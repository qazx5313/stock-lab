/* Page module: report.js */

function defaultReportText(){
  const m=DATA.market, topThemes=DATA.themes.slice(0,5), topPicks=DATA.picks.slice(0,5);
  return [
    `${DATA.meta.date} 盤後報告`,
    '',
    `一、今日市場總結`,
    `加權指數 ${fmtPx(m.twse.v)}，櫃買指數 ${fmtPx(m.tpex.v)}。上漲 ${m.up} 家、下跌 ${m.down} 家。`,
    '',
    `二、今日強勢題材`,
    topThemes.map((t,i)=>`${i+1}. ${t.name}：熱度 ${t.score}，${t.status}，平均 ${t.gain}`).join('\n') || '尚無題材熱度資料',
    '',
    `三、今日精選股票`,
    topPicks.map((p,i)=>`${i+1}. ${p.c} ${p.n}：綜合分 ${p.fs??p.total??'—'}，${p.ai||'尚無系統摘要'}`).join('\n') || '尚無精選股票資料',
    '',
    `四、明日觀察重點`,
    `觀察 ${topThemes.slice(0,3).map(t=>t.name).join('、')||'主流題材'} 是否延續量價強度。`
  ].join('\n');
}

function defaultReportPicksText(){
  return DATA.picks.slice(0,5).map(p=>`${p.c},${p.n},${p.t||''},${p.fs??p.total??''},${p.ai||''}`).join('\n');
}

