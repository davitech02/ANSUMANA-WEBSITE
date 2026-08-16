"""Finding model.

A finding records a compliance issue raised during a review. It carries its
own compliance status, risk level, and the corrective action status. The
associated report schedule is optional (SET NULL).
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .enums import ActionStatus, ComplianceStatus, RiskLevel, values_callable
from .mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .evidence import Evidence
    from .notification_log import NotificationLog
    from .proponent import Proponent
    from .report_schedule import ReportSchedule


class Finding(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, db.Model):
    """A compliance finding for a proponent."""

    __tablename__ = "findings"
    __table_args__ = (
        Index("ix_findings_proponent_action_status", "proponent_id", "action_status"),
    )

    proponent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proponents.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    report_schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("report_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    inspection_area: Mapped[str | None] = mapped_column(String(150), nullable=True)
    finding_title: Mapped[str] = mapped_column(String(255), nullable=False)
    finding_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    compliance_status: Mapped[ComplianceStatus] = mapped_column(
        Enum(
            ComplianceStatus,
            name="compliance_status",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        index=True,
    )
    risk_level: Mapped[RiskLevel] = mapped_column(
        Enum(
            RiskLevel,
            name="risk_level",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        index=True,
    )
    corrective_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_deadline: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    responsible_party: Mapped[str | None] = mapped_column(String(150), nullable=True)
    action_status: Mapped[ActionStatus] = mapped_column(
        Enum(
            ActionStatus,
            name="action_status",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        default=ActionStatus.OPEN,
        index=True,
    )
    sent_to_proponent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    proponent: Mapped["Proponent"] = relationship(
        "Proponent", back_populates="findings"
    )
    report_schedule: Mapped["ReportSchedule | None"] = relationship(
        "ReportSchedule", back_populates="findings"
    )
    evidence: Mapped[list["Evidence"]] = relationship(
        "Evidence", back_populates="finding", passive_deletes=True
    )
    notification_logs: Mapped[list["NotificationLog"]] = relationship(
        "NotificationLog", back_populates="finding", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<Finding {self.finding_title!r}>"