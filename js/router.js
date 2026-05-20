/* ============ 導覽與路由 ============ */
const I={
  home:'<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  map:'<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
  watch:'<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  atr:'<path d="M4 18h16M6 14l4-4 3 3 5-7M6 6v12M18 6v12"/>',
  filter:'<path d="M3 5h18M6 12h12M10 19h4"/>',
  stock:'<path d="M3 17l5-5 4 4 8-8M21 8h-5M21 8v5"/>',
  report:'<path d="M7 3h10l4 4v14H3V3zM14 3v5h5M8 13h8M8 17h8"/>',
  ai:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2"/>',
  account:'<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/>',
  admin:'<path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/>',
  status:'<path d="M3 12h4l3 8 4-16 3 8h4"/>',
};
const PAGES=[
  {id:'home',t:'今日市場總覽',s:'一眼掌握多空與資金題材',ic:I.home,grp:'每日盤後'},
  {id:'map',t:'股票類股地圖',s:'上市櫃股票類股分類',ic:I.map,grp:'每日盤後'},
  {id:'watch',t:'自選股',s:'追蹤自己關注的股票清單',ic:I.watch,grp:'每日盤後'},
  {id:'atr',t:'ATR 停利停損',s:'停損、停利與移動停利觀察',ic:I.atr,grp:'每日盤後'},
  {id:'screen',t:'每日篩選',s:'核心選股工具',ic:I.filter,grp:'每日盤後'},
  {id:'stock',t:'個股分析',s:'單一股票完整資訊',ic:I.stock,grp:'每日盤後'},
  {id:'observe',t:'觀察報告',s:'管理員發布觀察股票',ic:I.report,grp:'每日盤後'},
  {id:'report',t:'每日報告',s:'盤後自動產生報告',ic:I.report,grp:'每日盤後'},
  {id:'ai',t:'AI 量化模擬操盤實驗室',s:'AI 機器人回測與模擬交易',ic:I.ai,grp:'實驗室'},
  {id:'admin',t:'後台管理',s:'股票 / 題材 / 參數設定',ic:I.admin,grp:'系統'},
  {id:'status',t:'資料更新狀態',s:'每日抓取結果監控',ic:I.status,grp:'系統'},
  {id:'account',t:'帳號登入 / 申請',s:'會員申請、登入與權限狀態',ic:I.account,grp:'帳號',topOnly:true},
];
const MOB=[['home','總覽'],['map','題材'],['watch','自選'],['stock','個股'],['account','帳號']];

