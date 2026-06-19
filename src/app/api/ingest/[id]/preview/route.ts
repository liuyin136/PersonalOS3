import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** POST /api/ingest/:id/preview → backend POST /ingest/:id/preview */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyToBackend(`/ingest/${id}/preview`, req)
}
