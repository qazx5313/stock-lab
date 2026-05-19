/* ============ Supabase 設定 ============
   只用 anon key（公開金鑰，僅能讀取，已設 RLS 保護）。
   service_role 絕不放這裡，只放 GitHub Actions Secrets。 */
const SB_URL  = 'https://wgyumblfupaspzywiwzc.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndneXVtYmxmdXBhc3B6eXdpd3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5NjksImV4cCI6MjA5NDU4NDk2OX0.pUur9c40B76uOsI4LphE2cwtE_oqBWUMOwIT-L8qu9g';
const EDGE_RUN_DAILY_URL = `${SB_URL}/functions/v1/trigger-github-action`;
const EDGE_ADMIN_WRITE_URL = `${SB_URL}/functions/v1/admin-write`;
const ALLOW_DIRECT_BROWSER_WRITES = false;
let DATA_REAL_READY = false;
let DATA_LOAD_ERROR = '';
let DATA_FROM_CACHE = false;

async function sbGet(path, hi){
  const headers = { apikey:SB_ANON, Authorization:`Bearer ${SB_ANON}` };
  if(hi){ headers['Range-Unit']='items'; headers['Range']='0-'+hi; }
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers });
  if(!r.ok){
    const body = await r.text().catch(()=> '');
    throw new Error('Supabase '+r.status+' '+body.slice(0,160));
  }
  return r.json();
}
async function sbWrite(path, body, method='POST'){
  if(!ALLOW_DIRECT_BROWSER_WRITES){
    throw new Error('基於安全性，前端直接寫入 Supabase 已停用；請改用 Edge Function 寫入。');
  }
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers:{
      apikey:SB_ANON, Authorization:`Bearer ${SB_ANON}`,
      'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=representation'
    },
    body:JSON.stringify(body)
  });
  if(!r.ok){
    const txt = await r.text().catch(()=> '');
    throw new Error('Supabase '+r.status+' '+txt.slice(0,160));
  }
  return r.json();
}
async function sbPatch(path, body){
  if(!ALLOW_DIRECT_BROWSER_WRITES){
    throw new Error('基於安全性，前端直接寫入 Supabase 已停用；請改用 Edge Function 寫入。');
  }
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method:'PATCH',
    headers:{
      apikey:SB_ANON, Authorization:`Bearer ${SB_ANON}`,
      'Content-Type':'application/json', Prefer:'return=representation'
    },
    body:JSON.stringify(body)
  });
  if(!r.ok){
    const txt = await r.text().catch(()=> '');
    throw new Error('Supabase '+r.status+' '+txt.slice(0,160));
  }
  return r.json();
}

async function triggerDailyWorkflow(){
  let r;
  try{
    r = await fetch(EDGE_RUN_DAILY_URL, {
      method:'POST',
      headers:{
        apikey:SB_ANON,
        Authorization:`Bearer ${SB_ANON}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({workflow:'daily.yml', ref:'main'})
    });
  }catch(e){
    throw new Error('連不到 Edge Function，通常是 Supabase Function CORS 沒開，或 Function 尚未部署');
  }
  const txt = await r.text().catch(()=> '');
  let data = {};
  try{ data = txt ? JSON.parse(txt) : {}; }catch(_){ data = {error:txt}; }
  if(!r.ok || data.ok===false){
    throw new Error(data.error || data.message || `HTTP ${r.status}`);
  }
  return data;
}

