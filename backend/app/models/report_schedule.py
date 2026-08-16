"""ReportSchedule model.

Schedules define when a proponent must submit a compliance report. Reminder
flags record which reminder stages have already been sent so the reminder
engine never double-sends.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .enums import ReportStatus, ReportType, values_callable
from .mixins import SoftDeleteMixin, TimestampMixin, UTCDateTime, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .finding import Finding
    from .notification_log import NotificationLog
    from .permit import Permit
    from .proponent import Proponent


class ReportSchedule(
    UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, db.Model
):
    """A scheduled compliance report for a proponent."""

    __tablename__ = "report_schedules"
    __table_args__ = (
        Index("ix_report_schedules_proponent_due", "proponent_id", "due_date"),
    )

    proponent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proponents.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    permit_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("permits.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    report_type: Mapped[ReportType] = mapped_column(
        Enum(
            ReportType,
            name="report_type",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
    )
    reporting_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[ReportStatus] = mapped_column(
        Enum(
            ReportStatus,
            name="report_status",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        default=ReportStatus.PENDING,
        index=True,
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    reminder_30_sent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    reminder_14_sent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    reminder_7_sent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    reminder_1_sent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    reminder_due_sent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    reminder_overdue_sent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    proponent: Mapped["Proponent"] = relationship(
        "Proponent", back_populates="schedules"
    )
    permit: Mapped["Permit | None"] = relationship("Permit", back_populates="schedules")
    findings: Mapped[list["Finding"]] = relationship(
        "Finding", back_populates="report_schedule", passive_deletes=True
    )
    notification_logs: Mapped[list["NotificationLog"]] = relationship(
        "NotificationLog", back_populates="report_schedule", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<ReportSchedule {self.id!s} due {self.due_date}>"