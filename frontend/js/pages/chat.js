/**
 * Chat Page
 * - Real API calls to /api/chat/message
 * - Risk-level banners for HIGH/CRITICAL
 * - Session persistence
 * - Voice input/output
 * - Quick-reply chips
 * - Markdown bold (**text**) rendering
 */

const QUICK_CHIPS = [
  { label: '🤒 Fever & Headache',     msg: 'I have fever and headache since yesterday' },
  { label: '💔 Chest Pain',           msg: 'I have chest pain and discomfort' },
  { label: '🏥 Hospitals Near Me',    msg: 'Find hospitals near me in Hyderabad' },
  { label: '💊 Paracetamol Info',     msg: 'Tell me about Paracetamol — dosage and side effects' },
  { label: '🧠 Mental Health',        msg: 'I am feeling very anxious and stressed' },
  { label: '✨ Health Tips',          msg: 'Give me personalized health tips' },
  { label: '👨‍⚕️ Which Doctor?',    msg: 'What specialist should I see for high blood pressure?' },
  { label: '😴 Sleep Issues',         msg: 'I have been having trouble sleeping for a week' },
];

const GREETINGS = {
  en: 'Namaste! 🙏 I\'m your HealthAI assistant. I can help with symptoms, find hospitals, provide medicine info, mental health support, and much more.\n\nHow can I help you today?',
  hi: 'नमस्ते! 🙏 मैं आपका HealthAI सहायक हूँ। लक्षण जाँच, अस्पताल खोज, दवा जानकारी और मानसिक स्वास्थ्य सहायता में मदद कर सकता हूँ।\n\nआज आपकी कैसे सहायता करूँ?',
  te: 'నమస్కారం! 🙏 నేను మీ HealthAI సహాయకుడిని. లక్షణాల తనిఖీ, ఆసుపత్రుల వెతుకులాట, మందుల సమాచారం అందించగలను.\n\nనేను మీకు ఎలా సహాయం చేయగలను?',
  ta: 'வணக்கம்! 🙏 நான் உங்கள் HealthAI உதவியாளர். அறிகுறி பரிசோதனை, மருத்துவமனை தேடல், மருந்து தகவல் வழங்க முடியும்.\n\nநான் உங்களுக்கு எவ்வாறு உதவலாம்?',
  kn: 'ನಮಸ್ಕಾರ! 🙏 ನಾನು ನಿಮ್ಮ HealthAI ಸಹಾಯಕ. ರೋಗಲಕ್ಷಣ ಪರೀಕ್ಷೆ, ಆಸ್ಪತ್ರೆ ಹುಡುಕಾಟ, ಔಷಧ ಮಾಹಿತಿ ನೀಡಬಲ್ಲೆ.\n\nನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
};

function render_chat(container) {
  container.style.padding = '0';
  container.innerHTML = `
<div class="chat-wrap">
  <div class="chat-msgs" id="chat-msgs"></div>
  <div class="chips" id="chat-chips">
    ${QUICK_CHIPS.map(c => `<div class="chip" onclick="sendQuick(${JSON.stringify(c.msg)})">${c.label}</div>`).join('')}
  </div>
  <div class="chat-input-bar">
    <button class="chat-voice" id="chat-voice-btn" onclick="toggleVoice()" title="Voice input">🎤</button>
    <input class="chat-input" id="chat-input-el"
      placeholder="${GREETINGS[AppState.language] ? 'Describe your symptoms or ask anything…' : 'Ask anything…'}"
      autocomplete="off"
      onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); sendChatMessage(); }" />
    <button class="chat-send" onclick="sendChatMessage()" title="Send">
      <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2"/></svg>
    </button>
  </div>
  <div style="text-align:center;padding:4px 0 8px;font-size:10px;color:var(--text-dim)">
    HealthAI provides guidance, not diagnosis. For emergencies call 108.
  </div>
</div>`;

  // Show greeting
  const greeting = GREETINGS[AppState.language] || GREETINGS.en;
  setTimeout(() => _appendBotMsg(greeting, null), 250);

  // Handle pending question from another page (e.g. "Ask AI" button)
  if (AppState._pendingQuestion) {
    const q = AppState._pendingQuestion;
    AppState._pendingQuestion = null;
    setTimeout(() => {
      const inp = document.getElementById('chat-input-el');
      if (inp) inp.value = q;
      sendChatMessage();
    }, 600);
  }
}

