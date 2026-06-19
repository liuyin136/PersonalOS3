import { proxyToBackend } from '@/lib/proxy'

/** GET /api/knowledge/stats → backend GET /knowledge/stats */
export async function GET() {
  return proxyToBackend('/knowledge/stats')
}
