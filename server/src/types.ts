import type { StatusPath } from './lib/orderPath.js';
// Portal-facing models. Adapters map each upstream system's payloads onto these,
// so the front end never depends on a vendor's API shape.

export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }

// ---- Home Page Menu design (Confluence) - portal API contract ----
export interface ImageRef { src: string; alt: string; width: number; height: number }
/** GET /api/v1/portal/newsletter -> { results: Newsletter[] } */
export interface Newsletter {
  id: number; newsletter_title: string; newsletter_body: string;
  start_date: string; end_date: string; img_src: ImageRef | null;
}
/** GET /api/v1/portal/offers -> { offers: PortalOffer[] } */
export interface PortalOffer {
  id: string; name: string; title: string; description: string;
  start_date: string; end_date: string; image_src: ImageRef | null;
}
/** GET /api/v1/partner/quotes -> QuotesResponse. summary=true returns QuoteSummaryItem (Home);
 *  summary=false returns full HistoryQuote rows (My Quotes). */
export interface QuoteSummaryItem { id: string; postcode: string; created_at: string }
export interface QuotesResponse {
  partner_id: string; user_id: string;
  quotes: (QuoteSummaryItem | HistoryQuote)[];
  page: number; limit: number | null; total: number;
}
export interface QuoteQuery {
  owner?: string; page: number; limit?: number; sort?: 'date'; order: 'asc' | 'desc'; summary: boolean;
  id?: string; address?: string; ip_address?: string; postcode?: string; customer_name?: string;
  before?: string; after?: string; include_hidden?: boolean;
}

// ---- GIG (Giganet Information Gateway / SWIFT) - Check FTTP Availability + Retrieve Quotes designs ----
export interface GigAddress {
  address: {
    organisationName: string | null; poBox: string | null; subPremises: string | null; premisesName: string | null;
    thoroughfareNumber: string | null; dependentThoroughfareName: string | null; thoroughfareName: string | null;
    doubleDependentLocality: string | null; locality: string | null; postTown: string | null; county: string | null;
    postCode: string; country: string; uprn: string; exchangeGroupCode: string | null; formatted_short: string;
  };
  addressReference: { qualifier: string; addressReferenceNumber: string; districtCode: string };
  fttpAvailabilityStatus: string;
  coordinates?: { long: string; lat: string };
  url?: string; gn_build_area?: string; fttp_available_postcode?: string; fttp_planned_postcode?: string; cf_restricted_location?: string;
}
export interface CreateQuoteBody { address_key: string; postcode: string; product_types?: ('fttp' | 'ethernet')[]; promocode?: string; customer_name?: string }
export interface QuoteAddress { identifier: { reference: string; type: string }; short_address: string; postcode: string; town?: string; locality?: string | null; addressKey?: string }
export interface QuoteProduct {
  uuid: string; product_name: string; partner_product_code: string; product_type: string; carrier: string;
  bearer_speed_upload: string; bearer_speed_download: string; cdr_speed_upload: string; cdr_speed_download: string;
  availability_status: 'Register-Interest' | 'Pre-Order' | 'Coming-Soon' | 'Available' | string;
  engineer_appointment_required: string | boolean;
  install_type: 'Activation' | 'Migration' | 'New Provide' | 'Working Line Takeover' | string;
  months_free_rental: number; orderable: boolean | number; lead_time: number | string | null;
  guaranteed_download_speed: string; guaranteed_upload_speed: string; router: string;
  meta?: { onts?: { ont_reference: string; available_ports: number[] }[] };
}
/** Create Quote initial response */
export interface CreatedQuote { quote_uid: string; createdBy: string; dateCreated: string; address: QuoteAddress; status: string }
/** GET /api/v1/partner/quotes/{quote_ulid} */
export interface QuoteDetail {
  quote_ulid: string; address: QuoteAddress; status: string; quotes: QuoteProduct[];
  remaining_providers: number; total_providers: number;
  promocode: string | null; promocode_valid: number; promocode_message: string; reseller: string;
  // portal additions (not in the GIG example)
  customer_name?: string; created_by?: string; created_at?: string;
}
/** One row of quote history (Retrieve Quotes design) */
export interface HistoryQuote {
  quote_id: string; customer_name: string; short_address: string; post_code: string; city: string;
  created_at: string; created_by: string; hide_quote: boolean;
  search_type?: string; // shown in the My Quotes wireframe; not in the GIG example
}
export interface UserHistoryResponse { quotes: HistoryQuote[] }

