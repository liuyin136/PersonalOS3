-- ============================================================
-- Personal Knowledge OS — PostgreSQL + pgvector schema
-- Target image: pgvector/pgvector:pg16
-- ============================================================
-- Run order: executed automatically by the postgres image via
-- /docker-entrypoint-initdb.d on first container init.
-- ============================================================

-- 0. Extensions ------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram fuzzy text
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Namespaces ------------------------------------------------
-- A namespace is a logical collection of documents (e.g. engineering, hr).
-- Maps 1:1 to a pgvector search scope.
CREATE TABLE IF NOT EXISTS namespaces (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    embedding_model TEXT NOT NULL DEFAULT 'bge-small-en-v1.5',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Documents (parent Markdown) -------------------------------
-- One row per ingested source file. The original Markdown body is
-- stored on disk under /data/markdown and referenced by markdown_path.
-- `parent_id` is self-referential for versioned/derived documents;
-- for the primary hybrid-search rerank we group chunks by document_id.
CREATE TABLE IF NOT EXISTS documents (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace_id  UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    source_type   TEXT NOT NULL DEFAULT 'markdown',
                        -- markdown | pdf | txt | html | docx | url | confluence
    source_uri    TEXT NOT NULL,
    markdown_path TEXT,                 -- /data/markdown/<id>.md
    status        TEXT NOT NULL DEFAULT 'pending',
                        -- pending | chunking | embedding | indexing | synced | failed
    progress      INT  NOT NULL DEFAULT 0,
    chunk_count   INT  NOT NULL DEFAULT 0,
    token_count   INT  NOT NULL DEFAULT 0,
    tags          TEXT[] NOT NULL DEFAULT '{}',
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    parent_id     UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_namespace ON documents(namespace_id);
CREATE INDEX IF NOT EXISTS idx_documents_status    ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_tags      ON documents USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_documents_parent    ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated   ON documents(updated_at DESC);

-- 3. Document chunks -------------------------------------------
-- Each chunk is embedded into a 1536-dim vector (configurable).
-- `search_vector` is a tsvector rebuilt from chunk content for BM25
-- full-text search via GIN index.
--
-- NOTE on embedding dimension: change `vector(1536)` everywhere if
-- your embedding model outputs a different dim (e.g. bge-small = 384,
-- text-embedding-3-large = 3072). The app reads EMBEDDING_DIM from env.
CREATE TABLE IF NOT EXISTS document_chunks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    namespace_id  UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
    chunk_index   INT  NOT NULL,
    content       TEXT NOT NULL,
    token_count   INT  NOT NULL DEFAULT 0,
    embedding     vector(1536),
    search_vector tsvector,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(document_id, chunk_index)
);

-- HNSW vector index (cosine similarity).
-- Tuning notes:
--   m              = 16  — max connections per node (16–48; higher = more recall, more memory)
--   ef_construction= 128 — build-time search width (64–256; higher = better recall, slower build)
-- For >1M chunks raise m to 32 and ef_construction to 256.
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- GIN full-text index for BM25-style keyword search.
CREATE INDEX IF NOT EXISTS idx_chunks_search_vector
    ON document_chunks
    USING gin (search_vector);

-- Supporting indexes for filtering / joins.
CREATE INDEX IF NOT EXISTS idx_chunks_document  ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_namespace ON document_chunks(namespace_id);

-- Trigger to keep search_vector in sync with content on INSERT/UPDATE.
CREATE OR REPLACE FUNCTION chunks_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', coalesce(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chunks_search_vector ON document_chunks;
CREATE TRIGGER trg_chunks_search_vector
    BEFORE INSERT OR UPDATE OF content ON document_chunks
    FOR EACH ROW EXECUTE FUNCTION chunks_search_vector_update();

-- 4. Settings (model selection + runtime config) ---------------
-- Single-row table (id = 1) holding the active model selections.
CREATE TABLE IF NOT EXISTS settings (
    id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    chat_model      TEXT NOT NULL DEFAULT 'qwen2.5-7b-instruct',
    embedding_model TEXT NOT NULL DEFAULT 'bge-small-en-v1.5',
    reranker_model  TEXT NOT NULL DEFAULT 'bge-reranker-base',
    chat_temperature   REAL NOT NULL DEFAULT 0.3,
    chat_max_tokens    INT  NOT NULL DEFAULT 2048,
    context_limit      INT  NOT NULL DEFAULT 128000,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING;

-- 5. Ingestion jobs (Arq task audit trail) --------------------
CREATE TABLE IF NOT EXISTS ingest_jobs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    task_kind   TEXT NOT NULL,          -- chunk | embed | index | full
    status      TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | failed
    progress    INT  NOT NULL DEFAULT 0,
    message     TEXT,
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_document ON ingest_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_status   ON ingest_jobs(status);

-- 6. updated_at triggers ---------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_updated ON documents;
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_chunks_updated ON document_chunks;
CREATE TRIGGER trg_chunks_updated BEFORE UPDATE ON document_chunks
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_namespaces_updated ON namespaces;
CREATE TRIGGER trg_namespaces_updated BEFORE UPDATE ON namespaces
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated ON settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 7. Helpful comment block -------------------------------------
COMMENT ON TABLE documents IS 'Parent Markdown documents; original body stored on disk under /data/markdown';
COMMENT ON TABLE document_chunks IS 'Embedded chunks; HNSW(vector_cosine_ops) + GIN(tsvector) for hybrid search';
COMMENT ON COLUMN document_chunks.embedding IS 'vector(1536) — adjust dim if embedding model changes';
COMMENT ON INDEX idx_chunks_embedding_hnsw IS 'HNSW m=16 ef_construction=128 — raise for >1M chunks';
