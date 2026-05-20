/* ============ 1. 首頁 ============ */
function chartPointsSvg(points,color='#22C55E'){
  const rows=(points||[]).map(p=>({p:Number(p.p),a:Number(p.a)})).filter(p=>Number.isFinite(p.p));
  if(rows.length<2) return '';
  const sample=rows.filter((_,i)=>i%Math.max(1,Math.floor(rows.length/90))===0).slice(-110);
  const vals=sample.map(p=>p.p);
  const min=Math.min(...vals), max=Math.max(...vals), span=max-min||1;
  const pts=sample.map((p,i)=>{
    const x=(i/(sample.length-1))*300;
    const y=66-((p.p-min)/span)*52;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="spark" viewBox="0 0 300 82" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    <polyline points="0,70 300,70" fill="none" stroke="#E2E8F0" stroke-width="1"/>
  </svg>`;
}
function marketTrendSvg(o,color='#22C55E',chart=null){
  const real=chartPointsSvg(chart&&chart.points,color);
  if(real) return real;
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
  const lots=n>=1000000?Math.round(n/1000):Math.round(n);
  return lots.toLocaleString('en-US');
}
function quoteStockCard(s,opts={}){
  const side=String(s.market||s.m||'').toUpperCase()==='TPEX'?'櫃':'市';
  const px=Number(s.px), dp=Number(s.dp), ch=Number(s.chg||s.change);
  const vol=Number(s.vol);
  const actions=opts.actions||'';
  return `<div class="quote-card ${opts.compact?'compact':''}" data-live-row="${s.c}">
    <div class="quote-side">${side}</div>
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
      ${news.slice(0,5).map(n=>`<div class="mops-item">
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
function vHome(){
  const m=DATA.market;
  const idxVal=o=>Number.isFinite(Number(o&&o.v))?fmtPx(o.v):'—';
  const idxDiff=o=>Number.isFinite(Number(o&&o.d))&&Number.isFinite(Number(o&&o.dp))
    ? `${sgn(Number(o.d).toFixed(2))} (${sgn(Number(o.dp).toFixed(2))}%)`
    : '—';
  const ov=[
    ['加權指數',m.twse],
    ['櫃買指數',m.tpex],
  ];
  const picks=DATA.picks.slice(0,3);
  const flat=Number(m.flat)||0;
  const total=Math.max(1,m.up+m.down+flat);
  const upw=Math.max(12,Math.round(m.up/total*100))+'%';
  const downw=Math.max(12,Math.round(m.down/total*100))+'%';
  const tw=m.twseDist||{};
  const tp=m.tpexDist||{};
  return `<div class="dash fade stagger">
   <div class="dash-head">
     <div>
       <div class="dash-title"><span class="target">◎</span>今日台股關注清單</div>
       <div class="hint">盤後量化 AI 依題材、技術與籌碼整理，快速掃描隔日觀察重點。</div>
     </div>
     <div class="spacer"></div>
     <span class="badge hot">資料日 ${DATA.meta.date}</span>
     <span class="badge obs">最後更新 ${DATA.meta.updated}</span>
   </div>

   <div class="pick-grid">
     ${picks.map((s,i)=>`<div class="pick-card ${i<2?'best':'watch'}" data-stock="${s.c}">
       <div class="pick-top">
         <div style="min-width:0;flex:1">
           <div class="pick-code">${s.c}</div>
           <div class="pick-name">${s.n}</div>
           <div style="margin-top:10px"><span class="badge ${i<2?'cool':'warm'}">${i<2?'強勢關注':'穩健關注'}</span></div>
         </div>
         <div class="score-ring" style="--score:${s.fs}"><i><span>總分</span><b>${s.fs}</b></i></div>
       </div>
       <div class="pick-scores">
         <div class="mini-score"><span>基本面</span><b>${Math.max(35,Math.round((s.cs+s.ms)/2))}/50</b></div>
         <div class="mini-score"><span>技術分</span><b>${Math.max(35,Math.round(s.ts/2))}/50</b></div>
       </div>
       <div class="pick-tags"><span class="badge">${s.t}</span><span class="badge obs">MACD 多方</span><span class="badge obs">RSI 健康</span></div>
     </div>`).join('')}
   </div>

   <div class="dash-metrics">
     <div class="card card-pad">
       <div class="sec-title">市場環境</div>
       <div class="meter"><div class="meter-arc"><div class="needle"></div></div></div>
       <div style="display:flex;flex-direction:column;gap:4px">
         <b style="font-size:20px">${m.status}</b>
         <span class="muted" style="font-size:12.5px">${m.statusNote}</span>
       </div>
     </div>
     <div class="card card-pad">
       <div class="sec-title">今日走勢圖</div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
         ${ov.map(([k,o])=>`<div class="stat">
           <span class="k">${k}</span>
           <span data-live="${k==='加權指數'?'twse-v':'tpex-v'}" class="v ${dcls(Number(o&&o.d))}">${idxVal(o)}</span>
           <span data-live="${k==='加權指數'?'twse-d':'tpex-d'}" class="d ${dcls(Number(o&&o.d))}">${idxDiff(o)}</span>
           ${marketTrendSvg(o,Number(o&&o.d)<0?'#EF4444':'#22C55E',k==='加權指數'?m.twseChart:m.tpexChart)}
         </div>`).join('')}
       </div>
     </div>
     <div class="card card-pad">
       <div class="sec-title">漲跌分布</div>
       <div style="display:grid;grid-template-columns:1fr;gap:10px">
         ${[
           ['上市',tw],
           ['上櫃',tp],
           ['合計',{up:m.up,down:m.down,flat:flat,limitUp:m.limitUp,limitDown:m.limitDown}]
         ].map(([k,x])=>`<div style="display:grid;grid-template-columns:46px repeat(3,1fr);align-items:center;gap:8px;font-size:12px">
           <b>${k}</b>
           <span class="num up">漲 ${Number(x.up)||0}</span>
           <span class="num down">跌 ${Number(x.down)||0}</span>
           <span class="num">平 ${Number(x.flat)||0}</span>
         </div>`).join('')}
       </div>
       <div class="barline" style="--upw:${upw};--downw:${downw}"><i></i><i></i><i></i></div>
       <div class="muted" style="font-size:12px;margin-top:12px">上市漲停 ${tw.limitUp||0} / 跌停 ${tw.limitDown||0} · 上櫃漲停 ${tp.limitUp||0} / 跌停 ${tp.limitDown||0}</div>
     </div>
     <div class="card card-pad">
       <div class="sec-title">成交金額</div>
       <div class="flow-list">
         <div class="flow-row"><span>上市</span><span data-live="amt-twse" class="up">${m.amtTwse}</span></div>
         <div class="flow-row"><span>上櫃</span><span data-live="amt-tpex" class="up">${m.amtTpex}</span></div>
         <div class="flow-row"><span>合計</span><span data-live="amt-total">${m.amtTotal||'—'}</span></div>
       </div>
     </div>
   </div>

   <div class="dashboard-table-grid">
     <div class="card">
       <div class="card-h"><h3>自選股掃描</h3><span class="tag">Watchlist Scanner</span><span class="more" data-go="screen">查看全部 →</span></div>
       <div class="tbl-wrap"><table><thead><tr><th>股票</th><th class="r">收盤</th><th class="r">漲跌幅</th><th class="r">趨勢</th><th class="r">總分</th><th>備註</th></tr></thead><tbody>
         ${DATA.picks.slice(0,5).map(s=>`<tr data-live-row="${s.c}"><td><b class="code lnk" data-stock="${s.c}">${s.c}</b> <b>${s.n}</b></td><td data-live-cell="px" class="r num">${fmtPx(s.px)}</td><td data-live-cell="dp" class="r num ${dcls(Number(s.dp))}">${isFinite(Number(s.dp))?sgn(Number(s.dp).toFixed(2))+'%':'—'}</td><td class="r">${miniTrendForStock(s)}</td><td class="r"><b class="num" style="color:var(--primary)">${s.fs}</b></td><td><span class="badge ${s.fs>=84?'cool':s.fs>=78?'warm':'obs'}">${s.fs>=84?'強勢關注':s.fs>=78?'持續觀察':'中性觀察'}</span></td></tr>`).join('')}
       </tbody></table></div>
     </div>
     <div class="card" data-live-card="txf">
       ${txFuturePanel()}
     </div>
   </div>

   <div class="grid" style="grid-template-columns:1fr 1fr">
     <div class="card">
       <div class="card-h"><h3>今日強勢題材排行</h3><span class="tag">熱度分數 · 升溫 / 主流 / 降溫</span><span class="more" data-go="map">產業地圖 →</span></div>
       <div class="tbl-wrap"><table><thead><tr><th>題材</th><th class="r">平均漲幅</th><th>熱度</th><th>狀態</th></tr></thead><tbody>
         ${DATA.themes.slice(0,6).map(t=>`<tr><td><b class="lnk" data-go="map">${t.name}</b><div style="font-size:11px;color:var(--ink-3);margin-top:2px">${t.chain}</div></td><td class="r up num">${t.gain}</td><td>${scoreCell(t.score)}</td><td>${thBadge(t.status)}</td></tr>`).join('')}
       </tbody></table></div>
     </div>
     <div class="card">
       <div class="card-h"><h3>今日重大公告 / 風險提醒</h3><span class="tag">News & Risk</span></div>
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
function mapMarketThemes(){
  const label=mapMarketLabel();
  const rows=(DATA.themes||[]).filter(t=>{
    const n=String(t.name||'').trim();
    if(label==='上市') return n.includes('上市') && !n.includes('上櫃');
    return n.includes('上櫃');
  });
  return rows.length?rows:(DATA.themes||[]);
}
function vMap(){
  const themes=mapMarketThemes();
  const t=themes.find(x=>x.id===MAP_SEL)||themes[0];
  const stocks=(t&&Array.isArray(t.stocks))?t.stocks:[];
  if(!t){
    return `<div class="card card-pad fade"><h3>股票類股資料尚未建立</h3><p class="muted" style="margin-top:8px">請先在 GitHub Actions 跑 Daily market data pipeline，等 Build stock industry classes 完成後再重新整理。</p></div>`;
  }
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="seg" style="align-self:flex-start">
     <button class="${MAP_MARKET==='TWSE'?'on':''}" data-map-market="TWSE">上市</button>
     <button class="${MAP_MARKET==='TPEX'?'on':''}" data-map-market="TPEX">上櫃</button>
   </div>
   <div style="display:flex;gap:9px;flex-wrap:wrap">
     ${themes.map(th=>{const n=th.name;
       const id=th?th.id:'_'+n;const on=th&&th.id===MAP_SEL;
       return `<span class="chip ${on?'on':''}" data-theme="${id}">${n}${th?` · ${th.score}`:''}</span>`;}).join('')}
   </div>

   <div class="card">
     <div style="padding:20px 22px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;border-bottom:1px solid var(--border-soft)">
       <div style="flex:1;min-width:240px">
         <div style="display:flex;align-items:center;gap:10px">
           <h2 style="font-size:21px;font-weight:800;letter-spacing:-.4px">${t.name}</h2>${thBadge(t.status)}</div>
         <p style="color:var(--ink-2);font-size:13.5px;margin-top:8px;line-height:1.55">${t.desc}</p>
       </div>
       <div class="grid" style="grid-template-columns:repeat(3,auto);gap:24px">
         <div class="stat"><span class="k">熱度分數</span><span class="v" style="color:var(--primary)">${t.score}</span></div>
         <div class="stat"><span class="k">平均漲幅</span><span class="v up">${t.gain}</span></div>
         <div class="stat"><span class="k">資金狀態</span><span class="v" style="font-size:18px">${t.vol} 量增</span></div>
       </div>
     </div>
   </div>
   <div class="card">
     <div class="card-h"><h3>相關個股資料</h3><span class="tag">${stocks.length} 檔 · 點卡片可進個股分析</span></div>
     <div class="card-pad">
       ${stocks.length?`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px">
       ${stocks.map(s=>quoteStockCard({...s,market:s.market||MAP_MARKET,t:s.level||s.t||t.name,theme:t.name}, {compact:true})).join('')}
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
function watchlist(){
  return readStore(WATCH_KEY,[]).filter(x=>x&&/^[1-9]\d{3}$/.test(String(x.c||'')));
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
  writeStore(WATCH_KEY,clean);
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
    vol:isFinite(Number(price.volume))?Number(price.volume):(hit&&hit.vol)
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
  const merged=mergeWatchlists(watchlist(),remote);
  setWatchlist(merged);
  WATCH_REMOTE_LOADED=true;
  const saved=await saveRemoteWatchlist(merged);
  WATCH_SYNC_STATUS=saved?'已同步 Supabase 會員自選股':'已讀取 Supabase，但儲存同步失敗';
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
       <b style="font-size:15px">篩選條件</b><span class="tag" style="color:var(--ink-3);font-size:12px">點選下方條件即時篩選 · 已選 <b id="selCnt">${SEL.size}</b> 項</span>
       <button class="btn ghost sm" id="clrBtn" style="margin-left:auto">清除</button>
       <button class="btn sm" id="runBtn">執行篩選</button>
     </div>
     ${Object.entries(DATA.filters).map(([g,arr])=>`<div style="margin-top:16px">
       <div class="sec-title" style="margin-bottom:9px">${g}條件</div>
       <div style="display:flex;gap:8px;flex-wrap:wrap">
       ${arr.map(f=>`<span class="chip ${SEL.has(f)?'on':''}" data-f="${f}">${f}</span>`).join('')}
       </div></div>`).join('')}
   </div>
   <div class="card">
     <div class="card-h"><h3>篩選結果</h3><span class="tag"><b id="resCnt">${DATA.screen.length}</b> 檔符合 · 依綜合分排序</span>
       <span class="more">匯出 CSV →</span></div>
     <div class="tbl-wrap"><table><thead><tr><th>代號</th><th>名稱</th><th>題材</th><th class="r">收盤</th><th class="r">漲跌</th>
       <th class="r">成交量</th><th class="r">技術分</th><th class="r">籌碼分</th><th class="r">題材分</th><th class="r">總分</th><th>操作</th></tr></thead>
       <tbody id="resBody">${rowsScreen(DATA.screen)}</tbody></table></div>
   </div>
  </div>`;
}
function rowsScreen(list){
  return list.map(s=>`<tr><td class="code lnk" data-stock="${s.c}">${s.c}</td><td><b>${s.n}</b></td>
    <td><span class="badge">${s.t}</span></td><td class="r num">${fmtPx(s.px)}</td>
    <td class="r num ${dcls(Number(s.dp))}">${isFinite(Number(s.dp))?sgn(Number(s.dp).toFixed(2))+'%':'—'}</td><td class="r num muted">${s.vol}</td>
    <td class="r num">${s.ts}</td><td class="r num">${s.cs}</td><td class="r num">${s.ms}</td>
    <td class="r"><b class="num" style="color:var(--primary);font-size:14px">${s.total}</b></td>
    <td><button class="btn line sm" data-stock="${s.c}">分析</button></td></tr>`).join('');
}

/* ============ 4. 個股分析 ============ */
function vStock(){
  const s=DATA.stock;
  const fc=s.foreignCost||{};
  const fcRows=[
    ['外資推估成本',fc.cost,''],
    ['站穩起飛價 ×1.04',fc.launch,'cool'],
    ['獲利1 ×1.20',fc.tp1,'good'],
    ['獲利2 ×1.40',fc.tp2,'warm'],
    ['獲利3 ×1.70',fc.tp3,'hot']
  ];
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad">
     <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start">
       <div style="flex:1;min-width:220px">
         <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
           <h2 style="font-size:22px;font-weight:800"><span class="code" style="font-size:18px;color:var(--ink-2)">${s.c}</span> ${s.n}</h2>
           <span class="badge">${s.market}</span><span class="badge obs">${s.industry}</span><span class="badge hot">${s.theme}</span>
         </div>
         <div style="margin-top:10px;color:var(--ink-2);font-size:13px">題材定位：${s.role}</div>
       </div>
       <div style="text-align:right">
         <div class="num up" style="font-size:30px;font-weight:800">${fmtPx(s.px)}</div>
         <div class="num up" style="font-weight:700">▲ +${s.dp}%　量 ${s.vol} 張</div>
       </div>
     </div>
     <div style="display:flex;gap:8px;margin-top:14px">
       <input id="stkInput" placeholder="輸入股票代號（示範：1815）" style="flex:1;max-width:260px;padding:9px 13px;border:1px solid var(--border);border-radius:10px;font-family:var(--mono);font-size:14px;outline:none">
       <button class="btn sm" id="stkSearchBtn">查詢</button>
       <button class="btn line sm" id="watchToggleBtn" data-watch-symbol="${s.c}">${isWatched(s.c)?'移出自選':'加入自選'}</button>
     </div>
   </div>

   <div class="card">
     <div class="card-h"><h3>技術分析 · 近 60 日</h3><span class="tag">K 線 + 量 + 5/10/20/60MA</span>
       <div class="seg" style="margin-left:auto"><button class="on">日線</button><button>週線</button></div></div>
     <div class="card-pad">
       <canvas id="cK" style="width:100%;height:340px;display:block"></canvas>
       <canvas id="cV" style="width:100%;height:96px;display:block;margin-top:8px"></canvas>
       <div style="display:flex;gap:18px;font-size:11.5px;color:var(--ink-2);margin-top:10px;flex-wrap:wrap">
         <span><b style="color:#F59E0B">━</b> 5MA</span><span><b style="color:#2563EB">━</b> 10MA</span>
         <span><b style="color:#7C3AED">━</b> 20MA</span><span><b style="color:#0F172A">━</b> 60MA</span>
         <span style="margin-left:auto;color:var(--ink-3)">${s.levelText||'支撐 / 壓力：資料計算中'}</span>
       </div>
     </div>
   </div>

   <div class="grid" style="grid-template-columns:1fr 1fr">
     <div class="card"><div class="card-h"><h3>技術指標</h3></div>
       <div class="card-pad" style="display:flex;flex-direction:column;gap:14px">
         <div><div style="font-size:12px;color:var(--ink-2);margin-bottom:5px">KD（9,3,3）<b class="${s.tech?.kdClass||''}" style="float:right">${s.tech?.kdText||'尚無足夠歷史資料'}</b></div><canvas id="cKD" style="width:100%;height:80px;display:block"></canvas></div>
         <div><div style="font-size:12px;color:var(--ink-2);margin-bottom:5px">MACD <b class="${s.tech?.macdClass||''}" style="float:right">${s.tech?.macdText||'尚無足夠歷史資料'}</b></div><canvas id="cMD" style="width:100%;height:80px;display:block"></canvas></div>
         <div><div style="font-size:12px;color:var(--ink-2);margin-bottom:5px">RSI（14）<b class="${s.tech?.rsiClass||''}" style="float:right">${s.tech?.rsiText||'尚無足夠歷史資料'}</b></div><canvas id="cRS" style="width:100%;height:80px;display:block"></canvas></div>
       </div>
     </div>
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
        if(prev&&prev.c) DATA.stock.dp=+(((last.c-prev.c)/prev.c)*100).toFixed(2);
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
  if(customContent){
    return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
      <div class="card">
        <div class="card-h"><h3>${DATA.meta.date}（${DATA.meta.weekday}）盤後報告</h3><span class="tag">管理員編輯版</span></div>
        <div class="card-pad" style="line-height:1.85;font-size:14.5px;white-space:pre-wrap">${esc(customContent)}</div>
      </div>
      <div class="card"><div class="card-h"><h3>推薦股票</h3><span class="tag">管理員可於後台修改</span></div>
        <div class="quote-list">${customPicks.map(p=>quoteStockCard({...stockKnownInfo(p.c),...p,theme:p.t}, {actions:`<span class="badge hot">分數 ${p.fs??'—'}</span><span class="muted" style="font-size:12px">${esc(p.ai||'')}</span>`})).join('')}</div>
      </div>
    </div>`;
  }
  const note=String(draft.content||'').trim();
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card">
     <div class="card-h"><h3>${DATA.meta.date}（${DATA.meta.weekday}）盤後報告</h3>
       <span class="tag">${sourceReal?'Supabase 真實資料':'資料不足，顯示可用資料'}</span></div>
     <div class="card-pad" style="line-height:1.85;font-size:14.5px">
       <p><b>一、今日市場總結</b><br>
       加權指數 <b class="num ${dcls(m.twse.dp)}">${fmtPx(m.twse.v)}</b>（${sgn(Number(m.twse.dp||0).toFixed(2))}%），
       櫃買指數 <b class="num ${dcls(m.tpex.dp)}">${fmtPx(m.tpex.v)}</b>（${sgn(Number(m.tpex.dp||0).toFixed(2))}%）。
       上漲 ${m.up} 家、下跌 ${m.down} 家。${sourceReal?'':'目前資料來源不足，請先執行資料更新。'}</p>

       <p style="margin-top:14px"><b>二、今日強勢題材</b></p>
       <ol style="margin:6px 0 0 22px">
       ${topThemes.length?topThemes.map(t=>`<li style="margin:3px 0">${t.name}　<span class="muted" style="font-size:13px">熱度 ${t.score} · ${t.status} · 平均 ${t.gain}</span></li>`).join(''):'<li class="muted">尚無題材熱度資料</li>'}
       </ol>

       <p style="margin-top:14px"><b>三、今日精選股票</b></p>
       ${topPicks.length?`<div class="quote-list" style="margin-top:8px">${topPicks.map(p=>quoteStockCard(p,{actions:`<span class="badge hot">總分 ${p.fs??p.total??'—'}</span><span class="muted" style="font-size:12px">${esc(p.ai||'')}</span>`})).join('')}</div>`:'<div class="muted" style="margin-top:8px">尚無精選股票資料</div>'}

       <p style="margin-top:14px"><b>四、今日風險股票</b><br>
       ${risks.length?risks.map(r=>`${r.c} ${r.n}（${r.type}）`).join('、'):'尚無真實風險清單資料'}。</p>

       <p style="margin-top:14px"><b>五、今日重大公告</b><br>
       ${topNews.length?topNews.map(n=>`${n.c&&n.c!=='-'?n.c+' '+n.n+'：':''}${n.title}`).join('；'):'尚無重大公告資料'}。</p>

       <p style="margin-top:14px"><b>六、明日觀察重點</b><br>
       觀察 ${topThemes.slice(0,3).map(t=>t.name).join('、')||'主流題材'} 是否延續量價強度，並追蹤精選股是否維持技術分與籌碼分同步改善。</p>
       ${note?`<p style="margin-top:14px"><b>管理員備註</b><br>${esc(note).replace(/\n/g,'<br>')}</p>`:''}
     </div>
   </div>
   <div class="card card-pad" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
     <span class="badge ${sourceReal?'good':'warm'}">${sourceReal?'真實資料報告':'等待資料更新'}</span>
     <span style="font-size:13px;color:var(--ink-2)">報告內容只使用目前資料庫已載入的市場、題材、候選股與公告資料，不再混入固定範例文字。</span>
   </div>
  </div>`;
}

/* ============ 6. AI 量化模擬操盤實驗室 ============ */
let AI_VIEW=null;
function vAI(){
  if(AI_VIEW) return vAIDetail(AI_VIEW);
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad" style="background:linear-gradient(120deg,#EFF6FF,#fff)">
     <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
       <div style="width:42px;height:42px;border-radius:12px;background:var(--primary);display:flex;align-items:center;justify-content:center">
         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg></div>
       <div><b style="font-size:17px">AI 量化模擬操盤實驗室</b>
       <div style="font-size:12.5px;color:var(--ink-2);margin-top:2px">候選池 → AI 初篩 → 歷史回測 → FinMind 詳細分析 → 模擬交易 → 多 AI 檢討 → 策略升版</div></div>
     </div>
   </div>

   <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;font-size:12px;color:var(--ink-2)">
     ${['主系統盤後資料','每日篩選候選池','3 AI 各自選股','主庫歷史回測','FinMind 詳細分析','AI 綜合評分','模擬買進','持股追蹤','多 AI 檢討','策略升版'].map((s,i,a)=>
       `<span style="background:#fff;border:1px solid var(--border);padding:7px 12px;border-radius:99px;white-space:nowrap;font-weight:600">${i+1}. ${s}</span>${i<a.length-1?'<span style="display:flex;align-items:center;color:var(--ink-3)">›</span>':''}`).join('')}
   </div>

   <div class="grid stagger" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
   ${DATA.agents.map(a=>`<div class="card" style="cursor:pointer;transition:.15s" data-ai="${a.id}" onmouseover="this.style.boxShadow='var(--shadow-lg)'" onmouseout="this.style.boxShadow='var(--shadow)'">
     <div class="card-pad" style="border-bottom:1px solid var(--border-soft)">
       <div style="display:flex;align-items:center;gap:10px"><b style="font-size:16px">${a.name}</b>
       <span class="badge ${a.status==='運行中'?'cool':'obs'}" style="margin-left:auto">${a.status}</span></div>
       <div style="font-size:12px;color:var(--ink-3);margin-top:3px">${a.type} · 策略 ${a.ver}</div>
       <p style="font-size:12.5px;color:var(--ink-2);margin-top:9px;line-height:1.5">${a.desc}</p>
     </div>
     <div class="grid" style="grid-template-columns:1fr 1fr;gap:0">
       ${[['今日初篩',a.pre+' 檔'],['回測通過',a.passed+' 檔'],['今日模擬買進',a.buy+' 檔'],['回測平均勝率',a.wr],
          ['累積報酬率',a.cum,'up'],['本月報酬',a.mon,'up'],['勝率',a.win],['最大回撤',a.mdd,'down']].map((r,i)=>
         `<div style="padding:13px 18px;border-right:${i%2===0?'1px solid var(--border-soft)':'none'};border-bottom:1px solid var(--border-soft)">
         <div style="font-size:11px;color:var(--ink-3);font-weight:600">${r[0]}</div>
         <div class="num ${r[2]||''}" style="font-size:17px;font-weight:800;margin-top:2px">${r[1]}</div></div>`).join('')}
     </div>
     <div class="card-pad" style="display:flex;align-items:center"><span style="font-size:12px;color:var(--ink-2)">目前持股 <b>${a.pos}</b> 檔</span>
       <span class="more" style="margin-left:auto">查看 AI 詳細 →</span></div>
   </div>`).join('')}
   </div>
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
    DATA.aiBuy=trades.filter(t=>t.trade_type==='買進').slice(0,20).map(t=>({
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
     DATA.aiPos.map(p=>{const pnl=(p.cp-p.bp)*p.q*1000;const ret=((p.cp-p.bp)/p.bp*100);const td=Number(p.prev)?(p.cp-Number(p.prev))*p.q*1000:NaN;
       return `<tr><td class="code">${p.c}</td><td><b>${p.n}</b></td><td class="code">${p.bd}</td><td class="r num">${fmtPx(p.bp)}</td>
       <td class="r num">${fmtPx(p.cp)}</td><td class="r num">${p.q}</td><td class="r num">${(p.cp*p.q*1000).toLocaleString()}</td>
       <td class="r num ${td>=0?'up':'down'}">${Number.isFinite(td)?sgn(Math.round(td).toLocaleString()):'—'}</td>
       <td class="r num ${pnl>=0?'up':'down'}">${sgn(Math.round(pnl).toLocaleString())}</td>
       <td class="r num ${ret>=0?'up':'down'}">${sgn(ret.toFixed(1))}%</td></tr>`;}).join('')))}

   <div class="grid" style="grid-template-columns:1fr 1fr">
     ${blk('3 · 買進紀錄','',tbl([['日期'],['股票'],['價格','r'],['張','r'],['分','r'],['原因']],
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

/* ============ 7. 後台管理 ============ */
function vAdmin(){
  if(!isAdmin()){
    return `<div class="fade account-grid">
      <div class="card card-pad auth-panel">
        <h3 style="font-size:18px;margin-bottom:10px">需要管理員登入</h3>
        <div class="muted" style="font-size:13.5px;line-height:1.7">後台管理、板塊開通設定與使用天數設定只開放管理員帳號操作。</div>
        <div style="margin-top:14px"><span class="badge warm">請使用 Supabase app_users 內 role=admin 的帳號</span></div>
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
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad" style="background:var(--accent-soft);border-color:var(--accent)">
     <b style="font-size:13.5px">📌 說明</b>
     <div style="font-size:13px;color:var(--ink-2);margin-top:6px;line-height:1.6">
       股票、題材、AI 資料皆由系統每日盤後自動抓取與計算維護，此處為檢視。
       「開通設定」可設定板塊是否開通與使用天數。</div>
   </div>
   <div class="seg" style="flex-wrap:wrap" id="admSeg">
     ${[
       ['開通設定',4],['維修狀態',5],['股票資料',0],['題材分類',1],['篩選參數',2],['每日報告',3],['AI 機器人',6]
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

