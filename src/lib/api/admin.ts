/**
 * Admin CRUD API (blueprint `/api/admin`).
 *
 * All responses follow the pagination envelope for lists:
 * `{ items, pagination: { page, per_page, total, total_pages } }`.
 */

import { apiDelete, apiGet, apiPost, apiPut, apiQuery } from './client';
import type {
  Booking,
  CompanySettings,
  Evidence,
  Finding,
  Paginated,
  Permit,
  Proponent,
  ProponentDetail,
  ReportSchedule,
  ServiceRequest,
} from '../../types';

export interface PageQuery {
  page?: number;
  per_page?: number;
  q?: string;
  proponent_id?: string;
  include_deleted?: boolean;
}

export interface ListPermitsQuery extends PageQuery {
  status?: string;
  type?: string;
}

export interface ListSchedulesQuery extends PageQuery {
  permit_id?: string;
  report_type?: string;
  status?: string;
}

export interface ListFindingsQuery extends PageQuery {
  report_schedule_id?: string;
  compliance_status?: string;
  risk_level?: string;
  action_status?: string;
}

export interface ListEvidenceQuery extends PageQuery {
  finding_id?: string;
  review_status?: string;
}

export interface ListBookingsQuery extends PageQuery {
  booking_status?: string;
  service?: string;
}

export interface ListRequestsQuery extends PageQuery {
  status?: string;
  service?: string;
}

// --------------------------------------------------------------------------- //
// Proponents
// --------------------------------------------------------------------------- //

export type ProponentPayload = Partial<
  Pick<
    Proponent,
    | 'company_name'
    | 'contact_person'
    | 'email'
    | 'phone'
    | 'whatsapp_number'
    | 'project_type'
    | 'county'
    | 'district'
    | 'project_location'
    | 'project_description'
    | 'status'
  >
>;

export function listProponents(query: PageQuery = {}): Promise<Paginated<Proponent>> {
  return apiGet<Paginated<Proponent>>(apiQuery('/admin/proponents', query));
}

export function getProponent(id: string): Promise<ProponentDetail> {
  return apiGet<ProponentDetail>(`/admin/proponents/${id}`);
}

export function createProponent(payload: ProponentPayload): Promise<Proponent> {
  return apiPost<Proponent>('/admin/proponents', payload);
}

export function updateProponent(id: string, payload: ProponentPayload): Promise<Proponent> {
  return apiPut<Proponent>(`/admin/proponents/${id}`, payload);
}

export function deleteProponent(id: string): Promise<void> {
  return apiDelete<void>(`/admin/proponents/${id}`);
}

export function restoreProponent(id: string): Promise<Proponent> {
  return apiPost<Proponent>(`/admin/proponents/${id}/restore`);
}

// --------------------------------------------------------------------------- //
// Permits
// --------------------------------------------------------------------------- //

export interface PermitPayload {
  proponent_id: string;
  permit_number: string;
  permit_type: string;
  status?: string;
  issue_date?: string | null;
  expiry_date?: string | null;
}

export async function listPermits(
  query: ListPermitsQuery = {},
): Promise<Paginated<Permit>> {
  const data = await apiGet<Paginated<Permit>>(apiQuery('/admin/permits', query));
  return enrichPermits(data);
}

async function enrichPermits(data: Paginated<Permit>): Promise<Paginated<Permit>> {
  const names = await proponentNameMap();
  return {
    ...data,
    items: data.items.map((permit) => ({
      ...permit,
      proponent_name: names[permit.proponent_id] || '',
    })),
  };
}

export function getPermit(id: string): Promise<Permit> {
  return apiGet<Permit>(`/admin/permits/${id}`);
}

export function createPermit(payload: PermitPayload): Promise<Permit> {
  return apiPost<Permit>('/admin/permits', payload);
}

export function updatePermit(id: string, payload: Partial<PermitPayload>): Promise<Permit> {
  return apiPut<Permit>(`/admin/permits/${id}`, payload);
}

