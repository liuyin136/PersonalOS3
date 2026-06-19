/**
 * Shared mappers between Prisma rows and the snake_case JSON contract
 * used by the frontend `lib/api/*.ts` clients.
 */
import type { Document, Namespace } from '@prisma/client'

export interface DocWithNamespace extends Document {
  namespace: Namespace
}

/** Map a Prisma Document (+namespace) to the snake_case backend contract. */
export function mapDoc(doc: DocWithNamespace): Record<string, unknown> {
  return {
    id: doc.id,
    title: doc.title,
    source_type: doc.sourceType,
    source_uri: doc.sourceUri,
    status: doc.status,
    progress: doc.progress,
    chunk_count: doc.chunkCount,
    token_count: doc.tokenCount,
    namespace: doc.namespace.name,
    tags: safeParseArray(doc.tags),
    markdown_uri: doc.markdownPath ?? null,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString(),
    error_message: doc.errorMessage ?? null,
  }
}

export function safeParseArray<T = unknown>(raw: string | null | undefined): T[] {
  if (!raw) return [] as T[]
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as T[]) : ([] as T[])
  } catch {
    return [] as T[]
  }
}

export function safeParseObject(
  raw: string | null | undefined,
): Record<string, unknown> {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
