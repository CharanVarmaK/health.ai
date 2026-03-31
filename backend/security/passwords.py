"""
Password Security
- bcrypt hashing with configurable rounds
- Account lockout after failed attempts
- Timing-safe comparison
"""
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from loguru import logger

# bcrypt with 12 rounds — good balance of security vs performance
# Each hash takes ~250ms which is acceptable for login but prevents brute force
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
)

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    Uses timing-safe comparison to prevent timing attacks.
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.warning(f"Password verification error: {type(e).__name__}")
        return False


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password meets security requirements.
    Returns (is_valid, error_message).
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if len(password) > 128:
        return False, "Password must not exceed 128 characters"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number"
    if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in password):
        return False, "Password must contain at least one special character"

    # Common password check
    common = ["password", "123456", "qwerty", "letmein", "admin", "welcome"]
    if password.lower() in common or any(c in password.lower() for c in common):
        return False, "Password is too common. Please choose a stronger password"

    return True, ""


def is_account_locked(user) -> bool:
    """Check if user account is locked due to failed login attempts."""
    if user.locked_until is None:
        return False
    now = datetime.now(timezone.utc)
    if user.locked_until > now:
        return True
    return False


def get_lockout_remaining_minutes(user) -> int:
    """Return minutes remaining in lockout period."""
    if not is_account_locked(user):
        return 0
    now = datetime.now(timezone.utc)
    delta = user.locked_until - now
    return max(1, int(delta.total_seconds() / 60))


def should_lock_account(failed_attempts: int) -> tuple[bool, datetime | None]:
    """
    Determine if account should be locked based on failed attempts.
    Returns (should_lock, locked_until).
    """
    if failed_attempts >= MAX_FAILED_ATTEMPTS:
        locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        return True, locked_until
    return False, None
