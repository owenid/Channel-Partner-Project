// Mock data served when an upstream system has no *_BASE_URL configured.
import type {
  AccountProfile, NewsItem, Offer, Order, OrderFilter, OrderStatus, Page, ProductShare,
  QuoteSummary, QuoteVolumePoint, Resource, ResourceCategory, SupportContacts, VolumeRange,
} from '../types.js';

const lorem =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim.';

export const mockNews: NewsItem[] = [1, 2, 3, 4].map((i) => ({
  id: `news-${i}`,
  title: i === 1 ? 'This is a H3 title' : `Partner update ${i}`,
  summary: lorem,
  imageUrl: null,
  url: '#',
  publishedAt: '2023-02-03T15:21:00Z',
}));

export const mockOffers: Offer[] = [1, 2, 3, 4].map((i) => ({
  id: `offer-${i}`, title: 'Channel partner discount', expiresAt: '2023-10-10', imageUrl: null, url: '#',
}));

const refs = ['GL2 E3L', 'BH24 1EY', 'PO4 4DT', 'GL2 E4P', 'PO4 4DT', 'GL2 E4P', 'BS1 6QH'];
export const mockQuotes: QuoteSummary[] = refs.map((postcode, i) => ({
  id: `Q-${10231 - i}`, reference: `Q-${10231 - i}`, postcode, createdAt: '2023-02-03T15:21:00', status: 'Issued',
}));

const counts = [5, 12, 7, 5, 10, 7, 5, 10, 11, 5, 8, 6, 5, 10, 9, 4, 7, 8, 6, 9, 11, 7, 6, 8];
export function mockVolume(range: VolumeRange): QuoteVolumePoint[] {
  const n = { 'last-month': 14, 'last-3-months': 12, 'last-12-months': 12, 'last-24-months': 24 }[range];
  return counts.slice(0, n).map((count, i) => {
    const d = new Date(Date.UTC(2023, i, 1));
    return {
      period: d.toISOString().slice(0, 7),
      label: d.toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      count,
    };
  });
}

export const mockProducts: ProductShare[] = [
  { variant: 'Varient 1', count: 34 },
  { variant: 'Varient 2', count: 22 },
  { variant: 'Varient 3', count: 18 },
  { variant: 'Varient 4', count: 26 },
];

export const mockProfile: AccountProfile = {
  firstName: 'John', lastName: 'Doe', email: 'john.doe@xyzcomms.co.uk',
  partnerName: 'XYZ Comms', role: 'Customer Relationship Manager', department: 'Accounts',
};

export const mockContacts: SupportContacts = {
  websiteUrl: 'https://www.giganet.uk',
  contacts: [
    { role: 'Account Owner', name: 'Peter Jefferson', email: 'peter.jefferson@giganet.uk' },
    { role: 'Service Manager', name: 'James Williams', email: 'james.williams@giganet.uk' },
    { role: 'Sales Support Executive', name: 'Susan Jacobs', email: 'susan.jacobs@giganet.uk' },
  ],
};

// ---- Resources ----
const guideTemplates: Omit<Resource, 'id' | 'category'>[] = [
  { tag: 'Guides', bannerText: 'Channel portal quick start guide', title: "Channel portal quick start guide Feb' 23", summary: "Learn the basics of Giganet's channel partner portal. The guide covers everything you need to know to start using the portal.", imageUrl: null, url: '#', theme: 'light', art: 'phone' },
  { tag: 'Guides', bannerText: 'Channel partner portal guide', title: 'Channel portal user guide', summary: 'Become a champion of the Giganet channel partner portal with our full user guide. Learn everything you need to know about using your new portal.', imageUrl: null, url: '#', theme: 'teal', art: 'laptop' },
  { tag: 'Guides', bannerText: 'Adding Additional public IPs', title: 'Additional public IP guide', summary: "Looking to add additional IP's to a customer account? This guide will show you how to add additional public IP's.", imageUrl: null, url: '#', theme: 'dark', art: 'network' },
];
const resourceTotals: Record<ResourceCategory, number> = { 'quick-guides': 42, legal: 9, training: 14 };
const resourceTags: Record<ResourceCategory, string> = { 'quick-guides': 'Guides', legal: 'Legal', training: 'Training' };
// The design shows a 5-column grid with the 3 card styles cycling
const order = [0, 1, 2, 0, 1, 2, 0, 1];
export function mockResources(category: ResourceCategory, page: number, pageSize: number): Page<Resource> {
  const total = resourceTotals[category];
  const start = (page - 1) * pageSize;
  const items: Resource[] = [];
  for (let i = start; i < Math.min(start + pageSize, total); i++) {
    items.push({ ...guideTemplates[order[i % order.length]], tag: resourceTags[category], id: `${category}-${i + 1}`, category });
  }
  return { items, page, pageSize, total };
}

