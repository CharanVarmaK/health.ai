<div align="center">

# 🏥 HealthAI

### AI-powered healthcare assistant — built for India, designed for everyone.

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/Gemini-1.5_Flash-4285F4?logo=google&logoColor=white)](https://aistudio.google.com)
[![SQLite](https://img.shields.io/badge/Database-SQLite_%2F_PostgreSQL-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)

**Symptom checker · Hospital finder · Medicine info · Appointments · Mental health support · Family profiles · Encrypted health reports — all in one secure platform.**

[**Live Demo**](#) · [**API Docs**](http://localhost:8000/api/docs) · [**Report a Bug**](#) · [**Request a Feature**](#)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Security & Privacy](#security--privacy)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [User Guide](#user-guide)
- [API Reference](#api-reference)
- [Database](#database)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

HealthAI is a **production-grade, full-stack healthcare companion** that brings together AI-powered symptom analysis, real-time hospital search, medicine information, appointment management, and mental health support in a single secure platform.

Built with privacy at its core — every piece of personal health information (PHI) is **AES-256 encrypted at rest**. No data is sold. No ads. Your health data belongs to you.

### Why HealthAI?

Healthcare information in India is fragmented. Patients struggle to know whether their symptoms need urgent care, which specialist to visit, where the nearest emergency room is, or what their prescribed medication actually does. HealthAI solves all of this in one place, in your language, with AI that knows your medical history.

---

## Features

### 🤖 AI Health Chat
Powered by **Google Gemini 1.5 Flash** (free tier). The AI is given your full health profile — conditions, allergies, current medications — and responds with personalised, contextually-aware guidance. Every response includes an automatic **risk classification** (LOW / MEDIUM / HIGH / CRITICAL).

- Supports **6 languages**: English, हिंदी, తెలుగు, தமிழ், ಕನ್ನಡ, മലയാളം
- **Voice input** via Web Speech API (Chrome, Edge, Safari)
- **Voice output** — AI responses can be read aloud
- Chat history persisted per session, encrypted in database
- Rate limited to prevent abuse (20 messages/minute)

### 🩺 Symptom Checker
5-step guided assessment:
1. Primary symptom selection (10 categories)
2. Duration (< 24h to chronic/recurring)
3. Severity (1–5 scale)
4. Additional symptoms
5. Medical history context

Outputs: **risk level**, **recommended specialist**, and sends a personalised follow-up to the AI chat for detailed advice.

### 🚨 Emergency Triage
**Rule-based pre-triage runs instantly before any AI call.** If the message contains critical keywords (chest pain, difficulty breathing, stroke signs, suicidal ideation), a red emergency banner appears immediately with the relevant emergency number and nearest hospital — no waiting for Gemini.

Critical keyword categories covered:
- Cardiac emergencies
- Respiratory emergencies
- Neurological emergencies (stroke, seizure)
- Severe bleeding
- Anaphylaxis
- Mental health crisis (suicide, self-harm)
- Loss of consciousness

### 🏥 Hospital Finder
- Finds hospitals near the user's saved location
- **Google Places API** integration (if `GOOGLE_MAPS_API_KEY` is set)
- **Curated static fallback** for Hyderabad with 8 major hospitals (works offline)
- Filter by: emergency only, specialty, distance
- One-tap navigation (opens Google Maps with directions)
- Direct call links

### 🏪 Pharmacy Finder
- Nearby pharmacies with delivery status and hours
- Online pharmacy deeplinks (NetMeds, PharmEasy, 1mg)

### 💊 Medicine Database
Built-in database of 10 common medicines (expandable) with:
- Generic name and brand names
- Indications and dosage
- Side effects and contraindications
- Drug interaction checker (AI-powered)

### 📅 Appointments
Full appointment lifecycle management:
- Book with specialty, doctor, hospital, date, time, notes
- Smart suggestions via `<datalist>` (pre-filled hospital names)
- Mark as done / cancel
- Appointment reminder integration

### 🔔 Reminders
- Timed medicine and health reminders
- Browser notification support (requires permission)
- Web Speech API voice reminders
- Frequency options: daily, weekdays, weekends, custom
- Per-reminder toggle (active/paused)

### 👨‍👩‍👧 Family Profiles
- Up to 20 family members per account
- Each member has: name, relation, age, blood group, conditions, allergies, medications
- "Ask AI" button per member — sends contextual query about that family member

### 📄 Health Reports
- Generates full HTML report with all profile data, metrics, and upcoming appointments
- Opens in new tab for immediate printing or Ctrl+P → Save as PDF
- Stored encrypted in database, available for re-download
- Report types: Full, Metrics Summary

### 🧠 Mental Health
- 4-7-8 breathing exercise (interactive, animated)
- Mood tracker (stored locally, 30-day history)
- Crisis helplines: iCall, Vandrevala Foundation, NIMHANS
- Self-care tips
- AI responds with `💚` prefix and crisis resources for distress signals

### ✨ Health Tips
10 evidence-based health tips, filterable by category (Nutrition, Exercise, Sleep, Mental Health, Prevention, Lifestyle, Hydration).

### 🔒 Privacy Controls
- Per-feature privacy toggles
- GDPR Art. 17: full account deletion (CASCADE removes all data)
- GDPR Art. 20: data export as JSON
- Session management (logout all devices)

---

## Tech Stack

### Backend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Web framework | **FastAPI 0.111** | Async, auto-docs, Pydantic validation |
| ASGI server | **Uvicorn** | Production async server |
| Database ORM | **SQLAlchemy 2.0** (async) | Type-safe DB access |
| Database | **SQLite** (dev) / **PostgreSQL** (prod) | Persistent storage |
| Migration | **Alembic** | Schema migrations |
| AI | **Google Gemini 1.5 Flash** | Free-tier LLM |
| Auth | **python-jose** + **passlib** | JWT + bcrypt |
| Encryption | **cryptography (Fernet)** | AES-256 PHI encryption |
| Rate limiting | **slowapi** | Per-IP and per-user limits |
| Scheduling | **APScheduler** | Background token cleanup |
| HTTP client | **httpx** | Async HTTP for external APIs |
| PDF/Reports | **ReportLab** + **Jinja2** | Health report generation |
| Logging | **loguru** | Structured, PII-stripped logs |
| Validation | **Pydantic v2** | Request/response schemas |

### Frontend

| Component | Technology |
|-----------|-----------|
| Framework | Vanilla HTML/CSS/JavaScript (no build tools) |
| Fonts | Google Fonts — Sora + JetBrains Mono |
| Design | Custom dark-themed design system (CSS variables) |
| AI integration | Fetch API with streaming SSE support |
| Voice | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Maps | Google Maps deeplinks (no SDK required) |
| Storage | localStorage for session tokens, mood history, privacy prefs |

### Architecture

```
Browser (HTML/CSS/JS)
        │
        │  HTTPS  JWT Bearer Token
        ▼
┌────────────────────────────────────────────┐
│              FastAPI Application           │
│┌──────────┐  ┌──────────┐  ┌────────────┐  │
││  CORS    │  │Rate Limit│  │  Logging   │  │
││Middleware│  │Middleware│  │ Middleware │  │
│└──────────┘  └──────────┘  └────────────┘  │
│                                            │
│  ┌─────────────────────────────────────┐   │
│  │           API Routers               │   │
│  │  /auth  /users  /chat  /hospitals   │   │
│  │  /appointments  /reminders          │   │
│  │  /family  /reports                  │   │
│  └─────────────────────────────────────┘   │
│                                            │
│  ┌─────────────┐   ┌─────────────────────┐ │
│  │  Services   │   │     Security        │ │
│  │  gemini_ai  │   │  JWT + bcrypt       │ │
│  │  symptom    │   │  AES-256 PHI enc.   │ │
│  │  hospitals  │   │  Rate limiting      │ │
│  │  reports    │   │  Account lockout    │ │
│  └─────────────┘   └─────────────────────┘ │
└────────────────────────────────────────────┘
        │
        │  SQLAlchemy async
        ▼
┌─────────────────┐        ┌───────────────┐
│  SQLite / Neon  │        │ Google Gemini │
│  PostgreSQL     │        │  1.5 Flash    │
│  (encrypted)    │        │  (free tier)  │
└─────────────────┘        └───────────────┘
```

---

## Security & Privacy

HealthAI was designed with healthcare-grade security from day one. The following measures are implemented and active in the current codebase.

### Data Encryption

**All Personal Health Information (PHI) is encrypted at rest** using Fernet symmetric encryption (AES-128-CBC with HMAC-SHA256 authentication — equivalent to AES-256 in security strength when used with a 32-byte key).

Encrypted columns include:
- Full name, date of birth, phone number, address
- Medical conditions, allergies, medications, family history
- Blood pressure, glucose, temperature, all vitals
- Chat message content
- Appointment notes
- Health report content

The encryption key (`ENCRYPTION_KEY`) is separate from the JWT signing key (`SECRET_KEY`). Both are generated locally and never transmitted.

### Password Security
- **bcrypt** with cost factor 12 (~250ms per hash — fast enough for UX, slow enough to resist brute force)
- Passwords are never logged, never returned in API responses, never stored in plain text
- **Constant-time comparison** prevents timing-based password oracle attacks
- **Dummy hash** is run even when the user email doesn't exist — prevents user enumeration via response timing

### Session Management
- **Access tokens**: short-lived JWT (15 minutes), signed with HS256
- **Refresh tokens**: cryptographically random 64-byte URL-safe tokens, stored as SHA-256 hashes
- **Token rotation**: every refresh call revokes the old token and issues a new pair
- **Token revocation**: stored in database — logout immediately invalidates the token server-side
- **Replay detection**: presenting a revoked refresh token is logged as a potential theft event

### Account Protection
- **Account lockout**: 5 consecutive failed login attempts → 15-minute lock
- **Rate limiting**: 5 req/min for register, 10 req/min for login, 20 req/min for AI chat, 60 req/min general
- Limits are per-IP for unauthenticated routes, per-user for authenticated routes

### Input Security
- **Pydantic v2** validates every request body with strict type enforcement
- **XSS prevention**: all user-supplied strings are sanitised before rendering in frontend (`sanitize()` function wraps `textContent` assignment)
- **SQL injection**: SQLAlchemy ORM — zero raw SQL queries anywhere in the codebase
- **CORS**: locked to configured origins only

### Logging & Privacy
- **PII stripping**: email addresses, phone numbers, tokens, and passwords are redacted from log output via a `loguru` filter before writing to disk
- Logs are rotated at 10MB and retained for 30 days

### GDPR Compliance
| Right | Implementation |
|-------|----------------|
| Art. 17 — Right to erasure | `DELETE /api/auth/account` — CASCADE deletes every record |
| Art. 20 — Data portability | `GET /api/users/export` — returns all data as JSON |
| Art. 7 — Consent | Privacy toggles per-feature in Privacy page |
| Art. 25 — Privacy by design | PHI encrypted by default; analytics opt-in (off by default) |

---

## Quick Start

### Prerequisites
- **Python 3.11+** — https://python.org
- **Gemini API Key** (free) — https://aistudio.google.com → "Get API key"

### Installation

```bash
# 1. Clone / download and enter the project
cd healthai

# 2. Create virtual environment
python3 -m venv venv

# 3. Activate
source venv/bin/activate        # Linux / Mac
venv\Scripts\activate           # Windows

# 4. Install dependencies
pip install -r backend/requirements.txt

# 5. Generate .env with secure auto-generated keys
cd backend
python create_env.py

# 6. Add your Gemini API key to .env
# Open .env in any text editor and set:
# GEMINI_API_KEY=your_key_here

# 7. Start the server
python main.py
```

Open **http://127.0.0.1:8000** in your browser.

---

## Configuration

All configuration lives in `.env` (root of the project). Copy from `.env.example`.

### Required Variables

| Variable | Description | How to get |
|----------|-------------|-----------|
| `SECRET_KEY` | JWT signing key | Auto-generated by `create_env.py` |
| `ENCRYPTION_KEY` | PHI encryption key | Auto-generated by `create_env.py` |
| `GEMINI_API_KEY` | Google Gemini API key | https://aistudio.google.com |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./healthai.db` | Change to PostgreSQL for production |
| `APP_HOST` | `127.0.0.1` | Bind `0.0.0.0` to expose on network |
| `APP_PORT` | `8000` | HTTP port |
| `APP_ENV` | `development` | Set `production` to disable API docs |
| `GOOGLE_MAPS_API_KEY` | _(empty)_ | Enables live hospital search via Google Places |
| `ALLOWED_ORIGINS` | `http://localhost:8000` | CORS origins, comma-separated |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |

---

## User Guide

### Registration & Login

1. Open **http://127.0.0.1:8000**
2. Click **Create Account**, enter your name, email, and a strong password
   - Password must be ≥ 8 characters with uppercase, lowercase, number, and symbol
3. You are automatically logged in and taken to the app

### Setting Up Your Profile

**Go to: My Profile → Edit Profile**

Fill in as much as you can — the AI uses your profile to personalise every response:
- Age, gender, blood group
- **Existing conditions** (e.g. Hypertension, Asthma) — comma-separated
- **Allergies** (e.g. Penicillin, Dust mites) — comma-separated  
- **Current medications** (e.g. Amlodipine 5mg) — comma-separated
- Emergency contact name and phone

**Update Health Metrics** — click "Update Metrics" on the profile page to record your latest BP, glucose, SpO₂, etc.

### Using the AI Chat

1. Go to **AI Chat** (home page after login)
2. Type your symptoms, questions, or health concerns
3. The AI responds with:
   - Contextual guidance using your health profile
   - A **risk badge** (✅ Low / ⚡ Medium / ⚠️ High / 🆘 Emergency)
   - Recommended next steps
4. **Quick chips** at the top suggest common queries
5. **Voice input**: click the 🎤 button and speak your symptoms (Chrome/Edge/Safari)
6. **Language**: change language using the dropdown in the sidebar — the AI will respond in your language

### Symptom Checker

1. Go to **Symptom Checker**
2. Answer 5 questions:
   - Primary symptom → Duration → Severity (1–5) → Additional symptoms → Medical history
3. View your **risk assessment** with recommended specialist
4. Click **Book [Specialist]** to go directly to appointment booking, or **Ask AI** to continue the conversation

### Finding Hospitals

1. Go to **Hospitals**
2. Hospitals are listed sorted by distance (based on your saved city)
3. Filter by specialty or check **Emergency only**
4. Click **📞 Phone** to call directly
5. Click **🗺️ Navigate** to open Google Maps with turn-by-turn directions

### Booking an Appointment

1. Go to **Appointments** → click **+ Book Appointment**
2. Select specialty, enter doctor name (optional), hospital name
3. Choose date and time
4. Add notes about your symptoms or reason for visit
5. Click **✅ Confirm Booking**
6. Mark as **✓ Done** after the visit, or **Cancel** if needed

### Managing Reminders

1. Go to **Reminders** → click **+ Add Reminder**
2. Enter medicine name, select icon, set time and frequency
3. Click the **toggle** on any reminder to pause/resume
4. Click **Enable Notifications** to get browser alerts

> Voice reminders: if your device supports it, the app will speak the reminder aloud at the set time.

### Family Profiles

1. Go to **Family** → click **+ Add Member**
2. Enter name, relation, age, conditions, allergies, medications
3. Use the **💬 Ask AI** button on any family card to get health advice for that specific family member

### Generating Health Reports

1. Go to **Health Reports**
2. Click **Full Health Report** or **Metrics Summary**
3. The report opens in a new browser tab
4. Press **Ctrl+P** (or Cmd+P on Mac) → **Save as PDF**

### Mental Health Support

1. Go to **Mental Health**
2. **Breathing exercise**: click ▶ Start — follow the 4-7-8 pattern (inhale 4, hold 7, exhale 8)
3. **Mood tracker**: tap how you feel today — stored for 30 days
4. **Helplines**: tap 📞 to call any crisis helpline directly

### Privacy & Data Control

1. Go to **Privacy** to toggle features on/off
2. **Export your data**: click ⬇️ Export All My Data — downloads your complete health record as JSON
3. **Delete account**: click 🗑 Delete My Account, enter password and confirmation text — permanently deletes all data

---

## API Reference

Interactive API documentation is available at **http://127.0.0.1:8000/api/docs** when running in development mode.

### Authentication

All endpoints (except `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`) require:
```
Authorization: Bearer <access_token>
```

### Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login, get token pair |
| `POST` | `/api/auth/refresh` | Rotate refresh token |
| `POST` | `/api/auth/logout` | Revoke session |
| `POST` | `/api/auth/logout-all` | Revoke all sessions |
| `GET`  | `/api/auth/me` | Current user info |
| `DELETE` | `/api/auth/account` | GDPR account deletion |
| `GET`  | `/api/users/profile` | Get full health profile |
| `PUT`  | `/api/users/profile` | Update profile |
| `PUT`  | `/api/users/profile/metrics` | Update health metrics |
| `GET`  | `/api/users/export` | GDPR data export |
| `POST` | `/api/chat/message` | Send AI message |
| `GET`  | `/api/chat/sessions` | List chat sessions |
| `GET`  | `/api/hospitals` | Search nearby hospitals |
| `GET`  | `/api/pharmacies` | Search nearby pharmacies |
| `POST` | `/api/appointments` | Book appointment |
| `GET`  | `/api/appointments` | List appointments |
| `PUT`  | `/api/appointments/{id}` | Update appointment |
| `DELETE` | `/api/appointments/{id}` | Cancel appointment |
| `POST` | `/api/reminders` | Create reminder |
| `GET`  | `/api/reminders` | List reminders |
| `PATCH` | `/api/reminders/{id}/toggle` | Toggle active state |
| `DELETE` | `/api/reminders/{id}` | Delete reminder |
| `POST` | `/api/family` | Add family member |
| `GET`  | `/api/family` | List family members |
| `DELETE` | `/api/family/{id}` | Remove family member |
| `POST` | `/api/reports/generate` | Generate health report |
| `GET`  | `/api/reports` | List reports |
| `GET`  | `/api/reports/{id}` | Get report content |
| `GET`  | `/health` | Health check |

---

## Database

### Default: SQLite (zero setup)

SQLite is created automatically at `backend/healthai.db` on first startup. No configuration needed.

### Production: Neon PostgreSQL (recommended)

1. Go to **https://neon.tech** → create a free account
2. Create a new project → copy the **connection string**
3. Install the async driver:
   ```bash
   pip install asyncpg
   ```
4. Update `.env`:
   ```
   DATABASE_URL=postgresql+asyncpg://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
5. Restart — tables are created automatically

### Schema Overview

```
users                    — Authentication (email, hashed password, lockout)
user_profiles            — Health profile (all PHI columns encrypted)
refresh_tokens           — Session management (hashed tokens)
family_members           — Family health profiles (PHI encrypted)
appointments             — Appointment bookings (notes encrypted)
reminders                — Medicine/health reminders
chat_sessions            — Chat session metadata
chat_messages            — AI conversation history (content encrypted)
health_reports           — Generated reports (content encrypted)
```

---

## Deployment

### Environment Checklist for Production

Before deploying:

```bash
# In .env:
APP_ENV=production          # Disables /api/docs
APP_HOST=0.0.0.0            # Expose on all interfaces
APP_DEBUG=false

# Use PostgreSQL
DATABASE_URL=postgresql+asyncpg://...

# Lock CORS to your domain
ALLOWED_ORIGINS=https://yourdomain.com
```

### Run with Gunicorn (production)

```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Nginx Reverse Proxy (recommended)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/chat/stream {
        proxy_pass http://127.0.0.1:8000;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
    }
}
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `GEMINI_API_KEY not set` | Edit `.env`, add `GEMINI_API_KEY=...` from aistudio.google.com |
| `SECRET_KEY not set` | Run `python create_env.py` from `backend/` |
| `ModuleNotFoundError` | Activate venv: `source venv/bin/activate` |
| Port 8000 in use | Edit `.env`: `APP_PORT=8080` |
| Voice not working | Use Chrome or Edge — Firefox does not support Web Speech API |
| Gemini 429 rate limit | Free tier = 15 req/min. App auto-retries with exponential backoff |
| DB error on startup | Delete `backend/healthai.db` — it will be recreated cleanly |
| CORS errors | Add your frontend URL to `ALLOWED_ORIGINS` in `.env` |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes with tests
4. Ensure all Python files pass syntax check: `python3 -m py_compile backend/**/*.py`
5. Submit a pull request with a clear description

---

## License

MIT License — see [LICENSE](LICENSE) for full text.

**Medical Disclaimer**: HealthAI provides health information and guidance only. It does not provide medical diagnosis or replace professional medical advice. Always consult a qualified healthcare provider. In emergencies, call **108** (India) or your local emergency number immediately.

---

<div align="center">
Built with ❤️ for better healthcare access · © 2025 HealthAI
</div>
