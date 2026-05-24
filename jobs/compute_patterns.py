from __future__ import annotations

from pattern_detector import detect_patterns_for_symbol
from phase6_common import load_price_series, load_stock_map, log, safe_status, stock_name
from sb_common import sb_delete, sb_upsert


def main():
    key = "phase6_patterns"
    try:
        stock_map = load_stock_map()
        series = load_price_series()
        rows = []
        latest_date = None
        for symbol, prices in series.items():
            if len(prices) < 35:
                continue
            latest_date = max(latest_date or prices[-1]["date"], prices[-1]["date"])
            rows.extend(detect_patterns_for_symbol(symbol, stock_name(stock_map, symbol), prices))
        if latest_date:
            rows = [r for r in rows if r["date"] == latest_date]
            sb_delete("detected_patterns", f"date=eq.{latest_date}")
        rows = sorted(rows, key=lambda r: r["confidence_score"], reverse=True)[:1200]
        if rows:
            sb_upsert("detected_patterns", rows, on_conflict="symbol,date,pattern_type")
        log(f"patterns={len(rows)} latest={latest_date}")
        safe_status(key, True, f"型態辨識完成 {len(rows)} 筆")
    except Exception as exc:
        log(f"compute_patterns failed: {exc}")
        safe_status(key, False, str(exc))


if __name__ == "__main__":
    main()
