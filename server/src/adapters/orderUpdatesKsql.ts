import { config } from '../config.js';
import { cached } from '../lib/cache.js';
import { UpstreamError } from '../lib/httpClient.js';
import type { OrderUpdate, OrderUpdateFilter, OrderUpdateRow, Page } from '../types.js';
import type { PortalUser } from '../auth.js';

/**
 * Order status updates from Confluent Cloud ksqlDB ("Order Status Updates" design):
 *   POST {KSQL_ENDPOINT}/query
 *   { "ksql": "select * from SERVICENOW_ORDER_UPDATES_STREAM where partner_id='..' [and GIGANET_ORDER_REFERENCE='..'];",
 *     "streamProperties": { "ksql.streams.auto.offset.reset": "earliest" } }
 *
 * Portal field mapping (from the design):
 *   Order reference = GIGANET_ORDER_REFERENCE      Update = ORDER_LINE_UPDATE.DOMAIN_ORDER_UPDATE.DOMAIN_ORDER_TYPE
 *   Stage = ORDER_LINE_UPDATE.ORDER_LINE_STAGE     Status = STATE
 *   Comment = COMMENT                              Date raised = STATUS_TIMESTAMP
 */
const k = config.ksql;
export const enabled = !!k.endpoint;

/**
 * partner_id in the stream is the partner's Salesforce account id (Auth0 organization metadata
 * salesforce_account_id), e.g. '7806000005iLi4XYZ' - confirmed, despite the design text naming
 * servicenow_account_id.
 */
export const partnerIdFor = (u: PortalUser) => {
  if (!u.salesforceAccountId) throw new UpstreamError('ksqldb', 403, 'partner has no salesforce_account_id in its Auth0 organization metadata');
  return u.salesforceAccountId;
};

// KSQL string literal: single quotes doubled; identifiers are fixed/whitelisted
const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;
const stream = () => {
  if (!/^[A-Za-z0-9_]+$/.test(k.stream)) throw new Error('KSQL_STREAM must be a plain stream name');
  return k.stream;
};

const decode = (s: string) =>
  s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

interface KsqlRow {
  KEY?: string; PARTNER_ID: string; GIGANET_ORDER_REFERENCE: string; PARTNER_ORDER_REFERENCE?: string;
  COMMENT?: string; STATE?: string; STATUS_TIMESTAMP?: string;
  ORDER_LINE_UPDATE?: {
    DOMAIN_ORDER_UPDATE?: { DOMAIN_ORDER_TYPE?: string; DOMAIN_ORDER_REFERENCE?: string; DOMAIN_ORDER_LINE_STAGE?: string };
    ORDER_LINE_REFERENCE?: string; ORDER_LINE_STAGE?: string; PRODUCT_SPECIFICATION?: string;
  };
}

/**
 * ksqlDB answers either as a JSON array ([{header}, {row:{columns}}, ...]) or in the
 * delimited format shown in the design (a header object with columnNames, then one array per row).
 */
