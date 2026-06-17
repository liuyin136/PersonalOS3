/**
 * Base API client for the FastAPI + LangChain backend.
 *
 * NOTE: This is a placeholder client layer. All endpoints are pre-wired
 * with strong typing but do not perform real network calls yet — they
 * return mock data so the UI is fully interactive during template phase.
 *
 * When the backend is ready, replace the mock implementations with real
 * `fetch` calls to the configured base URL. The function signatures and
 * return types already match the expected backend contracts.
 */

import type {
  ApiResponse,
} from '@/types/rag'

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api'

/** Default backend port hint used by the gateway transform. */
export const BACKEND_PORT = process.env.NEXT_PUBLIC_BACKEND_PORT ?? '8000'

export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(message: string, status = 500, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Simulated latency for mocks (ms) */
  mockDelay?: number
}

/**
 * Generic request wrapper. Currently returns mock data via the supplied
 * `mockResolver`. Swap to a real fetch implementation when the backend
 * is connected.
 */
export async function request<T>(
  _path: string,
  options: RequestOptions = {},
  mockResolver?: () => T | Promise<T>,
): Promise<T> {
  // ----- Mock path (template phase) -----
  if (mockResolver) {
    const delay = options.mockDelay ?? 350
    await new Promise((r) => setTimeout(r, delay))
    const data = await mockResolver()
    return data
  }

  // ----- Real path (ready for backend) -----
  const url = `${API_BASE_URL}${_path}`
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(text || res.statusText, res.status)
  }

  const json = (await res.json()) as ApiResponse<T>
  if (!json.success) {
    throw new ApiError(json.error ?? 'Unknown error', res.status)
  }
  return json.data
}

/** Tiny id generator (client-safe). */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
