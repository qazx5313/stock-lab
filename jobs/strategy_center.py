from __future__ import annotations

import os
import time

from phase6_common import avg, hma, load_price_series, load_stock_map, log, ma, macd, nf, pct, rsi, safe_status, series_values, stdev, stock_name, volume_lots
from sb_common import sb_delete, sb_select, sb_upsert


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
    ("ma20_retest_strategy", "月線回測", "回測 MA20 附近量縮止跌，觀察中期支撐。", ["回測MA20", "量縮守住"], ["放量跌破MA20"]),
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

EXECUTABLE_TEMPLATE_IDS = {sid for sid, *_ in STRATEGY_LIBRARY_TEMPLATES}

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


def _local_low_indexes(lows, start, end):
    out = []
    for i in range(start + 2, end):
        if lows[i] <= lows[i - 1] and lows[i] <= lows[i + 1] and lows[i] <= lows[i - 2] and lows[i] <= lows[i + 2]:
            out.append(i)
    return out


def _double_bottom_levels(highs, lows, closes):
    if len(lows) < 45 or len(closes) < 45:
        return None
    start = len(lows) - 45
    end = len(lows) - 5
    candidates = _local_low_indexes(lows, start, end)
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


def _rsi_bullish_divergence(lows, closes):
    if len(lows) < 55:
        return None
    start = len(lows) - 50
    end = len(lows) - 2
    candidates = _local_low_indexes(lows, start, end)
    pairs = []
    for i, first in enumerate(candidates):
        pairs.extend((first, second) for second in candidates[i + 1:])
    if not pairs:
        mid = len(lows) - 22
        first = min(range(start, mid), key=lambda i: lows[i])
        second = min(range(mid, end), key=lambda i: lows[i])
        pairs = [(first, second)]
    for first, second in pairs:
        first_rsi = rsi(closes[:first + 1])
        if first_rsi is None:
            continue
        gap = second - first
        if gap < 8 or gap > 34:
            continue
        second_rsi = rsi(closes[:second + 1])
        if second_rsi is None:
            continue
        price_near_or_lower = lows[second] <= lows[first] * 1.03
        rsi_higher = second_rsi >= first_rsi + 3
        if price_near_or_lower and rsi_higher:
            return first, second, first_rsi, second_rsi
    return None


def _breakout_retest_level(highs, lows, closes):
    for days_ago in range(2, 9):
        breakout_idx = len(closes) - 1 - days_ago
        if breakout_idx < 25:
            continue
        resistance = max(highs[breakout_idx - 21:breakout_idx])
        breakout_close = closes[breakout_idx]
        if breakout_close <= resistance or closes[breakout_idx - 1] > resistance:
            continue
        retest_low = min(lows[breakout_idx + 1:])
        if retest_low >= resistance * 0.985 and closes[-1] >= resistance:
            return resistance, days_ago
    return None


def _true_ranges(highs, lows, closes):
    trs = []
    for i in range(1, len(closes)):
        trs.append(max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1])))
    return trs


def _atr(highs, lows, closes, length=14):
    trs = _true_ranges(highs, lows, closes)
    return avg(trs[-length:]) if len(trs) >= length else None


def _kd(closes, highs, lows, length=9):
    if len(closes) < length + 3:
        return None
    k = d = 50.0
    out = []
    for i in range(length - 1, len(closes)):
        hi = max(highs[i - length + 1:i + 1])
        lo = min(lows[i - length + 1:i + 1])
        rsv = 50 if hi == lo else (closes[i] - lo) / (hi - lo) * 100
        k = k * 2 / 3 + rsv / 3
        d = d * 2 / 3 + k / 3
        out.append((k, d))
    return out[-1], out[-2]


def _vwma(closes, vols, length=20):
    if len(closes) < length or len(vols) < length:
        return None
    v = vols[-length:]
    total = sum(v)
    if total <= 0:
        return None
    return sum(c * q for c, q in zip(closes[-length:], v)) / total


