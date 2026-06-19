/**
 * Search API — Workflow 2: Hybrid retrieval + parent-document reranking
 * Endpoints: /search
 */
import { request } from './client'
import type {
  SearchQuery,
  SearchResponse,
  ParentResult,
  ChunkHit,
  EditChunkRequest,
  EditChunkResponse,
  SourceType,
} from '@/types/rag'

function mapHit(c: Record<string, unknown>): ChunkHit {
  return {
    id: String(c.id ?? c.chunk_id ?? ''),
    chunkIndex: Number(c.chunk_index ?? 0),
    content: String(c.content ?? ''),
    markdown: String(c.markdown ?? c.content ?? ''),
    tokenCount: Number(c.token_count ?? 0),
    vectorScore: Number(c.vector_score ?? 0),
    keywordScore: Number(c.keyword_score ?? 0),
    hybridScore: Number(c.hybrid_score ?? 0),
  }
}

function mapParent(p: Record<string, unknown>): ParentResult {
  return {
    documentId: String(p.document_id ?? ''),
    documentTitle: String(p.document_title ?? 'Untitled'),
    sourceType: (p.source_type as SourceType) ?? 'markdown',
    namespace: String(p.namespace ?? 'default'),
    tags: (p.tags as string[]) ?? [],
    parentScore: Number(p.parent_score ?? 0),
    contributingChunks: Number(p.contributing_chunks ?? 0),
    topChunks: ((p.top_chunks as Record<string, unknown>[]) ?? []).map(mapHit),
  }
}

export const searchApi = {
  /** Run a hybrid / vector / keyword search with parent reranking. */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const body = {
      query: query.query,
      mode: query.mode,
      namespace: query.namespace,
      top_k: query.topK,
      alpha: query.alpha,
      rerank: query.rerank ?? true,
      rerank_top: query.rerankTop ?? 10,
      filters: query.filters,
    }
    const data = await request<Record<string, unknown>>('/api/search', {
      method: 'POST',
      body,
    })
    return {
      query: String(data.query ?? query.query),
      mode: (data.mode as SearchResponse['mode']) ?? query.mode,
      total: Number(data.total ?? 0),
      tookMs: Number(data.took_ms ?? 0),
      results: ((data.results as Record<string, unknown>[]) ?? []).map(mapParent),
    }
  },

  /** Edit a chunk in place (and optionally re-embed). */
  async editChunk(payload: EditChunkRequest): Promise<EditChunkResponse> {
    const data = await request<Record<string, unknown>>(
      `/api/search/${payload.id}`,
      { method: 'PATCH', body: { content: payload.content, reembed: payload.reembed } },
    )
    return {
      id: String(data.id),
      content: String(data.content),
      reembedded: Boolean(data.reembedded),
      updatedAt: String(data.updated_at ?? ''),
    }
  },
}
