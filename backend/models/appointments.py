from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Date, Time
from sqlalchemy.orm import relationship
from database import Base
from models.user import EncryptedText


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    doctor_name = Column(String(200), nullable=False)
    specialty = Column(String(100), nullable=False)
    hospital_name = Column(String(200), nullable=False)
    hospital_address = Column(String(500), nullable=True)
    appointment_date = Column(Date, nullable=False)
    appointment_time = Column(Time, nullable=False)
    status = Column(String(20), default="upcoming")  # upcoming | completed | cancelled
    notes = Column(EncryptedText, nullable=True)     # PHI — symptoms/reason
    reminder_sent = Column(Boolean, default=False)
    is_for_family_member = Column(Boolean, default=False)
    family_member_id = Column(Integer, ForeignKey("family_members.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="appointments")
