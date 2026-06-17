/**
 * Chat API — Workflow 4: Template-based Structured Chat Flow
 * Endpoints: /api/chat, /api/chat/templates
 */
import { request, uid } from './client'
import type {
  PromptTemplate,
  ChatRequest,
  ChatMessage,
  ChatStreamChunk,
} from '@/types/rag'

/** Built-in prompt templates (also serve as mock backend response). */
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

export const chatApi = {
  /** List available prompt templates. */
  async listTemplates(): Promise<PromptTemplate[]> {
    return request<PromptTemplate[]>(
      '/chat/templates',
      { method: 'GET', mockDelay: 300 },
      () => [...builtinTemplates],
    )
  },

  /** Send a structured chat request (non-streaming). */
  async sendChat(payload: ChatRequest): Promise<ChatMessage> {
    return request<ChatMessage>(
      '/chat',
      { method: 'POST', body: payload, mockDelay: 1200 },
      () => ({
        id: uid('msg'),
        role: 'assistant',
        content:
          'This is a **mock assistant response** generated from the structured prompt template.\n\n- Context items used: ' +
          payload.contextItemIds.length +
          '\n- Template: `' +
          payload.templateId +
          '`\n- Temperature: ' +
          payload.parameters.temperature +
          '\n\n```\nready for backend wiring\n```',
        timestamp: new Date().toISOString(),
        tokenCount: 128,
        model: payload.parameters.model,
      }),
    )
  },

  /** Stream a chat response (mock generator). */
  async *streamChat(payload: ChatRequest): AsyncGenerator<ChatStreamChunk> {
    const messageId = uid('msg')
    const tokens = [
      'This ',
      'is a ',
      '**streamed** ',
      'mock ',
      'response ',
      'assembled ',
      'from ',
      `template \`${payload.templateId}\`.`,
      '\n\n- Context items: ' + payload.contextItemIds.length,
      '\n- Model: ' + payload.parameters.model,
      '\n\nReady for real backend wiring.',
    ]
    for (const t of tokens) {
      await new Promise((r) => setTimeout(r, 90))
      yield { delta: t, messageId, done: false }
    }
    yield { delta: '', messageId, done: true, tokenCount: 96 }
  },
}
