"""Chat LLM service — OpenAI-compatible local endpoint (vLLM / Ollama / LM Studio).

Streams tokens back via an async generator. Works with any server that
implements the OpenAI /v1/chat/completions API, so Hong Kong users can
point it at a local Qwen / DeepSeek / Llama model without needing
OpenAI or Claude access.
"""
from __future__ import annotations

import json
from typing import AsyncIterator, List

import httpx

from ..config import settings


async def stream_chat(
    messages: List[dict],
    model: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 2048,
    top_p: float = 1.0,
) -> AsyncIterator[str]:
    """Yield text deltas from an OpenAI-compatible streaming endpoint."""
    payload = {
        "model": model or settings.CHAT_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "top_p": top_p,
        "stream": True,
    }
    headers = {"Authorization": f"Bearer {settings.CHAT_API_KEY}"}

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        async with client.stream(
            "POST",
            f"{settings.CHAT_API_BASE}/chat/completions",
            json=payload,
            headers=headers,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data = line[len("data: "):]
                if data.strip() == "[DONE]":
                    break
                try:
                    obj = json.loads(data)
                    delta = obj["choices"][0]["delta"].get("content", "")
                    if delta:
                        yield delta
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue


async def chat_complete(
    messages: List[dict],
    model: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 2048,
    top_p: float = 1.0,
) -> str:
    """Non-streaming chat completion. Collects all deltas."""
    out: List[str] = []
    async for delta in stream_chat(messages, model, temperature, max_tokens, top_p):
        out.append(delta)
    return "".join(out)
