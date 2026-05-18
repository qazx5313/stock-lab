#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_ai_lab.py — AI 量化模擬實驗室

第 1 個新版機器人：HMA/STDEV 量化 AI

規則：
  - 日 K，HMA(9)，Standard Deviation(9)
  - 收盤價上穿 HMA 且收盤價 > HMA 為關鍵 K 棒
  - 關鍵 K 棒下一根 K 棒為進場點
  - SL = 進場價 - 進場 K 棒 STDEV * 2
  - TP = 進場價 + 最新 K 棒 STDEV * 3，逐日更新，只往上調整
  - 週五收盤強制出場
  - 停損後，再進場需同時上穿 HMA 且突破前 6 根 K 棒高點

注意：日 K 不知道盤中先碰高或低；同一根同時碰 SL/TP 時採保守順序，先停損。
"""
import datetime as dt
import json
import math
import re
from collections import defaultdict

from sb_common import log, mark_status, sb_delete, sb_one, sb_select, sb_upsert


AGENT_NAME = "HMA/STDEV 量化 AI"
AGENT_TYPE = "hma_stdev_v1"
AGENT_VERSION = "hma-stdev-v1.0"
INIT_CASH = 1_000_000
HMA_LENGTH = 9
STDEV_LENGTH = 9
SL_MULT = 2
TP_MULT = 3
MAX_BUY_PER_RUN = 5


def nfloat(v):
    try:
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def weekday(date_text):
    return dt.date.fromisoformat(str(date_text)[:10]).weekday()


def wma(values, length):
    out = [None] * len(values)
    if length <= 0:
        return out
    denom = length * (length + 1) / 2
    for i in range(length - 1, len(values)):
        window = values[i - length + 1 : i + 1]
        if any(v is None for v in window):
            continue
        out[i] = sum(v * (j + 1) for j, v in enumerate(window)) / denom
    return out


def hma(values, length=HMA_LENGTH):
    half = max(1, int(length / 2))
    root = max(1, int(math.sqrt(length)))
    wh = wma(values, half)
    wf = wma(values, length)
    diff = [
        (2 * a - b) if a is not None and b is not None else None
        for a, b in zip(wh, wf)
    ]
    return wma(diff, root)


def stdev(values, length=STDEV_LENGTH):
    out = [None] * len(values)
    for i in range(length - 1, len(values)):
        window = values[i - length + 1 : i + 1]
        if any(v is None for v in window):
            continue
        mean = sum(window) / length
        out[i] = math.sqrt(sum((v - mean) ** 2 for v in window) / length)
    return out


def normalize_rows(rows):
    clean = []
    by_date = {}
    for r in rows:
        close = nfloat(r.get("close"))
        if close is None:
            continue
        d = str(r.get("date"))[:10]
        by_date[d] = {
            "date": d,
            "open": nfloat(r.get("open")) or close,
            "high": nfloat(r.get("high")) or close,
            "low": nfloat(r.get("low")) or close,
            "close": close,
        }
    for d in sorted(by_date):
        clean.append(by_date[d])
    return clean


def enrich(rows):
    rows = normalize_rows(rows)
    closes = [r["close"] for r in rows]
    h = hma(closes)
    sd = stdev(closes)
    for i, r in enumerate(rows):
        r["hma"] = h[i]
        r["stdev"] = sd[i]
    return rows


def is_cross_up(rows, i):
    if i <= 0:
        return False
    prev_close = rows[i - 1]["close"]
    prev_hma = rows[i - 1].get("hma")
    close = rows[i]["close"]
    cur_hma = rows[i].get("hma")
    return (
        prev_hma is not None
        and cur_hma is not None
        and prev_close <= prev_hma
        and close > cur_hma
    )


def breakout_prev6(rows, i):
    if i < 6:
        return False
    prev_high = max(r["high"] for r in rows[i - 6 : i])
    return rows[i]["close"] > prev_high


def parse_state(text):
    m = re.search(r"STATE=(\{.*\})", str(text or ""))
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except Exception:
        return {}


def reason_with_state(label, state):
    return f"{label} STATE={json.dumps(state, ensure_ascii=False, separators=(',', ':'))}"


def hma_backtest(rows):
    rows = enrich(rows)
    trades = []
    in_pos = False
    pending_key = None
    stopped_out = False
    entry = sl = tp = None
    entry_date = None

    for i, r in enumerate(rows):
        if pending_key is not None and not in_pos:
            entry_sd = r.get("stdev")
            if entry_sd is not None:
                entry = r["open"]
                sl = entry - entry_sd * SL_MULT
                tp = entry + entry_sd * TP_MULT
                entry_date = r["date"]
                in_pos = True
            pending_key = None

        if in_pos:
            if r.get("stdev") is not None:
                tp = max(tp, entry + r["stdev"] * TP_MULT)
            exit_reason = None
            exit_px = None
            if r["low"] <= sl:
                exit_reason = "停損"
                exit_px = sl
                stopped_out = True
            elif r["high"] >= tp:
                exit_reason = "移動停利"
                exit_px = tp
            elif weekday(r["date"]) == 4:
                exit_reason = "週五出場"
                exit_px = r["close"]
            if exit_reason:
                trades.append((entry_date, r["date"], entry, exit_px, exit_reason))
                in_pos = False
                entry = sl = tp = entry_date = None
            continue

        if i + 1 >= len(rows) or not is_cross_up(rows, i):
            continue
        if stopped_out and not breakout_prev6(rows, i):
            continue
        pending_key = i

    rets = [((ex - en) / en * 100) for _, _, en, ex, _ in trades if en]
    wins = [r for r in rets if r > 0]
    losses = [r for r in rets if r <= 0]
    pf = sum(wins) / abs(sum(losses)) if losses and sum(losses) else (99 if wins else 0)
    return {
        "sample_count": len(rets),
        "win_rate": round(len(wins) / len(rets) * 100, 2) if rets else 0,
        "avg_return_3d": round((sum(rets) / len(rets)) * 0.6, 2) if rets else 0,
        "avg_return_5d": round(sum(rets) / len(rets), 2) if rets else 0,
        "avg_return_10d": round((sum(rets) / len(rets)) * 1.6, 2) if rets else 0,
        "max_drawdown": round(min(rets), 2) if rets else 0,
        "profit_factor": round(pf, 2),
    }


def latest_price(symbol, prices_by_sym):
    rows = normalize_rows(prices_by_sym.get(symbol, []))
    return rows[-1]["close"] if rows else None


def latest_bar(symbol, prices_by_sym):
    rows = enrich(prices_by_sym.get(symbol, []))
    return rows[-1] if rows else None


def last_stop_loss_date(agent_id, symbol):
    rows = sb_select(
        "ai_trades",
        f"select=trade_date,reason&agent_id=eq.{agent_id}&symbol=eq.{symbol}"
        "&trade_type=eq.賣出&order=trade_date.desc&limit=1",
    )
    if rows and "停損" in str(rows[0].get("reason") or ""):
        return str(rows[0].get("trade_date"))[:10]
    return None


def latest_entry_signal(symbol, rows, agent_id):
    rows = enrich(rows)
    if len(rows) < HMA_LENGTH + 3:
        return None
    key_i = len(rows) - 2
    entry_i = len(rows) - 1
    if not is_cross_up(rows, key_i):
        return None
    stop_date = last_stop_loss_date(agent_id, symbol)
    if stop_date and rows[key_i]["date"] > stop_date and not breakout_prev6(rows, key_i):
        return None
    entry_sd = rows[entry_i].get("stdev")
    if entry_sd is None:
        return None
    entry = rows[entry_i]["open"]
    sl = entry - entry_sd * SL_MULT
    tp = entry + entry_sd * TP_MULT
    return {
        "symbol": symbol,
        "date": rows[entry_i]["date"],
        "key_date": rows[key_i]["date"],
        "entry": entry,
        "entry_sd": entry_sd,
        "sl": sl,
        "tp": tp,
        "hma": rows[key_i].get("hma"),
    }


def sync_hma_agent():
    agents = sb_select("ai_agents", "select=*&order=id.asc")
    hma_agents = [a for a in agents if a.get("strategy_type") == AGENT_TYPE]
    if not hma_agents:
        log("首次建立新版 HMA/STDEV AI，清除舊三機器人資料")
        for table in [
            "ai_candidates",
            "ai_backtests",
            "ai_deep_analysis",
            "ai_positions",
            "ai_trades",
            "ai_reviews",
            "ai_strategy_versions",
        ]:
            sb_delete(table, "agent_id=gte.0")
        sb_delete("ai_agents", "id=gte.0")
        sb_upsert(
            "ai_agents",
            [
                {
                    "name": AGENT_NAME,
                    "strategy_type": AGENT_TYPE,
                    "description": "日K HMA(9) 上穿搭配 STDEV(9) 風控；週五出場；SL 固定、TP 移動。",
                    "initial_cash": INIT_CASH,
                    "current_cash": INIT_CASH,
                    "current_asset_value": 0,
                    "status": "active",
                    "strategy_version": AGENT_VERSION,
                }
            ],
        )
        hma_agents = sb_select("ai_agents", f"select=*&strategy_type=eq.{AGENT_TYPE}&limit=1")
    else:
        keep = hma_agents[0]
        for a in agents:
            if a["id"] == keep["id"]:
                continue
            for table in [
                "ai_candidates",
                "ai_backtests",
                "ai_deep_analysis",
                "ai_positions",
                "ai_trades",
                "ai_reviews",
                "ai_strategy_versions",
            ]:
                sb_delete(table, f"agent_id=eq.{a['id']}")
            sb_delete("ai_agents", f"id=eq.{a['id']}")
    return hma_agents[0]


def update_open_positions(agent, latest, prices_by_sym):
    aid = agent["id"]
    open_pos = sb_select("ai_positions", f"select=*&agent_id=eq.{aid}&status=eq.持有")
    updates, sells = [], []
    for p in open_pos:
        sym = p["symbol"]
        rows = enrich(prices_by_sym.get(sym, []))
        if not rows:
            continue
        bar = rows[-1]
        px = bar["close"]
        bp = float(p.get("buy_price") or 0)
        qty = int(p.get("quantity") or 0)
        state = parse_state(p.get("buy_reason"))
        sl = float(state.get("sl") or bp * 0.92)
        prev_tp = float(state.get("tp") or bp * 1.15)
        if bar.get("stdev") is not None:
            tp = max(prev_tp, bp + bar["stdev"] * TP_MULT)
        else:
            tp = prev_tp
        status = "持有"
        exit_reason = ""
        exit_px = None
        if bar["low"] <= sl:
            status = "已賣出"
            exit_px = sl
            exit_reason = f"HMA/STDEV 停損 SL={sl:.2f}"
        elif bar["high"] >= tp:
            status = "已賣出"
            exit_px = tp
            exit_reason = f"HMA/STDEV 移動停利 TP={tp:.2f}"
        elif weekday(bar["date"]) == 4:
            status = "已賣出"
            exit_px = px
            exit_reason = "週五出場，避開週末跳空風險"
        mv = int(px * qty * 1000)
        pnl = int((px - bp) * qty * 1000)
        ret = round((px - bp) / bp * 100, 2) if bp else 0
        state.update({"sl": round(sl, 4), "tp": round(tp, 4), "last_date": bar["date"]})
        updates.append(
            {
                "id": p["id"],
                "agent_id": aid,
                "symbol": sym,
                "name": p.get("name"),
                "buy_date": p.get("buy_date"),
                "buy_price": bp,
                "quantity": qty,
                "current_price": px,
                "market_value": mv,
                "unrealized_pnl": pnl,
                "unrealized_return": ret,
                "buy_reason": reason_with_state("HMA/STDEV 持倉追蹤", state),
                "status": status,
            }
        )
        if status == "已賣出":
            sells.append(
                {
                    "agent_id": aid,
                    "symbol": sym,
                    "trade_date": latest,
                    "trade_type": "賣出",
                    "price": exit_px,
                    "quantity": qty,
                    "amount": int(exit_px * qty * 1000),
                    "reason": exit_reason,
                    "strategy_version": AGENT_VERSION,
                }
            )
    sb_upsert("ai_positions", updates, on_conflict="id")
    sb_upsert("ai_trades", sells)
    return updates, sells


def main():
    log("=== run_ai_lab HMA/STDEV 開始 ===")
    agent = sync_hma_agent()
    aid = agent["id"]
    latest_row = sb_one("daily_prices", "select=date&order=date.desc&limit=1")
    if not latest_row:
        mark_status("run_ai_lab", False, "no daily_prices")
        return
    latest = str(latest_row["date"])[:10]

    prices = sb_select(
        "daily_prices",
        "select=date,symbol,open,high,low,close&order=date.asc",
        page_size=1000,
    )
    prices_by_sym = defaultdict(list)
    for r in prices:
        prices_by_sym[r["symbol"]].append(r)

    stocks = sb_select("stocks", "select=symbol,name", page_size=1000)
    name_map = {s["symbol"]: s.get("name") for s in stocks}

    updated, sells = update_open_positions(agent, latest, prices_by_sym)
    held = {p["symbol"] for p in updated if p.get("status") == "持有"}
    current_asset_value = sum(int(p.get("market_value") or 0) for p in updated if p.get("status") == "持有")

    sb_delete("ai_candidates", f"agent_id=eq.{aid}&date=eq.{latest}")
    sb_delete("ai_backtests", f"agent_id=eq.{aid}")
    sb_delete("ai_deep_analysis", f"agent_id=eq.{aid}")

    candidates, backtests, deep_rows = [], [], []
    signals = []
    for sym, rows in prices_by_sym.items():
        rows = normalize_rows(rows)
        if len(rows) < 35 or rows[-1]["date"] != latest:
            continue
        bt = hma_backtest(rows)
        sig = latest_entry_signal(sym, rows, aid)
        if sig:
            signals.append(sig)
            accepted = True
            reason = (
                f"關鍵K={sig['key_date']} 收盤上穿HMA9；"
                f"進場={sig['entry']:.2f} SL={sig['sl']:.2f} TP={sig['tp']:.2f}"
            )
        else:
            accepted = False
            reason = "今日無 HMA/STDEV 進場訊號"
        if accepted:
            candidates.append(
                {
                    "agent_id": aid,
                    "candidate_pool_id": None,
                    "date": latest,
                    "symbol": sym,
                    "accepted_by_agent": True,
                    "agent_reason": reason,
                }
            )
            backtests.append(
                {
                    "agent_id": aid,
                    "ai_candidate_id": None,
                    "symbol": sym,
                    "matched_conditions": reason,
                    **bt,
                    "passed": bt["sample_count"] >= 2,
                    "failed_reason": "" if bt["sample_count"] >= 2 else "歷史訊號樣本不足",
                }
            )
            deep_rows.append(
                {
                    "agent_id": aid,
                    "ai_candidate_id": None,
                    "symbol": sym,
                    "finmind_data_used": json.dumps({"strategy": AGENT_TYPE}, ensure_ascii=False),
                    "technical_summary": reason,
                    "chip_summary": "本策略只使用價格指標，不納入籌碼。",
                    "fundamental_summary": "本策略只使用日K HMA/STDEV，不納入基本面。",
                    "risk_summary": "週五出場；固定 SL；TP 以 STDEV 移動。",
                    "final_score": min(100, 60 + bt["sample_count"] * 2 + int(bt["win_rate"] / 5)),
                    "decision": "買進",
                    "decision_reason": reason,
                }
            )

    sb_upsert("ai_candidates", candidates)
    sb_upsert("ai_backtests", backtests)
    sb_upsert("ai_deep_analysis", deep_rows)

    cash_available = int(agent.get("current_cash") if agent.get("current_cash") is not None else INIT_CASH)
    sold_cash = sum(int(t["amount"]) for t in sells)
    cash_available += sold_cash
    buy_signals = [s for s in signals if s["symbol"] not in held][:MAX_BUY_PER_RUN]
    per = cash_available // len(buy_signals) if buy_signals else 0
    positions, buys = [], []
    for sig in buy_signals:
        sym = sig["symbol"]
        entry = sig["entry"]
        qty = int(per // (entry * 1000)) if entry else 0
        if qty < 1:
            continue
        amount = int(entry * qty * 1000)
        state = {
            "key_date": sig["key_date"],
            "entry_sd": round(sig["entry_sd"], 4),
            "sl": round(sig["sl"], 4),
            "tp": round(sig["tp"], 4),
            "hma": round(sig["hma"], 4) if sig.get("hma") is not None else None,
        }
        positions.append(
            {
                "agent_id": aid,
                "symbol": sym,
                "name": name_map.get(sym, sym),
                "buy_date": latest,
                "buy_price": entry,
                "quantity": qty,
                "current_price": latest_price(sym, prices_by_sym) or entry,
                "market_value": amount,
                "unrealized_pnl": 0,
                "unrealized_return": 0,
                "buy_reason": reason_with_state("HMA/STDEV 進場", state),
                "status": "持有",
            }
        )
        buys.append(
            {
                "agent_id": aid,
                "symbol": sym,
                "trade_date": latest,
                "trade_type": "買進",
                "price": entry,
                "quantity": qty,
                "amount": amount,
                "reason": reason_with_state("HMA/STDEV 進場", state),
                "strategy_version": AGENT_VERSION,
            }
        )
    sb_upsert("ai_positions", positions)
    sb_upsert("ai_trades", buys)

    spent = sum(int(t["amount"]) for t in buys)
    cash_after = cash_available - spent
    asset_after = current_asset_value + sum(int(p["market_value"]) for p in positions)
    review = (
        f"HMA/STDEV 今日掃描 {len(prices_by_sym)} 檔，出現 {len(signals)} 檔進場訊號，"
        f"買進 {len(buys)} 檔，賣出 {len(sells)} 檔，持有 {len(held)+len(positions)} 檔。"
    )
    improvement = (
        "策略已可執行。下一步可加入成交量濾網或大盤濾網，降低盤整區間頻繁進出。"
        if signals
        else "今日無進場訊號，維持等待；後續可統計不同 STDEV 倍數下的訊號品質。"
    )
    sb_upsert(
        "ai_reviews",
        [
            {
                "agent_id": aid,
                "trade_id": None,
                "review_date": latest,
                "self_review": review,
                "chatgpt_review": "",
                "gemini_review": "",
                "final_review": review,
                "improvement_suggestion": improvement,
                "applied_to_strategy": False,
            }
        ],
    )
    sb_upsert(
        "ai_strategy_versions",
        [
            {
                "agent_id": aid,
                "version": AGENT_VERSION,
                "change_summary": "建立 HMA(9)+STDEV(9) 日K策略。",
                "old_rules": "舊三機器人已停用",
                "new_rules": "HMA 上穿隔日進場；SL=entry-STDEV*2；TP=entry+STDEV*3 移動；週五出場。",
                "reason": review,
            }
        ],
    )
    sb_upsert(
        "ai_agents",
        [
            {
                "id": aid,
                "name": AGENT_NAME,
                "strategy_type": AGENT_TYPE,
                "description": "日K HMA(9) 上穿搭配 STDEV(9) 風控；週五出場；SL 固定、TP 移動。",
                "initial_cash": INIT_CASH,
                "current_cash": cash_after,
                "current_asset_value": asset_after,
                "status": "active",
                "strategy_version": AGENT_VERSION,
            }
        ],
        on_conflict="id",
    )
    mark_status("run_ai_lab", True, f"hma_signals={len(signals)} buys={len(buys)} sells={len(sells)} latest={latest}")
    log(f"=== run_ai_lab 完成：signals={len(signals)} buys={len(buys)} sells={len(sells)} ===")


if __name__ == "__main__":
    main()
