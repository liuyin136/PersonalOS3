import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side proxy helper.
 *
 * Forwards requests from the Next.js frontend (port 3000) to the FastAPI
 * backend (http://api-server:8000 inside Docker). This keeps the browser
 * on a single origin (no CORS issues) and lets the frontend container
 * resolve the backend via the Docker internal network.
 *
 * The browser calls relative paths like /api/ingest/documents; the
 * matching Next.js route handler calls proxyToBackend('/ingest/documents')
 * — note the /api prefix is stripped before forwarding.
 */

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://api-server:8000'

/** Headers that must not be forwarded to the backend. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

function filterHeaders(
  headers: Headers,
): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out[key] = value
  })
  return out
}

/**
 * Proxy a request to the FastAPI backend.
 *
 * @param backendPath  Backend path WITHOUT /api prefix (e.g. "/ingest/documents")
 * @param req          Optional incoming NextRequest (method, headers, body forwarded)
 * @param options      Override method / body / extra headers
 */
export async function proxyToBackend(
  backendPath: string,
  req?: NextRequest,
  options?: {
    method?: string
    body?: BodyInit
    headers?: Record<string, string>
  },
): Promise<NextResponse> {
  const url = `${BACKEND_URL}${backendPath}`
  const method = options?.method ?? req?.method ?? 'GET'

  const reqHeaders: Record<string, string> = {}
  if (req) {
    Object.assign(reqHeaders, filterHeaders(req.headers))
  }
  if (options?.headers) {
    Object.assign(reqHeaders, options.headers)
  }

  let body: BodyInit | undefined
  if (options?.body !== undefined) {
    body = options.body
  } else if (req && method !== 'GET' && method !== 'HEAD') {
    body = req.body
  }

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: reqHeaders,
      body,
      // @ts-expect-error — duplex is required for streaming bodies in some runtimes
      duplex: 'half',
    })
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? `Backend unreachable: ${e.message}`
            : 'Backend unreachable',
        backend: BACKEND_URL,
      },
      { status: 502 },
    )
  }

  // Forward the response body stream, status, and safe headers.
  const resHeaders = new Headers()
  res.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) resHeaders.set(key, value)
  })

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
  })
}
