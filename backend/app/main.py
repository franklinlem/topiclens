import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import datasets_router, analysis_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("topiclens")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando TopicLens AI Backend...")
    await init_db()
    logger.info("Banco de dados inicializado com sucesso.")
    yield
    logger.info("Encerrando TopicLens AI Backend...")

app = FastAPI(
    title=settings.APP_NAME,
    description="Motor de Inteligência de Tópicos e Agrupamento Semântico Não-Supervisionado (UMAP + HDBSCAN + LLMs)",
    version="0.1.0",
    lifespan=lifespan
)

# Configuração de CORS para permitir requisições do frontend Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusão dos roteadores
app.include_router(datasets_router)
app.include_router(analysis_router)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "database": settings.DATABASE_URL.split("://")[0]
    }

@app.get("/", tags=["Root"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "0.1.0",
        "docs_url": "/docs",
        "health_url": "/health"
    }

