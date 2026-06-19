import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** POST /api/chat → backend POST /chat */
export async function POST(req: NextRequest) {
  return proxyToBackend('/chat', req)
}
