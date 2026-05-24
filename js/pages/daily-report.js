function vDailyReportPhase6(){
  const loading=phase6Ensure('report'); if(loading) return loading;
  const report=((DATA.phase6&&DATA.phase6.phase6Reports)||[])[0];
  if(!report){
    return typeof vReportLegacy==='function'
      ? vReportLegacy()
      : emptyPhase6('每日自動報告尚無資料','請執行 jobs/generate_daily_report.py。');
  }
  const arr=v=>{if(typeof v==='string'){try{return JSON.parse(v)||[];}catch(e){return []}}return Array.isArray(v)?v:[];};
  const list=(title,items,mapper)=>`<div class="card card-pad"><h3>${title}</h3><div class="mini-list">${(items||[]).length?(items||[]).map(mapper).join(''):'<div class="muted">目前尚無資料</div>'}</div></div>`;
  return `<div class="hero-card"><div><div class="eyebrow">DAILY REPORT</div><h2>${esc(report.title||'每日自動報告')}</h2><p>${esc(report.market_summary||'今日市場資料已整理完成。')}</p></div><div class="hero-metrics"><b>${esc(report.report_date||'—')}</b><span>資料日</span></div></div>
  <div class="grid-2">
    ${list('強勢題材',arr(report.strong_themes),x=>`<div><b>${esc(x.name||'')}</b><span>熱度 ${x.hot_score??'—'} · 平均漲跌 ${x.avg_change??'—'}%</span></div>`)}
    ${list('資金流入產業',arr(report.capital_flow_industries),x=>`<div><b>${esc(x.name||'')}</b><span>成交金額 ${x.amount??'—'}</span></div>`)}
    ${list('突破觀察股',arr(report.breakout_watch),x=>`<div data-stock="${esc(x.symbol||'')}"><b>${esc(x.symbol||'')} ${esc(x.name||'')}</b><span>${esc(x.pattern_type||x.strategy_name||'觀察')} · ${esc(x.reason||'')}</span></div>`)}
    ${list('回測支撐觀察股',arr(report.support_retest_watch),x=>`<div data-stock="${esc(x.symbol||'')}"><b>${esc(x.symbol||'')} ${esc(x.name||'')}</b><span>${esc(x.pattern_type||'回測觀察')} · ${esc(x.reason||'')}</span></div>`)}
    ${list('高風險警告股',arr(report.high_risk_warnings),x=>`<div data-stock="${esc(x.symbol||'')}"><b>${esc(x.symbol||'')} ${esc(x.name||'')}</b><span>${esc(x.behavior_type||'風險')} · ${esc(x.evidence||'')}</span></div>`)}
    ${list('AI 模擬操盤員今日動作',arr(report.ai_actions),x=>`<div data-stock="${esc(x.symbol||'')}"><b>${esc(x.symbol||'')}</b><span>${esc(x.trade_type||x.side||'')} ${esc(x.price||'')} · ${esc(x.reason||'')}</span></div>`)}
  </div>
  <div class="card card-pad"><h3>明日觀察重點</h3><p class="muted">${esc(report.tomorrow_focus||'依最新資料重新評估。')}</p></div>`;
}
var vReportLegacy=typeof vReport==='function'?vReport:null;
vReport=vDailyReportPhase6;
