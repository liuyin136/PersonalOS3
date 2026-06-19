import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** POST /api/chat/stream → backend POST /chat/stream (SSE) */
export async function POST(req: NextRequest) {
  return proxyToBackend('/chat/stream', req)
}
