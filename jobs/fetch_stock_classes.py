#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build the map page from stock industry classes instead of hand-made themes.

Listed/OTC stock classes come from the official company profile OpenAPI mirrors
for MOPS disclosures. The result is written into themes/theme_stocks so the
existing front end can render the same card layout without mock topic data.
"""
import datetime as dt
import re
import time
from collections import defaultdict

import requests
from requests.exceptions import SSLError

from sb_common import log, mark_status, sb_delete, sb_select, sb_upsert

TIMEOUT = 35
TWSE_INDUSTRY_CODES = {
    "01": "水泥工業",
    "02": "食品工業",
    "03": "塑膠工業",
    "04": "紡織纖維",
    "05": "電機機械",
    "06": "電器電纜",
    "08": "玻璃陶瓷",
    "09": "造紙工業",
    "10": "鋼鐵工業",
    "11": "橡膠工業",
    "12": "汽車工業",
    "14": "建材營造",
    "15": "航運業",
    "16": "觀光事業",
    "17": "金融保險",
    "18": "貿易百貨",
    "20": "其他",
    "21": "化學工業",
    "22": "生技醫療業",
    "23": "油電燃氣業",
    "24": "半導體業",
    "25": "電腦及週邊設備業",
    "26": "光電業",
    "27": "通信網路業",
    "28": "電子零組件業",
    "29": "電子通路業",
    "30": "資訊服務業",
    "31": "其他電子業",
    "32": "文化創意業",
    "33": "農業科技",
    "34": "電子商務",
    "35": "綠能環保",
    "36": "數位雲端",
    "37": "運動休閒",
    "38": "居家生活",
}
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


def is_symbol(v):
    s = str(v or "").strip()
    return len(s) == 4 and s.isdigit() and s[0] != "0"


def norm_market(v):
    s = str(v or "").strip().upper()
    if s in ("TPEX", "OTC") or "上櫃" in s or "櫃買" in s:
        return "TPEX"
    if s in ("TWSE", "TSE") or "上市" in s:
        return "TWSE"
    return ""


def market_label(v):
    return "上櫃" if norm_market(v) == "TPEX" else "上市"


def to_float(v):
    try:
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def http_json(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    except SSLError:
        if "tpex.org.tw" not in url:
            raise
        requests.packages.urllib3.disable_warnings()  # official TPEx endpoint, Windows cert fallback
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, verify=False)
    time.sleep(0.8)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {url}")
    return r.json()


def field(row, names):
    for name in names:
        if name in row and row.get(name) not in (None, ""):
            return row.get(name)
    return None


def industry_name(v):
    s = clean_industry(v)
    if s in TWSE_INDUSTRY_CODES:
        return TWSE_INDUSTRY_CODES[s]
    if re.fullmatch(r"\d+", s):
        return ""
    bad = {"ETF", "ETN", "權證", "指數投資證券", "受益證券", "期貨"}
    if not s or any(x in s for x in bad):
        return ""
    return s


def fetch_twse_company_classes():
    data = http_json("https://openapi.twse.com.tw/v1/opendata/t187ap03_L")
    rows = []
    for item in data if isinstance(data, list) else []:
        sym = str(field(item, ["公司代號", "出表公司代號", "有價證券代號", "Code"]) or "").strip()
        if not is_symbol(sym):
            continue
        industry = industry_name(field(item, ["產業別", "Industry"]))
        name = str(field(item, ["公司簡稱", "公司名稱", "Name"]) or "").strip()
        if not industry:
            continue
        rows.append({
            "symbol": sym,
            "name": name or None,
            "industry": industry,
            "market": "TWSE",
            "theme_tags": [industry],
        })
    return rows


def fetch_tpex_company_classes():
    data = http_json("https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O")
    rows = []
    for item in data if isinstance(data, list) else []:
        sym = str(field(item, [
            "SecuritiesCompanyCode", "公司代號", "出表公司代號", "有價證券代號", "Code"
        ]) or "").strip()
        if not is_symbol(sym):
            continue
        industry = industry_name(field(item, [
            "SecuritiesIndustryCode", "產業別", "Industry"
        ]))
        name = str(field(item, [
            "CompanyAbbreviation", "CompanyName", "公司簡稱", "公司名稱", "Name"
        ]) or "").strip()
        if not industry:
            continue
        rows.append({
            "symbol": sym,
            "name": name or None,
            "industry": industry,
            "market": "TPEX",
            "theme_tags": [industry],
        })
    return rows


def latest_date():
    rows = sb_select("daily_prices", "select=date&order=date.desc&limit=1", page_size=1, max_rows=1)
    return str(rows[0]["date"])[:10] if rows else ""


def latest_prices(latest):
    out = {}
    rows = sb_select(
        "daily_prices",
        f"select=symbol,close,change_percent,amount,volume,market&date=eq.{latest}",
        page_size=1000,
        max_rows=50000,
    )
    for row in rows:
        sym = str(row.get("symbol") or "").strip()
        if is_symbol(sym):
            out[sym] = row
    return out


def stock_rows():
    out = {}
    rows = sb_select("stocks", "select=symbol,name,industry,market,theme_tags", page_size=1000, max_rows=50000)
    for row in rows:
        sym = str(row.get("symbol") or "").strip()
        industry = industry_name(row.get("industry"))
        if is_symbol(sym) and industry:
            out[sym] = {**row, "industry": industry}
    return out


def clean_industry(name):
    s = re.sub(r"\s+", "", str(name or ""))
    return s.replace("業業", "業")


def build_class_rows(stocks, prices, latest):
    groups = defaultdict(list)
    for sym, stock in stocks.items():
        price = prices.get(sym)
        if not price or price.get("close") is None:
            continue
        industry = industry_name(stock.get("industry"))
        if not industry:
            continue
        key = (market_label(price.get("market") or stock.get("market")), industry)
        groups[key].append((sym, stock, price))

    theme_rows, link_rows = [], []
    sorted_groups = sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][1]))
    for idx, ((mk_label, industry), members) in enumerate(sorted_groups, start=1):
        tid = 1000 + idx
        members.sort(key=lambda x: (to_float(x[2].get("amount")) or 0, to_float(x[2].get("volume")) or 0), reverse=True)
        changes = [to_float(p.get("change_percent")) for _, _, p in members]
        changes = [x for x in changes if x is not None]
        avg = round(sum(changes) / len(changes), 2) if changes else 0
        amount = sum(to_float(p.get("amount")) or 0 for _, _, p in members)
        heat = max(1, min(99, int(55 + avg * 4 + min(len(members), 120) / 4)))
        status = "強勢" if avg >= 1.5 else ("偏弱" if avg <= -1.5 else "一般")
        theme_name = f"{mk_label} · {industry}"
        theme_rows.append({
            "id": tid,
            "theme_name": theme_name,
            "description": (
                f"{theme_name}：成分 {len(members)} 檔，"
                f"平均漲幅 {avg:.2f}% ，成交金額 {amount / 100000000:.2f} 億。"
            ),
            "heat_score": heat,
            "trend_status": status,
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
        for rank, (sym, stock, price) in enumerate(members, start=1):
            cp = to_float(price.get("change_percent")) or 0
            score = max(1, min(99, int(80 - rank / 3 + cp)))
            link_rows.append({
                "theme_id": tid,
                "symbol": sym,
                "role": "成分",
                "supply_chain_level": industry,
                "relevance_score": score,
                "note": f"{mk_label}股票類股分類；收盤 {price.get('close')}；漲跌 {cp:.2f}%",
            })
    return theme_rows, link_rows


def main():
    log("=== fetch_stock_classes start ===")
    twse_rows = fetch_twse_company_classes()
    tpex_rows = fetch_tpex_company_classes()
    profile_rows = twse_rows + tpex_rows
    sb_upsert("stocks", profile_rows, on_conflict="symbol")
    latest = latest_date()
    prices = latest_prices(latest)
    stocks = stock_rows()
    theme_rows, link_rows = build_class_rows(stocks, prices, latest)
    if not theme_rows or not link_rows:
        msg = (
            f"no class rows built; twse_profiles={len(twse_rows)}; "
            f"tpex_profiles={len(tpex_rows)}; prices={len(prices)}"
        )
        mark_status("fetch_stock_classes", False, msg)
        raise RuntimeError(msg)
    sb_delete("theme_stocks", "theme_id=gte.0")
    sb_delete("themes", "id=gte.0")
    tw = sb_upsert("themes", theme_rows, on_conflict="id")
    lw = sb_upsert("theme_stocks", link_rows, on_conflict="theme_id,symbol")
    msg = (
        f"twse_profiles={len(twse_rows)}; tpex_profiles={len(tpex_rows)}; "
        f"classes={tw}; class_stocks={lw}; latest={latest}"
    )
    mark_status("fetch_stock_classes", True, msg)
    log("  " + msg)
    log("=== fetch_stock_classes done ===")


if __name__ == "__main__":
    main()
