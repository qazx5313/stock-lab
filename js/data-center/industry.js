/*
 * Industry Manager
 * 統一類股/題材/細分類資料。未來 MoneyDJ、TWSE、TPEx 分類都應先整理到這裡。
 */
(function(){
  const dc=window.DATA_CENTER;
  if(!dc) return;
  dc.register('industry',{
    themes(){
      if(typeof mapMarketThemes==='function') return mapMarketThemes();
      return Array.isArray(DATA&&DATA.themes) ? DATA.themes : [];
    },
    byMarket(market){
      const m=String(market||'').toUpperCase();
      return this.themes().filter(t=>!m || String(t.market||'').toUpperCase()===m);
    },
    stocks(theme){
      const rows=Array.isArray(theme&&theme.stocks)?theme.stocks:[];
      return dc.stock ? rows.map(r=>dc.stock.enrich(r)) : rows;
    },
    tags(symbol){
      const s=dc.stock ? dc.stock.get(symbol) : {};
      return [s.market,s.industry,s.theme,s.t].filter(Boolean);
    }
  });
})();
