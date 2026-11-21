import { config } from '../config.js';
import { UpstreamError } from './httpClient.js';

/**
 * OAuth2 client-credentials token provider with in-memory caching.
 * Used for Salesforce (/services/oauth2/token) and ServiceNow (/oauth_token.do).
 */
export function clientCredentials(opts: { system: string; tokenUrl: string; clientId: string; clientSecret: string; scope?: string }) {
  type Token = { value: string; expires: number; instanceUrl?: string };
  let token: Token | null = null;
  let inflight: Promise<Token> | null = null;

  async function fetchToken() {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: opts.clientId, client_secret: opts.clientSecret });
    if (opts.scope) body.set('scope', opts.scope);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.timeoutMs);
    try {
      const res = await fetch(opts.tokenUrl, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      });
      if (!res.ok) throw new UpstreamError(opts.system, res.status, `token request failed: ${res.status}`);
      const json = (await res.json()) as { access_token: string; expires_in?: number; instance_url?: string };
      // Salesforce omits expires_in; refresh conservatively after 30 minutes
      const ttl = (json.expires_in ?? 1800) * 1000;
      return { value: json.access_token, expires: Date.now() + ttl - 60_000, instanceUrl: json.instance_url };
    } finally {
      clearTimeout(timer);
    }
  }

  return async () => {
    if (token && token.expires > Date.now()) return token;
    inflight ??= fetchToken().finally(() => { inflight = null; });
    token = await inflight;
    return token!;
  };
}
