"""
Authentication Router — all endpoints fully implemented.

POST   /api/auth/register     Create account
POST   /api/auth/login        Login, receive token pair
POST   /api/auth/refresh      Rotate refresh token
POST   /api/auth/logout       Revoke current session
POST   /api/auth/logout-all   Revoke every session for this user
GET    /api/auth/me           Current user info
DELETE /api/auth/account      GDPR-compliant permanent account deletion
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from models.user import User, UserProfile
from security.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    revoke_all_user_tokens,
    revoke_refresh_token,
    store_refresh_token,
    validate_refresh_token,
)
from security.passwords import (
    get_lockout_remaining_minutes,
    hash_password,
    is_account_locked,
    should_lock_account,
    validate_password_strength,
    verify_password,
)
from security.rate_limiter import auth_limiter
from loguru import logger

settings = get_settings()
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str

    @field_validator("display_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Display name must be at least 2 characters")
        if len(v) > 100:
            raise ValueError("Display name must not exceed 100 characters")
        for ch in ["<", ">", '"', "'"]:
            v = v.replace(ch, "")
        return v

    @field_validator("password")
    @classmethod
    def validate_pwd(cls, v: str) -> str:
        is_valid, msg = validate_password_strength(v)
        if not is_valid:
            raise ValueError(msg)
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class DeleteAccountRequest(BaseModel):
    password: str
    confirm: str

    @field_validator("confirm")
    @classmethod
    def validate_confirm(cls, v: str) -> str:
        if v != "DELETE MY ACCOUNT":
            raise ValueError('Confirmation text must be exactly "DELETE MY ACCOUNT"')
        return v


# ── Helpers ───────────────────────────────────────────────────────────────────

def _client_meta(request: Request) -> tuple[str, str]:
    ua = request.headers.get("User-Agent", "")[:500]
    ip = request.client.host if request.client else "unknown"
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        ip = xff.split(",")[0].strip()
    return ua, ip


async def _user_by_email(db: AsyncSession, email: str) -> User | None:
    r = await db.execute(select(User).where(User.email == email.lower()))
    return r.scalar_one_or_none()


def _token_payload(access_token: str, refresh_token: str) -> dict:
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
@auth_limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    existing = await _user_by_email(db, body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    profile = UserProfile(
        user_id=user.id,
        display_name=body.display_name,
        full_name=body.display_name,
    )
    db.add(profile)
    await db.flush()

    ua, ip = _client_meta(request)
    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token()
    await store_refresh_token(db, user.id, refresh_token, ua, ip)

    logger.info(f"User registered id={user.id}")
    return {
        "success": True,
        "message": "Account created successfully.",
        "tokens": _token_payload(access_token, refresh_token),
        "user": {
            "id": user.id,
            "email": user.email,
            "display_name": body.display_name,
            "language": "en",
        },
    }


@router.post("/login")
@auth_limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
    )
    # Constant-time dummy to prevent user-enumeration via timing
    _DUMMY = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewHQhbS0yHe8OWVK"

    user = await _user_by_email(db, body.email)
    if not user:
        verify_password(body.password, _DUMMY)
        raise invalid

    if is_account_locked(user):
        mins = get_lockout_remaining_minutes(user)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account locked due to repeated failures. Try again in {mins} minute(s).",
        )

    if not verify_password(body.password, user.hashed_password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        should_lock, locked_until = should_lock_account(user.failed_login_attempts)
        if should_lock:
            user.locked_until = locked_until
            logger.warning(f"Account locked user_id={user.id} after {user.failed_login_attempts} attempts")
        await db.flush()
        raise invalid

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact support.",
        )

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = datetime.now(timezone.utc)
    await db.flush()

    ua, ip = _client_meta(request)
    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token()
    await store_refresh_token(db, user.id, refresh_token, ua, ip)

    r = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = r.scalar_one_or_none()

    logger.info(f"User logged in id={user.id}")
    return {
        "success": True,
        "message": "Login successful.",
        "tokens": _token_payload(access_token, refresh_token),
        "user": {
            "id": user.id,
            "email": user.email,
            "display_name": profile.display_name if profile else "User",
            "language": profile.language if profile else "en",
        },
    }


@router.post("/refresh")
@auth_limiter.limit("30/minute")
async def refresh(
    request: Request,
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    rt = await validate_refresh_token(db, body.refresh_token)
    if not rt:
        logger.warning("Expired/invalid refresh token — possible replay")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please login again.",
        )

    r = await db.execute(select(User).where(User.id == rt.user_id))
    user = r.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    rt.revoked = True
    await db.flush()

    ua, ip = _client_meta(request)
    access_token = create_access_token(user.id, user.email)
    new_refresh = create_refresh_token()
    await store_refresh_token(db, user.id, new_refresh, ua, ip)

    return {"success": True, "tokens": _token_payload(access_token, new_refresh)}


@router.post("/logout")
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await revoke_refresh_token(db, body.refresh_token)
    return {"success": True, "message": "Logged out successfully."}


@router.post("/logout-all")
async def logout_all(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await revoke_all_user_tokens(db, current_user.id)
    logger.info(f"All sessions revoked user_id={current_user.id}")
    return {"success": True, "message": "Logged out from all devices."}


@router.get("/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    profile = r.scalar_one_or_none()
    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "display_name": profile.display_name if profile else "User",
            "language": profile.language if profile else "en",
            "is_verified": current_user.is_verified,
            "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
            "member_since": current_user.created_at.isoformat(),
        },
    }


@router.delete("/account")
async def delete_account(
    body: DeleteAccountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GDPR Art. 17 — Right to erasure. Permanently deletes ALL user data."""
    if not verify_password(body.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Deletion aborted.",
        )

    uid = current_user.id
    logger.warning(f"GDPR deletion started user_id={uid}")
    await db.delete(current_user)  # CASCADE removes all child records
    await db.flush()
    logger.warning(f"GDPR deletion complete user_id={uid}")

    return {
        "success": True,
        "message": "Your account and all health data have been permanently deleted.",
    }
