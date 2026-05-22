let SRC_STATUS = '載入中…';
const STATUS_LABELS={
  fetch_twse_prices:'TWSE 每日收盤資料',
  fetch_tpex_prices:'TPEX 每日收盤資料',
  fetch_twse_inst:'TWSE 法人買賣超',
  tpex_inst:'TPEX 法人買賣超',
  fetch_twse_margin:'TWSE 融資融券',
  fetch_mops_announcements:'MOPS 重大訊息',
  fetch_monthly_revenue:'MOPS 月營收',
  fetch_mis_daily_prices:'MIS 即時盤後報價',
  fetch_realtime_quotes:'MIS 即時盤中報價',
  fetch_stock_classes:'股票類股分類',
  fetch_company_info:'公司基本資料',
  fetch_index:'市場指數',
  validate_mis_quotes:'MIS 收盤價校驗',
  compute_signals:'每日訊號計算',
  run_ai_lab:'AI 實驗室',
  run_ai_intraday:'AI 即時候選 / 持股'
};
function fmtDoneTime(v){
  if(!v) return '—';
  const d=new Date(v);
  if(Number.isNaN(d.getTime())) return String(v).slice(0,16);
  return d.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
}
function fmtTwAmount(v){
  const n=Number(v);
  if(!isFinite(n)) return '—';
  if(Math.abs(n)>=1e8) return `${(n/1e8).toLocaleString('en-US',{maximumFractionDigits:0})} 億`;
  if(Math.abs(n)>=1e4) return `${(n/1e4).toLocaleString('en-US',{maximumFractionDigits:0})} 萬`;
  return Math.round(n).toLocaleString('en-US');
}
function parseMarketChartSource(v){
  try{
    const data=JSON.parse(String(v||'{}'));
    return Array.isArray(data.points)?data:null;
  }catch(_){return null;}
}
function visitorId(){
  try{
    let id=localStorage.getItem('stocklab_visitor_id');
    if(!id){
      id=(crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(16).slice(2);
      localStorage.setItem('stocklab_visitor_id',id);
    }
    return id;
  }catch(_){
    return String(Date.now())+'-'+Math.random().toString(16).slice(2);
  }
}
async function publicHeartbeatOnline(){
  try{
    await fetch(EDGE_ADMIN_WRITE_URL,{
      method:'POST',
      headers:{apikey:SB_ANON,'Content-Type':'application/json'},
      body:JSON.stringify({action:'public_heartbeat',payload:{visitor_id:visitorId()}})
    });
  }catch(e){
    console.warn('public heartbeat 略過:',e);
  }
}
function chunks(arr,size){
  const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out;
}
function normMarket(v){
  const s=String(v||'').trim().toUpperCase();
  if(s==='TPEX' || s==='OTC' || s.includes('上櫃') || s.includes('櫃買')) return 'TPEX';
  if(s==='TWSE' || s.includes('上市') || s.includes('證交')) return 'TWSE';
  return '';
}
function normThemeText(v){
  return String(v||'').toLowerCase().replace(/[ \t\r\n/／、,，()（）\[\]【】・·\-＿_]/g,'');
}
function themeAliases(name){
  const n=normThemeText(name);
  const base=[n];
  const plain=String(name||'').split('·').pop().replace(/^(上市|上櫃)\s*/,'').trim();
  const p=normThemeText(plain);
  if(p && p!==n) base.push(p);
  const groups=[
    ['玻纖布','玻織布','玻璃纖維布','玻璃纖維','玻纖','玻璃玻纖'],
    ['pcb','ccl','銅箔基板','電路板','印刷電路板'],
    ['玻璃基板','玻璃載板','先進封裝玻璃'],
    ['ai伺服器','伺服器','aiserver','ai'],
    ['散熱','熱傳','液冷','散熱模組'],
    ['面板','顯示器','lcd'],
    ['營建','建設','營造','建材'],
    ['航運','貨櫃','散裝','航空'],
    ['生技醫療','生技','醫療','製藥'],
    ['油電燃氣','油電','燃氣','電力'],
    ['食品','食物','飲料'],
    ['半導體','ic','晶圓','封測']
  ].map(g=>g.map(normThemeText));
  groups.forEach(g=>{if(g.some(x=>n.includes(x)||x.includes(n))) base.push(...g);});
  return [...new Set(base.filter(Boolean))];
}
function themeStockMatched(themeName, stockInfo, linkInfo={}){
  const name=String(themeName||'').trim();
  if(!name || name==='其他') return true;
  const aliases=themeAliases(name);
  const tags=Array.isArray(stockInfo.theme_tags)?stockInfo.theme_tags.join(' '):String(stockInfo.theme_tags||'');
  const hay=normThemeText([
    stockInfo.industry, tags, stockInfo.theme, linkInfo.role,
    linkInfo.supply_chain_level, linkInfo.note
  ].filter(Boolean).join(' '));
  if(!hay) return false;
  return aliases.some(a=>hay.includes(a) || a.includes(hay));
}
async function loadNameMap(symbols, dateHint){
  const wanted=[...new Set((symbols||[]).map(s=>String(s||'').trim()).filter(Boolean))];
  const map={};
  const validName=(name,sym)=>{
    const n=String(name||'').trim();
    return n && n!==sym && n!=='尚無名稱' && n!=='—' && n!=='-';
  };
  if(!wanted.length) return map;
  try{
    const rows=await sbGet('stocks?select=symbol,name,industry,market,theme_tags',20000);
    (rows||[]).forEach(r=>{
      const sym=String(r.symbol||'').trim();
      if(sym && wanted.includes(sym)) map[sym]={name:validName(r.name,sym)?String(r.name).trim():'',industry:r.industry,market:r.market,theme_tags:r.theme_tags};
    });
  }catch(_){}
  const missingFromAll=wanted.filter(sym=>!map[sym]||!validName(map[sym].name,sym));
  for(const part of chunks(missingFromAll,40)){
    try{
      const rows=await sbGet(
        `stocks?select=symbol,name,industry,market,theme_tags&symbol=in.(${part.join(',')})`,2000);
      (rows||[]).forEach(r=>{
        const sym=String(r.symbol||'').trim();
        if(sym && wanted.includes(sym) && validName(r.name,sym)){
          map[sym]={name:String(r.name).trim(),industry:r.industry,market:r.market,theme_tags:r.theme_tags};
        }
      });
    }catch(_){}
  }
  try{
    const q=dateHint
      ? `candidate_pool?select=symbol,name&date=eq.${dateHint}&order=id.desc`
      : 'candidate_pool?select=symbol,name&order=date.desc';
    const rows=await sbGet(q,20000);
    (rows||[]).forEach(r=>{
      const sym=String(r.symbol||'').trim();
      if(sym && wanted.includes(sym) && validName(r.name,sym) && (!map[sym]||!validName(map[sym].name,sym))){
        map[sym]={...(map[sym]||{}),name:String(r.name).trim()};
      }
    });
  }catch(_){}
  const missing=wanted.filter(sym=>!map[sym]||!validName(map[sym].name,sym));
  for(const part of chunks(missing,40)){
    try{
      const rows=await sbGet(
        `candidate_pool?select=symbol,name&symbol=in.(${part.join(',')})&order=date.desc&limit=2000`,2000);
      (rows||[]).forEach(r=>{
        const sym=String(r.symbol||'').trim();
        if(sym && wanted.includes(sym) && validName(r.name,sym) && (!map[sym]||!validName(map[sym].name,sym))){
          map[sym]={...(map[sym]||{}),name:String(r.name).trim()};
        }
      });
    }catch(_){}
  }
  return map;
}
async function loadMarketMap(symbols){
  const wanted=[...new Set((symbols||[]).map(s=>String(s||'').trim()).filter(Boolean))];
  const map={};
  if(!wanted.length) return map;
  for(const part of chunks(wanted,80)){
    try{
      const rows=await sbGet(`stocks?select=symbol,market&symbol=in.(${part.join(',')})`,4000);
      (rows||[]).forEach(r=>{
        const sym=String(r.symbol||'').trim();
        const mk=normMarket(r.market);
        if(sym && mk) map[sym]=mk;
      });
    }catch(_){}
  }
  return map;
}
async function loadLatestPriceMap(symbols, dateHint){
  const wanted=[...new Set((symbols||[]).map(s=>String(s||'').trim()).filter(Boolean))];
  const map={};
  if(!wanted.length) return map;
  try{
    const rows=await sbGet(
      `daily_prices?select=symbol,close,change_percent,volume&date=eq.${dateHint}`,20000);
    (rows||[]).forEach(r=>{const sym=String(r.symbol||'').trim(); if(wanted.includes(sym)) map[sym]=r;});
  }catch(_){}
  const missing=wanted.filter(s=>!map[s]);
  for(const part of chunks(missing,40)){
    try{
      const rows=await sbGet(
        `daily_prices?select=symbol,date,close,change_percent,volume&symbol=in.(${part.join(',')})&order=date.desc&limit=2000`,2000);
      (rows||[]).forEach(r=>{
        const sym=String(r.symbol||'').trim();
        if(sym && !map[sym]) map[sym]=r;
      });
    }catch(_){}
  }
  return map;
}
function emptyDist(){return {up:0,down:0,flat:0,limitUp:0,limitDown:0,amount:0,count:0};}
function addDist(dist,r){
  const ch=Number(r.change), cp=Number(r.change_percent), amt=Number(r.amount)||0;
  const mv=isFinite(ch)&&ch!==0?ch:(isFinite(cp)?cp:0);
  if(mv>0) dist.up++; else if(mv<0) dist.down++; else dist.flat++;
  if(isFinite(cp)&&cp>=9.5) dist.limitUp++;
  if(isFinite(cp)&&cp<=-9.5) dist.limitDown++;
  dist.amount+=amt;
  dist.count++;
}
function buildClassThemesFromCaches(){
  const stockMap=DATA.stockMap||{}, priceMap=DATA.priceMap||{};
  const groups={};
  Object.keys(priceMap).forEach(sym=>{
    const st=stockMap[sym]||{}, px=priceMap[sym]||{};
    const industry=String(st.industry||'').trim();
    const market=normMarket(st.market||px.market);
    if(!/^[1-9]\d{3}$/.test(sym) || !industry || !market) return;
    const label=market==='TPEX'?'上櫃':'上市';
    const name=`${label} · ${industry}`;
    const g=groups[name]||(groups[name]={name,market,label,industry,stocks:[],amount:0,changeSum:0,changeN:0});
    const cp=Number(px.change_percent);
    const amt=Number(px.amount)||0;
    g.amount+=amt;
    if(Number.isFinite(cp)){g.changeSum+=cp;g.changeN++;}
    g.stocks.push({
      c:sym,n:st.name||sym,role:'成分',level:industry,score:70,
      note:'',px:Number(px.close),dp:cp,vol:Number(px.volume)
    });
  });
  return Object.values(groups).map((g,i)=>{
    const avg=g.changeN?g.changeSum/g.changeN:0;
    g.stocks.sort((a,b)=>(Number(b.vol)||0)-(Number(a.vol)||0));
    return {
      id:`class-${g.market}-${i}`,themeId:`class-${g.market}-${i}`,
      name:g.name,score:Math.max(1,Math.min(99,Math.round(60+avg*3+Math.min(g.stocks.length,80)/4))),
      gain:(avg>=0?'+':'')+avg.toFixed(2)+'%',vol:'—',
      status:avg>=1.5?'強勢':(avg<=-1.5?'偏弱':'一般'),
      desc:`${g.name}：成分 ${g.stocks.length} 檔，平均漲幅 ${avg.toFixed(2)}%，成交金額 ${(g.amount/100000000).toFixed(2)} 億。`,
      chain:g.industry,stocks:g.stocks
    };
  }).filter(t=>t.stocks.length).sort((a,b)=>{
    const am=a.name.startsWith('上市')?0:1, bm=b.name.startsWith('上市')?0:1;
    return am-bm || b.score-a.score;
  });
}
function applyRealtimeQuotes(rows, options={}){
  if(!Array.isArray(rows)||!rows.length) return;
  const merge=options.merge===true;
  if(!merge) DATA.realtimeMap={};
  const newest=rows.slice().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0];
  rows.forEach(r=>{
    const sym=String(r.symbol||'').trim();
    const market=String(r.market||'').trim();
    const price=Number(r.price);
    if(!sym || !Number.isFinite(price)) return;
    const rawVolume=Number(r.volume);
    const source=String(r.source||'');
    const quoteVolume=Number.isFinite(rawVolume) && /TWSE_MIS_EDGE/i.test(source) && (market==='TWSE' || market==='TPEX')
      ? rawVolume*1000
      : rawVolume;
    const q={
      symbol:sym,name:r.name,market,
      close:price,price,
      change:Number(r.change),
      change_percent:Number(r.change_percent),
      volume:quoteVolume,
      amount:Number(r.amount),
      source:r.source,
      date:r.quote_date,
      quote_time:r.quote_time,
      updated_at:r.updated_at
    };
    if(market==='TWSE_CHART' || market==='TPEX_CHART'){
      const chart=parseMarketChartSource(r.source);
      const target=market==='TWSE_CHART'?'twse':'tpex';
      const amount=Number(r.amount);
      DATA.market[target+'Chart']=chart;
      if(Number.isFinite(amount) && amount>0){
        if(target==='twse') DATA.market.amtTwse=fmtTwAmount(amount);
        else DATA.market.amtTpex=fmtTwAmount(amount);
        const tw=Number(String(DATA.market.amtTwse||'').replace(/[^\d.-]/g,''))||0;
        const tp=Number(String(DATA.market.amtTpex||'').replace(/[^\d.-]/g,''))||0;
        if(tw||tp) DATA.market.amtTotal=`${(tw+tp).toLocaleString('en-US',{maximumFractionDigits:0})} 億`;
      }
      return;
    }
    if(market==='TWSE_INDEX'){
      DATA.market.twse={name:'加權指數',v:price,d:q.change,dp:q.change_percent};
      return;
    }
    if(market==='TPEX_INDEX'){
      DATA.market.tpex={name:'櫃買指數',v:price,d:q.change,dp:q.change_percent};
      return;
    }
    if(market==='TAIFEX'){
      if(sym==='TAIWANVIX' || /VIX|波動率/i.test(String(r.name||''))){
        DATA.market.vix={
          name:r.name||'臺指選擇權波動率指數',
          v:price,
          d:q.change,
          dp:q.change_percent,
          source:r.source||'TAIFEX_VIX_RT',
          quote_time:r.quote_time,
          updated_at:r.updated_at
        };
        DATA.realtimeMap.TAIWANVIX=q;
      }else{
        DATA.market.txFut={name:r.name||'台指期',v:price,d:q.change,dp:q.change_percent,source:r.source||'TAIFEX_MIS_RT',quote_time:r.quote_time,updated_at:r.updated_at};
        appendTxfChartPoints(DATA.market.txFut, r);
      }
      return;
    }
    if(/^[1-9]\d{3}$/.test(sym)){
      DATA.realtimeMap[sym]=q;
      DATA.priceMap=DATA.priceMap||{};
      DATA.priceMap[sym]={...(DATA.priceMap[sym]||{}),...q};
      DATA.stockMap=DATA.stockMap||{};
      DATA.stockMap[sym]={...(DATA.stockMap[sym]||{}),symbol:sym,name:r.name||DATA.stockMap[sym]?.name,market:market||DATA.stockMap[sym]?.market};
    }
  });
  if(newest){
    DATA.meta.updated=fmtDoneTime(newest.updated_at);
    DATA.meta.realtimeUpdated=fmtDoneTime(newest.updated_at);
  }
}
const REAL_CACHE_KEY='stockLabRealCache:v16';
const REAL_CACHE_TTL=1000*60*60*18;
const REAL_CACHE_FIELDS=[
  'meta','market','themes','themeList','chain','picks','news','risks','screen',
  'agents','aiCand','aiBack','aiDeep','aiTrades','aiReviews','aiVersions',
  'dataStatus','appSettings','realNewsLoaded','stockMap','priceMap','realtimeMap','maintenance'
];
function saveRealCache(){
  try{
    const payload={savedAt:Date.now(),data:{}};
    REAL_CACHE_FIELDS.forEach(k=>{payload.data[k]=DATA[k];});
    localStorage.setItem(REAL_CACHE_KEY,JSON.stringify(payload));
  }catch(e){ console.warn('真實資料快取儲存略過:',e); }
}
function restoreRealCache(){
  try{
    const raw=localStorage.getItem(REAL_CACHE_KEY);
    if(!raw) return false;
    const payload=JSON.parse(raw);
    if(!payload || !payload.data || !payload.savedAt) return false;
    if(Date.now()-Number(payload.savedAt)>REAL_CACHE_TTL) return false;
    Object.keys(payload.data).forEach(k=>{DATA[k]=payload.data[k];});
    DATA_REAL_READY=true;
    DATA_FROM_CACHE=true;
    DATA_LOAD_ERROR='';
    SRC_STATUS='⚡ 先顯示上次成功載入資料 · 背景更新中';
    return true;
  }catch(e){
    console.warn('真實資料快取載入略過:',e);
    return false;
  }
}

