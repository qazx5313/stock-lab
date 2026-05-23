/* ============ 1. 首頁 ============ */
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
  const side=String(s.market||s.m||'').toUpperCase()==='TPEX'?'櫃':'市';
  const px=Number(s.px), dp=Number(s.dp), ch=Number(s.chg||s.change);
  const vol=Number(s.vol);
  const actions=opts.actions||'';
  return `<div class="quote-card ${opts.compact?'compact':''} ${opts.hideMarketSide?'no-side':''}" data-live-row="${s.c}">
    ${opts.hideMarketSide?'':`<div class="quote-side">${side}</div>`}
    <div class="quote-main">
      <div class="quote-title lnk" data-stock="${s.c}"><span class="code">${s.c}</span> <b>${esc(s.n||s.c)}</b></div>
      <div class="quote-stats">
        <div><span>收盤價</span><b data-live-cell="px" class="num ${dcls(dp)}">${Number.isFinite(px)?fmtPx(px):'—'}</b></div>
        <div><span>漲跌</span><b class="num ${dcls(dp)}">${Number.isFinite(ch)?sgn(ch.toFixed(2)):'—'}</b></div>
        <div><span>漲跌幅</span><b data-live-cell="dp" class="num ${dcls(dp)}">${Number.isFinite(dp)?sgn(dp.toFixed(2))+'%':'—'}</b></div>
        <div><span>成交量(張)</span><b data-live-cell="vol" class="num">${Number.isFinite(vol)?fmtLots(vol):'—'}</b></div>
      </div>
      ${s.t||s.theme||s.industry?`<div class="quote-tags"><span class="badge">${esc(s.t||s.theme||s.industry)}</span>${s.role?`<span class="badge obs">${esc(s.role)}</span>`:''}</div>`:''}
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
  return `<div class="pick-card best market-card" ${liveKey?`data-live-card="${liveKey}"`:''}>
    <div class="pick-top">
      <div style="min-width:0;flex:1">
        <div class="pick-code" ${liveKey?`data-live="${liveKey}-name"`:''}>${esc(title)}</div>
        <div class="pick-name num ${dcls(d)}" ${liveKey?`data-live="${liveKey}-price"`:''}>${Number.isFinite(v)?fmtPx(v):'—'}</div>
        <div class="num ${dcls(d)}" ${liveKey?`data-live="${liveKey}-diff"`:''} style="margin-top:8px;font-weight:800">${Number.isFinite(d)?`${sgn(d.toFixed(2))}${Number.isFinite(dp)?` (${sgn(dp.toFixed(2))}%)`:''}`:'—'}</div>
      </div>
    </div>
    ${extra?`<div class="flow-list" style="margin-top:10px">${extra}</div>`:''}
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
function capitalFlowPanel(){
  const themes=(DATA.themes||[]).slice(0,8);
  return `<div class="card">
    <div class="card-h"><h3>資金流向</h3><span class="tag">類股成交金額 · 熱度</span><span class="more" data-go="map">類股地圖 →</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>類股</th><th class="r">平均漲幅</th><th>熱度</th><th>狀態</th></tr></thead><tbody>
      ${themes.map(t=>`<tr><td><b class="lnk" data-go="map">${esc(typeof themeDisplayName==='function'?themeDisplayName(t.name):t.name)}</b><div style="font-size:11px;color:var(--ink-3);margin-top:2px">${esc(t.chain||'')}</div></td><td class="r num ${String(t.gain).startsWith('-')?'down':'up'}">${t.gain}</td><td>${scoreCell(t.score)}</td><td>${thBadge(t.status)}</td></tr>`).join('')}
    </tbody></table></div>
  </div>`;
}
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

   <div class="pick-grid">
     ${marketSummaryCard('台指期',m.txFut,`<div class="flow-row"><span>時段</span><span data-live="txf-session-label">${txfSession(m.txFut)==='night'?'夜盤':'早盤'}</span></div><div class="flow-row"><span>更新</span><span data-live="txf-time">${m.txFut&&m.txFut.quote_time||'—'}</span></div>`,txfActiveChart(m.txFut))}
     ${marketSummaryCard('加權指數',m.twse,`<div class="flow-row"><span>成交金額</span><span>${m.amtTwse||'—'}</span></div>`,m.twseChart)}
     ${marketSummaryCard('櫃買指數',m.tpex,`<div class="flow-row"><span>成交金額</span><span>${m.amtTpex||'—'}</span></div>`,m.tpexChart)}
   </div>

   <div class="grid" style="grid-template-columns:320px 1fr">
     ${fearIndexPanel()}
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

