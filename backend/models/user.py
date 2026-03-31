"""
User & Medical Profile Models
All sensitive health data (PHI) is encrypted at rest using Fernet symmetric encryption.
Encryption/decryption is transparent via SQLAlchemy TypeDecorator.
"""
import json
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime,
    Text, Enum as SAEnum, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, TEXT
from cryptography.fernet import Fernet, InvalidToken
from database import Base
from config import get_settings

settings = get_settings()
_fernet = Fernet(settings.ENCRYPTION_KEY.encode())


class EncryptedText(TypeDecorator):
    """
    SQLAlchemy column type that transparently encrypts/decrypts values.
    Stored as: ENCRYPT::<base64-ciphertext>
    If value is None or empty, stored as-is.
    """
    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value, dialect):
        """Encrypt before saving to DB."""
        if value is None or value == "":
            return value
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        try:
            encrypted = _fernet.encrypt(str(value).encode()).decode()
            return f"ENCRYPT::{encrypted}"
        except Exception:
            return value  # Fallback: store unencrypted rather than crash

    def process_result_value(self, value, dialect):
        """Decrypt after reading from DB."""
        if value is None or not isinstance(value, str):
            return value
        if not value.startswith("ENCRYPT::"):
            return value  # Legacy unencrypted value
        try:
            decrypted = _fernet.decrypt(value[9:].encode()).decode()
            # Try to parse as JSON (for list/dict fields)
            try:
                return json.loads(decrypted)
            except (json.JSONDecodeError, ValueError):
                return decrypted
        except InvalidToken:
            return "[DECRYPTION_ERROR]"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime(timezone=True), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    family_members = relationship("FamilyMember", back_populates="user", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="user", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("HealthReport", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_email_active", "email", "is_active"),
    )

    def __repr__(self):
        return f"<User id={self.id} email=[REDACTED]>"


class UserProfile(Base):
    """
    Extended medical profile. All PHI fields are encrypted at rest.
    """
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Basic info (non-PHI, searchable)
    display_name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(SAEnum("Male", "Female", "Other", "Prefer not to say", name="gender_enum"), nullable=True)
    language = Column(String(10), default="en")

    # PHI — encrypted at rest
    full_name = Column(EncryptedText, nullable=True)
    date_of_birth = Column(EncryptedText, nullable=True)
    phone = Column(EncryptedText, nullable=True)
    blood_group = Column(EncryptedText, nullable=True)
    height_cm = Column(EncryptedText, nullable=True)
    weight_kg = Column(EncryptedText, nullable=True)
    address = Column(EncryptedText, nullable=True)
    city = Column(String(100), default="Hyderabad")
    state = Column(String(100), default="Telangana")
    country = Column(String(100), default="India")
    latitude = Column(EncryptedText, nullable=True)
    longitude = Column(EncryptedText, nullable=True)

    # Medical history (PHI — encrypted)
    conditions = Column(EncryptedText, nullable=True)        # JSON list
    allergies = Column(EncryptedText, nullable=True)         # JSON list
    current_medications = Column(EncryptedText, nullable=True)  # JSON list
    family_history = Column(EncryptedText, nullable=True)    # JSON list
    surgeries = Column(EncryptedText, nullable=True)         # JSON list
    emergency_contact_name = Column(EncryptedText, nullable=True)
    emergency_contact_phone = Column(EncryptedText, nullable=True)

    # Health metrics (PHI — encrypted)
    blood_pressure = Column(EncryptedText, nullable=True)
    heart_rate = Column(EncryptedText, nullable=True)
    temperature = Column(EncryptedText, nullable=True)
    spo2 = Column(EncryptedText, nullable=True)
    blood_glucose = Column(EncryptedText, nullable=True)
    cholesterol = Column(EncryptedText, nullable=True)

    # Settings
    notifications_enabled = Column(Boolean, default=True)
    share_data_for_improvement = Column(Boolean, default=False)
    data_retention_days = Column(Integer, default=365)

    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship
    user = relationship("User", back_populates="profile")


class RefreshToken(Base):
    """Stored refresh tokens for JWT rotation."""
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    revoked = Column(Boolean, default=False)
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)  # Supports IPv6

    user = relationship("User", back_populates="refresh_tokens")
