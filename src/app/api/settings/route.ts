import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** GET /api/settings → backend GET /settings */
export async function GET() {
  return proxyToBackend('/settings')
}

/** PUT /api/settings → backend PUT /settings */
export async function PUT(req: NextRequest) {
  return proxyToBackend('/settings', req, { method: 'PUT' })
}
