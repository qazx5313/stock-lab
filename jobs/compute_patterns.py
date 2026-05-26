from __future__ import annotations

from pattern_detector import detect_patterns_for_symbol
from phase6_common import avg, load_price_series, load_stock_map, log, ma, nf, safe_status, stock_name, volume_lots
from sb_common import sb_delete, sb_upsert

MIN_PATTERN_VOLUME_LOTS = 1000


def _pattern_key(row):
    return (str(row.get("symbol")), str(row.get("date")), str(row.get("pattern_type")))


def _row(symbol, name, latest, pattern_type, score, support, resistance, reason, risk_note):
    close = nf(latest.get("close"))
    support = round(support, 2) if support is not None else None
    resistance = round(resistance, 2) if resistance is not None else None
    target = None
    if close is not None and support is not None and resistance is not None:
        target = round(close + max(resistance - support, close * 0.035), 2)
    return {
        "symbol": symbol,
        "name": name,
        "date": latest.get("date"),
        "pattern_type": pattern_type,
        "confidence_score": round(score, 2),
        "support": support,
        "resistance": resistance,
        "breakout_price": resistance,
        "stop_loss": support,
        "target_price": target,
        "reason": reason,
        "risk_note": risk_note,
    }


def build_baseline_patterns(stock_map, series, latest_date, existing_keys, limit=180):
    """用真實 K 棒補出保守型態觀察，避免嚴格型態不足時頁面空白。"""
    rows = []
    for symbol, prices in series.items():
        clean = [
            r for r in prices
            if nf(r.get("close")) is not None
            and nf(r.get("high")) is not None
            and nf(r.get("low")) is not None
        ]
        if len(clean) < 35 or clean[-1].get("date") != latest_date:
            continue
        latest = clean[-1]
        closes = [nf(r.get("close")) for r in clean if nf(r.get("close")) is not None]
        highs = [nf(r.get("high")) for r in clean if nf(r.get("high")) is not None]
        lows = [nf(r.get("low")) for r in clean if nf(r.get("low")) is not None]
        vols = [volume_lots(r) for r in clean]
        if len(closes) < 35 or len(highs) < 35 or len(lows) < 35:
            continue
        close = closes[-1]
        ma20 = ma(closes, 20)
        avg_vol20 = avg(vols[-20:]) or 0
        vol = vols[-1]
        if vol < MIN_PATTERN_VOLUME_LOTS:
            continue
        support = min(lows[-20:])
        resistance = max(highs[-20:])
        prev_res = max(highs[-21:-1]) if len(highs) >= 21 else resistance
        prev_close = closes[-2] if len(closes) >= 2 else close
        close_position = (close - lows[-1]) / max(highs[-1] - lows[-1], 0.01)
        name = stock_name(stock_map, symbol)

        candidates = []
        if (
            prev_res
            and close > prev_res * 1.005
            and prev_close <= prev_res
            and avg_vol20 >= MIN_PATTERN_VOLUME_LOTS * 0.5
            and vol >= MIN_PATTERN_VOLUME_LOTS
            and vol >= avg_vol20 * 1.5
            and close_position >= 0.55
        ):
            candidates.append(_row(symbol, name, latest, "放量突破", 78, support, prev_res, "今日剛收盤突破前段壓力，且成交量明顯高於 20 日均量。", "隔日若跌回突破價，需視為假突破風險。"))
        if ma20 and abs(close - ma20) / close * 100 <= 4 and avg_vol20 and vol <= avg_vol20 * 0.9:
            candidates.append(_row(symbol, name, latest, "量縮回測", 72, ma20, resistance, "價格回測 MA20 附近，量能低於 20 日均量。", "跌破 MA20 且放量時，整理結構轉弱。"))
        rng_pct = (resistance - support) / close * 100 if close else 99
        if rng_pct <= 18:
            candidates.append(_row(symbol, name, latest, "箱型整理", 66, support, resistance, "近 20 日高低區間收斂，價格仍在箱型內。", "等待放量突破箱頂或跌破箱底。"))

        for item in candidates:
            if _pattern_key(item) not in existing_keys:
                rows.append(item)
                existing_keys.add(_pattern_key(item))
    rows.sort(key=lambda r: (r.get("confidence_score") or 0), reverse=True)
    return rows[:limit]


def main():
    key = "phase6_patterns"
    try:
        stock_map = load_stock_map()
        series = load_price_series()
        rows = []
        latest_date = None
        skipped = 0
        for symbol, prices in series.items():
            if len(prices) < 35:
                continue
            latest_date = max(latest_date or prices[-1]["date"], prices[-1]["date"])
            try:
                rows.extend(detect_patterns_for_symbol(symbol, stock_name(stock_map, symbol), prices))
            except Exception as exc:
                skipped += 1
                log(f"  pattern skip {symbol}: {exc}")
        if latest_date:
            existing = {_pattern_key(r) for r in rows}
            latest_count = sum(1 for r in rows if r.get("date") == latest_date)
            if latest_count < 30:
                rows.extend(build_baseline_patterns(stock_map, series, latest_date, existing, limit=180))
            sb_delete("detected_patterns", f"date=eq.{latest_date}")
        rows = sorted(rows, key=lambda r: (str(r.get("date") or ""), r.get("confidence_score") or 0), reverse=True)[:1200]
        if rows:
            sb_upsert("detected_patterns", rows, on_conflict="symbol,date,pattern_type")
        log(f"patterns={len(rows)} latest={latest_date} skipped={skipped}")
        safe_status(key, True, f"型態辨識完成 {len(rows)} 筆，略過 {skipped} 檔")
    except Exception as exc:
        log(f"compute_patterns failed: {exc}")
        safe_status(key, False, str(exc))


if __name__ == "__main__":
    main()
