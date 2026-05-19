#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fetch Taiwan market indexes and write them to market_index.

TWSE is read from FMTQIK, the same "每日市場成交資訊" page used on the
TWSE website. TPEx is read from TPEx indexInfo/inx.
"""
import datetime as dt
import re
import time

import requests

from sb_common import log, mark_status, sb_upsert

TIMEOUT = 30
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


def http_json(url, params=None):
    for attempt in range(1, 4):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
            time.sleep(1)
            if r.status_code == 200:
                return r.json()
            log(f"  HTTP {r.status_code}: {url}")
        except Exception as exc:
            log(f"  request failed {attempt}: {exc}")
            time.sleep(2 * attempt)
    return None


def clean_num(v):
    if v is None:
        return None
    s = str(v).replace(",", "").replace("+", "").strip()
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group(0)) if m else None


def clean_int(v):
    n = clean_num(v)
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


def last_weekday(day):
    while day.weekday() >= 5:
        day -= dt.timedelta(days=1)
    return day


def recent_month_starts(day, months=3):
    cur = day.replace(day=1)
    out = []
    for _ in range(months):
        out.append(cur)
        cur = (cur - dt.timedelta(days=1)).replace(day=1)
    return out


def fmtqik_row_to_index(row):
    if not isinstance(row, list) or len(row) < 6:
        return None
    row_date = parse_roc_or_ymd(row[0])
    value = clean_num(row[4])
    change = clean_num(row[5])
    if not row_date or value is None:
        return None
    change_percent = None
    if change is not None and value - change:
        change_percent = round(change / (value - change) * 100, 2)
    return {
        "date": row_date,
        "value": value,
        "change": change,
        "change_percent": change_percent,
        "amount": clean_int(row[2]),
    }


def fetch_taiex_fmtqik(today):
    url = "https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK"
    best = None
    for month_start in recent_month_starts(today, 3):
        data = http_json(
            url,
            {"date": month_start.strftime("%Y%m%d"), "response": "json"},
        )
        if not isinstance(data, dict) or not data.get("data"):
            continue
        rows = [fmtqik_row_to_index(row) for row in data.get("data", [])]
        rows = [row for row in rows if row and row["date"] <= today]
        if rows:
            candidate = sorted(rows, key=lambda x: x["date"])[-1]
            if not best or candidate["date"] > best["date"]:
                best = candidate
    return best


def fetch_tpex_index():
    url = "https://www.tpex.org.tw/www/zh-tw/indexInfo/inx"
    data = http_json(url)
    if not isinstance(data, dict) or data.get("stat") != "ok" or not data.get("tables"):
        return None
    rows = data["tables"][0].get("data", [])
    parsed = []
    for row in rows:
        if not isinstance(row, list) or len(row) < 6:
            continue
        row_date = parse_roc_or_ymd(row[0])
        close = clean_num(row[4])
        change = clean_num(row[5])
        if not row_date or close is None:
            continue
        change_percent = round(change / (close - change) * 100, 2) if change is not None and close - change else None
        parsed.append({"date": row_date, "value": close, "change": change, "change_percent": change_percent})
    return sorted(parsed, key=lambda x: x["date"])[-1] if parsed else None


def main():
    today = last_weekday(dt.date.today())
    log(f"=== fetch_index start ({today}) ===")
    rows = []

    twse = fetch_taiex_fmtqik(today)
    if twse:
        rows.append({
            "date": twse["date"].isoformat(),
            "market": "TWSE",
            "index_value": twse["value"],
            "change": twse.get("change"),
            "change_percent": twse.get("change_percent"),
            "amount": twse.get("amount"),
            "up_count": None,
            "down_count": None,
        })
        log(f"  TWSE FMTQIK {twse['date']} index={twse['value']} change={twse.get('change')}")
    else:
        log("  TWSE FMTQIK index not found")

    tpex = fetch_tpex_index()
    if tpex:
        rows.append({
            "date": tpex["date"].isoformat(),
            "market": "TPEX",
            "index_value": tpex["value"],
            "change": tpex.get("change"),
            "change_percent": tpex.get("change_percent"),
            "amount": None,
            "up_count": None,
            "down_count": None,
        })
        log(f"  TPEX {tpex['date']} index={tpex['value']} change={tpex.get('change')}")
    else:
        log("  TPEX index not found")

    if rows:
        sb_upsert("market_index", rows, on_conflict="date,market")
    ok = len(rows) > 0
    mark_status("fetch_index", ok, "" if ok else "index endpoints returned no data")
    log("=== fetch_index done ===")


if __name__ == "__main__":
    main()
