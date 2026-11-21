import { Router, Request, Response, NextFunction } from 'express';
import * as cms from './adapters/cms.js';
import * as swift from './adapters/swift.js';
import * as salesforce from './adapters/salesforce.js';
import * as sn from './adapters/servicenow.js';
import * as cases from './adapters/servicenowCases.js';
import {
  CASE_CATEGORIES, CASE_PRIORITIES, CASE_STATUSES, IMPACT_LEVELS, URGENCY_LEVELS, CaseFilter, CasePriority, CaseStatus,
} from './cases.types.js';
import { UpstreamError } from './lib/httpClient.js';
import { config } from './config.js';
import {
  CANCELLATION_REASONS, ORDER_STATUSES, RESOURCE_CATEGORIES, SERVICE_STATUSES, VOLUME_RANGES,
  OrderFilter, OrderStatus, OrderUpdateFilter, ResourceCategory, ServiceFilter, ServiceStatus, VolumeRange,
} from './types.js';

export const api = Router();

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).then((body) => { if (!res.headersSent) res.json(body); }).catch(next);

class BadRequest extends Error {}
const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const int = (v: unknown, d: number, min: number, max: number) => {
  const n = Number(v); return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : d;
};
const date = (v: unknown) => { const s = str(v, 10); return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined; };
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined);
const dir = (v: unknown) => oneOf(v, ['asc', 'desc'] as const);
const paging = (q: Request['query'], size = 6) => ({ page: int(q.page, 1, 1, 10_000), pageSize: int(q.pageSize, size, 1, 100) });

// ---------- Home dashboard ----------
// One call for the whole home page; each widget fails independently so one slow
// or broken upstream does not blank the dashboard.
api.get('/dashboard', h(async (req) => {
  const u = req.user;
  const range = oneOf(req.query.range, VOLUME_RANGES) ?? 'last-month';
  const settle = async <T>(p: Promise<T>) => {
    try { return { ok: true as const, data: await p }; }
    catch (e) { console.error(e); return { ok: false as const, error: e instanceof UpstreamError ? e.system : 'internal' }; }
  };
  const [news, offers, recentQuotes, quoteHistory, productSummary, profile, contacts] = await Promise.all([
    settle(cms.getNews(u)), settle(cms.getOffers(u)),
    settle(swift.getRecentQuotes(u)), settle(swift.getQuoteHistory(u, range)), settle(swift.getProductSummary(u)),
    settle(salesforce.getAccountProfile(u)), settle(salesforce.getSupportContacts(u)),
  ]);
  return { news, offers, recentQuotes, quoteHistory, productSummary, profile, contacts };
}));

api.get('/me', h(async (req) => ({ userId: req.user.userId, orgId: req.user.orgId, name: req.user.name ?? 'there' })));
api.get('/quotes/history', h(async (req) => swift.getQuoteHistory(req.user, oneOf(req.query.range, VOLUME_RANGES) ?? ('last-month' as VolumeRange))));

// ---------- Resources ----------
api.get('/resources', h(async (req) => {
  const category = oneOf(req.query.category, RESOURCE_CATEGORIES) ?? ('quick-guides' as ResourceCategory);
  const { page, pageSize } = paging(req.query, 8);
  return cms.getResources(category, page, pageSize);
}));

// ---------- Connections: orders ----------
const orderFilter = (q: Request['query'], size?: number): OrderFilter => ({
  view: 'orders',
  partnerOrderRef: str(q.partnerOrderRef, 50), address: str(q.address), location: str(q.location),
  status: oneOf(q.status, ORDER_STATUSES) as OrderStatus | undefined,
  from: date(q.from), to: date(q.to),
  sort: oneOf(q.sort, ['location', 'postcode', 'quoteId', 'productName', 'status', 'createdAt'] as const), dir: dir(q.dir),
  ...paging(q, size),
});
api.get('/orders', h(async (req) => sn.listOrders(req.user, orderFilter(req.query))));
api.get('/orders/:id', h(async (req) => sn.getOrder(req.user, req.params.id)));

