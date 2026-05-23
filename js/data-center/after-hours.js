/*
 * After Hours Manager
 * 管理每日盤後資料載入與狀態。盤後資料只在這裡宣告，不讓頁面自己猜。
 */
(function(){
  const dc=window.DATA_CENTER;
  if(!dc) return;
  dc.register('afterHours',{
    load(){
      return typeof loadReal==='function' ? loadReal() : Promise.resolve(false);
    },
    status(){
      return (DATA&&DATA.status)||{};
    },
    market(){
      return (DATA&&DATA.market)||{};
    },
    prices(){
      return (DATA&&DATA.priceMap)||{};
    }
  });
})();
