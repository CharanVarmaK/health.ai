const DISEASES_DB=[
  {name:"Hypertension",e:"❤️",cat:"Cardiovascular",desc:"Blood pressure persistently >130/80 mmHg. Major risk factor for heart disease and stroke.",symptoms:["Headache","Dizziness","Blurred vision","Chest pain"],prevention:"Low-sodium diet, exercise, weight management, stress reduction.",treatment:"Lifestyle changes + ACE inhibitors, beta-blockers, calcium channel blockers"},
  {name:"Type 2 Diabetes",e:"🩸",cat:"Metabolic",desc:"Chronic condition affecting blood sugar regulation. Linked to lifestyle factors.",symptoms:["Increased thirst","Frequent urination","Fatigue","Blurred vision","Slow healing"],prevention:"Healthy diet, exercise, maintain healthy weight, annual glucose screening.",treatment:"Diet control, Metformin, other oral agents, insulin if needed"},
  {name:"Asthma",e:"🫁",cat:"Respiratory",desc:"Airways narrow and swell causing breathing difficulty. Triggered by allergens, exercise, cold air.",symptoms:["Wheezing","Cough (especially at night)","Chest tightness","Breathlessness"],prevention:"Avoid triggers, air purifiers, prescribed inhalers, monitor peak flow.",treatment:"Bronchodilators (inhalers), inhaled corticosteroids, avoid triggers"},
  {name:"Dengue Fever",e:"🦟",cat:"Vector-borne",desc:"Mosquito-borne viral infection. Common in tropical India, especially monsoon season.",symptoms:["High fever","Severe headache","Pain behind eyes","Joint/muscle pain","Rash","Nausea"],prevention:"Mosquito repellents, full-sleeve clothing, eliminate standing water, nets.",treatment:"No specific antiviral — rest, fluids, paracetamol. Hospital if severe."},
  {name:"Typhoid",e:"🌡️",cat:"Bacterial",desc:"Salmonella typhi infection through contaminated food/water. Common in India.",symptoms:["Persistent high fever","Headache","Weakness","Abdominal pain","Rose spots"],prevention:"Typhoid vaccine, safe drinking water, food hygiene, handwashing.",treatment:"Antibiotics (Ciprofloxacin, Azithromycin), rest, oral rehydration"},
  {name:"Malaria",e:"🦠",cat:"Parasitic",desc:"Plasmodium parasites via mosquito bites. Can be life-threatening if untreated.",symptoms:["Fever with chills","Sweating","Headache","Nausea","Muscle pain"],prevention:"Mosquito nets, repellents, prophylactic medicines when travelling.",treatment:"Artemisinin-based combination therapy (ACT)"},
  {name:"COVID-19",e:"🦠",cat:"Viral",desc:"SARS-CoV-2 respiratory infection. Ranges from mild to severe.",symptoms:["Fever","Cough","Fatigue","Loss of taste/smell","Breathlessness"],prevention:"Vaccination, masking in crowds, hand hygiene, ventilation.",treatment:"Supportive care; antivirals for high-risk patients"},
  {name:"Common Cold",e:"🤧",cat:"Viral",desc:"Upper respiratory viral infection. Resolves in 7–10 days typically.",symptoms:["Runny nose","Sore throat","Cough","Mild fever","Sneezing"],prevention:"Handwashing, avoid sick contacts, adequate sleep, vitamin C.",treatment:"Rest, hydration, OTC symptom relief (antihistamines, paracetamol)"},
];

function render_diseases(container) {
  container.innerHTML = `
<div style="max-width:820px">
  <div class="search-bar"><input class="search-input" placeholder="Search disease, symptom, or category…" oninput="_filterDis(this.value)"></div>
  <div class="alert alert-blue" style="margin-bottom:14px">🔬 Educational information only. Consult a doctor for diagnosis and treatment.</div>
  <div id="dis-list">${DISEASES_DB.map(d=>_disCard(d)).join('')}</div>
</div>`;
}

function _disCard(d) {
  return `<div class="disease-card" onclick="_toggleDis(this)">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:24px;margin-bottom:4px">${d.e}</div>
      <div class="disease-name">${d.name}</div>
      <span class="tag tag-blue">${d.cat}</span>
    </div>
    <span style="font-size:12px;color:var(--text-muted)">▼</span>
  </div>
  <div class="disease-desc" style="margin-top:8px">${d.desc}</div>
  <div class="dis-detail" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
    <div style="margin-bottom:10px"><strong style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Common Symptoms</strong>
      <div>${d.symptoms.map(s=>`<span class="tag tag-amber" style="margin:2px">${s}</span>`).join('')}</div></div>
    <div class="list-row"><span class="list-key">Prevention</span><span class="list-val" style="text-align:left;font-weight:400;color:var(--text-mid);max-width:65%">${d.prevention}</span></div>
    <div class="list-row"><span class="list-key">Treatment</span><span class="list-val" style="text-align:left;font-weight:400;color:var(--text-mid);max-width:65%">${d.treatment}</span></div>
    <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="event.stopPropagation();askAI('Tell me more about ${d.name} — prevention, risk factors and treatment options in India')">💬 Ask AI</button>
  </div>
</div>`;
}

function _toggleDis(card) {
  const d=card.querySelector('.dis-detail'),a=card.querySelector('span:last-of-type');
  if(d){const s=d.style.display==='none'||!d.style.display;d.style.display=s?'block':'none';if(a)a.textContent=s?'▲':'▼';}
}
function _filterDis(q) {
  const lq=q.toLowerCase(),list=document.getElementById('dis-list');
  if(!list)return;
  const f=DISEASES_DB.filter(d=>d.name.toLowerCase().includes(lq)||d.cat.toLowerCase().includes(lq)||d.symptoms.some(s=>s.toLowerCase().includes(lq)));
  list.innerHTML=f.map(d=>_disCard(d)).join('')||'<div class="alert alert-amber">No results.</div>';
}

window.render_diseases=render_diseases;
window._toggleDis=_toggleDis;
window._filterDis=_filterDis;
