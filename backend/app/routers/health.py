"""Health router — checks DB, Redis, worker, and key endpoints."""
from __future__ import annotations

import time
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..config import settings
from ..schemas import HealthComponent, HealthReport

router = APIRouter(prefix="/health", tags=["health"])


async def _check_db(db: AsyncSession) -> HealthComponent:
    t0 = time.perf_counter()
    try:
        await db.execute(text("SELECT 1"))
        return HealthComponent(
            name="postgres",
            status="ok",
            latency_ms=int((time.perf_counter() - t0) * 1000),
            detail="pgvector connection alive",
        )
    except Exception as e:
        return HealthComponent(name="postgres", status="down", detail=str(e))


async def _check_redis() -> HealthComponent:
    t0 = time.perf_counter()
    try:
        from arq import create_pool
        from arq.connections import RedisSettings

        pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
        info = await pool.info()
        await pool.close()
        return HealthComponent(
            name="redis",
            status="ok",
            latency_ms=int((time.perf_counter() - t0) * 1000),
            detail=f"queued={info.queued_jobs}",
        )
    except Exception as e:
        return HealthComponent(name="redis", status="down", detail=str(e))


async def _check_embedder() -> HealthComponent:
    t0 = time.perf_counter()
    try:
        from ..services import embedding
        vec = await embedding.embed_query("ping")
        return HealthComponent(
            name="embedder",
            status="ok",
            latency_ms=int((time.perf_counter() - t0) * 1000),
            detail=f"dim={len(vec)}",
        )
    except Exception as e:
        return HealthComponent(name="embedder", status="degraded", detail=str(e))


@router.get("", response_model=HealthReport)
async def health(db: AsyncSession = Depends(get_db)):
    components: List[HealthComponent] = []
    components.append(await _check_db(db))
    components.append(await _check_redis())
    components.append(await _check_embedder())

    # API itself is up if we got here
    components.append(HealthComponent(name="api", status="ok", detail="FastAPI responding"))

    statuses = [c.status for c in components]
    overall = "ok" if all(s == "ok" for s in statuses) else (
        "down" if "down" in statuses else "degraded"
    )
    return HealthReport(status=overall, components=components)
