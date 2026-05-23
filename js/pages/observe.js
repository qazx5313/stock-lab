/* Page module: observe.js */

function observeCards(){
  const rows=Array.isArray(DATA.observations)?DATA.observations:[];
  if(!rows.length) return `<div class="card card-pad muted" style="font-size:13.5px">目前尚無管理員發布的觀察報告。</div>`;
  return rows.map(r=>{
    const s=stockKnownInfo(r.symbol||r.c);
    return `<div class="clean-row observe-clean-row" data-live-row="${s.c}">
      <div class="clean-symbol">
        <span class="code">${esc(s.c)}</span>
        <b class="lnk" data-stock="${s.c}">${esc(s.n||r.name||s.c)}</b>
        <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px"><span class="badge">${esc(s.industry||s.t||'—')}</span><span class="badge obs">${esc(r.category||'觀察')}</span></div>
      </div>
      <div class="clean-metrics">
        <div class="clean-metric"><span>收盤價</span><b data-live-cell="px" class="num ${dcls(Number(s.dp))}">${fmtPx(s.px)}</b></div>
        <div class="clean-metric"><span>漲跌幅</span><b data-live-cell="dp" class="num ${dcls(Number(s.dp))}">${Number.isFinite(Number(s.dp))?sgn(Number(s.dp).toFixed(2))+'%':'—'}</b></div>
        <div class="clean-metric"><span>成交量</span><b data-live-cell="vol" class="num">${Number.isFinite(Number(s.vol))?fmtLots(s.vol)+' 張':'—'}</b></div>
      </div>
      <div style="min-width:0">
        <div style="font-size:12px;color:var(--primary);font-weight:900;margin-bottom:5px">觀察重點</div>
        <div style="font-size:14px;line-height:1.75;color:var(--ink)">${esc(r.note||'管理員尚未填寫觀察備註')}</div>
        <div style="display:flex;justify-content:flex-end;margin-top:8px"><span class="badge cool">觀察中</span></div>
      </div>
    </div>`;
  }).join('');
}

function vObserve(){
  return `<div class="fade workspace-page">
    <div class="workspace-hero">
      <div class="workspace-icon" style="background:linear-gradient(135deg,#DBEAFE,#EFF6FF);color:var(--primary)">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z"/><path d="M8 8h7M8 12h7M8 16h4"/><circle cx="17" cy="17" r="3"/><path d="M19.5 19.5 22 22"/></svg>
      </div>
      <div>
        <div class="workspace-kicker">Observation</div>
        <div class="workspace-title">精選觀察報告</div>
        <div class="workspace-sub">由管理員發布的觀察股票與觀察理由，一般會員可在前台查看。</div>
      </div>
      <div class="workspace-feature-strip">
        <div class="workspace-feature"><i>★</i><div><b>專業觀點</b><span>聚焦值得追蹤的標的</span></div></div>
        <div class="workspace-feature"><i>⟳</i><div><b>即時更新</b><span>依資料庫最新內容呈現</span></div></div>
        <div class="workspace-feature"><i>盾</i><div><b>嚴選標的</b><span>避免分散到低品質訊號</span></div></div>
      </div>
    </div>
    <div class="soft-card clean-list">${observeCards()}</div>
  </div>`;
}