/* ============ 2. 股票類股地圖 ============ */
let MAP_SEL='glassfiber';
let MAP_MARKET='TWSE';
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
function vMap(){
  const themes=mapMarketThemes();
  const t=themes.find(x=>x.id===MAP_SEL)||themes[0];
  const stocks=(t&&Array.isArray(t.stocks))?t.stocks:[];
  const marketStocks=stocks.filter(s=>{
    const st=(DATA.stockMap||{})[String(s.c||'')];
    const mk=normMarket((st&&st.market)||s.market);
    return !mk || mk===MAP_MARKET;
  });
  if(!t){
    return `<div class="card card-pad fade"><h3>股票類股資料尚未建立</h3><p class="muted" style="margin-top:8px">請先在 GitHub Actions 跑 Daily market data pipeline，等 Build stock industry classes 完成後再重新整理。</p></div>`;
  }
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="seg" style="align-self:flex-start">
     <button class="${MAP_MARKET==='TWSE'?'on':''}" data-map-market="TWSE">上市</button>
     <button class="${MAP_MARKET==='TPEX'?'on':''}" data-map-market="TPEX">上櫃</button>
   </div>
   <div style="display:flex;gap:9px;flex-wrap:wrap">
     ${themes.map(th=>{const n=themeDisplayName(th.name);
       const id=th?th.id:'_'+n;const on=th&&th.id===MAP_SEL;
       return `<span class="chip ${on?'on':''}" data-theme="${id}">${n}${th?` · ${th.score}`:''}</span>`;}).join('')}
   </div>

   <div class="card">
     <div style="padding:20px 22px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;border-bottom:1px solid var(--border-soft)">
       <div style="flex:1;min-width:240px">
         <div style="display:flex;align-items:center;gap:10px">
           <h2 style="font-size:21px;font-weight:800;letter-spacing:-.4px">${themeDisplayName(t.name)}</h2>${thBadge(t.status)}</div>
         <p style="color:var(--ink-2);font-size:13.5px;margin-top:8px;line-height:1.55">${String(t.desc||'').replaceAll(t.name,themeDisplayName(t.name))}</p>
       </div>
       <div class="grid" style="grid-template-columns:repeat(3,auto);gap:24px">
         <div class="stat"><span class="k">熱度分數</span><span class="v" style="color:var(--primary)">${t.score}</span></div>
         <div class="stat"><span class="k">平均漲幅</span><span class="v up">${t.gain}</span></div>
         <div class="stat"><span class="k">資金狀態</span><span class="v" style="font-size:18px">${t.vol} 量增</span></div>
       </div>
     </div>
   </div>
   <div class="card">
     <div class="card-h"><h3>相關個股資料</h3><span class="tag">${marketStocks.length} 檔 · 點卡片可進個股分析</span></div>
     <div class="card-pad">
       ${marketStocks.length?`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
       ${marketStocks.map(s=>{const st=(DATA.stockMap||{})[String(s.c||'')]||{};return quoteStockCard({...s,market:normMarket(st.market||s.market)||MAP_MARKET,t:s.level||s.t||themeDisplayName(t.name),theme:themeDisplayName(t.name)}, {compact:true,hideMarketSide:true});}).join('')}
       </div>`:`<div class="muted" style="font-size:13px">此題材尚未有 Supabase 成分股資料。</div>`}
     </div>
   </div>
  </div>`;
}

/* ============ 3. 每日篩選 ============ */
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
function stockKnownInfo(sym){
  const c=String(sym||'').trim();
  const base=(DATA.stockMap&&DATA.stockMap[c])||{};
  const price=(DATA.priceMap&&DATA.priceMap[c])||{};
  const pools=[DATA.stock, ...(DATA.screen||[]), ...(DATA.picks||[])];
  (DATA.themes||[]).forEach(t=>Array.isArray(t.stocks)&&pools.push(...t.stocks));
  const hit=pools.find(s=>String(s&&s.c)===c && s.n && s.n!==c && s.n!=='尚無名稱') ||
            pools.find(s=>String(s&&s.c)===c);
  return {
    ...(hit||{}),
    c,
    n:(hit&&hit.n&&hit.n!==c&&hit.n!=='尚無名稱')?hit.n:(base.name||c),
    t:(hit&&hit.t)||(hit&&hit.level)||base.industry||'—',
    industry:base.industry||hit&&hit.industry,
    px:isFinite(Number(price.close))?Number(price.close):((hit&&isFinite(Number(hit.px)))?Number(hit.px):NaN),
    chg:isFinite(Number(price.change))?Number(price.change):((hit&&isFinite(Number(hit.chg)))?Number(hit.chg):NaN),
    dp:isFinite(Number(price.change_percent))?Number(price.change_percent):((hit&&isFinite(Number(hit.dp)))?Number(hit.dp):NaN),
    vol:isFinite(Number(price.volume))?Number(price.volume):(hit&&hit.vol),
    amount:isFinite(Number(price.amount))?Number(price.amount):(hit&&hit.amount)
  };
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
function vWatch(){
  const rows=watchRows();
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad">
     <div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap">
       <div style="flex:1;min-width:240px">
         <h3 style="font-size:18px;margin-bottom:8px">自選股清單</h3>
         <div class="muted" style="font-size:13px;line-height:1.6">${authUser()?'登入後會同步到 Supabase 會員自選股。':'請先登入，登入後自選股會同步到 Supabase。'} ${WATCH_SYNC_STATUS||''}</div>
       </div>
       <div style="display:flex;gap:8px;align-items:center">
         <input id="watchInput" placeholder="輸入股票代號" style="width:150px;padding:9px 13px;border:1px solid var(--border);border-radius:10px;font-family:var(--mono);font-size:14px;outline:none">
         <button class="btn sm" id="watchAddBtn">加入自選</button>
       </div>
     </div>
   </div>
   <div class="card">
     <div class="card-h"><h3>追蹤列表</h3><span class="tag">${rows.length} 檔 · 點分析可查看完整個股資料</span></div>
     ${rows.length?`<div class="quote-list">
       ${rows.map(s=>quoteStockCard(s,{
         actions:`<button class="btn line sm" data-stock="${s.c}">分析</button><button class="btn ghost sm" data-watch-remove="${s.c}">移除</button><span class="muted" style="font-size:12px">${String(s.addedAt||'').slice(0,10)||'—'}</span>`
       })).join('')}
     </div>`:
       `<div class="card-pad"><div class="muted" style="font-size:13.5px">目前還沒有自選股。輸入股票代號後加入，或到個股分析頁把正在看的股票加入自選。</div></div>`}
   </div>
  </div>`;
}
function vScreen(){
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad">
     <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
       <b style="font-size:15px">篩選條件</b><span class="tag" style="color:var(--ink-3);font-size:12px">成交量 >= 1000 張 · 站上 MA20/MA60 · MA5 > MA10 > MA20 > MA60 · 20MA 上升</span>
       <button class="btn sm" id="runBtn" style="margin-left:auto">重新整理</button>
     </div>
     <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
       ${['有量','有趨勢','均線結構轉強','短中期動能偏多'].map(f=>`<span class="chip on">${f}</span>`).join('')}
     </div>
   </div>
   <div class="card">
     <div class="card-h"><h3>篩選結果</h3><span class="tag"><b id="resCnt">${DATA.screen.length}</b> 檔符合 · 依量能與趨勢排序</span>
       <span class="more">匯出 CSV →</span></div>
     <div class="tbl-wrap"><table><thead><tr><th>代號</th><th>名稱</th><th>題材</th><th class="r">收盤</th><th class="r">漲跌</th>
       <th class="r">成交量</th><th>符合條件</th><th>操作</th></tr></thead>
       <tbody id="resBody">${rowsScreen(DATA.screen)}</tbody></table></div>
   </div>
  </div>`;
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
function vStock(){
  const known=stockKnownInfo(DATA.stock&&DATA.stock.c);
  const s={...DATA.stock,...known,
    n:(known.n&&known.n!==known.c)?known.n:DATA.stock.n,
    series:DATA.stock.series,
    inst:DATA.stock.inst, margin:DATA.stock.margin, foreignCost:DATA.stock.foreignCost,
    revenue:DATA.stock.revenue, ann:DATA.stock.ann, role:DATA.stock.role||known.t||known.industry,
    theme:DATA.stock.theme||known.t, industry:DATA.stock.industry||known.industry,
    market:DATA.stock.market||known.market
  };
  const fc=s.foreignCost||{};
  const revenue=Array.isArray(s.revenue)?s.revenue:[];
  const latestRevenue=revenue[0]||null;
  const dp=Number(s.dp);
  const chg=Number(s.chg);
  const vol=Number(s.vol);
  const headCls=dcls(dp);
  const headArrow=Number.isFinite(dp)?(dp>=0?'▲':'▼'):'';
  const fcRows=[
    ['外資推估成本',fc.cost,''],
    ['站穩起飛價 ×1.04',fc.launch,'cool'],
    ['獲利1 ×1.20',fc.tp1,'good'],
    ['獲利2 ×1.40',fc.tp2,'warm'],
    ['獲利3 ×1.70',fc.tp3,'hot']
  ];
  const latestBar=s.series&&s.series.length?s.series[s.series.length-1]:{};
  const liveAmount=Number.isFinite(Number(s.amount))?Number(s.amount):Number(latestBar.a);
  return `<div class="fade workspace-page stock-workspace">
   <div class="card stock-hero">
     <div class="stock-identity">
       <h2><span class="code" style="font-size:20px;color:var(--ink-2)">${s.c}</span> ${esc(s.n||s.c)} <span class="star">★</span></h2>
       <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">
         <span class="badge">${esc(s.market||'—')}</span><span class="badge obs">${esc(s.industry||'—')}</span><span class="badge hot">${esc(s.theme||'—')}</span>
       </div>
       <div style="margin-top:12px;color:var(--ink-2);font-size:13px;font-weight:700">題材定位：${esc(s.role||'—')}</div>
       <div style="margin-top:8px;color:var(--ink-2);font-size:13px;font-weight:700">K 線型態：${esc((stockDecisionInfo(s).signals||[])[0]?.name||'等待確認')}</div>
     </div>
     <div class="stock-price">
       <div class="num ${headCls} value" data-stock-live="px">${fmtPx(s.px)}</div>
       <div class="num ${headCls}" data-stock-live="chg" style="font-size:15px;font-weight:900;margin-top:6px">
         ${headArrow} ${Number.isFinite(chg)?sgn(chg.toFixed(2)):''}${Number.isFinite(dp)?`（${sgn(dp.toFixed(2))}%）`:''}
       </div>
       <div style="font-size:12.5px;color:var(--ink-2);font-weight:800;margin-top:8px">成交量　<span data-stock-live="vol">${Number.isFinite(vol)?fmtLots(vol)+' 張':'—'}</span></div>
       <div style="font-size:12px;color:var(--ink-3);font-weight:800;margin-top:4px">更新時間　${esc(DATA.meta.realtimeUpdated||DATA.meta.updated||'—')}</div>
     </div>
     <div class="stock-search">
       <div style="display:flex;gap:8px">
         <input id="stkInput" placeholder="輸入股票代號（範例：1815）" style="flex:1;min-width:0;padding:10px 13px;border:1px solid var(--border);border-radius:10px;font-family:var(--mono);font-size:14px;outline:none">
         <button class="btn sm" id="stkSearchBtn">查詢</button>
         <button class="btn line sm" id="watchToggleBtn" data-watch-symbol="${s.c}">${isWatched(s.c)?'移出自選':'加入自選'}</button>
       </div>
       <div class="quote-mini-grid">
         ${[['開盤',latestBar.o,'px'],['最高',latestBar.h,'px'],['最低',latestBar.l,'px'],['成交值',liveAmount,'amount']].map(r=>`<div><span>${r[0]}</span><b class="num" ${r[2]==='amount'?'data-stock-live="amount"':''}>${r[2]==='amount'?fmtAmountValue(r[1]):(Number.isFinite(Number(r[1]))?fmtPx(r[1]):'—')}</b></div>`).join('')}
       </div>
     </div>
   </div>

   ${stockDecisionPanel(s)}

   <div class="card">
     <div class="card-h"><h3>TradingView 技術分析</h3><span class="tag">K 線 · 成交量 · MA5/10/20/60 · RSI/KD/MACD</span></div>
     <div class="tv-wrap">
       <div id="tvStockChart" class="tv-chart"></div>
     </div>
   </div>

   <div class="grid" style="grid-template-columns:1fr">
     <div class="card"><div class="card-h"><h3>籌碼分析</h3><span class="tag">三大法人 · 融資融券</span></div>
       <div class="tbl-wrap"><table><tbody>
       ${[['外資買賣超',s.inst.foreign],['投信買賣超',s.inst.trust],['自營商買賣超',s.inst.dealer],
          ['三大法人合計',s.inst.total],['融資餘額',s.margin.mb],['融券餘額',s.margin.sb],
          ['融資增減',s.margin.mc],['融券增減',s.margin.sc]].map(r=>
         `<tr><td class="muted">${r[0]}</td><td class="r num" style="font-weight:700;color:${(''+r[1]).includes('-')?'var(--down)':'var(--up)'}">${r[1]}</td></tr>`).join('')}
       </tbody></table></div>
       <div class="card-pad" style="border-top:1px solid var(--border-soft);font-size:12.5px;color:var(--ink-2)">${s.inst3||'尚無近期籌碼資料'}</div>
     </div>
   </div>

   <div class="card"><div class="card-h"><h3>外資推估成本</h3><span class="tag">外資買超加權均價 · 推估值</span></div>
     ${fc.ready?`<div class="card-pad">
       <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
       ${fcRows.map(r=>`<div style="background:${r[2]==='hot'?'#FFF7ED':'var(--blue-tint)'};border:1px solid ${r[2]==='hot'?'#FED7AA':'var(--blue-soft)'};border-radius:10px;padding:12px 14px">
         <div style="font-size:11px;color:var(--ink-2);font-weight:700">${r[0]}</div>
         <div class="num ${r[2]||''}" style="font-size:20px;font-weight:850;margin-top:5px">${fmtPx(r[1])}</div>
       </div>`).join('')}
       </div>
       <div style="margin-top:12px;font-size:12.5px;color:var(--ink-2);line-height:1.55">
         ${fc.note}；現價相對成本 <b class="${Number(fc.gap)>=0?'up':'down'}">${Number(fc.gap)>=0?'+':''}${fc.gap}%</b>。
       </div>
     </div>`:`<div class="card-pad muted" style="font-size:13px">目前外資買超資料不足，無法推估成本。${fc.note||''}</div>`}
   </div>

   <div class="card"><div class="card-h"><h3>營收狀況</h3><span class="tag">MOPS 月營收</span></div>
     ${latestRevenue?`<div class="card-pad">
       <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
         ${[
           ['最新月份',latestRevenue.year_month||'—',''],
           ['單月營收',fmtRevenue(latestRevenue.revenue),''],
           ['月增率',fmtPct(latestRevenue.mom_percent),Number(latestRevenue.mom_percent)>=0?'up':'down'],
           ['年增率',fmtPct(latestRevenue.yoy_percent),Number(latestRevenue.yoy_percent)>=0?'up':'down'],
           ['累計營收',fmtRevenue(latestRevenue.accumulated_revenue),''],
           ['累計年增率',fmtPct(latestRevenue.accumulated_yoy_percent),Number(latestRevenue.accumulated_yoy_percent)>=0?'up':'down']
         ].map(r=>`<div style="background:var(--blue-tint);border:1px solid var(--blue-soft);border-radius:10px;padding:12px 14px">
           <div style="font-size:11px;color:var(--ink-2);font-weight:700">${r[0]}</div>
           <div class="num ${r[2]||''}" style="font-size:18px;font-weight:850;margin-top:5px">${r[1]}</div>
         </div>`).join('')}
       </div>
       <div class="tbl-wrap" style="margin-top:14px"><table><thead><tr><th>月份</th><th class="r">營收</th><th class="r">月增</th><th class="r">年增</th><th class="r">累計年增</th></tr></thead><tbody>
         ${revenue.slice(0,6).map(r=>`<tr><td class="code">${r.year_month||'—'}</td><td class="r num">${fmtRevenue(r.revenue)}</td>
           <td class="r num ${Number(r.mom_percent)>=0?'up':'down'}">${fmtPct(r.mom_percent)}</td>
           <td class="r num ${Number(r.yoy_percent)>=0?'up':'down'}">${fmtPct(r.yoy_percent)}</td>
           <td class="r num ${Number(r.accumulated_yoy_percent)>=0?'up':'down'}">${fmtPct(r.accumulated_yoy_percent)}</td></tr>`).join('')}
       </tbody></table></div>
     </div>`:`<div class="card-pad muted" style="font-size:13px">目前還沒有此股票的 MOPS 月營收資料，請先執行每日資料更新。</div>`}
   </div>

   <div class="grid" style="grid-template-columns:1.2fr 1fr">
     <div class="card"><div class="card-h"><h3>AI 操盤判斷</h3></div>
       <div class="card-pad" style="display:flex;flex-direction:column;gap:11px">
         ${[['目前趨勢',s.trend,'up'],['技術狀態',s.tStat,''],['籌碼狀態',s.cStat,''],
            ['題材狀態',s.mStat,''],['風險提醒',s.riskStat,'warn'],['操作觀察',s.op,'']].map(r=>
           `<div style="display:flex;gap:14px;align-items:flex-start"><div style="width:74px;font-size:12px;color:var(--ink-3);font-weight:700;flex-shrink:0;padding-top:1px">${r[0]}</div>
           <div style="flex:1;font-size:13.5px;font-weight:${r[2]?'700':'500'}" class="${r[2]}">${r[1]}</div></div>`).join('')}
       </div>
     </div>
     <div class="card"><div class="card-h"><h3>公告與新聞</h3></div>
       <div style="padding:4px 0">
       ${(s.ann&&s.ann.length)?s.ann.map(a=>`<div style="display:flex;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border-soft)">
         <b class="code" style="color:var(--ink-3);flex-shrink:0">${a.d}</b><div style="font-size:13px;line-height:1.4">${a.t}</div></div>`).join(''):
         `<div class="muted" style="padding:18px 20px;font-size:13px">此股票目前沒有公開資訊觀測站公告資料。</div>`}
      </div>
    </div>
  </div>
  </div>`;
}

/* 手繪 canvas 圖表（無外部依賴，GitHub Pages 直接可用） */
/* 抓該股真實歷史，轉成 K 線格式存 DATA.stock.series */
async function loadStockSeries(sym){
  try{
    DATA.stock.c=sym;
    DATA.stock.tech=null;
    DATA.stock.ann=[];
    DATA.stock.levelText='';
    DATA.stock.inst={foreign:'—',trust:'—',dealer:'—',total:'—'};
    DATA.stock.margin={mb:'—',sb:'—',mc:'—',sc:'—'};
    DATA.stock.inst3='尚無近期籌碼資料';
    DATA.stock.foreignCost={ready:false,note:''};
    DATA.stock.revenue=[];
    const rows = await sbGet(
      `daily_prices?select=date,open,high,low,close,volume,amount&symbol=eq.${sym}`+
      `&order=date.asc`, 5000);
    if(Array.isArray(rows) && rows.length>=5){
      DATA.stock.series = normalizeStockSeries(rows.map(r=>({
        o:Number(r.open)||Number(r.close)||0,
        h:Number(r.high)||Number(r.close)||0,
        l:Number(r.low)||Number(r.close)||0,
        c:Number(r.close)||0,
        v:Number(r.volume)||0,
        a:Number(r.amount)||0,
        d:String(r.date).slice(0,10)
      })).filter(x=>x.c>0));
      // 帶入最新報價到標頭
      const last=DATA.stock.series[DATA.stock.series.length-1];
      const prev=DATA.stock.series[DATA.stock.series.length-2];
      if(last){
        DATA.stock.px=last.c;
        DATA.stock.vol=Number(last.v)||0;
        if(prev&&prev.c){
          DATA.stock.chg=+(last.c-prev.c).toFixed(2);
          DATA.stock.dp=+(((last.c-prev.c)/prev.c)*100).toFixed(2);
        }
      }
      // 補股名
      try{
        const nm=await sbGet(`stocks?select=name,market,industry,theme_tags&symbol=eq.${sym}`,2);
        if(nm&&nm[0]){
          if(nm[0].name) DATA.stock.n=nm[0].name;
          DATA.stock.market=nm[0].market||'—';
          DATA.stock.industry=nm[0].industry||'—';
          const tags=Array.isArray(nm[0].theme_tags)?nm[0].theme_tags:[];
          DATA.stock.theme=tags[0]||DATA.stock.industry||'—';
          DATA.stock.role=tags.length?tags.join(' / '):(DATA.stock.industry||'—');
        }
      }catch(_){}
      if(!DATA.stock.n || DATA.stock.n===sym){
        try{
          const cn=await sbGet(`candidate_pool?select=name&symbol=eq.${sym}&order=date.desc&limit=1`,1);
          if(cn&&cn[0]&&cn[0].name) DATA.stock.n=cn[0].name;
        }catch(_){}
      }
      const closes=DATA.stock.series.map(x=>x.c);
      const highs=DATA.stock.series.map(x=>x.h);
      const lows=DATA.stock.series.map(x=>x.l);
      const kd=calcKDSeries(highs,lows,closes);
      const rsi=calcRSISeries(closes);
      const md=calcMACDSeries(closes);
      const lk=lastNum(kd.k), ld=lastNum(kd.d), lr=lastNum(rsi), lh=lastNum(md.hist);
      DATA.stock.tech={
        kd:kd, rsi:rsi, macd:md,
        kdText:lk==null||ld==null?'尚無足夠歷史資料':`K ${lk.toFixed(1)} · D ${ld.toFixed(1)} ${lk>=ld?'偏多':'偏弱'}`,
        kdClass:lk!=null&&ld!=null?(lk>=ld?'up':'down'):'',
        macdText:lh==null?'尚無足夠歷史資料':`${lh>=0?'柱狀為正':'柱狀為負'} ${lh.toFixed(3)}`,
        macdClass:lh!=null?(lh>=0?'up':'down'):'',
        rsiText:lr==null?'尚無足夠歷史資料':`${lr.toFixed(1)} ${lr>=70?'過熱':lr>=50?'偏強':lr<=30?'偏弱':'中性'}`,
        rsiClass:lr!=null?(lr>=50?'up':'down'):''
      };
      const recent=DATA.stock.series.slice(-20);
      if(recent.length){
        const sup=Math.min(...recent.map(x=>x.l));
        const res=Math.max(...recent.map(x=>x.h));
        DATA.stock.levelText=`近20日支撐 ${fmtPx(sup)} / 壓力 ${fmtPx(res)}`;
      }
      await loadStockRealDetails(sym);
      try{
        const rq=await sbGet(`realtime_quotes?select=symbol,name,market,quote_date,quote_time,price,change,change_percent,volume,amount,source,updated_at&symbol=eq.${sym}&order=updated_at.desc&limit=1`,1);
        if(Array.isArray(rq)&&rq.length&&typeof applyRealtimeQuotes==='function') applyRealtimeQuotes(rq,{merge:true});
        const live=stockKnownInfo(sym);
        if(Number.isFinite(Number(live.px))) DATA.stock.px=Number(live.px);
        if(Number.isFinite(Number(live.chg))) DATA.stock.chg=Number(live.chg);
        if(Number.isFinite(Number(live.dp))) DATA.stock.dp=Number(live.dp);
        if(Number.isFinite(Number(live.vol))) DATA.stock.vol=Number(live.vol);
        if(Number.isFinite(Number(live.amount))) DATA.stock.amount=Number(live.amount);
      }catch(_){}
    }else{
      DATA.stock.series=null; // 無足夠真實資料 -> 由繪圖 fallback
    }
  }catch(e){
    console.warn('個股歷史載入略過:',e);
    DATA.stock.series=null;
  }
}

async function loadStockRealDetails(sym){
  try{
    const sig=await sbGet(`daily_signals?select=technical_score,chip_score,theme_score,final_score,summary,signal_tags&symbol=eq.${sym}&order=date.desc&limit=1`,1);
    if(sig&&sig[0]){
      const tags=Array.isArray(sig[0].signal_tags)?sig[0].signal_tags.join('、'):'';
      DATA.stock.tStat=`技術分 ${sig[0].technical_score??'—'}${tags?' · '+tags:''}`;
      DATA.stock.cStat=`籌碼分 ${sig[0].chip_score??'—'}`;
      DATA.stock.mStat=`題材分 ${sig[0].theme_score??'—'}`;
      DATA.stock.trend=`綜合分 ${sig[0].final_score??'—'}`;
      DATA.stock.op=sig[0].summary||'尚無系統摘要';
    }
  }catch(e){ console.warn('個股訊號載入略過:',e); }
  try{
    const inst=await sbGet(`institutional_trades?select=date,foreign_buy_sell,investment_trust_buy_sell,dealer_buy_sell,total_buy_sell&symbol=eq.${sym}&order=date.desc&limit=160`,160);
    if(inst&&inst.length){
      const latest=inst[0];
      DATA.stock.inst={
        foreign:fmtInst(latest.foreign_buy_sell),
        trust:fmtInst(latest.investment_trust_buy_sell),
        dealer:fmtInst(latest.dealer_buy_sell),
        total:fmtInst(latest.total_buy_sell)
      };
      const recent=inst.slice(0,5);
      const sum=(arr,k)=>arr.reduce((a,r)=>a+(Number(r[k])||0),0);
      DATA.stock.inst3=`近${recent.length}筆合計：外資 ${fmtInst(sum(recent,'foreign_buy_sell'))} · 投信 ${fmtInst(sum(recent,'investment_trust_buy_sell'))} · 自營商 ${fmtInst(sum(recent,'dealer_buy_sell'))}（單位：張）`;
      DATA.stock.foreignCost=calcForeignCost(DATA.stock.series,inst);
    }
  }catch(e){ console.warn('法人籌碼載入略過:',e); }
  try{
    const mg=await sbGet(`margin_trades?select=date,margin_balance,short_balance,margin_change,short_change&symbol=eq.${sym}&order=date.desc&limit=1`,1);
    if(mg&&mg[0]){
      DATA.stock.margin={
        mb:fmtLot(mg[0].margin_balance),
        sb:fmtLot(mg[0].short_balance),
        mc:fmtSigned(mg[0].margin_change),
        sc:fmtSigned(mg[0].short_change)
      };
    }
  }catch(e){ console.warn('融資券載入略過:',e); }
  try{
    const ann=await sbGet(`mops_announcements?select=date,title,category&symbol=eq.${sym}&order=date.desc&limit=8`,8);
    DATA.stock.ann=(ann||[]).map(a=>({
      d:String(a.date||'').slice(5).replace('-','/'),
      t:[a.category,a.title].filter(Boolean).join(' · ')||'公告'
    }));
  }catch(e){ console.warn('公告載入略過:',e); DATA.stock.ann=[]; }
  try{
    const rev=await sbGet(
      `monthly_revenue?select=year_month,revenue,mom_percent,yoy_percent,accumulated_revenue,accumulated_yoy_percent&symbol=eq.${sym}&order=year_month.desc&limit=12`,
      12
    );
    DATA.stock.revenue=Array.isArray(rev)?rev:[];
  }catch(e){ console.warn('月營收載入略過:',e); DATA.stock.revenue=[]; }
}

function loadLightweightCharts(){
  if(window.LightweightCharts) return Promise.resolve();
  if(window.__lwChartsLoading) return window.__lwChartsLoading;
  window.__lwChartsLoading=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js';
    s.async=true;
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });
  return window.__lwChartsLoading;
}
function renderTradingViewStockChart(){
  const el=document.getElementById('tvStockChart');
  if(!el) return;
  const rows=(DATA.stock&&Array.isArray(DATA.stock.series)?DATA.stock.series:[]).slice(-180);
  if(rows.length<2){
    el.innerHTML='<div class="muted" style="padding:18px">此股票 K 棒資料不足，請先更新每日資料。</div>';
    return;
  }
  el.innerHTML='<canvas id="tvLiteCanvas" class="tv-canvas"></canvas>';
  drawTradingStyleCanvas(el.querySelector('#tvLiteCanvas'), rows);
  if(el.__tvResizeObserver) el.__tvResizeObserver.disconnect();
  el.__tvResizeObserver=new ResizeObserver(()=>drawTradingStyleCanvas(el.querySelector('#tvLiteCanvas'), rows));
  el.__tvResizeObserver.observe(el);
  const canvas=el.querySelector('#tvLiteCanvas');
  canvas.onmousemove=ev=>{
    const rect=canvas.getBoundingClientRect();
    drawTradingStyleCanvas(canvas, rows, {x:ev.clientX-rect.left,y:ev.clientY-rect.top});
  };
  canvas.onmouseleave=()=>drawTradingStyleCanvas(canvas, rows);
}

function calcMaRows(rows,len){
  const out=[];
  for(let i=0;i<rows.length;i++){
    if(i<len-1) continue;
    const part=rows.slice(i-len+1,i+1).map(r=>Number(r.c)).filter(Number.isFinite);
    if(part.length!==len) continue;
    out.push({time:String(rows[i].d||'').slice(0,10),value:+(part.reduce((a,b)=>a+b,0)/len).toFixed(4)});
  }
  return out;
}

function indicatorRows(rows,vals){
  return (vals||[]).map((v,i)=>({time:String(rows[i]&&rows[i].d||'').slice(0,10),value:Number(v)}))
    .filter(p=>p.time&&Number.isFinite(p.value));
}

function drawTradingStyleCanvas(canvas, rows, hover){
  if(!canvas||!rows||rows.length<2) return;
  const host=canvas.parentElement;
  const ratio=window.devicePixelRatio||1;
  const W=Math.max(620,Math.floor(host.clientWidth||1100));
  const H=940;
  canvas.style.width='100%';
  canvas.style.height=H+'px';
  canvas.width=W*ratio;
  canvas.height=H*ratio;
  const x=canvas.getContext('2d');
  x.setTransform(ratio,0,0,ratio,0,0);
  x.clearRect(0,0,W,H);
  x.fillStyle='#fff';
  x.fillRect(0,0,W,H);
  const L=14,R=66,T=34,G=10,B=34;
  const priceH=400,volH=95,macdH=130,kdH=105,rsiH=120;
  const panels=[
    {name:'price',y:T,h:priceH,label:'K 線  MA5  MA10  MA20  MA60'},
    {name:'vol',y:T+priceH+G,h:volH,label:'成交量'},
    {name:'macd',y:T+priceH+G+volH+G,h:macdH,label:'MACD 12・26・9'},
    {name:'kd',y:T+priceH+G+volH+G+macdH+G,h:kdH,label:'KD 9'},
    {name:'rsi',y:T+priceH+G+volH+G+macdH+G+kdH+G,h:rsiH,label:'RSI 9 / RSI 55'}
  ];
  const plotW=W-L-R;
  const n=rows.length;
  const bw=plotW/n;
  const X=i=>L+i*bw+bw/2;
  const closes=rows.map(r=>Number(r.c));
  const highs=rows.map(r=>Number(r.h));
  const lows=rows.map(r=>Number(r.l));
  const vols=rows.map(r=>volumeToLots(r.v)||0);
  const ma5=rows.map((_,i)=>i<4?NaN:rows.slice(i-4,i+1).reduce((a,b)=>a+Number(b.c||0),0)/5);
  const ma10=rows.map((_,i)=>i<9?NaN:rows.slice(i-9,i+1).reduce((a,b)=>a+Number(b.c||0),0)/10);
  const ma20=rows.map((_,i)=>i<19?NaN:rows.slice(i-19,i+1).reduce((a,b)=>a+Number(b.c||0),0)/20);
  const ma60=rows.map((_,i)=>i<59?NaN:rows.slice(i-59,i+1).reduce((a,b)=>a+Number(b.c||0),0)/60);
  const macd=calcMACDSeries(closes);
  const kd=calcKDSeries(highs,lows,closes,9);
  const rsi9=calcRSISeries(closes,9);
  const rsi55=calcRSISeries(closes,55);
  const hoverIdx=hover&&Number.isFinite(hover.x)?Math.max(0,Math.min(n-1,Math.round((hover.x-L-bw/2)/bw))):n-1;
  const hrow=rows[hoverIdx]||rows[n-1];
  const hv=(arr)=>{const v=Number(arr&&arr[hoverIdx]);return Number.isFinite(v)?v:null;};
  const grid=(p,steps=4)=>{
    x.strokeStyle='#EAF0F7';x.lineWidth=1;
    for(let i=0;i<=steps;i++){const yy=p.y+i*p.h/steps;x.beginPath();x.moveTo(L,yy);x.lineTo(W-R,yy);x.stroke();}
    const tickEvery=Math.max(7,Math.ceil(n/8));
    rows.forEach((r,i)=>{if(i%tickEvery&&i!==n-1)return;const xx=X(i);x.beginPath();x.moveTo(xx,p.y);x.lineTo(xx,p.y+p.h);x.stroke();});
  };
  const axis=(p,vals,fmt=v=>Number(v).toFixed(2))=>{
    const good=vals.filter(Number.isFinite);
    const mx=Math.max(...good),mn=Math.min(...good);
    const span=Math.max(.0001,mx-mn);
    const Y=v=>p.y+8+(mx-v)/span*(p.h-16);
    x.fillStyle='#475569';x.font='11px var(--mono), monospace';x.textAlign='left';
    [mx,(mx+mn)/2,mn].forEach(v=>x.fillText(fmt(v),W-R+8,Y(v)+4));
    return {Y,mx,mn,span};
  };
  panels.forEach(p=>grid(p,p.name==='price'?6:2));
  drawQuoteHeader(x,W,hrow,{
    ma5:hv(ma5),ma10:hv(ma10),ma20:hv(ma20),ma60:hv(ma60),
    vol:hv(vols),dif:hv(macd.dif),macd:hv(macd.signal),osc:hv(macd.hist),
    k:hv(kd.k),d:hv(kd.d),rsi9:hv(rsi9),rsi55:hv(rsi55)
  });
  drawPanelValueLabel(x,panels[0],[['K 線',''],['MA5',fmtInd(hv(ma5)),'#F59E0B'],['MA10',fmtInd(hv(ma10)),'#2563EB'],['MA20',fmtInd(hv(ma20)),'#7C3AED'],['MA60',fmtInd(hv(ma60)),'#64748B']]);
  drawPanelValueLabel(x,panels[1],[['成交量',Number.isFinite(hv(vols))?Math.round(hv(vols)).toLocaleString('en-US')+'張':'—','#F59E0B']]);
  drawPanelValueLabel(x,panels[2],[['MACD', ''],['DIF',fmtInd(hv(macd.dif)),'#2563EB'],['MACD',fmtInd(hv(macd.signal)),'#F59E0B'],['OSC',fmtInd(hv(macd.hist)),Number(hv(macd.hist))>=0?'#DC2626':'#16A34A']]);
  drawPanelValueLabel(x,panels[3],[['KD', ''],['K',fmtInd(hv(kd.k)),'#F59E0B'],['D',fmtInd(hv(kd.d)),'#06B6D4']]);
  drawPanelValueLabel(x,panels[4],[['RSI 相對強弱指標',''],['RSI(9)',fmtInd(hv(rsi9)),'#F59E0B'],['RSI(55)',fmtInd(hv(rsi55)),'#06B6D4']]);
  const priceVals=rows.flatMap(r=>[Number(r.h),Number(r.l)]).filter(Number.isFinite);
  const py=axis(panels[0],priceVals,v=>v.toFixed(2)).Y;
  const drawLine=(vals,color,p=panels[0],fixedAxis=null)=>{
    const clean=vals.map(Number);
    const yFn=fixedAxis||axis(p,clean, v=>Math.abs(v)>=10?v.toFixed(2):v.toFixed(3)).Y;
    x.strokeStyle=color;x.lineWidth=2;x.beginPath();let started=false;
    clean.forEach((v,i)=>{if(!Number.isFinite(v))return;const xx=X(i),yy=yFn(v);if(!started){x.moveTo(xx,yy);started=true;}else x.lineTo(xx,yy);});
    x.stroke();
    return yFn;
  };
  rows.forEach((r,i)=>{
    const o=Number(r.o),h=Number(r.h),l=Number(r.l),c=Number(r.c);
    const up=c>=o,xx=X(i),bodyW=Math.max(3,Math.min(10,bw*.58));
    x.strokeStyle=up?'#DC2626':'#16A34A';x.fillStyle=x.strokeStyle;
    x.beginPath();x.moveTo(xx,py(h));x.lineTo(xx,py(l));x.stroke();
    const y1=py(Math.max(o,c)),y2=py(Math.min(o,c));
    x.fillRect(xx-bodyW/2,y1,bodyW,Math.max(2,y2-y1));
  });
  [[ma5,'#F59E0B'],[ma10,'#2563EB'],[ma20,'#7C3AED'],[ma60,'#64748B']].forEach(([vals,color])=>{
    drawLine(vals,color,panels[0],py);
  });
  const last=rows[rows.length-1];
  if(last&&Number.isFinite(Number(last.c))){
    const yy=py(Number(last.c));x.setLineDash([2,3]);x.strokeStyle='#EF4444';x.beginPath();x.moveTo(L,yy);x.lineTo(W-R,yy);x.stroke();x.setLineDash([]);
    x.fillStyle='#DC2626';x.fillRect(W-R+4,yy-10,54,20);x.fillStyle='#fff';x.font='800 11px var(--mono), monospace';x.textAlign='center';x.fillText(Number(last.c).toFixed(2),W-R+31,yy+4);
  }
  const vp=panels[1],vmx=Math.max(...vols,1),vY=v=>vp.y+vp.h-(v/vmx)*(vp.h-18);
  rows.forEach((r,i)=>{const v=vols[i],xx=X(i),up=Number(r.c)>=Number(r.o);x.fillStyle=up?'rgba(220,38,38,.55)':'rgba(22,163,74,.55)';x.fillRect(xx-Math.max(2,bw*.32),vY(v),Math.max(2,bw*.64),vp.y+vp.h-vY(v));});
  x.fillStyle='#475569';x.textAlign='left';x.font='11px var(--mono), monospace';x.fillText(Math.round(vmx).toLocaleString('en-US'),W-R+8,vp.y+12);
  const mp=panels[2],mvals=[...macd.dif,...macd.signal,...macd.hist].map(Number).filter(Number.isFinite);
  const mMax=Math.max(...mvals.map(Math.abs),.01),mY=v=>mp.y+mp.h/2-(v/mMax)*(mp.h*.42);
  x.strokeStyle='#CBD5E1';x.beginPath();x.moveTo(L,mY(0));x.lineTo(W-R,mY(0));x.stroke();
  macd.hist.forEach((v,i)=>{v=Number(v);if(!Number.isFinite(v))return;const xx=X(i),yy=mY(v);x.fillStyle=v>=0?'rgba(220,38,38,.55)':'rgba(22,163,74,.55)';x.fillRect(xx-Math.max(2,bw*.32),Math.min(mY(0),yy),Math.max(2,bw*.64),Math.abs(mY(0)-yy));});
  drawLine(macd.dif,'#2563EB',mp,mY);drawLine(macd.signal,'#F59E0B',mp,mY);
  const kp=panels[3],kY=v=>kp.y+8+(100-v)/100*(kp.h-16);
  axis(kp,[0,50,100],v=>v.toFixed(0));drawLine(kd.k,'#F59E0B',kp,kY);drawLine(kd.d,'#06B6D4',kp,kY);
  const rp=panels[4],rY=v=>rp.y+8+(100-v)/100*(rp.h-16);
  axis(rp,[0,20,50,80,100],v=>v.toFixed(0));
  [80,50,20].forEach(v=>{
    const yy=rY(v);
    x.strokeStyle=v===50?'#CBD5E1':'#E2E8F0';
    x.setLineDash(v===50?[4,4]:[]);
    x.beginPath();x.moveTo(L,yy);x.lineTo(W-R,yy);x.stroke();
    x.setLineDash([]);
  });
  drawLine(rsi9,'#F59E0B',rp,rY);
  drawLine(rsi55,'#06B6D4',rp,rY);
  if(hover&&Number.isFinite(hover.x)){
    const xx=X(hoverIdx);
    x.setLineDash([4,4]);x.strokeStyle='#94A3B8';x.beginPath();x.moveTo(xx,T);x.lineTo(xx,H-B);x.stroke();x.setLineDash([]);
    const yy=Math.max(T,Math.min(H-B,hover.y||T));
    x.beginPath();x.moveTo(L,yy);x.lineTo(W-R,yy);x.stroke();
    const label=shortChartDate(hrow.d,true);
    x.fillStyle='#0F172A';x.fillRect(Math.max(L,Math.min(W-R-84,xx-42)),H-26,84,20);
    x.fillStyle='#fff';x.font='800 11px var(--mono), monospace';x.textAlign='center';x.fillText(label,Math.max(L+42,Math.min(W-R-42,xx)),H-12);
  }
  const tickEvery=Math.max(8,Math.ceil(n/8));
  x.fillStyle='#475569';x.font='11px system-ui';x.textAlign='center';
  rows.forEach((r,i)=>{if(i%tickEvery&&i!==n-1)return;const d=String(r.d||'');const lab=i===n-1?shortChartDate(d,true):shortChartDate(d);x.fillText(lab,X(i),H-8);});
}

function drawQuoteHeader(x,W,row,v){
  const bits=[
    ['日期',shortChartDate(row&&row.d,true),'#475569'],
    ['開',fmtPx(row&&row.o),'#475569'],
    ['高',fmtPx(row&&row.h),'#DC2626'],
    ['低',fmtPx(row&&row.l),'#16A34A'],
    ['收',fmtPx(row&&row.c),'#0F172A'],
    ['MA5',fmtInd(v.ma5),'#F59E0B'],
    ['MA10',fmtInd(v.ma10),'#2563EB'],
    ['MA20',fmtInd(v.ma20),'#7C3AED'],
    ['MA60',fmtInd(v.ma60),'#64748B'],
    ['RSI(9)',fmtInd(v.rsi9),'#F59E0B'],
    ['RSI(55)',fmtInd(v.rsi55),'#06B6D4']
  ];
  let xx=18,yy=15;
  x.font='800 12px var(--mono), monospace';x.textAlign='left';
  bits.forEach(([k,val,color])=>{
    const text=`${k} ${val}`;
    x.fillStyle=color;x.fillText(text,xx,yy);
    xx+=x.measureText(text).width+12;
    if(xx>W-220){xx=18;yy+=17;}
  });
}
function drawPanelValueLabel(x,p,items){
  let xx=22,yy=p.y+15;
  x.font='800 11px var(--mono), monospace';x.textAlign='left';
  items.forEach(([k,val,color])=>{
    const text=val?`${k} ${val}`:k;
    x.fillStyle=color||'#94A3B8';
    x.fillText(text,xx,yy);
    xx+=x.measureText(text).width+10;
  });
}
function fmtInd(v){
  return Number.isFinite(Number(v))?Number(v).toFixed(2):'—';
}

function genSeries(n,base,vol){let p=base,a=[];for(let i=0;i<n;i++){const o=p,ch=(Math.sin(i/4)+ (Math.random()-.45))*vol;
  const c=Math.max(base*.6,o+ch);const h=Math.max(o,c)*(1+Math.random()*.012);const l=Math.min(o,c)*(1-Math.random()*.012);
  a.push({o,h,l,c,v:Math.round((6000+Math.random()*9000)*(1+Math.abs(ch)/vol))});p=c;}return a;}
function normalizeStockSeries(rows){
  const byDate=new Map();
  (rows||[]).forEach(r=>{
    const d=String(r.d||'').slice(0,10);
    if(!d || !isFinite(r.c) || r.c<=0) return;
    const prev=byDate.get(d);
    if(!prev || Number(r.v||0)>=Number(prev.v||0)) byDate.set(d,{...r,d});
  });
  const sorted=[...byDate.values()].sort((a,b)=>String(a.d).localeCompare(String(b.d)));
  const out=[];
  sorted.forEach(r=>{
    const p=out[out.length-1];
    const sameBar=p&&['o','h','l','c','v'].every(k=>Number(p[k]||0)===Number(r[k]||0));
    if(!sameBar) out.push(r);
  });
  return out;
}
function calcForeignCost(series, instRows){
  const pxMap={};
  (series||[]).forEach(r=>{
    const v=Number(r.v)||0, amt=Number(r.a)||0;
    const avg=(amt>0&&v>0)?amt/v:((Number(r.o)+Number(r.h)+Number(r.l)+Number(r.c))/4);
    if(r.d&&isFinite(avg)&&avg>0) pxMap[String(r.d).slice(0,10)]={avg,close:Number(r.c)||avg};
  });
  let shares=0,costAmt=0,days=0,lastBuyDate='';
  (instRows||[]).slice().reverse().forEach(r=>{
    const d=String(r.date||'').slice(0,10);
    const buy=Number(r.foreign_buy_sell)||0;
    const px=pxMap[d];
    if(buy>0&&px){
      shares+=buy;
      costAmt+=buy*px.avg;
      days+=1;
      lastBuyDate=d;
    }
  });
  if(!shares||!costAmt){
    return {ready:false,note:'近160筆法人資料沒有可配對的外資買超日'};
  }
  const cost=costAmt/shares;
  const latest=(series||[]).length?Number(series[series.length-1].c):0;
  return {
    ready:true,
    cost:cost,
    launch:cost*1.04,
    tp1:cost*1.20,
    tp2:cost*1.40,
    tp3:cost*1.70,
    gap:latest&&cost?(((latest-cost)/cost)*100).toFixed(2):'0.00',
    note:`用近160筆資料中的 ${days} 個外資買超日推估，累計買超 ${Math.round(shares/1000).toLocaleString('en-US')} 張，最後買超日 ${lastBuyDate||'—'}`
  };
}
function ma(a,k,key='c'){return a.map((_,i)=>i<k-1?null:a.slice(i-k+1,i+1).reduce((s,x)=>s+x[key],0)/k);}
function lastNum(arr){for(let i=(arr||[]).length-1;i>=0;i--){const n=Number(arr[i]);if(isFinite(n))return n;}return null;}
function emaSeries(vals,n){
  const out=Array(vals.length).fill(null);let ema=null,buf=[];const k=2/(n+1);
  vals.forEach((v,i)=>{
    v=Number(v); if(!isFinite(v)) return;
    if(ema==null){
      buf.push(v);
      if(buf.length===n){ema=buf.reduce((a,b)=>a+b,0)/n;out[i]=ema;}
    }else{ema=v*k+ema*(1-k);out[i]=ema;}
  });
  return out;
}
function calcKDSeries(highs,lows,closes,n=9){
  const kArr=Array(closes.length).fill(null),dArr=Array(closes.length).fill(null);let k=50,d=50;
  for(let i=n-1;i<closes.length;i++){
    const hh=Math.max(...highs.slice(i-n+1,i+1)),ll=Math.min(...lows.slice(i-n+1,i+1));
    if(!isFinite(hh)||!isFinite(ll)||hh===ll) continue;
    const rsv=(closes[i]-ll)/(hh-ll)*100;
    k=2/3*k+1/3*rsv; d=2/3*d+1/3*k;
    kArr[i]=k; dArr[i]=d;
  }
  return {k:kArr,d:dArr};
}
function calcRSISeries(closes,n=14){
  return closes.map((_,i)=>{
    if(i<n) return null;
    let gain=0,loss=0;
    for(let j=i-n+1;j<=i;j++){const diff=closes[j]-closes[j-1];gain+=Math.max(diff,0);loss+=Math.max(-diff,0);}
    if(loss===0) return 100;
    const rs=(gain/n)/(loss/n);
    return 100-100/(1+rs);
  });
}
function calcMACDSeries(closes){
  const e12=emaSeries(closes,12),e26=emaSeries(closes,26);
  const dif=closes.map((_,i)=>e12[i]!=null&&e26[i]!=null?e12[i]-e26[i]:null);
  const signal=emaSeries(dif.map(v=>v==null?NaN:v),9);
  const hist=dif.map((v,i)=>v!=null&&signal[i]!=null?(v-signal[i])*2:null);
  return {dif,signal,hist};
}
function setupCanvas(id){const c=document.getElementById(id);if(!c)return null;const r=devicePixelRatio||1;
  const w=c.clientWidth,h=c.clientHeight;c.width=w*r;c.height=h*r;const x=c.getContext('2d');x.scale(r,r);return {x,w,h};}
function shortChartDate(s,withYear=false){
  const d=new Date(String(s||'').slice(0,10)+'T00:00:00');
  if(Number.isNaN(d.getTime())) return String(s||'').slice(5).replace('-','/');
  const mm=d.getMonth()+1, dd=d.getDate();
  return withYear?`${d.getFullYear()}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`:`${mm}/${dd}`;
}
function weekdayShort(s){
  const d=new Date(String(s||'').slice(0,10)+'T00:00:00');
  return Number.isNaN(d.getTime())?'':(['週日','週一','週二','週三','週四','週五','週六'][d.getDay()]||'');
}
function drawStockCharts(){
  if(document.getElementById('tvStockChart')){
    renderTradingViewStockChart();
    return;
  }
  const D=(DATA.stock&&Array.isArray(DATA.stock.series)&&DATA.stock.series.length>=5)
            ? DATA.stock.series.slice(-60)
            : [];
  const m5=ma(D,5),m10=ma(D,10),m20=ma(D,20),m60v=D.map(d=>d.c);
  const empty=(g,msg='尚無足夠真實資料')=>{if(!g)return;const{x,w,h}=g;x.fillStyle='#94A3B8';x.font='13px system-ui';x.textAlign='center';x.fillText(msg,w/2,h/2);};
  // K 線
  let g=setupCanvas('cK');if(g){const{x,w,h}=g;const L=16,R=12,T=10,B=36;
    if(!D.length){empty(g);return;}
    const all=D.flatMap(d=>[d.h,d.l]);const mx=Math.max(...all)*1.01,mn=Math.min(...all)*.99;
    const span=Math.max(.001,mx-mn), plotW=w-L-R, plotH=h-T-B;
    const Y=v=>T+(mx-v)/span*plotH;const bw=plotW/D.length;const X=i=>L+i*bw+bw/2;
    x.strokeStyle='#F1F5F9';x.lineWidth=1;
    for(let i=0;i<6;i++){const yy=T+i*plotH/5;x.beginPath();x.moveTo(L,yy);x.lineTo(w-R,yy);x.stroke();}
    const ticks=[];
    D.forEach((d,i)=>{
      const prev=D[i-1], cur=String(d.d||'');
      const monthChanged=!prev || String(prev.d||'').slice(5,7)!==cur.slice(5,7);
      if(monthChanged || i===D.length-1 || i%10===0) ticks.push({i,major:monthChanged,label:monthChanged?`${Number(cur.slice(5,7))}月`:shortChartDate(cur)});
    });
    ticks.forEach(t=>{
      const xx=X(t.i);x.strokeStyle=t.major?'#E2E8F0':'#F1F5F9';x.setLineDash(t.i===D.length-1?[4,4]:[]);
      x.beginPath();x.moveTo(xx,T);x.lineTo(xx,T+plotH);x.stroke();x.setLineDash([]);
      x.fillStyle=t.i===D.length-1?'#0F172A':'#64748B';x.font='11px system-ui';x.textAlign='center';
      if(t.i===D.length-1){
        const label=`${weekdayShort(D[t.i].d)} ${shortChartDate(D[t.i].d,true)}`.trim();
        const tw=x.measureText(label).width+14, bx=Math.min(Math.max(xx-tw/2,L),w-R-tw);
        x.fillRect(bx,h-24,tw,20);x.fillStyle='#fff';x.fillText(label,bx+tw/2,h-10);
      }else x.fillText(t.label,xx,h-12);
    });
    const last=D[D.length-1];
    if(last){
      const yy=Y(last.c);x.strokeStyle='rgba(220,38,38,.55)';x.setLineDash([3,4]);x.beginPath();x.moveTo(L,yy);x.lineTo(w-R,yy);x.stroke();x.setLineDash([]);
    }
    D.forEach((d,i)=>{const cx=X(i);const up=d.c>=d.o;x.strokeStyle=x.fillStyle=up?'#DC2626':'#16A34A';
      x.beginPath();x.moveTo(cx,Y(d.h));x.lineTo(cx,Y(d.l));x.stroke();
      const yo=Y(d.o),yc=Y(d.c);x.fillRect(cx-bw*.28,Math.min(yo,yc),Math.max(2,bw*.56),Math.max(2,Math.abs(yc-yo)));});
    const line=(arr,col)=>{x.strokeStyle=col;x.lineWidth=1.5;x.beginPath();let st=false;
      arr.forEach((v,i)=>{if(v==null)return;const cx=X(i),cy=Y(v);st?x.lineTo(cx,cy):x.moveTo(cx,cy);st=true;});x.stroke();};
    line(m5,'#F59E0B');line(m10,'#2563EB');line(m20,'#7C3AED');}
  // 量
  g=setupCanvas('cV');if(g){const{x,w,h}=g;const L=16,R=12,B=4;const mv=Math.max(...D.map(d=>d.v),1);const bw=(w-L-R)/Math.max(1,D.length);
    D.forEach((d,i)=>{const cx=L+i*bw+bw*.18,bh=d.v/mv*(h-B-4);x.fillStyle=d.c>=d.o?'rgba(220,38,38,.55)':'rgba(22,163,74,.55)';
      x.fillRect(cx,h-B-bh,Math.max(2,bw*.62),bh);});}
  // KD
  g=setupCanvas('cKD');if(g){const{x,w,h}=g;const kd=DATA.stock.tech&&DATA.stock.tech.kd;
    if(!kd){empty(g);}else [[kd.k,'#DC2626'],[kd.d,'#2563EB']].forEach(([s,c])=>{x.strokeStyle=c;x.lineWidth=1.5;x.beginPath();let started=false;
      s.slice(-60).forEach((v,i,a)=>{if(v==null)return;const cx=i/Math.max(1,a.length-1)*w,cy=h-v/100*h;started?x.lineTo(cx,cy):x.moveTo(cx,cy);started=true;});if(started)x.stroke();});}
  // MACD
  g=setupCanvas('cMD');if(g){const{x,w,h}=g;const bars=(DATA.stock.tech&&DATA.stock.tech.macd?DATA.stock.tech.macd.hist:[]).slice(-60);
    if(!bars.some(v=>v!=null)){empty(g);}else{const maxAbs=Math.max(...bars.map(v=>Math.abs(v||0)),.001);const bw=w/bars.length;bars.forEach((v,i)=>{if(v==null)return;x.fillStyle=v>=0?'rgba(220,38,38,.7)':'rgba(22,163,74,.7)';
      const bh=Math.abs(v)/maxAbs*(h/2-4);x.fillRect(i*bw,h/2-(v>0?bh:0),bw*.7,bh);});
    x.strokeStyle='#94A3B8';x.beginPath();x.moveTo(0,h/2);x.lineTo(w,h/2);x.stroke();}}
  // RSI
  g=setupCanvas('cRS');if(g){const{x,w,h}=g;const R=(DATA.stock.tech&&DATA.stock.tech.rsi?DATA.stock.tech.rsi:[]).slice(-60);
    if(!R.some(v=>v!=null)){empty(g);return;}
    x.strokeStyle='#E2E8F0';[30,70].forEach(l=>{const yy=h-l/100*h;x.beginPath();x.moveTo(0,yy);x.lineTo(w,yy);x.stroke();});
    x.strokeStyle='#2563EB';x.lineWidth=1.6;x.beginPath();let started=false;
    R.forEach((v,i)=>{if(v==null)return;const cx=i/Math.max(1,R.length-1)*w,cy=h-v/100*h;started?x.lineTo(cx,cy):x.moveTo(cx,cy);started=true;});if(started)x.stroke();}
}

/* ============ 5. 每日報告 ============ */
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

/* ============ 6. AI 量化模擬操盤實驗室 ============ */
let AI_VIEW=null;
function vAI(){
  if(AI_VIEW) return vAIDetail(AI_VIEW);
  return `<div class="fade workspace-page">
   <div class="workspace-hero">
     <div class="workspace-icon">
       <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>
     </div>
     <div>
       <div class="workspace-kicker">Quant Lab</div>
       <div class="workspace-title">AI 量化模擬操盤實驗室</div>
       <div class="workspace-sub">從資料準備到策略升版，AI 驅動全流程策略研究與模擬驗證。</div>
     </div>
     <div class="workspace-actions"><span class="pill">最新更新：${esc(DATA.meta.updated||'—')}</span></div>
   </div>

   <div class="strategy-toolbar">
     ${['主系統盤後資料','每日篩選候選池','3 AI 各自選股','主庫歷史回測','FinMind 詳細分析','AI 綜合評分','模擬買進','持股追蹤','多 AI 檢討','策略升版'].map((s,i,a)=>
       `<span class="strategy-step"><b>${i+1}</b>${s}</span>${i<a.length-1?'<span style="display:flex;align-items:center;color:var(--ink-3)">›</span>':''}`).join('')}
   </div>

   <div class="strategy-grid stagger">
   ${DATA.agents.map((a,idx)=>`<div class="strategy-card" style="cursor:pointer;transition:.15s" data-ai="${a.id}" onmouseover="this.style.boxShadow='var(--shadow-lg)'" onmouseout="this.style.boxShadow='var(--shadow)'">
     <div class="strategy-card-head">
       <div class="strategy-icon">${idx===2?'KC':idx===3?'MA':'AI'}</div>
       <div style="min-width:0;flex:1">
       <div style="display:flex;align-items:center;gap:10px"><h3>${a.name}</h3>
       <span class="badge ${a.status==='運行中'?'cool':'obs'}" style="margin-left:auto">${a.status}</span></div>
       <div style="font-size:12px;color:var(--ink-3);margin-top:3px">${a.type} · 策略 ${a.ver}</div>
       <p>${a.desc}</p>
       </div>
     </div>
     <div class="strategy-stats">
       ${[['今日初篩',a.pre+' 檔'],['回測通過',a.passed+' 檔'],['今日模擬買進',a.buy+' 檔'],['回測平均勝率',a.wr],
          ['累積報酬率',a.cum,'up'],['本月報酬',a.mon,'up'],['勝率',a.win],['最大回撤',a.mdd,'down']].map((r,i)=>
         `<div class="strategy-stat"><span>${r[0]}</span><b class="num ${r[2]||''}">${r[1]}</b></div>`).join('')}
     </div>
     <div class="card-pad" style="display:flex;align-items:center;gap:10px"><button class="btn line sm">查看 AI 詳細</button><button class="btn sm">模擬進場</button>
       <span class="more" style="margin-left:auto;font-size:12px;color:var(--ink-2)">持股 ${a.pos} 檔</span></div>
   </div>`).join('')}
   </div>
   <div class="card card-pad" style="background:var(--blue-tint);border-color:var(--blue-soft);font-size:13px;color:var(--ink-2)">提示：所有策略回測與模擬交易結果僅供參考，請搭配風險控管機制使用。</div>
  </div>`;
}

async function loadAIDetailData(agentKey){
  const a=DATA.agents.find(x=>x.id===agentKey)||DATA.agents[0];
  if(!a || !a._id) return;
  const aid=a._id;
  try{
    const [cs,bk,ps,tb,dp]=await Promise.all([
      sbGet(
        `ai_candidates?select=symbol,agent_reason,accepted_by_agent&agent_id=eq.${aid}&order=id.desc`,200
      ),
      sbGet(
        `ai_backtests?select=symbol,matched_conditions,sample_count,win_rate,avg_return_5d,avg_return_3d,avg_return_10d,max_drawdown,profit_factor,passed&agent_id=eq.${aid}&order=id.desc`,200
      ),
      sbGet(
        `ai_positions?select=symbol,name,buy_date,buy_price,current_price,quantity,buy_reason,status&agent_id=eq.${aid}&status=eq.持有`,200
      ),
      sbGet(
        `ai_trades?select=trade_date,symbol,price,quantity,amount,reason,trade_type&agent_id=eq.${aid}&order=id.desc`,200
      ),
      sbGet(
        `ai_deep_analysis?select=symbol,technical_summary,chip_summary,fundamental_summary,risk_summary,final_score,decision,decision_reason&agent_id=eq.${aid}&order=id.desc`,80
      )
    ]);
    const syms=[...new Set([
      ...(Array.isArray(cs)?cs.map(x=>x.symbol):[]),
      ...(Array.isArray(bk)?bk.map(x=>x.symbol):[]),
      ...(Array.isArray(ps)?ps.map(x=>x.symbol):[]),
      ...(Array.isArray(tb)?tb.map(x=>x.symbol):[]),
      ...(Array.isArray(dp)?dp.map(x=>x.symbol):[])
    ].map(x=>String(x||'').trim()).filter(Boolean))];
    const dateHint=String((DATA.meta&&DATA.meta.date)||'').replaceAll('/','-');
    const nm=await loadNameMap(syms,dateHint);
    const nameOf=(sym, fallback='')=>{
      const s=String(sym||'').trim();
      const n=String(((nm[s]||{}).name)||fallback||'').trim();
      return n && n!==s && n!=='尚無名稱' ? n : s;
    };
    const latestPriceRows=syms.length?await sbGet(
      `daily_prices?select=symbol,date,close&symbol=in.(${syms.join(',')})&order=date.desc&limit=2000`,2000
    ).catch(()=>[]): [];
    const prevCloseBySymbol={};
    (latestPriceRows||[]).forEach(r=>{
      const sym=String(r.symbol||'').trim();
      if(!sym) return;
      (prevCloseBySymbol[sym]=prevCloseBySymbol[sym]||[]).push(r);
    });
    const parseTradeState=reason=>{
      const m=String(reason||'').match(/STATE=(\{.*\})/);
      if(!m) return {};
      try{return JSON.parse(m[1]);}catch(_){return {};}
    };
    const cleanReason=reason=>String(reason||'—').replace(/\s*STATE=\{.*\}\s*$/,'').trim()||'—';
    const fmtDate=d=>String(d||'').slice(5).replace('-','/')||'—';
    const trades=Array.isArray(tb)?tb:[];
    const buyBySymbol={};
    trades.slice().sort((a,b)=>String(a.trade_date).localeCompare(String(b.trade_date))).forEach(t=>{
      const sym=String(t.symbol||'').trim();
      if(!sym) return;
      if(t.trade_type==='買進'){
        (buyBySymbol[sym]=buyBySymbol[sym]||[]).push(t);
      }
    });
    DATA.aiCand=(Array.isArray(cs)?cs:[]).filter(c=>c.accepted_by_agent).slice(0,20).map(c=>({
      c:c.symbol, n:nameOf(c.symbol), src:'候選池', reason:cleanReason(c.agent_reason), score:'—'}));
    DATA.aiBack=(Array.isArray(bk)?bk:[]).slice(0,30).map(b=>({
      c:b.symbol, n:nameOf(b.symbol), cond:cleanReason(b.matched_conditions),
      s:b.sample_count, wr:b.win_rate+'%', ar:(b.avg_return_5d>0?'+':'')+b.avg_return_5d+'%',
      r3:(b.avg_return_3d>0?'+':'')+b.avg_return_3d+'%',
      r5:(b.avg_return_5d>0?'+':'')+b.avg_return_5d+'%',
      r10:(b.avg_return_10d>0?'+':'')+b.avg_return_10d+'%',
      mdd:b.max_drawdown+'%', pf:String(b.profit_factor),
      res:b.passed?'通過':'不通過'}));
    DATA.aiPos=(Array.isArray(ps)?ps:[]).map(p=>({
      c:p.symbol, n:nameOf(p.symbol,p.name), bp:p.buy_price, cp:p.current_price,
      q:p.quantity, bd:fmtDate(p.buy_date), prev:(prevCloseBySymbol[String(p.symbol)]||[]).find(x=>Number(x.close)!==Number(p.current_price))?.close,
      reason:cleanReason(p.buy_reason)}));
    const latestAiDate=String((DATA.meta&&DATA.meta.date)||'').replaceAll('/','-').slice(0,10);
    DATA.aiBuy=trades.filter(t=>
      t.trade_type==='買進' &&
      (!latestAiDate || String(t.trade_date||'').slice(0,10)===latestAiDate)
    ).slice(0,20).map(t=>({
      d:fmtDate(t.trade_date), c:t.symbol, n:nameOf(t.symbol),
      p:Number(t.price), q:Number(t.quantity)||0, s:'—', reason:cleanReason(t.reason)}));
    DATA.aiSell=trades.filter(t=>t.trade_type==='賣出').map(t=>{
      const st=parseTradeState(t.reason);
      const sym=String(t.symbol||'').trim();
      const sellDate=String(t.trade_date||'').slice(0,10);
      const prior=(buyBySymbol[sym]||[]).filter(b=>String(b.trade_date||'').slice(0,10)<=sellDate).slice(-1)[0]||{};
      const buyPrice=Number(st.buy_price||prior.price)||0;
      const sellPrice=Number(st.sell_price||t.price)||0;
      const qty=Number(t.quantity||prior.quantity)||0;
      const pnl=Number.isFinite(Number(st.pnl))?Number(st.pnl):((sellPrice-buyPrice)*qty*1000);
      const ret=Number.isFinite(Number(st.return_pct))?Number(st.return_pct):(buyPrice?((sellPrice-buyPrice)/buyPrice*100):NaN);
      return {
        bd:fmtDate(st.buy_date||prior.trade_date),
        d:fmtDate(st.sell_date||t.trade_date),
        c:t.symbol, n:nameOf(t.symbol), bp:buyPrice, p:sellPrice,
        pnl:Number.isFinite(pnl)?sgn(Math.round(pnl).toLocaleString()):'—',
        ret:Number.isFinite(ret)?sgn(ret.toFixed(2))+'%':'—',
        reason:cleanReason(t.reason), early:'—', late:'—'
      };
    }).filter(s=>s.bd==='—' || s.bd!==s.d).slice(0,20);
    DATA.aiDeep=(Array.isArray(dp)?dp:[]).slice(0,8).map(d=>({
      c:d.symbol, n:nameOf(d.symbol), score:d.final_score||'—', decision:d.decision||'—',
      tech:d.technical_summary||'—', chip:d.chip_summary||'—',
      fund:d.fundamental_summary||'—', risk:d.risk_summary||'—',
      reason:cleanReason(d.decision_reason)
    }));
    const rv=await sbGet(
      `ai_reviews?select=review_date,self_review,improvement_suggestion&agent_id=eq.${aid}&order=id.desc`,20);
    DATA.aiReview=(Array.isArray(rv)?rv:[]).slice(0,8).map(r=>({
      q:String(r.review_date).slice(0,10), a:(r.improvement_suggestion||r.self_review||'—')}));
    const vv=await sbGet(
      `ai_strategy_versions?select=version,created_at,reason,old_rules,new_rules,change_summary&agent_id=eq.${aid}&order=id.desc`,20);
    DATA.aiVer=(Array.isArray(vv)?vv:[]).slice(0,10).map(v=>({
      v:v.version||'—', d:String(v.created_at||'').slice(0,10),
      reason:v.reason||'—', old:v.old_rules||'—', new:v.new_rules||'—',
      perf:v.change_summary||'—'}));
  }catch(e){ console.warn('AI 明細載入略過:',e); }
}

function vAIDetail(id){
  const a=DATA.agents.find(x=>x.id===id);
  const latestAiDate=String((DATA.meta&&DATA.meta.date)||'').replaceAll('/','-').slice(0,10);
  const blk=(title,sub,body)=>`<div class="card"><div class="card-h"><h3>${title}</h3>${sub?`<span class="tag">${sub}</span>`:''}</div>${body}</div>`;
  const tbl=(head,rows)=>`<div class="tbl-wrap"><table><thead><tr>${head.map(h=>`<th class="${h[1]||''}">${h[0]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  const deepRows=(DATA.aiDeep&&DATA.aiDeep.length)?DATA.aiDeep:[];
  const deepBody=deepRows.length
    ? `<div class="card-pad" style="display:flex;flex-direction:column;gap:14px">
        ${deepRows.map(d=>`<div style="border:1px solid var(--border-soft);border-radius:10px;padding:14px 16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
            <b class="code">${d.c}</b><b>${d.n}</b>
            <span class="badge ${d.decision==='買進'?'good':'obs'}">${d.decision}</span>
            <span class="badge hot">AI 最終評分 ${d.score}</span>
          </div>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
            ${[
              ['技術摘要',d.tech],
              ['籌碼摘要',d.chip],
              ['基本面摘要',d.fund],
              ['風險摘要',d.risk],
              ['決策原因',d.reason]
            ].map(r=>`<div style="background:var(--blue-tint);border:1px solid var(--blue-soft);border-radius:10px;padding:12px 14px">
              <div style="font-size:11px;color:var(--primary);font-weight:700">${r[0]}</div>
              <div style="font-size:13px;font-weight:600;margin-top:4px;line-height:1.45">${r[1]}</div></div>`).join('')}
          </div>
        </div>`).join('')}
      </div>`
    : `<div class="card-pad muted">目前沒有 AI 詳細分析資料；請先跑 GitHub Actions 的 AI 實驗室排程。</div>`;
  return `<div class="fade" style="display:flex;flex-direction:column;gap:16px">
   <button class="btn line sm" data-aiback style="align-self:flex-start">‹ 返回 AI 列表</button>

   ${blk('1 · AI 投資人概況','',`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));padding:18px 20px;gap:18px">
     ${[['AI 名稱',a.name],['策略類型',a.type],['交易週期','短中波段'],['初始資金','NT$ '+a.init.toLocaleString()],
        ['目前資產','NT$ '+(a.cash+a.hold).toLocaleString(),'up'],['現金','NT$ '+a.cash.toLocaleString()],
        ['持股市值','NT$ '+a.hold.toLocaleString()],['累積報酬率',a.cum,'up'],['最大回撤',a.mdd,'down'],
        ['策略版本',a.ver],['目前狀態',a.status]].map(r=>
       `<div class="stat"><span class="k">${r[0]}</span><span class="v ${r[2]||''}" style="font-size:16px">${r[1]}</span></div>`).join('')}</div>`)}

   ${blk('2 · 目前持有股票','放在上方方便快速檢查',tbl(
     [['代號'],['名稱'],['買進日'],['買進價','r'],['現價','r'],['張數','r'],['持股市值','r'],['今日損益','r'],['未實現損益','r'],['報酬率','r']],
     DATA.aiPos.map(p=>{const pnl=(p.cp-p.bp)*p.q*1000;const ret=((p.cp-p.bp)/p.bp*100);const isTodayBuy=latestAiDate&&String(p.bd||'').replace('/','-')===latestAiDate.slice(5);const td=isTodayBuy?pnl:(Number(p.prev)?(p.cp-Number(p.prev))*p.q*1000:NaN);
       return `<tr><td class="code">${p.c}</td><td><b>${p.n}</b></td><td class="code">${p.bd}</td><td class="r num">${fmtPx(p.bp)}</td>
       <td class="r num">${fmtPx(p.cp)}</td><td class="r num">${p.q}</td><td class="r num">${(p.cp*p.q*1000).toLocaleString()}</td>
       <td class="r num ${td>=0?'up':'down'}">${Number.isFinite(td)?sgn(Math.round(td).toLocaleString()):'—'}</td>
       <td class="r num ${pnl>=0?'up':'down'}">${sgn(Math.round(pnl).toLocaleString())}</td>
       <td class="r num ${ret>=0?'up':'down'}">${sgn(ret.toFixed(1))}%</td></tr>`;}).join('')))}

   <div class="grid" style="grid-template-columns:1fr 1fr">
     ${blk('3 · 今日買進紀錄','只顯示最新交易日真的進場，不顯示回測延續舊訊號',tbl([['日期'],['股票'],['價格','r'],['張','r'],['分','r'],['原因']],
       DATA.aiBuy.map(b=>`<tr><td class="code">${b.d}</td><td><b class="code">${b.c}</b> ${b.n}</td>
       <td class="r num">${fmtPx(b.p)}</td><td class="r num">${b.q}</td><td class="r num">${b.s}</td>
       <td class="muted" style="white-space:normal;min-width:120px">${b.reason}</td></tr>`).join('')))}
     ${blk('4 · 賣出紀錄','',tbl([['買進日'],['賣出日'],['股票'],['買進價','r'],['賣出價','r'],['損益','r'],['報酬','r'],['檢討']],
       DATA.aiSell.map(s=>`<tr><td class="code">${s.bd}</td><td class="code">${s.d}</td><td><b class="code">${s.c}</b> ${s.n}</td>
       <td class="r num">${fmtPx(s.bp)}</td><td class="r num">${fmtPx(s.p)}</td><td class="r num ${s.pnl.includes('-')?'down':'up'}">${s.pnl}</td>
       <td class="r num ${s.ret.includes('-')?'down':'up'}">${s.ret}</td>
       <td class="muted" style="white-space:normal">${s.reason}（賣早:${s.early}/賣晚:${s.late}）</td></tr>`).join('')))}
   </div>

   ${blk('5 · 候選股票來源','從各板塊取得候選股',tbl(
     [['代號'],['名稱'],['來源板塊'],['候選原因'],['初篩分','r']],
     DATA.aiCand.map(c=>`<tr><td class="code lnk" data-stock="${c.c}">${c.c}</td><td><b>${c.n}</b></td>
       <td><span class="badge obs">${c.src}</span></td><td class="muted" style="white-space:normal;min-width:200px">${c.reason}</td>
       <td class="r"><b class="num" style="color:var(--primary)">${c.score}</b></td></tr>`).join('')))}

   ${blk('6 · 歷史回測區','使用主系統資料庫回測',tbl(
     [['代號'],['名稱'],['相似條件'],['樣本','r'],['勝率','r'],['平均報酬','r'],['3日','r'],['5日','r'],['10日','r'],['最大回撤','r'],['盈虧比','r'],['結果']],
     DATA.aiBack.map(b=>`<tr><td class="code">${b.c}</td><td><b>${b.n}</b></td>
       <td class="muted" style="white-space:normal;min-width:160px">${b.cond}</td><td class="r num">${b.s}</td>
       <td class="r num">${b.wr}</td><td class="r num up">${b.ar}</td><td class="r num up">${b.r3}</td><td class="r num up">${b.r5}</td>
       <td class="r num ${b.r10.includes('-')?'down':'up'}">${b.r10}</td><td class="r num down">${b.mdd}</td><td class="r num">${b.pf}</td>
       <td><span class="badge ${b.res==='通過'?'good':b.res==='不通過'?'bad':'obs'}">${b.res}</span></td></tr>`).join('')))}

   ${blk('7 · AI 詳細分析區','僅回測通過股票進入此區',deepBody)}

   ${blk('8 · AI 自我檢討區','每次交易結束後自動產生',`<div class="card-pad" style="display:flex;flex-direction:column;gap:9px">
     ${DATA.aiReview.map(r=>`<div style="display:flex;gap:14px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border-soft)">
       <div style="width:140px;flex-shrink:0;font-size:12.5px;color:var(--ink-2);font-weight:700">${r.q}</div>
       <div style="font-size:13px">${r.a}</div></div>`).join('')}</div>`)}

   ${blk('9 · 多 AI 檢討流程','首版以規則 / 模擬文字產生，未來再接 API',`<div class="card-pad">
     <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px">
     ${['交易結果','原始 AI 自我檢討','ChatGPT 檢討策略','Gemini 再檢討','策略審核 AI 統整','產生修改建議','回傳原始 AI','更新下一版'].map((s,i,arr)=>
       `<div style="min-width:130px;background:var(--blue-tint);border:1px solid var(--blue-soft);border-radius:10px;padding:11px 13px;font-size:12px;font-weight:600;text-align:center">${s}</div>${i<arr.length-1?'<div style="display:flex;align-items:center;color:var(--ink-3);font-weight:800">→</div>':''}`).join('')}
     </div>
     <div style="margin-top:12px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:12px 14px;font-size:12.5px;color:#9A3412">
       首版不強制使用 OpenAI / Gemini API，避免費用。資料表與 UI 已就緒，未來把檢討流程接上 API 即可運作。</div></div>`)}

   ${blk('10 · AI 策略版本紀錄','',tbl([['版本'],['時間'],['修改原因'],['舊規則'],['新規則'],['績效變化']],
     DATA.aiVer.map(v=>`<tr><td><span class="badge">${v.v}</span></td><td class="code">${v.d}</td>
     <td class="muted" style="white-space:normal;min-width:130px">${v.reason}</td>
     <td class="muted" style="white-space:normal;min-width:140px">${v.old}</td>
     <td style="white-space:normal;min-width:160px">${v.new}</td>
     <td class="num up" style="white-space:normal">${v.perf}</td></tr>`).join('')))}
  </div>`;
}

/* ============ 7. ATR 停利停損 / 觀察報告 ============ */
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

/* ============ 8. 後台管理 ============ */
function vAdmin(){
  if(!isAdmin()){
    return `<div class="fade account-grid">
      <div class="card card-pad auth-panel">
        <h3 style="font-size:18px;margin-bottom:10px">需要管理員登入</h3>
        <div class="muted" style="font-size:13.5px;line-height:1.7">後台管理、板塊開通設定與使用天數設定只開放管理員帳號操作。</div>
      </div>
      <div class="card card-pad">
        <h3 style="font-size:18px;margin-bottom:12px">管理員登入</h3>
        <div class="form-grid">
          <div class="field"><label>帳號</label><input id="loginAccount" autocomplete="username" placeholder="輸入管理員帳號"></div>
          <div class="field"><label>密碼</label><input id="loginPassword" type="password" autocomplete="current-password" placeholder="輸入管理員密碼"></div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn" id="loginBtn">登入後台</button>
            <span id="loginMsg" class="muted" style="font-size:13px"></span>
          </div>
        </div>
      </div>
    </div>`;
  }
  const online=DATA.onlineStats||{members:DATA.onlineCount||0,guests:0,total:DATA.onlineCount||0};
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad" style="background:var(--accent-soft);border-color:var(--accent)">
     <b style="font-size:13.5px">📌 說明</b>
     <div style="font-size:13px;color:var(--ink-2);margin-top:6px;line-height:1.6">
       股票、題材、AI 資料皆由系統每日盤後自動抓取與計算維護，此處為檢視。
       「開通設定」可設定板塊是否開通與使用天數。</div>
   </div>
   <div class="admin-online-grid">
     <div class="mini-tile cool"><span>目前在線總數</span><b>${online.total||0}</b><small>最近 5 分鐘內有活動</small></div>
     <div class="mini-tile success"><span>線上會員</span><b>${online.members||0}</b><small>已登入帳號</small></div>
     <div class="mini-tile"><span>未登入遊客</span><b>${online.guests||0}</b><small>匿名瀏覽者</small></div>
   </div>
   <div class="seg" style="flex-wrap:wrap" id="admSeg">
     ${[
       ['開通設定',4],['維修狀態',5],['觀察報告',6],['股票資料',0],['題材分類',1],['篩選參數',2],['每日報告',3],['AI 機器人',7]
     ].map((r,i)=>`<button class="${i===0?'on':''}" data-tab="${r[1]}">${r[0]}</button>`).join('')}
   </div>
   <div id="admBody"></div>
  </div>`;
}
function admBody(i){
  const b=document.getElementById('admBody');if(!b)return;
  if(i===0){b.innerHTML=`<div class="card"><div class="card-h"><h3>股票資料管理</h3><button class="btn sm" id="addStockBtn" style="margin-left:auto">+ 新增股票</button></div>
    <div id="adminEditor"></div>
    <div class="tbl-wrap"><table><thead><tr><th>代號</th><th>名稱</th><th>市場</th><th>傳統產業</th><th>題材分類</th><th>龍頭</th><th>觀察</th><th>操作</th></tr></thead><tbody>
    ${DATA.adminStocks.map(s=>`<tr><td class="code">${s.c}</td><td><b>${s.n}</b></td><td>${s.m}</td><td class="muted">${s.ind}</td>
      <td><span class="badge">${s.th}</span></td><td>${s.lead?'<span class="badge hot">龍頭</span>':'—'}</td>
      <td>${s.obs?'<span class="badge warm">觀察</span>':'—'}</td>
      <td><button class="btn line sm" data-stock-edit="${s.c}">編輯</button></td></tr>`).join('')}</tbody></table></div></div>`;}
  else if(i===1){b.innerHTML=`<div class="card"><div class="card-h"><h3>題材分類管理</h3><button class="btn sm" id="addThemeBtn" style="margin-left:auto">+ 新增題材</button></div>
    <div id="adminEditor"></div>
    <div class="tbl-wrap"><table><thead><tr><th>題材名稱</th><th>說明</th><th>產業鏈位置</th><th>相關股票數</th><th>操作</th></tr></thead><tbody>
    ${DATA.themes.map(t=>`<tr><td><b>${t.name}</b></td><td class="muted" style="white-space:normal;min-width:260px">${t.desc}</td>
      <td>${t.chain}</td><td class="num">${Array.isArray(t.stocks)?t.stocks.length:'—'}</td><td><button class="btn line sm" data-theme-edit="${t.id}">編輯產業鏈</button></td></tr>`).join('')}</tbody></table></div></div>`;}
  else if(i===2){
    const P=DATA.appSettings||{};
    const fields=[
      ['成交量門檻（張）','vol_threshold',P.vol_threshold||'3000'],
      ['股價門檻','price_threshold',P.price_threshold||'20'],
      ['RSI 門檻','rsi_threshold',P.rsi_threshold||'50'],
      ['法人買超天數','inst_buy_days',P.inst_buy_days||'3'],
      ['題材熱度權重','heat_weight',P.heat_weight||'技術35 籌碼30 題材35']];
    b.innerHTML=`<div class="card card-pad"><h3 style="margin-bottom:16px">篩選參數管理</h3>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">
      ${fields.map(r=>`<div><label style="font-size:12px;color:var(--ink-2);font-weight:600">${r[0]}</label>
        <input id="set_${r[1]}" value="${r[2]}" style="width:100%;margin-top:6px;padding:9px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--mono);font-size:13px;outline:none"></div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:18px">
        <button class="btn" id="saveSetBtn">儲存設定</button>
        <span id="saveSetMsg" style="font-size:13px;color:var(--ink-2)"></span>
      </div>
      <div style="font-size:12px;color:var(--ink-3);margin-top:10px">儲存後於下次盤後計算生效。MA/KD/MACD 為標準參數，固定不開放調整。</div>
    </div>`;
    const keys=fields.map(f=>f[1]);
    const btn=document.getElementById('saveSetBtn');
    if(btn)btn.onclick=async()=>{
      btn.disabled=true;btn.textContent='儲存中…';
      const msg=document.getElementById('saveSetMsg');
      try{
        const rows=keys.map(k=>({key:k,value:(document.getElementById('set_'+k)||{}).value||'',updated_at:new Date().toISOString()}));
        const r=await fetch(`${SB_URL}/rest/v1/app_settings?on_conflict=key`,{
          method:'POST',
          headers:{apikey:SB_ANON,Authorization:`Bearer ${SB_ANON}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify(rows)});
        if(r.ok){
          DATA.appSettings=DATA.appSettings||{};rows.forEach(x=>DATA.appSettings[x.key]=x.value);
          if(msg){msg.textContent='✅ 已儲存（下次盤後計算生效）';msg.style.color='var(--up)';}
        }else{
          const t=await r.text().catch(()=> '');
          if(msg){msg.textContent='⚠️ 儲存失敗 '+r.status+'（請先在 Supabase 建 app_settings 表）';msg.style.color='#92400E';}
        }
      }catch(e){
        if(msg){msg.textContent='⚠️ 儲存失敗：'+(e&&e.message||e);msg.style.color='#92400E';}
      }
      btn.disabled=false;btn.textContent='儲存設定';
    };
  }
  else if(i===3){const draft=reportDraft();b.innerHTML=`<div class="card card-pad"><h3 style="margin-bottom:14px">每日報告管理</h3>
    <div style="display:flex;flex-direction:column;gap:11px">
    ${[['自動產出報告','已啟用 · 依 Supabase 當日資料即時組成'],['資料來源',SRC_STATUS],['發布狀態','前台即時顯示，管理員備註可儲存'],['風險提醒','目前讀取系統風險清單，後續可擴充手動風險表']].map(r=>
      `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-soft)">
      <b style="font-size:13.5px;width:160px">${r[0]}</b><span class="muted" style="flex:1">${r[1]}</span>
      <button class="btn line sm" data-report-view="${r[0]}">檢視</button></div>`).join('')}
      <div id="reportEditBox" class="card-pad" style="margin-top:8px;border:1px solid var(--border);border-radius:10px;background:#fff">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><b>報告內容編輯</b><span class="tag">會覆蓋前台每日報告顯示</span></div>
        <div class="field">
          <label>報告文字內容</label>
          <textarea id="reportContentInput" style="width:100%;min-height:240px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--sans);font-size:13.5px;outline:none">${esc(draft.content||defaultReportText())}</textarea>
        </div>
        <div class="field" style="margin-top:12px">
          <label>推薦股票，每行：代號,名稱,題材,分數,理由</label>
          <textarea id="reportPicksInput" style="width:100%;min-height:120px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--mono);font-size:13px;outline:none">${esc(draft.picks||defaultReportPicksText())}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px">
        <button class="btn" id="saveReportNoteBtn">儲存報告內容</button>
        <button class="btn line sm" id="previewReportBtn">前台預覽</button>
        <button class="btn line sm" id="regenReportBtn">重新產生報告</button>
        <span id="reportMsg" class="muted" style="font-size:13px"></span>
      </div>
    </div></div>`;}
  else if(i===4){
    const members=users().filter(u=>u.role!=='admin');
    const selected=(localStorage.getItem('stockLabAdminMember')||members[0]?.account||'');
    const acts=selected?memberEntitlements(selected):manageableActivationSettings().map(a=>({...a,enabled:false,days:0}));
    b.innerHTML=`<div class="card">
      <div class="card-h"><h3>會員與開通設定</h3><span class="tag">新增 / 刪除帳號 · 板塊開通天數</span></div>
      <div class="card-pad" style="border-bottom:1px solid var(--border-soft);background:var(--blue-tint)">
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">
          <div class="field"><label>新增帳號 Email</label><input id="newUserAccount" placeholder="user@example.com"></div>
          <div class="field"><label>密碼</label><input id="newUserPassword" type="password" placeholder="至少 6 碼"></div>
          <div class="field"><label>暱稱</label><input id="newUserNick" placeholder="會員暱稱"></div>
          <div class="field"><label>角色</label><select id="newUserRole"><option value="user">一般會員</option><option value="admin">管理員</option></select></div>
          <button class="btn" id="createUserBtn">新增帳號</button>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px">
          <button class="btn line sm" id="deleteUserBtn" ${selected?'':'disabled'}>刪除目前選定帳號</button>
          <span id="userManageMsg" class="muted" style="font-size:13px"></span>
        </div>
      </div>
      <div class="card-pad" style="border-bottom:1px solid var(--border-soft)">
        <div class="grid" style="grid-template-columns:minmax(220px,1fr) 160px auto;align-items:end">
          <div class="field"><label>選擇會員</label>
            <select id="memberSelect">
              ${members.length?members.map(u=>`<option value="${u.account}" ${u.account===selected?'selected':''}>${u.nick}（${u.account}）</option>`).join(''):'<option value="">尚無會員</option>'}
            </select>
          </div>
          <div class="field"><label>全部板塊天數</label><input id="allDaysInput" type="number" min="1" max="3650" value="30"></div>
          <button class="btn" id="openAllBtn" ${selected?'':'disabled'}>全部開通</button>
        </div>
      </div>
      <div class="card-pad activation-grid">
        ${acts.map(a=>`<div class="activation-card" data-act="${a.id}">
          <div class="toggle-row">
            <div><b>${a.name}</b><div class="muted" style="font-size:12px;margin-top:2px">${a.id}</div></div>
            <button class="toggle ${a.enabled?'on':''}" data-act-toggle="${a.id}" aria-label="切換 ${a.name}"></button>
          </div>
          <div class="field" style="margin-top:12px">
            <label>使用天數設定</label>
            <input id="act_days_${a.id}" type="number" min="1" max="3650" value="${a.days}">
          </div>
        </div>`).join('')}
      </div>
      <div class="card-pad" style="border-top:1px solid var(--border-soft);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn" id="saveActivationBtn" ${selected?'':'disabled'}>儲存此會員設定</button>
        <span id="activationMsg" class="muted" style="font-size:13px"></span>
      </div>
    </div>`;}
  else if(i===5){
    const rows=maintenanceSettings();
    b.innerHTML=`<div class="card">
      <div class="card-h"><h3>板塊維修狀態</h3><span class="tag">管理員仍可進入測試，一般會員會看到維修中</span></div>
      <div class="card-pad activation-grid">
        ${rows.map(a=>`<div class="activation-card" data-maint="${a.id}">
          <div class="toggle-row">
            <div><b>${a.name}</b><div class="muted" style="font-size:12px;margin-top:2px">${a.id}</div></div>
            <button class="toggle ${a.maintenance?'on':''}" data-maint-toggle="${a.id}" aria-label="切換 ${a.name} 維修狀態"></button>
          </div>
          <div class="field" style="margin-top:12px">
            <label>會員看到的提示</label>
            <input id="maint_msg_${a.id}" value="${esc(a.message||'此板塊正在維修更新，完成後會重新開放。')}">
          </div>
          <div class="muted" style="font-size:12px;margin-top:8px">${a.maintenance?'目前：維修中':'目前：開放'}</div>
        </div>`).join('')}
      </div>
      <div class="card-pad" style="border-top:1px solid var(--border-soft);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn" id="saveMaintenanceBtn">儲存維修狀態</button>
        <span id="maintenanceMsg" class="muted" style="font-size:13px"></span>
      </div>
    </div>`;
  }
  else if(i===6){
    const txt=(DATA.observations||[]).map(r=>`${r.symbol||r.c},${r.name||''},${r.category||'觀察'},${r.note||''}`).join('\n');
    b.innerHTML=`<div class="card">
      <div class="card-h"><h3>觀察報告管理</h3><span class="tag">每行：代號,名稱,分類,觀察原因</span></div>
      <div class="card-pad">
        <textarea id="observeInput" style="width:100%;min-height:220px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--mono);font-size:13px;outline:none" placeholder="2330,台積電,觀察,站上月線且法人回補">${esc(txt)}</textarea>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
          <button class="btn" id="saveObserveBtn">儲存觀察報告</button>
          <span id="observeMsg" class="muted" style="font-size:13px"></span>
        </div>
      </div>
    </div>`;
  }
  else{b.innerHTML=`<div class="card"><div class="card-h"><h3>AI 機器人管理</h3></div>
    <div class="tbl-wrap"><table><thead><tr><th>AI 名稱</th><th>策略</th><th>初始資金</th><th>持股上限</th><th>單檔上限</th><th>停損</th><th>停利</th><th>版本</th><th>啟用</th></tr></thead><tbody>
    ${DATA.agents.map(a=>`<tr><td><b>${a.name}</b></td><td class="muted">${a.type}</td>
      <td class="num">${a.init.toLocaleString()}</td><td class="num r">8 檔</td><td class="num r">15%</td>
      <td class="num r down">-8%</td><td class="num r up">+15%</td><td><span class="badge">${a.ver}</span></td>
      <td><span class="badge good">啟用</span></td></tr>`).join('')}</tbody></table></div></div>`;}
}

