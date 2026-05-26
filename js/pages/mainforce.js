function vMainforce(){
  const loading=phase6Ensure('mainforce'); if(loading) return loading;
  const source=typeof phase6LatestRows==='function'
    ? phase6LatestRows((DATA.phase6&&DATA.phase6.mainforce)||[])
    : ((DATA.phase6&&DATA.phase6.mainforce)||[]);
  const rows=source.filter(r=>{
    const info=(typeof stockKnownInfo==='function')?stockKnownInfo(r.symbol):{};
    const vol=Number(info&&info.vol);
    return !(Number.isFinite(vol) && vol>0 && vol<=1000);
  });
  if(!rows.length) return emptyPhase6('主力行為尚無資料','請執行 jobs/mainforce_detector.py 產生洗盤、誘多、出貨與回測成功訊號。');
  const types=[
    {key:'高檔爆量出貨',tone:'danger',hint:'高檔長上影或爆量不續強，優先看風險控管。'},
    {key:'假突破誘多',tone:'warn',hint:'突破後無法站穩或快速跌回，等待重新站回突破價。'},
    {key:'突破後回測成功',tone:'good',hint:'突破後回測守住，偏向續強觀察。'}
  ];
  const bucket=t=>rows.filter(r=>String(r.behavior_type||'').includes(t));
  const compactReason=(r)=>{
    const ev=String(r.evidence||'').replace(/\s+/g,' ').trim();
    return ev || r.suggested_action || '等待下一根 K 棒確認。';
  };
  const col=t=>{
    const list=bucket(t.key);
    return `<section class="force-column ${t.tone}">
      <div class="force-column-head">
        <div><h3>${esc(t.key)}</h3><p>${esc(t.hint)}</p></div>
        <b>${list.length}</b>
      </div>
      <div class="force-stock-list">
        ${list.length?list.slice(0,18).map(r=>`<div class="force-stock-row" data-stock="${esc(r.symbol)}">
          <div class="force-stock-top">
            <b>${esc(r.symbol)} ${esc(r.name||'')}</b>
            <span>${r.confidence_score??'—'}</span>
          </div>
          <div class="force-stock-meta">
            <span>${esc(r.date||'')}</span>
            <span>${esc(r.risk_level||'觀察')}</span>
            <span>${esc(r.suggested_action||'觀察')}</span>
          </div>
          <p>${esc(compactReason(r))}</p>
        </div>`).join(''):'<div class="force-empty">目前沒有符合股票</div>'}
      </div>
    </section>`;
  };
  const shown=types.reduce((sum,t)=>sum+bucket(t.key).length,0);
  return `<div class="hero-card phase6-hero">
    <div><div class="eyebrow">MAIN FORCE</div><h2>主力行為偵測</h2><p>只保留三個最重要的操盤訊號，方便快速掃描風險與機會。</p></div>
    <div class="hero-metrics"><b>${shown}</b><span>三大訊號</span><b>${rows.length}</b><span>全部偵測</span></div>
  </div>
  <div class="force-board">${types.map(col).join('')}</div>`;
}
