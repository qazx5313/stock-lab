/* Page module: watch.js */

function vWatch(){
  const rows=watchRows();
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad">
     <div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap">
       <div style="flex:1;min-width:240px">
         <h3 style="font-size:18px;margin-bottom:8px">自選股清單</h3>
         <div class="muted" style="font-size:13px;line-height:1.6">${authUser()?'登入後會同步到 Supabase 會員自選股。':'請先登入，登入後自選股會同步到 Supabase。'} ${WATCH_SYNC_STATUS||''}</div>
       </div>
       <div style="display:flex;gap:8px;align-items:center">
         <input id="watchInput" placeholder="輸入股票代號" style="width:150px;padding:9px 13px;border:1px solid var(--border);border-radius:10px;font-family:var(--mono);font-size:14px;outline:none">
         <button class="btn sm" id="watchAddBtn">加入自選</button>
       </div>
     </div>
   </div>
   <div class="card">
     <div class="card-h"><h3>追蹤列表</h3><span class="tag">${rows.length} 檔 · 點分析可查看完整個股資料</span></div>
     ${rows.length?`<div class="quote-list">
       ${rows.map(s=>quoteStockCard(s,{
         actions:`<button class="btn line sm" data-stock="${s.c}">分析</button><button class="btn ghost sm" data-watch-remove="${s.c}">移除</button><span class="muted" style="font-size:12px">${String(s.addedAt||'').slice(0,10)||'—'}</span>`
       })).join('')}
     </div>`:
       `<div class="card-pad"><div class="muted" style="font-size:13.5px">目前還沒有自選股。輸入股票代號後加入，或到個股分析頁把正在看的股票加入自選。</div></div>`}
   </div>
  </div>`;
}

