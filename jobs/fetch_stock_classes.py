#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build the map page from stock industry classes instead of hand-made themes.

Listed/OTC stock classes come from MoneyDJ industry classification pages first,
then fall back to the official company profile OpenAPI mirrors for MOPS
disclosures. The result is written into themes/theme_stocks so the existing
front end can render the same card layout without mock topic data.
"""
import datetime as dt
import html
import os
import re
import time
from collections import defaultdict
from urllib.parse import urljoin

import requests
from requests.exceptions import SSLError

from sb_common import log, mark_status, sb_delete, sb_select, sb_upsert

TIMEOUT = 35
MONEYDJ_INDEX_URL = "https://www.moneydj.com/Z/ZH/ZHA/ZHA.djhtm"
MONEYDJ_MAX_CLASSES = int(os.environ.get("MONEYDJ_MAX_CLASSES", "0") or "0")
MONEYDJ_SLEEP_SEC = float(os.environ.get("MONEYDJ_SLEEP_SEC", "0.12") or "0.12")
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


def clean_text(v):
    s = html.unescape(re.sub(r"<[^>]*>", "", str(v or "")))
    s = s.replace("\xa0", " ").replace("　", " ")
    return re.sub(r"\s+", " ", s).strip()


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


def http_moneydj_html(url):
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    time.sleep(MONEYDJ_SLEEP_SEC)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {url}")
    # MoneyDJ legacy pages are Big5. requests occasionally guesses ISO-8859-1,
    # so decode explicitly and ignore stray ad-script bytes.
    return r.content.decode("big5", errors="ignore")


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


def fetch_moneydj_class_links():
    page = http_moneydj_html(MONEYDJ_INDEX_URL)
    row_re = re.compile(
        r"<tr>\s*<td[^>]*>\s*<a\s+href=\"([^\"]*z/zh/zha/zh00\.djhtm\?a=(C\d+)[^\"]*)\"[^>]*>"
        r"(.*?)</a>\s*</td>\s*<td[^>]*>\s*<table[^>]*>(.*?)</table>\s*</td>\s*</tr>",
        flags=re.I | re.S,
    )
    link_re = re.compile(
        r'<a\s+href="([^"]*z/zh/zha/zh00\.djhtm\?a=(C\d+)[^"]*)"[^>]*>(.*?)</a>',
        flags=re.I | re.S,
    )
    out = {}
    for row in row_re.finditer(page):
        major = industry_name(row.group(3))
        if not major:
            continue
        major_code = row.group(2).strip()
        major_url = urljoin(MONEYDJ_INDEX_URL, row.group(1))
        out.setdefault(major_code, {
            "code": major_code,
            "major": major,
            "name": major,
            "url": major_url,
        })
        for m in link_re.finditer(row.group(4)):
            code = m.group(2).strip()
            name = industry_name(m.group(3))
            if not code or not name:
                continue
            out.setdefault(code, {
                "code": code,
                "major": major,
                "name": name,
                "url": urljoin(MONEYDJ_INDEX_URL, m.group(1)),
            })
    if not out:
        matches = re.finditer(
            r'href\s*=\s*"([^"]*zha/zh00\.djhtm\?a=(C\d+)[^"]*)"[^>]*>(.*?)</a>',
            page,
            flags=re.I | re.S,
        )
        for m in matches:
            code = m.group(2).strip()
            name = industry_name(m.group(3))
            if not code or not name:
                continue
            out.setdefault(code, {"code": code, "major": name, "name": name, "url": urljoin(MONEYDJ_INDEX_URL, m.group(1))})
    rows = list(out.values())
    rows.sort(key=lambda r: (r.get("major") or "", r["name"], r["code"]))
    if MONEYDJ_MAX_CLASSES > 0:
        rows = rows[:MONEYDJ_MAX_CLASSES]
    return rows


def parse_moneydj_members(page):
    members = []
    seen = set()
    for m in re.finditer(
        r"Link2Stk\('AS(\d{4})'\)[^>]*>\s*(\d{4})\s*([^<]+?)\s*</a>",
        page,
        flags=re.I | re.S,
    ):
        sym = m.group(1).strip()
        if sym != m.group(2).strip() or not is_symbol(sym) or sym in seen:
            continue
        name = clean_text(m.group(3))
        if not name or name == sym:
            continue
        seen.add(sym)
        members.append({"symbol": sym, "name": name})
    return members


def fetch_moneydj_classes():
    links = fetch_moneydj_class_links()
    classes = []
    failed = 0
    for idx, item in enumerate(links, start=1):
        try:
            page = http_moneydj_html(item["url"])
            members = parse_moneydj_members(page)
        except Exception as e:  # noqa
            failed += 1
            if failed <= 10:
                log(f"  MoneyDJ {item['code']} {item['name']} failed: {e}")
            continue
        if members:
            classes.append({**item, "members": members})
        if idx % 100 == 0:
            log(f"  MoneyDJ classes scanned {idx}/{len(links)}; with_members={len(classes)}")
    return classes, failed, len(links)


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
        if is_symbol(sym):
            out[sym] = {**row, "industry": industry}
    return out


def clean_industry(name):
    s = re.sub(r"\s+", "", str(name or ""))
    return s.replace("業業", "業")


def tag_list(v):
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str):
        return [x.strip() for x in re.split(r"[、,，\s]+", v) if x.strip()]
    return []


def build_official_groups(stocks, prices):
    groups = defaultdict(dict)
    for sym, stock in stocks.items():
        if not is_symbol(sym):
            continue
        market = norm_market(stock.get("market"))
        industry = industry_name(stock.get("industry"))
        if not market or not industry:
            continue
        key = (industry, industry)
        groups[key][sym] = {
            "symbol": sym,
            "name": stock.get("name") or sym,
            "market": market,
            "industry": industry,
            "major_tag": industry,
            "fine_tag": "",
            "price": prices.get(sym) or {},
        }
    return groups


def apply_moneydj_fine_tags(classes, stocks, prices, groups):
    stock_updates = {
        sym: {
            "symbol": sym,
            "name": stock.get("name") or sym,
            "market": norm_market(stock.get("market")),
            "industry": industry_name(stock.get("industry")),
            "theme_tags": sorted(set(tag_list(stock.get("theme_tags")) + ([industry_name(stock.get("industry"))] if industry_name(stock.get("industry")) else []))),
        }
        for sym, stock in stocks.items()
        if is_symbol(sym) and norm_market(stock.get("market"))
    }
    for cls in classes:
        major_tag = industry_name(cls.get("major")) or industry_name(cls.get("name"))
        fine_tag = industry_name(cls.get("name"))
        if not major_tag or not fine_tag:
            continue
        for member in cls.get("members") or []:
            sym = str(member.get("symbol") or "").strip()
            if not is_symbol(sym):
                continue
            stock = stocks.get(sym) or {}
            market = norm_market(stock.get("market"))
            if not market:
                continue
            official_industry = industry_name(stock.get("industry"))
            key = (major_tag, fine_tag)
            groups[key][sym] = {
                "symbol": sym,
                "name": stock.get("name") or member.get("name") or sym,
                "market": market,
                "industry": official_industry or fine_tag,
                "major_tag": major_tag,
                "fine_tag": fine_tag,
                "price": prices.get(sym) or {},
            }
            current = stock_updates.get(sym) or {
                "symbol": sym,
                "name": stock.get("name") or member.get("name") or sym,
                "market": market,
                "industry": official_industry or fine_tag,
                "theme_tags": [],
            }
            merged_tags = set(tag_list(current.get("theme_tags")))
            if official_industry:
                merged_tags.add(official_industry)
            merged_tags.add(major_tag)
            merged_tags.add(fine_tag)
            stock_updates[sym] = {
                "symbol": sym,
                "name": stock.get("name") or member.get("name") or sym,
                "market": market,
                "industry": official_industry or fine_tag,
                "theme_tags": sorted(x for x in merged_tags if x),
            }
    return groups, list(stock_updates.values())


def build_group_rows(groups):
    # Accept either {(major, fine): [members...]} or dict members from
    # MoneyDJ builder; normalize into the list form used below.
    normalized = defaultdict(list)
    for key, members in (groups or {}).items():
        if isinstance(members, dict):
            normalized[key] = list(members.values())
        else:
            normalized[key] = list(members or [])

    theme_rows, link_rows = [], []
    sorted_groups = sorted(normalized.items(), key=lambda kv: (kv[0][0], kv[0][1]))
    for idx, ((major, fine), members) in enumerate(sorted_groups, start=1):
        major = industry_name(major) or "未分類"
        fine = industry_name(fine) or major
        tid = 1000 + idx
        members.sort(key=lambda x: (
            to_float((x.get("price") or {}).get("amount")) or 0,
            to_float((x.get("price") or {}).get("volume")) or 0,
            x.get("symbol") or "",
        ), reverse=True)
        priced = [m for m in members if (m.get("price") or {}).get("close") is not None]
        changes = [to_float((m.get("price") or {}).get("change_percent")) for m in priced]
        changes = [x for x in changes if x is not None]
        avg = round(sum(changes) / len(changes), 2) if changes else 0
        amount = sum(to_float((m.get("price") or {}).get("amount")) or 0 for m in priced)
        heat = max(1, min(99, int(55 + avg * 4 + min(len(members), 120) / 4)))
        status = "強勢" if avg >= 1.5 else ("偏弱" if avg <= -1.5 else "一般")
        theme_name = major if major == fine else f"{major} / {fine}"
        theme_rows.append({
            "id": tid,
            "theme_name": theme_name,
            "description": (
                f"{themeDisplay(theme_name)}：成分 {len(members)} 檔，"
                f"有收盤價 {len(priced)} 檔，平均漲幅 {avg:.2f}% ，"
                f"成交金額 {amount / 100000000:.2f} 億。"
            ),
            "heat_score": heat,
            "trend_status": status,
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
        for rank, member in enumerate(members, start=1):
            sym = str(member.get("symbol") or "").strip()
            price = member.get("price") or {}
            cp = to_float(price.get("change_percent")) or 0
            score = max(1, min(99, int(80 - rank / 3 + cp)))
            link_rows.append({
                "theme_id": tid,
                "symbol": sym,
                "role": "成分",
                "supply_chain_level": member.get("fine_tag") or fine,
                "relevance_score": score,
                "note": "",
            })
    return theme_rows, link_rows


def themeDisplay(name):
    return re.sub(r"^(上市|上櫃)\s*[·・]\s*", "", str(name or "")).strip()


def main():
    log("=== fetch_stock_classes start ===")
    twse_rows = fetch_twse_company_classes()
    tpex_rows = fetch_tpex_company_classes()
    profile_rows = twse_rows + tpex_rows
    sb_upsert("stocks", profile_rows, on_conflict="symbol")
    latest = latest_date()
    prices = latest_prices(latest)
    stocks = stock_rows()
    official = {str(r.get("symbol") or "").strip(): r for r in profile_rows if is_symbol(r.get("symbol"))}
    for sym, row in official.items():
        prev = stocks.get(sym) or {}
        tags = set(tag_list(prev.get("theme_tags")))
        tags.update(row.get("theme_tags") or [])
        stocks[sym] = {
            **prev,
            **row,
            "market": norm_market(row.get("market")),
            "industry": industry_name(row.get("industry")),
            "theme_tags": sorted(x for x in tags if x),
        }

    moneydj_classes, moneydj_failed, moneydj_total = [], 0, 0
    try:
        moneydj_classes, moneydj_failed, moneydj_total = fetch_moneydj_classes()
    except Exception as e:  # noqa
        log(f"  MoneyDJ classes skipped: {e}")

    groups = build_official_groups(stocks, prices)
    stock_updates = []
    if moneydj_classes:
        groups, stock_updates = apply_moneydj_fine_tags(moneydj_classes, stocks, prices, groups)
    else:
        stock_updates = [
            {
                "symbol": sym,
                "name": row.get("name") or sym,
                "market": norm_market(row.get("market")),
                "industry": industry_name(row.get("industry")),
                "theme_tags": sorted(set(tag_list(row.get("theme_tags")) + ([industry_name(row.get("industry"))] if industry_name(row.get("industry")) else []))),
            }
            for sym, row in stocks.items()
            if is_symbol(sym) and norm_market(row.get("market"))
        ]
    if stock_updates:
        sb_upsert("stocks", stock_updates, on_conflict="symbol")
    theme_rows, link_rows = build_group_rows(groups)
    if not theme_rows or not link_rows:
        msg = (
            f"no class rows built; twse_profiles={len(twse_rows)}; "
            f"tpex_profiles={len(tpex_rows)}; moneydj={len(moneydj_classes)}/{moneydj_total}; "
            f"prices={len(prices)}"
        )
        mark_status("fetch_stock_classes", False, msg)
        raise RuntimeError(msg)
    sb_delete("theme_stocks", "theme_id=gte.0")
    sb_delete("themes", "id=gte.0")
    tw = sb_upsert("themes", theme_rows, on_conflict="id")
    lw = sb_upsert("theme_stocks", link_rows, on_conflict="theme_id,symbol")
    msg = (
        f"twse_profiles={len(twse_rows)}; tpex_profiles={len(tpex_rows)}; "
        f"moneydj_classes={len(moneydj_classes)}/{moneydj_total}; "
        f"moneydj_failed={moneydj_failed}; classes={tw}; class_stocks={lw}; latest={latest}"
    )
    mark_status("fetch_stock_classes", True, msg)
    log("  " + msg)
    log("=== fetch_stock_classes done ===")


if __name__ == "__main__":
    main()
