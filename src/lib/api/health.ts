/**
 * Health API — backend dependency checks
 * Endpoint: /health
 */
import { request } from './client'
import type { HealthReport, HealthStatus } from '@/types/rag'

function mapReport(r: Record<string, unknown>): HealthReport {
  return {
    status: (r.status as HealthStatus) ?? 'down',
    components: ((r.components as Record<string, unknown>[]) ?? []).map((c) => ({
      name: String(c.name),
      status: (c.status as HealthStatus) ?? 'down',
      latencyMs: c.latency_ms != null ? Number(c.latency_ms) : c.latencyMs != null ? Number(c.latencyMs) : undefined,
      detail: c.detail != null ? String(c.detail) : undefined,
    })),
  }
}

export const healthApi = {
  async check(): Promise<HealthReport> {
    const data = await request<Record<string, unknown>>('/api/health')
    return mapReport(data)
  },
}
