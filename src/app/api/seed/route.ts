import { NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** Sample markdown documents for first-time setup. */
const SAMPLE_DOCS: {
  title: string
  source_type: string
  source_uri: string
  namespace: string
  tags: string[]
  chunking: { strategy: string; chunk_size: number; chunk_overlap: number }
  content: string
}[] = [
  {
    title: 'RAG Architecture Overview',
    source_type: 'markdown',
    source_uri: 'docs/rag-architecture.md',
    namespace: 'engineering',
    tags: ['rag', 'architecture', 'retrieval'],
    chunking: { strategy: 'markdown', chunk_size: 600, chunk_overlap: 100 },
    content: `# RAG Architecture Overview

Retrieval-Augmented Generation (RAG) combines a retrieval system with a generative language model. The retriever surfaces relevant context from a knowledge base, and the generator produces an answer grounded in that context.

## Core components

A typical RAG pipeline has three components: the indexer, the retriever, and the generator. The indexer splits documents into chunks, embeds them, and stores the vectors. The retriever performs hybrid search over those vectors. The generator consumes the top-k chunks plus the user query and produces a final answer.

## Hybrid retrieval

Hybrid retrieval blends vector similarity and keyword overlap. Vector search captures semantic similarity, while keyword search (BM25-style) catches exact matches. A weight parameter alpha controls the balance between the two signals.

## Parent-document reranking

In parent-document reranking, chunks are scored individually, then aggregated per parent document. The top chunks belonging to a parent contribute to its overall score, weighted by rank-decay. This surfaces documents that have multiple relevant passages.`,
  },
  {
    title: 'Chunking Strategies',
    source_type: 'markdown',
    source_uri: 'docs/chunking-strategies.md',
    namespace: 'engineering',
    tags: ['rag', 'chunking', 'embeddings'],
    chunking: { strategy: 'markdown', chunk_size: 600, chunk_overlap: 100 },
    content: `# Chunking Strategies

Choosing the right chunking strategy is critical for retrieval quality. Too-small chunks lose context; too-large chunks dilute relevance.

## Fixed-size chunking

Fixed-size chunking splits text into chunks of a fixed token budget (e.g. 512 tokens). Simple but can cut sentences in half.

## Recursive chunking

Recursive chunking splits on hierarchical separators: paragraphs first, then sentences, then words. It preserves natural boundaries while respecting the token budget.

## Markdown-aware chunking

Markdown-aware chunking splits on headers (H1, H2, H3) before falling back to paragraphs. This keeps section context intact, which is ideal for technical docs.

## Semantic chunking

Semantic chunking groups adjacent sentences by embedding similarity. Boundaries form wherever similarity drops sharply. More expensive but produces coherent chunks.`,
  },
  {
    title: 'Prompt Engineering Best Practices',
    source_type: 'markdown',
    source_uri: 'docs/prompt-engineering.md',
    namespace: 'engineering',
    tags: ['llm', 'prompt', 'best-practices'],
    chunking: { strategy: 'markdown', chunk_size: 600, chunk_overlap: 100 },
    content: `# Prompt Engineering Best Practices

Effective prompts are specific, structured, and grounded in context. The RAG workflow benefits from templates that separate system instructions from user input and context.

## Use system prompts

System prompts set the model's role and constraints. For RAG, the system prompt should instruct the model to answer only from the provided context and to cite sources.

## Provide context explicitly

Inject retrieved chunks directly into the prompt. Mark the context clearly so the model knows where it begins and ends. The {{context}} variable is the standard placeholder.

## Variables over free-form input

Templates with named variables (e.g. {{question}}, {{focus}}) produce more deterministic outputs than free-form text. The frontend collects variable values via structured inputs.

## Temperature and sampling

Lower temperature (0.2-0.4) produces focused, factual answers — ideal for RAG Q&A. Higher temperature (0.7+) is better for creative tasks like summarization or comparison.`,
  },
]

/**
 * POST /api/seed
 * Seed 3 sample markdown documents by calling the backend ingest endpoint.
 * Idempotent: the backend creates or skips based on existing titles.
 */
export async function POST() {
  try {
    const results: Record<string, unknown>[] = []

    // Fetch existing docs to skip duplicates
    const existingRes = await proxyToBackend('/ingest/documents')
    let existingTitles: string[] = []
    if (existingRes.ok) {
      const existing = await existingRes.json()
      existingTitles = (existing as { title: string }[]).map((d) => d.title)
    }

    for (const sd of SAMPLE_DOCS) {
      if (existingTitles.includes(sd.title)) {
        results.push({ skipped: sd.title, reason: 'already exists' })
        continue
      }

      const res = await proxyToBackend('/ingest', undefined, {
        method: 'POST',
        body: JSON.stringify(sd),
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        const doc = await res.json()
        results.push(doc)
      } else {
        results.push({ error: sd.title, reason: `HTTP ${res.status}` })
      }
    }

    return NextResponse.json({ seeded: results.length, documents: results })
  } catch (e) {
    console.error('[POST /api/seed]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Seed failed' },
      { status: 500 },
    )
  }
}
