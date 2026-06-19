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
  chunkCount: number;
  tokenCount: number;
  markdownUri?: string;
  namespace: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  progress: number;
  errorMessage?: string;
}

export interface ChunkPreview {
  id: string;
  index: number;
  content: string;
  tokenCount: number;
  overlap: number;
}

export interface ChunkingConfig {
  strategy: 'fixed' | 'recursive' | 'semantic' | 'markdown';
  chunkSize: number;
  chunkOverlap: number;
}

export interface IngestRequest {
  title: string;
  sourceType: SourceType;
  sourceUri: string;
  namespace: string;
  tags: string[];
  chunking: ChunkingConfig;
  content?: string;
}

/* ------------------------------------------------------------------ */
/* Hybrid Search (Workflow 2) — parent-document reranked results      */
/* ------------------------------------------------------------------ */

export type SearchMode = 'hybrid' | 'vector' | 'keyword' | 'semantic';

export interface SearchQuery {
  query: string;
  mode: SearchMode;
  namespace: string;
  /** chunks fetched before parent rerank */
  topK: number;
  /** vector weight (0–1); keyword = 1 - alpha */
  alpha: number;
  /** metadata filters */
  filters?: SearchFilter;
  /** cross-encoder rerank of parents */
  rerank?: boolean;
  /** parents returned after rerank */
  rerankTop?: number;
}

export interface SearchFilter {
  tags?: string[];
  sourceTypes?: SourceType[];
  dateFrom?: string;
  dateTo?: string;
}

/** A single chunk hit with full score breakdown. */
export interface ChunkHit {
  id: string;
  chunkIndex: number;
  content: string;
  markdown: string;
  tokenCount: number;
  vectorScore: number;
  keywordScore: number;
  hybridScore: number;
}

/**
 * A parent Markdown document, reranked by aggregated chunk scores.
 * Each result carries its top contributing chunks.
 */
export interface ParentResult {
  documentId: string;
  documentTitle: string;
  sourceType: SourceType;
  namespace: string;
  tags: string[];
  /** aggregated weighted score */
  parentScore: number;
  /** how many top chunks belonged to this parent */
  contributingChunks: number;
  /** best chunks for this parent (max 3) */
  topChunks: ChunkHit[];
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  total: number;
  tookMs: number;
  results: ParentResult[];
}

export interface EditChunkRequest {
  id: string;
  content: string;
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
  cartItemId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sourceType: SourceType;
  tags: string[];
  addedAt: string;
  selected: boolean;
}

export interface CartSummary {
  itemCount: number;
  selectedCount: number;
  totalTokens: number;
  selectedTokens: number;
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
  contextItemIds?: string[];
  timestamp: string;
  tokenCount?: number;
  model?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  variables: PromptVariable[];
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
  stream: boolean;
  useContext: boolean;
}

/** Context item payload sent to the backend (from the cart store). */
export interface ContextItemPayload {
  id: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export interface ChatRequest {
  messages: { role: ChatRole; content: string; contextItemIds?: string[] }[];
  templateId?: string;
  variables: Record<string, string>;
  parameters: ChatParameters;
  contextItemIds: string[];
  contextItems: ContextItemPayload[];
}

export interface ChatStreamChunk {
  delta: string;
  messageId: string;
  done: boolean;
  tokenCount?: number;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Settings (model selection)                                         */
/* ------------------------------------------------------------------ */

export interface ModelSettings {
  chatModel: string;
  embeddingModel: string;
  rerankerModel: string;
  chatTemperature: number;
  chatMaxTokens: number;
  contextLimit: number;
}

export interface ModelOption {
  value: string;
  label: string;
  description: string;
}

export interface ModelCatalog {
  chatModels: ModelOption[];
  embeddingModels: ModelOption[];
  rerankerModels: ModelOption[];
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
  topTags: { tag: string; count: number }[];
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthComponent {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  detail?: string;
}

export interface HealthReport {
  status: HealthStatus;
  components: HealthComponent[];
}

/* ------------------------------------------------------------------ */
/* API envelope                                                       */
/* ------------------------------------------------------------------ */

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}
