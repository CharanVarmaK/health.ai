// ── Appointments Page ─────────────────────────────────────────────────────────
async function render_appointments(container) {
  container.innerHTML = `<div class="alert alert-green">Loading appointments…</div>`;
  let appts = [], specialties = [];
  try {
    const d = await API.get('/api/appointments?limit=50');
    appts = d.appointments || [];
    specialties = d.specialties || [];
  } catch(e) {
    container.innerHTML = `<div class="alert alert-red">Could not load appointments: ${sanitize(e.message)}</div>`;
    return;
  }

  const upcoming  = appts.filter(a => a.status === 'upcoming');
  const completed = appts.filter(a => a.status === 'completed');
  const cancelled = appts.filter(a => a.status === 'cancelled');

  container.innerHTML = `
<div style="max-width:820px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div style="font-size:13px;color:var(--text-muted)">${upcoming.length} upcoming · ${completed.length} completed</div>
    <button class="btn btn-primary" onclick="_toggleApptForm()">+ Book Appointment</button>
  </div>

  <div id="appt-form" style="display:none;margin-bottom:18px">
    <div class="card card-p">
      <div class="card-title">📅 Book New Appointment</div>
      <div class="g2">
        <div class="form-group">
          <label class="form-label">Specialty *</label>
          <select class="form-select" id="apf-spec">
            ${(specialties.length ? specialties : [
              'General Physician','Cardiologist','Pulmonologist','Neurologist',
              'Orthopedist','Dermatologist','Gastroenterologist','Diabetologist',
              'Gynaecologist','Paediatrician','Psychiatrist','Ophthalmologist',
              'ENT Specialist','Urologist','Nephrologist','Oncologist'
            ]).map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Doctor Name</label>
          <input class="form-input" id="apf-doc" placeholder="Dr. (leave blank if unknown)">
        </div>
        <div class="form-group">
          <label class="form-label">Hospital / Clinic *</label>
          <input class="form-input" id="apf-hosp" placeholder="e.g. Apollo Hospitals, Jubilee Hills" list="hosp-datalist">
          <datalist id="hosp-datalist">
            <option value="Apollo Hospitals, Jubilee Hills">
            <option value="KIMS Hospital, Secunderabad">
            <option value="Yashoda Hospital, Somajiguda">
            <option value="Care Hospitals, Banjara Hills">
            <option value="Medicover Hospitals, Hitec City">
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Hospital Address (optional)</label>
          <input class="form-input" id="apf-addr" placeholder="Street address">
        </div>
        <div class="form-group">
          <label class="form-label">Date *</label>
          <input class="form-input" type="date" id="apf-date" min="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Preferred Time *</label>
          <select class="form-select" id="apf-time">
            ${['09:00','09:30','10:00','10:30','11:00','11:30','12:00',
               '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']
              .map(t => `<option value="${t}">${_fmt12h(t)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Reason / Symptoms</label>
        <textarea class="form-textarea" id="apf-notes" placeholder="Describe the reason for your visit or your current symptoms…" rows="3"></textarea>
      </div>
      <div id="apf-err" class="alert alert-red" style="display:none;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" id="apf-submit" onclick="_submitAppt()">✅ Confirm Booking</button>
        <button class="btn btn-secondary" onclick="_toggleApptForm()">Cancel</button>
      </div>
    </div>
  </div>

  <div class="section-title">Upcoming (${upcoming.length})</div>
  <div id="upcoming-list">
    ${upcoming.length
      ? upcoming.map(a => _apptCard(a, true)).join('')
      : '<div class="alert alert-green" style="margin-bottom:8px">No upcoming appointments. Book one above!</div>'}
  </div>

  <div class="alert alert-blue" style="margin-top:14px;margin-bottom:0">
    💡 <strong>Tip:</strong> Based on your conditions, consider scheduling a Cardiologist and General Physician checkup.
    <button class="btn btn-secondary btn-sm" style="margin-left:8px;margin-top:4px" onclick="_toggleApptForm()">Book Now</button>
  </div>

  ${completed.length ? `
    <div class="section-title" style="margin-top:20px">Completed (${completed.length})</div>
    ${completed.map(a => _apptCard(a, false)).join('')}` : ''}

  ${cancelled.length ? `
    <div class="section-title" style="margin-top:20px">Cancelled (${cancelled.length})</div>
    ${cancelled.map(a => _apptCard(a, false)).join('')}` : ''}
</div>`;
}

function _fmt12h(t) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function _apptCard(a, isUpcoming) {
  const parts = (a.appointment_date || '').split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = parts[2] || '--';
  const mon = months[parseInt(parts[1]) - 1] || '';
  const time12 = a.appointment_time ? _fmt12h(a.appointment_time.slice(0,5)) : '';

  return `
<div class="appt-card" id="appt-${a.id}" style="${!isUpcoming ? 'opacity:.72' : ''}">
  <div class="appt-date">
    <div class="appt-day">${day}</div>
    <div class="appt-month">${mon}</div>
  </div>
  <div class="appt-info">
    <div class="appt-doc">${sanitize(a.doctor_name)}</div>
    <div class="appt-spec">${sanitize(a.specialty)}</div>
    <div class="appt-hosp">🏥 ${sanitize(a.hospital_name)}</div>
    <div class="appt-time">⏰ ${time12}</div>
    ${a.notes ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">📋 ${sanitize(a.notes)}</div>` : ''}
  </div>
  <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">
    <span class="tag ${a.status==='upcoming'?'tag-green':a.status==='cancelled'?'tag-red':'tag-blue'}">${a.status}</span>
    ${isUpcoming ? `
      <button class="btn btn-secondary btn-sm" onclick="_markDone(${a.id})">✓ Done</button>
      <button class="btn btn-danger btn-sm" onclick="_cancelAppt(${a.id})">Cancel</button>` : ''}
  </div>
</div>`;
}

function _toggleApptForm() {
  const f = document.getElementById('appt-form');
  if (!f) return;
  const opening = f.style.display === 'none' || f.style.display === '';
  f.style.display = opening ? 'block' : 'none';
  if (opening) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const di = document.getElementById('apf-date');
    if (di && !di.value) di.value = tomorrow.toISOString().split('T')[0];
    f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function _submitAppt() {
  const spec  = document.getElementById('apf-spec')?.value;
  const doc   = (document.getElementById('apf-doc')?.value.trim()) || `Dr. (${spec})`;
  const hosp  = document.getElementById('apf-hosp')?.value.trim();
  const addr  = document.getElementById('apf-addr')?.value.trim();
  const dt    = document.getElementById('apf-date')?.value;
  const tm    = document.getElementById('apf-time')?.value;
  const notes = document.getElementById('apf-notes')?.value.trim();
  const errEl = document.getElementById('apf-err');
  const btn   = document.getElementById('apf-submit');

  const showErr = msg => { if (errEl) { errEl.style.display='block'; errEl.textContent=msg; } };
  if (!hosp) { showErr('Please enter the hospital or clinic name.'); return; }
  if (!dt)   { showErr('Please select a date.'); return; }
  if (errEl) errEl.style.display = 'none';
  if (btn)   { btn.disabled=true; btn.textContent='Booking…'; }

  try {
    await API.post('/api/appointments', {
      doctor_name: doc,
      specialty: spec,
      hospital_name: hosp,
      hospital_address: addr || null,
      appointment_date: dt,
      appointment_time: tm,
      notes: notes || null,
    });
    showToast('✅ Appointment booked!');
    const page = document.querySelector('.page-wrap');
    if (page) render_appointments(page);
  } catch(e) {
    showErr(e.message || 'Booking failed. Please try again.');
    if (btn) { btn.disabled=false; btn.textContent='✅ Confirm Booking'; }
  }
}

async function _cancelAppt(id) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    await API.delete(`/api/appointments/${id}`);
    document.getElementById(`appt-${id}`)?.remove();
    showToast('Appointment cancelled.');
  } catch(e) { showToast('Error: ' + e.message); }
}

async function _markDone(id) {
  try {
    await API.put(`/api/appointments/${id}`, { status: 'completed' });
    showToast('Marked as completed.');
    const page = document.querySelector('.page-wrap');
    if (page) render_appointments(page);
  } catch(e) { showToast('Error: ' + e.message); }
}

window.render_appointments = render_appointments;
window._toggleApptForm     = _toggleApptForm;
window._submitAppt         = _submitAppt;
window._cancelAppt         = _cancelAppt;
window._markDone           = _markDone;
