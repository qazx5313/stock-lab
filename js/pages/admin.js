/* Page module: admin.js */

function vAdmin(){
  if(!isAdmin()){
    return `<div class="fade account-grid">
      <div class="card card-pad auth-panel">
        <h3 style="font-size:18px;margin-bottom:10px">需要管理員登入</h3>
        <div class="muted" style="font-size:13.5px;line-height:1.7">後台管理、板塊開通設定與使用天數設定只開放管理員帳號操作。</div>
      </div>
      <div class="card card-pad">
        <h3 style="font-size:18px;margin-bottom:12px">管理員登入</h3>
        <div class="form-grid">
          <div class="field"><label>帳號</label><input id="loginAccount" autocomplete="username" placeholder="輸入管理員帳號"></div>
          <div class="field"><label>密碼</label><input id="loginPassword" type="password" autocomplete="current-password" placeholder="輸入管理員密碼"></div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn" id="loginBtn">登入後台</button>
            <span id="loginMsg" class="muted" style="font-size:13px"></span>
          </div>
        </div>
      </div>
    </div>`;
  }
  const online=DATA.onlineStats||{members:DATA.onlineCount||0,guests:0,total:DATA.onlineCount||0};
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad" style="background:var(--accent-soft);border-color:var(--accent)">
     <b style="font-size:13.5px">📌 說明</b>
     <div style="font-size:13px;color:var(--ink-2);margin-top:6px;line-height:1.6">
       股票、題材、AI 資料皆由系統每日盤後自動抓取與計算維護，此處為檢視。
       「開通設定」可設定板塊是否開通與使用天數。</div>
   </div>
   <div class="admin-online-grid">
     <div class="mini-tile cool"><span>目前在線總數</span><b>${online.total||0}</b><small>最近 5 分鐘內有活動</small></div>
     <div class="mini-tile success"><span>線上會員</span><b>${online.members||0}</b><small>已登入帳號</small></div>
     <div class="mini-tile"><span>未登入遊客</span><b>${online.guests||0}</b><small>匿名瀏覽者</small></div>
   </div>
   <div class="seg" style="flex-wrap:wrap" id="admSeg">
     ${[
       ['開通設定',4],['維修狀態',5],['觀察報告',6],['股票資料',0],['題材分類',1],['篩選參數',2],['每日報告',3],['AI 機器人',7]
     ].map((r,i)=>`<button class="${i===0?'on':''}" data-tab="${r[1]}">${r[0]}</button>`).join('')}
   </div>
   <div id="admBody"></div>
  </div>`;
}
function admBody(i){
  const b=document.getElementById('admBody');if(!b)return;
  if(i===0){b.innerHTML=`<div class="card"><div class="card-h"><h3>股票資料管理</h3><button class="btn sm" id="addStockBtn" style="margin-left:auto">+ 新增股票</button></div>
    <div id="adminEditor"></div>
    <div class="tbl-wrap"><table><thead><tr><th>代號</th><th>名稱</th><th>市場</th><th>傳統產業</th><th>題材分類</th><th>龍頭</th><th>觀察</th><th>操作</th></tr></thead><tbody>
    ${DATA.adminStocks.map(s=>`<tr><td class="code">${s.c}</td><td><b>${s.n}</b></td><td>${s.m}</td><td class="muted">${s.ind}</td>
      <td><span class="badge">${s.th}</span></td><td>${s.lead?'<span class="badge hot">龍頭</span>':'—'}</td>
      <td>${s.obs?'<span class="badge warm">觀察</span>':'—'}</td>
      <td><button class="btn line sm" data-stock-edit="${s.c}">編輯</button></td></tr>`).join('')}</tbody></table></div></div>`;}
  else if(i===1){b.innerHTML=`<div class="card"><div class="card-h"><h3>題材分類管理</h3><button class="btn sm" id="addThemeBtn" style="margin-left:auto">+ 新增題材</button></div>
    <div id="adminEditor"></div>
    <div class="tbl-wrap"><table><thead><tr><th>題材名稱</th><th>說明</th><th>產業鏈位置</th><th>相關股票數</th><th>操作</th></tr></thead><tbody>
    ${DATA.themes.map(t=>`<tr><td><b>${t.name}</b></td><td class="muted" style="white-space:normal;min-width:260px">${t.desc}</td>
      <td>${t.chain}</td><td class="num">${Array.isArray(t.stocks)?t.stocks.length:'—'}</td><td><button class="btn line sm" data-theme-edit="${t.id}">編輯產業鏈</button></td></tr>`).join('')}</tbody></table></div></div>`;}
  else if(i===2){
    const P=DATA.appSettings||{};
    const fields=[
      ['成交量門檻（張）','vol_threshold',P.vol_threshold||'3000'],
      ['股價門檻','price_threshold',P.price_threshold||'20'],
      ['RSI 門檻','rsi_threshold',P.rsi_threshold||'50'],
      ['法人買超天數','inst_buy_days',P.inst_buy_days||'3'],
      ['題材熱度權重','heat_weight',P.heat_weight||'技術35 籌碼30 題材35']];
    b.innerHTML=`<div class="card card-pad"><h3 style="margin-bottom:16px">篩選參數管理</h3>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">
      ${fields.map(r=>`<div><label style="font-size:12px;color:var(--ink-2);font-weight:600">${r[0]}</label>
        <input id="set_${r[1]}" value="${r[2]}" style="width:100%;margin-top:6px;padding:9px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--mono);font-size:13px;outline:none"></div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:18px">
        <button class="btn" id="saveSetBtn">儲存設定</button>
        <span id="saveSetMsg" style="font-size:13px;color:var(--ink-2)"></span>
      </div>
      <div style="font-size:12px;color:var(--ink-3);margin-top:10px">儲存後於下次盤後計算生效。MA/KD/MACD 為標準參數，固定不開放調整。</div>
    </div>`;
    const keys=fields.map(f=>f[1]);
    const btn=document.getElementById('saveSetBtn');
    if(btn)btn.onclick=async()=>{
      btn.disabled=true;btn.textContent='儲存中…';
      const msg=document.getElementById('saveSetMsg');
      try{
        const rows=keys.map(k=>({key:k,value:(document.getElementById('set_'+k)||{}).value||'',updated_at:new Date().toISOString()}));
        const r=await fetch(`${SB_URL}/rest/v1/app_settings?on_conflict=key`,{
          method:'POST',
          headers:{apikey:SB_ANON,Authorization:`Bearer ${SB_ANON}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify(rows)});
        if(r.ok){
          DATA.appSettings=DATA.appSettings||{};rows.forEach(x=>DATA.appSettings[x.key]=x.value);
          if(msg){msg.textContent='✅ 已儲存（下次盤後計算生效）';msg.style.color='var(--up)';}
        }else{
          const t=await r.text().catch(()=> '');
          if(msg){msg.textContent='⚠️ 儲存失敗 '+r.status+'（請先在 Supabase 建 app_settings 表）';msg.style.color='#92400E';}
        }
      }catch(e){
        if(msg){msg.textContent='⚠️ 儲存失敗：'+(e&&e.message||e);msg.style.color='#92400E';}
      }
      btn.disabled=false;btn.textContent='儲存設定';
    };
  }
  else if(i===3){const draft=reportDraft();b.innerHTML=`<div class="card card-pad"><h3 style="margin-bottom:14px">每日報告管理</h3>
    <div style="display:flex;flex-direction:column;gap:11px">
    ${[['自動產出報告','已啟用 · 依 Supabase 當日資料即時組成'],['資料來源',SRC_STATUS],['發布狀態','前台即時顯示，管理員備註可儲存'],['風險提醒','目前讀取系統風險清單，後續可擴充手動風險表']].map(r=>
      `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-soft)">
      <b style="font-size:13.5px;width:160px">${r[0]}</b><span class="muted" style="flex:1">${r[1]}</span>
      <button class="btn line sm" data-report-view="${r[0]}">檢視</button></div>`).join('')}
      <div id="reportEditBox" class="card-pad" style="margin-top:8px;border:1px solid var(--border);border-radius:10px;background:#fff">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><b>報告內容編輯</b><span class="tag">會覆蓋前台每日報告顯示</span></div>
        <div class="field">
          <label>報告文字內容</label>
          <textarea id="reportContentInput" style="width:100%;min-height:240px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--sans);font-size:13.5px;outline:none">${esc(draft.content||defaultReportText())}</textarea>
        </div>
        <div class="field" style="margin-top:12px">
          <label>推薦股票，每行：代號,名稱,題材,分數,理由</label>
          <textarea id="reportPicksInput" style="width:100%;min-height:120px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--mono);font-size:13px;outline:none">${esc(draft.picks||defaultReportPicksText())}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px">
        <button class="btn" id="saveReportNoteBtn">儲存報告內容</button>
        <button class="btn line sm" id="previewReportBtn">前台預覽</button>
        <button class="btn line sm" id="regenReportBtn">重新產生報告</button>
        <span id="reportMsg" class="muted" style="font-size:13px"></span>
      </div>
    </div></div>`;}
  else if(i===4){
    const members=users().filter(u=>u.role!=='admin');
    const selected=(localStorage.getItem('stockLabAdminMember')||members[0]?.account||'');
    const acts=selected?memberEntitlements(selected):manageableActivationSettings().map(a=>({...a,enabled:false,days:0}));
    b.innerHTML=`<div class="card">
      <div class="card-h"><h3>會員與開通設定</h3><span class="tag">新增 / 刪除帳號 · 板塊開通天數</span></div>
      <div class="card-pad" style="border-bottom:1px solid var(--border-soft);background:var(--blue-tint)">
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">
          <div class="field"><label>新增帳號 Email</label><input id="newUserAccount" placeholder="user@example.com"></div>
          <div class="field"><label>密碼</label><input id="newUserPassword" type="password" placeholder="至少 6 碼"></div>
          <div class="field"><label>暱稱</label><input id="newUserNick" placeholder="會員暱稱"></div>
          <div class="field"><label>角色</label><select id="newUserRole"><option value="user">一般會員</option><option value="admin">管理員</option></select></div>
          <button class="btn" id="createUserBtn">新增帳號</button>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px">
          <button class="btn line sm" id="deleteUserBtn" ${selected?'':'disabled'}>刪除目前選定帳號</button>
          <span id="userManageMsg" class="muted" style="font-size:13px"></span>
        </div>
      </div>
      <div class="card-pad" style="border-bottom:1px solid var(--border-soft)">
        <div class="grid" style="grid-template-columns:minmax(220px,1fr) 160px auto;align-items:end">
          <div class="field"><label>選擇會員</label>
            <select id="memberSelect">
              ${members.length?members.map(u=>`<option value="${u.account}" ${u.account===selected?'selected':''}>${u.nick}（${u.account}）</option>`).join(''):'<option value="">尚無會員</option>'}
            </select>
          </div>
          <div class="field"><label>全部板塊天數</label><input id="allDaysInput" type="number" min="1" max="3650" value="30"></div>
          <button class="btn" id="openAllBtn" ${selected?'':'disabled'}>全部開通</button>
        </div>
      </div>
      <div class="card-pad activation-grid">
        ${acts.map(a=>`<div class="activation-card" data-act="${a.id}">
          <div class="toggle-row">
            <div><b>${a.name}</b><div class="muted" style="font-size:12px;margin-top:2px">${a.id}</div></div>
            <button class="toggle ${a.enabled?'on':''}" data-act-toggle="${a.id}" aria-label="切換 ${a.name}"></button>
          </div>
          <div class="field" style="margin-top:12px">
            <label>使用天數設定</label>
            <input id="act_days_${a.id}" type="number" min="1" max="3650" value="${a.days}">
          </div>
        </div>`).join('')}
      </div>
      <div class="card-pad" style="border-top:1px solid var(--border-soft);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn" id="saveActivationBtn" ${selected?'':'disabled'}>儲存此會員設定</button>
        <span id="activationMsg" class="muted" style="font-size:13px"></span>
      </div>
    </div>`;}
  else if(i===5){
    const rows=maintenanceSettings();
    b.innerHTML=`<div class="card">
      <div class="card-h"><h3>板塊維修狀態</h3><span class="tag">管理員仍可進入測試，一般會員會看到維修中</span></div>
      <div class="card-pad activation-grid">
        ${rows.map(a=>`<div class="activation-card" data-maint="${a.id}">
          <div class="toggle-row">
            <div><b>${a.name}</b><div class="muted" style="font-size:12px;margin-top:2px">${a.id}</div></div>
            <button class="toggle ${a.maintenance?'on':''}" data-maint-toggle="${a.id}" aria-label="切換 ${a.name} 維修狀態"></button>
          </div>
          <div class="field" style="margin-top:12px">
            <label>會員看到的提示</label>
            <input id="maint_msg_${a.id}" value="${esc(a.message||'此板塊正在維修更新，完成後會重新開放。')}">
          </div>
          <div class="muted" style="font-size:12px;margin-top:8px">${a.maintenance?'目前：維修中':'目前：開放'}</div>
        </div>`).join('')}
      </div>
      <div class="card-pad" style="border-top:1px solid var(--border-soft);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn" id="saveMaintenanceBtn">儲存維修狀態</button>
        <span id="maintenanceMsg" class="muted" style="font-size:13px"></span>
      </div>
    </div>`;
  }
  else if(i===6){
    const txt=(DATA.observations||[]).map(r=>`${r.symbol||r.c},${r.name||''},${r.category||'觀察'},${r.note||''}`).join('\n');
    b.innerHTML=`<div class="card">
      <div class="card-h"><h3>觀察報告管理</h3><span class="tag">每行：代號,名稱,分類,觀察原因</span></div>
      <div class="card-pad">
        <textarea id="observeInput" style="width:100%;min-height:220px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--mono);font-size:13px;outline:none" placeholder="2330,台積電,觀察,站上月線且法人回補">${esc(txt)}</textarea>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
          <button class="btn" id="saveObserveBtn">儲存觀察報告</button>
          <span id="observeMsg" class="muted" style="font-size:13px"></span>
        </div>
      </div>
    </div>`;
  }
  else{b.innerHTML=`<div class="card"><div class="card-h"><h3>AI 機器人管理</h3></div>
    <div class="tbl-wrap"><table><thead><tr><th>AI 名稱</th><th>策略</th><th>初始資金</th><th>持股上限</th><th>單檔上限</th><th>停損</th><th>停利</th><th>版本</th><th>啟用</th></tr></thead><tbody>
    ${DATA.agents.map(a=>`<tr><td><b>${a.name}</b></td><td class="muted">${a.type}</td>
      <td class="num">${a.init.toLocaleString()}</td><td class="num r">8 檔</td><td class="num r">15%</td>
      <td class="num r down">-8%</td><td class="num r up">+15%</td><td><span class="badge">${a.ver}</span></td>
      <td><span class="badge good">啟用</span></td></tr>`).join('')}</tbody></table></div></div>`;}
}

function stockAdminForm(s={}){
  return `<div class="card-pad" style="border-bottom:1px solid var(--border-soft);background:var(--blue-tint)">
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
      <div class="field"><label>股票代號</label><input id="admStockSymbol" value="${esc(s.c||'')}" placeholder="2330"></div>
      <div class="field"><label>名稱</label><input id="admStockName" value="${esc(s.n||'')}" placeholder="台積電"></div>
      <div class="field"><label>市場</label><select id="admStockMarket"><option ${s.m==='上市'?'selected':''}>上市</option><option ${s.m==='上櫃'?'selected':''}>上櫃</option><option ${s.m==='TWSE'?'selected':''}>TWSE</option><option ${s.m==='TPEX'?'selected':''}>TPEX</option></select></div>
      <div class="field"><label>傳統產業</label><input id="admStockIndustry" value="${esc(s.ind||'')}" placeholder="半導體"></div>
      <div class="field"><label>題材分類</label><input id="admStockTheme" value="${esc(s.th||'')}" placeholder="AI 伺服器"></div>
      <div class="field"><label>標記</label><div style="display:flex;gap:12px;align-items:center;height:38px"><label><input id="admStockLead" type="checkbox" ${s.lead?'checked':''}> 龍頭</label><label><input id="admStockObs" type="checkbox" ${s.obs?'checked':''}> 觀察</label></div></div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap">
      <button class="btn" id="saveStockBtn">儲存股票</button>
      <button class="btn line sm" id="cancelAdminEditBtn">取消</button>
      <span id="adminEditMsg" class="muted" style="font-size:13px"></span>
    </div>
  </div>`;
}
function themeAdminForm(t={}){
  const stockLines=(t.stocks||[]).map(s=>`${s.c},${s.role||'成分'},${s.level||''},${s.score||80}`).join('\n');
  return `<div class="card-pad" style="border-bottom:1px solid var(--border-soft);background:var(--blue-tint)">
    <input id="admThemeLocalId" type="hidden" value="${esc(t.id||'')}">
    <input id="admThemeDbId" type="hidden" value="${esc(t.themeId||'')}">
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      <div class="field"><label>題材名稱</label><input id="admThemeName" value="${esc(t.name||'')}" placeholder="AI 伺服器"></div>
      <div class="field"><label>熱度分數</label><input id="admThemeScore" type="number" min="0" max="100" value="${esc(t.score||70)}"></div>
      <div class="field"><label>狀態</label><input id="admThemeStatus" value="${esc(t.status||'觀察')}" placeholder="主流 / 觀察"></div>
      <div class="field"><label>產業鏈位置</label><input id="admThemeChain" value="${esc(t.chain||'')}" placeholder="上游 / 中游 / 下游"></div>
    </div>
    <div class="field" style="margin-top:12px"><label>說明</label><input id="admThemeDesc" value="${esc(t.desc||'')}" placeholder="題材說明"></div>
    <div class="field" style="margin-top:12px"><label>相關股票，每行：代號,角色,產業鏈位置,關聯分</label>
      <textarea id="admThemeStocks" style="width:100%;min-height:120px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;font-family:var(--mono);font-size:13px;outline:none">${esc(stockLines)}</textarea>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap">
      <button class="btn" id="saveThemeBtn">儲存題材</button>
      <button class="btn line sm" id="cancelAdminEditBtn">取消</button>
      <span id="adminEditMsg" class="muted" style="font-size:13px"></span>
    </div>
  </div>`;
}

/* ============ 8. 資料更新狀態 ============ */

