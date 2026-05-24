from __future__ import annotations

from phase6_common import log, safe_status
from sb_common import sb_select, sb_upsert


def _top(rows, n=5):
    return rows[:n] if rows else []


def main():
    key = "phase6_daily_report"
    try:
        dates = sb_select("daily_prices", "select=date&order=date.desc", page_size=1, max_rows=1)
        report_date = dates[0]["date"] if dates else None
        if not report_date:
            raise RuntimeError("找不到 daily_prices 最新交易日")

        indexes = sb_select("market_index", "select=date,market,index_value,change,change_percent,amount&order=date.desc", page_size=10, max_rows=10)
        themes = sb_select("themes", "select=name,avg_change,hot_score,amount&order=hot_score.desc", page_size=8, max_rows=8)
        patterns = sb_select("detected_patterns", "select=symbol,name,pattern_type,confidence_score,reason&order=date.desc,confidence_score.desc", page_size=20, max_rows=20)
        strategy_hits = sb_select("strategy_results", "select=symbol,name,strategy_name,score,reason&order=date.desc,score.desc", page_size=20, max_rows=20)
        risks = sb_select("mainforce_behaviors", "select=symbol,name,behavior_type,confidence_score,risk_level,evidence&order=date.desc,confidence_score.desc", page_size=20, max_rows=20)
        ai_actions = sb_select("ai_trades", "select=symbol,trade_type,side,price,reason,trade_date,date&order=id.desc", page_size=12, max_rows=12)

        twse = next((x for x in indexes if x.get("market") in ("TWSE", "上市", "TAIEX")), None)
        tpex = next((x for x in indexes if x.get("market") in ("TPEX", "上櫃", "TPEx")), None)
        market_summary = "今日盤勢資料已整理完成。"
        if twse or tpex:
            parts = []
            if twse:
                parts.append(f"加權指數 {twse.get('index_value')}，漲跌 {twse.get('change')}")
            if tpex:
                parts.append(f"櫃買指數 {tpex.get('index_value')}，漲跌 {tpex.get('change')}")
            market_summary = "；".join(parts) + "。"

        row = {
            "report_date": report_date,
            "title": f"{report_date} AI 盤後研究報告",
            "market_summary": market_summary,
            "strong_themes": _top(themes, 6),
            "capital_flow_industries": _top(sorted(themes, key=lambda x: x.get("amount") or 0, reverse=True), 6),
            "breakout_watch": _top([x for x in patterns if "突破" in str(x.get("pattern_type"))] + strategy_hits, 8),
            "support_retest_watch": _top([x for x in patterns if "回測" in str(x.get("pattern_type")) or "底" in str(x.get("pattern_type"))], 8),
            "high_risk_warnings": _top([x for x in risks if x.get("risk_level") in ("高", "中高")], 8),
            "ai_actions": _top(ai_actions, 10),
            "tomorrow_focus": "優先觀察放量突破後能否守住、量縮回測是否止跌，以及高檔爆量長上影個股是否轉弱。",
        }
        sb_upsert("generated_daily_reports", [row], on_conflict="report_date")
        log(f"daily report generated {report_date}")
        safe_status(key, True, f"每日自動報告完成 {report_date}")
    except Exception as exc:
        log(f"generate_daily_report failed: {exc}")
        safe_status(key, False, str(exc))


if __name__ == "__main__":
    main()
