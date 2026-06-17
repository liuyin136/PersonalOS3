/**
 * Ingestion API — Workflow 1: Knowledge Ingestion & Sync Flow
 * Endpoints: /api/ingest
 */
import { request, uid } from './client'
import type {
  IngestRequest,
  KnowledgeDocument,
  ChunkPreview,
  ChunkingConfig,
  SyncStatusEvent,
} from '@/types/rag'

/** Mock document store (template phase only) */
const mockDocs: KnowledgeDocument[] = [
  {
    id: 'doc_001',
    title: 'Enterprise RAG Architecture Guide',
    sourceType: 'markdown',
    sourceUri: 's3://verdant/docs/rag-arch.md',
    status: 'synced',
    chunkCount: 42,
    tokenCount: 18420,
    markdownUri: 's3://verdant/docs/rag-arch.md',
    namespace: 'engineering',
    tags: ['architecture', 'rag', 'reference'],
    createdAt: '2025-01-12T08:30:00Z',
    updatedAt: '2025-01-12T09:15:00Z',
    progress: 100,
  },
  {
    id: 'doc_002',
    title: 'Onboarding Handbook 2025',
    sourceType: 'pdf',
    sourceUri: 's3://verdant/docs/onboarding.pdf',
    status: 'synced',
    chunkCount: 28,
    tokenCount: 12100,
    markdownUri: 's3://verdant/docs/onboarding.md',
    namespace: 'hr',
    tags: ['handbook', 'onboarding'],
    createdAt: '2025-01-10T03:00:00Z',
    updatedAt: '2025-01-10T03:42:00Z',
    progress: 100,
  },
  {
    id: 'doc_003',
    title: 'API Rate Limiting Policy',
    sourceType: 'confluence',
    sourceUri: 'confluence://wiki/api-policy',
    status: 'embedding',
    chunkCount: 0,
    tokenCount: 0,
    namespace: 'engineering',
    tags: ['api', 'policy'],
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:02:00Z',
    progress: 62,
  },
]

export const ingestApi = {
  /** List all ingested documents. */
  async listDocuments(): Promise<KnowledgeDocument[]> {
    return request<KnowledgeDocument[]>(
      '/ingest/documents',
      { method: 'GET' },
      () => [...mockDocs],
    )
  },

  /** Create a new ingestion job. */
  async createIngest(payload: IngestRequest): Promise<KnowledgeDocument> {
    return request<KnowledgeDocument>(
      '/ingest',
      { method: 'POST', body: payload, mockDelay: 600 },
      () => ({
        id: uid('doc'),
        title: payload.title,
        sourceType: payload.sourceType,
        sourceUri: payload.sourceUri,
        status: 'pending',
        chunkCount: 0,
        tokenCount: 0,
        namespace: payload.namespace,
        tags: payload.tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        progress: 0,
      }),
    )
  },

  /** Get chunk preview for a document given a chunking config. */
  async previewChunks(
    documentId: string,
    config: ChunkingConfig,
  ): Promise<ChunkPreview[]> {
    return request<ChunkPreview[]>(
      `/ingest/${documentId}/preview`,
      { method: 'POST', body: config, mockDelay: 700 },
      () => {
        const sample = `# Sample chunk content for ${documentId}\n\nThis is a placeholder chunk generated using the **${config.strategy}** strategy with chunk size ${config.chunkSize} and overlap ${config.chunkOverlap}.\n\n- Bullet point one\n- Bullet point two\n\n\`\`\`python\nvector = embed(chunk)\n\`\`\``
        const count = 5
        return Array.from({ length: count }, (_, i) => ({
          id: uid('chk'),
          index: i,
          content: sample,
          tokenCount: Math.round(config.chunkSize * 0.75),
          embeddingModel: 'text-embedding-3-large',
          overlap: i === 0 ? 0 : config.chunkOverlap,
        }))
      },
    )
  },

  /** Commit ingestion — store markdown + sync to pgvector. */
  async commitIngest(documentId: string): Promise<KnowledgeDocument> {
    return request<KnowledgeDocument>(
      `/ingest/${documentId}/commit`,
      { method: 'POST', mockDelay: 800 },
      () => ({
        ...mockDocs[0],
        id: documentId,
        status: 'synced',
        progress: 100,
        chunkCount: 42,
        tokenCount: 18420,
        updatedAt: new Date().toISOString(),
      }),
    )
  },

  /** Delete a document and its vectors. */
  async deleteDocument(documentId: string): Promise<void> {
    return request<void>(
      `/ingest/${documentId}`,
      { method: 'DELETE', mockDelay: 300 },
      () => undefined,
    )
  },

  /** Subscribe to sync status events (placeholder for SSE/websocket). */
  subscribeSyncStatus(
    _documentId: string,
    onEvent: (event: SyncStatusEvent) => void,
  ): () => void {
    // Mock: emit a few status events then stop.
    const statuses: SyncStatusEvent[] = [
      { documentId: _documentId, status: 'chunking', progress: 25, message: 'Chunking document…', timestamp: new Date().toISOString() },
      { documentId: _documentId, status: 'embedding', progress: 55, message: 'Generating embeddings…', timestamp: new Date().toISOString() },
      { documentId: _documentId, status: 'indexing', progress: 80, message: 'Indexing into pgvector…', timestamp: new Date().toISOString() },
      { documentId: _documentId, status: 'synced', progress: 100, message: 'Sync complete.', timestamp: new Date().toISOString() },
    ]
    let i = 0
    const timer = setInterval(() => {
      if (i >= statuses.length) {
        clearInterval(timer)
        return
      }
      onEvent(statuses[i])
      i++
    }, 1200)
    return () => clearInterval(timer)
  },
}
