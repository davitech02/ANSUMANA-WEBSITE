/**
 * Public (unauthenticated) API (blueprint `/api/public`).
 */

import type { PublicPermitLookup } from '../../types';
import { apiGet, apiPost, apiQuery } from './client';

export interface PublicBookingInput {
  full_name: string;
  company_name?: string;
  email: string;
  phone: string;
  whatsapp_number?: string;
  service_needed: string;
  preferred_date: string;
  preferred_time: string;
  project_location?: string;
  message?: string;
}

export interface PublicServiceRequestInput {
  full_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  whatsapp_number?: string;
  service_needed: string;
  project_location?: string;
  message: string;
}

export function submitPublicBooking(input: PublicBookingInput): Promise<{
  id: string;
  full_name: string;
  company_name?: string | null;
  email: string;
  service_needed: string;
  preferred_date?: string | null;
  preferred_time?: string | null;
  project_location?: string | null;
  booking_status: string;
  created_at: string;
}> {
  return apiPost('/public/bookings', input);
}

export function submitPublicServiceRequest(input: PublicServiceRequestInput): Promise<{
  id: string;
  full_name: string;
  company_name?: string | null;
  email: string;
  service_needed: string;
  project_location?: string | null;
  status: string;
  created_at: string;
}> {
  return apiPost('/public/service-requests', input);
}

export function lookupPermitStatus(q: string): Promise<{
  items: PublicPermitLookup[];
  count: number;
}> {
  return apiGet(apiQuery('/public/permits/status', { q }));
}