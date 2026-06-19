/**
 * Chat API — Workflow 4: Template-based Structured Chat Flow
 * Endpoints: /chat, /chat/templates, /chat/stream (SSE)
 */
import { request, uid } from './client'
import type {
  PromptTemplate,
  ChatRequest,
  ChatMessage,
  ChatStreamChunk,
} from '@/types/rag'

/** Built-in templates (fallback if backend is unreachable). */
export const builtinTemplates: PromptTemplate[] = [
  {
    id: 'tpl_rag_qa',
    name: 'RAG Q&A',
    description: 'Answer user questions strictly using provided knowledge context.',
    systemPrompt:
      'You are a precise enterprise knowledge assistant. Answer ONLY using the provided context. If the context is insufficient, say you do not know. Cite sources by [doc:chunk] format.\n\nContext:\n{{context}}',
    userPrompt: 'Question: {{question}}',
    variables: [
      { key: 'question', label: 'Question', type: 'text', required: true },
    ],
    builtin: true,
  },
  {
    id: 'tpl_summarize',
    name: 'Document Summarizer',
    description: 'Produce a structured executive summary from selected chunks.',
    systemPrompt:
      'Summarize the following context into key points, risks, and action items. Use Markdown.\n\nContext:\n{{context}}',
    userPrompt: 'Focus area: {{focus}}',
    variables: [
      { key: 'focus', label: 'Focus area', type: 'text', defaultValue: 'overall' },
    ],
    builtin: true,
  },
  {
    id: 'tpl_compare',
    name: 'Comparison Matrix',
    description: 'Compare items from context in a Markdown table.',
    systemPrompt:
      'Build a comparison table from the context. Columns: feature, option A, option B. Be concise.\n\nContext:\n{{context}}',
    userPrompt: 'Compare: {{items}}',
    variables: [
      { key: 'items', label: 'Items to compare', type: 'text', required: true },
    ],
    builtin: true,
  },
  {
    id: 'tpl_extract',
    name: 'Entity Extraction',
    description: 'Extract structured entities (JSON) from context.',
    systemPrompt:
      'Extract entities from the context as valid JSON. Schema: { entities: [{ name, type, value }] }.\n\nContext:\n{{context}}',
    userPrompt: 'Extract entities related to: {{topic}}',
    variables: [
      { key: 'topic', label: 'Topic', type: 'text', required: true },
    ],
    builtin: true,
  },
]

function mapTemplate(t: Record<string, unknown>): PromptTemplate {
  return {
    id: String(t.id),
    name: String(t.name),
    description: String(t.description ?? ''),
    systemPrompt: String(t.system_prompt ?? t.systemPrompt ?? ''),
    userPrompt: String(t.user_prompt ?? t.userPrompt ?? ''),
    variables: ((t.variables as Record<string, unknown>[]) ?? []).map((v) => ({
      key: String(v.key),
      label: String(v.label),
      type: (v.type as 'text' | 'number' | 'select' | 'boolean') ?? 'text',
      defaultValue: v.default_value != null ? String(v.default_value) : v.defaultValue != null ? String(v.defaultValue) : undefined,
      options: v.options as string[] | undefined,
      required: Boolean(v.required),
    })),
    builtin: Boolean(t.builtin ?? true),
  }
}

export const chatApi = {
  /** List available prompt templates. */
  async listTemplates(): Promise<PromptTemplate[]> {
    try {
      const data = await request<Record<string, unknown>[]>('/api/chat/templates')
      const mapped = data.map(mapTemplate)
      return mapped.length ? mapped : builtinTemplates
    } catch {
      return builtinTemplates
    }
  },

  /** Send a structured chat request (non-streaming). */
  async sendChat(payload: ChatRequest): Promise<ChatMessage> {
    const data = await request<Record<string, unknown>>('/api/chat', {
      method: 'POST',
      body: payload,
    })
    return {
      id: String(data.id ?? uid('msg')),
      role: 'assistant',
      content: String(data.content ?? ''),
      timestamp: String(data.timestamp ?? new Date().toISOString()),
      tokenCount: data.token_count != null ? Number(data.token_count) : undefined,
      model: data.model != null ? String(data.model) : undefined,
    }
  },

  /** Stream a chat response via Server-Sent Events. */
  async *streamChat(payload: ChatRequest): AsyncGenerator<ChatStreamChunk> {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok || !res.body) {
      throw new Error(`stream failed: HTTP ${res.status}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const messageId = uid('msg')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const jsonStr = trimmed.slice(5).trim()
        if (!jsonStr) continue
        try {
          const obj = JSON.parse(jsonStr) as Record<string, unknown>
          if (obj.error) {
            yield { delta: '', messageId, done: true, error: String(obj.error) }
            return
          }
          yield {
            delta: String(obj.delta ?? ''),
            messageId: String(obj.messageId ?? messageId),
            done: Boolean(obj.done),
          }
        } catch {
          /* skip malformed line */
        }
      }
    }
  },
}
