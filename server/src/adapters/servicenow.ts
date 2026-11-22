import { config, UpstreamConfig } from '../config.js';
import { upstreamJson } from '../lib/httpClient.js';
import { clientCredentials } from '../lib/oauth.js';
import { mockCeaseService, mockServiceDetail, mockServices } from '../mocks/data.js';
import type { Page, Service, ServiceDetail, ServiceFilter } from '../types.js';
import type { PortalUser } from '../auth.js';

/**
 * ServiceNow connection shared by the orders, live-service and support-case adapters.
 *
 * Orders follow the Orders Placed View design (see adapters/orders.ts). Live services and
 * support cases have no design yet; they ASSUME a Scripted REST API under SN_API_PATH:
 *   GET  {path}/accounts/{acct}/services?...filters  -> Page<Service>
 *   GET  {path}/accounts/{acct}/services/{id}        -> ServiceDetail
 *   POST {path}/accounts/{acct}/services/{id}/cease  { reason } -> ServiceDetail
 */
const sn = config.servicenow;
const getToken = clientCredentials({
  system: 'servicenow', tokenUrl: `${sn.instanceUrl}/oauth_token.do`, clientId: sn.clientId, clientSecret: sn.clientSecret,
});
const authHeader = async () => `Bearer ${(await getToken()).value}`;

/** Assumed portal Scripted REST API (services, cases) */
export const snUpstream: UpstreamConfig = {
  name: 'servicenow', get baseUrl() { return sn.instanceUrl + sn.apiPath; }, useMock: sn.useMock, authHeader,
};
/** Instance root, for the GN Orders scripted endpoint /api/sn_ind_tmt_orm/orders */
export const snInstance: UpstreamConfig = {
  name: 'servicenow', get baseUrl() { return sn.instanceUrl; }, useMock: sn.useMock, authHeader,
};

const base = (u: PortalUser) => `/accounts/${encodeURIComponent(u.servicenowAccountId)}`;
const q = (f: object) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string | number>;

export class NotFound extends Error {}
export const orNotFound = <T>(v: T | undefined) => { if (!v) throw new NotFound(); return v; };

export async function listServices(user: PortalUser, f: ServiceFilter): Promise<Page<Service>> {
  if (snUpstream.useMock) return mockServices(f);
  return upstreamJson(snUpstream, `${base(user)}/services`, { query: q(f) });
}

export async function getService(user: PortalUser, id: string): Promise<ServiceDetail> {
  if (snUpstream.useMock) return orNotFound(mockServiceDetail(id));
  return upstreamJson(snUpstream, `${base(user)}/services/${encodeURIComponent(id)}`);
}

export async function ceaseService(user: PortalUser, id: string, reason: string): Promise<ServiceDetail> {
  if (snUpstream.useMock) return orNotFound(mockCeaseService(id, reason));
  return upstreamJson(snUpstream, `${base(user)}/services/${encodeURIComponent(id)}/cease`, {
    method: 'POST', body: { reason, requestedBy: user.userId },
  });
}