def _recent_limit_up(highs, lows, closes, lookback=20):
    start = max(1, len(closes) - lookback - 1)
    for i in range(len(closes) - 2, start - 1, -1):
        cp = pct(closes[i], closes[i - 1])
        if cp is not None and cp >= 9.3:
            return i, highs[i], lows[i]
    return None


def _gap_up_zone(highs, lows, lookback=12):
    start = max(1, len(highs) - lookback - 1)
    for i in range(len(highs) - 2, start - 1, -1):
        if lows[i] > highs[i - 1] * 1.01:
            return i, highs[i - 1], lows[i]
    return None


def _macd_bullish_divergence(lows, closes):
    if len(lows) < 55:
        return None
    start = len(lows) - 50
    end = len(lows) - 2
    candidates = _local_low_indexes(lows, start, end)
    pairs = []
    for i, first in enumerate(candidates):
        pairs.extend((first, second) for second in candidates[i + 1:])
    if not pairs:
        mid = len(lows) - 22
        pairs = [(min(range(start, mid), key=lambda i: lows[i]), min(range(mid, end), key=lambda i: lows[i]))]
    for first, second in pairs:
        if second - first < 8 or second - first > 34:
            continue
        _, _, h1 = macd(closes[:first + 1])
        _, _, h2 = macd(closes[:second + 1])
        if h1 is None or h2 is None:
            continue
        if lows[second] <= lows[first] * 1.03 and h2 > h1:
            return first, second, h1, h2
    return None


def _head_shoulders_bottom(highs, lows, closes):
    if len(lows) < 55:
        return None
    candidates = _local_low_indexes(lows, len(lows) - 55, len(lows) - 5)
    for i in range(len(candidates) - 2):
        left, head, right = candidates[i], candidates[i + 1], candidates[i + 2]
        if not (8 <= head - left <= 24 and 8 <= right - head <= 24):
            continue
        if lows[head] < lows[left] * .96 and lows[head] < lows[right] * .96 and abs(lows[left] - lows[right]) / min(lows[left], lows[right]) < .08:
            neckline = max(highs[left:right + 1])
            if closes[-1] > neckline and closes[-2] <= neckline:
                return neckline, lows[head]
    return None


def _trendline_breakout(highs, lows, closes):
    window_highs = highs[-26:-1]
    window_lows = lows[-26:-1]
    if len(window_highs) < 20:
        return None
    lower_highs = max(window_highs[-10:]) <= max(window_highs[:10]) * 1.02
    higher_lows = min(window_lows[-10:]) >= min(window_lows[:10]) * .98
    close = closes[-1]
    if lower_highs and higher_lows and close:
        trigger = max(window_highs[-10:])
        if close > trigger and closes[-2] <= trigger:
            return trigger
    return None


def _chip_context_rows(context, key):
    rows = (context or {}).get(key) or []
    return rows if isinstance(rows, list) else []


def _sum_recent(rows, field, n=3):
    vals = [nf(r.get(field), 0) for r in rows[-n:]]
    return sum(vals) if vals else 0


def load_strategy_context():
    out = {}
    try:
        rows = sb_select(
            "institutional_trades",
            "select=date,symbol,foreign_buy_sell,investment_trust_buy_sell,dealer_buy_sell,total_buy_sell&order=symbol.asc,date.asc",
            page_size=1000,
            max_rows=500000,
        )
        for r in rows:
            out.setdefault(str(r.get("symbol")), {}).setdefault("institutional", []).append(r)
    except Exception as exc:
        log(f"strategy context institutional skipped: {exc}")
    try:
        rows = sb_select(
            "margin_trades",
            "select=date,symbol,margin_balance,short_balance,margin_change,short_change,short_margin_ratio&order=symbol.asc,date.asc",
            page_size=1000,
            max_rows=500000,
        )
        for r in rows:
            out.setdefault(str(r.get("symbol")), {}).setdefault("margin", []).append(r)
    except Exception as exc:
        log(f"strategy context margin skipped: {exc}")
    return out


