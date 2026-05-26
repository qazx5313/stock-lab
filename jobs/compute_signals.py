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

from sb_common import log, sb_select, sb_one, sb_upsert, sb_delete, mark_status

# ---- 產業 -> 題材對應 ----
# TWSE/TPEX 產業別存的是「兩位數字代碼」（你資料庫實證：28/24/26/25...）
# 同時保留中文 key 當備援（萬一某些來源回中文）
INDUSTRY_THEME = {
    # ---- 數字代碼（TWSE 舊格式備援）----
    "24": "半導體",          "28": "PCB / CCL",
    "25": "AI 伺服器",       "26": "面板",
    "27": "AI 伺服器",       "31": "散熱",
    "14": "鋼鐵",            "05": "重電",
    "15": "重電",            "22": "塑膠",
    "20": "鋼鐵",            "12": "生技醫療",
    "17": "金融",            "23": "橡膠",
    "29": "電子通路",        "30": "資訊服務",
    "32": "文創",            "08": "玻璃陶瓷",
    "21": "電機機械",        "04": "塑膠",
    # ---- 中文產業別備援（來自 stocks.industry，非 FinMind 即時查詢）----
    "半導體業": "半導體", "半導體": "半導體",
    "電子零組件業": "PCB / CCL", "電子零組件": "PCB / CCL",
    "電腦及週邊設備業": "AI 伺服器", "電腦及週邊設備": "AI 伺服器",
    "光電業": "面板", "光電": "面板",
    "通信網路業": "通訊網路", "通信網路": "通訊網路",
    "其他電子業": "其他電子", "其他電子": "其他電子",
    "電子通路業": "電子通路", "電子通路": "電子通路",
    "資訊服務業": "資訊服務", "資訊服務": "資訊服務",
    "電機機械": "電機機械", "電器電纜": "電機機械",
    "鋼鐵工業": "鋼鐵", "鋼鐵": "鋼鐵",
    "玻璃陶瓷": "玻璃陶瓷",
    "汽車工業": "汽車零組件", "汽車": "汽車零組件",
    "生技醫療業": "生技醫療", "生技醫療": "生技醫療", "生技": "生技醫療",
    "化學工業": "化工", "化學": "化工",
    "塑膠工業": "塑膠", "塑膠": "塑膠",
    "橡膠工業": "橡膠", "橡膠": "橡膠",
    "紡織纖維": "紡織",
    "食品工業": "食品", "食品": "食品",
    "水泥工業": "水泥", "水泥": "水泥",
    "造紙工業": "造紙",
    "油電燃氣業": "油電燃氣",
    "建材營造業": "營建", "建材營造": "營建", "營建": "營建",
    "航運業": "航運", "航運": "航運",
    "觀光餐旅": "觀光餐旅", "觀光事業": "觀光餐旅",
    "金融保險業": "金融", "金融保險": "金融", "金融": "金融",
    "貿易百貨業": "貿易百貨", "貿易百貨": "貿易百貨",
    "農業科技業": "農業科技",
    "綠能環保": "綠能環保", "綠能環保業": "綠能環保",
    "數位雲端": "數位雲端", "數位雲端業": "數位雲端",
    "運動休閒": "運動休閒", "運動休閒業": "運動休閒",
    "居家生活": "居家生活", "居家生活業": "居家生活",
    "存託憑證": "其他", "其他業": "其他", "其他": "其他",
}

# 已知強勢產業鏈（補強核心題材的成分股歸類，最優先）
SYMBOL_THEME = {
    "1815": "玻纖布", "5340": "玻纖布", "1802": "玻纖布", "1809": "玻纖布",
    "6274": "PCB / CCL", "2383": "PCB / CCL", "6213": "PCB / CCL",
    "2368": "PCB / CCL", "3044": "PCB / CCL", "3037": "PCB / CCL",
    "4958": "PCB / CCL", "2316": "PCB / CCL", "8046": "PCB / CCL",
    "2382": "AI 伺服器", "6669": "AI 伺服器", "3231": "AI 伺服器",
    "2376": "AI 伺服器", "2356": "AI 伺服器", "3017": "AI 伺服器",
    "3661": "AI 伺服器", "2317": "AI 伺服器",
    "3035": "散熱", "3324": "散熱", "6230": "散熱",
}


