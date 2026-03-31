"""
Chat Router
-----------
POST  /api/chat/message          Send message, get AI response (non-streaming)
GET   /api/chat/stream           SSE streaming response
GET   /api/chat/sessions         List user's chat sessions
GET   /api/chat/sessions/{id}    Get session with full message history
DELETE /api/chat/sessions/{id}   Delete a session
POST  /api/chat/sessions         Create new session
GET   /api/chat/sessions/{id}/messages  Paginated messages
"""
import json
import time
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.chat import ChatMessage, ChatSession
from models.user import User, UserProfile
from security.auth import get_current_user
from security.rate_limiter import limiter
from services.gemini_ai import chat as ai_chat, stream_chat, format_history_for_gemini
from services.symptom_engine import triage
from loguru import logger

router = APIRouter(prefix="/api/chat", tags=["AI Chat"])

_MAX_MESSAGE_LENGTH = 2000
_MAX_SESSIONS_PER_USER = 100


# ── Schemas ───────────────────────────────────────────────────────────────────

class MessageRequest(BaseModel):
    message: str
    session_id: int | None = None   # None = auto-create new session
    language: str = "en"

    @field_validator("message")
    @classmethod
    def validate_msg(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        if len(v) > _MAX_MESSAGE_LENGTH:
            raise ValueError(f"Message too long (max {_MAX_MESSAGE_LENGTH} characters)")
        return v

    @field_validator("language")
    @classmethod
    def validate_lang(cls, v: str) -> str:
        allowed = {"en", "hi", "te", "ta", "kn", "ml", "bn", "mr", "gu", "pa"}
        return v if v in allowed else "en"


class NewSessionRequest(BaseModel):
    title: str | None = None
    language: str = "en"


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_session(
    db: AsyncSession, session_id: int, user_id: int
) -> ChatSession:
    r = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user_id,
            ChatSession.is_active == True,
        )
    )
    session = r.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


async def _get_or_create_session(
    db: AsyncSession, user_id: int, session_id: int | None, language: str, first_message: str
) -> ChatSession:
    if session_id:
        return await _get_session(db, session_id, user_id)

    # Check session count limit
    count = await db.scalar(
        select(func.count()).select_from(ChatSession)
        .where(ChatSession.user_id == user_id, ChatSession.is_active == True)
    )
    if (count or 0) >= _MAX_SESSIONS_PER_USER:
        # Auto-delete oldest session
        oldest_r = await db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user_id, ChatSession.is_active == True)
            .order_by(ChatSession.updated_at.asc())
            .limit(1)
        )
        oldest = oldest_r.scalar_one_or_none()
        if oldest:
            oldest.is_active = False

    # Auto-generate title from first message
    title = first_message[:60] + ("…" if len(first_message) > 60 else "")

    session = ChatSession(
        user_id=user_id,
        session_title=title,
        language=language,
        is_active=True,
        message_count=0,
    )
    db.add(session)
    await db.flush()
    return session


async def _get_user_profile_dict(db: AsyncSession, user_id: int) -> dict | None:
    r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = r.scalar_one_or_none()
    if not profile:
        return None

    def _safe_list(val):
        if isinstance(val, list):
            return val
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return [val] if val else []
        return []

    return {
        "name": profile.display_name,
        "age": profile.age,
        "gender": profile.gender,
        "blood_group": profile.blood_group,
        "conditions": _safe_list(profile.conditions),
        "allergies": _safe_list(profile.allergies),
        "current_medications": _safe_list(profile.current_medications),
        "city": profile.city or "Hyderabad",
    }


async def _load_history(db: AsyncSession, session_id: int, limit: int = 20) -> list:
    r = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    messages = list(reversed(r.scalars().all()))
    return format_history_for_gemini(messages)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/message")
