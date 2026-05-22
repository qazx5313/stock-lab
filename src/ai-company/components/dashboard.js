/* AI 自動營運公司 - Dashboard 元件集合 */
function aiCoEsc(v){
  return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function aiCoNum(v,unit=''){
  const n=Number(v);
  return Number.isFinite(n)?n.toLocaleString('en-US')+unit:'—';
}
function aiCoPct(v){
  const n=Number(v);
  return Number.isFinite(n)?(n>0?'+':'')+n.toFixed(2)+'%':'—';
}
function aiCoNow(){
  const d=new Date();
  return d.toLocaleTimeString('zh-TW',{hour12:false});
}
function aiCoMarket(){
  const m=(window.DATA&&DATA.market)||{};
  const tw=m.twse||{};
  const ot=m.tpex||{};
  const dist=m.dist||{};
  return {
    twse:tw,
    tpex:ot,
    dist,
    twseText:Number.isFinite(Number(tw.v))?`${aiCoNum(tw.v)} ${Number(tw.dp)>=0?'▲':'▼'} ${aiCoPct(tw.dp)}`:'資料待同步',
    tpexText:Number.isFinite(Number(ot.v))?`${aiCoNum(ot.v)} ${Number(ot.dp)>=0?'▲':'▼'} ${aiCoPct(ot.dp)}`:'資料待同步'
  };
}
function aiCoStocks(){
  const screen=(window.DATA&&Array.isArray(DATA.screen))?DATA.screen:[];
  const picks=screen.slice(0,5).map(s=>({
    c:s.c||s.symbol,
    n:s.n||s.name||s.c||s.symbol,
    score:Number(s.score||s.total_score||70),
    reason:s.note||s.reason||s.theme||'量價結構轉強',
    tags:[s.theme||s.th||'題材', Number(s.vol)?'有量':'觀察'].filter(Boolean)
  }));
  if(picks.length) return picks;
  return [
    {c:'2330',n:'台積電',score:92,reason:'技術面突破 + 籌碼集中',tags:['KD 黃金交叉','外資買超']},
    {c:'2454',n:'聯發科',score:86,reason:'AI 需求帶動',tags:['營收成長','法人買超']},
    {c:'3711',n:'日月光投控',score:78,reason:'封測景氣回溫',tags:['轉強訊號','量能放大']},
    {c:'2303',n:'聯電',score:74,reason:'晶圓代工報價上揚',tags:['月線支撐','籌碼回補']},
    {c:'3045',n:'台灣大',score:68,reason:'股利題材 + 防禦型',tags:['高殖利率','融資下降']}
  ];
}
function aiCoAgents(){
  const base=Array.isArray(window.AI_COMPANY_EMPLOYEES)?AI_COMPANY_EMPLOYEES:[];
  const real=(window.DATA&&Array.isArray(DATA.agents))?DATA.agents:[];
  const buy=real.reduce((s,a)=>s+(Number(a.buy)||0),0);
  return base.map(e=>{
    if(e.id==='trader' && buy) return {...e,tasks:Math.max(e.tasks,buy+8),done:Math.max(e.done,buy),desc:`今日模擬進場 ${buy} 檔，持續追蹤持股與風控。`};
    return e;
  });
}
function aiCoEmployeeCard(e,wide=false){
  const pct=Math.max(0,Math.min(100,Math.round((Number(e.done)||0)/(Number(e.tasks)||1)*100)));
  return `<article class="ai-co-card ${wide?'wide':''}">
    <div class="ai-co-card-head">
      <div><h3>${e.no}. ${aiCoEsc(e.name)}</h3><p>${aiCoEsc(e.desc)}</p></div>
      <span class="ai-co-status">${aiCoEsc(e.status)}</span>
    </div>
    <div class="ai-co-bot-row">
      <div class="ai-co-bot">${aiCoEsc(e.code)}</div>
      <div class="ai-co-progress"><span style="width:${pct}%"></span></div>
      <b>${pct}%</b>
    </div>
    ${wide?aiCoTradingFlow():`<div class="ai-co-mini-grid">
      <div><span>今日任務</span><b>${aiCoNum(e.tasks)}</b></div>
      <div><span>已完成</span><b>${aiCoNum(e.done)}</b></div>
      <div><span>健康分</span><b>${aiCoNum(e.score)}</b></div>
    </div>`}
    <div class="ai-co-updated"><span class="dot"></span> 最新更新 ${aiCoNow()}</div>
  </article>`;
}
function aiCoTradingFlow(){
  const items=['買進','持有中','目標達成','利空消息','停利賣出'];
  return `<div class="ai-co-trade-flow">${items.map((x,i)=>`<div class="${i===4?'sell':''}"><i>${i+1}</i><span>${x}</span></div>`).join('')}</div>
  <div class="ai-co-trade-result"><b>模擬報酬 +6.22%</b><span>今日交易 5 筆 · 持倉中 3 檔</span></div>`;
}
function aiCoHero(){
  const agents=aiCoAgents();
  const m=aiCoMarket();
  const done=agents.reduce((s,a)=>s+(a.done||0),0);
  const tasks=agents.reduce((s,a)=>s+(a.tasks||0),0);
  const pct=Math.round(done/(tasks||1)*100);
  return `<section class="ai-co-hero">
    <div class="ai-co-command">
      <div class="ai-co-hud left">
        <span>員工上線狀態</span><b>16 / 16</b><small>100%</small>
      </div>
      <div class="ai-co-supervisor">
        <div class="ai-co-robot-face"><i></i><i></i></div>
        <h2>1. AI 總主管</h2>
        <p>監控全體員工正常運作</p>
        <span><i></i> 運作中</span>
      </div>
      <div class="ai-co-hud right">
        <span>系統健康指數</span><b>98.6 / 100</b><small>${m.twseText}</small>
      </div>
      <div class="ai-co-hud bottom">
        <span>今日任務完成度</span><div><i style="width:${pct}%"></i></div><b>${pct}%</b>
      </div>
    </div>
  </section>`;
}
function aiCoTimeline(){
  const logs=Array.isArray(window.AI_COMPANY_LOGS)?AI_COMPANY_LOGS:[];
  return `<aside class="ai-co-timeline"><div class="ai-co-panel-head"><h3>即時任務紀錄</h3><select><option>全部員工</option></select></div>
    <div class="ai-co-time-list">${logs.map(l=>`<div class="ai-co-time-item ${l.tone}">
      <span class="time">${l.time}</span><i>${l.agent.slice(0,1)}</i><div><b>${aiCoEsc(l.agent)}</b><p>${aiCoEsc(l.text)}</p></div><em>${l.state==='ok'?'✓':'!'}</em>
    </div>`).join('')}</div>
  </aside>`;
}
function aiCoWatchlistPanel(){
  const rows=aiCoStocks();
  return `<section class="ai-co-panel ai-co-watch"><div class="ai-co-panel-head"><h3>明日觀察清單</h3><button data-ai-co-tab="screener">查看更多</button></div>
    <table><thead><tr><th>股票</th><th>評分</th><th>觀察原因</th><th>重點指標</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td><b>${aiCoEsc(r.c)} ${aiCoEsc(r.n)}</b></td><td><span class="ai-co-score">${r.score}</span></td><td>${aiCoEsc(r.reason)}</td><td>${r.tags.map(t=>`<span>${aiCoEsc(t)}</span>`).join('')}</td></tr>`).join('')}
    </tbody></table></section>`;
}
function aiCoDistribution(){
  const parts=[
    ['資料蒐集',26,'#0EA5E9'],['資料分析',20,'#22C55E'],['股票篩選',18,'#F97316'],
    ['模擬操盤',16,'#EF4444'],['風控管理',10,'#8B5CF6'],['檢討優化',10,'#14B8A6']
  ];
  let acc=0;
  const gradient=parts.map(p=>{const s=acc;acc+=p[1];return `${p[2]} ${s}% ${acc}%`;}).join(',');
  return `<section class="ai-co-panel"><div class="ai-co-panel-head"><h3>策略分工</h3><span>今日工時比例</span></div>
    <div class="ai-co-donut-wrap"><div class="ai-co-donut" style="background:conic-gradient(${gradient})"><b>100%</b><span>總工時</span></div>
    <ul>${parts.map(p=>`<li><i style="background:${p[2]}"></i>${p[0]} <b>${p[1]}%</b></li>`).join('')}</ul></div></section>`;
}
function aiCoPerformance(){
  const agents=(window.DATA&&Array.isArray(DATA.agents))?DATA.agents:[];
  const candidate=(window.DATA&&Array.isArray(DATA.screen))?DATA.screen.length:38;
  const buy=agents.reduce((s,a)=>s+(Number(a.buy)||0),0)||12;
  return `<section class="ai-co-panel"><div class="ai-co-panel-head"><h3>模擬績效摘要</h3><span>僅供參考</span></div>
    <div class="ai-co-kpi-grid">${[
      ['今日候選',candidate,'昨日 34'],['模擬進場',buy,'昨日 9'],['勝率','62.4%','昨日 58.1%'],
      ['平均報酬','+2.38%','昨日 +1.72%'],['風控阻擋',7,'昨日 5']
    ].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('')}</div>
    <p>模擬績效僅供參考，不代表未來實際表現。</p></section>`;
}
function aiCoApprovalPanel(){
  const rows=Array.isArray(window.AI_COMPANY_APPROVALS)?AI_COMPANY_APPROVALS:[];
  return `<section class="ai-co-panel"><div class="ai-co-panel-head"><h3>老闆審核中心</h3><span>${rows.length} 件待審核</span></div>
    ${rows.map(r=>`<div class="ai-co-approval"><i>${r.kind.slice(0,1)}</i><div><b>${r.kind}</b><p>${r.title}</p></div><span>${r.time}</span><button>審核</button></div>`).join('')}
  </section>`;
}
function aiCoMeetingPanel(){
  const rows=Array.isArray(window.AI_COMPANY_MEETING)?AI_COMPANY_MEETING:[];
  return `<section class="ai-co-panel"><div class="ai-co-panel-head"><h3>盤後檢討會議</h3><span>今晚 20:00</span></div>
    <ul class="ai-co-meeting">${rows.map(x=>`<li>${aiCoEsc(x)}</li>`).join('')}</ul>
    <button class="ai-co-wide-btn">查看會議流程</button></section>`;
}
function aiCoSectionPlaceholder(name){
  const map={
    supervisor:'AI 總主管會依任務狀態自動派工，並將高風險事項送審。',
    tasks:'任務佇列會記錄派工、執行、重試、完成與失敗狀態。',
    employees:'每位 AI 員工都有職責、權限、禁止動作、回報與績效。',
    screener:'股票篩選中心會整合技術、籌碼、題材、基本面與風控分數。',
    trading:'模擬操盤室只做模擬交易，不會真實下單。',
    backtest:'回測實驗室會驗證類似條件勝率、報酬與最大回撤。',
    review:'檢討會議室會產生改善建議，但不直接修改正式策略。',
    approvals:'老闆審核中心負責批准或拒絕高風險事項。',
    settings:'設定中心預留 API、排程、員工啟用停用與權限管理。'
  };
  return `<section class="ai-co-panel ai-co-placeholder"><h3>${aiCoEsc(name)}</h3><p>${map[name]||'此區塊已預留後續擴充。'}</p></section>`;
}
