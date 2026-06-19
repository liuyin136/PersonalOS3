import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapDoc } from '@/lib/rag/mappers'

/**
 * GET /api/ingest/documents
 * List all ingested documents joined with their namespace name.
 * Returns snake_case JSON array (matches the FastAPI backend contract).
 */
export async function GET() {
  try {
    const docs = await db.document.findMany({
      include: { namespace: true },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(docs.map(mapDoc))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list documents' },
      { status: 500 },
    )
  }
}
