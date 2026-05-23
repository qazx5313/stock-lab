/* Page module: home.js */

function vHome(){
  const m=DATA.market;
  return `<div class="dash fade stagger">
   <div class="dash-head">
     <div>
       <div class="dash-title"><span class="target">◎</span>今日市場總覽</div>
       <div class="hint">即時指數、台指期與資金流向整合，盤後資料完成後自動補齊法人與技術訊號。</div>
     </div>
     <div class="spacer"></div>
     <span class="badge hot">資料日 ${DATA.meta.date}</span>
     <span class="badge obs">最後更新 ${DATA.meta.updated}</span>
   </div>

   <div class="market-summary-grid">
     ${marketSummaryCard('台指期',m.txFut,`<div class="flow-row"><span>時段</span><span data-live="txf-session-label">${txfSession(m.txFut)==='night'?'夜盤':'早盤'}</span></div><div class="flow-row"><span>更新</span><span data-live="txf-time">${m.txFut&&m.txFut.quote_time||'—'}</span></div>`,txfActiveChart(m.txFut))}
     ${marketSummaryCard('加權指數',m.twse,`<div class="flow-row"><span>成交金額</span><span>${m.amtTwse||'—'}</span></div>`,m.twseChart)}
     ${marketSummaryCard('櫃買指數',m.tpex,`<div class="flow-row"><span>成交金額</span><span>${m.amtTpex||'—'}</span></div>`,m.tpexChart)}
     ${fearSummaryCard()}
   </div>

   <div class="grid" style="grid-template-columns:1fr">
     ${capitalFlowPanel()}
   </div>

   <div class="grid" style="grid-template-columns:1fr 1fr">
     <div class="card">
       <div class="card-h"><h3>市場行事曆</h3><span class="tag">Macro / Earnings</span></div>
       <div class="card-pad muted" style="font-size:13.5px;line-height:1.7">待 GitHub Actions 連接 MacroMicro 行事曆後顯示每日總經公布與美股財報時程。</div>
     </div>
     <div class="card">
       <div class="card-h"><h3>重大公告 / 風險提醒</h3><span class="tag">News & Risk</span></div>
       ${mopsNewsPanel()}
     </div>
   </div>
  </div>`;
}

