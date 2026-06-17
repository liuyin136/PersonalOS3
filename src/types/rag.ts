/**
 * RAG Domain Types
 * Shared type definitions for the entire RAG knowledge platform.
 * These mirror the FastAPI + LangChain + pgvector + Redis backend contracts.
 */

/* ------------------------------------------------------------------ */
/* Knowledge Ingestion (Workflow 1)                                   */
/* ------------------------------------------------------------------ */

export type IngestStatus =
  | 'pending'
  | 'uploading'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'synced'
  | 'failed';

export type SourceType = 'pdf' | 'markdown' | 'txt' | 'html' | 'docx' | 'url' | 'confluence';

export interface KnowledgeDocument {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceUri: string;
  status: IngestStatus;
  /** Total chunk count after processing */
  chunkCount: number;
  /** Total token estimate */
  tokenCount: number;
  /** Markdown content stored in object storage */
  markdownUri?: string;
  /** pgvector collection / namespace */
  namespace: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** Detailed progress 0–100 */
  progress: number;
  errorMessage?: string;
}

export interface ChunkPreview {
  id: string;
  index: number;
  content: string;
  tokenCount: number;
  /** Embedding model used */
  embeddingModel: string;
  /** Overlap with previous chunk */
  overlap: number;
}

export interface ChunkingConfig {
  strategy: 'fixed' | 'recursive' | 'semantic' | 'markdown';
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
}

export interface IngestRequest {
  title: string;
  sourceType: SourceType;
  sourceUri: string;
  namespace: string;
  tags: string[];
  chunking: ChunkingConfig;
}

export interface SyncStatusEvent {
  documentId: string;
  status: IngestStatus;
  progress: number;
  message: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Hybrid Search (Workflow 2)                                         */
/* ------------------------------------------------------------------ */

export type SearchMode = 'hybrid' | 'vector' | 'keyword' | 'semantic';

export interface SearchQuery {
  query: string;
  mode: SearchMode;
  namespace: string;
  /** Top-K results */
  topK: number;
  /** Weight for vector similarity (0–1), keyword = 1 - alpha */
  alpha: number;
  /** Metadata filters */
  filters?: SearchFilter;
  /** Reranking enabled */
  rerank?: boolean;
}

export interface SearchFilter {
  tags?: string[];
  sourceTypes?: SourceType[];
  dateFrom?: string;
  dateTo?: string;
}

export interface SearchHit {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  /** Markdown rendered content */
  markdown: string;
  /** Vector similarity score 0–1 */
  vectorScore: number;
  /** BM25 / keyword score */
  keywordScore: number;
  /** Combined hybrid score */
  hybridScore: number;
  sourceType: SourceType;
  tags: string[];
  namespace: string;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  hits: SearchHit[];
  total: number;
  tookMs: number;
  query: string;
  mode: SearchMode;
}

export interface EditChunkRequest {
  id: string;
  content: string;
  /** Whether to re-embed after edit */
  reembed: boolean;
}

export interface EditChunkResponse {
  id: string;
  content: string;
  reembedded: boolean;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Memory Cart (Workflow 3)                                           */
/* ------------------------------------------------------------------ */

export interface CartItem {
  id: string;
  /** Local unique id for cart management */
  cartItemId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sourceType: SourceType;
  tags: string[];
  addedAt: string;
  /** Whether selected for prompt assembly */
  selected: boolean;
}

export interface CartSummary {
  itemCount: number;
  selectedCount: number;
  totalTokens: number;
  selectedTokens: number;
  /** Context window limit from backend config */
  contextLimit: number;
}

export type OptimizationStrategy =
  | 'none'
  | 'truncate'
  | 'summarize'
  | 'deduplicate'
  | 'reorder';

export interface CartOptimizeRequest {
  itemIds: string[];
  strategy: OptimizationStrategy;
  targetTokens?: number;
}

export interface CartOptimizeResponse {
  items: CartItem[];
  originalTokens: number;
  optimizedTokens: number;
  removedCount: number;
}

/* ------------------------------------------------------------------ */
/* Structured Chat (Workflow 4)                                       */
/* ------------------------------------------------------------------ */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Cart item ids attached as context */
  contextItemIds?: string[];
  timestamp: string;
  /** Token usage for this message */
  tokenCount?: number;
  /** Model that produced the message */
  model?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  /** System prompt template with {{variables}} */
  systemPrompt: string;
  /** User prompt template */
  userPrompt: string;
  /** Declared variables */
  variables: PromptVariable[];
  /** Built-in or custom */
  builtin: boolean;
}

export interface PromptVariable {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  defaultValue?: string;
  options?: string[];
  required?: boolean;
}

export interface ChatParameters {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  /** Whether to stream the response */
  stream: boolean;
  /** Whether to attach memory cart context */
  useContext: boolean;
}

export interface ChatRequest {
  messages: ChatMessage[];
  templateId: string;
  variables: Record<string, string>;
  parameters: ChatParameters;
  contextItemIds: string[];
}

export interface ChatStreamChunk {
  delta: string;
  messageId: string;
  done: boolean;
  tokenCount?: number;
}

/* ------------------------------------------------------------------ */
/* Knowledge Base (overview / management)                             */
/* ------------------------------------------------------------------ */

export interface KnowledgeNamespace {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  chunkCount: number;
  totalTokens: number;
  embeddingModel: string;
  createdAt: string;
}

export interface KnowledgeStats {
  totalDocuments: number;
  totalChunks: number;
  totalTokens: number;
  namespaces: number;
  recentIngests: KnowledgeDocument[];
  topTags: { tag: string; count: number }[];
}

/* ------------------------------------------------------------------ */
/* API envelope                                                       */
/* ------------------------------------------------------------------ */

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
