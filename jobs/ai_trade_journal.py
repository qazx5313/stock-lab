from __future__ import annotations

import datetime as dt
import zlib

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


def safe_select(table, query, page_size=250, max_rows=250):
    try:
        return sb_select(table, query, page_size=page_size, max_rows=max_rows)
    except Exception as exc:
        log(f"  {table} 讀取略過: {exc}")
        return []


def synthetic_trade_id(prefix, *parts):
    raw = "|".join(str(p or "") for p in parts)
    return int(prefix) + zlib.crc32(raw.encode("utf-8"))


def normalize_trade_id(value, *fallback_parts):
    try:
        return int(value)
    except Exception:
        return synthetic_trade_id(800000000000, *fallback_parts)


def main():
    key = "phase6_ai_journal"
    try:
        stock_map = load_stock_map()
        series = load_price_series()
        trades = safe_select("ai_trades", "select=id,agent_id,symbol,trade_date,date,trade_type,side,price,trade_price,reason,note&order=id.desc", page_size=250, max_rows=250)
        if not trades:
            trades = safe_select("ai_trades", "select=*&order=id.desc", page_size=250, max_rows=250)
        positions = safe_select("ai_positions", "select=id,agent_id,symbol,name,buy_date,buy_price,current_price,quantity,buy_reason,reason,status&status=eq.持有&order=id.desc", page_size=250, max_rows=250)
        rows = []
        review_date = max((prices[-1]["date"] for prices in series.values() if prices), default=None) or dt.date.today().isoformat()
        seen = set()
        for trade in trades:
            symbol = str(trade.get("symbol") or "").strip()
            if not symbol:
                continue
            trade_id = normalize_trade_id(trade.get("id"), trade.get("agent_id"), symbol, trade.get("trade_date") or trade.get("date"), trade.get("price") or trade.get("trade_price"))
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
            seen.add((int(trade_id), review_date))

        for pos in positions:
            symbol = str(pos.get("symbol") or "").strip()
            if not symbol:
                continue
            trade_id = normalize_trade_id(pos.get("id"), pos.get("agent_id"), symbol, pos.get("buy_date"))
            key_pair = (trade_id, review_date)
            if key_pair in seen:
                continue
            pseudo = {
                "price": pos.get("buy_price"),
                "trade_price": pos.get("buy_price"),
                "reason": pos.get("buy_reason") or pos.get("reason"),
                "trade_type": "持股檢討",
            }
            prices = series.get(symbol, [])
            mistake, summary, suggestion = classify_trade(pseudo, prices)
            if mistake == "策略有效":
                suggestion = "持股仍符合策略，持續觀察量能、均線與停利停損是否觸發。"
            rows.append({
                "trade_id": trade_id,
                "agent_id": pos.get("agent_id"),
                "symbol": symbol,
                "name": pos.get("name") or stock_name(stock_map, symbol),
                "trade_date": pos.get("buy_date") or review_date,
                "trade_type": "持股檢討",
                "review_date": review_date,
                "result_summary": summary,
                "mistake_type": mistake,
                "improvement_suggestion": suggestion,
                "strategy_adjustment": "若同一錯誤分類連續出現，下一輪回測需調整進出場條件或風控參數。",
            })
            seen.add(key_pair)
        if rows:
            sb_upsert("ai_trade_journal", rows, on_conflict="trade_id,review_date")
        log(f"ai journal={len(rows)} review_date={review_date}")
        safe_status(key, True, f"AI 檢討日誌完成 {len(rows)} 筆")
    except Exception as exc:
        log(f"ai_trade_journal failed: {exc}")
        safe_status(key, False, str(exc))


if __name__ == "__main__":
    main()
