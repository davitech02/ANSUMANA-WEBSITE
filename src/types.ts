export type UserRole = 'admin' | 'user' | 'client';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  proponent_id?: string;
  created_date: string;
}

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

export interface Proponent {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  project_type: ProjectType;
  county: string;
  district: string;
  project_location: string;
  project_description: string;
  status: 'Active' | 'Inactive';
  created_date: string;
  updated_date?: string;
}

export type PermitType =
  | 'EPA Environmental Permit'
  | 'Mining License'
  | 'Environmental Impact License'
  | 'Waste Management Permit'
  | 'Other';

export type PermitStatus = 'Active' | 'Expired' | 'Suspended' | 'Pending Renewal';

export interface Permit {
  id: string;
  proponent_id: string;
  proponent_name: string;
  permit_number: string;
  permit_type: PermitType;
  issue_date: string;
  expiry_date: string;
  permit_status: PermitStatus;
  permit_file_url?: string;
  created_date: string;
  updated_date?: string;
}

export type ReportType =
  | 'Environmental Audit Report'
  | 'Biannual Monitoring Report'
  | 'Quarterly Monitoring Report';

export type ReportStatus = 'Pending' | 'Submitted' | 'Overdue' | 'Completed';

export interface ReportSchedule {
  id: string;
  proponent_id: string;
  proponent_name: string;
  permit_id?: string;
  report_type: ReportType;
  reporting_period: string;
  due_date: string;
  status: ReportStatus;
  reminder_30_sent: boolean;
  reminder_14_sent: boolean;
  reminder_7_sent: boolean;
  reminder_1_sent: boolean;
  reminder_due_sent: boolean;
  reminder_overdue_sent: boolean;
  created_date: string;
  updated_date?: string;
}

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

export interface Finding {
  id: string;
  proponent_id: string;
  proponent_name: string;
  report_schedule_id?: string;
  inspection_area: string;
  finding_title: string;
  finding_description?: string;
  compliance_status: ComplianceStatus;
  risk_level: RiskLevel;
  corrective_action: string;
  recommendation?: string;
  action_deadline: string;
  responsible_party: string;
  action_status: ActionStatus;
  sent_to_proponent?: boolean;
  created_date: string;
  updated_date?: string;
}

export type ComplianceFinding = Finding;

export type ReviewStatus = 'Pending review' | 'Approved' | 'Rejected' | 'More action needed';

export interface EvidenceUpload {
  id: string;
  finding_id: string;
  proponent_id: string;
  proponent_name?: string;
  evidence_title?: string;
  description?: string;
  file_url: string;
  file_name?: string;
  file_type?: string;
  comment?: string;
  date_action_completed?: string;
  submitted_by?: string;
  review_status: ReviewStatus;
  review_notes?: string;
  admin_comment?: string;
  reviewed_at?: string;
  reviewed_date?: string;
  uploaded_date?: string;
  created_date: string;
}

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

export interface Booking {
  id: string;
  full_name: string;
  company_name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  service_needed: BookingService;
  preferred_date: string;
  preferred_time: string;
  project_location: string;
  message?: string;
  booking_status: BookingStatus;
  meeting_link?: string;
  created_date: string;
}

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

export type RequestStatus = 'New' | 'Contacted' | 'In Review' | 'In progress' | 'Completed' | 'Closed' | 'Archived';
export type ServiceRequestStatus = RequestStatus;

export interface ServiceRequest {
  id: string;
  full_name: string;
  company_name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  service_needed: RequestService;
  project_location: string;
  message: string;
  status: RequestStatus;
  created_date: string;
}

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

export interface NotificationLog {
  id: string;
  proponent_id?: string;
  report_schedule_id?: string;
  finding_id?: string;
  channel: NotificationChannel;
  notification_type: NotificationType;
  recipient: string;
  subject: string;
  message_body: string;
  status: 'Sent' | 'Failed' | 'Pending';
  created_date: string;
}

export interface CompanySetting {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_whatsapp: string;
  company_address: string;
  company_tagline: string;
  enable_email_notifications: boolean;
  enable_whatsapp_notifications: boolean;
  reminder_30_enabled: boolean;
  reminder_14_enabled: boolean;
  reminder_7_enabled: boolean;
  reminder_1_enabled: boolean;
}
