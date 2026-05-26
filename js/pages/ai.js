/* Page module: ai.js */

function vAI(){
  if(AI_VIEW) return vAIDetail(AI_VIEW);
  return `<div class="fade workspace-page">
   <div class="workspace-hero">
     <div class="workspace-icon">
       <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>
     </div>
     <div>
       <div class="workspace-kicker">Quant Lab</div>
       <div class="workspace-title">AI 量化模擬操盤實驗室</div>
       <div class="workspace-sub">從資料準備到策略升版，AI 驅動全流程策略研究與模擬驗證。</div>
     </div>
     <div class="workspace-actions"><span class="pill">最新更新：${esc(DATA.meta.updated||'—')}</span></div>
   </div>

   <div class="strategy-toolbar">
     ${['主系統盤後資料','每日篩選候選池','3 AI 各自選股','主庫歷史回測','FinMind 詳細分析','AI 綜合評分','模擬買進','持股追蹤','多 AI 檢討','策略升版'].map((s,i,a)=>
       `<span class="strategy-step"><b>${i+1}</b>${s}</span>${i<a.length-1?'<span style="display:flex;align-items:center;color:var(--ink-3)">›</span>':''}`).join('')}
   </div>

   <div class="strategy-grid stagger">
   ${DATA.agents.map((a,idx)=>`<div class="strategy-card" style="cursor:pointer;transition:.15s" data-ai="${a.id}" onmouseover="this.style.boxShadow='var(--shadow-lg)'" onmouseout="this.style.boxShadow='var(--shadow)'">
     <div class="strategy-card-head">
       <div class="strategy-icon">${idx===2?'KC':idx===3?'MA':'AI'}</div>
       <div style="min-width:0;flex:1">
       <div style="display:flex;align-items:center;gap:10px"><h3>${a.name}</h3>
       <span class="badge ${a.status==='運行中'?'cool':'obs'}" style="margin-left:auto">${a.status}</span></div>
       <div style="font-size:12px;color:var(--ink-3);margin-top:3px">${a.type} · 策略 ${a.ver}</div>
       <p>${a.desc}</p>
       </div>
     </div>
     <div class="strategy-stats">
       ${[['今日初篩',a.pre+' 檔'],['回測通過',a.passed+' 檔'],['今日模擬買進',a.buy+' 檔'],['回測平均勝率',a.wr],
          ['累積報酬率',a.cum,'up'],['本月報酬',a.mon,'up'],['勝率',a.win],['最大回撤',a.mdd,'down']].map((r,i)=>
         `<div class="strategy-stat"><span>${r[0]}</span><b class="num ${r[2]||''}">${r[1]}</b></div>`).join('')}
     </div>
     <div class="card-pad" style="display:flex;align-items:center;gap:10px"><button class="btn line sm">查看 AI 詳細</button><button class="btn sm">模擬進場</button>
       <span class="more" style="margin-left:auto;font-size:12px;color:var(--ink-2)">持股 ${a.pos} 檔</span></div>
   </div>`).join('')}
   </div>
   <div class="card card-pad" style="background:var(--blue-tint);border-color:var(--blue-soft);font-size:13px;color:var(--ink-2)">提示：所有策略回測與模擬交易結果僅供參考，請搭配風險控管機制使用。</div>
  </div>`;
}

