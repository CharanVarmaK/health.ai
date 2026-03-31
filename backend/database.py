"""
HealthAI Database Layer
- Async SQLAlchemy with connection pooling
- Automatic table creation on startup
- Health check endpoint support
- SQLite for dev, PostgreSQL-ready for prod
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text, event
from loguru import logger
from config import get_settings

settings = get_settings()


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def _build_engine_url(url: str) -> str:
    """Convert sync DB URL to async driver URL."""
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "sqlite+aiosqlite:///")
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://")
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
    return url


def _create_engine() -> AsyncEngine:
    url = _build_engine_url(settings.DATABASE_URL)

    kwargs: dict = {
        "echo": settings.APP_DEBUG,
        "future": True,
    }

    if settings.is_sqlite:
        # SQLite-specific settings
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # PostgreSQL connection pool settings
        kwargs.update({
            "pool_size": 20,
            "max_overflow": 40,
            "pool_timeout": 30,
            "pool_recycle": 1800,   # Recycle connections every 30 min
            "pool_pre_ping": True,  # Verify connection before use
        })

    engine = create_async_engine(url, **kwargs)

    # Enable WAL mode for SQLite (better concurrent read performance)
    if settings.is_sqlite:
        @event.listens_for(engine.sync_engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

    return engine


# Global engine and session factory
engine: AsyncEngine = _create_engine()

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency — yields a DB session per request.
    Automatically handles commit/rollback/close.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_all_tables() -> None:
    """Create all tables on startup if they don't exist."""
    # Import all models to register them with Base
    from models import user, family, appointments, reminders, chat, reports  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables ready")


async def check_db_health() -> dict:
    """Check database connectivity — used by health endpoint."""
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT 1"))
            result.fetchone()
        return {"status": "healthy", "database": settings.DATABASE_URL.split("///")[0]}
    except Exception as e:
        logger.error(f"DB health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}


async def close_db() -> None:
    """Graceful shutdown — dispose connection pool."""
    await engine.dispose()
    logger.info("Database connections closed")
