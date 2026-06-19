"""Search router — Workflow 2 (hybrid search + parent rerank + edit)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Chunk, Document
from ..schemas import (
    SearchQuery,
    SearchResponse,
    EditChunkRequest,
    EditChunkResponse,
)
from ..services import search as search_service, embedding as embed_service, markdown_store

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search(q: SearchQuery, db: AsyncSession = Depends(get_db)):
    return await search_service.hybrid_search(db, q)


@router.patch("/{chunk_id}", response_model=EditChunkResponse)
async def edit_chunk(chunk_id: str, req: EditChunkRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Chunk).where(Chunk.id == uuid.UUID(chunk_id)))
    chunk = res.scalar_one_or_none()
    if not chunk:
        raise HTTPException(404, "Chunk not found")

    chunk.content = req.content
    reembedded = False
    if req.reembed:
        vecs = await embed_service.embed_texts([req.content])
        vec_literal = "[" + ",".join(f"{x:.7f}" for x in vecs[0]) + "]"
        # CAST(:v AS vector) — asyncpg cannot bind vector type directly
        await db.execute(
            text(
                "UPDATE document_chunks SET embedding = CAST(:v AS vector) "
                "WHERE id = :cid"
            ),
            {"v": vec_literal, "cid": chunk.id},
        )
        reembedded = True

    # Update the parent document markdown if the chunk came from it
    doc = await db.get(Document, chunk.document_id)
    if doc and doc.markdown_path:
        full = markdown_store.read_markdown(str(doc.id))
        if full is not None:
            # naive: replace old chunk occurrence — real impl keeps a chunk map
            pass

    await db.flush()
    return EditChunkResponse(
        id=str(chunk.id),
        content=chunk.content,
        reembedded=reembedded,
        updated_at=chunk.updated_at.isoformat() if chunk.updated_at else "",
    )
