"""File model.

Stores file metadata only. Binary contents live on disk (``storage_path``);
never in PostgreSQL.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .enums import FileCategory, values_callable
from .mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .user import User


class File(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """Metadata for an uploaded file."""

    __tablename__ = "files"

    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    category: Mapped[FileCategory] = mapped_column(
        Enum(
            FileCategory,
            name="file_category",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        default=FileCategory.OTHER,
        index=True,
    )
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    uploaded_by_user: Mapped["User | None"] = relationship(
        "User", back_populates="files"
    )

    def __repr__(self) -> str:
        return f"<File {self.stored_name!r}>"