function visiblePages(){
  return PAGES.filter(p=>{
    if(p.topOnly) return false;
    if(['home','map','watch','atr','screen','stock','observe','report'].includes(p.id)) return true;
    if(!authUser()) return false;
    if(p.id==='status') return isAdmin();
    if(isAdmin()) return true;
    if(p.grp==='實驗室' || p.grp==='系統') return hasAccess(p.id);
    return true;
  });
}
function buildNav(){
  const sb=document.getElementById('sidebar');
  let h=`<div class="brand"><div class="brand-logo"><div class="brand-mark">台</div>盤後操盤系統</div>
    <div class="brand-sub">TW STOCK · AI QUANT LAB</div></div><div class="nav">`;
  let grp='';
  visiblePages().forEach(p=>{
    if(p.grp!==grp){grp=p.grp;h+=`<div class="nav-label">${grp}</div>`;}
    h+=`<a class="nav-item" data-go="${p.id}">
      <svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p.ic}</svg>
      ${p.t.replace('AI 量化模擬操盤實驗室','AI 模擬實驗室')}</a>`;
  });
  h+=`</div><div class="nav-foot"><span class="dot"></span>盤後資料模式 · 首版 Demo</div>`;
  sb.innerHTML=h;
  document.getElementById('mobNav').innerHTML=MOB.map(([id,lb])=>{
    const p=PAGES.find(x=>x.id===id);
    if(id!=='account' && !visiblePages().some(x=>x.id===id)) return '';
    return `<a data-go="${id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p.ic}</svg>${lb}</a>`;
  }).join('');
  document.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{go(el.dataset.go);toggleNav(false);});
  renderTopAuth();
  renderDataFreshness();
}
function toggleNav(open){
  document.getElementById('sidebar').classList.toggle('open',open);
  document.getElementById('scrim').classList.toggle('show',open);
}
let CUR='home';
function go(id){
  if(!PAGES.some(x=>x.id===id)) id='home';
  CUR=id;const p=PAGES.find(x=>x.id===id);
  document.getElementById('pgTitle').textContent=p.t;
  document.getElementById('pgSub').textContent='';
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.go===id));
  document.querySelectorAll('.mob-nav a').forEach(n=>n.classList.toggle('active',n.dataset.go===id));
  const v=document.getElementById('view');
  try{
    if(isPageMaintenance(id)){
      v.innerHTML=vMaintenance(id);
    }else if(!isPageAllowed(id)){
      v.innerHTML=vLoginRequired(id);
    }else if(!DATA_REAL_READY && !['account','admin','status'].includes(id)){
      v.innerHTML=vDataUnavailable();
    }else{
      v.innerHTML=({home:vHome,map:vMap,watch:vWatch,atr:vATR,screen:vScreen,stock:vStock,observe:vObserve,report:vReport,ai:vAI,account:vAccount,admin:vAdmin,status:vStatus}[id])();
    }
  }catch(err){
    console.error('頁面渲染錯誤 ['+id+']:', err);
    v.innerHTML='<div class="card" style="margin:16px"><b>此頁載入時發生問題</b>'+
      '<div style="color:var(--ink-2);font-size:13px;margin-top:8px">'+
      '其他頁面仍可正常切換。錯誤：'+(err&&err.message||err)+'</div></div>';
  }
  v.scrollTo&&window.scrollTo(0,0);
  document.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{go(el.dataset.go);toggleNav(false);});
  renderTopAuth();
  renderDataFreshness();
  if(id==='stock')drawStockCharts();
  bindPage(id);
}
function vLoading(){
  return `<div class="card card-pad" style="max-width:720px;margin:24px auto">
    <h3 style="font-size:18px;margin-bottom:8px">正在載入真實盤後資料</h3>
    <div class="muted" style="font-size:13.5px;line-height:1.7">系統正在連線 Supabase。載入完成前不顯示任何 MOCK 股票、題材或報告內容。</div>
  </div>`;
}
function vDataUnavailable(){
  return `<div class="card card-pad" style="max-width:760px;margin:24px auto;border-color:#FDE68A;background:#FFFBEB">
    <h3 style="font-size:18px;margin-bottom:8px;color:#92400E">真實資料尚未載入</h3>
    <div style="font-size:13.5px;line-height:1.75;color:#92400E">
      為避免 MOCK 範例被誤認為真實盤後資料，目前不顯示股票分析內容。<br>
      ${DATA_LOAD_ERROR?`錯誤：${esc(DATA_LOAD_ERROR)}`:'請稍候或到資料更新狀態確認排程。'}
    </div>
  </div>`;
}
function vLoginRequired(id){
  const p=PAGES.find(x=>x.id===id)||{};
  return `<div class="card card-pad" style="max-width:760px;margin:24px auto">
    <h3 style="font-size:18px;margin-bottom:8px">${p.t||'此功能'}需登入後使用</h3>
    <div class="muted" style="font-size:13.5px;line-height:1.75">
      這個板塊可以預覽入口，但內容需要登入帳號並完成開通後才會顯示。
    </div>
    <div style="margin-top:14px"><button class="btn" data-go="account">登入 / 申請帳號</button></div>
  </div>`;
}
function vMaintenance(id){
  const p=PAGES.find(x=>x.id===id)||{};
  const m=(DATA.maintenance||{})[id]||{};
  return `<div class="card card-pad" style="max-width:760px;margin:24px auto;border-color:#FDE68A;background:#FFFBEB">
    <h3 style="font-size:18px;margin-bottom:8px">${p.t||'此板塊'}維修更新中</h3>
    <div style="font-size:13.5px;line-height:1.75;color:#92400E">
      ${esc(m.message||'管理員正在測試新版內容，完成後會重新開放。')}
    </div>
  </div>`;
}

/* ---------- 共用元件 ---------- */
function scoreCell(s){return `<div style="display:flex;align-items:center;gap:7px"><div class="scorebar"><i style="width:${s}%"></i></div><b class="num" style="font-size:12px">${s}</b></div>`;}
function thBadge(st){const m={'主流':'hot','強勢延伸':'hot','低位階補漲':'warm','長線主流':'warm','輪動題材':'warm','觀察':'obs','降溫':'cool'};return `<span class="badge ${m[st]||'obs'}">${st}</span>`;}

