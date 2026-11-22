import { config } from '../config.js';
import { upstreamJson, UpstreamError } from '../lib/httpClient.js';
import { cached } from '../lib/cache.js';
import * as mock from '../mocks/gig.js';
import { can, type PortalUser } from '../auth.js';
import {
  GigError,
  type AppointmentQuery, type AppointmentsResponse, type CreateQuoteBody, type CreatedQuote, type GigAddress,
  type HistoryQuote, type PlaceOrderBody, type PlaceOrderResponse, type QuoteDetail, type QuoteQuery,
  type QuotesResponse, type Reservation, type ResellerHistoryResponse, type UserHistoryResponse,
} from '../types.js';

/**
 * Giganet Information Gateway (GIG, a.k.a. SWIFT) - implements these designs:
 *  - Check FTTP Availability : POST /api/postcodes/{postcode}, POST /api/v1/partner/quotes/
 *  - Retrieve Quotes         : GET  /api/v1/partner/quotes/{quote_ulid}
 *                              GET  /api/v1/partner/quotes/{swift_user_id}      (partner user)
 *                              GET  /api/v1/partner/quotes/{swift_reseller_id}  (partner admin)
 *  - Engineer Appointments   : GET/POST /api/v1/partner/{product_type}/appointments
 *  - Order Placement         : POST /api/v1/partner/{product_type}/orders
 *                              PATCH /api/v1/partner/fttp/orders/{ref}/end_customer_contact
 *                              POST  /api/v1/partner/fttp/orders/{ref}/cancel
 */
const up = config.gig;
const isAdmin = (u: PortalUser) => can(u, 'read:all-quotes');
const enc = encodeURIComponent;

/** Re-throw GIG's documented { code, reason } errors as GigError so the user sees the reason. */
async function gig<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof UpstreamError && e.status && e.status < 500 && e.reason) throw new GigError(e.status, e.reason);
    throw e;
  }
}

// ---------- addresses ----------
export async function findAddresses(postcode: string): Promise<{ addresses: GigAddress[] }> {
  if (up.useMock) return mock.mockAddresses(postcode);
  return cached(`gig:addr:${postcode}`, () =>
    gig(() => upstreamJson(up, `/api/postcodes/${enc(postcode)}`, { method: 'POST', body: { postcode }, retry: true })), 10 * 60_000);
}

// ---------- quotes ----------
export async function createQuote(u: PortalUser, body: CreateQuoteBody): Promise<CreatedQuote> {
  if (up.useMock) return mock.mockCreateQuote(u, body);
  return gig(() => upstreamJson(up, '/api/v1/partner/quotes/', { method: 'POST', body }));
}

async function history(u: PortalUser, wholeReseller: boolean): Promise<HistoryQuote[]> {
  if (wholeReseller) {
    const res: ResellerHistoryResponse = up.useMock
      ? mock.mockResellerHistory(u.swiftResellerId)
      : await cached(`gig:hist:r:${u.swiftResellerId}`, () =>
          upstreamJson(up, up.resellerHistoryPath.replace('{swift_reseller_id}', enc(u.swiftResellerId))), 15_000);
    return res.users.flatMap((x) => x.quotes);
  }
  const res: UserHistoryResponse = up.useMock
    ? mock.mockUserHistory(u.swiftUserId, u.swiftResellerId)
    : await cached(`gig:hist:u:${u.swiftUserId}`, () =>
        upstreamJson(up, up.userHistoryPath.replace('{swift_user_id}', enc(u.swiftUserId))), 15_000);
  return res.quotes;
}

/**
 * GET /api/v1/partner/quotes (portal) - Home "Recent quotes" (summary=true) and My Quotes
 * (summary=false). Partner users get their own history; partner admins get the whole
 * reseller's history unless they ask for owner=<their own id>. Filtering, sorting and paging
 * happen here because the GIG history endpoints don't document query parameters.
 */
export async function listQuotes(u: PortalUser, q: QuoteQuery): Promise<QuotesResponse> {
  const wholeReseller = isAdmin(u) && q.owner !== u.sub;
  const has = (v: string | undefined, s?: string) => !s || (v ?? '').toLowerCase().includes(s.toLowerCase());
  let rows = (await history(u, wholeReseller)).filter((r) =>
    (q.include_hidden || !r.hide_quote) &&
    has(r.quote_id, q.id) && has(r.customer_name, q.customer_name) &&
    has(r.post_code.replace(/\s/g, ''), q.postcode?.replace(/\s/g, '')) &&
    has(`${r.short_address} ${r.city}`, q.address) &&
    (!q.before || r.created_at <= q.before) && (!q.after || r.created_at >= q.after),
  );
  // ip_address: the GIG history rows don't include customer_ip yet, so this filter can't be applied
  if (q.sort === 'date') rows = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) * (q.order === 'desc' ? -1 : 1));
  const total = rows.length;
  if (q.limit) rows = rows.slice((q.page - 1) * q.limit, q.page * q.limit);
  return {
    partner_id: u.swiftResellerId, user_id: u.swiftUserId, page: q.page, limit: q.limit ?? null, total,
    quotes: q.summary ? rows.map((r) => ({ id: r.quote_id, postcode: r.post_code, created_at: r.created_at })) : rows,
  };
}

