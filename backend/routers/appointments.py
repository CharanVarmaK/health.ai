"""
Appointments Router
POST   /api/appointments           Book appointment
GET    /api/appointments           List user appointments
PUT    /api/appointments/{id}      Update appointment
DELETE /api/appointments/{id}      Cancel appointment
"""
from datetime import date, time, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.appointments import Appointment
from models.user import User
from security.auth import get_current_user
from security.rate_limiter import limiter

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])

SPECIALTIES = [
    "General Physician","Cardiologist","Pulmonologist","Neurologist","Orthopedist",
    "Dermatologist","Gastroenterologist","Diabetologist","Gynaecologist","Paediatrician",
    "Psychiatrist","Ophthalmologist","ENT Specialist","Urologist","Nephrologist",
    "Oncologist","Rheumatologist","Endocrinologist","Hepatologist","Haematologist",
]


class AppointmentCreate(BaseModel):
    doctor_name: str
    specialty: str
    hospital_name: str
    hospital_address: Optional[str] = None
    appointment_date: date
    appointment_time: str        # "HH:MM" string — easier from frontend
    notes: Optional[str] = None
    is_for_family_member: bool = False
    family_member_id: Optional[int] = None

    @field_validator("doctor_name", "hospital_name")
    @classmethod
    def strip(cls, v): return v.strip()[:200]

    @field_validator("appointment_date")
    @classmethod
    def future_date(cls, v):
        if v < date.today():
            raise ValueError("Appointment date must be today or in the future")
        return v

    @field_validator("specialty")
    @classmethod
    def valid_specialty(cls, v):
        if v not in SPECIALTIES:
            raise ValueError(f"Invalid specialty. Valid: {', '.join(SPECIALTIES)}")
        return v

    @field_validator("appointment_time")
    @classmethod
    def parse_time(cls, v):
        try:
            h, m = v.split(":")
            time(int(h), int(m))
            return v
        except Exception:
            raise ValueError("Time must be HH:MM format (e.g. 10:30)")


class AppointmentUpdate(BaseModel):
    doctor_name: Optional[str] = None
    specialty: Optional[str] = None
    hospital_name: Optional[str] = None
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v):
        if v and v not in ("upcoming", "completed", "cancelled"):
            raise ValueError("Status must be: upcoming, completed, or cancelled")
        return v


def _appt_to_dict(a: Appointment) -> dict:
    return {
        "id": a.id,
        "doctor_name": a.doctor_name,
        "specialty": a.specialty,
        "hospital_name": a.hospital_name,
        "hospital_address": a.hospital_address,
        "appointment_date": str(a.appointment_date),
        "appointment_time": str(a.appointment_time)[:5] if a.appointment_time else "",
        "status": a.status,
        "notes": a.notes,
        "is_for_family_member": a.is_for_family_member,
        "family_member_id": a.family_member_id,
        "created_at": a.created_at.isoformat(),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_appointment(
    request: Request,
    body: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    h, m = body.appointment_time.split(":")
    appt = Appointment(
        user_id=current_user.id,
        doctor_name=body.doctor_name,
        specialty=body.specialty,
        hospital_name=body.hospital_name,
        hospital_address=body.hospital_address,
        appointment_date=body.appointment_date,
        appointment_time=time(int(h), int(m)),
        notes=body.notes,
        is_for_family_member=body.is_for_family_member,
        family_member_id=body.family_member_id,
        status="upcoming",
    )
    db.add(appt)
    await db.flush()
    return {"success": True, "message": "Appointment booked.", "appointment": _appt_to_dict(appt)}


@router.get("")
async def list_appointments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status_filter: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    q = select(Appointment).where(Appointment.user_id == current_user.id)
    if status_filter:
        q = q.where(Appointment.status == status_filter)
    q = q.order_by(Appointment.appointment_date.asc()).limit(limit).offset(offset)
    r = await db.execute(q)
    appts = r.scalars().all()

    count_q = select(func.count()).select_from(Appointment).where(Appointment.user_id == current_user.id)
    if status_filter:
        count_q = count_q.where(Appointment.status == status_filter)
    total = await db.scalar(count_q)

    return {
        "success": True,
        "appointments": [_appt_to_dict(a) for a in appts],
        "total": total or 0,
        "specialties": SPECIALTIES,
    }


@router.put("/{appt_id}")
async def update_appointment(
    appt_id: int,
    body: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(Appointment).where(Appointment.id == appt_id, Appointment.user_id == current_user.id)
    )
    appt = r.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    data = body.model_dump(exclude_none=True)
    if "appointment_time" in data:
        h, m = data.pop("appointment_time").split(":")
        appt.appointment_time = time(int(h), int(m))
    for k, v in data.items():
        setattr(appt, k, v)
    appt.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return {"success": True, "appointment": _appt_to_dict(appt)}


@router.delete("/{appt_id}")
async def cancel_appointment(
    appt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(Appointment).where(Appointment.id == appt_id, Appointment.user_id == current_user.id)
    )
    appt = r.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appt.status = "cancelled"
    appt.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return {"success": True, "message": "Appointment cancelled."}
