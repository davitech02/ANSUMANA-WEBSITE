"""Permit model.

Permits belong to a proponent (ON DELETE RESTRICT) and may reference an
uploaded file (SET NULL). The permit number is unique and indexed for fast
lookup by the public status-check endpoint.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .enums import PermitStatus, PermitType, values_callable
from .mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .file import File
    from .proponent import Proponent
    from .report_schedule import ReportSchedule


class Permit(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, db.Model):
    """An environmental permit or license held by a proponent."""

    __tablename__ = "permits"
    __table_args__ = (
        Index("ix_permits_proponent_status", "proponent_id", "status"),
    )

    proponent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proponents.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    permit_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    permit_type: Mapped[PermitType] = mapped_column(
        Enum(
            PermitType,
            name="permit_type",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
    )
    status: Mapped[PermitStatus] = mapped_column(
        Enum(
            PermitStatus,
            name="permit_status",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        default=PermitStatus.ACTIVE,
        index=True,
    )
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("files.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    proponent: Mapped["Proponent"] = relationship(
        "Proponent", back_populates="permits"
    )
    file: Mapped["File | None"] = relationship("File")
    schedules: Mapped[list["ReportSchedule"]] = relationship(
        "ReportSchedule", back_populates="permit", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<Permit {self.permit_number!r}>"