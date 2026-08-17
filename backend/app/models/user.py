"""User model.

Passwords are never stored as plaintext: the model only carries
``password_hash``. Emails are normalized (lowercased, trimmed) on assignment
and unique at the database level.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from ..extensions import db
from ..utils.text import normalize_email
from .enums import UserRole, values_callable
from .mixins import TimestampMixin, UTCDateTime, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .audit_log import AuditLog
    from .booking import Booking
    from .evidence import Evidence
    from .file import File
    from .notification import Notification
    from .password_reset_token import PasswordResetToken
    from .proponent import Proponent
    from .service_request import ServiceRequest
    from .token_blocklist import TokenBlocklist


class User(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """A user of the compliance portal."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    county: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        default=UserRole.CLIENT,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    proponent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("proponents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Timestamp of the most recent successful login (NULL until first login).
    last_login_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    # Incremented whenever a password changes. All previously issued JWT
    # access/refresh tokens carry a matching claim, so bumping this value
    # invalidates every outstanding session in one step.
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    proponent: Mapped["Proponent | None"] = relationship(
        "Proponent", back_populates="users"
    )
    evidence_reviews: Mapped[list["Evidence"]] = relationship(
        "Evidence", back_populates="reviewer", passive_deletes=True
    )
    files: Mapped[list["File"]] = relationship(
        "File", back_populates="uploaded_by_user", passive_deletes=True
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog", back_populates="user", passive_deletes=True
    )
    bookings_created: Mapped[list["Booking"]] = relationship(
        "Booking", back_populates="creator", passive_deletes=True
    )
    service_requests: Mapped[list["ServiceRequest"]] = relationship(
        "ServiceRequest", back_populates="creator", passive_deletes=True
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    blocklisted_tokens: Mapped[list["TokenBlocklist"]] = relationship(
        "TokenBlocklist", back_populates="user", passive_deletes=True
    )

    @validates("email")
    def _normalize_email(self, _key: str, value: str) -> str:
        return normalize_email(value)

    def __repr__(self) -> str:
        return f"<User {self.email!r}>"