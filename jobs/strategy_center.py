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


def _definition_rows():
    return [{
        "id": s["id"],
        "name": s["name"],
        "description": s["description"],
        "conditions": s["conditions"],
        "risk_rules": s["risk_rules"],
        "enabled": True,
    } for s in STRATEGIES]


def _stats(prices):
    closes = series_values(prices, "close")
    highs = series_values(prices, "high")
    lows = series_values(prices, "low")
    vols = [volume_lots(r) for r in prices]
    latest = prices[-1]
    prev = prices[-2] if len(prices) > 1 else latest
    return closes, highs, lows, vols, latest, prev


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
    hma_now = hma(closes, 9)
    hma_prev = hma(closes[:-1], 9)
    sd = stdev(closes, 9) or 0
    dif, dea, hist = macd(closes)
    _, _, hist_prev = macd(closes[:-1])
    high20 = max(highs[-21:-1])
    low20 = min(lows[-21:-1])
    basis = ma20 or close
    band_sd = stdev(closes, 20) or 0
    upper = basis + band_sd * 2

    if strategy_id == "hma_stdev_v1" and hma_now and hma_prev and prev_close <= hma_prev and close > hma_now and vol >= 1000:
        return 86, f"收盤上穿 HMA9，STDEV9={sd:.2f}，成交量 {vol:.0f} 張。"
    if strategy_id == "bollinger_r1_v1" and close > upper and vol >= avg20 * 1.3:
        return 82, f"收盤突破布林上軌 {upper:.2f}，量能放大 {vol / max(avg20, 1):.2f} 倍。"
    if strategy_id == "box_breakout_v1" and close > high20 and vol >= avg20 * 1.35 and pct(high20, low20) and pct(high20, low20) < 15:
        return 84, f"突破近 20 日箱頂 {high20:.2f}，整理後放量轉強。"
    if strategy_id == "volume_shrink_ma_v1" and ma5 and ma10 and ma20:
        spread = (max(ma5, ma10, ma20) - min(ma5, ma10, ma20)) / close * 100
        if spread < 3 and abs(close - ma20) / close * 100 < 3 and vol < avg20 * 0.85:
            return 70, f"MA5/10/20 糾結，回測 MA20 且量縮，等待方向選擇。"
    if strategy_id == "ma5_strong_v1" and ma5 and close > ma5 and ma5 > ma(closes[:-1], 5) and vol >= 1000:
        return 78, f"收盤站上 MA5 且 MA5 上彎，成交量 {vol:.0f} 張。"
    if strategy_id == "monthly_support_v1" and ma20 and abs(close - ma20) / close * 100 < 3 and close >= ma20 and vol < avg20:
        return 75, f"回測 MA20 {ma20:.2f} 守住，量能低於 20 日均量。"
    if strategy_id == "macd_turn_v1" and dif and dea and hist and hist_prev is not None and dif > dea and hist > hist_prev and close > (ma20 or close):
        return 77, f"MACD DIF 站上慢線，OSC 由 {hist_prev:.2f} 改善至 {hist:.2f}。"
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
