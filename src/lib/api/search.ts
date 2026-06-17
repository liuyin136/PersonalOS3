/**
 * Search API — Workflow 2: Retrieval, Reading & Real-time Editing Flow
 * Endpoints: /api/search
 */
import { request, uid } from './client'
import type {
  SearchQuery,
  SearchResponse,
  SearchHit,
  EditChunkRequest,
  EditChunkResponse,
} from '@/types/rag'

const mockContent = (i: number) =>
  `## Result ${i + 1}\n\nThis is a **mock knowledge chunk** returned by the hybrid search layer.\n\nIt demonstrates Markdown rendering including:\n\n- Vector similarity scoring\n- BM25 keyword scoring\n- Reciprocal rank fusion\n\n\`\`\`yaml\nscore:\n  vector: 0.84\n  keyword: 0.62\n  hybrid: 0.79\n\`\`\`\n\n> Use the edit action to refine this chunk and re-embed it into pgvector.`

export const searchApi = {
  /** Run a hybrid / vector / keyword search. */
  async search(query: SearchQuery): Promise<SearchResponse> {
    return request<SearchResponse>(
      '/search',
      { method: 'POST', body: query, mockDelay: 600 },
      () => {
        const count = Math.min(query.topK, 6)
        const hits: SearchHit[] = Array.from({ length: count }, (_, i) => {
          const vectorScore = 0.95 - i * 0.07 - Math.random() * 0.05
          const keywordScore = 0.88 - i * 0.09 - Math.random() * 0.05
          const hybridScore =
            query.alpha * vectorScore + (1 - query.alpha) * keywordScore
          return {
            id: uid('hit'),
            documentId: `doc_${String(i + 1).padStart(3, '0')}`,
            documentTitle: [
              'Enterprise RAG Architecture Guide',
              'Onboarding Handbook 2025',
              'API Rate Limiting Policy',
              'Incident Response Playbook',
              'Data Governance Framework',
              'Vector Index Tuning Notes',
            ][i] ?? `Document ${i + 1}`,
            chunkIndex: i * 3 + 1,
            content: mockContent(i),
            markdown: mockContent(i),
            vectorScore: Number(vectorScore.toFixed(3)),
            keywordScore: Number(keywordScore.toFixed(3)),
            hybridScore: Number(hybridScore.toFixed(3)),
            sourceType: (['markdown', 'pdf', 'confluence', 'docx', 'url', 'txt'] as const)[i % 6],
            tags: [['architecture'], ['handbook'], ['api'], ['ops'], ['governance'], ['vector']][i % 6],
            namespace: 'engineering',
            metadata: { reranked: query.rerank ?? false },
          }
        })
        return {
          hits,
          total: count,
          tookMs: 120 + Math.floor(Math.random() * 80),
          query: query.query,
          mode: query.mode,
        }
      },
    )
  },

  /** Edit a chunk in place (and optionally re-embed). */
  async editChunk(payload: EditChunkRequest): Promise<EditChunkResponse> {
    return request<EditChunkResponse>(
      `/search/${payload.id}`,
      { method: 'PATCH', body: payload, mockDelay: 500 },
      () => ({
        id: payload.id,
        content: payload.content,
        reembedded: payload.reembed,
        updatedAt: new Date().toISOString(),
      }),
    )
  },
}