function vReport(){
  const m=DATA.market;
  const topThemes=DATA.themes.slice(0,5);
  const topPicks=DATA.picks.slice(0,5);
  const topNews=DATA.realNewsLoaded?(DATA.news||[]).filter(n=>n.c!=='-'||n.title).slice(0,5):[];
  const risks=DATA.realRisksLoaded?(DATA.risks||[]):[];
  const sourceReal=SRC_STATUS.indexOf('✅')===0;
  const draft=reportDraft();
  const customContent=String(draft.content||'').trim();
  const customPicks=reportPickRows();
  const reportMetric=(label,value,detail,cls='')=>`<div class="metric-panel">
    <div><div class="label">${label}</div><div class="num value ${cls}">${value}</div></div>
    <div class="detail">${detail}</div>
  </div>`;
  if(customContent){
    return `<div class="fade workspace-page">
      <div class="workspace-hero compact">
        <div>
          <div class="workspace-kicker">Daily Report</div>
          <div class="workspace-title">${DATA.meta.date} 盤後報告</div>
          <div class="workspace-sub">管理員編輯版 · 可於後台調整文字與推薦股票。</div>
        </div>
      </div>
      <div class="soft-card">
        <div class="card-h"><h3>報告內容</h3><span class="tag">管理員編輯版</span></div>
        <div class="soft-card-pad" style="line-height:1.85;font-size:14.5px;white-space:pre-wrap">${esc(customContent)}</div>
      </div>
      <div class="soft-card"><div class="card-h"><h3>推薦股票</h3><span class="tag">管理員可於後台修改</span></div>
        <div class="quote-list">${customPicks.map(p=>quoteStockCard({...stockKnownInfo(p.c),...p,theme:p.t}, {actions:`<span class="badge hot">分數 ${p.fs??'—'}</span><span class="muted" style="font-size:12px">${esc(p.ai||'')}</span>`})).join('')}</div>
      </div>
    </div>`;
  }
  const note=String(draft.content||'').trim();
  return `<div class="fade workspace-page">
   <div class="workspace-hero compact">
     <div>
       <div class="workspace-kicker">Daily Report</div>
       <div class="workspace-title">${DATA.meta.date} 盤後報告</div>
       <div class="workspace-sub">${sourceReal?'資料庫盤後資料':'資料尚未完整'} · 更新時間 ${esc(DATA.meta.updated||'—')}</div>
     </div>
     <div class="workspace-actions"><button class="btn line sm" onclick="window.print()">匯出報告</button></div>
   </div>
   <div class="metric-strip">
     ${reportMetric('加權指數',fmtPx(m.twse.v),`成交金額 ${m.twse.amount?fmtTwAmount(m.twse.amount):'—'} · 上漲 ${m.twseUp??m.up} / 下跌 ${m.twseDown??m.down}`,dcls(m.twse.dp))}
     ${reportMetric('櫃買指數',fmtPx(m.tpex.v),`成交金額 ${m.tpex.amount?fmtTwAmount(m.tpex.amount):'—'} · 上漲 ${m.tpexUp??'—'} / 下跌 ${m.tpexDown??'—'}`,dcls(m.tpex.dp))}
     ${reportMetric('市場情緒 / 恐慌指數',String(m.fear??'—'),`${m.regime||'市場震盪'} · 較上日 ${Number.isFinite(Number(m.fearDelta))?sgn(Number(m.fearDelta).toFixed(0)):'—'}`,'')}
     ${reportMetric('市場觀察重點',topThemes[0]?.name||'—',`${topNews[0]?.title||'追蹤主流題材與資金流向'}`,'')}
   </div>
   <div class="two-col">
     <div class="soft-card">
       <div class="card-h"><h3>今日市場總結</h3></div>
       <div class="soft-card-pad" style="line-height:1.9;font-size:15px;color:var(--ink-2)">
         加權指數 <b class="num ${dcls(m.twse.dp)}">${fmtPx(m.twse.v)}</b>（${sgn(Number(m.twse.dp||0).toFixed(2))}%），
         櫃買指數 <b class="num ${dcls(m.tpex.dp)}">${fmtPx(m.tpex.v)}</b>（${sgn(Number(m.tpex.dp||0).toFixed(2))}%）。
         市場上漲 ${m.up} 家、下跌 ${m.down} 家。觀察 ${topThemes.slice(0,3).map(t=>t.name).join('、')||'主流題材'} 是否延續量價強度。
         ${note?`<div style="margin-top:14px;white-space:pre-wrap;color:var(--ink)">${esc(note)}</div>`:''}
       </div>
     </div>
     <div class="soft-card">
       <div class="card-h"><h3>今日強勢題材</h3><a class="more" data-view="map">查看題材地圖 →</a></div>
       <div class="tbl-wrap"><table><tbody>
         ${topThemes.length?topThemes.map((t,i)=>`<tr><td class="code">${i+1}</td><td><b>${esc(t.name)}</b></td><td class="r num up">${esc(String(t.score??'—'))}</td><td class="r">${esc(t.status||'—')}</td><td class="r num ${String(t.gain||'').includes('-')?'down':'up'}">${esc(t.gain||'—')}</td></tr>`).join(''):`<tr><td class="muted">尚無題材熱度資料</td></tr>`}
       </tbody></table></div>
     </div>
   </div>
   <div class="soft-card">
     <div class="card-h"><h3>今日精選股票</h3><span class="more">查看更多精選股票 →</span></div>
     <div class="quote-list" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));display:grid">
       ${topPicks.length?topPicks.slice(0,3).map(p=>quoteStockCard(p,{compact:true,actions:`<span class="badge hot">總分 ${p.fs??p.total??'—'}</span>`})).join(''):`<div class="muted">尚無精選股票資料</div>`}
     </div>
   </div>
   <div class="two-col">
     <div class="soft-card"><div class="card-h"><h3>今日重大公告</h3></div>
       <div class="mops-list">${topNews.length?topNews.map(n=>`<div class="mops-item"><span class="mops-label info">${esc(n.type||'公告')}</span><div><b>${esc(n.title||'—')}</b><div class="code muted">${esc(n.c&&n.c!=='-'?n.c+' '+(n.n||''):'')}　${esc(n.time||'')}</div></div></div>`).join(''):`<div class="soft-card-pad muted">尚無重大公告資料。</div>`}</div>
     </div>
     <div class="soft-card"><div class="card-h"><h3>風險提醒</h3></div>
       <div class="soft-card-pad" style="line-height:1.9">${risks.length?risks.slice(0,6).map(r=>`<div><span class="badge warm">${esc(r.type||'風險')}</span> <b>${esc(r.c)} ${esc(r.n||'')}</b></div>`).join(''):'<span class="muted">尚無真實風險清單資料。</span>'}</div>
     </div>
   </div>
  </div>`;
}

