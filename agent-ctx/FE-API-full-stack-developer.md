# FE-API — Sandbox Next.js API Routes

Agent: full-stack-developer
Task: Build Next.js API route handlers that mirror the FastAPI backend contract so the preview is fully functional (Prisma + SQLite + JS cosine similarity).

## What was built

### Shared sandbox lib
- `src/lib/sandbox/rag.ts` — `countTokens`, `tokenize`, `embed` (deterministic 384-dim hash-based, L2-normalized), `cosineSim`, `chunkText` (recursive markdown-aware splitter with overlap), `keywordScore`, `uid`.
- `src/lib/sandbox/mappers.ts` — `mapDoc` (Prisma Document+Namespace → snake_case), `safeParseArray` / `safeParseObject`.

### API routes (19 files)
1. `src/app/api/ingest/documents/route.ts` — GET: list docs joined with namespace.
2. `src/app/api/ingest/route.ts` — POST: upsert namespace → create doc → chunk + embed inline → mark synced.
3. `src/app/api/ingest/[id]/preview/route.ts` — POST: re-chunk stored content (no DB write).
4. `src/app/api/ingest/[id]/commit/route.ts` — POST: wipe chunks, re-run chunking + embedding.
5. `src/app/api/ingest/[id]/route.ts` — DELETE: cascade delete doc + chunks.
6. `src/app/api/search/route.ts` — POST: hybrid search with parent-document reranking (rank-decay 1.0/0.6/0.36, normalized by min(count,3), capped to rerank_top).
7. `src/app/api/search/[id]/route.ts` — PATCH: update chunk content + optional re-embed.
8. `src/app/api/chat/templates/route.ts` — GET: 4 built-in templates in snake_case.
9. `src/app/api/chat/route.ts` — POST: mock Markdown assistant reply describing assembled prompt.
10. `src/app/api/chat/stream/route.ts` — POST: SSE stream of mock reply (80ms/token, `data: {delta,messageId,done}\n\n`).
11. `src/app/api/settings/catalog/route.ts` — GET: 6 chat / 6 embedding / 4 reranker models.
12. `src/app/api/settings/route.ts` — GET + PUT: get-or-create Settings(id=1), snake_case mapping.
13. `src/app/api/knowledge/namespaces/route.ts` — GET: per-namespace doc/chunk/token counts.
14. `src/app/api/knowledge/stats/route.ts` — GET: global totals + top-10 tags.
15. `src/app/api/health/route.ts` — GET: DB ping + 3 components (postgres/api/embedder).
16. `src/app/api/cart/tokens/route.ts` — POST: `{token_count}`.
17. `src/app/api/cart/optimize/route.ts` — POST: truncate/deduplicate/reorder strategies with token accounting.
18. `src/app/api/seed/route.ts` — POST: idempotent seeding of 3 sample markdown docs into 'engineering' namespace.

## Verification

All endpoints tested end-to-end with curl:

| Endpoint | Result |
|---|---|
| `GET /api/health` | status ok, postgres latency ~15ms |
| `POST /api/seed` | 3 docs created (synced, 760 tokens total) |
| `GET /api/knowledge/stats` | 3 docs / 3 chunks / 760 tokens / 1 ns / 8 top tags |
| `GET /api/knowledge/namespaces` | engineering ns with doc_count=3 |
| `POST /api/search "hybrid retrieval"` | 3 ParentResults, top = RAG Architecture (parent_score=0.59) |
| `POST /api/ingest` (new doc) | status synced, 1 chunk, 90 tokens |
| `POST /api/ingest/[id]/preview` | 3 chunks with correct overlap + token counts |
| `PATCH /api/search/[id]` | updates content + re-embeds, returns updated_at |
| `DELETE /api/ingest/[id]` | HTTP 204 |
| `POST /api/cart/tokens` | `{token_count:12}` |
| `POST /api/cart/optimize` (deduplicate) | removed_count=1, optimized_tokens=6 |
| `POST /api/chat` | 226-token Markdown mock reply |
| `POST /api/chat/stream` | SSE `data:` events with 80ms cadence |
| `GET /api/settings/catalog` | 6 chat / 6 embedding / 4 reranker models |
| `GET /api/settings` | snake_case ModelSettings |
| `GET /api/chat/templates` | 4 templates in snake_case |

## Lint status

`bun run lint` → exit 0, 0 errors, 0 warnings across all 21 new files.

## Key design decisions

- **Hash-based embeddings (FNV-1a hashing trick, 384-dim, L2-normalized)**: deterministic and overlap-aware, so cosine similarity reflects token overlap — enough to make hybrid search ranking meaningful for the demo without loading sentence-transformers.
- **Recursive markdown-aware chunker**: splits on H1-H3 + paragraphs for markdown, paragraphs → sentences for recursive, word budget for fixed/semantic. Greedy merge up to chunk_size with tail-overlap into next chunk; hard char-split fallback for oversized fragments.
- **Parent reranking exactly per spec**: vector + keyword scoring → hybrid = alpha·v + (1-alpha)·k → sort by hybrid desc → group by parent doc → rank-decay weighted aggregate (1.0, 0.6, 0.36) normalized by min(count,3) → cap to rerank_top → return ParentResult[] with top_chunks (max 3).
- **No POC data by default**: DB starts empty. `POST /api/seed` allows on-demand demo seeding (3 markdown docs into 'engineering' namespace).
- **Markdown content stored in `Document.markdownPath`** for sandbox simplicity (production writes to `/data/markdown/<id>.md`).
- **Chat returns mock Markdown**: describes what would be sent to the LLM (template, model, ctx count, variables, last user message) — clearly a sandbox response but structured like a real one. Stream splits into word chunks with 80ms cadence.
