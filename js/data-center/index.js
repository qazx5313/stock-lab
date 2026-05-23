/*
 * Data Center
 * 這裡是前端資料入口的主管層。各頁面之後優先向 DATA_CENTER 拿資料，
 * 不再各自判斷該用即時、盤後、類股或歷史資料。
 */
(function(){
  const center={
    version:'20260524-data-center',
    managers:{},
    ready(){
      return !!(window.DATA && window.DATA_REAL_READY);
    },
    latestDate(){
      return String((DATA&&DATA.meta&&DATA.meta.date) || '').replaceAll('/','-').slice(0,10);
    },
    register(name,manager){
      this.managers[name]=manager;
      this[name]=manager;
      return manager;
    },
    snapshot(){
      return {
        date:this.latestDate(),
        realtime:!!this.realtime,
        afterHours:!!this.afterHours,
        industry:!!this.industry,
        stock:!!this.stock
      };
    }
  };
  window.DATA_CENTER=center;
})();
