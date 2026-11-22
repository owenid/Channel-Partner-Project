import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { config } from './config.js';
import { getOrganization, getUserRecord, mgmtApiEnabled } from './adapters/auth0Mgmt.js';

/** Identity the portal back end works with. Every upstream call is scoped by these ids. */
export interface PortalUser {
  /** Auth0 user id (token `sub`), e.g. auth0|6450cf85... - the quote `owner` in the Home Page Menu design */
  sub: string;
  userId: string;
  /** Auth0 organization id (org_...) */
  orgId: string;
  partnerName?: string;
  /** partner's sys_id in ServiceNow (organization metadata) */
  servicenowAccountId: string;
  /** partner id used by the Order Status Updates DB (organization metadata) */
  salesforceAccountId?: string;
  /** GIG/SWIFT ids (Retrieve Quotes design): user_metadata.swift_user_id, organization metadata.swift_reseller_id */
  swiftUserId: string;
  swiftResellerId: string;
  /** Auth0 RBAC permissions, e.g. read:own-quotes (partner user) or read:all-quotes (partner admin) */
  permissions: string[];
  name?: string;
  email?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user: PortalUser } }
}

export const can = (u: PortalUser, permission: string) => u.permissions.includes(permission);

// Local development only. DEV_USER_PERMISSIONS=read:own-quotes shows the partner-user view.
const DEV_USER: PortalUser = {
  sub: 'auth0|dev-george',
  userId: 'auth0|dev-george',
  orgId: 'org_dev',
  partnerName: 'XYZ Comms',
  servicenowAccountId: 'SN-ACC-0001',
  salesforceAccountId: '7806000005iLi4XYZ',
  swiftUserId: '456',
  swiftResellerId: '123',
  permissions: (process.env.DEV_USER_PERMISSIONS ?? 'read:own-quotes,read:all-quotes').split(',').map((p) => p.trim()).filter(Boolean),
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
 * Builds the partner identity. Ids can come from custom claims (fastest, if an Auth0 Action adds
 * them); anything missing is looked up through the Management API exactly as the Orders Placed
 * View design describes (user_metadata.org_id -> organization metadata). Results are cached.
 */
async function resolveIdentity(payload: JWTPayload): Promise<PortalUser | null> {
  const sub = payload.sub!;
  let orgId = claim(payload, 'org_id');
  let swiftUserId = claim(payload, 'swift_user_id');
  let servicenowAccountId = claim(payload, 'servicenow_account_id');
  let swiftResellerId = claim(payload, 'swift_reseller_id');
  let salesforceAccountId = claim(payload, 'salesforce_account_id');
  let partnerName: string | undefined;
  let name = claim(payload, 'name');

  if (mgmtApiEnabled && (!orgId || !swiftUserId || !servicenowAccountId || !swiftResellerId || !salesforceAccountId)) {
    const user = await getUserRecord(sub);
    orgId ??= user.user_metadata?.org_id;
    swiftUserId ??= user.user_metadata?.swift_user_id;
    name ??= user.given_name ?? user.name;
    if (orgId) {
      const org = await getOrganization(orgId);
      servicenowAccountId ??= org.metadata?.servicenow_account_id;
      swiftResellerId ??= org.metadata?.swift_reseller_id;
      salesforceAccountId ??= org.metadata?.salesforce_account_id;
      partnerName = org.display_name ?? org.name;
    }
  }
  if (!orgId || !servicenowAccountId || !swiftUserId || !swiftResellerId) return null;
  const permissions = Array.isArray(payload.permissions) ? payload.permissions.filter((p): p is string => typeof p === 'string') : [];
  return {
    sub, userId: claim(payload, 'user_id') ?? sub, orgId, partnerName, servicenowAccountId, salesforceAccountId,
    swiftUserId, swiftResellerId, permissions, name, email: claim(payload, 'email'),
  };
}

/** Verifies the Auth0 access token (signature, issuer, audience, expiry) and resolves req.user. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!jwks) {
    req.user = DEV_USER; // Auth0 not configured: local development only
    return next();
  }
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ error: 'missing_token' });
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer: `https://${config.auth0.domain}/`, audience: config.auth0.audience }));
    if (!payload.sub) throw new Error('no sub');
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
  try {
    const user = await resolveIdentity(payload);
    if (!user) {
      return res.status(403).json({ error: 'partner_not_linked', detail: 'user or organization is missing org_id, swift_user_id, servicenow_account_id or swift_reseller_id metadata' });
    }
    req.user = user;
    next();
  } catch (e) {
    console.error('identity lookup failed', e);
    res.status(502).json({ error: 'upstream_unavailable', system: 'auth0' });
  }
}
