import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** POST /api/cart/optimize → backend POST /cart/optimize */
export async function POST(req: NextRequest) {
  return proxyToBackend('/cart/optimize', req)
}
