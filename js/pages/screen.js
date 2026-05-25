/* Page module: screen.js */

function screenCategoryLabel(category){
  return ({
    trend:'趨勢',
    volume:'量價',
    momentum:'動能',
    'chart-pattern':'型態',
    chip:'籌碼',
    risk:'風險'
  })[category]||category||'篩選';
}

function screenTemplateLibrary(){
  const list=typeof getScreenersByCategory==='function'?getScreenersByCategory():[];
  if(!list.length) return '';
  return `<div class="card">
    <div class="card-h">
      <h3>篩選模板庫</h3>
      <span class="tag">${list.length} 組條件 · 來自技術資料庫</span>
    </div>
    <div class="knowledge-template-grid">
      ${list.map(t=>`<article class="knowledge-template-card">
        <div class="knowledge-template-head">
          <b>${esc(t.name)}</b>
          <span class="badge ${t.bias==='risk'?'warm':'obs'}">${esc(screenCategoryLabel(t.category))}</span>
        </div>
        <p>${esc(t.description||'')}</p>
        <div class="knowledge-template-tags">
          ${(t.conditions||t.screenerConditions||[]).slice(0,4).map(c=>`<span>${esc(c)}</span>`).join('')}
        </div>
      </article>`).join('')}
    </div>
  </div>`;
}

function vScreen(){
  const rows=DATA.screen||[];
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad">
     <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
       <b style="font-size:15px">篩選條件</b><span class="tag" style="color:var(--ink-3);font-size:12px">成交量 >= 1000 張 · 站上 MA20/MA60 · MA5 > MA10 > MA20 > MA60 · 20MA 上升</span>
       <button class="btn sm" id="runBtn" style="margin-left:auto">重新整理</button>
     </div>
     <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
       ${['有量','有趨勢','均線結構轉強','短中期動能偏多'].map(f=>`<span class="chip on">${f}</span>`).join('')}
     </div>
   </div>
   ${screenTemplateLibrary()}
   <div class="card">
     <div class="card-h"><h3>篩選結果</h3><span class="tag"><b id="resCnt">${rows.length}</b> 檔符合 · 依量能與趨勢排序</span>
       <span class="more">匯出 CSV →</span></div>
     <div class="tbl-wrap"><table><thead><tr><th>代號</th><th>名稱</th><th>題材</th><th class="r">收盤</th><th class="r">漲跌</th>
       <th class="r">成交量</th><th>符合條件</th><th>操作</th></tr></thead>
       <tbody id="resBody">${rowsScreen(rows)}</tbody></table></div>
   </div>
  </div>`;
}
