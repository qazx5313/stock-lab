#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sb_common.py — 所有 job 共用的 Supabase 連線與工具函式
（fetch_all.py 之後也可改用這個，但為降低風險暫不動它）
"""
import os
import json
import time
import datetime as dt
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
TIMEOUT = 30
RETRY = 3


def log(msg):
    print(f"[{dt.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def num(v):
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


def _headers(write=False):
    h = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if write:
        h["Prefer"] = "resolution=merge-duplicates,return=minimal"
    return h


def sb_one(table, query=""):
    """單筆查詢：直接用 PostgREST 的 limit，不套分頁 Range（避免 416）。
    query 例：'select=date&order=date.desc&limit=1'"""
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("缺少 SUPABASE_URL / SUPABASE_SERVICE_KEY")
    base = f"{SUPABASE_URL}/rest/v1/{table}"
    if query:
        base += "?" + query
    r = requests.get(base, headers=_headers(), timeout=TIMEOUT)
    if r.status_code not in (200, 206):
        raise RuntimeError(f"讀取失敗 {table} HTTP {r.status_code}: {r.text[:200]}")
    data = r.json()
    return data[0] if isinstance(data, list) and data else None


def sb_select(table, query="", page_size=1000, max_rows=200000):
    """分頁讀取整張表/查詢結果，回 list[dict]。query 例：'select=date,close&date=eq.2026-05-15'"""
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("缺少 SUPABASE_URL / SUPABASE_SERVICE_KEY")
    out, start = [], 0
    base = f"{SUPABASE_URL}/rest/v1/{table}"
    if query:
        base += "?" + query
    while True:
        h = _headers()
        h["Range-Unit"] = "items"
        h["Range"] = f"{start}-{start + page_size - 1}"
        r = requests.get(base, headers=h, timeout=TIMEOUT)
        if r.status_code not in (200, 206):
            raise RuntimeError(f"讀取失敗 {table} HTTP {r.status_code}: {r.text[:200]}")
        chunk = r.json()
        out.extend(chunk)
        if len(chunk) < page_size or len(out) >= max_rows:
            break
        start += page_size
    return out


def sb_upsert(table, rows, on_conflict=None, batch=500):
    if not rows:
        log(f"  {table}: 0 筆，略過")
        return 0
    # 防呆 1：有 symbol 欄位的表，只允許正規上市櫃普通股代號
    #   正規：4 位純數字，首位 1-9（排除 00 開頭 ETF、權證 72504U、興櫃 6 位 703819）
    import re as _re

    SYMBOLED = {
        "daily_prices", "daily_signals", "candidate_pool",
        "institutional_trades", "margin_trades", "stocks",
        "theme_stocks", "monthly_revenue",
    }
    if table in SYMBOLED:
        _ok = _re.compile(r"^[1-9]\d{3}$")
        b0 = len(rows)
        rows = [r for r in rows if _ok.match(str(r.get("symbol", "")).strip())]
        d0 = b0 - len(rows)
        if d0:
            log(f"  ⚠️ {table}: 剔除 {d0} 筆非普通股(權證/興櫃/ETF)代號")
        if not rows:
            log(f"  {table}: 過濾後 0 筆，略過")
            return 0
    # 防呆 2：有 date 欄位的表，凡是週六/週日的日期一律剔除（非交易日不可能有真資料）
    DATED = {
        "daily_prices", "daily_signals", "candidate_pool",
        "institutional_trades", "margin_trades",
    }
    if table in DATED:
        import datetime as _dt

        def _is_weekend(s):
            try:
                y, m, dd = str(s)[:10].split("-")
                return _dt.date(int(y), int(m), int(dd)).weekday() >= 5
            except Exception:
                return False

        before = len(rows)
        rows = [r for r in rows if not _is_weekend(r.get("date"))]
        dropped = before - len(rows)
        if dropped:
            log(f"  ⚠️ {table}: 剔除 {dropped} 筆非交易日(週末)資料")
        if not rows:
            log(f"  {table}: 過濾後 0 筆，略過")
            return 0
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("缺少 SUPABASE_URL / SUPABASE_SERVICE_KEY")
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    total = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i : i + batch]
        for attempt in range(1, RETRY + 1):
            try:
                r = requests.post(
                    url, headers=_headers(True), data=json.dumps(chunk), timeout=TIMEOUT
                )
                if r.status_code in (200, 201, 204):
                    total += len(chunk)
                    break
                if attempt == RETRY:
                    raise RuntimeError(
                        f"寫入失敗 {table} HTTP {r.status_code}: {r.text[:300]}"
                    )
                time.sleep(2 * attempt)
            except Exception:
                if attempt == RETRY:
                    raise
                time.sleep(2 * attempt)
    log(f"  {table}: 寫入 {total} 筆")
    return total


def sb_delete(table, query):
    """依條件刪除。query 例：'date=eq.2026-05-15'。用於重算前清當日舊資料避免重複。"""
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("缺少 SUPABASE_URL / SUPABASE_SERVICE_KEY")
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    try:
        r = requests.delete(url, headers=_headers(), timeout=TIMEOUT)
        if r.status_code in (200, 204):
            log(f"  {table}: 已清除舊資料（{query}）")
            return True
        log(f"  {table}: 清除回應 {r.status_code}")
        return False
    except Exception as e:  # noqa
        log(f"  {table}: 清除失敗 {e}")
        return False


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
                    "run_date": dt.date.today().isoformat(),
                }
            ],
        )
    except Exception as e:  # noqa
        log(f"  （data_status 寫入也失敗：{e}）")
