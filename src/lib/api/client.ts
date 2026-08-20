/**
 * Central API client.
 *
 * Wraps native `fetch` with the backend's response envelope
 * (`{"status":"success","data":...}` / `{"status":"error","code","message"}`),
 * automatic JWT refresh-and-retry on 401, and secure blob downloads.
 *
 * The backend is the source of truth for every endpoint; this module never
 * invents routes or response shapes.
 */

import type { ApiEnvelope, ApiErrorBody } from '../../types';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '');

export const ACCESS_TOKEN_KEY = 'aec_access_token';
export const REFRESH_TOKEN_KEY = 'aec_refresh_token';

/** Thrown for any non-2xx API response; carries the stable backend error code. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getAccessToken(): string | null {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh: string): void {
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  } catch {
    /* ignore storage failures */
  }
}

export function clearTokens(): void {
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* ignore storage failures */
  }
}

/** Fired once when a refresh attempt fails and the session must be dropped. */
let onSessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpiredHandler = handler;
}

function notifySessionExpired(): void {
  clearTokens();
  if (onSessionExpiredHandler) onSessionExpiredHandler();
}

// Single-flight refresh so concurrent 401s trigger only one refresh request.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refreshToken}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        notifySessionExpired();
        return null;
      }
      const envelope = (await response.json()) as ApiEnvelope<{
        access_token: string;
        refresh_token: string;
      }>;
      setTokens(envelope.data.access_token, envelope.data.refresh_token);
      return envelope.data.access_token;
    } catch {
      notifySessionExpired();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Path is appended to the API base URL (e.g. "/admin/permits"). */
}

function buildHeaders(contentType?: string): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    return {
      status: 'error',
      code: body.code || 'request_failed',
      message: body.message || 'Request failed.',
    };
  } catch {
    return { status: 'error', code: 'request_failed', message: 'Request failed.' };
  }
}

async function doRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = options.body instanceof FormData;
  const isJsonBody = hasBody && !isFormData && typeof options.body !== 'string';
  let bodyInit: BodyInit | null | undefined;
  if (hasBody) {
    bodyInit =
      isFormData || typeof options.body === 'string'
        ? (options.body as BodyInit)
        : JSON.stringify(options.body);
  }
  const contentType = isJsonBody ? 'application/json' : undefined;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      body: bodyInit as BodyInit,
      headers: buildHeaders(contentType),
    });
  } catch {
    throw new ApiError(
      'Unable to reach the server. Check your connection and try again.',
      0,
      'network_error',
    );
  }

  if (response.status === 401 && !isAuthPath(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      try {
        response = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          body: bodyInit as BodyInit,
          headers: buildHeaders(contentType),
        });
      } catch {
        throw new ApiError(
          'Unable to reach the server. Check your connection and try again.',
          0,
          'network_error',
        );
      }
    }
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    if (response.status === 401 && !isAuthPath(path)) notifySessionExpired();
    throw new ApiError(body.message, response.status, body.code);
  }

  const text = await response.text();
  if (!text) return undefined as T;
  try {
    const envelope = JSON.parse(text) as ApiEnvelope<T>;
    return envelope.data as T;
  } catch {
    return text as unknown as T;
  }
}

function isAuthPath(path: string): boolean {
  return path.startsWith('/auth/');
}

export function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return doRequest<T>(path, { ...options, method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return doRequest<T>(path, { method: 'POST', body });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return doRequest<T>(path, { method: 'PUT', body });
}

export function apiDelete<T>(path: string): Promise<T> {
  return doRequest<T>(path, { method: 'DELETE' });
}

export function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return doRequest<T>(path, { method: 'POST', body: formData });
}

export function apiQuery(path: string, params?: object): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Authenticated download of a file/CSV endpoint, returning the raw blob.
 * Triggers the same refresh-and-retry flow as JSON requests.
 */
export async function apiDownload(
  path: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers });
  } catch {
    throw new ApiError(
      'Unable to reach the server. Check your connection and try again.',
      0,
      'network_error',
    );
  }

  if (response.status === 401 && !isAuthPath(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      try {
        response = await fetch(`${API_BASE_URL}${path}`, {
          headers: { ...headers, Authorization: `Bearer ${refreshed}` },
        });
      } catch {
        throw new ApiError(
          'Unable to reach the server. Check your connection and try again.',
          0,
          'network_error',
        );
      }
    }
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    throw new ApiError(body.message, response.status, body.code);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match ? match[1] : 'download.bin';

  return { blob: await response.blob(), filename };
}

/** Trigger a browser download for an authenticated file endpoint. */
export async function saveDownload(path: string): Promise<void> {
  const { blob, filename } = await apiDownload(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}