import { useCallback, useEffect, useRef, useState } from 'react';

/** Set by the auth layer: returns an Auth0 access token, or null in dev-user mode. */
let tokenProvider: () => Promise<string | null> = async () => null;
export const setTokenProvider = (fn: () => Promise<string | null>) => { tokenProvider = fn; };

export class ApiError extends Error {
  constructor(public status: number, public body: { error?: string; message?: string }) {
    super(body.message ?? body.error ?? `Request failed (${status})`);
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const t = await tokenProvider();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(await authHeaders()) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json);
  return json as T;
}

/** Download a CSV export with the auth header (a plain link can't send it). */
export async function download(path: string) {
  const res = await fetch(`/api${path}`, { headers: await authHeaders() });
  if (!res.ok) throw new ApiError(res.status, {});
  const name = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'export.csv';
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export const qs = (params: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Fetch on mount and whenever `path` changes; `reload` re-fetches. Stale responses are ignored. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: !!path });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!path) return;
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    api<T>(path)
      .then((data) => n === seq.current && setState({ data, loading: false }))
      .catch((error) => n === seq.current && setState((s) => ({ ...s, error, loading: false })));
  }, [path]);
  useEffect(load, [load]);
  return { ...state, reload: load, setData: (data: T) => setState({ data, loading: false }) };
}