def hit_strategy(strategy_id, prices, context=None):
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
    high60 = max(highs[-61:-1])
    prev_high60 = max(highs[-62:-2])
    basis = ma20 or close
    band_sd = stdev(closes, 20) or 0
    upper = basis + band_sd * 2
    lower = basis - band_sd * 2
    bb_width = (upper - lower) / basis * 100 if basis else None
    atr_now = _atr(highs, lows, closes)
    rsi_now = rsi(closes)
    kd_now = _kd(closes, highs, lows)
    latest_open = nf(latest.get("open"), close)
    latest_high = highs[-1]
    latest_low = lows[-1]
    candle_range = max(latest_high - latest_low, 0)
    upper_shadow = latest_high - max(latest_open, close)
    lower_shadow = min(latest_open, close) - latest_low
    inst_rows = _chip_context_rows(context, "institutional")
    margin_rows = _chip_context_rows(context, "margin")

    if strategy_id == "hma_stdev_v1" and hma_now and hma_prev and prev_close <= hma_prev and close > hma_now and vol >= 1000:
        return 86, f"收盤上穿 HMA9，STDEV9={sd:.2f}，成交量 {vol:.0f} 張。"
    if strategy_id == "bollinger_r1_v1" and close > upper and vol >= avg20 * 1.3:
        return 82, f"收盤突破布林上軌 {upper:.2f}，量能放大 {vol / max(avg20, 1):.2f} 倍。"
    if strategy_id == "volume_breakout_strategy" and close > high20 and prev_close <= high20 and vol >= avg20 * 1.5 and vol >= 1000:
        base = f"突破近 20 日壓力 {high20:.2f}，成交量 {vol:.0f} 張、為 20 日均量 {vol / max(avg20, 1):.2f} 倍。"
        return 86 if ma20 and close > ma20 else 82, base
    if strategy_id == "base_breakout_strategy":
        width30 = pct(max(highs[-31:-1]), min(lows[-31:-1]))
        if width30 and width30 < 12 and close > high20 and prev_close <= high20 and vol >= avg20 * 1.2:
            return 82, f"近 30 日平台振幅 {width30:.1f}%，今日突破平台壓力 {high20:.2f}。"
    if strategy_id == "previous_high_breakout_strategy" and close > high60 and prev_close <= high60 and vol >= avg20 * 1.2 and vol >= 1000:
        return 84, f"收盤突破近 60 日前高 {high60:.2f}，量能為 20 日均量 {vol / max(avg20, 1):.2f} 倍。"
    if strategy_id == "all_time_high_breakout_strategy":
        prior_high = max(highs[:-1])
        if close > prior_high and prev_close <= prior_high and vol >= avg20 * 1.2:
            return 85, f"突破目前資料區間最高價 {prior_high:.2f}，量能為 20 日均量 {vol / max(avg20, 1):.2f} 倍。"
    if strategy_id == "bollinger_squeeze_breakout_strategy" and bb_width is not None:
        widths = []
        for i in range(20, len(closes) - 1):
            b = ma(closes[:i + 1], 20)
            s = stdev(closes[:i + 1], 20)
            if b and s is not None:
                widths.append((s * 4) / b * 100)
        squeeze = widths and bb_width <= sorted(widths[-30:])[max(0, int(len(widths[-30:]) * .25) - 1)] * 1.35
        if squeeze and close > upper and vol >= avg20 * 1.15:
            return 83, f"布林寬度 {bb_width:.1f}% 處於收斂區，今日突破上軌 {upper:.2f}。"
    if strategy_id == "triangle_breakout_strategy":
        trigger = _trendline_breakout(highs, lows, closes)
        if trigger and vol >= avg20 * 1.15:
            return 81, f"近 25 日高低點收斂，收盤突破收斂壓力 {trigger:.2f}。"
    if strategy_id == "cup_handle_breakout_strategy":
        left_high = max(highs[-61:-31])
        cup_low = min(lows[-50:-12])
        handle_low = min(lows[-12:-1])
        depth = pct(left_high, cup_low) or 0
        handle_depth = pct(left_high, handle_low) or 0
        if 12 <= depth <= 40 and handle_depth <= depth * .55 and close > left_high and vol >= avg20 * 1.2:
            return 82, f"杯柄型態突破杯緣 {left_high:.2f}，杯底回檔約 {depth:.1f}%。"
    if strategy_id == "limit_up_breakout_strategy":
        lu = _recent_limit_up(highs, lows, closes)
        if lu:
            _, lu_high, lu_low = lu
            if close > lu_high and vol >= avg20 * 1.15:
                return 83, f"近 20 日漲停 K 高點 {lu_high:.2f} 再突破，漲停 K 低點 {lu_low:.2f} 為風險線。"
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
    if strategy_id == "breakout_retest_hold_strategy":
        retest = _breakout_retest_level(highs, lows, closes)
        if retest and vol <= avg20 * 1.15:
            level, days_ago = retest
            return 80, f"{days_ago} 日前突破壓力 {level:.2f}，拉回測試未跌破且量能收斂。"
    if strategy_id == "ma5_retest_strategy" and ma5 and prev_ma5 and ma5 >= prev_ma5 and latest_low <= ma5 * 1.015 and close >= ma5 and vol <= avg20:
        return 77, f"五日線 MA5 {ma5:.2f} 上彎，盤中回測後收盤守住且量縮。"
    if strategy_id == "gap_retest_strategy":
        gap = _gap_up_zone(highs, lows)
        if gap:
            _, gap_low_edge, gap_high_edge = gap
            if latest_low <= gap_high_edge * 1.015 and latest_low >= gap_low_edge * .995 and close >= gap_high_edge:
                return 78, f"回測跳空缺口 {gap_low_edge:.2f}~{gap_high_edge:.2f} 未補，收盤仍站上缺口。"
    if strategy_id == "neckline_retest_strategy":
        retest = _breakout_retest_level(highs, lows, closes)
        if retest and vol <= avg20 * 1.1:
            level, days_ago = retest
            return 78, f"突破後第 {days_ago} 日回測頸線/壓力 {level:.2f} 不破。"
    if strategy_id == "box_top_retest_strategy":
        retest = _breakout_retest_level(highs, lows, closes)
        width30 = pct(max(highs[-35:-8]), min(lows[-35:-8]))
        if retest and width30 and width30 < 15:
            level, days_ago = retest
            return 79, f"箱型突破後第 {days_ago} 日回測箱頂 {level:.2f} 不破。"
    if strategy_id == "vwap_retest_strategy":
        vw = _vwma(closes, vols, 20)
        if vw and close >= vw and latest_low <= vw * 1.015 and vol <= avg20:
            return 76, f"回測 20 日 VWAP 成本線 {vw:.2f} 後收盤守住，量能收斂。"
    if strategy_id == "limit_up_candle_retest_strategy":
        lu = _recent_limit_up(highs, lows, closes)
        if lu:
            _, lu_high, lu_low = lu
            if lu_low <= latest_low <= lu_high and close >= (lu_high + lu_low) / 2 and vol <= avg20:
                return 78, f"回測漲停 K 區間 {lu_low:.2f}~{lu_high:.2f}，收盤守住中線以上。"
    if strategy_id == "ma5_strong_v1" and ma5 and close > ma5 and ma5 > ma(closes[:-1], 5) and vol >= 1000:
        return 78, f"收盤站上 MA5 且 MA5 上彎，成交量 {vol:.0f} 張。"
    if strategy_id == "monthly_support_v1" and ma20 and abs(close - ma20) / close * 100 < 3 and close >= ma20 and vol < avg20:
        return 75, f"回測 MA20 {ma20:.2f} 守住，量能低於 20 日均量。"
    if strategy_id == "ma20_retest_strategy" and ma20 and prev_ma20 and ma20 >= prev_ma20 and close >= ma20 and lows[-1] <= ma20 * 1.02 and vol <= avg20:
        return 76, f"月線 MA20 {ma20:.2f} 上彎，盤中回測附近後收盤守住且量縮。"
    if strategy_id == "macd_turn_v1" and dif and dea and hist and hist_prev is not None and dif > dea and hist > hist_prev and close > (ma20 or close):
        return 77, f"MACD DIF 站上慢線，OSC 由 {hist_prev:.2f} 改善至 {hist:.2f}。"
    if strategy_id == "double_bottom_reversal_strategy":
        levels = _double_bottom_levels(highs, lows, closes)
        if levels and vol >= avg20:
            _, _, neckline, bottom = levels
            return 85, f"W底突破頸線 {neckline:.2f}，低點區約 {bottom:.2f}，量能不低於 20 日均量。"
    if strategy_id == "head_shoulders_bottom_reversal_strategy":
        hs = _head_shoulders_bottom(highs, lows, closes)
        if hs and vol >= avg20:
            neckline, head = hs
            return 84, f"頭肩底突破頸線 {neckline:.2f}，頭部低點約 {head:.2f}，量能配合。"
    if strategy_id == "rsi_bullish_divergence_strategy":
        div = _rsi_bullish_divergence(lows, closes)
        if div and ma5 and close > ma5 and close > prev_close:
            _, _, first_rsi, second_rsi = div
            return 78, f"價格回測低檔但 RSI 由 {first_rsi:.1f} 墊高至 {second_rsi:.1f}，今日站回短均。"
    if strategy_id == "macd_bullish_divergence_strategy":
        div = _macd_bullish_divergence(lows, closes)
        if div and hist is not None and hist > (hist_prev or hist) and close > prev_close:
            _, _, first_hist, second_hist = div
            return 78, f"價格回測低檔但 MACD 動能由 {first_hist:.2f} 改善至 {second_hist:.2f}。"
    if strategy_id == "kd_low_golden_cross_strategy" and kd_now:
        (k, d), (pk, pd) = kd_now
        if pk <= pd and k > d and k < 45 and close > prev_close:
            return 76, f"KD 低檔黃金交叉，K={k:.1f}、D={d:.1f}，價格同步止跌。"
    if strategy_id == "long_lower_shadow_reversal_strategy":
        if candle_range and lower_shadow / candle_range >= .45 and latest_low <= low20 * 1.03 and close > prev_close:
            return 76, f"低檔長下影止跌，下影占 K 棒 {lower_shadow / candle_range * 100:.0f}%，支撐約 {low20:.2f}。"
    if strategy_id == "bottom_volume_reversal_strategy":
        if latest_low <= min(lows[-61:-1]) * 1.03 and close > latest_open and close > prev_close and vol >= avg20 * 1.8:
            return 79, f"低檔爆量紅 K，成交量為 20 日均量 {vol / max(avg20, 1):.2f} 倍，觀察止跌。"
    if strategy_id == "oversold_rebound_strategy" and rsi_now is not None:
        recent_rsi_low = min(rsi(closes[:i]) for i in range(max(15, len(closes) - 8), len(closes) + 1) if rsi(closes[:i]) is not None)
        if recent_rsi_low <= 35 and close > prev_close and ma5 and close >= ma5:
            return 75, f"近期 RSI 最低 {recent_rsi_low:.1f} 後反彈，收盤站回短均。"
    if strategy_id == "ma_bull_trend_strategy" and ma5 and ma10 and ma20 and ma60 and close > ma5 > ma10 > ma20 > ma60:
        return 82, f"均線多頭排列 MA5>{ma10:.2f}>{ma20:.2f}>{ma60:.2f}，價格站上短均。"
    if strategy_id == "macd_trend_red_bar_strategy" and dif and dea and hist and hist_prev is not None and dif > dea and hist > 0 and hist > hist_prev and close > (ma20 or close):
        return 79, f"MACD 順勢紅柱擴大，OSC 由 {hist_prev:.2f} 增至 {hist:.2f}。"
    if strategy_id == "adx_trend_strength_strategy" and ma20 and prev_ma20 and atr_now:
        trend_gain = pct(close, closes[-10])
        if trend_gain and trend_gain > 5 and ma20 > prev_ma20 and close > ma20 and atr_now / close * 100 >= 2:
            return 76, f"價格 10 日上漲 {trend_gain:.1f}% 且 MA20 上彎，波動擴張代表趨勢增強。"
    if strategy_id == "supertrend_bull_strategy" and atr_now and ma20:
        trail = ma20 - atr_now * 2
        prev_trail = (prev_ma20 or ma20) - atr_now * 2
        if close > trail and trail >= prev_trail and close > ma20:
            return 77, f"價格站上 ATR 追蹤線 {trail:.2f}，趨勢線維持上行。"
    if strategy_id == "ma5_strong_trend_strategy" and ma5 and prev_ma5 and close > ma5 and ma5 > prev_ma5 and lows[-3] >= ma5 * .98 and vol >= 1000:
        return 79, f"強勢股沿 MA5 上攻，近 3 日未有效跌破五日線 {ma5:.2f}。"
    if strategy_id == "flag_continuation_strategy":
        surge = pct(max(highs[-21:-8]), min(lows[-35:-21])) or 0
        pullback = pct(max(highs[-8:-1]), min(lows[-8:-1])) or 0
        if surge >= 12 and pullback <= 8 and close > max(highs[-8:-1]) and vol >= avg20:
            return 80, f"前段上漲 {surge:.1f}% 後旗形整理，今日突破旗面。"
    if strategy_id == "n_wave_trend_strategy":
        recent_low = min(lows[-15:-5])
        prior_low = min(lows[-35:-16])
        if recent_low > prior_low and close > high20 and vol >= avg20:
            return 80, f"N 字型高低點墊高，近期低點 {recent_low:.2f} 高於前低 {prior_low:.2f} 並突破前高。"
    if strategy_id == "box_bottom_range_strategy":
        box_width = pct(high20, low20)
        if box_width and box_width < 15 and latest_low <= low20 * 1.03 and close > low20 and vol <= avg20:
            return 70, f"箱型下緣 {low20:.2f} 附近量縮止跌，仍屬區間策略。"
    if strategy_id == "box_top_range_strategy":
        box_width = pct(high20, low20)
        if box_width and box_width < 15 and latest_high >= high20 * .98 and close < high20 and upper_shadow >= lower_shadow:
            return 68, f"接近箱型上緣 {high20:.2f} 出現壓力，區間高檔不追價。"
    if strategy_id == "bollinger_band_range_strategy" and bb_width is not None and bb_width < 12:
        if latest_low <= lower * 1.02 and close > lower:
            return 72, f"低波動盤觸及布林下軌 {lower:.2f} 後收回，偏區間反彈。"
        if latest_high >= upper * .98 and close < upper:
            return 68, f"低波動盤接近布林上軌 {upper:.2f} 後轉弱，偏區間壓力。"
    if strategy_id == "rsi_range_strategy" and rsi_now is not None and bb_width is not None and bb_width < 15:
        if rsi_now <= 35 and close > prev_close:
            return 71, f"震盪盤 RSI {rsi_now:.1f} 偏低後反彈。"
        if rsi_now >= 70 and close < prev_close:
            return 68, f"震盪盤 RSI {rsi_now:.1f} 過熱後轉弱。"
    if strategy_id == "kd_range_cycle_strategy" and kd_now:
        (k, d), (pk, pd) = kd_now
        if k > d and pk <= pd and k < 35:
            return 70, f"區間盤 KD 低檔轉強，K={k:.1f}、D={d:.1f}。"
        if k < d and pk >= pd and k > 65:
            return 67, f"區間盤 KD 高檔轉弱，K={k:.1f}、D={d:.1f}。"
    if strategy_id == "support_resistance_range_strategy":
        if latest_low <= low20 * 1.025 and close > low20:
            return 70, f"回測近 20 日支撐 {low20:.2f} 後收回。"
        if latest_high >= high20 * .985 and close < high20:
            return 67, f"接近近 20 日壓力 {high20:.2f} 後未突破。"
    if strategy_id == "top_volume_upper_shadow_risk":
        near_high = latest_high >= prev_high60 * 0.98
        if candle_range and near_high and vol >= avg20 * 1.8 and upper_shadow / candle_range >= 0.45 and close < latest_high * 0.97:
            return 72, f"高檔爆量長上影，成交量為 20 日均量 {vol / max(avg20, 1):.2f} 倍，追價風險升高。"
    if strategy_id == "ma20_break_risk" and ma20 and latest_high >= ma20 * .98 and close < ma20 and prev_close < (prev_ma20 or ma20):
        return 70, f"跌破月線後反彈站不回 MA20 {ma20:.2f}，趨勢轉弱風險。"
    if strategy_id == "false_breakout_risk":
        prior_resistance = max(highs[-22:-2])
        if prev_close > prior_resistance and close < prior_resistance and vol >= avg20:
            return 72, f"前一日突破 {prior_resistance:.2f} 後今日跌回，疑似假突破。"
    if strategy_id == "margin_surge_risk" and margin_rows:
        recent_margin = _sum_recent(margin_rows, "margin_change", 3)
        latest_margin = nf(margin_rows[-1].get("margin_change"), 0)
        if recent_margin > 0 and latest_margin > 0 and latest_high >= prev_high60 * .95 and close < latest_high * .98:
            return 69, f"融資近 3 筆增加 {recent_margin:.0f}，且股價位階偏高，籌碼風險升高。"
    if strategy_id == "institutional_selling_risk" and inst_rows:
        recent_sell = sum(nf(r.get("total_buy_sell"), nf(r.get("foreign_buy_sell"), 0)) for r in inst_rows[-3:])
        if recent_sell < 0 and ma20 and close < ma20:
            return 70, f"法人近 3 筆合計賣超 {recent_sell:.0f}，且股價跌破 MA20。"
    if strategy_id == "disposition_risk":
        recent_move = max(abs(pct(closes[i], closes[i - 1]) or 0) for i in range(len(closes) - 5, len(closes)))
        recent_range = pct(max(highs[-10:]), min(lows[-10:])) or 0
        if recent_move >= 8 or recent_range >= 28:
            return 66, f"短線波動異常，近 10 日振幅 {recent_range:.1f}%，需留意處置或追價風險。"
    if strategy_id == "liquidity_risk" and (avg20 < 1000 or vol < 500):
        return 65, f"流動性不足，成交量 {vol:.0f} 張、20 日均量 {avg20:.0f} 張。"
    if strategy_id == "gap_up_fade_risk" and latest_open > highs[-2] * 1.02 and close < latest_open and close <= (latest_high + latest_low) / 2:
        return 70, f"跳空開高後走低，開盤 {latest_open:.2f} 未能守住，短線追高風險。"
    return None


