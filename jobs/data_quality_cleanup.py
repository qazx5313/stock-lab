#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Final data quality pass for stock-lab.

This job runs after the daily fetch / signal jobs. It does not invent market
data. It only:
  1. fills missing names from other real tables,
  2. keeps candidate/theme rows tied to symbols that have real price data,
  3. writes a compact quality summary to data_status.
"""
import datetime as dt
import json
import os
import re
import time
from collections import defaultdict

import requests


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
TIMEOUT = 30
RETRY = 3
MIN_CANDIDATES = int(os.environ.get("QUALITY_MIN_CANDIDATES", "40"))


def log(msg):
    print(f"[{dt.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def headers(write=False):
    h = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if write:
        h["Prefer"] = "resolution=merge-duplicates,return=minimal"
    return h


def require_env():
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY")


def rest_get(table, query="", page_size=1000, max_rows=200000):
    require_env()
    out, start = [], 0
    base = f"{SUPABASE_URL}/rest/v1/{table}"
    if query:
        base += "?" + query
    while True:
        h = headers()
        h["Range-Unit"] = "items"
        h["Range"] = f"{start}-{start + page_size - 1}"
        r = requests.get(base, headers=h, timeout=TIMEOUT)
        if r.status_code not in (200, 206):
            raise RuntimeError(f"GET {table} HTTP {r.status_code}: {r.text[:300]}")
        chunk = r.json()
        out.extend(chunk)
        if len(chunk) < page_size or len(out) >= max_rows:
            break
        start += page_size
    return out


def rest_one(table, query=""):
    rows = rest_get(table, query, page_size=1, max_rows=1)
    return rows[0] if rows else None


def rest_upsert(table, rows, on_conflict=None, batch=500):
    if not rows:
        return 0
    require_env()
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    total = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i : i + batch]
        for attempt in range(1, RETRY + 1):
            r = requests.post(url, headers=headers(True), data=json.dumps(chunk), timeout=TIMEOUT)
            if r.status_code in (200, 201, 204):
                total += len(chunk)
                break
            if attempt == RETRY:
                raise RuntimeError(f"UPSERT {table} HTTP {r.status_code}: {r.text[:300]}")
            time.sleep(attempt * 2)
    return total


def rest_patch(table, query, patch):
    require_env()
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    r = requests.patch(url, headers=headers(True), data=json.dumps(patch), timeout=TIMEOUT)
    if r.status_code not in (200, 204):
        raise RuntimeError(f"PATCH {table} HTTP {r.status_code}: {r.text[:300]}")
    return True


def mark_status(source, ok, error=""):
    rest_upsert(
        "data_status",
        [
            {
                "source": source,
                "ok": ok,
                "finished_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "error": (error or "")[:1000],
                "run_date": dt.date.today().isoformat(),
            }
        ],
    )


def is_symbol(v):
    return bool(re.match(r"^[1-9]\d{3}$", str(v or "").strip()))


def bad_name(v, symbol=None):
    s = str(v or "").strip()
    if not s:
        return True
    if symbol and s == str(symbol):
        return True
    return s in {"尚無名稱", "—", "-", "None", "null"}


def to_float(v):
    try:
        return float(v)
    except Exception:
        return None


def norm_theme_text(v):
    return re.sub(r"[ \t\r\n/／、,，()（）\[\]【】・·\-＿_]", "", str(v or "").lower())


def theme_aliases(name):
    n = norm_theme_text(name)
    out = {n} if n else set()
    groups = [
        ["玻纖布", "玻織布", "玻璃纖維布", "玻璃纖維", "玻纖", "玻璃玻纖"],
        ["pcb", "ccl", "銅箔基板", "電路板", "印刷電路板"],
        ["玻璃基板", "玻璃載板", "先進封裝玻璃"],
        ["ai伺服器", "伺服器", "aiserver", "ai"],
        ["散熱", "熱傳", "液冷", "散熱模組"],
        ["面板", "顯示器", "lcd"],
        ["營建", "建設", "營造", "建材"],
        ["航運", "貨櫃", "散裝", "航空"],
        ["生技醫療", "生技", "醫療", "製藥"],
        ["油電燃氣", "油電", "燃氣", "電力"],
        ["食品", "食物", "飲料"],
        ["半導體", "ic", "晶圓", "封測"],
    ]
    for group in ([norm_theme_text(x) for x in g] for g in groups):
        if any(x and (x in n or n in x) for x in group):
            out.update(x for x in group if x)
    return out


def theme_stock_matched(theme_name, stock_info, link_info):
    theme_name = re.sub(r"^(上市|上櫃)\s*[·・]\s*", "", str(theme_name or "").strip())
    if not theme_name or theme_name == "其他":
        return True
    tags = stock_info.get("theme_tags") or []
    if isinstance(tags, list):
        tags_text = " ".join(str(x) for x in tags)
    else:
        tags_text = str(tags or "")
    hay = norm_theme_text(
        " ".join(
            str(x or "")
            for x in [
                stock_info.get("industry"),
                tags_text,
                link_info.get("role"),
                link_info.get("supply_chain_level"),
                link_info.get("note"),
            ]
        )
    )
    if not hay:
        return False
    return any(a and (a in hay or hay in a) for a in theme_aliases(theme_name))


def latest_price_by_symbol(symbols, latest_date):
    if not symbols:
        return {}
    wanted = set(symbols)
    out = {}
    latest_rows = rest_get(
        "daily_prices",
        f"select=symbol,date,close,change_percent,amount,volume,market&date=eq.{latest_date}",
        page_size=1000,
    )
    for row in latest_rows:
        sym = str(row.get("symbol") or "")
        if sym in wanted and row.get("close") is not None:
            out[sym] = row
    missing = [s for s in symbols if s not in out]
    for i in range(0, len(missing), 100):
        part = ",".join(missing[i : i + 100])
        if not part:
            continue
        rows = rest_get(
            "daily_prices",
            f"select=symbol,date,close,change_percent,amount,volume,market&symbol=in.({part})&order=date.desc",
            page_size=1000,
        )
        for row in rows:
            sym = str(row.get("symbol") or "")
            if sym in wanted and sym not in out and row.get("close") is not None:
                out[sym] = row
    return out


def build_name_map():
    names = {}
    stocks = rest_get("stocks", "select=symbol,name,industry,market,theme_tags", page_size=1000)
    for row in stocks:
        sym = str(row.get("symbol") or "").strip()
        if is_symbol(sym) and not bad_name(row.get("name"), sym):
            names[sym] = {
                "name": str(row.get("name")).strip(),
                "industry": row.get("industry"),
                "market": row.get("market"),
                "theme_tags": row.get("theme_tags"),
            }

    for table, query, name_col in [
        ("candidate_pool", "select=symbol,name&order=date.desc", "name"),
        ("mops_announcements", "select=symbol,company_name&order=date.desc", "company_name"),
        ("ai_positions", "select=symbol,name", "name"),
    ]:
        try:
            rows = rest_get(table, query, page_size=1000, max_rows=50000)
        except Exception as exc:
            log(f"skip name source {table}: {exc}")
            continue
        for row in rows:
            sym = str(row.get("symbol") or "").strip()
            nm = str(row.get(name_col) or "").strip()
            if is_symbol(sym) and not bad_name(nm, sym) and sym not in names:
                names[sym] = {"name": nm, "industry": None, "market": None}
    return names


def fill_stock_names(name_map):
    rows = rest_get("stocks", "select=symbol,name,industry,market", page_size=1000)
    updates = []
    for row in rows:
        sym = str(row.get("symbol") or "").strip()
        if not is_symbol(sym):
            continue
        source = name_map.get(sym)
        if source and bad_name(row.get("name"), sym):
            updates.append(
                {
                    "symbol": sym,
                    "name": source["name"],
                    "industry": row.get("industry") or source.get("industry"),
                    "market": row.get("market") or source.get("market"),
                }
            )
    return rest_upsert("stocks", updates, on_conflict="symbol")


def upsert_known_stocks(symbols, name_map, price_map):
    rows = []
    for sym in sorted(set(symbols)):
        if not is_symbol(sym):
            continue
        source = name_map.get(sym) or {}
        if bad_name(source.get("name"), sym):
            continue
        price = price_map.get(sym) or {}
        rows.append(
            {
                "symbol": sym,
                "name": source["name"],
                "industry": source.get("industry"),
                "market": source.get("market") or price.get("market"),
                "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            }
        )
    return rest_upsert("stocks", rows, on_conflict="symbol")


def fill_daily_price_markets(latest):
    prices = rest_get(
        "daily_prices",
        f"select=symbol,market&date=eq.{latest}",
        page_size=1000,
        max_rows=100000,
    )
    missing = sorted({
        str(r.get("symbol") or "").strip()
        for r in prices
        if is_symbol(r.get("symbol")) and not str(r.get("market") or "").strip()
    })
    if not missing:
        return 0
    market_map = {}
    for i in range(0, len(missing), 100):
        part = ",".join(missing[i : i + 100])
        rows = rest_get("stocks", f"select=symbol,market&symbol=in.({part})", page_size=1000)
        for row in rows:
            sym = str(row.get("symbol") or "").strip()
            market = str(row.get("market") or "").strip().upper()
            if is_symbol(sym) and market:
                market_map[sym] = "TPEX" if market in {"TPEX", "OTC"} or "上櫃" in market else "TWSE"
    fixed = 0
    for sym, market in market_map.items():
        rest_patch("daily_prices", f"date=eq.{latest}&symbol=eq.{sym}", {"market": market})
        fixed += 1
    return fixed


def fill_candidate_names(latest, name_map):
    rows = rest_get(
        "candidate_pool",
        f"select=id,date,symbol,name,score,reason&date=eq.{latest}&order=score.desc",
        page_size=1000,
    )
    fixed = 0
    for row in rows:
        sym = str(row.get("symbol") or "").strip()
        source = name_map.get(sym)
        if is_symbol(sym) and source and bad_name(row.get("name"), sym):
            rest_patch("candidate_pool", f"id=eq.{row['id']}", {"name": source["name"]})
            fixed += 1
    return rows, fixed


def top_up_candidates(latest, existing_rows, name_map, price_map):
    existing = {str(r.get("symbol") or "") for r in existing_rows}
    if len(existing) >= MIN_CANDIDATES:
        return 0
    signals = rest_get(
        "daily_signals",
        f"select=date,symbol,final_score,summary,signal_tags&date=eq.{latest}&order=final_score.desc",
        page_size=1000,
    )
    rows = []
    for sig in signals:
        sym = str(sig.get("symbol") or "").strip()
        if sym in existing or sym not in price_map or not is_symbol(sym):
            continue
        nm = (name_map.get(sym) or {}).get("name")
        if bad_name(nm, sym):
            continue
        tags = sig.get("signal_tags") or []
        reason = "、".join(tags) if isinstance(tags, list) and tags else (sig.get("summary") or "")
        rows.append(
            {
                "date": latest,
                "symbol": sym,
                "name": nm,
                "source_module": "data_quality_cleanup",
                "candidate_type": "資料補齊",
                "reason": reason[:180],
                "score": sig.get("final_score") or 0,
            }
        )
        existing.add(sym)
        if len(existing) >= MIN_CANDIDATES:
            break
    return rest_upsert("candidate_pool", rows)


def normalize_theme_stocks(latest, name_map, price_map):
    themes = rest_get(
        "themes",
        "select=id,theme_name,description,heat_score,trend_status",
        page_size=1000,
        max_rows=100000,
    )
    theme_stocks = rest_get(
        "theme_stocks",
        "select=theme_id,symbol,role,supply_chain_level,relevance_score,note",
        page_size=1000,
        max_rows=100000,
    )
    by_theme = defaultdict(list)
    fixed = 0
    missing_name = set()
    missing_price = set()

    for row in theme_stocks:
        sym = str(row.get("symbol") or "").strip()
        if not is_symbol(sym):
            continue
        by_theme[row.get("theme_id")].append(row)
        if sym not in name_map:
            missing_name.add(sym)
        if sym not in price_map:
            missing_price.add(sym)
        patch = {}
        if not row.get("role"):
            patch["role"] = "成分"
        if not row.get("supply_chain_level"):
            patch["supply_chain_level"] = "關聯"
        if row.get("relevance_score") is None:
            patch["relevance_score"] = 60
        if patch:
            rest_patch(
                "theme_stocks",
                f"theme_id=eq.{row.get('theme_id')}&symbol=eq.{sym}",
                patch,
            )
            fixed += 1

    theme_updates = []
    for theme in themes:
        tid = theme.get("id")
        raw_members = by_theme.get(tid, [])
        members = [
            m
            for m in raw_members
            if theme_stock_matched(
                str(theme.get("theme_name") or ""),
                name_map.get(str(m.get("symbol") or "")) or {},
                m,
            )
        ]
        priced = [m for m in members if str(m.get("symbol") or "") in price_map]
        cps = []
        amounts = []
        for m in priced:
            px = price_map.get(str(m.get("symbol") or ""))
            cp = to_float(px.get("change_percent")) if px else None
            amt = to_float(px.get("amount")) if px else None
            if cp is not None:
                cps.append(cp)
            if amt is not None:
                amounts.append(amt)
        avg_cp = round(sum(cps) / len(cps), 2) if cps else None
        total_amt = int(sum(amounts)) if amounts else None
        status = theme.get("trend_status") or "觀察"
        heat = theme.get("heat_score")
        if avg_cp is not None:
            heat = max(0, min(100, round(50 + avg_cp * 8 + min(len(priced), 20))))
            status = "量增" if total_amt and total_amt > 0 else status
        desc = (
            f"{theme.get('theme_name')}：成分 {len(members)} 檔，"
            f"有收盤價 {len(priced)} 檔"
        )
        if len(raw_members) != len(members):
            desc += f"，排除不相符 {len(raw_members) - len(members)} 檔"
        if avg_cp is not None:
            desc += f"，平均漲幅 {avg_cp}%"
        if total_amt is not None:
            desc += f"，成交金額 {round(total_amt / 100000000, 2)} 億"
        theme_updates.append(
            {
                "id": tid,
                "theme_name": theme.get("theme_name"),
                "description": desc,
                "heat_score": heat,
                "trend_status": status,
                "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            }
        )
    updated = rest_upsert("themes", theme_updates, on_conflict="id")
    return {
        "theme_count": len(themes),
        "theme_stock_count": len(theme_stocks),
        "fixed_theme_stocks": fixed,
        "updated_themes": updated,
        "missing_theme_names": len(missing_name),
        "missing_theme_prices": len(missing_price),
    }


def market_quality(latest):
    prices = rest_get(
        "daily_prices",
        f"select=symbol,open,high,low,close,change,change_percent,volume,amount,market&date=eq.{latest}",
        page_size=1000,
    )
    up = down = flat = missing_close = missing_amount = 0
    twse_amount = tpex_amount = 0
    for row in prices:
        close = to_float(row.get("close"))
        cp = to_float(row.get("change_percent"))
        ch = to_float(row.get("change"))
        amt = to_float(row.get("amount"))
        if close is None:
            missing_close += 1
        if amt is None:
            missing_amount += 1
        elif str(row.get("market") or "").upper() == "TPEX":
            tpex_amount += amt
        else:
            twse_amount += amt
        move = cp if cp is not None else ch
        if move is None or move == 0:
            flat += 1
        elif move > 0:
            up += 1
        else:
            down += 1
    indexes = rest_get("market_index", f"select=market,index_value,change,change_percent&date=eq.{latest}", page_size=20)
    inst = rest_get("institutional_trades", f"select=symbol,total_buy_sell,foreign_buy_sell,investment_trust_buy_sell,dealer_buy_sell&date=eq.{latest}", page_size=1000)
    total_inst = sum(int(r.get("total_buy_sell") or 0) for r in inst)
    prev_date_row = rest_one("daily_prices", f"select=date&date=lt.{latest}&order=date.desc&limit=1")
    stale_duplicate_bars = 0
    if prev_date_row:
        prev_date = str(prev_date_row.get("date"))[:10]
        prev_rows = rest_get(
            "daily_prices",
            f"select=symbol,open,high,low,close,volume&date=eq.{prev_date}",
            page_size=1000,
        )
        prev_map = {str(r.get("symbol") or ""): r for r in prev_rows}
        for row in prices:
            prev = prev_map.get(str(row.get("symbol") or ""))
            if not prev:
                continue
            same = all(
                to_float(row.get(k)) == to_float(prev.get(k))
                for k in ["open", "high", "low", "close", "volume"]
            )
            if same:
                stale_duplicate_bars += 1
    return {
        "price_rows": len(prices),
        "missing_close": missing_close,
        "missing_amount": missing_amount,
        "up": up,
        "down": down,
        "flat": flat,
        "index_rows": len(indexes),
        "twse_amount_e": round(twse_amount / 100000000, 2),
        "tpex_amount_e": round(tpex_amount / 100000000, 2),
        "institutional_rows": len(inst),
        "institutional_total": total_inst,
        "stale_duplicate_bars": stale_duplicate_bars,
    }


def main():
    log("=== data_quality_cleanup start ===")
    newest = rest_one("daily_prices", "select=date&order=date.desc&limit=1")
    if not newest:
        mark_status("data_quality_cleanup", False, "daily_prices is empty")
        raise RuntimeError("daily_prices is empty")
    latest = str(newest["date"])[:10]
    log(f"latest trading date: {latest}")

    name_map = build_name_map()
    stock_name_fixed = fill_stock_names(name_map)

    candidates, candidate_name_fixed = fill_candidate_names(latest, name_map)
    candidate_symbols = [str(r.get("symbol") or "") for r in candidates if is_symbol(r.get("symbol"))]
    theme_symbols = [
        str(r.get("symbol") or "")
        for r in rest_get("theme_stocks", "select=symbol", page_size=1000)
        if is_symbol(r.get("symbol"))
    ]
    signal_symbols = [
        str(r.get("symbol") or "")
        for r in rest_get("daily_signals", f"select=symbol&date=eq.{latest}", page_size=1000)
        if is_symbol(r.get("symbol"))
    ]
    all_symbols = sorted(set(candidate_symbols + theme_symbols + signal_symbols))
    price_map = latest_price_by_symbol(all_symbols, latest)
    stock_rows_upserted = upsert_known_stocks(all_symbols, name_map, price_map)
    daily_market_fixed = fill_daily_price_markets(latest)

    candidate_added = top_up_candidates(latest, candidates, name_map, price_map)
    theme_summary = normalize_theme_stocks(latest, name_map, price_map)
    market = market_quality(latest)

    missing_candidate_names = sum(1 for s in candidate_symbols if s not in name_map)
    missing_candidate_prices = sum(1 for s in candidate_symbols if s not in price_map)

    summary = (
        f"date={latest}; "
        f"stock_name_fixed={stock_name_fixed}; "
        f"stock_rows_upserted={stock_rows_upserted}; "
        f"daily_market_fixed={daily_market_fixed}; "
        f"candidate_name_fixed={candidate_name_fixed}; "
        f"candidate_added={candidate_added}; "
        f"missing_candidate_names={missing_candidate_names}; "
        f"missing_candidate_prices={missing_candidate_prices}; "
        f"theme_stock_count={theme_summary['theme_stock_count']}; "
        f"missing_theme_names={theme_summary['missing_theme_names']}; "
        f"missing_theme_prices={theme_summary['missing_theme_prices']}; "
        f"price_rows={market['price_rows']}; "
        f"missing_close={market['missing_close']}; "
        f"missing_amount={market['missing_amount']}; "
        f"stale_duplicate_bars={market['stale_duplicate_bars']}; "
        f"up={market['up']}; down={market['down']}; flat={market['flat']}; "
        f"index_rows={market['index_rows']}; "
        f"twse_amount_e={market['twse_amount_e']}; "
        f"tpex_amount_e={market['tpex_amount_e']}; "
        f"institutional_rows={market['institutional_rows']}"
    )
    log(summary)

    ok = (
        market["price_rows"] > 0
        and market["missing_close"] < market["price_rows"]
        and theme_summary["theme_stock_count"] > 0
    )
    mark_status("data_quality_cleanup", ok, summary)
    log("=== data_quality_cleanup done ===")


if __name__ == "__main__":
    main()
