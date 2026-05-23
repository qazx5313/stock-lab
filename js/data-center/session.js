/*
 * Session Manager
 * 統一管理台灣市場時段與資料模式。
 *
 * 目前規則：
 * - 週一到週五 08:45-13:30：早盤資料 + 即時資料
 * - 13:30 後：盤後資料 + 台指期夜盤即時資料
 * - 夜盤跨日 00:00-05:05：仍視為前一交易日夜盤
 */
(function(){
  const dc=window.DATA_CENTER;
  const RULES={
    dayStart:8*60+45,
    dayEnd:13*60+30,
    nightStart:13*60+30,
    nightQuoteStart:15*60,
    nightEnd:29*60+5
  };
  function taipeiParts(date=new Date()){
    const parts=new Intl.DateTimeFormat('en-US',{
      timeZone:'Asia/Taipei',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
    }).formatToParts(date).reduce((a,p)=>{a[p.type]=p.value;return a;},{});
    const hour=Number(parts.hour), minute=Number(parts.minute), second=Number(parts.second||0);
    return {weekday:parts.weekday,hour,minute,second,total:hour*60+minute+(second/60)};
  }
  function isWeekday(p){
    return ['Mon','Tue','Wed','Thu','Fri'].includes(p.weekday);
  }
  function isEarlyNightCarry(p){
    return ['Tue','Wed','Thu','Fri','Sat'].includes(p.weekday) && p.total<=5*60+5;
  }
  function session(p=taipeiParts()){
    if(isWeekday(p) && p.total>=RULES.dayStart && p.total<=RULES.dayEnd){
      return {
        id:'day_realtime',
        stockSource:'realtime',
        market:'day',
        futures:'day',
        label:'早盤',
        useStockRealtime:true,
        useFuturesRealtime:true,
        useAfterHours:false,
        useNightFutures:false
      };
    }
    if((isWeekday(p) && p.total>RULES.dayEnd) || isEarlyNightCarry(p)){
      return {
        id:'after_hours_night',
        stockSource:'after_hours',
        market:'after_hours',
        futures:'night',
        label:'盤後 / 夜盤',
        useStockRealtime:false,
        useFuturesRealtime:true,
        useAfterHours:true,
        useNightFutures:true
      };
    }
    return {
      id:'after_hours',
      stockSource:'after_hours',
      market:'after_hours',
      futures:'day',
      label:'盤後',
      useStockRealtime:false,
      useFuturesRealtime:false,
      useAfterHours:true,
      useNightFutures:false
    };
  }
  function isRealtimeNow(){
    const s=session();
    return !!(s.useStockRealtime || s.useFuturesRealtime);
  }
  function isStockRealtimeNow(){
    return !!session().useStockRealtime;
  }
  function isFuturesRealtimeNow(){
    return !!session().useFuturesRealtime;
  }
  function isDayMarketOpen(){
    return session().id==='day_realtime';
  }
  function shouldPreferRealtimeStock(live,daily){
    const liveClose=Number(live&&live.close);
    if(!Number.isFinite(liveClose)) return false;
    const dailyDate=String(daily&&daily.date||daily&&daily.quote_date||'').slice(0,10);
    const liveDate=String(live&&live.date||live&&live.quote_date||'').slice(0,10);
    if(isStockRealtimeNow()) return true;
    if(!dailyDate && liveDate) return true;
    return false;
  }
  function futuresSession(row){
    const txt=String([row&&row.name,row&&row.source,row&&row.quote_time].filter(Boolean).join(' '));
    if(/-M|AfterHours|NIGHT|night|夜/i.test(txt)) return 'night';
    if(/-F|Regular|DAY|day|早/i.test(txt)) return 'day';
    return session().futures;
  }
  function futuresProgress(label,key){
    const txt=String(label||'');
    const m=txt.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    let total=null;
    if(m) total=Number(m[1])*60+Number(m[2])+(Number(m[3]||0)/60);
    else total=taipeiParts().total;
    if(!Number.isFinite(total)) return null;
    if(key==='night'){
      const start=RULES.nightQuoteStart, end=RULES.nightEnd;
      const t=total<6*60 ? total+24*60 : total;
      return Math.max(0,Math.min(1,(t-start)/(end-start)));
    }
    const start=RULES.dayStart, end=RULES.dayEnd;
    return Math.max(0,Math.min(1,(total-start)/(end-start)));
  }
  const manager={
    RULES,
    taipeiParts,
    session,
    current:session,
    isRealtimeNow,
    isStockRealtimeNow,
    isFuturesRealtimeNow,
    isDayMarketOpen,
    shouldPreferRealtimeStock,
    futuresSession,
    futuresProgress
  };
  if(dc) dc.register('session',manager);
  window.MARKET_SESSION=manager;
  window.MARKET_SESSION_RULES=RULES;
})();
