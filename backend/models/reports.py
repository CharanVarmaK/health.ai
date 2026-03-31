from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from models.user import EncryptedText


class HealthReport(Base):
    __tablename__ = "health_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    report_type = Column(String(50), nullable=False)  # full | symptom_summary | chat_summary | appointment
    title = Column(String(200), nullable=False)
    content_html = Column(EncryptedText, nullable=True)   # PHI — encrypted HTML content
    content_summary = Column(EncryptedText, nullable=True)  # Short encrypted summary
    generated_by = Column(String(50), default="system")   # system | ai | user
    file_path = Column(String(500), nullable=True)        # Path to generated PDF

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="reports")
