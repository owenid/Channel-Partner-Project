import { Router, Request, Response, NextFunction } from 'express';
import * as cms from './adapters/cms.js';
import * as swift from './adapters/swift.js';
import * as salesforce from './adapters/salesforce.js';
import * as auth0Mgmt from './adapters/auth0Mgmt.js';
import * as gig from './adapters/gig.js';
import { can } from './auth.js';
import * as sn from './adapters/servicenow.js';
import * as orders from './adapters/orders.js';
import * as updatesKsql from './adapters/orderUpdatesKsql.js';
import * as cases from './adapters/servicenowCases.js';
import * as svc from './adapters/serviceActions.js';
import { EFFECTIVE_MODES, SUSPEND_REASONS, UNSUSPEND_REASONS } from './types.js';
import {
  CASE_CATEGORIES, CASE_PRIORITIES, CASE_STATUSES, IMPACT_LEVELS, URGENCY_LEVELS, CaseFilter, CasePriority, CaseStatus,
} from './cases.types.js';
import { UpstreamError } from './lib/httpClient.js';
import { config } from './config.js';
import {
  CANCELLATION_REASONS, ORDER_STATUSES, RESOURCE_CATEGORIES, SERVICE_STATUSES, VOLUME_RANGES, GigError,
  HistoryQuote, OrderFilter, OrderStatus, OrderUpdateFilter, QuoteQuery, ResourceCategory, ServiceFilter, ServiceStatus, VolumeRange,
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

class Forbidden extends Error {}
const isoDateTime = (v: unknown) => { const s = str(v, 40); return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : undefined; };
const bool = (v: unknown) => v === true || v === 'true' || v === '1';
const POSTCODE = /^[A-Z0-9]{2,4} ?[A-Z0-9]{3}$/i; // lenient: the design's own example "PO4 AYZ" isn't a strict UK format
const PRODUCT_TYPES = ['fttp'] as const; // "product_type will always be fttp day 1" - add 'ethernet' later

// ---------- Identity ----------
api.get('/me', h(async (req) => ({
  userId: req.user.userId, orgId: req.user.orgId, name: req.user.name ?? 'there',
  role: can(req.user, 'read:all-quotes') ? 'partner-admin' : 'partner-user',
  permissions: req.user.permissions,
})));

// ---------- Home Page Menu design ----------
api.get('/portal/newsletter', h(async () => ({ results: await cms.getNewsletters() })));
api.get('/portal/offers', h(async () => ({ offers: await cms.getOffers() })));
api.get('/portal/profile', h(async (req) => auth0Mgmt.getAccountProfile(req.user)));
api.get('/portal/contacts', h(async (req) => salesforce.getSupportContacts(req.user)));
api.get('/portal/quote-volume', h(async (req) => swift.getQuoteHistory(req.user, oneOf(req.query.range, VOLUME_RANGES) ?? ('last-month' as VolumeRange))));
api.get('/portal/product-summary', h(async (req) => swift.getProductSummary(req.user)));

// ---------- Quotes (Home Page Menu + Retrieve Quotes designs) ----------
function quoteQuery(req: Request, defaults: { limit?: number } = {}): QuoteQuery {
  const q = req.query, u = req.user;
  if (!can(u, 'read:own-quotes') && !can(u, 'read:all-quotes')) throw new Forbidden('read:own-quotes or read:all-quotes is required');
  const owner = str(q.owner, 100);
  // A partner user may only ask for their own quotes; omitting owner means "mine" for them.
  if (owner && owner !== u.sub && !can(u, 'read:all-quotes')) throw new Forbidden('you can only view your own quotes');
  if (owner && owner !== u.sub) throw new BadRequest('filtering by another user is not supported yet - omit owner to see all partner quotes');
  if (q.summary !== undefined && q.summary !== 'true' && q.summary !== 'false') throw new BadRequest('summary must be true or false');
  if (q.sort !== undefined && q.sort !== 'date') throw new BadRequest('sort only accepts "date"');
  const limit = q.limit !== undefined ? int(q.limit, 10, 1, 100) : defaults.limit;
  return {
    owner, page: int(q.page, 1, 1, 10_000), limit,
    sort: q.sort === 'date' ? 'date' : undefined, order: dir(q.order) ?? 'asc',
    summary: q.summary === undefined ? true : q.summary === 'true',
    id: str(q.id, 40), address: str(q.address), ip_address: str(q.ip_address, 45),
    postcode: str(q.postcode, 10), customer_name: str(q.customer_name),
    before: isoDateTime(q.before), after: isoDateTime(q.after), include_hidden: bool(q.include_hidden),
  };
}
api.get('/partner/quotes', h(async (req) => gig.listQuotes(req.user, quoteQuery(req))));
api.get('/partner/quotes.csv', h(async (req, res) => {
  const all = await gig.listQuotes(req.user, { ...quoteQuery(req), summary: false, limit: undefined, page: 1 });
  const rows = all.quotes as HistoryQuote[];
  const cols: [keyof HistoryQuote, string][] = [['quote_id', 'ID'], ['search_type', 'Search type'], ['customer_name', 'Customer name'], ['short_address', 'Address'], ['city', 'City'], ['post_code', 'Post code'], ['created_at', 'Created at'], ['created_by', 'Created by']];
  sendCsvRows(res, 'quotes', cols, rows);
}));
api.get('/partner/quotes/:id', h(async (req) => gig.getQuote(req.user, req.params.id)));
api.post('/partner/quotes/:id/hide', h(async (req) => gig.setQuoteHidden(req.user, req.params.id, req.body?.hide !== false)));

// Check FTTP Availability: address lookup, then create a quote
api.post('/postcodes/:postcode', h(async (req) => {
  const pc = req.params.postcode.trim();
  if (!POSTCODE.test(pc)) throw new BadRequest('enter a valid UK postcode');
  return gig.findAddresses(pc.toUpperCase());
}));
api.post('/partner/quotes', h(async (req, res) => {
  const b = req.body ?? {};
  const address_key = str(String(b.address_key ?? ''), 30), postcode = str(b.postcode, 10);
  if (!address_key || !/^[A-Z0-9]+$/i.test(address_key)) throw new BadRequest('address_key (UPRN or Openreach address key) is required');
  if (!postcode || !POSTCODE.test(postcode)) throw new BadRequest('a valid postcode is required');
  const types = Array.isArray(b.product_types) ? b.product_types : [];
  if (types.some((t: unknown) => t !== 'fttp' && t !== 'ethernet')) throw new BadRequest('product_types may only contain fttp and ethernet');
  const promocode = str(b.promocode, 30);
  if (promocode && !/^[A-Z0-9-]+$/i.test(promocode)) throw new BadRequest('promo code may only contain letters, numbers and dashes');
  res.status(201);
  return gig.createQuote(req.user, {
    address_key, postcode: postcode.toUpperCase(), product_types: types.length ? types : undefined,
    promocode, customer_name: str(b.customer_name, 120),
  });
}));

// ---------- Engineer Appointments and Reservation design ----------
api.get('/partner/:productType/appointments', h(async (req) => {
  const productType = oneOf(req.params.productType, PRODUCT_TYPES);
  if (!productType) throw new BadRequest('product_type must be fttp');
  const q = req.query;
  const start = isoDateTime(q.start_datetime_iso) ?? new Date().toISOString();
  const address_key = str(q.address_key, 30), product_code = str(q.product_code, 40);
  if (!address_key || !product_code) throw new BadRequest('address_key and product_code are required');
  return gig.queryAppointments(productType, { start_datetime_iso: start, address_key, product_code, postcode: str(q.postcode, 10) });
}));
api.post('/partner/:productType/appointments', h(async (req) => {
  const productType = oneOf(req.params.productType, PRODUCT_TYPES);
  if (!productType) throw new BadRequest('product_type must be fttp');
  const b = req.body ?? {};
  const start = isoDateTime(b.start_datetime_iso), end = isoDateTime(b.end_datetime_iso);
  const address_key = str(String(b.address_key ?? ''), 30), product_code = str(b.product_code, 40);
  if (!start || !end || !address_key || !product_code) throw new BadRequest('start_datetime_iso, end_datetime_iso, address_key and product_code are required');
  return { data: [await gig.reserveAppointment(productType, { start_datetime_iso: start, end_datetime_iso: end, address_key, product_code, postcode: str(b.postcode, 10) })], status: 'success', code: 200, reason: 'Appointment Reserved' };
}));

// ---------- Order Placement design ----------
// "Place Order Now" = reserve the chosen slot (if any) and place the order, in one request.
api.post('/partner/:productType/orders', h(async (req, res) => {
  const productType = oneOf(req.params.productType, PRODUCT_TYPES);
  if (!productType) throw new BadRequest('product_type must be fttp');
  const b = req.body ?? {}, item = b.product_order_item ?? {}, c = item.end_customer_contact ?? {};
  const quote_ulid = str(item.quote_ulid, 40), code = str(item.partner_product_code, 40);
  const address_key = str(String(item.address_key ?? ''), 30), site = str(item.customer_site_name, 120);
  if (!quote_ulid || !code || !address_key || !site) throw new BadRequest('quote, product, address and customer site name are required');
  const contact = {
    firstName: str(c.firstName, 60), lastName: str(c.lastName, 60), email: str(c.email, 120),
    mobile_phone: str(c.mobile_phone, 20), home_phone: str(c.home_phone, 20),
  };
  if (!contact.firstName || !contact.lastName || !contact.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) throw new BadRequest('end customer first name, last name and a valid email are required');
  const phone = contact.mobile_phone ?? contact.home_phone;
  if (!phone || !/^[+\d][\d\s]{9,19}$/.test(phone)) throw new BadRequest('a valid mobile or home phone number is required');

  // the quote decides on-net (Giganet) vs off-net (e.g. CityFibre) and whether a slot is needed
  const quote = await gig.getQuote(req.user, quote_ulid);
  if (quote.address.addressKey && quote.address.addressKey !== address_key && quote.address.identifier.reference !== address_key) {
    throw new GigError(400, 'Address not found'); // same reason GIG uses, and before we reserve anything
  }
  const product = quote.quotes.find((p) => p.partner_product_code === code);
  if (!product || !(product.orderable === true || product.orderable === 1)) throw new BadRequest('Product not available');
  const onNet = product.carrier === 'Giganet';

  let reservation_key = str(item.engineer_appointment_reference, 80);
  const slot = item.appointment_slot as { start_datetime_iso?: string; end_datetime_iso?: string } | undefined;
  if (!reservation_key && slot?.start_datetime_iso && slot.end_datetime_iso) {
    const r = await gig.reserveAppointment(productType, {
      start_datetime_iso: isoDateTime(slot.start_datetime_iso)!, end_datetime_iso: isoDateTime(slot.end_datetime_iso)!,
      address_key, product_code: code, postcode: quote.address.postcode,
    });
    reservation_key = r.reservation_key;
  }
  const requested = isoDateTime(item.requested_install_datetime), asap = item.install_asap === true;
  if (!onNet && !reservation_key && !requested && !asap) throw new BadRequest('choose an engineer appointment, a requested install date or install ASAP');

  res.status(201);
  return gig.placeOrder(req.user, productType, {
    partner_reference: str(b.partner_reference, 50), notes: str(b.notes, 1000),
    product_order_item: {
      quote_ulid, partner_product_code: code, address_key, postcode: quote.address.postcode,
      customer_site_name: site,
      end_customer_contact: { firstName: contact.firstName, lastName: contact.lastName, email: contact.email, ...(contact.mobile_phone ? { mobile_phone: contact.mobile_phone } : { home_phone: contact.home_phone }) },
      engineer_appointment_reference: reservation_key, requested_install_datetime: requested, install_asap: asap || undefined,
      hazards: str(item.hazards, 1000), ont_ref: str(item.ont_ref, 40), ont_port: str(item.ont_port, 10),
    },
  });
}));

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
api.get('/orders', h(async (req) => orders.listOrders(req.user, orderFilter(req.query))));
api.get('/orders/:id', h(async (req) => orders.getOrder(req.user, req.params.id)));

// Amend install date: the user picks one of the slots returned by GET /partner/fttp/appointments
api.post('/orders/:id/appointment', h(async (req) => {
  const start = isoDateTime(req.body?.start_datetime_iso), end = isoDateTime(req.body?.end_datetime_iso);
  if (!start || !end || Date.parse(end) <= Date.parse(start)) throw new BadRequest('choose an appointment slot');
  if (Date.parse(start) < Date.now()) throw new BadRequest('the appointment must be in the future');
  if (req.body?.confirmed !== true) throw new BadRequest('details must be confirmed');
  return orders.amendAppointment(req.user, req.params.id, { start, end });
}));
api.post('/orders/:id/contact', h(async (req) => {
  const firstName = str(req.body?.firstName, 60), lastName = str(req.body?.lastName, 60), telephone = str(req.body?.telephone, 20);
  if (!firstName || !lastName || !telephone || !/^[+\d][\d\s]{6,19}$/.test(telephone)) throw new BadRequest('first name, last name and a valid telephone are required');
  return orders.amendContact(req.user, req.params.id, { firstName, lastName, telephone });
}));
api.post('/orders/:id/comments', h(async (req) => {
  const comment = str(req.body?.comment, 2000);
  if (!comment) throw new BadRequest('comment is required');
  return orders.addOrderComment(req.user, req.params.id, comment);
}));
api.post('/orders/:id/cancel', h(async (req) => {
  const reason = oneOf(req.body?.reason, CANCELLATION_REASONS);
  if (!reason) throw new BadRequest('a valid cancellation reason is required');
  return orders.cancelOrder(req.user, req.params.id, reason);
}));

// ---------- Connections: order updates ----------
const updateFilter = (q: Request['query'], size?: number): OrderUpdateFilter => ({
  orderRef: str(q.orderRef, 50), stage: str(q.stage, 60), status: str(q.status, 40),
  from: date(q.from), to: date(q.to),
  sort: oneOf(q.sort, ['orderReference', 'update', 'stage', 'status', 'comment', 'raisedAt'] as const), dir: dir(q.dir),
  ...paging(q, size),
});
api.get('/order-updates/options', h(async () => ({ states: updatesKsql.UPDATE_STATES, stages: updatesKsql.UPDATE_STAGES })));
api.get('/order-updates', h(async (req) => orders.listOrderUpdates(req.user, updateFilter(req.query, 5))));

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

// ---------- Live service: sessions, modify, suspend ----------
api.get('/services/:id/sessions', h(async (req) => {
  const { page, pageSize } = paging(req.query, 5);
  return svc.getSessions(req.user, req.params.id, page, pageSize);
}));
api.get('/services/:id/modify-options', h(async (req) => svc.getModifyOptions(req.user, req.params.id)));
api.post('/services/:id/modify', h(async (req) => {
  const productId = str(req.body?.productId, 40);
  const effectiveMode = oneOf(req.body?.effectiveMode, EFFECTIVE_MODES);
  if (!productId || !effectiveMode) throw new BadRequest('a new product and an effective mode are required');
  if (req.body?.confirmed !== true) throw new BadRequest('the change must be confirmed');
  const opts = await svc.getModifyOptions(req.user, req.params.id);
  if (!opts.products.some((p) => p.id === productId)) throw new BadRequest('that product is not available for this service');
  return svc.modifyService(req.user, req.params.id, productId, effectiveMode);
}));
api.post('/services/:id/suspension', h(async (req) => {
  const action = oneOf(req.body?.action, ['suspend', 'unsuspend'] as const);
  const reason = action === 'suspend' ? oneOf(req.body?.reason, SUSPEND_REASONS) : oneOf(req.body?.reason, UNSUSPEND_REASONS);
  if (!action || !reason) throw new BadRequest('a service type and a valid reason are required');
  if (req.body?.confirmed !== true) throw new BadRequest('the change must be confirmed');
  const current = await sn.getService(req.user, req.params.id);
  if (action === 'suspend' && current.status === 'Suspended') throw new BadRequest('service is already suspended');
  if (action === 'unsuspend' && current.status !== 'Suspended') throw new BadRequest('service is not suspended');
  return svc.setSuspension(req.user, req.params.id, action, reason);
}));
api.get('/suspension-reasons', h(async () => ({ suspend: SUSPEND_REASONS, unsuspend: UNSUSPEND_REASONS })));

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
function sendCsvRows<T>(res: Response, name: string, cols: [keyof T, string][], rows: T[]) {
  const csv = [cols.map((c) => c[1]).join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c[0]])).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}
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
  (page) => orders.listOrders(req.user, { ...orderFilter(req.query), page, pageSize: 100 }))));
api.get('/order-updates.csv', h(async (req, res) => sendCsv(res, 'order-updates',
  [['orderReference', 'Order reference'], ['update', 'Update'], ['stage', 'Stage'], ['status', 'Status'], ['author', 'Author'], ['comment', 'Comment'], ['raisedAt', 'Date raised']],
  (page) => orders.listOrderUpdates(req.user, { ...updateFilter(req.query), page, pageSize: 100 }))));
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
  if (err instanceof Forbidden) return res.status(403).json({ error: 'forbidden', message: err.message });
  if (err instanceof sn.NotFound) return res.status(404).json({ error: 'not_found' });
  // GIG business errors ("Product not available", "Appointment Not Available", ...) are shown to the user
  if (err instanceof GigError) return res.status(err.status >= 500 ? 502 : err.status).json({ error: 'gig', message: err.reason });
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
  gig: config.gig.useMock ? 'mock' : 'live',
  ksqldb: config.ksql.endpoint ? 'live' : 'mock',
  auth0: config.auth0.enabled ? 'enabled' : 'dev-user',
  auth0ManagementApi: config.auth0.profileFromMgmtApi ? 'live' : 'mock',
});
