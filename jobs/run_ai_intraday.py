#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Intraday AI paper-trading simulator.

This job is intentionally different from the after-hours AI lab:
- it runs from the realtime workflow after MIS quotes are fetched;
- it builds a live "today" candle from realtime_quotes;
- it requires liquidity >= 1000 lots before any candidate/buy;
- it updates open positions and creates simulated buy/sell trades during market hours.
"""
import datetime as dt

from sb_common import log, mark_status, sb_delete, sb_select, sb_upsert
from run_ai_lab import (
    AGENT_DEFS,
    INIT_CASH,
    MAX_BUY_PER_AGENT,
    VERSION,
    build_context,
    enrich,
    exit_position,
    nfloat,
    parse_state,
    reason_with_state,
    rev_yoy,
)

MIN_VOLUME_LOTS = 1000
MIN_VOLUME_SHARES = MIN_VOLUME_LOTS * 1000
MAX_CANDIDATES_PER_AGENT = 20
HISTORY_DAYS = 180


def valid_symbol(s):
    s = str(s or "").strip()
    return len(s) == 4 and s.isdigit() and s[0] != "0"


def volume_shares(v, amount=None, price=None):
    n = nfloat(v) or 0
    amt = nfloat(amount)
    px = nfloat(price)
    if n > 0 and amt and px:
        implied = amt / px
        if implied > 0:
            as_shares_err = abs(n - implied) / implied
            as_lots_err = abs((n * 1000) - implied) / implied
            if as_lots_err < as_shares_err and as_lots_err <= 0.25:
                return int(n * 1000)
    # realtime_quotes.volume is normalized as shares by fetch_realtime_quotes.py.
    return int(n)


def volume_lots_value(v, amount=None, price=None):
    return int(volume_shares(v, amount, price) // 1000)


def name_map():
    out = {}
    for r in sb_select("stocks", "select=symbol,name", page_size=1000, max_rows=50000):
        sym = str(r.get("symbol") or "").strip()
        name = str(r.get("name") or "").strip()
        if valid_symbol(sym) and name and name != sym and name != "尚無名稱":
            out[sym] = name
    return out


def latest_history_by_symbol():
    rows = sb_select(
        "daily_prices",
        "select=date,symbol,open,high,low,close,volume&order=date.asc",
        page_size=1000,
        max_rows=300000,
    )
    by_sym = {}
    for r in rows:
        sym = str(r.get("symbol") or "").strip()
        if not valid_symbol(sym):
            continue
        by_sym.setdefault(sym, []).append(r)
    return {sym: vals[-HISTORY_DAYS:] for sym, vals in by_sym.items()}


def quote_rows():
    quotes = sb_select(
        "realtime_quotes",
        "select=symbol,name,market,quote_date,quote_time,price,change,change_percent,volume,amount,updated_at&order=updated_at.desc",
        page_size=1000,
        max_rows=50000,
    )
    out = {}
    for r in quotes:
        sym = str(r.get("symbol") or "").strip()
        px = nfloat(r.get("price"))
        if not valid_symbol(sym) or px is None:
            continue
        # Keep the newest row if duplicates exist.
        if sym not in out or str(r.get("updated_at") or "") > str(out[sym].get("updated_at") or ""):
            out[sym] = r
    return out


def quote_date(quotes):
    dates = [str(r.get("quote_date"))[:10] for r in quotes.values() if r.get("quote_date")]
    return max(dates) if dates else dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().isoformat()


def append_live_row(history, q, qdate):
    rows = list(history or [])
    px = nfloat(q.get("price"))
    if px is None:
        return rows
    vol = volume_shares(q.get("volume"), q.get("amount"), q.get("price"))
    prev_close = nfloat(rows[-1].get("close")) if rows else px
    live = {
        "date": qdate,
        "open": prev_close,
        "high": max(prev_close or px, px),
        "low": min(prev_close or px, px),
        "close": px,
        "volume": vol,
    }
    if rows and str(rows[-1].get("date"))[:10] == qdate:
        rows[-1] = {**rows[-1], **live}
    else:
        rows.append(live)
    return rows


def liquidity_ok_quote(q):
    return volume_lots_value(q.get("volume"), q.get("amount"), q.get("price")) >= MIN_VOLUME_LOTS


def intraday_signal(strategy, sym, rows, q, ctx):
    if len(rows) < 35 or not liquidity_ok_quote(q):
        return None
    live = enrich(rows)
    i = len(live) - 1
    prev, cur = live[i - 1], live[i]
    entry = nfloat(q.get("price")) or cur["close"]
    if strategy["signal"] == "hma":
        if prev.get("hma9") is None or cur.get("hma9") is None or cur.get("stdev9") is None:
            return None
        crossed = prev["close"] <= prev["hma9"] and cur["close"] > cur["hma9"]
        holding_strength = cur["close"] > cur["hma9"] and (nfloat(q.get("change_percent")) or 0) > 0
        if not (crossed or holding_strength):
            return None
        sd = cur["stdev9"]
        return {
            "symbol": sym,
            "entry": entry,
            "sl": entry - sd * 2,
            "tp": entry + sd * 3,
            "key_date": cur["date"],
            "entry_date": cur["date"],
            "current_price": entry,
            "volume_lots": volume_lots_value(q.get("volume"), q.get("amount"), q.get("price")),
            "reason": f"盤中站上HMA9；即時量 {volume_lots_value(q.get('volume'), q.get('amount'), q.get('price')):,} 張；SL/TP 依 STDEV9 計算",
            "state": {"hma": round(cur["hma9"], 4), "entry_sd": round(sd, 4), "intraday": True},
        }
    if strategy["signal"] == "bollinger":
        if prev.get("bb_upper") is None or cur.get("bb_upper") is None:
            return None
        yoy = rev_yoy(ctx["monthly_by_sym"], sym)
        if yoy is not None and yoy < 20:
            return None
        if not cur["close"] > cur["bb_upper"]:
            return None
        return {
            "symbol": sym,
            "entry": entry,
            "sl": entry * 0.88,
            "tp": entry * 1.35,
            "key_date": cur["date"],
            "entry_date": cur["date"],
            "current_price": entry,
            "volume_lots": volume_lots_value(q.get("volume"), q.get("amount"), q.get("price")),
            "reason": f"盤中突破布林上緣；即時量 {volume_lots_value(q.get('volume'), q.get('amount'), q.get('price')):,} 張；月營收YoY={yoy if yoy is not None else '待補'}",
            "state": {"bb_upper": round(cur["bb_upper"], 4), "revenue_yoy": yoy, "intraday": True},
        }
    return None


def intraday_exit(strategy, pos, rows, q):
    px = nfloat(q.get("price"))
    if px is None:
        return None, ""
    live = enrich(rows)
    row = live[-1]
    state = parse_state(pos.get("buy_reason"))
    bp = nfloat(pos.get("buy_price")) or nfloat(state.get("entry")) or px
    state.update({"entry": bp, "last_quote_time": q.get("quote_time")})
    if strategy["signal"] == "hma" and row.get("stdev9") is not None:
        state["tp"] = max(nfloat(state.get("tp")) or 0, bp + row["stdev9"] * 3)
    sl = nfloat(state.get("sl"))
    tp = nfloat(state.get("tp"))
    if sl is not None and px <= sl:
        return sl, "盤中停損"
    if tp is not None and px >= tp:
        return tp, "盤中停利"
    if strategy.get("exit_ma20") and row.get("ma20") is not None and px < row["ma20"]:
        return px, "盤中跌破20MA"
    # Friday risk control still applies intraday after the quote exists.
    px2, reason = exit_position(strategy, row, state)
    if reason == "週五出場":
        return px, "週五盤中出場"
    return None, ""


def update_open_positions(agent, strategy, history_by_sym, quotes, names, qdate):
    aid = agent["id"]
    open_pos = sb_select("ai_positions", f"select=*&agent_id=eq.{aid}&status=eq.持有")
    updates, sells = [], []
    for pos in open_pos:
        sym = str(pos.get("symbol") or "").strip()
        q = quotes.get(sym)
        if not q:
            continue
        rows = append_live_row(history_by_sym.get(sym, []), q, qdate)
        px = nfloat(q.get("price"))
        bp = nfloat(pos.get("buy_price"))
        qty = int(pos.get("quantity") or 0)
        if px is None or bp is None or qty <= 0:
            continue
        exit_px, exit_reason = intraday_exit(strategy, pos, rows, q)
        status = "持有"
        current = px
        if exit_px is not None:
            status = "已賣出"
            current = exit_px
        mv = int(current * qty * 1000)
        pnl = int((current - bp) * qty * 1000)
        ret = round((current - bp) / bp * 100, 2) if bp else 0
        state = parse_state(pos.get("buy_reason"))
        state.update({"last_date": qdate, "last_quote_time": q.get("quote_time")})
        updates.append({
            "id": pos["id"],
            "agent_id": aid,
            "symbol": sym,
            "name": names.get(sym) or pos.get("name") or q.get("name") or sym,
            "buy_date": pos.get("buy_date"),
            "buy_price": bp,
            "quantity": qty,
            "current_price": current,
            "market_value": mv,
            "unrealized_pnl": pnl,
            "unrealized_return": ret,
            "buy_reason": reason_with_state(f"{strategy['name']} 盤中持倉追蹤", state),
            "status": status,
        })
        if status == "已賣出":
            sells.append({
                "agent_id": aid,
                "symbol": sym,
                "trade_date": qdate,
                "trade_type": "賣出",
                "price": current,
                "quantity": qty,
                "amount": mv,
                "reason": reason_with_state(f"{strategy['name']} {exit_reason}", {
                    **state,
                    "buy_price": round(bp, 4),
                    "sell_price": round(current, 4),
                    "pnl": pnl,
                    "return_pct": ret,
                    "quote_time": q.get("quote_time"),
                }),
                "strategy_version": VERSION,
            })
    sb_upsert("ai_positions", updates, on_conflict="id")
    sb_upsert("ai_trades", sells)
    return updates, sells


def run_strategy(agent, strategy, history_by_sym, quotes, names, ctx, qdate):
    aid = agent["id"]
    log(f"--- intraday {strategy['name']} start ---")
    updated, sells = update_open_positions(agent, strategy, history_by_sym, quotes, names, qdate)
    held = {p["symbol"] for p in updated if p.get("status") == "持有"}
    existing_positions = sb_select("ai_positions", f"select=symbol&agent_id=eq.{aid}&status=eq.持有", page_size=1000)
    held |= {str(p.get("symbol")) for p in existing_positions if valid_symbol(p.get("symbol"))}
    today_trades = sb_select("ai_trades", f"select=symbol,trade_type&agent_id=eq.{aid}&trade_date=eq.{qdate}", page_size=1000)
    bought_or_sold_today = {str(t.get("symbol")) for t in today_trades if valid_symbol(t.get("symbol"))}

    signals = []
    for sym, q in quotes.items():
        rows = append_live_row(history_by_sym.get(sym, []), q, qdate)
        sig = intraday_signal(strategy, sym, rows, q, ctx)
        if sig:
            signals.append(sig)
    signals.sort(key=lambda s: (s.get("volume_lots", 0), nfloat(quotes.get(s["symbol"], {}).get("change_percent")) or 0), reverse=True)

    sb_delete("ai_candidates", f"agent_id=eq.{aid}&date=eq.{qdate}")
    candidates = [{
        "agent_id": aid,
        "candidate_pool_id": None,
        "date": qdate,
        "symbol": s["symbol"],
        "accepted_by_agent": True,
        "agent_reason": f"{strategy['name']} 盤中即時候選：{s['reason']}",
    } for s in signals[:MAX_CANDIDATES_PER_AGENT]]
    sb_upsert("ai_candidates", candidates)

    cash = int(agent.get("current_cash") if agent.get("current_cash") is not None else INIT_CASH)
    cash += sum(int(t["amount"]) for t in sells)
    current_asset_value = sum(int(p.get("market_value") or 0) for p in updated if p.get("status") == "持有")
    buy_signals = [s for s in signals if s["symbol"] not in held and s["symbol"] not in bought_or_sold_today][:MAX_BUY_PER_AGENT]
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
        q = quotes[sym]
        current = nfloat(q.get("price")) or entry
        amount = int(entry * qty * 1000)
        mv = int(current * qty * 1000)
        state = {
            "strategy": strategy["type"],
            "key_date": sig.get("key_date"),
            "entry_date": qdate,
            "entry": round(entry, 4),
            "sl": round(nfloat(sig.get("sl")) or 0, 4),
            "tp": round(nfloat(sig.get("tp")) or 0, 4) if sig.get("tp") is not None else None,
            "quote_time": q.get("quote_time"),
            "volume_lots": sig.get("volume_lots"),
            **(sig.get("state") or {}),
        }
        label = f"{strategy['name']} 盤中進場"
        positions.append({
            "agent_id": aid,
            "symbol": sym,
            "name": names.get(sym) or q.get("name") or sym,
            "buy_date": qdate,
            "buy_price": entry,
            "quantity": qty,
            "current_price": current,
            "market_value": mv,
            "unrealized_pnl": int((current - entry) * qty * 1000),
            "unrealized_return": round((current - entry) / entry * 100, 2),
            "buy_reason": reason_with_state(label, state),
            "status": "持有",
        })
        buys.append({
            "agent_id": aid,
            "symbol": sym,
            "trade_date": qdate,
            "trade_type": "買進",
            "price": entry,
            "quantity": qty,
            "amount": amount,
            "reason": reason_with_state(label, state),
            "strategy_version": VERSION,
        })
        cash -= amount
        current_asset_value += mv
    sb_upsert("ai_positions", positions)
    sb_upsert("ai_trades", buys)
    sb_upsert("ai_agents", [{
        "id": aid,
        "name": agent.get("name"),
        "strategy_type": agent.get("strategy_type"),
        "status": agent.get("status") or "active",
        "current_cash": max(0, cash),
        "current_asset_value": current_asset_value,
    }], on_conflict="id")
    review = f"{strategy['name']} 盤中掃描 {len(quotes)} 檔，成交量達標且符合 {len(signals)} 檔，買進 {len(buys)} 檔，賣出 {len(sells)} 檔。"
    sb_upsert("ai_reviews", [{
        "agent_id": aid,
        "trade_id": None,
        "review_date": qdate,
        "self_review": review,
        "chatgpt_review": "",
        "gemini_review": "",
        "final_review": review,
        "improvement_suggestion": "盤中任務使用 realtime_quotes 模擬盯盤；成交量未滿1000張不候選、不買進。",
        "applied_to_strategy": False,
    }])
    log(f"--- intraday {strategy['name']} done signals={len(signals)} buys={len(buys)} sells={len(sells)} ---")
    return len(signals), len(buys), len(sells)


def main():
    log("=== run_ai_intraday start ===")
    quotes = quote_rows()
    if not quotes:
        mark_status("run_ai_intraday", False, "no realtime_quotes")
        return
    qdate = quote_date(quotes)
    history_by_sym = latest_history_by_symbol()
    names = name_map()
    ctx = build_context()
    agents = sb_select("ai_agents", "select=*&status=eq.active", page_size=200)
    strategies = {s["type"]: s for s in AGENT_DEFS}
    if not agents:
        mark_status("run_ai_intraday", False, "no active ai_agents")
        return

    # Refresh a shared intraday candidate pool for UI/source inspection.
    sb_delete("candidate_pool", f"date=eq.{qdate}&source_module=eq.ai_intraday")
    pool = []
    for sym, q in quotes.items():
        if not liquidity_ok_quote(q):
            continue
        cp = nfloat(q.get("change_percent")) or 0
        if cp < 0:
            continue
        pool.append((volume_lots_value(q.get("volume"), q.get("amount"), q.get("price")), cp, sym, q))
    pool.sort(reverse=True)
    pool_rows = [{
        "date": qdate,
        "symbol": sym,
        "name": names.get(sym) or q.get("name") or sym,
        "source_module": "ai_intraday",
        "candidate_type": "即時量價候選",
        "reason": f"即時價 {q.get('price')}；漲跌 {q.get('change_percent')}%；量 {lots:,} 張；盤中流動性達標",
        "score": min(100, 60 + int(cp * 4) + min(lots // 1000, 30)),
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    } for lots, cp, sym, q in pool[:MAX_CANDIDATES_PER_AGENT * max(1, len(agents))]]
    sb_upsert("candidate_pool", pool_rows)

    total_s = total_b = total_x = 0
    for agent in agents:
        stype = agent.get("strategy_type")
        strategy = strategies.get(stype) or AGENT_DEFS[0]
        s, b, x = run_strategy(agent, strategy, history_by_sym, quotes, names, ctx, qdate)
        total_s += s
        total_b += b
        total_x += x
    msg = f"quote_date={qdate} quotes={len(quotes)} signals={total_s} buys={total_b} sells={total_x}; min_volume={MIN_VOLUME_LOTS} lots"
    mark_status("run_ai_intraday", True, msg)
    log("  " + msg)
    log("=== run_ai_intraday done ===")


if __name__ == "__main__":
    main()