export function deletePermit(id: string): Promise<void> {
  return apiDelete<void>(`/admin/permits/${id}`);
}

// --------------------------------------------------------------------------- //
// Report schedules
// --------------------------------------------------------------------------- //

export interface SchedulePayload {
  proponent_id: string;
  permit_id?: string | null;
  report_type: string;
  reporting_period?: string | null;
  due_date: string;
  status?: string;
}

export async function listSchedules(
  query: ListSchedulesQuery = {},
): Promise<Paginated<ReportSchedule>> {
  const data = await apiGet<Paginated<ReportSchedule>>(
    apiQuery('/admin/schedules', query),
  );
  const names = await proponentNameMap();
  return {
    ...data,
    items: data.items.map((schedule) => ({
      ...schedule,
      proponent_name: names[schedule.proponent_id] || '',
    })),
  };
}

export function getSchedule(id: string): Promise<ReportSchedule> {
  return apiGet<ReportSchedule>(`/admin/schedules/${id}`);
}

export function createSchedule(payload: SchedulePayload): Promise<ReportSchedule> {
  return apiPost<ReportSchedule>('/admin/schedules', payload);
}

export function updateSchedule(
  id: string,
  payload: Partial<SchedulePayload>,
): Promise<ReportSchedule> {
  return apiPut<ReportSchedule>(`/admin/schedules/${id}`, payload);
}

export function deleteSchedule(id: string): Promise<void> {
  return apiDelete<void>(`/admin/schedules/${id}`);
}

// --------------------------------------------------------------------------- //
// Findings
// --------------------------------------------------------------------------- //

export interface FindingPayload {
  proponent_id: string;
  report_schedule_id?: string | null;
  inspection_area?: string | null;
  finding_title: string;
  finding_description?: string | null;
  compliance_status: string;
  risk_level: string;
  corrective_action?: string | null;
  recommendation?: string | null;
  action_deadline?: string | null;
  responsible_party?: string | null;
  action_status?: string;
  sent_to_proponent?: boolean;
}

export async function listFindings(
  query: ListFindingsQuery = {},
): Promise<Paginated<Finding>> {
  const data = await apiGet<Paginated<Finding>>(apiQuery('/admin/findings', query));
  const names = await proponentNameMap();
  return {
    ...data,
    items: data.items.map((finding) => ({
      ...finding,
      proponent_name: names[finding.proponent_id] || '',
    })),
  };
}

export function getFinding(id: string): Promise<Finding> {
  return apiGet<Finding>(`/admin/findings/${id}`);
}

export function createFinding(payload: FindingPayload): Promise<Finding> {
  return apiPost<Finding>('/admin/findings', payload);
}

export function updateFinding(id: string, payload: Partial<FindingPayload>): Promise<Finding> {
  return apiPut<Finding>(`/admin/findings/${id}`, payload);
}

export function deleteFinding(id: string): Promise<void> {
  return apiDelete<void>(`/admin/findings/${id}`);
}

// --------------------------------------------------------------------------- //
// Evidence
// --------------------------------------------------------------------------- //

export async function listEvidence(
  query: ListEvidenceQuery = {},
): Promise<Paginated<Evidence>> {
  const data = await apiGet<Paginated<Evidence>>(apiQuery('/admin/evidence', query));
  return {
    ...data,
    items: data.items.map((evidence) => ({
      ...evidence,
      proponent_name: evidence.proponent?.company_name || '',
    })),
  };
}

export function getEvidence(id: string): Promise<Evidence> {
  return apiGet<Evidence>(`/admin/evidence/${id}`);
}

export function deleteEvidence(id: string): Promise<void> {
  return apiDelete<void>(`/admin/evidence/${id}`);
}

// --------------------------------------------------------------------------- //
// Bookings
// --------------------------------------------------------------------------- //

