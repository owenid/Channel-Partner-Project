import { config, UpstreamConfig } from '../config.js';
import { upstreamJson } from '../lib/httpClient.js';
import { cached } from '../lib/cache.js';
import { clientCredentials } from '../lib/oauth.js';
import { mockContacts } from '../mocks/data.js';
import type { Contact, SupportContacts } from '../types.js';
import type { PortalUser } from '../auth.js';

/**
 * Salesforce adapter: account manager / channel support contacts (Home Page Menu design, section F).
 * The account profile itself comes from Auth0 (adapters/auth0Mgmt.ts).
 * Authenticates with the OAuth2 client-credentials flow (a Connected App with
 * "Enable Client Credentials Flow" and a run-as integration user).
 *
 * ASSUMED data model - adjust the SOQL once the org's schema is confirmed:
 *   Account      : the partner, by Id = salesforce_account_id from the Auth0 organization metadata
 *                  (falls back to SF_SERVICENOW_ACCOUNT_FIELD = servicenow_account_id)
 *   Account.Owner                     -> "Account Owner"
 *   Account.Service_Manager__r        -> "Service Manager"          (custom lookup to User)
 *   Account.Sales_Support_Executive__r -> "Sales Support Executive" (custom lookup to User)
 */
const sf = config.salesforce;
const getToken = clientCredentials({
  system: 'salesforce',
  tokenUrl: `${sf.loginUrl}/services/oauth2/token`,
  clientId: sf.clientId,
  clientSecret: sf.clientSecret,
});

const up: UpstreamConfig = {
  name: 'salesforce',
  get baseUrl() { return sf.instanceUrl; },
  useMock: sf.useMock,
  authHeader: async () => `Bearer ${(await getToken())!.value}`,
};

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const soql = <T>(q: string) =>
  upstreamJson<{ records: T[] }>(up, `/services/data/${sf.apiVersion}/query`, { query: { q } }).then((r) => r.records);

interface SfUser { Name: string; Email: string }
interface SfAccount {
  Name: string;
  Owner: SfUser | null;
  Service_Manager__r: SfUser | null;
  Sales_Support_Executive__r: SfUser | null;
}
const accountQuery = (u: PortalUser) =>
  `SELECT Name, Owner.Name, Owner.Email, Service_Manager__r.Name, Service_Manager__r.Email,
          Sales_Support_Executive__r.Name, Sales_Support_Executive__r.Email
     FROM Account WHERE ${u.salesforceAccountId ? `Id = '${esc(u.salesforceAccountId)}'` : `${sf.accountIdField} = '${esc(u.servicenowAccountId)}'`} LIMIT 1`;

const getAccount = (u: PortalUser) =>
  cached(`sf:account:${u.salesforceAccountId ?? u.servicenowAccountId}`, async () => {
    const [acc] = await soql<SfAccount>(accountQuery(u));
    if (!acc) throw new Error(`No Salesforce account for partner ${u.orgId}`);
    return acc;
  }, 5 * 60_000);

export async function getSupportContacts(user: PortalUser): Promise<SupportContacts> {
  if (up.useMock) return mockContacts;
  const acc = await getAccount(user);
  const contacts: Contact[] = [];
  const add = (role: string, u: SfUser | null) => u && contacts.push({ role, name: u.Name, email: u.Email });
  add('Account Owner', acc.Owner);
  add('Service Manager', acc.Service_Manager__r);
  add('Sales Support Executive', acc.Sales_Support_Executive__r);
  return { contacts, websiteUrl: process.env.COMPANY_WEBSITE_URL ?? 'https://www.giganet.uk' };
}
