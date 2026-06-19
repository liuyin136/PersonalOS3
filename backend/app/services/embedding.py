"""Embedding + reranker services backed by sentence-transformers.

Uses local HuggingFace models so the system runs without OpenAI/Claude.
The embedding model is loaded lazily and cached; the reranker is a
cross-encoder that scores (query, chunk) pairs for parent reranking.
"""
from __future__ import annotations

import asyncio
from functools import lru_cache
from typing import List

from ..config import settings


@lru_cache(maxsize=4)
def _get_embedder(model_name: str):
    """Lazily load a sentence-transformers embedder (cached by model name)."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name, device="cpu")


@lru_cache(maxsize=4)
def _get_reranker(model_name: str):
    """Lazily load a cross-encoder reranker."""
    from sentence_transformers import CrossEncoder

    return CrossEncoder(model_name, device="cpu")


def _embed_sync(texts: List[str], model_name: str | None = None) -> List[List[float]]:
    model_name = model_name or settings.EMBEDDING_HF_MODEL
    model = _get_embedder(model_name)
    vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return [v.tolist() for v in vecs]


async def embed_texts(texts: List[str], model_name: str | None = None) -> List[List[float]]:
    """Embed a batch of texts; runs the CPU-bound encode in a thread."""
    return await asyncio.to_thread(_embed_sync, texts, model_name)


async def embed_query(text: str, model_name: str | None = None) -> List[float]:
    res = await embed_texts([text], model_name)
    return res[0]


def _rerank_sync(query: str, docs: List[str], model_name: str | None = None) -> List[float]:
    model_name = model_name or settings.RERANKER_HF_MODEL
    ce = _get_reranker(model_name)
    pairs = [(query, d) for d in docs]
    scores = ce.predict(pairs, show_progress_bar=False)
    return [float(s) for s in scores]


async def rerank(query: str, docs: List[str], model_name: str | None = None) -> List[float]:
    """Cross-encoder rerank scores for (query, docs) pairs."""
    return await asyncio.to_thread(_rerank_sync, query, docs, model_name)
