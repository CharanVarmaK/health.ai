"""
Hospitals & Pharmacies Router
GET /api/hospitals          List hospitals (with optional lat/lng + search)
GET /api/hospitals/{id}     Static detail by index
GET /api/pharmacies         List pharmacies
"""
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User, UserProfile
from security.auth import get_current_user
from security.rate_limiter import limiter
from services.hospital_finder import find_hospitals, find_pharmacies, STATIC_HOSPITALS, STATIC_PHARMACIES
from sqlalchemy import select

router = APIRouter(prefix="/api", tags=["Hospitals & Pharmacies"])


@router.get("/hospitals")
@limiter.limit("30/minute")
async def get_hospitals(
    request: Request,
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    search: str = Query("", max_length=100),
    radius: int = Query(15, ge=1, le=50),
    emergency_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # If no lat/lng provided, try user's saved location
    if not lat or not lng:
        r = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
        profile = r.scalar_one_or_none()
        if profile:
            try:
                lat = float(profile.latitude) if profile.latitude else None
                lng = float(profile.longitude) if profile.longitude else None
            except (TypeError, ValueError):
                lat = lng = None

    hospitals = await find_hospitals(lat, lng, search, radius)

    if search:
        q = search.lower()
        hospitals = [
            h for h in hospitals
            if q in h["name"].lower()
            or q in h.get("area","").lower()
            or any(q in s.lower() for s in h.get("specialties", []))
        ]
    if emergency_only:
        hospitals = [h for h in hospitals if h.get("emergency")]

    return {"success": True, "hospitals": hospitals, "total": len(hospitals)}


@router.get("/pharmacies")
@limiter.limit("30/minute")
async def get_pharmacies(
    request: Request,
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    delivery_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not lat or not lng:
        r = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
        profile = r.scalar_one_or_none()
        if profile:
            try:
                lat = float(profile.latitude) if profile.latitude else None
                lng = float(profile.longitude) if profile.longitude else None
            except (TypeError, ValueError):
                lat = lng = None

    pharmacies = await find_pharmacies(lat, lng)
    if delivery_only:
        pharmacies = [p for p in pharmacies if p.get("delivery")]

    return {"success": True, "pharmacies": pharmacies, "total": len(pharmacies)}
