import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapDoc } from '@/lib/rag/mappers'
import { chunkText, embed } from '@/lib/rag/rag'

/**
 * POST /api/ingest/:id/commit
 * Re-run chunking + embedding against the document's stored markdown content
 * (clears previous chunks and re-creates them). Returns the updated document.
 *
 * In the FastAPI backend this is what the Arq worker executes after the
 * user confirms a chunking preview. Done inline here.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      )
    }

    const content = doc.markdownPath ?? ''
    const meta = JSON.parse(doc.metadata || '{}') as {
      chunking?: { strategy: string; chunk_size: number; chunk_overlap: number }
    }
    const cfg = meta.chunking ?? {
      strategy: 'recursive',
      chunk_size: 800,
      chunk_overlap: 120,
    }

    // Wipe existing chunks for this document
    await db.chunk.deleteMany({ where: { documentId: id } })

    const chunks = chunkText(content, {
      strategy: cfg.strategy as 'fixed' | 'recursive' | 'semantic' | 'markdown',
      chunkSize: cfg.chunk_size,
      chunkOverlap: cfg.chunk_overlap,
    })

    if (chunks.length > 0) {
      await db.chunk.createMany({
        data: chunks.map((c) => ({
          documentId: id,
          namespaceId: doc.namespaceId,
          chunkIndex: c.index,
          content: c.content,
          tokenCount: c.tokenCount,
          embedding: JSON.stringify(embed(c.content)),
        })),
      })
    }

    const totalTokens = chunks.reduce((s, c) => s + c.tokenCount, 0)
    const updated = await db.document.update({
      where: { id },
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
    console.error('[POST /api/ingest/:id/commit]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Commit failed' },
      { status: 500 },
    )
  }
}
