export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiFailure = { error?: { code?: string; message?: string } };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach ProjectQR. Check your connection and try again.');
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({})) as T & ApiFailure;
  if (!response.ok) {
    throw new ApiError(response.status, body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'The request could not be completed.');
  }
  return body;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File) => {
    const body = new FormData();
    body.set('image', file);
    return request<T>(path, { method: 'POST', body });
  }
};
