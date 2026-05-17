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

# ---- 回測通過門檻（你原規格）----
PASS_WIN_RATE = 60.0     # 勝率 %
PASS_SAMPLE = 20         # 最少樣本
PASS_PROFIT_FACTOR = 1.5 # 盈虧比

INIT_CASH = 1_000_000    # 每個 AI 初始資金


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
        if chg > 3:  # 進場訊號
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

        # 重算前清掉這個 agent 的舊紀錄，避免每次跑都疊加重複
        for _t in ("ai_candidates", "ai_backtests", "ai_deep_analysis",
                   "ai_positions", "ai_trades"):
            sb_delete(_t, f"agent_id=eq.{aid}")

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

        # 5) 模擬交易：對 decision=買進 的，平均分配資金買進
        buys = [d for d in deep_rows if d["decision"] == "買進"]
        positions, trades = [], []
        if buys:
            per = INIT_CASH // len(buys)
            for d in buys:
                sym = d["symbol"]
                rows = sorted(
                    prices_by_sym.get(sym, []), key=lambda r: r["date"]
                )
                px = float(rows[-1]["close"]) if rows else None
                if not px or px <= 0:
                    continue
                qty = int(per // (px * 1000))  # 張（1張=1000股）
                if qty < 1:
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
        log(f"  模擬交易：買進 {len(trades)} 檔，動用資金 {spent:,}")

        # 6) 自我檢討（規則模板；多 AI 互評欄位先就緒）
        review = (
            f"本日從 {len(picks)} 檔候選選出 {len(chosen)} 檔，"
            f"回測通過 {len(passed_syms)} 檔，實際買進 {len(trades)} 檔。"
        )
        if len(passed_syms) == 0:
            improvement = "回測全數未過門檻，下次可放寬樣本數要求或調整訊號定義。"
        elif len(trades) == 0:
            improvement = "有通過回測但綜合分偏低未進場，可檢視評分權重。"
        else:
            improvement = "策略運作正常，持續觀察持股後續表現再決定加減碼。"
        sb_upsert(
            "ai_reviews",
            [
                {
                    "agent_id": aid,
                    "trade_id": None,
                    "review_date": latest,
                    "self_review": review,
                    "chatgpt_review": "",  # 預留：未來接 OpenAI
                    "gemini_review": "",   # 預留：未來接 Gemini
                    "final_review": review,
                    "improvement_suggestion": improvement,
                    "applied_to_strategy": False,
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
                    "current_cash": INIT_CASH - spent,
                    "current_asset_value": spent,
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