// ---- Orders ----
const places = ['Portsmouth', 'Marlborough', 'Ringwood', 'Bournemouth', 'Inverness', 'Glasgow', 'Bristol', 'Leeds', 'Swindon'];
const quoteIds = ['51234', '45634', '234234', '123456', '123456', '783729', '99812', '45122', '67001'];
const statuses: OrderStatus[] = ['In progress', 'On hold', 'Cancelled', 'Delayed', 'Scheduled', 'Acknowledged', 'Rejected'];
const speeds = [500, 500, 300, 900, 500, 500];
const allOrders: Order[] = Array.from({ length: 42 }, (_, i) => ({
  id: `ord-${i + 1}`,
  location: places[i % places.length],
  postcode: 'PO1 1FB',
  partnerOrderRef: 'XYZ-CO-123456',
  quoteId: quoteIds[i % quoteIds.length],
  orderReference: `ORD${String(12323 + i).padStart(8, '0')}`,
  productName: `CityFibre SMB FTTP ${speeds[i % speeds.length]} (12m) STD`,
  status: statuses[i % statuses.length],
  createdAt: new Date(Date.UTC(2023, 0, 1 + i * 7)).toISOString(),
}));

export function mockOrders(f: OrderFilter): Page<Order> {
  const has = (v: string, q?: string) => !q || v.toLowerCase().includes(q.toLowerCase());
  let rows = allOrders.filter((o) =>
    has(o.orderReference, f.partnerOrderRef) &&
    (has(o.postcode, f.address) || has(o.location, f.address)) &&
    has(o.location, f.location) &&
    (!f.status || o.status === f.status) &&
    (!f.from || o.createdAt >= f.from) &&
    (!f.to || o.createdAt.slice(0, 10) <= f.to),
  );
  if (f.view === 'live-service') rows = rows.filter((o) => o.status === 'Acknowledged' || o.status === 'Scheduled');
  if (f.sort) {
    const k = f.sort; const m = f.dir === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => String(a[k]).localeCompare(String(b[k]), 'en', { numeric: true }) * m);
  }
  const start = (f.page - 1) * f.pageSize;
  return { items: rows.slice(start, start + f.pageSize), page: f.page, pageSize: f.pageSize, total: rows.length };
}

// ---- Order detail (in-memory, so amend/cancel actions are visible while the server runs) ----
import type { OrderDetail, OrderUpdate } from '../types.js';
import { statusPath } from '../lib/orderPath.js';
const firstNames = ['Amanda', 'Liam', 'Priya', 'Tom', 'Grace', 'Owen'];
const lastNames = ['Jacob', 'Hughes', 'Patel', 'Barnes', 'Clarke', 'Idehen'];
const updateRows: [string, string, OrderUpdate['authorType'], string][] = [
  ['In progress', 'Owen Idehen', 'agent', 'Please pick another date as the initial date you picked is not currently available. You can do this using the partner portal by navigating to the connections menu.'],
  ['In progress', 'Customer', 'customer', 'Will this be completed soon as the customer is complaining that it is taking too long.'],
  ['In progress', 'Owen Idehen', 'agent', 'Please pick another date as the initial date you picked is not currently available. You can do this using the partner portal by navigating to the connections menu.'],
  ['Awaiting information', 'System', 'system', 'ORD0001345 - Giganet Full Fibre Bundle v14 - Stage has changed to & confirmed KCI-2.'],
  ['Awaiting information', 'Owen Idehen', 'agent', 'Please pick another date as the initial date you picked is not currently available. You can do this using the partner portal by navigating to the connections menu.'],
];
// order_line_stage / state as the Order Status Updates DB would report them for each mock status
const stageFor: Record<string, [string, string]> = {
  'In progress': ['Web order', ''], 'On hold': ['On hold', ''], Cancelled: ['Cancelled', ''], Delayed: ['Delayed', ''],
  'Awaiting information': ['Delayed', ''], Scheduled: ['Confirmed-KCI2', ''], Acknowledged: ['Fulfilled', ''],
  Completed: ['Fulfilled', 'Completed'], Rejected: ['Order rejected', ''],
};
const details = new Map<string, OrderDetail>();

