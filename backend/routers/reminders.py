"""
Reminders Router
POST   /api/reminders        Create reminder
GET    /api/reminders        List reminders
PUT    /api/reminders/{id}   Update reminder
DELETE /api/reminders/{id}   Delete reminder
PATCH  /api/reminders/{id}/toggle  Toggle active state
"""
from datetime import datetime, timezone, time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.reminders import Reminder
from models.user import User
from security.auth import get_current_user
from security.rate_limiter import limiter

router = APIRouter(prefix="/api/reminders", tags=["Reminders"])

ICONS    = ["💊","🩺","🏃","💧","🍎","😴","🔔","❤️","🧘","🥗"]
FREQS    = ["daily","weekdays","weekends","mon_wed_fri","tue_thu","weekly","custom"]
REM_TYPES= ["medicine","checkup","exercise","water","diet","sleep","custom"]


class ReminderCreate(BaseModel):
    name: str
    icon: str = "💊"
    reminder_type: str = "medicine"
    reminder_time: str       # "HH:MM"
    frequency: str = "daily"
    custom_days: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def val_name(cls, v):
        v = v.strip()
        if not v: raise ValueError("Name is required")
        return v[:200]

    @field_validator("reminder_time")
    @classmethod
    def val_time(cls, v):
        try:
            h, m = v.split(":"); time(int(h), int(m)); return v
        except: raise ValueError("Time must be HH:MM")

    @field_validator("frequency")
    @classmethod
    def val_freq(cls, v):
        if v not in FREQS: raise ValueError(f"Frequency must be one of: {', '.join(FREQS)}")
        return v


class ReminderUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    reminder_time: Optional[str] = None
    frequency: Optional[str] = None
    custom_days: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


def _rem_to_dict(r: Reminder) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "icon": r.icon,
        "reminder_type": r.reminder_type,
        "reminder_time": str(r.reminder_time)[:5] if r.reminder_time else "",
        "frequency": r.frequency,
        "custom_days": r.custom_days,
        "notes": r.notes,
        "is_active": r.is_active,
        "last_triggered": r.last_triggered.isoformat() if r.last_triggered else None,
        "created_at": r.created_at.isoformat(),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_reminder(
    request: Request,
    body: ReminderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Max 50 reminders per user
    from sqlalchemy import func
    count = await db.scalar(select(func.count()).select_from(Reminder).where(Reminder.user_id == current_user.id))
    if (count or 0) >= 50:
        raise HTTPException(status_code=400, detail="Maximum 50 reminders per account")

    h, m = body.reminder_time.split(":")
    rem = Reminder(
        user_id=current_user.id,
        name=body.name,
        icon=body.icon,
        reminder_type=body.reminder_type,
        reminder_time=time(int(h), int(m)),
        frequency=body.frequency,
        custom_days=body.custom_days,
        notes=body.notes,
        is_active=True,
    )
    db.add(rem)
    await db.flush()
    return {"success": True, "reminder": _rem_to_dict(rem)}


@router.get("")
async def list_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(Reminder).where(Reminder.user_id == current_user.id)
        .order_by(Reminder.reminder_time.asc())
    )
    reminders = r.scalars().all()
    return {"success": True, "reminders": [_rem_to_dict(r) for r in reminders]}


@router.put("/{rem_id}")
async def update_reminder(
    rem_id: int,
    body: ReminderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(select(Reminder).where(Reminder.id == rem_id, Reminder.user_id == current_user.id))
    rem = r.scalar_one_or_none()
    if not rem: raise HTTPException(status_code=404, detail="Reminder not found")

    data = body.model_dump(exclude_none=True)
    if "reminder_time" in data:
        h, m = data.pop("reminder_time").split(":")
        rem.reminder_time = time(int(h), int(m))
    for k, v in data.items():
        setattr(rem, k, v)
    rem.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return {"success": True, "reminder": _rem_to_dict(rem)}


@router.patch("/{rem_id}/toggle")
async def toggle_reminder(
    rem_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(select(Reminder).where(Reminder.id == rem_id, Reminder.user_id == current_user.id))
    rem = r.scalar_one_or_none()
    if not rem: raise HTTPException(status_code=404, detail="Reminder not found")
    rem.is_active = not rem.is_active
    rem.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return {"success": True, "is_active": rem.is_active}


@router.delete("/{rem_id}")
async def delete_reminder(
    rem_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(select(Reminder).where(Reminder.id == rem_id, Reminder.user_id == current_user.id))
    rem = r.scalar_one_or_none()
    if not rem: raise HTTPException(status_code=404, detail="Reminder not found")
    await db.delete(rem)
    await db.flush()
    return {"success": True, "message": "Reminder deleted."}
