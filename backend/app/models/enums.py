"""Central business enums.

Enum values must match the frontend (``src/types.ts``) exactly where the
frontend depends on them. Do not rename existing business statuses.

The ``values_callable`` helper is passed to every ``Enum`` column so that
PostgreSQL native enum types store the human-readable ``value`` (e.g.
``"Pending Renewal"``) rather than the Python member name.
"""

from __future__ import annotations

from enum import Enum


def values_callable(enum_cls: type[Enum]) -> list[str]:
    """Return the stored values for an enum class."""
    return [member.value for member in enum_cls]


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    CLIENT = "client"


class ProjectType(str, Enum):
    COLD_STORAGE = "Cold storage"
    MINING_AND_QUARRY = "Mining and quarry"
    GOLD_MINING = "Gold mining"
    SAND_MINING = "Sand mining"
    CONSTRUCTION = "Construction"
    HOTEL = "Hotel"
    FACTORY = "Factory"
    WAREHOUSE = "Warehouse"
    EXPLORATION = "Exploration"
    LOGGING = "Logging"
    OTHER = "Other"


class ProponentStatus(str, Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"


class PermitType(str, Enum):
    EPA_ENVIRONMENTAL_PERMIT = "EPA Environmental Permit"
    MINING_LICENSE = "Mining License"
    ENVIRONMENTAL_IMPACT_LICENSE = "Environmental Impact License"
    WASTE_MANAGEMENT_PERMIT = "Waste Management Permit"
    OTHER = "Other"


class PermitStatus(str, Enum):
    ACTIVE = "Active"
    EXPIRED = "Expired"
    SUSPENDED = "Suspended"
    PENDING_RENEWAL = "Pending Renewal"


class ReportType(str, Enum):
    ENVIRONMENTAL_AUDIT_REPORT = "Environmental Audit Report"
    BIANNUAL_MONITORING_REPORT = "Biannual Monitoring Report"
    QUARTERLY_MONITORING_REPORT = "Quarterly Monitoring Report"


class ReportStatus(str, Enum):
    PENDING = "Pending"
    SUBMITTED = "Submitted"
    OVERDUE = "Overdue"
    COMPLETED = "Completed"


class ComplianceStatus(str, Enum):
    COMPLIANT = "Compliant"
    NON_COMPLIANT = "Non-compliant"
    REQUIRES_IMPROVEMENT = "Requires improvement"
    PENDING_REVIEW = "Pending review"
    OBSERVATION = "Observation"
    MINOR_NON_COMPLIANCE = "Minor non-compliance"
    MAJOR_NON_COMPLIANCE = "Major non-compliance"
    IMPROVEMENT_NEEDED = "Improvement needed"


class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class ActionStatus(str, Enum):
    OPEN = "Open"
    PENDING = "Pending"
    IN_PROGRESS = "In progress"
    SUBMITTED_FOR_REVIEW = "Submitted for review"
    VERIFIED = "Verified"
    OVERDUE = "Overdue"


class ReviewStatus(str, Enum):
    PENDING_REVIEW = "Pending review"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    MORE_ACTION_NEEDED = "More action needed"


class BookingService(str, Enum):
    FREE_CONSULTATION_CALL = "Free consultation call"
    ENVIRONMENTAL_AUDIT_PLANNING_SESSION = "Environmental audit planning session"
    BIANNUAL_MONITORING_PLANNING_SESSION = "Biannual monitoring planning session"
    QUARTERLY_MONITORING_PLANNING_SESSION = "Quarterly monitoring planning session"
    ESIA_EMP_EPB_CONSULTATION = "ESIA/EMP/EPB consultation"
    MINING_LICENSE_SUPPORT_SESSION = "Mining license support session"
    COMPLIANCE_REVIEW_SESSION = "Compliance review session"
    REPORT_PLANNING_SESSION = "Report planning session"
    SITE_VISIT_PLANNING_CALL = "Site visit planning call"
    CORRECTIVE_ACTION_SUPPORT_SESSION = "Corrective action support session"


class BookingStatus(str, Enum):
    PENDING = "Pending"
    CONFIRMED = "Confirmed"
    COMPLETED = "Completed"
    RESCHEDULED = "Rescheduled"
    CANCELLED = "Cancelled"


class RequestService(str, Enum):
    ENVIRONMENTAL_AUDIT_REPORT = "Environmental Audit Report"
    BIANNUAL_MONITORING_REPORT = "Biannual Monitoring Report"
    QUARTERLY_MONITORING_REPORT = "Quarterly Monitoring Report"
    ENVIRONMENTAL_AND_SOCIAL_IMPACT_ASSESSMENT = "Environmental and Social Impact Assessment"
    ENVIRONMENTAL_MANAGEMENT_PLAN = "Environmental Management Plan"
    ENVIRONMENTAL_PROJECT_BRIEF = "Environmental Project Brief"
    MINING_LICENSE_SUPPORT = "Mining license support"
    COMPLIANCE_ADVISORY = "Compliance advisory"
    ENVIRONMENTAL_MONITORING = "Environmental monitoring"
    CORRECTIVE_ACTION_TRACKING = "Corrective action tracking"
    OTHER = "Other"


class RequestStatus(str, Enum):
    NEW = "New"
    CONTACTED = "Contacted"
    IN_REVIEW = "In Review"
    IN_PROGRESS = "In progress"
    COMPLETED = "Completed"
    CLOSED = "Closed"
    ARCHIVED = "Archived"


class NotificationChannel(str, Enum):
    EMAIL = "Email"
    WHATSAPP = "WhatsApp"


class NotificationType(str, Enum):
    REPORT_REMINDER = "Report reminder"
    OVERDUE_NOTICE = "Overdue notice"
    FINDINGS_NOTICE = "Findings notice"
    EVIDENCE_SUBMISSION = "Evidence submission"
    EVIDENCE_REVIEW = "Evidence review"
    BOOKING_CONFIRMATION = "Booking confirmation"
    SERVICE_REQUEST = "Service request"
    CORRECTIVE_ACTION = "Corrective action"
    SUPPORT_REQUEST = "Support Request"


class NotificationDeliveryStatus(str, Enum):
    PENDING = "Pending"
    SENT = "Sent"
    FAILED = "Failed"


class FileCategory(str, Enum):
    PERMIT = "permit"
    EVIDENCE = "evidence"
    REPORT = "report"
    AVATAR = "avatar"
    OTHER = "other"