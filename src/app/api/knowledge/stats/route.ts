import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { safeParseArray } from '@/lib/sandbox/mappers'

/**
 * GET /api/knowledge/stats
 * Global totals (documents / chunks / tokens / namespaces) + top tags.
 * Tags are stored as JSON-string arrays on Document.tags; we parse and
 * count them in JS (no JSONB aggregation in SQLite).
 */
export async function GET() {
  try {
    const [totalDocuments, totalChunks, namespaces, docs] = await Promise.all([
      db.document.count(),
      db.chunk.count(),
      db.namespace.count(),
      db.document.findMany({ select: { tags: true, tokenCount: true } }),
    ])

    const totalTokens = docs.reduce((s, d) => s + d.tokenCount, 0)

    // Tag frequency
    const tagCounts = new Map<string, number>()
    for (const d of docs) {
      const tags = safeParseArray<string>(d.tags)
      for (const t of tags) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
      }
    }
    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return NextResponse.json({
      total_documents: totalDocuments,
      total_chunks: totalChunks,
      total_tokens: totalTokens,
      namespaces,
      top_tags: topTags,
    })
  } catch (e) {
    console.error('[GET /api/knowledge/stats]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to read stats' },
      { status: 500 },
    )
  }
}
