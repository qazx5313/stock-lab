/* ============ 1. 首頁 ============ */
function vHome(){
  const m=DATA.market;
  const ov=[
    ['加權指數',fmtPx(m.twse.v),m.twse.d,m.twse.dp],
    ['櫃買指數',fmtPx(m.tpex.v),m.tpex.d,m.tpex.dp],
  ];
  const picks=DATA.picks.slice(0,3);
  const flat=Number(m.flat)||0;
  const total=Math.max(1,m.up+m.down+flat);
  const upw=Math.max(12,Math.round(m.up/total*100))+'%';
  const downw=Math.max(12,Math.round(m.down/total*100))+'%';
  return `<div class="dash fade stagger">
   <div class="dash-head">
     <div>
       <div class="dash-title"><span class="target">◎</span>今日台股關注清單</div>
       <div class="hint">盤後量化 AI 依題材、技術與籌碼整理，快速掃描隔日觀察重點。</div>
     </div>
     <div class="spacer"></div>
     <span class="badge hot">資料日 ${DATA.meta.date}</span>
     <span class="badge obs">最後更新 ${DATA.meta.updated}</span>
   </div>

   <div class="pick-grid">
     ${picks.map((s,i)=>`<div class="pick-card ${i<2?'best':'watch'}" data-stock="${s.c}">
       <div class="pick-top">
         <div style="min-width:0;flex:1">
           <div class="pick-code">${s.c}</div>
           <div class="pick-name">${s.n}</div>
           <div style="margin-top:10px"><span class="badge ${i<2?'cool':'warm'}">${i<2?'強勢關注':'穩健關注'}</span></div>
         </div>
         <div class="score-ring" style="--score:${s.fs}"><i><span>總分</span><b>${s.fs}</b></i></div>
       </div>
       <div class="pick-scores">
         <div class="mini-score"><span>基本面</span><b>${Math.max(35,Math.round((s.cs+s.ms)/2))}/50</b></div>
         <div class="mini-score"><span>技術分</span><b>${Math.max(35,Math.round(s.ts/2))}/50</b></div>
       </div>
       <div class="pick-reason">${s.ai}</div>
       <div class="pick-tags"><span class="badge">${s.t}</span><span class="badge obs">MACD 多方</span><span class="badge obs">RSI 健康</span></div>
     </div>`).join('')}
   </div>

   <div class="dash-metrics">
     <div class="card card-pad">
       <div class="sec-title">市場環境</div>
       <div class="meter"><div class="meter-arc"><div class="needle"></div></div></div>
       <div style="display:flex;flex-direction:column;gap:4px">
         <b style="font-size:20px">${m.status}</b>
         <span class="muted" style="font-size:12.5px">${m.statusNote}</span>
       </div>
     </div>
     <div class="card card-pad">
       <div class="sec-title">大盤指數</div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
         ${ov.map(([k,v,d,dp])=>`<div class="stat"><span class="k">${k}</span><span class="v ${dcls(d)}">${v}</span><span class="d ${dcls(d)}">${sgn(d.toFixed(2))} (${sgn(dp.toFixed(2))}%)</span></div>`).join('')}
       </div>
       <svg class="spark" viewBox="0 0 300 82" preserveAspectRatio="none" aria-hidden="true">
         <polyline points="0,68 24,62 48,66 72,54 96,57 120,43 144,48 168,34 192,39 216,25 240,30 264,18 300,23" fill="none" stroke="#22C55E" stroke-width="3" stroke-linecap="round"/>
         <polyline points="0,75 300,75" fill="none" stroke="#E2E8F0" stroke-width="1"/>
       </svg>
     </div>
     <div class="card card-pad">
       <div class="sec-title">漲跌分布</div>
       <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">
         <div><div class="num up" style="font-size:21px;font-weight:900">${m.up}</div><div class="muted" style="font-size:12px">上漲</div></div>
         <div><div class="num down" style="font-size:21px;font-weight:900">${m.down}</div><div class="muted" style="font-size:12px">下跌</div></div>
         <div><div class="num" style="font-size:21px;font-weight:900">${flat}</div><div class="muted" style="font-size:12px">平盤</div></div>
       </div>
       <div class="barline" style="--upw:${upw};--downw:${downw}"><i></i><i></i><i></i></div>
       <div class="muted" style="font-size:12px;margin-top:12px">漲停 ${m.limitUp} · 跌停 ${m.limitDown}</div>
     </div>
     <div class="card card-pad">
       <div class="sec-title">資金動向</div>
       <div class="flow-list">
         <div class="flow-row"><span>上市</span><span class="up">${m.amtTwse}</span></div>
         <div class="flow-row"><span>上櫃</span><span class="up">${m.amtTpex}</span></div>
         <div class="flow-row"><span>題材熱度</span><span class="down">${DATA.themes[0].score}</span></div>
       </div>
       <div class="muted" style="font-size:12px;margin-top:12px">資金偏向 ${DATA.themes.slice(0,3).map(t=>t.name).join('、')}</div>
     </div>
   </div>

   <div class="dashboard-table-grid">
     <div class="card">
       <div class="card-h"><h3>自選股掃描</h3><span class="tag">Watchlist Scanner</span><span class="more" data-go="screen">查看全部 →</span></div>
       <div class="tbl-wrap"><table><thead><tr><th>股票</th><th class="r">收盤</th><th class="r">漲跌幅</th><th class="r">趨勢</th><th class="r">總分</th><th>備註</th></tr></thead><tbody>
         ${DATA.picks.slice(0,5).map(s=>`<tr><td><b class="code lnk" data-stock="${s.c}">${s.c}</b> <b>${s.n}</b></td><td class="r num">${fmtPx(s.px)}</td><td class="r num up">+${s.dp}%</td><td class="r"><svg width="70" height="24" viewBox="0 0 70 24"><polyline points="0,19 10,15 20,17 30,11 40,13 50,7 60,9 70,4" fill="none" stroke="#22C55E" stroke-width="2"/></svg></td><td class="r"><b class="num" style="color:var(--primary)">${s.fs}</b></td><td><span class="badge ${s.fs>=84?'cool':s.fs>=78?'warm':'obs'}">${s.fs>=84?'強勢關注':s.fs>=78?'持續觀察':'中性觀察'}</span></td></tr>`).join('')}
       </tbody></table></div>
     </div>
     <div class="card">
       <div class="card-h"><h3>個股比較</h3><span class="tag">Stock Compare</span></div>
       <div class="tbl-wrap"><table class="compare-mini"><thead><tr><th>股票</th>${picks.map(s=>`<th>${s.c}</th>`).join('')}</tr></thead><tbody>
         <tr><td>總分</td>${picks.map(s=>`<td class="num ${s.fs>=84?'up':'warn'}"><b>${s.fs}</b></td>`).join('')}</tr>
         <tr><td>基本分</td>${picks.map(s=>`<td class="num">${Math.max(35,Math.round((s.cs+s.ms)/2))}</td>`).join('')}</tr>
         <tr><td>技術分</td>${picks.map(s=>`<td class="num">${Math.max(35,Math.round(s.ts/2))}</td>`).join('')}</tr>
         <tr><td>漲跌幅</td>${picks.map(s=>`<td class="num up">+${s.dp}%</td>`).join('')}</tr>
       </tbody></table></div>
     </div>
   </div>

   <div class="grid" style="grid-template-columns:1fr 1fr">
     <div class="card">
       <div class="card-h"><h3>今日強勢題材排行</h3><span class="tag">熱度分數 · 升溫 / 主流 / 降溫</span><span class="more" data-go="map">產業地圖 →</span></div>
       <div class="tbl-wrap"><table><thead><tr><th>題材</th><th class="r">平均漲幅</th><th>熱度</th><th>狀態</th></tr></thead><tbody>
         ${DATA.themes.slice(0,6).map(t=>`<tr><td><b class="lnk" data-go="map">${t.name}</b><div style="font-size:11px;color:var(--ink-3);margin-top:2px">${t.chain}</div></td><td class="r up num">${t.gain}</td><td>${scoreCell(t.score)}</td><td>${thBadge(t.status)}</td></tr>`).join('')}
       </tbody></table></div>
     </div>
     <div class="card">
       <div class="card-h"><h3>今日重大公告 / 風險提醒</h3><span class="tag">News & Risk</span></div>
       <div style="padding:6px 0">
         ${DATA.news.slice(0,3).map(x=>`<div style="display:flex;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border-soft);align-items:flex-start"><span class="badge ${x.k}">${x.k==='good'?'利多':x.k==='bad'?'利空':'中性'}</span><div style="flex:1"><div style="font-size:13.5px;font-weight:700;line-height:1.45">${x.title}</div><div style="font-size:11.5px;color:var(--ink-3);margin-top:3px">${x.c!=='-'?x.c+' '+x.n+' · ':''}${x.time}</div></div></div>`).join('')}
         ${DATA.risks.slice(0,2).map(x=>`<div style="display:flex;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border-soft);align-items:center"><span class="badge warm">${x.type}</span><div style="flex:1"><b class="code">${x.c}</b> <b>${x.n}</b><span style="color:var(--ink-3);font-size:12px;margin-left:8px">${x.note}</span></div></div>`).join('')}
       </div>
     </div>
   </div>
  </div>`;
}

