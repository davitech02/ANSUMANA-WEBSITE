"""ServiceRequest model.

A service request is a public or portal inquiry for AEC services. Like
bookings it may be submitted without a proponent or creator.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .enums import RequestService, RequestStatus, values_callable
from .mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .proponent import Proponent
    from .user import User


class ServiceRequest(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, db.Model):
    """A request for AEC services."""

    __tablename__ = "service_requests"

    proponent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("proponents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    whatsapp_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    service_needed: Mapped[RequestService] = mapped_column(
        Enum(
            RequestService,
            name="request_service",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
    )
    project_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(
            RequestStatus,
            name="request_status",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        default=RequestStatus.NEW,
        index=True,
    )

    proponent: Mapped["Proponent | None"] = relationship(
        "Proponent", back_populates="service_requests"
    )
    creator: Mapped["User | None"] = relationship(
        "User", back_populates="service_requests"
    )

    def __repr__(self) -> str:
        return f"<ServiceRequest {self.full_name!r}>"