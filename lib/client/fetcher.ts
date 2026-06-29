// Thin client-side fetch wrapper. Same-origin only (the BFF). Throws ApiError
// with the server's message so the UI can show inline errors with retry.

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;
  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function api<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers:
      opts.body && !(opts.headers && 'Content-Type' in opts.headers)
        ? { 'Content-Type': 'application/json', ...(opts.headers || {}) }
        : opts.headers,
    ...opts,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(json.error || `Request failed (${res.status})`, res.status, json.errors);
  }
  return json as T;
}

// Convenience for the allowlisted PVE proxy.
export function pvePath(hostId: string, path: string, query?: Record<string, string>) {
  const qs = new URLSearchParams({ hostId, ...(query || {}) }).toString();
  return `/api/pve${path}?${qs}`;
}
