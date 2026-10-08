from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class DocumentScatterPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    x: float
    y: float
    cluster_label: int
    text_snippet: str
    is_exemplar: bool

class DocumentDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    dataset_id: str
    topic_id: Optional[str] = None
    original_text: str
    clean_text: str
    cluster_label: int
    is_exemplar: bool
    coord_x: Optional[float] = None
    coord_y: Optional[float] = None
    metadata_json: Dict[str, Any] = {}
    created_at: datetime

