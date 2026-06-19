import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chunkText, embed } from '@/lib/sandbox/rag'
import { mapDoc } from '@/lib/sandbox/mappers'

/** Sample markdown documents for the seed endpoint. */
const SAMPLE_DOCS: {
  title: string
  sourceType: string
  sourceUri: string
  namespace: string
  tags: string[]
  chunking: { strategy: 'markdown'; chunk_size: 600; chunk_overlap: 100 }
  content: string
}[] = [
  {
    title: 'RAG Architecture Overview',
    sourceType: 'markdown',
    sourceUri: 'docs/rag-architecture.md',
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
    sourceType: 'markdown',
    sourceUri: 'docs/chunking-strategies.md',
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
    sourceType: 'markdown',
    sourceUri: 'docs/prompt-engineering.md',
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
 * Seed 2-3 sample markdown documents into the 'engineering' namespace.
 * Idempotent: skips documents whose title already exists.
 */
export async function POST() {
  try {
    const created: Record<string, unknown>[] = []

    for (const sd of SAMPLE_DOCS) {
      const existing = await db.document.findFirst({
        where: { title: sd.title },
      })
      if (existing) {
        created.push({ skipped: sd.title, reason: 'already exists' })
        continue
      }

      const namespace = await db.namespace.upsert({
        where: { name: sd.namespace },
        update: {},
        create: {
          name: sd.namespace,
          description: 'Engineering knowledge base (seeded)',
        },
      })

      const doc = await db.document.create({
        data: {
          title: sd.title,
          sourceType: sd.sourceType,
          sourceUri: sd.sourceUri,
          namespaceId: namespace.id,
          tags: JSON.stringify(sd.tags),
          markdownPath: sd.content,
          status: 'chunking',
          progress: 10,
          metadata: JSON.stringify({ chunking: sd.chunking }),
        },
        include: { namespace: true },
      })

      const chunks = chunkText(sd.content, {
        strategy: sd.chunking.strategy,
        chunkSize: sd.chunking.chunk_size,
        chunkOverlap: sd.chunking.chunk_overlap,
      })

      if (chunks.length > 0) {
        await db.chunk.createMany({
          data: chunks.map((c) => ({
            documentId: doc.id,
            namespaceId: namespace.id,
            chunkIndex: c.index,
            content: c.content,
            tokenCount: c.tokenCount,
            embedding: JSON.stringify(embed(c.content)),
          })),
        })
      }

      const totalTokens = chunks.reduce((s, c) => s + c.tokenCount, 0)
      const updated = await db.document.update({
        where: { id: doc.id },
        data: {
          status: 'synced',
          progress: 100,
          chunkCount: chunks.length,
          tokenCount: totalTokens,
        },
        include: { namespace: true },
      })

      created.push(mapDoc(updated))
    }

    return NextResponse.json({ seeded: created.length, documents: created })
  } catch (e) {
    console.error('[POST /api/seed]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Seed failed' },
      { status: 500 },
    )
  }
}
