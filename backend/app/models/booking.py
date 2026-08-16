"""Booking model.

A booking is a consultation session request. It may be submitted publicly
(no proponent/creator) or through the portal by a logged-in user.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .enums import BookingService, BookingStatus, values_callable
from .mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .proponent import Proponent
    from .user import User


class Booking(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, db.Model):
    """A consultation session booking."""

    __tablename__ = "bookings"

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
    service_needed: Mapped[BookingService] = mapped_column(
        Enum(
            BookingService,
            name="booking_service",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
    )
    preferred_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    preferred_time: Mapped[str | None] = mapped_column(String(20), nullable=True)
    project_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    booking_status: Mapped[BookingStatus] = mapped_column(
        Enum(
            BookingStatus,
            name="booking_status",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        default=BookingStatus.PENDING,
        index=True,
    )
    meeting_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    proponent: Mapped["Proponent | None"] = relationship(
        "Proponent", back_populates="bookings"
    )
    creator: Mapped["User | None"] = relationship(
        "User", back_populates="bookings_created"
    )

    def __repr__(self) -> str:
        return f"<Booking {self.full_name!r}>"