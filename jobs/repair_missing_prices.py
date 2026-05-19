#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Repair missing recent daily_prices rows using only official TWSE/TPEx sources.

FinMind is intentionally not used here. It is reserved for the AI quant lab.
"""
import datetime as dt
import os
import time

import requests

from sb_common import log, mark_status, sb_one, sb_select, sb_upsert

TIMEOUT = 45
REPAIR_LOOKBACK_DAYS = int(os.environ.get("REPAIR_LOOKBACK_DAYS", "3"))
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


def is_symbol(v):
    s = str(v or "").strip()
    return len(s) == 4 and s.isdigit() and s[0] != "0"


def to_float(v):
    try:
        if v is None or v == "":
            return None
        return float(str(v).replace(",", ""))
    except Exception:
        return None


def to_int(v):
    n = to_float(v)
    return int(n) if n is not None else None


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


def http_json(url, params=None):
    r = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
    time.sleep(1)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {url}")
    return r.json()


def latest_date():
    row = sb_one("daily_prices", "select=date&order=date.desc&limit=1")
    if not row:
        raise RuntimeError("daily_prices is empty")
    return str(row["date"])[:10]


def recent_trade_dates(limit):
    rows = sb_select("daily_prices", "select=date&order=date.desc", page_size=1000, max_rows=10000)
    out, seen = [], set()
    for row in rows:
        d = str(row.get("date") or "")[:10]
        if d and d not in seen:
            seen.add(d)
            out.append(d)
        if len(out) >= limit:
            break
    return out


def collect_target_symbols(latest):
    symbols = set()
    for table in ("candidate_pool", "daily_signals"):
        for row in sb_select(table, f"select=symbol&date=eq.{latest}", page_size=1000, max_rows=50000):
            sym = str(row.get("symbol") or "").strip()
            if is_symbol(sym):
                symbols.add(sym)
    try:
        for row in sb_select("ai_positions", "select=symbol", page_size=1000, max_rows=10000):
            sym = str(row.get("symbol") or "").strip()
            if is_symbol(sym):
                symbols.add(sym)
    except Exception as exc:
        log(f"  ai_positions lookup skipped: {exc}")
    return sorted(symbols)


def existing_symbols_by_date(dates):
    out = {d: set() for d in dates}
    for d in dates:
        rows = sb_select(
            "daily_prices",
            f"select=symbol,close&date=eq.{d}",
            page_size=1000,
            max_rows=50000,
        )
        out[d] = {
            str(r.get("symbol") or "").strip()
            for r in rows
            if is_symbol(r.get("symbol")) and r.get("close") is not None
        }
    return out


def official_twse_rows():
    data = http_json("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL")
    rows = []
    if not isinstance(data, list):
        return rows
    for item in data:
        sym = str(item.get("Code") or "").strip()
        close = to_float(item.get("ClosingPrice"))
        row_date = parse_roc_or_ymd(item.get("Date"))
        if not is_symbol(sym) or close is None or not row_date:
            continue
        chg = to_float(item.get("Change"))
        prev = close - chg if chg is not None else None
        rows.append({
            "date": row_date.isoformat(),
            "symbol": sym,
            "open": to_float(item.get("OpeningPrice")),
            "high": to_float(item.get("HighestPrice")),
            "low": to_float(item.get("LowestPrice")),
            "close": close,
            "change": chg,
            "change_percent": round(chg / prev * 100, 2) if prev else None,
            "volume": to_int(item.get("TradeVolume")),
            "amount": to_int(item.get("TradeValue")),
            "turnover_rate": None,
            "market": "TWSE",
        })
    return rows


def official_tpex_rows():
    data = http_json("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes")
    rows = []
    if not isinstance(data, list):
        return rows
    for item in data:
        sym = str(item.get("SecuritiesCompanyCode") or item.get("Code") or "").strip()
        close = to_float(item.get("Close"))
        row_date = parse_roc_or_ymd(item.get("Date"))
        if not is_symbol(sym) or close is None or not row_date:
            continue
        chg = to_float(item.get("Change"))
        prev = close - chg if chg is not None else None
        rows.append({
            "date": row_date.isoformat(),
            "symbol": sym,
            "open": to_float(item.get("Open")),
            "high": to_float(item.get("High")),
            "low": to_float(item.get("Low")),
            "close": close,
            "change": chg,
            "change_percent": round(chg / prev * 100, 2) if prev else None,
            "volume": to_int(item.get("TradingShares")),
            "amount": to_int(item.get("TransactionAmount")),
            "turnover_rate": None,
            "market": "TPEX",
        })
    return rows


def main():
    log("=== repair_missing_prices official-only start ===")
    latest = latest_date()
    dates = recent_trade_dates(max(1, REPAIR_LOOKBACK_DAYS)) or [latest]
    targets = collect_target_symbols(latest)
    existing_by_date = existing_symbols_by_date(dates)
    missing_pairs = {
        (d, sym)
        for d in dates
        for sym in targets
        if sym not in existing_by_date.get(d, set())
    }

    rows = []
    try:
        rows.extend(official_twse_rows())
    except Exception as exc:
        log(f"  TWSE official repair skipped: {exc}")
    try:
        rows.extend(official_tpex_rows())
    except Exception as exc:
        log(f"  TPEX official repair skipped: {exc}")

    matched = []
    repaired = set()
    for row in rows:
        pair = (str(row.get("date") or "")[:10], str(row.get("symbol") or "").strip())
        if pair in missing_pairs:
            matched.append(row)
            repaired.add(pair)

    written = sb_upsert("daily_prices", matched, on_conflict="date,symbol")
    still_missing = sorted(missing_pairs - repaired)
    msg = (
        f"dates={','.join(dates)}; targets={len(targets)}; "
        f"official_repaired={written}; still_missing={len(still_missing)}"
    )
    if still_missing:
        msg += "; examples=" + ",".join(f"{d}:{s}" for d, s in still_missing[:20])
    mark_status("repair_missing_prices", True, msg)
    log("  " + msg)
    log("=== repair_missing_prices official-only done ===")


if __name__ == "__main__":
    main()