// ---- Engineer Appointments and Reservation design ----
export interface AppointmentQuery { start_datetime_iso: string; address_key: string; postcode?: string; product_code: string }
export interface AppointmentSlot { start_datetime_iso: string; end_datetime_iso: string }
export interface AppointmentsResponse { status: string; data: AppointmentSlot[]; content: string; reason: string }
export interface Reservation { start_datetime_iso: string; end_datetime_iso: string; reservation_key: string; valid_until: string }

// ---- Order Placement design ----
export interface EndCustomerContact { firstName: string; lastName: string; email: string; mobile_phone?: string; home_phone?: string }
export interface PlaceOrderBody {
  partner_reference?: string; notes?: string;
  product_order_item: {
    quote_ulid: string; partner_product_code: string; address_key: string; postcode?: string;
    customer_site_name: string; end_customer_contact: EndCustomerContact;
    engineer_appointment_reference?: string; requested_install_datetime?: string; install_asap?: boolean;
    hazards?: string; ont_ref?: string; ont_port?: string;
  };
}
export interface PlaceOrderResponse { reason: string; giganet_order_reference: string; partner_reference: string | null; order_reference: string }
/** Errors GIG returns as { code, reason, status } - surfaced to the user as-is */
export class GigError extends Error {
  constructor(public status: number, public reason: string) { super(reason); }
}
export interface ResellerHistoryResponse { reseller_id: string; users: { email: string; quotes: HistoryQuote[] }[] }

// ---- CMS ----
export interface NewsItem { id: string; title: string; summary: string; imageUrl: string | null; url: string; publishedAt: string }
export interface Offer { id: string; title: string; expiresAt: string; imageUrl: string | null; url: string }

export type ResourceCategory = 'quick-guides' | 'legal' | 'training';
export const RESOURCE_CATEGORIES: ResourceCategory[] = ['quick-guides', 'legal', 'training'];
export interface Resource {
  id: string; category: ResourceCategory;
  tag: string; bannerText: string; title: string; summary: string;
  imageUrl: string | null; url: string;
  /** card colour style from the design: white, teal or navy */
  theme: 'light' | 'teal' | 'dark';
  /** illustration used when no imageUrl is set */
  art: 'phone' | 'laptop' | 'network';
}

// ---- SWIFT ----
export interface QuoteSummary { id: string; reference: string; postcode: string; createdAt: string; status: string }
export interface QuoteVolumePoint { period: string; label: string; count: number }
export interface ProductShare { variant: string; count: number }
export type VolumeRange = 'last-month' | 'last-3-months' | 'last-12-months' | 'last-24-months';
export const VOLUME_RANGES: VolumeRange[] = ['last-month', 'last-3-months', 'last-12-months', 'last-24-months'];

// ---- Salesforce ----
export interface Contact { role: string; name: string; email: string }
export interface AccountProfile {
  firstName: string; lastName: string; email: string;
  partnerName: string; role: string; department: string;
}
export interface SupportContacts { contacts: Contact[]; websiteUrl: string }

// ---- ServiceNow (connections) ----
export type OrderStatus = 'In progress' | 'On hold' | 'Cancelled' | 'Awaiting information' | 'Scheduled' | 'Acknowledged' | 'Completed' | 'Rejected' | 'Delayed';
export interface Order {
  id: string; location: string; postcode: string; partnerOrderRef: string;
  quoteId: string; orderReference: string; productName: string; status: OrderStatus;
  createdAt: string;
}
export type ConnectionsView = 'orders' | 'order-updates' | 'live-service' | 'support-cases';
export const CONNECTION_VIEWS: ConnectionsView[] = ['orders', 'order-updates', 'live-service', 'support-cases'];
export interface OrderFilter {
  view: ConnectionsView;
  partnerOrderRef?: string; address?: string; location?: string; status?: OrderStatus;
  from?: string; to?: string;
  sort?: keyof Order; dir?: 'asc' | 'desc';
  page: number; pageSize: number;
}