/* 嘗試用真實資料覆蓋 DATA.*；任何錯誤都退回假資料，畫面不壞。
   來源狀態只顯示在「資料更新狀態」頁，避免干擾主畫面。 */
async function loadReal(){
  try{
    // 直接問資料庫「最大的交易日」（排序取 1 筆，最穩，不受筆數上限影響）
    const newest = await sbGet('daily_prices?select=date&order=date.desc&limit=1');
    if(!Array.isArray(newest) || newest.length===0){
      throw new Error('資料庫尚無 daily_prices 資料');
    }
    const todayStr = new Date().toISOString().slice(0,10);
    let d = String(newest[0].date).slice(0,10);
    // 萬一最大日落在未來（資料異常），退而取 <= 今天的最大日
    if(d > todayStr){
      const safe = await sbGet(
        `daily_prices?select=date&date=lte.${todayStr}&order=date.desc&limit=1`);
      if(Array.isArray(safe) && safe.length) d = String(safe[0].date).slice(0,10);
    }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){
      throw new Error('找不到有效交易日');
    }
    try{
      const dates=await sbGet('daily_prices?select=date&order=date.desc&limit=8',500);
      const uniq=[...new Set((dates||[]).map(r=>String(r.date).slice(0,10)).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))];
      for(const cand of uniq){
        const n=await cnt(`daily_prices?select=symbol&date=eq.${cand}`);
        if(n>=1000){ d=cand; break; }
      }
    }catch(e){ console.warn('完整交易日檢查略過:',e); }
    console.log('[stock-lab] 採用最近交易日:', d);

    // 用 Prefer:count 拿總筆數，比抓全部 symbol 再 .length 穩又省流量
    async function cnt(q){
      const r = await fetch(`${SB_URL}/rest/v1/${q}`,{
        headers:{ apikey:SB_ANON, Authorization:`Bearer ${SB_ANON}`,
                  Prefer:'count=exact', Range:'0-0' }});
      const cr = r.headers.get('content-range') || '';
      const m = cr.match(/\/(\d+)$/);
      return m ? parseInt(m[1],10) : 0;
    }
    DATA.meta.date = d.replace(/-/g,'/');

    // 今日漲跌家數 / 成交金額 / 漲跌停，全部由 daily_prices 最新交易日彙總
    try{
      const dayRows = await sbGet(
        `daily_prices?select=symbol,close,change,change_percent,amount,volume,market&date=eq.${d}`, 20000);
      if(Array.isArray(dayRows) && dayRows.length){
        DATA.priceMap={};
        const twse=emptyDist(), tpex=emptyDist(), other=emptyDist();
        const marketMap=await loadMarketMap(dayRows.filter(r=>!normMarket(r.market)).map(r=>r.symbol));
        dayRows.forEach(r=>{
          const sym=String(r.symbol||'').trim();
          if(sym) DATA.priceMap[sym]=r;
          const mk=normMarket(r.market) || marketMap[sym] || '';
          if(mk==='TPEX') addDist(tpex,r);
          else if(mk==='TWSE') addDist(twse,r);
          else addDist(other,r);
        });
        const up=twse.up+tpex.up+other.up, down=twse.down+tpex.down+other.down, flat=twse.flat+tpex.flat+other.flat;
        const limitUp=twse.limitUp+tpex.limitUp+other.limitUp, limitDown=twse.limitDown+tpex.limitDown+other.limitDown;
        DATA.market.up=up; DATA.market.down=down; DATA.market.flat=flat;
        DATA.market.limitUp=limitUp; DATA.market.limitDown=limitDown;
        DATA.market.twseDist=twse;
        DATA.market.tpexDist=tpex;
        DATA.market.amtTwse=fmtTwAmount(twse.amount);
        DATA.market.amtTpex=fmtTwAmount(tpex.amount);
        DATA.market.amtTotal=fmtTwAmount(twse.amount+tpex.amount+other.amount);
        const breadth=up+down?up/(up+down):0.5;
        DATA.market.status=breadth>=0.58?'偏多格局':(breadth<=0.42?'偏空格局':'多空拉鋸');
        DATA.market.statusNote=`上市 ${twse.up} 漲 / ${twse.down} 跌；上櫃 ${tpex.up} 漲 / ${tpex.down} 跌。漲停 ${limitUp}、跌停 ${limitDown}。`;
      }
    }catch(e){ console.warn('市場分布彙總略過:',e); }
    try{
      const rows=await sbGet('stocks?select=symbol,name,industry,market,theme_tags',20000);
      DATA.stockMap={};
      (rows||[]).forEach(r=>{
        const sym=String(r.symbol||'').trim();
        if(sym) DATA.stockMap[sym]=r;
      });
    }catch(e){ console.warn('股票基本資料快取略過:',e); }
    try{
      const rq=await sbGet('realtime_quotes?select=symbol,name,market,quote_date,quote_time,price,change,change_percent,volume,amount,source,updated_at&order=updated_at.desc',20000);
      applyRealtimeQuotes(rq);
    }catch(e){ console.warn('即時報價載入略過:',e); }

    // 大盤指數（真實，取最新一日）
    try{
      const idx = await sbGet(
        `market_index?select=market,index_value,change,change_percent,amount&date=eq.${d}`, 10);
      (idx||[]).forEach(r=>{
        const v=Number(r.index_value);
        const ch=r.change!=null?Number(r.change):0;
        let dp=r.change_percent!=null?Number(r.change_percent):0;
        if(isFinite(v) && isFinite(ch) && (!isFinite(dp) || Math.abs(dp)<0.001) && Math.abs(ch)>0.001 && Math.abs(v-ch)>0.001){
          dp=ch/(v-ch)*100;
        }
        const o={ name:(r.market==='TWSE'?'加權指數':(r.market==='TXF'?'台指期':'櫃買指數')),
          v,
          d:ch,
          dp };
        if(r.market==='TWSE') DATA.market.twse=o;
        else if(r.market==='TPEX') DATA.market.tpex=o;
        else if(r.market==='TXF' && DATA.market.txFut?.source!=='TAIFEX_MIS_RT') DATA.market.txFut=o;
        if(r.market==='TWSE' && Number(r.amount)>0 && !DATA.market.twseChart) DATA.market.amtTwse=fmtTwAmount(r.amount);
        if(r.market==='TPEX' && Number(r.amount)>0 && !DATA.market.tpexChart) DATA.market.amtTpex=fmtTwAmount(r.amount);
      });
      const twAmt=(idx||[]).find(r=>r.market==='TWSE'&&r.amount!=null);
      const tpAmt=(idx||[]).find(r=>r.market==='TPEX'&&r.amount!=null);
      if(twAmt&&tpAmt && Number(twAmt.amount)>0 && Number(tpAmt.amount)>0 && !DATA.market.twseChart && !DATA.market.tpexChart) DATA.market.amtTotal=fmtTwAmount(Number(twAmt.amount)+Number(tpAmt.amount));
    }catch(e){ console.warn('指數載入略過:',e); }

    // 精選股：以 daily_signals 綜合分前 8（符合「系統綜合評分篩出」）
    const sigTop = await sbGet(
      `daily_signals?select=symbol,technical_score,chip_score,theme_score,final_score,summary`+
      `&date=eq.${d}&order=final_score.desc&limit=8`);
    if(Array.isArray(sigTop) && sigTop.length){
      const sigSymbols=[...new Set(sigTop.map(s=>String(s.symbol||'').trim()).filter(Boolean))];
      const nameMap = await loadNameMap(sigSymbols,d);
      // 補當日價格/漲跌/量
      const pr = await sbGet(
        `daily_prices?select=symbol,close,change_percent,volume&date=eq.${d}`, 20000);
      const pm = {}; (pr||[]).forEach(x=>pm[String(x.symbol||'').trim()]=x);
      DATA.picks = sigTop.map(sg=>{
        const sym=String(sg.symbol||'').trim();
        const p = pm[sym] || (DATA.priceMap&&DATA.priceMap[sym]) || {};
        const cp = parseFloat(p.change_percent);
        const px = parseFloat(p.close);
        const vol = parseInt(p.volume);
        return {
          c:sym,
          n:(nameMap[sym]&&nameMap[sym].name)||sym,
          t:(nameMap[sym]&&nameMap[sym].industry)||'—',
          px:isFinite(px)?px:0,
          dp:isFinite(cp)?cp:0,
          vol:isFinite(vol)?vol.toLocaleString('en-US'):'—',
          ts:sg.technical_score!=null?sg.technical_score:'—',
          cs:sg.chip_score!=null?sg.chip_score:'—',
          ms:sg.theme_score!=null?sg.theme_score:'—',
          fs:sg.final_score!=null?sg.final_score:'—',
          ai:sg.summary||'—'
        };
      });
    }

    // ---- 題材熱度：讀 themes（有真實就覆蓋範例）----
    try{
      const th = await sbGet(
        'themes?select=id,theme_name,heat_score,trend_status,description'+
        '&order=heat_score.desc', 200);
      if(Array.isArray(th) && th.length){
        const seenThemes=new Set();
        DATA.themes = th.map((t,i)=>{
          const mg = String(t.description||'').match(/平均漲幅\s*(-?[\d.]+)%/);
          return {
            id:'t'+i, themeId:t.id, name:t.theme_name, score:t.heat_score,
            gain:(mg?(parseFloat(mg[1])>0?'+':'')+mg[1]+'%':'—'),
            vol:'—', limit:0, high:0,
            status:t.trend_status||'—',
            desc:t.description||'', chain:'—'
          };
        }).filter(t=>{
          const key=normThemeText(t.name);
          if(!key || seenThemes.has(key)) return false;
          seenThemes.add(key);
          return true;
        });
        DATA.themeList = DATA.themes.map(t=>t.name);
        const ts = await sbGet('theme_stocks?select=theme_id,symbol,role,supply_chain_level,relevance_score,note', 20000);
        const symbols = [...new Set((ts||[]).map(x=>String(x.symbol||'').trim()).filter(Boolean))];
        const stockMap=await loadNameMap(symbols,d);
        const priceMap=await loadLatestPriceMap(symbols,d);
        const themeById={}; DATA.themes.forEach(t=>{themeById[String(t.themeId)]=t;});
        const byTheme={};
        (ts||[]).forEach(r=>{
          const sym=String(r.symbol||'').trim();
          const sm=stockMap[sym]||{};
          const px=priceMap[sym]||{};
          const fallbackName=(DATA.stock&&DATA.stock.c===sym&&DATA.stock.n&&DATA.stock.n!==sym)?DATA.stock.n:'尚無名稱';
          const key=String(r.theme_id);
          const th=themeById[key];
          if(!th) return;
          (byTheme[key]=byTheme[key]||[]).push({
            c:sym,n:(sm.name&&sm.name!==sym)?sm.name:fallbackName,role:r.role||'成分',
            level:r.supply_chain_level||sm.industry||'未分類',
            score:r.relevance_score||0,note:r.note||'',
            px:Number(px.close),dp:Number(px.change_percent),vol:Number(px.volume)
          });
        });
        DATA.themes.forEach(t=>{t.stocks=(byTheme[String(t.themeId)]||[]).sort((a,b)=>b.score-a.score);});
        DATA.themes=DATA.themes.filter(t=>Array.isArray(t.stocks)&&t.stocks.length);
        if(!DATA.themes.length) DATA.themes=buildClassThemesFromCaches();
        DATA.themeList=DATA.themes.map(t=>t.name);
        if(!DATA.themes.some(t=>t.id===MAP_SEL)) MAP_SEL=DATA.themes[0].id;
      }
    }catch(e){ console.warn('themes 載入略過:',e); }
    if(!Array.isArray(DATA.themes) || !DATA.themes.length){
      DATA.themes=buildClassThemesFromCaches();
      DATA.themeList=DATA.themes.map(t=>t.name);
      if(DATA.themes.length && !DATA.themes.some(t=>t.id===MAP_SEL)) MAP_SEL=DATA.themes[0].id;
    }

    // ---- 重大公告：讀公開資訊觀測站公告 ----
    try{
      const anns = await sbGet(
        'mops_announcements?select=date,symbol,company_name,title,category'+
        '&order=date.desc&limit=20', 20);
      if(Array.isArray(anns) && anns.length){
        const classify=(a)=>{
          const title=String(a.title||'');
          if(/財報|營收|盈餘|損益|除權|除息|股利|現金增資|減資/i.test(title)) return {cat:'財務數據',k:'good'};
          if(/董事會|股東會|董監|委員|改選|法人說明會|審計|薪酬/i.test(title)) return {cat:'公司治理',k:'neu'};
          if(/重大|併購|收購|處分|投資|訴訟|違約|停工|停業|終止|藥證|臨床|新藥|庫藏股|全額交割|變更交易/i.test(title)) return {cat:'重大事件',k:'bad'};
          if(/澄清|說明|媒體|傳聞/i.test(title)) return {cat:'澄清回應',k:'neu'};
          return {cat:'全部',k:'neu'};
        };
        DATA.news = anns.map(a=>({
          date:String(a.date||'').slice(0,10),
          c:a.symbol||'-',
          n:a.company_name||'',
          title:a.title||'公告',
          sourceCat:a.category||'',
          cat:classify(a).cat,
          time:String(a.date||'').slice(5).replace('-','/'),
          k:classify(a).k
        })).sort((a,b)=>{
          const rank=x=>x.cat==='重大事件'?0:x.cat==='財務數據'?1:x.cat==='公司治理'?2:x.cat==='澄清回應'?3:4;
          return rank(a)-rank(b) || String(b.date).localeCompare(String(a.date));
        });
        DATA.realNewsLoaded = true;
      }else{
        DATA.realNewsLoaded = false;
      }
    }catch(e){ DATA.realNewsLoaded = false; console.warn('公告載入略過:',e); }

    // ---- 每日篩選：讀 candidate_pool（均線 + 量能條件）----
    try{
      const cp = await sbGet(
        `candidate_pool?select=symbol,name,score,reason&date=eq.${d}`+
        `&order=score.desc&limit=40`, 100);
      if(Array.isArray(cp) && cp.length){
        const cpSymbols=[...new Set(cp.map(r=>String(r.symbol||'').trim()).filter(Boolean))];
        const pm = await loadLatestPriceMap(cpSymbols,d);
        const sg2 = await sbGet(
          `daily_signals?select=symbol,technical_score,chip_score,theme_score,final_score&date=eq.${d}`, 20000);
        const sm = {}; (sg2||[]).forEach(x=>sm[x.symbol]=x);
        const nmap = await loadNameMap(cpSymbols,d);
        DATA.screen = cp.map(r=>{
          const p = pm[r.symbol]||{}; const s = sm[r.symbol]||{};
          const info = nmap[r.symbol]||{};
          const cpv = parseFloat(p.change_percent);
          const px = parseFloat(p.close);
          const vol = parseInt(p.volume);
          const lots = isFinite(vol)?fmtLots(vol)+' 張':'—';
          const theme = (Array.isArray(info.theme_tags)&&info.theme_tags.length?info.theme_tags[0]:'') || info.industry || '—';
          return {
            c:r.symbol, n:info.name||r.name||'尚無名稱',
            t:theme,
            px:isFinite(px)?px:'—',
            dp:isFinite(cpv)?cpv:0,
            vol:lots,
            reason:r.reason||'成交量 >= 1000 張；站上 MA20/MA60；均線結構轉強；20MA 上升',
            ts:s.technical_score!=null?s.technical_score:'—',
            cs:s.chip_score!=null?s.chip_score:'—',
            ms:s.theme_score!=null?s.theme_score:'—',
            total:s.final_score!=null?s.final_score:r.score
          };
        });
      }
    }catch(e){ console.warn('candidate_pool 載入略過:',e); }

    // ---- 觀察報告 ----
    try{
      const obs=await sbGet('app_observation_reports?select=symbol,name,category,note,is_active,updated_at&is_active=eq.true&order=updated_at.desc&limit=40',80);
      DATA.observations=(obs||[]).map(r=>({symbol:r.symbol,c:r.symbol,name:r.name,category:r.category,note:r.note,updated_at:r.updated_at}));
    }catch(e){ DATA.observations=[]; console.warn('app_observation_reports 載入略過:',e); }

    // ---- AI 量化實驗室：讀真實 ai_* 資料 ----
    try{
      const ags = await sbGet('ai_agents?select=*&order=id.asc', 50);
      if(Array.isArray(ags) && ags.length){
        // 取每個 agent 最新檢討、回測通過數、買進數
        const revs = await sbGet(
          'ai_reviews?select=agent_id,review_date,self_review,improvement_suggestion'+
          '&order=review_date.desc', 200);
        const bts = await sbGet(
          'ai_backtests?select=agent_id,passed,win_rate,avg_return_5d,max_drawdown', 2000);
        const trs = await sbGet(
          'ai_trades?select=agent_id,trade_type', 2000);
        const passCnt={}, buyCnt={}, lastRev={}, statRows={};
        (bts||[]).forEach(b=>{
          if(b.passed){passCnt[b.agent_id]=(passCnt[b.agent_id]||0)+1;}
          (statRows[b.agent_id]=statRows[b.agent_id]||[]).push(b);
        });
        (trs||[]).forEach(t=>{ if(t.trade_type==='買進'){buyCnt[t.agent_id]=(buyCnt[t.agent_id]||0)+1;} });
        (revs||[]).forEach(r=>{ if(!lastRev[r.agent_id]) lastRev[r.agent_id]=r; });

        DATA.agents = ags.map(a=>{
          const init=a.initial_cash||1000000, cash=a.current_cash!=null?a.current_cash:init;
          const hold=a.current_asset_value||0;
          const stats=statRows[a.id]||[];
          const avg=(key)=>stats.length?stats.reduce((s,x)=>s+(Number(x[key])||0),0)/stats.length:NaN;
          const wr=avg('win_rate'), ar=avg('avg_return_5d'), mdd=avg('max_drawdown');
          return {
            id:'ai'+a.id, _id:a.id, name:a.name, type:a.strategy_type||'—',
            pre:0, passed:passCnt[a.id]||0, buy:buyCnt[a.id]||0,
            wr:Number.isFinite(wr)?wr.toFixed(1)+'%':'—', pos:buyCnt[a.id]||0,
            cum:(((cash+hold-init)/init*100).toFixed(1))+'%',
            mon:Number.isFinite(ar)?(ar>=0?'+':'')+ar.toFixed(1)+'%':'—',
            win:Number.isFinite(wr)?wr.toFixed(1)+'%':'—',
            mdd:Number.isFinite(mdd)?mdd.toFixed(1)+'%':'—',
            ver:a.strategy_version||'v1.0', status:a.status||'運行中',
            init:init, cash:cash, hold:hold,
            desc:a.description||''
          };
        });
        await loadAIDetailData(DATA.agents[0].id);
      }
    }catch(e){ console.warn('AI 實驗室載入略過:',e); }

    // ---- 系統設定（後台篩選參數現值）----
    try{
      const st = await sbGet('app_settings?select=key,value', 100);
      if(Array.isArray(st)){
        DATA.appSettings = DATA.appSettings || {};
        st.forEach(x=>DATA.appSettings[x.key]=x.value);
        if(DATA.appSettings.daily_report_note) setReportNote(DATA.appSettings.daily_report_note);
      }
    }catch(e){ console.warn('app_settings 載入略過:',e); }
    try{
      const pm=await sbGet('app_page_maintenance?select=page_id,name,maintenance,message,updated_at&order=page_id.asc',100);
      DATA.maintenance={};
      (pm||[]).forEach(r=>{DATA.maintenance[r.page_id]={id:r.page_id,name:r.name,maintenance:!!r.maintenance,message:r.message||'',updated_at:r.updated_at};});
    }catch(e){ console.warn('app_page_maintenance 載入略過:',e); }
    try{
      if(typeof adminWrite==='function' && typeof authUser==='function' && authUser() && typeof authToken==='function' && authToken()){
        await adminWrite('heartbeat_online',{}).catch(()=>{});
      }else{
        await publicHeartbeatOnline().catch(()=>{});
      }
      const since=new Date(Date.now()-5*60*1000).toISOString();
      const on=await sbGet(`app_online_sessions?select=account,last_seen&last_seen=gte.${encodeURIComponent(since)}`,500);
      const accounts=Array.isArray(on)?[...new Set(on.map(x=>String(x.account||'')).filter(Boolean))]:[];
      const guests=accounts.filter(x=>x.startsWith('guest:')).length;
      const members=accounts.filter(x=>x && !x.startsWith('guest:')).length;
      DATA.onlineStats={members,guests,total:members+guests};
      DATA.onlineCount=members+guests;
    }catch(e){ DATA.onlineCount=0; DATA.onlineStats={members:0,guests:0,total:0}; }

    // ---- 資料來源狀態：讀每個 job 最新一筆完成紀錄 ----
    try{
      const ds = await sbGet('data_status?select=source,ok,finished_at,error,run_date&order=finished_at.desc&limit=200',200);
      const latestBySource={};
      (ds||[]).forEach(r=>{ if(r.source && !latestBySource[r.source]) latestBySource[r.source]=r; });
      const rows=Object.entries(latestBySource).map(([source,r])=>({
        k:STATUS_LABELS[source]||source,
        ok:!!r.ok,
        t:fmtDoneTime(r.finished_at),
        err:r.error||'',
        runDate:r.run_date||''
      }));
      if(rows.length) DATA.dataStatus=rows.sort((a,b)=>a.k.localeCompare(b.k,'zh-Hant'));
    }catch(e){ console.warn('data_status 載入略過:',e); }

    SRC_STATUS = '✅ 已連線真實資料 · 交易日 '+DATA.meta.date+
                 ' · 上漲 '+DATA.market.up+' / 下跌 '+DATA.market.down+
                 ' · 題材 '+DATA.themes.length+' · 候選 '+DATA.screen.length+
                 ' · AI '+(DATA.agents?DATA.agents.length:0);
    DATA_REAL_READY = true;
    DATA_FROM_CACHE = false;
    DATA_LOAD_ERROR = '';
    saveRealCache();
  }catch(e){
    console.warn('Supabase 載入失敗：', e);
    DATA_LOAD_ERROR = (e&&e.message)||String(e);
    if(DATA_FROM_CACHE){
      DATA_REAL_READY = true;
      SRC_STATUS = '⚠️ 使用上次快取資料 · Supabase 更新失敗：'+DATA_LOAD_ERROR;
    }else{
      DATA_REAL_READY = false;
      SRC_STATUS = '⚠️ 連線失敗，未顯示 MOCK 股票資料：'+DATA_LOAD_ERROR;
    }
  }
}