export function mockOrderDetail(id: string): OrderDetail | undefined {
  if (details.has(id)) return details.get(id);
  const o = allOrders.find((x) => x.id === id);
  if (!o) return undefined;
  const i = allOrders.indexOf(o);
  const updates: OrderUpdate[] = updateRows.map(([status, author, authorType, text], j) => ({
    id: `${id}-u${j}`, orderReference: `SO000${18413 + i}`,
    update: 'Service order for CityFibre FTTP provisioning service', stage: status, status,
    comment: text, author, authorType, raisedAt: '2022-04-08T14:52:00',
  }));
  const d: OrderDetail = {
    ...o,
    customerName: `${firstNames[i % 6]} ${lastNames[i % 6]}`,
    address: '20 Fratton Road', city: o.location,
    datePlaced: '2022-08-12T10:13:00', dateInstalled: o.status === 'Acknowledged' ? '2022-08-22T15:40:00' : null,
    contact: { firstName: firstNames[i % 6], lastName: lastNames[i % 6], telephone: '01202903928' },
    supplier: 'CityFibre',
    addressKey: String(1775071095 + i),
    productCode: `R-CF-${o.productName.match(/FTTP (\d+)/)?.[1] ?? 500}`,
    productType: 'fttp',
    appointment: { date: '2023-04-25', slot: 'AM', label: '25/04/2023 08:00 - 13:00 (AM slot)' },
    cancellable: !['Cancelled', 'Completed', 'Rejected'].includes(o.status),
    orderStage: stageFor[o.status]?.[0] ?? '', orderLineState: stageFor[o.status]?.[1] ?? '',
    statusPath: statusPath(stageFor[o.status]?.[0], stageFor[o.status]?.[1]),
    updates,
  };
  details.set(id, d);
  return d;
}

/** Used by the GIG mock so orders placed from a quote show up under Connections. */
export function mockAddOrder(o: Order, d: Omit<OrderDetail, keyof Order | 'updates' | 'cancellable' | 'orderStage' | 'orderLineState' | 'statusPath'>) {
  allOrders.unshift(o);
  details.set(o.id, {
    ...o, ...d, cancellable: true, orderStage: '', orderLineState: '', statusPath: statusPath('', ''),
    updates: [{
      id: `${o.id}-u0`, orderReference: o.orderReference, update: `Service order for ${o.productName}`,
      stage: 'Order placed', status: 'In progress', comment: 'Order placed via the partner portal.',
      author: 'System', authorType: 'system', raisedAt: o.createdAt,
    }],
  });
}

const addUpdate = (d: OrderDetail, stage: string, status: string, text: string, author: string, authorType: OrderUpdate['authorType'] = 'customer') =>
  d.updates.unshift({
    id: `${d.id}-u${d.updates.length}`, orderReference: d.updates[0]?.orderReference ?? d.orderReference,
    update: `Service order for ${d.productName}`, stage, status, comment: text, author, authorType,
    raisedAt: new Date().toISOString(),
  });

export function mockAddComment(id: string, text: string, author: string) {
  const d = mockOrderDetail(id); if (!d) return undefined;
  addUpdate(d, 'Comment added', d.status, text, author);
  return d;
}

export function mockAmendAppointment(id: string, when: string, author: string) {
  const d = mockOrderDetail(id); if (!d) return undefined;
  const dt = new Date(when);
  const slot = dt.getHours() < 13 ? 'AM' : 'PM';
  const label = `${dt.toLocaleDateString('en-GB')} ${slot === 'AM' ? '08:00 - 13:00 (AM slot)' : '13:00 - 18:00 (PM slot)'}`;
  d.appointment = { date: when.slice(0, 10), slot, label };
  addUpdate(d, 'Appointment Change requested', 'In progress', `Requested new appointment ${label}`, author);
  return d;
}

export function mockAmendContact(id: string, c: OrderDetail['contact'], author: string) {
  const d = mockOrderDetail(id); if (!d) return undefined;
  d.contact = c;
  addUpdate(d, 'Install contact updated', 'Completed', `Install contact changed to ${c.firstName} ${c.lastName} (${c.telephone})`, author);
  return d;
}

