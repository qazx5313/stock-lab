#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fetch intraday quotes from TWSE MIS into realtime_quotes.

This job is intentionally separated from daily_prices:
  - 09:15 and hourly runs update realtime_quotes only.
  - runs at/after 13:30 Taiwan time also upsert daily_prices as the close snapshot.
"""
import datetime as dt
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
    txf = latest_txf_fallback()
    if txf and txf.get("price") is not None:
        rows.append(txf)
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