async function refreshRealtimeOnly(){
  try{
    const rq=await sbGet('realtime_quotes?select=symbol,name,market,quote_date,quote_time,price,change,change_percent,volume,amount,source,updated_at&order=updated_at.desc',20000);
    applyRealtimeQuotes(rq);
    saveRealCache();
    if(typeof renderTxFuture==='function') renderTxFuture();
    if(typeof updateLiveDom==='function') updateLiveDom();
    return true;
  }catch(e){
    console.warn('即時資料自動刷新略過:',e);
    return false;
  }
}

function taipeiNowParts(){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Taipei',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false
  }).formatToParts(new Date()).reduce((a,p)=>{a[p.type]=p.value;return a;},{});
  const hh=Number(parts.hour), mm=Number(parts.minute);
  return {weekday:parts.weekday,hour:hh,minute:mm,total:hh*60+mm};
}
function isTaiwanMarketOpenNow(){
  const p=taipeiNowParts();
  if(['Sat','Sun'].includes(p.weekday)) return false;
  return p.total>=9*60 && p.total<=13*60+35;
}
function isRealtimeQuoteTimeNow(){
  const p=taipeiNowParts();
  const daySession=p.total>=8*60+45 && p.total<=13*60+45;
  const nightSession=p.total>=15*60 || p.total<=5*60+5;
  if(p.weekday==='Sun') return false;
  if(p.weekday==='Sat') return p.total<=5*60+5;
  return daySession || nightSession;
}
function liveSymbolRows(){
  const out=new Map();
  const add=(s,market='')=>{
    const c=String(s&&s.c||s&&s.symbol||s||'').trim();
    if(!/^[1-9]\d{3}$/.test(c)) return;
    const st=(DATA.stockMap&&DATA.stockMap[c])||{};
    out.set(c,{symbol:c,market:market||normMarket(st.market)||''});
  };
  (typeof watchlist==='function'?watchlist():[]).forEach(add);
  (DATA.picks||[]).slice(0,12).forEach(add);
  (DATA.screen||[]).slice(0,20).forEach(add);
  (DATA.observations||[]).slice(0,30).forEach(r=>add(r.symbol||r.c));
  if(typeof atrRows==='function') (atrRows()||[]).slice(0,30).forEach(r=>add(r.c));
  (DATA.aiCand||[]).slice(0,20).forEach(add);
  (DATA.aiPos||[]).slice(0,20).forEach(add);
  if(DATA.stock&&DATA.stock.c) add(DATA.stock.c);
  return [...out.values()].slice(0,90);
}
let LIVE_EDGE_DISABLED_UNTIL=0;
async function refreshLiveEdge(){
  if(typeof EDGE_REALTIME_QUOTE_URL==='undefined' || !isRealtimeQuoteTimeNow() || document.hidden) return false;
  if(Date.now()<LIVE_EDGE_DISABLED_UNTIL) return false;
  const symbols=liveSymbolRows();
  try{
    const r=await fetch(EDGE_REALTIME_QUOTE_URL,{
      method:'POST',
      headers:{apikey:SB_ANON,Authorization:`Bearer ${SB_ANON}`,'Content-Type':'application/json'},
      body:JSON.stringify({symbols})
    });
    const text=await r.text();
    let data={};
    try{data=text?JSON.parse(text):{};}catch(_){data={error:text};}
    if(!r.ok || data.ok===false) throw new Error(data.error||`HTTP ${r.status}`);
    applyRealtimeQuotes(data.rows||[],{merge:true});
    DATA.meta.realtimeUpdated=fmtDoneTime(new Date().toISOString());
    if(data.sourceTime) DATA.meta.realtimeUpdated=data.sourceTime;
    if(DATA.stock&&DATA.stock.c&&DATA.priceMap&&DATA.priceMap[DATA.stock.c]){
      const q=DATA.priceMap[DATA.stock.c];
      DATA.stock.px=Number(q.close)||DATA.stock.px;
      DATA.stock.chg=Number(q.change);
      DATA.stock.dp=Number(q.change_percent);
      DATA.stock.vol=Number(q.volume);
      DATA.stock.amount=Number(q.amount);
    }
    if(typeof renderTxFuture==='function') renderTxFuture();
    if(typeof updateLiveDom==='function') updateLiveDom();
    return true;
  }catch(e){
    console.warn('前台即時報價略過:',e);
    LIVE_EDGE_DISABLED_UNTIL=Date.now()+60000;
    return false;
  }
}

