function vPatterns(){
  const loading=phase6Ensure('patterns'); if(loading) return loading;
  const rows=(DATA.phase6&&DATA.phase6.patterns)||[];
  if(!rows.length) return emptyPhase6('型態辨識尚無資料','請執行 jobs/compute_patterns.py 產生箱型、三角、W 底、突破與回測等型態。');
  const groups={};
  rows.forEach(r=>{(groups[r.pattern_type]=groups[r.pattern_type]||[]).push(r);});
  return `<div class="hero-card"><div><div class="eyebrow">PATTERN DETECTOR</div><h2>型態辨識</h2><p>自動辨識整理、突破、反轉與風險型態，提供支撐、壓力與風險備註。</p></div><div class="hero-metrics"><b>${rows.length}</b><span>型態訊號</span><b>${Object.keys(groups).length}</b><span>型態類別</span></div></div>
  <div class="card table-card"><table><thead><tr><th>股票</th><th>型態</th><th>信心</th><th>支撐</th><th>壓力</th><th>突破</th><th>停損</th><th>目標</th><th>原因</th></tr></thead><tbody>
    ${rows.map(r=>`<tr data-stock="${esc(r.symbol)}"><td><b>${esc(r.symbol)}</b> ${esc(r.name||'')}</td><td>${esc(r.pattern_type)}</td><td class="num">${r.confidence_score??'—'}</td><td>${fmtPx(r.support)}</td><td>${fmtPx(r.resistance)}</td><td>${fmtPx(r.breakout_price)}</td><td>${fmtPx(r.stop_loss)}</td><td>${fmtPx(r.target_price)}</td><td>${esc(r.reason||'')}</td></tr>`).join('')}
  </tbody></table></div>`;
}
