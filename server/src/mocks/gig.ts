// In-memory stand-in for the Giganet Information Gateway (GIG / SWIFT), shaped after the
// "Check FTTP Availability", "Retrieve Quotes", "Engineer Appointments and Reservation" and
// "Order Placement" designs. State lives for as long as the server process runs.
import type { PortalUser } from '../auth.js';
import {
  GigError,
  type AppointmentQuery, type AppointmentsResponse, type CreateQuoteBody, type CreatedQuote, type GigAddress,
  type HistoryQuote, type PlaceOrderBody, type PlaceOrderResponse, type QuoteDetail, type QuoteProduct,
  type Reservation, type ResellerHistoryResponse, type UserHistoryResponse,
} from '../types.js';
import { mockAddOrder } from './data.js';

// ---------- helpers ----------
const ulid = () => {
  const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
  let t = Date.now(), time = '';
  for (let i = 0; i < 10; i++) { time = alphabet[t % 32] + time; t = Math.floor(t / 32); }
  let rand = '';
  for (let i = 0; i < 16; i++) rand += alphabet[Math.floor(Math.random() * 32)];
  return time + rand;
};
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const normalisePostcode = (p: string) => p.toUpperCase().replace(/\s+/g, '').replace(/^(.+)(.{3})$/, '$1 $2');

// ---------- addresses (POST /api/postcodes/{postcode}) ----------
const streets = ['Salisbury Rd', 'Elizabeth Gardens', 'Fratton Road', 'Albert Road', 'Highland Road', 'Lawrence Road'];
const towns = ['Southsea', 'Portsmouth', 'Bournemouth', 'Southampton', 'Gloucester', 'Swindon'];
const availability = ['Available', 'Available', 'Not-Available', 'Planned', 'Available', 'Available', 'Not-Available', 'Available'];

function addressesFor(postcode: string): GigAddress[] {
  const pc = normalisePostcode(postcode);
  const h = hash(pc);
  if (pc.startsWith('ZZ')) return []; // handy for testing "no addresses found"
  const street = streets[h % streets.length], town = towns[h % towns.length];
  return availability.map((status, i) => {
    const num = i === 0 ? null : `${2 + i * 2}${i === 3 ? 'B' : ''}`;
    const uprn = String(1775000000 + ((h + i * 7919) % 999999));
    return {
      address: {
        organisationName: i === 5 ? 'Discovery Schools' : null, poBox: null, subPremises: null,
        premisesName: i === 0 ? 'Street Record' : null, thoroughfareNumber: num, dependentThoroughfareName: null,
        thoroughfareName: street, doubleDependentLocality: null, locality: null, postTown: town, county: null,
        postCode: pc, country: 'United Kingdom', uprn, exchangeGroupCode: i % 2 ? 'PCNTC' : null,
        formatted_short: [i === 5 ? 'Discovery Schools,' : null, i === 0 ? 'Street Record,' : num, street].filter(Boolean).join(' '),
      },
      addressReference: { qualifier: status === 'Available' ? 'Gold' : 'Silver', addressReferenceNumber: i % 2 ? `A000${66400300 + i}` : uprn, districtCode: i % 2 ? 'SD' : 'MIS' },
      fttpAvailabilityStatus: status,
      coordinates: { long: '-1.0870', lat: '50.7860' },
      url: 'null',
      gn_build_area: String(i === 1 || i === 4),
      fttp_available_postcode: String(status === 'Available'),
      fttp_planned_postcode: String(status === 'Planned'),
      cf_restricted_location: 'false',
    };
  });
}

export function mockAddresses(postcode: string) {
  return { addresses: addressesFor(postcode) };
}

// ---------- products ----------
interface Template { code: string; name: string; type: 'FTTP' | 'Ethernet'; carrier: string; speed: number; bearer: number }
const providers: Template[][] = [
  [900, 500, 300, 150].map((s) => ({ code: `R-CF-${s}`, name: `Full Fibre ${s} (12m) STD ESI`, type: 'FTTP' as const, carrier: 'CityFibre', speed: s, bearer: 1000 })),
  [900, 500].map((s) => ({ code: `R-GN-${s}`, name: `Giganet Full Fibre ${s} (12m) STD`, type: 'FTTP' as const, carrier: 'Giganet', speed: s, bearer: 1000 })),
  [500, 160].map((s) => ({ code: `R-OR-${s}`, name: `Openreach FTTP ${s} (12m) STD`, type: 'FTTP' as const, carrier: 'Openreach', speed: s, bearer: 1000 })),
  [{ code: 'R-NEOS-100', name: 'Ethernet 100Mb (36m)', type: 'Ethernet' as const, carrier: 'Neos Networks', speed: 100, bearer: 1000 }],
  [{ code: 'R-VMB-1000', name: 'Ethernet 1Gb (36m)', type: 'Ethernet' as const, carrier: 'Virgin Media Business', speed: 1000, bearer: 1000 }],
];
const providerDelayMs = [700, 1500, 2300, 3100, 3900];

