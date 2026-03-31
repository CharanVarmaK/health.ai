// ── Family Page ───────────────────────────────────────────────────────────────
async function render_family(container) {
  container.innerHTML = `<div class="alert alert-green">Loading family profiles…</div>`;
  let members = [], relations = [];
  try {
    const d = await API.get('/api/family');
    members   = d.members   || [];
    relations = d.relations || ['Spouse','Son','Daughter','Father','Mother','Brother','Sister','Other'];
  } catch(e) {
    container.innerHTML = `<div class="alert alert-red">Could not load family: ${sanitize(e.message)}</div>`;
    return;
  }

  container.innerHTML = `
<div style="max-width:820px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div style="font-size:13px;color:var(--text-muted)">${members.length} member${members.length!==1?'s':''}</div>
    <button class="btn btn-primary btn-sm" onclick="_toggleFamForm()">+ Add Member</button>
  </div>

  <!-- Add form -->
  <div id="fam-form" style="display:none;margin-bottom:18px">
    <div class="card card-p">
      <div class="card-title">Add Family Member</div>
      <div class="g2">
        <div class="form-group"><label class="form-label">Name *</label>
          <input class="form-input" id="ff-name" placeholder="Full name"></div>
        <div class="form-group"><label class="form-label">Relation *</label>
          <select class="form-select" id="ff-rel">
            ${relations.map(r=>`<option>${r}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Age</label>
          <input class="form-input" type="number" id="ff-age" placeholder="Age" min="0" max="120"></div>
        <div class="form-group"><label class="form-label">Gender</label>
          <select class="form-select" id="ff-gender"><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></div>
        <div class="form-group"><label class="form-label">Blood Group</label>
          <select class="form-select" id="ff-blood">
            <option value="">Unknown</option>
            ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=>`<option>${b}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Phone</label>
          <input class="form-input" id="ff-phone" placeholder="+91 …"></div>
      </div>
      <div class="form-group"><label class="form-label">Health Conditions (comma separated)</label>
        <input class="form-input" id="ff-cond" placeholder="e.g. Diabetes, Hypertension"></div>
      <div class="form-group"><label class="form-label">Allergies (comma separated)</label>
        <input class="form-input" id="ff-allerg" placeholder="e.g. Penicillin"></div>
      <div class="form-group"><label class="form-label">Current Medications (comma separated)</label>
        <input class="form-input" id="ff-meds" placeholder="e.g. Metformin 500mg"></div>
      <div id="ff-err" class="alert alert-red" style="display:none;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="ff-submit" onclick="_addFamMember()">Add Member</button>
        <button class="btn btn-secondary" onclick="_toggleFamForm()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Members grid -->
  <div class="g3" id="fam-grid">
    ${members.length
      ? members.map((m,i) => _famCard(m, i)).join('')
      : `<div class="card card-p" style="text-align:center;grid-column:1/-1">
          <div style="font-size:32px;margin-bottom:8px">👨‍👩‍👧</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">No family members added yet.</div>
          <button class="btn btn-primary btn-sm" onclick="_toggleFamForm()">+ Add First Member</button>
         </div>`}
  </div>
</div>`;
}

function _famCard(m, i) {
  const conds = Array.isArray(m.conditions) ? m.conditions : [];
  return `
<div class="family-card" id="fam-${m.id}">
  <div class="family-av" style="background:${m.color||'#d1fae5'};color:${m.text_color||'#065f46'}">${m.initials||'?'}</div>
  <div class="family-name">${sanitize(m.display_name)}</div>
  <div class="family-rel">${sanitize(m.relation)}</div>
  <div class="family-age">${m.age ? m.age + ' years' : '—'} ${m.blood_group ? '· ' + m.blood_group : ''}</div>
  <div style="margin-top:7px;display:flex;flex-wrap:wrap;justify-content:center;gap:3px">
    ${conds.slice(0,2).map(c=>`<span class="tag tag-amber" style="font-size:10px">${sanitize(c)}</span>`).join('')}
    ${!conds.length ? '<span class="tag tag-green" style="font-size:10px">Healthy</span>' : ''}
  </div>
  <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;justify-content:center">
    <button class="btn btn-secondary btn-sm" onclick="askAI('Health advice and checkup recommendations for my ${sanitize(m.relation).toLowerCase()} ${sanitize(m.display_name)}, age ${m.age||'unknown'}${conds.length?', conditions: '+conds.join(', '):''}')">💬 Ask AI</button>
    <button class="btn btn-danger btn-sm" onclick="_removeFam(${m.id})">🗑</button>
  </div>
</div>`;
}

function _toggleFamForm() {
  const f = document.getElementById('fam-form');
  if (f) {
    const opening = f.style.display === 'none' || f.style.display === '';
    f.style.display = opening ? 'block' : 'none';
    if (opening) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function _addFamMember() {
  const name   = document.getElementById('ff-name')?.value.trim();
  const rel    = document.getElementById('ff-rel')?.value;
  const age    = parseInt(document.getElementById('ff-age')?.value) || null;
  const gender = document.getElementById('ff-gender')?.value || null;
  const blood  = document.getElementById('ff-blood')?.value || null;
  const phone  = document.getElementById('ff-phone')?.value.trim() || null;
  const split  = v => v.split(',').map(s=>s.trim()).filter(Boolean);
  const cond   = split(document.getElementById('ff-cond')?.value   || '');
  const allerg = split(document.getElementById('ff-allerg')?.value || '');
  const meds   = split(document.getElementById('ff-meds')?.value   || '');
  const errEl  = document.getElementById('ff-err');
  const btn    = document.getElementById('ff-submit');

  if (!name) {
    if (errEl) { errEl.style.display='block'; errEl.textContent='Name is required.'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btn)   { btn.disabled=true; btn.textContent='Adding…'; }

  try {
    await API.post('/api/family', {
      display_name: name, relation: rel, age, gender,
      blood_group: blood||undefined, phone: phone||undefined,
      conditions: cond, allergies: allerg, medications: meds,
    });
    showToast(`✅ ${name} added!`);
    const page = document.querySelector('.page-wrap');
    if (page) render_family(page);
  } catch(e) {
    if (errEl) { errEl.style.display='block'; errEl.textContent=e.message; }
    if (btn)   { btn.disabled=false; btn.textContent='Add Member'; }
  }
}

async function _removeFam(id) {
  if (!confirm('Remove this family member?')) return;
  try {
    await API.delete(`/api/family/${id}`);
    document.getElementById(`fam-${id}`)?.remove();
    showToast('Family member removed.');
  } catch(e) { showToast('Error: ' + e.message); }
}

window.render_family  = render_family;
window._toggleFamForm = _toggleFamForm;
window._addFamMember  = _addFamMember;
window._removeFam     = _removeFam;
