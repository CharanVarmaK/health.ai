"""
Symptom Engine
--------------
Rule-based risk classification that runs BEFORE the AI call.
Catches critical/emergency symptoms instantly without waiting for Gemini.
Also maps symptoms → recommended specialist.
"""
from dataclasses import dataclass, field

# ── Emergency keyword sets ─────────────────────────────────────────────────────
_CRITICAL = frozenset([
    "chest pain", "chest tightness", "heart attack", "cardiac arrest",
    "can't breathe", "cannot breathe", "difficulty breathing", "stopped breathing",
    "not breathing", "severe breathlessness",
    "stroke", "face drooping", "arm weakness", "sudden confusion",
    "sudden severe headache", "thunderclap headache",
    "loss of consciousness", "fainted", "unconscious", "collapsed",
    "uncontrolled bleeding", "heavy bleeding", "coughing blood", "vomiting blood",
    "severe allergic reaction", "anaphylaxis", "throat closing",
    "seizure", "convulsion", "fitting",
    "overdose", "poisoning", "swallowed poison",
    "drowning", "electric shock",
    "suicide", "kill myself", "end my life", "want to die", "self harm",
])

_HIGH_RISK = frozenset([
    "severe abdominal pain", "severe stomach pain", "appendicitis",
    "high fever", "fever above 104", "fever above 40",
    "diabetic emergency", "very low blood sugar", "hypoglycemia severe",
    "severe dehydration", "not urinating",
    "sudden vision loss", "sudden blindness",
    "sudden hearing loss",
    "severe burns", "burn over large area",
    "broken bone", "fracture",
    "head injury", "head trauma",
    "meningitis", "stiff neck with fever",
    "severe chest infection", "pneumonia",
    "blood in urine", "blood in stool",
    "testicular pain sudden",
    "pregnancy emergency", "severe pregnancy pain",
])

_MEDIUM_RISK = frozenset([
    "fever", "high temperature", "temperature", "pyrexia",
    "persistent cough", "cough for days", "cough blood",
    "breathlessness", "shortness of breath", "wheezing",
    "chest discomfort", "palpitations",
    "severe headache", "migraine",
    "abdominal pain", "stomach pain", "stomach ache",
    "vomiting", "nausea vomiting", "vomiting repeatedly",
    "diarrhoea", "diarrhea", "loose motions",
    "urinary pain", "burning urination", "uti",
    "skin rash", "rash spreading",
    "joint pain", "severe joint pain",
    "eye pain", "vision changes",
    "ear pain", "earache",
    "swollen lymph node", "lump",
    "anxiety attack", "panic attack",
    "depression", "anxiety",
    "blood pressure high", "hypertension",
    "blood sugar high", "hyperglycemia",
])

# ── Specialist mapping ─────────────────────────────────────────────────────────
_SPECIALIST_MAP: dict[str, str] = {
    # Cardiovascular
    "chest pain": "Cardiologist",
    "palpitations": "Cardiologist",
    "heart": "Cardiologist",
    "blood pressure": "Cardiologist / General Physician",
    "hypertension": "Cardiologist",

    # Respiratory
    "cough": "Pulmonologist",
    "breathlessness": "Pulmonologist",
    "asthma": "Pulmonologist",
    "wheezing": "Pulmonologist",
    "pneumonia": "Pulmonologist",

    # Neurological
    "headache": "Neurologist",
    "migraine": "Neurologist",
    "seizure": "Neurologist",
    "stroke": "Neurologist (Emergency)",
    "dizziness": "Neurologist / ENT",
    "numbness": "Neurologist",
    "memory": "Neurologist",

    # Gastrointestinal
    "stomach": "Gastroenterologist",
    "abdominal": "Gastroenterologist",
    "diarrhoea": "Gastroenterologist",
    "diarrhea": "Gastroenterologist",
    "vomiting": "Gastroenterologist",
    "liver": "Gastroenterologist / Hepatologist",
    "jaundice": "Gastroenterologist / Hepatologist",
    "constipation": "Gastroenterologist",

    # Endocrine / Metabolic
    "diabetes": "Diabetologist / Endocrinologist",
    "blood sugar": "Diabetologist",
    "thyroid": "Endocrinologist",
    "weight gain": "Endocrinologist",
    "fatigue": "General Physician / Endocrinologist",

    # Urological
    "urinary": "Urologist",
    "kidney": "Nephrologist",
    "urination": "Urologist",

    # Musculoskeletal
    "joint pain": "Orthopedist / Rheumatologist",
    "back pain": "Orthopedist",
    "knee": "Orthopedist",
    "fracture": "Orthopedist (Emergency)",
    "arthritis": "Rheumatologist",

    # Dermatological
    "skin": "Dermatologist",
    "rash": "Dermatologist",
    "acne": "Dermatologist",
    "hair loss": "Dermatologist",

    # Mental health
    "anxiety": "Psychiatrist / Psychologist",
    "depression": "Psychiatrist / Psychologist",
    "mental": "Psychiatrist / Psychologist",
    "sleep": "Psychiatrist / Neurologist",
    "stress": "Psychologist",
    "panic": "Psychiatrist / Psychologist",

    # ENT
    "ear": "ENT Specialist",
    "throat": "ENT Specialist",
    "nose": "ENT Specialist",
    "tonsil": "ENT Specialist",
    "sinus": "ENT Specialist",
    "hearing": "ENT Specialist",

    # Ophthalmology
    "eye": "Ophthalmologist",
    "vision": "Ophthalmologist",
    "blurred": "Ophthalmologist",

    # Gynaecology
    "menstrual": "Gynaecologist",
    "period": "Gynaecologist",
    "pregnancy": "Obstetrician / Gynaecologist",
    "pcos": "Gynaecologist / Endocrinologist",

    # Paediatrics
    "child": "Paediatrician",
    "baby": "Paediatrician",
    "infant": "Paediatrician",

    # Oncology
    "cancer": "Oncologist",
    "tumour": "Oncologist",
    "tumor": "Oncologist",
    "lump": "Surgeon / Oncologist",

    # General
    "fever": "General Physician",
    "cold": "General Physician",
    "flu": "General Physician",
    "infection": "General Physician",
    "weakness": "General Physician",
    "appetite": "General Physician",
}

