import { NextRequest, NextResponse } from 'next/server'
import { countTokens } from '@/lib/rag/rag'

interface TokensBody {
  text?: string
}

/**
 * POST /api/cart/tokens
 * Count tokens for arbitrary text. Returns { token_count: number }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as TokensBody
    const text = typeof body.text === 'string' ? body.text : ''
    return NextResponse.json({ token_count: countTokens(text) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Token count failed' },
      { status: 500 },
    )
  }
}
