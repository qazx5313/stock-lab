/*
 * Stock Manager
 * 統一單一股票資料。優先順序在這裡集中管理：
 * 盤中用 realtime_quotes，盤後用 daily_prices，最後才回到股票主檔。
 */
function stockKnownInfo(sym){
  const c=String(sym||'').trim();
  const base=(DATA.stockMap&&DATA.stockMap[c])||{};
  const live=(DATA.realtimeMap&&DATA.realtimeMap[c])||{};
  const daily=(DATA.priceMap&&DATA.priceMap[c])||{};
  const liveDate=String(live.date||live.quote_date||'').slice(0,10);
  const dailyDate=String(daily.date||daily.quote_date||'').slice(0,10);
  const sessionStockPick=window.DATA_CENTER&&DATA_CENTER.session&&DATA_CENTER.session.shouldPreferRealtimeStock
    ? DATA_CENTER.session.shouldPreferRealtimeStock(live,daily)
    : ((typeof isRealtimeQuoteTimeNow==='function' && isRealtimeQuoteTimeNow()) || !dailyDate || (liveDate && liveDate>=dailyDate));
  const liveFresh=!!(live&&Number.isFinite(Number(live.close))) && sessionStockPick;
  const pickNum=(key,...fallbacks)=>{
    const lv=Number(live&&live[key]);
    const dv=Number(daily&&daily[key]);
    if(Number.isFinite(lv) && (liveFresh || !Number.isFinite(dv))) return lv;
    if(Number.isFinite(dv)) return dv;
    if(Number.isFinite(lv)) return lv;
    for(const v of fallbacks){
      const n=Number(v);
      if(Number.isFinite(n)) return n;
    }
    return NaN;
  };
  const pickStr=key=>{
    if(liveFresh && live&&live[key]) return live[key];
    return (daily&&daily[key]) || (live&&live[key]) || '';
  };
  const pools=[DATA.stock, ...(DATA.screen||[]), ...(DATA.picks||[])];
  (DATA.themes||[]).forEach(t=>Array.isArray(t.stocks)&&pools.push(...t.stocks));
  const hit=pools.find(s=>String(s&&s.c)===c && s.n && s.n!==c && s.n!=='尚無名稱') ||
            pools.find(s=>String(s&&s.c)===c);
  const tags=Array.isArray(base.theme_tags)?base.theme_tags.filter(Boolean):[];
  const primaryTheme=tags[0] || base.industry || (hit&&hit.t) || (hit&&hit.theme) || (hit&&hit.level) || (hit&&hit.industry) || '—';
  const role=tags.length?tags.join(' / '):((hit&&hit.role) || primaryTheme);
  return {
    ...(hit||{}),
    c,
    n:(hit&&hit.n&&hit.n!==c&&hit.n!=='尚無名稱')?hit.n:(base.name||c),
    t:primaryTheme,
    theme:primaryTheme,
    role,
    industry:base.industry || (hit&&hit.industry) || primaryTheme,
    market:normMarket(pickStr('market')||base.market||(hit&&hit.market)),
    px:pickNum('close',hit&&hit.px),
    chg:pickNum('change',hit&&hit.chg,hit&&hit.change),
    dp:pickNum('change_percent',hit&&hit.dp),
    vol:pickNum('volume',hit&&hit.vol),
    amount:pickNum('amount',hit&&hit.amount),
    date:pickStr('date') || (hit&&hit.date) || '',
    quote_time:pickStr('quote_time') || '',
    updated_at:pickStr('updated_at') || ''
  };
}

(function(){
  const dc=window.DATA_CENTER;
  if(!dc) return;
  dc.register('stock',{
    get(symbol){
      const c=String(symbol||'').trim();
      if(!c) return {};
      if(typeof stockKnownInfo==='function') return stockKnownInfo(c);
      const base=(DATA.stockMap&&DATA.stockMap[c])||{};
      const live=(DATA.realtimeMap&&DATA.realtimeMap[c])||{};
      const daily=(DATA.priceMap&&DATA.priceMap[c])||{};
      return {c,n:base.name||c,market:base.market,industry:base.industry,...daily,...live};
    },
    list(symbols){
      return (symbols||[]).map(s=>this.get(typeof s==='string'?s:s&&s.c)).filter(x=>x&&x.c);
    },
    enrich(row){
      const s=this.get(row&&row.c || row&&row.symbol);
      return {...row,...s,n:s.n||row&&row.n||row&&row.name};
    }
  });
})();
