/**
 * Shared domain and API contract types.
 *
 * These mirror the backend response schemas (`backend/app/schemas/*`) and
 * enum values (`backend/app/models/enums.py`) exactly. The backend is the
 * source of truth; do not rename or invent fields here without a
 * corresponding backend change.
 */

// --------------------------------------------------------------------------- //
// Enums (string values match the backend PostgreSQL-native enum values)
// --------------------------------------------------------------------------- //

export type UserRole = 'admin' | 'user' | 'client';

export type ProjectType =
  | 'Cold storage'
  | 'Mining and quarry'
  | 'Gold mining'
  | 'Sand mining'
  | 'Construction'
  | 'Hotel'
  | 'Factory'
  | 'Warehouse'
  | 'Exploration'
  | 'Logging'
  | 'Other';

export type ProponentStatus = 'Active' | 'Inactive';

export type PermitType =
  | 'EPA Environmental Permit'
  | 'Mining License'
  | 'Environmental Impact License'
  | 'Waste Management Permit'
  | 'Other';

export type PermitStatus = 'Active' | 'Expired' | 'Suspended' | 'Pending Renewal';

export type ReportType =
  | 'Environmental Audit Report'
  | 'Biannual Monitoring Report'
  | 'Quarterly Monitoring Report';

export type ReportStatus = 'Pending' | 'Submitted' | 'Overdue' | 'Completed';

export type ComplianceStatus =
  | 'Compliant'
  | 'Non-compliant'
  | 'Requires improvement'
  | 'Pending review'
  | 'Observation'
  | 'Minor non-compliance'
  | 'Major non-compliance'
  | 'Improvement needed';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export type ActionStatus =
  | 'Open'
  | 'Pending'
  | 'In progress'
  | 'Submitted for review'
  | 'Verified'
  | 'Overdue';

export type ReviewStatus = 'Pending review' | 'Approved' | 'Rejected' | 'More action needed';

export type BookingService =
  | 'Free consultation call'
  | 'Environmental audit planning session'
  | 'Biannual monitoring planning session'
  | 'Quarterly monitoring planning session'
  | 'ESIA/EMP/EPB consultation'
  | 'Mining license support session'
  | 'Compliance review session'
  | 'Report planning session'
  | 'Site visit planning call'
  | 'Corrective action support session';

export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Rescheduled' | 'Cancelled';

export type RequestService =
  | 'Environmental Audit Report'
  | 'Biannual Monitoring Report'
  | 'Quarterly Monitoring Report'
  | 'Environmental and Social Impact Assessment'
  | 'Environmental Management Plan'
  | 'Environmental Project Brief'
  | 'Mining license support'
  | 'Compliance advisory'
  | 'Environmental monitoring'
  | 'Corrective action tracking'
  | 'Other';

export type RequestStatus =
  | 'New'
  | 'Contacted'
  | 'In Review'
  | 'In progress'
  | 'Completed'
  | 'Closed'
  | 'Archived';

export type NotificationChannel = 'Email' | 'WhatsApp';

export type NotificationType =
  | 'Report reminder'
  | 'Overdue notice'
  | 'Findings notice'
  | 'Evidence submission'
  | 'Evidence review'
  | 'Booking confirmation'
  | 'Service request'
  | 'Corrective action'
  | 'Support Request';

export type NotificationDeliveryStatus = 'Pending' | 'Sent' | 'Failed';

export type FileCategory = 'permit' | 'evidence' | 'report' | 'avatar' | 'other';

// --------------------------------------------------------------------------- //
// API envelope types
// --------------------------------------------------------------------------- //

export interface ApiEnvelope<T> {
  status: string;
  data: T;
  message?: string;
}

export interface ApiErrorBody {
  status: 'error';
  code: string;
  message: string;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

// --------------------------------------------------------------------------- //
// Auth
// --------------------------------------------------------------------------- //

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  county?: string | null;
  district?: string | null;
  role: UserRole;
  is_active: boolean;
  proponent_id?: string | null;
  created_at: string;
  last_login_at?: string | null;
}