async function loadAIDetailData(agentKey){
  const a=DATA.agents.find(x=>x.id===agentKey)||DATA.agents[0];
  if(!a || !a._id) return;
  const aid=a._id;
  try{
    const dateHint=String((DATA.meta&&DATA.meta.date)||'').replaceAll('/','-').slice(0,10);
    const candidateDateFilter=dateHint?`&date=eq.${encodeURIComponent(dateHint)}`:'';
    const [cs,bk,ps,tb,dp]=await Promise.all([
      sbGet(
        `ai_candidates?select=symbol,date,agent_reason,accepted_by_agent&agent_id=eq.${aid}${candidateDateFilter}&order=id.desc`,200
      ),
      sbGet(
        `ai_backtests?select=symbol,matched_conditions,sample_count,win_rate,avg_return_5d,avg_return_3d,avg_return_10d,max_drawdown,profit_factor,passed&agent_id=eq.${aid}&order=id.desc`,200
      ),
      sbGet(
        `ai_positions?select=symbol,name,buy_date,buy_price,current_price,quantity,buy_reason,status&agent_id=eq.${aid}&status=eq.持有`,200
      ),
      sbGet(
        `ai_trades?select=trade_date,symbol,price,quantity,amount,reason,trade_type&agent_id=eq.${aid}&order=id.desc`,200
      ),
      sbGet(
        `ai_deep_analysis?select=symbol,technical_summary,chip_summary,fundamental_summary,risk_summary,final_score,decision,decision_reason&agent_id=eq.${aid}&order=id.desc`,80
      )
    ]);
    const syms=[...new Set([
      ...(Array.isArray(cs)?cs.map(x=>x.symbol):[]),
      ...(Array.isArray(bk)?bk.map(x=>x.symbol):[]),
      ...(Array.isArray(ps)?ps.map(x=>x.symbol):[]),
      ...(Array.isArray(tb)?tb.map(x=>x.symbol):[]),
      ...(Array.isArray(dp)?dp.map(x=>x.symbol):[])
    ].map(x=>String(x||'').trim()).filter(Boolean))];
    const nm=await loadNameMap(syms,dateHint);
    const nameOf=(sym, fallback='')=>{
      const s=String(sym||'').trim();
      const n=String(((nm[s]||{}).name)||fallback||'').trim();
      return n && n!==s && n!=='尚無名稱' ? n : s;
    };
    const latestPriceMap=(syms.length && typeof loadLatestPriceMap==='function')
      ? await loadLatestPriceMap(syms,dateHint).catch(()=>({}))
      : {};
    const latestPriceRows=syms.length?await sbGet(
      `daily_prices?select=symbol,date,close&symbol=in.(${syms.join(',')})&order=date.desc&limit=2000`,2000
    ).catch(()=>[]): [];
    const prevCloseBySymbol={};
    (latestPriceRows||[]).forEach(r=>{
      const sym=String(r.symbol||'').trim();
      if(!sym) return;
      (prevCloseBySymbol[sym]=prevCloseBySymbol[sym]||[]).push(r);
    });
    const parseTradeState=reason=>{
      const m=String(reason||'').match(/STATE=(\{.*\})/);
      if(!m) return {};
      try{return JSON.parse(m[1]);}catch(_){return {};}
    };
    const cleanReason=reason=>String(reason||'—').replace(/\s*STATE=\{.*\}\s*$/,'').trim()||'—';
    const fmtDate=d=>String(d||'').slice(5).replace('-','/')||'—';
    const latestQuoteOf=(sym, fallbackPrice)=>{
      const s=String(sym||'').trim();
      const q=latestPriceMap[s] || (DATA.priceMap&&DATA.priceMap[s]) || (DATA.realtimeMap&&DATA.realtimeMap[s]) || {};
      const px=[q.close,q.price,fallbackPrice].map(Number).find(v=>Number.isFinite(v)&&v>0);
      return {
        px:Number.isFinite(px)?px:Number(fallbackPrice),
        chg:Number(q.change),
        dp:Number(q.change_percent),
        date:String(q.date||q.quote_date||'').slice(0,10),
        source:q.source||''
      };
    };
    const trades=Array.isArray(tb)?tb:[];
    const buyBySymbol={};
    trades.slice().sort((a,b)=>String(a.trade_date).localeCompare(String(b.trade_date))).forEach(t=>{
      const sym=String(t.symbol||'').trim();
      if(!sym) return;
      if(t.trade_type==='買進'){
        (buyBySymbol[sym]=buyBySymbol[sym]||[]).push(t);
      }
    });
    DATA.aiCand=(Array.isArray(cs)?cs:[]).filter(c=>c.accepted_by_agent).slice(0,20).map(c=>({
      c:c.symbol, n:nameOf(c.symbol), src:'候選池', reason:cleanReason(c.agent_reason), score:'—'}));
    DATA.aiBack=(Array.isArray(bk)?bk:[]).slice(0,30).map(b=>({
      c:b.symbol, n:nameOf(b.symbol), cond:cleanReason(b.matched_conditions),
      s:b.sample_count, wr:b.win_rate+'%', ar:(b.avg_return_5d>0?'+':'')+b.avg_return_5d+'%',
      r3:(b.avg_return_3d>0?'+':'')+b.avg_return_3d+'%',
      r5:(b.avg_return_5d>0?'+':'')+b.avg_return_5d+'%',
      r10:(b.avg_return_10d>0?'+':'')+b.avg_return_10d+'%',
      mdd:b.max_drawdown+'%', pf:String(b.profit_factor),
      res:b.passed?'通過':'不通過'}));
    DATA.aiPos=(Array.isArray(ps)?ps:[]).map(p=>{
      const sym=String(p.symbol||'').trim();
      const latest=latestQuoteOf(sym,p.current_price);
      const cp=Number.isFinite(Number(latest.px))?Number(latest.px):Number(p.current_price);
      return {
        c:sym, n:nameOf(sym,p.name), bp:Number(p.buy_price), cp,
        q:Number(p.quantity)||0, bd:fmtDate(p.buy_date),
        prev:(prevCloseBySymbol[sym]||[]).find(x=>Number(x.close)!==cp)?.close,
        chg:latest.chg, dp:latest.dp, quoteDate:latest.date, quoteSource:latest.source,
        reason:cleanReason(p.buy_reason)
      };
    });
    const latestAiDate=String((DATA.meta&&DATA.meta.date)||'').replaceAll('/','-').slice(0,10);
    DATA.aiBuy=trades.filter(t=>
      t.trade_type==='買進' &&
      (!latestAiDate || String(t.trade_date||'').slice(0,10)===latestAiDate)
    ).slice(0,20).map(t=>({
      d:fmtDate(t.trade_date), c:t.symbol, n:nameOf(t.symbol),
      p:Number(t.price), q:Number(t.quantity)||0, s:'—', reason:cleanReason(t.reason)}));
    DATA.aiSell=trades.filter(t=>t.trade_type==='賣出').map(t=>{
      const st=parseTradeState(t.reason);
      const sym=String(t.symbol||'').trim();
      const sellDate=String(t.trade_date||'').slice(0,10);
      const prior=(buyBySymbol[sym]||[]).filter(b=>String(b.trade_date||'').slice(0,10)<=sellDate).slice(-1)[0]||{};
      const buyPrice=Number(st.buy_price||prior.price)||0;
      const sellPrice=Number(st.sell_price||t.price)||0;
      const qty=Number(t.quantity||prior.quantity)||0;
      const pnl=Number.isFinite(Number(st.pnl))?Number(st.pnl):((sellPrice-buyPrice)*qty*1000);
      const ret=Number.isFinite(Number(st.return_pct))?Number(st.return_pct):(buyPrice?((sellPrice-buyPrice)/buyPrice*100):NaN);
      return {
        bd:fmtDate(st.buy_date||prior.trade_date),
        d:fmtDate(st.sell_date||t.trade_date),
        c:t.symbol, n:nameOf(t.symbol), bp:buyPrice, p:sellPrice,
        pnl:Number.isFinite(pnl)?sgn(Math.round(pnl).toLocaleString()):'—',
        ret:Number.isFinite(ret)?sgn(ret.toFixed(2))+'%':'—',
        reason:cleanReason(t.reason), early:'—', late:'—'
      };
    }).filter(s=>s.bd==='—' || s.bd!==s.d).slice(0,20);
    DATA.aiDeep=(Array.isArray(dp)?dp:[]).slice(0,8).map(d=>({
      c:d.symbol, n:nameOf(d.symbol), score:d.final_score||'—', decision:d.decision||'—',
      tech:d.technical_summary||'—', chip:d.chip_summary||'—',
      fund:d.fundamental_summary||'—', risk:d.risk_summary||'—',
      reason:cleanReason(d.decision_reason)
    }));
    const rv=await sbGet(
      `ai_reviews?select=review_date,self_review,improvement_suggestion&agent_id=eq.${aid}&order=id.desc`,20);
    DATA.aiReview=(Array.isArray(rv)?rv:[]).slice(0,8).map(r=>({
      q:String(r.review_date).slice(0,10), a:(r.improvement_suggestion||r.self_review||'—')}));
    const vv=await sbGet(
      `ai_strategy_versions?select=version,created_at,reason,old_rules,new_rules,change_summary&agent_id=eq.${aid}&order=id.desc`,20);
    DATA.aiVer=(Array.isArray(vv)?vv:[]).slice(0,10).map(v=>({
      v:v.version||'—', d:String(v.created_at||'').slice(0,10),
      reason:v.reason||'—', old:v.old_rules||'—', new:v.new_rules||'—',
      perf:v.change_summary||'—'}));
  }catch(e){ console.warn('AI 明細載入略過:',e); }
}

