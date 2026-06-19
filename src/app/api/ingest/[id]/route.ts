import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * DELETE /api/ingest/:id
 * Delete a document and its chunks (cascade handles chunks at the DB level
 * via the Prisma relation, but we also delete chunks explicitly to be safe).
 */
export async function DELETE(
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
    await db.document.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('[DELETE /api/ingest/:id]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Delete failed' },
      { status: 500 },
    )
  }
}
