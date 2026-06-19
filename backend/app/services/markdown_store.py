"""Persist original Markdown to /data/markdown/<document_id>.md."""
from __future__ import annotations

import os
from pathlib import Path

from .config import settings


def _ensure_dir() -> Path:
    p = Path(settings.MARKDOWN_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


def save_markdown(document_id: str, content: str) -> str:
    """Write Markdown content to disk; return absolute path."""
    _ensure_dir()
    path = Path(settings.MARKDOWN_DIR) / f"{document_id}.md"
    path.write_text(content, encoding="utf-8")
    return str(path)


def read_markdown(document_id: str) -> str | None:
    path = Path(settings.MARKDOWN_DIR) / f"{document_id}.md"
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def delete_markdown(document_id: str) -> None:
    path = Path(settings.MARKDOWN_DIR) / f"{document_id}.md"
    if path.exists():
        path.unlink()
