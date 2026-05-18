#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_company_info.py — 補上市/上櫃公司產業別與名稱（改用 FinMind）

FinMind TaiwanStockInfo 一次回上市+上櫃+興櫃全部的
產業別(文字，如「半導體業」)、名稱、市場別。比 TPEX 端點穩定。

需要環境變數 FINMIND_TOKEN（GitHub Secret，第五階段已設）。
只 1 次 API 請求，不會爆免費額度。
"""
import os
import time

import requests

from sb_common import log, sb_upsert, mark_status

FINMIND_TOKEN = os.environ.get("FINMIND_TOKEN", "").strip()
FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"
TIMEOUT = 60


def fetch_finmind_info():
    headers = {}
    if FINMIND_TOKEN:
        headers["Authorization"] = f"Bearer {FINMIND_TOKEN}"
    for attempt in range(1, 4):
        try:
            r = requests.get(
                FINMIND_URL,
                params={"dataset": "TaiwanStockInfo"},
                headers=headers,
                timeout=TIMEOUT,
            )
            if r.status_code == 200:
                j = r.json()
                if j.get("status") == 200:
                    return j.get("data", [])
                log(f"  FinMind status={j.get('status')} msg={j.get('msg')}")
            else:
                log(f"  HTTP {r.status_code}")
            time.sleep(3 * attempt)
        except Exception as e:  # noqa
            log(f"  重試 {attempt}: {e}")
            time.sleep(3 * attempt)
    return None


def main():
    log("=== fetch_company_info (FinMind) 開始 ===")
    if not FINMIND_TOKEN:
        log("  ⚠️ 未設 FINMIND_TOKEN，仍嘗試")

    data = fetch_finmind_info()
    if not data:
        log("  ❌ TaiwanStockInfo 未取得")
        mark_status("fetch_company_info", False, "FinMind TaiwanStockInfo 失敗")
        return

    rows, seen = [], set()
    for d in data:
        sym = str(d.get("stock_id") or "").strip()
        name = (d.get("stock_name") or "").strip()
        ind = (d.get("industry_category") or "").strip()
        typ = (d.get("type") or "").strip()
        if not sym or sym in seen:
            continue
        seen.add(sym)
        market = "TWSE" if typ == "twse" else (
            "TPEX" if typ == "tpex" else typ.upper())
        if ind in ("大盤", "Index", "所有證券"):
            ind = None
        rows.append({
            "symbol": sym,
            "name": name or sym,
            "industry": ind or None,
            "market": market,
        })

    have_ind = sum(1 for r in rows if r.get("industry"))
    tw = sum(1 for r in rows if r["market"] == "TWSE")
    tp = sum(1 for r in rows if r["market"] == "TPEX")
    log(f"  解析 {len(rows)} 檔（上市 {tw} / 上櫃 {tp}），有產業別 {have_ind} 檔")

    if rows:
        sb_upsert("stocks", rows, on_conflict="symbol")

    ok = have_ind > 0
    mark_status("fetch_company_info", ok, "" if ok else "FinMind 無產業別")
    log("=== fetch_company_info 完成 ===")


if __name__ == "__main__":
    main()
