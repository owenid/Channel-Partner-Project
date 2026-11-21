import { config, UpstreamConfig } from '../config.js';
import { upstreamJson } from '../lib/httpClient.js';
import { clientCredentials } from '../lib/oauth.js';
import {
  mockAddComment, mockAmendAppointment, mockAmendContact, mockCancel, mockCeaseService,
  mockOrderDetail, mockOrderUpdates, mockOrders, mockServiceDetail, mockServices,
} from '../mocks/data.js';
import type { Order, OrderDetail, OrderFilter, OrderUpdateFilter, OrderUpdateRow, Page, Service, ServiceDetail, ServiceFilter } from '../types.js';
import type { PortalUser } from '../auth.js';

/**
 * ServiceNow adapter: orders, order updates, live services and the actions on them.
 *
 * ASSUMPTION: the architecture diagram does not name the system of record for
 * orders/services. The Auth0 token carries servicenow_account_id, so this adapter
 * assumes a ServiceNow Scripted REST API (SN_API_PATH) that already returns
 * portal-shaped JSON. Every request passes the caller's account id, and the
 * ServiceNow side must reject records that belong to another account.
 *
 *   GET  {path}/accounts/{acct}/orders?...filters        -> Page<Order>
 *   GET  {path}/accounts/{acct}/orders/{id}              -> OrderDetail
 *   POST {path}/accounts/{acct}/orders/{id}/appointment  { preferred }           -> OrderDetail
 *   POST {path}/accounts/{acct}/orders/{id}/contact      { firstName, lastName, telephone } -> OrderDetail
 *   POST {path}/accounts/{acct}/orders/{id}/comments     { comment }             -> OrderDetail
 *   POST {path}/accounts/{acct}/orders/{id}/cancel       { reason }              -> OrderDetail
 *   GET  {path}/accounts/{acct}/order-updates?...filters -> Page<OrderUpdateRow>
 *   GET  {path}/accounts/{acct}/services?...filters      -> Page<Service>
 *   GET  {path}/accounts/{acct}/services/{id}            -> ServiceDetail
 *   POST {path}/accounts/{acct}/services/{id}/cease      { reason }              -> ServiceDetail
 */
const sn = config.servicenow;
const getToken = clientCredentials({
  system: 'servicenow', tokenUrl: `${sn.instanceUrl}/oauth_token.do`, clientId: sn.clientId, clientSecret: sn.clientSecret,
});
export const snUpstream: UpstreamConfig = {
  name: 'servicenow',
  get baseUrl() { return sn.instanceUrl + sn.apiPath; },
  useMock: sn.useMock,
  authHeader: async () => `Bearer ${(await getToken())!.value}`,
};

const base = (u: PortalUser) => `/accounts/${encodeURIComponent(u.servicenowAccountId)}`;
const q = (f: object) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string | number>;

export class NotFound extends Error {}
const orNotFound = <T>(v: T | undefined) => { if (!v) throw new NotFound(); return v; };

export async function listOrders(user: PortalUser, f: OrderFilter): Promise<Page<Order>> {
  if (snUpstream.useMock) return mockOrders(f);
  return upstreamJson(snUpstream, `${base(user)}/orders`, { query: q(f) });
}

export async function getOrder(user: PortalUser, id: string): Promise<OrderDetail> {
  if (snUpstream.useMock) return orNotFound(mockOrderDetail(id));
  return upstreamJson(snUpstream, `${base(user)}/orders/${encodeURIComponent(id)}`);
}

export async function amendAppointment(user: PortalUser, id: string, preferred: string): Promise<OrderDetail> {
  if (snUpstream.useMock) return orNotFound(mockAmendAppointment(id, preferred, user.name ?? user.userId));
  return upstreamJson(snUpstream, `${base(user)}/orders/${encodeURIComponent(id)}/appointment`, {
    method: 'POST', body: { preferred, requestedBy: user.userId },
  });
}

export async function amendContact(user: PortalUser, id: string, c: OrderDetail['contact']): Promise<OrderDetail> {
  if (snUpstream.useMock) return orNotFound(mockAmendContact(id, c, user.name ?? user.userId));
  return upstreamJson(snUpstream, `${base(user)}/orders/${encodeURIComponent(id)}/contact`, {
    method: 'POST', body: { ...c, requestedBy: user.userId },
  });
}

export async function addOrderComment(user: PortalUser, id: string, comment: string): Promise<OrderDetail> {
  if (snUpstream.useMock) return orNotFound(mockAddComment(id, comment, user.name ?? user.userId));
  return upstreamJson(snUpstream, `${base(user)}/orders/${encodeURIComponent(id)}/comments`, {
    method: 'POST', body: { comment, requestedBy: user.userId },
  });
}

export async function cancelOrder(user: PortalUser, id: string, reason: string): Promise<OrderDetail> {
  if (snUpstream.useMock) return orNotFound(mockCancel(id, reason, user.name ?? user.userId));
  return upstreamJson(snUpstream, `${base(user)}/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST', body: { reason, requestedBy: user.userId },
  });
}

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

export async function listOrderUpdates(user: PortalUser, f: OrderUpdateFilter): Promise<Page<OrderUpdateRow>> {
  if (snUpstream.useMock) return mockOrderUpdates(f);
  return upstreamJson(snUpstream, `${base(user)}/order-updates`, { query: q(f) });
}
