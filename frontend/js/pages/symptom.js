const SYMP_FLOW = [
  { q:"What is your primary symptom?", field:"primary", opts:[
    {e:"🌡️",v:"Fever"},{e:"🤕",v:"Headache"},{e:"💔",v:"Chest pain"},
    {e:"🤢",v:"Stomach ache"},{e:"😮‍💨",v:"Breathlessness"},{e:"😴",v:"Fatigue"},
    {e:"😷",v:"Cough"},{e:"🌀",v:"Dizziness"},{e:"🦴",v:"Joint pain"},{e:"🔴",v:"Skin rash"},
  ]},
  { q:"How long have you had this?", field:"duration", opts:[
    {e:"⏱️",v:"Less than 24 hours"},{e:"📅",v:"1–3 days"},
    {e:"🗓️",v:"4–7 days"},{e:"📆",v:"More than a week"},{e:"🔄",v:"Recurring"},
  ]},
  { q:"Severity? (1=Mild, 5=Severe)", field:"severity", opts:[
    {e:"🟢",v:"1 — Mild"},{e:"🟡",v:"2 — Noticeable"},
    {e:"🟠",v:"3 — Moderate"},{e:"🔴",v:"4 — Severe"},{e:"🆘",v:"5 — Very severe"},
  ]},
  { q:"Any additional symptoms?", field:"additional", opts:[
    {e:"✅",v:"None"},{e:"🤮",v:"Nausea / vomiting"},
    {e:"🌡️",v:"High fever (>102°F)"},{e:"😮‍💨",v:"Difficulty breathing"},
    {e:"💔",v:"Chest tightness"},{e:"⚫",v:"Dizziness / fainting"},
  ]},
  { q:"Relevant medical history?", field:"history", opts:[
    {e:"✅",v:"None"},{e:"❤️",v:"Hypertension"},
    {e:"🩸",v:"Diabetes"},{e:"💔",v:"Heart disease"},
    {e:"🫁",v:"Asthma / Lung"},{e:"🫘",v:"Kidney disease"},
  ]},
];

const SPECIALIST_MAP = {
  "Chest pain":"Cardiologist","Breathlessness":"Pulmonologist",
  "Headache":"Neurologist / General Physician","Fever":"General Physician",
  "Stomach ache":"Gastroenterologist","Fatigue":"General Physician / Endocrinologist",
  "Cough":"Pulmonologist","Dizziness":"Neurologist / ENT",
  "Joint pain":"Orthopedist / Rheumatologist","Skin rash":"Dermatologist",
};

let _sympStep = 0, _sympAns = {};

function render_symptom(container) {
  _sympStep = 0; _sympAns = {};
  container.innerHTML = `
<div style="max-width:580px">
  <div class="alert alert-blue" style="margin-bottom:16px">
    🩺 Answer 5 quick questions for an AI-powered risk assessment and specialist recommendation.
  </div>
  <div class="card card-p" id="symp-card"></div>
  <div id="symp-result" style="margin-top:16px"></div>
</div>`;
  _renderSympStep();
}

function _renderSympStep() {
  if (_sympStep >= SYMP_FLOW.length) { _showSympResult(); return; }
  const step = SYMP_FLOW[_sympStep];
  const card = document.getElementById('symp-card');
  if (!card) return;

  const dots = SYMP_FLOW.map((_,i) =>
    `<div class="step-dot ${i<_sympStep?'done':i===_sympStep?'cur':''}"></div>`
  ).join('');

  card.innerHTML = `
    <div class="step-track">${dots}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Step ${_sympStep+1} of ${SYMP_FLOW.length}</div>
    <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:16px">${step.q}</div>
    <div id="symp-opts">
      ${step.opts.map(o=>`
        <div class="symp-opt" onclick="_pickSymp(this,'${step.field}','${o.v}')">
          <span style="font-size:18px">${o.e}</span><span>${o.v}</span>
        </div>`).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:14px">
      ${_sympStep>0?'<button class="btn btn-secondary btn-sm" onclick="_sympBack()">← Back</button>':'<div></div>'}
      <button class="btn btn-primary btn-sm" id="symp-next" onclick="_sympNext()" disabled style="opacity:.4">Next →</button>
    </div>`;

  // Warn immediately for chest pain
  if (_sympAns.primary === 'Chest pain' && _sympStep === 0) {
    showEmergencyBanner('⚠️ Chest pain detected — <strong>Call 108</strong> if severe or sudden. Continue assessment or go to emergency now.');
  }
}

