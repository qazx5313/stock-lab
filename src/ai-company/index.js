/* AI 自動營運公司 - 獨立入口
   原站只呼叫 vAICompany() 與 bindAICompanyPage()，其餘內容都留在 src/ai-company。 */
let AI_COMPANY_VIEW='overview';

function vAICompany(){
  const view=AI_COMPANY_VIEW||'overview';
  return `<div class="ai-company-shell">
    <div class="ai-co-side">
      <div class="ai-co-brand"><div class="ai-co-logo">AI</div><div><b>AI 自動營運公司</b><span>總部控制台</span></div></div>
      <nav>${[
        ['overview','公司總覽','▣'],['supervisor','主管辦公室','♚'],['tasks','即時任務','ϟ'],
        ['employees','員工列表','●'],['screener','股票篩選中心','↗'],['trading','模擬操盤室','◎'],
        ['backtest','回測實驗室','⌁'],['review','檢討會議室','◌'],['approvals','老闆審核中心','◆'],['settings','設定中心','⚙']
      ].map(([id,t,ic])=>`<button class="${view===id?'on':''}" data-ai-co-tab="${id}"><i>${ic}</i>${t}</button>`).join('')}</nav>
      <div class="ai-co-market-box"><span>大盤即時狀況</span><b>${aiCoMarket().twseText}</b><div class="ai-co-spark"></div><small>資料更新：${aiCoNow()}</small></div>
    </div>
    <main class="ai-co-main">
      <div class="ai-co-top">
        <button class="ai-co-menu">☰</button>
        <div class="ai-co-spacer"></div>
        <span><i class="dot"></i> 系統狀態：運作中</span>
        <span class="ai-co-clock" id="aiCoClock">${aiCoNow()}</span>
        <span class="ai-co-bell">🔔<b>7</b></span>
        <button class="ai-co-boss">老闆 / 交易主管⌄</button>
      </div>
      ${view==='overview'?aiCoOverview():aiCoSectionPlaceholder(view)}
    </main>
    ${view==='overview'?aiCoTimeline():''}
  </div>`;
}

function aiCoOverview(){
  const agents=aiCoAgents();
  const main=agents.filter(a=>['collector','analyst','screener','trader','risk','review'].includes(a.id));
  return `<div class="ai-co-overview">
    <header class="ai-co-title"><h1>AI 自動營運公司總部</h1><p>老闆不在線，AI 公司仍持續 24/7 自動營運。</p></header>
    ${aiCoHero()}
    <section class="ai-co-employees">
      ${main.map(e=>aiCoEmployeeCard(e,e.id==='trader')).join('')}
    </section>
    <div class="ai-co-tags">
      ${agents.filter(a=>['research','backtest','writer'].includes(a.id)).map(a=>`<span>${a.code} ${a.name}<b>${a.status}</b></span>`).join('')}
    </div>
    <section class="ai-co-bottom-grid">
      ${aiCoWatchlistPanel()}
      ${aiCoDistribution()}
      ${aiCoPerformance()}
      ${aiCoApprovalPanel()}
      ${aiCoMeetingPanel()}
    </section>
  </div>`;
}

function bindAICompanyPage(){
  document.querySelectorAll('[data-ai-co-tab]').forEach(btn=>{
    btn.onclick=()=>{AI_COMPANY_VIEW=btn.dataset.aiCoTab||'overview';go('aiCompany');};
  });
  const clock=document.getElementById('aiCoClock');
  if(clock) clock.textContent=aiCoNow();
}
