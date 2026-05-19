#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fetch same-day stock quote fields from TWSE MIS.

This job fills the daily OHLC close shortly after 13:30 using only the fields
shown in the MIS stock page summary: quote time, last price, change, volume,
open, high and low. Five-level order book fields are intentionally ignored.
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


def parse_roc_or_ymd(v):
    s = str(v or "").strip().replace("/", "").replace("-", "")
    try:
        if len(s) == 7:
            return dt.date(int(s[:3]) + 1911, int(s[3:5]), int(s[5:7]))
        if len(s) == 8:
            return dt.date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except Exception:
        return None
    return None


def collect_from_official_lists():
    out = {}
    try:
        data = http_json("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL")
        for item in data if isinstance(data, list) else []:
            sym = str(item.get("Code") or "").strip()
            if is_symbol(sym):
                out[sym] = {"symbol": sym, "name": item.get("Name"), "market": "TWSE"}
    except Exception as exc:
        log(f"  TWSE symbol list skipped: {exc}")
    try:
        data = http_json("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes")
        for item in data if isinstance(data, list) else []:
            sym = str(item.get("SecuritiesCompanyCode") or item.get("Code") or "").strip()
            name = item.get("CompanyName") or item.get("Name")
            if is_symbol(sym):
                out[sym] = {"symbol": sym, "name": name, "market": "TPEX"}
    except Exception as exc:
        log(f"  TPEX symbol list skipped: {exc}")
    return out


def collect_from_database():
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
        log(f"  stocks fallback skipped: {exc}")
    return out


def token(row):
    prefix = "otc" if norm_market(row.get("market")) == "TPEX" else "tse"
    return f"{prefix}_{row['symbol']}.tw"


def fetch_quotes(symbol_rows):
    sess = requests.Session()
    sess.headers.update(HEADERS)
    try:
        sess.get("https://mis.twse.com.tw/stock/index?lang=zhHant", timeout=TIMEOUT)
    except Exception:
        pass
    items = list(symbol_rows.values())
    quotes = []
    for i in range(0, len(items), 45):
        part = items[i : i + 45]
        params = {
            "ex_ch": "|".join(token(row) for row in part),
            "json": "1",
            "delay": "0",
            "_": str(int(time.time() * 1000)),
        }
        try:
            data = http_json("https://mis.twse.com.tw/stock/api/getStockInfo.jsp", params=params, session=sess)
        except Exception as exc:
            log(f"  MIS chunk {i // 45 + 1} skipped: {exc}")
            continue
        quotes.extend(data.get("msgArray", []) if isinstance(data, dict) else [])
        time.sleep(0.45)
    return quotes


def quote_to_rows(q, fallback):
    sym = str(q.get("c") or "").strip()
    if not is_symbol(sym):
        return None, None
    close = to_float(q.get("z"))
    qdate = parse_date(q.get("d"))
    if close is None or not qdate:
        return None, None
    prev = to_float(q.get("y"))
    change = round(close - prev, 2) if prev else None
    change_percent = round(change / prev * 100, 2) if prev and change is not None else None
    market = "TPEX" if str(q.get("ex") or "").lower() == "otc" else "TWSE"
    volume_lots = to_int(q.get("v"))
    price_row = {
        "date": qdate,
        "symbol": sym,
        "close": close,
        "market": market,
    }
    optional = {
        "open": to_float(q.get("o")),
        "high": to_float(q.get("h")),
        "low": to_float(q.get("l")),
        "change": change,
        "change_percent": change_percent,
        "volume": volume_lots * 1000 if volume_lots is not None else None,
    }
    price_row.update({k: v for k, v in optional.items() if v is not None})
    stock_row = {
        "symbol": sym,
        "market": market,
    }
    name = q.get("n") or fallback.get("name")
    if name:
        stock_row["name"] = name
    return price_row, stock_row


def main():
    log("=== fetch_mis_daily_prices start ===")
    symbols = collect_from_official_lists()
    if len(symbols) < 1000:
        symbols.update({k: v for k, v in collect_from_database().items() if k not in symbols})
    quotes = fetch_quotes(symbols)
    price_rows, stock_rows = [], []
    for q in quotes:
        sym = str(q.get("c") or "").strip()
        price_row, stock_row = quote_to_rows(q, symbols.get(sym, {}))
        if price_row:
            price_rows.append(price_row)
        if stock_row:
            stock_rows.append(stock_row)
    sb_upsert("stocks", stock_rows, on_conflict="symbol")
    written = sb_upsert("daily_prices", price_rows, on_conflict="date,symbol")
    latest = max((r["date"] for r in price_rows), default="—")
    msg = f"symbols={len(symbols)}; mis_returned={len(quotes)}; written={written}; latest={latest}; fields=time,z,change,volume,open,high,low"
    mark_status("fetch_mis_daily_prices", bool(written), "" if written else msg)
    log("  " + msg)
    log("=== fetch_mis_daily_prices done ===")


if __name__ == "__main__":
    main()
