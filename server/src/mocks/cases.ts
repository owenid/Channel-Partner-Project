import type { CaseDetail, CaseFilter, CasePriority, CaseStatus, CaseUpdate, NewCase, SupportCase } from '../cases.types.js';

const statuses: CaseStatus[] = ['New', 'In progress', 'Awaiting customer', 'Awaiting supplier', 'On hold - scheduled', 'Resolved'];
const priorities: CasePriority[] = ['Critical', 'High', 'Moderate', 'Low', 'Critical', 'None'];
const firstNums = ['123456', '345678', '789012', '134567', '345679', '124578'];
const updateTemplate: [CaseStatus, string, CaseUpdate['authorType'], string][] = [
  ['New', 'Owen Idehen', 'agent', 'Please pick another date as the initial date you picked is not currently available. You can do this using the partner portal by navigating to the connections menu.'],
  ['In progress', 'Customer', 'customer', 'This is an example comment that a customer has sent.'],
  ['Awaiting customer', 'System', 'system', "The status of this case has been updated to 'Awaiting customer'."],
  ['In progress', 'Customer', 'customer', 'This is an example comment that a customer has sent.'],
  ['Awaiting customer', 'System', 'system', "The status of this case has been updated to 'Awaiting customer'."],
];

const cases: CaseDetail[] = Array.from({ length: 42 }, (_, i) => ({
  id: `case-${i + 1}`,
  caseNumber: i < 6 ? firstNums[i] : String(200000 + i * 137),
  createdAt: new Date(Date.UTC(2023, 3, 9 - (i % 9), 9, 4)).toISOString(),
  serviceReference: 'SO00023456',
  summary: 'Example case summary text for this table',
  status: statuses[i % 6], priority: priorities[i % 6], partnerContact: 'Example name',
  lastUpdated: '2023-03-12T10:00:00Z', resolvedAt: statuses[i % 6] === 'Resolved' ? '2023-03-12T10:00:00Z' : null,
  description: 'Customer reports intermittent loss of service since the morning of 9 April. Router has been power-cycled with no change.',
  category: 'Fault - degraded service', partnerReference: 'XYZ-CASE-001', impact: '2 - Medium', urgency: '2 - Medium',
  updates: updateTemplate.map(([status, author, authorType, comment], j) => ({
    id: `case-${i + 1}-u${j}`, updatedAt: '2023-04-09T09:04:00', summary: 'Example case summary text for this table',
    status, comment, author, authorType, updatedBy: 'Example name',
  })),
}));

const toSummary = ({ id, caseNumber, createdAt, serviceReference, summary, status, priority, partnerContact }: CaseDetail): SupportCase =>
  ({ id, caseNumber, createdAt, serviceReference, summary, status, priority, partnerContact });

export function mockCases(f: CaseFilter) {
  const has = (v: string, q?: string) => !q || v.toLowerCase().includes(q.toLowerCase().replace(/^#/, ''));
  let rows = cases.filter((c) =>
    has(c.caseNumber, f.caseId) && has(c.serviceReference, f.serviceRef) &&
    (!f.priorities?.length || f.priorities.includes(c.priority)) &&
    (!f.statuses?.length || f.statuses.includes(c.status)) &&
    (!f.from || c.createdAt >= f.from) && (!f.to || c.createdAt.slice(0, 10) <= f.to),
  ).map(toSummary);
  if (f.sort) {
    const k = f.sort; const m = f.dir === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => String(a[k]).localeCompare(String(b[k]), 'en', { numeric: true }) * m);
  }
  const start = (f.page - 1) * f.pageSize;
  return { items: rows.slice(start, start + f.pageSize), page: f.page, pageSize: f.pageSize, total: rows.length };
}

export const mockCase = (id: string) => cases.find((c) => c.id === id);

/** ServiceNow-style priority matrix: impact x urgency */
const priorityFrom = (impact: string, urgency: string): CasePriority =>
  (['Critical', 'High', 'Moderate', 'Low', 'None'] as CasePriority[])[Math.min(4, Number(impact[0]) + Number(urgency[0]) - 2)];

export function mockCreateCase(c: NewCase, contact: string): CaseDetail {
  const now = new Date().toISOString();
  const d: CaseDetail = {
    id: `case-${cases.length + 1}`, caseNumber: String(300000 + cases.length), createdAt: now,
    serviceReference: c.serviceReference, summary: c.summary, status: 'New', priority: priorityFrom(c.impact, c.urgency),
    partnerContact: contact, lastUpdated: now, resolvedAt: null, description: c.detail, category: c.category,
    partnerReference: c.partnerReference ?? '', impact: c.impact, urgency: c.urgency,
    updates: [{ id: `new-${cases.length}`, updatedAt: now, summary: c.summary, status: 'New', comment: 'Case created via partner portal.', author: 'System', authorType: 'system', updatedBy: contact }],
  };
  cases.unshift(d);
  return d;
}

export function mockRespondToCase(id: string, comment: string, contact: string) {
  const d = mockCase(id);
  if (!d) return undefined;
  d.lastUpdated = new Date().toISOString();
  d.updates.unshift({ id: `${id}-u${d.updates.length}`, updatedAt: d.lastUpdated, summary: d.summary, status: d.status, comment, author: 'Customer', authorType: 'customer', updatedBy: contact });
  return d;
}
