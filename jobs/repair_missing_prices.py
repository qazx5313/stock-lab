#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Repair missing recent daily_prices rows for symbols used by the app.

Official broad daily APIs can be incomplete for some symbols when the workflow
runs. This job checks app-visible symbols over the latest few trading dates and
uses FinMind TaiwanStockPrice only to fill missing real K bars.
"""
import os
import time

import requests

from sb_common import log, mark_status, sb_one, sb_select, sb_upsert

FINMIND_TOKEN = os.environ.get("FINMIND_TOKEN", "").strip()
FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"
TIMEOUT = 45
REPAIR_MAX_SYMBOLS = int(os.environ.get("REPAIR_MAX_SYMBOLS", "800"))
REPAIR_LOOKBACK_DAYS = int(os.environ.get("REPAIR_LOOKBACK_DAYS", "3"))
SLEEP_SEC = float(os.environ.get("REPAIR_SLEEP_SEC", "0.35"))


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

    for row in sb_select("theme_stocks", "select=symbol", page_size=1000, max_rows=50000):
        sym = str(row.get("symbol") or "").strip()
        if is_symbol(sym):
            symbols.add(sym)

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


def stock_market_map(symbols):
    out = {}
    symbols = sorted({str(s or "").strip() for s in symbols if is_symbol(s)})
    for i in range(0, len(symbols), 100):
        part = ",".join(symbols[i : i + 100])
        if not part:
            continue
        try:
            rows = sb_select("stocks", f"select=symbol,market&symbol=in.({part})", page_size=1000, max_rows=1000)
            for row in rows:
                sym = str(row.get("symbol") or "").strip()
                market = str(row.get("market") or "").strip().upper()
                if sym and market:
                    out[sym] = "TPEX" if market in {"TPEX", "OTC"} or "上櫃" in market else "TWSE"
        except Exception as exc:
            log(f"  stocks market lookup skipped: {exc}")
    return out


def fetch_finmind_price(symbol, target_date):
    headers = {}
    if FINMIND_TOKEN:
        headers["Authorization"] = f"Bearer {FINMIND_TOKEN}"
    params = {
        "dataset": "TaiwanStockPrice",
        "data_id": symbol,
        "start_date": target_date,
        "end_date": target_date,
    }
    r = requests.get(FINMIND_URL, params=params, headers=headers, timeout=TIMEOUT)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:160]}")
    data = r.json()
    if data.get("status") != 200:
        raise RuntimeError(f"FinMind status={data.get('status')} msg={data.get('msg')}")
    rows = data.get("data") or []
    for item in rows:
        if str(item.get("date"))[:10] == target_date and str(item.get("stock_id")) == symbol:
            close = to_float(item.get("close"))
            change = to_float(item.get("spread"))
            prev = close - change if close is not None and change is not None else None
            return {
                "date": target_date,
                "symbol": symbol,
                "open": to_float(item.get("open")),
                "high": to_float(item.get("max")),
                "low": to_float(item.get("min")),
                "close": close,
                "change": change,
                "change_percent": round(change / prev * 100, 2) if prev else None,
                "volume": to_int(item.get("Trading_Volume")),
                "amount": to_int(item.get("Trading_money")),
                "turnover_rate": to_float(item.get("Trading_turnover")),
            }
    return None


def main():
    log("=== repair_missing_prices start ===")
    if not FINMIND_TOKEN:
        log("  FINMIND_TOKEN not set; anonymous quota may be limited")

    latest = latest_date()
    dates = recent_trade_dates(max(1, REPAIR_LOOKBACK_DAYS)) or [latest]
    targets = collect_target_symbols(latest)
    existing_by_date = existing_symbols_by_date(dates)
    missing_pairs = [
        (d, sym)
        for d in dates
        for sym in targets
        if sym not in existing_by_date.get(d, set())
    ]

    if REPAIR_MAX_SYMBOLS > 0:
        missing_pairs = missing_pairs[:REPAIR_MAX_SYMBOLS]

    markets = stock_market_map([sym for _, sym in missing_pairs])
    log(f"  dates={','.join(dates)} app_symbols={len(targets)} missing_pairs={len(missing_pairs)}")

    rows, failed = [], []
    for i, (target_date, sym) in enumerate(missing_pairs, 1):
        try:
            row = fetch_finmind_price(sym, target_date)
            if row and row.get("close") is not None:
                if markets.get(sym):
                    row["market"] = markets[sym]
                rows.append(row)
                log(f"  [{i}/{len(missing_pairs)}] {sym} repaired {target_date}")
            else:
                failed.append(f"{target_date}:{sym}")
                log(f"  [{i}/{len(missing_pairs)}] {sym} no FinMind K bar for {target_date}")
        except Exception as exc:
            failed.append(f"{target_date}:{sym}")
            log(f"  [{i}/{len(missing_pairs)}] {sym} failed: {exc}")
        time.sleep(SLEEP_SEC)

    written = sb_upsert("daily_prices", rows, on_conflict="date,symbol")
    msg = (
        f"dates={','.join(dates)}; targets={len(targets)}; missing_checked={len(missing_pairs)}; "
        f"repaired={written}; still_missing={len(failed)}"
    )
    if failed:
        msg += "; examples=" + ",".join(failed[:20])
    mark_status("repair_missing_prices", True, msg)
    log("  " + msg)
    log("=== repair_missing_prices done ===")


if __name__ == "__main__":
    main()
