"""
Gemini AI Service
-----------------
• Model  : gemini-1.5-flash  (free tier, aistudio.google.com)
• Retry  : exponential back-off on 429/5xx (respects free-tier rate limits)
• Safety : custom system prompt enforces healthcare guardrails
• History: last N messages sent as conversation context
• Risk   : parses RISK:LOW/MEDIUM/HIGH tag from model output
• Lang   : model instructed to reply in user's selected language
"""

import asyncio
import re
import time
from typing import AsyncGenerator

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from loguru import logger

from config import get_settings

settings = get_settings()

# ── Configure SDK once at import time ────────────────────────────────────────
genai.configure(api_key=settings.GEMINI_API_KEY)

# ── Safety settings — relaxed just enough for medical discussion ─────────────
_SAFETY = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
}

# ── Generation config ─────────────────────────────────────────────────────────
_GEN_CONFIG = genai.GenerationConfig(
    temperature=0.4,          # Low temp → consistent, factual medical responses
    top_p=0.85,
    top_k=40,
    max_output_tokens=600,    # Keeps responses concise and within free-tier limits
    candidate_count=1,
)

# ── System prompt ─────────────────────────────────────────────────────────────
_SYSTEM_PROMPT = """You are HealthAI, a compassionate and knowledgeable AI health assistant for users in India.

ROLE:
- Help users understand symptoms, assess risk, and navigate healthcare decisions
- Provide medicine information (usage, dosage, side effects, interactions)
- Recommend appropriate specialist doctors based on symptoms
- Offer mental health support with empathy and relevant crisis resources
- Share preventive health tips and lifestyle advice tailored to Indian context
- Help users find hospitals and pharmacies in their area

STRICT RULES:
1. NEVER diagnose definitively. Always say "this may suggest..." or "these symptoms can be associated with..."
2. For ANY symptom response, END your reply with exactly one of: RISK:LOW  RISK:MEDIUM  RISK:HIGH
3. RISK:HIGH = chest pain, severe breathing difficulty, stroke signs (face drooping, arm weakness, speech), uncontrolled bleeding, loss of consciousness, severe allergic reaction → immediately say CALL 108
4. RISK:MEDIUM = symptoms needing doctor within 24-48h (fever >3 days, worsening pain, etc.)
5. RISK:LOW = mild symptoms manageable at home with monitoring
6. For mental health concerns, ALWAYS include: iCall 9152987821, Vandrevala 1860-2662-345
7. Medicine info: always include dosage, side effects, and "consult your doctor/pharmacist before use"
8. Keep responses concise: 150-220 words max. Use bullet points for clarity.
9. Be warm, empathetic, and culturally sensitive. Address user respectfully.
10. If user mentions self-harm or suicide: respond with empathy, provide Vandrevala 1860-2662-345 (24/7), iCall 9152987821

CONTEXT — User location: Hyderabad, Telangana, India
When recommending hospitals, mention: Apollo Hospitals, KIMS, Yashoda, Care Hospitals (all have 24/7 emergency)
Emergency numbers: Ambulance 108 | Police 100 | Women helpline 1091

FORMAT:
- Use line breaks and bullet points for readability
- Bold key terms with **text**
- For HIGH risk: start response with ⚠️
- For mental health: start response with 💚
- End ALL symptom responses with the RISK tag on its own line"""

# Language instruction appended dynamically
_LANG_INSTRUCTIONS = {
    "hi": "\n\nIMPORTANT: Respond entirely in Hindi (Devanagari script). Keep medical terms in English.",
    "te": "\n\nIMPORTANT: Respond entirely in Telugu script. Keep medical terms in English.",
    "ta": "\n\nIMPORTANT: Respond entirely in Tamil script. Keep medical terms in English.",
    "kn": "\n\nIMPORTANT: Respond entirely in Kannada script. Keep medical terms in English.",
    "ml": "\n\nIMPORTANT: Respond entirely in Malayalam script. Keep medical terms in English.",
}

# ── Retry config ──────────────────────────────────────────────────────────────
_MAX_RETRIES = 3
_BASE_DELAY = 2.0    # seconds


# ── Public interface ──────────────────────────────────────────────────────────

