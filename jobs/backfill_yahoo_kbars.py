#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backfill_yahoo_kbars.py

用 Yahoo Finance 補足上市/上櫃普通股近一年日 K。

定位：
  - 這是「歷史 K 棒補洞」工具，不放進每日盤後管線。
  - 主要用途是一次性補足 daily_prices 的 OHLCV，讓技術分析可抓較長天數。
  - 每檔股票優先依官方上市/上櫃清單判斷 Yahoo suffix：
      TWSE -> 2330.TW
      TPEX -> 1815.TWO

用法：
  python backfill_yahoo_kbars.py
  python backfill_yahoo_kbars.py --days 365
  python backfill_yahoo_kbars.py --symbols 2330,1815
  python backfill_yahoo_kbars.py --limit 20 --dry-run
"""
import argparse
import datetime as dt
import time
from zoneinfo import ZoneInfo

import requests

from sb_common import log, mark_status, sb_select, sb_upsert

TIMEOUT = 35
YAHOO_SLEEP_SEC = 0.18
TAIPEI = ZoneInfo("Asia/Taipei")
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
    "Referer": "https://tw.stock.yahoo.com/",
}


def is_symbol(v):
    s = str(v or "").strip()
    return len(s) == 4 and s.isdigit() and s[0] != "0"


def as_float(v):
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


def as_int(v):
    if v is None:
        return None
    try:
        return int(round(float(v)))
    except Exception:
        return None


def norm_market(v):
    s = str(v or "").strip().upper()
    if s in ("TPEX", "OTC") or "上櫃" in s or "櫃買" in s:
        return "TPEX"
    if s in ("TWSE", "TSE") or "上市" in s:
        return "TWSE"
    return ""


def official_symbols():
    """用官方當日清單建立股票 universe；失敗時讓呼叫端再補 DB。"""
    out = {}
    sess = requests.Session()
    sess.headers.update(HEADERS)
    sources = [
        (
            "TWSE",
            "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
            lambda item: (
                str(item.get("Code") or "").strip(),
                item.get("Name"),
            ),
        ),
        (
            "TPEX",
            "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes",
            lambda item: (
                str(item.get("SecuritiesCompanyCode") or item.get("Code") or "").strip(),
                item.get("CompanyName") or item.get("Name"),
            ),
        ),
    ]
    for market, url, parser in sources:
        try:
            r = sess.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            data = r.json()
            for item in data if isinstance(data, list) else []:
                sym, name = parser(item)
                if is_symbol(sym):
                    out[sym] = {"symbol": sym, "name": name, "market": market}
            log(f"  官方清單 {market}: {sum(1 for r in out.values() if r['market'] == market)} 檔")
        except Exception as exc:
            log(f"  官方清單 {market} 讀取失敗，稍後用 Supabase 補：{exc}")
    return out


def database_symbols():
    out = {}
    try:
        rows = sb_select("stocks", "select=symbol,name,market,is_active", page_size=1000, max_rows=50000)
    except Exception as exc:
        log(f"  Supabase stocks 讀取失敗：{exc}")
        return out
    for row in rows:
        sym = str(row.get("symbol") or "").strip()
        if not is_symbol(sym):
            continue
        if row.get("is_active") is False:
            continue
        out[sym] = {
            "symbol": sym,
            "name": row.get("name"),
            "market": norm_market(row.get("market")) or "TWSE",
        }
    log(f"  Supabase stocks: {len(out)} 檔")
    return out


def yahoo_suffix(market):
    return "TWO" if norm_market(market) == "TPEX" else "TW"


def yahoo_symbol(symbol, market):
    return f"{symbol}.{yahoo_suffix(market)}"


def valid_ohlc(open_p, high, low, close):
    vals = [open_p, high, low, close]
    if any(v is None for v in vals):
        return False
    if any(v <= 0 for v in vals):
        return False
    if high < max(open_p, low, close):
        return False
    if low > min(open_p, high, close):
        return False
    # 過度離譜的單日價差通常是 Yahoo 補權/缺值造成，避免污染 K 棒。
    if low > 0 and high / low > 3:
        return False
    return True


def fetch_yahoo_chart(sess, symbol, market, start_date, end_date):
    period1 = int(dt.datetime.combine(start_date, dt.time.min, tzinfo=TAIPEI).timestamp())
    period2 = int(dt.datetime.combine(end_date + dt.timedelta(days=1), dt.time.min, tzinfo=TAIPEI).timestamp())
    code = yahoo_symbol(symbol, market)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{code}"
    params = {
        "period1": str(period1),
        "period2": str(period2),
        "interval": "1d",
        "events": "history",
        "includeAdjustedClose": "true",
    }
    r = sess.get(url, params=params, timeout=TIMEOUT)
    if r.status_code != 200 and "query1.finance.yahoo.com" in url:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{code}"
        r = sess.get(url, params=params, timeout=TIMEOUT)
    if r.status_code != 200:
        raise RuntimeError(f"Yahoo HTTP {r.status_code}")
    data = r.json()
    err = ((data.get("chart") or {}).get("error") or {}) if isinstance(data, dict) else {}
    if err:
        raise RuntimeError(str(err)[:180])
    result = (data.get("chart") or {}).get("result") or []
    return result[0] if result else None


def parse_chart(symbol, market, chart):
    if not chart:
        return []
    timestamps = chart.get("timestamp") or []
    quote = (((chart.get("indicators") or {}).get("quote") or [{}])[0]) or {}
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []
    rows = []
    seen_dates = set()
    for i, ts in enumerate(timestamps):
        open_p = as_float(opens[i] if i < len(opens) else None)
        high = as_float(highs[i] if i < len(highs) else None)
        low = as_float(lows[i] if i < len(lows) else None)
        close = as_float(closes[i] if i < len(closes) else None)
        if not valid_ohlc(open_p, high, low, close):
            continue
        date = dt.datetime.fromtimestamp(int(ts), dt.timezone.utc).astimezone(TAIPEI).date()
        if date.weekday() >= 5:
            continue
        iso = date.isoformat()
        if iso in seen_dates:
            continue
        seen_dates.add(iso)
        volume = as_int(volumes[i] if i < len(volumes) else None)
        amount = as_int(close * volume) if volume is not None else None
        rows.append(
            {
                "date": iso,
                "symbol": symbol,
                "open": round(open_p, 4),
                "high": round(high, 4),
                "low": round(low, 4),
                "close": round(close, 4),
                "change": None,
                "change_percent": None,
                "volume": volume,
                "amount": amount,
                "turnover_rate": None,
                "market": norm_market(market) or market,
            }
        )
    rows.sort(key=lambda r: r["date"])
    prev_close = None
    for row in rows:
        if prev_close:
            change = row["close"] - prev_close
            row["change"] = round(change, 4)
            row["change_percent"] = round(change / prev_close * 100, 4)
        prev_close = row["close"]
    return rows


def fetch_rows_for_symbol(sess, info, start_date, end_date):
    sym = info["symbol"]
    market = norm_market(info.get("market")) or "TWSE"
    tries = [market]
    # 市場分類偶爾會錯，Yahoo 補資料時自動試另一個 suffix。
    tries.append("TPEX" if market == "TWSE" else "TWSE")
    last_err = None
    for candidate_market in tries:
        try:
            chart = fetch_yahoo_chart(sess, sym, candidate_market, start_date, end_date)
            rows = parse_chart(sym, candidate_market, chart)
            if rows:
                return rows, candidate_market, None
        except Exception as exc:
            last_err = str(exc)
        time.sleep(YAHOO_SLEEP_SEC)
    return [], market, last_err or "no rows"


def build_universe(symbols_arg, limit):
    official = official_symbols()
    db = database_symbols()
    universe = db.copy()
    # 官方清單優先，避免上櫃跑到上市。
    universe.update(official)
    if symbols_arg:
        wanted = [s.strip() for s in symbols_arg.split(",") if s.strip()]
        universe = {
            s: universe.get(s, {"symbol": s, "name": None, "market": "TWSE"})
            for s in wanted
            if is_symbol(s)
        }
    items = sorted(universe.values(), key=lambda r: r["symbol"])
    if limit and limit > 0:
        items = items[:limit]
    return items


def main():
    global YAHOO_SLEEP_SEC

    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=365, help="往前抓幾個日曆日，預設 365")
    parser.add_argument("--symbols", default="", help="只補指定股票，逗號分隔，例如 2330,1815")
    parser.add_argument("--limit", type=int, default=0, help="測試用：只跑前 N 檔")
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--sleep", type=float, default=YAHOO_SLEEP_SEC)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    YAHOO_SLEEP_SEC = max(0.05, args.sleep)

    end_date = dt.datetime.now(TAIPEI).date()
    start_date = end_date - dt.timedelta(days=max(30, args.days))
    symbols = build_universe(args.symbols, args.limit)
    log(f"=== Yahoo 1Y K棒回補開始：symbols={len(symbols)} days={args.days} ===")
    log(f"  區間：{start_date} ~ {end_date}")

    sess = requests.Session()
    sess.headers.update(HEADERS)
    all_rows = []
    failures = []
    corrected_market = []
    total_symbols = 0
    total_rows = 0

    for idx, info in enumerate(symbols, start=1):
        rows, used_market, err = fetch_rows_for_symbol(sess, info, start_date, end_date)
        if rows:
            total_symbols += 1
            total_rows += len(rows)
            all_rows.extend(rows)
            if used_market != norm_market(info.get("market")):
                corrected_market.append(f"{info['symbol']}:{info.get('market')}->{used_market}")
            if len(all_rows) >= args.batch_size * 6:
                if args.dry_run:
                    log(f"  dry-run flush: {len(all_rows)} rows")
                else:
                    sb_upsert("daily_prices", all_rows, on_conflict="date,symbol", batch=args.batch_size)
                all_rows = []
        else:
            failures.append(f"{info['symbol']}:{err}")
        if idx % 50 == 0 or idx == len(symbols):
            log(f"  進度 {idx}/{len(symbols)}，成功 {total_symbols} 檔，rows={total_rows}，失敗 {len(failures)}")

    if all_rows:
        if args.dry_run:
            log(f"  dry-run final: {len(all_rows)} rows")
        else:
            sb_upsert("daily_prices", all_rows, on_conflict="date,symbol", batch=args.batch_size)

    if corrected_market:
        log(f"  Yahoo suffix 自動修正 {len(corrected_market)} 檔：{', '.join(corrected_market[:20])}")
    if failures:
        log(f"  失敗 {len(failures)} 檔（前 30）：{'; '.join(failures[:30])}")

    msg = f"symbols={total_symbols}/{len(symbols)} rows={total_rows} days={args.days} failures={len(failures)}"
    if not args.dry_run:
        mark_status("backfill_yahoo_kbars", total_rows > 0, "" if total_rows > 0 else msg)
    log("  " + msg)
    log("=== Yahoo 1Y K棒回補完成 ===")


if __name__ == "__main__":
    main()
