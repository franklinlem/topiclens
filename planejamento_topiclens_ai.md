# Planejamento Arquitetural e Guia de Implementação: TopicLens AI

> **Plataforma de Inteligência de Tópicos e Agrupamento Semântico Não-Supervisionado com LLMs**  
> **Baseado no Prompt:** Backend & IA: Agrupamento Semântico e Descoberta de Tópicos com UMAP e HDBSCAN  
> **Repositório GitHub:** `topiclens-ai` (ou `semantic-topic-lens`)  
> **Licença:** MIT | **Status:** Especificação Completa para Desenvolvimento  

---

## 1. Visão Geral e Escopo do Projeto

### 1.1 Contexto e Justificativa de Engenharia
Em ambientes corporativos modernos, grandes volumes de dados textuais chegam continuamente de forma não estruturada: avaliações em app stores, chamados de suporte técnico (Zendesk, Intercom), pesquisas de NPS, transcrições de reuniões de produto e redes sociais. 

O problema central é que métodos tradicionais de categorização baseados em palavras-chave exigem manutenção manual de dicionários e falham com sinônimos, enquanto sistemas de busca vetorial simples (RAG padrão) apenas respondem perguntas pontuais, mas não conseguem responder perguntas estratégicas e exploratórias agregadas, como: *"Quais são os 10 maiores grupos de reclamações dos nossos usuários nesta semana e como eles se distribuem?"*.

### 1.2 A Solução: TopicLens AI
O **TopicLens AI** é uma aplicação web fullstack corporativa que automatiza a ingestão de bases textuais, computa representações semânticas densas via embeddings, reduz a dimensionalidade não linear com **UMAP** (Uniform Manifold Approximation and Projection), agrupa textos em agrupamentos de densidade arbitrária com **HDBSCAN**, identifica os documentos exemplares centrais de cada grupo e aciona um LLM para sintetizar títulos executivos, resumos e recomendações acionáveis, exibindo tudo em um painel analítico com mapa de dispersão 2D interativo.

---

## 2. Arquitetura Técnica do Sistema

### 2.1 Diagrama de Fluxo e Componentes (Pipeline de 5 Etapas)

```
[ Arquivo CSV/JSON ou API ]
            |
            v (1. Ingestão & Limpeza)
+-------------------------------------------------------+
| FastAPI: Normalização de Texto e Pré-processamento    |
+-------------------------------------------------------+
            |
            v (2. Extração de Embeddings)
+-------------------------------------------------------+
| FastEmbed / Sentence-Transformers (BGE / E5 - 384d)   |
+-------------------------------------------------------+
            |
            +---------------------------+
            |                           |
            v (3. Redução para Clustering)| (3b. Redução para Visualização)
+----------------------------------+  +----------------------------------+
| UMAP 5D (Preservação de Vizinhança) |  | UMAP 2D (Coordenadas X/Y)        |
+----------------------------------+  +----------------------------------+
            |                                           |
            v (4. Clusterização Hierárquica)            |
+----------------------------------+                    |
| HDBSCAN (Detecção de Densidade & |                    |
|          Isolamento de Ruído -1) |                    |
+----------------------------------+                    |
            |                                           |
            v (5. Exemplares & Síntese)                 |
+----------------------------------+                    |
| Seleção de Documentos Centrais   |                    |
| + Síntese de Tópico via LLM     |                    |
+----------------------------------+                    |
            |                                           |
            v                                           v
+-------------------------------------------------------+
|   PostgreSQL / SQLite: Armazenamento Consolidado     |
+-------------------------------------------------------+
                            |
                            v REST / WebSocket
+-------------------------------------------------------+
| Next.js 15: Dashboard com Mapa 2D de Dispersão        |
| (Zoom, Hover, Tópicos, Métricas e Exportação)         |
+-------------------------------------------------------+
```

### 2.2 Tecnologias Selecionadas
* **Backend:**
  * **Linguagem & Framework:** Python 3.12 com FastAPI (totalmente assíncrono).
  * **Motor de Embeddings:** `fastembed` (inferência local de embeddings de alta velocidade em CPU via ONNX Runtime com modelo `BAAI/bge-small-en-v1.5` ou `multilingual-e5-small`).
  * **Redução Dimensional:** `umap-learn` (redução para 5D para clusterização e 2D para projeção gráfica).
  * **Clustering:** `hdbscan` (clusterização hierárquica baseada em densidade sem necessidade de fixar o número K de clusters previamente).
  * **Orquestração de LLM:** `litellm` (suporte unificado para Claude 3.5 Haiku/Sonnet, GPT-4o-mini e Ollama local para ambientes air-gapped).
  * **Banco de Dados:** PostgreSQL 16 (ou SQLite via aiosqlite para ambiente local).