export type BookingPayload = Partial<
  Pick<
    Booking,
    | 'proponent_id'
    | 'full_name'
    | 'company_name'
    | 'email'
    | 'phone'
    | 'whatsapp_number'
    | 'service_needed'
    | 'preferred_date'
    | 'preferred_time'
    | 'project_location'
    | 'message'
    | 'booking_status'
    | 'meeting_link'
  >
>;

export function listBookings(query: ListBookingsQuery = {}): Promise<Paginated<Booking>> {
  return apiGet<Paginated<Booking>>(apiQuery('/admin/bookings', query));
}

export function getBooking(id: string): Promise<Booking> {
  return apiGet<Booking>(`/admin/bookings/${id}`);
}

export function createBooking(payload: BookingPayload): Promise<Booking> {
  return apiPost<Booking>('/admin/bookings', payload);
}

export function updateBooking(id: string, payload: BookingPayload): Promise<Booking> {
  return apiPut<Booking>(`/admin/bookings/${id}`, payload);
}

export function deleteBooking(id: string): Promise<void> {
  return apiDelete<void>(`/admin/bookings/${id}`);
}

// --------------------------------------------------------------------------- //
// Service requests
// --------------------------------------------------------------------------- //

export type ServiceRequestPayload = Partial<
  Pick<
    ServiceRequest,
    | 'proponent_id'
    | 'full_name'
    | 'company_name'
    | 'email'
    | 'phone'
    | 'whatsapp_number'
    | 'service_needed'
    | 'project_location'
    | 'message'
    | 'status'
  >
>;

export function listServiceRequests(
  query: ListRequestsQuery = {},
): Promise<Paginated<ServiceRequest>> {
  return apiGet<Paginated<ServiceRequest>>(apiQuery('/admin/service-requests', query));
}

export function getServiceRequest(id: string): Promise<ServiceRequest> {
  return apiGet<ServiceRequest>(`/admin/service-requests/${id}`);
}

export function createServiceRequest(payload: ServiceRequestPayload): Promise<ServiceRequest> {
  return apiPost<ServiceRequest>('/admin/service-requests', payload);
}

export function updateServiceRequest(
  id: string,
  payload: ServiceRequestPayload,
): Promise<ServiceRequest> {
  return apiPut<ServiceRequest>(`/admin/service-requests/${id}`, payload);
}

export function deleteServiceRequest(id: string): Promise<void> {
  return apiDelete<void>(`/admin/service-requests/${id}`);
}

// --------------------------------------------------------------------------- //
// Company settings
// --------------------------------------------------------------------------- //

export type CompanySettingsPayload = Partial<
  Pick<
    CompanySettings,
    | 'company_name'
    | 'company_email'
    | 'company_phone'
    | 'company_whatsapp'
    | 'company_address'
    | 'company_tagline'
    | 'enable_email_notifications'
    | 'enable_whatsapp_notifications'
    | 'reminder_30_enabled'
    | 'reminder_14_enabled'
    | 'reminder_7_enabled'
    | 'reminder_1_enabled'
  >
>;

export function getSettings(): Promise<CompanySettings> {
  return apiGet<CompanySettings>('/admin/settings');
}

export function updateSettings(payload: CompanySettingsPayload): Promise<CompanySettings> {
  return apiPut<CompanySettings>('/admin/settings', payload);
}

// --------------------------------------------------------------------------- //
// Shared helpers
// --------------------------------------------------------------------------- //

let proponentsCache: Map<string, string> | null = null;

async function proponentNameMap(): Promise<Map<string, string>> {
  if (proponentsCache) return proponentsCache;
  try {
    const data = await apiGet<Paginated<Proponent>>(
      apiQuery('/admin/proponents', { page: 1, per_page: 100 }),
    );
    proponentsCache = new Map(data.items.map((p) => [p.id, p.company_name]));
  } catch {
    proponentsCache = new Map();
  }
  return proponentsCache;
}

export function clearProponentsCache(): void {
  proponentsCache = null;
}