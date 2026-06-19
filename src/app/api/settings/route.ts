import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Ensure a Settings row with id=1 exists; create default if missing.
 * Returns the row.
 */
async function getOrCreateSettings() {
  const existing = await db.settings.findUnique({ where: { id: 1 } })
  if (existing) return existing
  return db.settings.create({ data: { id: 1 } })
}

/** Map a Prisma Settings row → snake_case JSON. */
function mapSettings(s: {
  id: number
  chatModel: string
  embeddingModel: string
  rerankerModel: string
  chatTemperature: number
  chatMaxTokens: number
  contextLimit: number
  updatedAt: Date
}) {
  return {
    chat_model: s.chatModel,
    embedding_model: s.embeddingModel,
    reranker_model: s.rerankerModel,
    chat_temperature: s.chatTemperature,
    chat_max_tokens: s.chatMaxTokens,
    context_limit: s.contextLimit,
    updated_at: s.updatedAt.toISOString(),
  }
}

/**
 * GET /api/settings
 * Read the Settings row (id=1), creating a default row if missing.
 */
export async function GET() {
  try {
    const s = await getOrCreateSettings()
    return NextResponse.json(mapSettings(s))
  } catch (e) {
    console.error('[GET /api/settings]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to read settings' },
      { status: 500 },
    )
  }
}

interface PutBody {
  chat_model?: string
  embedding_model?: string
  reranker_model?: string
  chat_temperature?: number
  chat_max_tokens?: number
  context_limit?: number
}

/**
 * PUT /api/settings
 * Update the Settings row (id=1).
 */
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as PutBody
    // Ensure the row exists
    await getOrCreateSettings()

    const updated = await db.settings.update({
      where: { id: 1 },
      data: {
        ...(body.chat_model !== undefined ? { chatModel: body.chat_model } : {}),
        ...(body.embedding_model !== undefined
          ? { embeddingModel: body.embedding_model }
          : {}),
        ...(body.reranker_model !== undefined
          ? { rerankerModel: body.reranker_model }
          : {}),
        ...(body.chat_temperature !== undefined
          ? { chatTemperature: body.chat_temperature }
          : {}),
        ...(body.chat_max_tokens !== undefined
          ? { chatMaxTokens: body.chat_max_tokens }
          : {}),
        ...(body.context_limit !== undefined
          ? { contextLimit: body.context_limit }
          : {}),
      },
    })
    return NextResponse.json(mapSettings(updated))
  } catch (e) {
    console.error('[PUT /api/settings]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update settings' },
      { status: 500 },
    )
  }
}
