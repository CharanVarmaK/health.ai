/**
 * HealthAI App Core
 * Navigation, state management, toast, emergency modal,
 * voice init, token auto-refresh, profile bootstrap.
 */

// ── State ─────────────────────────────────────────────────────────────────────
const AppState = {
  currentPage: null,
  user: null,
  profile: null,
  language: 'en',
  sessionId: null,   // current chat session
  voiceActive: false,
  recognition: null,
  synth: window.speechSynthesis || null,
};

// Page title map
const PAGE_TITLES = {
  chat:         'AI Chat',
  dashboard:    'Dashboard',
  symptom:      'Symptom Checker',
  hospitals:    'Nearby Hospitals',
  pharmacy:     'Pharmacies',
  medicines:    'Medicine Info',
  diseases:     'Disease Awareness',
  mental:       'Mental Health',
  tips:         'Health Tips',
  appointments: 'Appointments',
  profile:      'My Profile',
  family:       'Family Profiles',
  reminders:    'Reminders',
  reports:      'Health Reports',
  privacy:      'Privacy & Security',
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Verify token, redirect if missing
  const token = localStorage.getItem('hai_access');
  if (!token) { window.location.href = '/'; return; }

  // Load user info
  try {
    const me = await API.auth.me();
    AppState.user = me.user;
  } catch {
    clearSession();
    window.location.href = '/';
    return;
  }

  // Load profile
  try {
    const pr = await API.profile.get();
    AppState.profile = pr.profile;
    AppState.language = pr.profile?.language || 'en';
  } catch (_) { /* profile load failure is non-fatal */ }

  // Update UI
  _updateNavProfile();
  _setLanguageSelector();
  _initVoice();
  _scheduleTokenRefresh();

  // Route to page from URL hash or default to chat
  const hash = window.location.hash.slice(1) || 'chat';
  navigate(hash in PAGE_TITLES ? hash : 'chat');
});

window.addEventListener('hashchange', () => {
  const page = window.location.hash.slice(1);
  if (page && page in PAGE_TITLES && page !== AppState.currentPage) {
    navigate(page);
  }
});

// ── Navigation ────────────────────────────────────────────────────────────────
function navigate(page) {
  if (!(page in PAGE_TITLES)) page = 'chat';

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update title
  document.getElementById('topbar-title').textContent = PAGE_TITLES[page];
  document.title = `HealthAI — ${PAGE_TITLES[page]}`;
  window.location.hash = page;

  // Render page
  const container = document.getElementById('pages');
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'page-wrap';
  container.appendChild(wrap);

  const renderer = window[`render_${page}`];
  if (typeof renderer === 'function') {
    renderer(wrap);
  } else {
    wrap.innerHTML = `<div class="alert alert-amber">Page "${page}" not loaded yet.</div>`;
  }

  AppState.currentPage = page;
  closeSidebar();
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').style.display = 'block';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').style.display = 'none';
}

