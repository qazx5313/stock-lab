from __future__ import annotations

from phase6_common import avg, hma, ma, nf, pct, rsi, series_values, stdev, volume_lots

MIN_PATTERN_VOLUME_LOTS = 1000


def _nums(values):
    return [v for v in (nf(x) for x in values) if v is not None]


def _safe_min(values):
    vals = _nums(values)
    return min(vals) if vals else None


def _safe_max(values):
    vals = _nums(values)
    return max(vals) if vals else None


def _row(symbol, name, latest, pattern_type, score, support, resistance, reason, risk_note):
    close = nf(latest.get("close"))
    support = round(support, 2) if support is not None else None
    resistance = round(resistance, 2) if resistance is not None else None
    breakout = resistance
    stop = support
    target = None
    if close is not None and support is not None and resistance is not None:
        target = round(close + max(resistance - support, close * 0.04), 2)
    return {
        "symbol": symbol,
        "name": name,
        "date": latest.get("date"),
        "pattern_type": pattern_type,
        "confidence_score": round(score, 2),
        "support": support,
        "resistance": resistance,
        "breakout_price": breakout,
        "stop_loss": stop,
        "target_price": target,
        "reason": reason,
        "risk_note": risk_note,
    }


def detect_patterns_for_symbol(symbol, name, rows):
    if len(rows) < 35:
        return []
    rows = [
        r for r in rows[-120:]
        if nf(r.get("close")) is not None
        and nf(r.get("high")) is not None
        and nf(r.get("low")) is not None
    ]
    if len(rows) < 35:
        return []
    latest = rows[-1]
    closes = series_values(rows, "close")
    highs = series_values(rows, "high")
    lows = series_values(rows, "low")
    volumes = [volume_lots(r) for r in rows]
    if len(closes) < 35 or len(highs) < 35 or len(lows) < 35:
        return []
    win20 = rows[-20:]
    prev20 = rows[-40:-20]
    support = _safe_min(r.get("low") for r in win20)
    resistance = _safe_max(r.get("high") for r in win20)
    if support is None or resistance is None:
        return []
    close = closes[-1]
    prev_close = closes[-2]
    avg_vol20 = avg(volumes[-20:]) or 0
    vol = volumes[-1]
    if vol < MIN_PATTERN_VOLUME_LOTS:
        return []
    out = []
    close_position = (close - lows[-1]) / max(highs[-1] - lows[-1], 0.01)

    rng_pct = (resistance - support) / close * 100 if close else 99
    if rng_pct <= 12:
        out.append(_row(symbol, name, latest, "箱型整理", 64 + max(0, 12 - rng_pct), support, resistance, "近 20 日高低區間收斂，價格在箱型內整理。", "未放量突破前容易維持震盪。"))

    if len(highs) >= 40 and len(lows) >= 40:
        early_high = _safe_max(highs[-40:-20])
        late_high = _safe_max(highs[-10:])
        early_low = _safe_min(lows[-40:-20])
        late_low = _safe_min(lows[-10:])
        if None not in (early_high, late_high, early_low, late_low):
            if late_high < early_high and late_low > early_low:
                out.append(_row(symbol, name, latest, "三角收斂", 72, support, resistance, "高點下降、低點墊高，多空壓縮等待方向。", "需等待放量突破或跌破確認。"))
            if abs(late_high - early_high) / close * 100 < 3 and late_low > early_low:
                out.append(_row(symbol, name, latest, "上升三角形", 74, support, resistance, "上方壓力接近水平，低點逐步墊高。", "突破失敗跌回整理區需降風險。"))
            if abs(late_low - early_low) / close * 100 < 3 and late_high < early_high:
                out.append(_row(symbol, name, latest, "下降三角形", 70, support, resistance, "下方支撐接近水平，高點逐步下降。", "跌破支撐容易轉弱。"))

        prior = pct(closes[-21], closes[-40])
        recent_high = _safe_max(closes[-12:])
        recent_pullback = pct(close, recent_high)
        if prior is not None and prior > 12 and recent_pullback is not None and -10 <= recent_pullback <= 0 and rng_pct <= 16:
            out.append(_row(symbol, name, latest, "旗形整理", 70, support, resistance, "前段急漲後量縮整理，疑似旗形休息。", "需突破旗面壓力才算續強。"))

        lows40 = lows[-40:]
        low1 = _safe_min(lows40[:20])
        low2 = _safe_min(lows40[20:])
        if None not in (low1, low2) and abs(low1 - low2) / close * 100 < 4 and close > ma(closes, 20):
            out.append(_row(symbol, name, latest, "W底", 73, min(low1, low2), resistance, "兩次測底未破且重新站回均線。", "頸線未突破前仍可能回測。"))
        highs40 = highs[-40:]
        high1 = _safe_max(highs40[:20])
        high2 = _safe_max(highs40[20:])
        if None not in (high1, high2) and abs(high1 - high2) / close * 100 < 4 and close < ma(closes, 20):
            out.append(_row(symbol, name, latest, "M頭", 72, support, max(high1, high2), "兩次攻高失敗且收回均線下方。", "若重新站回頸線，空方訊號失效。"))

    if len(highs) >= 55 and len(lows) >= 55:
        left = _safe_max(highs[-55:-38])
        head = _safe_max(highs[-38:-18])
        right = _safe_max(highs[-18:])
        if None not in (left, head, right) and head > left * 1.03 and head > right * 1.03 and close < ma(closes, 20):
            out.append(_row(symbol, name, latest, "頭肩頂", 68, support, head, "中段高點明顯高於左右肩，且短線轉弱。", "型態需跌破頸線才完全確認。"))
        left_low = _safe_min(lows[-55:-38])
        head_low = _safe_min(lows[-38:-18])
        right_low = _safe_min(lows[-18:])
        if None not in (left_low, head_low, right_low) and head_low < left_low * 0.97 and head_low < right_low * 0.97 and close > ma(closes, 20):
            out.append(_row(symbol, name, latest, "頭肩底", 68, head_low, resistance, "中段低點明顯低於左右肩，且重新站上短均。", "需突破頸線並守住才較可靠。"))

    prev_res = _safe_max(r.get("high") for r in prev20)
    if (
        prev_res is not None
        and nf(latest.get("high")) is not None
        and nf(latest.get("high")) > prev_res
        and close < prev_res
        and vol >= MIN_PATTERN_VOLUME_LOTS
    ):
        out.append(_row(symbol, name, latest, "假突破", 78, support, prev_res, "盤中突破前高但收盤跌回壓力下。", "追價容易被套，需等待重新站穩。"))
    if (
        prev_res is not None
        and close > prev_res * 1.005
        and prev_close <= prev_res
        and avg_vol20 >= MIN_PATTERN_VOLUME_LOTS * 0.5
        and vol >= MIN_PATTERN_VOLUME_LOTS
        and vol >= avg_vol20 * 1.5
        and close_position >= 0.55
    ):
        out.append(_row(symbol, name, latest, "放量突破", 82, support, prev_res, "收盤突破前高且成交量明顯放大。", "隔日若跌回突破區，需視為假突破風險。"))
    if abs(close - (ma(closes, 20) or close)) / close * 100 < 3 and avg_vol20 and vol < avg_vol20 * 0.8:
        out.append(_row(symbol, name, latest, "量縮回測", 75, ma(closes, 20), resistance, "回測 MA20 附近且量能收縮。", "若跌破均線並放量，整理結構轉弱。"))

    return out


def main():
    from compute_patterns import main as run

    run()


if __name__ == "__main__":
    main()
