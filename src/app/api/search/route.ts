import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  embed,
  cosineSim,
  keywordScore,
  tokenize,
} from '@/lib/sandbox/rag'
import { safeParseArray } from '@/lib/sandbox/mappers'

interface SearchBody {
  query: string
  mode?: 'hybrid' | 'vector' | 'keyword' | 'semantic'
  namespace?: string
  top_k?: number
  alpha?: number
  rerank?: boolean
  rerank_top?: number
  filters?: {
    tags?: string[]
    sourceTypes?: string[]
    dateFrom?: string
    dateTo?: string
  }
}

interface ScoredChunk {
  chunkId: string
  documentId: string
  documentTitle: string
  sourceType: string
  namespace: string
  tags: string[]
  chunkIndex: number
  content: string
  tokenCount: number
  vectorScore: number
  keywordScore: number
  hybridScore: number
}

/**
 * POST /api/search
 * Hybrid retrieval with parent-document reranking, mirroring the FastAPI
 * search service. Returns ParentResult[] in snake_case.
 */
export async function POST(req: NextRequest) {
  const start = performance.now()
  try {
    const body = (await req.json()) as SearchBody
    const query = body.query ?? ''
    const mode = body.mode ?? 'hybrid'
    const topK = Math.max(1, Math.min(50, body.top_k ?? 10))
    const alpha =
      mode === 'vector' ? 1 : mode === 'keyword' ? 0 : Math.min(1, Math.max(0, body.alpha ?? 0.5))
    const rerankTop = Math.max(1, Math.min(50, body.rerank_top ?? 10))

    if (!query.trim()) {
      return NextResponse.json({
        query,
        mode,
        total: 0,
        took_ms: Math.round(performance.now() - start),
        results: [],
      })
    }

    // Fetch candidate chunks (optionally filtered by namespace + filters)
    const where: {
      namespace?: { name: string }
      document?: {
        sourceType?: { in: string[] }
        tags?: { contains: string }
      }
    } = {}

    if (body.namespace && body.namespace !== 'all') {
      where.namespace = { name: body.namespace }
    }
    if (body.filters?.sourceTypes?.length) {
      where.document = {
        ...(where.document ?? {}),
        sourceType: { in: body.filters.sourceTypes },
      }
    }
    // Tag filter: simple substring match on the JSON string column
    if (body.filters?.tags?.length) {
      where.document = {
        ...(where.document ?? {}),
        tags: { contains: body.filters.tags[0] },
      }
    }

    const chunks = await db.chunk.findMany({
      where,
      include: {
        document: { include: { namespace: true } },
      },
      take: 2000, // sandbox cap
    })

    if (chunks.length === 0) {
      return NextResponse.json({
        query,
        mode,
        total: 0,
        took_ms: Math.round(performance.now() - start),
        results: [],
      })
    }

    // Compute query vector once
    const qVec = embed(query)
    const qTokens = new Set(tokenize(query))

    // Score every chunk
    const scored: ScoredChunk[] = chunks.map((c) => {
      const chunkVec = safeParseArray<number>(c.embedding)
      const vScore = chunkVec.length ? cosineSim(qVec, chunkVec) : 0
      const kScore = keywordScore(query, c.content)
      const hybrid = alpha * vScore + (1 - alpha) * kScore
      return {
        chunkId: c.id,
        documentId: c.documentId,
        documentTitle: c.document.title,
        sourceType: c.document.sourceType,
        namespace: c.document.namespace.name,
        tags: safeParseArray<string>(c.document.tags),
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: c.tokenCount,
        vectorScore: vScore,
        keywordScore: kScore,
        hybridScore: hybrid,
      }
    })

    // Sort by hybrid score desc, take top_k
    scored.sort((a, b) => b.hybridScore - a.hybridScore)
    const topChunks = scored.slice(0, topK)

    // Group by parent document with rank-decay weighting
    // Top chunk weight 1.0, next 0.6, next 0.36, ... (geometric 0.6)
    // Normalize by count capped at 3.
    const byParent = new Map<string, ScoredChunk[]>()
    for (const sc of topChunks) {
      const arr = byParent.get(sc.documentId) ?? []
      arr.push(sc)
      byParent.set(sc.documentId, arr)
    }

    const parentResults = Array.from(byParent.entries()).map(
      ([docId, arr]) => {
        let weightedSum = 0
        let weight = 1
        const cap = Math.min(arr.length, 3)
        for (let i = 0; i < arr.length; i++) {
          if (i < cap) weightedSum += arr[i].hybridScore * weight
          weight *= 0.6
        }
        const parentScore = weightedSum / Math.min(arr.length, 3)
        const top3 = arr.slice(0, 3)
        return {
          document_id: docId,
          document_title: arr[0].documentTitle,
          source_type: arr[0].sourceType,
          namespace: arr[0].namespace,
          tags: arr[0].tags,
          parent_score: parentScore,
          contributing_chunks: arr.length,
          top_chunks: top3.map((c) => ({
            id: c.chunkId,
            chunk_index: c.chunkIndex,
            content: c.content,
            markdown: c.content,
            token_count: c.tokenCount,
            vector_score: c.vectorScore,
            keyword_score: c.keywordScore,
            hybrid_score: c.hybridScore,
          })),
        }
      },
    )

    // Sort parents by parent_score desc; cap to rerank_top
    parentResults.sort((a, b) => b.parent_score - a.parent_score)
    const finalResults = parentResults.slice(0, rerankTop)

    void body.rerank // sandbox: rerank is implicit (we already reranked by parent score)

    return NextResponse.json({
      query,
      mode,
      total: finalResults.length,
      took_ms: Math.round(performance.now() - start),
      results: finalResults,
    })
  } catch (e) {
    console.error('[POST /api/search]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Search failed' },
      { status: 500 },
    )
  }
}
