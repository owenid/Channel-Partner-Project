import { config, UpstreamConfig } from '../config.js';

export class UpstreamError extends Error {
  constructor(
    public system: string,
    public status: number | null,
    message: string,
    /** business reason from the upstream body, e.g. GIG's { "reason": "Product not available" } */
    public reason?: string,
  ) {
    super(`[${system}] ${message}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function reasonFrom(res: Response): Promise<string | undefined> {
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { reason?: unknown; message?: unknown; error?: unknown };
      const r = j.reason ?? j.message ?? j.error;
      return typeof r === 'string' ? r.slice(0, 200) : undefined;
    } catch {
      return text && text.length < 200 ? text : undefined; // e.g. GIG's plain "Provider API Error"
    }
  } catch {
    return undefined;
  }
}

/**
 * Call an upstream JSON API with a timeout and bearer auth.
 * GET requests are retried with backoff on network errors, 429 and 5xx. Other methods are
 * NOT retried by default: repeating a create-quote, reserve or place-order call after a
 * timeout could create a duplicate.
 */
export async function upstreamJson<T>(
  up: UpstreamConfig,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined>; retry?: boolean } = {},
): Promise<T> {
  const url = new URL(up.baseUrl + path);
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const method = init.method ?? 'GET';
  const retries = (init.retry ?? method === 'GET') ? config.retries : 0;

  const auth = await up.authHeader();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(auth ? { Authorization: auth } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
      const reason = await reasonFrom(res);
      lastErr = new UpstreamError(up.name, res.status, `${res.status} ${res.statusText} on ${path}`, reason);
      if (!(res.status === 429 || res.status >= 500)) throw lastErr;
    } catch (e) {
      if (e instanceof UpstreamError && e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr = e instanceof UpstreamError ? e : new UpstreamError(up.name, null, `request failed on ${path}: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(200 * 2 ** attempt);
  }
  throw lastErr;
}