// ---- Order detail + actions ----
export interface OrderUpdate {
  id: string; orderReference: string; update: string; stage: string;
  status: string; comment: string; author: string;
  authorType: 'agent' | 'customer' | 'system';
  raisedAt: string;
}
export const ORDER_STAGES = ['Order placed', 'Order Acknowledged', 'Installation Scheduled', 'Order operational'] as const;
export const ORDER_STATUSES: OrderStatus[] = ['In progress', 'On hold', 'Cancelled', 'Awaiting information', 'Scheduled', 'Acknowledged', 'Completed', 'Rejected', 'Delayed'];
export interface OrderDetail extends Order {
  customerName: string;
  address: string; city: string;
  datePlaced: string; dateInstalled: string | null;
  contact: { firstName: string; lastName: string; telephone: string };
  supplier: string;
  /** needed to query engineer appointments via GIG when amending the install date */
  addressKey: string; productCode: string; productType: string;
  appointment: { date: string; slot: 'AM' | 'PM'; label: string } | null;
  cancellable: boolean;
  /** latest order_line_stage / state from the Order Status Updates DB (Orders Placed View design) */
  orderStage: string; orderLineState: string;
  statusPath: StatusPath;
  updates: OrderUpdate[];
}
export const CANCELLATION_REASONS = [
  'Existing supplier lowered price',
  'Failed install (Customer)',
  'Failed install (Supplier)',
  'In contract with existing supplier',
  'Change in personal circumstances',
  'Customer preferred not to say',
  'DD Mandate Cancelled',
  'Supplier Delay',
  'Supplier rejected order',
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

// ---- Live services ----
export type ServiceStatus = 'Operational' | 'Offline' | 'Suspended' | 'Alt status';
export const SERVICE_STATUSES: ServiceStatus[] = ['Operational', 'Offline', 'Suspended', 'Alt status'];
export interface Service {
  id: string; location: string; postcode: string; orderReference: string;
  serviceReference: string; quoteReference: string; serviceName: string;
  status: ServiceStatus; createdAt: string;
}
export interface ServiceFilter {
  quoteRef?: string; serviceRef?: string; address?: string; location?: string;
  status?: ServiceStatus; from?: string; to?: string;
  sort?: keyof Service; dir?: 'asc' | 'desc';
  page: number; pageSize: number;
}
export interface ServiceDetail extends Service {
  address: string; city: string; customerName: string;
  radiusUsername: string; ipv4: string;
  /** WAN address and delegated prefix */
  ipv6: string; ipv6Prefix: string;
  online: boolean;
  suspended: boolean;
  /** a modify/upgrade/downgrade waiting for the end of the bill cycle */
  pendingChange: { toProduct: string; effective: string; effectiveDate: string } | null;
  billCycleEnd: string;
}
export interface RadiusSession { id: string; username: string; start: string; end: string | null; durationSeconds: number; downloadBytes: number; uploadBytes: number }

// ---- Modify (upgrade / downgrade) and suspension ----
export const EFFECTIVE_MODES = ['Immediately', 'At the end of bill cycle'] as const;
export type EffectiveMode = (typeof EFFECTIVE_MODES)[number];
export interface ProductOption { id: string; name: string; bandwidthMbps: number; direction: 'upgrade' | 'downgrade' }
export interface ModifyOptions { currentProduct: string; currentBandwidthMbps: number; products: ProductOption[]; effectiveModes: readonly EffectiveMode[]; billCycleEnd: string }
export const SUSPEND_REASONS = ['Payment default', 'Customer request', 'Fraud investigation', 'Acceptable use policy breach', 'Other'] as const;
export const UNSUSPEND_REASONS = ['Payment received', 'Customer request', 'Investigation closed', 'Other'] as const;
export type SuspensionAction = 'suspend' | 'unsuspend';

// ---- Order updates feed (Connections > Order updates) ----
export interface OrderUpdateRow extends OrderUpdate { orderId: string }
export interface OrderUpdateFilter {
  orderRef?: string; stage?: string; status?: string; from?: string; to?: string;
  sort?: keyof OrderUpdateRow; dir?: 'asc' | 'desc';
  page: number; pageSize: number;
}
