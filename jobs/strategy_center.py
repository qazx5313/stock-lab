from __future__ import annotations

import os
import time

from phase6_common import avg, hma, load_price_series, load_stock_map, log, ma, macd, nf, pct, safe_status, series_values, stdev, stock_name, volume_lots
from sb_common import sb_delete, sb_upsert


STRATEGIES = [
    {
        "id": "hma_stdev_v1",
        "name": "HMA/STDEV 量化 AI",
        "description": "日 K 收盤上穿 HMA9，成交量大於 1000 張，使用標準差控管風險。",
        "conditions": ["收盤上穿 HMA9", "成交量 >= 1000 張", "週五避免新倉"],
        "risk_rules": ["停損 = 進場價 - STDEV9 * 2", "移動停利 = 進場價 + STDEV9 * 3"],
    },
    {
        "id": "bollinger_r1_v1",
        "name": "布林通道突破 R1",
        "description": "股價突破布林上軌並放量，偏向主升段啟動觀察。",
        "conditions": ["收盤突破布林上軌", "成交量大於 20 日均量 1.3 倍"],
        "risk_rules": ["跌回 MA20 或突破 K 低點停損"],
    },
    {
        "id": "box_breakout_v1",
        "name": "箱型突破",
        "description": "整理區間突破前高且放量，觀察壓力轉支撐。",
        "conditions": ["近 20 日箱型", "收盤突破箱頂", "突破放量"],
        "risk_rules": ["跌回箱頂下方停損"],
    },
    {
        "id": "volume_shrink_ma_v1",
        "name": "量縮回測均線糾結",
        "description": "MA5/10/20 糾結後量縮回測，等待方向突破。",
        "conditions": ["MA5/10/20 距離小", "成交量低於 20 日均量", "收盤接近 MA20"],
        "risk_rules": ["跌破整理低點停損"],
    },
    {
        "id": "ma5_strong_v1",
        "name": "MA5 強勢股",
        "description": "股價沿 MA5 上攻且量能足夠，適合短線強勢觀察。",
        "conditions": ["收盤站上 MA5", "MA5 上彎", "成交量 >= 1000 張"],
        "risk_rules": ["跌破 MA5 且站不回時降風險"],
    },
    {
        "id": "monthly_support_v1",
        "name": "月線支撐",
        "description": "回測 MA20 附近量縮止跌，觀察中期資金成本支撐。",
        "conditions": ["接近 MA20", "量縮", "收盤守住 MA20"],
        "risk_rules": ["放量跌破 MA20 停損"],
    },
    {
        "id": "macd_turn_v1",
        "name": "MACD 轉強",
        "description": "MACD DIF 站上慢線且柱狀體轉強，搭配價格站穩均線。",
        "conditions": ["DIF > MACD", "OSC 增加", "收盤站上 MA20"],
        "risk_rules": ["OSC 轉弱且跌破 MA20 降風險"],
    },
]

