import { upstreamJson } from '../lib/httpClient.js';
import { cached } from '../lib/cache.js';
import { statusLabel, statusPath } from '../lib/orderPath.js';
import {
  mockAddComment, mockAmendAppointment, mockAmendContact, mockCancel, mockOrderDetail, mockOrderUpdates, mockOrders,
} from '../mocks/data.js';
import type { Order, OrderDetail, OrderFilter, OrderUpdateFilter, OrderUpdateRow, Page } from '../types.js';
import type { PortalUser } from '../auth.js';
import { snInstance, NotFound, orNotFound } from './servicenow.js';
import * as updatesKsql from './orderUpdatesKsql.js';
import * as gig from './gig.js';

/**
 * Orders - per the "Orders Placed View" design:
 *  - list:    ServiceNow GN Orders scripted endpoint
 *             GET /api/sn_ind_tmt_orm/orders?sysparm_query=partner={servicenow_account_id}^ORDERBYDESCorder_date&page=&per_page=&summary=true
 *  - detail:  GET /api/sn_ind_tmt_orm/orders?sysparm_query=partner={sn}^order_id={giganet_order_reference}&summary=false
 *             + order status updates from Confluent ksqlDB (status bar + update history)
 *  - comment: SWIFT/GIG POST /api/v1/partner/fttp/orders/comment
 *  - amend install date / contact, cancel: GIG (Order Placement design)
 *
 * UI field mapping (from the design): Location=city, Postcode=zip, Quote ID=quote_id,
 * Partner order ref=external_id, Giganet order ref=order_id, Product=name, Status=stage.
 * Field names on the scripted endpoint's response are otherwise ASSUMED - see toOrder/toDetail.
 */
const ORDERS_PATH = '/api/sn_ind_tmt_orm/orders';
const useMock = snInstance.useMock;

type SnRow = Record<string, unknown>;
const s = (v: unknown): string => {
  if (v && typeof v === 'object' && 'display_value' in v) return String((v as { display_value: unknown }).display_value ?? '');
  return v === null || v === undefined ? '' : String(v);
};
/** values go inside a ServiceNow encoded query, where ^ and = are operators */
const enc = (v: string) => v.replace(/[\^=\n\r]/g, '');
const snDate = (v: string) => (v ? new Date(v.replace(' ', 'T') + (v.includes('Z') ? '' : 'Z')).toISOString() : '');

function toOrder(r: SnRow): Order {
  const stage = s(r.stage ?? r.order_line_stage), state = s(r.state);
  return {
    id: s(r.order_id ?? r.number),
    location: s(r.city ?? r.location),
    postcode: s(r.zip ?? r.postcode),
    partnerOrderRef: s(r.external_id),
    quoteId: s(r.quote_id),
    orderReference: s(r.order_id ?? r.number),
    productName: s(r.name ?? r.product_name),
    status: (stage ? statusLabel(stage, state) : s(r.status) || 'In progress') as Order['status'],
    createdAt: snDate(s(r.order_date ?? r.sys_created_on)),
  };
}

const SORT_FIELDS: Partial<Record<keyof Order, string>> = {
  location: 'city', postcode: 'zip', quoteId: 'quote_id', productName: 'name', status: 'stage', createdAt: 'order_date',
};

export async function listOrders(u: PortalUser, f: OrderFilter): Promise<Page<Order>> {
  if (useMock) return mockOrders(f);
  const parts = [`partner=${enc(u.servicenowAccountId)}`];
  if (f.partnerOrderRef) parts.push(`order_idLIKE${enc(f.partnerOrderRef)}^ORexternal_idLIKE${enc(f.partnerOrderRef)}`);
  if (f.address) parts.push(`zipLIKE${enc(f.address)}^ORcityLIKE${enc(f.address)}`);
  if (f.location) parts.push(`cityLIKE${enc(f.location)}`);
  if (f.from) parts.push(`order_date>=${f.from} 00:00:00`);
  if (f.to) parts.push(`order_date<=${f.to} 23:59:59`);
  const sort = (f.sort && SORT_FIELDS[f.sort]) ?? 'order_date';
  parts.push(`${f.dir === 'asc' ? 'ORDERBY' : 'ORDERBYDESC'}${sort}`);
  const res = await upstreamJson<{ result: SnRow[]; total?: number | string }>(snInstance, ORDERS_PATH, {
    query: { sysparm_query: parts.join('^'), page: f.page, per_page: f.pageSize, summary: 'true' },
  });
  let items = res.result.map(toOrder);
  if (f.status) items = items.filter((o) => o.status === f.status); // status is derived from stage
  return { items, page: f.page, pageSize: f.pageSize, total: Number(res.total ?? items.length) };
}

