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

let SCREEN_TEMPLATE_ID='';
let SCREEN_READY=false;

function screenTemplates(){
  return typeof getScreenersByCategory==='function'?getScreenersByCategory():[];
}

function screenTemplateById(id){
  return screenTemplates().find(t=>t.id===id)||null;
}

function screenDefaultConditions(){
  const strong=screenTemplateById('strong-stock-screener');
  return strong?screenTemplateChips(strong):['收盤站上 MA5/MA20','MA20 上升','成交量 >= 1000張'];
}

function screenTemplateConditions(t){
  return (t&&(t.conditions||t.screenerConditions)||screenDefaultConditions()).slice(0,6);
}

function screenTemplateChips(t){
  return (t&&(t.outputTags&&t.outputTags.length?t.outputTags:(t.conditions||t.screenerConditions))||screenDefaultConditions()).slice(0,6);
}

function screenEnsureState(){
  if(SCREEN_READY) return;
  SCREEN_READY=true;
  if(!SCREEN_TEMPLATE_ID && screenTemplateById('strong-stock-screener')) SCREEN_TEMPLATE_ID='strong-stock-screener';
  if(typeof SEL!=='undefined'){
    SEL.clear();
    screenDefaultConditions().forEach(x=>SEL.add(x));
  }
}

function screenLots(s){
  const raw=String(s&&s.vol||'').replace(/,/g,'').replace(/張/g,'');
  const n=Number(raw);
  return Number.isFinite(n)?n:0;
}

function screenScoreFor(row,t){
  const id=t&&t.id||'';
  const dp=Number(row.dp)||0, vol=screenLots(row), total=Number(row.total)||0;
  const ts=Number(row.ts)||0, cs=Number(row.cs)||0, ms=Number(row.ms)||0;
  let score=total || (ts*.35+cs*.25+ms*.4);
  if(/volume|breakout|limit-up/.test(id)) score+=Math.min(20,vol/2500)+Math.max(0,dp)*2;
  if(/trend|strong|ma|macd|rsi/.test(id)) score+=ts*.25+Math.max(0,dp);
  if(/chip|main-force/.test(id)) score+=cs*.35+ms*.25;
  if(/risk|distribution|false/.test(id)) score+=Math.max(0,dp)*1.5+Math.min(18,vol/3000);
  if(/retest|box|triangle|bottom|shoulders/.test(id)) score+=ts*.18+ms*.12;
  return score;
}

function screenConditionMatch(row,condition){
  const c=String(condition||'');
  const dp=Number(row.dp)||0, vol=screenLots(row);
  const ts=Number(row.ts)||0, cs=Number(row.cs)||0, ms=Number(row.ms)||0, total=Number(row.total)||0;
  if(c.includes('1000')) return vol>=1000;
  if(c.includes('3000')) return vol>=3000;
  if(c.includes('5000')) return vol>=5000;
  if(c.includes('10000')) return vol>=10000;
  if(c.includes('漲停')) return dp>=9;
  if(c.includes('放量')||c.includes('量比')||c.includes('突破20日高')||c.includes('成交量')) return vol>=5000 || dp>=5;
  if(c.includes('MA')||c.includes('均線')||c.includes('站上')||c.includes('趨勢')) return ts>=68 || total>=72;
  if(c.includes('20MA')||c.includes('MA20')) return ts>=68 || total>=72;
  if(c.includes('RSI')||c.includes('MACD')||c.includes('動能')||c.includes('收盤轉強')) return ts>=70 || dp>2;
  if(c.includes('法人')||c.includes('籌碼')||c.includes('主力')) return cs>=70 || ms>=80;
  if(c.includes('箱型')||c.includes('三角')||c.includes('W底')||c.includes('頭肩')||c.includes('頸線')||c.includes('型態')) return ms>=75 || ts>=72;
  if(c.includes('風險')||c.includes('長上影')||c.includes('出貨')||c.includes('假突破')) return dp>=5 || vol>=10000;
  if(c.includes('有量')) return vol>=1000;
  if(c.includes('有趨勢')) return ts>=65 || total>=70;
  return true;
}

function screenApplyRows(){
  screenEnsureState();
  const rows=(DATA.screen||[]).slice();
  const t=screenTemplateById(SCREEN_TEMPLATE_ID);
  const selected=typeof SEL!=='undefined'?[...SEL]:screenTemplateChips(t);
  if(!selected.length) return [];
  let out=SCREEN_TEMPLATE_ID?rows.filter(r=>r._screenId===SCREEN_TEMPLATE_ID):[];
  if(!out.length) out=rows.filter(r=>selected.every(c=>screenConditionMatch(r,c)));
  if(t && !out.length){
    out=rows.slice().sort((a,b)=>screenScoreFor(b,t)-screenScoreFor(a,t)).slice(0,Math.min(5,rows.length));
  }
  return out.map(r=>({
    ...r,
    reason:selected.join('；'),
    _screenScore:t?screenScoreFor(r,t):Number(r.total)||0
  })).sort((a,b)=>(Number(b._screenScore)||0)-(Number(a._screenScore)||0));
}

function screenTemplateLibrary(){
  const list=screenTemplates();
  if(!list.length) return '';
  return `<div class="card">
    <div class="card-h">
      <h3>篩選模板庫</h3>
      <span class="tag">${list.length} 組條件 · 來自技術資料庫</span>
    </div>
    <div class="knowledge-template-grid">
      ${list.map(t=>`<article class="knowledge-template-card ${SCREEN_TEMPLATE_ID===t.id?'active':''}" data-screen-template="${esc(t.id)}" tabindex="0">
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
  screenEnsureState();
  const activeTemplate=screenTemplateById(SCREEN_TEMPLATE_ID);
  const activeConditions=typeof SEL!=='undefined'?[...SEL]:screenTemplateChips(activeTemplate);
  const summary=screenTemplateConditions(activeTemplate).join(' · ');
  const rows=screenApplyRows();
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad">
     <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
       <b style="font-size:15px">篩選條件</b><span class="tag" style="color:var(--ink-3);font-size:12px"><b id="selCnt">${activeConditions.length}</b> 個條件 · ${esc(summary||'自訂篩選')}</span>
       <button class="btn sm" id="runBtn" style="margin-left:auto">重新整理</button>
       <button class="btn line sm" id="clrBtn">清除</button>
     </div>
     <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
       ${activeConditions.map(f=>`<button type="button" class="chip ${typeof SEL==='undefined'||SEL.has(f)?'on':''}" data-f="${esc(f)}">${esc(f)}</button>`).join('')||'<span class="muted">尚未選擇條件</span>'}
     </div>
   </div>
   ${screenTemplateLibrary()}
   <div class="card">
     <div class="card-h"><h3>篩選結果</h3><span class="tag"><b id="resCnt">${rows.length}</b> 檔符合 · 依量能與趨勢排序</span>
       <button type="button" class="more" id="exportScreenBtn">匯出 CSV →</button></div>
     <div class="tbl-wrap"><table><thead><tr><th>代號</th><th>名稱</th><th>題材</th><th class="r">收盤</th><th class="r">漲跌</th>
       <th class="r">成交量</th><th>符合條件</th><th>操作</th></tr></thead>
       <tbody id="resBody">${rows.length?rowsScreen(rows):'<tr><td colspan="8" class="muted" style="padding:18px">尚無符合目前條件的股票，請調整模板或條件。</td></tr>'}</tbody></table></div>
   </div>
  </div>`;
}
