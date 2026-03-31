"""
Reports Router
POST /api/reports/generate    Generate health report (HTML)
GET  /api/reports             List user's reports
GET  /api/reports/{id}        Get report content
DELETE /api/reports/{id}      Delete report
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from database import get_db
from models.reports import HealthReport
from models.user import User, UserProfile
from models.appointments import Appointment
from security.auth import get_current_user
from security.rate_limiter import limiter
from services.report_generator import generate_html_report, save_report_file

router = APIRouter(prefix="/api/reports", tags=["Reports"])


class GenerateReportRequest(BaseModel):
    report_type: str = "full"    # full | metrics | appointments
    title: Optional[str] = None


@router.post("/generate", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def generate_report(
    request: Request,
    body: GenerateReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Load profile
    r = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=400, detail="Please complete your profile before generating a report")

    # Load upcoming appointments
    ar = await db.execute(
        select(Appointment)
        .where(Appointment.user_id == current_user.id, Appointment.status == "upcoming")
        .order_by(Appointment.appointment_date.asc())
        .limit(5)
    )
    appointments = ar.scalars().all()

    # Generate HTML
    html = generate_html_report(current_user, profile, appointments)

    # Save to DB
    title = body.title or f"Health Report — {datetime.now(timezone.utc).strftime('%d %b %Y')}"
    report = HealthReport(
        user_id=current_user.id,
        report_type=body.report_type,
        title=title,
        content_html=html,
        generated_by="user",
    )
    db.add(report)
    await db.flush()

    # Optionally save to disk
    try:
        file_path = await save_report_file(current_user.id, html, body.report_type)
        report.file_path = file_path
    except Exception:
        pass

    return {
        "success": True,
        "report": {
            "id": report.id,
            "title": title,
            "report_type": body.report_type,
            "created_at": report.created_at.isoformat(),
            "html": html,          # Frontend can open this in a new tab / print
        },
    }


@router.get("")
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(HealthReport)
        .where(HealthReport.user_id == current_user.id)
        .order_by(HealthReport.created_at.desc())
        .limit(20)
    )
    reports = r.scalars().all()
    return {
        "success": True,
        "reports": [
            {"id": rp.id, "title": rp.title, "report_type": rp.report_type, "created_at": rp.created_at.isoformat()}
            for rp in reports
        ],
    }


@router.get("/{report_id}")
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(HealthReport).where(HealthReport.id == report_id, HealthReport.user_id == current_user.id)
    )
    report = r.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "success": True,
        "report": {
            "id": report.id,
            "title": report.title,
            "report_type": report.report_type,
            "html": report.content_html,
            "created_at": report.created_at.isoformat(),
        },
    }


@router.delete("/{report_id}")
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(HealthReport).where(HealthReport.id == report_id, HealthReport.user_id == current_user.id)
    )
    report = r.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(report)
    await db.flush()
    return {"success": True, "message": "Report deleted."}
