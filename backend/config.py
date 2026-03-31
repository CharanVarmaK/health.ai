"""
HealthAI Configuration
Loads and validates all environment variables at startup.
Application will refuse to start if required config is missing.
"""
import os
import sys
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from loguru import logger


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "HealthAI"
    APP_ENV: str = "development"
    APP_HOST: str = "127.0.0.1"
    APP_PORT: int = 8000
    APP_DEBUG: bool = True

    # Security
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENCRYPTION_KEY: str

    # Database
    DATABASE_URL: str = "sqlite:///./healthai.db"

    # Gemini AI
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:8000,http://127.0.0.1:8000"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    CHAT_RATE_LIMIT_PER_MINUTE: int = 20

    # Email (optional)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@healthai.local"

    # Maps (optional)
    GOOGLE_MAPS_API_KEY: str = ""

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/healthai.log"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if v == "CHANGE_ME_generate_a_64_char_hex_string_using_command_above":
            raise ValueError(
                "\n\n❌ SECRET_KEY not set!\n"
                "Run: python -c \"import secrets; print(secrets.token_hex(64))\"\n"
                "Then add the output to your .env file as SECRET_KEY=...\n"
            )
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @field_validator("ENCRYPTION_KEY")
    @classmethod
    def validate_encryption_key(cls, v: str) -> str:
        if v == "CHANGE_ME_generate_with_fernet_command_above":
            raise ValueError(
                "\n\n❌ ENCRYPTION_KEY not set!\n"
                "Run: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"\n"
                "Then add the output to your .env file as ENCRYPTION_KEY=...\n"
            )
        return v

    @field_validator("GEMINI_API_KEY")
    @classmethod
    def validate_gemini_key(cls, v: str) -> str:
        if v == "your_gemini_api_key_here" or not v:
            raise ValueError(
                "\n\n❌ GEMINI_API_KEY not set!\n"
                "Get your free API key from: https://aistudio.google.com\n"
                "Then add it to your .env file as GEMINI_API_KEY=...\n"
            )
        return v

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


@lru_cache()
def get_settings() -> Settings:
    """Cached settings — loaded once at startup."""
    try:
        settings = Settings()
        return settings
    except Exception as e:
        logger.error(f"❌ Configuration error: {e}")
        sys.exit(1)


def configure_logging(settings: Settings) -> None:
    """Configure loguru logging with PII stripping."""
    import os
    os.makedirs("logs", exist_ok=True)

    # Remove default handler
    logger.remove()

    # Console handler
    logger.add(
        sys.stdout,
        level=settings.LOG_LEVEL,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
        colorize=True,
    )

    # File handler — strips sensitive data
    logger.add(
        settings.LOG_FILE,
        level=settings.LOG_LEVEL,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
        rotation="10 MB",
        retention="30 days",
        compression="zip",
        filter=_strip_pii,
    )

    logger.info(f"✅ HealthAI starting in {settings.APP_ENV} mode")


def _strip_pii(record: dict) -> bool:
    """Remove sensitive data from log records before writing to file."""
    import re
    msg = record["message"]
    # Strip potential tokens, passwords, keys from logs
    msg = re.sub(r'(password|token|key|secret|authorization)["\s:=]+\S+', r'\1=[REDACTED]', msg, flags=re.IGNORECASE)
    msg = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', msg)
    msg = re.sub(r'\b\d{10}\b', '[PHONE]', msg)
    record["message"] = msg
    return True
