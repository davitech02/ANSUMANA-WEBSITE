/**
 * Health endpoints (blueprint `/api/health`, unauthenticated).
 */

import type { HealthCheck } from '../../types';
import { apiGet } from './client';

export interface ServiceBanner {
  service: string;
}

export function healthBanner(): Promise<ServiceBanner> {
  return apiGet<ServiceBanner>('/health');
}

export function liveness(): Promise<{ status: string }> {
  return apiGet<{ status: string }>('/health/live');
}

export function readiness(): Promise<HealthCheck> {
  return apiGet<HealthCheck>('/health/ready');
}