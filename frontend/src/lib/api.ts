/**
 * Minimal API client: base URL, timeout, and the backend's JSON error envelope
 * ({"error": {"code", "message", "details"}} — context/system_design.md §9).
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(
  /\/+$/,
  '',
)

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** True when the backend could not be reached at all (asleep, offline, CORS, timeout). */
  get isUnreachable(): boolean {
    return this.status === 0
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: Record<string, unknown> }
}

export interface ApiRequestInit extends RequestInit {
  /** Abort the request after this many milliseconds. Default 15 s. */
  timeoutMs?: number
}

export async function apiFetch<T>(
  path: string,
  { timeoutMs = 15_000, signal, headers, ...init }: ApiRequestInit = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort, { once: true })

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...headers },
    })
  } catch (error) {
    if (signal?.aborted) throw error
    if (controller.signal.aborted) {
      throw new ApiError(0, 'timeout', `The backend did not respond within ${timeoutMs / 1000} s.`)
    }
    throw new ApiError(0, 'network_error', 'Could not reach the backend.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorEnvelope | null
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'http_error',
      body?.error?.message ?? `Request failed with status ${response.status}.`,
      body?.error?.details ?? {},
    )
  }
  return (await response.json()) as T
}
