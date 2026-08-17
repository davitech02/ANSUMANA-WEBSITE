"""TokenBlocklist model.

Records revoked JWT identifiers (JTIs) so access/refresh tokens can be
invalidated before their natural expiry. Only the JTI (a random UUID, never a
secret) and metadata are stored — never the raw token or its payload.

Rows are written on:
* logout (both access and, when provided, refresh tokens)
* refresh-token rotation (the old refresh token is revoked)
* any other targeted revocation

A JTI present in this table is treated as revoked by the JWT blocklist loader.
Expired rows are purged opportunistically by the auth service.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .mixins import TimestampMixin, UTCDateTime, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .user import User


class TokenBlocklist(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """A revoked JWT identifier."""

    __tablename__ = "token_blocklist"
    __table_args__ = (
        Index("ix_token_blocklist_user_created", "user_id", "created_at"),
    )

    jti: Mapped[str] = mapped_column(
        String(36), unique=True, nullable=False, index=True
    )
    token_type: Mapped[str] = mapped_column(String(20), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, index=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )

    user: Mapped["User | None"] = relationship(
        "User", back_populates="blocklisted_tokens"
    )

    def __repr__(self) -> str:
        return f"<TokenBlocklist {self.token_type} {self.jti}>"