function vAIDetail(id){
  const a=DATA.agents.find(x=>x.id===id);
  const latestAiDate=String((DATA.meta&&DATA.meta.date)||'').replaceAll('/','-').slice(0,10);
  const aiHoldValue=(DATA.aiPos||[]).reduce((sum,p)=>sum+(Number(p.cp)||0)*(Number(p.q)||0)*1000,0);
  const holdValue=Number.isFinite(aiHoldValue)&&aiHoldValue>0?Math.round(aiHoldValue):a.hold;
  const assetValue=Number(a.cash||0)+Number(holdValue||0);
  const retPct=Number(a.init)?((assetValue-Number(a.init))/Number(a.init)*100):NaN;
  const blk=(title,sub,body)=>`<div class="card"><div class="card-h"><h3>${title}</h3>${sub?`<span class="tag">${sub}</span>`:''}</div>${body}</div>`;
  const tbl=(head,rows)=>`<div class="tbl-wrap"><table><thead><tr>${head.map(h=>`<th class="${h[1]||''}">${h[0]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  const deepRows=(DATA.aiDeep&&DATA.aiDeep.length)?DATA.aiDeep:[];
  const deepBody=deepRows.length
    ? `<div class="card-pad" style="display:flex;flex-direction:column;gap:14px">
        ${deepRows.map(d=>`<div style="border:1px solid var(--border-soft);border-radius:10px;padding:14px 16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
            <b class="code">${d.c}</b><b>${d.n}</b>
            <span class="badge ${d.decision==='買進'?'good':'obs'}">${d.decision}</span>
            <span class="badge hot">AI 最終評分 ${d.score}</span>
          </div>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
            ${[
              ['技術摘要',d.tech],
              ['籌碼摘要',d.chip],
              ['基本面摘要',d.fund],
              ['風險摘要',d.risk],
              ['決策原因',d.reason]
            ].map(r=>`<div style="background:var(--blue-tint);border:1px solid var(--blue-soft);border-radius:10px;padding:12px 14px">
              <div style="font-size:11px;color:var(--primary);font-weight:700">${r[0]}</div>
              <div style="font-size:13px;font-weight:600;margin-top:4px;line-height:1.45">${r[1]}</div></div>`).join('')}
          </div>
        </div>`).join('')}
      </div>`
    : `<div class="card-pad muted">目前沒有 AI 詳細分析資料；請先跑 GitHub Actions 的 AI 實驗室排程。</div>`;
  return `<div class="fade" style="display:flex;flex-direction:column;gap:16px">
   <button class="btn line sm" data-aiback style="align-self:flex-start">‹ 返回 AI 列表</button>

   ${blk('1 · AI 投資人概況','',`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));padding:18px 20px;gap:18px">
     ${[['AI 名稱',a.name],['策略類型',a.type],['交易週期','短中波段'],['初始資金','NT$ '+a.init.toLocaleString()],
        ['目前資產','NT$ '+assetValue.toLocaleString(),'up'],['現金','NT$ '+a.cash.toLocaleString()],
        ['持股市值','NT$ '+holdValue.toLocaleString()],['累積報酬率',Number.isFinite(retPct)?sgn(retPct.toFixed(1))+'%':a.cum,'up'],['最大回撤',a.mdd,'down'],
        ['策略版本',a.ver],['目前狀態',a.status]].map(r=>
       `<div class="stat"><span class="k">${r[0]}</span><span class="v ${r[2]||''}" style="font-size:16px">${r[1]}</span></div>`).join('')}</div>`)}

   ${blk('2 · 目前持有股票','放在上方方便快速檢查',tbl(
     [['代號'],['名稱'],['買進日'],['買進價','r'],['現價','r'],['張數','r'],['持股市值','r'],['今日損益','r'],['未實現損益','r'],['報酬率','r']],
     DATA.aiPos.map(p=>{const pnl=(p.cp-p.bp)*p.q*1000;const ret=((p.cp-p.bp)/p.bp*100);const isTodayBuy=latestAiDate&&String(p.bd||'').replace('/','-')===latestAiDate.slice(5);const td=isTodayBuy?pnl:(Number.isFinite(Number(p.chg))?Number(p.chg)*p.q*1000:(Number(p.prev)?(p.cp-Number(p.prev))*p.q*1000:NaN));
       return `<tr data-live-row="${esc(p.c)}"><td class="code">${p.c}</td><td><b>${p.n}</b></td><td class="code">${p.bd}</td><td class="r num">${fmtPx(p.bp)}</td>
       <td class="r num" data-live-cell="px">${fmtPx(p.cp)}</td><td class="r num">${p.q}</td><td class="r num">${(p.cp*p.q*1000).toLocaleString()}</td>
       <td class="r num ${td>=0?'up':'down'}">${Number.isFinite(td)?sgn(Math.round(td).toLocaleString()):'—'}</td>
       <td class="r num ${pnl>=0?'up':'down'}">${sgn(Math.round(pnl).toLocaleString())}</td>
       <td class="r num ${ret>=0?'up':'down'}">${sgn(ret.toFixed(1))}%</td></tr>`;}).join('')))}

   <div class="grid" style="grid-template-columns:1fr 1fr">
     ${blk('3 · 今日買進紀錄','只顯示最新交易日真的進場，不顯示回測延續舊訊號',tbl([['日期'],['股票'],['價格','r'],['張','r'],['分','r'],['原因']],
       DATA.aiBuy.map(b=>`<tr><td class="code">${b.d}</td><td><b class="code">${b.c}</b> ${b.n}</td>
       <td class="r num">${fmtPx(b.p)}</td><td class="r num">${b.q}</td><td class="r num">${b.s}</td>
       <td class="muted" style="white-space:normal;min-width:120px">${b.reason}</td></tr>`).join('')))}
     ${blk('4 · 賣出紀錄','',tbl([['買進日'],['賣出日'],['股票'],['買進價','r'],['賣出價','r'],['損益','r'],['報酬','r'],['檢討']],
       DATA.aiSell.map(s=>`<tr><td class="code">${s.bd}</td><td class="code">${s.d}</td><td><b class="code">${s.c}</b> ${s.n}</td>
       <td class="r num">${fmtPx(s.bp)}</td><td class="r num">${fmtPx(s.p)}</td><td class="r num ${s.pnl.includes('-')?'down':'up'}">${s.pnl}</td>
       <td class="r num ${s.ret.includes('-')?'down':'up'}">${s.ret}</td>
       <td class="muted" style="white-space:normal">${s.reason}（賣早:${s.early}/賣晚:${s.late}）</td></tr>`).join('')))}
   </div>

   ${blk('5 · 候選股票來源','從各板塊取得候選股',tbl(
     [['代號'],['名稱'],['來源板塊'],['候選原因'],['初篩分','r']],
     DATA.aiCand.map(c=>`<tr><td class="code lnk" data-stock="${c.c}">${c.c}</td><td><b>${c.n}</b></td>
       <td><span class="badge obs">${c.src}</span></td><td class="muted" style="white-space:normal;min-width:200px">${c.reason}</td>
       <td class="r"><b class="num" style="color:var(--primary)">${c.score}</b></td></tr>`).join('')))}

   ${blk('6 · 歷史回測區','使用主系統資料庫回測',tbl(
     [['代號'],['名稱'],['相似條件'],['樣本','r'],['勝率','r'],['平均報酬','r'],['3日','r'],['5日','r'],['10日','r'],['最大回撤','r'],['盈虧比','r'],['結果']],
     DATA.aiBack.map(b=>`<tr><td class="code">${b.c}</td><td><b>${b.n}</b></td>
       <td class="muted" style="white-space:normal;min-width:160px">${b.cond}</td><td class="r num">${b.s}</td>
       <td class="r num">${b.wr}</td><td class="r num up">${b.ar}</td><td class="r num up">${b.r3}</td><td class="r num up">${b.r5}</td>
       <td class="r num ${b.r10.includes('-')?'down':'up'}">${b.r10}</td><td class="r num down">${b.mdd}</td><td class="r num">${b.pf}</td>
       <td><span class="badge ${b.res==='通過'?'good':b.res==='不通過'?'bad':'obs'}">${b.res}</span></td></tr>`).join('')))}

   ${blk('7 · AI 詳細分析區','僅回測通過股票進入此區',deepBody)}

   ${blk('8 · AI 自我檢討區','每次交易結束後自動產生',`<div class="card-pad" style="display:flex;flex-direction:column;gap:9px">
     ${DATA.aiReview.map(r=>`<div style="display:flex;gap:14px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border-soft)">
       <div style="width:140px;flex-shrink:0;font-size:12.5px;color:var(--ink-2);font-weight:700">${r.q}</div>
       <div style="font-size:13px">${r.a}</div></div>`).join('')}</div>`)}

   ${blk('9 · 多 AI 檢討流程','首版以規則 / 模擬文字產生，未來再接 API',`<div class="card-pad">
     <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px">
     ${['交易結果','原始 AI 自我檢討','ChatGPT 檢討策略','Gemini 再檢討','策略審核 AI 統整','產生修改建議','回傳原始 AI','更新下一版'].map((s,i,arr)=>
       `<div style="min-width:130px;background:var(--blue-tint);border:1px solid var(--blue-soft);border-radius:10px;padding:11px 13px;font-size:12px;font-weight:600;text-align:center">${s}</div>${i<arr.length-1?'<div style="display:flex;align-items:center;color:var(--ink-3);font-weight:800">→</div>':''}`).join('')}
     </div>
     <div style="margin-top:12px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:12px 14px;font-size:12.5px;color:#9A3412">
       首版不強制使用 OpenAI / Gemini API，避免費用。資料表與 UI 已就緒，未來把檢討流程接上 API 即可運作。</div></div>`)}

   ${blk('10 · AI 策略版本紀錄','',tbl([['版本'],['時間'],['修改原因'],['舊規則'],['新規則'],['績效變化']],
     DATA.aiVer.map(v=>`<tr><td><span class="badge">${v.v}</span></td><td class="code">${v.d}</td>
     <td class="muted" style="white-space:normal;min-width:130px">${v.reason}</td>
     <td class="muted" style="white-space:normal;min-width:140px">${v.old}</td>
     <td style="white-space:normal;min-width:160px">${v.new}</td>
     <td class="num up" style="white-space:normal">${v.perf}</td></tr>`).join('')))}
  </div>`;
}
