/**
 * Admin workflow + operations API (blueprint `/api/admin`).
 *
 * Dashboard aggregates, entity workflow actions, audit/notification log views,
 * the reminder engine, operational diagnostics, and CSV exports.
 */

import type {
  AuditLog,
  Booking,
  DashboardSummary,
  DashboardTrends,
  Diagnostics,
  Evidence,
  Finding,
  NotificationLog,
  Paginated,
  Permit,
  ReminderRunSummary,
  ServiceRequest,
} from '../../types';
import { apiGet, apiPost, apiQuery, saveDownload } from './client';

// --------------------------------------------------------------------------- //
// Dashboard
// --------------------------------------------------------------------------- //

export function dashboardSummary(): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>('/admin/dashboard/summary');
}

export function dashboardTrends(
  query: { granularity?: string; from?: string; to?: string } = {},
): Promise<DashboardTrends> {
  return apiGet<DashboardTrends>(apiQuery('/admin/dashboard/trends', query));
}

// --------------------------------------------------------------------------- //
// Entity workflow actions
// --------------------------------------------------------------------------- //

export type PermitWorkflowAction =
  | 'activate'
  | 'renew'
  | 'suspend'
  | 'mark_expired'
  | 'pending_renewal';

export function permitWorkflow(
  id: string,
  action: PermitWorkflowAction,
  payload: { issue_date?: string | null; expiry_date?: string | null } = {},
): Promise<Permit> {
  return apiPost<Permit>(`/admin/permits/${id}/workflow`, { action, ...payload });
}

export type FindingWorkflowAction =
  | 'start'
  | 'submit_for_review'
  | 'verify'
  | 'reopen'
  | 'mark_overdue';

export function findingWorkflow(id: string, action: FindingWorkflowAction): Promise<Finding> {
  return apiPost<Finding>(`/admin/findings/${id}/workflow`, { action });
}

export function reviewEvidence(
  id: string,
  payload: {
    status: 'Approved' | 'Rejected' | 'More action needed';
    review_notes?: string | null;
    admin_comment?: string | null;
  },
): Promise<Evidence> {
  return apiPost<Evidence>(`/admin/evidence/${id}/review`, payload);
}

export type BookingWorkflowAction = 'confirm' | 'reschedule' | 'complete' | 'cancel';

export function bookingWorkflow(
  id: string,
  action: BookingWorkflowAction,
  payload: {
    preferred_date?: string | null;
    preferred_time?: string | null;
    meeting_link?: string | null;
  } = {},
): Promise<Booking> {
  return apiPost<Booking>(`/admin/bookings/${id}/workflow`, { action, ...payload });
}

export type ServiceRequestWorkflowAction =
  | 'contact'
  | 'review'
  | 'process'
  | 'complete'
  | 'close'
  | 'reopen'
  | 'archive';

export function serviceRequestWorkflow(
  id: string,
  action: ServiceRequestWorkflowAction,
): Promise<ServiceRequest> {
  return apiPost<ServiceRequest>(`/admin/service-requests/${id}/workflow`, { action });
}

// --------------------------------------------------------------------------- //
// Audit + notification logs
// --------------------------------------------------------------------------- //

export function listAuditLogs(
  query: {
    action?: string;
    entity_type?: string;
    user_id?: string;
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
  } = {},
): Promise<Paginated<AuditLog>> {
  return apiGet<Paginated<AuditLog>>(apiQuery('/admin/audit-logs', query));
}

export function listNotificationLogs(
  query: {
    channel?: string;
    notification_type?: string;
    status?: string;
    proponent_id?: string;
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
  } = {},
): Promise<Paginated<NotificationLog>> {
  return apiGet<Paginated<NotificationLog>>(apiQuery('/admin/notification-logs', query));
}

export function retryNotification(
  id: string,
): Promise<{ notification: NotificationLog; attempt: number }> {
  return apiPost<{ notification: NotificationLog; attempt: number }>(
    `/admin/notification-logs/${id}/retry`,
  );
}

// --------------------------------------------------------------------------- //
// Reminder engine
// --------------------------------------------------------------------------- //

export function runReminders(dryRun = false): Promise<ReminderRunSummary> {
  return apiPost<ReminderRunSummary>('/admin/reminders/run', { dry_run: dryRun });
}

// --------------------------------------------------------------------------- //
// Diagnostics
// --------------------------------------------------------------------------- //

export function diagnostics(): Promise<Diagnostics> {
  return apiGet<Diagnostics>('/admin/diagnostics');
}

// --------------------------------------------------------------------------- //
// CSV exports
// --------------------------------------------------------------------------- //

export const EXPORTABLE_ENTITIES = [
  'proponents',
  'permits',
  'schedules',
  'findings',
  'evidence',
  'bookings',
  'service_requests',
  'notification_logs',
  'audit_logs',
] as const;

export type ExportEntity = (typeof EXPORTABLE_ENTITIES)[number];

export function downloadCsvExport(entity: ExportEntity, includeDeleted = false): Promise<void> {
  const query = includeDeleted ? '?include_deleted=true' : '';
  return saveDownload(`/admin/exports/${entity}.csv${query}`);
}