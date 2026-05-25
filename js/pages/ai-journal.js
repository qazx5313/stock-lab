function vAIJournal(){
  const loading=phase6Ensure('aiJournal'); if(loading) return loading;
  const rows=(DATA.phase6&&DATA.phase6.aiJournal)||[];
  if(!rows.length){
    phase6RetryOnce('aiJournal','aiJournal');
    const err=DATA.phase6Errors&&DATA.phase6Errors.aiJournal;
    if(err){
      return emptyPhase6('AI 檢討日誌讀取失敗',`Supabase 回傳：${err}。若 GitHub Actions 已經寫入資料，請到 Supabase SQL Editor 重新執行 db/phase6_schema.sql 內的 ai_trade_journal RLS policy。`);
    }
    return emptyPhase6('AI 檢討日誌尚無資料','後端尚未讀到 ai_trade_journal 紀錄。若剛跑完 GitHub Actions，請稍等後重新整理；系統也會自動再抓一次。');
  }
  return `<div class="hero-card"><div><div class="eyebrow">AI JOURNAL</div><h2>AI 操盤員檢討日誌</h2><p>自動整理 AI 交易後的獲利、虧損原因與下一輪策略調整方向。</p></div><div class="hero-metrics"><b>${rows.length}</b><span>檢討紀錄</span></div></div>
  <div class="card table-card"><table><thead><tr><th>日期</th><th>股票</th><th>方向</th><th>檢討分類</th><th>結果</th><th>下一次調整</th></tr></thead><tbody>
    ${rows.map(r=>`<tr data-stock="${esc(r.symbol||'')}"><td>${esc(r.review_date||'')}</td><td><b>${esc(r.symbol||'')}</b> ${esc(r.name||'')}</td><td>${esc(r.trade_type||'')}</td><td><span class="badge ${r.mistake_type==='策略有效'?'hot':'warm'}">${esc(r.mistake_type||'')}</span></td><td>${esc(r.result_summary||'')}</td><td>${esc(r.improvement_suggestion||'')}</td></tr>`).join('')}
  </tbody></table></div>`;
}
