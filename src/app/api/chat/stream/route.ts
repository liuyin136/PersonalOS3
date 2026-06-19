import { NextRequest } from 'next/server'
import { uid, countTokens } from '@/lib/rag/rag'

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
    `> **Local assistant** — no live LLM endpoint is configured. The message below shows what *would* be sent to the backend model and a structured mock response.`,
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
    `Based on the ${ctxCount} context item${ctxCount === 1 ? '' : 's'} attached and the **${tplName}** template, here is a generated answer:`,
    ``,
    `> The structured-chat pipeline successfully assembled a prompt of ~${ctxTokens + countTokens(lastUser)} tokens and would have streamed a real answer from \`${model}\` at temperature ${payload.parameters?.temperature ?? 0.3}. To enable real completions, set \`OPENAI_API_BASE\` / \`OPENAI_API_KEY\` and deploy the FastAPI backend.`,
    ``,
    `_(Local response · id \`${uid('msg')}\`)_`,
  ].join('\n')
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + '…'
}

/**
 * POST /api/chat/stream
 * SSE stream of the mock assistant reply. Splits the reply into words
 * (preserving whitespace via a simple regex split) and yields each as a
 * `data: {delta, messageId, done}\n\n` event with ~80ms delay. Final
 * event has `done: true` and empty delta.
 *
 * Uses `ReadableStream` + `TextEncoder` so it works on the Edge runtime.
 */
export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => ({}))) as ChatRequestBody
  const fullText = buildMockReply(payload)
  const messageId = uid('msg')

  // Split on whitespace boundaries while keeping the separators.
  const tokens = fullText.match(/\S+\s*|\s+/g) ?? [fullText]

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        for (const tok of tokens) {
          send({ delta: tok, messageId, done: false })
          // ~80ms per token to simulate token streaming
          await new Promise((r) => setTimeout(r, 80))
        }
        send({ delta: '', messageId, done: true })
      } catch (e) {
        send({
          error: e instanceof Error ? e.message : 'stream interrupted',
          messageId,
          done: true,
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
