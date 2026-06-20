"""Arq worker — heavy ingestion tasks (chunking + embedding + vector insert).

Runs as `arq worker.WorkerSettings`. Uses the same DB engine as the API.
"""
from __future__ import annotations

import uuid
from typing import Any

from arq import create_pool
from arq.connections import RedisSettings
from sqlalchemy import text, select

from .config import settings
from .db import SessionLocal
from .models import Document, Chunk, IngestJob, Namespace
from .services import chunking, embedding, markdown_store
from .schemas import ChunkingConfig


async def run_ingest(ctx: dict, document_id: str, content: str, config: dict) -> str:
    """Full ingest pipeline: chunk -> embed -> insert vectors (CAST)."""
    async with SessionLocal() as db:
        # 1. load document
        doc = (
            await db.execute(select(Document).where(Document.id == uuid.UUID(document_id)))
        ).scalar_one_or_none()
        if not doc:
            return f"doc {document_id} not found"

        ns = (
            await db.execute(select(Namespace).where(Namespace.id == doc.namespace_id))
        ).scalar_one()

        job = IngestJob(document_id=doc.id, task_kind="full", status="running")
        db.add(job)
        await db.flush()

        try:
            # 2. update status -> chunking
            doc.status = "chunking"
            doc.progress = 10
            await db.flush()

            if not content and doc.markdown_path:
                content = markdown_store.read_markdown(document_id) or ""

            cfg = ChunkingConfig(**(config or {"strategy": "recursive", "chunk_size": 512, "chunk_overlap": 50}))
            chunks = chunking.chunk_text(content, cfg)

            # 3. delete old chunks for this doc (re-ingest safe)
            old = (await db.execute(select(Chunk).where(Chunk.document_id == doc.id))).scalars().all()
            for c in old:
                await db.delete(c)
            await db.flush()

            doc.status = "embedding"
            doc.progress = 40
            await db.flush()

            # 4. embed in batches
            texts = [c.content for c in chunks]
            BATCH = 32
            vectors: list[list[float]] = []
            model_name = ns.embedding_model or settings.EMBEDDING_HF_MODEL
            for i in range(0, len(texts), BATCH):
                batch = texts[i : i + BATCH]
                vectors.extend(await embedding.embed_texts(batch, model_name))

            doc.status = "indexing"
            doc.progress = 75
            await db.flush()

            # 5. insert chunks with embeddings (CAST(:vec AS vector))
            for chunk, vec in zip(chunks, vectors):
                vec_literal = "[" + ",".join(f"{x:.7f}" for x in vec) + "]"
                await db.execute(
                    text(
                        """
                        INSERT INTO document_chunks
                            (id, document_id, namespace_id, chunk_index,
                             content, token_count, embedding, metadata)
                        VALUES
                            (:id, :doc, :ns, :idx,
                             :content, :tc, CAST(:vec AS vector), '{}'::jsonb)
                        """
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "doc": str(doc.id),
                        "ns": str(ns.id),
                        "idx": chunk.index,
                        "content": chunk.content,
                        "tc": chunk.token_count,
                        "vec": vec_literal,
                    },
                )

            doc.chunk_count = len(chunks)
            doc.token_count = sum(c.token_count for c in chunks)
            doc.status = "synced"
            doc.progress = 100
            job.status = "done"
            job.progress = 100
            job.finished_at = __import__("datetime").datetime.utcnow()
            await db.flush()

        except Exception as e:
            doc.status = "failed"
            doc.error_message = str(e)
            job.status = "failed"
            job.message = str(e)
            job.finished_at = __import__("datetime").datetime.utcnow()
            await db.flush()
            raise
        finally:
            await db.commit()

    return f"ingested {document_id}"


async def enqueue_ingest(document_id: str, content: str, config: dict) -> str:
    """Enqueue the ingest job on Redis (Arq)."""
    pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    try:
        job = await pool.enqueue_job("run_ingest", document_id, content, config)
        return job.job_id
    finally:
        await pool.close()


class WorkerSettings:
    """Arq worker settings."""
    functions = [run_ingest]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 4
    job_timeout = 600