export function mockCancel(id: string, reason: string, author: string) {
  const d = mockOrderDetail(id); if (!d) return undefined;
  d.status = 'Cancelled'; d.cancellable = false;
  d.orderStage = 'Cancelled'; d.statusPath = statusPath('Cancelled', '');
  const o = allOrders.find((x) => x.id === id); if (o) o.status = 'Cancelled';
  addUpdate(d, 'Cancellation requested', 'In progress', `Reason: ${reason}`, author);
  return d;
}

// ---- Live services ----
import type { Service, ServiceDetail, ServiceFilter, ServiceStatus } from '../types.js';
const svcStatus: ServiceStatus[] = ['Operational', 'Offline', 'Operational', 'Operational', 'Operational', 'Alt status'];
const allServices: Service[] = Array.from({ length: 42 }, (_, i) => ({
  id: `svc-${i + 1}`,
  location: places[i % places.length],
  postcode: 'PO1 1FB',
  orderReference: `ORD${String(12323 + i).padStart(8, '0')}`,
  serviceReference: `SVC${String(55100 + i).padStart(7, '0')}`,
  quoteReference: `Q-${10200 + i}`,
  serviceName: i % 6 === 5 ? 'CityFibre National FTTP 500 (12m) STD' : `CityFibre SMB FTTP ${speeds[i % speeds.length]} (12m) STD`,
  status: svcStatus[i % svcStatus.length],
  createdAt: new Date(Date.UTC(2023, 0, 1 + i * 7)).toISOString(),
}));

export function mockServices(f: ServiceFilter) {
  const has = (v: string, q?: string) => !q || v.toLowerCase().includes(q.toLowerCase());
  let rows = allServices.filter((s) =>
    has(s.quoteReference, f.quoteRef) && has(s.serviceReference, f.serviceRef) &&
    (has(s.postcode, f.address) || has(s.location, f.address)) && has(s.location, f.location) &&
    (!f.status || s.status === f.status) &&
    (!f.from || s.createdAt >= f.from) && (!f.to || s.createdAt.slice(0, 10) <= f.to),
  );
  if (f.sort) {
    const k = f.sort; const m = f.dir === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => String(a[k]).localeCompare(String(b[k]), 'en', { numeric: true }) * m);
  }
  const start = (f.page - 1) * f.pageSize;
  return { items: rows.slice(start, start + f.pageSize), page: f.page, pageSize: f.pageSize, total: rows.length };
}

const pendingChanges = new Map<string, ServiceDetail['pendingChange']>();
const customers = ['Jeremy Matthews', 'Amanda Jacob', 'Priya Patel', 'Tom Barnes', 'Grace Clarke', 'Liam Hughes'];
const billCycleEnd = () => {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 0); // last day of this month
  return d.toISOString().slice(0, 10);
};

export function mockServiceDetail(id: string): ServiceDetail | undefined {
  const s = allServices.find((x) => x.id === id);
  if (!s) return undefined;
  const n = allServices.indexOf(s);
  const hex = (0x1164 + n).toString(16);
  return {
    ...s, address: '20 Fratton Road', city: s.location, customerName: customers[n % customers.length],
    radiusUsername: `GN${784749 + n}@giga.net.uk`,
    ipv4: `37.48.229.${(249 + n) % 255}`,
    ipv6: `2a05:87c6:1:${hex}::/64`, ipv6Prefix: `2a05:87c6:${(0x1169 + n).toString(16)}::/48`,
    online: s.status === 'Operational',
    suspended: s.status === 'Suspended',
    pendingChange: pendingChanges.get(id) ?? null,
    billCycleEnd: billCycleEnd(),
  };
}

export function mockCeaseService(id: string, reason: string) {
  const s = allServices.find((x) => x.id === id);
  if (!s) return undefined;
  s.status = 'Alt status';
  return { ...mockServiceDetail(id)!, ceaseRequested: { reason, at: new Date().toISOString() } };
}

