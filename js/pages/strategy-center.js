let PHASE6_LOADING=false;
async function loadPhase6Data(force=false){
  if(!force && DATA.phase6Loaded) return DATA.phase6;
  if(PHASE6_LOADING) return DATA.phase6||{};
  PHASE6_LOADING=true;
  DATA.phase6=DATA.phase6||{};
  DATA.phase6Errors={};
  const safe=async(key,path,fallback=[])=>{
    try{DATA.phase6[key]=await sbGet(path);}
    catch(err){
      const msg=err.message||String(err);
      console.warn(`Phase6 ${key} 載入失敗`,err);
      DATA.phase6[key]=fallback;
      DATA.phase6Errors[key]=msg;
      DATA.phase6Error=msg;
    }
  };
  await Promise.all([
    safe('strategies','strategy_definitions?select=*&order=name.asc'),
    safe('strategyResults','strategy_results?select=*&order=date.desc,score.desc&limit=1000'),
    safe('strategyBacktests','strategy_backtests?select=*&order=date.desc&limit=500'),
    safe('patterns','detected_patterns?select=*&order=date.desc,confidence_score.desc&limit=160'),
    safe('mainforce','mainforce_behaviors?select=*&order=date.desc,confidence_score.desc&limit=160'),
    safe('aiJournal','ai_trade_journal?select=*&order=review_date.desc,created_at.desc&limit=120'),
    safe('phase6Reports','generated_daily_reports?select=*&order=report_date.desc&limit=1')
  ]);
  DATA.phase6Loaded=true;PHASE6_LOADING=false;
  return DATA.phase6;
}
function phase6RetryOnce(pageId,key){
  DATA.phase6Retry=DATA.phase6Retry||{};
  const k=`${pageId}:${key}`;
  if(DATA.phase6Retry[k]) return;
  DATA.phase6Retry[k]=true;
  setTimeout(()=>{
    loadPhase6Data(true).then(()=>{if(CUR===pageId)go(pageId);});
  },500);
}
function phase6Ensure(pageId){
  if(DATA.phase6Loaded) return '';
  loadPhase6Data().then(()=>{if(CUR===pageId)go(pageId);});
  return `<div class="card card-pad"><h3>正在載入第六階段資料</h3><p class="muted">若資料表尚未建立，這裡會先顯示空狀態。</p></div>`;
}
function emptyPhase6(title,msg){
  return `<div class="card card-pad"><h3>${esc(title)}</h3><p class="muted">${esc(msg||'目前尚無資料，請先執行 GitHub Actions 或確認 Supabase schema。')}</p></div>`;
}
function p6Chips(list){
  if(typeof list==='string'){try{list=JSON.parse(list);}catch(e){list=[list];}}
  return (Array.isArray(list)?list:[]).map(x=>`<span class="badge obs">${esc(x)}</span>`).join('');
}
function p6List(list){
  if(typeof list==='string'){try{list=JSON.parse(list);}catch(e){list=[list];}}
  return Array.isArray(list)?list.filter(Boolean):[];
}
function strategyTypeLabel(type){
  return ({
    breakout:'突破',
    retest:'回測',
    reversal:'反轉',
    'trend-following':'趨勢追蹤',
    range:'震盪區間',
    'risk-avoid':'風險避開'
  })[type]||type||'策略';
}
function strategyRegistryTemplates(){
  return typeof getStrategiesByType==='function'?getStrategiesByType():[];
}
function strategyKey(id){
  return String(id||'').trim().toLowerCase().replace(/_/g,'-');
}
function strategyNameKey(name){
  return String(name||'').trim().toLowerCase().replace(/\s+/g,'');
}
function strategyTemplateDef(t){
  return {
    id:t.id,
    _local_id:t.id,
    _source:'technical-registry',
    name:t.name,
    description:t.description,
    conditions:t.entryConditions||t.screenerConditions||[],
    risk_rules:t.stopLossRules||t.exitConditions||[],
    enabled:true,
    strategy_type:t.strategyType,
    ui_tags:t.uiTags||[]
  };
}
function mergeStrategyDefinitions(remoteDefs,localTemplates){
  const rows=(remoteDefs||[]).map(s=>({...s,_source:'supabase'}));
  localTemplates.forEach(t=>{
    const local=strategyTemplateDef(t);
    const hit=rows.find(s=>strategyKey(s.id)===strategyKey(t.id) || strategyNameKey(s.name)===strategyNameKey(t.name));
    if(hit){
      hit._local_id=t.id;
      hit._source=hit._source||'supabase';
      if(!hit.description) hit.description=local.description;
      if(!p6List(hit.conditions).length) hit.conditions=local.conditions;
      if(!p6List(hit.risk_rules).length) hit.risk_rules=local.risk_rules;
      if(!hit.strategy_type) hit.strategy_type=local.strategy_type;
      if(!hit.ui_tags) hit.ui_tags=local.ui_tags;
      if(hit.enabled==null) hit.enabled=true;
    }else{
      rows.push(local);
    }
  });
  return rows;
}
function strategyAliases(s){
  return new Set([s&&s.id,s&&s._local_id].filter(Boolean).map(strategyKey));
}
function strategyHitsFor(hits,s){
  const aliases=strategyAliases(s), name=strategyNameKey(s&&s.name);
  return (hits||[]).filter(h=>aliases.has(strategyKey(h.strategy_id)) || (name && strategyNameKey(h.strategy_name)===name));
}
let STRATEGY_TYPE_FILTER='all';
let STRATEGY_ONLY_HITS=false;
let STRATEGY_FOCUS_ID='';
let STRATEGY_QUERY='';
let STRATEGY_SORT='category';
let STRATEGY_VIEW='group';
let STRATEGY_OPEN_GROUP='breakout';
const STRATEGY_GROUPS=[
  {id:'breakout',label:'突破策略',desc:'偵測價格突破關鍵壓力，開始轉強或主升機會。',accent:'blue'},
  {id:'retest',label:'回測策略',desc:'過濾突破後回測不破或均線支撐成立。',accent:'cyan'},
  {id:'reversal',label:'反轉策略',desc:'偵測低檔轉強或背離訊號，捕捉反轉機會。',accent:'violet'},
  {id:'trend-following',label:'趨勢追蹤策略',desc:'順勢追蹤主要趨勢，強化持續續航力。',accent:'green'},
  {id:'range',label:'震盪區間策略',desc:'在震盪盤內高拋低吸，累積穩定報酬。',accent:'amber'},
  {id:'risk-avoid',label:'風險控制策略',desc:'偵測追高、籌碼失衡與流動性風險。',accent:'red'}
];
function strategySourceLabel(s){
  return s&&s._source==='technical-registry'?'技術資料庫':'策略中心';
}
function strategyTypeOf(s){
  return s.strategy_type || s.strategyType || (s.ui_tags&&s.ui_tags[0]) || 'other';
}
function strategyGroupMeta(type){
  return STRATEGY_GROUPS.find(g=>g.id===type)||{id:type,label:strategyTypeLabel(type),desc:'其他策略模板。',accent:'blue'};
}
function strategyHitsAll(hits,s){
  return strategyHitsFor(hits,s).slice().sort((a,b)=>Number(b.score||0)-Number(a.score||0));
}
function strategyBacktestFor(backs,s){
  return (backs||[]).find(b=>strategyKey(b.strategy_id)===strategyKey(s.id) || strategyKey(b.strategy_id)===strategyKey(s._local_id))||{};
}
function strategyWinRate(backs,s){
  const bt=strategyBacktestFor(backs,s);
  return Number.isFinite(Number(bt.win_rate))?Number(bt.win_rate):null;
}
function strategySearchText(s){
  return [s.id,s._local_id,s.name,s.description,strategyTypeLabel(strategyTypeOf(s)),strategyTypeOf(s),...p6List(s.conditions),...p6List(s.risk_rules),...(s.ui_tags||[])].join(' ').toLowerCase();
}
function strategyMatches(s,hits){
  const q=String(STRATEGY_QUERY||'').trim().toLowerCase();
  if(STRATEGY_TYPE_FILTER!=='all' && strategyTypeOf(s)!==STRATEGY_TYPE_FILTER) return false;
  if(STRATEGY_ONLY_HITS && !strategyHitsFor(hits,s).length) return false;
  return !q || strategySearchText(s).includes(q);
}
function strategySortRows(rows,hits,backs){
  return rows.slice().sort((a,b)=>{
    const ah=strategyHitsFor(hits,a), bh=strategyHitsFor(hits,b);
    const as=Number(ah[0]&&ah[0].score||-1), bs=Number(bh[0]&&bh[0].score||-1);
    if(STRATEGY_SORT==='hits') return bh.length-ah.length || bs-as || String(a.name||'').localeCompare(String(b.name||''),'zh-Hant');
    if(STRATEGY_SORT==='win') return Number(strategyWinRate(backs,b)||-1)-Number(strategyWinRate(backs,a)||-1) || bs-as;
    if(STRATEGY_SORT==='name') return String(a.name||'').localeCompare(String(b.name||''),'zh-Hant');
    return STRATEGY_GROUPS.findIndex(g=>g.id===strategyTypeOf(a))-STRATEGY_GROUPS.findIndex(g=>g.id===strategyTypeOf(b)) || bs-as || String(a.name||'').localeCompare(String(b.name||''),'zh-Hant');
  });
}
function strategyAvgWin(backs,rows){
  const ids=new Set(rows.flatMap(s=>[strategyKey(s.id),strategyKey(s._local_id)]));
  const vals=(backs||[]).filter(b=>ids.has(strategyKey(b.strategy_id))).map(b=>Number(b.win_rate)).filter(Number.isFinite);
  return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
}
function strategyKpis(defs,hits,backs){
  const enabled=defs.filter(s=>s.enabled!==false).length;
  const avgWin=strategyAvgWin(backs,defs);
  return `<div class="strategy-stat-grid">
    <div class="strategy-stat"><span>策略總數</span><b>${defs.length}</b><em>所有分類合計</em><i></i></div>
    <div class="strategy-stat green"><span>啟用中</span><b>${enabled}</b><em>正在監控與執行</em><i></i></div>
    <div class="strategy-stat violet"><span>近期命中</span><b>${hits.length}</b><em>近 20 筆交易日</em><i></i></div>
    <div class="strategy-stat amber"><span>平均勝率</span><b>${avgWin==null?'—':avgWin.toFixed(1)+'%'}</b><em>加權平均勝率</em><i></i></div>
  </div>`;
}
function strategyTabs(defs,hits){
  const tabs=[{id:'all',label:'全部',count:defs.length},...STRATEGY_GROUPS.map(g=>({id:g.id,label:strategyTypeLabel(g.id),count:defs.filter(s=>strategyTypeOf(s)===g.id).length}))];
  return `<div class="strategy-tabs">
    ${tabs.map(t=>`<button type="button" class="${STRATEGY_TYPE_FILTER===t.id?'on':''}" data-strategy-filter="${esc(t.id)}">${esc(t.label)} <b>${t.count}</b></button>`).join('')}
    <button type="button" class="${STRATEGY_ONLY_HITS?'on':''}" data-strategy-toggle-hits="1">有命中 <b>${defs.filter(s=>strategyHitsFor(hits,s).length).length}</b></button>
  </div>`;
}
function strategyToolbar(defs,hits){
  return `<div class="strategy-toolbar">
    <label class="strategy-search">
      <span>搜尋</span>
      <input id="strategySearchInput" value="${esc(STRATEGY_QUERY)}" placeholder="搜尋策略名稱、條件或股票..." autocomplete="off">
      ${STRATEGY_QUERY?'<button type="button" data-strategy-search-clear="1">清除</button>':''}
    </label>
    <select id="strategySortSelect" class="strategy-sort" aria-label="策略排序">
      ${[['category','排序：分類'],['hits','排序：命中數'],['win','排序：勝率'],['name','排序：名稱']].map(([v,t])=>`<option value="${v}" ${STRATEGY_SORT===v?'selected':''}>${t}</option>`).join('')}
    </select>
    <div class="strategy-view-toggle">
      <button type="button" class="${STRATEGY_VIEW==='group'?'on':''}" data-strategy-view="group">分組</button>
      <button type="button" class="${STRATEGY_VIEW==='grid'?'on':''}" data-strategy-view="grid">卡片</button>
    </div>
  </div>
  ${strategyTabs(defs,hits)}`;
}
function strategyFocusHits(hits){
  if(!hits.length) return '<div class="strategy-focus-empty">目前資料庫尚無命中股票，排程重新計算後會自動出現。</div>';
  return `<div class="strategy-focus-hits">
    ${hits.slice(0,8).map(h=>`<button type="button" data-stock="${esc(h.symbol)}">
      <div><b>${esc(h.symbol)} ${esc(h.name||'')}</b><span>${esc(h.reason||'')}</span></div>
      <strong class="${dcls(h.score)}">${esc(h.score??'—')}</strong>
    </button>`).join('')}
  </div>`;
}
function strategyFocusPanel(s,hits){
  if(!s) return '';
  const conditions=p6List(s.conditions), risks=p6List(s.risk_rules);
  return `<div class="strategy-focus card">
    <div class="card-h">
      <h3>${esc(s.name)}</h3>
      <div class="strategy-head-badges">
        <span class="tag">${esc(strategySourceLabel(s))} · ${esc(strategyTypeLabel(strategyTypeOf(s)))}</span>
        <button type="button" class="btn ghost sm" data-strategy-clear="1">關閉</button>
      </div>
    </div>
    <div class="strategy-focus-body">
      <div>
        <p>${esc(s.description||'')}</p>
        <div class="strategy-section"><span>策略條件</span><div>${conditions.map(x=>`<em>${esc(x)}</em>`).join('')||'<em>尚未設定</em>'}</div></div>
        <div class="strategy-section"><span>風險規則</span><div>${risks.map(x=>`<em>${esc(x)}</em>`).join('')||'<em>依系統預設停損控管</em>'}</div></div>
      </div>
      <div class="strategy-hits">
        <div class="strategy-hits-title">此策略近期命中</div>
        ${strategyFocusHits(hits)}
      </div>
    </div>
  </div>`;
}
function strategyHitRows(hits){
  return hits.length?`<div class="strategy-hit-mini-list">
    ${hits.slice(0,2).map(h=>`<button type="button" data-stock="${esc(h.symbol)}"><span>${esc(h.symbol)} ${esc(h.name||'')}</span><b>${esc(h.score??'—')}</b></button>`).join('')}
  </div>`:'<div class="strategy-hit-empty">尚無命中</div>';
}
function strategyInlineDetail(s,hits){
  const conditions=p6List(s.conditions), risks=p6List(s.risk_rules);
  return `<div class="strategy-card-detail">
    <div class="strategy-card-detail-grid">
      <div class="strategy-mini-section"><span>完整策略條件</span><div>${conditions.map(x=>`<em>${esc(x)}</em>`).join('')||'<em>尚未設定</em>'}</div></div>
      <div class="strategy-mini-section"><span>完整風險規則</span><div>${risks.map(x=>`<em>${esc(x)}</em>`).join('')||'<em>系統預設</em>'}</div></div>
    </div>
    <div class="strategy-hit-area">
      <span>此策略近期命中</span>
      ${hits.length?`<div class="strategy-hit-mini-list expanded">
        ${hits.slice(0,5).map(h=>`<button type="button" data-stock="${esc(h.symbol)}"><span>${esc(h.symbol)} ${esc(h.name||'')}</span><b>${esc(h.score??'—')}</b></button>`).join('')}
      </div>`:'<div class="strategy-hit-empty">尚無命中</div>'}
    </div>
  </div>`;
}
function strategyCard(s,hits,backs){
  const sh=strategyHitsAll(hits,s);
  const bt=strategyBacktestFor(backs,s);
  const conditions=p6List(s.conditions);
  const risks=p6List(s.risk_rules);
  const best=sh[0];
  const focused=STRATEGY_FOCUS_ID && (strategyKey(STRATEGY_FOCUS_ID)===strategyKey(s.id) || strategyKey(STRATEGY_FOCUS_ID)===strategyKey(s._local_id));
  return `<article class="strategy-work-card ${focused?'active':''}">
    <div class="strategy-card-head">
      <div>
        <b>${esc(s.name)}</b>
        <span>${esc(strategySourceLabel(s))} · ${esc(strategyTypeLabel(strategyTypeOf(s)))}</span>
      </div>
      <button type="button" class="strategy-star" data-strategy-focus="${esc(s.id)}" title="${focused?'收合策略':'查看策略'}">${focused?'×':'☆'}</button>
    </div>
    <p>${esc(s.description||'')}</p>
    <div class="strategy-card-metrics">
      <div><span>回測樣本</span><b>${bt.sample_count||0}</b></div>
      <div><span>勝率</span><b class="${dcls(bt.win_rate)}">${bt.win_rate??'—'}%</b></div>
      <div><span>命中</span><b>${sh.length}</b></div>
    </div>
    <div class="strategy-mini-section"><span>策略條件</span><div>${conditions.slice(0,3).map(x=>`<em>${esc(x)}</em>`).join('')||'<em>尚未設定</em>'}</div></div>
    <div class="strategy-mini-section"><span>風險規則</span><div>${risks.slice(0,2).map(x=>`<em>${esc(x)}</em>`).join('')||'<em>系統預設</em>'}</div></div>
    <div class="strategy-hit-area">
      <span>近期命中</span>
      ${strategyHitRows(sh)}
    </div>
    ${focused?strategyInlineDetail(s,sh):''}
    <div class="strategy-card-actions">
      <button type="button" class="btn line sm" data-strategy-focus="${esc(s.id)}">${focused?'收合策略':'查看策略'}</button>
      ${best?`<button type="button" class="btn sm" data-stock="${esc(best.symbol)}">查看命中股</button>`:`<button type="button" class="btn sm" data-strategy-focus="${esc(s.id)}">查看命中股</button>`}
    </div>
  </article>`;
}
function strategyGroupRow(group,rows,hits,backs){
  const open=STRATEGY_VIEW==='grid' || STRATEGY_OPEN_GROUP===group.id || STRATEGY_TYPE_FILTER===group.id;
  const hitCount=rows.reduce((n,s)=>n+strategyHitsFor(hits,s).length,0);
  const avg=strategyAvgWin(backs,rows);
  return `<section class="strategy-group ${open?'open':''} accent-${group.accent}">
    <button type="button" class="strategy-group-head" data-strategy-group="${esc(group.id)}">
      <div class="strategy-group-icon"><i></i></div>
      <div class="strategy-group-title"><b>${esc(group.label)}</b><span>${esc(group.desc)}</span></div>
      <div class="strategy-group-meta"><span>${rows.length} 個策略</span><span>近期命中 ${hitCount} 筆</span><span>平均勝率 ${avg==null?'—':avg.toFixed(1)+'%'}</span></div>
      <strong>${open?'收合':'展開'}</strong>
    </button>
    ${open?`<div class="strategy-group-body">${rows.map(s=>strategyCard(s,hits,backs)).join('')}</div>`:''}
  </section>`;
}
function vStrategyCenter(){
  const loading=phase6Ensure('strategy'); if(loading) return loading;
  const p=DATA.phase6||{},remoteDefs=p.strategies||[],hits=p.strategyResults||[],backs=p.strategyBacktests||[];
  const localTemplates=strategyRegistryTemplates();
  const defs=mergeStrategyDefinitions(remoteDefs,localTemplates);
  const filteredDefs=strategySortRows(defs.filter(s=>strategyMatches(s,hits)),hits,backs);
  const groups=STRATEGY_GROUPS.map(g=>({...g,rows:filteredDefs.filter(s=>strategyTypeOf(s)===g.id)})).filter(g=>g.rows.length);
  return `<div class="strategy-workspace">
    <div class="strategy-titlebar">
      <div><h2>策略中心</h2><p>集中管理策略條件、風險控管、近期命中與回測摘要</p></div>
    </div>
    ${strategyKpis(defs,hits,backs)}
    ${strategyToolbar(defs,hits)}
    <div class="${STRATEGY_VIEW==='grid'?'strategy-flat-grid':'strategy-group-list'}">
      ${STRATEGY_VIEW==='grid'?filteredDefs.map(s=>strategyCard(s,hits,backs)).join(''):groups.map(g=>strategyGroupRow(g,g.rows,hits,backs)).join('')}
    </div>
    ${!filteredDefs.length?emptyPhase6('沒有符合篩選的策略','請調整搜尋、分類或關閉只看有命中。'):''}
  </div>`;
}
