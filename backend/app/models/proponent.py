"""Proponent model.

A proponent is a client company tracked by AEC. Business records owned by a
proponent (permits, schedules, findings, evidence, bookings, service
requests, notification logs) are protected with ON DELETE RESTRICT so they
are never silently lost; users linked to a proponent are SET NULL instead.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from ..extensions import db
from ..utils.text import normalize_email
from .enums import ProjectType, ProponentStatus, values_callable
from .mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .booking import Booking
    from .evidence import Evidence
    from .finding import Finding
    from .notification_log import NotificationLog
    from .permit import Permit
    from .report_schedule import ReportSchedule
    from .service_request import ServiceRequest
    from .user import User


class Proponent(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, db.Model):
    """A client company registered with AEC."""

    __tablename__ = "proponents"

    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_person: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False, index=True
    )
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    whatsapp_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    project_type: Mapped[ProjectType | None] = mapped_column(
        Enum(
            ProjectType,
            name="project_type",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=True,
    )
    county: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    project_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    project_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProponentStatus] = mapped_column(
        Enum(
            ProponentStatus,
            name="proponent_status",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        default=ProponentStatus.ACTIVE,
        index=True,
    )

    users: Mapped[list["User"]] = relationship(
        "User", back_populates="proponent", passive_deletes=True
    )
    permits: Mapped[list["Permit"]] = relationship(
        "Permit", back_populates="proponent", passive_deletes=True
    )
    schedules: Mapped[list["ReportSchedule"]] = relationship(
        "ReportSchedule", back_populates="proponent", passive_deletes=True
    )
    findings: Mapped[list["Finding"]] = relationship(
        "Finding", back_populates="proponent", passive_deletes=True
    )
    evidence: Mapped[list["Evidence"]] = relationship(
        "Evidence", back_populates="proponent", passive_deletes=True
    )
    bookings: Mapped[list["Booking"]] = relationship(
        "Booking", back_populates="proponent", passive_deletes=True
    )
    service_requests: Mapped[list["ServiceRequest"]] = relationship(
        "ServiceRequest", back_populates="proponent", passive_deletes=True
    )
    notification_logs: Mapped[list["NotificationLog"]] = relationship(
        "NotificationLog", back_populates="proponent", passive_deletes=True
    )

    @validates("email")
    def _normalize_email(self, _key: str, value: str) -> str:
        return normalize_email(value)

    def __repr__(self) -> str:
        return f"<Proponent {self.company_name!r}>"