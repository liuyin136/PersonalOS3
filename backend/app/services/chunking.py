"""Text chunking strategies for RAG ingestion.

Default: recursive character splitting with ~512 token target and 10%
overlap. Token counts use tiktoken (cl100k_base) which matches most
OpenAI-compatible chat tokenizers closely enough for budgeting.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

import tiktoken

from ..schemas import ChunkingConfig

_ENC = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(_ENC.encode(text))


@dataclass
class Chunk:
    index: int
    content: str
    token_count: int
    overlap: int


def _split_recursive(text: str, size: int, overlap: int) -> List[str]:
    """LangChain-style recursive splitter on structural separators."""
    separators = ["\n\n## ", "\n\n# ", "\n\n", "\n", ". ", " "]
    pieces = [text]
    for sep in separators:
        new_pieces: List[str] = []
        for piece in pieces:
            if count_tokens(piece) > size:
                parts = piece.split(sep)
                # re-join parts greedily to ~size tokens
                buf = ""
                for part in parts:
                    candidate = (buf + sep + part) if buf else part
                    if count_tokens(candidate) > size and buf:
                        new_pieces.append(buf)
                        # keep overlap from end of buf
                        tail = _tail_tokens(buf, overlap)
                        buf = (tail + sep + part) if tail else part
                    else:
                        buf = candidate
                if buf:
                    new_pieces.append(buf)
            else:
                new_pieces.append(piece)
        pieces = new_pieces
        if all(count_tokens(p) <= size for p in pieces):
            break
    # Final pass: split any still-oversized pieces by tokens
    final: List[str] = []
    for p in pieces:
        if count_tokens(p) <= size:
            final.append(p)
        else:
            final.extend(_split_by_tokens(p, size, overlap))
    return [p for p in final if p.strip()]


def _tail_tokens(text: str, n: int) -> str:
    tokens = _ENC.encode(text)
    if len(tokens) <= n:
        return text
    return _ENC.decode(tokens[-n:])


def _split_by_tokens(text: str, size: int, overlap: int) -> List[str]:
    tokens = _ENC.encode(text)
    chunks: List[str] = []
    step = max(1, size - overlap)
    i = 0
    while i < len(tokens):
        window = tokens[i : i + size]
        chunks.append(_ENC.decode(window))
        if i + size >= len(tokens):
            break
        i += step
    return chunks


def _split_markdown(text: str, size: int, overlap: int) -> List[str]:
    """Split on markdown headers first, then recursive."""
    sections = text.split("\n\n## ")
    out: List[str] = []
    for idx, sec in enumerate(sections):
        if idx > 0:
            sec = "## " + sec
        if count_tokens(sec) > size:
            out.extend(_split_recursive(sec, size, overlap))
        else:
            if sec.strip():
                out.append(sec)
    return out


def chunk_text(text: str, config: ChunkingConfig) -> List[Chunk]:
    """Produce chunks for the given text per the chunking config."""
    size = config.chunk_size
    overlap = max(0, int(config.chunk_size * (config.chunk_overlap / 100.0))) \
        if config.chunk_overlap < 100 else config.chunk_overlap

    if config.strategy == "fixed":
        parts = _split_by_tokens(text, size, overlap)
    elif config.strategy == "markdown":
        parts = _split_markdown(text, size, overlap)
    elif config.strategy == "semantic":
        # semantic splitting falls back to recursive on structural boundaries
        parts = _split_recursive(text, size, overlap)
    else:  # recursive
        parts = _split_recursive(text, size, overlap)

    chunks: List[Chunk] = []
    prev_tokens: List[int] = []
    for i, p in enumerate(parts):
        tc = count_tokens(p)
        # overlap estimate = tokens shared with previous chunk's tail
        ov = overlap if i > 0 else 0
        chunks.append(Chunk(index=i, content=p, token_count=tc, overlap=ov))
        prev_tokens = _ENC.encode(p)
    return chunks