class GeminiResponse:
    __slots__ = ("text", "risk_level", "tokens_used", "model", "latency_ms", "error")

    def __init__(
        self,
        text: str = "",
        risk_level: str | None = None,
        tokens_used: int = 0,
        model: str = "",
        latency_ms: int = 0,
        error: str | None = None,
    ):
        self.text = text
        self.risk_level = risk_level
        self.tokens_used = tokens_used
        self.model = model
        self.latency_ms = latency_ms
        self.error = error


async def chat(
    user_message: str,
    history: list[dict],          # [{"role": "user"|"model", "parts": [str]}]
    user_profile: dict | None = None,
    language: str = "en",
) -> GeminiResponse:
    """
    Send a message to Gemini and return a structured response.

    Args:
        user_message: The user's latest message
        history: Conversation history in Gemini format
        user_profile: Optional dict with name, age, conditions, allergies, medications
        language: BCP-47 language code (en, hi, te, ta, kn, ml)

    Returns:
        GeminiResponse with text, risk_level, tokens_used, latency_ms
    """
    system = _build_system_prompt(user_profile, language)
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=system,
        generation_config=_GEN_CONFIG,
        safety_settings=_SAFETY,
    )

    # Build history — keep last 20 turns to stay within context limits
    trimmed_history = history[-20:] if len(history) > 20 else history

    t0 = time.perf_counter()
    last_error: Exception | None = None

    for attempt in range(_MAX_RETRIES):
        try:
            convo = model.start_chat(history=trimmed_history)
            response = await asyncio.to_thread(convo.send_message, user_message)

            latency_ms = int((time.perf_counter() - t0) * 1000)
            raw_text = response.text

            # Extract and strip RISK tag
            risk = _extract_risk(raw_text)
            clean_text = _strip_risk_tag(raw_text).strip()

            tokens = 0
            try:
                tokens = response.usage_metadata.total_token_count or 0
            except Exception:
                pass

            logger.debug(
                f"Gemini OK attempt={attempt+1} tokens={tokens} "
                f"latency={latency_ms}ms risk={risk}"
            )

            return GeminiResponse(
                text=clean_text,
                risk_level=risk,
                tokens_used=tokens,
                model=settings.GEMINI_MODEL,
                latency_ms=latency_ms,
            )

        except Exception as exc:
            last_error = exc
            err_str = str(exc)

            # Detect quota / rate-limit errors
            is_rate_limit = any(x in err_str for x in ["429", "quota", "Resource has been exhausted"])
            is_server_err = any(x in err_str for x in ["500", "503", "502", "internal"])
            is_safety     = "block" in err_str.lower() or "safety" in err_str.lower()

            if is_safety:
                logger.warning("Gemini safety block — returning safe fallback")
                return GeminiResponse(
                    text=(
                        "I'm unable to process that specific request. "
                        "If you have a health concern, please describe your symptoms and "
                        "I'll do my best to help, or call your doctor directly."
                    ),
                    error="safety_block",
                )

            if not (is_rate_limit or is_server_err):
                # Non-retryable error
                logger.error(f"Gemini non-retryable error: {exc}")
                break

            if attempt < _MAX_RETRIES - 1:
                delay = _BASE_DELAY * (2 ** attempt)   # 2s → 4s → 8s
                logger.warning(f"Gemini error (attempt {attempt+1}), retrying in {delay}s: {exc}")
                await asyncio.sleep(delay)

    # All retries exhausted
    logger.error(f"Gemini failed after {_MAX_RETRIES} attempts: {last_error}")
    return GeminiResponse(
        text=_fallback_response(user_message),
        error=str(last_error),
    )


