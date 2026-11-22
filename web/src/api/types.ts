// Mirrors the portal API contract (server/src/types.ts, server/src/cases.types.ts).
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }

export interface Me { userId: string; orgId: string; name: string; role: 'partner-admin' | 'partner-user'; permissions: string[] }

// ---- Home Page Menu design ----
export interface ImageRef { src: string; alt: string; width: number; height: number }
export interface Newsletter { id: number; newsletter_title: string; newsletter_body: string; start_date: string; end_date: string; img_src: ImageRef | null }
export interface PortalOffer { id: string; name: string; title: string; description: string; start_date: string; end_date: string; image_src: ImageRef | null }
export interface QuoteVolumePoint { period: string; label: string; count: number }
export interface ProductShare { variant: string; count: number }
export interface AccountProfile { firstName: string; lastName: string; email: string; partnerName: string; role: string; department: string }
export interface SupportContacts { contacts: { role: string; name: string; email: string }[]; websiteUrl: string }
export type VolumeRange = 'last-month' | 'last-3-months' | 'last-12-months' | 'last-24-months';

// ---- Quotes (Retrieve Quotes, Check FTTP Availability designs) ----
export interface QuoteSummaryItem { id: string; postcode: string; created_at: string }
export interface HistoryQuote {
  quote_id: string; customer_name: string; short_address: string; post_code: string; city: string;
  created_at: string; created_by: string; hide_quote: boolean; search_type?: string;
}
export interface QuotesResponse<T> { partner_id: string; user_id: string; quotes: T[]; page: number; limit: number | null; total: number }
export interface GigAddress {
  address: { formatted_short: string; postCode: string; postTown: string | null; uprn: string; organisationName: string | null };
  addressReference: { qualifier: string; addressReferenceNumber: string; districtCode: string };
  fttpAvailabilityStatus: string;
  gn_build_area?: string;
}
export interface CreatedQuote { quote_uid: string; createdBy: string; dateCreated: string; status: string }
export interface QuoteProduct {
  uuid: string; product_name: string; partner_product_code: string; product_type: string; carrier: string;
  bearer_speed_upload: string; bearer_speed_download: string; cdr_speed_upload: string; cdr_speed_download: string;
  availability_status: string; engineer_appointment_required: string | boolean; install_type: string;
  months_free_rental: number; orderable: boolean | number; lead_time: number | string | null;
  guaranteed_download_speed: string; guaranteed_upload_speed: string; router: string;
  meta?: { onts?: { ont_reference: string; available_ports: number[] }[] };
}
export interface QuoteDetail {
  quote_ulid: string;
  address: { identifier: { reference: string; type: string }; short_address: string; postcode: string; town?: string; locality?: string | null; addressKey?: string };
  status: string; quotes: QuoteProduct[]; remaining_providers: number; total_providers: number;
  promocode: string | null; promocode_valid: number; promocode_message: string; reseller: string;
  customer_name?: string; created_by?: string; created_at?: string;
}
export interface AppointmentSlot { start_datetime_iso: string; end_datetime_iso: string }
export interface AppointmentsResponse { status: string; data: AppointmentSlot[]; content: string; reason: string }
export interface PlaceOrderResponse { reason: string; giganet_order_reference: string; partner_reference: string | null; order_reference: string }

export const isOrderable = (p: QuoteProduct) => p.orderable === true || p.orderable === 1;
export const needsEngineer = (p: QuoteProduct) => String(p.engineer_appointment_required).toUpperCase() === 'TRUE';

// ---- Resources ----
export type ResourceCategory = 'quick-guides' | 'legal' | 'training';
export interface Resource {
  id: string; category: ResourceCategory; tag: string; bannerText: string; title: string; summary: string;
  imageUrl: string | null; url: string; theme: 'light' | 'teal' | 'dark'; art: 'phone' | 'laptop' | 'network';
}

// ---- Orders (Orders Placed View, Order Status Updates designs) ----
export interface Order {
  id: string; location: string; postcode: string; partnerOrderRef: string; quoteId: string;
  orderReference: string; productName: string; status: string; createdAt: string;
}
export type AuthorType = 'agent' | 'customer' | 'system';
export interface OrderUpdate { id: string; orderReference: string; update: string; stage: string; status: string; comment: string; author: string; authorType: AuthorType; raisedAt: string }
export interface OrderUpdateRow extends OrderUpdate { orderId: string }
export type StepState = 'done' | 'partial' | 'todo' | 'error' | 'warn';
export interface StatusPath { kind: 'normal' | 'rejected' | 'cancelled' | 'delayed' | 'on-hold'; steps: { label: string; state: StepState }[] }
export interface OrderDetail extends Order {
  customerName: string; address: string; city: string; datePlaced: string; dateInstalled: string | null;
  contact: { firstName: string; lastName: string; telephone: string }; supplier: string;
  addressKey: string; productCode: string; productType: string;
  appointment: { date: string; slot: 'AM' | 'PM'; label: string } | null;
  cancellable: boolean; orderStage: string; orderLineState: string; statusPath: StatusPath; updates: OrderUpdate[];
}

// ---- Live services ----
export interface Service {
  id: string; location: string; postcode: string; orderReference: string; serviceReference: string;
  quoteReference: string; serviceName: string; status: string; createdAt: string;
}
export interface ServiceDetail extends Service {
  address: string; city: string; customerName: string;
  radiusUsername: string; ipv4: string; ipv6: string; ipv6Prefix: string;
  online: boolean; suspended: boolean; billCycleEnd: string;
  pendingChange: { toProduct: string; effective: string; effectiveDate: string } | null;
}
export interface RadiusSession { id: string; username: string; start: string; end: string | null; durationSeconds: number; downloadBytes: number; uploadBytes: number }
export type EffectiveMode = 'Immediately' | 'At the end of bill cycle';
export interface ModifyOptions {
  currentProduct: string; currentBandwidthMbps: number; billCycleEnd: string; effectiveModes: EffectiveMode[];
  products: { id: string; name: string; bandwidthMbps: number; direction: 'upgrade' | 'downgrade' }[];
}

// ---- Support cases ----
export interface SupportCase { id: string; caseNumber: string; createdAt: string; serviceReference: string; summary: string; status: string; priority: string; partnerContact: string }
export interface CaseUpdate { id: string; updatedAt: string; summary: string; status: string; comment: string; author: string; authorType: AuthorType; updatedBy: string }
export interface CaseDetail extends SupportCase {
  lastUpdated: string; resolvedAt: string | null; description: string; category: string;
  partnerReference: string; impact: string; urgency: string; updates: CaseUpdate[];
}

export const ORDER_STATUSES = ['In progress', 'Scheduled', 'Completed', 'On hold', 'Delayed', 'Cancelled', 'Rejected'];
export const SERVICE_STATUSES = ['Operational', 'Offline', 'Suspended', 'Alt status'];
export const CASE_STATUSES = ['New', 'In progress', 'Awaiting customer', 'Awaiting supplier', 'On hold - scheduled', 'Resolved'];
export const CASE_PRIORITIES = [['Critical', 'Priority P1'], ['High', 'Priority P2'], ['Moderate', 'Priority P3'], ['Low', 'Priority P4'], ['None', 'Priority P5']] as const;
export const CANCELLATION_REASONS = [
  'Existing supplier lowered price', 'Failed install (Customer)', 'Failed install (Supplier)',
  'In contract with existing supplier', 'Change in personal circumstances', 'Customer preferred not to say',
  'DD Mandate Cancelled', 'Supplier Delay', 'Supplier rejected order',
];
