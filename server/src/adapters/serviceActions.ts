import { upstreamJson } from '../lib/httpClient.js';
import { mockModifyOptions, mockModifyService, mockSessions, mockSuspension } from '../mocks/data.js';
import { snUpstream, NotFound } from './servicenow.js';
import type { EffectiveMode, ModifyOptions, Page, RadiusSession, ServiceDetail, SuspensionAction } from '../types.js';
import type { PortalUser } from '../auth.js';

/**
 * Live-service actions and session history (ServiceNow Scripted REST API - assumed contract):
 *
 *   GET  {path}/accounts/{acct}/services/{id}/sessions?page=&pageSize= -> Page<RadiusSession>
 *   GET  {path}/accounts/{acct}/services/{id}/modify-options           -> ModifyOptions
 *   POST {path}/accounts/{acct}/services/{id}/modify      { productId, effectiveMode }      -> ServiceDetail
 *   POST {path}/accounts/{acct}/services/{id}/suspension  { action: suspend|unsuspend, reason } -> ServiceDetail
 *
 * Radius session history may in practice come from the RADIUS/AAA platform rather than
 * ServiceNow; if so, point only getSessions at that system.
 */
const base = (u: PortalUser, id: string) =>
  `/accounts/${encodeURIComponent(u.servicenowAccountId)}/services/${encodeURIComponent(id)}`;
const orNotFound = <T>(v: T | undefined) => { if (!v) throw new NotFound(); return v; };

export async function getSessions(user: PortalUser, id: string, page: number, pageSize: number): Promise<Page<RadiusSession>> {
  if (snUpstream.useMock) return orNotFound(mockSessions(id, page, pageSize));
  return upstreamJson(snUpstream, `${base(user, id)}/sessions`, { query: { page, pageSize } });
}

export async function getModifyOptions(user: PortalUser, id: string): Promise<ModifyOptions> {
  if (snUpstream.useMock) return orNotFound(mockModifyOptions(id));
  return upstreamJson(snUpstream, `${base(user, id)}/modify-options`);
}

export async function modifyService(user: PortalUser, id: string, productId: string, effectiveMode: EffectiveMode): Promise<ServiceDetail> {
  if (snUpstream.useMock) return orNotFound(mockModifyService(id, productId, effectiveMode));
  return upstreamJson(snUpstream, `${base(user, id)}/modify`, { method: 'POST', body: { productId, effectiveMode, requestedBy: user.userId } });
}

export async function setSuspension(user: PortalUser, id: string, action: SuspensionAction, reason: string): Promise<ServiceDetail> {
  if (snUpstream.useMock) return orNotFound(mockSuspension(id, action));
  return upstreamJson(snUpstream, `${base(user, id)}/suspension`, { method: 'POST', body: { action, reason, requestedBy: user.userId } });
}
