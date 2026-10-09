/**
 * Single HTTP entry point for the whole app.
 *
 * Auth lives in httpOnly cookies, so there is no token to attach here. The
 * only real complexity is transparently refreshing an expired access token and
 * replaying the original request, with concurrent 401s sharing one refresh.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** `true` when retrying could plausibly succeed. */
  get isRetryable() {
    return this.status >= 500 || this.status === 0 || this.code === 'DATABASE_UNAVAILABLE';
  }

  get isAuthError() {
    return this.status === 401;
  }
}

const BASE = '/api';
const SESSION_HINT_COOKIE = 'forge_sess';

/**
 * Mirrors the server's non-httpOnly marker. Anonymous visitors can skip auth
 * probes entirely; a missing hint mid-session means the session is dead.
 */
export function hasSessionHint(): boolean {
  return typeof document !== 'undefined' && document.cookie.split('; ').includes(`${SESSION_HINT_COOKIE}=1`);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
  signal?: AbortSignal;
  /** Internal: prevents a refresh loop. */
  skipRefresh?: boolean;
};

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        if (value.length) url.searchParams.set(key, value.join(','));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.pathname + url.search;
}

/** Shared refresh promise so ten parallel 401s cause one refresh, not ten. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!hasSessionHint()) return false;
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      return response.ok;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so simultaneous callers all see this result.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

type AuthFailureListener = () => void;
const authFailureListeners = new Set<AuthFailureListener>();

/** Lets the auth provider clear local state when the session truly dies. */
export function onAuthFailure(listener: AuthFailureListener) {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, skipRefresh } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'We could not reach the server. Check your connection and try again.');
  }

  if (response.status === 204) return undefined as T;

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (response.ok) return payload as T;

  const error = (payload as { error?: { code?: string; message?: string; details?: Record<string, string> } } | null)
    ?.error;
  const code = error?.code ?? 'UNKNOWN';

  // An expired access token is the normal case after 15 minutes idle. Refresh
  // and replay once, silently.
  if (response.status === 401 && !skipRefresh && code !== 'INVALID_CREDENTIALS') {
    if (await refreshSession()) {
      return request<T>(path, { ...options, skipRefresh: true });
    }
    for (const listener of authFailureListeners) listener();
  }

  throw new ApiError(
    response.status,
    code,
    error?.message ?? 'Something went wrong. Please try again.',
    error?.details,
  );
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

/** Multipart upload - media files, not JSON. */
export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (response.ok) return payload as T;
  const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
  throw new ApiError(response.status, error?.code ?? 'UNKNOWN', error?.message ?? 'Upload failed.');
}

/** Turns an unknown thrown value into copy that is safe to show a user. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Field-level errors for inline form validation, when the server sent them. */
export function fieldErrors(err: unknown): Record<string, string> {
  return err instanceof ApiError && err.details ? err.details : {};
}