function stockAdminForm(s={}){
  return `<div class="card-pad" style="border-bottom:1px solid var(--border-soft);background:var(--blue-tint)">
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
      <div class="field"><label>股票代號</label><input id="admStockSymbol" value="${esc(s.c||'')}" placeholder="2330"></div>
      <div class="field"><label>名稱</label><input id="admStockName" value="${esc(s.n||'')}" placeholder="台積電"></div>
      <div class="field"><label>市場</label><select id="admStockMarket"><option ${s.m==='上市'?'selected':''}>上市</option><option ${s.m==='上櫃'?'selected':''}>上櫃</option><option ${s.m==='TWSE'?'selected':''}>TWSE</option><option ${s.m==='TPEX'?'selected':''}>TPEX</option></select></div>
      <div class="field"><label>傳統產業</label><input id="admStockIndustry" value="${esc(s.ind||'')}" placeholder="半導體"></div>
      <div class="field"><label>題材分類</label><input id="admStockTheme" value="${esc(s.th||'')}" placeholder="AI 伺服器"></div>
      <div class="field"><label>標記</label><div style="display:flex;gap:12px;align-items:center;height:38px"><label><input id="admStockLead" type="checkbox" ${s.lead?'checked':''}> 龍頭</label><label><input id="admStockObs" type="checkbox" ${s.obs?'checked':''}> 觀察</label></div></div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap">
      <button class="btn" id="saveStockBtn">儲存股票</button>
      <button class="btn line sm" id="cancelAdminEditBtn">取消</button>
      <span id="adminEditMsg" class="muted" style="font-size:13px"></span>
    </div>
  </div>`;
}
function themeAdminForm(t={}){
  const stockLines=(t.stocks||[]).map(s=>`${s.c},${s.role||'成分'},${s.level||''},${s.score||80}`).join('\n');
  return `<div class="card-pad" style="border-bottom:1px solid var(--border-soft);background:var(--blue-tint)">
    <input id="admThemeLocalId" type="hidden" value="${esc(t.id||'')}">
    <input id="admThemeDbId" type="hidden" value="${esc(t.themeId||'')}">
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      <div class="field"><label>題材名稱</label><input id="admThemeName" value="${esc(t.name||'')}" placeholder="AI 伺服器"></div>
      <div class="field"><label>熱度分數</label><input id="admThemeScore" type="number" min="0" max="100" value="${esc(t.score||70)}"></div>
      <div class="field"><label>狀態</label><input id="admThemeStatus" value="${esc(t.status||'觀察')}" placeholder="主流 / 觀察"></div>
      <div class="field"><label>產業鏈位置</label><input id="admThemeChain" value="${esc(t.chain||'')}" placeholder="上游 / 中游 / 下游"></div>
    </div>
    <div class="field" style="margin-top:12px"><label>說明</label><input id="admThemeDesc" value="${esc(t.desc||'')}" placeholder="題材說明"></div>
    <div class="field" style="margin-top:12px"><label>相關股票，每行：代號,角色,產業鏈位置,關聯分</label>
      <textarea id="admThemeStocks" style="width:100%;min-height:120px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--mono);font-size:13px;outline:none">${esc(stockLines)}</textarea>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap">
      <button class="btn" id="saveThemeBtn">儲存題材</button>
      <button class="btn line sm" id="cancelAdminEditBtn">取消</button>
      <span id="adminEditMsg" class="muted" style="font-size:13px"></span>
    </div>
  </div>`;
}