def volume_to_lots(v):
    """daily_prices.volume is normalized as shares; screening uses lots."""
    try:
        n = float(v or 0)
    except Exception:
        return 0.0
    return n / 1000 if n >= 1000 else n


def volume_price_profile(rows, closes, highs, lows, vols):
    """Phase 6 量價結構評分：用最新 K 棒與近 20/60 日結構判斷。"""
    if len(closes) < 3:
        return 50, [], []
    close = closes[-1]
    prev_close = closes[-2]
    high = highs[-1]
    low = lows[-1]
    vol = vols[-1]
    avg20 = sum(vols[-21:-1]) / 20 if len(vols) >= 21 and sum(vols[-21:-1]) else 0
    high60 = max(highs[-60:]) if len(highs) >= 60 else max(highs)
    low60 = min(lows[-60:]) if len(lows) >= 60 else min(lows)
    prev_high20 = max(highs[-21:-1]) if len(highs) >= 21 else max(highs[:-1])
    ma20_now = ma(closes, 20)

    score = 50
    tags = []
    risks = []
    up = close > prev_close
    down = close < prev_close
    vol_ratio = vol / avg20 if avg20 else 1

    if up and vol_ratio >= 1.2:
        score += 16
        tags.append("價漲量增")
    elif up and vol_ratio < 0.85:
        score -= 5
        tags.append("價漲量縮")
        risks.append("動能不足")
    if down and vol_ratio >= 1.2:
        score -= 14
        tags.append("價跌量增")
        risks.append("賣壓放大")
    elif down and vol_ratio < 0.85:
        score += 7
        tags.append("價跌量縮")
        tags.append("可能止跌")

    if close <= low60 * 1.12 and vol_ratio >= 1.8 and up:
        score += 12
        tags.append("低檔爆量")
        tags.append("轉強觀察")

    candle_range = max(high - low, 0.01)
    upper_shadow = (high - close) / candle_range
    if close >= high60 * 0.92 and vol_ratio >= 1.8 and upper_shadow >= 0.45:
        score -= 18
        risks.append("高檔爆量長上影")
        risks.append("出貨警告")

    if close > prev_high20 and vol_ratio >= 1.3:
        score += 15
        tags.append("突破放量")
    if ma20_now and abs(close - ma20_now) / close * 100 <= 3 and vol_ratio <= 0.85:
        score += 8
        tags.append("回測量縮")
        tags.append("健康整理")

    return max(0, min(100, round(score, 2))), tags, risks


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
    dates = sb_select("daily_prices", "select=date", page_size=1000, max_rows=900000)
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
        max_rows=900000,
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
        max_rows=500000,
    )
    inst_by_sym = defaultdict(list)
    for r in inst:
        inst_by_sym[r["symbol"]].append(r)

    signals, screen_candidates, theme_heat = [], [], defaultdict(
        lambda: {"gain": [], "vol": [], "members": []}
    )

    for sym, rows in series.items():
        rows = [r for r in rows if r.get("close") is not None]
        if not rows or str(rows[-1]["date"])[:10] != latest:
            continue
        closes = [float(r["close"]) for r in rows]
        highs = [float(r["high"]) if r.get("high") else float(r["close"]) for r in rows]
        lows = [float(r["low"]) if r.get("low") else float(r["close"]) for r in rows]
        vols = [volume_to_lots(r.get("volume")) for r in rows]
        cur = rows[-1]

        ma5, ma10, ma20, ma60 = ma(closes, 5), ma(closes, 10), ma(closes, 20), ma(closes, 60)
        ma20_prev = round(sum(closes[-21:-1]) / 20, 2) if len(closes) >= 21 else None
        rsi14 = rsi(closes)
        kk, dd = kd(highs, lows, closes)
        dif, sig, hist = macd(closes)
        _, _, prev_hist = macd(closes[:-1])
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
        ind = str((smap.get(sym) or {}).get("industry") or "").strip()
        # 代碼可能存成 '5' 或 '05'，兩種都試；再試中文備援
        theme = (
            SYMBOL_THEME.get(sym)
            or INDUSTRY_THEME.get(ind)
            or INDUSTRY_THEME.get(ind.zfill(2))
            or INDUSTRY_THEME.get(ind.lstrip("0"))
        )
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

        vp_score, vp_tags, risk_flags = volume_price_profile(rows, closes, highs, lows, vols)

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
                "volume_price_score": vp_score,
                "volume_price_tags": vp_tags,
                "risk_flags": risk_flags,
                "summary": (
                    f"收{closes[-1]} 漲跌{cp if cp is not None else '—'}% "
                    f"MA20={ma20} RSI={rsi14} K={kk} D={dd} "
                    f"量比={vol_x} 法人連買={cont_buy}"
                ),
            }
        )

        vol_lots = vols[-1]
        prev_close = closes[-2] if len(closes) >= 2 else closes[-1]
        avg20_vol = sum(vols[-21:-1]) / 20 if len(vols) >= 21 and sum(vols[-21:-1]) else 0
        prev_high20 = max(highs[-21:-1]) if len(highs) >= 21 else None
        prev_low20 = min(lows[-21:-1]) if len(lows) >= 21 else None
        high60 = max(highs[-60:]) if len(highs) >= 60 else None
        latest_open = float(cur.get("open") or closes[-1])
        candle_range = max(highs[-1] - lows[-1], 0.01)
        upper_shadow = highs[-1] - max(latest_open, closes[-1])
        lower_shadow = min(latest_open, closes[-1]) - lows[-1]
        close_position = (closes[-1] - lows[-1]) / candle_range
        inst_values = []
        for ir in inst_by_sym.get(sym, []):
            raw = ir.get("total_buy_sell")
            if raw is None:
                raw = ir.get("foreign_buy_sell")
            try:
                inst_values.append(float(raw or 0))
            except Exception:
                inst_values.append(0)
        ma_spread = (
            (max(ma5, ma10, ma20) - min(ma5, ma10, ma20)) / closes[-1] * 100
            if ma5 is not None and ma10 is not None and ma20 is not None and closes[-1]
            else None
        )

        def add_screen_candidate(sid, name, reason, score):
            screen_candidates.append(
                {
                    "date": latest,
                    "symbol": sym,
                    "name": (smap.get(sym) or {}).get("name") or sym,
                    "source_module": sid,
                    "candidate_type": name,
                    "reason": reason,
                    "score": int(max(0, min(999999, round(score)))),
                }
            )

        if (
            len(closes) >= 61
            and vol_lots >= 1000
            and ma5 is not None and ma10 is not None and ma20 is not None and ma60 is not None
            and closes[-1] >= ma20 and closes[-1] >= ma60
            and ma5 > ma10 > ma20 > ma60
            and ma20_prev is not None and ma20 > ma20_prev
        ):
            add_screen_candidate(
                "strong-stock-screener",
                "強勢股篩選",
                (
                    f"成交量 {round(vol_lots):,} 張；站上 MA20/MA60；"
                    f"MA5({ma5}) > MA10({ma10}) > MA20({ma20}) > MA60({ma60})；20MA 上升"
                ),
                final * 100 + vol_lots,
            )

        if (
            prev_high20
            and vol_x
            and vol_lots >= 1000
            and prev_close <= prev_high20
            and closes[-1] > prev_high20 * 1.005
            and vol_x >= 1.3
            and close_position >= 0.55
        ):
            add_screen_candidate(
                "volume-breakout-screener",
                "放量突破篩選",
                f"今日剛收盤突破 20 日高 {prev_high20:.2f}，量比 {vol_x}、成交量 {round(vol_lots):,} 張。",
                final * 100 + vol_lots,
            )

        prev_ma5, prev_ma10, prev_ma20 = ma(closes[:-1], 5), ma(closes[:-1], 10), ma(closes[:-1], 20)
        prev_ma_spread = (
            (max(prev_ma5, prev_ma10, prev_ma20) - min(prev_ma5, prev_ma10, prev_ma20)) / closes[-2] * 100
            if prev_ma5 is not None and prev_ma10 is not None and prev_ma20 is not None and len(closes) >= 2 and closes[-2]
            else None
        )
        just_broke_ma_cluster = (
            ma_spread is not None
            and prev_ma_spread is not None
            and prev_ma_spread <= 2.8
            and ma5 and ma10 and ma20
            and vol_lots >= 1000
            and closes[-1] > max(ma5, ma10, ma20)
            and prev_close <= max(prev_ma5, prev_ma10, prev_ma20) * 1.005
            and (vol_x or 0) >= 1.2
        )
        if just_broke_ma_cluster:
            add_screen_candidate(
                "ma-compression-breakout-screener",
                "均線糾結突破篩選",
                f"前一日 MA5/10/20 糾結 {prev_ma_spread:.1f}%，今日放量站上糾結區。",
                final * 100 + vol_lots,
            )

        retest_volume_shrunk = (
            len(vols) >= 8
            and vol_lots <= vols[-2]
            and vols[-2] <= vols[-3]
            and vol_lots <= max(avg20_vol, 1) * 0.8
            and sum(vols[-3:]) / 3 <= max(avg20_vol, 1) * 0.9
            and sum(vols[-3:]) / 3 < sum(vols[-8:-3]) / 5
        )
        retest_price_held = (
            ma20
            and ma20_prev
            and ma20 >= ma20_prev
            and lows[-1] <= ma20 * 1.015
            and closes[-1] >= ma20 * 0.995
            and closes[-1] <= prev_close * 1.025
        )
        if retest_price_held and retest_volume_shrunk:
            add_screen_candidate(
                "low-volume-retest-screener",
                "量縮回測篩選",
                f"回測 MA20 {ma20} 守住，今日量 {round(vol_lots):,} 張低於昨日且低於 20 日均量。",
                final * 100 + max(0, 1000 - vol_lots),
            )

        limit_candidates = []
        for idx in range(max(0, len(rows) - 21), len(rows) - 3):
            day = rows[idx]
            if day.get("change_percent") is not None and float(day.get("change_percent") or 0) >= 9:
                limit_candidates.append((idx, day))
        if limit_candidates:
            limit_idx, limit_day = limit_candidates[-1]
            limit_high = float(limit_day.get("high") or limit_day.get("close") or 0)
            limit_low = float(limit_day.get("low") or limit_day.get("close") or 0)
            after_high = max(highs[limit_idx + 1 :])
            after_low = min(lows[limit_idx + 1 :])
            after_range = ((after_high - after_low) / max(limit_low, 0.01) * 100) if limit_low else None
            if (
                limit_high
                and after_range is not None
                and after_range <= 18
                and after_low >= limit_low * 0.96
                and closes[-1] <= limit_high * 1.12
                and closes[-1] >= limit_low
                and (vol_x or 1) <= 1.6
            ):
                add_screen_candidate(
                    "limit-up-consolidation-screener",
                    "一個月內漲停後整理篩選",
                    f"近 20 日有漲停 K，之後整理振幅 {after_range:.1f}%、未跌破漲停低點。",
                    final * 100 + 200,
                )

        prev_box_range = (
            (prev_high20 - prev_low20) / prev_low20 * 100
            if prev_high20 and prev_low20
            else None
        )
        if (
            prev_box_range is not None
            and prev_box_range <= 12
            and prev_close <= prev_high20 * 1.005
            and closes[-1] > prev_high20 * 1.005
            and (vol_x or 0) >= 1.15
            and close_position >= 0.55
        ):
            add_screen_candidate(
                "box-breakout-screener",
                "箱型整理突破篩選",
                f"前 20 日箱型振幅 {prev_box_range:.1f}%，今日剛突破箱頂 {prev_high20:.2f}。",
                final * 100 + vol_lots,
            )

        if len(highs) >= 30:
            early_high = max(highs[-30:-15])
            late_high = max(highs[-15:-1])
            early_low = min(lows[-30:-15])
            late_low = min(lows[-15:-1])
            contraction = late_high <= early_high * 0.99 and late_low >= early_low * 1.01
            if (
                contraction
                and prev_close <= late_high
                and closes[-1] > late_high * 1.005
                and (vol_x or 0) >= 1.1
                and close_position >= 0.55
            ):
                add_screen_candidate(
                    "triangle-breakout-screener",
                    "三角收斂突破篩選",
                    f"高點降低、低點墊高後，今日剛突破收斂上緣 {late_high:.2f}。",
                    final * 100 + vol_lots,
                )

        if len(lows) >= 45:
            left_window = range(len(lows) - 45, len(lows) - 25)
            right_window = range(len(lows) - 20, len(lows) - 4)
            left_idx = min(left_window, key=lambda i: lows[i])
            right_idx = min(right_window, key=lambda i: lows[i])
            left_low = lows[left_idx]
            right_low = lows[right_idx]
            neckline = max(highs[left_idx:right_idx + 1])
            if (
                left_low
                and right_idx - left_idx >= 12
                and abs(right_low - left_low) / left_low * 100 <= 6
                and prev_close <= neckline
                and closes[-1] > neckline * 1.005
                and (vol_x or 0) >= 1.05
            ):
                add_screen_candidate(
                    "double-bottom-screener",
                    "W底反轉篩選",
                    f"雙低點接近，今日剛突破頸線 {neckline:.2f}。",
                    final * 100 + vol_lots,
                )

        if len(lows) >= 65:
            left_shoulder = min(lows[-65:-45])
            head_low = min(lows[-44:-24])
            right_shoulder = min(lows[-23:-5])
            neckline_hs = max(highs[-44:-5])
            shoulders_close = abs(left_shoulder - right_shoulder) / max(left_shoulder, 0.01) * 100 <= 10
            if (
                shoulders_close
                and head_low < min(left_shoulder, right_shoulder) * 0.94
                and prev_close <= neckline_hs
                and closes[-1] > neckline_hs * 1.005
                and (vol_x or 0) >= 1.05
            ):
                add_screen_candidate(
                    "head-shoulders-bottom-screener",
                    "頭肩底反轉篩選",
                    f"頭低於兩肩且兩肩接近，今日剛突破頸線 {neckline_hs:.2f}。",
                    final * 100 + vol_lots,
                )

        macd_just_turned = (
            dif is not None and sig is not None and hist is not None
            and prev_hist is not None
            and prev_hist <= 0 < hist
            and dif > sig
            and ma20 and closes[-1] >= ma20
        )
        if macd_just_turned:
            add_screen_candidate(
                "macd-turn-screener",
                "MACD轉強篩選",
                f"MACD OSC 由 {prev_hist} 翻紅至 {hist}，DIF {dif} 站上慢線且收盤站上 MA20。",
                final * 100 + tech_s,
            )

        if len(closes) >= 50:
            prior_start, prior_end = len(lows) - 45, len(lows) - 15
            recent_start, recent_end = len(lows) - 14, len(lows) - 2
            prior_idx = min(range(prior_start, prior_end), key=lambda i: lows[i])
            recent_idx = min(range(recent_start, recent_end), key=lambda i: lows[i])
            prior_low = lows[prior_idx]
            recent_low = lows[recent_idx]
            prior_rsi = rsi(closes[: prior_idx + 1])
            recent_rsi = rsi(closes[: recent_idx + 1])
            rsi_diverged = (
                prior_rsi is not None
                and recent_rsi is not None
                and recent_idx - prior_idx >= 8
                and recent_low <= prior_low * 1.02
                and recent_rsi >= prior_rsi + 5
                and prior_rsi <= 45
                and recent_rsi <= 60
                and closes[-1] > closes[-2]
                and closes[-1] >= (ma5 or closes[-1])
            )
            if rsi_diverged:
                add_screen_candidate(
                    "rsi-divergence-screener",
                    "RSI底背離篩選",
                    f"價格低點 {prior_low:.2f}->{recent_low:.2f}，RSI {prior_rsi}->{recent_rsi} 墊高後收盤轉強。",
                    final * 100 + tech_s,
                )

        recent_inst = inst_values[-3:] if len(inst_values) >= 3 else []
        prior_inst = inst_values[-6:-3] if len(inst_values) >= 6 else []
        recent_inst_sum = sum(recent_inst)
        prior_inst_sum = sum(prior_inst)
        chip_just_turned = (
            len(recent_inst) == 3
            and all(v > 0 for v in recent_inst[-2:])
            and recent_inst_sum > 0
            and (not prior_inst or prior_inst_sum <= 0 or recent_inst_sum >= abs(prior_inst_sum) * 0.8)
        )
        if chip_just_turned:
            add_screen_candidate(
                "chip-turn-screener",
                "法人籌碼轉強篩選",
                f"近 3 筆法人買超合計轉正 {round(recent_inst_sum):,}，前段籌碼未延續買超。",
                final * 100 + chip_s * 10,
            )

        if (
            prev_low20
            and lows[-1] < prev_low20 * 0.995
            and closes[-1] > prev_low20
            and close_position >= 0.65
            and lower_shadow / candle_range >= 0.35
            and (vol_x or 1) <= 1.6
        ):
            add_screen_candidate(
                "main-force-wash-screener",
                "主力洗盤後轉強篩選",
                f"盤中跌破 20 日支撐 {prev_low20:.2f} 後收回，長下影占比 {lower_shadow / candle_range:.0%}。",
                final * 100 + vol_lots,
            )

        if (
            prev_high20
            and highs[-1] > prev_high20 * 1.005
            and closes[-1] < prev_high20
            and close_position <= 0.45
            and upper_shadow / candle_range >= 0.35
            and (vol_x or 0) >= 1.1
        ):
            add_screen_candidate(
                "false-breakout-risk-screener",
                "假突破風險篩選",
                f"盤中突破 20 日高 {prev_high20:.2f} 後收回，長上影占比 {upper_shadow / candle_range:.0%}。",
                final * 100 + vol_lots,
            )

        if (
            high60
            and highs[-1] >= high60 * 0.98
            and closes[-1] >= high60 * 0.9
            and (vol_x or 0) >= 1.4
            and upper_shadow / candle_range >= 0.4
            and (closes[-1] < latest_open or close_position <= 0.45)
        ):
            add_screen_candidate(
                "top-distribution-risk-screener",
                "高檔出貨風險篩選",
                f"接近 60 日高檔且量比 {vol_x}，長上影占比 {upper_shadow / candle_range:.0%}。",
                final * 100 + vol_lots,
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

    # 股票類股地圖由 fetch_stock_classes.py 統一重建。
    # 這裡只計算 daily_signals / candidate_pool，避免跑完 AI 訊號後覆蓋官方產業分類。
    log("題材表由 fetch_stock_classes 管理，本步不覆寫 themes/theme_stocks")

    # ---- 候選池：每日篩選新邏輯 ----
    # 每個模板保留自己的前段名單，避免強勢股等大類把小眾模板整批擠掉。
    by_screen = defaultdict(list)
    for candidate in screen_candidates:
        by_screen[candidate["source_module"]].append(candidate)
    cand = []
    for sid in sorted(by_screen):
        cand.extend(sorted(by_screen[sid], key=lambda s: s["score"], reverse=True)[:30])
    cand = sorted(cand, key=lambda s: (s["source_module"], -s["score"], s["symbol"]))
    sb_delete("candidate_pool", f"date=eq.{latest}")
    sb_upsert("candidate_pool", cand)
    log(f"候選池 {len(cand)} 檔")

    mark_status("compute_signals", True, f"signals={len(signals)}")
    log("=== compute_signals 完成 ===")


if __name__ == "__main__":
    main()
