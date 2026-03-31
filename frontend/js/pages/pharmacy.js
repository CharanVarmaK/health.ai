async function render_pharmacy(container) {
  container.innerHTML = `
<div style="max-width:820px">
  <div class="map-block" onclick="window.open('https://www.google.com/maps/search/pharmacy+near+me','_blank')">
    <div class="map-icon">🏪</div>
    <div class="map-lbl">Pharmacies Near You</div>
    <div class="map-sub">Click to open in Google Maps</div>
  </div>
  <div id="pharma-list"><div class="alert alert-green">Loading…</div></div>
  <div class="section-title" style="margin-top:20px">Online Medicine Delivery</div>
  <div class="g3">
    ${[['💊','NetMeds','https://www.netmeds.com'],['🏥','PharmEasy','https://pharmeasy.in'],['💉','1mg','https://www.1mg.com']]
      .map(([i,n,u])=>`
      <button class="card card-p" style="cursor:pointer;text-align:left" onclick="window.open('${u}','_blank')">
        <div style="font-size:24px;margin-bottom:6px">${i}</div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${n}</div>
        <div style="font-size:11px;color:var(--text-muted)">Home delivery</div>
      </button>`).join('')}
  </div>
</div>`;

  try {
    const data = await API.get('/api/pharmacies');
    const list = data.pharmacies || [];
    document.getElementById('pharma-list').innerHTML = list.map(p=>`
<div class="hosp-card">
  <div class="hosp-head">
    <div>
      <div class="hosp-name">🏪 ${sanitize(p.name)}</div>
      <div class="hosp-area">📍 ${sanitize(p.area)}, ${sanitize(p.city||'Hyderabad')}</div>
    </div>
    <div style="text-align:right">
      <div class="hosp-dist">${p.dist_km} km</div>
      ${p.delivery?'<span class="tag tag-green">🛵 Delivery</span>':'<span class="tag tag-amber">No delivery</span>'}
    </div>
  </div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">⏰ ${p.hours||'—'}</div>
  <div class="hosp-actions">
    ${p.phone?`<a href="tel:${p.phone}" class="btn btn-primary btn-sm">📞 ${p.phone}</a>`:''}
    <button class="btn btn-secondary btn-sm" onclick="window.open('https://www.google.com/maps/search/${encodeURIComponent(p.name+' '+p.area)}','_blank')">🗺️ Navigate</button>
  </div>
</div>`).join('') || '<div class="alert alert-amber">No pharmacies found.</div>';
  } catch(e) {
    document.getElementById('pharma-list').innerHTML = `<div class="alert alert-amber">${e.message}</div>`;
  }
}
window.render_pharmacy = render_pharmacy;
