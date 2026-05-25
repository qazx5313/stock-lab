/* Page module: home.js */

function homeOverviewStyles(){
  return `<style>
    .market-overview-page{width:100%;max-width:none;margin:0;padding:22px clamp(22px,2.1vw,40px) 34px;color:#0b1b3a;box-sizing:border-box}
    .market-overview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:22px}
    .market-overview-title{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap}
    .market-overview-title h2{margin:0;font-size:31px;line-height:1.1;letter-spacing:0;font-weight:950;color:#061638}
    .market-overview-title span{font-size:15px;font-weight:800;color:#6b7da0;padding-bottom:4px}
    .market-overview-subtitle{margin:10px 0 0;color:#5b6e91;font-size:15px;font-weight:700}
    .market-overview-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
    .market-overview-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid #e3eaf5;background:#f6f9fe;border-radius:10px;padding:11px 14px;color:#536681;font-weight:850;white-space:nowrap}
    .market-overview-chip b{color:#e11d2f}
    .market-overview-page .market-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(260px,1fr));gap:20px;margin-bottom:22px}
    .market-overview-page .market-summary-card{border:1px solid #dbe5f2;background:linear-gradient(180deg,#fff,#fbfdff);border-radius:14px;box-shadow:0 10px 28px rgba(15,35,75,.08);padding:22px;min-height:178px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
    .market-overview-page .market-summary-top{display:flex;align-items:center;gap:10px;color:#345070;font-size:15px;font-weight:950;margin-bottom:12px}
    .market-overview-page .market-summary-icon{width:24px;height:24px;border-radius:8px;display:grid;place-items:center;color:#2563eb;background:#eef5ff;font-size:17px}
    .market-overview-page .market-summary-value{font-size:38px;line-height:1.05;font-weight:950;margin:8px 0 6px;letter-spacing:.3px}
    .market-overview-page .market-summary-diff{font-size:17px;font-weight:950;margin-bottom:15px}
    .market-overview-page .market-summary-divider{height:1px;background:#dfe7f2;margin:12px 0 13px}
    .market-overview-page .market-summary-meta{display:grid;gap:9px;margin-top:auto}
    .market-overview-page .flow-row{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#536681;font-weight:850}
    .market-overview-page .flow-row span:last-child,.market-overview-page .flow-row b{color:#274264;font-weight:950}
    .market-overview-page .fear-summary-main{display:grid;grid-template-columns:1fr 122px;gap:12px;align-items:center}
    .market-overview-page .fear-mini-meter{width:122px;height:78px;display:grid;place-items:end center}
    .market-overview-page .fear-mini-arc{width:112px;height:56px;border-radius:112px 112px 0 0;background:conic-gradient(from 270deg,#89efb3 0deg,#22c55e 56deg,#facc15 92deg,#fb923c 126deg,#ef4444 180deg,#e7edf5 180deg);position:relative;overflow:hidden}
    .market-overview-page .fear-mini-arc:after{content:"";position:absolute;left:18px;right:18px;bottom:0;height:36px;background:#fff;border-radius:80px 80px 0 0}
    .market-overview-page .fear-mini-needle{position:absolute;left:50%;bottom:0;width:42px;height:4px;border-radius:999px;background:#0f2650;transform-origin:left center;z-index:2}
    .market-overview-flow.card,.market-overview-bottom .card{border:1px solid #dbe5f2;border-radius:14px;background:#fff;box-shadow:0 10px 28px rgba(15,35,75,.08);overflow:hidden}
    .market-overview-flow .card-h,.market-overview-bottom .card-h{padding:18px 22px;border-bottom:1px solid #e8eef6}
    .market-overview-flow .card-h h3,.market-overview-bottom .card-h h3{font-size:22px}
    .market-overview-page .flow-board{display:grid;grid-template-columns:1fr 1fr;gap:0;padding:18px 22px 12px;overflow:hidden}
    .market-overview-page .flow-lane{min-width:0;overflow:hidden}
    .market-overview-page .flow-lane:first-child{padding-right:18px;border-right:1px dashed #cbd8ea}
    .market-overview-page .flow-lane:last-child{padding-left:18px}
    .market-overview-page .flow-lane-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;color:#263e62}
    .market-overview-page .flow-lane-head b{font-size:16px}
    .market-overview-page .flow-lane-head span{font-size:12px;color:#8190aa;font-weight:800}
    .market-overview-page .flow-bars{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));align-items:end;gap:10px;min-height:168px;overflow:hidden}
    .market-overview-page .flow-bar{border:0;background:transparent;display:grid;grid-template-rows:16px 112px 34px;justify-items:center;align-items:end;gap:6px;min-width:0;width:100%;height:168px;color:#183358;cursor:pointer;overflow:hidden}
    .market-overview-page .flow-bar i{width:30px;min-height:22px;max-height:112px;border-radius:8px 8px 2px 2px;align-self:end;box-shadow:inset 0 -12px 18px rgba(0,0,0,.08)}
    .market-overview-page .flow-bar.pos i{background:linear-gradient(180deg,#ff4a4f,#dc2626)}
    .market-overview-page .flow-bar.neg i{background:linear-gradient(180deg,#45d18b,#16a34a)}
    .market-overview-page .flow-pct{font-size:11.5px;font-weight:950;line-height:1.1;white-space:nowrap}
    .market-overview-page .flow-bar.pos .flow-pct{color:#dc2626}
    .market-overview-page .flow-bar.neg .flow-pct{color:#15905a}
    .market-overview-page .flow-bar b{font-size:11px;line-height:1.25;max-width:100%;min-height:34px;max-height:34px;text-align:center;overflow:hidden;color:#243b60;overflow-wrap:anywhere;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .market-overview-page .flow-note{display:flex;align-items:center;gap:14px;border-top:1px solid #e8eef6;padding:13px 22px;color:#667895;font-weight:800;font-size:12.5px;overflow:hidden}
    .market-overview-page .flow-note span{display:inline-flex;align-items:center;gap:7px;min-width:0}
    .market-overview-page .flow-dot{width:8px;height:8px;border-radius:999px;display:inline-block}
    .market-overview-page .flow-dot.red{background:#dc2626}.market-overview-page .flow-dot.green{background:#16a34a}
    .market-overview-bottom{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}
    @media (max-width:1180px){.market-overview-page .market-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.market-overview-page .flow-board{grid-template-columns:1fr}.market-overview-page .flow-lane:first-child{padding-right:0;border-right:0;border-bottom:1px dashed #cbd8ea;padding-bottom:20px}.market-overview-page .flow-lane:last-child{padding-left:0;padding-top:20px}.market-overview-bottom{grid-template-columns:1fr}}
    @media (min-width:761px){
      .topbar #pgTitle,.topbar #pgSub{visibility:hidden}
      .market-overview-head{display:block;height:0;margin:0}
      .market-overview-title{
        position:fixed;z-index:45;top:9px;left:254px;display:block;max-width:min(52vw,760px);pointer-events:none
      }
      .market-overview-title h2{display:inline;font-size:18px;line-height:1.15;letter-spacing:0}
      .market-overview-title span{display:inline;margin-left:10px;padding-bottom:0;font-size:12px;vertical-align:baseline}
      .market-overview-subtitle{
        position:fixed;z-index:45;top:32px;left:254px;max-width:min(52vw,760px);margin:0;font-size:11.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none
      }
      .market-overview-meta{
        position:fixed;z-index:45;top:11px;right:clamp(170px,17vw,275px);display:flex;align-items:center;justify-content:flex-end;gap:10px;pointer-events:none
      }
      .market-overview-chip{padding:8px 13px;border-radius:10px;font-size:13px;background:#f8fbff}
    }
    @media (min-width:761px) and (max-width:1120px){
      .market-overview-title{max-width:42vw}
      .market-overview-subtitle{display:none}
      .market-overview-meta{right:150px;gap:8px}
      .market-overview-chip{padding:7px 10px;font-size:12px}
    }
    @media (max-width:760px){.market-overview-page{padding:16px}.market-overview-head{display:block}.market-overview-meta{justify-content:flex-start;margin-top:14px}.market-overview-page .market-summary-grid{grid-template-columns:1fr}.market-overview-page .flow-board{padding:16px}.market-overview-page .flow-bars{grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.market-overview-page .flow-note{display:grid;gap:8px}}
  </style>`;
}

