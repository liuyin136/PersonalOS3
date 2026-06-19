"""Hybrid search with parent-document reranking.

Pipeline (matches the specified industrial logic):
  1. Vector search on chunks (HNSW cosine) -> top-K chunks
  2. Optional BM25 keyword search on the same chunk set via GIN tsvector
  3. Combine chunk-level scores: hybrid = alpha * vector + (1-alpha) * keyword
  4. Group top chunks by parent document_id
  5. Aggregate a weighted parent score (sum of top-N chunk hybrid scores,
     decayed by rank so the #1 chunk weighs most)
  6. Optional cross-encoder rerank of parent documents using their
     concatenated top-chunk text
  7. Return parent-level results, each carrying its top contributing chunks

Embeddings are inserted with `CAST(:embedding AS vector)` to satisfy
pgvector's parameter binding rules (asyncpg cannot bind vector type
directly).
"""
from __future__ import annotations

import time
import uuid
from typing import List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..schemas import (
    ChunkHit,
    ParentResult,
    SearchQuery,
    SearchResponse,
)
from . import embedding as embed_service


# ------------------------------------------------------------------
# Low-level chunk-level search
# ------------------------------------------------------------------
async def _vector_search_chunks(
    db: AsyncSession,
    query_vec: List[float],
    q: SearchQuery,
) -> List[dict]:
    """HNSW cosine vector search on chunks. Returns raw rows."""
    # Build parameterised SQL. The embedding is passed as a string and
    # CAST to vector on the DB side (asyncpg cannot bind vector type).
    vec_literal = "[" + ",".join(f"{x:.7f}" for x in query_vec) + "]"

    filters_sql = ["dc.namespace_id = (SELECT id FROM namespaces WHERE name = :ns)"]
    params = {"ns": q.namespace, "vec": vec_literal, "limit": q.top_k, "ef": settings.HNSW_EF_SEARCH}

    if q.filters and q.filters.tags:
        filters_sql.append("d.tags && :tags")
        params["tags"] = q.filters.tags
    if q.filters and q.filters.source_types:
        filters_sql.append("d.source_type = ANY(:stypes)")
        params["stypes"] = q.filters.source_types

    where = " AND ".join(filters_sql)

    sql = f"""
        SET LOCAL hnsw.ef_search = :ef;
        SELECT
            dc.id::text                       AS chunk_id,
            dc.document_id::text              AS document_id,
            d.title                           AS document_title,
            d.source_type                     AS source_type,
            n.name                            AS namespace,
            d.tags                            AS tags,
            dc.chunk_index                    AS chunk_index,
            dc.content                        AS content,
            dc.token_count                    AS token_count,
            1 - (dc.embedding <=> CAST(:vec AS vector)) AS vector_score
        FROM document_chunks dc
        JOIN documents d  ON d.id = dc.document_id
        JOIN namespaces n ON n.id = dc.namespace_id
        WHERE {where}
        ORDER BY dc.embedding <=> CAST(:vec AS vector)
        LIMIT :limit;
    """
    result = await db.execute(text(sql), params)
    return [dict(r._mapping) for r in result.fetchall()]


async def _keyword_search_chunks(
    db: AsyncSession,
    query_text: str,
    q: SearchQuery,
    candidate_ids: List[str],
) -> dict[str, float]:
    """BM25-ish ts_rank keyword scoring on the candidate chunk set."""
    if not candidate_ids:
        return {}
    sql = """
        SELECT id::text AS chunk_id,
               ts_rank(search_vector, plainto_tsquery('english', :q)) AS kw_score
        FROM document_chunks
        WHERE id = ANY(:ids)
          AND search_vector @@ plainto_tsquery('english', :q);
    """
    result = await db.execute(
        text(sql), {"q": query_text, "ids": [uuid.UUID(c) for c in candidate_ids]}
    )
    return {r.chunk_id: float(r.kw_score) for r in result.fetchall()}