// ---- Radius session history ----
import type { ModifyOptions, ProductOption, RadiusSession, EffectiveMode, SuspensionAction } from '../types.js';
export function mockSessions(id: string, page: number, pageSize: number) {
  const d = mockServiceDetail(id);
  if (!d) return undefined;
  const total = d.status === 'Alt status' ? 0 : 14;
  const items: RadiusSession[] = [];
  for (let i = (page - 1) * pageSize; i < Math.min(page * pageSize, total); i++) {
    const start = new Date(Date.UTC(2023, 1, 20 - i * 4, 8 + (i % 12), 22, 36));
    const dur = (2 + (i % 4)) * 86400 + (i % 7) * 3600 + 1560;
    const open = i === 0 && d.online;
    items.push({
      id: `${id}-s${i}`, username: d.radiusUsername, start: start.toISOString(),
      end: open ? null : new Date(start.getTime() + dur * 1000).toISOString(),
      durationSeconds: dur, downloadBytes: Math.round((8 + (i * 7.3) % 40) * 1e9), uploadBytes: Math.round((1 + (i * 1.7) % 6) * 1e9),
    });
  }
  return { items, page, pageSize, total };
}

// ---- Modify (upgrade / downgrade) ----
const catalogue = [150, 300, 500, 900].map((mbps) => ({ mbps, name: (supplier: string) => `${supplier} SMB FTTP ${mbps} (12m) STD` }));
export function mockModifyOptions(id: string): ModifyOptions | undefined {
  const d = mockServiceDetail(id);
  if (!d) return undefined;
  const current = Number(d.serviceName.match(/FTTP (\d+)/)?.[1] ?? 500);
  const supplier = d.serviceName.split(' SMB')[0].split(' National')[0];
  const products: ProductOption[] = catalogue
    .filter((p) => p.mbps !== current)
    .map((p) => ({ id: `fttp-${p.mbps}`, name: p.name(supplier), bandwidthMbps: p.mbps, direction: p.mbps > current ? 'upgrade' : 'downgrade' }));
  return { currentProduct: d.serviceName, currentBandwidthMbps: current, products, effectiveModes: ['Immediately', 'At the end of bill cycle'], billCycleEnd: d.billCycleEnd };
}

export function mockModifyService(id: string, productId: string, mode: EffectiveMode) {
  const opts = mockModifyOptions(id);
  const product = opts?.products.find((p) => p.id === productId);
  if (!opts || !product) return undefined;
  const s = allServices.find((x) => x.id === id)!;
  if (mode === 'Immediately') {
    s.serviceName = product.name;
    pendingChanges.delete(id);
  } else {
    pendingChanges.set(id, { toProduct: product.name, effective: mode, effectiveDate: opts.billCycleEnd });
  }
  return mockServiceDetail(id);
}

// ---- Suspend / unsuspend ----
export function mockSuspension(id: string, action: SuspensionAction) {
  const s = allServices.find((x) => x.id === id);
  if (!s) return undefined;
  s.status = action === 'suspend' ? 'Suspended' : 'Operational';
  return mockServiceDetail(id);
}

// ---- Order updates feed ----
import type { OrderUpdateFilter, OrderUpdateRow } from '../types.js';
const feedStatus = ['In progress', 'On Hold', 'Canceled', 'Rejected', 'Acknowledged'];
const feedStage = ['Web order', 'On hold', 'Cancelled', 'Order rejected', 'Confirmed KCI-2'];
const feed: OrderUpdateRow[] = Array.from({ length: 42 }, (_, i) => {
  const [, author, authorType, text] = updateRows[i % 2 === 0 ? 0 : 3];
  return {
    id: `upd-${i + 1}`, orderId: `ord-${(i % 42) + 1}`, orderReference: `ORD${String(12804 + i).padStart(7, '0')}`,
    update: 'Service Order for FTTP Installation Service', stage: feedStage[i % feedStage.length],
    status: feedStatus[i % feedStatus.length], comment: text, author, authorType,
    raisedAt: new Date(Date.UTC(2022, 3, 8 + i, 14, 52)).toISOString(),
  };
});
export function mockOrderUpdates(f: OrderUpdateFilter) {
  const has = (v: string, q?: string) => !q || v.toLowerCase().includes(q.toLowerCase());
  let rows = feed.filter((u) =>
    has(u.orderReference, f.orderRef) && (!f.stage || u.stage === f.stage) && (!f.status || u.status === f.status) &&
    (!f.from || u.raisedAt >= f.from) && (!f.to || u.raisedAt.slice(0, 10) <= f.to),
  );
  if (f.sort) {
    const k = f.sort; const m = f.dir === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => String(a[k]).localeCompare(String(b[k]), 'en', { numeric: true }) * m);
  }
  const start = (f.page - 1) * f.pageSize;
  return { items: rows.slice(start, start + f.pageSize), page: f.page, pageSize: f.pageSize, total: rows.length };
}
