/**
 * Base API client.
 *
 * The browser calls relative paths like /api/ingest/documents (same origin).
 * The matching Next.js route handler proxies the request to the FastAPI
 * backend via the server-side BACKEND_URL env var (see src/lib/proxy.ts).
 *
 * This single-origin pattern avoids CORS issues and keeps the backend
 * internal to the Docker network.
 */

export const API_BASE_URL = ''

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
}

/** Generic JSON request against the same-origin Next.js API routes. */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (e) {
    throw new ApiError(
      e instanceof Error ? e.message : 'Network error',
      0,
      e,
    )
  }

  if (!res.ok) {
    let detail: unknown
    try {
      detail = await res.json()
    } catch {
      detail = await res.text().catch(() => res.statusText)
    }
    const msg =
      (detail && typeof detail === 'object' && 'detail' in detail
        ? String((detail as { detail: unknown }).detail)
        : res.statusText) || `HTTP ${res.status}`
    throw new ApiError(msg, res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Tiny id generator (client-safe). */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