async def stream_chat(
    user_message: str,
    history: list[dict],
    user_profile: dict | None = None,
    language: str = "en",
) -> AsyncGenerator[str, None]:
    """
    Stream Gemini response token-by-token.
    Yields text chunks. Caller is responsible for SSE formatting.
    Falls back to non-streaming on error.
    """
    system = _build_system_prompt(user_profile, language)
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=system,
        generation_config=_GEN_CONFIG,
        safety_settings=_SAFETY,
    )

    trimmed = history[-20:] if len(history) > 20 else history

    try:
        convo = model.start_chat(history=trimmed)
        response = await asyncio.to_thread(
            lambda: convo.send_message(user_message, stream=True)
        )
        full_text = ""
        for chunk in response:
            if chunk.text:
                full_text += chunk.text
                yield chunk.text
        # Yield risk tag as a special sentinel at the end
        risk = _extract_risk(full_text)
        if risk:
            yield f"\n__RISK:{risk}__"
    except Exception as exc:
        logger.error(f"Gemini stream error: {exc}")
        fallback = _fallback_response(user_message)
        yield fallback


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_system_prompt(profile: dict | None, language: str) -> str:
    prompt = _SYSTEM_PROMPT

    if profile:
        parts = []
        if profile.get("name"):
            parts.append(f"User name: {profile['name']}")
        if profile.get("age"):
            parts.append(f"Age: {profile['age']}")
        if profile.get("gender"):
            parts.append(f"Gender: {profile['gender']}")
        if profile.get("blood_group"):
            parts.append(f"Blood group: {profile['blood_group']}")
        if profile.get("conditions"):
            conds = profile["conditions"]
            if isinstance(conds, list):
                conds = ", ".join(conds)
            parts.append(f"Existing conditions: {conds}")
        if profile.get("allergies"):
            allgs = profile["allergies"]
            if isinstance(allgs, list):
                allgs = ", ".join(allgs)
            parts.append(f"Known allergies: {allgs}")
        if profile.get("current_medications"):
            meds = profile["current_medications"]
            if isinstance(meds, list):
                meds = ", ".join(meds)
            parts.append(f"Current medications: {meds}")

        if parts:
            prompt += "\n\nPATIENT PROFILE:\n" + "\n".join(f"- {p}" for p in parts)
            prompt += "\nAlways personalize advice considering this profile. Flag any conflicts with current medications."

    if language in _LANG_INSTRUCTIONS:
        prompt += _LANG_INSTRUCTIONS[language]

    return prompt


def _extract_risk(text: str) -> str | None:
    """Parse RISK:HIGH/MEDIUM/LOW from model output."""
    match = re.search(r"\bRISK:(HIGH|MEDIUM|LOW)\b", text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    return None


def _strip_risk_tag(text: str) -> str:
    """Remove the RISK:xxx tag from the user-facing text."""
    return re.sub(r"\s*\bRISK:(HIGH|MEDIUM|LOW)\b\s*", "", text, flags=re.IGNORECASE).strip()


def _fallback_response(message: str) -> str:
    """
    Rule-based fallback when Gemini is unavailable.
    Covers the most critical triage cases so the app never goes silent.
    """
    m = message.lower()
    if any(w in m for w in ["chest pain", "heart attack", "can't breathe", "cannot breathe", "stroke"]):
        return (
            "⚠️ This sounds like a **medical emergency**.\n\n"
            "**Call 108 (Ambulance) immediately** or go to the nearest emergency room.\n\n"
            "Do not drive yourself. Stay calm and keep someone with you.\n\n"
            "Nearest 24/7 emergency in Hyderabad: **Apollo Hospitals** — 040-23607777"
        )
    if any(w in m for w in ["suicide", "kill myself", "end my life", "want to die"]):
        return (
            "💚 I hear you, and I'm really glad you reached out.\n\n"
            "Please contact a crisis counsellor right now:\n"
            "• **Vandrevala Foundation: 1860-2662-345** (24/7, free)\n"
            "• **iCall: 9152987821** (Mon–Sat 8am–10pm)\n\n"
            "You don't have to face this alone. A trained counsellor is ready to listen."
        )
    return (
        "I'm having trouble connecting to the AI service right now. "
        "Please try again in a moment.\n\n"
        "For emergencies: **Ambulance 108** | Hospitals: Apollo 040-23607777 | "
        "Mental health: 1860-2662-345"
    )


def format_history_for_gemini(db_messages: list) -> list[dict]:
    """
    Convert DB ChatMessage objects to Gemini history format.
    Gemini expects: [{"role": "user"|"model", "parts": ["text"]}]
    """
    history = []
    for msg in db_messages:
        role = "model" if msg.role == "assistant" else "user"
        content = msg.content
        if isinstance(content, str) and content:
            history.append({"role": role, "parts": [content]})
    return history
