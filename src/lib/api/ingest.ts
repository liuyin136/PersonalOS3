/**
 * Ingestion API — Workflow 1: Knowledge Ingestion & Sync Flow
 * Endpoints: /ingest
 */
import { request } from './client'
import type {
  IngestRequest,
  KnowledgeDocument,
  ChunkPreview,
  ChunkingConfig,
} from '@/types/rag'

/** Map backend snake_case → frontend camelCase. */
function mapDoc(d: Record<string, unknown>): KnowledgeDocument {
  return {
    id: String(d.id),
    title: String(d.title),
    sourceType: (d.source_type as KnowledgeDocument['sourceType']) ?? 'markdown',
    sourceUri: String(d.source_uri ?? ''),
    status: (d.status as KnowledgeDocument['status']) ?? 'pending',
    progress: Number(d.progress ?? 0),
    chunkCount: Number(d.chunk_count ?? 0),
    tokenCount: Number(d.token_count ?? 0),
    namespace: String(d.namespace ?? 'default'),
    tags: (d.tags as string[]) ?? [],
    markdownUri: (d.markdown_uri as string) ?? undefined,
    createdAt: String(d.created_at ?? ''),
    updatedAt: String(d.updated_at ?? ''),
    errorMessage: (d.error_message as string) ?? undefined,
  }
}

function toBackendChunking(c: ChunkingConfig) {
  return {
    strategy: c.strategy,
    chunk_size: c.chunkSize,
    chunk_overlap: c.chunkOverlap,
  }
}

export const ingestApi = {
  /** List all ingested documents. */
  async listDocuments(): Promise<KnowledgeDocument[]> {
    const data = await request<Record<string, unknown>[]>('/api/ingest/documents')
    return data.map(mapDoc)
  },

  /** Create a new ingestion job. */
  async createIngest(payload: IngestRequest): Promise<KnowledgeDocument> {
    const body = {
      title: payload.title,
      source_type: payload.sourceType,
      source_uri: payload.sourceUri,
      namespace: payload.namespace,
      tags: payload.tags,
      chunking: toBackendChunking(payload.chunking),
      content: payload.content ?? '',
    }
    const data = await request<Record<string, unknown>>('/api/ingest', {
      method: 'POST',
      body,
    })
    return mapDoc(data)
  },

  /** Get chunk preview for a document given a chunking config. */
  async previewChunks(
    documentId: string,
    config: ChunkingConfig,
  ): Promise<ChunkPreview[]> {
    const data = await request<Record<string, unknown>[]>(
      `/api/ingest/${documentId}/preview`,
      { method: 'POST', body: toBackendChunking(config) },
    )
    return data.map((c) => ({
      id: String(c.id),
      index: Number(c.index),
      content: String(c.content),
      tokenCount: Number(c.token_count),
      overlap: Number(c.overlap),
    }))
  },

  /** Commit ingestion — store markdown + sync to pgvector. */
  async commitIngest(documentId: string): Promise<KnowledgeDocument> {
    const data = await request<Record<string, unknown>>(
      `/api/ingest/${documentId}/commit`,
      { method: 'POST' },
    )
    return mapDoc(data)
  },

  /** Delete a document and its vectors. */
  async deleteDocument(documentId: string): Promise<void> {
    await request<void>(`/api/ingest/${documentId}`, { method: 'DELETE' })
  },

  /**
   * Subscribe to sync status events. Polls the document list for status
   * changes (the backend processes ingestion asynchronously via Arq).
   */
  subscribeSyncStatus(
    documentId: string,
    onEvent: (event: {
      documentId: string
      status: KnowledgeDocument['status']
      progress: number
      message: string
      timestamp: string
    }) => void,
  ): () => void {
    let active = true
    const poll = async () => {
      while (active) {
        try {
          const docs = await ingestApi.listDocuments()
          const doc = docs.find((d) => d.id === documentId)
          if (doc) {
            onEvent({
              documentId,
              status: doc.status,
              progress: doc.progress,
              message: doc.errorMessage ?? '',
              timestamp: doc.updatedAt,
            })
            if (doc.status === 'synced' || doc.status === 'failed') return
          }
        } catch {
          /* ignore transient errors */
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
    void poll()
    return () => {
      active = false
    }
  },
}
