import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * POST /api/images/upload
 * Accept a multipart image upload (from clipboard paste or file picker),
 * save it to /data/pic with a unique filename, and return the URL/path
 * that should be inserted into the Markdown.
 *
 * In production the FastAPI backend serves the same contract; images are
 * written to /data/pic (mounted volume) and served via /api/images/:filename.
 */
const PIC_DIR = process.env.PIC_DIR || path.join(process.cwd(), 'public', 'data', 'pic')

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'])
const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Expected multipart field "file".' },
        { status: 400 },
      )
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: png, jpg, gif, webp, svg.` },
        { status: 415 },
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (${file.size} bytes). Max ${MAX_SIZE} bytes.` },
        { status: 413 },
      )
    }

    await fs.mkdir(PIC_DIR, { recursive: true })

    const buf = Buffer.from(await file.arrayBuffer())
    const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8)
    const ext = EXT_BY_TYPE[file.type] ?? 'bin'
    const filename = `${hash}-${Date.now()}.${ext}`
    const filepath = path.join(PIC_DIR, filename)

    await fs.writeFile(filepath, buf)

    const url = `/api/images/${filename}`
    return NextResponse.json({
      url,
      filename,
      path: filepath,
      size: file.size,
      content_type: file.type,
    })
  } catch (e) {
    console.error('[POST /api/images/upload]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Image upload failed' },
      { status: 500 },
    )
  }
}
