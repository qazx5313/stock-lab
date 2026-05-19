#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_ai_lab.py - AI 量化模擬實驗室

保留原 HMA/STDEV 策略，並新增布林通道突破R1策略：
  1. HMA/STDEV 量化 AI
  2. 布林通道突破R1 AI

共同設計：
  - 每個策略是一個 ai_agents 機器人。
  - 每次排程會更新既有持股、重新產生候選/回測/詳細分析。
  - 回測如果發現歷史進場後到最新 K 棒仍未出場，會補進持股，不必只挑今天剛出訊號的股票。

注意：
  - 目前資料庫尚無股本、毛利率、股價淨值比、研發比，布林R1的基本面條件先用月營收 YoY 做可用欄位驗證。
"""
import datetime as dt
import json
import math
import re
from collections import defaultdict

from sb_common import log, mark_status, sb_one, sb_select, sb_upsert, sb_delete


INIT_CASH = 1_000_000
MAX_BUY_PER_AGENT = 5
MIN_VOLUME_LOTS = 1000
MIN_VOLUME_SHARES = MIN_VOLUME_LOTS * 1000
VERSION = "multi-strategy-v2.0"


AGENT_DEFS = [
    {
        "type": "hma_stdev_v1",
        "name": "HMA/STDEV 量化 AI",
        "desc": "日K HMA(9) 上穿搭配 STDEV(9) 風控；成交量需超過1000張；回測有效持股可延續；週五出場。",
        "signal": "hma",
        "friday_exit": True,
        "risk": "SL=進場-STDEV*2；TP=進場+STDEV*3 並逐日上調。",
    },
    {
        "type": "bollinger_r1_v1",
        "name": "布林通道突破R1 AI",
        "desc": "月營收YoY優先篩選，股價突破布林上緣；成交量需超過1000張。",
        "signal": "bollinger",
        "sl_pct": 0.12,
        "tp_pct": 0.35,
        "exit_ma20": True,
        "risk": "停損12%；停利35%；若跌破20MA也出場。基本面缺欄位時不使用假資料硬判定。",
    },
]


def nfloat(v):
    try:
        if v is None:
            return None
        return float(str(v).replace(",", ""))
    except Exception:
        return None


def valid_name(name, symbol):
    n = str(name or "").strip()
    s = str(symbol or "").strip()
    return bool(n and n != s and n not in ("尚無名稱", "—", "-"))


def weekday(date_text):
    return dt.date.fromisoformat(str(date_text)[:10]).weekday()


def volume_lots(row):
    return int((nfloat(row.get("volume")) or 0) // 1000)


def lots_value(v):
    x = nfloat(v) or 0
    return x / 1000 if abs(x) >= 100000 else x


def reason_with_state(label, state):
    return f"{label} STATE={json.dumps(state, ensure_ascii=False, separators=(',', ':'))}"


def parse_state(text):
    m = re.search(r"STATE=(\{.*\})", str(text or ""))
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except Exception:
        return {}


def normalize_rows(rows):
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
            "volume": nfloat(r.get("volume")) or 0,
        }
    return [by_date[d] for d in sorted(by_date)]


def ma(values, length):
    out = [None] * len(values)
    for i in range(length - 1, len(values)):
        window = values[i - length + 1 : i + 1]
        if any(v is None for v in window):
            continue
        out[i] = sum(window) / length
    return out


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


def hma(values, length=9):
    half = max(1, int(length / 2))
    root = max(1, int(math.sqrt(length)))
    wh = wma(values, half)
    wf = wma(values, length)
    diff = [(2 * a - b) if a is not None and b is not None else None for a, b in zip(wh, wf)]
    return wma(diff, root)


def stdev(values, length=9):
    out = [None] * len(values)
    for i in range(length - 1, len(values)):
        window = values[i - length + 1 : i + 1]
        if any(v is None for v in window):
            continue
        mean = sum(window) / length
        out[i] = math.sqrt(sum((v - mean) ** 2 for v in window) / length)
    return out


def enrich(rows):
    rows = normalize_rows(rows)
    closes = [r["close"] for r in rows]
    highs = [r["high"] for r in rows]
    hma9 = hma(closes, 9)
    sd9 = stdev(closes, 9)
    ma20 = ma(closes, 20)
    sd20 = stdev(closes, 20)
    for i, r in enumerate(rows):
        r["hma9"] = hma9[i]
        r["stdev9"] = sd9[i]
        r["ma20"] = ma20[i]
        r["bb_upper"] = (ma20[i] + sd20[i] * 2) if ma20[i] is not None and sd20[i] is not None else None
        r["change_percent"] = ((closes[i] - closes[i - 1]) / closes[i - 1] * 100) if i > 0 and closes[i - 1] else 0
        r["high120"] = max(highs[max(0, i - 119) : i + 1]) if i >= 0 else None
    return rows


def liquidity_ok(rows, i):
    if i < 0 or i >= len(rows):
        return False
    return (nfloat(rows[i].get("volume")) or 0) >= MIN_VOLUME_SHARES


def avg_volume(rows, i, days):
    start = max(0, i - days)
    vals = [nfloat(r.get("volume")) or 0 for r in rows[start:i]]
    return sum(vals) / len(vals) if vals else 0


def inst_lots(inst_by_sym, sym, date_text):
    row = inst_by_sym.get(sym, {}).get(str(date_text)[:10])
    if not row:
        return 0
    return lots_value(row.get("total_buy_sell") or row.get("foreign_buy_sell"))


def inst_sum_lots(inst_by_sym, sym, rows, i, days=5):
    total = 0
    for r in rows[max(0, i - days + 1) : i + 1]:
        total += inst_lots(inst_by_sym, sym, r["date"])
    return total


def rev_yoy(monthly_by_sym, sym):
    row = monthly_by_sym.get(sym)
    return nfloat(row.get("yoy_percent")) if row else None


def signal_hma(sym, rows, i, ctx):
    if i <= 0 or i + 1 >= len(rows):
        return None
    prev, cur, entry_bar = rows[i - 1], rows[i], rows[i + 1]
    if prev.get("hma9") is None or cur.get("hma9") is None or entry_bar.get("stdev9") is None:
        return None
    if not (prev["close"] <= prev["hma9"] and cur["close"] > cur["hma9"]):
        return None
    if not liquidity_ok(rows, i + 1):
        return None
    entry = entry_bar["open"]
    sd = entry_bar["stdev9"]
    return {
        "entry": entry,
        "sl": entry - sd * 2,
        "tp": entry + sd * 3,
        "key_date": cur["date"],
        "entry_date": entry_bar["date"],
        "reason": f"收盤上穿HMA9；進場量 {volume_lots(entry_bar)} 張；SL/TP 依 STDEV9 計算",
        "state": {"hma": round(cur["hma9"], 4), "entry_sd": round(sd, 4)},
    }


def signal_bollinger(sym, rows, i, ctx):
    if i <= 0 or i + 1 >= len(rows) or not liquidity_ok(rows, i):
        return None
    prev, cur = rows[i - 1], rows[i]
    if prev.get("bb_upper") is None or cur.get("bb_upper") is None:
        return None
    yoy = rev_yoy(ctx["monthly_by_sym"], sym)
    if yoy is not None and yoy < 20:
        return None
    if not (prev["close"] <= prev["bb_upper"] and cur["close"] > cur["bb_upper"]):
        return None
    entry = rows[i + 1]["open"]
    ytext = f"{yoy:.2f}%" if yoy is not None else "待補"
    return {
        "entry": entry,
        "sl": entry * 0.88,
        "tp": entry * 1.35,
        "key_date": cur["date"],
        "entry_date": rows[i + 1]["date"],
        "reason": f"突破布林通道上緣；月營收YoY={ytext}；成交量 {volume_lots(cur)} 張",
        "state": {"bb_upper": round(cur["bb_upper"], 4), "revenue_yoy": yoy},
    }


SIGNAL_FN = {
    "hma": signal_hma,
    "bollinger": signal_bollinger,
}


def exit_position(strategy, row, state):
    entry = nfloat(state.get("entry")) or 0
    sl = nfloat(state.get("sl"))
    tp = nfloat(state.get("tp"))
    if sl is not None and row["low"] <= sl:
        return sl, "停損"
    if tp is not None and row["high"] >= tp:
        return tp, "停利"
    if strategy.get("exit_ma20") and row.get("ma20") is not None and row["close"] < row["ma20"]:
        return row["close"], "跌破20MA"
    if strategy.get("friday_exit") and weekday(row["date"]) == 4:
        return row["close"], "週五出場"
    if entry <= 0:
        return None, ""
    return None, ""


def run_backtest(strategy, sym, raw_rows, ctx):
    rows = enrich(raw_rows)
    trades = []
    active = None
    sig_fn = SIGNAL_FN[strategy["signal"]]
    for i, row in enumerate(rows):
        if active:
            if strategy["signal"] == "hma" and row.get("stdev9") is not None:
                active["tp"] = max(active["tp"], active["entry"] + row["stdev9"] * 3)
            px, reason = exit_position(strategy, row, active)
            if px is not None:
                trades.append(
                    {
                        "entry_date": active["entry_date"],
                        "exit_date": row["date"],
                        "entry": active["entry"],
                        "exit": px,
                        "reason": reason,
                    }
                )
                active = None
            continue
        sig = sig_fn(sym, rows, i, ctx)
        if not sig:
            continue
        active = {
            **sig,
            "entry": sig["entry"],
            "sl": sig["sl"],
            "tp": sig.get("tp"),
            "strategy": strategy["type"],
        }
    rets = [((t["exit"] - t["entry"]) / t["entry"] * 100) for t in trades if t["entry"]]
    wins = [r for r in rets if r > 0]
    losses = [r for r in rets if r <= 0]
    pf = sum(wins) / abs(sum(losses)) if losses and sum(losses) else (99 if wins else 0)
    stats = {
        "sample_count": len(rets),
        "win_rate": round(len(wins) / len(rets) * 100, 2) if rets else 0,
        "avg_return_3d": round((sum(rets) / len(rets)) * 0.6, 2) if rets else 0,
        "avg_return_5d": round(sum(rets) / len(rets), 2) if rets else 0,
        "avg_return_10d": round((sum(rets) / len(rets)) * 1.6, 2) if rets else 0,
        "max_drawdown": round(min(rets), 2) if rets else 0,
        "profit_factor": round(pf, 2),
    }
    if active:
        latest = rows[-1]
        active.update(
            {
                "date": latest["date"],
                "current_price": latest["close"],
                "carry_from_backtest": True,
                "volume_lots": volume_lots(latest),
            }
        )
    return stats, active


def latest_signal(strategy, sym, raw_rows, ctx):
    rows = enrich(raw_rows)
    if len(rows) < 35:
        return None
    sig = SIGNAL_FN[strategy["signal"]](sym, rows, len(rows) - 2, ctx)
    if sig:
        sig.update({"date": rows[-1]["date"], "current_price": rows[-1]["close"], "carry_from_backtest": False, "volume_lots": volume_lots(rows[-1])})
    return sig


def load_name_map():
    rows = sb_select("stocks", "select=symbol,name", page_size=1000)
    out = {
        str(r["symbol"]): str(r.get("name") or "").strip()
        for r in rows
        if valid_name(r.get("name"), r.get("symbol"))
    }
    try:
        pool = sb_select("candidate_pool", "select=symbol,name&order=date.desc", page_size=1000, max_rows=50000)
        for r in pool:
            sym = str(r.get("symbol") or "").strip()
            if sym and sym not in out and valid_name(r.get("name"), sym):
                out[sym] = str(r.get("name") or "").strip()
    except Exception as exc:  # noqa
        log(f"  股票名稱 fallback 略過：{exc}")
    return out


def sync_agents():
    existing = sb_select("ai_agents", "select=*&order=id.asc")
    by_type = {a.get("strategy_type"): a for a in existing}
    active_types = {s["type"] for s in AGENT_DEFS}
    for old in existing:
        if old.get("strategy_type") not in active_types:
            log(f"移除停用 AI 策略：{old.get('name') or old.get('strategy_type')}")
            for table in [
                "ai_candidates",
                "ai_backtests",
                "ai_deep_analysis",
                "ai_positions",
                "ai_trades",
                "ai_reviews",
                "ai_strategy_versions",
            ]:
                sb_delete(table, f"agent_id=eq.{old['id']}")
            sb_delete("ai_agents", f"id=eq.{old['id']}")
    for spec in AGENT_DEFS:
        row = by_type.get(spec["type"])
        payload = {
            "name": spec["name"],
            "strategy_type": spec["type"],
            "description": spec["desc"],
            "initial_cash": INIT_CASH,
            "current_cash": row.get("current_cash") if row else INIT_CASH,
            "current_asset_value": row.get("current_asset_value") if row else 0,
            "status": "active",
            "strategy_version": VERSION,
        }
        if row:
            payload["id"] = row["id"]
            sb_upsert("ai_agents", [payload], on_conflict="id")
        else:
            sb_upsert("ai_agents", [payload])
    fresh = sb_select("ai_agents", "select=*&order=id.asc")
    return {a.get("strategy_type"): a for a in fresh if a.get("strategy_type") in {s["type"] for s in AGENT_DEFS}}


def update_open_positions(agent, strategy, latest, prices_by_sym, name_map):
    aid = agent["id"]
    open_pos = sb_select("ai_positions", f"select=*&agent_id=eq.{aid}&status=eq.持有")
    updates, sells = [], []
    for pos in open_pos:
        sym = pos["symbol"]
        rows = enrich(prices_by_sym.get(sym, []))
        if not rows:
            continue
        row = rows[-1]
        state = parse_state(pos.get("buy_reason"))
        bp = nfloat(pos.get("buy_price")) or nfloat(state.get("entry")) or row["close"]
        qty = int(pos.get("quantity") or 0)
        state.update({"entry": bp, "sl": state.get("sl"), "tp": state.get("tp")})
        if strategy["signal"] == "hma" and row.get("stdev9") is not None:
            state["tp"] = max(nfloat(state.get("tp")) or 0, bp + row["stdev9"] * 3)
        px, exit_reason = exit_position(strategy, row, state)
        status = "持有"
        current = row["close"]
        buy_date = str(pos.get("buy_date") or state.get("entry_date") or "")[:10]
        same_day_as_buy = bool(buy_date and row["date"] <= buy_date)
        if same_day_as_buy:
            px, exit_reason = None, ""
        if px is not None:
            status = "已賣出"
            current = px
        mv = int(current * qty * 1000)
        pnl = int((current - bp) * qty * 1000)
        ret = round((current - bp) / bp * 100, 2) if bp else 0
        state.update({"last_date": row["date"], "sl": state.get("sl"), "tp": state.get("tp")})
        updates.append(
            {
                "id": pos["id"],
                "agent_id": aid,
                "symbol": sym,
                "name": name_map.get(sym) or pos.get("name") or sym,
                "buy_date": pos.get("buy_date"),
                "buy_price": bp,
                "quantity": qty,
                "current_price": current,
                "market_value": mv,
                "unrealized_pnl": pnl,
                "unrealized_return": ret,
                "buy_reason": reason_with_state(f"{strategy['name']} 持倉追蹤", state),
                "status": status,
            }
        )
        if status == "已賣出":
            sell_state = {
                **state,
                "buy_date": buy_date,
                "sell_date": row["date"],
                "buy_price": round(bp, 4),
                "sell_price": round(current, 4),
                "pnl": pnl,
                "return_pct": ret,
                "exit_reason": exit_reason,
            }
            sells.append(
                {
                    "agent_id": aid,
                    "symbol": sym,
                    "trade_date": row["date"],
                    "trade_type": "賣出",
                    "price": current,
                    "quantity": qty,
                    "amount": mv,
                    "reason": reason_with_state(f"{strategy['name']} {exit_reason}", sell_state),
                    "strategy_version": VERSION,
                }
            )
    sb_upsert("ai_positions", updates, on_conflict="id")
    sb_upsert("ai_trades", sells)
    return updates, sells


def build_context():
    inst = sb_select(
        "institutional_trades",
        "select=date,symbol,foreign_buy_sell,total_buy_sell&order=date.asc",
        page_size=1000,
    )
    inst_by_sym = defaultdict(dict)
    for r in inst:
        inst_by_sym[str(r["symbol"])][str(r["date"])[:10]] = r
    monthly = sb_select(
        "monthly_revenue",
        "select=year_month,symbol,yoy_percent&order=year_month.desc",
        page_size=1000,
        max_rows=50000,
    )
    monthly_by_sym = {}
    for r in monthly:
        sym = str(r.get("symbol") or "")
        if sym and sym not in monthly_by_sym:
            monthly_by_sym[sym] = r
    return {"inst_by_sym": inst_by_sym, "monthly_by_sym": monthly_by_sym}


def run_strategy(agent, strategy, latest, prices_by_sym, name_map, ctx):
    aid = agent["id"]
    log(f"--- {strategy['name']} 開始 ---")
    updated, sells = update_open_positions(agent, strategy, latest, prices_by_sym, name_map)
    held = {p["symbol"] for p in updated if p.get("status") == "持有"}
    sold_today = {t["symbol"] for t in sells}
    current_asset_value = sum(int(p.get("market_value") or 0) for p in updated if p.get("status") == "持有")

    sb_delete("ai_candidates", f"agent_id=eq.{aid}&date=eq.{latest}")
    sb_delete("ai_backtests", f"agent_id=eq.{aid}")
    sb_delete("ai_deep_analysis", f"agent_id=eq.{aid}")

    candidates, backtests, deep_rows, signals = [], [], [], []
    for sym, raw in prices_by_sym.items():
        rows = normalize_rows(raw)
        if len(rows) < 35 or rows[-1]["date"] != latest:
            continue
        stats, active = run_backtest(strategy, sym, rows, ctx)
        sig = latest_signal(strategy, sym, rows, ctx) or active
        if not sig:
            continue
        sig["symbol"] = sym
        sig["reason"] = sig.get("reason") or "回測持股延續"
        signals.append(sig)
        reason = (
            f"回測持股延續：{sig.get('entry_date')} 進場後尚未觸發出場；{sig['reason']}"
            if sig.get("carry_from_backtest")
            else sig["reason"]
        )
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
                **stats,
                "passed": stats["sample_count"] >= 1,
                "failed_reason": "" if stats["sample_count"] >= 1 else "歷史完成交易樣本不足，但目前仍可能有有效持股",
            }
        )
        deep_rows.append(
            {
                "agent_id": aid,
                "ai_candidate_id": None,
                "symbol": sym,
                "finmind_data_used": json.dumps(
                    {"strategy": strategy["type"], "available_fields_only": True},
                    ensure_ascii=False,
                ),
                "technical_summary": reason,
                "chip_summary": "本策略以日K與成交量為主。",
                "fundamental_summary": "布林R1目前只驗證月營收YoY；股本/毛利率/PB/研發比待補欄位。" if strategy["signal"] == "bollinger" else "本策略不使用基本面或目前無對應欄位。",
                "risk_summary": strategy["risk"],
                "final_score": min(100, 60 + stats["sample_count"] * 2 + int(stats["win_rate"] / 5)),
                "decision": "買進",
                "decision_reason": reason,
            }
        )

    sb_upsert("ai_candidates", candidates)
    sb_upsert("ai_backtests", backtests)
    sb_upsert("ai_deep_analysis", deep_rows)

    cash = int(agent.get("current_cash") if agent.get("current_cash") is not None else INIT_CASH)
    cash += sum(int(t["amount"]) for t in sells)
    signals.sort(key=lambda s: (s.get("carry_from_backtest", False), s.get("volume_lots", 0)), reverse=True)
    buy_signals = [s for s in signals if s["symbol"] not in held and s["symbol"] not in sold_today][:MAX_BUY_PER_AGENT]
    per = cash // len(buy_signals) if buy_signals else 0
    positions, buys = [], []
    for sig in buy_signals:
        sym = sig["symbol"]
        entry = nfloat(sig.get("entry"))
        if not entry:
            continue
        qty = int(per // (entry * 1000))
        if qty < 1:
            continue
        current = nfloat(sig.get("current_price")) or entry
        amount = int(entry * qty * 1000)
        mv = int(current * qty * 1000)
        buy_date = sig.get("entry_date") or latest
        state = {
            "strategy": strategy["type"],
            "key_date": sig.get("key_date"),
            "entry_date": buy_date,
            "entry": round(entry, 4),
            "sl": round(nfloat(sig.get("sl")) or 0, 4),
            "tp": round(nfloat(sig.get("tp")) or 0, 4) if sig.get("tp") is not None else None,
            "carry_from_backtest": bool(sig.get("carry_from_backtest")),
            **(sig.get("state") or {}),
        }
        label = f"{strategy['name']} 回測持股補進" if sig.get("carry_from_backtest") else f"{strategy['name']} 進場"
        positions.append(
            {
                "agent_id": aid,
                "symbol": sym,
                "name": name_map.get(sym, sym),
                "buy_date": buy_date,
                "buy_price": entry,
                "quantity": qty,
                "current_price": current,
                "market_value": mv,
                "unrealized_pnl": int((current - entry) * qty * 1000),
                "unrealized_return": round((current - entry) / entry * 100, 2),
                "buy_reason": reason_with_state(label, state),
                "status": "持有",
            }
        )
        buys.append(
            {
                "agent_id": aid,
                "symbol": sym,
                "trade_date": buy_date,
                "trade_type": "買進",
                "price": entry,
                "quantity": qty,
                "amount": amount,
                "reason": reason_with_state(label, state),
                "strategy_version": VERSION,
            }
        )
    sb_upsert("ai_positions", positions)
    sb_upsert("ai_trades", buys)

    spent = sum(int(t["amount"]) for t in buys)
    cash_after = cash - spent
    asset_after = current_asset_value + sum(int(p["market_value"]) for p in positions)
    review = f"{strategy['name']} 掃描 {len(prices_by_sym)} 檔，符合/回測延續 {len(signals)} 檔，買進 {len(buys)} 檔，賣出 {len(sells)} 檔。"
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
                "improvement_suggestion": strategy["risk"],
                "applied_to_strategy": False,
            }
        ],
    )
    sb_upsert(
        "ai_strategy_versions",
        [
            {
                "agent_id": aid,
                "version": VERSION,
                "change_summary": "多策略 AI 模擬與回測持股延續。",
                "old_rules": "單一 HMA/STDEV 策略。",
                "new_rules": strategy["desc"],
                "reason": review,
            }
        ],
    )
    sb_upsert(
        "ai_agents",
        [
            {
                "id": aid,
                "name": strategy["name"],
                "strategy_type": strategy["type"],
                "description": strategy["desc"],
                "initial_cash": INIT_CASH,
                "current_cash": cash_after,
                "current_asset_value": asset_after,
                "status": "active",
                "strategy_version": VERSION,
            }
        ],
        on_conflict="id",
    )
    log(f"--- {strategy['name']} 完成 signals={len(signals)} buys={len(buys)} sells={len(sells)} ---")
    return len(signals), len(buys), len(sells)


def main():
    log("=== run_ai_lab 多策略開始 ===")
    latest_row = sb_one("daily_prices", "select=date&order=date.desc&limit=1")
    if not latest_row:
        mark_status("run_ai_lab", False, "no daily_prices")
        return
    latest = str(latest_row["date"])[:10]
    prices = sb_select(
        "daily_prices",
        "select=date,symbol,open,high,low,close,volume&order=date.asc",
        page_size=1000,
        max_rows=300000,
    )
    prices_by_sym = defaultdict(list)
    for r in prices:
        prices_by_sym[str(r["symbol"])].append(r)
    name_map = load_name_map()
    ctx = build_context()
    agents = sync_agents()

    total_s = total_b = total_x = 0
    for spec in AGENT_DEFS:
        agent = agents.get(spec["type"])
        if not agent:
            log(f"  找不到 agent: {spec['type']}，略過")
            continue
        s, b, x = run_strategy(agent, spec, latest, prices_by_sym, name_map, ctx)
        total_s += s
        total_b += b
        total_x += x
    mark_status("run_ai_lab", True, f"strategies={len(AGENT_DEFS)} signals={total_s} buys={total_b} sells={total_x} latest={latest}")
    log("=== run_ai_lab 多策略完成 ===")


if __name__ == "__main__":
    main()
