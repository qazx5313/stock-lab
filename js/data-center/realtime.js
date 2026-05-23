/*
 * Realtime Manager
 * 管理盤中/夜盤會跳動的資料。頁面只需要呼叫 refresh/apply，
 * 不需要知道 MIS、TAIFEX、Supabase 快取各自怎麼合併。
 */
(function(){
  const dc=window.DATA_CENTER;
  if(!dc) return;
  dc.register('realtime',{
    isMarketOpen(){
      if(dc.session&&dc.session.isRealtimeNow) return dc.session.isRealtimeNow();
      return typeof isRealtimeQuoteTimeNow==='function' ? isRealtimeQuoteTimeNow() : false;
    },
    isStockOpen(){
      if(dc.session&&dc.session.isStockRealtimeNow) return dc.session.isStockRealtimeNow();
      return typeof isTaiwanMarketOpenNow==='function' ? isTaiwanMarketOpenNow() : false;
    },
    isFuturesOpen(){
      if(dc.session&&dc.session.isFuturesRealtimeNow) return dc.session.isFuturesRealtimeNow();
      return this.isMarketOpen();
    },
    mode(){
      return dc.session&&dc.session.current ? dc.session.current() : {};
    },
    apply(rows,options){
      return typeof applyRealtimeQuotes==='function' ? applyRealtimeQuotes(rows||[],options||{}) : 0;
    },
    refreshEdge(){
      return typeof refreshLiveEdge==='function' ? refreshLiveEdge() : Promise.resolve(false);
    },
    refreshStored(){
      return typeof refreshRealtimeOnly==='function' ? refreshRealtimeOnly() : Promise.resolve(false);
    },
    futures(){
      return (DATA&&DATA.futures)||{};
    },
    quote(symbol){
      return dc.stock ? dc.stock.get(symbol) : {};
    }
  });
})();