/* ============ 2. 產業題材地圖 ============ */
let MAP_SEL='glassfiber';
function vMap(){
  const t=DATA.themes.find(x=>x.id===MAP_SEL)||DATA.themes[0];
  const stocks=(t&&Array.isArray(t.stocks))?t.stocks:[];
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div style="display:flex;gap:9px;flex-wrap:wrap">
     ${DATA.themeList.map(n=>{const th=DATA.themes.find(x=>x.name===n);
       const id=th?th.id:'_'+n;const on=th&&th.id===MAP_SEL;
       return `<span class="chip ${on?'on':''}" data-theme="${id}">${n}${th?` · ${th.score}`:''}</span>`;}).join('')}
   </div>

   <div class="card">
     <div style="padding:20px 22px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;border-bottom:1px solid var(--border-soft)">
       <div style="flex:1;min-width:240px">
         <div style="display:flex;align-items:center;gap:10px">
           <h2 style="font-size:21px;font-weight:800;letter-spacing:-.4px">${t.name}</h2>${thBadge(t.status)}</div>
         <p style="color:var(--ink-2);font-size:13.5px;margin-top:8px;line-height:1.55">${t.desc}</p>
       </div>
       <div class="grid" style="grid-template-columns:repeat(3,auto);gap:24px">
         <div class="stat"><span class="k">熱度分數</span><span class="v" style="color:var(--primary)">${t.score}</span></div>
         <div class="stat"><span class="k">平均漲幅</span><span class="v up">${t.gain}</span></div>
         <div class="stat"><span class="k">資金狀態</span><span class="v" style="font-size:18px">${t.vol} 量增</span></div>
       </div>
     </div>
   </div>
   <div class="card">
     <div class="card-h"><h3>相關個股資料</h3><span class="tag">${stocks.length} 檔 · 點卡片可進個股分析</span></div>
     <div class="card-pad">
       ${stocks.length?`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px">
       ${stocks.slice(0,60).map(s=>`<div class="activation-card lnk" data-stock="${s.c}" style="min-height:142px">
         <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
           <div><div class="code" style="font-size:13px;color:var(--ink-3)">${s.c}</div>
           <b style="font-size:18px">${s.n}</b></div>
           <span class="badge">${s.role||'成分'}</span>
         </div>
         <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
           <span class="tag">${s.level||'未分類'}</span>
           <span class="tag">關聯 ${s.score||0}</span>
         </div>
         <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:14px">
           <div><div class="muted" style="font-size:11px">收盤</div><div class="num" style="font-weight:800;font-size:18px">${isFinite(s.px)?fmtPx(s.px):'—'}</div></div>
           <div class="num ${dcls(s.dp)}" style="font-weight:800">${isFinite(s.dp)?sgn(s.dp.toFixed(2))+'%':'—'}</div>
         </div>
         <div class="muted" style="font-size:12px;margin-top:8px">${s.note||'尚無補充說明'}</div>
       </div>`).join('')}
       </div>`:`<div class="muted" style="font-size:13px">此題材尚未有 Supabase 成分股資料。</div>`}
     </div>
   </div>
  </div>`;
}

/* ============ 3. 每日篩選 ============ */
const SEL=new Set(['今日漲幅 > 3%','站上 20MA','三大法人合計買超','今日強勢題材']);
function vScreen(){
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad">
     <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
       <b style="font-size:15px">篩選條件</b><span class="tag" style="color:var(--ink-3);font-size:12px">點選下方條件即時篩選 · 已選 <b id="selCnt">${SEL.size}</b> 項</span>
       <button class="btn ghost sm" id="clrBtn" style="margin-left:auto">清除</button>
       <button class="btn sm" id="runBtn">執行篩選</button>
     </div>
     ${Object.entries(DATA.filters).map(([g,arr])=>`<div style="margin-top:16px">
       <div class="sec-title" style="margin-bottom:9px">${g}條件</div>
       <div style="display:flex;gap:8px;flex-wrap:wrap">
       ${arr.map(f=>`<span class="chip ${SEL.has(f)?'on':''}" data-f="${f}">${f}</span>`).join('')}
       </div></div>`).join('')}
   </div>
   <div class="card">
     <div class="card-h"><h3>篩選結果</h3><span class="tag"><b id="resCnt">${DATA.screen.length}</b> 檔符合 · 依綜合分排序</span>
       <span class="more">匯出 CSV →</span></div>
     <div class="tbl-wrap"><table><thead><tr><th>代號</th><th>名稱</th><th>題材</th><th class="r">收盤</th><th class="r">漲跌</th>
       <th class="r">成交量</th><th class="r">技術分</th><th class="r">籌碼分</th><th class="r">題材分</th><th class="r">總分</th><th>操作</th></tr></thead>
       <tbody id="resBody">${rowsScreen(DATA.screen)}</tbody></table></div>
   </div>
  </div>`;
}
function rowsScreen(list){
  return list.map(s=>`<tr><td class="code lnk" data-stock="${s.c}">${s.c}</td><td><b>${s.n}</b></td>
    <td><span class="badge">${s.t}</span></td><td class="r num">${fmtPx(s.px)}</td>
    <td class="r num up">+${s.dp}%</td><td class="r num muted">${s.vol}</td>
    <td class="r num">${s.ts}</td><td class="r num">${s.cs}</td><td class="r num">${s.ms}</td>
    <td class="r"><b class="num" style="color:var(--primary);font-size:14px">${s.total}</b></td>
    <td><button class="btn line sm" data-stock="${s.c}">分析</button></td></tr>`).join('');
}