function productsFor(t: Template, a: GigAddress, promoValid: boolean): QuoteProduct | null {
  let status: QuoteProduct['availability_status'] = 'Available';
  let orderable = true;
  if (t.carrier === 'CityFibre') {
    if (a.fttpAvailabilityStatus === 'Not-Available') { status = 'Register-Interest'; orderable = false; }
    if (a.fttpAvailabilityStatus === 'Planned') { status = 'Pre-Order'; }
  }
  if (t.carrier === 'Giganet' && a.gn_build_area !== 'true') return null; // on-net only inside Giganet build areas
  if (t.carrier === 'Openreach' && a.fttpAvailabilityStatus === 'Not-Available') { status = 'Coming-Soon'; orderable = false; }
  const guaranteed = String(Math.round(t.speed / 2));
  return {
    uuid: `${t.code}-${a.address.uprn}`.toLowerCase(),
    product_name: t.name, partner_product_code: t.code, product_type: t.type, carrier: t.carrier,
    bearer_speed_upload: String(t.bearer), bearer_speed_download: String(t.bearer),
    cdr_speed_upload: String(t.speed), cdr_speed_download: String(t.speed),
    availability_status: status,
    engineer_appointment_required: t.type === 'Ethernet' || t.carrier !== 'Openreach' ? 'TRUE' : 'FALSE',
    install_type: t.type === 'Ethernet' ? 'New Provide' : t.carrier === 'Openreach' ? 'Migration' : 'New Provide',
    months_free_rental: promoValid ? 3 : 0,
    orderable,
    lead_time: t.type === 'Ethernet' ? 45 : null,
    guaranteed_download_speed: guaranteed, guaranteed_upload_speed: guaranteed,
    router: t.type === 'Ethernet' ? 'Managed CPE' : 'Wires Only',
    meta: t.carrier === 'Openreach' ? { onts: [{ ont_reference: `ONT-${a.address.uprn.slice(-6)}`, available_ports: [1, 2, 3, 4] }] } : undefined,
  };
}

// ---------- quote store ----------
interface StoredQuote {
  ulid: string; resellerId: string; swiftUserId: string; ownerSub: string;
  createdBy: string; createdByEmail: string; customerName: string; address: GigAddress;
  createdAt: number; promocode: string | null; productTypes: string[] | null; hidden: boolean;
}
const VALID_PROMOS = ['GIGA-23'];
const store = new Map<string, StoredQuote>();

// Seed history: the dev user (swift 456) and a colleague (swift 457) in reseller 123
const seedCustomers = ['Macmillan Ltd', 'Discovery Schools', 'Enderby Fire Service', 'Test 2', 'Co-operative Retail Services', 'Gloucester Fire and Rescue', 'Alice Lee', 'Tom Smith', 'Bob Smith', 'Jane Doe'];
const seedPostcodes = ['PO1 5BX', 'LE3 5EJ', 'LE19 4NJ', 'GL2 5EL', 'PO4 4DT', 'BH24 1EY', 'SO14 2AA', 'GL2 E3L', 'BS1 6QH', 'SP1 1BA'];
for (let i = 0; i < 26; i++) {
  const mine = i % 3 !== 2;
  const address = addressesFor(seedPostcodes[i % seedPostcodes.length])[(i * 3) % 8];
  const id = `01gwhhv${String(i).padStart(2, '0')}a2mm7s5mfpfd9bfjw`.slice(0, 26);
  store.set(id, {
    ulid: id, resellerId: '123', swiftUserId: mine ? '456' : '457', ownerSub: mine ? 'auth0|dev-george' : 'auth0|dev-jane',
    createdBy: mine ? 'George' : 'Jane Tyler', createdByEmail: mine ? 'john.doe@xyzcomms.co.uk' : 'jane.tyler@xyzcomms.co.uk',
    customerName: seedCustomers[i % seedCustomers.length], address,
    createdAt: Date.UTC(2023, 1, 13, 11, 14) - i * 36e5 * 31, promocode: null, productTypes: null, hidden: i === 7,
  });
}

const visible = (u: PortalUser, q: StoredQuote, admin: boolean) =>
  q.resellerId === u.swiftResellerId && (admin || q.swiftUserId === u.swiftUserId);

