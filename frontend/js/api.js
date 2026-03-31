/**
 * HealthAI API Client
 * - Attaches Bearer token to every request
 * - Auto-refreshes token on 401
 * - Retries once after refresh
 * - Throws typed errors for UI to handle
 */

const API_BASE = '';   // Same origin — FastAPI serves both API and frontend

// Token keys (must match auth.js)
const TK  = 'hai_access';
const RTK = 'hai_refresh';
const EXP = 'hai_exp';
const USR = 'hai_user';

let _refreshing = null;   // Promise lock — prevents multiple simultaneous refresh calls

// ── Public helpers ────────────────────────────────────────────────────────────

function getToken()   { return localStorage.getItem(TK); }
function getRefresh() { return localStorage.getItem(RTK); }
function getUser()    { try { return JSON.parse(localStorage.getItem(USR) || '{}'); } catch { return {}; } }

function saveTokens(tokens, user) {
  localStorage.setItem(TK,  tokens.access_token);
  localStorage.setItem(RTK, tokens.refresh_token);
  localStorage.setItem(EXP, (Date.now() + tokens.expires_in * 1000).toString());
  if (user) localStorage.setItem(USR, JSON.stringify(user));
}

function clearSession() {
  [TK, RTK, EXP, USR].forEach(k => localStorage.removeItem(k));
}

function isTokenExpired() {
  const exp = parseInt(localStorage.getItem(EXP) || '0', 10);
  return Date.now() > exp - 30000;  // 30s early
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch(path, options = {}, _retry = true) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(API_BASE + path, {
    ...options,
    headers,
  });

  // 401 → try token refresh once
  if (response.status === 401 && _retry) {
    const refreshed = await _refreshToken();
    if (refreshed) {
      return apiFetch(path, options, false);   // Retry with new token
    } else {
      clearSession();
      window.location.href = '/';
      throw new ApiError('Session expired. Please login again.', 401);
    }
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(`Server error (${response.status})`, response.status);
  }

  if (!response.ok) {
    const msg = json?.error?.message
      || json?.detail
      || (Array.isArray(json?.detail) ? json.detail.map(d => d.msg).join('. ') : null)
      || `Request failed (${response.status})`;
    throw new ApiError(msg, response.status, json?.error);
  }

  return json;
}

async function _refreshToken() {
  // If refresh already in progress, wait for it
  if (_refreshing) return _refreshing;

  const rt = getRefresh();
  if (!rt) return false;

  _refreshing = (async () => {
    try {
      const json = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      }).then(r => r.json());

      if (json?.tokens) {
        saveTokens(json.tokens, getUser());
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshing = null;
    }
  })();

  return _refreshing;
}

// Typed error class
class ApiError extends Error {
  constructor(message, status = 0, detail = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

// ── Convenience methods ───────────────────────────────────────────────────────

const API = {
  get:    (path)         => apiFetch(path, { method: 'GET' }),
  post:   (path, body)   => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)   => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (path, body)   => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(body || {}) }),
  delete: (path)         => apiFetch(path, { method: 'DELETE' }),

  // ── Auth ──
  auth: {
    me:         ()           => API.get('/api/auth/me'),
    logout:     (rt)         => API.post('/api/auth/logout', { refresh_token: rt }),
    logoutAll:  ()           => API.post('/api/auth/logout-all', {}),
    delete:     (pwd, conf)  => apiFetch('/api/auth/account', { method: 'DELETE', body: JSON.stringify({ password: pwd, confirm: conf }) }),
  },

  // ── User Profile ──
  profile: {
    get:          ()      => API.get('/api/users/profile'),
    update:       (data)  => API.put('/api/users/profile', data),
    updateMetrics:(data)  => API.put('/api/users/profile/metrics', data),
    setLanguage:  (lang)  => API.put('/api/users/language', { language: lang }),
    export:       ()      => API.get('/api/users/export'),
  },

  // ── Chat ──
  chat: {
    send:         (msg, sessionId, lang) => API.post('/api/chat/message', { message: msg, session_id: sessionId || null, language: lang || 'en' }),
    sessions:     (limit, offset)        => API.get(`/api/chat/sessions?limit=${limit||20}&offset=${offset||0}`),
    session:      (id)                   => API.get(`/api/chat/sessions/${id}`),
    newSession:   (title, lang)          => API.post('/api/chat/sessions', { title, language: lang || 'en' }),
    deleteSession:(id)                   => API.delete(`/api/chat/sessions/${id}`),
    streamUrl:    (msg, sessionId, lang) => {
      const p = new URLSearchParams({ message: msg, language: lang || 'en' });
      if (sessionId) p.set('session_id', sessionId);
      const token = getToken();
      if (token) p.set('token', token);
      return `/api/chat/stream?${p.toString()}`;
    },
  },
};

// Make available globally
window.API    = API;
window.getUser = getUser;
window.saveTokens = saveTokens;
window.clearSession = clearSession;
window.ApiError = ApiError;