@limiter.limit("20/minute")
async def send_message(
    request: Request,
    body: MessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a message, get AI response.
    Pre-triages for emergencies before calling Gemini.
    """
    # Pre-triage (instant, no AI call needed)
    profile_dict = await _get_user_profile_dict(db, current_user.id)
    triage_result = triage(body.message, profile_dict)

    # Get/create session
    session = await _get_or_create_session(
        db, current_user.id, body.session_id, body.language, body.message
    )

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)
    await db.flush()

    # Load conversation history for context
    history = await _load_history(db, session.id)

    # Call Gemini
    ai_response = await ai_chat(
        user_message=body.message,
        history=history,
        user_profile=profile_dict,
        language=body.language,
    )

    # Use AI risk level if available, else fall back to triage result
    final_risk = ai_response.risk_level or (
        triage_result.risk_level if triage_result.risk_level != "LOW" else None
    )

    # Save assistant message
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=ai_response.text,
        risk_level=final_risk,
        tokens_used=ai_response.tokens_used,
        model_used=ai_response.model,
        latency_ms=ai_response.latency_ms,
    )
    db.add(assistant_msg)

    # Update session
    session.message_count = (session.message_count or 0) + 2
    session.updated_at = datetime.now(timezone.utc)
    await db.flush()

    response_data = {
        "success": True,
        "session_id": session.id,
        "message": {
            "id": assistant_msg.id,
            "role": "assistant",
            "content": ai_response.text,
            "risk_level": final_risk,
            "created_at": assistant_msg.created_at.isoformat(),
        },
        "triage": {
            "risk_level": triage_result.risk_level,
            "is_emergency": triage_result.is_emergency,
            "specialist": triage_result.specialist,
            "emergency_message": triage_result.emergency_message,
        },
        "error": ai_response.error,
    }

    # Log if there was a high-risk triage
    if triage_result.is_emergency:
        logger.warning(
            f"Emergency triage triggered user_id={current_user.id} "
            f"keywords={triage_result.keywords_matched}"
        )

    return response_data


@router.get("/stream")
@limiter.limit("20/minute")
async def stream_message(
    request: Request,
    message: str = Query(..., max_length=_MAX_MESSAGE_LENGTH),
    session_id: int | None = Query(None),
    language: str = Query("en"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SSE streaming response. Client receives text chunks as they are generated.
    Connect with: EventSource('/api/chat/stream?message=...')
    """
    profile_dict = await _get_user_profile_dict(db, current_user.id)
    triage_result = triage(message, profile_dict)

    session = await _get_or_create_session(
        db, current_user.id, session_id, language, message
    )

    # Save user message
    user_msg = ChatMessage(session_id=session.id, role="user", content=message)
    db.add(user_msg)
    await db.flush()
    await db.commit()

    history = await _load_history(db, session.id)

    async def event_generator() -> AsyncGenerator[str, None]:
        # Send triage result immediately
        yield f"data: {json.dumps({'type': 'triage', 'triage': {'risk_level': triage_result.risk_level, 'is_emergency': triage_result.is_emergency, 'specialist': triage_result.specialist, 'emergency_message': triage_result.emergency_message}})}\n\n"

        # Send session id
        yield f"data: {json.dumps({'type': 'session', 'session_id': session.id})}\n\n"

        full_text = ""
        risk_level = None

        async for chunk in stream_chat(message, history, profile_dict, language):
            if chunk.startswith("\n__RISK:") and chunk.endswith("__"):
                risk_level = chunk[8:-2]
                continue
            full_text += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

        # Save complete response to DB
        async with db:
            assistant_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=full_text,
                risk_level=risk_level or (triage_result.risk_level if triage_result.risk_level != "LOW" else None),
            )
            db.add(assistant_msg)
            session.message_count = (session.message_count or 0) + 2
            session.updated_at = datetime.now(timezone.utc)
            await db.commit()

        yield f"data: {json.dumps({'type': 'done', 'risk_level': risk_level, 'message_id': assistant_msg.id})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    body: NewSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = ChatSession(
        user_id=current_user.id,
        session_title=body.title or "New conversation",
        language=body.language,
        is_active=True,
        message_count=0,
    )
    db.add(session)
    await db.flush()
    return {
        "success": True,
        "session": {
            "id": session.id,
            "title": session.session_title,
            "language": session.language,
            "created_at": session.created_at.isoformat(),
        },
    }


@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    r = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id, ChatSession.is_active == True)
        .order_by(desc(ChatSession.updated_at))
        .limit(limit)
        .offset(offset)
    )
    sessions = r.scalars().all()
    total = await db.scalar(
        select(func.count()).select_from(ChatSession)
        .where(ChatSession.user_id == current_user.id, ChatSession.is_active == True)
    )
    return {
        "success": True,
        "sessions": [
            {
                "id": s.id,
                "title": s.session_title,
                "language": s.language,
                "message_count": s.message_count,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                "created_at": s.created_at.isoformat(),
            }
            for s in sessions
        ],
        "total": total or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/sessions/{session_id}")
async def get_session_with_messages(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    session = await _get_session(db, session_id, current_user.id)

    r = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    messages = r.scalars().all()
    total_msgs = await db.scalar(
        select(func.count()).select_from(ChatMessage)
        .where(ChatMessage.session_id == session_id)
    )

    return {
        "success": True,
        "session": {
            "id": session.id,
            "title": session.session_title,
            "language": session.language,
            "message_count": session.message_count,
            "created_at": session.created_at.isoformat(),
        },
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "risk_level": m.risk_level,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "total": total_msgs or 0,
    }


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await _get_session(db, session_id, current_user.id)
    session.is_active = False
    await db.flush()
    return {"success": True, "message": "Chat session deleted."}