export function mockCreateQuote(u: PortalUser, body: CreateQuoteBody): CreatedQuote {
  const address = addressesFor(body.postcode).find((a) => a.address.uprn === body.address_key || a.addressReference.addressReferenceNumber === body.address_key);
  if (!address) throw new GigError(400, 'Address not found');
  const id = ulid();
  store.set(id, {
    ulid: id, resellerId: u.swiftResellerId, swiftUserId: u.swiftUserId, ownerSub: u.sub,
    createdBy: u.name ?? 'Partner user', createdByEmail: u.email ?? '', customerName: body.customer_name ?? '',
    address, createdAt: Date.now(), promocode: body.promocode ?? null, productTypes: body.product_types ?? null, hidden: false,
  });
  return {
    quote_uid: id, createdBy: u.name ?? 'Partner user', dateCreated: new Date().toISOString(),
    address: {
      identifier: { reference: address.address.uprn, type: 'UPRN' }, short_address: address.address.formatted_short,
      postcode: address.address.postCode, addressKey: address.address.uprn, locality: address.address.locality,
    },
    status: 'Loading Quotes: Please Wait!',
  };
}

export function mockGetQuote(u: PortalUser, id: string, admin: boolean): QuoteDetail | undefined {
  const q = store.get(id);
  if (!q || !visible(u, q, admin)) return undefined;
  const elapsed = Date.now() - q.createdAt;
  const done = providerDelayMs.filter((d) => elapsed >= d).length;
  const promoValid = !!q.promocode && VALID_PROMOS.includes(q.promocode.toUpperCase());
  const quotes = providers.slice(0, done).flat()
    .filter((t) => !q.productTypes?.length || q.productTypes.includes(t.type.toLowerCase()))
    .map((t) => productsFor(t, q.address, promoValid))
    .filter((p): p is QuoteProduct => !!p);
  const remaining = providers.length - done;
  return {
    quote_ulid: q.ulid,
    address: {
      identifier: { reference: q.address.address.uprn, type: 'UPRN' }, short_address: q.address.address.formatted_short,
      postcode: q.address.address.postCode, town: q.address.address.postTown ?? '', locality: q.address.address.locality,
      addressKey: q.address.address.uprn,
    },
    status: remaining ? 'Generating' : 'Complete',
    quotes, remaining_providers: remaining, total_providers: providers.length,
    promocode: q.promocode, promocode_valid: promoValid ? 1 : 0,
    promocode_message: !q.promocode ? 'Promo code was not found' : promoValid ? 'Promo code applied: 3 months free rental' : 'Promo code was not found',
    reseller: 'Channels',
    customer_name: q.customerName, created_by: q.createdBy, created_at: new Date(q.createdAt).toISOString(),
  };
}

const toHistory = (q: StoredQuote): HistoryQuote => ({
  quote_id: q.ulid, customer_name: q.customerName, short_address: q.address.address.formatted_short,
  post_code: q.address.address.postCode, city: q.address.address.postTown ?? '',
  created_at: new Date(q.createdAt).toISOString(), created_by: q.createdBy, hide_quote: q.hidden, search_type: 'Single Search',
});

/** GET /api/v1/partner/quotes/{swift_user_id} */
export function mockUserHistory(swiftUserId: string, resellerId: string): UserHistoryResponse {
  return { quotes: [...store.values()].filter((q) => q.swiftUserId === swiftUserId && q.resellerId === resellerId).map(toHistory) };
}

/** GET /api/v1/partner/quotes/{swift_reseller_id} */
export function mockResellerHistory(resellerId: string): ResellerHistoryResponse {
  const byUser = new Map<string, HistoryQuote[]>();
  for (const q of store.values()) {
    if (q.resellerId !== resellerId) continue;
    byUser.set(q.createdByEmail, [...(byUser.get(q.createdByEmail) ?? []), toHistory(q)]);
  }
  return { reseller_id: resellerId, users: [...byUser].map(([email, quotes]) => ({ email, quotes })) };
}

export function mockHideQuote(u: PortalUser, id: string, hide: boolean, admin: boolean) {
  const q = store.get(id);
  if (!q || !visible(u, q, admin)) return undefined;
  q.hidden = hide;
  return toHistory(q);
}

// ---------- appointments ----------
const reservations = new Map<string, Reservation & { address_key: string; product_code: string }>();

function quoteProductAt(addressKey: string, productCode: string): QuoteProduct | undefined {
  for (const q of store.values()) {
    if (q.address.address.uprn !== addressKey) continue;
    const t = providers.flat().find((p) => p.code === productCode);
    const p = t && productsFor(t, q.address, false);
    if (p) return p;
  }
  // existing orders (amend install date) don't have a stored quote in the mock: allow FTTP codes
  if (/^R-(CF|GN|OR)-\d+$/.test(productCode)) return { orderable: true, engineer_appointment_required: 'TRUE' } as QuoteProduct;
  return undefined;
}