@dataclass
class TriageResult:
    risk_level: str                 # CRITICAL | HIGH | MEDIUM | LOW
    is_emergency: bool
    specialist: str
    emergency_message: str | None = None
    keywords_matched: list[str] = field(default_factory=list)


def triage(message: str, user_profile: dict | None = None) -> TriageResult:
    """
    Fast rule-based pre-triage before sending to Gemini.
    Returns risk level and whether to show emergency banner immediately.
    """
    m = message.lower()

    # Check critical / emergency first
    matched_critical = [kw for kw in _CRITICAL if kw in m]
    if matched_critical:
        specialist = _get_specialist(m)
        emergency_msg = None

        # Special case for mental health emergencies
        if any(w in m for w in ["suicide", "kill myself", "end my life", "want to die"]):
            emergency_msg = (
                "💚 You are not alone. Please call **Vandrevala Foundation: 1860-2662-345** (24/7 free) "
                "or **iCall: 9152987821** right now. A counsellor is ready to help."
            )
            return TriageResult(
                risk_level="HIGH",
                is_emergency=False,  # Don't show red emergency bar for mental health
                specialist="Psychiatrist / Psychologist",
                emergency_message=emergency_msg,
                keywords_matched=matched_critical,
            )

        emergency_msg = (
            "⚠️ **Call 108 (Ambulance) immediately** or go to the nearest emergency room. "
            "Apollo Hospitals (24/7): 040-23607777"
        )
        return TriageResult(
            risk_level="CRITICAL",
            is_emergency=True,
            specialist="Emergency Department",
            emergency_message=emergency_msg,
            keywords_matched=matched_critical,
        )

    matched_high = [kw for kw in _HIGH_RISK if kw in m]
    if matched_high:
        return TriageResult(
            risk_level="HIGH",
            is_emergency=False,
            specialist=_get_specialist(m),
            keywords_matched=matched_high,
        )

    matched_medium = [kw for kw in _MEDIUM_RISK if kw in m]
    if matched_medium:
        return TriageResult(
            risk_level="MEDIUM",
            is_emergency=False,
            specialist=_get_specialist(m),
            keywords_matched=matched_medium,
        )

    # Consider profile context — e.g. hypertension + headache → bump to MEDIUM
    if user_profile:
        conditions = user_profile.get("conditions", [])
        if isinstance(conditions, str):
            conditions = [conditions]
        conditions_lower = " ".join(str(c).lower() for c in conditions)
        if "hypertension" in conditions_lower and ("headache" in m or "dizziness" in m):
            return TriageResult(
                risk_level="MEDIUM",
                is_emergency=False,
                specialist="General Physician / Cardiologist",
                keywords_matched=["profile_context:hypertension"],
            )
        if "diabetes" in conditions_lower and ("dizzy" in m or "shaking" in m or "sweat" in m):
            return TriageResult(
                risk_level="MEDIUM",
                is_emergency=False,
                specialist="Diabetologist / General Physician",
                keywords_matched=["profile_context:diabetes"],
            )

    return TriageResult(
        risk_level="LOW",
        is_emergency=False,
        specialist=_get_specialist(m),
    )


def _get_specialist(message: str) -> str:
    for keyword, specialist in _SPECIALIST_MAP.items():
        if keyword in message:
            return specialist
    return "General Physician"


def risk_to_color(risk: str) -> str:
    return {
        "CRITICAL": "red",
        "HIGH": "red",
        "MEDIUM": "amber",
        "LOW": "green",
    }.get(risk, "green")


def risk_to_label(risk: str) -> str:
    return {
        "CRITICAL": "⚠️ Emergency — Call 108",
        "HIGH": "⚠️ High Risk — See Doctor Today",
        "MEDIUM": "⚡ Medium Risk — Consult Doctor Soon",
        "LOW": "✅ Low Risk — Monitor at Home",
    }.get(risk, "")
