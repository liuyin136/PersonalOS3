import { NextRequest, NextResponse } from 'next/server'
import { countTokens } from '@/lib/rag/rag'

interface CartItem {
  id: string
  cartItemId?: string
  documentId?: string
  documentTitle?: string
  chunkIndex?: number
  content: string
  tokenCount?: number
  sourceType?: string
  tags?: string[]
  addedAt?: string
  selected?: boolean
}

interface OptimizeBody {
  items?: CartItem[]
  itemIds?: string[]
  strategy?: 'none' | 'truncate' | 'summarize' | 'deduplicate' | 'reorder'
  targetTokens?: number
}

/**
 * POST /api/cart/optimize
 * Cart optimization. For 'truncate' strategy, drops items (lowest-token
 * first) until under targetTokens. All other strategies return items
 * unchanged but still report original/optimized token counts.
 *
 * In production this would call the LLM (summarize) or use embedding
 * similarity (deduplicate). The frontend just displays before/after.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as OptimizeBody
    const items = Array.isArray(body.items) ? body.items : []
    const strategy = body.strategy ?? 'none'
    const targetTokens =
      typeof body.targetTokens === 'number' && body.targetTokens > 0
        ? body.targetTokens
        : Math.floor(
            items.reduce((s, i) => s + (i.tokenCount ?? countTokens(i.content)), 0) * 0.7,
          )

    const originalTokens = items.reduce(
      (s, i) => s + (i.tokenCount ?? countTokens(i.content)),
      0,
    )

    let optimizedItems = items
    let removedCount = 0

    if (strategy === 'truncate') {
      // Drop items with the lowest token count first until under target
      const sorted = [...items].sort(
        (a, b) =>
          (a.tokenCount ?? countTokens(a.content)) -
          (b.tokenCount ?? countTokens(b.content)),
      )
      const dropped = new Set<string>()
      let running = originalTokens
      for (const it of sorted) {
        if (running <= targetTokens) break
        dropped.add(it.id)
        running -= it.tokenCount ?? countTokens(it.content)
      }
      optimizedItems = items.filter((i) => !dropped.has(i.id))
      removedCount = dropped.size
    } else if (strategy === 'deduplicate') {
      // Drop exact-duplicate content (by content hash)
      const seen = new Set<string>()
      const deduped: CartItem[] = []
      for (const it of items) {
        const key = it.content.trim().toLowerCase()
        if (seen.has(key)) {
          removedCount++
          continue
        }
        seen.add(key)
        deduped.push(it)
      }
      optimizedItems = deduped
    } else if (strategy === 'reorder') {
      // Keep highest-token items first (most information-dense first)
      optimizedItems = [...items].sort(
        (a, b) =>
          (b.tokenCount ?? countTokens(b.content)) -
          (a.tokenCount ?? countTokens(a.content)),
      )
    }
    // 'none' and 'summarize' fall through unchanged

    const optimizedTokens = optimizedItems.reduce(
      (s, i) => s + (i.tokenCount ?? countTokens(i.content)),
      0,
    )

    return NextResponse.json({
      items: optimizedItems,
      original_tokens: originalTokens,
      optimized_tokens: optimizedTokens,
      removed_count: removedCount,
    })
  } catch (e) {
    console.error('[POST /api/cart/optimize]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Optimization failed' },
      { status: 500 },
    )
  }
}
