const TIPS_DB=[
  {e:"🥗",t:"Eat a rainbow of vegetables",b:"Aim for 5 different coloured vegetables daily. Dark greens (spinach, broccoli) are rich in iron and folate. Each colour provides unique antioxidants.",cat:"Nutrition"},
  {e:"💧",t:"Hydrate consistently",b:"Drink 8–10 glasses (2–2.5 litres) daily. Start mornings with warm water. Proper hydration supports kidney function, digestion and skin health.",cat:"Hydration"},
  {e:"🏃",t:"Move 30 minutes daily",b:"Regular moderate exercise reduces heart disease risk by 35%, type 2 diabetes by 50%. Even a brisk 30-minute walk counts. Start small.",cat:"Exercise"},
  {e:"😴",t:"Prioritise 7–9 hours of sleep",b:"Sleep deprivation raises diabetes and heart disease risk. Maintain consistent sleep/wake times. Avoid screens 1 hour before bed.",cat:"Sleep"},
  {e:"🧘",t:"Practice stress management",b:"Chronic stress raises cortisol causing inflammation. Try 10 minutes of meditation or 4-7-8 breathing daily. Apps like HeadSpace help.",cat:"Mental Health"},
  {e:"🦷",t:"Dental health = heart health",b:"Poor oral hygiene is linked to heart disease. Brush twice daily, floss once. Visit dentist every 6 months.",cat:"Prevention"},
  {e:"☀️",t:"Get morning sunlight",b:"15–20 minutes of morning sunlight produces Vitamin D and sets circadian rhythm for better sleep. Also supports immunity and bone health.",cat:"Lifestyle"},
  {e:"🩺",t:"Annual preventive checkups",b:"Detect problems early. For adults: BP monitoring, blood sugar, lipid profile, eye and dental exam annually.",cat:"Prevention"},
  {e:"🚭",t:"Avoid tobacco completely",b:"Smoking damages nearly every organ. Within 20 minutes of quitting, heart rate and BP begin to normalise. It's never too late.",cat:"Lifestyle"},
  {e:"🍷",t:"Limit alcohol intake",b:"If you drink, limit to 1 drink/day (women) or 2 (men). Excess alcohol raises BP, damages liver and disrupts sleep.",cat:"Lifestyle"},
];

function render_tips(container){
  const cats=['All',...new Set(TIPS_DB.map(t=>t.cat))];
  container.innerHTML=`
<div style="max-width:820px">
  <div class="tabs" id="tips-tabs">
    ${cats.map((c,i)=>`<div class="tab${i===0?' active':''}" onclick="_filterTips('${c}',this)">${c}</div>`).join('')}
  </div>
  <div id="tips-list">${TIPS_DB.map(t=>_tipCard(t)).join('')}</div>
  <div class="section-title" style="margin-top:20px">Get Personalised Tips</div>
  <div class="card card-p">
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Get AI-powered health tips tailored to your profile and conditions.</div>
    <button class="btn btn-primary" onclick="askAI('Give me personalised health tips and lifestyle advice based on my health profile')">✨ Get My Personalised Tips</button>
  </div>
</div>`;
}

function _tipCard(t){
  return `<div class="tip-card" data-cat="${t.cat}">
  <div class="tip-icon">${t.e}</div>
  <div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <div class="tip-title">${t.t}</div>
      <span class="tag tag-green" style="font-size:10px">${t.cat}</span>
    </div>
    <div class="tip-body">${t.b}</div>
    <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="askAI('Tell me more about this health tip: ${t.t}')">Learn more</button>
  </div>
</div>`;
}

function _filterTips(cat,tabEl){
  document.querySelectorAll('#tips-tabs .tab').forEach(t=>t.classList.remove('active'));
  tabEl.classList.add('active');
  const list=document.getElementById('tips-list');
  if(!list)return;
  const f=cat==='All'?TIPS_DB:TIPS_DB.filter(t=>t.cat===cat);
  list.innerHTML=f.map(t=>_tipCard(t)).join('');
}

window.render_tips=render_tips;
window._filterTips=_filterTips;