/** The caller may only open quotes that appear in the history they're allowed to see. */
async function assertVisible(u: PortalUser, id: string) {
  const rows = await history(u, isAdmin(u));
  if (!rows.some((r) => r.quote_id === id)) throw new GigError(404, 'Quote not found');
}

export async function getQuote(u: PortalUser, id: string): Promise<QuoteDetail> {
  if (up.useMock) {
    const q = mock.mockGetQuote(u, id, isAdmin(u));
    if (!q) throw new GigError(404, 'Quote not found');
    return q;
  }
  await assertVisible(u, id);
  return gig(() => upstreamJson(up, `/api/v1/partner/quotes/${enc(id)}`));
}

/** Hide/unhide a quote in My Quotes. ASSUMED endpoint: PATCH /api/v1/partner/quotes/{id} { hide_quote }. */
export async function setQuoteHidden(u: PortalUser, id: string, hide: boolean): Promise<HistoryQuote | { quote_id: string; hide_quote: boolean }> {
  if (up.useMock) {
    const r = mock.mockHideQuote(u, id, hide, isAdmin(u));
    if (!r) throw new GigError(404, 'Quote not found');
    return r;
  }
  await assertVisible(u, id);
  await gig(() => upstreamJson(up, `/api/v1/partner/quotes/${enc(id)}`, { method: 'PATCH', body: { hide_quote: hide } }));
  return { quote_id: id, hide_quote: hide };
}

// ---------- appointments ----------
/**
 * The design sends a GET *with a JSON body*, which browsers and Node's fetch can't do.
 * We send the same fields as query parameters - confirm GIG accepts them.
 */
export async function queryAppointments(productType: string, q: AppointmentQuery): Promise<AppointmentsResponse> {
  if (up.useMock) return mock.mockAppointments(q);
  return gig(() => upstreamJson(up, `/api/v1/partner/${enc(productType)}/appointments`, { query: { ...q } }));
}

export async function reserveAppointment(productType: string, body: AppointmentQuery & { end_datetime_iso: string; giganet_order_reference?: string }): Promise<Reservation> {
  if (up.useMock) return mock.mockReserve(body);
  const res = await gig(() => upstreamJson<{ data: unknown[]; status: string }>(up, `/api/v1/partner/${enc(productType)}/appointments`, { method: 'POST', body }));
  return parseReservation(res.data);
}

/** The design's example returns data: [[ "start_datetime_iso : ...", "reservation_key : ..." ]] - accept that or plain objects. */
function parseReservation(data: unknown[]): Reservation {
  const first = data?.[0];
  if (first && !Array.isArray(first) && typeof first === 'object') return first as Reservation;
  const entries = (Array.isArray(first) ? first : []).map((s) => String(s).split(/\s*:\s*(.+)/).slice(0, 2));
  const o = Object.fromEntries(entries) as Record<string, string>;
  if (!o.reservation_key) throw new GigError(502, 'Appointment reservation response was not understood');
  return { start_datetime_iso: o.start_datetime_iso, end_datetime_iso: o.end_datetime_iso, reservation_key: o.reservation_key, valid_until: o.valid_until };
}

// ---------- orders ----------
export async function placeOrder(u: PortalUser, productType: string, body: PlaceOrderBody): Promise<PlaceOrderResponse> {
  if (up.useMock) return mock.mockPlaceOrder(u, body, isAdmin(u));
  await assertVisible(u, body.product_order_item.quote_ulid);
  return gig(() => upstreamJson(up, `/api/v1/partner/${enc(productType)}/orders`, { method: 'POST', body }));
}

export async function amendOrderContact(orderRef: string, c: { firstName: string; lastName: string; telephone: string }) {
  return gig(() => upstreamJson(up, `/api/v1/partner/fttp/orders/${enc(orderRef)}/end_customer_contact`, {
    method: 'PATCH', body: { firstName: c.firstName, lastName: c.lastName, mobile_phone: c.telephone },
  }));
}

/** Orders Placed View design: partner comment on an order -> ServiceNow partner_updates/orders/comment */
export async function addOrderComment(body: { partner_id: string; giganet_order_reference: string; partner_order_reference: string; comment: string; partner_user: string }) {
  return gig(() => upstreamJson(up, '/api/v1/partner/fttp/orders/comment', { method: 'POST', body }));
}

export async function cancelOrder(orderRef: string, reason: string) {
  // GIG replies "Order Cancellation is pending" or rejects once past the point of no return
  return gig(() => upstreamJson(up, `/api/v1/partner/fttp/orders/${enc(orderRef)}/cancel`, { method: 'POST', body: { reason } }));
}
