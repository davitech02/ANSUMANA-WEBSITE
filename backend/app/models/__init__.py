"""SQLAlchemy models package.

Importing this package registers every model with SQLAlchemy's mapper so that
``create_all``/migrations and relationship resolution see the full schema.
"""

from .audit_log import AuditLog
from .booking import Booking
from .company_settings import CompanySettings
from .enums import (
    ActionStatus,
    BookingService,
    BookingStatus,
    ComplianceStatus,
    FileCategory,
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationType,
    PermitStatus,
    PermitType,
    ProjectType,
    ProponentStatus,
    ReportStatus,
    ReportType,
    RequestService,
    RequestStatus,
    ReviewStatus,
    RiskLevel,
    UserRole,
)
from .evidence import Evidence
from .file import File
from .finding import Finding
from .notification import Notification
from .notification_log import NotificationLog
from .password_reset_token import PasswordResetToken
from .permit import Permit
from .proponent import Proponent
from .report_schedule import ReportSchedule
from .service_request import ServiceRequest
from .token_blocklist import TokenBlocklist
from .user import User

__all__ = [
    "ActionStatus",
    "AuditLog",
    "Booking",
    "BookingService",
    "BookingStatus",
    "ComplianceStatus",
    "CompanySettings",
    "Evidence",
    "File",
    "FileCategory",
    "Finding",
    "Notification",
    "NotificationChannel",
    "NotificationDeliveryStatus",
    "NotificationLog",
    "NotificationType",
    "PasswordResetToken",
    "Permit",
    "PermitStatus",
    "PermitType",
    "ProjectType",
    "Proponent",
    "ProponentStatus",
    "ReportSchedule",
    "ReportStatus",
    "ReportType",
    "RequestService",
    "RequestStatus",
    "ReviewStatus",
    "RiskLevel",
    "ServiceRequest",
    "TokenBlocklist",
    "User",
    "UserRole",
]