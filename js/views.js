/* Shared view helpers. Page renderers live in js/pages/. */
function chartPointsSvg(points,color='#22C55E'){
  let rows=(points||[]).map(p=>({p:Number(p.p),a:Number(p.a),x:Number(p.x),t:String(p.t||'')})).filter(p=>Number.isFinite(p.p));
  if(rows.length<2) return '';
  if(rows.some(p=>Number.isFinite(p.x))){
    rows=rows.filter(p=>Number.isFinite(p.x)).sort((a,b)=>a.x-b.x || a.t.localeCompare(b.t));
    const dedup=new Map();
    rows.forEach(p=>dedup.set(p.t||Number(p.x).toFixed(5),p));
    rows=[...dedup.values()];
  }
  if(rows.length<2) return '';
  const sample=rows.filter((_,i)=>i%Math.max(1,Math.floor(rows.length/180))===0).slice(-220);
  const vals=sample.map(p=>p.p);
  const min=Math.min(...vals), max=Math.max(...vals), pad=Math.max(4,(max-min)*.12), span=(max-min+pad*2)||1;
  const base=vals[0];
  const pts=sample.map((p,i)=>{
    const x=Number.isFinite(p.x)?Math.max(0,Math.min(1,p.x))*300:(i/(sample.length-1))*300;
    const y=68-((p.p-(min-pad))/span)*56;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="spark" viewBox="0 0 300 82" preserveAspectRatio="none" aria-hidden="true">
    <g stroke="#E2E8F0" stroke-width=".65" opacity=".85">
      ${[12,26,40,54,68].map(y=>`<line x1="0" y1="${y}" x2="300" y2="${y}"/>`).join('')}
      ${Array.from({length:13},(_,i)=>i*25).map(x=>`<line x1="${x}" y1="8" x2="${x}" y2="76"/>`).join('')}
    </g>
    <line x1="0" y1="${(68-((base-(min-pad))/span)*56).toFixed(1)}" x2="300" y2="${(68-((base-(min-pad))/span)*56).toFixed(1)}" stroke="#94A3B8" stroke-width=".8" stroke-dasharray="4 3"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function blankTrendSvg(){
  return `<svg class="spark" viewBox="0 0 300 82" preserveAspectRatio="none" aria-hidden="true">
    <g stroke="#E2E8F0" stroke-width=".65" opacity=".85">
      ${[12,26,40,54,68].map(y=>`<line x1="0" y1="${y}" x2="300" y2="${y}"/>`).join('')}
      ${Array.from({length:13},(_,i)=>i*25).map(x=>`<line x1="${x}" y1="8" x2="${x}" y2="76"/>`).join('')}
    </g>
  </svg>`;
}
function marketTrendSvg(o,color='#22C55E',chart=null,allowFallback=true){
  const real=chartPointsSvg(chart&&chart.points,color);
  if(real) return real;
  if(!allowFallback) return blankTrendSvg();
  const d=Number(o&&o.d);
  const pts=Number.isFinite(d)&&d<0
    ? '0,22 36,18 72,30 108,24 144,38 180,34 216,48 252,44 300,58'
    : '0,58 36,50 72,54 108,42 144,45 180,32 216,36 252,22 300,26';
  return `<svg class="spark" viewBox="0 0 300 82" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    <polyline points="0,70 300,70" fill="none" stroke="#E2E8F0" stroke-width="1"/>
  </svg>`;
}
function miniTrendForStock(s){
  const dp=Number(s&&s.dp);
  const up=Number.isFinite(dp)&&dp>=0;
  const seed=String(s&&s.c||'0').split('').reduce((a,b)=>a+Number(b||0),0);
  const base=up?[18,16,19,13,15,9,11,6]:[6,10,8,14,12,18,16,21];
  const pts=base.map((y,i)=>`${i*12},${Math.max(3,Math.min(22,y+((seed+i)%3-1)*2))}`).join(' ');
  return `<svg width="70" height="24" viewBox="0 0 72 24"><polyline points="${pts}" fill="none" stroke="${up?'#22C55E':'#EF4444'}" stroke-width="2"/></svg>`;
}
function fmtLots(v){
  const n=Number(v);
  if(!Number.isFinite(n)) return '—';
  const lots=volumeToLots(n);
  return lots.toLocaleString('en-US');
}
function volumeToLots(v){
  const n=Number(v);
  if(!Number.isFinite(n)) return NaN;
  return n>=1000?Math.round(n/1000):Math.round(n);
}
function fmtRevenue(v){
  const n=Number(v);
  if(!Number.isFinite(n)) return '—';
  return (n/100000).toLocaleString('zh-TW',{maximumFractionDigits:2})+' 億';
}
function fmtPct(v){
  const n=Number(v);
  if(!Number.isFinite(n)) return '—';
  return `${n>0?'+':''}${n.toFixed(2)}%`;
}
function fmtAmountValue(v){
  const n=Number(v);
  if(!Number.isFinite(n) || n<=0) return '—';
  return typeof fmtTwAmount==='function' ? fmtTwAmount(n) : n.toLocaleString('en-US');
}
function quoteStockCard(s,opts={}){
  const live=(!opts.noLookup && typeof stockKnownInfo==='function' && s&&s.c)?stockKnownInfo(s.c):{};
  const row={...s};
  ['px','dp','chg','change','vol','amount'].forEach(k=>{
    if(live[k]!=null && live[k]!=='' && Number.isFinite(Number(live[k]))) row[k]=live[k];
  });
  if(live.n && (!row.n || row.n===row.c || row.n==='尚無名稱')) row.n=live.n;
  if(live.market && !row.market) row.market=live.market;
  if(live.industry && !row.t && !row.theme && !row.industry) row.industry=live.industry;
  const side=String(row.market||row.m||'').toUpperCase()==='TPEX'?'櫃':'市';
  const px=Number(row.px), dp=Number(row.dp), ch=Number(row.chg||row.change);
  const vol=Number(row.vol);
  const actions=opts.actions||'';
  return `<div class="quote-card ${opts.compact?'compact':''} ${opts.hideMarketSide?'no-side':''}" data-live-row="${row.c}">
    ${opts.hideMarketSide?'':`<div class="quote-side">${side}</div>`}
    <div class="quote-main">
      <div class="quote-title lnk" data-stock="${row.c}"><span class="code">${row.c}</span> <b>${esc(row.n||row.c)}</b></div>
      <div class="quote-stats">
        <div><span>收盤價</span><b data-live-cell="px" class="num ${dcls(dp)}">${Number.isFinite(px)?fmtPx(px):'—'}</b></div>
        <div><span>漲跌</span><b data-live-cell="chg" class="num ${dcls(dp)}">${Number.isFinite(ch)?sgn(ch.toFixed(2)):'—'}</b></div>
        <div><span>漲跌幅</span><b data-live-cell="dp" class="num ${dcls(dp)}">${Number.isFinite(dp)?sgn(dp.toFixed(2))+'%':'—'}</b></div>
        <div><span>成交量(張)</span><b data-live-cell="vol" class="num">${Number.isFinite(vol)?fmtLots(vol):'—'}</b></div>
      </div>
      ${row.t||row.theme||row.industry?`<div class="quote-tags"><span class="badge">${esc(row.t||row.theme||row.industry)}</span>${row.role?`<span class="badge obs">${esc(row.role)}</span>`:''}</div>`:''}
    </div>
    ${actions?`<div class="quote-actions">${actions}</div>`:''}
  </div>`;
}
function mopsNewsPanel(){
  const news=(DATA.realNewsLoaded?DATA.news:[]).slice(0,8);
  if(!news.length) return `<div class="card-pad muted" style="font-size:13.5px">尚無真實重大公告資料。</div>`;
  const cats=['全部','澄清回應','財務數據','公司治理','重大事件'];
  const counts=Object.fromEntries(cats.map(c=>[c,c==='全部'?news.length:news.filter(n=>n.cat===c).length]));
  const dates=[...new Set(news.map(n=>n.date).filter(Boolean))].slice(0,7);
  return `<div class="mops-panel">
    <div class="mops-chips">
      ${cats.filter(c=>counts[c]).map((c,i)=>`<span class="mops-chip ${i===0?'on':''}">${c} ${counts[c]}</span>`).join('')}
    </div>
    <div class="mops-dates">
      <span class="mops-date on">今天</span>${dates.slice(1).map(d=>`<span class="mops-date">${d.slice(5).replace('-','/')}</span>`).join('')}
    </div>
    <div class="mops-list">
      ${news.map(n=>`<div class="mops-item">
        <span class="mops-label ${n.cat==='重大事件'?'bad':n.cat==='財務數據'?'good':n.cat==='公司治理'?'gov':'info'}">${esc(n.cat||'公告')}</span>
        <div><b>${esc(n.title)}</b><div class="muted code">${n.c!=='-'?`${n.c} ${n.n}`:''}　${String(n.date||'').replaceAll('-','/')} ${n.time||''}</div></div>
      </div>`).join('')}
    </div>
  </div>`;
}
function txfSession(f){
  if(window.DATA_CENTER&&DATA_CENTER.session&&DATA_CENTER.session.futuresSession){
    return DATA_CENTER.session.futuresSession(f);
  }
  const txt=String([f&&f.name,f&&f.source,f&&f.quote_time].filter(Boolean).join(' '));
  if(/-M|AfterHours|night|夜/i.test(txt)) return 'night';
  if(/-F|Regular|day|早/i.test(txt)) return 'day';
  const p=typeof taipeiNowParts==='function'?taipeiNowParts():{total:0};
  return p.total>=15*60 || p.total<8*60+45 ? 'night':'day';
}
function txfActiveChart(f){
  const sess=txfSession(f);
  const charts=DATA.market&&DATA.market.txfCharts;
  const chart=charts&&charts[sess];
  return chart&&Array.isArray(chart.points)&&chart.points.length>=2?chart:null;
}
function txFuturePanel(){
  const f=(DATA.market&&DATA.market.txFut)||{};
  const v=Number(f.v), d=Number(f.d), dp=Number(f.dp);
  const sess=txfSession(f);
  const cls=dcls(d);
  return `<div class="card-h"><h3>台指期</h3><span class="tag">TAIFEX Futures</span></div>
    <div class="card-pad">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px">
        <div style="display:flex;gap:8px;align-items:center">
          <span data-txf-session="day" class="session-tag ${sess==='day'?'on':''}">早盤</span>
          <span data-txf-session="night" class="session-tag ${sess==='night'?'on':''}">夜盤</span>
        </div>
        <span data-live="txf-time" class="muted code" style="font-size:12px">${f.quote_time||'—'}</span>
      </div>
      <div class="stat">
        <span data-live="txf-name" class="k">${f.name||'台指期'}</span>
        <span data-live="txf-price" class="v ${cls}" style="font-size:28px">${Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:2}):'—'}</span>
        <span data-live="txf-diff" class="d ${cls}">${Number.isFinite(d)?`${d>0?'+':''}${d.toLocaleString('en-US',{maximumFractionDigits:2})}${Number.isFinite(dp)?` (${dp>0?'+':''}${dp.toFixed(2)}%)`:''}`:'—'}</span>
      </div>
      <div class="flow-list" style="margin-top:16px">
        <div class="flow-row"><span>資料來源</span><span data-live="txf-source">${String(f.source||'—').replace('TAIFEX_MIS_RT','TAIFEX 即時').replace('TAIFEX_EDGE_RT_NIGHT','TAIFEX 即時').replace('TAIFEX_EDGE_RT_DAY','TAIFEX 即時')}</span></div>
        <div class="flow-row"><span>更新</span><span data-live="txf-updated">${f.updated_at?fmtDoneTime(f.updated_at):'—'}</span></div>
      </div>
    </div>`;
}
function trendMini(title,o,color){
  return `<div class="card card-pad">
    <div class="sec-title">${title}今日走勢圖</div>
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-end">
      <div><span class="muted" style="font-size:12px">收盤</span><div class="stat"><span class="v ${dcls(Number(o&&o.d))}">${Number.isFinite(Number(o&&o.v))?fmtPx(o.v):'—'}</span></div></div>
      <div class="num ${dcls(Number(o&&o.d))}" style="font-weight:800">${Number.isFinite(Number(o&&o.d))&&Number.isFinite(Number(o&&o.dp))?`${sgn(Number(o.d).toFixed(2))} (${sgn(Number(o.dp).toFixed(2))}%)`:'—'}</div>
    </div>
    ${marketTrendSvg(o,color)}
  </div>`;
}
function marketSummaryCard(title,o,extra='',chart=null){
  const d=Number(o&&o.d), dp=Number(o&&o.dp), v=Number(o&&o.v);
  const liveKey=title==='台指期'?'txf':(title==='加權指數'?'twse':(title==='櫃買指數'?'tpex':''));
  return `<div class="market-summary-card market-card" ${liveKey?`data-live-card="${liveKey}"`:''}>
    <div class="market-summary-main">
      <div style="min-width:0;flex:1">
        <div class="market-summary-label" ${liveKey?`data-live="${liveKey}-name"`:''}>${esc(title)}</div>
        <div class="market-summary-value num ${dcls(d)}" ${liveKey?`data-live="${liveKey}-price"`:''}>${Number.isFinite(v)?fmtPx(v):'—'}</div>
        <div class="market-summary-diff num ${dcls(d)}" ${liveKey?`data-live="${liveKey}-diff"`:''}>${Number.isFinite(d)?`${sgn(d.toFixed(2))}${Number.isFinite(dp)?` (${sgn(dp.toFixed(2))}%)`:''}`:'—'}</div>
      </div>
    </div>
    ${extra?`<div class="market-summary-meta">${extra}</div>`:''}
  </div>`;
}
function fearSummaryCard(){
  const m=DATA.market||{};
  const vix=Number(m.vix&&m.vix.v);
  const up=Number(m.up)||0, down=Number(m.down)||0;
  const total=Math.max(1,up+down+(Number(m.flat)||0));
  const fallback=Math.round((down/total)*100);
  const fear=Math.max(0,Math.min(100,Math.round(Number.isFinite(vix)?vix:fallback)));
  const label=fear>=70?'恐慌':fear>=55?'偏恐慌':fear>=40?'中性震盪':'偏樂觀';
  return `<div class="market-summary-card fear-summary-card">
    <div class="market-summary-main">
      <div style="min-width:0;flex:1">
        <div class="market-summary-label">恐慌指數</div>
        <div class="market-summary-value">${fear}</div>
        <div class="market-summary-diff">${label}</div>
      </div>
      <div class="fear-mini-meter" aria-label="fear ${fear}">
        <div class="fear-mini-arc"><div class="fear-mini-needle" style="transform:rotate(${Math.round(-90+fear*1.8)}deg)"></div></div>
      </div>
    </div>
    <div class="market-summary-meta">
      <div><span>來源</span><b>${Number.isFinite(vix)?'TAIFEX 波動率':'市場漲跌估算'}</b></div>
      <div><span>數值</span><b>${Number.isFinite(vix)?fmtPx(vix):`${fear}/100`}</b></div>
    </div>
  </div>`;
}
function fearIndexPanel(){
  const m=DATA.market||{};
  const vix=Number(m.vix&&m.vix.v);
  const up=Number(m.up)||0, down=Number(m.down)||0;
  const total=Math.max(1,up+down+(Number(m.flat)||0));
  const fallback=Math.round((down/total)*100);
  const fear=Math.max(0,Math.min(100,Math.round(Number.isFinite(vix)?vix:fallback)));
  const label=fear>=70?'恐慌':fear>=55?'偏恐慌':fear>=40?'中性震盪':'偏樂觀';
  return `<div class="card card-pad fear-panel">
     <div class="sec-title">恐慌指數</div>
     <div class="meter"><div class="meter-arc"><div class="needle" style="transform:rotate(${Math.round(-90+fear*1.8)}deg)"></div></div></div>
     <b style="font-size:22px">${fear}</b>
     <div style="font-size:20px;font-weight:900;margin-top:4px">${label}</div>
     ${Number.isFinite(vix)?`<div class="muted" style="font-size:12.5px;margin-top:8px">TAIFEX 波動率 ${fmtPx(vix)}</div>`:''}
   </div>`;
}
function capitalFlowRows(){
  return (DATA.themes||[]).map(t=>{
    const stocks=Array.isArray(t.stocks)?t.stocks:[];
    const live=stocks.map(s=>{
      const info=typeof stockKnownInfo==='function'?stockKnownInfo(s.c):((DATA.stockMap||{})[String(s.c||'')]||s);
      return Number(info&&info.dp);
    }).filter(Number.isFinite);
    const raw=String(t.gain||'0').replace('%','').replace('+','').trim();
    const fallback=Number(raw);
    const gainVal=live.length?live.reduce((a,b)=>a+b,0)/live.length:(Number.isFinite(fallback)?fallback:0);
    return {
      ...t,
      gainVal,
      stockCount:live.length||stocks.length||0,
      displayName:typeof themeDisplayName==='function'?themeDisplayName(t.name):t.name
    };
  }).filter(t=>t.displayName&&t.stockCount);
}
function capitalFlowBars(rows,type){
  const max=Math.max(1,...rows.map(t=>Math.abs(t.gainVal)));
  if(!rows.length) return `<div class="flow-empty">目前沒有${type==='up'?'上漲':'下跌'}類股資料</div>`;
  return rows.map(t=>{
    const positive=t.gainVal>=0;
    const h=Math.max(18,Math.round(Math.abs(t.gainVal)/max*104));
    const name=String(t.displayName||'').replace(/指數?$/,'');
    return `<button class="flow-bar ${positive?'pos':'neg'}" data-go="map" title="${esc(name)} ${t.gainVal.toFixed(2)}%">
      <span class="flow-pct">${t.gainVal>0?'+':''}${t.gainVal.toFixed(2)}%</span>
      <i style="height:${h}px"></i>
      <b>${esc(name)}</b>
    </button>`;
  }).join('');
}
function capitalFlowMarkup(){
  const rows=capitalFlowRows();
  const strong=rows.filter(t=>t.gainVal>=0).sort((a,b)=>b.gainVal-a.gainVal).slice(0,8);
  const weak=rows.filter(t=>t.gainVal<0).sort((a,b)=>a.gainVal-b.gainVal).slice(0,8);
  return `<div class="flow-board">
    <div class="flow-lane">
      <div class="flow-lane-head"><b>強勢類股</b><span>即時排序</span></div>
      <div class="flow-bars">${capitalFlowBars(strong,'up')}</div>
    </div>
    <div class="flow-lane">
      <div class="flow-lane-head"><b>弱勢類股</b><span>即時排序</span></div>
      <div class="flow-bars">${capitalFlowBars(weak,'down')}</div>
    </div>
  </div>
  <div class="flow-note">紅色代表資金偏多，綠色代表偏弱；依即時報價平均漲跌重新排序。</div>`;
}
function updateCapitalFlowDom(){
  const el=document.querySelector('[data-capital-flow]');
  if(el) el.innerHTML=capitalFlowMarkup();
}
function capitalFlowPanel(){
  return `<div class="card">
    <div class="card-h"><h3>資金流向</h3><span class="tag">即時類股強弱</span><span class="more" data-go="map">類股地圖 →</span></div>
    <div data-capital-flow>${capitalFlowMarkup()}</div>
  </div>`;
}
/* ============ 2. 股票類股地圖 ============ */
let MAP_SEL='glassfiber';
let MAP_MARKET='TWSE';
let MAP_QUERY='';
function mapMarketLabel(){
  return MAP_MARKET==='TPEX'?'上櫃':'上市';
}
function themeDisplayName(name){
  return String(name||'').replace(/^(上市|上櫃)\s*[·・]\s*/,'');
}
function mapMarketThemes(){
  const label=mapMarketLabel();
  const rows=(DATA.themes||[]).filter(t=>{
    const n=String(t.name||'').trim();
    if(label==='上市') return n.includes('上市') && !n.includes('上櫃');
    return n.includes('上櫃');
  });
  if(rows.length) return rows;
  const built=typeof buildClassThemesFromCaches==='function'?buildClassThemesFromCaches():[];
  return built.filter(t=>{
    const n=String(t.name||'').trim();
    if(label==='上市') return n.includes('上市') && !n.includes('上櫃');
    return n.includes('上櫃');
  });
}
const SEL=new Set(['今日漲幅 > 3%','站上 20MA','三大法人合計買超','今日強勢題材']);
const WATCH_KEY='stockLabWatchlist';
let WATCH_REMOTE_LOADED=false;
let WATCH_SYNC_STATUS='';
function watchKey(){
  const u=authUser&&authUser();
  return u&&u.account?`${WATCH_KEY}:${u.account}`:WATCH_KEY;
}
function watchlist(){
  return readStore(watchKey(),[]).filter(x=>x&&/^[1-9]\d{3}$/.test(String(x.c||'')));
}
function setWatchlist(rows){
  const seen=new Set();
  const clean=(rows||[]).map(x=>({
    c:String(x.c||'').trim(),
    n:String(x.n||'').trim(),
    addedAt:x.addedAt||new Date().toISOString()
  })).filter(x=>{
    if(!/^[1-9]\d{3}$/.test(x.c) || seen.has(x.c)) return false;
    seen.add(x.c);
    return true;
  });
  writeStore(watchKey(),clean);
}
function addWatchStock(stock){
  const s=stockKnownInfo(stock&&stock.c||stock);
  const rows=watchlist().filter(x=>x.c!==String(s.c));
  rows.unshift({c:String(s.c),n:s.n&&s.n!=='尚無名稱'?s.n:String(s.c),addedAt:new Date().toISOString()});
  setWatchlist(rows);
}
function removeWatchStock(sym){setWatchlist(watchlist().filter(x=>x.c!==String(sym)));}
function isWatched(sym){return watchlist().some(x=>x.c===String(sym));}
function mergeWatchlists(localRows,remoteRows){
  const out=[];
  const add=r=>{
    const c=String(r&&r.c||'').trim();
    if(!/^[1-9]\d{3}$/.test(c) || out.some(x=>x.c===c)) return;
    const info=stockKnownInfo(c);
    out.push({
      c,
      n:(r.n&&r.n!==c&&r.n!=='尚無名稱')?r.n:(info.n&&info.n!=='尚無名稱'?info.n:c),
      note:r.note||'',
      addedAt:r.addedAt||new Date().toISOString()
    });
  };
  (remoteRows||[]).forEach(add);
  (localRows||[]).forEach(add);
  return out;
}
async function syncWatchlistFromRemote(force=false){
  if(!authUser() || !authToken()) return false;
  if(WATCH_REMOTE_LOADED && !force) return true;
  const remote=await loadRemoteWatchlist();
  if(!remote) {
    WATCH_SYNC_STATUS='無法連線 Supabase，自選股暫存在此瀏覽器';
    return false;
  }
  const remoteOnly=mergeWatchlists([],remote);
  setWatchlist(remoteOnly);
  WATCH_REMOTE_LOADED=true;
  WATCH_SYNC_STATUS='已同步 Supabase 會員自選股';
  return true;
}
async function persistWatchlist(){
  if(!authUser() || !authToken()){
    WATCH_SYNC_STATUS='已儲存在此瀏覽器，登入後可同步到 Supabase';
    return false;
  }
  const ok=await saveRemoteWatchlist(watchlist());
  WATCH_REMOTE_LOADED=true;
  WATCH_SYNC_STATUS=ok?'已同步 Supabase':'同步失敗，已先保留在此瀏覽器';
  return ok;
}
function watchRows(){
  return watchlist().map(x=>{
    const info=stockKnownInfo(x.c);
    return {...x,...info,n:(info.n&&info.n!=='尚無名稱')?info.n:(x.n||x.c)};
  });
}
function rowsScreen(list){
  return list.map(s=>`<tr><td class="code lnk" data-stock="${s.c}">${s.c}</td><td><b>${s.n}</b></td>
    <td><span class="badge">${s.t}</span></td><td class="r num">${fmtPx(s.px)}</td>
    <td class="r num ${dcls(Number(s.dp))}">${isFinite(Number(s.dp))?sgn(Number(s.dp).toFixed(2))+'%':'—'}</td><td class="r num muted">${fmtScreenVol(s.vol)}</td>
    <td class="muted" style="white-space:normal;min-width:240px">${esc(screenReason(s))}</td>
    <td><button class="btn line sm" data-stock="${s.c}">分析</button></td></tr>`).join('');
}
function fmtScreenVol(v){
  if(typeof v==='string' && v.includes('張')) return v;
  const n=Number(String(v||'').replace(/,/g,''));
  return Number.isFinite(n)?`${fmtLots(n)} 張`:'—';
}
function screenReason(s){
  const base=s.reason||'成交量 >= 1000 張；站上 MA20/MA60；均線多頭排列；20MA 上升';
  const vol=fmtScreenVol(s.vol);
  return vol==='—'?base:String(base).replace(/成交量\s*[\d,]+\s*張/,'成交量 '+vol);
}

/* ============ 4. 個股分析 ============ */
function avgNums(nums){
  const xs=(nums||[]).map(Number).filter(Number.isFinite);
  return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
}
function sdNums(nums){
  const xs=(nums||[]).map(Number).filter(Number.isFinite);
  if(!xs.length) return null;
  const a=avgNums(xs);
  return Math.sqrt(xs.reduce((s,x)=>s+Math.pow(x-a,2),0)/xs.length);
}
function pctDiff(a,b){
  a=Number(a);b=Number(b);
  return Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a-b)/b*100:null;
}
function candleParts(k){
  const o=Number(k&&k.o),h=Number(k&&k.h),l=Number(k&&k.l),c=Number(k&&k.c);
  const range=Math.max(0.001,h-l);
  const body=Math.abs(c-o);
  return {o,h,l,c,range,body,upper:h-Math.max(o,c),lower:Math.min(o,c)-l,green:c>=o,red:c<o};
}
function localLows(series,start,end){
  const out=[];
  for(let i=Math.max(1,start);i<=Math.min(series.length-2,end);i++){
    const v=Number(series[i].l)||Number(series[i].c);
    const p=Number(series[i-1].l)||Number(series[i-1].c);
    const n=Number(series[i+1].l)||Number(series[i+1].c);
    if(Number.isFinite(v)&&v<=p&&v<=n) out.push({i,v,k:series[i]});
  }
  return out;
}
function localHighs(series,start,end){
  const out=[];
  for(let i=Math.max(1,start);i<=Math.min(series.length-2,end);i++){
    const v=Number(series[i].h)||Number(series[i].c);
    const p=Number(series[i-1].h)||Number(series[i-1].c);
    const n=Number(series[i+1].h)||Number(series[i+1].c);
    if(Number.isFinite(v)&&v>=p&&v>=n) out.push({i,v,k:series[i]});
  }
  return out;
}
function detectTechSignals(series,ctx){
  const closes=series.map(x=>Number(x.c));
  const highs=series.map(x=>Number(x.h));
  const lows=series.map(x=>Number(x.l));
  const vols=series.map(x=>Number(x.v||x.vol||0));
  const last=series[series.length-1]||{};
  const prev=series[series.length-2]||{};
  const lastC=candleParts(last), prevC=candleParts(prev);
  const px=ctx.px, ma5=ctx.ma5, ma10=ctx.ma10, ma20=ctx.ma20, ma60=ctx.ma60;
  const vol20=avgNums(vols.slice(-21,-1));
  const volRatio=vol20&&Number(last.v||last.vol)?Number(last.v||last.vol)/vol20:null;
  const kd=calcKDSeries(highs,lows,closes,9);
  const kNow=lastNum(kd.k), dNow=lastNum(kd.d);
  const kPrev=kd.k.length>1?kd.k[kd.k.length-2]:null;
  const dPrev=kd.d.length>1?kd.d[kd.d.length-2]:null;
  const rsi14=lastNum(calcRSISeries(closes,14));
  const macd=calcMACDSeries(closes);
  const macdLine=macd.signal||macd.macd||[];
  const oscLine=macd.hist||macd.osc||[];
  const difNow=lastNum(macd.dif), macdNow=lastNum(macdLine), oscNow=lastNum(oscLine);
  const oscPrev=oscLine.length>1?oscLine[oscLine.length-2]:null;
  const bMid=avgNums(closes.slice(-20));
  const bSd=sdNums(closes.slice(-20));
  const bUp=Number.isFinite(bMid)&&Number.isFinite(bSd)?bMid+bSd*2:null;
  const bDn=Number.isFinite(bMid)&&Number.isFinite(bSd)?bMid-bSd*2:null;
  const signals=[];
  const add=(name,kind,score,note)=>signals.push({name,kind,score,note});
  const recent=series.slice(-60);
  const baseIndex=series.length-recent.length;
  const lowsPts=localLows(series,Math.max(0,series.length-45),series.length-2);
  for(let a=0;a<lowsPts.length;a++){
    for(let b=a+1;b<lowsPts.length;b++){
      const l1=lowsPts[a], l2=lowsPts[b];
      if(l2.i-l1.i<8 || l2.i-l1.i>35) continue;
      const lowGap=Math.abs(l1.v-l2.v)/Math.max(l1.v,l2.v);
      const neck=Math.max(...series.slice(l1.i,l2.i+1).map(x=>Number(x.h)||0));
      if(lowGap<=0.08 && Number.isFinite(neck) && px>=neck*0.985){
        add('W底', 'up', 86, `雙低接近，頸線 ${fmtPx(neck)} 附近已被挑戰`);
        a=lowsPts.length; break;
      }
    }
  }
  if(recent.length>=45){
    const left=recent.slice(0,18).reduce((m,x,i)=>(Number(x.h)>m.v?{i:baseIndex+i,v:Number(x.h)}:m),{i:baseIndex,v:0});
    const bottom=recent.reduce((m,x,i)=>(Number(x.l)<m.v?{i:baseIndex+i,v:Number(x.l)}:m),{i:baseIndex,v:Infinity});
    const depth=pctDiff(left.v,bottom.v);
    const rightHigh=Math.max(...recent.slice(-12).map(x=>Number(x.h)||0));
    if(Number.isFinite(depth) && depth>=12 && depth<=45 && bottom.i>left.i+8 && rightHigh>=left.v*0.9 && px>=ma20){
      add('咖啡杯型態', 'up', 82, `回升接近杯緣 ${fmtPx(left.v)}，留意是否放量突破`);
    }
  }
  if(lastC.lower>=lastC.body*2.2 && lastC.upper<=lastC.range*.28 && ctx.above20 && ctx.ma20Up){
    add('吊人線', 'warn', 55, '上升後出現長下影小實體，隔日若跌破低點要保守');
  }
  if(prevC.red && prevC.body/prevC.range>=0.5 && lastC.green && lastC.o>=prevC.c && lastC.c<=prevC.o && px<ma20*1.03){
    add('多頭母子', 'up', 63, '下跌後小紅K收在前一根黑K實體內，留意止跌反彈');
  }
  const priorLow=Math.min(...series.slice(-22,-2).map(x=>Number(x.l)||Infinity));
  if(Number.isFinite(priorLow) && lastC.l<priorLow*.995 && lastC.c>priorLow && lastC.green){
    add('假跌破', 'up', 72, `跌破 ${fmtPx(priorLow)} 後收回，支撐有買盤防守`);
  }
  const priorHigh=Math.max(...series.slice(-22,-2).map(x=>Number(x.h)||0));
  if(Number.isFinite(priorHigh) && px>priorHigh && volRatio>=1.3){
    add('帶量突破', 'up', 78, `突破近20日高點，量能約 ${volRatio.toFixed(2)} 倍`);
  }
  if([ma5,ma10,ma20,ma60].every(Number.isFinite) && ma5>ma10 && ma10>ma20 && ma20>ma60) add('均線多頭排列','up',76,'短中長均線結構偏多');
  if([kNow,dNow,kPrev,dPrev].every(Number.isFinite) && kPrev<=dPrev && kNow>dNow && kNow<80) add('KD黃金交叉','up',66,`K ${fmtPx(kNow)} 上穿 D ${fmtPx(dNow)}`);
  if(Number.isFinite(kNow) && kNow>=80 && Number.isFinite(dNow) && dNow>=80) add('KD高檔鈍化','warn',58,'強勢延伸中，但追價風險提高');
  if(Number.isFinite(rsi14) && rsi14>=55 && rsi14<=75) add('RSI偏多','up',61,`RSI14 ${fmtPx(rsi14)}，動能健康`);
  if(Number.isFinite(rsi14) && rsi14>=80) add('RSI過熱','warn',50,`RSI14 ${fmtPx(rsi14)}，短線易震盪`);
  if([oscNow,oscPrev].every(Number.isFinite) && oscNow>0 && oscNow>oscPrev) add('MACD轉強','up',64,'OSC 位於零軸上且擴大');
  if(Number.isFinite(bUp) && px>=bUp*.98) add('布林上緣攻擊','up',67,`靠近布林上緣 ${fmtPx(bUp)}，適合觀察續航`);
  if(Number.isFinite(bDn) && px<=bDn*1.02) add('布林下緣止跌區','warn',52,`接近布林下緣 ${fmtPx(bDn)}，先看止跌確認`);
  if(Number.isFinite(volRatio) && volRatio>=1.5) add('VMA量能放大','up',62,`成交量約20日均量 ${volRatio.toFixed(2)} 倍`);
  return {
    signals:signals.sort((a,b)=>b.score-a.score).slice(0,8),
    indicator:{k:kNow,d:dNow,rsi:rsi14,dif:difNow,macd:macdNow,osc:oscNow,bUp,bMid,bDn,volRatio}
  };
}
function stockDecisionInfo(s){
  const series=Array.isArray(s&&s.series)?s.series.filter(x=>Number.isFinite(Number(x.c))):[];
  const last=series[series.length-1]||{};
  const prev=series[series.length-2]||{};
  const px=Number(s&&s.px)||Number(last.c);
  const dp=Number(s&&s.dp);
  if(!series.length || !Number.isFinite(px)){
    return {
      ready:false,title:`${s.c} ${s.n||''}`,
      summary:'尚無足夠 K 線資料，暫時無法產生操作摘要。',
      bullets:['請先確認每日資料更新已完成。'],
      metrics:[]
    };
  }
  const m5=ma(series,5), m10=ma(series,10), m20=ma(series,20), m60=ma(series,60);
  const ma5=lastNum(m5), ma10=lastNum(m10), ma20=lastNum(m20), ma60=lastNum(m60);
  const ma20Prev=series.length>24?m20[m20.length-6]:null;
  const recent=series.slice(-20);
  const recentHigh=Math.max(...recent.map(x=>Number(x.h)||Number(x.c)||0).filter(Number.isFinite));
  const recentLow=Math.min(...recent.map(x=>Number(x.l)||Number(x.c)||0).filter(Number.isFinite));
  const supports=[
    {name:'MA20 動態支撐',v:ma20},
    {name:'MA60 長線支撐',v:ma60},
    {name:'近20日低點',v:recentLow}
  ].filter(x=>Number.isFinite(x.v)&&x.v>0).sort((a,b)=>Math.abs(px-b.v)-Math.abs(px-a.v));
  const below=supports.filter(x=>x.v<=px).sort((a,b)=>b.v-a.v)[0] || supports.sort((a,b)=>Math.abs(px-a.v)-Math.abs(px-b.v))[0];
  const resistance=Number.isFinite(recentHigh)?recentHigh:null;
  const support=below&&Number.isFinite(below.v)?below.v:null;
  const defense=Number.isFinite(support)?Math.max(support*0.985,px*0.92):px*0.95;
  const reward=Number.isFinite(resistance)?Math.max(0,resistance-px):0;
  const risk=Math.max(0,px-defense);
  const rr=risk>0?reward/risk:null;
  const maBull=[ma5,ma10,ma20,ma60].every(Number.isFinite) && ma5>ma10 && ma10>ma20 && ma20>ma60;
  const above20=Number.isFinite(ma20)&&px>=ma20;
  const ma20Up=Number.isFinite(ma20)&&Number.isFinite(ma20Prev)&&ma20>=ma20Prev;
  const tech=detectTechSignals(series,{px,ma5,ma10,ma20,ma60,above20,ma20Up});
  const primary=tech.signals[0]||null;
  const body=Math.abs(Number(last.c)-Number(last.o));
  const range=Math.max(0.001,Number(last.h)-Number(last.l));
  let pattern=primary?primary.name:'整理中';
  if(!primary && Number(last.c)>Number(last.o) && body/range>=0.55) pattern='突破型態';
  else if(!primary && Number(last.c)<Number(last.o) && body/range>=0.55) pattern='轉弱K棒';
  else if(!primary && Number(last.l)<Number(prev.l) && Number(last.c)>Number(last.o)) pattern='下影支撐';
  const trend=maBull?'多頭排列':(above20&&ma20Up?'上升趨勢':(above20?'站上MA20':'跌破MA20'));
  const win=primary?primary.score:(maBull?68:(above20&&ma20Up?62:(above20?54:46)));
  let action='';
  if(primary && primary.name==='假跌破'){
    action=`假跌破收回支撐，防守 ${fmtPx(defense)}，壓力先看 ${fmtPx(resistance)}`;
  }else if(primary && primary.name==='W底'){
    action=`W底接近確認，站穩頸線後防守 ${fmtPx(defense)}，壓力先看 ${fmtPx(resistance)}`;
  }else if(primary && primary.name==='咖啡杯型態'){
    action=`咖啡杯回升段，放量突破杯緣後偏向波段續攻`;
  }else if(primary && primary.name==='吊人線'){
    action=`出現吊人線警訊，若隔日跌破低點或 MA20 轉弱先降低部位`;
  }else if(!above20 && Number.isFinite(ma20)){
    action=`等站回 MA20（${fmtPx(ma20)}）並守住 ${fmtPx(defense)} 後再評估進場`;
  }else if(Number.isFinite(resistance) && px>=resistance*0.995){
    action=`接近壓力 ${fmtPx(resistance)}，先觀察是否帶量突破`;
  }else{
    action=`站穩 ${below.name} ${fmtPx(support)}，防守 ${fmtPx(defense)}，目標壓力 ${fmtPx(resistance)}`;
  }
  const summary=`${action}。`;
  const track=maBull?'均線多頭排列，回測支撐是買點':(above20?'短線偏多，留意 MA20 是否失守':'趨勢偏弱，等重新站回均線');
  return {
    ready:true,
    trend,pattern,win,support,resistance,defense,rr,ma5,ma10,ma20,ma60,ma20Up,signals:tech.signals,indicator:tech.indicator,
    summary,
    bullets:[
      `K線型態：${pattern}，強度參考 ${win}%${primary&&primary.note?'；'+primary.note:''}`,
      `防守位 ${fmtPx(defense)}（距現價 ${fmtPct((defense-px)/px*100)}），以防守位作為停損基準`,
      `支撐 ${fmtPx(support)}（${below.name}），壓力 ${fmtPx(resistance)}（近20日高點）`,
      `趨勢：${track}`,
      `軌道：${above20?'站在 MA20 之上':'低於 MA20'}，${ma20Up?'MA20 仍上升':'MA20 未明顯上升'}`,
      `指標：KD ${fmtPx(tech.indicator.k)}/${fmtPx(tech.indicator.d)}，RSI ${fmtPx(tech.indicator.rsi)}，MACD OSC ${fmtPx(tech.indicator.osc)}`
    ],
    metrics:[
      ['現價',fmtPx(px),''],
      ['趨勢',trend,above20?'up':'down'],
      ['型態',pattern,pattern.includes('弱')?'down':'up'],
      ['支撐區',fmtPx(support),'up',below.name],
      ['壓力區',fmtPx(resistance),'down','近20日高點'],
      ['防守位',fmtPx(defense),'down',fmtPct((defense-px)/px*100)],
      ['風險報酬',rr==null?'—':rr.toFixed(2),rr!=null&&rr>=1.5?'up':'warn','目標壓力 / 防守風險']
    ]
  };
}
function stockDecisionPanel(s){
  const d=stockDecisionInfo(s);
  return `<div class="decision-card pro-decision">
    <div class="decision-head">
      <div>
        <div class="decision-title"><span class="code">${esc(s.c)}</span> ${esc(s.n||s.c)}</div>
        <div class="decision-summary">${esc(d.summary)}</div>
      </div>
      <div class="decision-actions">
        <button class="btn line sm" data-watch-symbol="${s.c}">${isWatched(s.c)?'移出自選':'加入自選'}</button>
      </div>
    </div>
    <div class="decision-body">
      <div class="decision-notes">
        ${(d.bullets||[]).map(x=>`<div>${esc(x)}</div>`).join('')}
      </div>
      <div class="decision-metrics">
        ${(d.metrics||[]).map(m=>`<div class="decision-metric">
          <span>${esc(m[0])}</span><b class="${m[2]||''}">${esc(m[1])}</b>${m[3]?`<small>${esc(m[3])}</small>`:''}
        </div>`).join('')}
      </div>
    </div>
    <div class="decision-signals">
      <b>技術型態偵測</b>
      <div>${(d.signals&&d.signals.length?d.signals:[{name:'尚無明確型態',kind:'',score:'—',note:'等待型態確認'}]).map(x=>`<span class="signal-chip ${x.kind||''}">${esc(x.name)} <small>${esc(x.score)}${Number.isFinite(Number(x.score))?'%':''}</small></span>`).join('')}</div>
    </div>
  </div>`;
}
function reportDraft(){
  const raw=reportNote();
  try{
    const d=JSON.parse(raw);
    if(d&&typeof d==='object'&&(d.content||d.picks)) return d;
  }catch(_){}
  return {content:raw||'',picks:''};
}
function reportPickRows(){
  const d=reportDraft();
  const lines=String(d.picks||'').split('\n').map(x=>x.trim()).filter(Boolean);
  if(!lines.length) return DATA.picks.slice(0,5);
  return lines.map(line=>{
    const [c,n,t,fs,...rest]=line.split(',').map(x=>x.trim());
    return {c,n:n||c,t:t||'—',fs:fs||'—',ai:rest.join(',')||'管理員手動推薦'};
  }).filter(x=>x.c);
}
/* ============ 6. AI 量化模擬操盤實驗室 ============ */
let AI_VIEW=null;
