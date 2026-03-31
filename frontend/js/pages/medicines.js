// ── Medicine data ─────────────────────────────────────────────────────────────
const MEDICINES_DB = [
  {name:"Paracetamol (Crocin / Dolo)",generic:"Acetaminophen",cat:"Analgesic / Antipyretic",use:"Fever, headache, mild-moderate pain",dose:"500–1000mg every 4–6 hrs (max 4g/day)",sides:"Rare at normal doses; liver damage in overdose",avoid:"Alcohol, liver disease. Never exceed 4g/day",brands:["Crocin","Dolo 650","Calpol","Metacin"]},
  {name:"Ibuprofen",generic:"Ibuprofen",cat:"NSAID",use:"Pain, fever, inflammation, arthritis",dose:"200–400mg every 4–6 hrs (max 1200mg/day OTC)",sides:"Stomach irritation, ulcers, kidney issues, raised BP",avoid:"Peptic ulcer, kidney/heart disease. Take with food",brands:["Brufen","Advil","Ibugesic"]},
  {name:"Amoxicillin",generic:"Amoxicillin trihydrate",cat:"Antibiotic (Penicillin)",use:"Bacterial infections: ear, throat, UTI, chest",dose:"250–500mg 3× daily for 5–10 days as prescribed",sides:"Diarrhoea, nausea, rash; allergic reaction possible",avoid:"Penicillin allergy. Complete full course",brands:["Amoxil","Mox","Novamox"]},
  {name:"Metformin",generic:"Metformin HCl",cat:"Antidiabetic (Biguanide)",use:"Type 2 diabetes, PCOS",dose:"500–1000mg twice daily with meals",sides:"Nausea, diarrhoea, stomach upset. Rare: lactic acidosis",avoid:"Kidney disease, liver disease, contrast dye procedures",brands:["Glycomet","Glucophage","Obimet"]},
  {name:"Amlodipine",generic:"Amlodipine besylate",cat:"Calcium Channel Blocker",use:"Hypertension, angina",dose:"5–10mg once daily",sides:"Ankle swelling, flushing, headache, dizziness",avoid:"Severe hypotension. Avoid grapefruit juice",brands:["Amlip","Stamlo","Amdepin"]},
  {name:"Azithromycin",generic:"Azithromycin dihydrate",cat:"Antibiotic (Macrolide)",use:"Chest infections, throat, STIs",dose:"500mg once daily 3–5 days as prescribed",sides:"Nausea, stomach pain, diarrhoea",avoid:"Do not take with antacids. Complete full course",brands:["Azithral","Zithromax","Aziwin"]},
  {name:"Cetirizine",generic:"Cetirizine HCl",cat:"Antihistamine",use:"Allergies, hay fever, hives, itching",dose:"10mg once daily (evening preferred)",sides:"Drowsiness, dry mouth, headache",avoid:"Heavy machinery. Avoid alcohol",brands:["Cetzine","Alerid","Okacet"]},
  {name:"Omeprazole",generic:"Omeprazole",cat:"Proton Pump Inhibitor",use:"Acidity, GERD, peptic ulcers",dose:"20mg once daily before breakfast",sides:"Headache, diarrhoea, nausea. Long-term: low Mg/B12",avoid:"Long-term use without medical supervision",brands:["Omez","Ocid","Lopraz"]},
  {name:"Montelukast",generic:"Montelukast sodium",cat:"Leukotriene Antagonist",use:"Asthma prevention, seasonal allergies",dose:"10mg once daily in the evening",sides:"Headache, stomach pain, mood changes",avoid:"Report mood/behaviour changes to doctor",brands:["Montair","Singulair","Montek"]},
  {name:"Vitamin D3",generic:"Cholecalciferol",cat:"Vitamin Supplement",use:"Vitamin D deficiency, bone health, immunity",dose:"1000–2000 IU daily (or as prescribed)",sides:"Toxicity at very high doses: nausea, kidney stones",avoid:"High calcium levels. Granulomatous diseases",brands:["D-Rise","Calcirol","Uprise D3"]},
];

