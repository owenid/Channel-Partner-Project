import { config } from '../config.js';

const store = new Map<string, { expires: number; value: Promise<unknown> }>();

/** Memoise an upstream call for CACHE_TTL_SECONDS; failed calls are not cached. */
export function cached<T>(key: string, fn: () => Promise<T>, ttlMs = config.cacheTtlMs): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = fn().catch((e) => {
    store.delete(key);
    throw e;
  });
  store.set(key, { expires: Date.now() + ttlMs, value });
  return value;
}
