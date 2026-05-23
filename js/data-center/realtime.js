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
      return typeof isRealtimeQuoteTimeNow==='function' ? isRealtimeQuoteTimeNow() : false;
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
