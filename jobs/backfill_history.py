#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backfill_history.py — 歷史收盤行情回補
一次抓過去 N 個交易日的上市/上櫃收盤，補進 daily_prices，
讓 MA/KD/MACD/RSI 等技術指標算得出來（首次跑一次即可）。

用法：
  python jobs/backfill_history.py            # 預設回補 120 個日曆日
  python jobs/backfill_history.py --days 250 # 自訂天數

資料源：
  上市 TWSE  STOCK_DAY_AVG 替代不可行，改用 MI_INDEX 個股全表（依日查）
  這裡採 TWSE/TPEX 的「依日期查當日全部個股」端點，逐日抓。
  節流：每次請求間隔，避免被官方擋。

注意：交易所對歷史逐日查詢有節流，回補天數越多越久。
      120 日約需數分鐘；GitHub Actions 跑沒問題。
"""
import sys
import time
import datetime as dt

import requests

from sb_common import log, num, to_int, sb_upsert, mark_status

THROTTLE = 3.0
TIMEOUT = 30
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}


def http_json(url, params):
    for attempt in range(1, 4):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
            time.sleep(THROTTLE)
            if r.status_code == 200:
                return r.json()
        except Exception as e:  # noqa
            log(f"    重試 {attempt}：{e}")
            time.sleep(THROTTLE * attempt)
    return None


def ymd(d):
    return d.strftime("%Y%m%d")


# ---- 上市：TWSE STOCK_DAY 全市場（依日期）----
# 端點 MI_INDEX：type=ALLBUT0999 回當日全部個股
def fetch_twse_day(d):
    url = "https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX"
    j = http_json(
        url, {"response": "json", "date": ymd(d), "type": "ALLBUT0999"}
    )
    if not j or j.get("stat") != "OK":
        return []
    rows = []
    # 找含個股報價的那張表（欄位有 證券代號 / 收盤價）
    tables = j.get("tables") or []
    for t in tables:
        flds = "".join(map(str, t.get("fields", [])))
        if "證券代號" in flds and "收盤價" in flds:
            for f in t.get("data", []):
                sym = str(f[0]).strip()
                if not sym.isdigit() or len(sym) != 4:
                    continue
                close = num(f[8]) if len(f) > 8 else None
                openp = num(f[5]) if len(f) > 5 else None
                high = num(f[6]) if len(f) > 6 else None
                low = num(f[7]) if len(f) > 7 else None
                vol = to_int(f[2]) if len(f) > 2 else None
                amt = to_int(f[4]) if len(f) > 4 else None
                rows.append(
                    {
                        "date": d.isoformat(),
                        "symbol": sym,
                        "open": openp,
                        "high": high,
                        "low": low,
                        "close": close,
                        "change": None,
                        "change_percent": None,
                        "volume": vol,
                        "amount": amt,
                        "turnover_rate": None,
                        "market": "TWSE",
                    }
                )
            break
    return rows


# ---- 上櫃：TPEX 依日期 ----
def fetch_tpex_day(d):
    # TPEX 民國年格式 yyy/mm/dd
    roc = f"{d.year - 1911}/{d.month:02d}/{d.day:02d}"
    url = "https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php"
    j = http_json(url, {"l": "zh-tw", "d": roc, "se": "EW", "_": int(time.time())})
    if not j or not j.get("aaData"):
        return []
    rows = []
    for f in j["aaData"]:
        sym = str(f[0]).strip()
        if not sym.isdigit() or len(sym) != 4:
            continue
        rows.append(
            {
                "date": d.isoformat(),
                "symbol": sym,
                "open": num(f[4]) if len(f) > 4 else None,
                "high": num(f[5]) if len(f) > 5 else None,
                "low": num(f[6]) if len(f) > 6 else None,
                "close": num(f[2]) if len(f) > 2 else None,
                "change": num(f[3]) if len(f) > 3 else None,
                "change_percent": None,
                "volume": to_int(f[7]) if len(f) > 7 else None,
                "amount": to_int(f[8]) if len(f) > 8 else None,
                "turnover_rate": None,
                "market": "TPEX",
            }
        )
    return rows


def main():
    days = 120
    if "--days" in sys.argv:
        days = int(sys.argv[sys.argv.index("--days") + 1])

    today = dt.date.today()
    log(f"=== 歷史回補開始：往前 {days} 個日曆日 ===")
    total_tw, total_tp, hit_days = 0, 0, 0

    for back in range(1, days + 1):
        d = today - dt.timedelta(days=back)
        if d.weekday() >= 5:  # 跳過週末
            continue
        try:
            tw = fetch_twse_day(d)
            tp = fetch_tpex_day(d)
            if tw or tp:
                if tw:
                    sb_upsert("daily_prices", tw, on_conflict="date,symbol")
                if tp:
                    sb_upsert("daily_prices", tp, on_conflict="date,symbol")
                total_tw += len(tw)
                total_tp += len(tp)
                hit_days += 1
                log(f"  {d}：上市 {len(tw)} / 上櫃 {len(tp)}")
            else:
                log(f"  {d}：無資料（假日或休市）")
        except Exception as e:  # noqa
            log(f"  {d}：失敗 {e}")

    log(
        f"=== 回補結束：有效交易日 {hit_days}，"
        f"上市 {total_tw} 筆 / 上櫃 {total_tp} 筆 ==="
    )
    mark_status("backfill_history", True, f"days={hit_days}")


if __name__ == "__main__":
    main()
