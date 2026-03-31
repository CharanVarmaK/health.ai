// ── Hospitals Page ──────────────────────────────────────────────────────────
async function render_hospitals(container) {
  container.innerHTML = `
<div style="max-width:820px">
  <div class="map-block" onclick="window.open('https://www.google.com/maps/search/hospital+near+me','_blank')">
    <div class="map-icon">🗺️</div>
    <div class="map-lbl">Hospitals Near You — Click to Open Maps</div>
    <div class="map-sub">Hyderabad area · Live navigation</div>
  </div>
  <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
    <input class="search-input" id="hosp-search" placeholder="Search by name or specialty…" oninput="_filterHospitals(this.value)" style="flex:1;min-width:200px"/>
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-muted);cursor:pointer">
      <input type="checkbox" id="hosp-emergency" onchange="_filterHospitals(document.getElementById('hosp-search').value)"> Emergency only
    </label>
  </div>
  <div class="alert alert-red" style="margin-bottom:12px">📞 Emergency Ambulance: <strong>108</strong> | Police: 100 | Women: 1091</div>
  <div id="hosp-list"><div class="alert alert-green">Loading hospitals…</div></div>
</div>`;

  try {
    const data = await API.get('/api/hospitals');
    window._allHospitals = data.hospitals || [];
    _renderHospitals(window._allHospitals);
  } catch(e) {
    document.getElementById('hosp-list').innerHTML = `<div class="alert alert-amber">Could not load hospitals. ${e.message}</div>`;
  }
}

function _renderHospitals(list) {
  const el = document.getElementById('hosp-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = '<div class="alert alert-amber">No hospitals found.</div>'; return; }
  el.innerHTML = list.map(h => `
<div class="hosp-card">
  <div class="hosp-head">
    <div>
      <div class="hosp-name">${sanitize(h.name)}</div>
      <div class="hosp-area">📍 ${sanitize(h.area)}, ${sanitize(h.city||'Hyderabad')}</div>
    </div>
    <div style="text-align:right">
      <div class="hosp-dist">📏 ${h.dist_km} km</div>
      <div class="hosp-stars">${'★'.repeat(Math.round(h.rating||0))} <span style="color:var(--text-muted);font-size:11px">${h.rating||''} (${(h.reviews||0).toLocaleString()})</span></div>
    </div>
  </div>
  <div class="hosp-tags">
    ${h.emergency?'<span class="tag tag-red">🚨 24/7 Emergency</span>':''}
    ${(h.specialties||[]).slice(0,3).map(s=>`<span class="tag tag-green">${s}</span>`).join('')}
  </div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">⏰ ${h.hours||'See website'}</div>
  <div class="hosp-actions">
    ${h.phone?`<a href="tel:${h.phone}" class="btn btn-primary btn-sm">📞 ${h.phone}</a>`:''}
    <a href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}" target="_blank" class="btn btn-secondary btn-sm">🗺️ Navigate</a>
    <button class="btn btn-secondary btn-sm" onclick="navigate('appointments')">📅 Book</button>
    <button class="btn btn-secondary btn-sm" onclick="askAI('Tell me about ${sanitize(h.name)} hospital — specialties, timings and doctors')">💬 Ask AI</button>
  </div>
</div>`).join('');
}

function _filterHospitals(q) {
  const all = window._allHospitals || [];
  const emergencyOnly = document.getElementById('hosp-emergency')?.checked;
  const lq = q.toLowerCase();
  const filtered = all.filter(h => {
    const match = !lq || h.name.toLowerCase().includes(lq) || h.area.toLowerCase().includes(lq)
      || (h.specialties||[]).some(s=>s.toLowerCase().includes(lq));
    const emg = !emergencyOnly || h.emergency;
    return match && emg;
  });
  _renderHospitals(filtered);
}

window.render_hospitals = render_hospitals;
window._filterHospitals = _filterHospitals;
