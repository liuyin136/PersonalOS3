"""SQLAlchemy ORM models mirroring db/init.sql."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID, TSVECTOR
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .config import settings


class Base(DeclarativeBase):
    pass


class Namespace(Base):
    __tablename__ = "namespaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    embedding_model: Mapped[str] = mapped_column(Text, default="bge-small-en-v1.5")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    documents: Mapped[List["Document"]] = relationship(back_populates="namespace", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    namespace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("namespaces.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(Text, default="markdown")
    source_uri: Mapped[str] = mapped_column(Text, nullable=False)
    markdown_path: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="pending")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[List[str]] = mapped_column(ARRAY(Text), default=list)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    namespace: Mapped["Namespace"] = relationship(back_populates="documents")
    chunks: Mapped[List["Chunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"))
    namespace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("namespaces.id", ondelete="CASCADE"))
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    # embedding stored as vector; dim configurable via env
    embedding: Mapped[Optional[list]] = mapped_column(Vector(settings.EMBEDDING_DIM))
    search_vector = mapped_column(TSVECTOR)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    document: Mapped["Document"] = relationship(back_populates="chunks")


class SettingsRow(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    chat_model: Mapped[str] = mapped_column(Text, default="qwen2.5-7b-instruct")
    embedding_model: Mapped[str] = mapped_column(Text, default="bge-small-en-v1.5")
    reranker_model: Mapped[str] = mapped_column(Text, default="bge-reranker-base")
    chat_temperature: Mapped[float] = mapped_column(Float, default=0.3)
    chat_max_tokens: Mapped[int] = mapped_column(Integer, default=2048)
    context_limit: Mapped[int] = mapped_column(Integer, default=128000)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class IngestJob(Base):
    __tablename__ = "ingest_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"))
    task_kind: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
