#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Repair missing latest daily_prices rows for symbols used by the app.

The broad TWSE/TPEX daily APIs occasionally miss a subset of symbols or are
not fully updated when the workflow runs. This job checks app-visible symbols
and fetches only missing latest-date K bars from FinMind TaiwanStockPrice.

It never copies yesterday's price forward. If FinMind has no row for the target
date, the symbol stays missing and the result is recorded in data_status.
"""
import datetime as dt
import os
import time

import requests

from sb_common import log, mark_status, sb_one, sb_select, sb_upsert


FINMIND_TOKEN = os.environ.get("FINMIND_TOKEN", "").strip()
FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"
TIMEOUT = 45
REPAIR_MAX_SYMBOLS = int(os.environ.get("REPAIR_MAX_SYMBOLS", "500"))
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


def collect_target_symbols(latest):
    symbols = set()

    for row in sb_select("theme_stocks", "select=symbol", page_size=1000, max_rows=50000):
        sym = str(row.get("symbol") or "").strip()
        if is_symbol(sym):
            symbols.add(sym)

    for row in sb_select(
        "candidate_pool",
        f"select=symbol&date=eq.{latest}",
        page_size=1000,
        max_rows=50000,
    ):
        sym = str(row.get("symbol") or "").strip()
        if is_symbol(sym):
            symbols.add(sym)

    for row in sb_select(
        "daily_signals",
        f"select=symbol&date=eq.{latest}",
        page_size=1000,
        max_rows=50000,
    ):
        sym = str(row.get("symbol") or "").strip()
        if is_symbol(sym):
            symbols.add(sym)

    try:
        for row in sb_select(
            "ai_positions",
            "select=symbol&status=eq.持有",
            page_size=1000,
            max_rows=10000,
        ):
            sym = str(row.get("symbol") or "").strip()
            if is_symbol(sym):
                symbols.add(sym)
    except Exception as exc:
        log(f"  ai_positions 略過：{exc}")

    return sorted(symbols)


def existing_latest_symbols(latest):
    rows = sb_select(
        "daily_prices",
        f"select=symbol,close&date=eq.{latest}",
        page_size=1000,
        max_rows=50000,
    )
    return {
        str(r.get("symbol") or "").strip()
        for r in rows
        if is_symbol(r.get("symbol")) and r.get("close") is not None
    }


def stock_market_map(symbols):
    out = {}
    symbols = sorted({str(s or "").strip() for s in symbols if is_symbol(s)})
    for i in range(0, len(symbols), 100):
        part = ",".join(symbols[i : i + 100])
        if not part:
            continue
        try:
            rows = sb_select(
                "stocks",
                f"select=symbol,market&symbol=in.({part})",
                page_size=1000,
                max_rows=1000,
            )
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
    log("=== repair_missing_prices 開始 ===")
    if not FINMIND_TOKEN:
        log("  ⚠️ 未設定 FINMIND_TOKEN，仍嘗試公開額度")

    latest = latest_date()
    targets = collect_target_symbols(latest)
    existing = existing_latest_symbols(latest)
    missing = [s for s in targets if s not in existing]
    markets = stock_market_map(missing)

    if REPAIR_MAX_SYMBOLS > 0:
        missing = missing[:REPAIR_MAX_SYMBOLS]

    log(f"  latest={latest} app symbols={len(targets)} missing={len(missing)}")
    rows, failed = [], []
    for i, sym in enumerate(missing, 1):
        try:
            row = fetch_finmind_price(sym, latest)
            if row and row.get("close") is not None:
                if markets.get(sym):
                    row["market"] = markets[sym]
                rows.append(row)
                log(f"  [{i}/{len(missing)}] {sym} 補到 {latest}")
            else:
                failed.append(sym)
                log(f"  [{i}/{len(missing)}] {sym} FinMind 無 {latest} K棒")
        except Exception as exc:
            failed.append(sym)
            log(f"  [{i}/{len(missing)}] {sym} 失敗：{exc}")
        time.sleep(SLEEP_SEC)

    written = sb_upsert("daily_prices", rows, on_conflict="date,symbol")
    msg = (
        f"date={latest}; targets={len(targets)}; missing_checked={len(missing)}; "
        f"repaired={written}; still_missing={len(failed)}"
    )
    if failed:
        msg += "; examples=" + ",".join(failed[:20])
    mark_status("repair_missing_prices", True, msg)
    log("  " + msg)
    log("=== repair_missing_prices 完成 ===")


if __name__ == "__main__":
    main()
