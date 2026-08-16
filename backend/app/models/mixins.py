"""Shared model mixins.

Reused across models for UUID primary keys, timezone-aware timestamps, and
the agreed soft-delete strategy (``is_deleted`` + ``deleted_at``).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator


def utcnow() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """A timezone-aware DateTime column.

    Values are normalized to UTC before being stored and are always returned
    as timezone-aware datetimes (UTC) to the application, regardless of the
    underlying database dialect.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class UUIDPrimaryKeyMixin:
    """Provides a UUID primary key generated with Python ``uuid4``."""

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    """Provides timezone-aware ``created_at`` / ``updated_at`` columns."""

    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow
    )


class SoftDeleteMixin:
    """Provides the soft-delete strategy for business records.

    Records are marked with ``is_deleted``/``deleted_at`` instead of being
    physically removed through normal application workflows.
    """

    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
        index=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )