#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validate latest daily_prices closes against TWSE MIS last quotes.

MIS is used here only as a post-fetch correctness check for price fields. We do
not read or store five-level order book fields.
"""
import datetime as dt
import os
import time

import requests

from sb_common import log, mark_status, sb_one, sb_select, sb_upsert

TIMEOUT = 30
MAX_SYMBOLS = int(os.environ.get("MIS_VALIDATE_MAX_SYMBOLS", "220"))
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


def parse_mis_date(v):
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


def latest_date():
    row = sb_one("daily_prices", "select=date&order=date.desc&limit=1")
    if not row:
        raise RuntimeError("daily_prices is empty")
    return str(row["date"])[:10]


def collect_symbols(latest):
    symbols = []
    seen = set()

    def add(sym):
        sym = str(sym or "").strip()
        if is_symbol(sym) and sym not in seen:
            seen.add(sym)
            symbols.append(sym)

    for table in ("daily_signals", "candidate_pool"):
        try:
            for row in sb_select(table, f"select=symbol&date=eq.{latest}", page_size=1000, max_rows=50000):
                add(row.get("symbol"))
        except Exception as exc:
            log(f"  {table} symbols skipped: {exc}")
    try:
        for row in sb_select("ai_positions", "select=symbol", page_size=1000, max_rows=10000):
            add(row.get("symbol"))
    except Exception as exc:
        log(f"  ai_positions symbols skipped: {exc}")
    try:
        rows = sb_select(
            "daily_prices",
            f"select=symbol&date=eq.{latest}&order=amount.desc",
            page_size=1000,
            max_rows=MAX_SYMBOLS,
        )
        for row in rows:
            add(row.get("symbol"))
            if len(symbols) >= MAX_SYMBOLS:
                break
    except Exception as exc:
        log(f"  high amount symbols skipped: {exc}")
    return symbols[:MAX_SYMBOLS]


def load_daily_rows(latest, symbols):
    out = {}
    for i in range(0, len(symbols), 80):
        part = symbols[i : i + 80]
        rows = sb_select(
            "daily_prices",
            "select=symbol,open,high,low,close,change,change_percent,market"
            f"&date=eq.{latest}&symbol=in.({','.join(part)})",
            page_size=1000,
            max_rows=5000,
        )
        for row in rows:
            sym = str(row.get("symbol") or "").strip()
            if is_symbol(sym):
                out[sym] = row
    return out


def load_market_map(symbols):
    out = {}
    for i in range(0, len(symbols), 80):
        part = symbols[i : i + 80]
        try:
            rows = sb_select(
                "stocks",
                f"select=symbol,market&symbol=in.({','.join(part)})",
                page_size=1000,
                max_rows=5000,
            )
            for row in rows:
                sym = str(row.get("symbol") or "").strip()
                mk = norm_market(row.get("market"))
                if is_symbol(sym) and mk:
                    out[sym] = mk
        except Exception as exc:
            log(f"  stocks market lookup skipped: {exc}")
    return out


def mis_token(sym, market):
    prefix = "otc" if norm_market(market) == "TPEX" else "tse"
    return f"{prefix}_{sym}.tw"


def fetch_mis_quotes(tokens):
    sess = requests.Session()
    sess.headers.update(HEADERS)
    try:
        sess.get("https://mis.twse.com.tw/stock/index?lang=zhHant", timeout=TIMEOUT)
    except Exception:
        pass
    out = {}
    for i in range(0, len(tokens), 45):
        part = tokens[i : i + 45]
        params = {
            "ex_ch": "|".join(t for _, t in part),
            "json": "1",
            "delay": "0",
            "_": str(int(time.time() * 1000)),
        }
        r = sess.get(
            "https://mis.twse.com.tw/stock/api/getStockInfo.jsp",
            params=params,
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            log(f"  MIS HTTP {r.status_code}")
            continue
        data = r.json()
        for item in data.get("msgArray", []) if isinstance(data, dict) else []:
            sym = str(item.get("c") or "").strip()
            if is_symbol(sym):
                out[sym] = item
        time.sleep(0.7)
    return out


def quote_patch(latest, daily, quote):
    qdate = parse_mis_date(quote.get("d"))
    if qdate and qdate != latest:
        return None, "stale"
    last = to_float(quote.get("z"))
    if last is None:
        return None, "empty"
    old_close = to_float(daily.get("close"))
    if old_close is not None and abs(old_close - last) <= 0.01:
        return None, "match"

    y = to_float(quote.get("y"))
    chg = round(last - y, 2) if y else daily.get("change")
    cp = round(chg / y * 100, 2) if y else daily.get("change_percent")
    return {
        "date": latest,
        "symbol": str(daily.get("symbol") or quote.get("c")).strip(),
        "open": to_float(quote.get("o")) or daily.get("open"),
        "high": to_float(quote.get("h")) or daily.get("high"),
        "low": to_float(quote.get("l")) or daily.get("low"),
        "close": last,
        "change": chg,
        "change_percent": cp,
        "market": daily.get("market"),
    }, "patched"


def main():
    log("=== validate_mis_quotes start ===")
    latest = latest_date()
    symbols = collect_symbols(latest)
    daily = load_daily_rows(latest, symbols)
    market_map = load_market_map(symbols)
    tokens = []
    for sym in symbols:
        row = daily.get(sym, {})
        market = row.get("market") or market_map.get(sym)
        tokens.append((sym, mis_token(sym, market)))

    quotes = fetch_mis_quotes(tokens)
    patches, skipped = [], {"match": 0, "stale": 0, "empty": 0, "missing": 0}
    examples = []
    for sym in symbols:
        if sym not in quotes or sym not in daily:
            skipped["missing"] += 1
            continue
        patch, state = quote_patch(latest, daily[sym], quotes[sym])
        if patch:
            patches.append(patch)
            if len(examples) < 12:
                examples.append(f"{sym}:{daily[sym].get('close')}->{patch['close']}")
        else:
            skipped[state] = skipped.get(state, 0) + 1

    written = sb_upsert("daily_prices", patches, on_conflict="date,symbol")
    msg = (
        f"date={latest}; checked={len(symbols)}; mis_returned={len(quotes)}; "
        f"corrected={written}; match={skipped.get('match',0)}; "
        f"stale={skipped.get('stale',0)}; empty={skipped.get('empty',0)}; "
        f"missing={skipped.get('missing',0)}"
    )
    if examples:
        msg += "; examples=" + ",".join(examples)
    mark_status("validate_mis_quotes", True, msg)
    log("  " + msg)
    log("=== validate_mis_quotes done ===")


if __name__ == "__main__":
    main()