api.post('/orders/:id/appointment', h(async (req) => {
  const preferred = str(req.body?.preferred, 25);
  if (!preferred || Number.isNaN(Date.parse(preferred))) throw new BadRequest('preferred must be a date-time');
  if (Date.parse(preferred) < Date.now()) throw new BadRequest('preferred appointment must be in the future');
  if (req.body?.confirmed !== true) throw new BadRequest('details must be confirmed');
  return sn.amendAppointment(req.user, req.params.id, preferred);
}));
api.post('/orders/:id/contact', h(async (req) => {
  const firstName = str(req.body?.firstName, 60), lastName = str(req.body?.lastName, 60), telephone = str(req.body?.telephone, 20);
  if (!firstName || !lastName || !telephone || !/^[+\d][\d\s]{6,19}$/.test(telephone)) throw new BadRequest('first name, last name and a valid telephone are required');
  return sn.amendContact(req.user, req.params.id, { firstName, lastName, telephone });
}));
api.post('/orders/:id/comments', h(async (req) => {
  const comment = str(req.body?.comment, 2000);
  if (!comment) throw new BadRequest('comment is required');
  return sn.addOrderComment(req.user, req.params.id, comment);
}));
api.post('/orders/:id/cancel', h(async (req) => {
  const reason = oneOf(req.body?.reason, CANCELLATION_REASONS);
  if (!reason) throw new BadRequest('a valid cancellation reason is required');
  return sn.cancelOrder(req.user, req.params.id, reason);
}));

// ---------- Connections: order updates ----------
const updateFilter = (q: Request['query'], size?: number): OrderUpdateFilter => ({
  orderRef: str(q.orderRef, 50), stage: str(q.stage, 60), status: str(q.status, 40),
  from: date(q.from), to: date(q.to),
  sort: oneOf(q.sort, ['orderReference', 'update', 'stage', 'status', 'comment', 'raisedAt'] as const), dir: dir(q.dir),
  ...paging(q, size),
});
api.get('/order-updates', h(async (req) => sn.listOrderUpdates(req.user, updateFilter(req.query, 5))));

// ---------- Connections: live services ----------
const serviceFilter = (q: Request['query'], size?: number): ServiceFilter => ({
  quoteRef: str(q.quoteRef, 50), serviceRef: str(q.serviceRef, 50), address: str(q.address), location: str(q.location),
  status: oneOf(q.status, SERVICE_STATUSES) as ServiceStatus | undefined,
  from: date(q.from), to: date(q.to),
  sort: oneOf(q.sort, ['location', 'postcode', 'orderReference', 'serviceName', 'status'] as const), dir: dir(q.dir),
  ...paging(q, size),
});
api.get('/services', h(async (req) => sn.listServices(req.user, serviceFilter(req.query))));
api.get('/services/:id', h(async (req) => sn.getService(req.user, req.params.id)));
api.post('/services/:id/cease', h(async (req) => {
  const reason = oneOf(req.body?.reason, CANCELLATION_REASONS);
  if (!reason) throw new BadRequest('a valid cease reason is required');
  return sn.ceaseService(req.user, req.params.id, reason);
}));

// ---------- Connections: support cases ----------
const list = <T extends string>(v: unknown, allowed: readonly T[]) =>
  (typeof v === 'string' ? v.split(',') : []).filter((x): x is T => allowed.includes(x as T));
