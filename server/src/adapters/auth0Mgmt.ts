import { config, UpstreamConfig } from '../config.js';
import { upstreamJson } from '../lib/httpClient.js';
import { cached } from '../lib/cache.js';
import { clientCredentials } from '../lib/oauth.js';
import type { AccountProfile } from '../types.js';

/**
 * Auth0 Management API - per the "Orders Placed View" and "Home Page Menu" designs:
 *   GET /api/v2/users/{user_id}         -> user_metadata { org_id, swift_user_id, role, department, phone_number }
 *   GET /api/v2/organizations/{org_id}  -> display_name + metadata { salesforce_account_id, servicenow_account_id, swift_reseller_id }
 * Needs a machine-to-machine app with read:users and read:organizations.
 */
const a0 = config.auth0;
const getToken = clientCredentials({
  system: 'auth0',
  tokenUrl: `https://${a0.domain}/oauth/token`,
  clientId: a0.mgmtClientId,
  clientSecret: a0.mgmtClientSecret,
  audience: `https://${a0.domain}/api/v2/`,
});
const up: UpstreamConfig = {
  name: 'auth0',
  baseUrl: `https://${a0.domain}/api/v2`,
  useMock: !a0.profileFromMgmtApi,
  authHeader: async () => `Bearer ${(await getToken()).value}`,
};
export const mgmtApiEnabled = !up.useMock;

export interface Auth0UserRecord {
  user_id: string; email?: string; name?: string; given_name?: string; family_name?: string;
  user_metadata?: Partial<Record<'org_id' | 'swift_user_id' | 'role' | 'department' | 'phone_number' | 'first_name' | 'last_name', string>>;
}
export interface Auth0Organization {
  id: string; name: string; display_name?: string;
  metadata?: Partial<Record<'salesforce_account_id' | 'servicenow_account_id' | 'swift_reseller_id', string>>;
}

const TTL = 5 * 60_000;
export const getUserRecord = (sub: string) =>
  cached(`auth0:user:${sub}`, () => upstreamJson<Auth0UserRecord>(up, `/users/${encodeURIComponent(sub)}`), TTL);
export const getOrganization = (orgId: string) =>
  cached(`auth0:org:${orgId}`, () => upstreamJson<Auth0Organization>(up, `/organizations/${encodeURIComponent(orgId)}`), TTL);

const MOCK_PROFILE: AccountProfile = {
  firstName: 'John', lastName: 'Doe', email: 'john.doe@xyzcomms.co.uk',
  partnerName: 'XYZ Comms', role: 'Customer Relationship Manager', department: 'Accounts',
};

/** Account profile card: Auth0 user metadata + organisation display name. */
export async function getAccountProfile(u: { sub: string; orgId: string; email?: string }): Promise<AccountProfile> {
  if (up.useMock) return MOCK_PROFILE;
  const [user, org] = await Promise.all([getUserRecord(u.sub), getOrganization(u.orgId)]);
  const m = user.user_metadata ?? {};
  return {
    firstName: m.first_name ?? user.given_name ?? '', lastName: m.last_name ?? user.family_name ?? '',
    email: user.email ?? u.email ?? '', partnerName: org.display_name ?? org.name,
    role: m.role ?? '', department: m.department ?? '',
  };
}
