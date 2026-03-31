"""
HealthAI — FastAPI Application Entry Point

Startup sequence:
  1. Load and validate config (.env)
  2. Configure structured logging
  3. Create DB tables
  4. Mount middleware (CORS, rate limiting, logging, error handling)
  5. Register all routers
  6. Start background scheduler (reminders, token cleanup)
  7. Serve frontend static files

Run with:
  uvicorn main:app --reload --host 127.0.0.1 --port 8000
"""
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from loguru import logger

from config import get_settings, configure_logging
from database import create_all_tables, close_db, check_db_health
from middleware.logging import RequestLoggingMiddleware
from middleware.error_handler import (
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
)
from security.rate_limiter import limiter

settings = get_settings()
configure_logging(settings)

# ── Directories ───────────────────────────────────────────────────────────────
os.makedirs("logs", exist_ok=True)
os.makedirs("reports", exist_ok=True)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    logger.info("=" * 60)
    logger.info(f"  {settings.APP_NAME} starting up")
    logger.info(f"  Environment : {settings.APP_ENV}")
    logger.info(f"  Database    : {settings.DATABASE_URL.split('///')[0]}")
    logger.info(f"  Debug       : {settings.APP_DEBUG}")
    logger.info("=" * 60)

    await create_all_tables()
    _start_scheduler()

    logger.info(f"✅ {settings.APP_NAME} ready at http://{settings.APP_HOST}:{settings.APP_PORT}")
    yield

    # ── Shutdown ──
    logger.info("Shutting down…")
    _stop_scheduler()
    await close_db()
    logger.info("Shutdown complete.")


# ── Background Scheduler ──────────────────────────────────────────────────────
_scheduler = None


def _start_scheduler():
    global _scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        from security.auth import cleanup_expired_tokens
        from database import AsyncSessionLocal

        _scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

        async def _cleanup():
            async with AsyncSessionLocal() as db:
                count = await cleanup_expired_tokens(db)
                await db.commit()
                if count:
                    logger.debug(f"Cleaned up {count} expired refresh tokens")

        _scheduler.add_job(_cleanup, IntervalTrigger(hours=6), id="token_cleanup")
        _scheduler.start()
        logger.info("✅ Background scheduler started")
    except Exception as e:
        logger.warning(f"Scheduler start failed (non-fatal): {e}")


def _stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)


# ── App Factory ───────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description="Production-grade AI-powered healthcare assistant",
        version="1.0.0",
        docs_url="/api/docs" if not settings.is_production else None,
        redoc_url="/api/redoc" if not settings.is_production else None,
        openapi_url="/api/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── Rate Limiter ──
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── CORS ──
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
        max_age=3600,
    )

    # ── Request Logging ──
    app.add_middleware(RequestLoggingMiddleware)

    # ── Exception Handlers ──
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    # ── Routers ──
    from routers.auth import router as auth_router
    from routers.users import router as users_router
    from routers.chat import router as chat_router
    from routers.hospitals import router as hospitals_router
    from routers.appointments import router as appointments_router
    from routers.reminders import router as reminders_router
    from routers.family import router as family_router
    from routers.reports import router as reports_router

    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(chat_router)
    app.include_router(hospitals_router)
    app.include_router(appointments_router)
    app.include_router(reminders_router)
    app.include_router(family_router)
    app.include_router(reports_router)

    # ── Health Check ──
    @app.get("/health", tags=["System"])
    async def health():
        db_status = await check_db_health()
        healthy = db_status["status"] == "healthy"
        return JSONResponse(
            status_code=200 if healthy else 503,
            content={
                "status": "healthy" if healthy else "degraded",
                "app": settings.APP_NAME,
                "env": settings.APP_ENV,
                "database": db_status,
            },
        )

    # ── Frontend Static Files ──
    if FRONTEND_DIR.exists():
        # Serve static assets
        if (FRONTEND_DIR / "css").exists():
            app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
        if (FRONTEND_DIR / "js").exists():
            app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
        if (FRONTEND_DIR / "assets").exists():
            app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

        # Serve index.html for root and all non-API routes (SPA support)
        @app.get("/", include_in_schema=False)
        async def serve_root():
            index = FRONTEND_DIR / "index.html"
            if index.exists():
                return FileResponse(str(index))
            return JSONResponse({"message": f"{settings.APP_NAME} API is running"})

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str, request: Request):
            # Don't intercept API routes
            if full_path.startswith("api/"):
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="API endpoint not found")
            # Try to serve the exact file first
            file_path = FRONTEND_DIR / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(str(file_path))
            # Fall back to index.html for client-side routing
            index = FRONTEND_DIR / "index.html"
            if index.exists():
                return FileResponse(str(index))
            raise StarletteHTTPException(status_code=404)
    else:
        logger.warning(f"Frontend directory not found at {FRONTEND_DIR} — serving API only")

        @app.get("/", include_in_schema=False)
        async def api_root():
            return {
                "app": settings.APP_NAME,
                "version": "1.0.0",
                "docs": "/api/docs",
                "health": "/health",
            }

    return app


app = create_app()


# ── Dev entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.APP_DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=False,  # We handle our own request logging
    )
