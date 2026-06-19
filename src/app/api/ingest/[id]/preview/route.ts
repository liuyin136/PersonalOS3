import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chunkText, uid } from '@/lib/sandbox/rag'

interface PreviewBody {
  strategy?: 'fixed' | 'recursive' | 'semantic' | 'markdown'
  chunk_size?: number
  chunk_overlap?: number
}

/**
 * POST /api/ingest/:id/preview
 * Re-chunk the document's stored markdown content (markdownPath field)
 * using the supplied chunking config and return preview chunks (no DB write).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as PreviewBody

    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      )
    }

    const content = doc.markdownPath ?? ''
    const chunks = chunkText(content, {
      strategy: body.strategy ?? 'recursive',
      chunkSize: body.chunk_size ?? 800,
      chunkOverlap: body.chunk_overlap ?? 120,
    })

    return NextResponse.json(
      chunks.map((c) => ({
        id: uid('chk'),
        index: c.index,
        content: c.content,
        token_count: c.tokenCount,
        overlap: c.overlap,
      })),
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Preview failed' },
      { status: 500 },
    )
  }
}