const caseFilter = (q: Request['query'], size?: number): CaseFilter => ({
  caseId: str(q.caseId, 20), serviceRef: str(q.serviceRef, 30),
  priorities: list<CasePriority>(q.priorities, CASE_PRIORITIES), statuses: list<CaseStatus>(q.statuses, CASE_STATUSES),
  from: date(q.from), to: date(q.to),
  sort: oneOf(q.sort, ['caseNumber', 'createdAt', 'summary', 'status'] as const), dir: dir(q.dir),
  ...paging(q, size),
});
api.get('/cases', h(async (req) => cases.listCases(req.user, caseFilter(req.query))));
api.get('/cases/options', h(async () => ({ categories: CASE_CATEGORIES, impact: IMPACT_LEVELS, urgency: URGENCY_LEVELS })));
api.get('/cases/:id', h(async (req) => cases.getCase(req.user, req.params.id)));
api.post('/cases', h(async (req, res) => {
  const b = req.body ?? {};
  const category = oneOf(b.category, CASE_CATEGORIES), impact = oneOf(b.impact, IMPACT_LEVELS), urgency = oneOf(b.urgency, URGENCY_LEVELS);
  const summary = str(b.summary, 160), detail = str(b.detail, 4000), serviceReference = str(b.serviceReference, 20)?.toUpperCase();
  if (!category || !impact || !urgency || !summary || !detail) throw new BadRequest('category, summary, detail, impact and urgency are required');
  if (!serviceReference || !/^SO\d{6,10}$/.test(serviceReference)) throw new BadRequest('service reference must look like SO00023456');
  res.status(201);
  return cases.createCase(req.user, { category, impact, urgency, summary, detail, serviceReference, partnerReference: str(b.partnerReference, 50) });
}));
api.post('/cases/:id/comments', h(async (req) => {
  const comment = str(req.body?.comment, 2000);
  if (!comment) throw new BadRequest('comment is required');
  return cases.respondToCase(req.user, req.params.id, comment);
}));

// ---------- CSV exports (all pages matching the current filters) ----------
const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
async function sendCsv<T>(res: Response, name: string, cols: [keyof T, string][], fetchPage: (page: number) => Promise<{ items: T[]; total: number }>) {
  const rows: T[] = [];
  for (let page = 1; page <= 100; page++) {
    const p = await fetchPage(page);
    rows.push(...p.items);
    if (rows.length >= p.total || p.items.length === 0) break;
  }
  const csv = [cols.map((c) => c[1]).join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c[0]])).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}
api.get('/orders.csv', h(async (req, res) => sendCsv(res, 'orders',
  [['location', 'Location'], ['postcode', 'Postcode'], ['partnerOrderRef', 'Partner order ref'], ['quoteId', 'Quote ID'], ['orderReference', 'Order reference'], ['productName', 'Product name'], ['status', 'Status']],
  (page) => sn.listOrders(req.user, { ...orderFilter(req.query), page, pageSize: 100 }))));
api.get('/order-updates.csv', h(async (req, res) => sendCsv(res, 'order-updates',
  [['orderReference', 'Order reference'], ['update', 'Update'], ['stage', 'Stage'], ['status', 'Status'], ['author', 'Author'], ['comment', 'Comment'], ['raisedAt', 'Date raised']],
  (page) => sn.listOrderUpdates(req.user, { ...updateFilter(req.query), page, pageSize: 100 }))));
api.get('/services.csv', h(async (req, res) => sendCsv(res, 'services',
  [['location', 'Location'], ['postcode', 'Postcode'], ['orderReference', 'Order reference'], ['serviceReference', 'Service reference'], ['serviceName', 'Service name'], ['status', 'Status']],
  (page) => sn.listServices(req.user, { ...serviceFilter(req.query), page, pageSize: 100 }))));

api.get('/cases.csv', h(async (req, res) => sendCsv(res, 'cases',
  [['caseNumber', 'Case ID'], ['createdAt', 'Date created'], ['serviceReference', 'Service reference'], ['summary', 'Case summary'], ['status', 'Status'], ['priority', 'Priority'], ['partnerContact', 'Partner contact']],
  (page) => cases.listCases(req.user, { ...caseFilter(req.query), page, pageSize: 100 }))));

// ---------- Errors ----------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof BadRequest) return res.status(400).json({ error: 'bad_request', message: err.message });
  if (err instanceof sn.NotFound) return res.status(404).json({ error: 'not_found' });
  if (err instanceof UpstreamError) {
    console.error(err.message);
    if (err.status === 404) return res.status(404).json({ error: 'not_found' });
    return res.status(502).json({ error: 'upstream_unavailable', system: err.system });
  }
  console.error(err);
  res.status(500).json({ error: 'internal' });
});

export const upstreamModes = () => ({
  cms: config.cms.useMock ? 'mock' : 'live',
  swift: config.swift.useMock ? 'mock' : 'live',
  salesforce: config.salesforce.useMock ? 'mock' : 'live',
  servicenow: config.servicenow.useMock ? 'mock' : 'live',
  auth0: config.auth0.enabled ? 'enabled' : 'dev-user',
});
