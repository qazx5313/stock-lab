#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_company_info.py — 補上市/上櫃公司產業別

stocks.industry 目前全空，導致題材無法分類。
本支抓 TWSE / TPEX 公司基本資料的「產業別」，更新進 stocks.industry。

跑一次即可（公司產業別很少變）；之後新上市公司每日 fetch 也會帶到。

資料源：
  上市 TWSE OpenAPI  公司基本資料（含 產業別）
  上櫃 TPEX OpenAPI  公司基本資料（含 產業別）
"""
import time
import datetime as dt

import requests

from sb_common import log, sb_upsert, mark_status

TIMEOUT = 30
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}


def http_json(url):
    for attempt in range(1, 4):
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            time.sleep(2)
            if r.status_code == 200:
                return r.json()
        except Exception as e:  # noqa
            log(f"  重試 {attempt}: {e}")
            time.sleep(2 * attempt)
    return None


def fetch_twse_company():
    """上市公司基本資料（含產業別）。
    端點欄位：公司代號 公司名稱 ... 產業別 ..."""
    url = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L"
    data = http_json(url)
    rows = []
    if isinstance(data, list):
        for d in data:
            sym = str(
                d.get("公司代號") or d.get("Company Code") or ""
            ).strip()
            name = (d.get("公司簡稱") or d.get("公司名稱") or "").strip()
            ind = (d.get("產業別") or d.get("Industry") or "").strip()
            if sym:
                rows.append(
                    {
                        "symbol": sym,
                        "name": name or sym,
                        "industry": ind or None,
                        "market": "TWSE",
                    }
                )
    return rows


def fetch_tpex_company():
    """上櫃公司基本資料（含產業別）。"""
    url = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes"
    # 先試專門的公司基本資料端點
    alt = "https://www.tpex.org.tw/openapi/v1/tpex_companies_basic_info"
    rows = []
    for u in (alt, url):
        data = http_json(u)
        if not isinstance(data, list) or not data:
            continue
        for d in data:
            sym = str(
                d.get("SecuritiesCompanyCode")
                or d.get("公司代號")
                or d.get("Code")
                or ""
            ).strip()
            name = (
                d.get("CompanyName") or d.get("公司名稱") or d.get("Name") or ""
            ).strip()
            ind = (
                d.get("SecuritiesIndustryCode")
                or d.get("產業別")
                or d.get("Industry")
                or ""
            ).strip()
            if sym:
                rows.append(
                    {
                        "symbol": sym,
                        "name": name or sym,
                        "industry": ind or None,
                        "market": "TPEX",
                    }
                )
        if rows:
            break
    return rows


def main():
    log("=== fetch_company_info 開始 ===")
    tw = fetch_twse_company()
    log(f"上市公司資料：{len(tw)} 筆")
    tp = fetch_tpex_company()
    log(f"上櫃公司資料：{len(tp)} 筆")

    all_rows = tw + tp
    have_ind = sum(1 for r in all_rows if r.get("industry"))
    log(f"合計 {len(all_rows)} 筆，其中有產業別 {have_ind} 筆")

    if all_rows:
        # sb_upsert 會自動過濾非普通股代號
        sb_upsert("stocks", all_rows, on_conflict="symbol")

    ok = have_ind > 0
    mark_status(
        "fetch_company_info",
        ok,
        "" if ok else "未取得任何產業別，端點可能需調整",
    )
    log("=== fetch_company_info 完成 ===")


if __name__ == "__main__":
    main()
