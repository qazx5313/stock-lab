#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
compute_signals.py — 第四階段核心計算引擎

讀 daily_prices / institutional_trades / monthly_revenue，
算出：
  - 技術指標：MA5/10/20/60、KD、MACD、RSI、量增倍數、漲跌
  - 法人連買天數
  - 五大面向評分(價格/量能/技術/籌碼/題材) → daily_signals
  - 題材分類 + 熱度評分 → themes / theme_stocks
  - 候選池 → candidate_pool

無第三方套件（純 Python 算指標），GitHub Actions 可直接跑。
"""
import datetime as dt
from collections import defaultdict

from sb_common import log, sb_select, sb_one, sb_upsert, mark_status

# ---- 產業 -> 題材對應（規則版；之後可在後台維護）----
INDUSTRY_THEME = {
    "半導體": "半導體設備",
    "電子零組件": "PCB / CCL",
    "電腦及週邊設備": "AI 伺服器",
    "光電": "面板",
    "通信網路": "AI 伺服器",
    "電子通路": "AI 伺服器",
    "其他電子": "散熱",
    "電機機械": "重電",
    "玻璃陶瓷": "玻纖布",
    "鋼鐵": "重電",
    "汽車": "電動車",
}

# 已知強勢產業鏈（首版補強題材歸類，之後資料變多可弱化）
SYMBOL_THEME = {
    "1815": "玻纖布", "5340": "玻纖布", "1802": "玻纖布",
    "6274": "PCB / CCL", "2383": "PCB / CCL", "6213": "PCB / CCL",
    "2368": "PCB / CCL", "3044": "PCB / CCL", "3037": "PCB / CCL",
    "4958": "PCB / CCL", "2382": "AI 伺服器", "6669": "AI 伺服器",
    "3231": "AI 伺服器",
}


# ---------- 技術指標（純 Python）----------
def ma(seq, n):
    return round(sum(seq[-n:]) / n, 2) if len(seq) >= n else None


def rsi(closes, n=14):
    if len(closes) < n + 1:
        return None
    gains, losses = [], []
    for i in range(-n, 0):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    ag = sum(gains) / n
    al = sum(losses) / n
    if al == 0:
        return 100.0
    rs = ag / al
    return round(100 - 100 / (1 + rs), 2)


def kd(highs, lows, closes, n=9):
    if len(closes) < n:
        return None, None
    k, d = 50.0, 50.0
    for i in range(n - 1, len(closes)):
        hh = max(highs[i - n + 1 : i + 1])
        ll = min(lows[i - n + 1 : i + 1])
        rsv = 50.0 if hh == ll else (closes[i] - ll) / (hh - ll) * 100
        k = 2 / 3 * k + 1 / 3 * rsv
        d = 2 / 3 * d + 1 / 3 * k
    return round(k, 2), round(d, 2)


def ema(seq, n):
    if len(seq) < n:
        return None
    k = 2 / (n + 1)
    e = sum(seq[:n]) / n
    for v in seq[n:]:
        e = v * k + e * (1 - k)
    return e


def macd(closes):
    if len(closes) < 26:
        return None, None, None
    ef = ema(closes, 12)
    es = ema(closes, 26)
    if ef is None or es is None:
        return None, None, None
    dif = ef - es
    # 簡化 signal：用近 9 日 DIF 均值近似
    difs = []
    for j in range(9, 0, -1):
        sub = closes[: len(closes) - j + 1]
        a, b = ema(sub, 12), ema(sub, 26)
        if a is not None and b is not None:
            difs.append(a - b)
    sig = sum(difs) / len(difs) if difs else dif
    return round(dif, 3), round(sig, 3), round((dif - sig) * 2, 3)


def main():
    today = dt.date.today()
    log("=== compute_signals 開始 ===")

    # 1) 抓最近交易日（用 sb_one，PostgREST limit，不套分頁 Range）
    newest = sb_one("daily_prices", "select=date&order=date.desc&limit=1")
    dates = sb_select("daily_prices", "select=date", page_size=1000)
    all_d = sorted({str(r["date"])[:10] for r in dates})
    if not all_d:
        log("daily_prices 無資料，結束")
        mark_status("compute_signals", False, "no daily_prices")
        return
    latest = (
        str(newest["date"])[:10] if newest else all_d[-1]
    )
    log(
        f"資料庫日期範圍：{all_d[0]} ~ {all_d[-1]}（共 {len(all_d)} 個交易日）"
    )
    log(f"採用最近交易日：{latest}")

    # 2) 拉全部歷史價格，依 symbol 整理時間序列
    prices = sb_select(
        "daily_prices",
        "select=date,symbol,open,high,low,close,change,change_percent,volume,amount&order=date.asc",
        page_size=1000,
    )
    series = defaultdict(list)
    for r in prices:
        series[r["symbol"]].append(r)

    # 3) 個股清單（名稱/產業）
    stocks = sb_select("stocks", "select=symbol,name,industry,market", page_size=1000)
    smap = {s["symbol"]: s for s in stocks}

    # 4) 法人（近 10 個交易日，算連買）
    inst = sb_select(
        "institutional_trades",
        "select=date,symbol,foreign_buy_sell,total_buy_sell&order=date.asc",
        page_size=1000,
    )
    inst_by_sym = defaultdict(list)
    for r in inst:
        inst_by_sym[r["symbol"]].append(r)

    signals, theme_heat = [], defaultdict(
        lambda: {"gain": [], "vol": [], "members": []}
    )

    for sym, rows in series.items():
        rows = [r for r in rows if r.get("close") is not None]
        if not rows or str(rows[-1]["date"])[:10] != latest:
            continue
        closes = [float(r["close"]) for r in rows]
        highs = [float(r["high"]) if r.get("high") else float(r["close"]) for r in rows]
        lows = [float(r["low"]) if r.get("low") else float(r["close"]) for r in rows]
        vols = [float(r["volume"]) if r.get("volume") else 0 for r in rows]
        cur = rows[-1]

        ma5, ma20, ma60 = ma(closes, 5), ma(closes, 20), ma(closes, 60)
        rsi14 = rsi(closes)
        kk, dd = kd(highs, lows, closes)
        dif, sig, hist = macd(closes)
        vol_x = round(vols[-1] / (sum(vols[-21:-1]) / 20), 2) if len(vols) >= 21 and sum(vols[-21:-1]) else None
        cp = cur.get("change_percent")
        try:
            cp = float(cp) if cp is not None else (
                round((closes[-1] - closes[-2]) / closes[-2] * 100, 2)
                if len(closes) >= 2 and closes[-2] else None
            )
        except Exception:  # noqa
            cp = None

        # 法人連買天數
        cont_buy = 0
        for ir in reversed(inst_by_sym.get(sym, [])):
            v = ir.get("total_buy_sell") or ir.get("foreign_buy_sell")
            if v and v > 0:
                cont_buy += 1
            else:
                break

        # ---- 五大面向評分（0~100）----
        price_s = 60
        if ma5 and ma20:
            price_s = 85 if closes[-1] > ma5 > ma20 else (70 if closes[-1] > ma20 else 40)
        vol_s = 50 if not vol_x else min(100, int(50 + (vol_x - 1) * 40))
        tech_s = 50
        if rsi14 is not None:
            tech_s = 80 if 55 <= rsi14 <= 75 else (60 if rsi14 < 55 else 40)
        if kk and dd and kk > dd:
            tech_s += 10
        if hist is not None and hist > 0:
            tech_s += 5
        tech_s = max(0, min(100, tech_s))
        chip_s = min(100, 50 + cont_buy * 12)
        ind = (smap.get(sym) or {}).get("industry") or ""
        theme = SYMBOL_THEME.get(sym) or INDUSTRY_THEME.get(ind)
        theme_s = 70 if theme else 45

        final = round(
            price_s * 0.2 + vol_s * 0.2 + tech_s * 0.25 + chip_s * 0.2 + theme_s * 0.15
        )

        tags = []
        if vol_x and vol_x >= 1.5:
            tags.append("爆量")
        if ma5 and ma20 and closes[-1] > ma5 > ma20:
            tags.append("均線多頭")
        if cont_buy >= 3:
            tags.append(f"法人連{cont_buy}買")
        if cp is not None and cp >= 5:
            tags.append("強漲")

        signals.append(
            {
                "date": latest,
                "symbol": sym,
                "price_score": price_s,
                "volume_score": vol_s,
                "technical_score": tech_s,
                "chip_score": chip_s,
                "theme_score": theme_s,
                "final_score": final,
                "signal_tags": tags,
                "summary": (
                    f"收{closes[-1]} 漲跌{cp if cp is not None else '—'}% "
                    f"MA20={ma20} RSI={rsi14} K={kk} D={dd} "
                    f"量比={vol_x} 法人連買={cont_buy}"
                ),
            }
        )

        if theme and cp is not None:
            theme_heat[theme]["gain"].append(cp)
            if vol_x:
                theme_heat[theme]["vol"].append(vol_x)
            theme_heat[theme]["members"].append(
                {"symbol": sym, "score": final, "cp": cp}
            )

    log(f"算出 {len(signals)} 檔訊號")
    sb_upsert("daily_signals", signals, on_conflict="date,symbol")

    # ---- 題材熱度 ----
    themes_rows, theme_stock_rows = [], []
    tid = 1
    ranked = sorted(
        theme_heat.items(),
        key=lambda kv: (sum(kv[1]["gain"]) / len(kv[1]["gain"])) if kv[1]["gain"] else 0,
        reverse=True,
    )
    for name, info in ranked:
        n = len(info["gain"]) or 1
        avg_gain = sum(info["gain"]) / n
        avg_vol = (sum(info["vol"]) / len(info["vol"])) if info["vol"] else 1
        heat = max(
            0, min(100, round(avg_gain * 6 + (avg_vol - 1) * 25 + min(n, 20)))
        )
        status = "主流" if heat >= 75 else ("增溫" if heat >= 55 else "觀察")
        themes_rows.append(
            {
                "id": tid,
                "theme_name": name,
                "description": f"{name}：成分 {n} 檔，平均漲幅 {round(avg_gain,2)}%，量比 {round(avg_vol,2)}x",
                "heat_score": heat,
                "trend_status": status,
            }
        )
        for m in sorted(info["members"], key=lambda x: x["score"], reverse=True):
            theme_stock_rows.append(
                {
                    "theme_id": tid,
                    "symbol": m["symbol"],
                    "role": "領漲" if m["cp"] >= avg_gain else "成分",
                    "supply_chain_level": "",
                    "relevance_score": m["score"],
                    "note": "",
                }
            )
        tid += 1
    sb_upsert("themes", themes_rows, on_conflict="id")
    sb_upsert("theme_stocks", theme_stock_rows, on_conflict="theme_id,symbol")
    log(f"題材 {len(themes_rows)} 個，成分 {len(theme_stock_rows)} 筆")

    # ---- 候選池：綜合分前 40 ----
    top = sorted(signals, key=lambda s: s["final_score"], reverse=True)[:40]
    cand = [
        {
            "date": latest,
            "symbol": s["symbol"],
            "name": (smap.get(s["symbol"]) or {}).get("name") or s["symbol"],
            "source_module": "compute_signals",
            "candidate_type": "綜合評分",
            "reason": "；".join(s["signal_tags"]) or s["summary"][:60],
            "score": s["final_score"],
        }
        for s in top
    ]
    sb_upsert("candidate_pool", cand)
    log(f"候選池 {len(cand)} 檔")

    mark_status("compute_signals", True, f"signals={len(signals)} themes={len(themes_rows)}")
    log("=== compute_signals 完成 ===")


if __name__ == "__main__":
    main()
