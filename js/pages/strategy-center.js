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
function strategyTemplateLibrary(list,title='技術策略模板庫'){
  if(!list.length) return '';
  return `<div class="card">
    <div class="card-h">
      <h3>${esc(title)}</h3>
      <span class="tag">${list.length} 組模板 · 來自技術資料庫</span>
    </div>
    <div class="knowledge-template-grid strategy-template-grid">
      ${list.map(t=>`<article class="knowledge-template-card">
        <div class="knowledge-template-head">
          <b>${esc(t.name)}</b>
          <span class="badge obs">${esc(strategyTypeLabel(t.strategyType))}</span>
        </div>
        <p>${esc(t.description||'')}</p>
        <div class="knowledge-template-tags">
          ${(t.entryConditions||t.screenerConditions||[]).slice(0,4).map(c=>`<span>${esc(c)}</span>`).join('')}
        </div>
      </article>`).join('')}
    </div>
  </div>`;
}
function vStrategyCenter(){
  const loading=phase6Ensure('strategy'); if(loading) return loading;
  const p=DATA.phase6||{},defs=p.strategies||[],hits=p.strategyResults||[],backs=p.strategyBacktests||[];
  const localTemplates=strategyRegistryTemplates();
  if(!defs.length) return `<div class="hero-card phase6-hero">
    <div><div class="eyebrow">STRATEGY CENTER</div><h2>策略中心</h2><p>策略資料表尚未回填時，先顯示本機技術資料庫模板。</p></div>
    <div class="strategy-kpis">
      <div><b>${localTemplates.length}</b><span>模板數</span></div>
      <div><b>0</b><span>啟用中</span></div>
      <div><b>0</b><span>近期命中</span></div>
      <div><b>—</b><span>平均勝率</span></div>
    </div>
  </div>
  ${emptyPhase6('策略中心尚無資料','請先在 Supabase 執行 db/phase6_schema.sql，再跑 jobs/strategy_center.py。')}
  ${strategyTemplateLibrary(localTemplates)}`;
  const enabled=defs.filter(s=>s.enabled).length;
  const avgWin=backs.length?backs.reduce((s,b)=>s+(Number(b.win_rate)||0),0)/backs.length:null;
  const existingIds=new Set(defs.map(s=>String(s.id||'').replace(/_/g,'-')));
  const extraTemplates=localTemplates.filter(t=>!existingIds.has(String(t.id||'').replace(/_/g,'-')));
  const bestByStrategy=new Map();
  hits.forEach(h=>{
    const prev=bestByStrategy.get(h.strategy_id);
    if(!prev || Number(h.score||0)>Number(prev.score||0)) bestByStrategy.set(h.strategy_id,h);
  });
  const sortedDefs=defs.slice().sort((a,b)=>{
    const ah=bestByStrategy.get(a.id), bh=bestByStrategy.get(b.id);
    return Number(bh&&bh.score||-1)-Number(ah&&ah.score||-1) || Number(b.enabled)-Number(a.enabled) || String(a.name||'').localeCompare(String(b.name||''),'zh-Hant');
  });
  return `<div class="hero-card phase6-hero">
    <div><div class="eyebrow">STRATEGY CENTER</div><h2>策略中心</h2><p>集中管理策略條件、風險控管、近期命中與回測摘要。</p></div>
    <div class="strategy-kpis">
      <div><b>${defs.length}</b><span>策略數</span></div>
      <div><b>${enabled}</b><span>啟用中</span></div>
      <div><b>${hits.length}</b><span>近期命中</span></div>
      <div><b>${avgWin==null?'—':avgWin.toFixed(1)+'%'}</b><span>平均勝率</span></div>
    </div>
  </div>
  <div class="strategy-center-grid">
    ${sortedDefs.map(s=>{
      const sh=hits.filter(h=>h.strategy_id===s.id).slice(0,5);
      const best=bestByStrategy.get(s.id);
      const bt=backs.find(b=>b.strategy_id===s.id)||{};
      const conditions=p6List(s.conditions);
      const risks=p6List(s.risk_rules);
      return `<article class="strategy-center-card ${s.enabled?'is-on':'is-off'}">
        <div class="strategy-center-head">
          <div>
            <span class="strategy-id">${esc(s.id||'strategy')}</span>
            <h3>${esc(s.name)}</h3>
          </div>
          <div class="strategy-head-badges">
            ${best?p6SignalBadge(best):''}
            <span class="badge ${s.enabled?'hot':'cool'}">${s.enabled?'啟用':'停用'}</span>
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
      </article>`;
    }).join('')}
  </div>
  ${strategyTemplateLibrary(extraTemplates,'尚未回填到策略中心的模板')}`;
}
