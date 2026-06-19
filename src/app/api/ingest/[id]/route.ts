import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** DELETE /api/ingest/:id → backend DELETE /ingest/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyToBackend(`/ingest/${id}`, undefined, { method: 'DELETE' })
}
