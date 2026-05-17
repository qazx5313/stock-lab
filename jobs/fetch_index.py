#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_index.py — 抓大盤指數（加權 TAIEX / 櫃買 TPEx）

寫進 market_index。首頁的指數從此變真實（原本是寫死的 21684）。
每日盤後排程會自動跑。

資料源：
  加權 TWSE OpenAPI  大盤統計（發行量加權股價指數）
  櫃買 TPEX OpenAPI  櫃買指數
"""
import datetime as dt
import time

import requests

from sb_common import log, num, to_int, sb_upsert, mark_status

TIMEOUT = 30
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}


def http_json(url, params=None):
    for attempt in range(1, 4):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
            time.sleep(2)
            if r.status_code == 200:
                return r.json()
        except Exception as e:  # noqa
            log(f"  重試 {attempt}: {e}")
            time.sleep(2 * attempt)
    return None


def last_weekday(d):
    while d.weekday() >= 5:
        d -= dt.timedelta(days=1)
    return d


def fetch_taiex():
    """加權指數。TWSE OpenAPI 大盤指數收盤行情。"""
    # 含發行量加權股價指數的每日收盤
    url = "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX"
    data = http_json(url)
    if not isinstance(data, list):
        return None
    for row in data:
        name = str(row.get("指數") or row.get("Index") or "")
        if "發行量加權股價指數" in name or name.strip() == "發行量加權股價指數":
            return {
                "value": num(row.get("收盤指數") or row.get("ClosingIndex")),
                "change": num(row.get("漲跌點數") or row.get("Change")),
                "change_percent": num(
                    row.get("漲跌百分比") or row.get("ChangePercent")
                ),
            }
    return None


def fetch_tpex_index():
    """櫃買指數。TPEX OpenAPI。"""
    for url in (
        "https://www.tpex.org.tw/openapi/v1/tpex_otc_indices",
        "https://www.tpex.org.tw/openapi/v1/tpex_otc_index",
    ):
        data = http_json(url)
        if isinstance(data, list) and data:
            for row in data:
                # 找櫃買(OTC)指數那筆
                nm = str(row.get("指數名稱") or row.get("IndexName") or "")
                if "櫃買" in nm or "OTC" in nm or len(data) == 1:
                    return {
                        "value": num(
                            row.get("收盤指數")
                            or row.get("ClosingIndex")
                            or row.get("Close")
                        ),
                        "change": num(
                            row.get("漲跌") or row.get("Change")
                        ),
                        "change_percent": num(
                            row.get("漲跌百分比") or row.get("ChangePercent")
                        ),
                    }
    return None


def main():
    d = last_weekday(dt.date.today())
    log(f"=== fetch_index 開始（交易日 {d}）===")
    rows = []

    tw = fetch_taiex()
    if tw and tw.get("value"):
        rows.append(
            {
                "date": d.isoformat(),
                "market": "TWSE",
                "index_value": tw["value"],
                "change": tw.get("change"),
                "change_percent": tw.get("change_percent"),
                "amount": None,
                "up_count": None,
                "down_count": None,
            }
        )
        log(f"  加權指數 {tw['value']}（{tw.get('change')}）")
    else:
        log("  ⚠️ 加權指數未取得（端點可能需調整，請回報）")

    tp = fetch_tpex_index()
    if tp and tp.get("value"):
        rows.append(
            {
                "date": d.isoformat(),
                "market": "TPEX",
                "index_value": tp["value"],
                "change": tp.get("change"),
                "change_percent": tp.get("change_percent"),
                "amount": None,
                "up_count": None,
                "down_count": None,
            }
        )
        log(f"  櫃買指數 {tp['value']}（{tp.get('change')}）")
    else:
        log("  ⚠️ 櫃買指數未取得（端點可能需調整，請回報）")

    if rows:
        # market_index 無 symbol 欄位，sb_upsert 的代號過濾不影響
        sb_upsert("market_index", rows, on_conflict="date,market")
    ok = len(rows) > 0
    mark_status("fetch_index", ok, "" if ok else "指數端點需調整")
    log("=== fetch_index 完成 ===")


if __name__ == "__main__":
    main()