STRATEGY_LIBRARY_TEMPLATES = [
    ("volume_breakout_strategy", "放量突破", "突破壓力且量能放大，觀察資金是否進場。", ["收盤突破壓力", "成交量大於20日均量1.3倍"], ["跌回突破價下方停損"]),
    ("base_breakout_strategy", "平台突破", "平台整理後向上突破，觀察壓力轉支撐。", ["平台整理完成", "收盤突破平台上緣"], ["跌回平台內停損"]),
    ("previous_high_breakout_strategy", "前高突破", "突破前波高點，確認上方套牢壓力被消化。", ["收盤突破前高", "成交量放大"], ["跌回前高下方停損"]),
    ("all_time_high_breakout_strategy", "歷史新高突破", "突破長期高點，偏向趨勢延伸觀察。", ["創長期新高", "成交額放大"], ["跌回突破K低點停損"]),
    ("bollinger_squeeze_breakout_strategy", "布林收口突破", "布林寬度收斂後突破，觀察波動擴張。", ["BBWidth 低檔", "收盤突破上軌"], ["跌回中軌降風險"]),
    ("triangle_breakout_strategy", "三角收斂突破", "高低點收斂後突破，等待方向選擇。", ["高低點收斂", "突破收斂上緣"], ["跌回三角形內停損"]),
    ("cup_handle_breakout_strategy", "杯柄突破", "杯柄型態突破杯緣，觀察中期續強。", ["杯柄型態完成", "突破杯緣"], ["跌破柄部低點停損"]),
    ("limit_up_breakout_strategy", "漲停突破", "漲停K後整理再突破，觀察強勢延續。", ["近20日有漲停K", "突破漲停K高點"], ["跌破漲停K低點停損"]),
    ("ma_compression_breakout_strategy", "均線糾結突破", "短中期均線收斂後放量突破。", ["MA5/10/20 糾結", "放量突破"], ["跌破糾結區停損"]),
    ("breakout_retest_hold_strategy", "突破後回測不破", "突破後回測原壓力不破，觀察壓力轉支撐。", ["突破後拉回", "回測突破價不破"], ["跌破突破價停損"]),
    ("ma5_retest_strategy", "五日線回測", "強勢股沿五日線上攻，量縮回測不破。", ["回測MA5", "量縮止跌"], ["跌破MA5且站不回"]),
    ("gap_retest_strategy", "缺口回測", "跳空缺口回測不補，觀察缺口支撐。", ["回測缺口上緣", "缺口不補"], ["補缺口且轉弱"]),
    ("neckline_retest_strategy", "頸線回測", "突破頸線後回測不破，確認型態有效。", ["突破頸線", "回測不破"], ["跌破頸線停損"]),
    ("box_top_retest_strategy", "箱頂回測", "箱型突破後回測箱頂，確認支撐。", ["突破箱頂", "回測箱頂不破"], ["跌回箱內"]),
    ("vwap_retest_strategy", "VWAP 回測", "站上VWAP後回測不破，觀察資金成本支撐。", ["站上VWAP", "回測VWAP不破"], ["跌破VWAP"]),
    ("limit_up_candle_retest_strategy", "漲停K回測", "漲停K後回測高低點區間，確認強勢整理。", ["回測漲停K區間", "量縮止跌"], ["跌破漲停K低點"]),
    ("double_bottom_reversal_strategy", "W底反轉", "雙底突破頸線，確認低檔反轉。", ["第二低不破", "突破頸線"], ["跌破第二低"]),
    ("head_shoulders_bottom_reversal_strategy", "頭肩底反轉", "頭肩底完成後突破頸線。", ["右肩完成", "突破頸線"], ["跌破右肩低點"]),
    ("rsi_bullish_divergence_strategy", "RSI底背離", "價格創低但RSI不再創低，觀察止跌。", ["價格創低", "RSI未創低", "站回短均"], ["跌破新低"]),
    ("macd_bullish_divergence_strategy", "MACD底背離", "價格創低但MACD動能改善。", ["價格創低", "MACD未創低", "OSC改善"], ["OSC再轉弱"]),
    ("kd_low_golden_cross_strategy", "KD低檔黃金交叉", "KD低檔轉強，搭配價格止跌。", ["KD低檔K上穿D", "價格止跌"], ["K再跌破D"]),
    ("long_lower_shadow_reversal_strategy", "長下影止跌", "支撐附近長下影，觀察隔日確認。", ["支撐附近長下影", "隔日站穩"], ["跌破下影低點"]),
    ("bottom_volume_reversal_strategy", "低檔爆量反轉", "低檔爆量紅K後觀察是否止跌。", ["低檔爆量", "隔日不破低點"], ["爆量後續跌"]),
    ("oversold_rebound_strategy", "跌深反彈", "跌深後動能指標回升，偏短線反彈。", ["跌幅過大", "RSI過低後轉強"], ["反彈量縮失敗"]),
    ("ma_bull_trend_strategy", "均線多頭排列", "均線依短到長向上排列，追蹤趨勢延續。", ["MA5>MA10>MA20>MA60", "價格站上均線"], ["跌破MA20"]),
    ("macd_trend_red_bar_strategy", "MACD順勢紅柱", "MACD紅柱擴大，趨勢動能延續。", ["DIF>MACD", "OSC紅柱擴大"], ["OSC縮小轉黑"]),
    ("adx_trend_strength_strategy", "ADX趨勢增強", "ADX上升代表趨勢強度提升。", ["ADX上升", "方向指標同向"], ["ADX下降且跌破均線"]),
    ("supertrend_bull_strategy", "Supertrend多頭", "價格站上Supertrend追蹤線。", ["價格站上Supertrend", "線向上"], ["跌破Supertrend"]),
    ("ma5_strong_trend_strategy", "強勢股沿五日線", "強勢股回測MA5不破。", ["沿MA5上攻", "回測不破"], ["跌破MA5站不回"]),
    ("flag_continuation_strategy", "旗形整理後續攻", "急漲後旗形整理再突破。", ["旗形整理", "突破旗面"], ["跌破旗形低點"]),
    ("n_wave_trend_strategy", "N字型上攻", "高低點墊高形成N字延續。", ["高低點墊高", "突破前高"], ["跌破前低"]),
    ("box_bottom_range_strategy", "箱底低吸", "箱型下緣支撐附近觀察反彈。", ["箱底支撐", "量縮止跌"], ["跌破箱底"]),
    ("box_top_range_strategy", "箱頂高賣", "箱型上緣壓力附近降低追價。", ["接近箱頂", "量價背離"], ["突破箱頂放量"]),
    ("bollinger_band_range_strategy", "布林上下軌反轉", "盤整盤沿布林上下軌操作。", ["觸及上下軌", "動能反轉"], ["通道擴張順勢突破"]),
    ("rsi_range_strategy", "RSI過熱過冷", "震盪盤使用RSI高低檔循環。", ["RSI過熱或過冷", "接近支撐壓力"], ["趨勢行情鈍化"]),
    ("kd_range_cycle_strategy", "KD高低檔循環", "震盪盤觀察KD高低檔交叉。", ["KD高低檔交叉", "區間明確"], ["突破區間後失效"]),
    ("support_resistance_range_strategy", "支撐壓力來回", "支撐與壓力間來回操作。", ["支撐買盤", "壓力賣壓"], ["區間突破或跌破"]),
    ("top_volume_upper_shadow_risk", "高檔爆量長上影", "高檔爆量長上影代表追價風險。", ["高檔爆量", "長上影"], ["降低追價"]),
    ("ma20_break_risk", "跌破月線站不回", "跌破MA20後反彈站不回，趨勢轉弱。", ["跌破MA20", "反彈站不回"], ["轉弱避開"]),
    ("false_breakout_risk", "假突破隔日轉弱", "突破後隔日轉弱，容易套牢追價。", ["突破後跌回", "隔日轉弱"], ["避免追價"]),
    ("margin_surge_risk", "融資暴增", "融資快速增加且股價高檔，籌碼風險升高。", ["融資快速增加", "股價高檔"], ["降低權重"]),
    ("institutional_selling_risk", "法人連賣", "法人連續賣超且跌破支撐，趨勢偏弱。", ["法人連賣", "跌破支撐"], ["降低權重"]),
    ("disposition_risk", "處置風險", "波動過大可能處置，降低追價與槓桿。", ["波動異常", "可能處置"], ["降低槓桿"]),
    ("liquidity_risk", "流動性不足", "成交量不足容易滑價，排除候選。", ["成交量低於1000張", "買賣價差大"], ["排除候選"]),
    ("gap_up_fade_risk", "跳空開高走低", "跳空開高後走低，短線賣壓大。", ["跳空開高", "收盤走低"], ["避免追高"]),
]

