import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/knowledge/namespaces
 * Aggregate document / chunk / token counts per namespace.
 * Returns snake_case JSON array.
 */
export async function GET() {
  try {
    const namespaces = await db.namespace.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        documents: {
          select: { id: true, tokenCount: true, chunkCount: true },
        },
      },
    })

    const out = namespaces.map((n) => {
      const documentCount = n.documents.length
      const chunkCount = n.documents.reduce((s, d) => s + d.chunkCount, 0)
      const totalTokens = n.documents.reduce((s, d) => s + d.tokenCount, 0)
      return {
        id: n.id,
        name: n.name,
        description: n.description,
        document_count: documentCount,
        chunk_count: chunkCount,
        total_tokens: totalTokens,
        embedding_model: n.embeddingModel,
        created_at: n.createdAt.toISOString(),
      }
    })

    return NextResponse.json(out)
  } catch (e) {
    console.error('[GET /api/knowledge/namespaces]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list namespaces' },
      { status: 500 },
    )
  }
}
