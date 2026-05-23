/* Page module: map.js */

function vMap(){
  const themes=mapMarketThemes();
  const t=themes.find(x=>x.id===MAP_SEL)||themes[0];
  if(t && t.id!==MAP_SEL) MAP_SEL=t.id;
  const stocks=(t&&Array.isArray(t.stocks))?t.stocks:[];
  const marketStocks=stocks.filter(s=>{
    const st=(DATA.stockMap||{})[String(s.c||'')];
    const mk=normMarket((st&&st.market)||s.market);
    return !mk || mk===MAP_MARKET;
  });
  const q=String(MAP_QUERY||'').trim().toLowerCase();
  const visibleStocks=q?marketStocks.filter(s=>{
    const st=(DATA.stockMap||{})[String(s.c||'')]||{};
    const hay=[s.c,s.n,s.t,s.level,s.theme,st.name,st.industry,(st.theme_tags||[]).join(' ')].join(' ').toLowerCase();
    return hay.includes(q);
  }):marketStocks;
  if(!t){
    return `<div class="card card-pad fade"><h3>股票類股資料尚未建立</h3><p class="muted" style="margin-top:8px">請先在 GitHub Actions 跑 Daily market data pipeline，等 Build stock industry classes 完成後再重新整理。</p></div>`;
  }
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="map-controls card card-pad">
     <div class="seg">
       <button class="${MAP_MARKET==='TWSE'?'on':''}" data-map-market="TWSE">上市</button>
       <button class="${MAP_MARKET==='TPEX'?'on':''}" data-map-market="TPEX">上櫃</button>
     </div>
     <div class="field map-select-field">
       <label>類股 / 細分類</label>
       <select id="mapThemeSelect" data-map-theme-select>
         ${themes.map(th=>`<option value="${esc(th.id)}" ${th.id===MAP_SEL?'selected':''}>${esc(themeDisplayName(th.name))} · ${Array.isArray(th.stocks)?th.stocks.length:0} 檔</option>`).join('')}
       </select>
     </div>
     <div class="field map-search-field">
       <label>搜尋個股</label>
       <input id="mapStockSearch" value="${esc(MAP_QUERY)}" placeholder="代號、名稱、標籤">
     </div>
     <div class="map-count">
       <b>${visibleStocks.length}</b><span>${q?` / ${marketStocks.length}`:mapMarketLabel()} 檔</span>
     </div>
   </div>

   <div class="card">
     <div style="padding:20px 22px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;border-bottom:1px solid var(--border-soft)">
       <div style="flex:1;min-width:240px">
         <div style="display:flex;align-items:center;gap:10px">
           <h2 style="font-size:21px;font-weight:800;letter-spacing:-.4px">${themeDisplayName(t.name)}</h2>${thBadge(t.status)}</div>
         <p style="color:var(--ink-2);font-size:13.5px;margin-top:8px;line-height:1.55">${String(t.desc||'').replaceAll(t.name,themeDisplayName(t.name))}</p>
       </div>
       <div class="grid" style="grid-template-columns:repeat(3,auto);gap:24px">
         <div class="stat"><span class="k">熱度分數</span><span class="v" style="color:var(--primary)">${t.score}</span></div>
         <div class="stat"><span class="k">平均漲幅</span><span class="v up">${t.gain}</span></div>
         <div class="stat"><span class="k">資金狀態</span><span class="v" style="font-size:18px">${t.vol} 量增</span></div>
       </div>
     </div>
   </div>
   <div class="card">
     <div class="card-h"><h3>相關個股資料</h3><span class="tag">${visibleStocks.length}${q?` / ${marketStocks.length}`:''} 檔 · 點卡片可進個股分析</span></div>
     <div class="card-pad">
       ${visibleStocks.length?`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
       ${visibleStocks.map(s=>{const st=(DATA.stockMap||{})[String(s.c||'')]||{};const theme=themeDisplayName(t.name);const industry=st.industry||s.industry||'';return quoteStockCard({...s,market:normMarket(st.market||s.market)||MAP_MARKET,t:s.level||theme,theme,role:industry&&industry!==theme?industry:(s.role||'成分')}, {compact:true,hideMarketSide:true});}).join('')}
       </div>`:`<div class="muted" style="font-size:13px">此類股目前沒有符合搜尋條件的個股。</div>`}
     </div>
   </div>
  </div>`;
}

