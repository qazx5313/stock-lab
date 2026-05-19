#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fetch Taiwan market indexes and write them to market_index.

TWSE is read from TWSE MI_INDEX. TPEx is read from TPEx indexInfo/inx.
The parser is deliberately defensive because the exchange JSON field names
can differ between OpenAPI and rwd endpoints.
"""
import datetime as dt
import re
import time

import requests

from sb_common import log, num, sb_upsert, mark_status

TIMEOUT = 30
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}


def http_json(url, params=None):
    for attempt in range(1, 4):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
            time.sleep(1)
            if r.status_code == 200:
                return r.json()
            log(f"  HTTP {r.status_code}: {url}")
        except Exception as e:
            log(f"  request failed {attempt}: {e}")
            time.sleep(2 * attempt)
    return None


def last_weekday(d):
    while d.weekday() >= 5:
        d -= dt.timedelta(days=1)
    return d


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


def clean_num(v):
    if v is None:
        return None
    s = str(v).replace(",", "").replace("+", "").strip()
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group(0)) if m else None


def plausible_taiex(v):
    return v is not None and 8000 <= float(v) <= 50000


def fetch_taiex_openapi():
    url = "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX"
    data = http_json(url)
    if not isinstance(data, list):
      return None
    for row in data:
        joined = " ".join(str(v) for v in row.values())
        if "發行量加權股價指數" not in joined:
            continue
        value = (
            clean_num(row.get("收盤指數"))
            or clean_num(row.get("ClosingIndex"))
            or clean_num(row.get("指數"))
        )
        if not plausible_taiex(value):
            continue
        return {
            "date": parse_roc_or_ymd(row.get("日期") or row.get("Date")),
            "value": value,
            "change": clean_num(row.get("漲跌點數") or row.get("Change")),
            "change_percent": clean_num(row.get("漲跌百分比(%)") or row.get("ChangePercent")),
        }
    return None


def fetch_taiex_rwd(day):
    url = "https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX"
    data = http_json(url, {"date": day.strftime("%Y%m%d"), "type": "IND", "response": "json"})
    if not isinstance(data, dict):
        return None
    tables = data.get("tables") or []
    for table in tables:
        for row in table.get("data", []) or []:
            if not isinstance(row, list):
                continue
            if not any("發行量加權股價指數" in str(cell) for cell in row):
                continue
            nums = [clean_num(cell) for cell in row]
            nums = [x for x in nums if x is not None]
            value = next((x for x in nums if plausible_taiex(x)), None)
            if value is None:
                continue
            after = nums[nums.index(value) + 1 :]
            return {
                "date": parse_roc_or_ymd(data.get("date")) or day,
                "value": value,
                "change": after[0] if len(after) >= 1 else None,
                "change_percent": after[1] if len(after) >= 2 else None,
            }
    return None


def fetch_taiex(day):
    return fetch_taiex_openapi() or fetch_taiex_rwd(day)


def fetch_tpex_index():
    url = "https://www.tpex.org.tw/www/zh-tw/indexInfo/inx"
    j = http_json(url)
    if not isinstance(j, dict) or j.get("stat") != "ok" or not j.get("tables"):
        return None
    rows = j["tables"][0].get("data", [])
    if not rows:
        return None
    last = rows[-1]
    row_date = parse_roc_or_ymd(last[0]) if len(last) > 0 else None
    close = clean_num(last[4]) if len(last) > 4 else None
    chg = clean_num(last[5]) if len(last) > 5 else None
    cp = None
    if close is not None and chg is not None and (close - chg):
        cp = round(chg / (close - chg) * 100, 2)
    return {"date": row_date, "value": close, "change": chg, "change_percent": cp}


def main():
    d = last_weekday(dt.date.today())
    log(f"=== fetch_index start ({d}) ===")
    rows = []

    tw = fetch_taiex(d)
    if tw and plausible_taiex(tw.get("value")):
        rows.append({
            "date": (tw.get("date") or d).isoformat(),
            "market": "TWSE",
            "index_value": tw["value"],
            "change": tw.get("change"),
            "change_percent": tw.get("change_percent"),
            "amount": None,
            "up_count": None,
            "down_count": None,
        })
        log(f"  TWSE index {tw['value']} change={tw.get('change')}")
    else:
        log("  TWSE index not found")

    tp = fetch_tpex_index()
    if tp and tp.get("value"):
        rows.append({
            "date": (tp.get("date") or d).isoformat(),
            "market": "TPEX",
            "index_value": tp["value"],
            "change": tp.get("change"),
            "change_percent": tp.get("change_percent"),
            "amount": None,
            "up_count": None,
            "down_count": None,
        })
        log(f"  TPEX index {tp['value']} change={tp.get('change')}")
    else:
        log("  TPEX index not found")

    if rows:
        sb_upsert("market_index", rows, on_conflict="date,market")
    ok = len(rows) > 0
    mark_status("fetch_index", ok, "" if ok else "index endpoints returned no data")
    log("=== fetch_index done ===")


if __name__ == "__main__":
    main()
