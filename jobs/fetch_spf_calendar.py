#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_spf_calendar.py

抓永豐期貨「一週財經行事曆」PDF，整理成市場行事曆事件後寫入 Supabase。
來源頁：https://www.spf.com.tw/sinopacSPF/research/list.do?id=180fdcacb04000005fa4adef23dd5137
"""
import datetime as dt
import re
from html.parser import HTMLParser
from io import BytesIO
from urllib.parse import quote, urljoin

import requests

from sb_common import log, mark_status, sb_delete, sb_upsert


LIST_URL = "https://www.spf.com.tw/sinopacSPF/research/list.do?id=180fdcacb04000005fa4adef23dd5137"
SOURCE = "永豐期貨財經行事曆"
TIMEOUT = 30


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self._href = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self._href = href
            self._text = []

    def handle_data(self, data):
        if self._href:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href:
            text = re.sub(r"\s+", " ", "".join(self._text)).strip()
            self.links.append((self._href, text))
            self._href = None
            self._text = []


def fetch_text(url):
    r = requests.get(
        url,
        timeout=TIMEOUT,
        headers={"User-Agent": "Mozilla/5.0 stock-lab calendar fetcher"},
    )
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def latest_pdf_link():
    html = fetch_text(LIST_URL)
    parser = LinkParser()
    parser.feed(html)
    candidates = []
    for href, text in parser.links:
        hay = f"{href} {text}"
        if "財經行事曆" not in hay:
            continue
        if ".pdf" not in href.lower() and "researchContent" not in href:
            continue
        candidates.append((urljoin(LIST_URL, href), text))
    if not candidates:
        for href, text in parser.links:
            if ".pdf" in href.lower():
                candidates.append((urljoin(LIST_URL, href), text))
    if not candidates:
        raise RuntimeError("永豐頁面找不到財經行事曆 PDF 連結")
    return candidates[0]


def download_pdf(url):
    r = requests.get(
        url,
        timeout=TIMEOUT,
        headers={"User-Agent": "Mozilla/5.0 stock-lab calendar fetcher"},
    )
    r.raise_for_status()
    return r.content


def extract_pdf_text(pdf_bytes, first_page_only=True):
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError("缺少 pypdf，請先 pip install -r requirements.txt") from exc
    reader = PdfReader(BytesIO(pdf_bytes))
    pages = []
    page_iter = reader.pages[:1] if first_page_only else reader.pages
    for page in page_iter:
        pages.append(page.extract_text() or "")
    return "\n".join(pages)


def parse_week(title, text):
    hay = f"{title}\n{text}"
    m = re.search(r"(20\d{2})(\d{2})(\d{2})\s*[~～-]\s*(\d{2})(\d{2})", hay)
    if m:
        y, m1, d1, m2, d2 = map(int, m.groups())
        start = dt.date(y, m1, d1)
        end = dt.date(y, m2, d2)
        return y, start, end, f"{start:%Y/%m/%d}~{end:%m/%d}"
    m = re.search(r"(20\d{2})[/.-](\d{1,2})[/.-](\d{1,2})", hay)
    if m:
        y, mo, da = map(int, m.groups())
        start = dt.date(y, mo, da)
        end = start + dt.timedelta(days=6)
        return y, start, end, f"{start:%Y/%m/%d}~{end:%m/%d}"
    today = dt.date.today()
    monday = today - dt.timedelta(days=today.weekday())
    return today.year, monday, monday + dt.timedelta(days=6), f"{monday:%Y/%m/%d}~{(monday + dt.timedelta(days=6)):%m/%d}"


COUNTRIES = [
    "台灣", "美國", "日本", "中國", "歐元區", "德國", "英國", "法國", "加拿大",
    "澳洲", "韓國", "香港", "新加坡", "瑞士", "義大利", "印度", "紐西蘭",
]


def split_region_title(text):
    s = re.sub(r"\s+", " ", text).strip(" -　")
    m = re.match(r"^[【\[](?P<country>[^】\]]+)[】\]]\s*(?P<title>.+)$", s)
    if m:
        return m.group("country").strip(), m.group("title").strip()
    for c in COUNTRIES:
        if s.startswith(c):
            return c, s[len(c):].strip(" -　")
    parts = s.split(" ", 1)
    if len(parts) == 2 and len(parts[0]) <= 8:
        return parts[0], parts[1].strip()
    return "全球", s


def classify(title):
    t = title or ""
    if re.search(r"休市|假期|紀念日", t):
        return "休市", 2
    if re.search(r"CPI|PCE|通膨|物價", t, re.I):
        return "通膨", 3
    if re.search(r"就業|失業|ADP|非農", t, re.I):
        return "就業", 3
    if re.search(r"利率|央行|聯準|FOMC|ECB", t, re.I):
        return "央行", 3
    if re.search(r"GDP|PMI|景氣|信心|耐久財|所得|支出|零售|製造", t, re.I):
        return "經濟數據", 2
    if re.search(r"公債|標售|拍賣", t):
        return "債券", 1
    return "財經", 1


def normalize_lines(text):
    skip = re.compile(r"^(本週大財經|一週財經行事曆|日期|時間|國家|事件|資料來源|永豐|Sinopac|Page|\d+)$")
    lines = []
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line or skip.search(line):
            continue
        if re.search(r"20\d{6}.*財經行事曆", line):
            continue
        lines.append(line)
    return lines


def parse_table_text(text):
    """永豐第一頁是「日期 / 時間 / 事件」表格，用表格模式解析，避免第二頁雜表或表頭碎片混入。"""
    flat = re.sub(r"\s+", " ", text.replace("～", "~")).strip()
    flat = re.sub(r"本週大財經\s*(?:\(?\d{4}/\d{1,2}/\d{1,2}\s*~\s*\d{1,2}/\d{1,2}\)?)?", " ", flat)
    row_re = re.compile(
        r"(?:(?P<date>\d{1,2}/\d{1,2})\s*(?:\([^)]*\))?\s*)?"
        r"(?P<time>全天|\d{1,2}:\d{2})\s*"
        r"(?P<body>[【\[][^】\]]+[】\]].*?)"
        r"(?=(?:\d{1,2}/\d{1,2}\s*(?:\([^)]*\))?\s*)?(?:全天|\d{1,2}:\d{2})\s*[【\[]|$)"
    )
    out = []
    current_md = None
    for m in row_re.finditer(flat):
        if m.group("date"):
            current_md = m.group("date")
        if not current_md:
            continue
        body = re.sub(r"\s+", " ", m.group("body")).strip()
        if not re.match(r"^[【\[][^】\]]+[】\]]", body):
            continue
        out.append((current_md, m.group("time"), body))
    return out


def parse_events(text, report_title, pdf_url):
    year, start, _end, week_label = parse_week(report_title, text)
    rows = []

    parsed = parse_table_text(text)
    if not parsed:
        current_md = None
        date_re = re.compile(r"^(?P<md>\d{1,2}/\d{1,2})(?:\s*\([^)]*\))?\s*(?P<rest>.*)$")
        time_re = re.compile(r"^(?P<time>全天|\d{1,2}:\d{2})\s+(?P<rest>.+)$", re.I)
        for line in normalize_lines(text):
            m = date_re.match(line)
            rest = line
            if m:
                current_md = m.group("md")
                rest = m.group("rest").strip()
            if not current_md or not rest or not re.search(r"^(全天|\d{1,2}:\d{2}|[【\[])", rest):
                continue
            tm = time_re.match(rest)
            if tm:
                parsed.append((current_md, tm.group("time"), tm.group("rest").strip()))

    for md, event_time, rest in parsed:
        month, day = map(int, md.split("/"))
        current_date = dt.date(year, month, day)
        region, title = split_region_title(rest)
        title = re.sub(r"\s+", " ", title).strip(" -　⭐★")
        if len(title) < 2:
            continue
        category, importance = classify(title)
        rows.append({
            "event_date": current_date.isoformat(),
            "event_time": event_time,
            "country": region[:20],
            "title": title[:200],
            "category": category,
            "importance": importance,
            "source": SOURCE,
            "source_url": pdf_url,
            "report_title": report_title[:200],
            "published_at": start.isoformat(),
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
    uniq = {}
    for row in rows:
        key = (row["event_date"], row["event_time"], row["country"], row["title"], row["source"])
        uniq[key] = row
    return list(uniq.values())


def main():
    log("=== fetch_spf_calendar start ===")
    try:
        pdf_url, title = latest_pdf_link()
        log(f"  latest PDF: {title or pdf_url}")
        text = extract_pdf_text(download_pdf(pdf_url))
        rows = parse_events(text, title or "永豐期貨一週財經行事曆", pdf_url)
        if not rows:
            raise RuntimeError("PDF 已下載，但沒有解析到任何行事曆事件")
        sb_delete("market_calendar_events", f"source=eq.{quote(SOURCE, safe='')}")
        sb_upsert(
            "market_calendar_events",
            rows,
            on_conflict="event_date,event_time,country,title,source",
            batch=200,
        )
        mark_status("fetch_spf_calendar", True)
        log(f"  calendar rows={len(rows)} source={pdf_url}")
        log("=== fetch_spf_calendar done ===")
    except Exception as exc:
        mark_status("fetch_spf_calendar", False, str(exc))
        raise


if __name__ == "__main__":
    main()
