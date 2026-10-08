import io
import csv
import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db, AsyncSessionLocal
from app.models.dataset import Dataset
from app.models.topic import Topic
from app.models.document import Document
from app.schemas.analysis import ClusteringParameters, AnalysisProgressResponse, AnalysisResultsResponse
from app.schemas.topic import TopicSummary
from app.schemas.document import DocumentScatterPoint, DocumentDetail
from app.services.pipeline_service import PipelineService

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])

async def run_pipeline_in_background(dataset_id: str, params: ClusteringParameters):
    """Executa a esteira analítica em uma sessão assíncrona dedicada de background."""
    async with AsyncSessionLocal() as session:
        await PipelineService.run_analysis(dataset_id, params, session)

@router.post("/{dataset_id}/start")
async def start_analysis(
    dataset_id: str,
    params: ClusteringParameters = ClusteringParameters(),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db)
):
    """Inicia o processamento assíncrono de agrupamento e síntese de tópicos."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset não encontrado")

    if dataset.document_count == 0:
        raise HTTPException(status_code=400, detail="Dataset não contém documentos para analisar")

    dataset.status = "PROCESSING"
    dataset.progress_percent = 5
    dataset.progress_message = "Iniciando esteira de processamento..."
    dataset.error_message = None
    await db.commit()

    # Dispara background task independente
    background_tasks.add_task(run_pipeline_in_background, dataset_id, params)

    return {
        "message": "Processamento de inteligência iniciado com sucesso",
        "dataset_id": dataset_id,
        "status": "PROCESSING"
    }

@router.get("/{dataset_id}/status", response_model=AnalysisProgressResponse)
async def get_analysis_status(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Acompanha o progresso em tempo real da análise."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset não encontrado")

    return AnalysisProgressResponse(
        dataset_id=dataset.id,
        status=dataset.status,
        progress_percent=dataset.progress_percent,
        progress_message=dataset.progress_message,
        error_message=dataset.error_message
    )

@router.get("/{dataset_id}/results", response_model=AnalysisResultsResponse)
async def get_analysis_results(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Retorna os resultados consolidados: tópicos gerados, centroides e coordenadas 2D para visualização."""
    res_ds = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = res_ds.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset não encontrado")

    if dataset.status != "COMPLETED":
        raise HTTPException(status_code=400, detail=f"A análise ainda não está concluída (Status atual: {dataset.status})")

    # Recupera tópicos ordenados por quantidade de documentos (excluindo ruído -1 da primeira posição se desejado)
    res_topics = await db.execute(
        select(Topic).where(Topic.dataset_id == dataset_id).order_by(desc(Topic.document_count))
    )
    topics = res_topics.scalars().all()

    # Recupera documentos com coordenadas
    res_docs = await db.execute(
        select(Document).where(Document.dataset_id == dataset_id)
    )
    docs = res_docs.scalars().all()

    scatter_points = []
    clustered_count = 0
    noise_count = 0

    for doc in docs:
        if doc.cluster_label == -1:
            noise_count += 1
        else:
            clustered_count += 1

        scatter_points.append(
            DocumentScatterPoint(
                id=doc.id,
                x=float(doc.coord_x or 0.0),
                y=float(doc.coord_y or 0.0),
                cluster_label=doc.cluster_label,
                text_snippet=doc.clean_text[:140] + ("..." if len(doc.clean_text) > 140 else ""),
                is_exemplar=doc.is_exemplar
            )
        )

    topic_summaries = [
        TopicSummary(
            id=t.id,
            cluster_label=t.cluster_label,
            title=t.title,
            summary=t.summary,
            keywords=t.keywords or [],
            document_count=t.document_count,
            percentage=t.percentage,
            density_score=t.density_score,
            created_at=t.created_at
        )
        for t in topics
    ]

    return AnalysisResultsResponse(
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        total_documents=len(docs),
        clustered_documents=clustered_count,
        noise_documents=noise_count,
        topics=topic_summaries,
        scatter_points=scatter_points,
        execution_time_seconds=0.0
    )

@router.get("/{dataset_id}/documents/{document_id}", response_model=DocumentDetail)
async def get_document_detail(dataset_id: str, document_id: str, db: AsyncSession = Depends(get_db)):
    """Retorna detalhes completos e metadados de um documento inspecionado."""
    res = await db.execute(
        select(Document).where(Document.dataset_id == dataset_id, Document.id == document_id)
    )
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return doc

@router.get("/{dataset_id}/export/csv")
async def export_analysis_csv(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Exporta o resultado do agrupamento para download em formato CSV."""
    res_ds = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = res_ds.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset não encontrado")

    res_topics = await db.execute(select(Topic).where(Topic.dataset_id == dataset_id))
    topic_titles = {t.cluster_label: t.title for t in res_topics.scalars().all()}

    res_docs = await db.execute(select(Document).where(Document.dataset_id == dataset_id))
    docs = res_docs.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["document_id", "cluster_label", "topic_title", "is_exemplar", "coord_x", "coord_y", "text"])

    for doc in docs:
        topic_title = topic_titles.get(doc.cluster_label, "Ruído" if doc.cluster_label == -1 else f"Cluster {doc.cluster_label}")
        writer.writerow([
            doc.id,
            doc.cluster_label,
            topic_title,
            doc.is_exemplar,
            round(doc.coord_x or 0.0, 4),
            round(doc.coord_y or 0.0, 4),
            doc.original_text
        ])

    output.seek(0)
    filename = f"topiclens_{dataset.name.replace(' ', '_').lower()}_export.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

