from __future__ import annotations

from phase6_common import avg, load_price_series, load_stock_map, log, ma, nf, pct, safe_status, series_values, stock_name, volume_lots
from sb_common import sb_delete, sb_upsert


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
    support = min(lows[-21:-1])
    resistance = max(highs[-21:-1])
    ma20 = ma(closes, 20) or close
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

    if low < support and close > support and vol <= avg20 * 1.35:
        add("假跌破洗盤", 76, f"盤中跌破支撐 {support:.2f} 後收回，量能未失控。", "中", "觀察隔日是否站穩支撐。")
    if pct(max(highs[-20:]), min(lows[-20:])) and pct(max(highs[-20:]), min(lows[-20:])) < 10 and vol < avg20:
        add("橫盤磨人洗盤", 67, "近 20 日區間收斂且量能低於均量。", "低", "等待放量突破方向。")
    if pct(close, open_price) and pct(close, open_price) < -5 and vol > avg20 * 1.2:
        add("急殺長黑洗盤", 70, "出現長黑且放量，需觀察是否快速收回。", "高", "未收回前不追多。")
    if high > open_price * 1.05 and close < (high + low) / 2:
        add("拉高後快速回落", 74, "盤中拉高超過 5% 但收在半分位下方。", "高", "小心短線追價風險。")
    if high > resistance and close < resistance:
        add("假突破誘多", 80, f"突破前壓 {resistance:.2f} 後收回。", "高", "等待重新站回突破價。")
    upper_shadow = (high - close) / max(high - low, 0.01)
    if vol > avg20 * 1.8 and upper_shadow > 0.45 and close > ma20:
        add("高檔爆量出貨", 82, "爆量長上影，疑似上方籌碼鬆動。", "高", "降低追價，嚴守停損。")
    if abs(low - resistance) / close * 100 < 3 and close > resistance and vol < avg20 * 1.2:
        add("突破後回測成功", 78, "回測前壓轉支撐後收在突破價上方。", "中低", "可列入續強觀察。")
    if ma20 > ma(closes[:-5], 20) and pct(max(highs[-25:]), min(lows[-25:])) < 14 and vol < avg20 * 1.15:
        add("主升段前整理", 72, "MA20 上升且區間整理，量能未失控。", "中", "放量突破可提高關注。")
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