function liveText(sel,text,cls=''){
  const el=document.querySelector(sel);
  if(!el) return;
  el.textContent=text;
  if(cls) el.className=cls;
}
function updateLiveDom(){
  if(CUR==='home'){
    const m=DATA.market||{};
    const fmt=o=>Number.isFinite(Number(o&&o.v))?fmtPx(o.v):'—';
    const diff=o=>Number.isFinite(Number(o&&o.d))&&Number.isFinite(Number(o&&o.dp))?`${sgn(Number(o.d).toFixed(2))} (${sgn(Number(o.dp).toFixed(2))}%)`:'—';
    updateMarketCardDom('twse',m.twse);
    updateMarketCardDom('tpex',m.tpex);
    updateTxFutureDom();
    liveText('[data-live="twse-v"]',fmt(m.twse),`v ${dcls(Number(m.twse&&m.twse.d))}`);
    liveText('[data-live="twse-d"]',diff(m.twse),`d ${dcls(Number(m.twse&&m.twse.d))}`);
    liveText('[data-live="tpex-v"]',fmt(m.tpex),`v ${dcls(Number(m.tpex&&m.tpex.d))}`);
    liveText('[data-live="tpex-d"]',diff(m.tpex),`d ${dcls(Number(m.tpex&&m.tpex.d))}`);
    liveText('[data-live="amt-twse"]',m.amtTwse||'—','up');
    liveText('[data-live="amt-tpex"]',m.amtTpex||'—','up');
    liveText('[data-live="amt-total"]',m.amtTotal||'—','');
    (DATA.picks||[]).slice(0,5).forEach(s=>{
      const row=document.querySelector(`[data-live-row="${s.c}"]`);
      if(!row) return;
      const info=typeof stockKnownInfo==='function'?stockKnownInfo(s.c):s;
      const px=row.querySelector('[data-live-cell="px"]');
      const dp=row.querySelector('[data-live-cell="dp"]');
      if(px) px.textContent=fmtPx(info.px);
      if(dp){dp.textContent=isFinite(Number(info.dp))?sgn(Number(info.dp).toFixed(2))+'%':'—';dp.className=`r num ${dcls(Number(info.dp))}`;}
    });
  }
  if(CUR==='watch' && typeof watchRows==='function'){
    watchRows().forEach(s=>{
      const row=document.querySelector(`[data-live-row="${s.c}"]`);
      if(!row) return;
      const px=row.querySelector('[data-live-cell="px"]');
      const dp=row.querySelector('[data-live-cell="dp"]');
      const vol=row.querySelector('[data-live-cell="vol"]');
      if(px) px.textContent=fmtPx(s.px);
      if(dp){dp.textContent=isFinite(Number(s.dp))?sgn(Number(s.dp).toFixed(2))+'%':'—';dp.className=`r num ${dcls(Number(s.dp))}`;}
      if(vol) vol.textContent=`${fmtLots(s.vol)} 張`;
    });
  }
  if(CUR==='observe' && typeof stockKnownInfo==='function'){
    (DATA.observations||[]).forEach(r=>{
      const s=stockKnownInfo(r.symbol||r.c);
      const row=document.querySelector(`[data-live-row="${s.c}"]`);
      if(!row) return;
      const px=row.querySelector('[data-live-cell="px"]');
      const dp=row.querySelector('[data-live-cell="dp"]');
      const vol=row.querySelector('[data-live-cell="vol"]');
      if(px){px.textContent=fmtPx(s.px);px.className=`num ${dcls(Number(s.dp))}`;}
      if(dp){dp.textContent=Number.isFinite(Number(s.dp))?sgn(Number(s.dp).toFixed(2))+'%':'—';dp.className=`num ${dcls(Number(s.dp))}`;}
      if(vol) vol.textContent=`${fmtLots(s.vol)} 張`;
    });
  }
  if(CUR==='stock' && DATA.stock&&DATA.stock.c&&typeof stockKnownInfo==='function'){
    const s=stockKnownInfo(DATA.stock.c);
    if(Number.isFinite(Number(s.px))){
      DATA.stock.px=s.px; DATA.stock.chg=s.chg; DATA.stock.dp=s.dp; DATA.stock.vol=s.vol; DATA.stock.amount=s.amount;
      const px=document.querySelector('[data-stock-live="px"]');
      const chg=document.querySelector('[data-stock-live="chg"]');
      const vol=document.querySelector('[data-stock-live="vol"]');
      const amount=document.querySelector('[data-stock-live="amount"]');
      if(px){px.textContent=fmtPx(s.px);px.className=`num ${dcls(Number(s.dp))} value`;}
      if(chg){
        const d=Number(s.chg), p=Number(s.dp);
        chg.textContent=`${Number.isFinite(p)&&p>=0?'▲':'▼'} ${Number.isFinite(d)?sgn(d.toFixed(2)):''}${Number.isFinite(p)?`（${sgn(p.toFixed(2))}%）`:''}`;
        chg.className=`num ${dcls(d)}`;
      }
      if(vol) vol.textContent=Number.isFinite(Number(s.vol))?`${fmtLots(s.vol)} 張`:'—';
      if(amount) amount.textContent=typeof fmtAmountValue==='function'?fmtAmountValue(s.amount):(Number.isFinite(Number(s.amount))?Number(s.amount).toLocaleString('en-US'):'—');
    }
  }
  if(CUR==='atr' && typeof syncAtrRowsWithLive==='function'){
    const rows=syncAtrRowsWithLive();
    rows.forEach(r=>{
      const row=document.querySelector(`[data-atr-row="${r.c}"]`);
      if(!row) return;
      const s=stockKnownInfo(r.c);
      const px=Number(s.px||r.current||r.entry||0);
      const atr=Number(r.atr||px*0.035||0);
      const stop=Number(r.stop||Number(r.entry)-atr*Number(r.stopMult||1));
      const take=Number(r.take||Number(r.entry)+atr*Number(r.takeMult||1.5));
      const trailBase=Math.max(Number(r.high||0),px,Number(r.entry||0));
      const movingStop=Math.max(stop,trailBase-atr*Number(r.stopMult||1));
      const takeActive=trailBase>=take;
      const movingTake=takeActive?Math.max(take,trailBase-atr*Number(r.trailAtr||0.5),trailBase*(1-Number(r.trailPct||5)/100)):take;
      const set=(name,val)=>{const el=row.querySelector(`[data-atr-cell="${name}"]`);if(el)el.textContent=val;};
      set('px',fmtPx(px)); set('stop',fmtPx(movingStop)); set('take',fmtPx(movingTake)); set('high',fmtPx(trailBase)); set('gap',Number.isFinite(px)&&px?fmtPct((px-movingStop)/px*100):'—');
      const note=row.querySelector('[data-atr-cell="take-note"]');
      if(note) note.textContent=takeActive?'已碰到初始停利位，開始移動停利':'尚未碰到初始停利位，目前先看初始停利';
    });
  }
}
function txfSessionKeyFromRow(row){
  const txt=String([row&&row.name,row&&row.source,row&&row.quote_time].filter(Boolean).join(' '));
  if(/-M|AfterHours|NIGHT|夜/i.test(txt)) return 'night';
  if(/-F|Regular|DAY|早/i.test(txt)) return 'day';
  if(typeof taipeiNowParts==='function'){
    const p=taipeiNowParts();
    return p.total>=15*60 || p.total<8*60+45 ? 'night':'day';
  }
  return 'day';
}
function appendTxfChartPoints(f,row={}){
  const pts=Array.isArray(row&&row.chart_points)?row.chart_points:[];
  if(pts.length){
    pts.forEach(pt=>appendTxfChartPoint({...f,v:Number(pt.p),quote_time:pt.t,volume:pt.a},{...row,quote_time:pt.t,volume:pt.a}));
    return;
  }
  appendTxfChartPoint(f,row);
}
function appendTxfChartPoint(f,row={}){
  const price=Number(f&&f.v);
  if(!Number.isFinite(price)) return;
  DATA.market=DATA.market||{};
  DATA.market.txfCharts=DATA.market.txfCharts||{day:{points:[]},night:{points:[]}};
  const key=txfSessionKeyFromRow({...f,...row});
  const bucket=DATA.market.txfCharts[key]||(DATA.market.txfCharts[key]={points:[]});
  const points=Array.isArray(bucket.points)?bucket.points:(bucket.points=[]);
  const label=String(f.quote_time||row.quote_time||f.updated_at||Date.now());
  const progress=txfSessionProgress(label,key);
  if(!Number.isFinite(progress)) return;
  const quoteDate=String(row.quote_date||f.quote_date||'').slice(0,10);
  if(quoteDate && bucket.quoteDate && bucket.quoteDate!==quoteDate) points.splice(0,points.length);
  if(quoteDate) bucket.quoteDate=quoteDate;
  const last=points[points.length-1];
  if(last && String(last.t||'')===label){
    last.p=price;
    last.a=Number(f.volume||row.volume)||last.a||0;
    last.x=progress;
  }else{
    points.push({t:label,p:price,a:Number(f.volume||row.volume)||0,x:progress});
  }
  points.sort((a,b)=>{
    const ax=Number(a.x), bx=Number(b.x);
    if(Number.isFinite(ax)&&Number.isFinite(bx)&&ax!==bx) return ax-bx;
    return String(a.t||'').localeCompare(String(b.t||''));
  });
  for(let i=points.length-2;i>=0;i--){
    if(String(points[i].t||'')===String(points[i+1].t||'')) points.splice(i,1);
  }
  if(points.length>360) points.splice(0,points.length-360);
}
function txfSessionProgress(label,key){
  const txt=String(label||'');
  const m=txt.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  let total=null;
  if(m) total=Number(m[1])*60+Number(m[2])+(Number(m[3]||0)/60);
  else if(typeof taipeiNowParts==='function') total=taipeiNowParts().total;
  if(!Number.isFinite(total)) return null;
  if(key==='night'){
    const start=15*60, end=29*60+5;
    let t=total<6*60 ? total+24*60 : total;
    return Math.max(0,Math.min(1,(t-start)/(end-start)));
  }
  const start=8*60+45, end=13*60+45;
  return Math.max(0,Math.min(1,(total-start)/(end-start)));
}
function updateMarketCardDom(key,o){
  const card=document.querySelector(`[data-live-card="${key}"]`);
  if(!card) return;
  const v=Number(o&&o.v), d=Number(o&&o.d), dp=Number(o&&o.dp);
  const cls=dcls(d);
  const price=card.querySelector(`[data-live="${key}-price"]`);
  const diff=card.querySelector(`[data-live="${key}-diff"]`);
  if(price){
    price.textContent=Number.isFinite(v)?fmtPx(v):'—';
    price.className=`pick-name num ${cls}`;
  }
  if(diff){
    diff.textContent=Number.isFinite(d)?`${sgn(d.toFixed(2))}${Number.isFinite(dp)?` (${sgn(dp.toFixed(2))}%)`:''}`:'—';
    diff.className=`num ${cls}`;
  }
  const chartEl=card.querySelector(`[data-live-chart="${key}"]`);
  if(chartEl && typeof marketTrendSvg==='function'){
    const chart=key==='txf' && typeof txfActiveChart==='function' ? txfActiveChart(o) : null;
    chartEl.innerHTML=marketTrendSvg(o,Number(o&&o.d)<0?'#EF4444':'#22C55E',chart,key!=='txf');
  }
}
function setLiveClass(el,base,cls){
  if(!el) return;
  el.className=[base,cls].filter(Boolean).join(' ');
}
function updateTxFutureDom(){
  const f=(DATA.market&&DATA.market.txFut)||{};
  const card=document.querySelector('[data-live-card="txf"]');
  if(!card) return;
  const sess=typeof txfSession==='function'?txfSession(f):'day';
  const v=Number(f.v), d=Number(f.d), dp=Number(f.dp);
  const cls=dcls(d);
  const summaryPrice=card.querySelector('[data-live="txf-price"]');
  const summaryDiff=card.querySelector('[data-live="txf-diff"]');
  if(summaryPrice){
    summaryPrice.textContent=Number.isFinite(v)?fmtPx(v):'—';
    summaryPrice.className=`pick-name num ${cls}`;
  }
  if(summaryDiff){
    summaryDiff.textContent=Number.isFinite(d)?`${sgn(d.toFixed(2))}${Number.isFinite(dp)?` (${sgn(dp.toFixed(2))}%)`:''}`:'—';
    summaryDiff.className=`num ${cls}`;
  }
  liveText('[data-live="txf-session-label"]',sess==='night'?'夜盤':'早盤','');
  liveText('[data-live="txf-time"]',f.quote_time||'—','');
  const chartEl=card.querySelector('[data-live-chart="txf"]');
  if(chartEl && typeof marketTrendSvg==='function'){
    const chart=typeof txfActiveChart==='function'?txfActiveChart(f):null;
    chartEl.innerHTML=marketTrendSvg(f,d<0?'#EF4444':'#22C55E',chart,false);
  }
  const day=card.querySelector('[data-txf-session="day"]');
  const night=card.querySelector('[data-txf-session="night"]');
  if(day) day.className=`session-tag ${sess==='day'?'on':''}`;
  if(night) night.className=`session-tag ${sess==='night'?'on':''}`;
  liveText('[data-live="txf-time"]',f.quote_time||'—','muted code');
  liveText('[data-live="txf-name"]',f.name||'台指期','k');
  const price=card.querySelector('[data-live="txf-price"]');
  if(price){
    price.textContent=Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:2}):'—';
    setLiveClass(price,'v',cls);
  }
  const diff=card.querySelector('[data-live="txf-diff"]');
  if(diff){
    diff.textContent=Number.isFinite(d)?`${d>0?'+':''}${d.toLocaleString('en-US',{maximumFractionDigits:2})}${Number.isFinite(dp)?` (${dp>0?'+':''}${dp.toFixed(2)}%)`:''}`:'—';
    setLiveClass(diff,'d',cls);
  }
  liveText('[data-live="txf-source"]',String(f.source||'—').replace('TAIFEX_MIS_RT','TAIFEX 即時').replace('TAIFEX_EDGE_RT_NIGHT','TAIFEX 即時').replace('TAIFEX_EDGE_RT_DAY','TAIFEX 即時'),'');
  liveText('[data-live="txf-updated"]',f.updated_at?fmtDoneTime(f.updated_at):'—','');
}

function flagSource(txt){ /* 舊介面保留相容，不再使用 */ }

