"""Ingestion router — Workflow 1.

Accepts Markdown/text content (or a file upload), persists the original
Markdown to /data/markdown, enqueues an Arq job for chunking + embedding
+ vector insertion, and returns the created document.
"""
from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Document, Namespace
from ..schemas import (
    IngestRequest,
    DocumentOut,
    ChunkPreview,
    ChunkingConfig,
)
from ..services import markdown_store, chunking
from ..worker import enqueue_ingest

router = APIRouter(prefix="/ingest", tags=["ingest"])


async def _get_or_create_namespace(db: AsyncSession, name: str) -> Namespace:
    res = await db.execute(select(Namespace).where(Namespace.name == name))
    ns = res.scalar_one_or_none()
    if ns:
        return ns
    ns = Namespace(name=name, description=f"Auto-created namespace '{name}'")
    db.add(ns)
    await db.flush()
    return ns


def _doc_to_out(doc: Document, ns_name: str) -> DocumentOut:
    return DocumentOut(
        id=str(doc.id),
        title=doc.title,
        source_type=doc.source_type,
        source_uri=doc.source_uri,
        status=doc.status,
        progress=doc.progress,
        chunk_count=doc.chunk_count,
        token_count=doc.token_count,
        namespace=ns_name,
        tags=doc.tags or [],
        markdown_uri=doc.markdown_path,
        created_at=doc.created_at.isoformat() if doc.created_at else "",
        updated_at=doc.updated_at.isoformat() if doc.updated_at else "",
        error_message=doc.error_message,
    )


@router.get("/documents", response_model=List[DocumentOut])
async def list_documents(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Document, Namespace.name)
        .join(Namespace, Document.namespace_id == Namespace.id)
        .order_by(Document.updated_at.desc())
    )
    rows = res.all()
    return [_doc_to_out(d, ns) for d, ns in rows]


@router.post("", response_model=DocumentOut)
async def create_ingest(req: IngestRequest, db: AsyncSession = Depends(get_db)):
    if not req.content and not req.source_uri:
        raise HTTPException(400, "Either content or source_uri must be provided")

    ns = await _get_or_create_namespace(db, req.namespace)
    doc = Document(
        namespace_id=ns.id,
        title=req.title,
        source_type=req.source_type,
        source_uri=req.source_uri or f"inline://{req.title}",
        status="pending",
        tags=req.tags,
        metadata_={"chunking": req.chunking.model_dump()},
    )
    db.add(doc)
    await db.flush()

    content = req.content or ""
    if content:
        path = markdown_store.save_markdown(str(doc.id), content)
        doc.markdown_path = path

    await db.flush()
    doc_id = str(doc.id)

    # Enqueue the heavy ingestion job (Arq). Falls back to inline if Redis
    # is unavailable so the endpoint still works in dev.
    try:
        await enqueue_ingest(doc_id, content, req.chunking.model_dump())
    except Exception:
        # Inline fallback (dev mode without Redis) — import the task fn directly
        from ..worker import run_ingest
        await run_ingest({}, doc_id, content, req.chunking.model_dump())

    return _doc_to_out(doc, ns.name)


@router.post("/upload", response_model=DocumentOut)
async def upload_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    namespace: str = Form("default"),
    tags: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    content = (await file.read()).decode("utf-8", errors="replace")
    req = IngestRequest(
        title=title,
        source_type="markdown",
        source_uri=f"upload://{file.filename}",
        namespace=namespace,
        tags=[t.strip() for t in tags.split(",") if t.strip()],
        content=content,
    )
    return await create_ingest(req, db)


@router.post("/{document_id}/preview", response_model=List[ChunkPreview])
async def preview_chunks(
    document_id: str,
    config: ChunkingConfig,
    db: AsyncSession = Depends(get_db),
):
    """Preview chunking for an existing document (or pass raw content)."""
    res = await db.execute(select(Document).where(Document.id == uuid.UUID(document_id)))
    doc = res.scalar_one_or_none()
    if not doc or not doc.markdown_path:
        raise HTTPException(404, "Document or its markdown not found")
    content = markdown_store.read_markdown(document_id) or ""
    chunks = chunking.chunk_text(content, config)
    return [
        ChunkPreview(
            id=f"{document_id}-{c.index}",
            index=c.index,
            content=c.content,
            token_count=c.token_count,
            overlap=c.overlap,
        )
        for c in chunks
    ]


@router.post("/{document_id}/commit", response_model=DocumentOut)
async def commit_ingest(document_id: str, db: AsyncSession = Depends(get_db)):
    """Re-run the full ingest pipeline (chunk + embed + index)."""
    res = await db.execute(
        select(Document, Namespace.name)
        .join(Namespace, Document.namespace_id == Namespace.id)
        .where(Document.id == uuid.UUID(document_id))
    )
    row = res.first()
    if not row:
        raise HTTPException(404, "Document not found")
    doc, ns_name = row
    content = markdown_store.read_markdown(document_id) or ""
    config = (doc.metadata_ or {}).get("chunking", {})
    try:
        await enqueue_ingest(document_id, content, config)
    except Exception:
        from ..worker import run_ingest
        await run_ingest({}, document_id, content, config)
    return _doc_to_out(doc, ns_name)


@router.delete("/{document_id}")
async def delete_document(document_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Document).where(Document.id == uuid.UUID(document_id)))
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    markdown_store.delete_markdown(document_id)
    await db.delete(doc)
    return {"success": True}
