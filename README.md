# TopicLens AI 🔍✨

> **Plataforma de Inteligência de Tópicos e Agrupamento Semântico Não-Supervisionado com UMAP, HDBSCAN e LLMs.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js 15](https://img.shields.io/badge/Next.js-15.0-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)

---

## 📌 Visão Geral

Em ambientes corporativos, grandes volumes de dados textuais chegam continuamente de forma não estruturada: avaliações de app stores, chamados de suporte (Zendesk, Intercom), pesquisas de NPS e transcrições de reuniões.

O **TopicLens AI** automatiza a categorização desses textos sem a necessidade de taxonomia pré-fixada:
1. Ingesta arquivos CSV/JSON com detecção automática da coluna de texto.
2. Computa vetores densos (embeddings) de alta velocidade via **FastEmbed** / ONNX Runtime.
3. Executa redução de dimensionalidade com **UMAP** (5D para evitar a maldição da dimensionalidade no agrupamento e 2D para visualização na interface).
4. Agrupa textos por densidade com **HDBSCAN**, separando ruído natural (-1) de agrupamentos semânticos sólidos.
5. Identifica os **exemplares centrais** (menor distância euclidiana ao centroide) e sintetiza títulos executivos, resumos e tags com **LiteLLM** (Claude 3.5 Haiku, GPT-4o-mini, Ollama ou rotulador heurístico local).
6. Apresenta os resultados em um dashboard com **mapa de dispersão 2D interativo**, zoom/pan, filtros de cluster e inspeção individual de documentos.

---

## 🚀 Arquitetura do Pipeline

```
[ Arquivo CSV/JSON ou API ]
            │
            ▼ (1. Ingestão & Limpeza)
┌────────────────────────────────────────────────────────┐
│ FastAPI: Normalização de Texto e Pré-processamento     │
└────────────────────────────────────────────────────────┘
            │
            ▼ (2. Extração de Embeddings)
┌────────────────────────────────────────────────────────┐
│ FastEmbed / ONNX Runtime (BAAI/bge-small-en-v1.5 384d) │
└────────────────────────────────────────────────────────┘
            │
            ├───────────────────────────┐
            │                           │
            ▼ (3. Redução p/ Clustering)│ (3b. Redução p/ Visualização)
┌───────────────────────────────────┐   │
│ UMAP 5D (Preservação de Vizinhos) │   │ UMAP 2D (Coordenadas X/Y)
└───────────────────────────────────┘   └───────────────────────────┘
            │                                         │
            ▼ (4. Agrupamento Hierárquico)            │
┌───────────────────────────────────┐                 │
│ HDBSCAN (Densidade Arbitrária &   │                 │
│          Isolamento de Ruído -1)  │                 │
└───────────────────────────────────┘                 │
            │                                         │
            ▼ (5. Exemplares & Síntese)               │
┌───────────────────────────────────┐                 │
│ Seleção de Documentos Centrais    │                 │
│ + Síntese via LLM (LiteLLM)       │                 │
└───────────────────────────────────┘                 │
            │                                         │
            ▼                                         ▼
┌────────────────────────────────────────────────────────┐
│      SQLite / PostgreSQL: Armazenamento Consolidado    │
└────────────────────────────────────────────────────────┘
                            │
                            ▼ REST API / Polling
┌────────────────────────────────────────────────────────┐
│ Next.js 15: Dashboard com Mapa 2D de Dispersão         │
│ (Zoom, Pan, Hover, Filtros, Inspeção e Exportação)     │
└────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tecnologias Utilizadas

- **Backend:**
  - Python 3.12 & FastAPI
  - FastEmbed (`BAAI/bge-small-en-v1.5`) via ONNX Runtime
  - UMAP (`umap-learn`)
  - HDBSCAN (`hdbscan`)
  - LiteLLM (GPT-4o-mini, Claude 3.5, Ollama) com fallback heurístico
  - SQLAlchemy 2.0 (assíncrono) + SQLite (`aiosqlite`) / PostgreSQL (`asyncpg`)
  - Pytest + Pytest-Asyncio
- **Frontend:**
  - Next.js 15 (App Router, React 19)
  - TypeScript
  - Tailwind CSS
  - Lucide Icons
- **DevOps & Infra:**
  - Docker multi-stage & Docker Compose
  - GitHub Actions CI/CD

---

## ⚡ Como Executar Localmente

### Pré-requisitos
- Python 3.12+
- Node.js 20+ e npm

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/topiclens-ai.git
cd topiclens-ai
```

### 2. Configurar o Backend
```bash
# Criar e ativar ambiente virtual
cd backend
python3 -m venv .venv
source .venv/bin/activate  # No Windows: .venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Iniciar servidor FastAPI
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
O backend estará disponível em `http://localhost:8000` e a documentação interativa Swagger em `http://localhost:8000/docs`.

### 3. Configurar o Frontend
Em outro terminal:
```bash
cd frontend
npm install
npm run dev
```
Acesse a aplicação no navegador em `http://localhost:3000`.

---

## 🐳 Executando com Docker Compose

Caso prefira executar todo o ecossistema (PostgreSQL + FastAPI + Next.js) via contêineres:

```bash
docker-compose up --build
```

---

## 🧪 Executando os Testes Automatizados

O projeto possui suíte completa de testes unitários e de integração:

```bash
cd backend
./.venv/bin/pytest -v
```

Testes inclusos:
- `test_clustering_detects_separable_synthetic_clusters`: Valida a separação de grupos densos sintéticos pelo UMAP + HDBSCAN.
- `test_extract_exemplars_returns_closest_indices`: Garante a correta identificação dos documentos mais próximos ao centroide.
- `test_heuristic_topic_labeler_without_api_key`: Testa o gerador local de rótulos sem dependência de credenciais externas.
- `test_health_check` & `test_upload_and_list_datasets`: Valida o ciclo completo de ingestão e endpoints REST.

---

## 📂 Amostra Pronta para Testes

Uma base de testes com 50 avaliações de clientes está disponível em:
`samples/customer_feedback.csv`

Você também pode clicar no botão **"Carregar Amostra de Demonstração"** na tela de novo dataset para testar a plataforma instantaneamente com um clique.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

