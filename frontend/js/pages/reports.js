// ── Reports Page ──────────────────────────────────────────────────────────────
async function render_reports(container) {
  container.innerHTML = `<div class="alert alert-green">Loading reports…</div>`;
  let reports = [];
  try {
    const d = await API.get('/api/reports');
    reports = d.reports || [];
  } catch(e) {
    container.innerHTML = `<div class="alert alert-red">Could not load reports: ${sanitize(e.message)}</div>`;
    return;
  }

  container.innerHTML = `
<div style="max-width:820px">
  <!-- Generate section -->
  <div class="section-title">Generate New Report</div>
  <div class="g2" style="margin-bottom:18px">
    <button class="card card-p" style="text-align:left;cursor:pointer;transition:border-color .15s" onclick="_generateReport('full','Full Health Report')"
      onmouseover="this.style.borderColor='var(--green)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="font-size:28px;margin-bottom:8px">📋</div>
      <div style="font-size:14px;font-weight:600;color:var(--text)">Full Health Report</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Profile, metrics, medical history, medications and appointments — all in one printable document.</div>
    </button>
    <button class="card card-p" style="text-align:left;cursor:pointer;transition:border-color .15s" onclick="_generateReport('metrics','Health Metrics Summary')"
      onmouseover="this.style.borderColor='var(--green)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="font-size:28px;margin-bottom:8px">📊</div>
      <div style="font-size:14px;font-weight:600;color:var(--text)">Metrics Summary</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Current vitals: BP, heart rate, glucose, SpO₂ and more — formatted for your doctor.</div>
    </button>
  </div>

  <div id="gen-status" style="margin-bottom:16px"></div>

  <!-- Past reports -->
  <div class="section-title">Past Reports (${reports.length})</div>
  <div id="reports-list">
    ${reports.length ? reports.map(r => _reportRow(r)).join('') : '<div class="alert alert-blue">No reports generated yet. Create your first report above.</div>'}
  </div>

  <div class="alert alert-green" style="margin-top:16px">
    💡 Reports are generated as HTML files — open in browser and use <strong>Ctrl+P / Cmd+P</strong> to print or save as PDF.
  </div>
</div>`;
}

function _reportRow(r) {
  return `
<div class="card card-p" id="report-${r.id}" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
  <div>
    <div style="font-size:14px;font-weight:600;color:var(--text)">📄 ${sanitize(r.title)}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${r.report_type} · Generated ${fmtDate(r.created_at)}</div>
  </div>
  <div style="display:flex;gap:7px;flex-wrap:wrap">
    <button class="btn btn-primary btn-sm" onclick="_viewReport(${r.id})">👁 View</button>
    <button class="btn btn-secondary btn-sm" onclick="_downloadReport(${r.id},'${sanitize(r.title)}')">⬇️ Download</button>
    <button class="btn btn-danger btn-sm" onclick="_deleteReport(${r.id})">🗑</button>
  </div>
</div>`;
}

async function _generateReport(type, title) {
  const statusEl = document.getElementById('gen-status');
  if (statusEl) statusEl.innerHTML = '<div class="alert alert-blue">⏳ Generating report… please wait.</div>';

  try {
    const d = await API.post('/api/reports/generate', { report_type: type, title });
    const report = d.report;
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-green">✅ Report generated: <strong>${sanitize(report.title)}</strong></div>`;

    // Open in new tab for immediate viewing / printing
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(report.html);
      win.document.close();
    }

    showToast('✅ Report ready — opening in new tab');
    // Refresh list
    const page = document.querySelector('.page-wrap');
    if (page) render_reports(page);
  } catch(e) {
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-red">Generation failed: ${sanitize(e.message)}</div>`;
  }
}

async function _viewReport(id) {
  try {
    const d = await API.get(`/api/reports/${id}`);
    const win = window.open('', '_blank');
    if (win) { win.document.write(d.report.html); win.document.close(); }
  } catch(e) { showToast('Error: ' + e.message); }
}

async function _downloadReport(id, title) {
  try {
    const d = await API.get(`/api/reports/${id}`);
    const blob = new Blob([d.report.html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    showToast('✅ Report downloaded!');
  } catch(e) { showToast('Download failed: ' + e.message); }
}

async function _deleteReport(id) {
  if (!confirm('Delete this report?')) return;
  try {
    await API.delete(`/api/reports/${id}`);
    document.getElementById(`report-${id}`)?.remove();
    showToast('Report deleted.');
  } catch(e) { showToast('Error: ' + e.message); }
}

window.render_reports   = render_reports;
window._generateReport  = _generateReport;
window._viewReport      = _viewReport;
window._downloadReport  = _downloadReport;
window._deleteReport    = _deleteReport;
