# Personal Knowledge OS — Verdant RAG

A production-grade personal knowledge management system built on RAG (Retrieval-Augmented Generation) architecture. Combines a Notion-style green-themed Next.js frontend with a FastAPI + pgvector + LangChain + Arq backend for industrial-grade knowledge ingestion, hybrid search, memory cart, and structured chat workflows.

---

## Table of Contents

1. [Quick Start (Windows Docker Desktop)](#quick-start-windows-docker-desktop)
2. [Architecture Overview](#architecture-overview)
3. [Project History](#project-history)
4. [Configuration Reference](#configuration-reference)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start (Windows Docker Desktop)

### Prerequisites

- **Windows 10/11** with **Docker Desktop** installed and WSL 2 backend enabled
- **4 GB+ RAM** allocated to Docker Desktop (8 GB recommended for the AI worker)
- Ports 3000, 8000, 5432 available on the host

### Steps

1. **Clone or download** the project to a local directory (e.g., `C:\personalos`).

2. **Open PowerShell or Command Prompt** in the project root.

3. **Build and start all services:**
   ```powershell
   docker compose up -d --build
   ```

4. **Wait for initialization** (first build takes 5–10 minutes due to Python ML dependencies and model weight downloads):
   ```powershell
   docker compose logs -f api-server
   ```
   Wait until you see `Uvicorn running on http://0.0.0.0:8000`.

5. **Open the application** in your browser:
   ```
   http://localhost:3000
   ```

6. **Seed sample data** (optional): Navigate to **Health** → click **"Seed sample data"** to populate the knowledge base with 3 sample documents.

7. **Stop the stack:**
   ```powershell
   docker compose down
   ```
   To persist data between restarts, the PostgreSQL, Redis, markdown, and image volumes are retained automatically. To wipe all data:
   ```powershell
   docker compose down -v
   ```

### Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Next.js UI (Notion-style green theme) |
| Backend API | http://localhost:8000 | FastAPI + interactive docs at `/docs` |
| PostgreSQL | localhost:5432 | pgvector database (user: `postgres`, pass: `mysecretpassword`) |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Windows Host (Browser)                  │
│                    http://localhost:3000                   │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│              Frontend Container (Next.js 16)               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Pages     │  │  Components  │  │  API Routes     │  │
│  │  (App Router)│  │  (shadcn/ui) │  │  (thin proxies) │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
│         │  Zustand stores │                   │            │
│         └────────┬────────┘                   │            │
│                  │ relative /api/*            │            │
│                  ▼                            │            │
│         ┌────────────────┐                    │            │
│         │  lib/api/      │────────────────────┘            │
│         │  (typed client)│                                 │
│         └────────────────┘                                 │
└────────────────────────┬─────────────────────────────────┘
                         │ BACKEND_URL=http://api-server:8000
                         │ (Docker internal network)
┌────────────────────────▼─────────────────────────────────┐
│              Backend Container (FastAPI)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Ingest   │ │ Search   │ │ Chat     │ │ Images       │ │
│  │ Router   │ │ Router   │ │ Router   │ │ Router       │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │            │            │               │         │
│  ┌────▼────────────▼────────────▼───────────────▼───────┐ │
│  │            Services Layer                             │ │
│  │  chunking · embedding(BGE) · hybrid search · LLM     │ │
│  └────┬─────────────────────────────────────────────────┘ │
│       │                    │                               │
│  ┌────▼────┐         ┌─────▼─────┐    ┌────────────────┐  │
│  │ asyncpg │         │  Arq tasks│    │ /data/markdown │  │
│  │ (pool)  │         │  (Redis)  │    │ /data/pic      │  │
│  └────┬────┘         └───────────┘    └────────────────┘  │
└───────┼───────────────────────────────────────────────────┘
        │
┌───────▼───────────┐    ┌──────────────┐
│ personalos-db     │    │    Redis     │
│ pgvector/pgvector │    │  7-alpine    │
│ :pg16             │    │              │
│ HNSW + GIN indexes│    │ Arq broker   │
└───────────────────┘    └──────────────┘

┌───────────────────────────────────────┐
│         AI Worker Container           │
│  arq worker.WorkerSettings            │
│  ├── Chunking (tiktoken)              │
│  ├── Embedding (sentence-transformers)│
│  └── Vector insert (CAST AS vector)   │
│  Memory limit: 1 GB                   │
└───────────────────────────────────────┘
```

### Key Design Decisions

- **Single-origin proxy pattern**: The browser only talks to the frontend (port 3000). Next.js API route handlers proxy all requests to the FastAPI backend via the Docker internal network (`http://api-server:8000`). This eliminates CORS issues and keeps the backend internal.
- **No Prisma in frontend**: All database access is handled by the FastAPI backend. The frontend has zero direct database dependencies.
- **Parent-document hybrid reranking**: Vector search runs on chunks → top chunks are grouped by parent document → weighted aggregate score (rank-decay) → optional cross-encoder rerank → parent-level results returned.
- **Local AI models**: Uses `sentence-transformers` (BGE embedder + cross-encoder reranker) and OpenAI-compatible local LLM endpoints (Ollama / vLLM / LM Studio). No OpenAI or Claude API keys required.

---

## Project History

### Version 1.0 — Initial Frontend Template

- **Next.js 16 App Router** with TypeScript, Tailwind CSS 4, and shadcn/ui (New York style)
- **Notion-style green dual-mode theme**: Light greens (#E8F5E9 / #A5D6A7) for day mode, deep greens (#1B3A2F / #2E5C4A) for night mode, using `oklch` CSS variables and `next-themes`
- **Responsive layout**: Sidebar navigation, top bar, sticky footer, mobile hamburger menu
- **Theme system**: Custom `prose-rag` Markdown styling, gradient-green utilities, green scrollbars
- **Typed API client layer** (`lib/api/`): Prepared contracts for all four RAG workflows

### Version 2.0 — Four RAG Workflows

Implemented the complete RAG knowledge management UI with four industrial-grade workflows:

1. **Workflow 1 — Knowledge Ingestion** (`/ingest`): Drag-and-drop upload zone, chunking strategy configuration (fixed/recursive/semantic/markdown), live chunk preview with Markdown rendering, and a sync status panel showing document processing progress.
2. **Workflow 2 — Hybrid Search & Retrieval** (`/search`): Hybrid search bar with mode toggle (hybrid/vector/keyword/semantic), alpha weight slider, top-K control, rerank toggle. Results displayed as parent documents with top contributing chunks, each with full score breakdown (vector/keyword/hybrid).
3. **Workflow 3 — Memory Cart** (`/cart`): Temporary knowledge staging area with per-item selection, token counter with color-coded progress bar (green→amber→red), optimization strategies (truncate/summarize/deduplicate/reorder), and one-click "Send to Structured Chat".
4. **Workflow 4 — Structured Chat** (`/chat`): Template selector (4 built-in templates: RAG Q&A, Summarizer, Comparison Matrix, Entity Extraction), variable inputs, parameter panel (model/temperature/maxTokens/topP), live prompt preview with `{{context}}` and `{{variable}}` interpolation, and streaming chat with SSE.

### Version 3.0 — Production Backend

Built the complete FastAPI backend:

- **Database schema** (`db/init.sql`): pgvector extension, `documents` table (parent Markdown, tags, metadata JSONB, parent_id for versioning), `document_chunks` table (embedding `vector(1536)`, `search_vector` tsvector), `settings` table (model selection), `ingest_jobs` table (Arq audit trail)
- **Indexes**: HNSW vector index (`m=16`, `ef_construction=128`, `vector_cosine_ops`) for fast cosine similarity search; GIN index on tsvector for BM25-style keyword search; trigger-maintained tsvector column
- **Async stack**: SQLAlchemy + asyncpg for non-blocking database access; Arq for background task processing (chunking, embedding, vector insertion)
- **Hybrid search implementation** (`services/search.py`): Exact parent-document reranking pipeline — vector search on chunks via HNSW → keyword search via GIN tsvector → alpha-weighted hybrid score → group by parent document → rank-decay weighted aggregate (1.0/0.6/0.36) → optional cross-encoder rerank → return `ParentResult[]` with top chunks
- **CAST vector handling**: All vector inserts use `CAST(:embedding AS vector)` since asyncpg cannot bind the pgvector type directly
- **Markdown persistence**: Original Markdown stored to `/data/markdown/<document_id>.md`
- **Arq worker** (`worker.py`): Background ingestion pipeline — chunk text → batch embed via sentence-transformers → insert vectors with CAST → update document status
- **LangChain integration**: Used for orchestration where beneficial (text splitters, document loaders)
- **Model selection** (`/settings` page + `/settings` API): Choose chat model (Qwen2.5, DeepSeek, Llama, Mistral, Gemma), embedding model (BGE small/base/large, BGE M3, E5, GTE), and reranker model (BGE reranker base/large/v2-m3, MS MARCO)
- **Health check** (`/health` page + `/health` API): Tests PostgreSQL, Redis, embedder, and all API endpoints with live status badges and latency metrics

### Version 4.0 — Markdown Editor Enhancement

- **Enhanced Markdown editor** (`components/editor/markdown-editor.tsx`): Clipboard image paste (Ctrl/Cmd+V) → instant upload to `/data/pic` → automatic MD image syntax insertion at cursor position
- **Fulltext ↔ Render toggle**: Segmented control with instant mode switching and synchronized state. Render mode uses `react-markdown` with `prose-rag` Notion-green styling
- **Image management**: Thumbnail strip with alt text and delete capability; drag-and-drop image files; file picker button
- **Image API**: `POST /api/images/upload` (multipart → `/data/pic`), `GET /api/images/:filename` (serve with 1-year immutable cache), `DELETE /api/images/:filename`
- **Backend image router**: FastAPI `images.py` mirrors the same contract; docker-compose mounts `./data/pic` volume to both api-server and ai-worker
- **Integrated** into both the Ingest upload zone (content field) and the Search edit modal

### Version 5.0 — Architecture Cleanup

- **Removed all sandbox references**: Renamed `lib/sandbox/` → `lib/rag/` and cleaned 16 files of sandbox terminology
- **Code organization**: Improved separation of concerns across frontend layers

### Version 6.0 — Standalone Deployment (Current)

- **Complete Prisma removal**: Deleted `src/lib/db.ts` (Prisma client), `prisma/schema.prisma`, and `src/lib/rag/` (local RAG utilities). All 20 Next.js API route handlers rewritten as thin proxies that forward to the FastAPI backend via `src/lib/proxy.ts`.
- **Single-origin proxy pattern**: Browser calls relative `/api/*` paths; Next.js route handlers proxy to `http://api-server:8000` via the Docker internal network using the `BACKEND_URL` env var. No CORS issues, backend stays internal.
- **Dockerfile.standalone** (root): Multi-stage Node.js 20 build — deps → build → runner. Uses Next.js standalone output for minimal image size. Runs as non-root user.
- **docker-compose.yml**: Five services (`personalos-db`, `redis`, `api-server`, `ai-worker`, `frontend`) with health checks, named volumes for PostgreSQL data, Redis data, markdown files, and image files. Frontend build context changed to root directory.
- **Windows Docker Desktop optimization**: Named volumes instead of bind mounts for data directories (avoids Windows path permission issues). All services have `restart: always`.

---

## Configuration Reference

### Environment Variables

#### Backend (api-server + ai-worker)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:mysecretpassword@personalos-db:5432/personalos` | PostgreSQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection for Arq broker |
| `MARKDOWN_DIR` | `/data/markdown` | Original Markdown file storage |
| `PIC_DIR` | `/data/pic` | Uploaded image storage |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |
| `EMBEDDING_MODEL` | `bge-small-en-v1.5` | Embedding model name |
| `EMBEDDING_HF_MODEL` | `BAAI/bge-small-en-v1.5` | HuggingFace model ID |
| `EMBEDDING_DIM` | `384` | Embedding vector dimension |
| `RERANKER_MODEL` | `bge-reranker-base` | Cross-encoder reranker model |
| `CHAT_MODEL` | `qwen2.5-7b-instruct` | Chat LLM model name |
| `CHAT_API_BASE` | `http://localhost:11434/v1` | OpenAI-compatible LLM endpoint |
| `CHAT_API_KEY` | `not-required` | LLM API key |
| `HNSW_EF_SEARCH` | `64` | Runtime HNSW search width |

#### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://api-server:8000` | Server-side backend URL (Docker internal) |
| `NEXT_PUBLIC_API_BASE_URL` | _(empty)_ | Browser-side base URL (empty = relative `/api/*`) |

### Docker Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `personalos_db_data` | `/var/lib/postgresql/data` | PostgreSQL data persistence |
| `redis_data` | `/data` | Redis persistence |
| `markdown_data` | `/data/markdown` | Original Markdown documents |
| `pic_data` | `/data/pic` | Uploaded images |

### Database Schema

- **`namespaces`**: Logical document collections (engineering, hr, legal, etc.)
- **`documents`**: Parent Markdown documents with status tracking, tags, metadata
- **`document_chunks`**: Embedded chunks with `vector(1536)` embedding + `tsvector` full-text
- **`settings`**: Single-row table for model selection (id=1)
- **`ingest_jobs`**: Arq task audit trail

**Indexes**:
- HNSW on `embedding` (`vector_cosine_ops`, `m=16`, `ef_construction=128`)
- GIN on `search_vector` (tsvector full-text)
- GIN on `tags` (array filtering)
- B-tree on `namespace_id`, `status`, `updated_at`

---

## API Reference

All endpoints are accessed via the frontend at `http://localhost:3000/api/*`. The Next.js route handlers proxy to the FastAPI backend.

### Ingest

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ingest/documents` | List all documents |
| POST | `/api/ingest` | Create + ingest a document |
| POST | `/api/ingest/:id/preview` | Preview chunking |
| POST | `/api/ingest/:id/commit` | Re-run full ingest pipeline |
| DELETE | `/api/ingest/:id` | Delete document + chunks |

### Search

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/search` | Hybrid search with parent reranking |
| PATCH | `/api/search/:id` | Edit chunk (optional re-embed) |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/templates` | List prompt templates |
| POST | `/api/chat` | Non-streaming chat |
| POST | `/api/chat/stream` | Streaming chat (SSE) |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings/catalog` | Available models |
| GET | `/api/settings` | Current settings |
| PUT | `/api/settings` | Update settings |

### Knowledge

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/knowledge/namespaces` | List namespaces with stats |
| GET | `/api/knowledge/stats` | Global statistics |

### Images

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/images/upload` | Upload image (multipart) |
| GET | `/api/images/:filename` | Serve image |
| DELETE | `/api/images/:filename` | Delete image |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend health report |

### Utility

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/seed` | Seed 3 sample documents |
| POST | `/api/cart/tokens` | Count tokens |
| POST | `/api/cart/optimize` | Optimize cart items |

---

## Troubleshooting

### Services won't start

```powershell
# Check service status
docker compose ps

# View logs for a specific service
docker compose logs api-server
docker compose logs ai-worker
docker compose logs frontend

# Rebuild from scratch
docker compose down -v
docker compose up -d --build
```

### First build is slow

The backend Dockerfile pre-downloads BGE embedding and reranker model weights (~550 MB total). This is a one-time cost. Subsequent builds use Docker cache.

### Frontend can't reach backend

- Verify `BACKEND_URL=http://api-server:8000` is set in the frontend service environment
- Check that `api-server` is healthy: `docker compose ps api-server`
- The frontend's Next.js API routes proxy to the backend; if you see `502 Backend unreachable`, the backend container is not running or not healthy

### Image upload fails

- Verify the `pic_data` volume is mounted on both `api-server` and `ai-worker`
- Check that `/data/pic` directory exists inside the backend container:
  ```powershell
  docker compose exec api-server ls -la /data/pic
  ```

### Database connection errors

- Wait for the `personalos-db` health check to pass before starting the backend (docker-compose handles this with `depends_on: condition: service_healthy`)
- Verify the password matches: `mysecretpassword` in both `docker-compose.yml` and `db/init.sql`
- The `db/init.sql` script runs automatically on first database initialization only. To re-run it, you must delete the volume: `docker compose down -v && docker compose up -d --build`

### AI worker OOM (Out of Memory)

The worker has a 1 GB memory limit. If processing large documents causes OOM:
- Increase the limit in `docker-compose.yml` under `ai-worker.deploy.resources.limits.memory`
- Or reduce `CHUNK_SIZE_TOKENS` to process smaller batches

### Port conflicts

If ports 3000, 8000, or 5432 are already in use:
- Edit `docker-compose.yml` and change the port mapping (e.g., `"3001:3000"`)
- Update `CORS_ORIGINS` in the backend environment to match

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, Zustand, next-themes |
| Backend | FastAPI, SQLAlchemy (async), asyncpg, pgvector, Arq, LangChain |
| AI/ML | sentence-transformers (BGE embedder + cross-encoder reranker), tiktoken, torch |
| Database | PostgreSQL 16 with pgvector (HNSW + GIN indexes) |
| Cache/Queue | Redis 7 (Arq broker) |
| Deployment | Docker Compose, Docker Desktop (Windows) |

## License

Personal Knowledge OS — Verdant RAG. Built for enterprise and personal knowledge management.
