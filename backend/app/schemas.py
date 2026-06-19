"""Pydantic request/response schemas for all API contracts."""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ------------------------------------------------------------------
# Shared
# ------------------------------------------------------------------
SourceType = Literal["pdf", "markdown", "txt", "html", "docx", "url", "confluence"]
SearchMode = Literal["hybrid", "vector", "keyword", "semantic"]


# ------------------------------------------------------------------
# Ingest
# ------------------------------------------------------------------
class ChunkingConfig(BaseModel):
    strategy: Literal["fixed", "recursive", "semantic", "markdown"] = "recursive"
    chunk_size: int = Field(512, ge=64, le=4096)
    chunk_overlap: int = Field(50, ge=0, le=512)


class IngestRequest(BaseModel):
    title: str
    source_type: SourceType = "markdown"
    source_uri: str
    namespace: str = "default"
    tags: List[str] = Field(default_factory=list)
    chunking: ChunkingConfig = Field(default_factory=ChunkingConfig)
    content: Optional[str] = None  # raw markdown text (if not a file upload)


class ChunkPreview(BaseModel):
    id: str
    index: int
    content: str
    token_count: int
    overlap: int


class DocumentOut(BaseModel):
    id: str
    title: str
    source_type: SourceType
    source_uri: str
    status: str
    progress: int
    chunk_count: int
    token_count: int
    namespace: str
    tags: List[str]
    markdown_uri: Optional[str] = None
    created_at: str
    updated_at: str
    error_message: Optional[str] = None


# ------------------------------------------------------------------
# Search — parent-document reranked results
# ------------------------------------------------------------------
class ChunkHit(BaseModel):
    id: str
    chunk_index: int
    content: str
    markdown: str
    token_count: int
    vector_score: float
    keyword_score: float
    hybrid_score: float


class ParentResult(BaseModel):
    """A parent Markdown document, reranked by aggregated chunk scores."""
    document_id: str
    document_title: str
    source_type: SourceType
    namespace: str
    tags: List[str]
    parent_score: float           # aggregated weighted score
    contributing_chunks: int      # how many top chunks belonged to this parent
    top_chunks: List[ChunkHit]    # best chunks for this parent (max 3)


class SearchQuery(BaseModel):
    query: str
    mode: SearchMode = "hybrid"
    namespace: str = "default"
    top_k: int = Field(20, ge=1, le=100, description="chunks fetched before parent rerank")
    alpha: float = Field(0.5, ge=0.0, le=1.0, description="vector weight; keyword = 1 - alpha")
    rerank: bool = True
    rerank_top: int = Field(10, ge=1, le=50, description="parents returned after rerank")
    filters: Optional["SearchFilter"] = None


class SearchFilter(BaseModel):
    tags: Optional[List[str]] = None
    source_types: Optional[List[SourceType]] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    mode: SearchMode
    total: int
    took_ms: int
    results: List[ParentResult]


class EditChunkRequest(BaseModel):
    id: str
    content: str
    reembed: bool = True


class EditChunkResponse(BaseModel):
    id: str
    content: str
    reembedded: bool
    updated_at: str


# ------------------------------------------------------------------
# Settings (model selection)
# ------------------------------------------------------------------
class ModelSettings(BaseModel):
    chat_model: str = "qwen2.5-7b-instruct"
    embedding_model: str = "bge-small-en-v1.5"
    reranker_model: str = "bge-reranker-base"
    chat_temperature: float = 0.3
    chat_max_tokens: int = 2048
    context_limit: int = 128000


class ModelOption(BaseModel):
    value: str
    label: str
    description: str = ""


class ModelCatalog(BaseModel):
    chat_models: List[ModelOption]
    embedding_models: List[ModelOption]
    reranker_models: List[ModelOption]


# ------------------------------------------------------------------
# Chat
# ------------------------------------------------------------------
class PromptVariable(BaseModel):
    key: str
    label: str
    type: Literal["text", "number", "select", "boolean"] = "text"
    default_value: Optional[str] = None
    options: Optional[List[str]] = None
    required: bool = False


class PromptTemplate(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    user_prompt: str
    variables: List[PromptVariable]
    builtin: bool = True


class ChatParameters(BaseModel):
    model: str = "qwen2.5-7b-instruct"
    temperature: float = 0.3
    max_tokens: int = 2048
    top_p: float = 1.0
    stream: bool = True
    use_context: bool = True


class ChatMessageIn(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    context_item_ids: Optional[List[str]] = None


class ChatRequest(BaseModel):
    messages: List[ChatMessageIn]
    template_id: Optional[str] = None
    variables: Dict[str, str] = Field(default_factory=dict)
    parameters: ChatParameters = Field(default_factory=ChatParameters)
    context_item_ids: List[str] = Field(default_factory=list)
    # Cart context payload (id, content) sent from the frontend store
    context_items: List[Dict[str, Any]] = Field(default_factory=list)


# ------------------------------------------------------------------
# Knowledge
# ------------------------------------------------------------------
class NamespaceOut(BaseModel):
    id: str
    name: str
    description: str
    document_count: int
    chunk_count: int
    total_tokens: int
    embedding_model: str
    created_at: str


class KnowledgeStats(BaseModel):
    total_documents: int
    total_chunks: int
    total_tokens: int
    namespaces: int
    top_tags: List[Dict[str, Any]]


# ------------------------------------------------------------------
# Health
# ------------------------------------------------------------------
class HealthComponent(BaseModel):
    name: str
    status: Literal["ok", "degraded", "down"]
    latency_ms: Optional[int] = None
    detail: Optional[str] = None


class HealthReport(BaseModel):
    status: Literal["ok", "degraded", "down"]
    components: List[HealthComponent]


# Resolve forward refs
SearchQuery.model_rebuild()