function _pickSymp(el, field, val) {
  document.querySelectorAll('.symp-opt').forEach(o=>o.classList.remove('sel'));
  el.classList.add('sel');
  _sympAns[field] = val;
  const btn = document.getElementById('symp-next');
  if (btn) { btn.disabled=false; btn.style.opacity='1'; }
  if (val==='Chest pain'||val==='Difficulty breathing'||val==='5 — Very severe') {
    showEmergencyBanner('⚠️ This symptom may require immediate care. <strong>Call 108</strong> if it is severe or sudden.');
  }
}

function _sympNext() {
  const field = SYMP_FLOW[_sympStep].field;
  if (!_sympAns[field]) { showToast('Please select an option'); return; }
  _sympStep++;
  _renderSympStep();
}

function _sympBack() {
  if (_sympStep > 0) { _sympStep--; _renderSympStep(); }
}

function _showSympResult() {
  const a = _sympAns;
  let score = 0;
  if ((a.primary||'').includes('Chest')) score+=5;
  if ((a.additional||'').includes('breathing')||((a.additional||'').includes('tightness'))) score+=3;
  if ((a.additional||'').includes('fainting')) score+=4;
  if ((a.severity||'').startsWith('4')||(a.severity||'').startsWith('5')) score+=2;
  if ((a.duration||'').includes('week')||(a.duration||'').includes('Recurring')) score+=1;
  if ((a.history||'').includes('Heart')||(a.history||'').includes('Kidney')) score+=1;

  const risk = score>=5?'HIGH':score>=2?'MEDIUM':'LOW';
  const specialist = SPECIALIST_MAP[a.primary] || 'General Physician';

  const riskInfo = {
    HIGH:   {label:'⚠️ High Risk — See Doctor Today',   cls:'risk-high',   action:'Book an appointment today or visit a walk-in clinic.',color:'#ef4444'},
    MEDIUM: {label:'⚡ Medium Risk — Consult Doctor Soon',cls:'risk-medium', action:'Schedule a doctor visit within 24–48 hours.',color:'#f59e0b'},
    LOW:    {label:'✅ Low Risk — Monitor at Home',       cls:'risk-low',    action:'Rest, stay hydrated, monitor symptoms. Consult if worsening.',color:'#16a37a'},
  };
  const ri = riskInfo[risk];

  document.getElementById('symp-card').style.display='none';
  const result = document.getElementById('symp-result');
  result.innerHTML = `
<div class="card card-p" style="border-color:${ri.color}30">
  <div style="margin-bottom:14px">
    <div style="font-size:20px;font-weight:700;color:${ri.color};margin-bottom:4px">${ri.label}</div>
    <div style="font-size:13px;color:var(--text-muted)">${ri.action}</div>
  </div>
  <div class="card card-p" style="background:var(--bg);margin-bottom:14px">
    <div class="card-title">Assessment Summary</div>
    ${[['Primary Symptom',a.primary],['Duration',a.duration],['Severity',a.severity?.split('—')[0]?.trim()],
       ['Additional',a.additional],['History',a.history],['Recommended Specialist',specialist]
    ].map(([k,v])=>`<div class="list-row"><span class="list-key">${k}</span><span class="list-val">${v||'—'}</span></div>`).join('')}
    <div class="list-row"><span class="list-key">Risk Level</span><span class="risk ${ri.cls}">${risk}</span></div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-primary" onclick="navigate('appointments')">📅 Book ${specialist}</button>
    <button class="btn btn-secondary" onclick="askAI('I have ${a.primary||'symptoms'} — ${a.severity||''} severity for ${a.duration||'unknown duration'}. What should I do?')">💬 Ask AI</button>
    ${risk==='HIGH'?'<button class="btn btn-danger" onclick="showEmergency()">🚨 Emergency</button>':''}
    <button class="btn btn-secondary" onclick="render_symptom(document.querySelector('.page-wrap'))">🔄 Start Over</button>
  </div>
</div>`;

  // If AI available, get personalized advice
  setTimeout(()=> askAI(`Based on my symptoms: ${a.primary}, ${a.severity} severity, for ${a.duration}. Additional: ${a.additional}. History: ${a.history}. What do you advise?`), 200);
}

window.render_symptom = render_symptom;
window._pickSymp = _pickSymp;
window._sympNext = _sympNext;
window._sympBack = _sympBack;
