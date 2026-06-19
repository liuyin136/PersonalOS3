/**
 * Knowledge API — namespace & stats overview
 * Endpoints: /knowledge
 */
import { request } from './client'
import type { KnowledgeNamespace, KnowledgeStats } from '@/types/rag'

function mapNamespace(n: Record<string, unknown>): KnowledgeNamespace {
  return {
    id: String(n.id),
    name: String(n.name),
    description: String(n.description ?? ''),
    documentCount: Number(n.document_count ?? n.documentCount ?? 0),
    chunkCount: Number(n.chunk_count ?? n.chunkCount ?? 0),
    totalTokens: Number(n.total_tokens ?? n.totalTokens ?? 0),
    embeddingModel: String(n.embedding_model ?? n.embeddingModel ?? ''),
    createdAt: String(n.created_at ?? n.createdAt ?? ''),
  }
}

export const knowledgeApi = {
  async listNamespaces(): Promise<KnowledgeNamespace[]> {
    const data = await request<Record<string, unknown>[]>('/api/knowledge/namespaces')
    return data.map(mapNamespace)
  },

  async getStats(): Promise<KnowledgeStats> {
    const data = await request<Record<string, unknown>>('/api/knowledge/stats')
    return {
      totalDocuments: Number(data.total_documents ?? 0),
      totalChunks: Number(data.total_chunks ?? 0),
      totalTokens: Number(data.total_tokens ?? 0),
      namespaces: Number(data.namespaces ?? 0),
      topTags: ((data.top_tags as { tag: string; count: number }[]) ?? []).map((t) => ({
        tag: String(t.tag),
        count: Number(t.count),
      })),
    }
  },
}
