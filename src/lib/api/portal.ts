/**
 * Client portal API (blueprint `/api/client`).
 *
 * Every endpoint is scoped server-side to the authenticated client's own
 * proponent; lists return `{ items, count }` (no pagination).
 */

import type {
  ClientEvidence,
  ClientFinding,
  ClientPermit,
  NotificationLog,
  Proponent,
  ReportSchedule,
  User,
} from '../../types';
import { apiGet, apiPost, apiPut, apiQuery, apiUpload } from './client';

export interface ClientMe {
  user: User;
  proponent: Proponent | null;
}

export function fetchClientMe(): Promise<ClientMe> {
  return apiGet<ClientMe>('/client/me');
}

export type CompanyUpdatePayload = Partial<
  Pick<
    Proponent,
    | 'company_name'
    | 'contact_person'
    | 'email'
    | 'phone'
    | 'whatsapp_number'
    | 'county'
    | 'district'
    | 'project_location'
    | 'project_description'
  >
>;

export function updateCompany(payload: CompanyUpdatePayload): Promise<{ proponent: Proponent }> {
  return apiPut<{ proponent: Proponent }>('/client/company', payload);
}

export interface ClientList<T> {
  items: T[];
  count: number;
}

export function listClientPermits(
  query: { from?: string; to?: string } = {},
): Promise<ClientList<ClientPermit>> {
  return apiGet<ClientList<ClientPermit>>(apiQuery('/client/permits', query));
}

export function listClientSchedules(): Promise<ClientList<ReportSchedule>> {
  return apiGet<ClientList<ReportSchedule>>('/client/schedules');
}

export function listClientFindings(
  query: { from?: string; to?: string } = {},
): Promise<ClientList<ClientFinding>> {
  return apiGet<ClientList<ClientFinding>>(apiQuery('/client/findings', query));
}

export function listClientReminders(): Promise<ClientList<NotificationLog>> {
  return apiGet<ClientList<NotificationLog>>('/client/reminders');
}

export function listClientEvidence(): Promise<ClientList<ClientEvidence>> {
  return apiGet<ClientList<ClientEvidence>>('/client/evidence');
}

export function getClientEvidence(id: string): Promise<ClientEvidence> {
  return apiGet<ClientEvidence>(`/client/evidence/${id}`);
}

export interface EvidenceUploadInput {
  finding_id: string;
  evidence_title: string;
  description?: string;
  file?: File | null;
}

export function uploadClientEvidence(input: EvidenceUploadInput): Promise<ClientEvidence> {
  const formData = new FormData();
  formData.set('finding_id', input.finding_id);
  formData.set('evidence_title', input.evidence_title);
  if (input.description) formData.set('description', input.description);
  if (input.file) formData.set('file', input.file);
  return apiUpload<ClientEvidence>('/client/evidence', formData);
}

// Client permit download path (auth header required; use saveDownload).
export function clientPermitFileUrl(id: string): string {
  return `/client/permits/${id}/file`;
}

export function clientEvidenceFileUrl(id: string): string {
  return `/client/evidence/${id}/file`;
}