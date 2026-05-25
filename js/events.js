/* ============ 事件綁定 ============ */
function bindPage(id){
  document.querySelectorAll('[data-stock]').forEach(el=>el.onclick=async()=>{
    DATA.stock.c=el.dataset.stock;
    await loadStockSeries(el.dataset.stock);
    go('stock');});
  document.querySelectorAll('[data-strategy-filter]').forEach(el=>el.onclick=()=>{
    if(typeof STRATEGY_TYPE_FILTER!=='undefined') STRATEGY_TYPE_FILTER=el.dataset.strategyFilter||'all';
    go('strategy');
  });
  document.querySelectorAll('[data-strategy-toggle-hits]').forEach(el=>el.onclick=()=>{
    if(typeof STRATEGY_ONLY_HITS!=='undefined') STRATEGY_ONLY_HITS=!STRATEGY_ONLY_HITS;
    go('strategy');
  });
  document.querySelectorAll('[data-strategy-focus]').forEach(el=>el.onclick=()=>{
    if(typeof STRATEGY_FOCUS_ID!=='undefined'){
      const next=el.dataset.strategyFocus||'';
      STRATEGY_FOCUS_ID=STRATEGY_FOCUS_ID===next?'':next;
    }
    go('strategy');
  });
  document.querySelectorAll('[data-strategy-clear]').forEach(el=>el.onclick=()=>{
    if(typeof STRATEGY_FOCUS_ID!=='undefined') STRATEGY_FOCUS_ID='';
    go('strategy');
  });
  document.querySelectorAll('[data-strategy-view]').forEach(el=>el.onclick=()=>{
    if(typeof STRATEGY_VIEW!=='undefined') STRATEGY_VIEW=el.dataset.strategyView||'group';
    go('strategy');
  });
  document.querySelectorAll('[data-strategy-group]').forEach(el=>el.onclick=()=>{
    if(typeof STRATEGY_OPEN_GROUP!=='undefined') STRATEGY_OPEN_GROUP=STRATEGY_OPEN_GROUP===el.dataset.strategyGroup?'':el.dataset.strategyGroup;
    go('strategy');
  });
  const strategySearch=document.getElementById('strategySearchInput');
  if(strategySearch){
    strategySearch.oninput=()=>{
      if(typeof STRATEGY_QUERY!=='undefined') STRATEGY_QUERY=strategySearch.value||'';
      clearTimeout(window.__strategySearchTimer);
      const pos=strategySearch.selectionStart||0;
      window.__strategySearchTimer=setTimeout(()=>{
        if(CUR==='strategy') go('strategy');
        setTimeout(()=>{
          const next=document.getElementById('strategySearchInput');
          if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch(_){}}
        },0);
      },220);
    };
    strategySearch.onkeydown=e=>{
      if(e.key==='Enter'){e.preventDefault();if(typeof STRATEGY_QUERY!=='undefined') STRATEGY_QUERY=strategySearch.value||'';go('strategy');}
    };
  }
  document.querySelectorAll('[data-strategy-search-clear]').forEach(el=>el.onclick=()=>{
    if(typeof STRATEGY_QUERY!=='undefined') STRATEGY_QUERY='';
    go('strategy');
  });
  const strategySort=document.getElementById('strategySortSelect');
  if(strategySort) strategySort.onchange=()=>{
    if(typeof STRATEGY_SORT!=='undefined') STRATEGY_SORT=strategySort.value||'category';
    go('strategy');
  };
  document.querySelectorAll('[data-theme-major]').forEach(el=>el.onclick=()=>{
    MAP_MAJOR=el.dataset.themeMajor||'';
    const first=(typeof mapThemesForMajor==='function'?mapThemesForMajor(MAP_MAJOR):[])[0];
    MAP_SEL=first?first.id:'';
    MAP_QUERY='';
    go('map');
  });
  document.querySelectorAll('[data-theme]').forEach(el=>el.onclick=()=>{
    const list=typeof mapMarketThemes==='function'?mapMarketThemes():(DATA.themes||[]);
    const t=list.find(x=>x.id===el.dataset.theme); if(t){MAP_SEL=t.id;if(typeof themeParts==='function') MAP_MAJOR=themeParts(t.name).major;go('map');}});
  const mapMajorSelect=document.getElementById('mapMajorSelect');
  if(mapMajorSelect) mapMajorSelect.onchange=()=>{
    MAP_MAJOR=mapMajorSelect.value||'';
    const first=(typeof mapThemesForMajor==='function'?mapThemesForMajor(MAP_MAJOR):[])[0];
    MAP_SEL=first?first.id:'';
    MAP_QUERY='';
    go('map');
  };
  const mapThemeSelect=document.getElementById('mapThemeSelect');
  if(mapThemeSelect) mapThemeSelect.onchange=()=>{
    MAP_SEL=mapThemeSelect.value||'';
    if(typeof mapMarketThemes==='function' && typeof themeParts==='function'){
      const t=mapMarketThemes().find(x=>x.id===MAP_SEL);
      if(t) MAP_MAJOR=themeParts(t.name).major;
    }
    MAP_QUERY='';
    go('map');
  };
  const mapStockSearch=document.getElementById('mapStockSearch');
  const runMapSearch=()=>{
    if(mapStockSearch) MAP_QUERY=mapStockSearch.value||'';
    if(typeof mapFindThemeByQuery==='function'){
      const hit=mapFindThemeByQuery(MAP_QUERY);
      if(hit){
        MAP_SEL=hit.id;
        if(typeof themeParts==='function') MAP_MAJOR=themeParts(hit.name).major;
      }
    }
    go('map');
  };
  if(mapStockSearch) mapStockSearch.oninput=()=>{
    MAP_QUERY=mapStockSearch.value||'';
  };
  if(mapStockSearch) mapStockSearch.onkeydown=e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      runMapSearch();
    }
  };
  const mapSearchBtn=document.getElementById('mapSearchBtn');
  if(mapSearchBtn) mapSearchBtn.onclick=runMapSearch;
  document.querySelectorAll('[data-map-market]').forEach(el=>el.onclick=()=>{
    MAP_MARKET=el.dataset.mapMarket==='TPEX'?'TPEX':'TWSE';
    const first=(typeof mapThemesForMajor==='function'?mapThemesForMajor(MAP_MAJOR):[])[0]||(typeof mapMarketThemes==='function'?mapMarketThemes():(DATA.themes||[]))[0];
    MAP_SEL=first?first.id:'';
    MAP_QUERY='';
    go('map');
  });
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
    await syncWatchlistFromRemote(true);
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
    const result=await remoteRegister(account,password,nick);
    if(!result.ok){
      if(msg){msg.textContent='申請失敗：'+(result.error||'請稍後再試');msg.style.color='#92400E';}
      return;
    }
    const next=[...users(),{account,nick,role:'user',createdAt:new Date().toISOString()}];
    setUsers(next);
    if(msg){msg.textContent='申請完成，可直接登入';msg.style.color='var(--up)';}
  };
  const logoutBtn=document.getElementById('logoutBtn');
  if(logoutBtn)logoutBtn.onclick=()=>{setAuthUser(null);setAuthToken('');setRefreshToken('');if(typeof WATCH_REMOTE_LOADED!=='undefined')WATCH_REMOTE_LOADED=false;buildNav();go('home');};
  if(id==='screen'){
    const upd=()=>{const x=document.getElementById('selCnt');if(x)x.textContent=SEL.size;
      document.querySelectorAll('[data-f]').forEach(c=>c.classList.toggle('on',SEL.has(c.dataset.f)));};
    document.querySelectorAll('[data-f]').forEach(c=>c.onclick=()=>{
      SEL.has(c.dataset.f)?SEL.delete(c.dataset.f):SEL.add(c.dataset.f);
      go('screen');
    });
    document.querySelectorAll('[data-screen-template]').forEach(card=>card.onclick=()=>{
      if(typeof SCREEN_TEMPLATE_ID!=='undefined') SCREEN_TEMPLATE_ID=card.dataset.screenTemplate||'';
      const t=typeof screenTemplateById==='function'?screenTemplateById(SCREEN_TEMPLATE_ID):null;
      if(typeof SEL!=='undefined' && typeof screenTemplateChips==='function'){
        SEL.clear();
        screenTemplateChips(t).forEach(x=>SEL.add(x));
      }
      go('screen');
    });
    document.querySelectorAll('[data-screen-template]').forEach(card=>card.onkeydown=e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}
    });
    const clr=document.getElementById('clrBtn');
    if(clr)clr.onclick=()=>{
      if(typeof SCREEN_TEMPLATE_ID!=='undefined') SCREEN_TEMPLATE_ID='';
      SEL.clear();
      go('screen');
    };
    const run=document.getElementById('runBtn');
    if(run)run.onclick=()=>go('screen');
    const exp=document.getElementById('exportScreenBtn');
    if(exp)exp.onclick=()=>{
      const rows=typeof screenApplyRows==='function'?screenApplyRows():(DATA.screen||[]);
      const head=['代號','名稱','題材','收盤','漲跌%','成交量','符合條件'];
      const csv=[head,...rows.map(s=>[s.c,s.n,s.t,s.px,s.dp,fmtScreenVol(s.vol),screenReason(s)])]
        .map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='每日篩選.csv';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    };
  }
  if(id==='ai'){
    document.querySelectorAll('[data-ai]').forEach(el=>el.onclick=async()=>{AI_VIEW=el.dataset.ai;await loadAIDetailData(AI_VIEW);go('ai');});
    const bk=document.querySelector('[data-aiback]');if(bk)bk.onclick=()=>{AI_VIEW=null;go('ai');};
  }
  if(id==='patterns' && typeof bindPatterns==='function'){
    bindPatterns();
  }
  if(id==='watch'){
    if(authUser() && !WATCH_REMOTE_LOADED){
      syncWatchlistFromRemote().then(ok=>{if(ok&&CUR==='watch')go('watch');});
    }
    const inp=document.getElementById('watchInput');
    const add=document.getElementById('watchAddBtn');
    const doAdd=async()=>{
      const v=(inp&&inp.value||'').trim();
      if(!/^[1-9]\d{3}$/.test(v)){
        alert('請輸入 4 位數字股票代號（例：1815）');return;
      }
      addWatchStock(v);
      await persistWatchlist();
      go('watch');
    };
    if(add)add.onclick=doAdd;
    if(inp)inp.onkeydown=e=>{if(e.key==='Enter')doAdd();};
    document.querySelectorAll('[data-watch-remove]').forEach(btn=>btn.onclick=async()=>{
      removeWatchStock(btn.dataset.watchRemove);
      await persistWatchlist();
      go('watch');
    });
  }
  if(id==='atr'){
    const add=document.getElementById('atrAddBtn');
    const msg=document.getElementById('atrMsg');
    const calcAtr=async(sym,period)=>{
      try{
        const rows=await sbGet(`daily_prices?select=date,high,low,close&symbol=eq.${sym}&order=date.desc&limit=${Math.max(30,period+5)}`,80);
        const a=(rows||[]).slice().reverse();
        if(a.length<period+1) return NaN;
        const trs=[];
        for(let i=1;i<a.length;i++){
          const h=Number(a[i].high||a[i].close), l=Number(a[i].low||a[i].close), pc=Number(a[i-1].close);
          trs.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));
        }
        const sub=trs.slice(-period);
        return sub.reduce((s,x)=>s+x,0)/sub.length;
      }catch(e){return NaN;}
    };
    if(add)add.onclick=async()=>{
      const sym=(document.getElementById('atrSymbol')||{}).value?.trim()||'';
      const entry=Number((document.getElementById('atrEntry')||{}).value);
      const period=Math.max(2,parseInt((document.getElementById('atrPeriod')||{}).value,10)||14);
      if(!/^[1-9]\d{3}$/.test(sym)||!Number.isFinite(entry)||entry<=0){
        if(msg){msg.textContent='請輸入正確股票代號與買入價';msg.style.color='#92400E';}
        return;
      }
      add.disabled=true;add.textContent='計算中…';
      const info=stockKnownInfo(sym);
      let atr=await calcAtr(sym,period);
      if(!Number.isFinite(atr)||atr<=0) atr=entry*0.035;
      const stopMult=Number((document.getElementById('atrStopMult')||{}).value)||1;
      const takeMult=Number((document.getElementById('atrTakeMult')||{}).value)||1.5;
      const trailAtr=Number((document.getElementById('atrTrailAtr')||{}).value)||0.5;
      const trailPct=Number((document.getElementById('atrTrailPct')||{}).value)||5;
      const rows=atrRows().filter(x=>x.c!==sym);
      rows.unshift({c:sym,n:info.n||sym,entry,period,atr,stopMult,takeMult,trailAtr,trailPct,current:info.px,high:Math.max(entry,Number(info.px)||entry),createdAt:new Date().toISOString(),dir:'long'});
      setAtrRows(rows);
      if(msg){msg.textContent='已加入 ATR 觀察列表';msg.style.color='var(--up)';}
      add.disabled=false;add.textContent='加入觀察';
      go('atr');
    };
    document.querySelectorAll('[data-atr-remove]').forEach(btn=>btn.onclick=()=>{
      setAtrRows(atrRows().filter(x=>x.c!==btn.dataset.atrRemove));
      go('atr');
    });
  }
  if(id==='stock'){
    const inp=document.getElementById('stkInput');
    const btn=document.getElementById('stkSearchBtn');
    const bindWatchButton=(watchBtn)=>{
      if(!watchBtn) return;
      watchBtn.onclick=async()=>{
        const sym=watchBtn.dataset.watchSymbol||DATA.stock.c;
        if(isWatched(sym)){
          removeWatchStock(sym);
          document.querySelectorAll(`[data-watch-symbol="${sym}"]`).forEach(b=>b.textContent='加入自選');
        }else{
          addWatchStock(DATA.stock);
          document.querySelectorAll(`[data-watch-symbol="${sym}"]`).forEach(b=>b.textContent='移出自選');
        }
        await persistWatchlist();
      };
    };
    document.querySelectorAll('[data-watch-symbol]').forEach(bindWatchButton);
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
    admBody(4);
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
        const draft={
          content:(document.getElementById('reportContentInput')||{}).value||'',
          picks:(document.getElementById('reportPicksInput')||{}).value||'',
          updatedAt:new Date().toISOString()
        };
        const note=JSON.stringify(draft);
        setReportNote(note);
        try{
          await adminWrite('save_report_note',{note});
          if(msg){msg.textContent='已儲存報告內容，前台每日報告會顯示修改版';msg.style.color='var(--up)';}
        }catch(e){
          if(msg){msg.textContent='已先儲存在本機；Supabase 儲存失敗：'+(e.message||e);msg.style.color='#92400E';}
        }
      };
      document.querySelectorAll('[data-report-view]').forEach(btn=>btn.onclick=()=>{
        const box=document.getElementById('reportEditBox');
        if(box)box.scrollIntoView({behavior:'smooth',block:'start'});
      });
      const preview=document.getElementById('previewReportBtn');
      if(preview)preview.onclick=()=>go('report');
      const regen=document.getElementById('regenReportBtn');
      if(regen)regen.onclick=()=>{setReportNote('');admBody(3);bindAdminControls();go('report');};
      const memberSelect=document.getElementById('memberSelect');
      if(memberSelect)memberSelect.onchange=async()=>{
        localStorage.setItem('stockLabAdminMember',memberSelect.value);
        await loadRemoteEntitlements(memberSelect.value);
        admBody(4);bindAdminControls();
      };
      const createUser=document.getElementById('createUserBtn');
      if(createUser)createUser.onclick=async()=>{
        const msg=document.getElementById('userManageMsg');
        const account=(document.getElementById('newUserAccount')||{}).value?.trim()||'';
        const password=(document.getElementById('newUserPassword')||{}).value||'';
        const nick=(document.getElementById('newUserNick')||{}).value?.trim()||account;
        const role=(document.getElementById('newUserRole')||{}).value||'user';
        if(!account||!password){if(msg){msg.textContent='請填 Email 與密碼';msg.style.color='#92400E';}return;}
        createUser.disabled=true;createUser.textContent='新增中…';
        try{
          await adminWrite('create_user',{account,password,nick,role,days_remaining:0});
          const next=users().filter(u=>u.account!==account);
          next.unshift({account,nick,role,daysRemaining:0});
          setUsers(next);
          localStorage.setItem('stockLabAdminMember',account);
          admBody(4);bindAdminControls();
        }catch(e){if(msg){msg.textContent='新增失敗：'+(e.message||e);msg.style.color='#92400E';}}
        createUser.disabled=false;createUser.textContent='新增帳號';
      };
      const deleteUser=document.getElementById('deleteUserBtn');
      if(deleteUser)deleteUser.onclick=async()=>{
        const account=(document.getElementById('memberSelect')||{}).value||'';
        const msg=document.getElementById('userManageMsg');
        if(!account) return;
        if(!confirm('確定刪除帳號 '+account+'？此動作會刪除登入帳號與開通資料。')) return;
        deleteUser.disabled=true;deleteUser.textContent='刪除中…';
        try{
          await adminWrite('delete_user',{account});
          setUsers(users().filter(u=>u.account!==account));
          const all=entitlements(); delete all[account]; setEntitlements(all);
          localStorage.removeItem('stockLabAdminMember');
          admBody(4);bindAdminControls();
        }catch(e){if(msg){msg.textContent='刪除失敗：'+(e.message||e);msg.style.color='#92400E';}}
        deleteUser.disabled=false;deleteUser.textContent='刪除目前選定帳號';
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
      document.querySelectorAll('[data-maint-toggle]').forEach(btn=>btn.onclick=()=>{
        const rows=maintenanceSettings();
        const item=rows.find(a=>a.id===btn.dataset.maintToggle);
        if(item){
          item.maintenance=!item.maintenance;
          DATA.maintenance=DATA.maintenance||{};
          rows.forEach(r=>{DATA.maintenance[r.id]={id:r.id,name:r.name,maintenance:!!r.maintenance,message:(document.getElementById('maint_msg_'+r.id)||{}).value||r.message};});
          admBody(5);bindAdminControls();
        }
      });
      const saveMaintenance=document.getElementById('saveMaintenanceBtn');
      if(saveMaintenance)saveMaintenance.onclick=async()=>{
        const msg=document.getElementById('maintenanceMsg');
        const rows=maintenanceSettings().map(a=>({
          ...a,
          message:(document.getElementById('maint_msg_'+a.id)||{}).value||a.message
        }));
        saveMaintenance.disabled=true;saveMaintenance.textContent='儲存中…';
        const result=await saveRemoteMaintenance(rows);
        if(msg){
          msg.textContent=result.ok?'已儲存板塊維修狀態':'儲存失敗：'+(result.error||'請確認 Edge Function 與資料表');
          msg.style.color=result.ok?'var(--up)':'#92400E';
        }
        saveMaintenance.disabled=false;saveMaintenance.textContent='儲存維修狀態';
        buildNav();
      };
      const saveObserve=document.getElementById('saveObserveBtn');
      if(saveObserve)saveObserve.onclick=async()=>{
        const msg=document.getElementById('observeMsg');
        const lines=((document.getElementById('observeInput')||{}).value||'').split('\n').map(x=>x.trim()).filter(Boolean);
        const rows=lines.map(line=>{
          const [symbol,name,category,...noteParts]=line.split(',').map(x=>x.trim());
          return {symbol,name:name||symbol,category:category||'觀察',note:noteParts.join(',')||'',is_active:true};
        }).filter(r=>/^[1-9]\d{3}$/.test(r.symbol));
        saveObserve.disabled=true;saveObserve.textContent='儲存中…';
        try{
          await adminWrite('save_observations',{rows});
          DATA.observations=rows.map(r=>({c:r.symbol,...r}));
          if(msg){msg.textContent='已儲存觀察報告';msg.style.color='var(--up)';}
        }catch(e){
          if(msg){msg.textContent='儲存失敗：'+(e.message||e);msg.style.color='#92400E';}
        }
        saveObserve.disabled=false;saveObserve.textContent='儲存觀察報告';
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
const hadCache=restoreRealCache();
if(hadCache){
  buildNav();
  go(CUR||'home');
}else{
  document.getElementById('view').innerHTML=vLoading();
}
loadRemoteActivation().then(()=>{ buildNav(); });
loadRemoteUsers().then(()=>{ if(isAdmin()&&CUR==='admin') go('admin'); });
if(authUser()){
  loadRemoteEntitlements(authUser().account).then(()=>{
    buildNav();
    go(CUR||'home');
  });
}
/* 背景嘗試載入真實資料，成功後重繪當前頁；失敗時顯示錯誤，不顯示 MOCK 股票資料 */
loadReal().then(()=>{
  go(CUR||'home');
  if(typeof refreshLiveEdge==='function' && DATA_REAL_READY && !document.hidden){
    refreshLiveEdge();
  }
});

setInterval(()=>{
  if(typeof refreshRealtimeOnly==='function' && DATA_REAL_READY && !document.hidden){
    refreshRealtimeOnly();
  }
},60000);

setInterval(()=>{
  if(typeof refreshLiveEdge==='function' && DATA_REAL_READY && !document.hidden){
    refreshLiveEdge();
  }
},5000);

setInterval(()=>{
  if(document.hidden) return;
  if(typeof authUser==='function' && authUser() && typeof adminWrite==='function'){
    adminWrite('heartbeat_online',{}).catch(()=>{});
  }else if(typeof publicHeartbeatOnline==='function'){
    publicHeartbeatOnline().catch(()=>{});
  }
},60000);
