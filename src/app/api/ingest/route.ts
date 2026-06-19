import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapDoc } from '@/lib/rag/mappers'
import { chunkText, embed } from '@/lib/rag/rag'

interface IngestBody {
  title: string
  source_type?: string
  source_uri?: string
  namespace?: string
  tags?: string[]
  chunking?: {
    strategy: 'fixed' | 'recursive' | 'semantic' | 'markdown'
    chunk_size: number
    chunk_overlap: number
  }
  content?: string
}

/**
 * POST /api/ingest
 * Create a new ingestion job:
 *  1. Upsert namespace (creates if missing).
 *  2. Create Document row with status 'pending'.
 *  3. Persist the markdown content (stored on markdownPath field;
 *     production backend writes to /data/markdown/<id>.md).
 *  4. Run chunking + embeddings inline.
 *  5. Update status to 'synced', chunkCount, tokenCount.
 *
 * Returns the document in snake_case.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IngestBody
    if (!body.title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 },
      )
    }

    const namespaceName = body.namespace?.trim() || 'default'
    const sourceType = body.source_type || 'markdown'
    const sourceUri = body.source_uri || ''
    const tags = Array.isArray(body.tags) ? body.tags : []
    const content = body.content ?? ''
    const cfg = body.chunking ?? {
      strategy: 'recursive' as const,
      chunk_size: 800,
      chunk_overlap: 120,
    }

    // 1. Upsert namespace
    const namespace = await db.namespace.upsert({
      where: { name: namespaceName },
      update: {},
      create: {
        name: namespaceName,
        description: `Auto-created namespace: ${namespaceName}`,
      },
    })

    // 2. Create document (pending)
    const doc = await db.document.create({
      data: {
        title: body.title,
        sourceType,
        sourceUri,
        namespaceId: namespace.id,
        tags: JSON.stringify(tags),
        markdownPath: content, // store markdown content directly
        status: 'chunking',
        progress: 10,
      },
      include: { namespace: true },
    })

    // 3. Chunk + embed inline
    const chunks = chunkText(content, {
      strategy: cfg.strategy,
      chunkSize: cfg.chunk_size,
      chunkOverlap: cfg.chunk_overlap,
    })

    if (chunks.length > 0) {
      await db.chunk.createMany({
        data: chunks.map((c) => ({
          documentId: doc.id,
          namespaceId: namespace.id,
          chunkIndex: c.index,
          content: c.content,
          tokenCount: c.tokenCount,
          embedding: JSON.stringify(embed(c.content)),
        })),
      })
    }

    const totalTokens = chunks.reduce((s, c) => s + c.tokenCount, 0)

    // 4. Mark synced
    const updated = await db.document.update({
      where: { id: doc.id },
      data: {
        status: 'synced',
        progress: 100,
        chunkCount: chunks.length,
        tokenCount: totalTokens,
      },
      include: { namespace: true },
    })

    return NextResponse.json(mapDoc(updated))
  } catch (e) {
    console.error('[POST /api/ingest]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Ingestion failed' },
      { status: 500 },
    )
  }
}
