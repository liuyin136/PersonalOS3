import { proxyToBackend } from '@/lib/proxy'

/** GET /api/knowledge/namespaces → backend GET /knowledge/namespaces */
export async function GET() {
  return proxyToBackend('/knowledge/namespaces')
}
