import type { AuthSession, Proponent, User } from '../../types';
import { apiGet, apiPost } from './client';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  full_name: string;
  email: string;
  password: string;
  company_name?: string;
}

export function login(input: LoginInput): Promise<AuthSession> {
  return apiPost<AuthSession>('/auth/login', input);
}

export function register(input: RegisterInput): Promise<AuthSession> {
  return apiPost<AuthSession>('/auth/register', input);
}

export function fetchMe(): Promise<{ user: User; proponent: Proponent | null }> {
  return apiGet<{ user: User; proponent: Proponent | null }>('/auth/me');
}

export function logout(refreshToken: string | null): Promise<void> {
  return apiPost<void>('/auth/logout', { refresh_token: refreshToken ?? undefined });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/forgot-password', { email });
}

export function resetPassword(input: {
  token: string;
  password: string;
  confirm: string;
}): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/reset-password', input);
}