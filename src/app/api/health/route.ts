import { proxyToBackend } from '@/lib/proxy'

/** GET /api/health → backend GET /health */
export async function GET() {
  return proxyToBackend('/health')
}