def _strategy_family(strategy_id):
    if strategy_id.endswith("_risk") or "_risk" in strategy_id:
        return "risk"
    if "_range_" in strategy_id or strategy_id.endswith("_range_strategy"):
        return "range"
    if "retest" in strategy_id:
        return "retest"
    if "reversal" in strategy_id or "divergence" in strategy_id or "rebound" in strategy_id:
        return "reversal"
    if "trend" in strategy_id or "ma_bull" in strategy_id or "supertrend" in strategy_id:
        return "trend"
    if "breakout" in strategy_id or "high" in strategy_id:
        return "breakout"
    return "mixed"


def _score_label(score, family):
    if family == "risk":
        if score >= 78:
            return "高風險訊號"
        if score >= 68:
            return "風險訊號"
        return "風險觀察"
    if score >= 85:
        return "強訊號"
    if score >= 75:
        return "普通訊號"
    return "僅觀察"


def score_strategy_hit(strategy, prices, context, base_score, reason):
    closes, highs, lows, vols, latest, _ = _stats(prices)
    close = closes[-1]
    vol = vols[-1]
    avg20 = avg(vols[-20:]) or 0
    ma5 = ma(closes, 5)
    ma20 = ma(closes, 20)
    prev_ma20 = ma(closes[:-1], 20)
    ma60 = ma(closes, 60)
    latest_open = nf(latest.get("open"), close)
    latest_high = highs[-1]
    latest_low = lows[-1]
    candle_range = max(latest_high - latest_low, 0)
    upper_shadow = latest_high - max(latest_open, close)
    volume_ratio = vol / max(avg20, 1)
    family = _strategy_family(strategy["id"])
    components = {"base": int(base_score), "trend": 0, "volume": 0, "chip": 0, "riskPenalty": 0}
    notes = []

    if ma20 and close > ma20:
        components["trend"] += 4
    if ma5 and ma20 and ma5 > ma20:
        components["trend"] += 4
    if ma20 and prev_ma20 and ma20 > prev_ma20:
        components["trend"] += 3
    if ma60 and close > ma60:
        components["trend"] += 3

    if volume_ratio >= 2.5:
        components["volume"] += 7
        notes.append("量能明顯放大，需確認不是短線過熱")
    elif volume_ratio >= 1.5:
        components["volume"] += 8
    elif volume_ratio >= 1.15:
        components["volume"] += 5
    elif family in {"retest", "range"} and volume_ratio <= 0.9:
        components["volume"] += 5

    inst_rows = _chip_context_rows(context, "institutional")
    if inst_rows:
        recent_inst = sum(nf(r.get("total_buy_sell"), nf(r.get("foreign_buy_sell"), 0)) for r in inst_rows[-3:])
        if recent_inst > 0:
            components["chip"] += 4
        elif recent_inst < 0:
            components["chip"] -= 4
            notes.append("法人近 3 筆偏賣超")

    margin_rows = _chip_context_rows(context, "margin")
    if margin_rows:
        recent_margin = _sum_recent(margin_rows, "margin_change", 3)
        if recent_margin > 0 and family != "risk":
            components["riskPenalty"] += 3
            notes.append("融資增加，留意籌碼浮額")

    if avg20 < 1000:
        components["riskPenalty"] += 8
        notes.append("20 日均量低於 1000 張，流動性較弱")
    if ma20 and close > ma20 * 1.15 and family != "risk":
        components["riskPenalty"] += 5
        notes.append("價格距離 MA20 偏遠，追價風險提高")
    if candle_range and upper_shadow / candle_range >= 0.45:
        components["riskPenalty"] += 5
        notes.append("今日上影線偏長")

    raw = base_score + components["trend"] + components["volume"] + components["chip"] - components["riskPenalty"]
    if family == "risk":
        raw = base_score + components["riskPenalty"] + max(0, -components["chip"])
        risk_level = "high" if raw >= 78 else "medium"
    else:
        risk_level = "medium" if components["riskPenalty"] >= 8 else "low"
    score = int(max(0, min(100, round(raw))))
    label = _score_label(score, family)
    risk_note = "；".join(notes) if notes else "僅作策略研究，仍需搭配大盤、題材與停損控管。"
    if family == "risk" and not notes:
        risk_note = "此為風險避開策略，命中代表應降低追價或部位曝險。"
    return {
        "score": score,
        "hit_type": label,
        "reason": reason,
        "risk_note": risk_note,
        "metadata": {
            "source": "phase6_strategy_center",
            "strategy_family": family,
            "risk_level": risk_level,
            "quality_components": components,
            "volume_ratio": round(volume_ratio, 2),
        },
    }


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
        strategy_context = load_strategy_context()
        latest_date = max((prices[-1]["date"] for prices in series.values() if prices), default=None)
        sb_upsert("strategy_definitions", _definition_rows(), on_conflict="id")
        hits = []
        for symbol, prices in series.items():
            if not prices or prices[-1]["date"] != latest_date:
                continue
            for strategy in STRATEGIES:
                if not strategy.get("enabled", True):
                    continue
                hit = hit_strategy(strategy["id"], prices, strategy_context.get(str(symbol), {}))
                if not hit:
                    continue
                base_score, reason = hit
                scored = score_strategy_hit(strategy, prices, strategy_context.get(str(symbol), {}), base_score, reason)
                hits.append({
                    "strategy_id": strategy["id"],
                    "strategy_name": strategy["name"],
                    "symbol": symbol,
                    "name": stock_name(stock_map, symbol),
                    "date": latest_date,
                    "score": scored["score"],
                    "hit_type": scored["hit_type"],
                    "reason": scored["reason"],
                    "risk_note": scored["risk_note"],
                    "metadata": scored["metadata"],
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
