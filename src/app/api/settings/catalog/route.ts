import { NextResponse } from 'next/server'

/** Model catalog — mirrors /backend/app/routers/settings.py. */
const CATALOG = {
  chat_models: [
    {
      value: 'qwen2.5-7b-instruct',
      label: 'Qwen2.5 7B Instruct',
      description: 'Balanced general-purpose chat model (~7B params).',
    },
    {
      value: 'qwen2.5-14b-instruct',
      label: 'Qwen2.5 14B Instruct',
      description: 'Higher quality chat model (~14B params).',
    },
    {
      value: 'deepseek-r1',
      label: 'DeepSeek R1',
      description: 'Reasoning-focused model with chain-of-thought.',
    },
    {
      value: 'llama-3.1-8b-instruct',
      label: 'Llama 3.1 8B Instruct',
      description: 'Meta Llama 3.1 instruct-tuned.',
    },
    {
      value: 'mistral-7b-instruct',
      label: 'Mistral 7B Instruct',
      description: 'Mistral instruct-tuned model.',
    },
    {
      value: 'gemma-2-9b-it',
      label: 'Gemma 2 9B IT',
      description: 'Google Gemma 2 instruct-tuned.',
    },
  ],
  embedding_models: [
    {
      value: 'bge-small-en-v1.5',
      label: 'BGE small-en v1.5',
      description: '384-dim English embedding (~130MB).',
    },
    {
      value: 'bge-base-en-v1.5',
      label: 'BGE base-en v1.5',
      description: '768-dim English embedding (~420MB).',
    },
    {
      value: 'bge-large-en-v1.5',
      label: 'BGE large-en v1.5',
      description: '1024-dim English embedding (~1.3GB).',
    },
    {
      value: 'bge-m3',
      label: 'BGE M3',
      description: 'Multi-lingual, multi-granularity embedding.',
    },
    {
      value: 'e5-small-v2',
      label: 'E5 small v2',
      description: 'Microsoft E5 small embedding.',
    },
    {
      value: 'gte-small',
      label: 'GTE small',
      description: 'Alibaba GTE small embedding.',
    },
  ],
  reranker_models: [
    {
      value: 'bge-reranker-base',
      label: 'BGE Reranker Base',
      description: 'Cross-encoder reranker (~420MB).',
    },
    {
      value: 'bge-reranker-large',
      label: 'BGE Reranker Large',
      description: 'Larger cross-encoder reranker (~1.3GB).',
    },
    {
      value: 'bge-reranker-v2-m3',
      label: 'BGE Reranker v2 M3',
      description: 'Multi-lingual reranker.',
    },
    {
      value: 'ms-marco-MiniLM-L-12-v2',
      label: 'MS MARCO MiniLM L12 v2',
      description: 'Microsoft cross-encoder reranker.',
    },
  ],
}

/** GET /api/settings/catalog */
export async function GET() {
  return NextResponse.json(CATALOG)
}
