from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Time
from sqlalchemy.orm import relationship
from database import Base


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    icon = Column(String(10), default="💊")
    reminder_type = Column(String(50), default="medicine")  # medicine | checkup | exercise | water | custom
    reminder_time = Column(Time, nullable=False)
    frequency = Column(String(50), default="daily")  # daily | weekdays | weekends | custom
    custom_days = Column(String(100), nullable=True)  # e.g. "Mon,Wed,Fri"
    is_active = Column(Boolean, default=True)
    notes = Column(String(500), nullable=True)
    last_triggered = Column(DateTime(timezone=True), nullable=True)
    snooze_until = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="reminders")
