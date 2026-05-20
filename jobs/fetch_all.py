#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
stock-lab 盤後抓取主程式
抓 TWSE(上市) / TPEX(上櫃) / MOPS(公開資訊) 全部資料 -> 寫進 Supabase

執行環境：GitHub Actions（能連網）
本機/沙箱無法連網時會在每個來源印出錯誤並寫進 data_status，不會整支掛掉。

需要的環境變數（GitHub Secrets）：
  SUPABASE_URL           你的 Supabase Project URL
  SUPABASE_SERVICE_KEY   service_role key（只放 Secrets，勿 commit）

用法：
  python jobs/fetch_all.py            # 全部抓
  python jobs/fetch_all.py --only twse_price   # 只抓某模組（除錯用）
"""

import os
import sys
import time
import json
import datetime as dt
import traceback

import requests

# ------------------------------------------------------------------
# 基本設定
# ------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# 節流：每次對官方網站請求之間至少間隔幾秒，避免被擋
THROTTLE_SEC = float(os.environ.get("THROTTLE_SEC", "3"))

# 連線逾時 / 重試
TIMEOUT = 30
RETRY = 3

HEADERS_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}

TODAY = dt.date.today()


def log(msg):
    print(f"[{dt.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def roc_date(d: dt.date) -> str:
    """西元轉民國年字串，例 2026-05-16 -> 115/05/16（部分 TWSE 端點要民國）"""
    return f"{d.year - 1911}/{d.month:02d}/{d.day:02d}"


def ymd(d: dt.date) -> str:
    return d.strftime("%Y%m%d")


def parse_roc_or_ymd(v):
    s = str(v or "").strip().replace("/", "").replace("-", "")
    try:
        if len(s) == 7:  # 1150518
            return dt.date(int(s[:3]) + 1911, int(s[3:5]), int(s[5:7]))
        if len(s) == 8:  # 20260518
            return dt.date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except Exception:
        return None
    return None


def last_weekday(d: dt.date) -> dt.date:
    """OpenAPI 收盤端點不回日期，回最近一個工作日當交易日近似值。
    （週六->週五、週日->週五；國定假日的細微誤差待第四階段用法人實際交易日校正）"""
    while d.weekday() >= 5:  # 5=六 6=日
        d -= dt.timedelta(days=1)
    return d


TRADE_DAY = last_weekday(dt.date.today())


# ------------------------------------------------------------------
# HTTP（含重試 + 節流）
# ------------------------------------------------------------------
def http_get(url, params=None, expect="json"):
    last_err = None
    for attempt in range(1, RETRY + 1):
        try:
            r = requests.get(
                url, params=params, headers=HEADERS_BROWSER, timeout=TIMEOUT
            )
            time.sleep(THROTTLE_SEC)
            if r.status_code != 200:
                last_err = f"HTTP {r.status_code}"
                continue
            if expect == "json":
                return r.json()
            return r.text
        except Exception as e:  # noqa
            last_err = f"{type(e).__name__}: {e}"
            time.sleep(THROTTLE_SEC * attempt)
    raise RuntimeError(f"GET 失敗 {url} ({last_err})")


# ------------------------------------------------------------------
# Supabase 寫入（用 REST，不需額外套件；service_role 繞過 RLS）
# ------------------------------------------------------------------
def sb_headers():
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        # upsert：主鍵衝突就覆蓋
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }


def sb_upsert(table, rows, on_conflict=None, batch=500):
    """批次 upsert。rows 為 list[dict]。"""
    if not rows:
        log(f"  {table}: 0 筆，略過")
        return 0
    # 防呆 1：只允許正規上市櫃普通股代號（4 位數字、首位 1-9）
    import re as _re
    _SYMBOLED = {
        "daily_prices", "daily_signals", "candidate_pool",
        "institutional_trades", "margin_trades", "stocks",
        "theme_stocks", "monthly_revenue",
    }
    if table in _SYMBOLED:
        _ok = _re.compile(r"^[1-9]\d{3}$")
        _b = len(rows)
        rows = [r for r in rows if _ok.match(str(r.get("symbol", "")).strip())]
        if _b - len(rows):
            log(f"  ⚠️ {table}: 剔除 {_b - len(rows)} 筆非普通股代號")
        if not rows:
            log(f"  {table}: 過濾後 0 筆，略過")
            return 0
    # 防呆 2：有 date 欄位的表，週六/週日日期一律剔除（非交易日無真資料）
    _DATED = {
        "daily_prices", "daily_signals", "candidate_pool",
        "institutional_trades", "margin_trades",
    }
    if table in _DATED:
        def _wknd(s):
            try:
                y, m, dd = str(s)[:10].split("-")
                return dt.date(int(y), int(m), int(dd)).weekday() >= 5
            except Exception:
                return False

        b = len(rows)
        rows = [r for r in rows if not _wknd(r.get("date"))]
        if b - len(rows):
            log(f"  ⚠️ {table}: 剔除 {b - len(rows)} 筆非交易日(週末)")
        if not rows:
            log(f"  {table}: 過濾後 0 筆，略過")
            return 0
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_KEY 環境變數")

    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"

    total = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i : i + batch]
        for attempt in range(1, RETRY + 1):
            try:
                r = requests.post(
                    url, headers=sb_headers(), data=json.dumps(chunk), timeout=TIMEOUT
                )
                if r.status_code in (200, 201, 204):
                    total += len(chunk)
                    break
                else:
                    if attempt == RETRY:
                        raise RuntimeError(
                            f"Supabase 寫入失敗 {table} HTTP {r.status_code}: {r.text[:300]}"
                        )
                    time.sleep(2 * attempt)
            except Exception as e:  # noqa
                if attempt == RETRY:
                    raise
                time.sleep(2 * attempt)
    log(f"  {table}: 寫入 {total} 筆")
    return total


def sb_delete(table, query):
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_KEY 環境變數")
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    r = requests.delete(url, headers=sb_headers(), timeout=TIMEOUT)
    if r.status_code not in (200, 204):
        raise RuntimeError(f"Supabase 刪除失敗 {table} HTTP {r.status_code}: {r.text[:300]}")
    return True


def mark_status(source, ok, error=""):
    try:
        sb_upsert(
            "data_status",
            [
                {
                    "source": source,
                    "ok": ok,
                    "finished_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                    "error": (error or "")[:1000],
                    "run_date": TODAY.isoformat(),
                }
            ],
        )
    except Exception as e:  # noqa
        log(f"  （data_status 寫入也失敗：{e}）")


def num(v):
    """把官方資料的 '1,234'、'--'、'X' 等轉成數字或 None"""
    if v is None:
        return None
    s = str(v).replace(",", "").replace("+", "").strip()
    if s in ("", "--", "---", "X", "x", "N/A", "null", "除權息", "除息", "除權"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def to_int(v):
    f = num(v)
    return int(f) if f is not None else None


# ==================================================================
# 1. TWSE 上市 每日收盤行情
#    端點：STOCK_DAY_ALL（全部上市股票當日行情，回 JSON）
# ==================================================================
def fetch_twse_price():
    log("TWSE 上市收盤行情…")
    url = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
    data = http_get(url, expect="json")
    rows = []
    for d in data:
        # 欄位：Code,Name,TradeVolume,TradeValue,OpeningPrice,HighestPrice,
        #       LowestPrice,ClosingPrice,Change,Transaction
        close = num(d.get("ClosingPrice"))
        chg = num(d.get("Change"))
        row_date = parse_roc_or_ymd(d.get("Date")) or TRADE_DAY
        rows.append(
            {
                "date": row_date.isoformat(),
                "symbol": d.get("Code"),
                "open": num(d.get("OpeningPrice")),
                "high": num(d.get("HighestPrice")),
                "low": num(d.get("LowestPrice")),
                "close": close,
                "change": chg,
                "change_percent": round((chg / (close - chg) * 100), 2)
                if (close is not None and chg is not None and (close - chg))
                else None,
                "volume": to_int(d.get("TradeVolume")),
                "amount": to_int(d.get("TradeValue")),
                "turnover_rate": None,
                "market": "TWSE",
            }
        )
    sb_upsert("daily_prices", rows, on_conflict="date,symbol")
    # 順便維護 stocks 基本清單
    stk = [
        {"symbol": d.get("Code"), "name": d.get("Name"), "market": "TWSE"}
        for d in data
        if d.get("Code")
    ]
    sb_upsert("stocks", stk, on_conflict="symbol")
    return len(rows)


# ==================================================================
# 2. TPEX 上櫃 每日收盤行情
#    端點：tpex_mainboard_daily_close_quotes
# ==================================================================
def fetch_tpex_price():
    log("TPEX 上櫃收盤行情…")
    url = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes"
    data = http_get(url, expect="json")
    rows, stk = [], []
    for d in data:
        # 欄位名稱以 TPEX OpenAPI 為準（中文鍵）
        sym = d.get("SecuritiesCompanyCode") or d.get("Code")
        name = d.get("CompanyName") or d.get("Name")
        close = num(d.get("Close"))
        chg = num(d.get("Change"))
        row_date = parse_roc_or_ymd(d.get("Date")) or TRADE_DAY
        rows.append(
            {
                "date": row_date.isoformat(),
                "symbol": sym,
                "open": num(d.get("Open")),
                "high": num(d.get("High")),
                "low": num(d.get("Low")),
                "close": close,
                "change": chg,
                "change_percent": round((chg / (close - chg) * 100), 2)
                if (close is not None and chg is not None and (close - chg))
                else None,
                "volume": to_int(d.get("TradingShares")),
                "amount": to_int(d.get("TransactionAmount")),
                "turnover_rate": None,
                "market": "TPEX",
            }
        )
        if sym:
            stk.append({"symbol": sym, "name": name, "market": "TPEX"})
    sb_upsert("daily_prices", rows, on_conflict="date,symbol")
    sb_upsert("stocks", stk, on_conflict="symbol")
    return len(rows)


# ==================================================================
# 3. TWSE 三大法人買賣超（個股）
#    端點：fund/T86（回 JSON，需帶 response=json & date & selectType=ALLBUT0999）
# ==================================================================
def fetch_twse_inst():
    log("TWSE 三大法人買賣超…")
    url = "https://www.twse.com.tw/rwd/zh/fund/T86"
    # 從今天往前找最近一個有資料的交易日（最多回找 10 天，跨假日/連假）
    for back in range(0, 10):
        d = TODAY - dt.timedelta(days=back)
        if d.weekday() >= 5:  # 週六日直接跳過，省一次請求
            continue
        j = http_get(
            url,
            params={"response": "json", "date": ymd(d), "selectType": "ALLBUT0999"},
            expect="json",
        )
        if j and j.get("stat") == "OK" and j.get("data"):
            rows = []
            for f in j["data"]:
                # 0證券代號 1證券名稱 ... 外資/投信/自營 ... 三大法人買賣超(末欄)
                rows.append(
                    {
                        "date": d.isoformat(),
                        "symbol": f[0].strip(),
                        "foreign_buy_sell": to_int(f[4]) if len(f) > 4 else None,
                        "investment_trust_buy_sell": to_int(f[10])
                        if len(f) > 10
                        else None,
                        "dealer_buy_sell": to_int(f[11]) if len(f) > 11 else None,
                        "total_buy_sell": to_int(f[-1]),
                        "market": "TWSE",
                    }
                )
            log(f"  （採用交易日 {d}）")
            sb_upsert("institutional_trades", rows, on_conflict="date,symbol")
            return len(rows)
    # 10 天內都查無（極少見：長假），視為正常空資料，不算失敗
    log("  近 10 日查無法人資料（可能長假），記 0 筆")
    return 0


# ==================================================================
# 3b. TPEX 上櫃 三大法人買賣超（個股）
#    端點：3insti/daily_trade/3itrade_hedge_result.php
# ==================================================================
def fetch_tpex_inst():
    log("TPEX 上櫃三大法人買賣超…")
    url = "https://www.tpex.org.tw/web/stock/3insti/daily_trade/3itrade_hedge_result.php"
    for back in range(0, 10):
        d = TODAY - dt.timedelta(days=back)
        if d.weekday() >= 5:
            continue
        j = http_get(
            url,
            params={
                "l": "zh-tw",
                "o": "json",
                "se": "EW",
                "t": "D",
                "d": roc_date(d),
                "s": "0,asc",
            },
            expect="json",
        )
        tables = j.get("tables") if isinstance(j, dict) else None
        target = tables[0] if tables else None
        data = target.get("data") if target else None
        if not data:
            continue
        row_date = parse_roc_or_ymd(target.get("date")) or d
        rows = []
        for f in data:
            if len(f) < 24:
                continue
            rows.append(
                {
                    "date": row_date.isoformat(),
                    "symbol": str(f[0]).strip(),
                    # TPEx 欄位：外資總買賣超=10，投信買賣超=13，自營商合計=22，三大法人合計=23
                    "foreign_buy_sell": to_int(f[10]),
                    "investment_trust_buy_sell": to_int(f[13]),
                    "dealer_buy_sell": to_int(f[22]),
                    "total_buy_sell": to_int(f[23]),
                    "market": "TPEX",
                }
            )
        log(f"  （採用交易日 {row_date}）")
        sb_upsert("institutional_trades", rows, on_conflict="date,symbol")
        return len(rows)
    log("  近 10 日查無上櫃法人資料（可能長假），記 0 筆")
    return 0


# ==================================================================
# 4. TWSE 融資融券（個股）
#    端點：exchangeReport/MI_MARGN
# ==================================================================
def fetch_twse_margin():
    log("TWSE 融資融券…")
    url = "https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN"
    for back in range(0, 10):
        d = TODAY - dt.timedelta(days=back)
        if d.weekday() >= 5:
            continue
        j = http_get(
            url,
            params={"response": "json", "date": ymd(d), "selectType": "ALL"},
            expect="json",
        )
        if not (j and j.get("stat") == "OK"):
            continue
        # 取含證券代號的個股明細表
        target = None
        for t in j.get("tables") or []:
            flds = "".join(map(str, t.get("fields", [])))
            if "股票代號" in flds or "證券代號" in flds:
                target = t
                break
        if not target or not target.get("data"):
            continue
        rows = []
        for f in target["data"]:
            rows.append(
                {
                    "date": d.isoformat(),
                    "symbol": str(f[0]).strip(),
                    "margin_balance": to_int(f[6]) if len(f) > 6 else None,
                    "short_balance": to_int(f[12]) if len(f) > 12 else None,
                    "margin_change": None,
                    "short_change": None,
                    "short_margin_ratio": None,
                    "market": "TWSE",
                }
            )
        log(f"  （採用交易日 {d}）")
        sb_upsert("margin_trades", rows, on_conflict="date,symbol")
        return len(rows)
    log("  近 10 日查無資券資料（可能長假），記 0 筆")
    return 0


# ==================================================================
# 5. MOPS 重大訊息（當日）
#    來源：新版公開資訊觀測站首頁 API。
# ==================================================================
def fetch_mops_announcements():
    log("MOPS 重大訊息…")
    home_url = "https://mops.twse.com.tw/mops/#/web/home"
    api_url = "https://mops.twse.com.tw/mops/api/home_page/t05sr01_1"
    markets = [
        ("", "全部"),
        ("sii", "上市"),
        ("otc", "上櫃"),
    ]
    rows, seen = [], set()

    def post_home(market_kind):
        payload = {"count": 20, "marketKind": market_kind}
        headers = dict(HEADERS_BROWSER)
        headers.update(
            {
                "Content-Type": "application/json",
                "Referer": home_url,
                "Origin": "https://mops.twse.com.tw",
            }
        )
        last_err = None
        for attempt in range(1, RETRY + 1):
            try:
                r = requests.post(
                    api_url, headers=headers, data=json.dumps(payload), timeout=TIMEOUT
                )
                time.sleep(THROTTLE_SEC)
                if r.status_code == 200:
                    return r.json()
                last_err = f"HTTP {r.status_code}: {r.text[:120]}"
            except Exception as exc:  # noqa
                last_err = f"{type(exc).__name__}: {exc}"
            time.sleep(THROTTLE_SEC * attempt)
        raise RuntimeError(f"MOPS home_page/t05sr01_1 失敗 ({last_err})")

    for market_kind, label in markets:
        data = post_home(market_kind)
        if int(data.get("code", 0) or 0) != 200:
            log(f"  MOPS {label}: API code={data.get('code')} message={data.get('message')}")
            continue
        items = ((data.get("result") or {}).get("data") or [])
        for item in items:
            row_date = parse_roc_or_ymd(item.get("date"))
            if not row_date:
                continue
            symbol = str(item.get("companyId") or "").strip()
            if not symbol.isdigit():
                symbol = "".join(ch for ch in symbol if ch.isdigit())
            if len(symbol) != 4:
                continue
            title = " ".join(str(item.get("subject") or "").split())
            company = str(item.get("companyAbbreviation") or "").strip()
            if not title:
                continue
            key = (row_date.isoformat(), symbol, title)
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "date": row_date.isoformat(),
                    "symbol": symbol,
                    "company_name": company or None,
                    "title": title[:500],
                    "content": None,
                    "category": f"重大訊息-{label}",
                    "source_url": home_url,
                }
            )

    # Re-running Actions should replace the recent MOPS window, not duplicate it.
    target_days = {TODAY - dt.timedelta(days=i) for i in range(0, 7)}
    target_days.update(parse_roc_or_ymd(r.get("date")) for r in rows)
    for day in sorted(d for d in target_days if d):
        try:
            sb_delete("mops_announcements", f"date=eq.{day.isoformat()}")
        except Exception as exc:
            log(f"  MOPS duplicate cleanup skipped for {day}: {exc}")
    sb_upsert("mops_announcements", rows)
    return len(rows)


# ==================================================================
# 6. MOPS 月營收（最近一個已公布月份）
#    端點：t21sc03（國內公司月營收彙總）
# ==================================================================
def fetch_monthly_revenue():
    log("MOPS 月營收…")
    # 月營收次月 10 日前公布，取上個月
    first = TODAY.replace(day=1)
    last_month = first - dt.timedelta(days=1)
    ym = f"{last_month.year}-{last_month.month:02d}"
    import re

    rows = []
    for market in ("sii", "otc", "rotc"):
        url = "https://mopsov.twse.com.tw/nas/t21/{}/t21sc03_{}_{}_0.html".format(
            market, last_month.year - 1911, last_month.month
        )
        try:
            txt = http_get(url, expect="text")
        except Exception as e:  # noqa
            log(f"  MOPS 月營收 {market} skipped: {e}")
            continue
        before = len(rows)
        for m in re.finditer(r"<tr[^>]*>(.*?)</tr>", txt, re.S):
            cells = re.findall(r"<td[^>]*>(.*?)</td>", m.group(1), re.S)
            cells = [
                re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", c).replace("&nbsp;", " ")).strip()
                for c in cells
            ]
            if len(cells) >= 8 and re.match(r"^\d{4}$", cells[0]):
                revenue = to_int(cells[2])
                last_year_revenue = num(cells[4]) if len(cells) > 4 else None
                yoy = (
                    round((revenue - last_year_revenue) / last_year_revenue * 100, 2)
                    if revenue is not None and last_year_revenue
                    else None
                )
                rows.append(
                    {
                        "year_month": ym,
                        "symbol": cells[0],
                        "revenue": revenue,
                        "mom_percent": num(cells[5]) if len(cells) > 5 else None,
                        "yoy_percent": yoy,
                        "accumulated_revenue": to_int(cells[6]) if len(cells) > 6 else None,
                        "accumulated_yoy_percent": num(cells[8])
                        if len(cells) > 8
                        else None,
                    }
                )
        log(f"  MOPS 月營收 {market}: {len(rows)-before} 筆")
    sb_upsert("monthly_revenue", rows, on_conflict="year_month,symbol")
    return len(rows)


# ==================================================================
# 主流程
# ==================================================================
JOBS = [
    ("twse_price", fetch_twse_price),
    ("tpex_price", fetch_tpex_price),
    ("twse_inst", fetch_twse_inst),
    ("tpex_inst", fetch_tpex_inst),
    ("twse_margin", fetch_twse_margin),
    ("mops_announcements", fetch_mops_announcements),
    ("monthly_revenue", fetch_monthly_revenue),
]


def main():
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]

    log(f"=== stock-lab 抓取開始 {TODAY} ===")
    if not SUPABASE_URL or not SERVICE_KEY:
        log("⚠️  未設定 SUPABASE_URL / SUPABASE_SERVICE_KEY，僅做連線測試會失敗")

    ok_count, fail_count = 0, 0
    for name, fn in JOBS:
        if only and name != only:
            continue
        try:
            n = fn()
            mark_status(name, True, "")
            log(f"✅ {name} 完成（{n} 筆）")
            ok_count += 1
        except Exception as e:  # noqa
            err = f"{type(e).__name__}: {e}"
            log(f"❌ {name} 失敗：{err}")
            traceback.print_exc()
            mark_status(name, False, err)
            fail_count += 1

    log(f"=== 結束：成功 {ok_count} / 失敗 {fail_count} ===")
    # 全失敗才讓 Actions 標紅，部分失敗仍算通過（其他資料還是進得去）
    if ok_count == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
