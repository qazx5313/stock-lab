/* Page module: atr.js */

function atrKey(){
  const u=authUser&&authUser();
  return u&&u.account?`stockLabAtrWatch:${u.account}`:'stockLabAtrWatch';
}
function atrRows(){return readStore(atrKey(),[]);}
function setAtrRows(rows){writeStore(atrKey(),rows);}
function syncAtrRowsWithLive(){
  const rows=atrRows();
  let changed=false;
  const next=rows.map(r=>{
    const s=stockKnownInfo(r.c);
    const px=Number(s.px||r.current||r.entry);
    if(!Number.isFinite(px)) return r;
    const high=Math.max(Number(r.high||0),px,Number(r.entry||0));
    if(px!==Number(r.current)||high!==Number(r.high||0)){
      changed=true;
      return {...r,current:px,high,updatedAt:new Date().toISOString()};
    }
    return r;
  });
  if(changed) setAtrRows(next);
  return next;
}
function atrCard(r){
  const s=stockKnownInfo(r.c);
  const px=Number(s.px||r.current||r.entry||0);
  const atr=Number(r.atr||px*0.035||0);
  const stop=Number(r.stop||Number(r.entry)-atr*Number(r.stopMult||1));
  const take=Number(r.take||Number(r.entry)+atr*Number(r.takeMult||1.5));
  const trailBase=Math.max(Number(r.high||0),px,Number(r.entry||0));
  const stopByAtr=trailBase-atr*Number(r.stopMult||1);
  const movingStop=Math.max(stop,stopByAtr);
  const takeActive=trailBase>=take;
  const takeTrailByAtr=trailBase+atr*Number(r.trailAtr||0.5);
  const takeTrailByPct=trailBase*(1+Number(r.trailPct||5)/100);
  const movingTake=takeActive?Math.max(take,takeTrailByAtr,takeTrailByPct):take;
  const rr=(take-Number(r.entry))/(Number(r.entry)-stop);
  return `<div class="atr-watch-card" data-atr-row="${r.c}">
    <div class="atr-watch-head"><h3><span class="code">${r.c}</span> ${esc(s.n||r.n||r.c)}</h3><span class="badge ${r.dir==='short'?'bad':'good'}">${r.dir==='short'?'做空':'做多'} ▲</span><span class="badge obs">觀察中</span></div>
    <div class="card-pad">
      <div class="atr-tile-grid">
        <div class="atr-big-tile"><span>現價</span><b data-atr-cell="px" class="num">${fmtPx(px)}</b></div>
        <div class="atr-big-tile"><span>ATR 值</span><b class="num cool">${fmtPx(atr)}</b></div>
        <div class="atr-big-tile"><span>買入價</span><b class="num">${fmtPx(r.entry)}</b></div>
        <div class="atr-big-tile"><span>風險報酬比</span><b class="num">${Number.isFinite(rr)?`1 : ${rr.toFixed(2)}`:'—'}</b></div>
      </div>
      <div class="atr-tile-grid" style="margin-top:12px">
        <div class="atr-big-tile danger"><span>移動停損</span><b data-atr-cell="stop" class="num down">${fmtPx(movingStop)}</b><small>包含初始買入停損價；股價創高後只往上調整</small></div>
        <div class="atr-big-tile success"><span>移動停利</span><b data-atr-cell="take" class="num up">${fmtPx(movingTake)}</b><small data-atr-cell="take-note">${takeActive?'已碰到初始停利位，停利目標跟著新高上調':'尚未碰到初始停利位，目前先看初始停利'}</small></div>
        <div class="atr-big-tile"><span>追蹤最高價</span><b data-atr-cell="high" class="num">${fmtPx(trailBase)}</b><small>移動停損與停利皆依此價格往上調整</small></div>
        <div class="atr-big-tile"><span>距離現價</span><b data-atr-cell="gap" class="num">${Number.isFinite(px)&&px?fmtPct((px-movingStop)/px*100):'—'}</b><small>低於移動停損即出場觀察</small></div>
      </div>
      <div class="muted" style="font-size:12.5px;margin-top:12px">ATR 週期 ${r.period||14} · 停損 ${r.stopMult||1} 倍 · 初始停利 ${r.takeMult||1.5} 倍 · 停利啟動後用新高 + ${r.trailAtr||0.5} ATR 或 +${r.trailPct||5}% 上調目標 · 出場看移動停損，停利看上調後目標</div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn line sm" data-atr-remove="${r.c}">移除觀察</button></div>
    </div>
  </div>`;
}
function vATR(){
  const rows=syncAtrRowsWithLive();
  return `<div class="fade workspace-page">
    <div class="workspace-hero compact">
      <div class="workspace-icon" style="width:54px;height:54px;border-radius:16px">
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M3 17l6-6 4 4 7-9"/><path d="M14 6h6v6"/></svg>
      </div>
      <div>
        <div class="workspace-kicker">ATR Risk Control</div>
        <div class="workspace-title">ATR 停利停損</div>
        <div class="workspace-sub">設定買入價與 ATR 參數，追蹤移動停損與移動停利，不在此頁放走勢圖。</div>
      </div>
    </div>
    <div class="card atr-form-card">
      <h3 style="font-size:18px;margin-bottom:14px">ATR 停利停損 + 移動停利</h3>
      <div class="atr-form-grid">
        <div class="field"><label>股票代號</label><input id="atrSymbol" placeholder="2330"></div>
        <div class="field"><label>買入價</label><input id="atrEntry" type="number" step="0.01" placeholder="買入價"></div>
        <div class="field"><label>ATR 週期</label><input id="atrPeriod" type="number" value="14"></div>
        <div class="field"><label>停損倍數</label><input id="atrStopMult" type="number" step="0.1" value="1"></div>
        <div class="field"><label>目標停利倍數</label><input id="atrTakeMult" type="number" step="0.1" value="1.5"></div>
        <div class="field"><label>移動停損倍數 ATR</label><input id="atrTrailAtr" type="number" step="0.1" value="0.5"></div>
        <div class="field"><label>移動停損 %</label><input id="atrTrailPct" type="number" step="0.1" value="5"></div>
        <button class="btn" id="atrAddBtn">加入觀察</button>
      </div>
      <div id="atrMsg" class="muted" style="font-size:13px;margin-top:10px"></div>
    </div>
    <div class="atr-watch-grid">
      ${rows.length?rows.map(atrCard).join(''):`<div class="card card-pad muted" style="font-size:13.5px">尚未加入 ATR 觀察股票。</div>`}
    </div>
  </div>`;
}

