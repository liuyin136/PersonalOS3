import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** POST /api/ingest → backend POST /ingest */
export async function POST(req: NextRequest) {
  return proxyToBackend('/ingest', req)
}
