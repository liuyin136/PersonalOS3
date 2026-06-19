/**
 * Local RAG utilities — pure JS implementations of the FastAPI backend
 * primitives used by the Next.js API routes (Prisma + SQLite + JS cosine).
 *
 * - countTokens: simple length/4 heuristic (no tiktoken)
 * - chunkText:   recursive markdown-aware splitter with overlap
 * - embed:       deterministic hash-based Float32Array(384), L2-normalized
 * - cosineSim:   cosine similarity between two vectors
 *
 * The hash-based embedder is NOT a real semantic model, but it has two
 * nice properties that make retrieval work:
 *   1. Deterministic: same text → same vector (stable, reproducible).
 *   2. Overlap-aware:  text sharing many token hashes → higher cosine.
 * That's enough to produce meaningful ordering for hybrid retrieval.
 *
 * In production (docker compose), the FastAPI backend replaces these
 * routes with real sentence-transformers embeddings + pgvector HNSW.
 */

export const EMBEDDING_DIM = 384

/** Tiny id generator. */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

/** Heuristic token count (no tiktoken on the client). */
export function countTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/* ------------------------------------------------------------------ */
/* Hashing                                                             */
/* ------------------------------------------------------------------ */

/** FNV-1a 32-bit hash — fast, deterministic, no deps. */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Tokenize text into lowercase alphanumeric words. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/* ------------------------------------------------------------------ */
/* Embedding                                                           */
/* ------------------------------------------------------------------ */

/**
 * Deterministic hash-based embedding (hashing trick).
 * Tokenize → hash each token into one of EMBEDDING_DIM buckets →
 * accumulate +1/-1 → L2-normalize. Text sharing many tokens produces
 * positively-correlated vectors, so cosine similarity reflects lexical
 * overlap.
 */
export function embed(text: string): number[] {
  const vec = new Float32Array(EMBEDDING_DIM)
  const tokens = tokenize(text)
  for (const tok of tokens) {
    const h = fnv1a(tok)
    const idx = h % EMBEDDING_DIM
    const sign = (h >>> 16) & 1 ? 1 : -1
    vec[idx] += sign
  }
  let norm = 0
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm
  }
  return Array.from(vec)
}

/** Cosine similarity between two vectors. */
export function cosineSim(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0
  const len = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/* ------------------------------------------------------------------ */
/* Chunking                                                            */
/* ------------------------------------------------------------------ */

export interface ChunkingConfig {
  strategy: 'fixed' | 'recursive' | 'semantic' | 'markdown'
  chunkSize: number
  chunkOverlap: number
}

export interface ChunkResult {
  index: number
  content: string
  tokenCount: number
  overlap: number
}

/**
 * Recursive markdown-aware text splitter.
 *
 * `markdown` splits on `\n## ` (H2) then `\n\n`. `recursive` splits on
 * `\n\n` then sentences. `fixed`/`semantic` chunk on word count.
 * Fragments are greedily merged up to `chunkSize` tokens; the next
 * chunk starts with `chunkOverlap` tokens from the previous tail.
 */
export function chunkText(
  text: string,
  config: ChunkingConfig,
): ChunkResult[] {
  const cleanText = text ?? ''
  if (!cleanText.trim()) return []

  const { strategy, chunkSize, chunkOverlap } = config
  const size = Math.max(50, chunkSize)
  const overlap = Math.max(0, Math.min(chunkOverlap, size - 1))

  const fragments: string[] = []
  if (strategy === 'markdown') {
    const sections = cleanText.split(/(?=\n#{1,3}\s)/)
    for (const sec of sections) {
      if (!sec.trim()) continue
      for (const para of sec.split(/\n\n+/)) {
        if (para.trim()) fragments.push(para.trim())
      }
    }
  } else if (strategy === 'recursive') {
    for (const para of cleanText.split(/\n\n+/)) {
      if (!para.trim()) continue
      const sentences = para
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
      fragments.push(...sentences)
    }
  } else {
    const words = cleanText.split(/\s+/).filter(Boolean)
    const wordsPerChunk = Math.max(1, size * 4)
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      fragments.push(words.slice(i, i + wordsPerChunk).join(' '))
    }
  }

  if (fragments.length === 0) {
    fragments.push(cleanText.trim())
  }

  const chunks: string[] = []
  let current = ''
  let currentTokens = 0

  for (const frag of fragments) {
    const fragTokens = countTokens(frag)
    if (currentTokens + fragTokens > size && current) {
      chunks.push(current.trim())
      if (overlap > 0) {
        const tailTokens: string[] = []
        let tailCount = 0
        const words = current.split(/\s+/).filter(Boolean)
        for (let i = words.length - 1; i >= 0 && tailCount < overlap; i--) {
          tailTokens.unshift(words[i])
          tailCount = countTokens(tailTokens.join(' '))
        }
        current = tailTokens.join(' ') + ' ' + frag
        currentTokens = countTokens(current)
      } else {
        current = frag
        currentTokens = fragTokens
      }
    } else {
      current = current ? current + '\n\n' + frag : frag
      currentTokens = countTokens(current)
    }
  }
  if (current.trim()) chunks.push(current.trim())

  const finalChunks: string[] = []
  for (const ch of chunks) {
    const tk = countTokens(ch)
    if (tk <= size * 1.5) {
      finalChunks.push(ch)
      continue
    }
    const charBudget = size * 4
    const overlapChars = overlap * 4
    for (let i = 0; i < ch.length; i += charBudget - overlapChars) {
      const slice = ch.slice(i, i + charBudget)
      if (slice.trim()) finalChunks.push(slice.trim())
      if (i + charBudget >= ch.length) break
    }
  }

  return finalChunks.map((content, index) => ({
    index,
    content,
    tokenCount: countTokens(content),
    overlap: index === 0 ? 0 : overlap,
  }))
}

/* ------------------------------------------------------------------ */
/* Keyword scoring                                                     */
/* ------------------------------------------------------------------ */

/**
 * Lexical overlap score normalized to [0, 1].
 * Counts how many unique query terms appear in the chunk, divided by
 * the number of unique query terms. Empty queries → 0.
 */
export function keywordScore(query: string, content: string): number {
  const qTerms = new Set(tokenize(query))
  if (qTerms.size === 0) return 0
  const cTokens = new Set(tokenize(content))
  let hits = 0
  for (const t of qTerms) if (cTokens.has(t)) hits++
  return hits / qTerms.size
}