export function parse(text: string): KsqlRow[] {
  let names: string[] = [];
  const rows: unknown[][] = [];
  const take = (item: unknown) => {
    if (Array.isArray(item)) { rows.push(item); return; }
    if (!item || typeof item !== 'object') return;
    const o = item as Record<string, any>;
    if (Array.isArray(o.columnNames)) names = o.columnNames;
    if (o.header?.schema) names = String(o.header.schema).split(/,\s*(?=`)/).map((c: string) => c.match(/`([^`]+)`/)?.[1] ?? '');
    if (Array.isArray(o.row?.columns)) rows.push(o.row.columns);
    if (o.errorMessage || o['@type'] === 'statement_error') throw new UpstreamError('ksqldb', 400, String(o.message ?? o.errorMessage?.message ?? 'query failed'));
  };
  const trimmed = text.trim();
  try {
    const whole = JSON.parse(trimmed);
    (Array.isArray(whole) && !whole.every((x) => typeof x !== 'object' || Array.isArray(x)) ? whole : [whole]).forEach(take);
    if (Array.isArray(whole) && whole.every((x) => Array.isArray(x))) whole.forEach(take);
  } catch {
    // delimited: one JSON value per line (or concatenated values)
    for (const line of trimmed.replace(/\]\s*\[/g, ']\n[').replace(/\}\s*\[/g, '}\n[').split('\n')) {
      const l = line.trim().replace(/,$/, '');
      if (l) { try { take(JSON.parse(l)); } catch { /* ignore partial lines */ } }
    }
  }
  return rows.map((r) => Object.fromEntries(names.map((n, i) => [n, r[i]])) as unknown as KsqlRow);
}

async function query(ksql: string): Promise<KsqlRow[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(config.timeoutMs, 15_000));
  try {
    const res = await fetch(`${k.endpoint.replace(/\/$/, '')}/query`, {
      method: 'POST', signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/vnd.ksql.v1+json',
        Accept: 'application/vnd.ksql.v1+json',
        Authorization: `Basic ${Buffer.from(`${k.apiKey}:${k.apiSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({ ksql, streamsProperties: { 'ksql.streams.auto.offset.reset': 'earliest' } }),
    });
    const text = await res.text();
    if (!res.ok) throw new UpstreamError('ksqldb', res.status, `${res.status} on /query`, text.slice(0, 200));
    return parse(text);
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    throw new UpstreamError('ksqldb', null, `query failed: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

const authorOf = (comment: string): { author: string; authorType: OrderUpdate['authorType']; text: string } => {
  // e.g. "04-May-23 12:01:14 - Owen Idehen (Additional comments) Installation date has passed..."
  const m = comment.match(/^\d{2}-\w{3}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+-\s+(.+?)\s+\(([^)]+)\)\s*(.*)$/);
  if (!m) return { author: 'System', authorType: 'system', text: comment };
  const who = m[1];
  const type: OrderUpdate['authorType'] = /^(system)$/i.test(who) ? 'system' : /order portal|customer|partner/i.test(who) ? 'customer' : 'agent';
  return { author: who, authorType: type, text: m[3] };
};

export const toUpdate = (r: KsqlRow, i: number): OrderUpdateRow => {
  const comment = decode(r.COMMENT ?? '');
  const a = authorOf(comment);
  const ts = r.STATUS_TIMESTAMP ? new Date(r.STATUS_TIMESTAMP.replace(' ', 'T') + 'Z') : new Date(0);
  return {
    id: (r.KEY ?? '').replace(/"/g, '') || `${r.GIGANET_ORDER_REFERENCE}-${i}`,
    orderId: r.GIGANET_ORDER_REFERENCE,
    orderReference: r.GIGANET_ORDER_REFERENCE,
    update: r.ORDER_LINE_UPDATE?.DOMAIN_ORDER_UPDATE?.DOMAIN_ORDER_TYPE || r.ORDER_LINE_UPDATE?.PRODUCT_SPECIFICATION || 'Order update',
    stage: r.ORDER_LINE_UPDATE?.ORDER_LINE_STAGE ?? '',
    status: r.STATE ?? '',
    comment: a.text, author: a.author, authorType: a.authorType,
    raisedAt: ts.toISOString(),
  };
};

const newestFirst = (a: OrderUpdateRow, b: OrderUpdateRow) => b.raisedAt.localeCompare(a.raisedAt);

/** All updates for one order, newest first; the newest drives the order status bar. */
export async function updatesForOrder(u: PortalUser, giganetOrderReference: string) {
  const pid = partnerIdFor(u);
  const rows = await cached(`ksql:order:${pid}:${giganetOrderReference}`, () =>
    query(`select * from ${stream()} where partner_id=${lit(pid)} and GIGANET_ORDER_REFERENCE=${lit(giganetOrderReference)};`), 15_000);
  const updates = rows.map(toUpdate).sort(newestFirst);
  const latestRow = rows.slice().sort((a, b) => String(b.STATUS_TIMESTAMP).localeCompare(String(a.STATUS_TIMESTAMP)))[0];
  return {
    updates,
    latest: latestRow ? { stage: latestRow.ORDER_LINE_UPDATE?.ORDER_LINE_STAGE ?? '', state: latestRow.STATE ?? '' } : null,
  };
}

/**
 * Connections > Order updates tab. Filters follow the design's "Order Updates Filter Conditions"
 * (order reference, state, order_line_update->order_line_stage, status_timestamp range) and are
 * pushed into the KSQL query; sorting and paging happen here.
 */
export async function updatesForPartner(u: PortalUser, f: OrderUpdateFilter): Promise<Page<OrderUpdateRow>> {
  const where = [`partner_id=${lit(partnerIdFor(u))}`];
  if (f.orderRef) where.push(`GIGANET_ORDER_REFERENCE=${lit(f.orderRef.toUpperCase())}`);
  if (f.status) where.push(`STATE=${lit(f.status)}`);
  if (f.stage) where.push(`ORDER_LINE_UPDATE->ORDER_LINE_STAGE=${lit(f.stage)}`);
  if (f.from) where.push(`STATUS_TIMESTAMP>=${lit(`${f.from} 00:00:00`)}`);
  if (f.to) where.push(`STATUS_TIMESTAMP<=${lit(`${f.to} 23:59:59`)}`);
  const ksql = `select * from ${stream()} where ${where.join(' and ')};`;
  let rows = (await cached(`ksql:${ksql}`, () => query(ksql), 15_000)).map(toUpdate);
  const key = f.sort ?? 'raisedAt';
  rows = rows.sort((a, b) => String(a[key]).localeCompare(String(b[key]), 'en', { numeric: true }) * (f.sort && f.dir === 'asc' ? 1 : -1));
  const start = (f.page - 1) * f.pageSize;
  return { items: rows.slice(start, start + f.pageSize), page: f.page, pageSize: f.pageSize, total: rows.length };
}

// Filter options listed in the design
export const UPDATE_STATES = ['Draft', 'New', 'Acknowledged', 'Scheduled', 'Rejected', 'In progress', 'Revision in Progress', 'Awaiting Information', 'On Hold', 'Assessing Cancellation', 'Cancellation in Progress', 'Canceled', 'Completed'];
export const UPDATE_STAGES = ['Web order', 'Queued', 'Order rejected', 'Confirmed KCI-2', 'Cancelled', 'Live QA', 'Fulfilled', 'Auto-Approve Failed', 'Completed', 'On hold', 'Appointment request rejected', 'Supplier modify request pending', 'Order confirmed', 'Supplier modify request acknowledged', 'Elevate Done', 'Install Complete', 'Delayed', 'Supplier modify request rejected', 'Appointment confirmed'];
