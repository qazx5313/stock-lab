function patternState(){
  DATA.patternUi=DATA.patternUi||{q:'',type:'all',min:'0',sort:'confidence',view:'cards',selected:''};
  return DATA.patternUi;
}

function patternKind(type=''){
  const t=String(type||'');
  if(/假突破|M頭|頭肩頂|出貨|風險/.test(t)) return 'risk';
  if(/回測|支撐/.test(t)) return 'support';
  if(/突破|放量/.test(t)) return 'breakout';
  if(/W底|頭肩底|圓底/.test(t)) return 'reverse';
  if(/高檔|壓力/.test(t)) return 'high';
  return 'neutral';
}

function patternLabel(type=''){
  return String(type||'型態訊號').replace(/_/g,' ');
}

function patternNum(v){
  const n=Number(v);
  return Number.isFinite(n)?n:'';
}

function patternDate(v){
  const s=String(v||'').slice(0,10);
  return s || '—';
}

function patternStock(row){
  const sym=String(row&&row.symbol||'').trim();
  const info=(typeof stockKnownInfo==='function')?stockKnownInfo(sym):{};
  return {
    c:sym,
    n:row.name || info.n || sym,
    px:Number.isFinite(Number(info.px))?Number(info.px):patternNum(row.breakout_price)||patternNum(row.resistance)||patternNum(row.support),
    dp:Number(info.dp),
    chg:Number(info.chg),
    vol:Number(info.vol),
    amount:Number(info.amount),
    theme:info.theme || info.t || '—',
    market:info.market || ''
  };
}

function patternLiquidityOk(row){
  const s=row&&row._stock||{};
  const vol=Number(s.vol);
  if(Number.isFinite(vol) && vol>0 && vol<1000) return false;
  return true;
}

function patternRows(){
  return ((DATA.phase6&&DATA.phase6.patterns)||[])
    .map((r,i)=>({...r,_idx:i,_kind:patternKind(r.pattern_type),_stock:patternStock(r)}))
    .filter(patternLiquidityOk);
}

