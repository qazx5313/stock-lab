/* ============ 事件綁定 ============ */
function bindPage(id){
  document.querySelectorAll('[data-stock]').forEach(el=>el.onclick=async()=>{
    DATA.stock.c=el.dataset.stock;
    await loadStockSeries(el.dataset.stock);
    go('stock');});
  document.querySelectorAll('[data-theme]').forEach(el=>el.onclick=()=>{
    const t=DATA.themes.find(x=>x.id===el.dataset.theme); if(t){MAP_SEL=t.id;go('map');}});
  const loginBtn=document.getElementById('loginBtn');
  if(loginBtn)loginBtn.onclick=async()=>{
    const account=(document.getElementById('loginAccount')||{}).value?.trim()||'';
    const password=(document.getElementById('loginPassword')||{}).value||'';
    const msg=document.getElementById('loginMsg');
    if(msg){msg.textContent='登入中…';msg.style.color='var(--ink-2)';}
    const found=await remoteLogin(account,password);
    if(!found){
      if(msg){msg.textContent='帳號或密碼錯誤';msg.style.color='#92400E';}
      return;
    }
    setAuthUser({account:found.account,nick:found.nick,role:found.role||'user',daysRemaining:found.daysRemaining||0});
    await loadRemoteEntitlements(found.account);
    buildNav();
    go(id==='admin'?'admin':'home');
  };
  const registerBtn=document.getElementById('registerBtn');
  if(registerBtn)registerBtn.onclick=async()=>{
    const account=(document.getElementById('regAccount')||{}).value?.trim()||'';
    const password=(document.getElementById('regPassword')||{}).value||'';
    const nick=(document.getElementById('regNick')||{}).value?.trim()||'';
    const msg=document.getElementById('registerMsg');
    if(!account||!password||!nick){
      if(msg){msg.textContent='請填寫帳號、密碼與暱稱';msg.style.color='#92400E';}
      return;
    }
    if(users().some(u=>u.account===account)){
      if(msg){msg.textContent='此帳號已存在';msg.style.color='#92400E';}
      return;
    }
    if(msg){msg.textContent='送出中…';msg.style.color='var(--ink-2)';}
    const ok=await remoteRegister(account,password,nick);
    if(!ok){
      if(msg){msg.textContent='前端直接註冊已停用，請改用 Edge Function / Supabase Auth 建立帳號';msg.style.color='#92400E';}
      return;
    }
    const next=[...users(),{account,nick,role:'user',createdAt:new Date().toISOString()}];
    setUsers(next);
    if(msg){msg.textContent='申請完成，可直接登入';msg.style.color='var(--up)';}
  };
  const logoutBtn=document.getElementById('logoutBtn');
  if(logoutBtn)logoutBtn.onclick=()=>{setAuthUser(null);setAuthToken('');buildNav();go('home');};
  if(id==='screen'){
    const upd=()=>{document.getElementById('selCnt').textContent=SEL.size;
      document.querySelectorAll('[data-f]').forEach(c=>c.classList.toggle('on',SEL.has(c.dataset.f)));};
    document.querySelectorAll('[data-f]').forEach(c=>c.onclick=()=>{
      SEL.has(c.dataset.f)?SEL.delete(c.dataset.f):SEL.add(c.dataset.f);upd();});
    document.getElementById('clrBtn').onclick=()=>{SEL.clear();upd();
      document.getElementById('resBody').innerHTML=rowsScreen([]);document.getElementById('resCnt').textContent=0;};
    document.getElementById('runBtn').onclick=()=>{
      const n=Math.max(3,Math.min(DATA.screen.length,DATA.screen.length-((4-SEL.size)%4+4)%4));
      const r=DATA.screen.slice(0,Math.max(3,n));document.getElementById('resBody').innerHTML=rowsScreen(r);
      document.getElementById('resCnt').textContent=r.length;
      document.querySelectorAll('#resBody [data-stock]').forEach(el=>el.onclick=async()=>{DATA.stock.c=el.dataset.stock;await loadStockSeries(el.dataset.stock);go('stock');});};
  }
  if(id==='ai'){
    document.querySelectorAll('[data-ai]').forEach(el=>el.onclick=async()=>{AI_VIEW=el.dataset.ai;await loadAIDetailData(AI_VIEW);go('ai');});
    const bk=document.querySelector('[data-aiback]');if(bk)bk.onclick=()=>{AI_VIEW=null;go('ai');};
  }
  if(id==='stock'){
    const inp=document.getElementById('stkInput');
    const btn=document.getElementById('stkSearchBtn');
    const doSearch=async()=>{
      const v=(inp&&inp.value||'').trim();
      if(!/^[1-9]\d{3}$/.test(v)){
        alert('請輸入 4 位數字股票代號（例：1815）');return;
      }
      if(btn){btn.textContent='查詢中…';btn.disabled=true;}
      DATA.stock.c=v;
      await loadStockSeries(v);
      if(!DATA.stock.series){
        if(btn){btn.textContent='查詢';btn.disabled=false;}
        alert('查無「'+v+'」的歷史資料（可能非上市櫃普通股，或資料庫尚未收錄）');
        return;
      }
      go('stock');
    };
    if(btn)btn.onclick=doSearch;
    if(inp)inp.onkeydown=(e)=>{ if(e.key==='Enter')doSearch(); };
  }
  if(id==='status'){
    const runBtn=document.getElementById('runDailyBtn');
    const runMsg=document.getElementById('runDailyMsg');
    if(runBtn)runBtn.onclick=async()=>{
      if(!isAdmin()){
        if(runMsg){runMsg.textContent='只有管理員可以執行';runMsg.style.color='#92400E';}
        return;
      }
      runBtn.disabled=true;
      runBtn.textContent='觸發中…';
      if(runMsg){runMsg.textContent='正在請 GitHub Actions 開始跑 daily.yml';runMsg.style.color='var(--ink-2)';}
      try{
        await triggerDailyWorkflow();
        if(runMsg){runMsg.textContent='已送出，請到 GitHub Actions 查看執行進度';runMsg.style.color='var(--up)';}
      }catch(e){
        if(runMsg){runMsg.textContent='觸發失敗：'+(e.message||e);runMsg.style.color='#92400E';}
      }finally{
        runBtn.disabled=false;
        runBtn.textContent='手動重新抓取';
      }
    };
  }
  if(id==='admin'){
    admBody(0);
    const bindAdminControls=()=>{
      const editor=document.getElementById('adminEditor');
      const clearEditor=()=>{if(editor)editor.innerHTML='';};
      const cancel=document.getElementById('cancelAdminEditBtn');
      if(cancel)cancel.onclick=clearEditor;
      const addStock=document.getElementById('addStockBtn');
      if(addStock&&editor)addStock.onclick=()=>{editor.innerHTML=stockAdminForm();bindAdminControls();};
      document.querySelectorAll('[data-stock-edit]').forEach(btn=>btn.onclick=()=>{
        const s=DATA.adminStocks.find(x=>x.c===btn.dataset.stockEdit)||{};
        if(editor){editor.innerHTML=stockAdminForm(s);bindAdminControls();}
      });
      const saveStock=document.getElementById('saveStockBtn');
      if(saveStock)saveStock.onclick=async()=>{
        const msg=document.getElementById('adminEditMsg');
        const row={
          c:(document.getElementById('admStockSymbol')||{}).value?.trim()||'',
          n:(document.getElementById('admStockName')||{}).value?.trim()||'',
          m:(document.getElementById('admStockMarket')||{}).value||'TWSE',
          ind:(document.getElementById('admStockIndustry')||{}).value?.trim()||'',
          th:(document.getElementById('admStockTheme')||{}).value?.trim()||'',
          lead:!!(document.getElementById('admStockLead')||{}).checked,
          obs:!!(document.getElementById('admStockObs')||{}).checked
        };
        if(!/^[0-9A-Za-z.-]+$/.test(row.c)||!row.n){if(msg){msg.textContent='請填股票代號與名稱';msg.style.color='#92400E';}return;}
        saveStock.disabled=true;saveStock.textContent='儲存中…';
        try{
          await adminWrite('save_stock',{
            symbol:row.c,name:row.n,market:row.m,industry:row.ind,
            theme_tags:row.th?row.th.split(/[、,]/).map(x=>x.trim()).filter(Boolean):[],
            is_leader:row.lead
          });
          const i=DATA.adminStocks.findIndex(x=>x.c===row.c);
          if(i>=0) DATA.adminStocks[i]=row; else DATA.adminStocks.unshift(row);
          admBody(0);bindAdminControls();
        }catch(e){if(msg){msg.textContent='儲存失敗：'+(e.message||e);msg.style.color='#92400E';}}
        saveStock.disabled=false;saveStock.textContent='儲存股票';
      };
      const addTheme=document.getElementById('addThemeBtn');
      if(addTheme&&editor)addTheme.onclick=()=>{editor.innerHTML=themeAdminForm();bindAdminControls();};
      document.querySelectorAll('[data-theme-edit]').forEach(btn=>btn.onclick=()=>{
        const t=DATA.themes.find(x=>x.id===btn.dataset.themeEdit)||{};
        if(editor){editor.innerHTML=themeAdminForm(t);bindAdminControls();}
      });
      const saveTheme=document.getElementById('saveThemeBtn');
      if(saveTheme)saveTheme.onclick=async()=>{
        const msg=document.getElementById('adminEditMsg');
        const localId=(document.getElementById('admThemeLocalId')||{}).value||'';
        let dbId=(document.getElementById('admThemeDbId')||{}).value||'';
        const name=(document.getElementById('admThemeName')||{}).value?.trim()||'';
        const score=Math.max(0,Math.min(100,parseInt((document.getElementById('admThemeScore')||{}).value,10)||0));
        const status=(document.getElementById('admThemeStatus')||{}).value?.trim()||'觀察';
        const chain=(document.getElementById('admThemeChain')||{}).value?.trim()||'—';
        const desc=(document.getElementById('admThemeDesc')||{}).value?.trim()||'';
        if(!name){if(msg){msg.textContent='請填題材名稱';msg.style.color='#92400E';}return;}
        saveTheme.disabled=true;saveTheme.textContent='儲存中…';
        try{
          const body={theme_name:name,heat_score:score,trend_status:status,description:desc,updated_at:new Date().toISOString()};
          const saved=await adminWrite('save_theme',{id:dbId,theme_name:name,heat_score:score,trend_status:status,description:desc});
          dbId=dbId || (Array.isArray(saved)?saved[0]?.id:saved?.id);
          const lines=((document.getElementById('admThemeStocks')||{}).value||'').split('\n').map(x=>x.trim()).filter(Boolean);
          const stocks=lines.map(line=>{
            const [symbol,role,level,relevance]=line.split(',').map(x=>x.trim());
            return {theme_id:Number(dbId),symbol,role:role||'成分',supply_chain_level:level||chain,relevance_score:parseInt(relevance,10)||80,note:''};
          }).filter(x=>x.theme_id&&x.symbol);
          if(stocks.length) await adminWrite('save_theme_stocks',stocks);
          const next={id:localId||('t'+Date.now()),themeId:dbId,name,score,gain:'—',vol:'—',limit:0,high:0,status,desc,chain,
            stocks:stocks.map(x=>({c:x.symbol,n:x.symbol,role:x.role,level:x.supply_chain_level,score:x.relevance_score}))};
          const i=DATA.themes.findIndex(x=>x.id===localId);
          if(i>=0) DATA.themes[i]=next; else DATA.themes.unshift(next);
          DATA.themeList=DATA.themes.map(t=>t.name);
          admBody(1);bindAdminControls();
        }catch(e){if(msg){msg.textContent='儲存失敗：'+(e.message||e);msg.style.color='#92400E';}}
        saveTheme.disabled=false;saveTheme.textContent='儲存題材';
      };
      const saveNote=document.getElementById('saveReportNoteBtn');
      if(saveNote)saveNote.onclick=async()=>{
        const msg=document.getElementById('reportMsg');
        const note=(document.getElementById('reportNoteInput')||{}).value||'';
        setReportNote(note);
        try{
          await adminWrite('save_report_note',{note});
          if(msg){msg.textContent='已儲存報告備註';msg.style.color='var(--up)';}
        }catch(e){
          if(msg){msg.textContent='已先儲存在本機；Supabase 儲存失敗：'+(e.message||e);msg.style.color='#92400E';}
        }
      };
      const regen=document.getElementById('regenReportBtn');
      if(regen)regen.onclick=()=>{setReportNote('');admBody(3);bindAdminControls();go('report');};
      const memberSelect=document.getElementById('memberSelect');
      if(memberSelect)memberSelect.onchange=async()=>{
        localStorage.setItem('stockLabAdminMember',memberSelect.value);
        await loadRemoteEntitlements(memberSelect.value);
        admBody(4);bindAdminControls();
      };
      const openAll=document.getElementById('openAllBtn');
      if(openAll)openAll.onclick=()=>{
        const account=(document.getElementById('memberSelect')||{}).value||'';
        if(!account) return;
        const days=Math.max(1,parseInt((document.getElementById('allDaysInput')||{}).value,10)||1);
        const rows=manageableActivationSettings().map(a=>({...a,enabled:true,days}));
        setMemberEntitlements(account,rows);
        admBody(4);bindAdminControls();
        const msg=document.getElementById('activationMsg');
        if(msg){msg.textContent='已套用全部板塊 '+days+' 天，請儲存';msg.style.color='var(--up)';}
      };
      document.querySelectorAll('[data-act-toggle]').forEach(btn=>btn.onclick=()=>{
        const account=(document.getElementById('memberSelect')||{}).value||'';
        if(!account) return;
        const acts=memberEntitlements(account);
        const item=acts.find(a=>a.id===btn.dataset.actToggle);
        if(item){item.enabled=!item.enabled;setMemberEntitlements(account,acts);admBody(4);bindAdminControls();}
      });
      const saveAct=document.getElementById('saveActivationBtn');
      if(saveAct)saveAct.onclick=async()=>{
        const account=(document.getElementById('memberSelect')||{}).value||'';
        if(!account) return;
        const acts=memberEntitlements(account).map(a=>({
          ...a,
          days:Math.max(1,parseInt((document.getElementById('act_days_'+a.id)||{}).value,10)||1)
        }));
        setMemberEntitlements(account,acts);
        await saveRemoteEntitlements(account,acts);
        const msg=document.getElementById('activationMsg');
        if(msg){msg.textContent='已儲存 '+account+' 的板塊開通與天數';msg.style.color='var(--up)';}
      };
    };
    document.querySelectorAll('#admSeg button').forEach(btn=>btn.onclick=()=>{
      document.querySelectorAll('#admSeg button').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');admBody(+btn.dataset.tab);bindAdminControls();});
    bindAdminControls();
  }
}
window.addEventListener('resize',()=>{if(CUR==='stock')drawStockCharts();});

/* ============ 初始化 ============ */
buildNav();
document.getElementById('view').innerHTML=vLoading();
loadRemoteActivation().then(()=>{ buildNav(); });
loadRemoteUsers().then(()=>{ if(isAdmin()&&CUR==='admin') go('admin'); });
/* 背景嘗試載入真實資料，成功後重繪當前頁；失敗時顯示錯誤，不顯示 MOCK 股票資料 */
loadReal().then(()=>{ go(CUR||'home'); });