EXECUTABLE_TEMPLATE_IDS = {
    "volume_breakout_strategy",
    "box_breakout_strategy",
    "ma_compression_breakout_strategy",
    "double_bottom_reversal_strategy",
}

STRATEGIES += [
    {
        "id": sid,
        "name": name,
        "description": desc,
        "conditions": conditions,
        "risk_rules": risk_rules,
        "enabled": sid in EXECUTABLE_TEMPLATE_IDS,
    }
    for sid, name, desc, conditions, risk_rules in STRATEGY_LIBRARY_TEMPLATES
]


def _definition_rows():
    return [{
        "id": s["id"],
        "name": s["name"],
        "description": s["description"],
        "conditions": s["conditions"],
        "risk_rules": s["risk_rules"],
        "enabled": s.get("enabled", True),
    } for s in STRATEGIES]


def _stats(prices):
    closes = series_values(prices, "close")
    highs = series_values(prices, "high")
    lows = series_values(prices, "low")
    vols = [volume_lots(r) for r in prices]
    latest = prices[-1]
    prev = prices[-2] if len(prices) > 1 else latest
    return closes, highs, lows, vols, latest, prev


def _ma_spread_pct(close, *values):
    clean = [v for v in values if v is not None]
    if not clean or not close:
        return None
    return (max(clean) - min(clean)) / close * 100


