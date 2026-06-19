"""FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import ingest, search, chat, settings as settings_router, knowledge, health, images


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup hook — create tables if not exists (dev convenience; in prod use Alembic)
    yield


app = FastAPI(
    title="Verdant RAG API",
    description="Personal Knowledge OS — production RAG backend (pgvector + LangChain + Arq).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(settings_router.router)
app.include_router(knowledge.router)
app.include_router(health.router)
app.include_router(images.router)


@app.get("/")
async def root():
    return {"service": "verdant-rag-api", "status": "running", "docs": "/docs"}
