/* Page module: status.js */

function vStatus(){
  const ok=DATA.dataStatus.filter(d=>d.ok).length;
  const srcOk=SRC_STATUS.indexOf('✅')===0;
  const latest=(DATA.dataStatus||[]).map(d=>d.t).filter(t=>t&&t!=='—').sort().slice(-1)[0]||DATA.meta.updated||'—';
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px">
   <div class="card card-pad" style="background:${srcOk?'#FEF2F2':'#FEF3C7'};border-color:${srcOk?'#FECACA':'#FDE68A'}">
     <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
       <span class="badge ${srcOk?'good':'warm'}">${srcOk?'真實資料連線':'資料來源提醒'}</span>
       <b style="font-size:14px;color:${srcOk?'var(--up)':'#92400E'}">${SRC_STATUS}</b>
     </div>
   </div>
   <div class="card card-pad" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
     <div class="stat"><span class="k">今日抓取進度</span><span class="v"><span class="up">${ok}</span><span style="color:var(--ink-3);font-size:18px"> / ${DATA.dataStatus.length}</span></span></div>
     <div style="flex:1;min-width:200px"><div class="progress"><i style="width:${ok/DATA.dataStatus.length*100}%"></i></div>
       <div style="font-size:12px;color:var(--ink-2);margin-top:7px">最後更新：${DATA.meta.date} ${latest} · 排程 GitHub Actions 每日 14:30 / 16:00</div></div>
     <button class="btn sm" id="runDailyBtn">手動重新抓取</button>
     <span id="runDailyMsg" class="muted" style="font-size:12px"></span>
   </div>
   <div class="card"><div class="card-h"><h3>資料來源狀態</h3><span class="tag">每日盤後排程結果</span></div>
     <div class="tbl-wrap"><table><thead><tr><th>資料來源</th><th>狀態</th><th class="r">完成時間</th><th>備註</th></tr></thead><tbody>
     ${DATA.dataStatus.map(d=>`<tr><td><b>${d.k}</b></td>
       <td><span class="badge ${d.ok?'good':'bad'}">${d.ok?'● 成功':'● 失敗'}</span></td>
       <td class="r code">${d.t}</td><td class="muted">${d.err||'正常'}</td></tr>`).join('')}
     </tbody></table></div>
   </div>
   <div class="card card-pad"><b style="font-size:14px">錯誤紀錄</b>
     <div style="margin-top:10px;font-size:13px;color:var(--ink-2);background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:13px;font-family:var(--mono)">
       <div>[16:40] MOPS 月營收：當月營收尚未公布（每月 10 日前），略過</div>
       <div style="color:var(--down);margin-top:4px">[${latest}] 資料來源狀態已同步 Supabase data_status</div>
     </div>
   </div>
  </div>`;
}