def _double_bottom_levels(highs, lows, closes):
    if len(lows) < 45 or len(closes) < 45:
        return None
    start = len(lows) - 45
    end = len(lows) - 5
    candidates = []
    for i in range(start + 2, end):
        if lows[i] <= lows[i - 1] and lows[i] <= lows[i + 1] and lows[i] <= lows[i - 2] and lows[i] <= lows[i + 2]:
            candidates.append(i)
    for i, first in enumerate(candidates):
        for second in candidates[i + 1:]:
            gap = second - first
            if gap < 8 or gap > 32:
                continue
            low1, low2 = lows[first], lows[second]
            if low1 <= 0 or low2 <= 0:
                continue
            low_diff = abs(low2 - low1) / min(low1, low2) * 100
            if low_diff > 6:
                continue
            neckline = max(highs[first:second + 1])
            depth = pct(neckline, min(low1, low2)) or 0
            if depth < 6:
                continue
            if close := closes[-1]:
                if close > neckline and closes[-2] <= neckline:
                    return first, second, neckline, min(low1, low2)
    return None


def hit_strategy(strategy_id, prices):
    if len(prices) < 65:
        return None
    closes, highs, lows, vols, latest, prev = _stats(prices)
    close = closes[-1]
    prev_close = closes[-2]
    vol = vols[-1]
    avg20 = avg(vols[-20:]) or 0
    ma5 = ma(closes, 5)
    ma10 = ma(closes, 10)
    ma20 = ma(closes, 20)
    ma60 = ma(closes, 60)
    prev_ma5 = ma(closes[:-1], 5)
    prev_ma10 = ma(closes[:-1], 10)
    prev_ma20 = ma(closes[:-1], 20)
    hma_now = hma(closes, 9)
    hma_prev = hma(closes[:-1], 9)
    sd = stdev(closes, 9) or 0
    dif, dea, hist = macd(closes)
    _, _, hist_prev = macd(closes[:-1])
    high20 = max(highs[-21:-1])
    low20 = min(lows[-21:-1])
    high10 = max(highs[-11:-1])
    basis = ma20 or close
    band_sd = stdev(closes, 20) or 0
    upper = basis + band_sd * 2

    if strategy_id == "hma_stdev_v1" and hma_now and hma_prev and prev_close <= hma_prev and close > hma_now and vol >= 1000:
        return 86, f"收盤上穿 HMA9，STDEV9={sd:.2f}，成交量 {vol:.0f} 張。"
    if strategy_id == "bollinger_r1_v1" and close > upper and vol >= avg20 * 1.3:
        return 82, f"收盤突破布林上軌 {upper:.2f}，量能放大 {vol / max(avg20, 1):.2f} 倍。"
    if strategy_id == "volume_breakout_strategy" and close > high20 and prev_close <= high20 and vol >= avg20 * 1.5 and vol >= 1000:
        base = f"突破近 20 日壓力 {high20:.2f}，成交量 {vol:.0f} 張、為 20 日均量 {vol / max(avg20, 1):.2f} 倍。"
        return 86 if ma20 and close > ma20 else 82, base
    if strategy_id == "box_breakout_v1" and close > high20 and vol >= avg20 * 1.35 and pct(high20, low20) and pct(high20, low20) < 15:
        return 84, f"突破近 20 日箱頂 {high20:.2f}，整理後放量轉強。"
    if strategy_id == "box_breakout_strategy" and close > high20 and prev_close <= high20 and vol >= avg20 * 1.25:
        box_width = pct(high20, low20)
        if box_width and box_width < 15:
            return 84, f"近 20 日箱型寬度 {box_width:.1f}%，收盤突破箱頂 {high20:.2f} 且量能放大。"
    if strategy_id == "volume_shrink_ma_v1" and ma5 and ma10 and ma20:
        spread = _ma_spread_pct(close, ma5, ma10, ma20)
        if spread < 3 and abs(close - ma20) / close * 100 < 3 and vol < avg20 * 0.85:
            return 70, f"MA5/10/20 糾結，回測 MA20 且量縮，等待方向選擇。"
    if strategy_id == "ma_compression_breakout_strategy" and ma5 and ma10 and ma20 and prev_ma5 and prev_ma10 and prev_ma20:
        spread = _ma_spread_pct(prev_close, prev_ma5, prev_ma10, prev_ma20)
        if spread is not None and spread < 3 and close > max(ma5, ma10, ma20) and close > high10 and vol >= avg20 * 1.2:
            return 83, f"MA5/10/20 前一日收斂 {spread:.1f}%，今日放量突破短期壓力 {high10:.2f}。"
    if strategy_id == "ma5_strong_v1" and ma5 and close > ma5 and ma5 > ma(closes[:-1], 5) and vol >= 1000:
        return 78, f"收盤站上 MA5 且 MA5 上彎，成交量 {vol:.0f} 張。"
    if strategy_id == "monthly_support_v1" and ma20 and abs(close - ma20) / close * 100 < 3 and close >= ma20 and vol < avg20:
        return 75, f"回測 MA20 {ma20:.2f} 守住，量能低於 20 日均量。"
    if strategy_id == "macd_turn_v1" and dif and dea and hist and hist_prev is not None and dif > dea and hist > hist_prev and close > (ma20 or close):
        return 77, f"MACD DIF 站上慢線，OSC 由 {hist_prev:.2f} 改善至 {hist:.2f}。"
    if strategy_id == "double_bottom_reversal_strategy":
        levels = _double_bottom_levels(highs, lows, closes)
        if levels and vol >= avg20:
            _, _, neckline, bottom = levels
            return 85, f"W底突破頸線 {neckline:.2f}，低點區約 {bottom:.2f}，量能不低於 20 日均量。"
    return None


