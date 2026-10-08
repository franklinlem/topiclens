import io
import uuid
import json
import pandas as pd
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models.dataset import Dataset
from app.models.document import Document
from app.schemas.dataset import DatasetResponse, DatasetUploadPreview
from app.services.embedding_service import EmbeddingService

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

@router.get("", response_model=List[DatasetResponse])
async def list_datasets(db: AsyncSession = Depends(get_db)):
    """Lista todos os datasets ordenados pela data de criação decrescente."""
    result = await db.execute(select(Dataset).order_by(desc(Dataset.created_at)))
    return result.scalars().all()

@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Retorna detalhes de um dataset específico."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset não encontrado")
    return dataset

@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Exclui um dataset e todos os seus tópicos e documentos associados."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset não encontrado")
    await db.delete(dataset)
    await db.commit()
    return None

def detect_text_column(df: pd.DataFrame) -> str:
    """Identifica automaticamente a coluna mais provável contendo o texto principal."""
    text_candidates = ["text", "texto", "review", "feedback", "comment", "comentario", "description", "descricao", "message", "mensagem", "content", "conteudo"]
    
    # Busca por nome correspondente
    for col in df.columns:
        if str(col).lower().strip() in text_candidates:
            return str(col)
            
    # Procura coluna de string com maior tamanho médio de caracteres
    string_cols = [c for c in df.columns if df[c].dtype == object or pd.api.types.is_string_dtype(df[c])]
    if string_cols:
        best_col = max(string_cols, key=lambda c: df[c].astype(str).str.len().mean())
        return str(best_col)

    return str(df.columns[0])

@router.post("/preview", response_model=DatasetUploadPreview)
async def preview_file(file: UploadFile = File(...)):
    """Analisa um arquivo CSV/JSON sem salvar, retornando colunas e sugestão da coluna de texto."""
    contents = await file.read()
    filename = file.filename or ""

    try:
        if filename.endswith(".json"):
            data = json.loads(contents.decode("utf-8"))
            df = pd.DataFrame(data)
        else:
            # Tenta ler com diferentes delimitadores
            try:
                df = pd.read_csv(io.BytesIO(contents))
            except Exception:
                df = pd.read_csv(io.BytesIO(contents), sep=";")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar arquivo: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="O arquivo está vazio")

    suggested = detect_text_column(df)
    cols = [str(c) for c in df.columns]
    sample_rows = df.head(5).fillna("").to_dict(orient="records")

    return DatasetUploadPreview(
        total_rows=len(df),
        columns=cols,
        suggested_text_column=suggested,
        sample_rows=sample_rows
    )

@router.post("/upload", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    text_column: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingesta um arquivo CSV/JSON, valida as linhas de texto e cria os registros de documentos.
    """
    contents = await file.read()
    filename = file.filename or "dataset.csv"
    dataset_name = name or filename.rsplit(".", 1)[0]

    try:
        if filename.endswith(".json"):
            data = json.loads(contents.decode("utf-8"))
            df = pd.DataFrame(data)
        else:
            try:
                df = pd.read_csv(io.BytesIO(contents))
            except Exception:
                df = pd.read_csv(io.BytesIO(contents), sep=";")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao carregar arquivo de dados: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="O arquivo enviado está vazio")

    selected_col = text_column if (text_column and text_column in df.columns) else detect_text_column(df)
    df = df.dropna(subset=[selected_col])
    if df.empty:
        raise HTTPException(status_code=400, detail=f"Nenhum texto válido encontrado na coluna '{selected_col}'")

    # Cria o registro do Dataset
    dataset_id = str(uuid.uuid4())
    dataset = Dataset(
        id=dataset_id,
        name=dataset_name,
        description=description or f"Carregado via {filename} com foco na coluna '{selected_col}'",
        document_count=len(df),
        status="UPLOADED",
        progress_message="Arquivo pronto para análise de tópicos",
        progress_percent=0
    )
    db.add(dataset)

    # Cria os documentos
    documents = []
    other_cols = [c for c in df.columns if c != selected_col]

    for _, row in df.iterrows():
        raw_text = str(row[selected_col]).strip()
        if not raw_text:
            continue
        cleaned = EmbeddingService.clean_text(raw_text)
        metadata = {str(c): (None if pd.isna(row[c]) else row[c]) for c in other_cols}
        
        doc = Document(
            id=str(uuid.uuid4()),
            dataset_id=dataset_id,
            original_text=raw_text,
            clean_text=cleaned,
            cluster_label=-1,
            is_exemplar=False,
            metadata_json=metadata
        )
        documents.append(doc)

    db.add_all(documents)
    dataset.document_count = len(documents)
    await db.commit()
    await db.refresh(dataset)

    return dataset

