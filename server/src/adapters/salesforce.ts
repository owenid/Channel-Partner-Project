import { config, UpstreamConfig } from '../config.js';
import { upstreamJson } from '../lib/httpClient.js';
import { cached } from '../lib/cache.js';
import { clientCredentials } from '../lib/oauth.js';
import { mockContacts, mockProfile } from '../mocks/data.js';
import type { AccountProfile, Contact, SupportContacts } from '../types.js';
import type { PortalUser } from '../auth.js';

/**
 * Salesforce adapter: account profile and account manager / support contacts.
 * Authenticates with the OAuth2 client-credentials flow (a Connected App with
 * "Enable Client Credentials Flow" and a run-as integration user).
 *
 * ASSUMED data model - adjust the SOQL once the org's schema is confirmed:
 *   Contact      : the portal user, matched on Auth0 user email (Contact.Email)
 *   Account      : the partner, matched on SF_SERVICENOW_ACCOUNT_FIELD = servicenow_account_id
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
interface SfContact { FirstName: string; LastName: string; Email: string; Title: string | null; Department: string | null }

const accountQuery = (u: PortalUser) =>
  `SELECT Name, Owner.Name, Owner.Email, Service_Manager__r.Name, Service_Manager__r.Email,
          Sales_Support_Executive__r.Name, Sales_Support_Executive__r.Email
     FROM Account WHERE ${sf.accountIdField} = '${esc(u.servicenowAccountId)}' LIMIT 1`;

const getAccount = (u: PortalUser) =>
  cached(`sf:account:${u.servicenowAccountId}`, async () => {
    const [acc] = await soql<SfAccount>(accountQuery(u));
    if (!acc) throw new Error(`No Salesforce account for ${u.servicenowAccountId}`);
    return acc;
  }, 5 * 60_000);

export async function getAccountProfile(user: PortalUser): Promise<AccountProfile> {
  if (up.useMock) return mockProfile;
  return cached(`sf:profile:${user.userId}`, async () => {
    const acc = await getAccount(user);
    const [c] = user.email
      ? await soql<SfContact>(
          `SELECT FirstName, LastName, Email, Title, Department FROM Contact
            WHERE Email = '${esc(user.email)}' AND Account.${sf.accountIdField} = '${esc(user.servicenowAccountId)}' LIMIT 1`,
        )
      : [];
    return {
      firstName: c?.FirstName ?? '', lastName: c?.LastName ?? '', email: c?.Email ?? user.email ?? '',
      partnerName: acc.Name, role: c?.Title ?? '', department: c?.Department ?? '',
    };
  }, 5 * 60_000);
}

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
