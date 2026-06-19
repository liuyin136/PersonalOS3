import { proxyToBackend } from '@/lib/proxy'

/** GET /api/chat/templates → backend GET /chat/templates */
export async function GET() {
  return proxyToBackend('/chat/templates')
}
