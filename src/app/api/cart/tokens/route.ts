import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/proxy'

/** POST /api/cart/tokens → backend POST /cart/tokens */
export async function POST(req: NextRequest) {
  return proxyToBackend('/cart/tokens', req)
}