# ------------------------------------------------------------------
# Parent-document aggregation + rerank
# ------------------------------------------------------------------
def _aggregate_parent_scores(chunks: List[dict], alpha: float) -> List[ParentResult]:
    """Group chunks by parent document and compute weighted parent score."""
    by_parent: dict[str, List[dict]] = {}
    for ch in chunks:
        by_parent.setdefault(ch["document_id"], []).append(ch)

    parents: List[ParentResult] = []
    for doc_id, doc_chunks in by_parent.items():
        # sort this parent's chunks by hybrid desc
        doc_chunks.sort(key=lambda c: c.get("hybrid_score", c["vector_score"]), reverse=True)
        first = doc_chunks[0]
        # weighted sum: rank-decay so the strongest chunk dominates
        weighted = 0.0
        decay = 1.0
        for ch in doc_chunks[:3]:
            weighted += ch.get("hybrid_score", ch["vector_score"]) * decay
            decay *= 0.6
        # normalise by count of contributing chunks (capped at 3)
        parent_score = weighted / min(len(doc_chunks), 3)

        top_chunks = [
            ChunkHit(
                id=ch["chunk_id"],
                chunk_index=ch["chunk_index"],
                content=ch["content"],
                markdown=ch["content"],
                token_count=ch["token_count"],
                vector_score=round(float(ch["vector_score"]), 4),
                keyword_score=round(float(ch.get("keyword_score", 0.0)), 4),
                hybrid_score=round(float(ch.get("hybrid_score", ch["vector_score"])), 4),
            )
            for ch in doc_chunks[:3]
        ]
        parents.append(
            ParentResult(
                document_id=doc_id,
                document_title=first["document_title"],
                source_type=first["source_type"],
                namespace=first["namespace"],
                tags=first["tags"] or [],
                parent_score=round(parent_score, 4),
                contributing_chunks=len(doc_chunks),
                top_chunks=top_chunks,
            )
        )
    parents.sort(key=lambda p: p.parent_score, reverse=True)
    return parents


async def _cross_encoder_rerank(
    query: str, parents: List[ParentResult], model_name: str | None = None
) -> List[ParentResult]:
    """Rerank parent documents with a cross-encoder over their top-chunk text."""
    if not parents:
        return parents
    docs = ["\n\n".join(c.content for c in p.top_chunks) for p in parents]
    scores = await embed_service.rerank(query, docs, model_name)
    for p, s in zip(parents, scores):
        # blend: 70% reranker, 30% original parent_score
        p.parent_score = round(0.7 * s + 0.3 * p.parent_score, 4)
    parents.sort(key=lambda p: p.parent_score, reverse=True)
    return parents


# ------------------------------------------------------------------
# Public entry point
# ------------------------------------------------------------------
async def hybrid_search(db: AsyncSession, q: SearchQuery) -> SearchResponse:
    t0 = time.perf_counter()

    # 1. embed the query
    query_vec = await embed_service.embed_query(q.query)

    # 2. vector search on chunks
    chunks = await _vector_search_chunks(db, query_vec, q)

    # 3. keyword search (only for hybrid/keyword modes)
    if q.mode in ("hybrid", "keyword") and chunks:
        kw_map = await _keyword_search_chunks(
            db, q.query, q, [c["chunk_id"] for c in chunks]
        )
        # normalise keyword scores to 0..1
        max_kw = max(kw_map.values()) if kw_map else 1.0
        if max_kw == 0:
            max_kw = 1.0
        for c in chunks:
            c["keyword_score"] = kw_map.get(c["chunk_id"], 0.0) / max_kw
    else:
        for c in chunks:
            c["keyword_score"] = 0.0

    # 4. combine chunk scores
    for c in chunks:
        if q.mode == "vector":
            c["hybrid_score"] = c["vector_score"]
        elif q.mode == "keyword":
            c["hybrid_score"] = c["keyword_score"]
        else:  # hybrid / semantic
            c["hybrid_score"] = q.alpha * c["vector_score"] + (1 - q.alpha) * c["keyword_score"]

    # 5. group + aggregate by parent
    parents = _aggregate_parent_scores(chunks, q.alpha)

    # 6. optional cross-encoder rerank of parents
    if q.rerank and parents:
        try:
            parents = await _cross_encoder_rerank(q.query, parents)
        except Exception:
            # reranker optional — fall back to aggregated scores
            pass

    # 7. cap to rerank_top
    parents = parents[: q.rerank_top]

    took_ms = int((time.perf_counter() - t0) * 1000)
    return SearchResponse(
        query=q.query,
        mode=q.mode,
        total=len(parents),
        took_ms=took_ms,
        results=parents,
    )
