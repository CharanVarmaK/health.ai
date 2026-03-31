"""
Rate Limiting
- Per-IP limiting for auth endpoints (prevents brute force)
- Per-user limiting for API endpoints
- Per-user limiting for AI chat (respects Gemini free tier)
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def get_user_id_or_ip(request: Request) -> str:
    """Rate limit key: user ID if authenticated, else IP address."""
    # Try to get user from request state (set by auth middleware)
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return get_remote_address(request)


# General API limiter — by IP for unauthenticated, by user ID for authenticated
limiter = Limiter(key_func=get_user_id_or_ip)

# Strict limiter for auth endpoints — always by IP
auth_limiter = Limiter(key_func=get_remote_address)