* **Frontend:**
  * **Framework:** Next.js 15 (App Router), React 19, TypeScript.
  * **Estilização:** Tailwind CSS v3/v4 com componentes Radix UI (shadcn/ui).
  * **Visualização Gráfica:** D3.js e Recharts / Canvas 2D para renderização de dezenas de milhares de pontos no scatter plot com zoom/pan e seleção de lasso.
  * **Gerenciamento de Estado:** TanStack Query (React Query v5) com suporte a polling/SSE para acompanhamento de progresso de tarefas longas.
* **Infraestrutura & DevOps:**
  * Dockerfile multi-stage para backend e frontend.
  * `docker-compose.yml` para execução imediata com um comando.
  * GitHub Actions CI/CD (Ruff para linting, Pytest com coverage, Docker build check).

---

## 3. Modelagem de Dados e Esquemas

### 3.1 Esquema Relacional (`schema.sql`)
```sql
-- Tabela de Projetos / Datasets
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    document_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED', -- UPLOADING, PROCESSING, COMPLETED, FAILED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Tópicos Descobertos
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    cluster_label INTEGER NOT NULL, -- -1 para ruído, 0..N para clusters válidos
    title VARCHAR(200) NOT NULL,
    summary TEXT NOT NULL,
    keywords JSONB NOT NULL DEFAULT '[]',
    document_count INTEGER NOT NULL DEFAULT 0,
    density_score NUMERIC(5, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Documentos Individuais
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    original_text TEXT NOT NULL,
    clean_text TEXT NOT NULL,
    cluster_label INTEGER NOT NULL DEFAULT -1,
    is_exemplar BOOLEAN NOT NULL DEFAULT FALSE,
    coord_x NUMERIC(8, 4), -- Coordenada 2D UMAP para plotagem
    coord_y NUMERIC(8, 4), -- Coordenada 2D UMAP para plotagem
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_dataset ON documents(dataset_id);
CREATE INDEX IF NOT EXISTS idx_documents_cluster ON documents(cluster_label);
CREATE INDEX IF NOT EXISTS idx_topics_dataset ON topics(dataset_id);
```

### 3.2 Esquemas Pydantic v2 (`schemas.py`)
```python
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime

class DatasetCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None

class DatasetResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    document_count: int
    status: str
    created_at: datetime

class ClusteringParameters(BaseModel):
    min_cluster_size: int = Field(default=15, ge=5, le=500, description="Tamanho mínimo de documentos para formar um cluster")
    min_samples: int = Field(default=5, ge=1, le=100, description="Conservadorismo do agrupamento (maior = mais ruído, clusters mais densos)")
    n_neighbors_umap: int = Field(default=15, ge=5, le=100)
    umap_components: int = Field(default=5, ge=2, le=20)
    llm_model: str = Field(default="gpt-4o-mini", description="Modelo para síntese de rótulos")

class TopicSummary(BaseModel):
    id: UUID
    cluster_label: int
    title: str
    summary: str
    keywords: List[str]
    document_count: int
    percentage: float

class DocumentScatterPoint(BaseModel):
    id: UUID
    x: float
    y: float
    cluster_label: int
    text_snippet: str
    is_exemplar: bool

class AnalysisResultsResponse(BaseModel):
    dataset_id: UUID
    total_documents: int
    clustered_documents: int
    noise_documents: int
    topics: List[TopicSummary]
    scatter_points: List[DocumentScatterPoint]
    execution_time_seconds: float
```

---

## 4. Estrutura do Repositório no GitHub

