"""Chat router — Workflow 4 (structured templated chat with streaming)."""
from __future__ import annotations

import uuid
from typing import AsyncIterator, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Chunk
from ..schemas import ChatRequest, PromptTemplate, ChatMessageIn
from ..services import llm, templates as tpl_service
from ..config import settings

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/templates", response_model=List[PromptTemplate])
async def list_templates():
    return tpl_service.BUILTIN_TEMPLATES


def _assemble_context(req: ChatRequest) -> str:
    """Join cart context items (id + content) into a single context block."""
    parts: List[str] = []
    # context_items payload from the frontend store
    for item in req.context_items:
        content = item.get("content", "")
        title = item.get("documentTitle", "unknown")
        idx = item.get("chunkIndex", "?")
        parts.append(f"<!-- {title} · chunk #{idx} -->\n{content}")
    return "\n\n---\n\n".join(parts)


def _build_messages(req: ChatRequest) -> List[dict]:
    tpl = None
    if req.template_id:
        tpl = next((t for t in tpl_service.BUILTIN_TEMPLATES if t.id == req.template_id), None)

    context = _assemble_context(req) if req.parameters.use_context else ""

    if tpl:
        sys_prompt = tpl.system_prompt.replace("{{context}}", context)
        usr_prompt = tpl.user_prompt
        for k, v in req.variables.items():
            sys_prompt = sys_prompt.replace("{{" + k + "}}", v)
            usr_prompt = usr_prompt.replace("{{" + k + "}}", v)
        messages = [{"role": "system", "content": sys_prompt}]
        # carry conversation history (user/assistant only)
        for m in req.messages:
            if m.role in ("user", "assistant"):
                messages.append({"role": m.role, "content": m.content})
        # the latest user message is the rendered user prompt
        if req.messages and req.messages[-1].role == "user":
            messages[-1] = {"role": "user", "content": usr_prompt or req.messages[-1].content}
        else:
            messages.append({"role": "user", "content": usr_prompt})
    else:
        messages = [{"role": m.role, "content": m.content} for m in req.messages]

    return messages


@router.post("")
async def chat(req: ChatRequest):
    """Non-streaming chat. Returns the full assistant message."""
    messages = _build_messages(req)
    content = await llm.chat_complete(
        messages,
        model=req.parameters.model,
        temperature=req.parameters.temperature,
        max_tokens=req.parameters.max_tokens,
        top_p=req.parameters.top_p,
    )
    return {
        "id": f"msg_{uuid.uuid4().hex[:10]}",
        "role": "assistant",
        "content": content,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "model": req.parameters.model,
    }


@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """Streaming chat via Server-Sent Events."""
    messages = _build_messages(req)
    msg_id = f"msg_{uuid.uuid4().hex[:10]}"

    async def event_gen() -> AsyncIterator[bytes]:
        try:
            async for delta in llm.stream_chat(
                messages,
                model=req.parameters.model,
                temperature=req.parameters.temperature,
                max_tokens=req.parameters.max_tokens,
                top_p=req.parameters.top_p,
            ):
                # SSE format: data: {json}\n\n
                payload = __import__("json").dumps(
                    {"delta": delta, "messageId": msg_id, "done": False}
                )
                yield f"data: {payload}\n\n".encode()
            yield (
                f"data: {__import__('json').dumps({'delta': '', 'messageId': msg_id, 'done': True})}\n\n"
            ).encode()
        except Exception as e:
            err = __import__("json").dumps({"error": str(e), "messageId": msg_id, "done": True})
            yield f"data: {err}\n\n".encode()

    return StreamingResponse(event_gen(), media_type="text/event-stream")
