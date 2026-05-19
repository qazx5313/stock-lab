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
  fetch_stock_classes:'股票類股分類',
  fetch_company_info:'公司基本資料',
  fetch_index:'市場指數',
  validate_mis_quotes:'MIS 收盤價校驗',
  compute_signals:'每日訊號計算',
  run_ai_lab:'AI 實驗室'
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
const REAL_CACHE_KEY='stockLabRealCache:v8';
const REAL_CACHE_TTL=1000*60*60*18;
const REAL_CACHE_FIELDS=[
  'meta','market','themes','themeList','chain','picks','news','risks','screen',
  'agents','aiCand','aiBack','aiDeep','aiTrades','aiReviews','aiVersions',
  'dataStatus','appSettings','realNewsLoaded'
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
        `daily_prices?select=symbol,change,change_percent,amount,market&date=eq.${d}`, 20000);
      if(Array.isArray(dayRows) && dayRows.length){
        const twse=emptyDist(), tpex=emptyDist(), other=emptyDist();
        const marketMap=await loadMarketMap(dayRows.filter(r=>!normMarket(r.market)).map(r=>r.symbol));
        dayRows.forEach(r=>{
          const sym=String(r.symbol||'').trim();
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
        else if(r.market==='TXF') DATA.market.txFut=o;
        if(r.market==='TWSE' && r.amount!=null) DATA.market.amtTwse=fmtTwAmount(r.amount);
        if(r.market==='TPEX' && r.amount!=null) DATA.market.amtTpex=fmtTwAmount(r.amount);
      });
      const twAmt=(idx||[]).find(r=>r.market==='TWSE'&&r.amount!=null);
      const tpAmt=(idx||[]).find(r=>r.market==='TPEX'&&r.amount!=null);
      if(twAmt&&tpAmt) DATA.market.amtTotal=fmtTwAmount(Number(twAmt.amount)+Number(tpAmt.amount));
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
      const pm = {}; (pr||[]).forEach(x=>pm[x.symbol]=x);
      DATA.picks = sigTop.map(sg=>{
        const p = pm[sg.symbol] || {};
        const cp = parseFloat(p.change_percent);
        const px = parseFloat(p.close);
        const vol = parseInt(p.volume);
        return {
          c:sg.symbol,
          n:(nameMap[sg.symbol]&&nameMap[sg.symbol].name)||sg.symbol,
          t:(nameMap[sg.symbol]&&nameMap[sg.symbol].industry)||'—',
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
        DATA.themeList=DATA.themes.map(t=>t.name);
        if(!DATA.themes.some(t=>t.id===MAP_SEL)) MAP_SEL=DATA.themes[0].id;
      }
    }catch(e){ console.warn('themes 載入略過:',e); }

    // ---- 重大公告：讀公開資訊觀測站公告 ----
    try{
      const anns = await sbGet(
        'mops_announcements?select=date,symbol,company_name,title,category'+
        '&order=date.desc&limit=20', 20);
      if(Array.isArray(anns) && anns.length){
        DATA.news = anns.map(a=>({
          c:a.symbol||'-',
          n:a.company_name||'',
          title:[a.category,a.title].filter(Boolean).join(' · ')||'公告',
          time:String(a.date||'').slice(5).replace('-','/'),
          k:'neu'
        }));
        DATA.realNewsLoaded = true;
      }else{
        DATA.realNewsLoaded = false;
      }
    }catch(e){ DATA.realNewsLoaded = false; console.warn('公告載入略過:',e); }

    // ---- 每日篩選：讀 candidate_pool（綜合分排序）----
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
          const cpv = parseFloat(p.change_percent);
          const px = parseFloat(p.close);
          const vol = parseInt(p.volume);
          return {
            c:r.symbol, n:(nmap[r.symbol]&&nmap[r.symbol].name)||r.name||'尚無名稱',
            t:(r.reason||'').slice(0,10)||'—',
            px:isFinite(px)?px:'—',
            dp:isFinite(cpv)?cpv:0,
            vol:isFinite(vol)?vol.toLocaleString('en-US'):'—',
            ts:s.technical_score!=null?s.technical_score:'—',
            cs:s.chip_score!=null?s.chip_score:'—',
            ms:s.theme_score!=null?s.theme_score:'—',
            total:s.final_score!=null?s.final_score:r.score
          };
        });
      }
    }catch(e){ console.warn('candidate_pool 載入略過:',e); }

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

function flagSource(txt){ /* 舊介面保留相容，不再使用 */ }

