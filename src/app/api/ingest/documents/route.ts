import { proxyToBackend } from '@/lib/proxy'

/** GET /api/ingest/documents → backend GET /ingest/documents */
export async function GET() {
  return proxyToBackend('/ingest/documents')
}
