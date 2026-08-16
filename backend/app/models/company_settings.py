"""CompanySettings model.

Singleton configuration record for the organization. The single-row rule is
enforced by the service layer; only ``updated_by`` links to a user.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .user import User


class CompanySettings(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """Organization-wide settings."""

    __tablename__ = "company_settings"

    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    company_email: Mapped[str] = mapped_column(String(320), nullable=False)
    company_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company_whatsapp: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_tagline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enable_email_notifications: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    enable_whatsapp_notifications: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    reminder_30_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    reminder_14_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    reminder_7_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    reminder_1_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    updated_by_user: Mapped["User | None"] = relationship("User")

    def __repr__(self) -> str:
        return f"<CompanySettings {self.company_name!r}>"