export function mockAppointments(q: AppointmentQuery): AppointmentsResponse {
  const product = quoteProductAt(q.address_key, q.product_code);
  if (!product || !product.orderable) throw new GigError(400, 'Product not available');
  const start = new Date(Math.max(Date.parse(q.start_datetime_iso) || Date.now(), Date.now() + 2 * 864e5));
  start.setUTCHours(0, 0, 0, 0);
  const data = [];
  for (let d = 0; data.length < 16 && d < 30; d++) {
    const day = new Date(start.getTime() + d * 864e5);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    for (const [from, to] of [[8, 13], [13, 18]]) {
      if (hash(q.address_key + day.toISOString() + from) % 4 === 0) continue; // some slots are taken
      const s = new Date(day); s.setUTCHours(from);
      const e = new Date(day); e.setUTCHours(to);
      data.push({ start_datetime_iso: s.toISOString(), end_datetime_iso: e.toISOString() });
    }
  }
  return data.length
    ? { status: 'success', data, content: '200', reason: 'Appointments Received' }
    : { status: 'success', data: [], content: '200', reason: 'No Appointments Received' };
}

export function mockReserve(q: AppointmentQuery & { end_datetime_iso: string }): Reservation {
  const slots = mockAppointments(q).data;
  if (!slots.some((s) => s.start_datetime_iso === q.start_datetime_iso && s.end_datetime_iso === q.end_datetime_iso)) {
    throw new GigError(404, 'Appointment Not Available');
  }
  const r = {
    start_datetime_iso: q.start_datetime_iso, end_datetime_iso: q.end_datetime_iso,
    reservation_key: `RSV-${ulid().slice(-10).toUpperCase()}`, valid_until: new Date(Date.now() + 30 * 6e4).toISOString(),
    address_key: q.address_key, product_code: q.product_code,
  };
  reservations.set(r.reservation_key, r);
  return r;
}

export const mockReservation = (key: string) => reservations.get(key);

// ---------- orders ----------
let orderSeq = 4500;
export function mockPlaceOrder(u: PortalUser, body: PlaceOrderBody, admin: boolean): PlaceOrderResponse {
  const item = body.product_order_item;
  const quote = mockGetQuote(u, item.quote_ulid, admin);
  if (!quote) throw new GigError(400, 'Address not found');
  if (quote.address.addressKey !== item.address_key) throw new GigError(400, 'Address not found');
  const product = quote.quotes.find((p) => p.partner_product_code === item.partner_product_code);
  if (!product || !product.orderable) throw new GigError(400, 'Product not available');

  let appointment: { date: string; slot: 'AM' | 'PM'; label: string } | null = null;
  if (item.engineer_appointment_reference) {
    const r = reservations.get(item.engineer_appointment_reference);
    if (!r || Date.parse(r.valid_until) < Date.now() || r.address_key !== item.address_key || r.product_code !== item.partner_product_code) {
      throw new GigError(400, 'Appointment reservation is invalid or has expired');
    }
    const s = new Date(r.start_datetime_iso);
    const am = s.getUTCHours() < 12;
    appointment = { date: r.start_datetime_iso.slice(0, 10), slot: am ? 'AM' : 'PM', label: `${s.toLocaleDateString('en-GB', { timeZone: 'UTC' })} ${am ? '08:00 - 13:00 (AM slot)' : '13:00 - 18:00 (PM slot)'}` };
    reservations.delete(r.reservation_key);
  }

  const n = ++orderSeq;
  const giganetRef = `ORD${String(n).padStart(8, '0')}`;
  const soRef = `SO000${30000 + n}`;
  const c = item.end_customer_contact;
  mockAddOrder(
    {
      id: `ord-gn-${n}`, location: quote.address.town ?? '', postcode: quote.address.postcode,
      partnerOrderRef: body.partner_reference ?? '', quoteId: quote.quote_ulid, orderReference: giganetRef,
      productName: product.product_name, status: 'In progress', createdAt: new Date().toISOString(),
    },
    {
      customerName: item.customer_site_name, address: quote.address.short_address, city: quote.address.town ?? '',
      datePlaced: new Date().toISOString(), dateInstalled: null,
      contact: { firstName: c.firstName, lastName: c.lastName, telephone: c.mobile_phone ?? c.home_phone ?? '' },
      supplier: product.carrier, addressKey: item.address_key, productCode: product.partner_product_code,
      productType: product.product_type.toLowerCase(), appointment,
    },
  );
  return { reason: 'Order Accepted', giganet_order_reference: giganetRef, partner_reference: body.partner_reference ?? null, order_reference: soRef };
}
