"""Knowledge router — namespaces + stats overview."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Document, Namespace, Chunk
from ..schemas import NamespaceOut, KnowledgeStats

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("/namespaces", response_model=List[NamespaceOut])
async def list_namespaces(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(
            Namespace.id,
            Namespace.name,
            Namespace.description,
            Namespace.embedding_model,
            Namespace.created_at,
            func.count(distinct(Document.id)).label("doc_count"),
            func.count(Chunk.id).label("chunk_count"),
            func.coalesce(func.sum(Chunk.token_count), 0).label("tokens"),
        )
        .join(Document, Document.namespace_id == Namespace.id, isouter=True)
        .join(Chunk, Chunk.document_id == Document.id, isouter=True)
        .group_by(Namespace.id)
        .order_by(Namespace.name)
    )
    rows = res.all()
    return [
        NamespaceOut(
            id=str(r.id),
            name=r.name,
            description=r.description or "",
            document_count=r.doc_count or 0,
            chunk_count=r.chunk_count or 0,
            total_tokens=int(r.tokens or 0),
            embedding_model=r.embedding_model,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rows
    ]


@router.get("/stats", response_model=KnowledgeStats)
async def get_stats(db: AsyncSession = Depends(get_db)):
    doc_count = (await db.execute(select(func.count(Document.id)))).scalar() or 0
    chunk_count = (await db.execute(select(func.count(Chunk.id)))).scalar() or 0
    token_sum = (await db.execute(select(func.coalesce(func.sum(Chunk.token_count), 0)))).scalar() or 0
    ns_count = (await db.execute(select(func.count(Namespace.id)))).scalar() or 0

    # top tags
    tag_rows = (
        await db.execute(
            select(func.unnest(Document.tags).label("tag"), func.count().label("c"))
            .group_by("tag")
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()
    top_tags = [{"tag": r.tag, "count": int(r.c)} for r in tag_rows if r.tag]

    return KnowledgeStats(
        total_documents=int(doc_count),
        total_chunks=int(chunk_count),
        total_tokens=int(token_sum),
        namespaces=int(ns_count),
        top_tags=top_tags,
    )
