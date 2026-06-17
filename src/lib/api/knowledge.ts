/**
 * Knowledge API — namespace & stats overview
 * Endpoints: /api/knowledge
 */
import { request } from './client'
import type { KnowledgeNamespace, KnowledgeStats } from '@/types/rag'

const mockNamespaces: KnowledgeNamespace[] = [
  {
    id: 'ns_eng',
    name: 'engineering',
    description: 'Engineering docs, runbooks, and architecture references.',
    documentCount: 48,
    chunkCount: 1240,
    totalTokens: 542000,
    embeddingModel: 'text-embedding-3-large',
    createdAt: '2024-11-02T00:00:00Z',
  },
  {
    id: 'ns_hr',
    name: 'hr',
    description: 'HR handbook, policies and onboarding material.',
    documentCount: 22,
    chunkCount: 610,
    totalTokens: 218000,
    embeddingModel: 'text-embedding-3-large',
    createdAt: '2024-12-05T00:00:00Z',
  },
  {
    id: 'ns_legal',
    name: 'legal',
    description: 'Contracts, compliance and regulatory documents.',
    documentCount: 15,
    chunkCount: 430,
    totalTokens: 196000,
    embeddingModel: 'text-embedding-3-large',
    createdAt: '2024-12-20T00:00:00Z',
  },
]

export const knowledgeApi = {
  async listNamespaces(): Promise<KnowledgeNamespace[]> {
    return request<KnowledgeNamespace[]>(
      '/knowledge/namespaces',
      { method: 'GET', mockDelay: 400 },
      () => [...mockNamespaces],
    )
  },

  async getStats(): Promise<KnowledgeStats> {
    return request<KnowledgeStats>(
      '/knowledge/stats',
      { method: 'GET', mockDelay: 500 },
      () => ({
        totalDocuments: 85,
        totalChunks: 2280,
        totalTokens: 956000,
        namespaces: mockNamespaces.length,
        recentIngests: [],
        topTags: [
          { tag: 'architecture', count: 24 },
          { tag: 'policy', count: 18 },
          { tag: 'onboarding', count: 12 },
          { tag: 'api', count: 10 },
          { tag: 'governance', count: 8 },
        ],
      }),
    )
  },
}