export interface AuthSession {
  user: User;
  proponent: Proponent | null;
  access_token: string;
  refresh_token: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

// --------------------------------------------------------------------------- //
// Proponents
// --------------------------------------------------------------------------- //

export interface Proponent {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone?: string | null;
  whatsapp_number?: string | null;
  project_type?: ProjectType | null;
  county?: string | null;
  district?: string | null;
  project_location?: string | null;
  project_description?: string | null;
  status: ProponentStatus;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
}

export interface ProponentDetail extends Proponent {
  summary: {
    permits: number;
    schedules: number;
    findings: number;
    evidence: number;
    users: number;
    bookings: number;
    service_requests: number;
  };
}

// --------------------------------------------------------------------------- //
// Permits
// --------------------------------------------------------------------------- //

export interface Permit {
  id: string;
  proponent_id: string;
  permit_number: string;
  permit_type: PermitType;
  status: PermitStatus;
  issue_date?: string | null;
  expiry_date?: string | null;
  has_file: boolean;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
  /** Client-side convenience display field (company name from the linked proponent). */
  proponent_name?: string;
}

export interface ClientPermit {
  id: string;
  proponent_id: string;
  permit_number: string;
  permit_type: PermitType;
  permit_status: PermitStatus;
  issue_date?: string | null;
  expiry_date?: string | null;
  has_file: boolean;
}

// --------------------------------------------------------------------------- //
// Report schedules
// --------------------------------------------------------------------------- //

export interface ReportSchedule {
  id: string;
  proponent_id: string;
  permit_id?: string | null;
  report_type: ReportType;
  reporting_period?: string | null;
  due_date: string;
  status: ReportStatus;
  submitted_at?: string | null;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
  /** Client-side convenience display field (company name from the linked proponent). */
  proponent_name?: string;
}

// --------------------------------------------------------------------------- //
// Findings
// --------------------------------------------------------------------------- //

export interface Finding {
  id: string;
  proponent_id: string;
  report_schedule_id?: string | null;
  inspection_area?: string | null;
  finding_title: string;
  finding_description?: string | null;
  compliance_status: ComplianceStatus;
  risk_level: RiskLevel;
  corrective_action?: string | null;
  recommendation?: string | null;
  action_deadline?: string | null;
  responsible_party?: string | null;
  action_status: ActionStatus;
  sent_to_proponent: boolean;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
  /** Client-side convenience display field (company name from the linked proponent). */
  proponent_name?: string;
}

// --------------------------------------------------------------------------- //
// Evidence
// --------------------------------------------------------------------------- //

export interface FileMeta {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  category: FileCategory;
}

export interface EvidenceFinding {
  id: string;
  finding_title: string;
  inspection_area?: string | null;
  compliance_status: ComplianceStatus;
  risk_level: RiskLevel;
  action_status: ActionStatus;
}

export interface EvidenceProponent {
  id: string;
  company_name: string;
  email: string;
}

export interface Evidence {
  id: string;
  finding_id: string;
  proponent_id: string;
  reviewer_id?: string | null;
  evidence_title?: string | null;
  description?: string | null;
  review_status: ReviewStatus;
  review_notes?: string | null;
  admin_comment?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
  has_file: boolean;
  finding?: EvidenceFinding | null;
  proponent?: EvidenceProponent | null;
  file?: FileMeta | null;
  /** Client-side convenience display field. */
  proponent_name?: string;
}

export interface ClientEvidenceFile {
  file_name: string;
  file_type: string;
  file_size: number;
  category: FileCategory;
}

export interface ClientEvidenceFinding {
  id: string;
  finding_title: string;
  inspection_area?: string | null;
  compliance_status: ComplianceStatus;
  risk_level: RiskLevel;
  action_status: ActionStatus;
}

export interface ClientEvidence {
  id: string;
  finding_id: string;
  proponent_id: string;
  evidence_title?: string | null;
  description?: string | null;
  review_status: ReviewStatus;
  submitted_at?: string | null;
  created_at: string;
  has_file: boolean;
  finding?: ClientEvidenceFinding | null;
  file?: ClientEvidenceFile | null;
}

export interface ClientFinding {
  id: string;
  report_schedule_id?: string | null;
  inspection_area?: string | null;
  finding_title: string;
  finding_description?: string | null;
  compliance_status: ComplianceStatus;
  risk_level: RiskLevel;
  corrective_action?: string | null;
  recommendation?: string | null;
  action_deadline?: string | null;
  responsible_party?: string | null;
  action_status: ActionStatus;
  sent_to_proponent: boolean;
}

// --------------------------------------------------------------------------- //
// Bookings
// --------------------------------------------------------------------------- //

export interface Booking {
  id: string;
  proponent_id?: string | null;
  created_by?: string | null;
  full_name: string;
  company_name?: string | null;
  email: string;
  phone?: string | null;
  whatsapp_number?: string | null;
  service_needed: BookingService;
  preferred_date?: string | null;
  preferred_time?: string | null;
  project_location?: string | null;
  message?: string | null;
  booking_status: BookingStatus;
  meeting_link?: string | null;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
}

// --------------------------------------------------------------------------- //
// Service requests
// --------------------------------------------------------------------------- //

export interface ServiceRequest {
  id: string;
  proponent_id?: string | null;
  created_by?: string | null;
  full_name: string;
  company_name?: string | null;
  email: string;
  phone?: string | null;
  whatsapp_number?: string | null;
  service_needed: RequestService;
  project_location?: string | null;
  message?: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
}

// --------------------------------------------------------------------------- //
// Audit + notification logs
// --------------------------------------------------------------------------- //

export interface AuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  proponent_id?: string | null;
  report_schedule_id?: string | null;
  finding_id?: string | null;
  channel: NotificationChannel;
  notification_type: NotificationType;
  recipient: string;
  subject?: string | null;
  message_body?: string | null;
  status: NotificationDeliveryStatus;
  sent_at?: string | null;
  error_message?: string | null;
  created_at: string;
}

