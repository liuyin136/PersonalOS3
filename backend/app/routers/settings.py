"""Settings router — model selection for chat / embedding / reranker."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import SettingsRow
from ..schemas import ModelSettings, ModelCatalog, ModelOption

router = APIRouter(prefix="/settings", tags=["settings"])


CATALOG = ModelCatalog(
    chat_models=[
        ModelOption(value="qwen2.5-7b-instruct", label="Qwen2.5 7B Instruct", description="Balanced local chat model"),
        ModelOption(value="qwen2.5-14b-instruct", label="Qwen2.5 14B Instruct", description="Higher quality, more memory"),
        ModelOption(value="deepseek-r1-distill-qwen-7b", label="DeepSeek R1 Distill 7B", description="Reasoning-focused"),
        ModelOption(value="llama-3.1-8b-instruct", label="Llama 3.1 8B Instruct", description="Meta general purpose"),
        ModelOption(value="mistral-7b-instruct-v0.3", label="Mistral 7B Instruct v0.3", description="Compact and fast"),
        ModelOption(value="gemma-2-9b-it", label="Gemma 2 9B IT", description="Google lightweight"),
    ],
    embedding_models=[
        ModelOption(value="bge-small-en-v1.5", label="BGE Small EN v1.5", description="384-dim, fast, English"),
        ModelOption(value="bge-base-en-v1.5", label="BGE Base EN v1.5", description="768-dim, balanced"),
        ModelOption(value="bge-large-en-v1.5", label="BGE Large EN v1.5", description="1024-dim, high quality"),
        ModelOption(value="bge-m3", label="BGE M3", description="Multi-lingual, 1024-dim"),
        ModelOption(value="e5-small-v2", label="E5 Small v2", description="384-dim alternative"),
        ModelOption(value="gte-small", label="GTE Small", description="384-dim, lightweight"),
    ],
    reranker_models=[
        ModelOption(value="bge-reranker-base", label="BGE Reranker Base", description="Cross-encoder, balanced"),
        ModelOption(value="bge-reranker-large", label="BGE Reranker Large", description="Higher accuracy"),
        ModelOption(value="bge-reranker-v2-m3", label="BGE Reranker v2 M3", description="Multi-lingual"),
        ModelOption(value="ms-marco-MiniLM-L-6-v2", label="MS MARCO MiniLM L6", description="Compact reranker"),
    ],
)


@router.get("/catalog", response_model=ModelCatalog)
async def get_catalog():
    return CATALOG


@router.get("", response_model=ModelSettings)
async def get_settings(db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(SettingsRow).where(SettingsRow.id == 1))).scalar_one_or_none()
    if not row:
        row = SettingsRow(id=1)
        db.add(row)
        await db.flush()
    return ModelSettings(
        chat_model=row.chat_model,
        embedding_model=row.embedding_model,
        reranker_model=row.reranker_model,
        chat_temperature=row.chat_temperature,
        chat_max_tokens=row.chat_max_tokens,
        context_limit=row.context_limit,
    )


@router.put("", response_model=ModelSettings)
async def update_settings(payload: ModelSettings, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(SettingsRow).where(SettingsRow.id == 1))).scalar_one_or_none()
    if not row:
        row = SettingsRow(id=1)
        db.add(row)
    row.chat_model = payload.chat_model
    row.embedding_model = payload.embedding_model
    row.reranker_model = payload.reranker_model
    row.chat_temperature = payload.chat_temperature
    row.chat_max_tokens = payload.chat_max_tokens
    row.context_limit = payload.context_limit
    await db.flush()
    return ModelSettings(
        chat_model=row.chat_model,
        embedding_model=row.embedding_model,
        reranker_model=row.reranker_model,
        chat_temperature=row.chat_temperature,
        chat_max_tokens=row.chat_max_tokens,
        context_limit=row.context_limit,
    )
