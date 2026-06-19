import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** POST /api/images/upload → backend POST /images/upload (multipart) */
export async function POST(req: NextRequest) {
  return proxyToBackend('/images/upload', req)
}
