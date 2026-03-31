let _breathTimer=null;
function render_mental(container){
  container.innerHTML=`
<div style="max-width:820px">
  <div class="card card-p" style="background:rgba(22,163,122,.08);border-color:rgba(22,163,122,.3);margin-bottom:16px">
    <div style="font-size:28px;margin-bottom:8px">💚</div>
    <div style="font-size:18px;font-weight:600;color:var(--text);margin-bottom:8px">Your mental health matters</div>
    <div style="font-size:13px;color:var(--text-muted);line-height:1.7;margin-bottom:14px">It's okay to seek help. You are not alone, and support is available. Talk to HealthAI or connect with a professional counsellor below.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="askAI('I need mental health support and guidance')">💬 Talk to AI</button>
      <a href="tel:9152987821" class="btn btn-secondary">📞 iCall Now</a>
    </div>
  </div>

  <div class="g2" style="margin-bottom:16px">
    <div>
      <div class="section-title">4-7-8 Breathing Exercise</div>
      <div class="card card-p">
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">Activates the parasympathetic nervous system, reducing anxiety in minutes.</div>
        <div class="g3" style="text-align:center;margin-bottom:14px">
          <div class="stat"><div class="stat-value" style="color:var(--green)">4</div><div class="stat-label">Inhale (counts)</div></div>
          <div class="stat"><div class="stat-value" style="color:#fbbf24">7</div><div class="stat-label">Hold (counts)</div></div>
          <div class="stat"><div class="stat-value" style="color:#60a5fa">8</div><div class="stat-label">Exhale (counts)</div></div>
        </div>
        <button class="btn btn-primary btn-block" id="breathe-btn" onclick="_toggleBreathe()">▶ Start Breathing Exercise</button>
        <div id="breathe-fb" style="margin-top:12px;text-align:center;font-size:18px;font-weight:600;min-height:28px;color:var(--green)"></div>
      </div>
    </div>
    <div>
      <div class="section-title">Mood Tracker</div>
      <div class="card card-p">
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">How are you feeling today?</div>
        <div style="display:flex;flex-direction:column;gap:7px">
          ${['😊 Great','🙂 Good','😐 Okay','😔 Low','😢 Not well'].map(m=>`
            <button class="btn btn-secondary" onclick="_trackMood('${m}',this)" style="justify-content:flex-start">${m}</button>`).join('')}
        </div>
        <div id="mood-result" style="margin-top:12px"></div>
      </div>
    </div>
  </div>

  <div class="section-title">Crisis Helplines — Free & Confidential</div>
  <div class="card card-p" style="margin-bottom:16px">
    ${[
      ["iCall (TISS)","9152987821","Professional counselling","Mon–Sat, 8am–10pm"],
      ["Vandrevala Foundation","1860-2662-345","24/7 mental health support","24/7"],
      ["NIMHANS Helpline","080-46110007","National mental health institute","Mon–Sat, 8am–10pm"],
      ["National Helpline","14416","Govt mental health helpline","24/7"],
    ].map(([name,num,desc,hrs])=>`
      <div class="list-row">
        <div><div style="font-size:13px;font-weight:500;color:var(--text)">${name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${desc} · ${hrs}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--green)">${num}</span>
          <a href="tel:${num.replace(/[^0-9]/g,'')}" class="btn btn-primary btn-sm">📞</a>
        </div>
      </div>`).join('')}
  </div>

  <div class="section-title">Self-Care Tips</div>
  <div class="g2">
    ${[
      ['🚶','Daily walks','Even 20 min of walking reduces anxiety and boosts endorphins significantly.'],
      ['📔','Journaling','Writing thoughts helps process emotions and reduce mental clutter.'],
      ['👥','Stay connected','Regular contact with friends and family is vital for mental wellbeing.'],
      ['📵','Digital detox','1 hour offline before bed improves sleep quality and overall mood.'],
    ].map(([e,t,b])=>`
      <div class="tip-card"><div class="tip-icon">${e}</div>
        <div><div class="tip-title">${t}</div><div class="tip-body">${b}</div></div>
      </div>`).join('')}
  </div>
</div>`;
}

function _toggleBreathe(){
  if(_breathTimer){clearTimeout(_breathTimer);_breathTimer=null;document.getElementById('breathe-btn').textContent='▶ Start Breathing Exercise';document.getElementById('breathe-fb').textContent='';return;}
  document.getElementById('breathe-btn').textContent='⏹ Stop';
  const phases=[{t:'Breathe IN…',d:4000,c:'var(--green)'},{t:'Hold…',d:7000,c:'#fbbf24'},{t:'Breathe OUT…',d:8000,c:'#60a5fa'}];
  let i=0;
  function next(){const p=phases[i%3];const fb=document.getElementById('breathe-fb');if(fb){fb.style.color=p.c;fb.textContent=p.t;}i++;_breathTimer=setTimeout(next,p.d);}
  next();
}

function _trackMood(mood,btn){
  document.querySelectorAll('#page-mental .btn-secondary').forEach(b=>b.style.background='');
  btn.style.background='rgba(22,163,122,.15)';
  const r={
    '😊 Great':'Wonderful! Keep doing what you\'re doing. Share your positivity today.',
    '🙂 Good':'Great to hear. Maintain your routines and take care of yourself.',
    '😐 Okay':'It\'s okay to just be okay. A short walk or calling someone you love can help.',
    '😔 Low':'Sorry you\'re feeling low. Consider talking to someone — a friend or our AI. You matter.',
    '😢 Not well':'Thank you for sharing. Please reach out to iCall (9152987821) or talk to our AI. You are not alone.',
  };
  const isDistress=mood.includes('Low')||mood.includes('Not well');
  const res=document.getElementById('mood-result');
  if(res) res.innerHTML=`<div class="alert ${isDistress?'alert-amber':'alert-green'}">${r[mood]||''}</div>`;
  const saved=JSON.parse(localStorage.getItem('hai_moods')||'[]');
  saved.push({mood,date:new Date().toISOString()});
  localStorage.setItem('hai_moods',JSON.stringify(saved.slice(-30)));
}

window.render_mental=render_mental;
window._toggleBreathe=_toggleBreathe;
window._trackMood=_trackMood;
