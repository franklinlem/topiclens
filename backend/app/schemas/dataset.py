from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class DatasetCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Nome identificador do dataset")
    description: Optional[str] = Field(default=None, description="Descrição opcional do dataset")

class DatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    document_count: int
    status: str
    progress_message: Optional[str] = None
    progress_percent: int = 0
    created_at: datetime
    updated_at: datetime

class DatasetUploadPreview(BaseModel):
    total_rows: int
    columns: list[str]
    suggested_text_column: str
    sample_rows: list[dict]

