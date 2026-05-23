#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fetch intraday quotes from TWSE MIS into realtime_quotes.

This job is intentionally separated from daily_prices:
  - 09:15 and hourly runs update realtime_quotes only.
  - runs at/after 13:30 Taiwan time also upsert daily_prices as the close snapshot.
"""
import datetime as dt
import json
import random
import string
import time

import requests

from sb_common import log, mark_status, sb_select, sb_upsert

TIMEOUT = 35
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Referer": "https://mis.twse.com.tw/stock/index?lang=zhHant",
}
MIS_URL = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp"
MIS_BOOT = "https://mis.twse.com.tw/stock/index?lang=zhHant"
MIS_CHART_URLS = {
    "TWSE_CHART": "https://mis.twse.com.tw/stock/data/mis_ohlc_TSE.txt",
    "TPEX_CHART": "https://mis.twse.com.tw/stock/data/mis_ohlc_OTC.txt",
}
TAIFEX_AFTER_HOURS = "https://mis.taifex.com.tw/futures/AfterHoursSession/EquityIndices/FuturesDomestic/"
TAIFEX_REGULAR = "https://mis.taifex.com.tw/futures/RegularSession/EquityIndices/FuturesDomestic/"
TAIFEX_SEARCH = "https://mis.taifex.com.tw/futures/api/getSearchResult"
TAIFEX_WS_BASE = "wss://mis.taifex.com.tw/futures/rt"
REALTIME_KEYS = [
    "symbol", "name", "market", "quote_date", "quote_time",
    "open", "high", "low", "price", "prev_close", "change",
    "change_percent", "volume", "amount", "source", "updated_at",
]


def is_symbol(v):
    s = str(v or "").strip()
    return len(s) == 4 and s.isdigit() and s[0] != "0"


def to_float(v):
    s = str(v or "").replace(",", "").strip()
    if s in ("", "-", "--", "NaN", "null"):
        return None
    try:
        return float(s)
    except Exception:
        return None


def to_int(v):
    n = to_float(v)
    return int(n) if n is not None else None


def parse_date(v):
    s = str(v or "").strip().replace("/", "").replace("-", "")
    try:
        if len(s) == 8:
            return dt.date(int(s[:4]), int(s[4:6]), int(s[6:8])).isoformat()
    except Exception:
        return None
    return None


def parse_taifex_time(v):
    s = str(v or "").strip()
    if len(s) == 6 and s.isdigit():
        return f"{s[:2]}:{s[2:4]}:{s[4:]}"
    return s or None


def norm_market(v):
    s = str(v or "").upper()
    if s in ("TPEX", "OTC") or "上櫃" in s or "櫃買" in s:
        return "TPEX"
    if s in ("TWSE", "TSE") or "上市" in s:
        return "TWSE"
    return ""


def http_json(url, params=None, session=None):
    client = session or requests
    r = client.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {url}")
    return r.json()


def taifex_headers(referer):
    return {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": referer,
        "Origin": "https://mis.taifex.com.tw",
        "Content-Type": "application/json; charset=utf-8",
    }


def collect_symbols():
    out = {}
    try:
        for row in sb_select("stocks", "select=symbol,name,market", page_size=1000, max_rows=50000):
            sym = str(row.get("symbol") or "").strip()
            if is_symbol(sym):
                out[sym] = {
                    "symbol": sym,
                    "name": row.get("name"),
                    "market": norm_market(row.get("market")) or "TWSE",
                }
    except Exception as exc:
        log(f"  stocks list skipped: {exc}")
    return out


def token(row):
    return f"{'otc' if norm_market(row.get('market')) == 'TPEX' else 'tse'}_{row['symbol']}.tw"


def fetch_mis(tokens, chunk_size=45, sleep_sec=0.38):
    sess = requests.Session()
    sess.headers.update(HEADERS)
    try:
        sess.get(MIS_BOOT, timeout=TIMEOUT)
    except Exception:
        pass
    quotes = []
    for i in range(0, len(tokens), chunk_size):
        part = tokens[i : i + chunk_size]
        params = {
            "ex_ch": "|".join(part),
            "json": "1",
            "delay": "0",
            "_": str(int(time.time() * 1000)),
        }
        try:
            data = http_json(MIS_URL, params=params, session=sess)
            quotes.extend(data.get("msgArray", []) if isinstance(data, dict) else [])
        except Exception as exc:
            log(f"  MIS chunk {i // chunk_size + 1} skipped: {exc}")
        time.sleep(sleep_sec)
    return quotes


def fetch_mis_index_charts(session=None):
    sess = session or requests.Session()
    rows = []
    for market, url in MIS_CHART_URLS.items():
        try:
            r = sess.get(
                url,
                params={"_": str(int(time.time() * 1000))},
                headers=HEADERS,
                timeout=TIMEOUT,
            )
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}")
            data = json.loads((r.text or "").strip())
            points = []
            for p in data.get("ohlcArray") or []:
                price = to_float(p.get("c"))
                ts = str(p.get("ts") or "").strip()
                amount_e = to_float(p.get("s"))
                if price is None or not ts:
                    continue
                points.append({
                    "t": ts,
                    "p": price,
                    "a": round(amount_e / 100, 2) if amount_e is not None else None,
                })
            if not points:
                continue
            static = data.get("staticObj") or {}
            qdate = parse_date(str(static.get("key") or "").split("_")[-1]) or dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().isoformat()
            amount = to_int(static.get("tz"))
            volume = to_int(static.get("tv"))
            last = points[-1]
            rows.append({
                "symbol": "T00_CHART" if market == "TWSE_CHART" else "O00_CHART",
                "name": "加權指數今日走勢" if market == "TWSE_CHART" else "櫃買指數今日走勢",
                "market": market,
                "quote_date": qdate,
                "quote_time": parse_taifex_time(last.get("t")),
                "open": points[0].get("p"),
                "high": max(p["p"] for p in points),
                "low": min(p["p"] for p in points),
                "price": last.get("p"),
                "prev_close": None,
                "change": None,
                "change_percent": None,
                "volume": volume,
                "amount": amount,
                "source": json.dumps({"points": points[-260:], "static": static}, ensure_ascii=False, separators=(",", ":")),
                "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            })
            log(f"  {market}: chart_points={len(points)} amount={amount}")
        except Exception as exc:
            log(f"  {market} chart skipped: {exc}")
    return rows


def quote_row(q, fallback=None):
    fallback = fallback or {}
    sym = str(q.get("c") or "").strip()
    qdate = parse_date(q.get("d"))
    price = to_float(q.get("z"))
    if not sym or not qdate or price is None:
        return None
    prev = to_float(q.get("y"))
    change = round(price - prev, 2) if prev is not None else None
    change_percent = round(change / prev * 100, 2) if prev not in (None, 0) and change is not None else None
    ex = str(q.get("ex") or "").lower()
    if sym == "t00":
        market = "TWSE_INDEX"
        symbol = "T00"
        name = "加權指數"
    elif sym == "o00":
        market = "TPEX_INDEX"
        symbol = "O00"
        name = "櫃買指數"
    else:
        market = "TPEX" if ex == "otc" else "TWSE"
        symbol = sym
        name = q.get("n") or fallback.get("name") or sym
    volume_lots = to_int(q.get("v") or q.get("m"))
    return {
        "symbol": symbol,
        "name": name,
        "market": market,
        "quote_date": qdate,
        "quote_time": str(q.get("t") or q.get("%") or "").strip() or None,
        "open": to_float(q.get("o")),
        "high": to_float(q.get("h")),
        "low": to_float(q.get("l")),
        "price": price,
        "prev_close": prev,
        "change": change,
        "change_percent": change_percent,
        "volume": volume_lots * 1000 if volume_lots is not None and market in ("TWSE", "TPEX") else volume_lots,
        "amount": None,
        "source": "TWSE_MIS",
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def daily_price_row(r):
    if r.get("market") not in ("TWSE", "TPEX"):
        return None
    return {
        "date": r["quote_date"],
        "symbol": r["symbol"],
        "open": r.get("open"),
        "high": r.get("high"),
        "low": r.get("low"),
        "close": r.get("price"),
        "change": r.get("change"),
        "change_percent": r.get("change_percent"),
        "volume": r.get("volume"),
        "market": r.get("market"),
    }


def should_write_daily(now_tw):
    return now_tw.hour > 13 or (now_tw.hour == 13 and now_tw.minute >= 30)


def normalize_realtime_row(row):
    return {k: row.get(k) for k in REALTIME_KEYS}


def is_taifex_day_session(now_tw):
    if now_tw.weekday() > 4:
        return False
    hm = now_tw.hour * 100 + now_tw.minute
    return 845 <= hm <= 1330


def taifex_session_plan(now_tw):
    if is_taifex_day_session(now_tw):
        return "day", "0", "-F", TAIFEX_REGULAR
    return "night", "1", "-M", TAIFEX_AFTER_HOURS


def taifex_search_txf(session, referer, keyword="\u81fa\u6307\u671f"):
    session.get(referer, timeout=TIMEOUT)
    body = json.dumps({"KeyWord": keyword}, ensure_ascii=False).encode("utf-8")
    r = session.post(TAIFEX_SEARCH, data=body, headers=taifex_headers(referer), timeout=TIMEOUT)
    if r.status_code != 200:
        raise RuntimeError(f"TAIFEX search HTTP {r.status_code}")
    data = r.json()
    if str(data.get("RtCode")) != "0":
        raise RuntimeError(f"TAIFEX search {data.get('RtMsg')}")
    return data.get("RtData") or []


def taifex_sockjs_messages(symbols, referer, timeout_sec=9):
    import websocket

    session_id = "".join(random.choice(string.ascii_letters + string.digits) for _ in range(8))
    url = f"{TAIFEX_WS_BASE}/000/{session_id}/websocket"
    ws = websocket.create_connection(
        url,
        timeout=timeout_sec,
        origin="https://mis.taifex.com.tw",
        header=[f"Referer: {referer}"],
    )
    try:
        first = ws.recv()
        if first != "o":
            log(f"  TAIFEX unexpected open frame: {first[:80]}")
        payload = json.dumps({"type": "subscribe", "symbols": symbols}, separators=(",", ":"))
        ws.send(json.dumps([payload], separators=(",", ":")))
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            try:
                raw = ws.recv()
            except Exception:
                break
            if not raw or raw == "h":
                continue
            if raw.startswith("a"):
                try:
                    for item in json.loads(raw[1:]):
                        yield json.loads(item)
                except Exception as exc:
                    log(f"  TAIFEX frame parse skipped: {exc}")
    finally:
        try:
            ws.close()
        except Exception:
            pass


def taifex_quote_score(values):
    return (
        to_int(values.get("404")) or to_int(values.get("258")) or 0,
        to_float(values.get("125")) or to_float(values.get("257")) or 0,
    )


def taifex_quote_to_row(symbol, values):
    qdate = parse_date(values.get("144"))
    price = to_float(values.get("125")) or to_float(values.get("257"))
    ref = to_float(values.get("129"))
    if not qdate or price is None:
        return None
    change = round(price - ref, 2) if ref is not None else None
    change_percent = round(change / ref * 100, 2) if ref not in (None, 0) and change is not None else None
    return {
        "symbol": "TXF",
        "name": f"台指期 {symbol}",
        "market": "TAIFEX",
        "quote_date": qdate,
        "quote_time": parse_taifex_time(values.get("143") or values.get("880")),
        "open": to_float(values.get("126")),
        "high": to_float(values.get("130")),
        "low": to_float(values.get("131")),
        "price": price,
        "prev_close": ref,
        "change": change,
        "change_percent": change_percent,
        "volume": to_int(values.get("404")) or to_int(values.get("258")),
        "amount": None,
        "source": "TAIFEX_MIS_RT",
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def taifex_vix_to_row(symbol, values):
    qdate = parse_date(values.get("144"))
    price = to_float(values.get("125")) or to_float(values.get("257"))
    ref = to_float(values.get("129"))
    if not qdate or price is None:
        return None
    change = round(price - ref, 2) if ref is not None else None
    change_percent = round(change / ref * 100, 2) if ref not in (None, 0) and change is not None else None
    return {
        "symbol": "TAIWANVIX",
        "name": "臺指選擇權波動率指數",
        "market": "TAIFEX",
        "quote_date": qdate,
        "quote_time": parse_taifex_time(values.get("143") or values.get("880")),
        "open": to_float(values.get("126")),
        "high": to_float(values.get("130")),
        "low": to_float(values.get("131")),
        "price": price,
        "prev_close": ref,
        "change": change,
        "change_percent": change_percent,
        "volume": to_int(values.get("404")) or to_int(values.get("258")),
        "amount": None,
        "source": "TAIFEX_VIX_RT",
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def fetch_taifex_vix():
    try:
        sess = requests.Session()
        sess.headers.update({"User-Agent": HEADERS["User-Agent"]})
        referer = "https://mis.taifex.com.tw/futures/VolatilityQuotes"
        rows = taifex_search_txf(sess, referer, "VIX")
        symbols = [
            r.get("SymbolID")
            for r in rows
            if r.get("Level1ID") == "4" and r.get("SymbolID")
        ]
        symbols = [s for s in symbols if s][:5]
        if not symbols:
            return None
        by_symbol = {s: {} for s in symbols}
        for msg in taifex_sockjs_messages(symbols, referer):
            if msg.get("type") != "quote":
                continue
            quote = msg.get("quote") or {}
            symbol = quote.get("symbol")
            if symbol in by_symbol:
                by_symbol[symbol].update(quote.get("values") or {})
        for symbol, values in by_symbol.items():
            row = taifex_vix_to_row(symbol, values)
            if row:
                log(f"  TAIFEX VIX {symbol} price={row.get('price')} change={row.get('change')}")
                return row
        return None
    except Exception as exc:
        log(f"  TAIFEX VIX realtime skipped: {exc}")
        return None


def fetch_taifex_txf(now_tw):
    try:
        sess = requests.Session()
        sess.headers.update({"User-Agent": HEADERS["User-Agent"]})
        session_key, level_id, suffix, referer = taifex_session_plan(now_tw)
        rows = taifex_search_txf(sess, referer)
        symbols = [
            r.get("SymbolID")
            for r in rows
            if r.get("Level1ID") == level_id
            and r.get("KindID") == "1"
            and r.get("SymbolType") == "F"
            and r.get("CID") == "TXF"
            and str(r.get("SymbolID") or "").endswith(suffix)
        ]
        symbols = [s for s in symbols if s and s not in ("TXF-S", "TXF-P")][:8]
        if not symbols:
            log(f"  TAIFEX TXF {session_key} no symbols from fixed session")
            return None
        by_symbol = {s: {} for s in symbols}
        for msg in taifex_sockjs_messages(symbols, referer):
            if msg.get("type") != "quote":
                continue
            quote = msg.get("quote") or {}
            symbol = quote.get("symbol")
            if symbol in by_symbol:
                by_symbol[symbol].update(quote.get("values") or {})
        best_symbol, best_values = None, None
        for symbol, values in by_symbol.items():
            row = taifex_quote_to_row(symbol, values)
            if not row:
                continue
            if best_values is None or taifex_quote_score(values) > taifex_quote_score(best_values):
                best_symbol, best_values = symbol, values
        if best_symbol and best_values:
            row = taifex_quote_to_row(best_symbol, best_values)
            row["source"] = "TAIFEX_MIS_RT_DAY" if session_key == "day" else "TAIFEX_MIS_RT_NIGHT"
            log(f"  TAIFEX TXF {session_key} {best_symbol} price={row.get('price')} change={row.get('change')} vol={row.get('volume')}")
            return row
        return None
    except Exception as exc:
        log(f"  TAIFEX TXF realtime skipped: {exc}")
        return None


def latest_txf_fallback():
    try:
        rows = sb_select(
            "market_index",
            "select=date,index_value,change,change_percent&market=eq.TXF&order=date.desc&limit=1",
            page_size=1,
            max_rows=1,
        )
        if not rows:
            return None
        r = rows[0]
        return {
            "symbol": "TXF",
            "name": "台指期",
            "market": "TAIFEX",
            "quote_date": str(r.get("date"))[:10],
            "quote_time": None,
            "open": None,
            "high": None,
            "low": None,
            "price": to_float(r.get("index_value")),
            "prev_close": None,
            "change": to_float(r.get("change")),
            "change_percent": to_float(r.get("change_percent")),
            "volume": None,
            "amount": None,
            "source": "TAIFEX_OPENAPI_EOD",
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }
    except Exception as exc:
        log(f"  TXF fallback skipped: {exc}")
        return None


def main():
    log("=== fetch_realtime_quotes start ===")
    now_tw = dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
    symbols = collect_symbols()
    tokens = ["tse_t00.tw", "otc_o00.tw"] + [token(row) for row in symbols.values()]
    quotes = fetch_mis(tokens)
    rows, stock_rows = [], []
    for q in quotes:
        raw_sym = str(q.get("c") or "").strip()
        r = quote_row(q, symbols.get(raw_sym, {}))
        if not r:
            continue
        rows.append(r)
        if r["market"] in ("TWSE", "TPEX"):
            stock_rows.append({"symbol": r["symbol"], "name": r["name"], "market": r["market"], "updated_at": r["updated_at"]})
    chart_rows = fetch_mis_index_charts()
    rows.extend(chart_rows)
    txf = fetch_taifex_txf(now_tw) or latest_txf_fallback()
    if txf and txf.get("price") is not None:
        rows.append(txf)
    vix = fetch_taifex_vix()
    if vix and vix.get("price") is not None:
        rows.append(vix)
    rows = [normalize_realtime_row(r) for r in rows]
    sb_upsert("stocks", stock_rows, on_conflict="symbol")
    written = sb_upsert("realtime_quotes", rows, on_conflict="symbol,market")
    daily_written = 0
    if should_write_daily(now_tw):
        daily_rows = [x for x in (daily_price_row(r) for r in rows) if x]
        daily_written = sb_upsert("daily_prices", daily_rows, on_conflict="date,symbol")
    latest = max((r["quote_date"] for r in rows), default="—")
    msg = f"quotes={len(rows)} stocks={len(stock_rows)} daily_close_written={daily_written} latest={latest} time={now_tw:%H:%M}"
    mark_status("fetch_realtime_quotes", bool(written), "" if written else msg)
    log("  " + msg)
    log("=== fetch_realtime_quotes done ===")


if __name__ == "__main__":
    main()
