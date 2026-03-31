"""
Family Members Router
POST   /api/family           Add family member
GET    /api/family           List family members
PUT    /api/family/{id}      Update member
DELETE /api/family/{id}      Remove member
"""
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.family import FamilyMember
from models.user import User
from security.auth import get_current_user
from security.rate_limiter import limiter

router = APIRouter(prefix="/api/family", tags=["Family"])

RELATIONS = ["Spouse","Wife","Husband","Son","Daughter","Father","Mother","Brother","Sister","Grandfather","Grandmother","Other"]
COLORS = ["#d1fae5","#dbeafe","#fef3c7","#ede9fe","#fee2e2","#fce7f3","#ecfdf5","#f0f9ff"]
TEXT_COLORS = ["#065f46","#1d4ed8","#92400e","#5b21b6","#991b1b","#9d174d","#064e3b","#0c4a6e"]


class FamilyCreate(BaseModel):
    display_name: str
    relation: str
    age: Optional[int] = None
    gender: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    blood_group: Optional[str] = None
    phone: Optional[str] = None
    conditions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    medications: Optional[List[str]] = None

    @field_validator("display_name")
    @classmethod
    def val_name(cls, v):
        v = v.strip()
        if len(v) < 2: raise ValueError("Name must be at least 2 characters")
        return v[:100]

    @field_validator("relation")
    @classmethod
    def val_rel(cls, v):
        if v not in RELATIONS: raise ValueError(f"Relation must be one of: {', '.join(RELATIONS)}")
        return v

    @field_validator("age")
    @classmethod
    def val_age(cls, v):
        if v is not None and not (0 <= v <= 120): raise ValueError("Age must be 0–120")
        return v


class FamilyUpdate(BaseModel):
    display_name: Optional[str] = None
    relation: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    phone: Optional[str] = None
    conditions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    medications: Optional[List[str]] = None


def _fam_to_dict(f: FamilyMember, idx: int = 0) -> dict:
    import json
    def _sl(v):
        if isinstance(v, list): return v
        if isinstance(v, str):
            try: return json.loads(v)
            except: return [v] if v else []
        return []
    ci = idx % len(COLORS)
    return {
        "id": f.id,
        "display_name": f.display_name,
        "initials": "".join(p[0] for p in f.display_name.split()[:2]).upper(),
        "relation": f.relation,
        "age": f.age,
        "gender": f.gender,
        "blood_group": f.blood_group,
        "conditions": _sl(f.conditions),
        "allergies": _sl(f.allergies),
        "medications": _sl(f.medications),
        "color": COLORS[ci],
        "text_color": TEXT_COLORS[ci],
        "created_at": f.created_at.isoformat(),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def add_member(
    request: Request,
    body: FamilyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    count = await db.scalar(select(func.count()).select_from(FamilyMember).where(
        FamilyMember.user_id == current_user.id, FamilyMember.is_active == True))
    if (count or 0) >= 20:
        raise HTTPException(status_code=400, detail="Maximum 20 family members per account")

    member = FamilyMember(
        user_id=current_user.id,
        display_name=body.display_name,
        full_name=body.full_name or body.display_name,
        relation=body.relation,
        age=body.age,
        gender=body.gender,
        blood_group=body.blood_group,
        phone=body.phone,
        conditions=body.conditions,
        allergies=body.allergies,
        medications=body.medications,
        is_active=True,
    )
    db.add(member)
    await db.flush()
    return {"success": True, "member": _fam_to_dict(member)}


@router.get("")
async def list_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(FamilyMember).where(FamilyMember.user_id == current_user.id, FamilyMember.is_active == True)
        .order_by(FamilyMember.created_at.asc())
    )
    members = r.scalars().all()
    return {"success": True, "members": [_fam_to_dict(m, i) for i, m in enumerate(members)], "relations": RELATIONS}


@router.put("/{member_id}")
async def update_member(
    member_id: int,
    body: FamilyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(select(FamilyMember).where(FamilyMember.id == member_id, FamilyMember.user_id == current_user.id))
    member = r.scalar_one_or_none()
    if not member: raise HTTPException(status_code=404, detail="Family member not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(member, k, v)
    member.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return {"success": True, "member": _fam_to_dict(member)}


@router.delete("/{member_id}")
async def delete_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(select(FamilyMember).where(FamilyMember.id == member_id, FamilyMember.user_id == current_user.id))
    member = r.scalar_one_or_none()
    if not member: raise HTTPException(status_code=404, detail="Family member not found")
    member.is_active = False
    member.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return {"success": True, "message": "Family member removed."}