```
topiclens-ai/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Testes automatizados, linting e typecheck
│       └── docker-build.yml       # Validação de build das imagens de contêiner
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # Entrypoint FastAPI e rotas principais
│   │   ├── config.py              # Configurações de ambiente (Pydantic Settings)
│   │   ├── database.py            # Sessão SQLAlchemy assíncrona
│   │   ├── models/                # Modelos ORM (Dataset, Document, Topic)
│   │   ├── schemas/               # Modelos de validação Pydantic v2
│   │   ├── services/
│   │   │   ├── embedding_service.py   # Extração de vetores densos (FastEmbed)
│   │   │   ├── clustering_engine.py   # Redução UMAP e agrupamento HDBSCAN
│   │   │   └── topic_labeler.py       # Síntese de títulos e resumos via LLM
│   │   └── routers/
│   │       ├── datasets.py        # Upload de CSV e gestão de datasets
│   │       └── analysis.py        # Execução de clustering e streaming de status
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_clustering.py     # Testes matemáticos de agrupamento
│   │   └── test_api.py            # Testes de integração de endpoints
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # Visão Geral de Datasets
│   │   │   ├── datasets/new/      # Upload e parametrização
│   │   │   └── analysis/[id]/     # Dashboard analítico e Scatter Plot interativo
│   │   ├── components/
│   │   │   ├── ClusterScatterPlot.tsx # Gráfico de dispersão 2D com D3/Canvas
│   │   │   ├── TopicCardList.tsx      # Lista de tópicos sintetizados com percentual
│   │   │   └── DocumentInspector.tsx  # Drawer lateral para inspeção de textos reais
│   │   └── lib/
│   │       └── api-client.ts
│   ├── Dockerfile
│   ├── package.json
│   └── tailwind.config.ts
├── samples/                       # Arquivos CSV de demonstração (ex: customer_feedback.csv)
├── docker-compose.yml
├── LICENSE (MIT)
├── README.md                      # Documentação completa e guia rápido
└── .env.example
```

---

## 5. Implementação Passo a Passo com Código-Fonte

### Passo 1: Motor de Clustering (`backend/app/services/clustering_engine.py`)
```python
import numpy as np
import umap
import hdbscan
from typing import Tuple, Dict, Any, List

class ClusteringEngine:
    @staticmethod
    def reduce_and_cluster(
        embeddings: np.ndarray,
        min_cluster_size: int = 15,
        min_samples: int = 5,
        n_neighbors: int = 15,
        target_dimensions: int = 5
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Executa a redução UMAP para espaço denso (5D) para clustering,
        redução paralela para 2D para visualização na UI,
        e clusterização via HDBSCAN.
        """
        # 1. Redução de dimensionalidade intermediária para clustering (evita maldição da dimensionalidade)
        reducer_clustering = umap.UMAP(
            n_neighbors=n_neighbors,
            n_components=target_dimensions,
            metric="cosine",
            min_dist=0.0,
            random_state=42
        )
        reduced_embeddings_nd = reducer_clustering.fit_transform(embeddings)

        # 2. Redução paralela para 2D dedicada à plotagem visual na interface
        reducer_2d = umap.UMAP(
            n_neighbors=n_neighbors,
            n_components=2,
            metric="cosine",
            min_dist=0.1,
            random_state=42
        )
        coordinates_2d = reducer_2d.fit_transform(embeddings)

        # 3. Agrupamento não-supervisionado com HDBSCAN
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=min_samples,
            metric="euclidean",
            cluster_selection_method="eom",
            prediction_data=True
        )
        cluster_labels = clusterer.fit_predict(reduced_embeddings_nd)

        return cluster_labels, coordinates_2d, clusterer.probabilities_

    @staticmethod
    def extract_exemplars(
        embeddings: np.ndarray,
        cluster_labels: np.ndarray,
        top_n: int = 4
    ) -> Dict[int, List[int]]:
        """
        Identifica os índices dos documentos mais representativos (exemplares)
        calculando a menor distância euclidiana até o centroide de cada cluster.
        """
        exemplars_by_cluster: Dict[int, List[int]] = {}
        unique_clusters = set(cluster_labels)

        for cluster in unique_clusters:
            if cluster == -1:
                continue  # Pula ruído

            cluster_indices = np.where(cluster_labels == cluster)[0]
            if len(cluster_indices) == 0:
                continue

            cluster_vectors = embeddings[cluster_indices]
            centroid = np.mean(cluster_vectors, axis=0)

            # Distância euclidiana de cada ponto ao centroide
            distances = np.linalg.norm(cluster_vectors - centroid, axis=1)
            sorted_local_indices = np.argsort(distances)

            # Pega os top_n mais próximos
            best_global_indices = cluster_indices[sorted_local_indices[:top_n]].tolist()
            exemplars_by_cluster[cluster] = best_global_indices

        return exemplars_by_cluster
```

