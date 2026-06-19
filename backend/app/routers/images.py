"""Image upload & serving router.

Accepts clipboard-pasted or file-picked images from the Markdown editor,
saves them to /data/pic with unique filenames, and serves them back via
/api/images/{filename}. Mirrors the Next.js API route contract so the
frontend works identically in both local and docker deployments.
"""
from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

from ..config import settings

router = APIRouter(prefix="/images", tags=["images"])

ALLOWED_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def _ensure_dir() -> Path:
    p = Path(settings.PIC_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Allowed: png, jpg, gif, webp, svg.",
        )

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data)} bytes). Max {MAX_SIZE} bytes.",
        )

    _ensure_dir()
    digest = hashlib.sha256(data).hexdigest()[:8]
    ext = ALLOWED_TYPES[file.content_type]
    filename = f"{digest}-{int(time.time() * 1000)}.{ext}"
    filepath = Path(settings.PIC_DIR) / filename
    filepath.write_bytes(data)

    return {
        "url": f"/api/images/{filename}",
        "filename": filename,
        "path": str(filepath),
        "size": len(data),
        "content_type": file.content_type,
    }


@router.get("/{filename}")
async def get_image(filename: str):
    # Prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
        "svg": "image/svg+xml",
    }
    if ext not in content_types:
        raise HTTPException(status_code=415, detail="Unsupported image type")

    filepath = Path(settings.PIC_DIR) / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(
        filepath,
        media_type=content_types[ext],
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.delete("/{filename}")
async def delete_image(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    filepath = Path(settings.PIC_DIR) / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    filepath.unlink()
    return {"success": True}
