"""NotificationLog model.

Records the delivery/audit history of Email and WhatsApp notifications.
Distinct from Notification, which is an in-portal notification for a user.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .enums import (
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationType,
    values_callable,
)
from .mixins import TimestampMixin, UTCDateTime, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .finding import Finding
    from .proponent import Proponent
    from .report_schedule import ReportSchedule


class NotificationLog(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """Delivery audit record for an Email or WhatsApp notification."""

    __tablename__ = "notification_logs"
    __table_args__ = (
        Index("ix_notification_logs_channel_status", "channel", "status"),
        Index("ix_notification_logs_proponent_created", "proponent_id", "created_at"),
    )

    proponent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("proponents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    report_schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("report_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    finding_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("findings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(
            NotificationChannel,
            name="notification_channel",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(
            NotificationType,
            name="notification_type",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
    )
    recipient: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[NotificationDeliveryStatus] = mapped_column(
        Enum(
            NotificationDeliveryStatus,
            name="notification_log_status",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        default=NotificationDeliveryStatus.PENDING,
        index=True,
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    proponent: Mapped["Proponent | None"] = relationship(
        "Proponent", back_populates="notification_logs"
    )
    report_schedule: Mapped["ReportSchedule | None"] = relationship(
        "ReportSchedule", back_populates="notification_logs"
    )
    finding: Mapped["Finding | None"] = relationship(
        "Finding", back_populates="notification_logs"
    )

    def __repr__(self) -> str:
        return f"<NotificationLog {self.channel.value} to {self.recipient!r}>"