// --------------------------------------------------------------------------- //
// Company settings
// --------------------------------------------------------------------------- //

export interface CompanySettings {
  id: string;
  company_name: string;
  company_email: string;
  company_phone?: string | null;
  company_whatsapp?: string | null;
  company_address?: string | null;
  company_tagline?: string | null;
  enable_email_notifications: boolean;
  enable_whatsapp_notifications: boolean;
  reminder_30_enabled: boolean;
  reminder_14_enabled: boolean;
  reminder_7_enabled: boolean;
  reminder_1_enabled: boolean;
  updated_by?: string | null;
  created_at: string;
  updated_at?: string;
}

// --------------------------------------------------------------------------- //
// Dashboard + operations
// --------------------------------------------------------------------------- //

export interface DashboardSummary {
  proponents: { total: number; active: number };
  permits: {
    total: number;
    active: number;
    expired: number;
    suspended: number;
    pending_renewal: number;
  };
  schedules: {
    total: number;
    pending: number;
    submitted: number;
    overdue: number;
    completed: number;
    due_7: number;
    due_14: number;
    due_30: number;
  };
  findings: {
    total: number;
    open: number;
    verified: number;
    high_risk: number;
    pending_review: number;
  };
  evidence: { total: number; pending_review: number; approved: number; rejected: number };
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    rescheduled: number;
  };
  service_requests: {
    total: number;
    new: number;
    contacted: number;
    in_review: number;
    in_progress: number;
    completed: number;
    closed: number;
    archived: number;
  };
}

export interface TrendBucket {
  period: string;
  total: number;
  completed: number;
  pending: number;
  submitted: number;
  overdue: number;
}

export interface DashboardTrends {
  granularity: string;
  from: string;
  to: string;
  buckets: TrendBucket[];
}

export interface ReminderWindowSummary {
  processed: number;
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
  channel_skips: number;
}

export interface ReminderRunSummary {
  run_at: string;
  dry_run: boolean;
  processed: number;
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
  channel_skips: number;
  windows: Record<string, ReminderWindowSummary>;
}

export interface Diagnostics {
  application: string;
  database: string;
  configuration: { status: string; problems: string[] };
  notifications: { email_enabled: boolean; whatsapp_enabled: boolean };
  reminders: { available: boolean };
  migrations: { head: string };
}

export interface HealthCheck {
  status: string;
  checks: { database: string; configuration: string };
  problems?: string[];
}

export interface PublicPermitLookup {
  permit_number: string;
  permit_type: PermitType;
  permit_status: PermitStatus;
  expiry_date?: string | null;
  proponent_name: string;
  schedules: {
    report_type: ReportType;
    reporting_period?: string | null;
    due_date: string;
    status: ReportStatus;
  }[];
}

// --------------------------------------------------------------------------- //
// Backward-compatible aliases used by the original mock UI layer
// --------------------------------------------------------------------------- //

export type ComplianceFinding = Finding;
export type EvidenceUpload = Evidence;
export type ServiceRequestStatus = RequestStatus;
export type CompanySetting = CompanySettings;