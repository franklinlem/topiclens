from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.topic import TopicSummary
from app.schemas.document import DocumentScatterPoint

class ClusteringParameters(BaseModel):
    min_cluster_size: int = Field(default=15, ge=2, le=500, description="Tamanho mínimo de documentos para formar um cluster")
    min_samples: int = Field(default=5, ge=1, le=100, description="Conservadorismo do agrupamento (maior = mais ruído, clusters mais densos)")
    n_neighbors_umap: int = Field(default=15, ge=2, le=100, description="Número de vizinhos locais para UMAP")
    umap_components: int = Field(default=5, ge=2, le=20, description="Dimensões intermediárias para clustering")
    llm_model: str = Field(default="gpt-4o-mini", description="Modelo para síntese de rótulos (ou 'heuristic' para local)")

class AnalysisProgressResponse(BaseModel):
    dataset_id: str
    status: str
    progress_percent: int
    progress_message: Optional[str] = None
    error_message: Optional[str] = None

class AnalysisResultsResponse(BaseModel):
    dataset_id: str
    dataset_name: str
    total_documents: int
    clustered_documents: int
    noise_documents: int
    topics: List[TopicSummary]
    scatter_points: List[DocumentScatterPoint]
    execution_time_seconds: float

