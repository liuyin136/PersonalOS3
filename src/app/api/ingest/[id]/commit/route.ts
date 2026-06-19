import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** POST /api/ingest/:id/commit → backend POST /ingest/:id/commit */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyToBackend(`/ingest/${id}/commit`, req)
}
