// ── Reminders Page ────────────────────────────────────────────────────────────
async function render_reminders(container) {
  container.innerHTML = `<div class="alert alert-green">Loading reminders…</div>`;
  let reminders = [];
  try {
    const d = await API.get('/api/reminders');
    reminders = d.reminders || [];
  } catch(e) {
    container.innerHTML = `<div class="alert alert-red">Could not load reminders: ${sanitize(e.message)}</div>`;
    return;
  }

  const active   = reminders.filter(r => r.is_active).length;

  container.innerHTML = `
<div style="max-width:700px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div style="font-size:13px;color:var(--text-muted)">${active} active · ${reminders.length} total</div>
    <button class="btn btn-primary btn-sm" onclick="_toggleRemForm()">+ Add Reminder</button>
  </div>

  <!-- Add form -->
  <div id="rem-form" style="display:none;margin-bottom:18px">
    <div class="card card-p">
      <div class="card-title">New Reminder</div>
      <div class="g2">
        <div class="form-group"><label class="form-label">Name *</label>
          <input class="form-input" id="rf-name" placeholder="e.g. Vitamin D3 1000 IU"></div>
        <div class="form-group"><label class="form-label">Icon</label>
          <select class="form-select" id="rf-icon">
            ${['💊 Medicine','🩺 Health Check','🏃 Exercise','💧 Water','🍎 Diet','😴 Sleep','🔔 General','❤️ BP Check','🧘 Meditation','🥗 Nutrition']
              .map(o => { const [e,l]=o.split(' ');return `<option value="${e}">${o}</option>`; }).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Time *</label>
          <input class="form-input" type="time" id="rf-time"></div>
        <div class="form-group"><label class="form-label">Frequency</label>
          <select class="form-select" id="rf-freq">
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays (Mon–Fri)</option>
            <option value="weekends">Weekends</option>
            <option value="mon_wed_fri">Mon, Wed, Fri</option>
            <option value="tue_thu">Tue, Thu</option>
            <option value="weekly">Weekly</option>
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Notes (optional)</label>
        <input class="form-input" id="rf-notes" placeholder="e.g. Take with food"></div>
      <div id="rf-err" class="alert alert-red" style="display:none;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="rf-submit" onclick="_addReminder()">Add Reminder</button>
        <button class="btn btn-secondary" onclick="_toggleRemForm()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Reminders list -->
  <div id="rem-list">
    ${reminders.length
      ? reminders.map(r => _remItem(r)).join('')
      : `<div class="card card-p" style="text-align:center">
          <div style="font-size:32px;margin-bottom:8px">🔔</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">No reminders yet. Add medicine or health reminders to stay on track.</div>
          <button class="btn btn-primary btn-sm" onclick="_toggleRemForm()">+ Add First Reminder</button>
         </div>`}
  </div>

  <div class="alert alert-blue" style="margin-top:16px">
    💡 Enable browser notifications for timely reminders.
    <button class="btn btn-secondary btn-sm" style="margin-left:8px" onclick="_requestNotifPerm()">Enable Notifications</button>
  </div>
</div>`;

  // Start local notification checker
  _startReminderChecker(reminders);
}

function _remItem(r) {
  const freqLabel = {
    daily:'Daily', weekdays:'Mon–Fri', weekends:'Weekends',
    mon_wed_fri:'Mon, Wed, Fri', tue_thu:'Tue, Thu', weekly:'Weekly',
  }[r.frequency] || r.frequency;

  return `
<div class="reminder-item" id="rem-${r.id}">
  <div class="reminder-icon">${r.icon||'🔔'}</div>
  <div class="reminder-info">
    <div class="reminder-name">${sanitize(r.name)}</div>
    <div class="reminder-time">⏰ ${r.reminder_time} · ${freqLabel}${r.notes?` · ${sanitize(r.notes)}`:''}</div>
  </div>
  <div style="display:flex;align-items:center;gap:8px">
    <button class="btn btn-danger btn-sm" onclick="_deleteReminder(${r.id})" title="Delete">🗑</button>
    <div class="toggle ${r.is_active?'':'off'}" onclick="_toggleRem(${r.id},this)" title="${r.is_active?'Active — click to pause':'Paused — click to activate'}"></div>
  </div>
</div>`;
}

function _toggleRemForm() {
  const f = document.getElementById('rem-form');
  if (f) {
    const opening = f.style.display === 'none' || f.style.display === '';
    f.style.display = opening ? 'block' : 'none';
    if (opening) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function _addReminder() {
  const name  = document.getElementById('rf-name')?.value.trim();
  const icon  = document.getElementById('rf-icon')?.value  || '🔔';
  const time  = document.getElementById('rf-time')?.value;
  const freq  = document.getElementById('rf-freq')?.value  || 'daily';
  const notes = document.getElementById('rf-notes')?.value.trim();
  const errEl = document.getElementById('rf-err');
  const btn   = document.getElementById('rf-submit');

  if (!name) {
    if (errEl) { errEl.style.display='block'; errEl.textContent='Reminder name is required.'; }
    return;
  }
  if (!time) {
    if (errEl) { errEl.style.display='block'; errEl.textContent='Please select a time.'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btn)   { btn.disabled=true; btn.textContent='Adding…'; }

  try {
    await API.post('/api/reminders', {
      name, icon, reminder_type: 'medicine', reminder_time: time,
      frequency: freq, notes: notes || null,
    });
    showToast(`✅ Reminder added: ${name}`);
    const page = document.querySelector('.page-wrap');
    if (page) render_reminders(page);
  } catch(e) {
    if (errEl) { errEl.style.display='block'; errEl.textContent=e.message; }
    if (btn)   { btn.disabled=false; btn.textContent='Add Reminder'; }
  }
}

async function _toggleRem(id, el) {
  try {
    const d = await API.patch(`/api/reminders/${id}/toggle`, {});
    // Wait — PATCH body needed? Check router — it reads nothing from body
    el.classList.toggle('off', !d.is_active);
    showToast(d.is_active ? '🔔 Reminder activated' : '🔕 Reminder paused');
  } catch(e) { showToast('Error: ' + e.message); }
}

async function _deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;
  try {
    await API.delete(`/api/reminders/${id}`);
    document.getElementById(`rem-${id}`)?.remove();
    showToast('Reminder deleted.');
  } catch(e) { showToast('Error: ' + e.message); }
}

function _requestNotifPerm() {
  if (!('Notification' in window)) { showToast('Notifications not supported in this browser'); return; }
  Notification.requestPermission().then(p => {
    showToast(p === 'granted' ? '✅ Notifications enabled!' : 'Notification permission denied.');
  });
}

let _remCheckerInterval = null;
function _startReminderChecker(reminders) {
  if (_remCheckerInterval) clearInterval(_remCheckerInterval);
  _remCheckerInterval = setInterval(() => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    reminders.forEach(r => {
      if (!r.is_active) return;
      if (r.reminder_time === hhmm) {
        showToast(`⏰ Reminder: ${r.name}`, 6000);
        if (Notification.permission === 'granted') {
          new Notification('HealthAI Reminder', { body: r.name, icon: '/assets/logo.png' });
        }
        if (AppState.synth) speakText(`Reminder: ${r.name}`);
      }
    });
  }, 30000); // check every 30 seconds
}

window.render_reminders    = render_reminders;
window._toggleRemForm      = _toggleRemForm;
window._addReminder        = _addReminder;
window._toggleRem          = _toggleRem;
window._deleteReminder     = _deleteReminder;
window._requestNotifPerm   = _requestNotifPerm;
