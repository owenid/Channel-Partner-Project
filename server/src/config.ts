const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);
const str = (k: string, d = '') => process.env[k] ?? d;

export interface UpstreamConfig {
  name: string;
  baseUrl: string;
  /** true when no base URL is configured: the adapter serves mock data */
  useMock: boolean;
  /** returns the Authorization header value for a request */
  authHeader: () => Promise<string | undefined>;
}

const staticBearer = (key: string) => async () => (key ? `Bearer ${key}` : undefined);

export const config = {
  port: num(process.env.PORT, 4000),
  corsOrigin: str('CORS_ORIGIN', 'http://localhost:5173'),
  timeoutMs: num(process.env.UPSTREAM_TIMEOUT_MS, 5000),
  retries: num(process.env.UPSTREAM_RETRIES, 2),
  cacheTtlMs: num(process.env.CACHE_TTL_SECONDS, 60) * 1000,

  auth0: {
    domain: str('AUTH0_DOMAIN'), // e.g. your-tenant.eu.auth0.com
    audience: str('AUTH0_AUDIENCE'), // API identifier configured in Auth0
    /** namespace used for custom claims added by an Auth0 Action */
    claimNamespace: str('AUTH0_CLAIM_NAMESPACE', 'https://portal/'),
    get enabled() { return !!this.domain && !!this.audience; },
    /** overridable for local testing against a fake Auth0; defaults follow the tenant domain */
    get issuer() { return process.env.AUTH0_ISSUER || `https://${this.domain}/`; },
    get jwksUri() { return process.env.AUTH0_JWKS_URI || `https://${this.domain}/.well-known/jwks.json`; },
    /** Machine-to-machine app (read:users) used to read user_metadata for the Account profile */
    mgmtClientId: str('AUTH0_MGMT_CLIENT_ID'),
    mgmtClientSecret: str('AUTH0_MGMT_CLIENT_SECRET'),
    get profileFromMgmtApi() { return !!this.domain && !!this.mgmtClientId; },
  },

  cms: {
    name: 'cms',
    baseUrl: str('CMS_BASE_URL').replace(/\/$/, ''), // e.g. https://cms.example.com
    get useMock() { return !this.baseUrl; },
    authHeader: staticBearer(str('CMS_API_TOKEN')),
    /** Drupal JSON:API resources from the Home Page Menu design */
    newslettersPath: str('CMS_NEWSLETTERS_PATH', '/drupalwebsite/jsonapi/node/newsletters'),
    offersPath: str('CMS_OFFERS_PATH', '/drupalwebsite/jsonapi/node/offers'),
  } as UpstreamConfig & { newslettersPath: string; offersPath: string },

  /** Giganet Information Gateway - quotes, addresses, appointments, orders (falls back to SWIFT_*) */
  gig: {
    name: 'gig',
    baseUrl: (process.env.GIG_BASE_URL ?? str('SWIFT_BASE_URL')).replace(/\/$/, ''),
    get useMock() { return !this.baseUrl; },
    authHeader: staticBearer(process.env.GIG_API_KEY ?? str('SWIFT_API_KEY')),
    // The Retrieve Quotes design uses /api/v1/partner/quotes/{id} for user history, reseller
    // history AND quote detail; these are configurable until GIG confirms the real paths.
    userHistoryPath: str('GIG_USER_HISTORY_PATH', '/api/v1/partner/quotes/{swift_user_id}'),
    resellerHistoryPath: str('GIG_RESELLER_HISTORY_PATH', '/api/v1/partner/quotes/{swift_reseller_id}'),
  } as UpstreamConfig & { userHistoryPath: string; resellerHistoryPath: string },

  swift: {
    name: 'swift',
    baseUrl: str('SWIFT_BASE_URL').replace(/\/$/, ''),
    get useMock() { return !this.baseUrl; },
    authHeader: staticBearer(str('SWIFT_API_KEY')),
  } as UpstreamConfig,

  servicenow: {
    instanceUrl: str('SN_INSTANCE_URL').replace(/\/$/, ''), // e.g. https://yourco.service-now.com
    clientId: str('SN_CLIENT_ID'),
    clientSecret: str('SN_CLIENT_SECRET'),
    /** Scripted REST API base path that fronts orders/services for the portal */
    apiPath: str('SN_API_PATH', '/api/x_partner_portal/v1'),
    get useMock() { return !this.instanceUrl || !this.clientId; },
  },

  /** Confluent Cloud ksqlDB holding the ServiceNow order status updates stream */
  ksql: {
    endpoint: str('KSQL_ENDPOINT'), // e.g. https://pksqlc-xxxxx.eu-west-2.aws.confluent.cloud:443
    apiKey: str('KSQL_API_KEY'),
    apiSecret: str('KSQL_API_SECRET'),
    stream: str('KSQL_STREAM', 'SERVICENOW_ORDER_UPDATES_STREAM'),
  },

  salesforce: {
    loginUrl: str('SF_LOGIN_URL', 'https://login.salesforce.com'),
    instanceUrl: str('SF_INSTANCE_URL').replace(/\/$/, ''),
    clientId: str('SF_CLIENT_ID'),
    clientSecret: str('SF_CLIENT_SECRET'),
    apiVersion: str('SF_API_VERSION', 'v60.0'),
    /** custom field on Account that holds the ServiceNow account id from the Auth0 token */
    accountIdField: str('SF_SERVICENOW_ACCOUNT_FIELD', 'ServiceNow_Account_Id__c'),
    get useMock() { return !this.instanceUrl || !this.clientId; },
  },
};
