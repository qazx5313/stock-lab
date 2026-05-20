#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Intraday AI simulator refresh.

The daily AI strategy still owns technical backtests and after-hours review.
This job keeps candidates and open positions marked to the latest MIS quote so
the lab behaves like an intraday paper-trading board.
"""
import datetime as dt

from sb_common import log, mark_status, sb_delete, sb_select, sb_upsert

MIN_VOLUME = 1000 * 1000
MAX_CANDIDATES_PER_AGENT = 20


def nfloat(v):
    try:
        if v is None:
            return None
        return float(str(v).replace(",", ""))
    except Exception:
        return None


def valid_symbol(s):
    s = str(s or "").strip()
    return len(s) == 4 and s.isdigit() and s[0] != "0"


def name_map():
    out = {}
    for r in sb_select("stocks", "select=symbol,name", page_size=1000, max_rows=50000):
        sym = str(r.get("symbol") or "").strip()
        name = str(r.get("name") or "").strip()
        if valid_symbol(sym) and name and name != sym and name != "尚無名稱":
            out[sym] = name
    return out


def latest_signal_map():
    latest = sb_select("daily_signals", "select=date&order=date.desc&limit=1", page_size=1, max_rows=1)
    if not latest:
        return {}
    d = str(latest[0]["date"])[:10]
    rows = sb_select(
        "daily_signals",
        f"select=symbol,final_score,technical_score,chip_score,theme_score,summary&date=eq.{d}",
        page_size=1000,
        max_rows=50000,
    )
    return {str(r.get("symbol")): r for r in rows if valid_symbol(r.get("symbol"))}


def main():
    log("=== run_ai_intraday start ===")
    quotes = sb_select(
        "realtime_quotes",
        "select=symbol,name,market,quote_date,quote_time,price,change,change_percent,volume,updated_at",
        page_size=1000,
        max_rows=50000,
    )
    quote_by_sym = {
        str(r.get("symbol")): r
        for r in quotes
        if valid_symbol(r.get("symbol")) and nfloat(r.get("price")) is not None
    }
    if not quote_by_sym:
        mark_status("run_ai_intraday", False, "no realtime_quotes")
        return
    quote_date = max(str(r.get("quote_date"))[:10] for r in quote_by_sym.values())
    names = name_map()
    signals = latest_signal_map()
    agents = sb_select("ai_agents", "select=id,name,strategy_type,status&status=eq.active", page_size=200)

    # Update open positions to the latest quote.
    positions = sb_select("ai_positions", "select=*&status=eq.持有", page_size=1000, max_rows=10000)
    updates = []
    for p in positions:
        sym = str(p.get("symbol") or "").strip()
        q = quote_by_sym.get(sym)
        px = nfloat(q.get("price")) if q else None
        bp = nfloat(p.get("buy_price"))
        qty = int(p.get("quantity") or 0)
        if px is None or bp is None or qty <= 0:
            continue
        mv = int(px * qty * 1000)
        pnl = int((px - bp) * qty * 1000)
        ret = round((px - bp) / bp * 100, 2) if bp else 0
        updates.append({
            "id": p["id"],
            "agent_id": p.get("agent_id"),
            "symbol": sym,
            "name": names.get(sym) or p.get("name") or q.get("name") or sym,
            "buy_date": p.get("buy_date"),
            "buy_price": bp,
            "quantity": qty,
            "current_price": px,
            "market_value": mv,
            "unrealized_pnl": pnl,
            "unrealized_return": ret,
            "buy_reason": p.get("buy_reason") or "AI 即時持股追蹤",
            "status": "持有",
        })
    sb_upsert("ai_positions", updates, on_conflict="id")
    asset_by_agent = {}
    for row in updates:
        aid = row.get("agent_id")
        if aid:
            asset_by_agent[aid] = asset_by_agent.get(aid, 0) + int(row.get("market_value") or 0)
    agent_updates = []
    for agent in agents:
        if agent["id"] in asset_by_agent:
            agent_updates.append({
                "id": agent["id"],
                "name": agent.get("name"),
                "strategy_type": agent.get("strategy_type"),
                "status": agent.get("status") or "active",
                "current_asset_value": asset_by_agent[agent["id"]],
            })
    sb_upsert("ai_agents", agent_updates, on_conflict="id")

    # Refresh intraday candidates from real-time liquidity plus yesterday/daily signal score.
    sb_delete("candidate_pool", f"date=eq.{quote_date}&source_module=eq.ai_intraday")
    pool_rows = []
    ranked = []
    for sym, q in quote_by_sym.items():
        vol = int(nfloat(q.get("volume")) or 0)
        cp = nfloat(q.get("change_percent")) or 0
        sig = signals.get(sym, {})
        score = int(sig.get("final_score") or 50)
        if vol < MIN_VOLUME:
            continue
        score = max(score, min(95, 55 + int(cp * 4) + min(vol // 1_000_000, 30)))
        if score < 65 and cp < 1.0:
            continue
        ranked.append((score, vol, sym, q, sig))
    ranked.sort(reverse=True)
    for score, vol, sym, q, sig in ranked[:MAX_CANDIDATES_PER_AGENT * max(1, len(agents))]:
        pool_rows.append({
            "date": quote_date,
            "symbol": sym,
            "name": names.get(sym) or q.get("name") or sym,
            "source_module": "ai_intraday",
            "candidate_type": "即時候選",
            "reason": f"即時價 {q.get('price')}；漲跌 {q.get('change_percent')}%；量 {round(vol/1000):,} 張；{sig.get('summary') or '盤中量價符合'}",
            "score": score,
            "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
    sb_upsert("candidate_pool", pool_rows)

    ai_rows = []
    for agent in agents:
        aid = agent["id"]
        sb_delete("ai_candidates", f"agent_id=eq.{aid}&date=eq.{quote_date}")
        for row in pool_rows[:MAX_CANDIDATES_PER_AGENT]:
            ai_rows.append({
                "agent_id": aid,
                "candidate_pool_id": None,
                "date": quote_date,
                "symbol": row["symbol"],
                "accepted_by_agent": True,
                "agent_reason": f"{agent.get('name') or 'AI'} 即時候選：{row['reason']}",
            })
    sb_upsert("ai_candidates", ai_rows)
    msg = f"quote_date={quote_date} quotes={len(quote_by_sym)} positions={len(updates)} candidates={len(pool_rows)}"
    mark_status("run_ai_intraday", True, msg)
    log("  " + msg)
    log("=== run_ai_intraday done ===")


if __name__ == "__main__":
    main()
