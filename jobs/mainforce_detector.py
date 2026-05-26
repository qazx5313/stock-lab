from __future__ import annotations

from phase6_common import avg, load_price_series, load_stock_map, log, ma, nf, pct, safe_status, series_values, stock_name, volume_lots
from sb_common import sb_delete, sb_upsert

MIN_MAINFORCE_VOLUME_LOTS = 1000
MIN_MAINFORCE_AVG20_LOTS = 500


def detect(symbol, name, prices):
    if len(prices) < 45:
        return []
    latest = prices[-1]
    closes = series_values(prices, "close")
    highs = series_values(prices, "high")
    lows = series_values(prices, "low")
    vols = [volume_lots(r) for r in prices]
    close = closes[-1]
    open_price = nf(latest.get("open")) or close
    high = highs[-1]
    low = lows[-1]
    avg20 = avg(vols[-20:]) or 0
    vol = vols[-1]
    if vol < MIN_MAINFORCE_VOLUME_LOTS or avg20 < MIN_MAINFORCE_AVG20_LOTS:
        return []
    support = min(lows[-21:-1])
    resistance = max(highs[-21:-1])
    ma20 = ma(closes, 20) or close
    prev_close = closes[-2]
    prev_high60 = max(highs[-61:-1])
    prev_high5 = max(highs[-6:-1])
    candle_range = max(high - low, 0.01)
    close_position = (close - low) / candle_range
    upper_shadow = (high - max(open_price, close)) / candle_range
    lower_shadow = (min(open_price, close) - low) / candle_range
    volume_ratio = vol / max(avg20, 1)
    out = []

    def add(kind, score, evidence, risk, action):
        out.append({
            "symbol": symbol,
            "name": name,
            "date": latest.get("date"),
            "behavior_type": kind,
            "confidence_score": score,
            "evidence": evidence,
            "risk_level": risk,
            "suggested_action": action,
        })

    if low < support * 0.995 and close > support and close_position >= 0.58 and vol <= avg20 * 1.35:
        add("假跌破洗盤", 76, f"盤中跌破支撐 {support:.2f} 後收回，成交量 {vol:.0f} 張、量比 {volume_ratio:.2f}。", "中", "觀察隔日是否站穩支撐。")
    range20 = pct(max(highs[-20:]), min(lows[-20:]))
    if range20 and range20 < 10 and vol >= MIN_MAINFORCE_VOLUME_LOTS and vol <= avg20 * 0.9:
        add("橫盤磨人洗盤", 67, f"近 20 日區間收斂 {range20:.1f}%，成交量 {vol:.0f} 張且低於均量。", "低", "等待放量突破方向。")
    if pct(close, open_price) and pct(close, open_price) < -5 and vol >= avg20 * 1.2:
        add("急殺長黑洗盤", 70, f"出現長黑且成交量 {vol:.0f} 張，為 20 日均量 {volume_ratio:.2f} 倍。", "高", "未收回前不追多。")
    if high > open_price * 1.05 and close_position <= 0.45 and vol >= avg20:
        add("拉高後快速回落", 74, f"盤中拉高超過 5% 但收在半分位下方，成交量 {vol:.0f} 張。", "高", "小心短線追價風險。")
    if high > resistance * 1.005 and close < resistance and close_position <= 0.45 and vol >= avg20 * 0.9:
        add("假突破誘多", 80, f"盤中突破前壓 {resistance:.2f} 後收回，成交量 {vol:.0f} 張、量比 {volume_ratio:.2f}。", "高", "等待重新站回突破價。")
    if (
        vol >= avg20 * 1.8
        and upper_shadow > 0.45
        and close_position <= 0.5
        and close > ma20
        and high >= prev_high60 * 0.98
        and high >= prev_high5 * 0.995
    ):
        add("高檔爆量出貨", 82, f"今日接近 60 日高檔且爆量長上影，成交量 {vol:.0f} 張、量比 {volume_ratio:.2f}。", "高", "降低追價，嚴守停損。")
    if abs(low - resistance) / close * 100 < 3 and close > resistance and prev_close > resistance and vol <= avg20 * 1.2:
        add("突破後回測成功", 78, f"回測前壓 {resistance:.2f} 轉支撐後收在突破價上方，成交量 {vol:.0f} 張。", "中低", "可列入續強觀察。")
    ma20_prev5 = ma(closes[:-5], 20)
    if ma20_prev5 and ma20 > ma20_prev5 and range20 and range20 < 14 and vol <= avg20 * 1.15 and close >= ma20:
        add("主升段前整理", 72, f"MA20 上升且區間整理，成交量 {vol:.0f} 張、量比 {volume_ratio:.2f}。", "中", "放量突破可提高關注。")
    return out


def main():
    key = "phase6_mainforce"
    try:
        stock_map = load_stock_map()
        series = load_price_series()
        latest_date = max((prices[-1]["date"] for prices in series.values() if prices), default=None)
        rows = []
        for symbol, prices in series.items():
            if prices and prices[-1]["date"] == latest_date:
                rows.extend(detect(symbol, stock_name(stock_map, symbol), prices))
        if latest_date:
            sb_delete("mainforce_behaviors", f"date=eq.{latest_date}")
        rows = sorted(rows, key=lambda r: r["confidence_score"], reverse=True)[:800]
        if rows:
            sb_upsert("mainforce_behaviors", rows, on_conflict="symbol,date,behavior_type")
        log(f"mainforce={len(rows)} latest={latest_date}")
        safe_status(key, True, f"主力行為偵測完成 {len(rows)} 筆")
    except Exception as exc:
        log(f"mainforce_detector failed: {exc}")
        safe_status(key, False, str(exc))


if __name__ == "__main__":
    main()
