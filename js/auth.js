/* ---------- 帳號與開通狀態（MVP：登入來源改走 Supabase app_users） ---------- */
function readStore(k,fallback){
  try{return JSON.parse(localStorage.getItem(k))||fallback;}catch(e){return fallback;}
}
function writeStore(k,v){localStorage.setItem(k,JSON.stringify(v));}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function users(){return readStore('stockLabUsers',[]);}
function setUsers(v){writeStore('stockLabUsers',v);}
function authUser(){return readStore('stockLabAuth',null);}
function setAuthUser(v){v?writeStore('stockLabAuth',v):localStorage.removeItem('stockLabAuth');}
function authToken(){return localStorage.getItem('stockLabAccessToken')||'';}
function setAuthToken(v){v?localStorage.setItem('stockLabAccessToken',v):localStorage.removeItem('stockLabAccessToken');}
function authEmailFor(account){
  const a=String(account||'').trim();
  if(a.includes('@')) return a;
  const safe=a.toLowerCase().replace(/[^a-z0-9._-]/g,'');
  return `${safe || 'user'}@stocklab.local`;
}
function activationSettings(){
  const saved=readStore('stockLabActivation',[]);
  const byId=new Map((Array.isArray(saved)?saved:[]).map(a=>[a.id,a]));
  const merged=DATA.activation.map(a=>({...a,...(byId.get(a.id)||{})}));
  (Array.isArray(saved)?saved:[]).forEach(a=>{if(a&&a.id&&!merged.some(x=>x.id===a.id)) merged.push(a);});
  return merged;
}
function setActivationSettings(v){writeStore('stockLabActivation',v);}
function manageableActivationSettings(){return activationSettings().filter(a=>a.id!=='status');}
function entitlements(){return readStore('stockLabEntitlements',{});}
function setEntitlements(v){writeStore('stockLabEntitlements',v);}
function memberEntitlements(account){
  const all=entitlements();
  const rows=all[account]||{};
  return manageableActivationSettings().map(a=>({
    id:a.id,
    name:a.name,
    enabled:!!(rows[a.id]&&rows[a.id].enabled),
    days:rows[a.id]?Number(rows[a.id].days)||0:0
  }));
}
function setMemberEntitlements(account, rows){
  const all=entitlements();
  all[account]={};
  rows.forEach(r=>{all[account][r.id]={enabled:!!r.enabled,days:Number(r.days)||0};});
  setEntitlements(all);
}
function reportNote(){return localStorage.getItem('stockLabReportNote')||'';}
function setReportNote(v){v?localStorage.setItem('stockLabReportNote',v):localStorage.removeItem('stockLabReportNote');}
function isAdmin(){const u=authUser();return u&&u.role==='admin';}
function hasAccess(id){
  if(isAdmin()) return true;
  const u=authUser();
  if(!u) return false;
  const item=memberEntitlements(u.account).find(a=>a.id===id);
  return !!(item&&item.enabled&&Number(item.days)>0);
}
function isPageAllowed(id){
  const p=PAGES.find(x=>x.id===id);
  if(!p || p.topOnly) return id==='account';
  if(id==='home' || id==='map') return true;
  if(!authUser()) return false;
  if(id==='status') return isAdmin();
  if(isAdmin()) return true;
  if(['watch','screen','stock','report'].includes(id)) return true;
  if(p.grp==='實驗室' || p.grp==='系統') return hasAccess(id);
  return true;
}
function remainingDays(){
  if(isAdmin()) return '無限制';
  const u=authUser();
  if(!u) return '0 天';
  const enabled=memberEntitlements(u.account).filter(a=>a.enabled).map(a=>Number(a.days)||0);
  const days=Math.max(Number(u.daysRemaining)||0, ...enabled, 0);
  return days+' 天';
}
function renderTopAuth(){
  const box=document.getElementById('topAuth');
  if(!box) return;
  const u=authUser();
  box.innerHTML=u
    ? `<button class="top-user" data-go="account"><div class="avatar">${u.nick.slice(0,1)}</div><div><b>${u.nick}</b><span>剩餘 ${remainingDays()}</span></div></button><button class="btn line sm" id="topLogoutBtn">登出</button>`
    : `<button class="btn sm" data-go="account">登入 / 申請</button>`;
  document.querySelectorAll('#topAuth [data-go]').forEach(el=>el.onclick=()=>go(el.dataset.go));
  const out=document.getElementById('topLogoutBtn');
  if(out)out.onclick=()=>{setAuthUser(null);setAuthToken('');if(typeof WATCH_REMOTE_LOADED!=='undefined')WATCH_REMOTE_LOADED=false;buildNav();go('home');};
}
function renderDataFreshness(){
  renderTxFuture();
  const el=document.getElementById('dataFreshness');
  if(!el) return;
  const latest=(DATA.dataStatus||[])
    .map(d=>d.t)
    .filter(t=>t&&t!=='—')
    .sort()
    .slice(-1)[0];
  const label=DATA_FROM_CACHE?'快取資料':(DATA_REAL_READY?'盤後資料':'資料狀態');
  const tail=DATA_FROM_CACHE?'背景更新中':`${latest||DATA.meta.updated||'—'} 更新`;
  el.innerHTML=`<span class="dot"></span>${label} · ${tail}`;
}
function renderTxFuture(){
  const el=document.getElementById('txFuturePill');
  if(!el) return;
  const f=(DATA.market&&DATA.market.txFut)||{};
  const v=Number(f.v), d=Number(f.d), dp=Number(f.dp);
  const hasV=Number.isFinite(v);
  const hasD=Number.isFinite(d);
  const cls=hasD && d<0?'down':'up';
  const ch=hasD
    ? `<b class="${cls}">${d>0?'+':''}${d.toLocaleString('en-US',{maximumFractionDigits:2})}${Number.isFinite(dp)?` (${dp>0?'+':''}${dp.toFixed(2)}%)`:''}</b>`
    : '<b>—</b>';
  el.innerHTML=`<span class="dot"></span>台指期 ${hasV?v.toLocaleString('en-US',{maximumFractionDigits:2}):'—'} ${ch}`;
}
async function loadRemoteActivation(){
  try{
    const rows=await sbGet('app_activation_settings?select=page_id,name,enabled,days&order=page_id.asc',100);
    if(Array.isArray(rows)&&rows.length){
      setActivationSettings(rows.map(r=>({id:r.page_id,name:r.name||r.page_id,enabled:!!r.enabled,days:Number(r.days)||1})));
    }
  }catch(e){ console.warn('app_activation_settings 載入略過:',e); }
}
async function saveRemoteActivation(acts){
  try{
    await adminWrite('save_activation_settings',acts);
    return true;
  }catch(e){ console.warn('app_activation_settings 儲存略過:',e); return false; }
}
async function loadRemoteUsers(){
  try{
    const rows=await sbGet('app_users?select=account,nick,role,days_remaining&order=created_at.desc',500);
    if(Array.isArray(rows)&&rows.length){
      const local=users();
      const merged=[...local];
      rows.forEach(r=>{
        if(!merged.some(u=>u.account===r.account)){
          merged.push({account:r.account,password:'',nick:r.nick,role:r.role||'user',daysRemaining:Number(r.days_remaining)||0});
        }
      });
      setUsers(merged);
    }
  }catch(e){ console.warn('app_users 清單載入略過:',e); }
}
async function loadRemoteEntitlements(account){
  if(!account) return;
  try{
    const rows=await sbGet(`app_user_entitlements?select=account,page_id,name,enabled,days&account=eq.${encodeURIComponent(account)}`,500);
    if(Array.isArray(rows)&&rows.length){
      setMemberEntitlements(account, rows.map(r=>({id:r.page_id,name:r.name||r.page_id,enabled:!!r.enabled,days:Number(r.days)||0})));
    }
  }catch(e){ console.warn('app_user_entitlements 載入略過:',e); }
}
async function saveRemoteEntitlements(account, rows){
  try{
    await adminWrite('save_entitlements',{account,rows});
    return true;
  }catch(e){ console.warn('app_user_entitlements 儲存略過:',e); return false; }
}
async function remoteRegister(account,password,nick){
  try{
    const r=await fetch(EDGE_ADMIN_WRITE_URL,{
      method:'POST',
      headers:{apikey:SB_ANON,Authorization:`Bearer ${SB_ANON}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        action:'public_register',
        payload:{account,auth_email:authEmailFor(account),password,nick}
      })
    });
    const raw=await r.text();
    let data={};
    try{data=raw?JSON.parse(raw):{};}catch(_){data={error:raw};}
    if(!r.ok || data.ok===false) throw new Error(data.error || raw || `HTTP ${r.status}`);
    return {ok:true};
  }catch(e){
    console.warn('Supabase Auth 註冊失敗:',e);
    return {ok:false,error:e&&e.message?e.message:String(e)};
  }
}
async function remoteLogin(account,password){
  try{
    const loginEmail=authEmailFor(account);
    const r=await fetch(`${SB_URL}/auth/v1/token?grant_type=password`,{
      method:'POST',
      headers:{apikey:SB_ANON,'Content-Type':'application/json'},
      body:JSON.stringify({email:loginEmail,password})
    });
    if(!r.ok) throw new Error(await r.text());
    const session=await r.json();
    setAuthToken(session.access_token||'');
    let profile=null;
    try{
      const rows=await sbGet(`app_users?select=account,nick,role,days_remaining&account=eq.${encodeURIComponent(account)}&limit=1`);
      profile=Array.isArray(rows)?rows[0]:null;
    }catch(_){}
    if(!profile && loginEmail!==account){
      try{
        const rows=await sbGet(`app_users?select=account,nick,role,days_remaining&account=eq.${encodeURIComponent(loginEmail)}&limit=1`);
        profile=Array.isArray(rows)?rows[0]:null;
      }catch(_){}
    }
    return {
      account:profile?.account || account,
      nick:profile?.nick || session.user?.user_metadata?.nick || account,
      role:profile?.role || session.user?.user_metadata?.role || 'user',
      daysRemaining:Number(profile?.days_remaining)||0
    };
  }catch(e){ console.warn('Supabase Auth 登入略過:',e); }
  return null;
}
async function adminWrite(action,payload){
  const token=authToken();
  if(!token) throw new Error('尚未取得 Supabase Auth token，請重新登入');
  const r=await fetch(EDGE_ADMIN_WRITE_URL,{
    method:'POST',
    headers:{
      apikey:SB_ANON,
      Authorization:`Bearer ${token}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({action,payload})
  });
  const txt=await r.text().catch(()=> '');
  let data={};
  try{data=txt?JSON.parse(txt):{};}catch(_){data={error:txt};}
  if(!r.ok || data.ok===false) throw new Error(data.error||`HTTP ${r.status}`);
  return data.data;
}
async function userWrite(action,payload){
  const token=authToken();
  if(!token) throw new Error('尚未登入');
  const r=await fetch(EDGE_ADMIN_WRITE_URL,{
    method:'POST',
    headers:{
      apikey:SB_ANON,
      Authorization:`Bearer ${token}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({action,payload})
  });
  const txt=await r.text().catch(()=> '');
  let data={};
  try{data=txt?JSON.parse(txt):{};}catch(_){data={error:txt};}
  if(!r.ok || data.ok===false) throw new Error(data.error||`HTTP ${r.status}`);
  return data.data;
}
async function loadRemoteWatchlist(){
  try{
    const rows=await userWrite('get_watchlist',{});
    return Array.isArray(rows)?rows:[];
  }catch(e){
    console.warn('會員自選股載入略過:',e);
    return null;
  }
}
async function saveRemoteWatchlist(rows){
  try{
    await userWrite('save_watchlist',{rows});
    return true;
  }catch(e){
    console.warn('會員自選股儲存略過:',e);
    return false;
  }
}

function vAccount(){
  const u=authUser();
  const acts=u?memberEntitlements(u.account):manageableActivationSettings().map(a=>({...a,enabled:false,days:0}));
  const statusPanel=u?`<div class="card card-pad auth-panel">
      <h3 style="font-size:18px;margin-bottom:12px">帳號狀態</h3>
      <div class="auth-status"><div class="avatar">${u.nick.slice(0,1)}</div>
        <div style="flex:1"><b>${u.nick}</b><div class="muted" style="font-size:12.5px">${u.account} · ${u.role==='admin'?'管理員':'一般會員'} · 剩餘 ${remainingDays()}</div></div>
        <button class="btn line sm" id="logoutBtn">登出</button></div>
      <div style="margin-top:14px;font-size:12.5px;color:var(--ink-2);line-height:1.7">
        帳號資料以 Supabase 為準；管理員必須在 app_users 表中設定 role=admin。前端不再提供硬寫管理員密碼。
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-h"><h3>目前板塊開通</h3><span class="tag">依會員權限顯示</span></div>
        <div class="card-pad activation-grid">
          ${acts.map(a=>`<div class="activation-card">
            <div class="toggle-row"><b>${a.name}</b><span class="badge ${a.enabled?'cool':'obs'}">${a.enabled?'已開通':'未開通'}</span></div>
            <div class="muted" style="font-size:12.5px;margin-top:8px">剩餘 ${a.enabled?a.days:0} 天</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`:'';
  return `<div class="fade ${u?'account-grid':''}">
    ${statusPanel}
    <div style="display:flex;flex-direction:column;gap:18px;${u?'':'max-width:560px'}">
      <div class="card card-pad">
        <h3 style="font-size:18px;margin-bottom:12px">登入帳號</h3>
        <div class="form-grid">
          <div class="field"><label>帳號</label><input id="loginAccount" autocomplete="username" placeholder="輸入帳號或 Email"></div>
          <div class="field"><label>密碼</label><input id="loginPassword" type="password" autocomplete="current-password" placeholder="輸入密碼"></div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn" id="loginBtn">登入</button>
            <span id="loginMsg" class="muted" style="font-size:13px"></span>
          </div>
        </div>
      </div>
      <div class="card card-pad">
        <h3 style="font-size:18px;margin-bottom:12px">申請帳號</h3>
        <div class="form-grid">
          <div class="field"><label>帳號</label><input id="regAccount" autocomplete="username" placeholder="建立登入帳號"></div>
          <div class="field"><label>密碼</label><input id="regPassword" type="password" autocomplete="new-password" placeholder="建立密碼"></div>
          <div class="field"><label>暱稱</label><input id="regNick" placeholder="顯示在系統內的名稱"></div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn" id="registerBtn">送出申請</button>
            <span id="registerMsg" class="muted" style="font-size:13px"></span>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