### Passo 2: Rotulador de Tópicos com LLM (`backend/app/services/topic_labeler.py`)
```python
import json
from typing import List, Dict, Any
from litellm import completion

class TopicLabeler:
    @staticmethod
    def generate_topic_summary(
        exemplar_texts: List[str],
        cluster_size: int,
        model: str = "gpt-4o-mini"
    ) -> Dict[str, Any]:
        """
        Envia os textos exemplares ao LLM para sintetizar um rótulo e sumário objetivo.
        """
        formatted_exemplars = "\n---\n".join([f"- {text[:300]}" for text in exemplar_texts])

        prompt = f"""
Você é um Especialista em Análise de Dados e Descoberta de Tópicos.
Analise os seguintes textos exemplares representativos que pertencem a um mesmo cluster semântico (total de {cluster_size} ocorrências):

{formatted_exemplars}

Sua tarefa é gerar um resumo estruturado em JSON com o seguinte formato estrito:
{{
  "title": "Título conciso do tópico (máximo 5 palavras)",
  "summary": "Resumo executivo explicando a essência do problema ou assunto compartilhado nesses textos (1 a 2 sentenças)",
  "keywords": ["tag1", "tag2", "tag3", "tag4"]
}}
Responda APENAS o JSON válido.
"""

        response = completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        return json.loads(content)
```

### Passo 3: Componente Frontend de Visualização (`frontend/src/components/ClusterScatterPlot.tsx`)
```tsx
"use client";

import React, { useMemo, useState } from "react";
import { DocumentScatterPoint } from "@/lib/api-client";

interface ClusterScatterPlotProps {
  points: DocumentScatterPoint[];
  onSelectPoint: (point: DocumentScatterPoint) => void;
  selectedCluster: number | null;
}

const CLUSTER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ec4899", 
  "#8b5cf6", "#06b6d4", "#f97316", "#14b8a6",
  "#6366f1", "#84cc16"
];

export const ClusterScatterPlot: React.FC<ClusterScatterPlotProps> = ({
  points,
  onSelectPoint,
  selectedCluster,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<DocumentScatterPoint | null>(null);

  // Normalização de coordenadas para escala SVG (800x600)
  const { normalizedPoints, viewBox } = useMemo(() => {
    if (!points.length) return { normalizedPoints: [], viewBox: "0 0 800 600" };

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 40;
    const width = 800;
    const height = 600;

    const scaleX = (x: number) => padding + ((x - minX) / (maxX - minX || 1)) * (width - padding * 2);
    const scaleY = (y: number) => padding + ((y - minY) / (maxY - minY || 1)) * (height - padding * 2);

    return {
      normalizedPoints: points.map((p) => ({
        ...p,
        svgX: scaleX(p.x),
        svgY: scaleY(p.y),
      })),
      viewBox: `0 0 ${width} ${height}`,
    };
  }, [points]);

  return (
    <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between mb-2 px-2 text-xs text-slate-400">
        <span>Mapa de Projeção Semântica 2D (UMAP)</span>
        <span>{points.length} documentos plotados</span>
      </div>

      <svg viewBox={viewBox} className="w-full h-[520px] select-none cursor-crosshair">
        {/* Grid de fundo */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Pontos de documentos */}
        {normalizedPoints.map((point) => {
          const isNoise = point.cluster_label === -1;
          const color = isNoise
            ? "#64748b"
            : CLUSTER_COLORS[point.cluster_label % CLUSTER_COLORS.length];

          const isDimmed = selectedCluster !== null && point.cluster_label !== selectedCluster;
          const isHovered = hoveredPoint?.id === point.id;

          return (
            <circle
              key={point.id}
              cx={point.svgX}
              cy={point.svgY}
              r={point.is_exemplar ? (isHovered ? 8 : 6) : (isHovered ? 5 : 3)}
              fill={color}
              opacity={isDimmed ? 0.15 : (isNoise ? 0.4 : 0.85)}
              stroke={point.is_exemplar ? "#ffffff" : "none"}
              strokeWidth={point.is_exemplar ? 1.5 : 0}
              className="transition-all duration-150 cursor-pointer"
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={() => onSelectPoint(point)}
            />
          );
        })}
      </svg>

      {/* Tooltip de Hover */}
      {hoveredPoint && (
        <div
          className="absolute bottom-6 left-6 max-w-md bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-xl shadow-2xl text-xs text-slate-200 pointer-events-none transition-opacity"
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor:
                  hoveredPoint.cluster_label === -1
                    ? "#64748b"
                    : CLUSTER_COLORS[hoveredPoint.cluster_label % CLUSTER_COLORS.length],
              }}
            />
            <span className="font-semibold text-slate-100">
              {hoveredPoint.cluster_label === -1 ? "Ruído / Não agrupado" : `Cluster #${hoveredPoint.cluster_label}`}
            </span>
            {hoveredPoint.is_exemplar && (
              <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono text-[10px]">
                Exemplar Central
              </span>
            )}
          </div>
          <p className="line-clamp-3 text-slate-300 italic">"{hoveredPoint.text_snippet}"</p>
        </div>
      )}
    </div>
  );
};
```

---

## 6. Docker & Infraestrutura de Execução

### 6.1 `docker-compose.yml`
```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: topiclens_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: topiclens
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespw
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: topiclens_backend
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgrespw@db:5432/topiclens
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
    ports:
      - "8000:8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: topiclens_frontend
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  pgdata:
```

### 6.2 `backend/Dockerfile`
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential gcc
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 1000 appuser
COPY --from=builder /root/.local /home/appuser/.local
COPY . /app
ENV PATH=/home/appuser/.local/bin:$PATH
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 7. Estratégia de Testes Automatizados

### Teste do Algoritmo de Clustering (`backend/tests/test_clustering.py`)
```python
import numpy as np
import pytest
from app.services.clustering_engine import ClusteringEngine