def backtest_strategy(strategy, series, *, deadline=None, max_symbols=260, max_samples=120):
    samples = []
    scanned_symbols = 0
    for prices in series.values():
        if deadline and time.monotonic() >= deadline:
            break
        if len(prices) < 70:
            continue
        scanned_symbols += 1
        if scanned_symbols > max_symbols:
            break
        start = max(65, len(prices) - 160)
        for i in range(start, len(prices) - 5):
            if deadline and time.monotonic() >= deadline:
                break
            if not strategy.get("enabled", True):
                continue
            hit = hit_strategy(strategy["id"], prices[:i + 1])
            if not hit:
                continue
            entry = nf(prices[i]["close"])
            exit_price = nf(prices[i + 5]["close"])
            if entry and exit_price:
                samples.append((exit_price - entry) / entry * 100)
            if len(samples) >= max_samples:
                break
        if len(samples) >= max_samples:
            break
    if not samples:
        return 0, None, None, None
    wins = [x for x in samples if x > 0]
    return len(samples), round(len(wins) / len(samples) * 100, 2), round(avg(samples), 2), round(min(samples), 2)


def main():
    key = "phase6_strategy_center"
    try:
        stock_map = load_stock_map()
        series = load_price_series()
        latest_date = max((prices[-1]["date"] for prices in series.values() if prices), default=None)
        sb_upsert("strategy_definitions", _definition_rows(), on_conflict="id")
        hits = []
        for symbol, prices in series.items():
            if not prices or prices[-1]["date"] != latest_date:
                continue
            for strategy in STRATEGIES:
                if not strategy.get("enabled", True):
                    continue
                hit = hit_strategy(strategy["id"], prices)
                if not hit:
                    continue
                score, reason = hit
                hits.append({
                    "strategy_id": strategy["id"],
                    "strategy_name": strategy["name"],
                    "symbol": symbol,
                    "name": stock_name(stock_map, symbol),
                    "date": latest_date,
                    "score": score,
                    "hit_type": "今日命中",
                    "reason": reason,
                    "risk_note": "僅作策略研究，仍需搭配大盤、題材與停損控管。",
                    "metadata": {"source": "phase6_strategy_center"},
                })
        if latest_date:
            sb_delete("strategy_results", f"date=eq.{latest_date}")
        hits = sorted(hits, key=lambda r: r["score"], reverse=True)[:500]
        if hits:
            sb_upsert("strategy_results", hits, on_conflict="strategy_id,symbol,date")

        backtests = []
        backtest_seconds = max(5, int(os.getenv("STRATEGY_BACKTEST_SECONDS", "25")))
        backtest_deadline = time.monotonic() + backtest_seconds
        for strategy in STRATEGIES:
            if not strategy.get("enabled", True):
                continue
            if time.monotonic() >= backtest_deadline:
                log("strategy backtest skipped: reached time budget")
                break
            sample_count, win_rate, avg_return, max_drawdown = backtest_strategy(
                strategy,
                series,
                deadline=backtest_deadline,
            )
            backtests.append({
                "strategy_id": strategy["id"],
                "strategy_name": strategy["name"],
                "date": latest_date,
                "sample_count": sample_count,
                "win_rate": win_rate,
                "avg_return": avg_return,
                "max_drawdown": max_drawdown,
                "summary": "以最近歷史 K 棒做簡易 5 日持有回測，作為策略健康度參考。",
            })
        if backtests:
            sb_upsert("strategy_backtests", backtests, on_conflict="strategy_id,date")
        log(f"strategy hits={len(hits)} backtests={len(backtests)} latest={latest_date}")
        safe_status(key, True, f"策略中心完成 {len(hits)} 筆")
    except Exception as exc:
        log(f"strategy_center failed: {exc}")
        safe_status(key, False, str(exc))


if __name__ == "__main__":
    main()
