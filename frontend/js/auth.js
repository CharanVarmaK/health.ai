/**
 * HealthAI — Authentication Module
 *
 * Handles: login, register, token storage, auto-refresh, redirect to app.
 * Tokens are stored in localStorage (access) + localStorage (refresh).
 * Access token is refreshed automatically 1 minute before expiry.
 * On any 401 from the API, auto-refresh is attempted once before logout.
 */

const AUTH_API = '/api/auth';
const TOKEN_KEY = 'hai_access';
const REFRESH_KEY = 'hai_refresh';
const USER_KEY = 'hai_user';
const EXPIRY_KEY = 'hai_exp';

let _refreshTimer = null;

// ── On page load ──────────────────────────────────────────────────────────────
(function init() {
  // If already authenticated, go straight to app
  if (getAccessToken() && !isTokenExpired()) {
    redirectToApp();
    return;
  }
  // If refresh token exists, try silent refresh before showing login
  if (getRefreshToken()) {
    silentRefresh().then(ok => {
      if (ok) redirectToApp();
    });
  }
})();

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  clearAllErrors();
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  clearAllErrors();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  let valid = true;

  if (!email || !isValidEmail(email)) {
    showFieldError('err-login-email', 'Enter a valid email address');
    valid = false;
  }
  if (!password) {
    showFieldError('err-login-password', 'Enter your password');
    valid = false;
  }
  if (!valid) return;

  setLoading('btn-login', true);

  try {
    const data = await apiPost(`${AUTH_API}/login`, { email, password });
    saveSession(data.tokens, data.user);
    redirectToApp();
  } catch (err) {
    showGlobalError('err-login-global', err.message || 'Login failed. Please try again.');
  } finally {
    setLoading('btn-login', false);
  }
}

// ── Register ──────────────────────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  clearAllErrors();

  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const agreed = document.getElementById('reg-agree').checked;
  let valid = true;

  if (!name || name.length < 2) {
    showFieldError('err-reg-name', 'Enter your name (at least 2 characters)');
    valid = false;
  }
  if (!email || !isValidEmail(email)) {
    showFieldError('err-reg-email', 'Enter a valid email address');
    valid = false;
  }
  if (!password) {
    showFieldError('err-reg-password', 'Create a password');
    valid = false;
  }
  if (password && confirm !== password) {
    showFieldError('err-reg-confirm', 'Passwords do not match');
    valid = false;
  }
  if (!agreed) {
    showFieldError('err-reg-agree', 'You must agree to the Privacy Policy');
    valid = false;
  }
  if (!valid) return;

  setLoading('btn-register', true);

  try {
    const data = await apiPost(`${AUTH_API}/register`, {
      email,
      password,
      display_name: name,
    });
    saveSession(data.tokens, data.user);
    redirectToApp();
  } catch (err) {
    showGlobalError('err-reg-global', err.message || 'Registration failed. Please try again.');
  } finally {
    setLoading('btn-register', false);
  }
}

// ── Session management ────────────────────────────────────────────────────────
function saveSession(tokens, user) {
  localStorage.setItem(TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Store expiry timestamp (ms)
  const expMs = Date.now() + (tokens.expires_in * 1000);
  localStorage.setItem(EXPIRY_KEY, expMs.toString());
  scheduleRefresh(tokens.expires_in);
}

function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}
function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}'); }
  catch { return {}; }
}

function isTokenExpired() {
  const exp = parseInt(localStorage.getItem(EXPIRY_KEY) || '0', 10);
  return Date.now() > exp - 30000; // treat as expired 30s early
}

function clearSession() {
  [TOKEN_KEY, REFRESH_KEY, USER_KEY, EXPIRY_KEY].forEach(k => localStorage.removeItem(k));
  if (_refreshTimer) clearTimeout(_refreshTimer);
}

// Auto-refresh: schedule a refresh 60 seconds before expiry
function scheduleRefresh(expiresInSeconds) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const delay = Math.max((expiresInSeconds - 60) * 1000, 5000);
  _refreshTimer = setTimeout(silentRefresh, delay);
}

async function silentRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const data = await apiPost(`${AUTH_API}/refresh`, { refresh_token: refreshToken });
    saveSession(data.tokens, getUser());
    return true;
  } catch {
    clearSession();
    return false;
  }
}

// Called from app.js on logout
async function logout() {
  const rt = getRefreshToken();
  if (rt) {
    try {
      await apiPost(`${AUTH_API}/logout`, { refresh_token: rt });
    } catch (_) { /* best effort */ }
  }
  clearSession();
  window.location.href = '/';
}

// ── Redirect ──────────────────────────────────────────────────────────────────
function redirectToApp() {
  window.location.href = '/app.html';
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    // Extract the most useful error message
    const msg = json?.error?.message
      || json?.detail
      || (Array.isArray(json?.detail) ? json.detail.map(d => d.msg).join('. ') : null)
      || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

// ── Password strength meter ───────────────────────────────────────────────────
function checkPasswordStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const fill = document.getElementById('pwd-fill');
  const label = document.getElementById('pwd-label');
  if (!fill || !label) return;

  const levels = [
    { pct: '0%',   color: 'transparent', text: '' },
    { pct: '20%',  color: '#ef4444',     text: 'Very weak' },
    { pct: '40%',  color: '#f59e0b',     text: 'Weak' },
    { pct: '60%',  color: '#f59e0b',     text: 'Fair' },
    { pct: '80%',  color: '#16a37a',     text: 'Strong' },
    { pct: '100%', color: '#059669',     text: 'Very strong ✓' },
  ];

  const lvl = levels[Math.min(score, 5)];
  fill.style.width = pwd ? lvl.pct : '0%';
  fill.style.background = lvl.color;
  label.textContent = pwd ? lvl.text : '';
  label.style.color = lvl.color;
}

// ── Password visibility toggle ────────────────────────────────────────────────
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  // Update icon
  const svg = btn.querySelector('svg');
  if (svg) {
    svg.innerHTML = show
      ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>';
  }
}

// ── Validation helpers ────────────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
  // Highlight the nearest input
  const input = el?.previousElementSibling?.querySelector?.('input') || el?.previousElementSibling;
  if (input && input.tagName === 'INPUT') input.classList.add('error');
}

function showGlobalError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearAllErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
}

// ── Loading state ─────────────────────────────────────────────────────────────
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  if (text) text.style.opacity = loading ? '0' : '1';
  if (spinner) spinner.classList.toggle('hidden', !loading);
}

// ── Forgot password placeholder ───────────────────────────────────────────────
function showForgotPassword() {
  alert('Password reset: enter your email and check your inbox.\n\n(Email reset will be available once SMTP is configured in .env)');
}

// ── Modals ────────────────────────────────────────────────────────────────────
function showPrivacyNote() {
  document.getElementById('modal-privacy').classList.remove('hidden');
  document.getElementById('modal-backdrop').classList.remove('hidden');
}
function closeModal() {
  document.querySelectorAll('.mini-modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('modal-backdrop').classList.add('hidden');
}