function render_medicines(container) {
  container.innerHTML = `
<div style="max-width:820px">
  <div class="alert alert-amber" style="margin-bottom:14px">⚠️ For educational purposes only. Always consult your doctor or pharmacist before taking any medicine.</div>
  <div class="search-bar">
    <input class="search-input" placeholder="Search by name, use, or category…" oninput="_filterMeds(this.value)">
  </div>
  <div id="med-list">
    ${MEDICINES_DB.map(m=>_medCard(m)).join('')}
  </div>
  <div class="section-title" style="margin-top:20px">Drug Interaction Checker</div>
  <div class="card card-p">
    <div class="form-group">
      <label class="form-label">Enter medicine names (comma separated)</label>
      <input class="form-input" id="interact-input" placeholder="e.g. Amlodipine, Metformin, Aspirin">
    </div>
    <button class="btn btn-primary" onclick="_checkInteraction()">🔍 Check Interactions</button>
    <div id="interact-result" style="margin-top:12px"></div>
  </div>
</div>`;
}

function _medCard(m) {
  return `<div class="med-card" onclick="_toggleMed(this)">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div class="med-name">💊 ${m.name}</div>
      <div class="med-generic">${m.generic}</div>
      <span class="tag tag-blue">${m.cat}</span>
    </div>
    <span style="font-size:12px;color:var(--text-muted)">▼</span>
  </div>
  <div class="med-detail">
    ${[['Uses',m.use],['Dosage',m.dose],['Side Effects',m.sides],['Avoid when',m.avoid]]
      .map(([k,v])=>`<div class="list-row"><span class="list-key" style="min-width:110px">${k}</span><span class="list-val" style="text-align:left;font-weight:400;color:var(--text-mid)">${v}</span></div>`).join('')}
    <div style="margin-top:10px"><strong style="font-size:12px;color:var(--text-muted)">Brands: </strong>
      ${m.brands.map(b=>`<span class="tag tag-green" style="margin:2px">${b}</span>`).join('')}
    </div>
    <div style="margin-top:10px">
      <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();askAI('Tell me more about ${m.name} — drug interactions, warnings and special populations')">💬 Ask AI</button>
    </div>
  </div>
</div>`;
}

function _toggleMed(card) {
  const d = card.querySelector('.med-detail');
  const a = card.querySelector('span:last-of-type');
  if(d) { const s=d.style.display==='none'||!d.style.display; d.style.display=s?'block':'none'; if(a) a.textContent=s?'▲':'▼'; }
}

function _filterMeds(q) {
  const lq = q.toLowerCase();
  const list = document.getElementById('med-list');
  if (!list) return;
  const filtered = MEDICINES_DB.filter(m =>
    m.name.toLowerCase().includes(lq)||m.generic.toLowerCase().includes(lq)||m.use.toLowerCase().includes(lq)||m.cat.toLowerCase().includes(lq)
  );
  list.innerHTML = filtered.map(m=>_medCard(m)).join('') || '<div class="alert alert-amber">No medicines found.</div>';
}

function _checkInteraction() {
  const val = document.getElementById('interact-input')?.value?.trim();
  const res = document.getElementById('interact-result');
  if (!val) { if(res) res.innerHTML='<div class="alert alert-amber">Enter medicine names to check.</div>'; return; }
  if(res) res.innerHTML=`<div class="alert alert-green">Checking interactions for: <strong>${sanitize(val)}</strong><br><br>
    For a definitive check consult your pharmacist or use:
    <a href="https://www.drugs.com/drug_interactions.html" target="_blank" style="color:var(--green)">drugs.com interaction checker →</a><br><br>
    <button class="btn btn-primary btn-sm" onclick="askAI('Check drug interactions and warnings for: ${sanitize(val)}')">💬 Ask AI for Details</button>
  </div>`;
}

window.render_medicines = render_medicines;
window._toggleMed = _toggleMed;
window._filterMeds = _filterMeds;
window._checkInteraction = _checkInteraction;
