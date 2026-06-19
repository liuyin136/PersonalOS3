"""Application configuration loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Core services ---
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:mysecretpassword@localhost:5432/personalos"
    )
    REDIS_URL: str = Field(default="redis://localhost:6379")

    # --- Storage ---
    MARKDOWN_DIR: str = Field(default="/data/markdown")
    PIC_DIR: str = Field(default="/data/pic")

    # --- Embedding ---
    EMBEDDING_MODEL: str = Field(default="bge-small-en-v1.5")
    EMBEDDING_DIM: int = Field(default=384)
    # Local sentence-transformers model id (HuggingFace hub)
    EMBEDDING_HF_MODEL: str = Field(default="BAAI/bge-small-en-v1.5")

    # --- Chat (OpenAI-compatible local endpoint, e.g. vLLM / Ollama) ---
    CHAT_MODEL: str = Field(default="qwen2.5-7b-instruct")
    CHAT_API_BASE: str = Field(default="http://localhost:11434/v1")
    CHAT_API_KEY: str = Field(default="not-required")

    # --- Reranker (cross-encoder via sentence-transformers) ---
    RERANKER_MODEL: str = Field(default="bge-reranker-base")
    RERANKER_HF_MODEL: str = Field(default="BAAI/bge-reranker-base")

    # --- Chunking ---
    CHUNK_SIZE_TOKENS: int = Field(default=512)
    CHUNK_OVERLAP_PCT: int = Field(default=10)  # 10% overlap

    # --- Search defaults ---
    SEARCH_TOP_K: int = Field(default=20)        # chunks fetched before parent rerank
    SEARCH_RERANK_TOP: int = Field(default=10)   # parents returned after rerank
    HNSW_EF_SEARCH: int = Field(default=64)      # runtime HNSW search width

    # --- CORS ---
    CORS_ORIGINS: str = Field(default="http://localhost:3000")

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
