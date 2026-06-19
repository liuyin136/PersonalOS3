import { NextRequest, NextResponse } from 'next/server'
import { uid, countTokens } from '@/lib/sandbox/rag'

interface ChatRequestBody {
  messages: { role: string; content: string }[]
  templateId?: string
  variables?: Record<string, string>
  parameters?: {
    model?: string
    temperature?: number
    maxTokens?: number
    topP?: number
    stream?: boolean
    useContext?: boolean
  }
  contextItems?: {
    id: string
    documentTitle: string
    chunkIndex: number
    content: string
    tokenCount: number
  }[]
}

const TEMPLATE_NAMES: Record<string, string> = {
  tpl_rag_qa: 'RAG Q&A',
  tpl_summarize: 'Document Summarizer',
  tpl_compare: 'Comparison Matrix',
  tpl_extract: 'Entity Extraction',
}

/**
 * Build the mock assistant reply that describes what would be sent to the
 * real LLM. The frontend chat interface renders this as Markdown so it
 * should be Markdown-formatted to look natural.
 */
function buildMockReply(payload: ChatRequestBody): string {
  const tplName = payload.templateId
    ? TEMPLATE_NAMES[payload.templateId] ?? payload.templateId
    : 'No template'
  const model = payload.parameters?.model ?? 'qwen2.5-7b-instruct'
  const ctxCount = payload.contextItems?.length ?? 0
  const ctxTokens =
    payload.contextItems?.reduce((s, c) => s + (c.tokenCount || 0), 0) ?? 0
  const lastUser =
    [...(payload.messages ?? [])].reverse().find((m) => m.role === 'user')
      ?.content ?? ''
  const vars = payload.variables ?? {}

  const varLines = Object.keys(vars).length
    ? Object.entries(vars)
        .map(([k, v]) => `- **${k}**: ${v}`)
        .join('\n')
    : '_none_'

  const ctxLines = (payload.contextItems ?? [])
    .slice(0, 5)
    .map(
      (c, i) =>
        `${i + 1}. **${c.documentTitle}** · chunk #${c.chunkIndex} · ${c.tokenCount} tok`,
    )
    .join('\n')

  return [
    `> **Sandbox assistant** — no live LLM is configured in this preview. The message below shows what *would* be sent to the backend model and a mock structured response.`,
    ``,
    `### Request summary`,
    `- **Template**: ${tplName} (\`${payload.templateId ?? '—'}\`)`,
    `- **Model**: \`${model}\``,
    `- **Context items**: ${ctxCount} (${ctxTokens.toLocaleString()} tokens)`,
    `- **Last user message**: ${lastUser ? '_' + truncate(lastUser, 120) + '_' : '—'}`,
    ``,
    `### Template variables`,
    varLines,
    ``,
    `### Context attached`,
    ctxLines || '_no items in cart_',
    ``,
    `### Mock assistant response`,
    `Based on the ${ctxCount} context item${ctxCount === 1 ? '' : 's'} attached and the **${tplName}** template, here is a sandbox-generated answer:`,
    ``,
    `> The structured-chat pipeline successfully assembled a prompt of ~${ctxTokens + countTokens(lastUser)} tokens and would have streamed a real answer from \`${model}\` at temperature ${payload.parameters?.temperature ?? 0.3}. To enable real completions, set \`OPENAI_API_BASE\` / \`OPENAI_API_KEY\` and deploy the FastAPI backend.`,
    ``,
    `_(Sandbox response · id \`${uid('msg')}\`)_`,
  ].join('\n')
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + '…'
}

/**
 * POST /api/chat
 * Non-streaming chat. Builds a mock assistant reply describing the
 * assembled prompt (no live LLM in sandbox).
 */
export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as ChatRequestBody
    const content = buildMockReply(payload)
    const msgId = uid('msg')
    return NextResponse.json({
      id: msgId,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      token_count: countTokens(content),
      model: payload.parameters?.model ?? 'qwen2.5-7b-instruct',
    })
  } catch (e) {
    console.error('[POST /api/chat]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Chat failed' },
      { status: 500 },
    )
  }
}
