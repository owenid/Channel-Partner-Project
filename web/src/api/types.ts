// Mirrors server/src/types.ts and server/src/cases.types.ts (the portal API contract).
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
export type Widget<T> = { ok: true; data: T } | { ok: false; error: string };

export interface NewsItem { id: string; title: string; summary: string; imageUrl: string | null; url: string; publishedAt: string }
export interface Offer { id: string; title: string; expiresAt: string; imageUrl: string | null; url: string }
export interface QuoteSummary { id: string; reference: string; postcode: string; createdAt: string; status: string }
export interface QuoteVolumePoint { period: string; label: string; count: number }
export interface ProductShare { variant: string; count: number }
export interface AccountProfile { firstName: string; lastName: string; email: string; partnerName: string; role: string; department: string }
export interface SupportContacts { contacts: { role: string; name: string; email: string }[]; websiteUrl: string }
export interface Dashboard {
  news: Widget<NewsItem[]>; offers: Widget<Offer[]>; recentQuotes: Widget<QuoteSummary[]>;
  quoteHistory: Widget<QuoteVolumePoint[]>; productSummary: Widget<ProductShare[]>;
  profile: Widget<AccountProfile>; contacts: Widget<SupportContacts>;
}
export type VolumeRange = 'last-month' | 'last-3-months' | 'last-12-months' | 'last-24-months';

export type ResourceCategory = 'quick-guides' | 'legal' | 'training';
export interface Resource {
  id: string; category: ResourceCategory; tag: string; bannerText: string; title: string; summary: string;
  imageUrl: string | null; url: string; theme: 'light' | 'teal' | 'dark'; art: 'phone' | 'laptop' | 'network';
}

export interface Order {
  id: string; location: string; postcode: string; partnerOrderRef: string; quoteId: string;
  orderReference: string; productName: string; status: string; createdAt: string;
}
export type AuthorType = 'agent' | 'customer' | 'system';
export interface OrderUpdate { id: string; orderReference: string; update: string; stage: string; status: string; comment: string; author: string; authorType: AuthorType; raisedAt: string }
export interface OrderUpdateRow extends OrderUpdate { orderId: string }
export interface OrderDetail extends Order {
  customerName: string; address: string; city: string; datePlaced: string; dateInstalled: string | null;
  contact: { firstName: string; lastName: string; telephone: string }; supplier: string;
  appointment: { date: string; slot: 'AM' | 'PM'; label: string } | null;
  cancellable: boolean; stageIndex: number; updates: OrderUpdate[];
}

export interface Service {
  id: string; location: string; postcode: string; orderReference: string; serviceReference: string;
  quoteReference: string; serviceName: string; status: string; createdAt: string;
}
export interface ServiceDetail extends Service {
  address: string; city: string; radiusUsername: string; ipv4: string; ipv6: string; online: boolean;
  radiusSessions: { start: string; end: string | null; ip: string }[];
}

export interface SupportCase { id: string; caseNumber: string; createdAt: string; serviceReference: string; summary: string; status: string; priority: string; partnerContact: string }
export interface CaseUpdate { id: string; updatedAt: string; summary: string; status: string; comment: string; author: string; authorType: AuthorType; updatedBy: string }
export interface CaseDetail extends SupportCase {
  lastUpdated: string; resolvedAt: string | null; description: string; category: string;
  partnerReference: string; impact: string; urgency: string; updates: CaseUpdate[];
}

export const ORDER_STATUSES = ['In progress', 'On hold', 'Cancelled', 'Awaiting information', 'Scheduled', 'Acknowledged', 'Completed'];
export const SERVICE_STATUSES = ['Operational', 'Offline', 'Alt status'];
export const UPDATE_STAGES = ['On hold', 'Order placed', 'Appointment confirmed', 'Appointment Change', 'Full fibre service CI created'];
export const UPDATE_STATUSES = ['In progress', 'On hold', 'Cancelled', 'Rejected', 'Awaiting information', 'Completed', 'Alt status'];
export const CASE_STATUSES = ['New', 'In progress', 'Awaiting customer', 'Awaiting supplier', 'On hold - scheduled', 'Resolved'];
export const CASE_PRIORITIES = [['Critical', 'Priority P1'], ['High', 'Priority P2'], ['Moderate', 'Priority P3'], ['Low', 'Priority P4'], ['None', 'Priority P5']] as const;
export const CANCELLATION_REASONS = [
  'Existing supplier lowered price', 'Failed install (Customer)', 'Failed install (Supplier)',
  'In contract with existing supplier', 'Change in personal circumstances', 'Customer preferred not to say',
  'DD Mandate Cancelled', 'Supplier Delay', 'Supplier rejected order',
];
