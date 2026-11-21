// ---- Support cases (ServiceNow) ----
export const CASE_STATUSES = ['New', 'In progress', 'Awaiting customer', 'Awaiting supplier', 'On hold - scheduled', 'Resolved'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
/** P1..P5 */
export const CASE_PRIORITIES = ['Critical', 'High', 'Moderate', 'Low', 'None'] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];
export const CASE_CATEGORIES = ['Fault - no service', 'Fault - degraded service', 'Billing query', 'Order query', 'Change request', 'General enquiry'] as const;
export const IMPACT_LEVELS = ['1 - High', '2 - Medium', '3 - Low'] as const;
export const URGENCY_LEVELS = ['1 - High', '2 - Medium', '3 - Low'] as const;

export interface SupportCase {
  id: string; caseNumber: string; createdAt: string; serviceReference: string;
  summary: string; status: CaseStatus; priority: CasePriority; partnerContact: string;
}
export interface CaseUpdate {
  id: string; updatedAt: string; summary: string; status: CaseStatus;
  comment: string; author: string; authorType: 'agent' | 'customer' | 'system'; updatedBy: string;
}
export interface CaseDetail extends SupportCase {
  lastUpdated: string; resolvedAt: string | null; description: string;
  category: string; partnerReference: string; impact: string; urgency: string;
  updates: CaseUpdate[];
}
export interface CaseFilter {
  caseId?: string; serviceRef?: string;
  priorities?: CasePriority[]; statuses?: CaseStatus[];
  from?: string; to?: string;
  sort?: keyof SupportCase; dir?: 'asc' | 'desc';
  page: number; pageSize: number;
}
export interface NewCase {
  partnerReference?: string; category: string; summary: string; detail: string;
  impact: string; urgency: string; serviceReference: string;
}
