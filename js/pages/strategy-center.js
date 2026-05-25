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
    safe('strategyResults','strategy_results?select=*&order=date.desc,score.desc&limit=120'),
    safe('strategyBacktests','strategy_backtests?select=*&order=date.desc&limit=80'),
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
function p6Meta(value){
  if(!value) return {};
  if(typeof value==='string'){try{return JSON.parse(value)||{};}catch(e){return {};}}
  return typeof value==='object'?value:{};
}
function p6SignalBadge(hit){
  const score=Number(hit.score);
  let t=hit.hit_type||'今日命中';
  if(t==='今日命中' && Number.isFinite(score)){
    t=score>=85?'強訊號':score>=75?'普通訊號':'僅觀察';
  }
  const risk=(p6Meta(hit.metadata).risk_level||'').toLowerCase();
  const cls=t.includes('高風險')||risk==='high'?'bad':t.includes('風險')||risk==='medium'?'warm':t.includes('強')?'hot':t.includes('普通')?'good':'obs';
  return `<span class="badge ${cls}">${esc(t)}</span>`;
}
function p6RiskLabel(risk){
  return ({low:'低',medium:'中',high:'高'})[String(risk||'').toLowerCase()]||'—';
}
function p6QualityBars(hit){
  const meta=p6Meta(hit.metadata);
  const q=meta.quality_components;
  if(!q || typeof q!=='object') return hit.hit_type==='今日命中'?'<div class="strategy-quality-empty">等待重新計算分數拆解</div>':'';
  const rows=[
    ['基礎',q.base],
    ['趨勢',q.trend],
    ['量能',q.volume],
    ['籌碼',q.chip],
    ['風險',q.riskPenalty]
  ];
  return `<div class="strategy-quality">
    ${rows.map(([label,val])=>{
      const n=Number(val)||0;
      const width=Math.min(100,Math.abs(n)*8);
      const cls=label==='風險'?'risk':n<0?'neg':'pos';
      return `<div class="strategy-quality-row ${cls}">
        <span>${label}</span>
        <i><b style="width:${width}%"></b></i>
        <em>${esc(n)}</em>
      </div>`;
    }).join('')}
  </div>`;
}
function p6HitButton(hit){
  const meta=p6Meta(hit.metadata);
  const risk=meta.risk_level;
  return `<button type="button" data-stock="${esc(hit.symbol)}">
    <div class="strategy-hit-top">
      <b>${esc(hit.symbol)} ${esc(hit.name||'')}</b>
      <strong class="${dcls(hit.score)}">${hit.score??'—'}</strong>
    </div>
    <div class="strategy-hit-badges">
      ${p6SignalBadge(hit)}
      ${risk?`<span class="badge obs">風險 ${esc(p6RiskLabel(risk))}</span>`:''}
      ${meta.volume_ratio!=null?`<span class="badge obs">量比 ${esc(meta.volume_ratio)}</span>`:''}
    </div>
    <span>${esc(hit.reason||'')}</span>
    ${hit.risk_note?`<small>${esc(hit.risk_note)}</small>`:''}
    ${p6QualityBars(hit)}
  </button>`;
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
function strategySourceLabel(s){
  return s&&s._source==='technical-registry'?'技術資料庫':'策略中心';
}
function strategyTypeOf(s){
  return s.strategy_type || s.strategyType || (s.ui_tags&&s.ui_tags[0]) || 'other';
}
function strategyControls(defs){
  const types=['all','breakout','retest','reversal','trend-following','range','risk-avoid'];
  return `<div class="strategy-tools">
    <div class="strategy-tabs">
      ${types.map(t=>`<button type="button" class="${STRATEGY_TYPE_FILTER===t?'on':''}" data-strategy-filter="${esc(t)}">${t==='all'?'全部':esc(strategyTypeLabel(t))}</button>`).join('')}
    </div>
    <button type="button" class="btn line sm ${STRATEGY_ONLY_HITS?'on':''}" data-strategy-toggle-hits="1">只看有命中</button>
    ${STRATEGY_FOCUS_ID?'<button type="button" class="btn ghost sm" data-strategy-clear="1">清除選取</button>':''}
    <span class="tag">${defs.length} 組策略 · 已合併技術資料庫</span>
  </div>`;
}
function strategyFocusPanel(s,hits){
  if(!s) return '';
  const conditions=p6List(s.conditions), risks=p6List(s.risk_rules);
  return `<div class="card strategy-focus">
    <div class="card-h">
      <h3>${esc(s.name)}</h3>
      <span class="tag">${esc(strategySourceLabel(s))} · ${esc(strategyTypeLabel(strategyTypeOf(s)))}</span>
    </div>
    <div class="strategy-focus-body">
      <div>
        <p>${esc(s.description||'')}</p>
        <div class="strategy-section"><span>策略條件</span><div>${conditions.map(x=>`<em>${esc(x)}</em>`).join('')||'<em>尚未設定</em>'}</div></div>
        <div class="strategy-section"><span>風險規則</span><div>${risks.map(x=>`<em>${esc(x)}</em>`).join('')||'<em>依系統預設停損控管</em>'}</div></div>
      </div>
      <div class="strategy-hits">
        <div class="strategy-hits-title">此策略近期命中</div>
        ${hits.length?hits.slice(0,8).map(p6HitButton).join(''):'<div class="muted">目前資料庫尚無命中股票，排程重新計算後會自動出現。</div>'}
      </div>
    </div>
  </div>`;
}
function vStrategyCenter(){
  const loading=phase6Ensure('strategy'); if(loading) return loading;
  const p=DATA.phase6||{},remoteDefs=p.strategies||[],hits=p.strategyResults||[],backs=p.strategyBacktests||[];
  const localTemplates=strategyRegistryTemplates();
  const defs=mergeStrategyDefinitions(remoteDefs,localTemplates);
  const enabled=defs.filter(s=>s.enabled!==false).length;
  const avgWin=backs.length?backs.reduce((s,b)=>s+(Number(b.win_rate)||0),0)/backs.length:null;
  const bestByStrategy=new Map();
  defs.forEach(s=>{
    const sh=strategyHitsFor(hits,s);
    if(sh.length) bestByStrategy.set(strategyKey(s.id),sh.slice().sort((a,b)=>Number(b.score||0)-Number(a.score||0))[0]);
  });
  const sortedDefs=defs.slice().sort((a,b)=>{
    const ah=bestByStrategy.get(strategyKey(a.id)), bh=bestByStrategy.get(strategyKey(b.id));
    return Number(bh&&bh.score||-1)-Number(ah&&ah.score||-1) || Number(b.enabled!==false)-Number(a.enabled!==false) || String(a.name||'').localeCompare(String(b.name||''),'zh-Hant');
  });
  const filteredDefs=sortedDefs.filter(s=>{
    if(STRATEGY_TYPE_FILTER!=='all' && strategyTypeOf(s)!==STRATEGY_TYPE_FILTER) return false;
    if(STRATEGY_ONLY_HITS && !strategyHitsFor(hits,s).length) return false;
    return true;
  });
  const focused=defs.find(s=>strategyKey(s.id)===strategyKey(STRATEGY_FOCUS_ID) || strategyKey(s._local_id)===strategyKey(STRATEGY_FOCUS_ID));
  const focusedHits=focused?strategyHitsFor(hits,focused):[];
  return `<div class="hero-card phase6-hero">
    <div><div class="eyebrow">STRATEGY CENTER</div><h2>策略中心</h2><p>集中管理策略條件、風險控管、近期命中與回測摘要。技術資料庫模板會直接併入策略清單。</p></div>
    <div class="strategy-kpis">
      <div><b>${defs.length}</b><span>策略數</span></div>
      <div><b>${enabled}</b><span>啟用中</span></div>
      <div><b>${hits.length}</b><span>近期命中</span></div>
      <div><b>${avgWin==null?'—':avgWin.toFixed(1)+'%'}</b><span>平均勝率</span></div>
    </div>
  </div>
  ${strategyControls(defs)}
  ${strategyFocusPanel(focused,focusedHits)}
  <div class="strategy-center-grid">
    ${filteredDefs.map(s=>{
      const sh=strategyHitsFor(hits,s).slice(0,5);
      const best=bestByStrategy.get(strategyKey(s.id));
      const bt=backs.find(b=>strategyKey(b.strategy_id)===strategyKey(s.id) || strategyKey(b.strategy_id)===strategyKey(s._local_id))||{};
      const conditions=p6List(s.conditions);
      const risks=p6List(s.risk_rules);
      const active=focused && (strategyKey(focused.id)===strategyKey(s.id) || strategyKey(focused._local_id)===strategyKey(s._local_id));
      return `<article class="strategy-center-card ${s.enabled!==false?'is-on':'is-off'} ${active?'active':''}">
        <div class="strategy-center-head">
          <div>
            <span class="strategy-id">${esc(s.id||'strategy')} · ${esc(strategySourceLabel(s))}</span>
            <h3>${esc(s.name)}</h3>
          </div>
          <div class="strategy-head-badges">
            ${best?p6SignalBadge(best):''}
            <span class="badge obs">${esc(strategyTypeLabel(strategyTypeOf(s)))}</span>
            <span class="badge ${s.enabled!==false?'hot':'cool'}">${s.enabled!==false?'啟用':'停用'}</span>
          </div>
        </div>
        <p class="strategy-desc">${esc(s.description||'')}</p>
        <div class="strategy-metrics">
          <div><span>回測樣本</span><b>${bt.sample_count||0}</b></div>
          <div><span>勝率</span><b class="${dcls(bt.win_rate)}">${bt.win_rate??'—'}%</b></div>
          <div><span>平均報酬</span><b class="${dcls(bt.avg_return)}">${bt.avg_return??'—'}%</b></div>
          <div><span>命中</span><b>${sh.length}</b></div>
        </div>
        <div class="strategy-section">
          <span>策略條件</span>
          <div>${conditions.length?conditions.map(x=>`<em>${esc(x)}</em>`).join(''):'<em>尚未設定</em>'}</div>
        </div>
        <div class="strategy-section">
          <span>風險規則</span>
          <div>${risks.length?risks.map(x=>`<em>${esc(x)}</em>`).join(''):'<em>依系統預設停損控管</em>'}</div>
        </div>
        <div class="strategy-hits">
          <div class="strategy-hits-title">近期命中</div>
          ${sh.length?sh.map(p6HitButton).join(''):'<div class="muted">尚無命中股票</div>'}
        </div>
        <div class="strategy-actions">
          <button type="button" class="btn line sm" data-strategy-focus="${esc(s.id)}">查看策略</button>
          ${sh[0]?`<button type="button" class="btn sm" data-stock="${esc(sh[0].symbol)}">查看最高分股票</button>`:''}
        </div>
      </article>`;
    }).join('')}
  </div>
  ${!filteredDefs.length?emptyPhase6('沒有符合篩選的策略','請切回全部或關閉只看有命中。'):''}`;
}