function toDetail(r: SnRow, base: Order): Omit<OrderDetail, 'updates' | 'orderStage' | 'orderLineState' | 'statusPath'> {
  const start = s(r.installation_start ?? r.appointment_start);
  return {
    ...base,
    customerName: s(r.customer_site_name ?? r.customer_name ?? r.u_premises_name),
    address: s(r.u_display_name ?? r.address ?? r.street),
    city: base.location,
    datePlaced: base.createdAt,
    dateInstalled: s(r.actual_end_date) ? snDate(s(r.actual_end_date)) : null,
    contact: { firstName: s(r.first_name ?? r.firstName), lastName: s(r.last_name ?? r.lastName), telephone: s(r.mobile_phone ?? r.home_phone ?? r.phone) },
    supplier: s(r.u_supplier ?? r.supplier),
    addressKey: s(r.u_uprn ?? r.u_address_reference ?? r.uprn),
    productCode: s(r.product_code ?? r.partner_product_code),
    productType: 'fttp',
    appointment: start ? { date: snDate(start).slice(0, 10), slot: new Date(snDate(start)).getUTCHours() < 12 ? 'AM' : 'PM', label: start } : null,
    cancellable: !['cancelled', 'closed', 'complete', 'completed'].includes(s(r.state).toLowerCase()),
  };
}

export async function getOrder(u: PortalUser, id: string): Promise<OrderDetail> {
  if (useMock) return orNotFound(mockOrderDetail(id));
  const res = await cached(`sn:order:${u.servicenowAccountId}:${id}`, () =>
    upstreamJson<{ result: SnRow[] }>(snInstance, ORDERS_PATH, {
      query: { sysparm_query: `partner=${enc(u.servicenowAccountId)}^order_id=${enc(id)}`, page: 1, per_page: 3, summary: 'false' },
    }), 15_000);
  const row = res.result[0];
  if (!row) throw new NotFound(); // partner filter in the query = ownership check
  const base = toOrder(row);
  const history = updatesKsql.enabled
    ? await updatesKsql.updatesForOrder(u, base.orderReference)
    : { updates: [], latest: null };
  const stage = history.latest?.stage ?? s(row.stage), state = history.latest?.state ?? s(row.state);
  const detail = toDetail(row, base);
  const path = statusPath(stage, state);
  return {
    ...detail,
    status: (stage ? statusLabel(stage, state) : base.status) as Order['status'],
    cancellable: detail.cancellable && path.kind !== 'cancelled' && path.kind !== 'rejected',
    orderStage: stage, orderLineState: state, statusPath: path, updates: history.updates,
  };
}

export async function listOrderUpdates(u: PortalUser, f: OrderUpdateFilter): Promise<Page<OrderUpdateRow>> {
  if (!updatesKsql.enabled) return mockOrderUpdates(f);
  return updatesKsql.updatesForPartner(u, f);
}

/** "Add comment to order update" -> SWIFT/GIG POST /api/v1/partner/fttp/orders/comment */
export async function addOrderComment(u: PortalUser, id: string, comment: string): Promise<OrderDetail> {
  if (useMock) return orNotFound(mockAddComment(id, comment, u.name ?? u.userId));
  const order = await getOrder(u, id);
  await gig.addOrderComment({
    partner_id: u.salesforceAccountId ?? '', giganet_order_reference: order.orderReference,
    partner_order_reference: order.partnerOrderRef, comment, partner_user: u.name ?? u.email ?? u.userId,
  });
  return getOrder(u, id);
}

/** Amend install date: reserve the chosen engineer slot through GIG, which updates the ServiceNow order. */
export async function amendAppointment(u: PortalUser, id: string, slot: { start: string; end: string }): Promise<OrderDetail> {
  const order = await getOrder(u, id); // also proves the order belongs to this partner
  await gig.reserveAppointment(order.productType || 'fttp', {
    start_datetime_iso: slot.start, end_datetime_iso: slot.end,
    address_key: order.addressKey, postcode: order.postcode, product_code: order.productCode,
    giganet_order_reference: order.orderReference,
  });
  if (useMock) return orNotFound(mockAmendAppointment(id, slot.start, u.name ?? u.userId));
  return getOrder(u, id);
}

/** Amend install contact via GIG: PATCH /api/v1/partner/fttp/orders/{ref}/end_customer_contact */
export async function amendContact(u: PortalUser, id: string, c: OrderDetail['contact']): Promise<OrderDetail> {
  if (useMock) return orNotFound(mockAmendContact(id, c, u.name ?? u.userId));
  const order = await getOrder(u, id);
  await gig.amendOrderContact(order.orderReference, c);
  return getOrder(u, id);
}

/** Cancel via GIG: POST /api/v1/partner/fttp/orders/{ref}/cancel (may be refused past the point of no return) */
export async function cancelOrder(u: PortalUser, id: string, reason: string): Promise<OrderDetail> {
  if (useMock) return orNotFound(mockCancel(id, reason, u.name ?? u.userId));
  const order = await getOrder(u, id);
  await gig.cancelOrder(order.orderReference, reason);
  return getOrder(u, id);
}