// ── Profile UI update ─────────────────────────────────────────────────────────
function _updateNavProfile() {
  const u = AppState.user;
  if (!u) return;
  const initials = (u.display_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const city = AppState.profile?.city || 'Hyderabad, IN';

  const navAv   = document.getElementById('nav-av');
  const navName = document.getElementById('nav-name');
  const navCity = document.getElementById('nav-city');
  const topAv   = document.getElementById('topbar-av');

  if (navAv)   navAv.textContent   = initials;
  if (navName) navName.textContent = u.display_name || 'User';
  if (navCity) navCity.textContent = city;
  if (topAv)   topAv.textContent   = initials;
}

function _setLanguageSelector() {
  const sel = document.getElementById('lang-sel');
  if (sel) sel.value = AppState.language;
}

// ── Language ──────────────────────────────────────────────────────────────────
async function setLanguage(lang) {
  AppState.language = lang;
  try {
    await API.profile.setLanguage(lang);
  } catch (_) { /* non-fatal */ }
  showToast('Language changed');
}

// ── Emergency ─────────────────────────────────────────────────────────────────
function showEmergency() {
  document.getElementById('modal-emergency-bg').classList.remove('hidden');
  document.getElementById('modal-emergency').classList.remove('hidden');
}
function hideEmergency() {
  document.getElementById('modal-emergency-bg').classList.add('hidden');
  document.getElementById('modal-emergency').classList.add('hidden');
}

// Emergency banner (triggered by triage HIGH/CRITICAL from AI chat)
function showEmergencyBanner(msg) {
  const banner = document.getElementById('emergency-banner');
  const text   = document.getElementById('emergency-banner-text');
  if (!banner || !text) return;
  text.innerHTML = msg;
  banner.classList.remove('hidden');
}
function hideEmergencyBanner() {
  document.getElementById('emergency-banner')?.classList.add('hidden');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function doLogout() {
  const rt = localStorage.getItem('hai_refresh');
  try { if (rt) await API.auth.logout(rt); } catch (_) {}
  clearSession();
  window.location.href = '/';
}

// ── Token auto-refresh ────────────────────────────────────────────────────────
function _scheduleTokenRefresh() {
  const exp = parseInt(localStorage.getItem('hai_exp') || '0', 10);
  const delay = Math.max(exp - Date.now() - 60000, 5000);
  setTimeout(async () => {
    const rt = localStorage.getItem('hai_refresh');
    if (!rt) return;
    try {
      const json = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      }).then(r => r.json());
      if (json?.tokens) {
        saveTokens(json.tokens, getUser());
        _scheduleTokenRefresh();
      }
    } catch (_) {}
  }, delay);
}

// ── Voice ─────────────────────────────────────────────────────────────────────
function _initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const r = new SR();
  r.continuous = false;
  r.interimResults = false;
  r.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const inp = document.getElementById('chat-input-el');
    if (inp) inp.value = transcript;
    stopVoice();
    // Trigger send if chat is active
    if (typeof sendChatMessage === 'function') sendChatMessage();
  };
  r.onerror = () => stopVoice();
  r.onend   = () => stopVoice();
  AppState.recognition = r;
}

function toggleVoice() {
  if (AppState.voiceActive) stopVoice();
  else startVoice();
}

function startVoice() {
  if (!AppState.recognition) {
    showToast('Voice input not supported in this browser');
    return;
  }
  const lang_map = { hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN' };
  AppState.recognition.lang = lang_map[AppState.language] || 'en-IN';
  AppState.recognition.start();
  AppState.voiceActive = true;
  document.getElementById('chat-voice-btn')?.classList.add('rec');
  showToast('🎤 Listening… speak now');
}

function stopVoice() {
  AppState.voiceActive = false;
  document.getElementById('chat-voice-btn')?.classList.remove('rec');
  try { AppState.recognition?.stop(); } catch (_) {}
}

function speakText(text) {
  if (!AppState.synth) return;
  AppState.synth.cancel();
  const clean = text.replace(/[*_`#]/g, '').slice(0, 350);
  const u = new SpeechSynthesisUtterance(clean);
  const lang_map = { hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN' };
  u.lang = lang_map[AppState.language] || 'en-IN';
  u.rate = 0.9;
  AppState.synth.speak(u);
}

// ── Utility ───────────────────────────────────────────────────────────────────
function fmtTime(d) {
  return (d ? new Date(d) : new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function nl2br(str) {
  return (str || '').replace(/\n/g, '<br>');
}

// Quick-send from any page to chat
function askAI(question) {
  AppState._pendingQuestion = question;
  navigate('chat');
}

// Expose to pages
window.navigate       = navigate;
window.showEmergency  = showEmergency;
window.hideEmergency  = hideEmergency;
window.showEmergencyBanner = showEmergencyBanner;
window.hideEmergencyBanner = hideEmergencyBanner;
window.showToast      = showToast;
window.doLogout       = doLogout;
window.setLanguage    = setLanguage;
window.toggleVoice    = toggleVoice;
window.startVoice     = startVoice;
window.stopVoice      = stopVoice;
window.speakText      = speakText;
window.fmtTime        = fmtTime;
window.fmtDate        = fmtDate;
window.sanitize       = sanitize;
window.nl2br          = nl2br;
window.askAI          = askAI;
window.AppState       = AppState;
window.openSidebar    = openSidebar;
window.closeSidebar   = closeSidebar;
