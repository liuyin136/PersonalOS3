import { proxyToBackend } from '@/lib/proxy'

/** GET /api/settings/catalog → backend GET /settings/catalog */
export async function GET() {
  return proxyToBackend('/settings/catalog')
}
