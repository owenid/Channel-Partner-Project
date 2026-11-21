import { config, UpstreamConfig } from '../config.js';

export class UpstreamError extends Error {
  constructor(public system: string, public status: number | null, message: string) {
    super(`[${system}] ${message}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET/POST JSON against an upstream system with a timeout, bearer auth and
 * retries (exponential backoff) on network errors, 429 and 5xx responses.
 */
export async function upstreamJson<T>(
  up: UpstreamConfig,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const url = new URL(up.baseUrl + path);
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  const auth = await up.authHeader();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= config.retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.timeoutMs);
    try {
      const res = await fetch(url, {
        method: init.method ?? 'GET',
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(auth ? { Authorization: auth } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status >= 500;
      lastErr = new UpstreamError(up.name, res.status, `${res.status} ${res.statusText} on ${path}`);
      if (!retryable) throw lastErr;
    } catch (e) {
      if (e instanceof UpstreamError && e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr = e instanceof UpstreamError ? e : new UpstreamError(up.name, null, `request failed on ${path}: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    if (attempt < config.retries) await sleep(200 * 2 ** attempt);
  }
  throw lastErr;
}
