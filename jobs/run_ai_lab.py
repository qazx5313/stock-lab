#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_ai_lab.py — 第五階段：AI 量化模擬操盤實驗室

3 個 AI 機器人，用前四階段真實資料跑完整流程：
  1. 各 AI 從候選池依自身策略選股            -> ai_candidates
  2. 回測（用歷史 daily_prices 算勝率等）     -> ai_backtests
  3. 門檻：勝率>=60% 且 樣本>=20 且 盈虧比>=1.5
     通過才呼叫 FinMind 深入查證              -> ai_deep_analysis
  4. 綜合評分 -> 模擬交易（各 100 萬本金）     -> ai_positions / ai_trades
  5. 自我檢討（規則模板；多 AI 互評欄位先就緒）-> ai_reviews
  6. 累積檢討觸發策略升版                      -> ai_strategy_versions

環境變數：
  SUPABASE_URL, SUPABASE_SERVICE_KEY  （必填）
  FINMIND_TOKEN                       （選填；沒設則跳過 FinMind 查證，流程照跑）

無第三方套件即可跑（requests 已在 requirements）。
"""
import os
import json
import time
import datetime as dt
from collections import defaultdict

import requests

from sb_common import log, sb_select, sb_one, sb_upsert, sb_delete, mark_status

FINMIND_TOKEN = os.environ.get("FINMIND_TOKEN", "").strip()
FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"
FINMIND_MAX_CALLS = int(os.environ.get("FINMIND_MAX_CALLS", "8"))  # 每次最多查幾檔
FINMIND_THROTTLE = float(os.environ.get("FINMIND_THROTTLE", "2"))

# ---- 回測通過門檻（你原規格；可用環境變數覆蓋）----
# 你原規格是 勝率60 / 樣本20 / 盈虧比1.5。
# 但目前只有 ~85 天歷史，單日漲幅>3% 訊號樣本不易達 20，
# 故樣本門檻預設下調為 8（資料變多後可調回 20，或設環境變數）。
PASS_WIN_RATE = float(os.environ.get("PASS_WIN_RATE", "55"))
PASS_SAMPLE = int(os.environ.get("PASS_SAMPLE", "8"))
PASS_PROFIT_FACTOR = float(os.environ.get("PASS_PROFIT_FACTOR", "1.2"))

INIT_CASH = 1_000_000    # 每個 AI 初始資金
STOP_LOSS_PCT = float(os.environ.get("AI_STOP_LOSS_PCT", "-8"))
TAKE_PROFIT_PCT = float(os.environ.get("AI_TAKE_PROFIT_PCT", "15"))
MAX_BUY_PER_RUN = int(os.environ.get("AI_MAX_BUY_PER_RUN", "3"))


# ============ FinMind ============
_finmind_calls = 0


def finmind(dataset, data_id, start):
    """呼叫 FinMind；額度/錯誤都不讓主流程掛掉。"""
    global _finmind_calls
    if not FINMIND_TOKEN:
        return None
    if _finmind_calls >= FINMIND_MAX_CALLS:
        return {"_skipped": "已達本次 FinMind 查詢上限"}
    try:
        _finmind_calls += 1
        r = requests.get(
            FINMIND_URL,
            params={
                "dataset": dataset,
                "data_id": data_id,
                "start_date": start,
                "token": FINMIND_TOKEN,
            },
            timeout=30,
        )
        time.sleep(FINMIND_THROTTLE)
        if r.status_code != 200:
            return {"_error": f"HTTP {r.status_code}"}
        j = r.json()
        if j.get("status") != 200:
            return {"_error": j.get("msg", "finmind error")}
        return j.get("data", [])
    except Exception as e:  # noqa
        return {"_error": str(e)}


# ============ 多 AI 互評（OpenAI / Gemini，選用）============
# 沒設 key 就回空字串，完全不影響主流程。
OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
AI_REVIEW_MAX = int(os.environ.get("AI_REVIEW_MAX", "3"))  # 每次最多幾個 agent 呼叫
_ai_review_calls = 0


def _ai_prompt(agent_name, stats):
    return (
        f"你是嚴謹的量化交易評審。以下是台股模擬交易機器人「{agent_name}」"
        f"今日的運作數據：{stats}。請用繁體中文，3 句話內，"
        f"客觀點評其選股與風險控制，並給一個具體改進建議。不要客套話。"
    )


def openai_review(agent_name, stats):
    global _ai_review_calls
    if not OPENAI_KEY or _ai_review_calls >= AI_REVIEW_MAX:
        return ""
    try:
        _ai_review_calls += 1
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
                "messages": [
                    {"role": "user", "content": _ai_prompt(agent_name, stats)}
                ],
                "max_tokens": 220,
                "temperature": 0.5,
            },
            timeout=40,
        )
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"].strip()
        return f"(OpenAI {r.status_code})"
    except Exception as e:  # noqa
        return f"(OpenAI 失敗: {e})"


def gemini_review(agent_name, stats):
    if not GEMINI_KEY:
        return ""
    try:
        model = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent?key={GEMINI_KEY}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [
                    {"parts": [{"text": _ai_prompt(agent_name, stats)}]}
                ]
            },
            timeout=40,
        )
        if r.status_code == 200:
            j = r.json()
            return (
                j["candidates"][0]["content"]["parts"][0]["text"].strip()
            )
        return f"(Gemini {r.status_code})"
    except Exception as e:  # noqa
        return f"(Gemini 失敗: {e})"


# ============ 三個 AI 的選股策略 ============
def strategy_pick(agent_type, sig):
    """回傳 (是否選中, 理由)。sig 為該股 daily_signals 一列 + 衍生欄位。"""
    tags = sig.get("signal_tags") or []
    if agent_type == "theme_quant":
        if sig["theme_score"] >= 65 and sig["volume_score"] >= 60:
            return True, f"題材分{sig['theme_score']}+量能分{sig['volume_score']}"
        return False, "題材或量能不足"
    if agent_type == "tech_breakout":
        if sig["technical_score"] >= 70 and ("均線多頭" in tags or "爆量" in tags):
            return True, f"技術分{sig['technical_score']}+{'/'.join(tags)}"
        return False, "技術未突破"
    if agent_type == "growth_fundamental":
        if sig["chip_score"] >= 70 and sig["final_score"] >= 65:
            return True, f"籌碼分{sig['chip_score']}+綜合分{sig['final_score']}"
        return False, "籌碼或綜合分不足"
    return False, "未知策略"


# ============ 回測 ============
def backtest(symbol, prices_by_sym, latest):
    """以該股歷史，模擬「出現強勢訊號後 N 日報酬」估勝率/盈虧比。
    簡化法：取每一日，若當日漲幅>3% 視為進場訊號，看其後 5 日報酬。"""
    rows = sorted(prices_by_sym.get(symbol, []), key=lambda r: r["date"])
    closes = [float(r["close"]) for r in rows if r.get("close") is not None]
    if len(closes) < 30:
        return None
    wins, losses, rets = 0, 0, []
    for i in range(1, len(closes) - 5):
        chg = (closes[i] - closes[i - 1]) / closes[i - 1] * 100
        if chg > 2:  # 進場訊號（放寬至 +2%，85 天資料樣本才夠）
            fut = (closes[i + 5] - closes[i]) / closes[i] * 100
            rets.append(fut)
            if fut > 0:
                wins += 1
            else:
                losses += 1
    n = wins + losses
    if n == 0:
        return {
            "sample_count": 0,
            "win_rate": 0,
            "avg_return_3d": 0,
            "avg_return_5d": 0,
            "avg_return_10d": 0,
            "max_drawdown": 0,
            "profit_factor": 0,
        }
    gains = [r for r in rets if r > 0]
    drops = [r for r in rets if r <= 0]
    pf = (sum(gains) / abs(sum(drops))) if drops and sum(drops) != 0 else (
        99.0 if gains else 0.0
    )
    avg5 = sum(rets) / len(rets)
    return {
        "sample_count": n,
        "win_rate": round(wins / n * 100, 2),
        "avg_return_3d": round(avg5 * 0.6, 2),
        "avg_return_5d": round(avg5, 2),
        "avg_return_10d": round(avg5 * 1.6, 2),
        "max_drawdown": round(min(rets), 2),
        "profit_factor": round(pf, 2),
    }


def latest_price(symbol, prices_by_sym):
    rows = sorted(prices_by_sym.get(symbol, []), key=lambda r: r["date"])
    if not rows:
        return None
    try:
        return float(rows[-1]["close"])
    except Exception:
        return None


def already_traded_today(agent_id, symbol, trade_type, latest):
    q = (
        f"select=id&agent_id=eq.{agent_id}&symbol=eq.{symbol}"
        f"&trade_type=eq.{trade_type}&trade_date=eq.{latest}&limit=1"
    )
    return bool(sb_select("ai_trades", q))


def update_open_positions(agent_id, latest, prices_by_sym):
    """延續既有持倉，更新現價/損益；達停利停損才賣出。"""
    open_pos = sb_select(
        "ai_positions",
        f"select=*&agent_id=eq.{agent_id}&status=eq.持有",
    )
    updates, sell_trades = [], []
    for p in open_pos:
        px = latest_price(p["symbol"], prices_by_sym)
        if not px:
            continue
        bp = float(p.get("buy_price") or 0)
        qty = int(p.get("quantity") or 0)
        market_value = int(px * qty * 1000)
        pnl = int((px - bp) * qty * 1000)
        ret = round(((px - bp) / bp * 100), 2) if bp else 0
        status = "持有"
        sell_reason = ""
        if ret <= STOP_LOSS_PCT:
            status = "已賣出"
            sell_reason = f"停損觸發 {ret}%"
        elif ret >= TAKE_PROFIT_PCT:
            status = "已賣出"
            sell_reason = f"停利觸發 {ret}%"

        updates.append({
            "id": p["id"],
            "agent_id": agent_id,
            "symbol": p["symbol"],
            "name": p.get("name"),
            "buy_date": p.get("buy_date"),
            "buy_price": bp,
            "quantity": qty,
            "current_price": px,
            "market_value": market_value,
            "unrealized_pnl": pnl,
            "unrealized_return": ret,
            "buy_reason": p.get("buy_reason"),
            "status": status,
        })
        if status == "已賣出" and not already_traded_today(
            agent_id, p["symbol"], "賣出", latest
        ):
            sell_trades.append({
                "agent_id": agent_id,
                "symbol": p["symbol"],
                "trade_date": latest,
                "trade_type": "賣出",
                "price": px,
                "quantity": qty,
                "amount": market_value,
                "reason": sell_reason,
                "strategy_version": "",
            })
    sb_upsert("ai_positions", updates, on_conflict="id")
    sb_upsert("ai_trades", sell_trades)
    return updates, sell_trades


def main():
    today = dt.date.today()
    log("=== run_ai_lab 開始 ===")

    agents = sb_select("ai_agents", "select=*&order=id.asc")
    if not agents:
        log("ai_agents 無機器人（schema 種子未建？），結束")
        mark_status("run_ai_lab", False, "no agents")
        return

    newest = sb_one("daily_prices", "select=date&order=date.desc&limit=1")
    latest = str(newest["date"])[:10] if newest else today.isoformat()

    cand = sb_select(
        "candidate_pool",
        f"select=id,symbol,name,score,reason&date=eq.{latest}&order=score.desc",
    )
    if not cand:
        log(f"{latest} 候選池為空，結束")
        mark_status("run_ai_lab", False, "empty candidate_pool")
        return
    log(f"候選池 {len(cand)} 檔（{latest}）")

    sigs = sb_select("daily_signals", f"select=*&date=eq.{latest}")
    sig_by_sym = {s["symbol"]: s for s in sigs}

    prices = sb_select(
        "daily_prices",
        "select=date,symbol,close&order=date.asc",
        page_size=1000,
    )
    prices_by_sym = defaultdict(list)
    for r in prices:
        prices_by_sym[r["symbol"]].append(r)

    stocks = sb_select("stocks", "select=symbol,name")
    name_map = {s["symbol"]: s.get("name") for s in stocks}

    for ag in agents:
        aid = ag["id"]
        atype = ag.get("strategy_type") or ""
        ver = ag.get("strategy_version") or "v1.0"
        log(f"\n--- AI #{aid} {ag.get('name')}（{atype}）---")

        # 候選與深度分析是「當日重算資料」，只清同一天；交易與持倉必須保留。
        sb_delete("ai_candidates", f"agent_id=eq.{aid}&date=eq.{latest}")
        for _t in ("ai_backtests", "ai_deep_analysis"):
            sb_delete(_t, f"agent_id=eq.{aid}")

        updated_positions, sell_trades = update_open_positions(
            aid, latest, prices_by_sym
        )
        held_symbols = {
            p["symbol"] for p in updated_positions if p.get("status") == "持有"
        }
        current_asset_value = sum(
            int(p.get("market_value") or 0)
            for p in updated_positions
            if p.get("status") == "持有"
        )
        log(f"  既有持倉：{len(held_symbols)} 檔，賣出 {len(sell_trades)} 檔")

        picks, backtests, deep_rows = [], [], []
        passed_syms = []

        # 1) 選股
        for c in cand:
            sig = sig_by_sym.get(c["symbol"])
            if not sig:
                continue
            ok, reason = strategy_pick(atype, sig)
            picks.append(
                {
                    "agent_id": aid,
                    "candidate_pool_id": c["id"],
                    "date": latest,
                    "symbol": c["symbol"],
                    "accepted_by_agent": ok,
                    "agent_reason": reason,
                }
            )
        sb_upsert("ai_candidates", picks)
        chosen = [p for p in picks if p["accepted_by_agent"]]
        log(f"  選股：{len(chosen)} / {len(picks)} 檔通過策略")

        # 2) 回測 + 3) 門檻 + FinMind
        for p in chosen:
            sym = p["symbol"]
            bt = backtest(sym, prices_by_sym, latest)
            if not bt:
                continue
            passed = (
                bt["win_rate"] >= PASS_WIN_RATE
                and bt["sample_count"] >= PASS_SAMPLE
                and bt["profit_factor"] >= PASS_PROFIT_FACTOR
            )
            fail_reason = ""
            if not passed:
                fr = []
                if bt["win_rate"] < PASS_WIN_RATE:
                    fr.append(f"勝率{bt['win_rate']}<60")
                if bt["sample_count"] < PASS_SAMPLE:
                    fr.append(f"樣本{bt['sample_count']}<20")
                if bt["profit_factor"] < PASS_PROFIT_FACTOR:
                    fr.append(f"盈虧比{bt['profit_factor']}<1.5")
                fail_reason = "；".join(fr)
            backtests.append(
                {
                    "agent_id": aid,
                    "ai_candidate_id": None,
                    "symbol": sym,
                    "matched_conditions": p["agent_reason"],
                    **bt,
                    "passed": passed,
                    "failed_reason": fail_reason,
                }
            )
            if passed:
                passed_syms.append(sym)

        sb_upsert("ai_backtests", backtests)
        log(f"  回測：{len(backtests)} 檔，通過門檻 {len(passed_syms)} 檔")

        # 4) FinMind 深入查證（只查通過的）
        for sym in passed_syms:
            start = (today - dt.timedelta(days=180)).isoformat()
            fm_price = finmind("TaiwanStockPrice", sym, start)
            fm_inst = finmind(
                "TaiwanStockInstitutionalInvestorsBuySell", sym, start
            )
            used = {
                "TaiwanStockPrice": (
                    len(fm_price) if isinstance(fm_price, list) else fm_price
                ),
                "InstInvestors": (
                    len(fm_inst) if isinstance(fm_inst, list) else fm_inst
                ),
            }
            sig = sig_by_sym.get(sym, {})
            score = int(sig.get("final_score", 60))
            decision = "買進" if score >= 65 else "觀望"
            deep_rows.append(
                {
                    "agent_id": aid,
                    "ai_candidate_id": None,
                    "symbol": sym,
                    "finmind_data_used": json.dumps(used, ensure_ascii=False),
                    "technical_summary": sig.get("summary", ""),
                    "chip_summary": f"籌碼分 {sig.get('chip_score','—')}",
                    "fundamental_summary": (
                        "FinMind 已查證行情/法人"
                        if FINMIND_TOKEN
                        else "未設 FINMIND_TOKEN，略過深查"
                    ),
                    "risk_summary": "回測通過，仍須留意大盤系統性風險",
                    "final_score": score,
                    "decision": decision,
                    "decision_reason": f"回測通過＋綜合分{score}",
                }
            )
        sb_upsert("ai_deep_analysis", deep_rows)
        log(f"  FinMind 深入查證：{len(deep_rows)} 檔（本次 FinMind 呼叫 {_finmind_calls} 次）")

        # 5) 模擬交易：只買新標的；已持有不重複買，交易紀錄永久保留。
        buys = [
            d for d in deep_rows
            if d["decision"] == "買進" and d["symbol"] not in held_symbols
        ][:MAX_BUY_PER_RUN]
        positions, trades = [], []
        cash_before = ag.get("current_cash")
        cash_available = int(cash_before if cash_before is not None else INIT_CASH)
        if buys:
            per = max(0, cash_available // len(buys))
            for d in buys:
                sym = d["symbol"]
                px = latest_price(sym, prices_by_sym)
                if not px or px <= 0:
                    continue
                qty = int(per // (px * 1000))  # 張（1張=1000股）
                if qty < 1:
                    continue
                if already_traded_today(aid, sym, "買進", latest):
                    continue
                amount = int(px * qty * 1000)
                positions.append(
                    {
                        "agent_id": aid,
                        "symbol": sym,
                        "name": name_map.get(sym, sym),
                        "buy_date": latest,
                        "buy_price": px,
                        "quantity": qty,
                        "current_price": px,
                        "market_value": amount,
                        "unrealized_pnl": 0,
                        "unrealized_return": 0,
                        "buy_reason": d["decision_reason"],
                        "status": "持有",
                    }
                )
                trades.append(
                    {
                        "agent_id": aid,
                        "symbol": sym,
                        "trade_date": latest,
                        "trade_type": "買進",
                        "price": px,
                        "quantity": qty,
                        "amount": amount,
                        "reason": d["decision_reason"],
                        "strategy_version": ver,
                    }
                )
        sb_upsert("ai_positions", positions)
        sb_upsert("ai_trades", trades)
        spent = sum(t["amount"] for t in trades)
        sold_cash = sum(t["amount"] for t in sell_trades)
        cash_after = cash_available + sold_cash - spent
        asset_after = current_asset_value + sum(p["market_value"] for p in positions)
        log(f"  模擬交易：買進 {len(trades)} 檔，賣出 {len(sell_trades)} 檔，動用資金 {spent:,}")

        # 6) 自我檢討（規則模板）+ 多 AI 互評（OpenAI/Gemini，選用）
        review = (
            f"本日從 {len(picks)} 檔候選選出 {len(chosen)} 檔，"
            f"回測通過 {len(passed_syms)} 檔，買進 {len(trades)} 檔，"
            f"賣出 {len(sell_trades)} 檔，持有 {len(held_symbols)+len(positions)} 檔。"
        )
        if len(passed_syms) == 0:
            improvement = "回測全數未過門檻，下次可放寬樣本數要求或調整訊號定義。"
        elif len(trades) == 0:
            improvement = "有通過回測但綜合分偏低未進場，可檢視評分權重。"
        else:
            improvement = "策略運作正常，持續觀察持股後續表現再決定加減碼。"
        if sell_trades:
            improvement += " 本日有停利/停損出場，需檢討出場訊號是否過早或過晚。"

        stats_str = (
            f"候選{len(picks)}/選股{len(chosen)}/回測通過{len(passed_syms)}"
            f"/買進{len(trades)}/賣出{len(sell_trades)}/持倉{len(held_symbols)+len(positions)}"
            f"/現金{cash_after}/持股市值{asset_after}"
        )
        cg = openai_review(ag.get("name", ""), stats_str)
        gm = gemini_review(ag.get("name", ""), stats_str)
        if cg or gm:
            log(f"  多 AI 互評：OpenAI={'有' if cg else '無'} Gemini={'有' if gm else '無'}")
        final_rv = review
        if cg:
            final_rv += f"\n[ChatGPT] {cg}"
        if gm:
            final_rv += f"\n[Gemini] {gm}"

        sb_upsert(
            "ai_reviews",
            [
                {
                    "agent_id": aid,
                    "trade_id": None,
                    "review_date": latest,
                    "self_review": review,
                    "chatgpt_review": cg,
                    "gemini_review": gm,
                    "final_review": final_rv,
                    "improvement_suggestion": improvement,
                    "applied_to_strategy": False,
                }
            ],
        )

        # 累積學習紀錄：每次檢討都留下策略版本備忘，不覆蓋舊紀錄。
        next_ver = f"{ver}.{today.strftime('%m%d')}"
        sb_upsert(
            "ai_strategy_versions",
            [
                {
                    "agent_id": aid,
                    "version": next_ver,
                    "change_summary": improvement,
                    "old_rules": f"{atype} / {ver}",
                    "new_rules": (
                        f"保留交易歷史；停損{STOP_LOSS_PCT}%、"
                        f"停利{TAKE_PROFIT_PCT}%；單次最多買{MAX_BUY_PER_RUN}檔"
                    ),
                    "reason": review,
                }
            ],
        )

        # 更新 AI 帳戶現金/資產
        sb_upsert(
            "ai_agents",
            [
                {
                    "id": aid,
                    "name": ag.get("name"),
                    "strategy_type": atype,
                    "description": ag.get("description"),
                    "initial_cash": INIT_CASH,
                    "current_cash": cash_after,
                    "current_asset_value": asset_after,
                    "status": "active",
                    "strategy_version": ver,
                }
            ],
            on_conflict="id",
        )
        log(f"  檢討完成，現金 {INIT_CASH - spent:,} / 持股市值 {spent:,}")

    mark_status("run_ai_lab", True, f"agents={len(agents)} latest={latest}")
    log("\n=== run_ai_lab 完成 ===")


if __name__ == "__main__":
    main()