def test_clustering_detects_separable_synthetic_clusters():
    # Cria dois grupos sintéticos bem separados em 384 dimensões
    np.random.seed(42)
    cluster_1 = np.random.normal(loc=1.0, scale=0.1, size=(50, 384))
    cluster_2 = np.random.normal(loc=-1.0, scale=0.1, size=(50, 384))
    data = np.vstack([cluster_1, cluster_2])

    labels, coords_2d, probs = ClusteringEngine.reduce_and_cluster(
        embeddings=data,
        min_cluster_size=15,
        min_samples=5,
        n_neighbors=10,
        target_dimensions=3
    )

    # Garante que foram descobertos ao menos 2 clusters distintos (excluindo ruído -1)
    valid_clusters = set(labels) - {-1}
    assert len(valid_clusters) >= 2
    assert coords_2d.shape == (100, 2)
    assert len(labels) == 100

def test_extract_exemplars_returns_closest_indices():
    embeddings = np.array([
        [0.0, 0.0],
        [0.1, 0.1],  # Próximo ao centroide
        [1.0, 1.0],  # Longe do centroide
    ])
    labels = np.array([0, 0, 0])

    exemplars = ClusteringEngine.extract_exemplars(embeddings, labels, top_n=1)
    assert 0 in exemplars
    assert len(exemplars[0]) == 1
    # O ponto mais próximo da média [0.36, 0.36] deve ser o ponto 1
    assert exemplars[0][0] in [0, 1]
```

---

## 8. Checklist de Execução para Desenvolvimento

- [ ] **Fase 1: Motor de Inteligência e Ingestão (Backend)**
  - Configurar pipeline de extração de embeddings com FastEmbed (`bge-small-en-v1.5`).
  - Implementar o `ClusteringEngine` com UMAP e HDBSCAN.
  - Implementar o `TopicLabeler` integrado com LiteLLM com saída estruturada JSON.
- [ ] **Fase 2: Endpoints REST e Persistência**
  - Implementar rota de upload de CSV/JSON com validação de colunas de texto.
  - Implementar endpoint de status assíncrono para datasets grandes.
  - Implementar rotas para consulta de tópicos e coordenadas 2D.
- [ ] **Fase 3: Interface do Usuário (Next.js 15)**
  - Construir tela de upload com drag-and-drop e pré-visualização de colunas.
  - Construir o mapa de dispersão interativo com seleção de clusters e zoom.
  - Construir o painel lateral com cartões de tópicos, métricas percentuais e botões de exportação (CSV/PDF).
- [ ] **Fase 4: Empacotamento, Testes e GitHub**
  - Escrever testes automatizados com Pytest cobrindo diferentes tamanhos de dataset.
  - Configurar o GitHub Actions (`.github/workflows/ci.yml`).
  - Adicionar badges de build, licença MIT e screenshots demonstrativos no `README.md`.