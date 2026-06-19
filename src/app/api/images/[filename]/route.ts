import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * GET /api/images/[filename]
 * Serve a stored image from /data/pic. Used by the Markdown renderer to
 * display pasted/uploaded images referenced as ![alt](/api/images/x.png).
 */
const PIC_DIR = process.env.PIC_DIR || path.join(process.cwd(), 'public', 'data', 'pic')

const TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params

  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const ext = path.extname(filename).slice(1).toLowerCase()
  const contentType = TYPE_BY_EXT[ext]
  if (!contentType) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 })
  }

  const filepath = path.join(PIC_DIR, filename)
  try {
    const data = await fs.readFile(filepath)
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }
  const filepath = path.join(PIC_DIR, filename)
  try {
    await fs.unlink(filepath)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }
}
