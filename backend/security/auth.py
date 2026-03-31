"""
JWT Authentication
- Short-lived access tokens (15 min)
- Long-lived refresh tokens (7 days) with rotation
- Refresh tokens stored hashed in DB
- Token revocation support
"""
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from config import get_settings
from database import get_db
from models.user import User, RefreshToken

settings = get_settings()

# Custom HTTPBearer that returns 401 instead of 403 on missing token
class OptionalHTTPBearer(HTTPBearer):
    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        try:
            return await super().__call__(request)
        except HTTPException:
            return None


bearer_scheme = HTTPBearer(auto_error=True)


def create_access_token(user_id: int, email: str) -> str:
    """Create a short-lived JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token() -> str:
    """Create a cryptographically secure refresh token."""
    return secrets.token_urlsafe(64)


def hash_token(token: str) -> str:
    """Hash a refresh token for secure storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token.
    Returns payload dict or None if invalid/expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError as e:
        logger.debug(f"Token decode failed: {type(e).__name__}")
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency — validates JWT and returns current user.
    Raises 401 if token is invalid, expired, or user not found/inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise credentials_exception

    user_id_str: str = payload.get("sub")
    if not user_id_str:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support.",
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Alias for get_current_user — semantic clarity in routes."""
    return current_user


async def store_refresh_token(
    db: AsyncSession,
    user_id: int,
    token: str,
    user_agent: str = None,
    ip_address: str = None,
) -> RefreshToken:
    """Store a hashed refresh token in the database."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    rt = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(token),
        expires_at=expire,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(rt)
    await db.flush()
    return rt


async def validate_refresh_token(
    db: AsyncSession, token: str
) -> Optional[RefreshToken]:
    """
    Validate a refresh token against the database.
    Returns the RefreshToken record or None if invalid.
    """
    token_hash = hash_token(token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    return result.scalar_one_or_none()


async def revoke_refresh_token(db: AsyncSession, token: str) -> bool:
    """Revoke a specific refresh token (logout)."""
    rt = await validate_refresh_token(db, token)
    if rt:
        rt.revoked = True
        await db.flush()
        return True
    return False


async def revoke_all_user_tokens(db: AsyncSession, user_id: int) -> None:
    """Revoke all refresh tokens for a user (logout everywhere)."""
    from sqlalchemy import update
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked == False)
        .values(revoked=True)
    )
    await db.flush()


async def cleanup_expired_tokens(db: AsyncSession) -> int:
    """Delete expired tokens — called by background scheduler."""
    from sqlalchemy import delete
    result = await db.execute(
        delete(RefreshToken).where(
            RefreshToken.expires_at < datetime.now(timezone.utc)
        )
    )
    return result.rowcount
