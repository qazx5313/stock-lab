function vMainforce(){
  const loading=phase6Ensure('mainforce'); if(loading) return loading;
  const rows=(DATA.phase6&&DATA.phase6.mainforce)||[];
  if(!rows.length) return emptyPhase6('主力行為尚無資料','請執行 jobs/mainforce_detector.py 產生洗盤、誘多、出貨與回測成功訊號。');
  return `<div class="hero-card"><div><div class="eyebrow">MAIN FORCE</div><h2>主力行為偵測</h2><p>用量價、影線、突破與回測結構觀察疑似主力行為。</p></div><div class="hero-metrics"><b>${rows.length}</b><span>偵測結果</span></div></div>
  <div class="grid-2">${rows.map(r=>`<div class="card card-pad" data-stock="${esc(r.symbol)}">
    <div class="card-head"><div><h3>${esc(r.symbol)} ${esc(r.name||'')}</h3><p class="muted">${esc(r.date||'')}</p></div><span class="badge ${r.risk_level==='高'?'warm':'obs'}">${esc(r.risk_level||'觀察')}</span></div>
    <h2 style="font-size:22px;margin:6px 0">${esc(r.behavior_type)}</h2>
    <div class="split-row"><span>信心分數</span><b>${r.confidence_score??'—'}</b><span>建議</span><b>${esc(r.suggested_action||'觀察')}</b></div>
    <p class="muted" style="line-height:1.75">${esc(r.evidence||'')}</p>
  </div>`).join('')}</div>`;
}
