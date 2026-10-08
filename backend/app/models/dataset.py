import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def get_utc_now():
    return datetime.now(timezone.utc)

class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="UPLOADED", nullable=False) # UPLOADED, PROCESSING, COMPLETED, FAILED
    progress_message: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)

    topics = relationship("Topic", back_populates="dataset", cascade="all, delete-orphan", lazy="selectin")
    documents = relationship("Document", back_populates="dataset", cascade="all, delete-orphan", lazy="selectin")

