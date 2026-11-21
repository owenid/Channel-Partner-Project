import { upstreamJson } from '../lib/httpClient.js';
import { mockCase, mockCases, mockCreateCase, mockRespondToCase } from '../mocks/cases.js';
import { snUpstream, NotFound } from './servicenow.js';
import type { CaseDetail, CaseFilter, NewCase, SupportCase } from '../cases.types.js';
import type { Page } from '../types.js';
import type { PortalUser } from '../auth.js';

/**
 * ServiceNow support cases (Customer Service Management cases or incidents).
 *
 * ASSUMED contract on the same Scripted REST API as orders/services:
 *   GET  {path}/accounts/{acct}/cases?caseId=&serviceRef=&priorities=a,b&statuses=a,b&from=&to=&sort=&dir=&page=&pageSize=
 *   GET  {path}/accounts/{acct}/cases/{id}
 *   POST {path}/accounts/{acct}/cases                { category, summary, detail, impact, urgency, serviceReference, partnerReference }
 *   POST {path}/accounts/{acct}/cases/{id}/comments  { comment }
 * Priority is derived by ServiceNow from impact x urgency.
 */
const base = (u: PortalUser) => `/accounts/${encodeURIComponent(u.servicenowAccountId)}/cases`;
const orNotFound = <T>(v: T | undefined) => { if (!v) throw new NotFound(); return v; };
const who = (u: PortalUser) => u.name ?? u.userId;

export async function listCases(user: PortalUser, f: CaseFilter): Promise<Page<SupportCase>> {
  if (snUpstream.useMock) return mockCases(f);
  const { priorities, statuses, ...rest } = f;
  const query = Object.fromEntries(
    Object.entries({ ...rest, priorities: priorities?.join(','), statuses: statuses?.join(',') }).filter(([, v]) => v !== undefined && v !== ''),
  ) as Record<string, string | number>;
  return upstreamJson(snUpstream, base(user), { query });
}

export async function getCase(user: PortalUser, id: string): Promise<CaseDetail> {
  if (snUpstream.useMock) return orNotFound(mockCase(id));
  return upstreamJson(snUpstream, `${base(user)}/${encodeURIComponent(id)}`);
}

export async function createCase(user: PortalUser, c: NewCase): Promise<CaseDetail> {
  if (snUpstream.useMock) return mockCreateCase(c, who(user));
  return upstreamJson(snUpstream, base(user), { method: 'POST', body: { ...c, requestedBy: user.userId } });
}

export async function respondToCase(user: PortalUser, id: string, comment: string): Promise<CaseDetail> {
  if (snUpstream.useMock) return orNotFound(mockRespondToCase(id, comment, who(user)));
  return upstreamJson(snUpstream, `${base(user)}/${encodeURIComponent(id)}/comments`, { method: 'POST', body: { comment, requestedBy: user.userId } });
}