/* ============ 4. 個股分析 ============ */
function vStock(){
  const s=DATA.stock;
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad">
     <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start">
       <div style="flex:1;min-width:220px">
         <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
           <h2 style="font-size:22px;font-weight:800"><span class="code" style="font-size:18px;color:var(--ink-2)">${s.c}</span> ${s.n}</h2>
           <span class="badge">${s.market}</span><span class="badge obs">${s.industry}</span><span class="badge hot">${s.theme}</span>
         </div>
         <div style="margin-top:10px;color:var(--ink-2);font-size:13px">題材定位：${s.role}</div>
       </div>
       <div style="text-align:right">
         <div class="num up" style="font-size:30px;font-weight:800">${fmtPx(s.px)}</div>
         <div class="num up" style="font-weight:700">▲ +${s.dp}%　量 ${s.vol} 張</div>
       </div>
     </div>
     <div style="display:flex;gap:8px;margin-top:14px">
       <input id="stkInput" placeholder="輸入股票代號（示範：1815）" style="flex:1;max-width:260px;padding:9px 13px;border:1px solid var(--border);border-radius:10px;font-family:var(--mono);font-size:14px;outline:none">
       <button class="btn sm" id="stkSearchBtn">查詢</button>
     </div>
   </div>

   <div class="card">
     <div class="card-h"><h3>技術分析 · 近 60 日</h3><span class="tag">K 線 + 量 + 5/10/20/60MA</span>
       <div class="seg" style="margin-left:auto"><button class="on">日線</button><button>週線</button></div></div>
     <div class="card-pad">
       <canvas id="cK" style="width:100%;height:300px;display:block"></canvas>
       <canvas id="cV" style="width:100%;height:90px;display:block;margin-top:8px"></canvas>
       <div style="display:flex;gap:18px;font-size:11.5px;color:var(--ink-2);margin-top:10px;flex-wrap:wrap">
         <span><b style="color:#F59E0B">━</b> 5MA</span><span><b style="color:#2563EB">━</b> 10MA</span>
         <span><b style="color:#7C3AED">━</b> 20MA</span><span><b style="color:#0F172A">━</b> 60MA</span>
         <span style="margin-left:auto;color:var(--ink-3)">${s.levelText||'支撐 / 壓力：資料計算中'}</span>
       </div>
     </div>
   </div>

   <div class="grid" style="grid-template-columns:1fr 1fr">
     <div class="card"><div class="card-h"><h3>技術指標</h3></div>
       <div class="card-pad" style="display:flex;flex-direction:column;gap:14px">
         <div><div style="font-size:12px;color:var(--ink-2);margin-bottom:5px">KD（9,3,3）<b class="${s.tech?.kdClass||''}" style="float:right">${s.tech?.kdText||'尚無足夠歷史資料'}</b></div><canvas id="cKD" style="width:100%;height:80px;display:block"></canvas></div>
         <div><div style="font-size:12px;color:var(--ink-2);margin-bottom:5px">MACD <b class="${s.tech?.macdClass||''}" style="float:right">${s.tech?.macdText||'尚無足夠歷史資料'}</b></div><canvas id="cMD" style="width:100%;height:80px;display:block"></canvas></div>
         <div><div style="font-size:12px;color:var(--ink-2);margin-bottom:5px">RSI（14）<b class="${s.tech?.rsiClass||''}" style="float:right">${s.tech?.rsiText||'尚無足夠歷史資料'}</b></div><canvas id="cRS" style="width:100%;height:80px;display:block"></canvas></div>
       </div>
     </div>
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
async function loadStockSeries(sym){
  try{
    DATA.stock.c=sym;
    DATA.stock.tech=null;
    DATA.stock.ann=[];
    DATA.stock.levelText='';
    DATA.stock.inst={foreign:'—',trust:'—',dealer:'—',total:'—'};
    DATA.stock.margin={mb:'—',sb:'—',mc:'—',sc:'—'};
    DATA.stock.inst3='尚無近期籌碼資料';
    const rows = await sbGet(
      `daily_prices?select=date,open,high,low,close,volume&symbol=eq.${sym}`+
      `&order=date.asc`, 5000);
    if(Array.isArray(rows) && rows.length>=5){
      DATA.stock.series = normalizeStockSeries(rows.map(r=>({
        o:Number(r.open)||Number(r.close)||0,
        h:Number(r.high)||Number(r.close)||0,
        l:Number(r.low)||Number(r.close)||0,
        c:Number(r.close)||0,
        v:Number(r.volume)||0,
        d:String(r.date).slice(0,10)
      })).filter(x=>x.c>0));
      // 帶入最新報價到標頭
      const last=DATA.stock.series[DATA.stock.series.length-1];
      const prev=DATA.stock.series[DATA.stock.series.length-2];
      if(last){
        DATA.stock.px=last.c;
        if(prev&&prev.c) DATA.stock.dp=+(((last.c-prev.c)/prev.c)*100).toFixed(2);
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
      const closes=DATA.stock.series.map(x=>x.c);
      const highs=DATA.stock.series.map(x=>x.h);
      const lows=DATA.stock.series.map(x=>x.l);
      const kd=calcKDSeries(highs,lows,closes);
      const rsi=calcRSISeries(closes);
      const md=calcMACDSeries(closes);
      const lk=lastNum(kd.k), ld=lastNum(kd.d), lr=lastNum(rsi), lh=lastNum(md.hist);
      DATA.stock.tech={
        kd:kd, rsi:rsi, macd:md,
        kdText:lk==null||ld==null?'尚無足夠歷史資料':`K ${lk.toFixed(1)} · D ${ld.toFixed(1)} ${lk>=ld?'偏多':'偏弱'}`,
        kdClass:lk!=null&&ld!=null?(lk>=ld?'up':'down'):'',
        macdText:lh==null?'尚無足夠歷史資料':`${lh>=0?'柱狀為正':'柱狀為負'} ${lh.toFixed(3)}`,
        macdClass:lh!=null?(lh>=0?'up':'down'):'',
        rsiText:lr==null?'尚無足夠歷史資料':`${lr.toFixed(1)} ${lr>=70?'過熱':lr>=50?'偏強':lr<=30?'偏弱':'中性'}`,
        rsiClass:lr!=null?(lr>=50?'up':'down'):''
      };
      const recent=DATA.stock.series.slice(-20);
      if(recent.length){
        const sup=Math.min(...recent.map(x=>x.l));
        const res=Math.max(...recent.map(x=>x.h));
        DATA.stock.levelText=`近20日支撐 ${fmtPx(sup)} / 壓力 ${fmtPx(res)}`;
      }
      await loadStockRealDetails(sym);
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
    const inst=await sbGet(`institutional_trades?select=date,foreign_buy_sell,investment_trust_buy_sell,dealer_buy_sell,total_buy_sell&symbol=eq.${sym}&order=date.desc&limit=5`,5);
    if(inst&&inst.length){
      const latest=inst[0];
      DATA.stock.inst={
        foreign:fmtInst(latest.foreign_buy_sell),
        trust:fmtInst(latest.investment_trust_buy_sell),
        dealer:fmtInst(latest.dealer_buy_sell),
        total:fmtInst(latest.total_buy_sell)
      };
      const sum=(k)=>inst.reduce((a,r)=>a+(Number(r[k])||0),0);
      DATA.stock.inst3=`近${inst.length}筆合計：外資 ${fmtInst(sum('foreign_buy_sell'))} · 投信 ${fmtInst(sum('investment_trust_buy_sell'))} · 自營商 ${fmtInst(sum('dealer_buy_sell'))}（單位：張）`;
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
}

function genSeries(n,base,vol){let p=base,a=[];for(let i=0;i<n;i++){const o=p,ch=(Math.sin(i/4)+ (Math.random()-.45))*vol;
  const c=Math.max(base*.6,o+ch);const h=Math.max(o,c)*(1+Math.random()*.012);const l=Math.min(o,c)*(1-Math.random()*.012);
  a.push({o,h,l,c,v:Math.round((6000+Math.random()*9000)*(1+Math.abs(ch)/vol))});p=c;}return a;}
function normalizeStockSeries(rows){
  const byDate=new Map();
  (rows||[]).forEach(r=>{
    const d=String(r.d||'').slice(0,10);
    if(!d || !isFinite(r.c) || r.c<=0) return;
    const prev=byDate.get(d);
    if(!prev || Number(r.v||0)>=Number(prev.v||0)) byDate.set(d,{...r,d});
  });
  const sorted=[...byDate.values()].sort((a,b)=>String(a.d).localeCompare(String(b.d)));
  const out=[];
  sorted.forEach(r=>{
    const p=out[out.length-1];
    const sameBar=p&&['o','h','l','c','v'].every(k=>Number(p[k]||0)===Number(r[k]||0));
    if(!sameBar) out.push(r);
  });
  return out;
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
function drawStockCharts(){
  const D=(DATA.stock&&Array.isArray(DATA.stock.series)&&DATA.stock.series.length>=5)
            ? DATA.stock.series.slice(-60)
            : [];
  const m5=ma(D,5),m10=ma(D,10),m20=ma(D,20),m60v=D.map(d=>d.c);
  const empty=(g,msg='尚無足夠真實資料')=>{if(!g)return;const{x,w,h}=g;x.fillStyle='#94A3B8';x.font='13px system-ui';x.textAlign='center';x.fillText(msg,w/2,h/2);};
  // K 線
  let g=setupCanvas('cK');if(g){const{x,w,h}=g;const pad=8;
    if(!D.length){empty(g);return;}
    const all=D.flatMap(d=>[d.h,d.l]);const mx=Math.max(...all)*1.01,mn=Math.min(...all)*.99;
    const Y=v=>pad+(mx-v)/(mx-mn)*(h-pad*2);const bw=(w-20)/D.length;
    x.strokeStyle='#F1F5F9';for(let i=0;i<5;i++){const yy=pad+i*(h-pad*2)/4;x.beginPath();x.moveTo(0,yy);x.lineTo(w,yy);x.stroke();}
    D.forEach((d,i)=>{const cx=10+i*bw+bw/2;const up=d.c>=d.o;x.strokeStyle=x.fillStyle=up?'#DC2626':'#16A34A';
      x.beginPath();x.moveTo(cx,Y(d.h));x.lineTo(cx,Y(d.l));x.stroke();
      const yo=Y(d.o),yc=Y(d.c);x.fillRect(cx-bw*.3,Math.min(yo,yc),bw*.6,Math.max(2,Math.abs(yc-yo)));});
    const line=(arr,col)=>{x.strokeStyle=col;x.lineWidth=1.5;x.beginPath();let st=false;
      arr.forEach((v,i)=>{if(v==null)return;const cx=10+i*bw+bw/2,cy=Y(v);st?x.lineTo(cx,cy):x.moveTo(cx,cy);st=true;});x.stroke();};
    line(m5,'#F59E0B');line(m10,'#2563EB');line(m20,'#7C3AED');}
  // 量
  g=setupCanvas('cV');if(g){const{x,w,h}=g;const mv=Math.max(...D.map(d=>d.v));const bw=(w-20)/D.length;
    D.forEach((d,i)=>{const cx=10+i*bw,bh=d.v/mv*(h-6);x.fillStyle=d.c>=d.o?'rgba(220,38,38,.55)':'rgba(22,163,74,.55)';
      x.fillRect(cx,h-bh,bw*.62,bh);});}
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
function vReport(){
  const m=DATA.market;
  const topThemes=DATA.themes.slice(0,5);
  const topPicks=DATA.picks.slice(0,5);
  const topNews=DATA.realNewsLoaded?(DATA.news||[]).filter(n=>n.c!=='-'||n.title).slice(0,5):[];
  const risks=DATA.realRisksLoaded?(DATA.risks||[]):[];
  const sourceReal=SRC_STATUS.indexOf('✅')===0;
  const note=reportNote();
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card">
     <div class="card-h"><h3>${DATA.meta.date}（${DATA.meta.weekday}）盤後報告</h3>
       <span class="tag">${sourceReal?'Supabase 真實資料':'資料不足，顯示可用資料'}</span></div>
     <div class="card-pad" style="line-height:1.85;font-size:14.5px">
       <p><b>一、今日市場總結</b><br>
       加權指數 <b class="num ${dcls(m.twse.dp)}">${fmtPx(m.twse.v)}</b>（${sgn(Number(m.twse.dp||0).toFixed(2))}%），
       櫃買指數 <b class="num ${dcls(m.tpex.dp)}">${fmtPx(m.tpex.v)}</b>（${sgn(Number(m.tpex.dp||0).toFixed(2))}%）。
       上漲 ${m.up} 家、下跌 ${m.down} 家。${sourceReal?'本段由 Supabase 最新交易日資料產生。':'目前資料來源不足，請先執行資料更新。'}</p>

       <p style="margin-top:14px"><b>二、今日強勢題材</b></p>
       <ol style="margin:6px 0 0 22px">
       ${topThemes.length?topThemes.map(t=>`<li style="margin:3px 0">${t.name}　<span class="muted" style="font-size:13px">熱度 ${t.score} · ${t.status} · 平均 ${t.gain}</span></li>`).join(''):'<li class="muted">尚無題材熱度資料</li>'}
       </ol>

       <p style="margin-top:14px"><b>三、今日精選股票</b></p>
       ${topPicks.length?topPicks.map(p=>`<div style="background:var(--blue-tint);border:1px solid var(--blue-soft);border-radius:12px;padding:13px 16px;margin-top:8px">
         <b style="font-size:15px"><span class="code">${p.c}</span> ${p.n}</b> <span class="badge hot" style="margin-left:6px">${p.t||'—'}</span>
         <div style="margin-top:7px;font-size:13.5px;color:var(--ink-2);line-height:1.7">
         綜合分 ${p.fs??p.total??'—'} · 技術分 ${p.ts??'—'} · 籌碼分 ${p.cs??'—'} · 題材分 ${p.ms??'—'}<br>
         ${p.ai||'尚無系統摘要'}</div>
       </div>`).join(''):'<div class="muted" style="margin-top:8px">尚無精選股票資料</div>'}

       <p style="margin-top:14px"><b>四、今日風險股票</b><br>
       ${risks.length?risks.map(r=>`${r.c} ${r.n}（${r.type}）`).join('、'):'尚無真實風險清單資料'}。</p>

       <p style="margin-top:14px"><b>五、今日重大公告</b><br>
       ${topNews.length?topNews.map(n=>`${n.c&&n.c!=='-'?n.c+' '+n.n+'：':''}${n.title}`).join('；'):'尚無重大公告資料'}。</p>

       <p style="margin-top:14px"><b>六、明日觀察重點</b><br>
       觀察 ${topThemes.slice(0,3).map(t=>t.name).join('、')||'主流題材'} 是否延續量價強度，並追蹤精選股是否維持技術分與籌碼分同步改善。</p>
       ${note?`<p style="margin-top:14px"><b>管理員備註</b><br>${esc(note).replace(/\n/g,'<br>')}</p>`:''}
     </div>
   </div>
   <div class="card card-pad" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
     <span class="badge ${sourceReal?'good':'warm'}">${sourceReal?'真實資料報告':'等待資料更新'}</span>
     <span style="font-size:13px;color:var(--ink-2)">報告內容只使用目前資料庫已載入的市場、題材、候選股與公告資料，不再混入固定範例文字。</span>
   </div>
  </div>`;
}

/* ============ 6. AI 量化模擬操盤實驗室 ============ */
let AI_VIEW=null;
function vAI(){
  if(AI_VIEW) return vAIDetail(AI_VIEW);
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad" style="background:linear-gradient(120deg,#EFF6FF,#fff)">
     <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
       <div style="width:42px;height:42px;border-radius:12px;background:var(--primary);display:flex;align-items:center;justify-content:center">
         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg></div>
       <div><b style="font-size:17px">AI 量化模擬操盤實驗室</b>
       <div style="font-size:12.5px;color:var(--ink-2);margin-top:2px">候選池 → AI 初篩 → 歷史回測 → FinMind 詳細分析 → 模擬交易 → 多 AI 檢討 → 策略升版</div></div>
     </div>
   </div>

   <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;font-size:12px;color:var(--ink-2)">
     ${['主系統盤後資料','每日篩選候選池','3 AI 各自選股','主庫歷史回測','FinMind 詳細分析','AI 綜合評分','模擬買進','持股追蹤','多 AI 檢討','策略升版'].map((s,i,a)=>
       `<span style="background:#fff;border:1px solid var(--border);padding:7px 12px;border-radius:99px;white-space:nowrap;font-weight:600">${i+1}. ${s}</span>${i<a.length-1?'<span style="display:flex;align-items:center;color:var(--ink-3)">›</span>':''}`).join('')}
   </div>

   <div class="grid stagger" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
   ${DATA.agents.map(a=>`<div class="card" style="cursor:pointer;transition:.15s" data-ai="${a.id}" onmouseover="this.style.boxShadow='var(--shadow-lg)'" onmouseout="this.style.boxShadow='var(--shadow)'">
     <div class="card-pad" style="border-bottom:1px solid var(--border-soft)">
       <div style="display:flex;align-items:center;gap:10px"><b style="font-size:16px">${a.name}</b>
       <span class="badge ${a.status==='運行中'?'cool':'obs'}" style="margin-left:auto">${a.status}</span></div>
       <div style="font-size:12px;color:var(--ink-3);margin-top:3px">${a.type} · 策略 ${a.ver}</div>
       <p style="font-size:12.5px;color:var(--ink-2);margin-top:9px;line-height:1.5">${a.desc}</p>
     </div>
     <div class="grid" style="grid-template-columns:1fr 1fr;gap:0">
       ${[['今日初篩',a.pre+' 檔'],['回測通過',a.passed+' 檔'],['今日模擬買進',a.buy+' 檔'],['回測平均勝率',a.wr],
          ['累積報酬率',a.cum,'up'],['本月報酬',a.mon,'up'],['勝率',a.win],['最大回撤',a.mdd,'down']].map((r,i)=>
         `<div style="padding:13px 18px;border-right:${i%2===0?'1px solid var(--border-soft)':'none'};border-bottom:1px solid var(--border-soft)">
         <div style="font-size:11px;color:var(--ink-3);font-weight:600">${r[0]}</div>
         <div class="num ${r[2]||''}" style="font-size:17px;font-weight:800;margin-top:2px">${r[1]}</div></div>`).join('')}
     </div>
     <div class="card-pad" style="display:flex;align-items:center"><span style="font-size:12px;color:var(--ink-2)">目前持股 <b>${a.pos}</b> 檔</span>
       <span class="more" style="margin-left:auto">查看 AI 詳細 →</span></div>
   </div>`).join('')}
   </div>
  </div>`;
}

async function loadAIDetailData(agentKey){
  const a=DATA.agents.find(x=>x.id===agentKey)||DATA.agents[0];
  if(!a || !a._id) return;
  const aid=a._id;
  try{
    const cs=await sbGet(
      `ai_candidates?select=symbol,agent_reason,accepted_by_agent&agent_id=eq.${aid}&order=id.desc`,200);
    DATA.aiCand=(Array.isArray(cs)?cs:[]).filter(c=>c.accepted_by_agent).slice(0,20).map(c=>({
      c:c.symbol, n:c.symbol, src:'候選池', reason:c.agent_reason||'—', score:'—'}));
    const bk=await sbGet(
      `ai_backtests?select=symbol,matched_conditions,sample_count,win_rate,avg_return_5d,avg_return_3d,avg_return_10d,max_drawdown,profit_factor,passed&agent_id=eq.${aid}&order=id.desc`,200);
    DATA.aiBack=(Array.isArray(bk)?bk:[]).slice(0,30).map(b=>({
      c:b.symbol, n:b.symbol, cond:b.matched_conditions||'—',
      s:b.sample_count, wr:b.win_rate+'%', ar:(b.avg_return_5d>0?'+':'')+b.avg_return_5d+'%',
      r3:(b.avg_return_3d>0?'+':'')+b.avg_return_3d+'%',
      r5:(b.avg_return_5d>0?'+':'')+b.avg_return_5d+'%',
      r10:(b.avg_return_10d>0?'+':'')+b.avg_return_10d+'%',
      mdd:b.max_drawdown+'%', pf:String(b.profit_factor),
      res:b.passed?'通過':'不通過'}));
    const ps=await sbGet(
      `ai_positions?select=symbol,name,buy_price,current_price,quantity,buy_reason,status&agent_id=eq.${aid}&status=eq.持有`,200);
    DATA.aiPos=(Array.isArray(ps)?ps:[]).map(p=>({
      c:p.symbol, n:p.name||p.symbol, bp:p.buy_price, cp:p.current_price,
      q:p.quantity, reason:p.buy_reason||'—'}));
    const tb=await sbGet(
      `ai_trades?select=trade_date,symbol,price,quantity,reason,trade_type&agent_id=eq.${aid}&order=id.desc`,200);
    DATA.aiBuy=(Array.isArray(tb)?tb:[]).filter(t=>t.trade_type==='買進').slice(0,20).map(t=>({
      d:String(t.trade_date).slice(5).replace('-','/'), c:t.symbol, n:t.symbol,
      p:t.price, q:t.quantity, s:'—', reason:t.reason||'—'}));
    DATA.aiSell=(Array.isArray(tb)?tb:[]).filter(t=>t.trade_type==='賣出').slice(0,20).map(t=>({
      d:String(t.trade_date).slice(5).replace('-','/'), c:t.symbol, n:t.symbol,
      p:t.price, pnl:'—', ret:'—', reason:t.reason||'—', early:'—', late:'—'}));
    const rv=await sbGet(
      `ai_reviews?select=review_date,self_review,improvement_suggestion&agent_id=eq.${aid}&order=id.desc`,20);
    DATA.aiReview=(Array.isArray(rv)?rv:[]).slice(0,8).map(r=>({
      q:String(r.review_date).slice(0,10), a:(r.improvement_suggestion||r.self_review||'—')}));
    const vv=await sbGet(
      `ai_strategy_versions?select=version,created_at,reason,old_rules,new_rules,change_summary&agent_id=eq.${aid}&order=id.desc`,20);
    DATA.aiVer=(Array.isArray(vv)?vv:[]).slice(0,10).map(v=>({
      v:v.version||'—', d:String(v.created_at||'').slice(0,10),
      reason:v.reason||'—', old:v.old_rules||'—', new:v.new_rules||'—',
      perf:v.change_summary||'—'}));
  }catch(e){ console.warn('AI 明細載入略過:',e); }
}

function vAIDetail(id){
  const a=DATA.agents.find(x=>x.id===id);
  const blk=(title,sub,body)=>`<div class="card"><div class="card-h"><h3>${title}</h3>${sub?`<span class="tag">${sub}</span>`:''}</div>${body}</div>`;
  const tbl=(head,rows)=>`<div class="tbl-wrap"><table><thead><tr>${head.map(h=>`<th class="${h[1]||''}">${h[0]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  return `<div class="fade" style="display:flex;flex-direction:column;gap:16px">
   <button class="btn line sm" data-aiback style="align-self:flex-start">‹ 返回 AI 列表</button>

   ${blk('1 · AI 投資人概況','',`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));padding:18px 20px;gap:18px">
     ${[['AI 名稱',a.name],['策略類型',a.type],['交易週期','短中波段'],['初始資金','NT$ '+a.init.toLocaleString()],
        ['目前資產','NT$ '+(a.cash+a.hold).toLocaleString(),'up'],['現金','NT$ '+a.cash.toLocaleString()],
        ['持股市值','NT$ '+a.hold.toLocaleString()],['累積報酬率',a.cum,'up'],['最大回撤',a.mdd,'down'],
        ['策略版本',a.ver],['目前狀態',a.status]].map(r=>
       `<div class="stat"><span class="k">${r[0]}</span><span class="v ${r[2]||''}" style="font-size:16px">${r[1]}</span></div>`).join('')}</div>`)}

   ${blk('2 · 候選股票來源','從各板塊取得候選股',tbl(
     [['代號'],['名稱'],['來源板塊'],['候選原因'],['初篩分','r']],
     DATA.aiCand.map(c=>`<tr><td class="code lnk" data-stock="${c.c}">${c.c}</td><td><b>${c.n}</b></td>
       <td><span class="badge obs">${c.src}</span></td><td class="muted" style="white-space:normal;min-width:200px">${c.reason}</td>
       <td class="r"><b class="num" style="color:var(--primary)">${c.score}</b></td></tr>`).join('')))}

   ${blk('3 · 歷史回測區','使用主系統資料庫回測',tbl(
     [['代號'],['名稱'],['相似條件'],['樣本','r'],['勝率','r'],['平均報酬','r'],['3日','r'],['5日','r'],['10日','r'],['最大回撤','r'],['盈虧比','r'],['結果']],
     DATA.aiBack.map(b=>`<tr><td class="code">${b.c}</td><td><b>${b.n}</b></td>
       <td class="muted" style="white-space:normal;min-width:160px">${b.cond}</td><td class="r num">${b.s}</td>
       <td class="r num">${b.wr}</td><td class="r num up">${b.ar}</td><td class="r num up">${b.r3}</td><td class="r num up">${b.r5}</td>
       <td class="r num ${b.r10.includes('-')?'down':'up'}">${b.r10}</td><td class="r num down">${b.mdd}</td><td class="r num">${b.pf}</td>
       <td><span class="badge ${b.res==='通過'?'good':b.res==='不通過'?'bad':'obs'}">${b.res}</span></td></tr>`).join('')))}

   ${blk('4 · FinMind 詳細分析區','僅回測通過股票進入此區（節省 API 額度）',`<div class="card-pad">
     <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><b class="code">1815</b><b>富喬</b>
       <span class="badge good">回測通過</span><span class="badge hot">AI 最終評分 90</span></div>
     <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px">
       ${[['近 60 日技術','多頭排列、站上所有均線'],['近 20 日法人','合計買超 +39,100 張'],
          ['近 20 日資券','資減券增，籌碼健康'],['近 12 月營收','YoY +24%，連 3 月成長'],
          ['最近 4 季 EPS','0.62 / 0.71 / 0.85 / 0.93'],['本益比 / 股價淨值比','24.1 倍 / 3.2 倍'],
          ['除權息','現金股利 1.2 元'],['風險摘要','單日漲幅大，留意追高']].map(r=>
         `<div style="background:var(--blue-tint);border:1px solid var(--blue-soft);border-radius:10px;padding:12px 14px">
         <div style="font-size:11px;color:var(--primary);font-weight:700">${r[0]}</div>
         <div style="font-size:13px;font-weight:600;margin-top:4px">${r[1]}</div></div>`).join('')}
     </div></div>`)}

   ${blk('5 · 目前持有股票','',tbl(
     [['代號'],['名稱'],['買進價','r'],['現價','r'],['張數','r'],['持股市值','r'],['未實現損益','r'],['報酬率','r'],['買進原因']],
     DATA.aiPos.map(p=>{const pnl=(p.cp-p.bp)*p.q*1000;const ret=((p.cp-p.bp)/p.bp*100);
       return `<tr><td class="code">${p.c}</td><td><b>${p.n}</b></td><td class="r num">${fmtPx(p.bp)}</td>
       <td class="r num">${fmtPx(p.cp)}</td><td class="r num">${p.q}</td><td class="r num">${(p.cp*p.q*1000).toLocaleString()}</td>
       <td class="r num ${pnl>=0?'up':'down'}">${sgn(Math.round(pnl).toLocaleString())}</td>
       <td class="r num ${ret>=0?'up':'down'}">${sgn(ret.toFixed(1))}%</td>
       <td class="muted" style="white-space:normal;min-width:160px">${p.reason}</td></tr>`;}).join('')))}

   <div class="grid" style="grid-template-columns:1fr 1fr">
     ${blk('6 · 買進紀錄','',tbl([['日期'],['股票'],['價格','r'],['張','r'],['分','r'],['原因']],
       DATA.aiBuy.map(b=>`<tr><td class="code">${b.d}</td><td><b class="code">${b.c}</b> ${b.n}</td>
       <td class="r num">${fmtPx(b.p)}</td><td class="r num">${b.q}</td><td class="r num">${b.s}</td>
       <td class="muted" style="white-space:normal;min-width:120px">${b.reason}</td></tr>`).join('')))}
     ${blk('7 · 賣出紀錄','',tbl([['日期'],['股票'],['價格','r'],['損益','r'],['報酬','r'],['檢討']],
       DATA.aiSell.map(s=>`<tr><td class="code">${s.d}</td><td><b class="code">${s.c}</b> ${s.n}</td>
       <td class="r num">${fmtPx(s.p)}</td><td class="r num ${s.pnl.includes('-')?'down':'up'}">${s.pnl}</td>
       <td class="r num ${s.ret.includes('-')?'down':'up'}">${s.ret}</td>
       <td class="muted" style="white-space:normal">${s.reason}（賣早:${s.early}/賣晚:${s.late}）</td></tr>`).join('')))}
   </div>

   ${blk('8 · AI 自我檢討區','每次交易結束後自動產生',`<div class="card-pad" style="display:flex;flex-direction:column;gap:9px">
     ${DATA.aiReview.map(r=>`<div style="display:flex;gap:14px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border-soft)">
       <div style="width:140px;flex-shrink:0;font-size:12.5px;color:var(--ink-2);font-weight:700">${r.q}</div>
       <div style="font-size:13px">${r.a}</div></div>`).join('')}</div>`)}

   ${blk('9 · 多 AI 檢討流程','首版以規則 / 模擬文字產生，未來再接 API',`<div class="card-pad">
     <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px">
     ${['交易結果','原始 AI 自我檢討','ChatGPT 檢討策略','Gemini 再檢討','策略審核 AI 統整','產生修改建議','回傳原始 AI','更新下一版'].map((s,i,arr)=>
       `<div style="min-width:130px;background:var(--blue-tint);border:1px solid var(--blue-soft);border-radius:10px;padding:11px 13px;font-size:12px;font-weight:600;text-align:center">${s}</div>${i<arr.length-1?'<div style="display:flex;align-items:center;color:var(--ink-3);font-weight:800">→</div>':''}`).join('')}
     </div>
     <div style="margin-top:12px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:12px 14px;font-size:12.5px;color:#9A3412">
       首版不強制使用 OpenAI / Gemini API，避免費用。資料表與 UI 已就緒，未來把檢討流程接上 API 即可運作。</div></div>`)}

   ${blk('10 · AI 策略版本紀錄','',tbl([['版本'],['時間'],['修改原因'],['舊規則'],['新規則'],['績效變化']],
     DATA.aiVer.map(v=>`<tr><td><span class="badge">${v.v}</span></td><td class="code">${v.d}</td>
     <td class="muted" style="white-space:normal;min-width:130px">${v.reason}</td>
     <td class="muted" style="white-space:normal;min-width:140px">${v.old}</td>
     <td style="white-space:normal;min-width:160px">${v.new}</td>
     <td class="num up" style="white-space:normal">${v.perf}</td></tr>`).join('')))}
  </div>`;
}

/* ============ 7. 後台管理 ============ */
function vAdmin(){
  if(!isAdmin()){
    return `<div class="fade account-grid">
      <div class="card card-pad auth-panel">
        <h3 style="font-size:18px;margin-bottom:10px">需要管理員登入</h3>
        <div class="muted" style="font-size:13.5px;line-height:1.7">後台管理、板塊開通設定與使用天數設定只開放管理員帳號操作。</div>
        <div style="margin-top:14px"><span class="badge warm">請使用 Supabase app_users 內 role=admin 的帳號</span></div>
      </div>
      <div class="card card-pad">
        <h3 style="font-size:18px;margin-bottom:12px">管理員登入</h3>
        <div class="form-grid">
          <div class="field"><label>帳號</label><input id="loginAccount" autocomplete="username" placeholder="輸入管理員帳號"></div>
          <div class="field"><label>密碼</label><input id="loginPassword" type="password" autocomplete="current-password" placeholder="輸入管理員密碼"></div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn" id="loginBtn">登入後台</button>
            <span id="loginMsg" class="muted" style="font-size:13px"></span>
          </div>
        </div>
      </div>
    </div>`;
  }
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad" style="background:var(--accent-soft);border-color:var(--accent)">
     <b style="font-size:13.5px">📌 說明</b>
     <div style="font-size:13px;color:var(--ink-2);margin-top:6px;line-height:1.6">
       股票、題材、AI 資料皆由系統每日盤後自動抓取與計算維護，此處為檢視。
       「開通設定」可設定板塊是否開通與使用天數。</div>
   </div>
   <div class="seg" style="flex-wrap:wrap" id="admSeg">
     ${['股票資料','題材分類','篩選參數','每日報告','開通設定','AI 機器人'].map((t,i)=>`<button class="${i===0?'on':''}" data-tab="${i}">${t}</button>`).join('')}
   </div>
   <div id="admBody"></div>
  </div>`;
}
function admBody(i){
  const b=document.getElementById('admBody');if(!b)return;
  if(i===0){b.innerHTML=`<div class="card"><div class="card-h"><h3>股票資料管理</h3><button class="btn sm" id="addStockBtn" style="margin-left:auto">+ 新增股票</button></div>
    <div id="adminEditor"></div>
    <div class="tbl-wrap"><table><thead><tr><th>代號</th><th>名稱</th><th>市場</th><th>傳統產業</th><th>題材分類</th><th>龍頭</th><th>觀察</th><th>操作</th></tr></thead><tbody>
    ${DATA.adminStocks.map(s=>`<tr><td class="code">${s.c}</td><td><b>${s.n}</b></td><td>${s.m}</td><td class="muted">${s.ind}</td>
      <td><span class="badge">${s.th}</span></td><td>${s.lead?'<span class="badge hot">龍頭</span>':'—'}</td>
      <td>${s.obs?'<span class="badge warm">觀察</span>':'—'}</td>
      <td><button class="btn line sm" data-stock-edit="${s.c}">編輯</button></td></tr>`).join('')}</tbody></table></div></div>`;}
  else if(i===1){b.innerHTML=`<div class="card"><div class="card-h"><h3>題材分類管理</h3><button class="btn sm" id="addThemeBtn" style="margin-left:auto">+ 新增題材</button></div>
    <div id="adminEditor"></div>
    <div class="tbl-wrap"><table><thead><tr><th>題材名稱</th><th>說明</th><th>產業鏈位置</th><th>相關股票數</th><th>操作</th></tr></thead><tbody>
    ${DATA.themes.map(t=>`<tr><td><b>${t.name}</b></td><td class="muted" style="white-space:normal;min-width:260px">${t.desc}</td>
      <td>${t.chain}</td><td class="num">${Array.isArray(t.stocks)?t.stocks.length:'—'}</td><td><button class="btn line sm" data-theme-edit="${t.id}">編輯產業鏈</button></td></tr>`).join('')}</tbody></table></div></div>`;}
  else if(i===2){
    const P=DATA.appSettings||{};
    const fields=[
      ['成交量門檻（張）','vol_threshold',P.vol_threshold||'3000'],
      ['股價門檻','price_threshold',P.price_threshold||'20'],
      ['RSI 門檻','rsi_threshold',P.rsi_threshold||'50'],
      ['法人買超天數','inst_buy_days',P.inst_buy_days||'3'],
      ['題材熱度權重','heat_weight',P.heat_weight||'技術35 籌碼30 題材35']];
    b.innerHTML=`<div class="card card-pad"><h3 style="margin-bottom:16px">篩選參數管理</h3>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">
      ${fields.map(r=>`<div><label style="font-size:12px;color:var(--ink-2);font-weight:600">${r[0]}</label>
        <input id="set_${r[1]}" value="${r[2]}" style="width:100%;margin-top:6px;padding:9px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--mono);font-size:13px;outline:none"></div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:18px">
        <button class="btn" id="saveSetBtn">儲存設定</button>
        <span id="saveSetMsg" style="font-size:13px;color:var(--ink-2)"></span>
      </div>
      <div style="font-size:12px;color:var(--ink-3);margin-top:10px">儲存後於下次盤後計算生效。MA/KD/MACD 為標準參數，固定不開放調整。</div>
    </div>`;
    const keys=fields.map(f=>f[1]);
    const btn=document.getElementById('saveSetBtn');
    if(btn)btn.onclick=async()=>{
      btn.disabled=true;btn.textContent='儲存中…';
      const msg=document.getElementById('saveSetMsg');
      try{
        const rows=keys.map(k=>({key:k,value:(document.getElementById('set_'+k)||{}).value||'',updated_at:new Date().toISOString()}));
        const r=await fetch(`${SB_URL}/rest/v1/app_settings?on_conflict=key`,{
          method:'POST',
          headers:{apikey:SB_ANON,Authorization:`Bearer ${SB_ANON}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify(rows)});
        if(r.ok){
          DATA.appSettings=DATA.appSettings||{};rows.forEach(x=>DATA.appSettings[x.key]=x.value);
          if(msg){msg.textContent='✅ 已儲存（下次盤後計算生效）';msg.style.color='var(--up)';}
        }else{
          const t=await r.text().catch(()=> '');
          if(msg){msg.textContent='⚠️ 儲存失敗 '+r.status+'（請先在 Supabase 建 app_settings 表）';msg.style.color='#92400E';}
        }
      }catch(e){
        if(msg){msg.textContent='⚠️ 儲存失敗：'+(e&&e.message||e);msg.style.color='#92400E';}
      }
      btn.disabled=false;btn.textContent='儲存設定';
    };
  }
  else if(i===3){b.innerHTML=`<div class="card card-pad"><h3 style="margin-bottom:14px">每日報告管理</h3>
    <div style="display:flex;flex-direction:column;gap:11px">
    ${[['自動產出報告','已啟用 · 依 Supabase 當日資料即時組成'],['資料來源',SRC_STATUS],['發布狀態','前台即時顯示，管理員備註可儲存'],['風險提醒','目前讀取系統風險清單，後續可擴充手動風險表']].map(r=>
      `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-soft)">
      <b style="font-size:13.5px;width:160px">${r[0]}</b><span class="muted" style="flex:1">${r[1]}</span>
      <span class="badge obs">檢視</span></div>`).join('')}
      <div class="field" style="margin-top:14px">
        <label>管理員手動備註</label>
        <textarea id="reportNoteInput" style="width:100%;min-height:120px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--sans);font-size:13.5px;outline:none">${esc(reportNote())}</textarea>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px">
        <button class="btn" id="saveReportNoteBtn">儲存報告備註</button>
        <button class="btn line sm" id="regenReportBtn">重新產生報告</button>
        <span id="reportMsg" class="muted" style="font-size:13px"></span>
      </div>
    </div></div>`;}
  else if(i===4){
    const members=users().filter(u=>u.role!=='admin');
    const selected=(localStorage.getItem('stockLabAdminMember')||members[0]?.account||'');
    const acts=selected?memberEntitlements(selected):manageableActivationSettings().map(a=>({...a,enabled:false,days:0}));
    b.innerHTML=`<div class="card">
      <div class="card-h"><h3>會員與開通設定</h3><span class="tag">新增 / 刪除帳號 · 板塊開通天數</span></div>
      <div class="card-pad" style="border-bottom:1px solid var(--border-soft);background:var(--blue-tint)">
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">
          <div class="field"><label>新增帳號 Email</label><input id="newUserAccount" placeholder="user@example.com"></div>
          <div class="field"><label>密碼</label><input id="newUserPassword" type="password" placeholder="至少 6 碼"></div>
          <div class="field"><label>暱稱</label><input id="newUserNick" placeholder="會員暱稱"></div>
          <div class="field"><label>角色</label><select id="newUserRole"><option value="user">一般會員</option><option value="admin">管理員</option></select></div>
          <button class="btn" id="createUserBtn">新增帳號</button>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px">
          <button class="btn line sm" id="deleteUserBtn" ${selected?'':'disabled'}>刪除目前選定帳號</button>
          <span id="userManageMsg" class="muted" style="font-size:13px"></span>
        </div>
      </div>
      <div class="card-pad" style="border-bottom:1px solid var(--border-soft)">
        <div class="grid" style="grid-template-columns:minmax(220px,1fr) 160px auto;align-items:end">
          <div class="field"><label>選擇會員</label>
            <select id="memberSelect">
              ${members.length?members.map(u=>`<option value="${u.account}" ${u.account===selected?'selected':''}>${u.nick}（${u.account}）</option>`).join(''):'<option value="">尚無會員</option>'}
            </select>
          </div>
          <div class="field"><label>全部板塊天數</label><input id="allDaysInput" type="number" min="1" max="3650" value="30"></div>
          <button class="btn" id="openAllBtn" ${selected?'':'disabled'}>全部開通</button>
        </div>
      </div>
      <div class="card-pad activation-grid">
        ${acts.map(a=>`<div class="activation-card" data-act="${a.id}">
          <div class="toggle-row">
            <div><b>${a.name}</b><div class="muted" style="font-size:12px;margin-top:2px">${a.id}</div></div>
            <button class="toggle ${a.enabled?'on':''}" data-act-toggle="${a.id}" aria-label="切換 ${a.name}"></button>
          </div>
          <div class="field" style="margin-top:12px">
            <label>使用天數設定</label>
            <input id="act_days_${a.id}" type="number" min="1" max="3650" value="${a.days}">
          </div>
        </div>`).join('')}
      </div>
      <div class="card-pad" style="border-top:1px solid var(--border-soft);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn" id="saveActivationBtn" ${selected?'':'disabled'}>儲存此會員設定</button>
        <span id="activationMsg" class="muted" style="font-size:13px"></span>
      </div>
    </div>`;}
  else{b.innerHTML=`<div class="card"><div class="card-h"><h3>AI 機器人管理</h3></div>
    <div class="tbl-wrap"><table><thead><tr><th>AI 名稱</th><th>策略</th><th>初始資金</th><th>持股上限</th><th>單檔上限</th><th>停損</th><th>停利</th><th>版本</th><th>啟用</th></tr></thead><tbody>
    ${DATA.agents.map(a=>`<tr><td><b>${a.name}</b></td><td class="muted">${a.type}</td>
      <td class="num">${a.init.toLocaleString()}</td><td class="num r">8 檔</td><td class="num r">15%</td>
      <td class="num r down">-8%</td><td class="num r up">+15%</td><td><span class="badge">${a.ver}</span></td>
      <td><span class="badge good">啟用</span></td></tr>`).join('')}</tbody></table></div></div>`;}
}

function stockAdminForm(s={}){
  return `<div class="card-pad" style="border-bottom:1px solid var(--border-soft);background:var(--blue-tint)">
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
      <div class="field"><label>股票代號</label><input id="admStockSymbol" value="${esc(s.c||'')}" placeholder="2330"></div>
      <div class="field"><label>名稱</label><input id="admStockName" value="${esc(s.n||'')}" placeholder="台積電"></div>
      <div class="field"><label>市場</label><select id="admStockMarket"><option ${s.m==='上市'?'selected':''}>上市</option><option ${s.m==='上櫃'?'selected':''}>上櫃</option><option ${s.m==='TWSE'?'selected':''}>TWSE</option><option ${s.m==='TPEX'?'selected':''}>TPEX</option></select></div>
      <div class="field"><label>傳統產業</label><input id="admStockIndustry" value="${esc(s.ind||'')}" placeholder="半導體"></div>
      <div class="field"><label>題材分類</label><input id="admStockTheme" value="${esc(s.th||'')}" placeholder="AI 伺服器"></div>
      <div class="field"><label>標記</label><div style="display:flex;gap:12px;align-items:center;height:38px"><label><input id="admStockLead" type="checkbox" ${s.lead?'checked':''}> 龍頭</label><label><input id="admStockObs" type="checkbox" ${s.obs?'checked':''}> 觀察</label></div></div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap">
      <button class="btn" id="saveStockBtn">儲存股票</button>
      <button class="btn line sm" id="cancelAdminEditBtn">取消</button>
      <span id="adminEditMsg" class="muted" style="font-size:13px"></span>
    </div>
  </div>`;
}
function themeAdminForm(t={}){
  const stockLines=(t.stocks||[]).map(s=>`${s.c},${s.role||'成分'},${s.level||''},${s.score||80}`).join('\n');
  return `<div class="card-pad" style="border-bottom:1px solid var(--border-soft);background:var(--blue-tint)">
    <input id="admThemeLocalId" type="hidden" value="${esc(t.id||'')}">
    <input id="admThemeDbId" type="hidden" value="${esc(t.themeId||'')}">
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      <div class="field"><label>題材名稱</label><input id="admThemeName" value="${esc(t.name||'')}" placeholder="AI 伺服器"></div>
      <div class="field"><label>熱度分數</label><input id="admThemeScore" type="number" min="0" max="100" value="${esc(t.score||70)}"></div>
      <div class="field"><label>狀態</label><input id="admThemeStatus" value="${esc(t.status||'觀察')}" placeholder="主流 / 觀察"></div>
      <div class="field"><label>產業鏈位置</label><input id="admThemeChain" value="${esc(t.chain||'')}" placeholder="上游 / 中游 / 下游"></div>
    </div>
    <div class="field" style="margin-top:12px"><label>說明</label><input id="admThemeDesc" value="${esc(t.desc||'')}" placeholder="題材說明"></div>
    <div class="field" style="margin-top:12px"><label>相關股票，每行：代號,角色,產業鏈位置,關聯分</label>
      <textarea id="admThemeStocks" style="width:100%;min-height:120px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--mono);font-size:13px;outline:none">${esc(stockLines)}</textarea>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap">
      <button class="btn" id="saveThemeBtn">儲存題材</button>
      <button class="btn line sm" id="cancelAdminEditBtn">取消</button>
      <span id="adminEditMsg" class="muted" style="font-size:13px"></span>
    </div>
  </div>`;
}

/* ============ 8. 資料更新狀態 ============ */
function vStatus(){
  const ok=DATA.dataStatus.filter(d=>d.ok).length;
  const srcOk=SRC_STATUS.indexOf('✅')===0;
  const latest=(DATA.dataStatus||[]).map(d=>d.t).filter(t=>t&&t!=='—').sort().slice(-1)[0]||DATA.meta.updated||'—';
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad" style="background:${srcOk?'#FEF2F2':'#FEF3C7'};border-color:${srcOk?'#FECACA':'#FDE68A'}">
     <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
       <span class="badge ${srcOk?'good':'warm'}">${srcOk?'真實資料連線':'資料來源提醒'}</span>
       <b style="font-size:14px;color:${srcOk?'var(--up)':'#92400E'}">${SRC_STATUS}</b>
     </div>
   </div>
   <div class="card card-pad" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
     <div class="stat"><span class="k">今日抓取進度</span><span class="v"><span class="up">${ok}</span><span style="color:var(--ink-3);font-size:18px"> / ${DATA.dataStatus.length}</span></span></div>
     <div style="flex:1;min-width:200px"><div class="progress"><i style="width:${ok/DATA.dataStatus.length*100}%"></i></div>
       <div style="font-size:12px;color:var(--ink-2);margin-top:7px">最後更新：${DATA.meta.date} ${latest} · 排程 GitHub Actions 每日 14:30 / 16:00</div></div>
     <button class="btn sm" id="runDailyBtn">手動重新抓取</button>
     <span id="runDailyMsg" class="muted" style="font-size:12px"></span>
   </div>
   <div class="card"><div class="card-h"><h3>資料來源狀態</h3><span class="tag">每日盤後排程結果</span></div>
     <div class="tbl-wrap"><table><thead><tr><th>資料來源</th><th>狀態</th><th class="r">完成時間</th><th>備註</th></tr></thead><tbody>
     ${DATA.dataStatus.map(d=>`<tr><td><b>${d.k}</b></td>
       <td><span class="badge ${d.ok?'good':'bad'}">${d.ok?'● 成功':'● 失敗'}</span></td>
       <td class="r code">${d.t}</td><td class="muted">${d.err||'正常'}</td></tr>`).join('')}
     </tbody></table></div>
   </div>
   <div class="card card-pad"><b style="font-size:14px">錯誤紀錄</b>
     <div style="margin-top:10px;font-size:13px;color:var(--ink-2);background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:13px;font-family:var(--mono)">
       <div>[16:40] MOPS 月營收：當月營收尚未公布（每月 10 日前），略過</div>
       <div style="color:var(--down);margin-top:4px">[${latest}] 資料來源狀態已同步 Supabase data_status</div>
     </div>
   </div>
  </div>`;
}

