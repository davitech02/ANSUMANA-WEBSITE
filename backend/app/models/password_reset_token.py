"""PasswordResetToken model.

Stores only the SHA-256 hash of a reset token — never the raw token. Tokens
are single-use (``used_at``) and expire via ``expires_at``.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .mixins import TimestampMixin, UTCDateTime, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .user import User


class PasswordResetToken(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """A password reset token hash."""

    __tablename__ = "password_reset_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, index=True
    )
    used_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )

    user: Mapped["User"] = relationship(
        "User", back_populates="password_reset_tokens"
    )

    def __repr__(self) -> str:
        return f"<PasswordResetToken user={self.user_id!s}>"