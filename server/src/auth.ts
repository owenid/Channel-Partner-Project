import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { config } from './config.js';

/** Identity the portal back end works with, taken from the Auth0 access token. */
export interface PortalUser {
  userId: string;
  orgId: string;
  servicenowAccountId: string;
  name?: string;
  email?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user: PortalUser } }
}

const DEV_USER: PortalUser = {
  userId: 'dev|george',
  orgId: 'org_dev',
  servicenowAccountId: 'SN-ACC-0001',
  name: 'George',
  email: 'john.doe@xyzcomms.co.uk',
};

const jwks = config.auth0.enabled
  ? createRemoteJWKSet(new URL(`https://${config.auth0.domain}/.well-known/jwks.json`))
  : null;

const claim = (p: JWTPayload, key: string) => {
  const v = p[config.auth0.claimNamespace + key] ?? p[key];
  return typeof v === 'string' ? v : undefined;
};

/**
 * Verifies the Auth0 access token (signature, issuer, audience, expiry) and puts
 * user_id / org_id / servicenow_account_id on req.user. Every downstream call is
 * scoped by these claims, never by ids sent from the browser.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!jwks) {
    req.user = DEV_USER; // Auth0 not configured: local development only
    return next();
  }
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${config.auth0.domain}/`,
      audience: config.auth0.audience,
    });
    const userId = claim(payload, 'user_id') ?? payload.sub;
    const orgId = claim(payload, 'org_id');
    const servicenowAccountId = claim(payload, 'servicenow_account_id');
    if (!userId || !orgId || !servicenowAccountId) {
      return res.status(403).json({ error: 'missing_claims', detail: 'token needs user_id, org_id and servicenow_account_id' });
    }
    req.user = { userId, orgId, servicenowAccountId, name: claim(payload, 'name'), email: claim(payload, 'email') };
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}
