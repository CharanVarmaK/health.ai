from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
from models.user import EncryptedText


class FamilyMember(Base):
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    display_name = Column(String(100), nullable=False)
    relation = Column(String(50), nullable=False)  # Wife, Son, Father, etc.
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)

    # PHI — encrypted
    full_name = Column(EncryptedText, nullable=True)
    date_of_birth = Column(EncryptedText, nullable=True)
    blood_group = Column(EncryptedText, nullable=True)
    phone = Column(EncryptedText, nullable=True)
    conditions = Column(EncryptedText, nullable=True)    # JSON list
    allergies = Column(EncryptedText, nullable=True)     # JSON list
    medications = Column(EncryptedText, nullable=True)   # JSON list

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="family_members")
