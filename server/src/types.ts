// Portal-facing models. Adapters map each upstream system's payloads onto these,
// so the front end never depends on a vendor's API shape.

export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }

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
export type OrderStatus = 'In progress' | 'On hold' | 'Cancelled' | 'Awaiting information' | 'Scheduled' | 'Acknowledged' | 'Completed';
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
export const ORDER_STATUSES: OrderStatus[] = ['In progress', 'On hold', 'Cancelled', 'Awaiting information', 'Scheduled', 'Acknowledged', 'Completed'];
export interface OrderDetail extends Order {
  customerName: string;
  address: string; city: string;
  datePlaced: string; dateInstalled: string | null;
  contact: { firstName: string; lastName: string; telephone: string };
  supplier: string;
  appointment: { date: string; slot: 'AM' | 'PM'; label: string } | null;
  cancellable: boolean;
  /** index into ORDER_STAGES of the last completed stage */
  stageIndex: number;
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
export type ServiceStatus = 'Operational' | 'Offline' | 'Alt status';
export const SERVICE_STATUSES: ServiceStatus[] = ['Operational', 'Offline', 'Alt status'];
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
  address: string; city: string;
  radiusUsername: string; ipv4: string; ipv6: string;
  online: boolean;
  radiusSessions: { start: string; end: string | null; ip: string }[];
}

// ---- Order updates feed (Connections > Order updates) ----
export interface OrderUpdateRow extends OrderUpdate { orderId: string }
export const UPDATE_STAGES = ['On hold', 'Order placed', 'Appointment confirmed', 'Appointment Change', 'Full fibre service CI created'];
export const UPDATE_STATUSES = ['In progress', 'On hold', 'Cancelled', 'Rejected', 'Awaiting information', 'Completed', 'Alt status'];
export interface OrderUpdateFilter {
  orderRef?: string; stage?: string; status?: string; from?: string; to?: string;
  sort?: keyof OrderUpdateRow; dir?: 'asc' | 'desc';
  page: number; pageSize: number;
}
