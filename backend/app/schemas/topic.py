from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class TopicSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    cluster_label: int
    title: str
    summary: str
    keywords: List[str]
    document_count: int
    percentage: float
    density_score: Optional[float] = None
    created_at: datetime

