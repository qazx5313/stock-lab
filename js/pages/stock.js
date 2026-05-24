/* Page module: stock.js */

function vStock(){
  const known=stockKnownInfo(DATA.stock&&DATA.stock.c);
  const cleanTheme=v=>v&&v!=='—'&&v!=='尚無分類'?v:'';
  const s={...DATA.stock,...known,
    n:(known.n&&known.n!==known.c)?known.n:DATA.stock.n,
    series:DATA.stock.series,
    inst:DATA.stock.inst, margin:DATA.stock.margin, foreignCost:DATA.stock.foreignCost,
    revenue:DATA.stock.revenue, ann:DATA.stock.ann, role:cleanTheme(DATA.stock.role)||known.role||known.t||known.industry,
    theme:cleanTheme(DATA.stock.theme)||known.t, industry:cleanTheme(DATA.stock.industry)||known.industry,
    market:DATA.stock.market||known.market
  };
  const fc=s.foreignCost||{};
  const revenue=Array.isArray(s.revenue)?s.revenue:[];
  const latestRevenue=revenue[0]||null;
  const dp=Number(s.dp);
  const chg=Number(s.chg);
  const vol=Number(s.vol);
  const headCls=dcls(dp);
  const headArrow=Number.isFinite(dp)?(dp>=0?'▲':'▼'):'';
  const fcRows=[
    ['外資推估成本',fc.cost,''],
    ['站穩起飛價 ×1.04',fc.launch,'cool'],
    ['獲利1 ×1.20',fc.tp1,'good'],
    ['獲利2 ×1.40',fc.tp2,'warm'],
    ['獲利3 ×1.70',fc.tp3,'hot']
  ];
  const latestBar=s.series&&s.series.length?s.series[s.series.length-1]:{};
  const liveAmount=Number.isFinite(Number(s.amount))?Number(s.amount):Number(latestBar.a);
  return `<div class="fade workspace-page stock-workspace">
   <div class="card stock-hero">
     <div class="stock-identity">
       <h2><span class="code" style="font-size:20px;color:var(--ink-2)">${s.c}</span> ${esc(s.n||s.c)} <span class="star">★</span></h2>
       <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">
         <span class="badge">${esc(s.market||'—')}</span><span class="badge obs">${esc(s.industry||'—')}</span><span class="badge hot">${esc(s.theme||'—')}</span>
       </div>
       <div style="margin-top:12px;color:var(--ink-2);font-size:13px;font-weight:700">題材定位：${esc(s.role||'—')}</div>
       <div style="margin-top:8px;color:var(--ink-2);font-size:13px;font-weight:700">K 線型態：${esc((stockDecisionInfo(s).signals||[])[0]?.name||'等待確認')}</div>
     </div>
     <div class="stock-price">
       <div class="num ${headCls} value" data-stock-live="px">${fmtPx(s.px)}</div>
       <div class="num ${headCls}" data-stock-live="chg" style="font-size:15px;font-weight:900;margin-top:6px">
         ${headArrow} ${Number.isFinite(chg)?sgn(chg.toFixed(2)):''}${Number.isFinite(dp)?`（${sgn(dp.toFixed(2))}%）`:''}
       </div>
       <div style="font-size:12.5px;color:var(--ink-2);font-weight:800;margin-top:8px">成交值　<span data-stock-live="amount">${fmtAmountValue(liveAmount)}</span></div>
       <div style="font-size:12px;color:var(--ink-3);font-weight:800;margin-top:4px">更新時間　${esc(DATA.meta.realtimeUpdated||DATA.meta.updated||'—')}</div>
     </div>
     <div class="stock-search">
       <div style="display:flex;gap:8px">
         <input id="stkInput" placeholder="輸入股票代號（範例：1815）" style="flex:1;min-width:0;padding:10px 13px;border:1px solid var(--border);border-radius:10px;font-family:var(--mono);font-size:14px;outline:none">
         <button class="btn sm" id="stkSearchBtn">查詢</button>
         <button class="btn line sm" id="watchToggleBtn" data-watch-symbol="${s.c}">${isWatched(s.c)?'移出自選':'加入自選'}</button>
       </div>
       <div class="quote-mini-grid">
         ${[['開盤',latestBar.o,'px'],['最高',latestBar.h,'px'],['最低',latestBar.l,'px'],['成交量',vol,'vol']].map(r=>`<div><span>${r[0]}</span><b class="num" ${r[2]==='vol'?'data-stock-live="vol"':''}>${r[2]==='vol'?(Number.isFinite(Number(r[1]))?fmtLots(r[1])+' 張':'—'):(Number.isFinite(Number(r[1]))?fmtPx(r[1]):'—')}</b></div>`).join('')}
       </div>
     </div>
   </div>

   ${stockDecisionPanel(s)}

   <div class="card">
     <div class="card-h"><h3>TradingView 技術分析</h3><span class="tag">近 200 日 K 線 · 成交量 · MA5/10/20/60 · RSI/KD/MACD</span></div>
     <div class="tv-wrap">
       <div id="tvStockChart" class="tv-chart"></div>
     </div>
   </div>

   <div class="grid" style="grid-template-columns:1fr">
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

   <div class="card"><div class="card-h"><h3>營收狀況</h3><span class="tag">MOPS 月營收</span></div>
     ${latestRevenue?`<div class="card-pad">
       <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
         ${[
           ['最新月份',latestRevenue.year_month||'—',''],
           ['單月營收',fmtRevenue(latestRevenue.revenue),''],
           ['月增率',fmtPct(latestRevenue.mom_percent),Number(latestRevenue.mom_percent)>=0?'up':'down'],
           ['年增率',fmtPct(latestRevenue.yoy_percent),Number(latestRevenue.yoy_percent)>=0?'up':'down'],
           ['累計營收',fmtRevenue(latestRevenue.accumulated_revenue),''],
           ['累計年增率',fmtPct(latestRevenue.accumulated_yoy_percent),Number(latestRevenue.accumulated_yoy_percent)>=0?'up':'down']
         ].map(r=>`<div style="background:var(--blue-tint);border:1px solid var(--blue-soft);border-radius:10px;padding:12px 14px">
           <div style="font-size:11px;color:var(--ink-2);font-weight:700">${r[0]}</div>
           <div class="num ${r[2]||''}" style="font-size:18px;font-weight:850;margin-top:5px">${r[1]}</div>
         </div>`).join('')}
       </div>
       <div class="tbl-wrap" style="margin-top:14px"><table><thead><tr><th>月份</th><th class="r">營收</th><th class="r">月增</th><th class="r">年增</th><th class="r">累計年增</th></tr></thead><tbody>
         ${revenue.slice(0,6).map(r=>`<tr><td class="code">${r.year_month||'—'}</td><td class="r num">${fmtRevenue(r.revenue)}</td>
           <td class="r num ${Number(r.mom_percent)>=0?'up':'down'}">${fmtPct(r.mom_percent)}</td>
           <td class="r num ${Number(r.yoy_percent)>=0?'up':'down'}">${fmtPct(r.yoy_percent)}</td>
           <td class="r num ${Number(r.accumulated_yoy_percent)>=0?'up':'down'}">${fmtPct(r.accumulated_yoy_percent)}</td></tr>`).join('')}
       </tbody></table></div>
     </div>`:`<div class="card-pad muted" style="font-size:13px">目前還沒有此股票的 MOPS 月營收資料，請先執行每日資料更新。</div>`}
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
const STOCK_CHART_VISIBLE_DAYS=200;
const STOCK_HISTORY_FETCH_LIMIT=420;

function refreshStockSeriesWithLiveQuote(sym,live){
  const series=Array.isArray(DATA.stock&&DATA.stock.series)?DATA.stock.series:null;
  const px=Number(live&&live.px);
  if(!series || !series.length || !Number.isFinite(px)) return;
  const date=String((live&&live.date)||(DATA.meta&&DATA.meta.date)||'').replaceAll('/','-').slice(0,10);
  const last=series[series.length-1];
  const prev=series[series.length-2];
  if(date && last && String(last.d||'').slice(0,10)===date){
    last.c=px;
    last.h=Math.max(Number(last.h)||px,px);
    last.l=Math.min(Number(last.l)||px,px);
    if(Number.isFinite(Number(live.vol))) last.v=Number(live.vol);
    if(Number.isFinite(Number(live.amount))) last.a=Number(live.amount);
  }else if(date && (!last || date>String(last.d||'').slice(0,10))){
    const open=Number(last&&last.c)||px;
    series.push({
      o:open,h:Math.max(open,px),l:Math.min(open,px),c:px,
      v:Number.isFinite(Number(live.vol))?Number(live.vol):0,
      a:Number.isFinite(Number(live.amount))?Number(live.amount):0,
      d:date
    });
  }
  const tail=series[series.length-1];
  const before=series[series.length-2]||prev;
  if(tail){
    DATA.stock.px=tail.c;
    DATA.stock.vol=Number(tail.v)||DATA.stock.vol||0;
    DATA.stock.amount=Number(tail.a)||DATA.stock.amount||0;
    if(before&&before.c){
      DATA.stock.chg=+(tail.c-before.c).toFixed(2);
      DATA.stock.dp=+(((tail.c-before.c)/before.c)*100).toFixed(2);
    }
  }
  DATA.stock.series=normalizeStockSeries(series);
  updateStockTechFromSeries();
}
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
    DATA.stock.revenue=[];
    const rows = await sbGet(
      `daily_prices?select=date,open,high,low,close,volume,amount&symbol=eq.${sym}`+
      `&order=date.desc&limit=${STOCK_HISTORY_FETCH_LIMIT}`, 5000);
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
        DATA.stock.vol=Number(last.v)||0;
        if(prev&&prev.c){
          DATA.stock.chg=+(last.c-prev.c).toFixed(2);
          DATA.stock.dp=+(((last.c-prev.c)/prev.c)*100).toFixed(2);
        }
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
      updateStockTechFromSeries();
      const recent=DATA.stock.series.slice(-20);
      if(recent.length){
        const sup=Math.min(...recent.map(x=>x.l));
        const res=Math.max(...recent.map(x=>x.h));
        DATA.stock.levelText=`近20日支撐 ${fmtPx(sup)} / 壓力 ${fmtPx(res)}`;
      }
      await loadStockRealDetails(sym);
      try{
        const rq=await sbGet(`realtime_quotes?select=symbol,name,market,quote_date,quote_time,price,change,change_percent,volume,amount,source,updated_at&symbol=eq.${sym}&order=updated_at.desc&limit=1`,1);
        if(Array.isArray(rq)&&rq.length&&typeof applyRealtimeQuotes==='function') applyRealtimeQuotes(rq,{merge:true});
        const live=stockKnownInfo(sym);
        refreshStockSeriesWithLiveQuote(sym,live);
        if(Number.isFinite(Number(live.px))) DATA.stock.px=Number(live.px);
        if(Number.isFinite(Number(live.chg))) DATA.stock.chg=Number(live.chg);
        if(Number.isFinite(Number(live.dp))) DATA.stock.dp=Number(live.dp);
        if(Number.isFinite(Number(live.vol))) DATA.stock.vol=Number(live.vol);
        if(Number.isFinite(Number(live.amount))) DATA.stock.amount=Number(live.amount);
      }catch(_){}
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
  try{
    const rev=await sbGet(
      `monthly_revenue?select=year_month,revenue,mom_percent,yoy_percent,accumulated_revenue,accumulated_yoy_percent&symbol=eq.${sym}&order=year_month.desc&limit=12`,
      12
    );
    DATA.stock.revenue=Array.isArray(rev)?rev:[];
  }catch(e){ console.warn('月營收載入略過:',e); DATA.stock.revenue=[]; }
}

function loadLightweightCharts(){
  if(window.LightweightCharts) return Promise.resolve();
  if(window.__lwChartsLoading) return window.__lwChartsLoading;
  window.__lwChartsLoading=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js';
    s.async=true;
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });
  return window.__lwChartsLoading;
}
function renderTradingViewStockChart(){
  const el=document.getElementById('tvStockChart');
  if(!el) return;
  const chartData=buildStockChartData(DATA.stock&&DATA.stock.series,STOCK_CHART_VISIBLE_DAYS);
  const rows=chartData.rows;
  if(rows.length<2){
    el.innerHTML='<div class="muted" style="padding:18px">此股票 K 棒資料不足，請先更新每日資料。</div>';
    return;
  }
  el.innerHTML='<canvas id="tvLiteCanvas" class="tv-canvas"></canvas>';
  drawTradingStyleCanvas(el.querySelector('#tvLiteCanvas'), chartData);
  if(el.__tvResizeObserver) el.__tvResizeObserver.disconnect();
  el.__tvResizeObserver=new ResizeObserver(()=>drawTradingStyleCanvas(el.querySelector('#tvLiteCanvas'), chartData));
  el.__tvResizeObserver.observe(el);
  const canvas=el.querySelector('#tvLiteCanvas');
  canvas.onmousemove=ev=>{
    const rect=canvas.getBoundingClientRect();
    drawTradingStyleCanvas(canvas, chartData, {x:ev.clientX-rect.left,y:ev.clientY-rect.top});
  };
  canvas.onmouseleave=()=>drawTradingStyleCanvas(canvas, chartData);
}

function calcMaRows(rows,len){
  const out=[];
  for(let i=0;i<rows.length;i++){
    if(i<len-1) continue;
    const part=rows.slice(i-len+1,i+1).map(r=>Number(r.c)).filter(Number.isFinite);
    if(part.length!==len) continue;
    out.push({time:String(rows[i].d||'').slice(0,10),value:+(part.reduce((a,b)=>a+b,0)/len).toFixed(4)});
  }
  return out;
}

function indicatorRows(rows,vals){
  return (vals||[]).map((v,i)=>({time:String(rows[i]&&rows[i].d||'').slice(0,10),value:Number(v)}))
    .filter(p=>p.time&&Number.isFinite(p.value));
}

function drawTradingStyleCanvas(canvas, chartData, hover){
  const payload=Array.isArray(chartData)?buildStockChartData(chartData,STOCK_CHART_VISIBLE_DAYS):(chartData||{});
  const rows=Array.isArray(payload.rows)?payload.rows:[];
  if(!canvas||!rows||rows.length<2) return;
  const indicators=payload.indicators||{};
  const host=canvas.parentElement;
  const ratio=window.devicePixelRatio||1;
  const W=Math.max(620,Math.floor(host.clientWidth||1100));
  const H=940;
  canvas.style.width='100%';
  canvas.style.height=H+'px';
  canvas.width=W*ratio;
  canvas.height=H*ratio;
  const x=canvas.getContext('2d');
  x.setTransform(ratio,0,0,ratio,0,0);
  x.clearRect(0,0,W,H);
  x.fillStyle='#fff';
  x.fillRect(0,0,W,H);
  const L=14,R=66,T=34,G=10,B=34;
  const priceH=400,volH=95,macdH=130,kdH=105,rsiH=120;
  const panels=[
    {name:'price',y:T,h:priceH,label:'K 線  MA5  MA10  MA20  MA60'},
    {name:'vol',y:T+priceH+G,h:volH,label:'成交量'},
    {name:'macd',y:T+priceH+G+volH+G,h:macdH,label:'MACD 12・26・9'},
    {name:'kd',y:T+priceH+G+volH+G+macdH+G,h:kdH,label:'KD 9'},
    {name:'rsi',y:T+priceH+G+volH+G+macdH+G+kdH+G,h:rsiH,label:'RSI 9 / RSI 55'}
  ];
  const plotW=W-L-R;
  const n=rows.length;
  const bw=plotW/n;
  const X=i=>L+i*bw+bw/2;
  const closes=rows.map(r=>Number(r.c));
  const highs=rows.map(r=>Number(r.h));
  const lows=rows.map(r=>Number(r.l));
  const vols=rows.map(r=>volumeToLots(r.v)||0);
  const ma5=indicators.ma5||calcMovingAverageValues(closes,5);
  const ma10=indicators.ma10||calcMovingAverageValues(closes,10);
  const ma20=indicators.ma20||calcMovingAverageValues(closes,20);
  const ma60=indicators.ma60||calcMovingAverageValues(closes,60);
  const macd=indicators.macd||calcMACDSeries(closes);
  const kd=indicators.kd||calcKDSeries(highs,lows,closes,9);
  const rsi9=indicators.rsi9||calcRSISeries(closes,9);
  const rsi55=indicators.rsi55||calcRSISeries(closes,55);
  const hoverIdx=hover&&Number.isFinite(hover.x)?Math.max(0,Math.min(n-1,Math.round((hover.x-L-bw/2)/bw))):n-1;
  const hrow=rows[hoverIdx]||rows[n-1];
  const hv=(arr)=>{const v=Number(arr&&arr[hoverIdx]);return Number.isFinite(v)?v:null;};
  const grid=(p,steps=4)=>{
    x.strokeStyle='#EAF0F7';x.lineWidth=1;
    for(let i=0;i<=steps;i++){const yy=p.y+i*p.h/steps;x.beginPath();x.moveTo(L,yy);x.lineTo(W-R,yy);x.stroke();}
    const tickEvery=Math.max(7,Math.ceil(n/8));
    rows.forEach((r,i)=>{if(i%tickEvery&&i!==n-1)return;const xx=X(i);x.beginPath();x.moveTo(xx,p.y);x.lineTo(xx,p.y+p.h);x.stroke();});
  };
  const axis=(p,vals,fmt=v=>Number(v).toFixed(2))=>{
    const good=vals.filter(Number.isFinite);
    const mx=Math.max(...good),mn=Math.min(...good);
    const span=Math.max(.0001,mx-mn);
    const Y=v=>p.y+8+(mx-v)/span*(p.h-16);
    x.fillStyle='#475569';x.font='11px var(--mono), monospace';x.textAlign='left';
    [mx,(mx+mn)/2,mn].forEach(v=>x.fillText(fmt(v),W-R+8,Y(v)+4));
    return {Y,mx,mn,span};
  };
  panels.forEach(p=>grid(p,p.name==='price'?6:2));
  drawQuoteHeader(x,W,hrow,{
    ma5:hv(ma5),ma10:hv(ma10),ma20:hv(ma20),ma60:hv(ma60),
    vol:hv(vols),dif:hv(macd.dif),macd:hv(macd.signal),osc:hv(macd.hist),
    k:hv(kd.k),d:hv(kd.d),rsi9:hv(rsi9),rsi55:hv(rsi55)
  });
  drawPanelValueLabel(x,panels[0],[['K 線',''],['MA5',fmtInd(hv(ma5)),'#F59E0B'],['MA10',fmtInd(hv(ma10)),'#2563EB'],['MA20',fmtInd(hv(ma20)),'#7C3AED'],['MA60',fmtInd(hv(ma60)),'#64748B']]);
  drawPanelValueLabel(x,panels[1],[['成交量',Number.isFinite(hv(vols))?Math.round(hv(vols)).toLocaleString('en-US')+'張':'—','#F59E0B']]);
  drawPanelValueLabel(x,panels[2],[['MACD', ''],['DIF',fmtInd(hv(macd.dif)),'#2563EB'],['MACD',fmtInd(hv(macd.signal)),'#F59E0B'],['OSC',fmtInd(hv(macd.hist)),Number(hv(macd.hist))>=0?'#DC2626':'#16A34A']]);
  drawPanelValueLabel(x,panels[3],[['KD', ''],['K',fmtInd(hv(kd.k)),'#F59E0B'],['D',fmtInd(hv(kd.d)),'#06B6D4']]);
  drawPanelValueLabel(x,panels[4],[['RSI 相對強弱指標',''],['RSI(9)',fmtInd(hv(rsi9)),'#F59E0B'],['RSI(55)',fmtInd(hv(rsi55)),'#06B6D4']]);
  const priceVals=rows.flatMap(r=>[Number(r.h),Number(r.l)]).filter(Number.isFinite);
  const py=axis(panels[0],priceVals,v=>v.toFixed(2)).Y;
  const drawLine=(vals,color,p=panels[0],fixedAxis=null)=>{
    const clean=vals.map(Number);
    const yFn=fixedAxis||axis(p,clean, v=>Math.abs(v)>=10?v.toFixed(2):v.toFixed(3)).Y;
    x.strokeStyle=color;x.lineWidth=2;x.beginPath();let started=false;
    clean.forEach((v,i)=>{if(!Number.isFinite(v))return;const xx=X(i),yy=yFn(v);if(!started){x.moveTo(xx,yy);started=true;}else x.lineTo(xx,yy);});
    x.stroke();
    return yFn;
  };
  rows.forEach((r,i)=>{
    const o=Number(r.o),h=Number(r.h),l=Number(r.l),c=Number(r.c);
    const up=c>=o,xx=X(i),bodyW=Math.max(3,Math.min(10,bw*.58));
    x.strokeStyle=up?'#DC2626':'#16A34A';x.fillStyle=x.strokeStyle;
    x.beginPath();x.moveTo(xx,py(h));x.lineTo(xx,py(l));x.stroke();
    const y1=py(Math.max(o,c)),y2=py(Math.min(o,c));
    x.fillRect(xx-bodyW/2,y1,bodyW,Math.max(2,y2-y1));
  });
  [[ma5,'#F59E0B'],[ma10,'#2563EB'],[ma20,'#7C3AED'],[ma60,'#64748B']].forEach(([vals,color])=>{
    drawLine(vals,color,panels[0],py);
  });
  const last=rows[rows.length-1];
  if(last&&Number.isFinite(Number(last.c))){
    const yy=py(Number(last.c));x.setLineDash([2,3]);x.strokeStyle='#EF4444';x.beginPath();x.moveTo(L,yy);x.lineTo(W-R,yy);x.stroke();x.setLineDash([]);
    x.fillStyle='#DC2626';x.fillRect(W-R+4,yy-10,54,20);x.fillStyle='#fff';x.font='800 11px var(--mono), monospace';x.textAlign='center';x.fillText(Number(last.c).toFixed(2),W-R+31,yy+4);
  }
  const vp=panels[1],vmx=Math.max(...vols,1),vY=v=>vp.y+vp.h-(v/vmx)*(vp.h-18);
  rows.forEach((r,i)=>{const v=vols[i],xx=X(i),up=Number(r.c)>=Number(r.o);x.fillStyle=up?'rgba(220,38,38,.55)':'rgba(22,163,74,.55)';x.fillRect(xx-Math.max(2,bw*.32),vY(v),Math.max(2,bw*.64),vp.y+vp.h-vY(v));});
  x.fillStyle='#475569';x.textAlign='left';x.font='11px var(--mono), monospace';x.fillText(Math.round(vmx).toLocaleString('en-US'),W-R+8,vp.y+12);
  const mp=panels[2],mvals=[...macd.dif,...macd.signal,...macd.hist].map(Number).filter(Number.isFinite);
  const mMax=Math.max(...mvals.map(Math.abs),.01),mY=v=>mp.y+mp.h/2-(v/mMax)*(mp.h*.42);
  x.strokeStyle='#CBD5E1';x.beginPath();x.moveTo(L,mY(0));x.lineTo(W-R,mY(0));x.stroke();
  macd.hist.forEach((v,i)=>{v=Number(v);if(!Number.isFinite(v))return;const xx=X(i),yy=mY(v);x.fillStyle=v>=0?'rgba(220,38,38,.55)':'rgba(22,163,74,.55)';x.fillRect(xx-Math.max(2,bw*.32),Math.min(mY(0),yy),Math.max(2,bw*.64),Math.abs(mY(0)-yy));});
  drawLine(macd.dif,'#2563EB',mp,mY);drawLine(macd.signal,'#F59E0B',mp,mY);
  const kp=panels[3],kY=v=>kp.y+8+(100-v)/100*(kp.h-16);
  axis(kp,[0,50,100],v=>v.toFixed(0));drawLine(kd.k,'#F59E0B',kp,kY);drawLine(kd.d,'#06B6D4',kp,kY);
  const rp=panels[4],rY=v=>rp.y+8+(100-v)/100*(rp.h-16);
  axis(rp,[0,20,50,80,100],v=>v.toFixed(0));
  [80,50,20].forEach(v=>{
    const yy=rY(v);
    x.strokeStyle=v===50?'#CBD5E1':'#E2E8F0';
    x.setLineDash(v===50?[4,4]:[]);
    x.beginPath();x.moveTo(L,yy);x.lineTo(W-R,yy);x.stroke();
    x.setLineDash([]);
  });
  drawLine(rsi9,'#F59E0B',rp,rY);
  drawLine(rsi55,'#06B6D4',rp,rY);
  if(hover&&Number.isFinite(hover.x)){
    const xx=X(hoverIdx);
    x.setLineDash([4,4]);x.strokeStyle='#94A3B8';x.beginPath();x.moveTo(xx,T);x.lineTo(xx,H-B);x.stroke();x.setLineDash([]);
    const yy=Math.max(T,Math.min(H-B,hover.y||T));
    x.beginPath();x.moveTo(L,yy);x.lineTo(W-R,yy);x.stroke();
    const label=shortChartDate(hrow.d,true);
    x.fillStyle='#0F172A';x.fillRect(Math.max(L,Math.min(W-R-84,xx-42)),H-26,84,20);
    x.fillStyle='#fff';x.font='800 11px var(--mono), monospace';x.textAlign='center';x.fillText(label,Math.max(L+42,Math.min(W-R-42,xx)),H-12);
  }
  const tickEvery=Math.max(8,Math.ceil(n/8));
  x.fillStyle='#475569';x.font='11px system-ui';x.textAlign='center';
  rows.forEach((r,i)=>{if(i%tickEvery&&i!==n-1)return;const d=String(r.d||'');const lab=i===n-1?shortChartDate(d,true):shortChartDate(d);x.fillText(lab,X(i),H-8);});
}

function drawQuoteHeader(x,W,row,v){
  const bits=[
    ['日期',shortChartDate(row&&row.d,true),'#475569'],
    ['開',fmtPx(row&&row.o),'#475569'],
    ['高',fmtPx(row&&row.h),'#DC2626'],
    ['低',fmtPx(row&&row.l),'#16A34A'],
    ['收',fmtPx(row&&row.c),'#0F172A'],
    ['MA5',fmtInd(v.ma5),'#F59E0B'],
    ['MA10',fmtInd(v.ma10),'#2563EB'],
    ['MA20',fmtInd(v.ma20),'#7C3AED'],
    ['MA60',fmtInd(v.ma60),'#64748B'],
    ['RSI(9)',fmtInd(v.rsi9),'#F59E0B'],
    ['RSI(55)',fmtInd(v.rsi55),'#06B6D4']
  ];
  let xx=18,yy=15;
  x.font='800 12px var(--mono), monospace';x.textAlign='left';
  bits.forEach(([k,val,color])=>{
    const text=`${k} ${val}`;
    x.fillStyle=color;x.fillText(text,xx,yy);
    xx+=x.measureText(text).width+12;
    if(xx>W-220){xx=18;yy+=17;}
  });
}
function drawPanelValueLabel(x,p,items){
  let xx=22,yy=p.y+15;
  x.font='800 11px var(--mono), monospace';x.textAlign='left';
  items.forEach(([k,val,color])=>{
    const text=val?`${k} ${val}`:k;
    x.fillStyle=color||'#94A3B8';
    x.fillText(text,xx,yy);
    xx+=x.measureText(text).width+10;
  });
}
function fmtInd(v){
  return Number.isFinite(Number(v))?Number(v).toFixed(2):'—';
}

function genSeries(n,base,vol){let p=base,a=[];for(let i=0;i<n;i++){const o=p,ch=(Math.sin(i/4)+ (Math.random()-.45))*vol;
  const c=Math.max(base*.6,o+ch);const h=Math.max(o,c)*(1+Math.random()*.012);const l=Math.min(o,c)*(1-Math.random()*.012);
  a.push({o,h,l,c,v:Math.round((6000+Math.random()*9000)*(1+Math.abs(ch)/vol))});p=c;}return a;}
function updateStockTechFromSeries(){
  const series=Array.isArray(DATA.stock&&DATA.stock.series)?DATA.stock.series:[];
  if(series.length<5){DATA.stock.tech=null;return;}
  const highs=series.map(r=>Number(r.h));
  const lows=series.map(r=>Number(r.l));
  const closes=series.map(r=>Number(r.c));
  const kd=calcKDSeries(highs,lows,closes,9);
  const rsi=calcRSISeries(closes,14);
  const macd=calcMACDSeries(closes);
  DATA.stock.tech={
    kd,rsi,macd,
    kdText:`K=${fmtInd(lastNum(kd.k))} D=${fmtInd(lastNum(kd.d))}`,
    rsiText:`RSI=${fmtInd(lastNum(rsi))}`,
    macdText:`DIF=${fmtInd(lastNum(macd.dif))} MACD=${fmtInd(lastNum(macd.signal))} OSC=${fmtInd(lastNum(macd.hist))}`
  };
}
function coerceStockBar(r){
  const c=Number(r&&r.c);
  if(!Number.isFinite(c)||c<=0) return null;
  const d=String((r&&r.d)||(r&&r.date)||'').slice(0,10);
  if(!d) return null;
  let o=Number(r.o),h=Number(r.h),l=Number(r.l);
  if(!Number.isFinite(o)||o<=0) o=c;
  if(!Number.isFinite(h)||h<=0) h=Math.max(o,c);
  if(!Number.isFinite(l)||l<=0) l=Math.min(o,c);
  h=Math.max(h,o,c);
  l=Math.min(l,o,c);
  if(h<=0||l<=0||h<l) return null;
  return {o,h,l,c,v:Number(r.v)||0,a:Number(r.a)||0,d};
}
function dateGapDays(a,b){
  const da=new Date(String(a||'').slice(0,10)+'T00:00:00');
  const db=new Date(String(b||'').slice(0,10)+'T00:00:00');
  if(Number.isNaN(da.getTime())||Number.isNaN(db.getTime())) return 0;
  return Math.round((db-da)/86400000);
}
function trimUnstableStockHistory(rows){
  if(!Array.isArray(rows)||rows.length<80) return rows||[];
  let start=0;
  for(let i=rows.length-1;i>0;i--){
    const prev=rows[i-1],cur=rows[i];
    const gap=dateGapDays(prev.d,cur.d);
    const pc=Number(prev.c),cc=Number(cur.c);
    const jump=(pc>0&&cc>0)?Math.abs(cc-pc)/pc:0;
    if(gap>14||jump>.45){start=i;break;}
  }
  const trimmed=rows.slice(start);
  return trimmed.length>=80?trimmed:rows;
}
function normalizeStockSeries(rows){
  const byDate=new Map();
  (rows||[]).forEach(r=>{
    const bar=coerceStockBar(r);
    if(!bar) return;
    const prev=byDate.get(bar.d);
    if(!prev || Number(bar.v||0)>=Number(prev.v||0)) byDate.set(bar.d,bar);
  });
  const sorted=[...byDate.values()].sort((a,b)=>String(a.d).localeCompare(String(b.d)));
  const out=[];
  sorted.forEach(r=>{
    const p=out[out.length-1];
    const sameBar=p&&['o','h','l','c','v'].every(k=>Number(p[k]||0)===Number(r[k]||0));
    if(!sameBar) out.push(r);
  });
  return trimUnstableStockHistory(out);
}
function calcMovingAverageValues(vals,len){
  const out=Array(vals.length).fill(null);
  let sum=0,valid=0;
  vals.forEach((raw,i)=>{
    const v=Number(raw);
    if(Number.isFinite(v)){sum+=v;valid++;}
    const old=Number(vals[i-len]);
    if(i>=len&&Number.isFinite(old)){sum-=old;valid--;}
    if(i>=len-1&&valid===len) out[i]=sum/len;
  });
  return out;
}
function buildStockChartData(series,visibleDays=STOCK_CHART_VISIBLE_DAYS){
  const clean=normalizeStockSeries(series||[]);
  const closes=clean.map(r=>Number(r.c));
  const highs=clean.map(r=>Number(r.h));
  const lows=clean.map(r=>Number(r.l));
  const start=Math.max(0,clean.length-visibleDays);
  const slice=arr=>(arr||[]).slice(start);
  const macd=calcMACDSeries(closes);
  const kd=calcKDSeries(highs,lows,closes,9);
  return {
    rows:clean.slice(start),
    indicators:{
      ma5:slice(calcMovingAverageValues(closes,5)),
      ma10:slice(calcMovingAverageValues(closes,10)),
      ma20:slice(calcMovingAverageValues(closes,20)),
      ma60:slice(calcMovingAverageValues(closes,60)),
      macd:{
        dif:slice(macd.dif),
        signal:slice(macd.signal),
        hist:slice(macd.hist)
      },
      kd:{k:slice(kd.k),d:slice(kd.d)},
      rsi9:slice(calcRSISeries(closes,9)),
      rsi55:slice(calcRSISeries(closes,55))
    }
  };
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
  if(document.getElementById('tvStockChart')){
    renderTradingViewStockChart();
    return;
  }
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
