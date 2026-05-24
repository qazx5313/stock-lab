let PHASE6_LOADING=false;
async function loadPhase6Data(force=false){
  if(!force && DATA.phase6Loaded) return DATA.phase6;
  if(PHASE6_LOADING) return DATA.phase6||{};
  PHASE6_LOADING=true;
  DATA.phase6=DATA.phase6||{};
  const safe=async(key,path,fallback=[])=>{
    try{DATA.phase6[key]=await sbGet(path);}
    catch(err){console.warn(`Phase6 ${key} 載入失敗`,err);DATA.phase6[key]=fallback;DATA.phase6Error=err.message||String(err);}
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
function vStrategyCenter(){
  const loading=phase6Ensure('strategy'); if(loading) return loading;
  const p=DATA.phase6||{},defs=p.strategies||[],hits=p.strategyResults||[],backs=p.strategyBacktests||[];
  if(!defs.length) return emptyPhase6('策略中心尚無資料','請先在 Supabase 執行 db/phase6_schema.sql，再跑 jobs/strategy_center.py。');
  return `<div class="hero-card">
    <div><div class="eyebrow">STRATEGY CENTER</div><h2>策略中心</h2><p>統一管理策略條件、風險規則、今日命中與回測摘要。</p></div>
    <div class="hero-metrics"><b>${defs.length}</b><span>策略數</span><b>${hits.length}</b><span>近期命中</span></div>
  </div>
  <div class="grid-2">
    ${defs.map(s=>{
      const sh=hits.filter(h=>h.strategy_id===s.id).slice(0,4);
      const bt=backs.find(b=>b.strategy_id===s.id)||{};
      return `<div class="card">
        <div class="card-head"><div><h3>${esc(s.name)}</h3><p class="muted">${esc(s.description||'')}</p></div><span class="badge ${s.enabled?'hot':'cool'}">${s.enabled?'啟用':'停用'}</span></div>
        <div class="split-row"><span>回測樣本</span><b>${bt.sample_count||0}</b><span>勝率</span><b class="${dcls(bt.win_rate)}">${bt.win_rate??'—'}%</b><span>平均報酬</span><b class="${dcls(bt.avg_return)}">${bt.avg_return??'—'}%</b></div>
        <div class="muted" style="margin-top:10px">條件</div><div class="tagline">${p6Chips(s.conditions)}</div>
        <div class="muted" style="margin-top:10px">近期命中</div>
        <div class="mini-list">${sh.length?sh.map(h=>`<div><b>${esc(h.symbol)} ${esc(h.name||'')}</b><span>${esc(h.reason||'')}</span></div>`).join(''):'<div class="muted">尚無命中股票</div>'}</div>
      </div>`;
    }).join('')}
  </div>`;
}