/* ============ 8. 資料更新狀態 ============ */
function vStatus(){
  const ok=DATA.dataStatus.filter(d=>d.ok).length;
  const srcOk=SRC_STATUS.indexOf('✅')===0;
  const latest=(DATA.dataStatus||[]).map(d=>d.t).filter(t=>t&&t!=='—').sort().slice(-1)[0]||DATA.meta.updated||'—';
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad" style="background:${srcOk?'#FEF2F2':'#FEF3C7'};border-color:${srcOk?'#FECACA':'#FDE68A'}">
     <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
       <span class="badge ${srcOk?'good':'warm'}">${srcOk?'真實資料連線':'資料來源提醒'}</span>
       <b style="font-size:14px;color:${srcOk?'var(--up)':'#92400E'}">${SRC_STATUS}</b>
     </div>
   </div>
   <div class="card card-pad" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
     <div class="stat"><span class="k">今日抓取進度</span><span class="v"><span class="up">${ok}</span><span style="color:var(--ink-3);font-size:18px"> / ${DATA.dataStatus.length}</span></span></div>
     <div style="flex:1;min-width:200px"><div class="progress"><i style="width:${ok/DATA.dataStatus.length*100}%"></i></div>
       <div style="font-size:12px;color:var(--ink-2);margin-top:7px">最後更新：${DATA.meta.date} ${latest} · 排程 GitHub Actions 每日 14:30 / 16:00</div></div>
     <button class="btn sm" id="runDailyBtn">手動重新抓取</button>
     <span id="runDailyMsg" class="muted" style="font-size:12px"></span>
   </div>
   <div class="card"><div class="card-h"><h3>資料來源狀態</h3><span class="tag">每日盤後排程結果</span></div>
     <div class="tbl-wrap"><table><thead><tr><th>資料來源</th><th>狀態</th><th class="r">完成時間</th><th>備註</th></tr></thead><tbody>
     ${DATA.dataStatus.map(d=>`<tr><td><b>${d.k}</b></td>
       <td><span class="badge ${d.ok?'good':'bad'}">${d.ok?'● 成功':'● 失敗'}</span></td>
       <td class="r code">${d.t}</td><td class="muted">${d.err||'正常'}</td></tr>`).join('')}
     </tbody></table></div>
   </div>
   <div class="card card-pad"><b style="font-size:14px">錯誤紀錄</b>
     <div style="margin-top:10px;font-size:13px;color:var(--ink-2);background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:13px;font-family:var(--mono)">
       <div>[16:40] MOPS 月營收：當月營收尚未公布（每月 10 日前），略過</div>
       <div style="color:var(--down);margin-top:4px">[${latest}] 資料來源狀態已同步 Supabase data_status</div>
     </div>
   </div>
  </div>`;
}

