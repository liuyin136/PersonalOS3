import { NextResponse } from 'next/server'

/**
 * Built-in prompt templates. Mirrors the FastAPI templates.py and the
 * frontend `builtinTemplates` in `src/lib/api/chat.ts`. Returned in
 * snake_case so the frontend `mapTemplate` works without changes.
 */
const BUILTIN_TEMPLATES = [
  {
    id: 'tpl_rag_qa',
    name: 'RAG Q&A',
    description: 'Answer user questions strictly using provided knowledge context.',
    system_prompt:
      'You are a precise enterprise knowledge assistant. Answer ONLY using the provided context. If the context is insufficient, say you do not know. Cite sources by [doc:chunk] format.\n\nContext:\n{{context}}',
    user_prompt: 'Question: {{question}}',
    variables: [
      { key: 'question', label: 'Question', type: 'text', required: true },
    ],
    builtin: true,
  },
  {
    id: 'tpl_summarize',
    name: 'Document Summarizer',
    description: 'Produce a structured executive summary from selected chunks.',
    system_prompt:
      'Summarize the following context into key points, risks, and action items. Use Markdown.\n\nContext:\n{{context}}',
    user_prompt: 'Focus area: {{focus}}',
    variables: [
      {
        key: 'focus',
        label: 'Focus area',
        type: 'text',
        default_value: 'overall',
      },
    ],
    builtin: true,
  },
  {
    id: 'tpl_compare',
    name: 'Comparison Matrix',
    description: 'Compare items from context in a Markdown table.',
    system_prompt:
      'Build a comparison table from the context. Columns: feature, option A, option B. Be concise.\n\nContext:\n{{context}}',
    user_prompt: 'Compare: {{items}}',
    variables: [
      { key: 'items', label: 'Items to compare', type: 'text', required: true },
    ],
    builtin: true,
  },
  {
    id: 'tpl_extract',
    name: 'Entity Extraction',
    description: 'Extract structured entities (JSON) from context.',
    system_prompt:
      'Extract entities from the context as valid JSON. Schema: { entities: [{ name, type, value }] }.\n\nContext:\n{{context}}',
    user_prompt: 'Extract entities related to: {{topic}}',
    variables: [
      { key: 'topic', label: 'Topic', type: 'text', required: true },
    ],
    builtin: true,
  },
]

/**
 * GET /api/chat/templates
 * Return built-in templates in snake_case (no DB storage needed).
 */
export async function GET() {
  try {
    return NextResponse.json(BUILTIN_TEMPLATES)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list templates' },
      { status: 500 },
    )
  }
}
