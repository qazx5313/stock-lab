from __future__ import annotations

from phase6_common import load_price_series, load_stock_map, log, nf, safe_status, stock_name, volume_lots
from sb_common import sb_select, sb_upsert


def classify_trade(trade, prices):
    reason = str(trade.get("reason") or trade.get("note") or "")
    trade_type = str(trade.get("trade_type") or trade.get("side") or "")
    price = nf(trade.get("price") or trade.get("trade_price"))
    latest = prices[-1] if prices else {}
    volume = volume_lots(latest) if latest else 0
    close = nf(latest.get("close"))
    change = ((close - price) / price * 100) if price and close else None

    if "假突破" in reason:
        mistake = "假突破"
        suggestion = "突破訊號需加入收盤站穩與隔日續強確認。"
    elif volume and volume < 1000:
        mistake = "量能不足"
        suggestion = "進場條件需維持成交量 1000 張以上，避免流動性不足。"
    elif change is not None and change < -5:
        mistake = "停損太慢"
        suggestion = "回測停損觸發條件，避免虧損擴大。"
    elif change is not None and change > 8 and trade_type.lower() in ("sell", "賣出"):
        mistake = "策略有效"
        suggestion = "保留策略核心條件，持續觀察不同市場環境表現。"
    elif change is not None and change > 6:
        mistake = "停利太早"
        suggestion = "可加入移動停利，讓主升段持股延續。"
    elif "追" in reason or (change is not None and change < -2):
        mistake = "追高"
        suggestion = "進場需避免距離均線過遠，加入乖離率限制。"
    else:
        mistake = "策略有效"
        suggestion = "目前沒有明顯錯誤，持續累積樣本。"

    summary = "尚無足夠價格資料可評估。"
    if change is not None:
        summary = f"以目前價格估算，交易後變動約 {change:+.2f}%。"
    return mistake, summary, suggestion


def main():
    key = "phase6_ai_journal"
    try:
        stock_map = load_stock_map()
        series = load_price_series()
        trades = sb_select("ai_trades", "select=id,agent_id,symbol,trade_date,date,trade_type,side,price,trade_price,reason,note&order=id.desc", page_size=250, max_rows=250)
        rows = []
        review_date = max((prices[-1]["date"] for prices in series.values() if prices), default=None)
        for trade in trades:
            trade_id = trade.get("id")
            symbol = str(trade.get("symbol") or "").strip()
            if not trade_id or not symbol:
                continue
            prices = series.get(symbol, [])
            mistake, summary, suggestion = classify_trade(trade, prices)
            rows.append({
                "trade_id": trade_id,
                "agent_id": trade.get("agent_id"),
                "symbol": symbol,
                "name": stock_name(stock_map, symbol),
                "trade_date": trade.get("trade_date") or trade.get("date"),
                "trade_type": trade.get("trade_type") or trade.get("side"),
                "review_date": review_date,
                "result_summary": summary,
                "mistake_type": mistake,
                "improvement_suggestion": suggestion,
                "strategy_adjustment": "下一輪回測需驗證此分類是否重複出現，若重複即調整策略參數。",
            })
        if rows:
            sb_upsert("ai_trade_journal", rows, on_conflict="trade_id,review_date")
        log(f"ai journal={len(rows)} review_date={review_date}")
        safe_status(key, True, f"AI 檢討日誌完成 {len(rows)} 筆")
    except Exception as exc:
        log(f"ai_trade_journal failed: {exc}")
        safe_status(key, False, str(exc))


if __name__ == "__main__":
    main()
