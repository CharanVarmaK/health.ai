// ── Privacy & Security Page ───────────────────────────────────────────────────
function render_privacy(container) {
  const prefs = JSON.parse(localStorage.getItem('hai_privacy_prefs') || '{}');

  container.innerHTML = `
<div style="max-width:700px">

  <!-- Security status banner -->
  <div class="card card-p" style="background:rgba(22,163,122,.08);border-color:rgba(22,163,122,.3);margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">🔒</div>
      <div>
        <div style="font-size:15px;font-weight:600;color:var(--green-mid)">Your health data is secure</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
          All personal health information is encrypted with AES-256. Passwords use bcrypt. Sessions use rotating JWT tokens.
        </div>
      </div>
    </div>
  </div>

  <!-- Data & Privacy controls -->
  <div class="section-title">Privacy Controls</div>
  <div class="card card-p" style="margin-bottom:16px">
    ${[
      ['notifications_enabled',   '🔔 Reminder Notifications',    'Receive browser notifications for medicine and health reminders.', true],
      ['share_analytics',         '📊 Usage Analytics',           'Share anonymous usage data to help improve HealthAI. No health data is included.', false],
      ['ai_personalization',      '🤖 AI Personalisation',        'Allow AI to use your health profile to personalise responses and recommendations.', true],
      ['store_chat_history',      '💬 Store Chat History',        'Save your AI chat conversations for continuity across sessions.', true],
      ['location_access',         '📍 Location for Hospitals',    'Use your location to find nearby hospitals and pharmacies.', true],
    ].map(([key, label, desc, defaultOn]) => {
      const on = prefs[key] !== undefined ? prefs[key] : defaultOn;
      return `
      <div class="privacy-row">
        <div>
          <div class="privacy-label">${label}</div>
          <div class="privacy-desc">${desc}</div>
        </div>
        <div class="toggle ${on?'':'off'}" id="priv-${key}" onclick="_togglePriv('${key}',this)"></div>
      </div>`;
    }).join('')}
  </div>

  <!-- Security info -->
  <div class="section-title">Security Measures</div>
  <div class="card card-p" style="margin-bottom:16px">
    ${[
      ['🔐','AES-256 Encryption',     'All health data stored in the database is encrypted at rest.'],
      ['🔑','bcrypt Passwords',        'Passwords are hashed with bcrypt (12 rounds) — never stored in plain text.'],
      ['🎟️','JWT Token Rotation',      'Access tokens expire in 15 minutes. Refresh tokens rotate on every use.'],
      ['🛡️','Account Lockout',         'Account locks for 15 minutes after 5 consecutive failed login attempts.'],
      ['📵','PII-Stripped Logs',       'Emails, phone numbers and personal data are automatically removed from server logs.'],
      ['🚫','No Data Selling',         'Your health data is never sold, shared with advertisers, or used for profiling.'],
    ].map(([e,t,d]) => `
      <div class="list-row">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">${e}</span>
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--text)">${t}</div>
            <div style="font-size:11px;color:var(--text-muted)">${d}</div>
          </div>
        </div>
      </div>`).join('')}
  </div>

  <!-- Session management -->
  <div class="section-title">Session Management</div>
  <div class="card card-p" style="margin-bottom:16px">
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">Manage your active sessions across devices.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary" onclick="_logoutAll()">↩ Logout All Devices</button>
    </div>
  </div>

  <!-- Data controls -->
  <div class="section-title">Your Data Rights</div>
  <div class="card card-p" style="margin-bottom:16px">
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
      Under GDPR and Indian PDPB principles, you have the right to access, export, and delete your data.
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary" onclick="navigate('profile'); setTimeout(()=>_exportData?.(),300)">⬇️ Export All My Data</button>
      <button class="btn btn-danger" onclick="_showDeleteAccount()">🗑 Delete My Account</button>
    </div>
  </div>

  <!-- Delete account modal -->
  <div id="delete-modal" style="display:none">
    <div class="card card-p" style="border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.05)">
      <div style="font-size:15px;font-weight:700;color:#f87171;margin-bottom:12px">⚠️ Permanently Delete Account</div>
      <div class="alert alert-red" style="margin-bottom:14px">
        This will permanently delete your account and ALL health data — profile, chat history, appointments, reminders, reports and family profiles. <strong>This cannot be undone.</strong>
      </div>
      <div class="form-group"><label class="form-label">Enter your password to confirm</label>
        <input class="form-input" type="password" id="del-pwd" placeholder="Your current password"></div>
      <div class="form-group"><label class="form-label">Type <strong>DELETE MY ACCOUNT</strong> to confirm</label>
        <input class="form-input" id="del-confirm" placeholder="DELETE MY ACCOUNT"></div>
      <div id="del-err" class="alert alert-red" style="display:none;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-danger" id="del-btn" onclick="_deleteAccount()">🗑 Delete My Account Permanently</button>
        <button class="btn btn-secondary" onclick="_hideDeleteAccount()">Cancel</button>
      </div>
    </div>
  </div>

</div>`;
}

function _togglePriv(key, el) {
  el.classList.toggle('off');
  const on = !el.classList.contains('off');
  const prefs = JSON.parse(localStorage.getItem('hai_privacy_prefs') || '{}');
  prefs[key] = on;
  localStorage.setItem('hai_privacy_prefs', JSON.stringify(prefs));
  showToast(on ? `✅ ${key.replace(/_/g,' ')} enabled` : `${key.replace(/_/g,' ')} disabled`);

  // Sync notification preference to profile
  if (key === 'notifications_enabled') {
    API.profile.update({ notifications_enabled: on }).catch(() => {});
  }
  if (key === 'share_analytics') {
    API.profile.update({ share_data_for_improvement: on }).catch(() => {});
  }
}

async function _logoutAll() {
  if (!confirm('This will sign you out from all devices. Continue?')) return;
  try {
    await API.auth.logoutAll();
    clearSession();
    window.location.href = '/';
  } catch(e) { showToast('Error: ' + e.message); }
}

function _showDeleteAccount() {
  const m = document.getElementById('delete-modal');
  if (m) { m.style.display='block'; m.scrollIntoView({ behavior:'smooth' }); }
}

function _hideDeleteAccount() {
  const m = document.getElementById('delete-modal');
  if (m) m.style.display = 'none';
}

async function _deleteAccount() {
  const pwd     = document.getElementById('del-pwd')?.value;
  const confirm = document.getElementById('del-confirm')?.value;
  const errEl   = document.getElementById('del-err');
  const btn     = document.getElementById('del-btn');

  if (!pwd)     { if(errEl){errEl.style.display='block';errEl.textContent='Password is required.';} return; }
  if (confirm !== 'DELETE MY ACCOUNT') {
    if(errEl){errEl.style.display='block';errEl.textContent='Please type DELETE MY ACCOUNT exactly.';}
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btn)   { btn.disabled=true; btn.textContent='Deleting…'; }

  try {
    await API.auth.delete(pwd, confirm);
    clearSession();
    alert('Your account and all data have been permanently deleted. Goodbye.');
    window.location.href = '/';
  } catch(e) {
    if (errEl) { errEl.style.display='block'; errEl.textContent=e.message; }
    if (btn)   { btn.disabled=false; btn.textContent='🗑 Delete My Account Permanently'; }
  }
}

window.render_privacy       = render_privacy;
window._togglePriv          = _togglePriv;
window._logoutAll           = _logoutAll;
window._showDeleteAccount   = _showDeleteAccount;
window._hideDeleteAccount   = _hideDeleteAccount;
window._deleteAccount       = _deleteAccount;