function patternFilterRows(rows){
  const st=patternState();
  const q=String(st.q||'').trim().toLowerCase();
  const min=Number(st.min)||0;
  let out=rows.filter(r=>{
    if(st.type && st.type!=='all' && String(r.pattern_type)!==String(st.type)) return false;
    if(Number(r.confidence_score||0)<min) return false;
    if(q){
      const hay=[r.symbol,r.name,r.pattern_type,r.reason,r.risk_note,r._stock&&r._stock.theme].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
  out.sort((a,b)=>{
    if(st.sort==='date') return String(b.date||'').localeCompare(String(a.date||'')) || Number(b.confidence_score||0)-Number(a.confidence_score||0);
    if(st.sort==='symbol') return String(a.symbol||'').localeCompare(String(b.symbol||''));
    if(st.sort==='risk') return (a._kind==='risk'?-1:1) - (b._kind==='risk'?-1:1) || Number(b.confidence_score||0)-Number(a.confidence_score||0);
    return Number(b.confidence_score||0)-Number(a.confidence_score||0);
  });
  return out;
}

function patternStats(rows){
  return [
    {k:'all',label:'今日型態訊號',value:rows.length,tone:'blue'},
    {k:'breakout',label:'放量突破',value:rows.filter(r=>r._kind==='breakout').length,tone:'green'},
    {k:'risk',label:'反轉風險',value:rows.filter(r=>r._kind==='risk').length,tone:'red'},
    {k:'high',label:'高信心訊號',value:rows.filter(r=>Number(r.confidence_score||0)>=80).length,tone:'purple'},
    {k:'near',label:'接近突破',value:rows.filter(r=>/接近|整理|三角|箱型/.test(String(r.pattern_type||'')+String(r.reason||''))).length,tone:'orange'},
    {k:'support',label:'回測支撐',value:rows.filter(r=>r._kind==='support').length,tone:'teal'}
  ];
}

function patternStatCard(s){
  const icons={all:'波',breakout:'突',risk:'險',high:'信',near:'靶',support:'守'};
  return `<div class="pattern-stat pattern-${s.tone}">
    <span>${icons[s.k]||'型'}</span>
    <div><small>${esc(s.label)}</small><b>${s.value}</b></div>
  </div>`;
}

function patternTypes(rows){
  const map=new Map();
  rows.forEach(r=>map.set(String(r.pattern_type||'未分類'),(map.get(String(r.pattern_type||'未分類'))||0)+1));
  return [...map.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));
}

function patternReason(row){
  return row.reason || `${patternLabel(row.pattern_type)}，信心分數 ${Number(row.confidence_score||0)}。`;
}

function patternCard(row,selected){
  const s=row._stock||{};
  const kind=row._kind;
  return `<article class="pattern-card ${selected?'active':''}" data-pattern-select="${esc(row.symbol)}">
    <div class="pattern-card-head">
      <div><b>${esc(row.symbol)}</b> <strong>${esc(s.n||row.name||'')}</strong></div>
      <span class="pattern-badge ${kind}">${esc(patternLabel(row.pattern_type))}</span>
      <em>信心 ${Number(row.confidence_score||0)}</em>
    </div>
    <div class="pattern-levels">
      <div><span>支撐</span><b>${fmtPx(row.support)}</b></div>
      <div><span>突破</span><b>${fmtPx(row.breakout_price||row.resistance)}</b></div>
      <div><span>停損</span><b>${fmtPx(row.stop_loss)}</b></div>
      <div><span>目標</span><b>${fmtPx(row.target_price)}</b></div>
    </div>
    <div class="pattern-card-foot">
      <span>${esc(patternReason(row))}</span>
      <button type="button" data-pattern-select="${esc(row.symbol)}">查看詳情</button>
    </div>
  </article>`;
}

function patternTable(rows){
  return `<div class="card table-card pattern-table"><table><thead><tr>
    <th>股票</th><th>型態</th><th>信心</th><th>支撐</th><th>突破</th><th>停損</th><th>目標</th><th>原因</th>
  </tr></thead><tbody>
    ${rows.map(r=>`<tr data-pattern-select="${esc(r.symbol)}">
      <td><b>${esc(r.symbol)}</b> ${esc(r._stock.n||r.name||'')}</td>
      <td><span class="pattern-badge ${r._kind}">${esc(patternLabel(r.pattern_type))}</span></td>
      <td class="num">${Number(r.confidence_score||0)}</td>
      <td>${fmtPx(r.support)}</td>
      <td>${fmtPx(r.breakout_price||r.resistance)}</td>
      <td>${fmtPx(r.stop_loss)}</td>
      <td>${fmtPx(r.target_price)}</td>
      <td>${esc(patternReason(r))}</td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

function patternMiniChart(row){
  const support=patternNum(row.support)||10;
  const breakout=patternNum(row.breakout_price)||patternNum(row.resistance)||support*1.12;
  const target=patternNum(row.target_price)||breakout*1.12;
  const stop=patternNum(row.stop_loss)||support*.95;
  const min=Math.min(stop,support,breakout,target);
  const max=Math.max(stop,support,breakout,target);
  const y=v=>150-((v-min)/(max-min||1))*110;
  const pts=[
    [22,y(support*.98)],[70,y(support*1.02)],[118,y(support*.99)],[166,y((support+breakout)/2)],
    [214,y(breakout*.98)],[262,y(breakout*1.02)],[310,y(target*.92)],[358,y(target)]
  ].map(p=>p.join(',')).join(' ');
  return `<svg class="pattern-mini-chart" viewBox="0 0 380 170" role="img" aria-label="型態區間示意">
    <defs><linearGradient id="patternArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#60A5FA" stop-opacity=".22"/><stop offset="1" stop-color="#60A5FA" stop-opacity="0"/></linearGradient></defs>
    <path d="M20 150H360M20 114H360M20 78H360M20 42H360" stroke="#E2E8F0" stroke-width="1"/>
    <line x1="20" x2="360" y1="${y(breakout)}" y2="${y(breakout)}" stroke="#2563EB" stroke-dasharray="4 4"/>
    <line x1="20" x2="360" y1="${y(support)}" y2="${y(support)}" stroke="#10B981" stroke-dasharray="4 4"/>
    <polyline points="${pts}" fill="none" stroke="#16A34A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="${pts} 358,150 22,150" fill="url(#patternArea)"/>
    <text x="302" y="${Math.max(16,y(breakout)-6)}" fill="#2563EB">突破 ${fmtPx(breakout)}</text>
    <text x="302" y="${Math.min(160,y(support)+16)}" fill="#059669">支撐 ${fmtPx(support)}</text>
  </svg>`;
}

function patternDetail(row){
  if(!row) return `<aside class="pattern-detail card"><p class="muted">請選擇一筆型態訊號查看詳細內容。</p></aside>`;
  const s=row._stock||{};
  const px=Number(s.px);
  const dp=Number(s.dp);
  const amount=Number(s.amount);
  const vol=Number(s.vol);
  return `<aside class="pattern-detail card">
    <button type="button" class="pattern-close" data-pattern-clear>×</button>
    <div class="pattern-detail-head">
      <div>
        <h3>${esc(row.symbol)} ${esc(s.n||row.name||'')}</h3>
        <span class="pattern-badge ${row._kind}">${esc(patternLabel(row.pattern_type))}</span>
      </div>
      <em>信心 ${Number(row.confidence_score||0)}</em>
    </div>
    <div class="pattern-quote">
      <b class="${dcls(dp)}">${Number.isFinite(px)?fmtPx(px):fmtPx(row.breakout_price)}</b>
      <span class="${dcls(dp)}">${Number.isFinite(dp)?sgn(dp.toFixed(2))+'%':'—'}</span>
      <small>日期 ${patternDate(row.date)}</small>
      <small>成交量 ${Number.isFinite(vol)?fmtLots(vol)+' 張':'—'}</small>
      <small>成交額 ${Number.isFinite(amount)?fmtTwAmount(amount):'—'}</small>
    </div>
    <div class="pattern-tabs"><span class="active">日線</span><span>週線</span><span>月線</span></div>
    ${patternMiniChart(row)}
    <section>
      <h4>型態說明</h4>
      <p>${esc(row.reason||'此型態由近期價量結構、支撐壓力與突破位置自動辨識。')}</p>
    </section>
    <section>
      <h4>操作備註</h4>
      <ul>
        <li>支撐 ${fmtPx(row.support)}，突破觀察 ${fmtPx(row.breakout_price||row.resistance)}。</li>
        <li>若回測不破支撐，仍偏多方結構；跌破停損 ${fmtPx(row.stop_loss)} 要降風險。</li>
      </ul>
    </section>
    <section class="pattern-risk">
      <h4>風險提醒</h4>
      <p>${esc(row.risk_note||'型態訊號需搭配成交量與大盤環境確認，避免單一訊號追價。')}</p>
    </section>
    <button type="button" class="pattern-watch" data-watch-add-pattern="${esc(row.symbol)}">加入自選</button>
  </aside>`;
}

function patternStyles(){
  return `<style>
    .pattern-page{max-width:none}
    .pattern-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:18px}
    .pattern-hero .eyebrow{letter-spacing:.16em;color:#2563EB;font-weight:850;font-size:12px}
    .pattern-hero h2{font-size:34px;line-height:1.05;margin:6px 0 6px}
    .pattern-hero p{color:#53657F;margin:0}
    .pattern-help{color:#64748B;font-weight:750;font-size:13px}
    .pattern-stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin-bottom:18px}
    .pattern-stat{display:flex;align-items:center;gap:13px;border:1px solid #DCE6F4;background:#fff;border-radius:12px;padding:16px;box-shadow:0 8px 22px rgba(15,23,42,.06)}
    .pattern-stat span{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-weight:900}
    .pattern-stat small{display:block;color:#64748B;font-weight:750}
    .pattern-stat b{font-size:24px;line-height:1.1}
    .pattern-blue span{background:#EAF2FF;color:#2563EB}.pattern-green span{background:#EAFBF2;color:#16A34A}.pattern-red span{background:#FFF1F2;color:#E11D48}
    .pattern-purple span{background:#F3E8FF;color:#7C3AED}.pattern-orange span{background:#FFF7ED;color:#EA580C}.pattern-teal span{background:#ECFEFF;color:#0891B2}
    .pattern-toolbar{display:grid;grid-template-columns:1.5fr 180px 160px 170px auto;gap:12px;align-items:center;margin-bottom:18px}
    .pattern-search{display:flex;gap:8px}
    .pattern-search input,.pattern-toolbar select{height:44px;border:1px solid #D9E3F2;border-radius:10px;background:#fff;padding:0 14px;color:#0F172A;font-weight:700;width:100%}
    .pattern-search button,.pattern-view button{height:44px;border:1px solid #CFE0F7;border-radius:10px;background:#fff;color:#2563EB;font-weight:850;padding:0 14px}
    .pattern-view{display:flex;gap:8px;justify-content:flex-end}
    .pattern-view button.active{background:#2563EB;color:#fff;border-color:#2563EB}
    .pattern-layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;align-items:start}
    .pattern-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .pattern-card{border:1px solid #DCE6F4;background:#fff;border-radius:12px;padding:16px;box-shadow:0 8px 22px rgba(15,23,42,.05);cursor:pointer}
    .pattern-card.active{border-color:#2563EB;box-shadow:0 0 0 2px rgba(37,99,235,.12),0 10px 26px rgba(15,23,42,.08)}
    .pattern-card-head{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:start}
    .pattern-card-head b{color:#334155;margin-right:4px}.pattern-card-head strong{font-size:20px;color:#0F172A}.pattern-card-head em,.pattern-detail-head em{font-style:normal;color:#059669;background:#ECFDF5;border-radius:8px;padding:5px 8px;font-weight:850;font-size:12px}
    .pattern-badge{display:inline-flex;align-items:center;border-radius:8px;padding:5px 8px;font-size:12px;font-weight:850;white-space:nowrap}
    .pattern-badge.breakout{background:#DCFCE7;color:#15803D}.pattern-badge.risk{background:#FFE4E6;color:#BE123C}.pattern-badge.support{background:#E0F2FE;color:#0369A1}
    .pattern-badge.reverse{background:#F3E8FF;color:#6D28D9}.pattern-badge.high{background:#FFF7ED;color:#C2410C}.pattern-badge.neutral{background:#EFF6FF;color:#2563EB}
    .pattern-levels{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}
    .pattern-levels div{border:1px solid #E6EEF8;border-radius:9px;padding:10px;text-align:center}
    .pattern-levels span{display:block;color:#64748B;font-size:12px;font-weight:750}.pattern-levels b{font-size:15px}
    .pattern-card-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#53657F;border-top:1px solid #EAF0F8;padding-top:10px;font-size:13px}
    .pattern-card-foot button{border:1px solid #9CC0FF;background:#fff;color:#2563EB;border-radius:8px;padding:7px 12px;font-weight:850;white-space:nowrap}
    .pattern-detail{position:sticky;top:82px;padding:20px;min-height:680px}
    .pattern-close{position:absolute;right:16px;top:12px;border:0;background:transparent;font-size:22px;color:#64748B}
    .pattern-detail-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
    .pattern-detail-head h3{margin:0 0 8px;font-size:20px}
    .pattern-quote{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:16px 0}
    .pattern-quote b{font-size:30px;grid-column:1/2}.pattern-quote span{align-self:end;font-weight:850}.pattern-quote small{color:#53657F;font-weight:750}
    .pattern-tabs{display:inline-flex;background:#F1F5F9;border-radius:10px;padding:4px;margin:8px 0 10px}
    .pattern-tabs span{padding:7px 14px;border-radius:8px;color:#64748B;font-weight:850;font-size:13px}.pattern-tabs .active{background:#2563EB;color:#fff}
    .pattern-mini-chart{width:100%;height:180px;border:1px solid #E6EEF8;border-radius:12px;background:#fff;margin-bottom:14px}
    .pattern-detail section{border-top:1px solid #EAF0F8;padding-top:14px;margin-top:14px}
    .pattern-detail h4{margin:0 0 8px}.pattern-detail p,.pattern-detail li{color:#53657F;line-height:1.65}
    .pattern-risk{background:#FFF7ED;border:1px solid #FED7AA!important;border-radius:12px;padding:14px!important}
    .pattern-watch{width:100%;height:44px;border:0;border-radius:10px;background:#2563EB;color:#fff;font-weight:900;margin-top:14px}
    .pattern-table tr{cursor:pointer}
    @media(max-width:1200px){.pattern-stats{grid-template-columns:repeat(3,1fr)}.pattern-layout{grid-template-columns:1fr}.pattern-detail{position:static}.pattern-toolbar{grid-template-columns:1fr 1fr}}
    @media(max-width:760px){.pattern-stats,.pattern-list{grid-template-columns:1fr}.pattern-toolbar{grid-template-columns:1fr}.pattern-card-head{grid-template-columns:1fr}.pattern-levels{grid-template-columns:repeat(2,1fr)}}
  </style>`;
}

function vPatterns(){
  const loading=phase6Ensure('patterns'); if(loading) return loading;
  const rows=patternRows();
  if(!rows.length) return emptyPhase6('型態辨識尚無資料','請執行 jobs/compute_patterns.py 產生箱型、三角、W 底、突破與回測等型態。');
  const st=patternState();
  const filtered=patternFilterRows(rows);
  if(!st.selected || !rows.some(r=>String(r.symbol)===String(st.selected))) st.selected=(filtered[0]&&filtered[0].symbol)||(rows[0]&&rows[0].symbol)||'';
  const selected=filtered.find(r=>String(r.symbol)===String(st.selected)) || filtered[0] || rows[0];
  const types=patternTypes(rows);
  return `${patternStyles()}<div class="pattern-page">
    <div class="pattern-hero">
      <div><div class="eyebrow">PATTERN DETECTOR</div><h2>型態辨識</h2><p>自動辨識整理、突破、反轉與風險型態，提供支撐、壓力與風險備註。</p></div>
      <div class="pattern-help">使用說明</div>
    </div>
    <div class="pattern-stats">${patternStats(rows).map(patternStatCard).join('')}</div>
    <div class="pattern-toolbar">
      <div class="pattern-search">
        <input id="patternSearch" value="${esc(st.q||'')}" placeholder="搜尋股票 / 代號 / 題材 / 型態，按 Enter 搜尋">
        <button id="patternSearchBtn" type="button">搜尋</button>
      </div>
      <select id="patternType">
        <option value="all">型態：全部</option>
        ${types.map(([t,c])=>`<option value="${esc(t)}" ${st.type===t?'selected':''}>${esc(t)} · ${c}</option>`).join('')}
      </select>
      <select id="patternMin">
        ${[[0,'信心：全部'],[70,'信心：70以上'],[80,'信心：80以上'],[90,'信心：90以上']].map(([v,t])=>`<option value="${v}" ${String(st.min)===String(v)?'selected':''}>${t}</option>`).join('')}
      </select>
      <select id="patternSort">
        ${[['confidence','排序：信心最高'],['date','排序：最新'],['risk','排序：風險優先'],['symbol','排序：代號']].map(([v,t])=>`<option value="${v}" ${st.sort===v?'selected':''}>${t}</option>`).join('')}
      </select>
      <div class="pattern-view">
        <button type="button" data-pattern-view="cards" class="${st.view!=='table'?'active':''}">卡片檢視</button>
        <button type="button" data-pattern-view="table" class="${st.view==='table'?'active':''}">表格檢視</button>
      </div>
    </div>
    <div class="pattern-layout">
      <main>
        ${filtered.length?(
          st.view==='table'?patternTable(filtered):`<div class="pattern-list">${filtered.map(r=>patternCard(r,String(r.symbol)===String(selected&&selected.symbol))).join('')}</div>`
        ):`<div class="card card-pad"><h3>沒有符合條件的型態</h3><p class="muted">請調整搜尋、型態或信心門檻。</p></div>`}
      </main>
      ${patternDetail(selected)}
    </div>
  </div>`;
}

function bindPatterns(){
  const st=patternState();
  const rerender=()=>go('patterns');
  const search=document.getElementById('patternSearch');
  const applySearch=()=>{st.q=(search&&search.value||'').trim();rerender();};
  if(search){
    search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();applySearch();}};
  }
  const searchBtn=document.getElementById('patternSearchBtn');
  if(searchBtn) searchBtn.onclick=applySearch;
  const type=document.getElementById('patternType');
  if(type) type.onchange=()=>{st.type=type.value;st.selected='';rerender();};
  const min=document.getElementById('patternMin');
  if(min) min.onchange=()=>{st.min=min.value;st.selected='';rerender();};
  const sort=document.getElementById('patternSort');
  if(sort) sort.onchange=()=>{st.sort=sort.value;rerender();};
  document.querySelectorAll('[data-pattern-view]').forEach(btn=>btn.onclick=()=>{st.view=btn.dataset.patternView;rerender();});
  document.querySelectorAll('[data-pattern-select]').forEach(el=>el.onclick=e=>{
    e.stopPropagation();
    st.selected=el.dataset.patternSelect;
    rerender();
  });
  const clear=document.querySelector('[data-pattern-clear]');
  if(clear) clear.onclick=()=>{st.selected='';rerender();};
  document.querySelectorAll('[data-watch-add-pattern]').forEach(btn=>btn.onclick=async e=>{
    e.stopPropagation();
    const sym=btn.dataset.watchAddPattern;
    if(typeof addWatchStock==='function'){
      addWatchStock(sym);
      if(typeof persistWatchlist==='function') await persistWatchlist();
      btn.textContent='已加入自選';
    }
  });
}
