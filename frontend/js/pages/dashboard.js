async function render_dashboard(container) {
  container.innerHTML = `<div class="alert alert-green">Loading dashboard…</div>`;
  let profile = {}, appointments = [], reminders = [];
  try {
    const [pr, ar, rr] = await Promise.all([
      API.profile.get(),
      API.get('/api/appointments?status_filter=upcoming&limit=3'),
      API.get('/api/reminders'),
    ]);
    profile = pr.profile || {};
    appointments = ar.appointments || [];
    reminders = (rr.reminders || []).filter(r => r.is_active).slice(0,4);
  } catch(e) { /* non-fatal — show whatever loaded */ }

  const user = getUser();
  const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
  const meds = Array.isArray(profile.current_medications) ? profile.current_medications : [];

  const nextAppt = appointments[0];
  const bannerHtml = nextAppt
    ? `<div class="alert alert-amber">📅 Next appointment: <strong>${nextAppt.doctor_name}</strong> — ${nextAppt.specialty} on <strong>${nextAppt.appointment_date}</strong> at ${nextAppt.appointment_time} · ${nextAppt.hospital_name}</div>`
    : '';

  container.innerHTML = `
${bannerHtml}
<div class="g4" style="margin-bottom:16px">
  <div class="stat"><div class="stat-icon">❤️</div><div class="stat-label">Blood Pressure</div>
    <div class="stat-value" style="font-size:18px;color:${profile.blood_pressure?'#fbbf24':'var(--text-muted)'}">${profile.blood_pressure||'Not set'}</div>
    <div class="stat-sub">${profile.blood_pressure?'⚠️ Monitor':'Update in profile'}</div></div>
  <div class="stat"><div class="stat-icon">💊</div><div class="stat-label">Medicines</div>
    <div class="stat-value">${meds.length}</div><div class="stat-sub">Active</div></div>
  <div class="stat"><div class="stat-icon">📅</div><div class="stat-label">Appointments</div>
    <div class="stat-value">${appointments.length}</div><div class="stat-sub">Upcoming</div></div>
  <div class="stat"><div class="stat-icon">👨‍👩‍👧</div><div class="stat-label">Conditions</div>
    <div class="stat-value">${conditions.length||'—'}</div><div class="stat-sub">${conditions[0]||'None on record'}</div></div>
</div>

<div class="g2" style="margin-bottom:16px">
  <div>
    <div class="section-title">Quick Actions</div>
    <div class="g2">
      ${[
        ['🩺','Symptom Checker','Check your symptoms','symptom'],
        ['🏥','Find Hospitals','Nearby with ratings','hospitals'],
        ['📅','Book Appointment','Schedule a doctor visit','appointments'],
        ['📄','Health Report','Download your report','reports'],
      ].map(([icon,title,desc,page])=>`
        <button class="card card-p" style="text-align:left;cursor:pointer;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);transition:border-color .15s" onclick="navigate('${page}')" onmouseover="this.style.borderColor='var(--green)'" onmouseout="this.style.borderColor='var(--border)')">
          <div style="font-size:22px;margin-bottom:6px">${icon}</div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${title}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${desc}</div>
        </button>`).join('')}
    </div>
  </div>
  <div>
    <div class="section-title">Today's Reminders</div>
    <div class="card card-p">
      ${reminders.length ? reminders.map(r=>`
        <div class="list-row">
          <div><span style="font-size:18px;margin-right:8px">${r.icon}</span>
            <span style="font-weight:500;color:var(--text)">${r.name}</span></div>
          <div style="font-size:12px;font-weight:600;color:var(--green)">${r.reminder_time}</div>
        </div>`).join('') : '<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:16px">No active reminders.<br><button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="navigate(\'reminders\')">+ Add Reminder</button></div>'}
      ${reminders.length ? `<div style="margin-top:10px"><button class="btn btn-secondary btn-sm" onclick="navigate('reminders')">Manage →</button></div>` : ''}
    </div>
  </div>
</div>

<div class="section-title">Health Metrics</div>
<div class="metrics-grid" style="margin-bottom:16px">
  ${[
    ['Blood Pressure', profile.blood_pressure||'—', profile.blood_pressure?'caution':'normal'],
    ['Heart Rate',     profile.heart_rate||'—',     'normal'],
    ['Temperature',    profile.temperature||'—',    'normal'],
    ['SpO₂',           profile.spo2||'—',           'normal'],
    ['Blood Glucose',  profile.blood_glucose||'—',  'normal'],
    ['Cholesterol',    profile.cholesterol||'—',    'normal'],
  ].map(([lbl,val,st])=>`
    <div class="metric">
      <div class="metric-val">${val}</div>
      <div class="metric-lbl">${lbl}</div>
      <div class="metric-status ms-${st}">${st==='normal'?'✅ Normal':st==='caution'?'⚠️ Monitor':'🔴 Alert'}</div>
    </div>`).join('')}
</div>
<button class="btn btn-secondary btn-sm" onclick="navigate('profile')">Update Metrics →</button>`;
}
window.render_dashboard = render_dashboard;
