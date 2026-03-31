// ── Profile Page ──────────────────────────────────────────────────────────────
async function render_profile(container) {
  container.innerHTML = `<div class="alert alert-green">Loading profile…</div>`;
  let profile = {};
  try {
    const d = await API.profile.get();
    profile = d.profile || {};
  } catch(e) {
    container.innerHTML = `<div class="alert alert-red">Could not load profile: ${sanitize(e.message)}</div>`;
    return;
  }

  const user = getUser();
  const conditions  = Array.isArray(profile.conditions)          ? profile.conditions          : [];
  const allergies   = Array.isArray(profile.allergies)           ? profile.allergies           : [];
  const medications = Array.isArray(profile.current_medications) ? profile.current_medications : [];
  const famHx       = Array.isArray(profile.family_history)      ? profile.family_history      : [];

  container.innerHTML = `
<div style="max-width:820px">

  <!-- Header card -->
  <div class="card card-p" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px">
      <div class="user-av" style="width:64px;height:64px;font-size:22px;font-weight:700;flex-shrink:0">
        ${(profile.display_name||'U').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
      </div>
      <div style="flex:1">
        <div style="font-size:20px;font-weight:700;color:var(--text)">${sanitize(profile.full_name||profile.display_name||'—')}</div>
        <div style="font-size:13px;color:var(--text-muted)">${profile.gender||'—'} · ${profile.age||'—'} years · Blood: ${profile.blood_group||'—'}</div>
        <div style="margin-top:6px">
          ${conditions.map(c=>`<span class="tag tag-amber" style="margin:2px">${sanitize(c)}</span>`).join('')}
          ${!conditions.length ? '<span class="tag tag-green">No conditions on record</span>' : ''}
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="_toggleProfileEdit()">✏️ Edit Profile</button>
    </div>
  </div>

  <!-- Edit form (hidden by default) -->
  <div id="profile-edit-form" style="display:none;margin-bottom:16px">
    <div class="card card-p">
      <div class="card-title">Edit Profile</div>
      <div class="g2">
        <div class="form-group"><label class="form-label">Display Name</label>
          <input class="form-input" id="pe-dname" value="${sanitize(profile.display_name||'')}"></div>
        <div class="form-group"><label class="form-label">Full Name</label>
          <input class="form-input" id="pe-fname" value="${sanitize(profile.full_name||'')}"></div>
        <div class="form-group"><label class="form-label">Age</label>
          <input class="form-input" type="number" id="pe-age" value="${profile.age||''}" min="1" max="120"></div>
        <div class="form-group"><label class="form-label">Gender</label>
          <select class="form-select" id="pe-gender">
            ${['Male','Female','Other','Prefer not to say'].map(g=>`<option ${profile.gender===g?'selected':''}>${g}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Date of Birth</label>
          <input class="form-input" type="date" id="pe-dob" value="${profile.date_of_birth||''}"></div>
        <div class="form-group"><label class="form-label">Blood Group</label>
          <select class="form-select" id="pe-blood">
            <option value="">Unknown</option>
            ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=>`<option ${profile.blood_group===b?'selected':''}>${b}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Height</label>
          <input class="form-input" id="pe-height" value="${sanitize(profile.height_cm||'')}" placeholder="e.g. 172 cm"></div>
        <div class="form-group"><label class="form-label">Weight</label>
          <input class="form-input" id="pe-weight" value="${sanitize(profile.weight_kg||'')}" placeholder="e.g. 70 kg"></div>
        <div class="form-group"><label class="form-label">Phone</label>
          <input class="form-input" id="pe-phone" value="${sanitize(profile.phone||'')}" placeholder="+91 98765 43210"></div>
        <div class="form-group"><label class="form-label">City</label>
          <input class="form-input" id="pe-city" value="${sanitize(profile.city||'Hyderabad')}"></div>
      </div>
      <div class="form-group"><label class="form-label">Existing Conditions (comma separated)</label>
        <input class="form-input" id="pe-conditions" value="${sanitize(conditions.join(', '))}" placeholder="e.g. Hypertension, Asthma"></div>
      <div class="form-group"><label class="form-label">Allergies (comma separated)</label>
        <input class="form-input" id="pe-allergies" value="${sanitize(allergies.join(', '))}" placeholder="e.g. Penicillin, Dust mites"></div>
      <div class="form-group"><label class="form-label">Current Medications (comma separated)</label>
        <input class="form-input" id="pe-meds" value="${sanitize(medications.join(', '))}" placeholder="e.g. Amlodipine 5mg, Metformin 500mg"></div>
      <div class="form-group"><label class="form-label">Family History (comma separated)</label>
        <input class="form-input" id="pe-famhx" value="${sanitize(famHx.join(', '))}" placeholder="e.g. Diabetes (Father), Hypertension (Mother)"></div>
      <div class="form-group"><label class="form-label">Emergency Contact Name</label>
        <input class="form-input" id="pe-ecname" value="${sanitize(profile.emergency_contact_name||'')}"></div>
      <div class="form-group"><label class="form-label">Emergency Contact Phone</label>
        <input class="form-input" id="pe-ecphone" value="${sanitize(profile.emergency_contact_phone||'')}"></div>
      <div id="pe-err" class="alert alert-red" style="display:none;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" id="pe-save" onclick="_saveProfile()">💾 Save Changes</button>
        <button class="btn btn-secondary" onclick="_toggleProfileEdit()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Health Metrics -->
  <div class="section-title">Health Metrics</div>
  <div class="metrics-grid" style="margin-bottom:8px">
    ${[
      ['Blood Pressure', profile.blood_pressure||'—', profile.blood_pressure?'caution':'normal'],
      ['Heart Rate',     profile.heart_rate||'—',     'normal'],
      ['Temperature',    profile.temperature||'—',    'normal'],
      ['SpO₂',           profile.spo2||'—',           'normal'],
      ['Blood Glucose',  profile.blood_glucose||'—',  'normal'],
      ['Cholesterol',    profile.cholesterol||'—',    'normal'],
    ].map(([lbl,val,st]) => `
      <div class="metric">
        <div class="metric-val">${sanitize(String(val))}</div>
        <div class="metric-lbl">${lbl}</div>
        <div class="metric-status ms-${st}">${st==='normal'?'✅ Normal':st==='caution'?'⚠️ Monitor':'🔴 Alert'}</div>
      </div>`).join('')}
  </div>

  <!-- Update metrics inline -->
  <div id="metrics-form-toggle" style="margin-bottom:16px">
    <button class="btn btn-secondary btn-sm" onclick="_toggleMetricsForm()">📊 Update Metrics</button>
  </div>
  <div id="metrics-form" style="display:none;margin-bottom:16px">
    <div class="card card-p">
      <div class="card-title">Update Health Metrics</div>
      <div class="g2">
        ${[['Blood Pressure','me-bp','e.g. 120/80',profile.blood_pressure],
           ['Heart Rate','me-hr','e.g. 72 bpm',profile.heart_rate],
           ['Temperature','me-temp','e.g. 98.6°F',profile.temperature],
           ['SpO₂','me-spo2','e.g. 98%',profile.spo2],
           ['Blood Glucose','me-bg','e.g. 95 mg/dL',profile.blood_glucose],
           ['Cholesterol','me-chol','e.g. 190 mg/dL',profile.cholesterol],
        ].map(([lbl,id,ph,val])=>`
          <div class="form-group">
            <label class="form-label">${lbl}</label>
            <input class="form-input" id="${id}" placeholder="${ph}" value="${sanitize(val||'')}">
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="_saveMetrics()">Save Metrics</button>
        <button class="btn btn-secondary btn-sm" onclick="_toggleMetricsForm()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Personal Info + Medical History -->
  <div class="g2">
    <div>
      <div class="section-title">Personal Information</div>
      <div class="card card-p">
        ${[
          ['Date of Birth', profile.date_of_birth||'—'],
          ['Height / Weight', `${profile.height_cm||'—'} / ${profile.weight_kg||'—'}`],
          ['Phone', profile.phone||'—'],
          ['City', profile.city||'Hyderabad'],
          ['Emergency Contact', profile.emergency_contact_name ? `${profile.emergency_contact_name} · ${profile.emergency_contact_phone||''}` : '—'],
        ].map(([k,v])=>`
          <div class="list-row">
            <span class="list-key">${k}</span>
            <span class="list-val" style="font-size:12px">${sanitize(String(v))}</span>
          </div>`).join('')}
      </div>
    </div>
    <div>
      <div class="section-title">Medical History</div>
      <div class="card card-p">
        <div class="list-row"><span class="list-key">Conditions</span>
          <span class="list-val" style="text-align:left;font-size:12px">${conditions.join(', ')||'None'}</span></div>
        <div class="list-row"><span class="list-key">Allergies</span>
          <span class="list-val" style="text-align:left;font-size:12px;color:#f87171">${allergies.join(', ')||'None'}</span></div>
        <div class="list-row"><span class="list-key">Medications</span>
          <span class="list-val" style="text-align:left;font-size:12px">${medications.join(', ')||'None'}</span></div>
        <div class="list-row"><span class="list-key">Family History</span>
          <span class="list-val" style="text-align:left;font-size:12px">${famHx.join(', ')||'None'}</span></div>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
    <button class="btn btn-primary" onclick="navigate('reports')">📄 Generate Health Report</button>
    <button class="btn btn-secondary" onclick="askAI('Analyse my health profile and give me personalised recommendations for my conditions and medications')">🤖 AI Health Analysis</button>
    <button class="btn btn-secondary" onclick="_exportData()">⬇️ Export My Data</button>
  </div>
</div>`;
}

function _toggleProfileEdit() {
  const f = document.getElementById('profile-edit-form');
  if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function _toggleMetricsForm() {
  const f = document.getElementById('metrics-form');
  if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function _saveProfile() {
  const errEl = document.getElementById('pe-err');
  const btn   = document.getElementById('pe-save');
  const splitComma = v => v.split(',').map(s=>s.trim()).filter(Boolean);

  const body = {
    display_name:             document.getElementById('pe-dname')?.value.trim()  || undefined,
    full_name:                document.getElementById('pe-fname')?.value.trim()  || undefined,
    age:                      parseInt(document.getElementById('pe-age')?.value) || undefined,
    gender:                   document.getElementById('pe-gender')?.value        || undefined,
    date_of_birth:            document.getElementById('pe-dob')?.value           || undefined,
    blood_group:              document.getElementById('pe-blood')?.value         || undefined,
    height_cm:                document.getElementById('pe-height')?.value.trim() || undefined,
    weight_kg:                document.getElementById('pe-weight')?.value.trim() || undefined,
    phone:                    document.getElementById('pe-phone')?.value.trim()  || undefined,
    city:                     document.getElementById('pe-city')?.value.trim()   || undefined,
    conditions:               splitComma(document.getElementById('pe-conditions')?.value||''),
    allergies:                splitComma(document.getElementById('pe-allergies')?.value||''),
    current_medications:      splitComma(document.getElementById('pe-meds')?.value||''),
    family_history:           splitComma(document.getElementById('pe-famhx')?.value||''),
    emergency_contact_name:   document.getElementById('pe-ecname')?.value.trim()  || undefined,
    emergency_contact_phone:  document.getElementById('pe-ecphone')?.value.trim() || undefined,
  };

  // Remove undefined keys
  Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

  if (errEl) errEl.style.display = 'none';
  if (btn)   { btn.disabled=true; btn.textContent='Saving…'; }

  try {
    await API.profile.update(body);
    showToast('✅ Profile updated!');
    AppState.profile = (await API.profile.get()).profile;
    const page = document.querySelector('.page-wrap');
    if (page) render_profile(page);
  } catch(e) {
    if (errEl) { errEl.style.display='block'; errEl.textContent = e.message; }
    if (btn)   { btn.disabled=false; btn.textContent='💾 Save Changes'; }
  }
}

async function _saveMetrics() {
  const body = {
    blood_pressure: document.getElementById('me-bp')?.value.trim()   || undefined,
    heart_rate:     document.getElementById('me-hr')?.value.trim()   || undefined,
    temperature:    document.getElementById('me-temp')?.value.trim() || undefined,
    spo2:           document.getElementById('me-spo2')?.value.trim() || undefined,
    blood_glucose:  document.getElementById('me-bg')?.value.trim()   || undefined,
    cholesterol:    document.getElementById('me-chol')?.value.trim() || undefined,
  };
  Object.keys(body).forEach(k => !body[k] && delete body[k]);
  try {
    await API.profile.updateMetrics(body);
    showToast('✅ Metrics updated!');
    const page = document.querySelector('.page-wrap');
    if (page) render_profile(page);
  } catch(e) { showToast('Error: ' + e.message); }
}

async function _exportData() {
  try {
    const data = await API.profile.export();
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `HealthAI_Export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('✅ Data exported!');
  } catch(e) { showToast('Export failed: ' + e.message); }
}

window.render_profile     = render_profile;
window._toggleProfileEdit = _toggleProfileEdit;
window._toggleMetricsForm = _toggleMetricsForm;
window._saveProfile       = _saveProfile;
window._saveMetrics       = _saveMetrics;
window._exportData        = _exportData;
