import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { embed, countTokens } from '@/lib/rag/rag'

interface PatchBody {
  content: string
  reembed?: boolean
}

/**
 * PATCH /api/search/:id
 * Update a chunk's content. If `reembed` is true, regenerate the embedding
 * vector from the new content. Returns snake_case response.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await req.json()) as PatchBody
    if (typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 },
      )
    }

    const existing = await db.chunk.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 },
      )
    }

    const reembed = Boolean(body.reembed)
    const data: {
      content: string
      tokenCount: number
      embedding?: string
    } = {
      content: body.content,
      tokenCount: countTokens(body.content),
    }
    if (reembed) {
      data.embedding = JSON.stringify(embed(body.content))
    }

    const updated = await db.chunk.update({ where: { id }, data })

    return NextResponse.json({
      id: updated.id,
      content: updated.content,
      reembedded: reembed,
      updated_at: updated.updatedAt.toISOString(),
    })
  } catch (e) {
    console.error('[PATCH /api/search/:id]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Patch failed' },
      { status: 500 },
    )
  }
}
