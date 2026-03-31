"""
User Profile Router

GET    /api/users/profile           Get full profile
PUT    /api/users/profile           Update profile
PUT    /api/users/profile/metrics   Update health metrics
PUT    /api/users/language          Set preferred language
GET    /api/users/export            GDPR data export (JSON)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import json

from database import get_db
from models.user import User, UserProfile
from security.auth import get_current_user
from security.rate_limiter import limiter
from fastapi import Request
from loguru import logger

router = APIRouter(prefix="/api/users", tags=["User Profile"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    phone: Optional[str] = None
    blood_group: Optional[str] = None
    height_cm: Optional[str] = None
    weight_kg: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    conditions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    family_history: Optional[List[str]] = None
    surgeries: Optional[List[str]] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    share_data_for_improvement: Optional[bool] = None

    @field_validator("age")
    @classmethod
    def validate_age(cls, v):
        if v is not None and not (0 < v < 150):
            raise ValueError("Age must be between 1 and 149")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        allowed = {"Male", "Female", "Other", "Prefer not to say"}
        if v and v not in allowed:
            raise ValueError(f"Gender must be one of: {', '.join(allowed)}")
        return v

    @field_validator("blood_group")
    @classmethod
    def validate_blood(cls, v):
        allowed = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"}
        if v and v not in allowed:
            raise ValueError(f"Invalid blood group")
        return v


class MetricsUpdate(BaseModel):
    blood_pressure: Optional[str] = None
    heart_rate: Optional[str] = None
    temperature: Optional[str] = None
    spo2: Optional[str] = None
    blood_glucose: Optional[str] = None
    cholesterol: Optional[str] = None
    weight_kg: Optional[str] = None


class LanguageUpdate(BaseModel):
    language: str

    @field_validator("language")
    @classmethod
    def validate_lang(cls, v):
        allowed = {"en", "hi", "te", "ta", "kn", "ml", "bn", "mr", "gu", "pa"}
        if v not in allowed:
            raise ValueError(f"Unsupported language. Allowed: {', '.join(allowed)}")
        return v


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_or_create_profile(db: AsyncSession, user_id: int) -> UserProfile:
    r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = r.scalar_one_or_none()
    if not profile:
        profile = UserProfile(user_id=user_id, display_name="User")
        db.add(profile)
        await db.flush()
    return profile


def _profile_to_dict(profile: UserProfile) -> dict:
    """Serialize profile to dict, safely handling encrypted list fields."""
    def _safe_list(val) -> list:
        if val is None:
            return []
        if isinstance(val, list):
            return val
        if isinstance(val, str):
            try:
                parsed = json.loads(val)
                return parsed if isinstance(parsed, list) else [parsed]
            except Exception:
                return [val] if val else []
        return []

    return {
        "display_name": profile.display_name,
        "full_name": profile.full_name,
        "age": profile.age,
        "gender": profile.gender,
        "date_of_birth": profile.date_of_birth,
        "phone": profile.phone,
        "blood_group": profile.blood_group,
        "height_cm": profile.height_cm,
        "weight_kg": profile.weight_kg,
        "address": profile.address,
        "city": profile.city,
        "state": profile.state,
        "country": profile.country,
        "latitude": profile.latitude,
        "longitude": profile.longitude,
        "conditions": _safe_list(profile.conditions),
        "allergies": _safe_list(profile.allergies),
        "current_medications": _safe_list(profile.current_medications),
        "family_history": _safe_list(profile.family_history),
        "surgeries": _safe_list(profile.surgeries),
        "emergency_contact_name": profile.emergency_contact_name,
        "emergency_contact_phone": profile.emergency_contact_phone,
        "blood_pressure": profile.blood_pressure,
        "heart_rate": profile.heart_rate,
        "temperature": profile.temperature,
        "spo2": profile.spo2,
        "blood_glucose": profile.blood_glucose,
        "cholesterol": profile.cholesterol,
        "language": profile.language,
        "notifications_enabled": profile.notifications_enabled,
        "share_data_for_improvement": profile.share_data_for_improvement,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = await _get_or_create_profile(db, current_user.id)
    return {
        "success": True,
        "profile": _profile_to_dict(profile),
    }


@router.put("/profile")
@limiter.limit("20/minute")
async def update_profile(
    request: Request,
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = await _get_or_create_profile(db, current_user.id)

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if hasattr(profile, field):
            setattr(profile, field, value)

    await db.flush()
    logger.info(f"Profile updated user_id={current_user.id} fields={list(update_data.keys())}")

    return {
        "success": True,
        "message": "Profile updated successfully.",
        "profile": _profile_to_dict(profile),
    }


@router.put("/profile/metrics")
@limiter.limit("30/minute")
async def update_metrics(
    request: Request,
    body: MetricsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = await _get_or_create_profile(db, current_user.id)

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if hasattr(profile, field):
            setattr(profile, field, value)

    await db.flush()
    return {
        "success": True,
        "message": "Health metrics updated.",
        "metrics": {
            "blood_pressure": profile.blood_pressure,
            "heart_rate": profile.heart_rate,
            "temperature": profile.temperature,
            "spo2": profile.spo2,
            "blood_glucose": profile.blood_glucose,
            "cholesterol": profile.cholesterol,
        },
    }


@router.put("/language")
async def update_language(
    body: LanguageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = await _get_or_create_profile(db, current_user.id)
    profile.language = body.language
    await db.flush()
    return {"success": True, "language": body.language}


@router.get("/export")
async def export_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GDPR Art. 20 — Data portability.
    Returns all user data as JSON. Includes profile, appointments,
    reminders, and chat history count (not content for privacy).
    """
    from models.family import FamilyMember
    from models.appointments import Appointment
    from models.reminders import Reminder
    from models.chat import ChatSession
    from models.reports import HealthReport
    from sqlalchemy import func

    profile = await _get_or_create_profile(db, current_user.id)

    # Count records
    appt_count = await db.scalar(
        select(func.count()).select_from(Appointment).where(Appointment.user_id == current_user.id)
    )
    reminder_count = await db.scalar(
        select(func.count()).select_from(Reminder).where(Reminder.user_id == current_user.id)
    )
    chat_count = await db.scalar(
        select(func.count()).select_from(ChatSession).where(ChatSession.user_id == current_user.id)
    )

    # Family
    fam_r = await db.execute(
        select(FamilyMember).where(FamilyMember.user_id == current_user.id, FamilyMember.is_active == True)
    )
    family = fam_r.scalars().all()

    return {
        "success": True,
        "export_date": datetime.now(timezone.utc).isoformat(),
        "data": {
            "account": {
                "email": current_user.email,
                "created_at": current_user.created_at.isoformat(),
                "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
            },
            "profile": _profile_to_dict(profile),
            "family_members": [
                {
                    "name": f.display_name,
                    "relation": f.relation,
                    "age": f.age,
                }
                for f in family
            ],
            "summary": {
                "total_appointments": appt_count or 0,
                "total_reminders": reminder_count or 0,
                "total_chat_sessions": chat_count or 0,
            },
        },
    }


# Import needed for export endpoint
from datetime import datetime, timezone
