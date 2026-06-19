import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** GET /api/images/:filename → backend GET /images/:filename (binary) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params
  return proxyToBackend(`/images/${encodeURIComponent(filename)}`)
}

/** DELETE /api/images/:filename → backend DELETE /images/:filename */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params
  return proxyToBackend(
    `/images/${encodeURIComponent(filename)}`,
    undefined,
    { method: 'DELETE' },
  )
}