function vHome(){
  const m=DATA.market||{};
  return `${homeOverviewStyles()}<div class="market-overview-page dash fade stagger">
   <div class="market-overview-head">
     <div>
       <div class="market-overview-title"><h2>今日市場總覽</h2><span>Market Overview</span></div>
       <div class="market-overview-subtitle">整合即時指數、台指期、資金流向、盤後資料與技術訊號，掌握市場脈動。</div>
     </div>
     <div class="market-overview-meta">
       <span class="market-overview-chip">資料日期 <b>${DATA.meta.date}</b></span>
       <span class="market-overview-chip">最後更新 <b>${DATA.meta.updated}</b></span>
     </div>
   </div>

   <div class="market-summary-grid">
     ${marketSummaryCard('台指期',m.txFut,`<div class="flow-row"><span>時段</span><span data-live="txf-session-label">${txfSession(m.txFut)==='night'?'夜盤':'早盤'}</span></div><div class="flow-row"><span>更新</span><span data-live="txf-time">${m.txFut&&m.txFut.quote_time||'—'}</span></div>`,txfActiveChart(m.txFut))}
     ${marketSummaryCard('加權指數',m.twse,`<div class="flow-row"><span>成交金額</span><span>${m.amtTwse||'—'}</span></div>`,m.twseChart)}
     ${marketSummaryCard('櫃買指數',m.tpex,`<div class="flow-row"><span>成交金額</span><span>${m.amtTpex||'—'}</span></div>`,m.tpexChart)}
     ${fearSummaryCard()}
   </div>

   ${capitalFlowPanel()}

   <div class="market-overview-bottom">
     <div class="card">
       <div class="card-h"><h3>市場行事曆</h3><span class="tag">Macro / Earnings</span></div>
       ${marketCalendarPanel()}
     </div>
     <div class="card">
       <div class="card-h"><h3>重大公告 / 風險提醒</h3><span class="tag">News & Risk</span></div>
       ${mopsNewsPanel()}
     </div>
   </div>
  </div>`;
}
