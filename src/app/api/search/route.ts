import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** POST /api/search → backend POST /search */
export async function POST(req: NextRequest) {
  return proxyToBackend('/search', req)
}
