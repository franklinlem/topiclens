import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def get_utc_now():
    return datetime.now(timezone.utc)

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id: Mapped[str] = mapped_column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("topics.id", ondelete="SET NULL"), nullable=True, index=True)
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    clean_text: Mapped[str] = mapped_column(Text, nullable=False)
    cluster_label: Mapped[int] = mapped_column(Integer, default=-1, nullable=False, index=True)
    is_exemplar: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    coord_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    coord_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    dataset = relationship("Dataset", back_populates="documents")
    topic = relationship("Topic", back_populates="documents")

