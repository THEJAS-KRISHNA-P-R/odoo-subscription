import { navigateTo } from './router';

export interface ApiErrorPayload {
  status: number;
  error: string;
  message: string;
  fields?: Record<string, string>;
}

export class ApiError extends Error implements ApiErrorPayload {
  status: number;
  error: string;
  fields?: Record<string, string>;

  constructor(payload: ApiErrorPayload) {
    super(payload.message || payload.error || 'Request failed');
    this.name = 'ApiError';
    this.status = payload.status;
    this.error = payload.error;
    this.fields = payload.fields;
  }
}

const rawBaseUrl =
  (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8080/api/v1';

export const API_BASE_URL = String(rawBaseUrl).replace(/\/+$/, '');

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface RequestOptions {
  headers?: Record<string, string>;
  idempotencyKey?: string;
  skipAuthRedirect?: boolean;
}

const AUTH_PATHS = ['/login', '/signup', '/forgot', '/reset'];

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options?.headers || {}),
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options?.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError({
      status: 0,
      error: 'network_error',
      message: `Unable to reach backend API at ${API_BASE_URL}. Ensure the server is running and accessible.`,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let parsed: unknown = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
  } else {
    try {
      const text = await response.text();
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      !options?.skipAuthRedirect &&
      typeof window !== 'undefined' &&
      !AUTH_PATHS.includes(window.location.pathname)
    ) {
      navigateTo('/login', true);
    }

    const errObj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
    throw new ApiError({
      status: response.status,
      error: typeof errObj.error === 'string' ? errObj.error : `http_${response.status}`,
      message:
        typeof errObj.message === 'string'
          ? errObj.message
          : `Request failed with status ${response.status}`,
      fields:
        errObj.fields && typeof errObj.fields === 'object'
          ? (errObj.fields as Record<string, string>)
          : undefined,
    });
  }

  return parsed as T;
}

async function downloadFile(path: string, filename: string): Promise<void> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'text/csv, application/json;q=0.9, */*;q=0.8',
      },
    });
  } catch {
    throw new ApiError({
      status: 0,
      error: 'network_error',
      message: `Unable to reach backend API at ${API_BASE_URL}. Ensure the server is running and accessible.`,
    });
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      typeof window !== 'undefined' &&
      !AUTH_PATHS.includes(window.location.pathname)
    ) {
      navigateTo('/login', true);
    }
    let errMessage = `Export failed with status ${response.status}`;
    try {
      const parsed = await response.json();
      if (parsed && typeof parsed.message === 'string') {
        errMessage = parsed.message;
      }
    } catch {
      // Non-JSON error body
    }
    throw new ApiError({
      status: response.status,
      error: `http_${response.status}`,
      message: errMessage,
    });
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export const api = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>('GET', path, undefined, options),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),
  download: (path: string, filename: string) => downloadFile(path, filename),
};