// ── Send message ──────────────────────────────────────────────────────────────
async function sendChatMessage() {
  const inp = document.getElementById('chat-input-el');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';

  // Hide chips after first message
  const chips = document.getElementById('chat-chips');
  if (chips) chips.style.display = 'none';

  _appendUserMsg(text);
  _showTyping();

  try {
    const data = await API.chat.send(text, AppState.sessionId, AppState.language);

    _hideTyping();

    // Store session id
    if (data.session_id) AppState.sessionId = data.session_id;

    const msg = data.message;
    const triage = data.triage;

    _appendBotMsg(msg.content, msg.risk_level);

    // Show emergency banner for critical triage
    if (triage?.is_emergency && triage?.emergency_message) {
      showEmergencyBanner(triage.emergency_message);
    }

    // HIGH risk → show emergency action row
    if (msg.risk_level === 'HIGH' || msg.risk_level === 'CRITICAL' || triage?.is_emergency) {
      _appendEmergencyActions();
    }

  } catch (err) {
    _hideTyping();
    _appendBotMsg(
      err.status === 429
        ? '⏳ You\'re sending messages too quickly. Please wait a moment and try again.'
        : `I\'m having trouble right now. Please try again.\n\nFor emergencies: **Call 108**`,
      null
    );
  }
}

function sendQuick(msg) {
  const inp = document.getElementById('chat-input-el');
  if (inp) inp.value = msg;
  sendChatMessage();
}

// ── Message rendering ─────────────────────────────────────────────────────────
function _appendUserMsg(text) {
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  const initials = (AppState.user?.display_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const div = document.createElement('div');
  div.className = 'msg u';
  div.innerHTML = `
    <div class="msg-av usr">${initials}</div>
    <div class="msg-body">
      <div class="bubble">${sanitize(text)}</div>
      <div class="msg-time">${fmtTime()}</div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function _appendBotMsg(text, riskLevel) {
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;

  // Render markdown bold (**text**)
  const rendered = _renderMarkdown(sanitize(text));

  let riskHtml = '';
  if (riskLevel) {
    const labels = {
      LOW:      '<span class="risk risk-low">✅ Low Risk</span>',
      MEDIUM:   '<span class="risk risk-medium">⚡ Medium Risk — Consult Doctor Soon</span>',
      HIGH:     '<span class="risk risk-high">⚠️ High Risk — See Doctor Today</span>',
      CRITICAL: '<span class="risk risk-critical">🆘 Emergency — Call 108 Now</span>',
    };
    riskHtml = `<div style="margin-top:8px">${labels[riskLevel] || ''}</div>`;
  }

  const div = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = `
    <div class="msg-av bot">AI</div>
    <div class="msg-body">
      <div class="bubble">${rendered}${riskHtml}</div>
      <div class="msg-time">${fmtTime()}</div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function _appendEmergencyActions() {
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;padding:2px 0 2px 42px;';
  div.innerHTML = `
    <button class="btn btn-danger btn-sm" onclick="showEmergency()">🚨 Emergency Contacts</button>
    <button class="btn btn-secondary btn-sm" onclick="navigate('hospitals')">🏥 Find Hospitals</button>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function _showTyping() {
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'msg bot'; div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-av bot">AI</div>
    <div class="msg-body">
      <div class="bubble">
        <div class="typing-wrap">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function _hideTyping() {
  document.getElementById('typing-indicator')?.remove();
}

// Basic markdown: **bold**, *italic*, bullet points, line breaks
function _renderMarkdown(html) {
  return html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^• (.+)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span>•</span><span>$1</span></div>')
    .replace(/^- (.+)$/gm,  '<div style="display:flex;gap:6px;margin:2px 0"><span>•</span><span>$1</span></div>')
    .replace(/\n/g, '<br>');
}

// Expose
window.render_chat      = render_chat;
window.sendChatMessage  = sendChatMessage;
window.sendQuick        = sendQuick;
