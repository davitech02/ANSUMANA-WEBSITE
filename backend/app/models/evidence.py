"""Evidence model.

Evidence links a finding to an uploaded file (metadata only) and records the
review outcome by an admin reviewer.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .enums import ReviewStatus, values_callable
from .mixins import SoftDeleteMixin, TimestampMixin, UTCDateTime, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .file import File
    from .finding import Finding
    from .proponent import Proponent
    from .user import User


class Evidence(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, db.Model):
    """Evidence submitted in response to a finding."""

    __tablename__ = "evidence"
    __table_args__ = (
        Index("ix_evidence_finding_review_status", "finding_id", "review_status"),
    )

    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("findings.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    proponent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proponents.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("files.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    evidence_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_status: Mapped[ReviewStatus] = mapped_column(
        Enum(
            ReviewStatus,
            name="review_status",
            values_callable=values_callable,
            native_enum=True,
        ),
        nullable=False,
        default=ReviewStatus.PENDING_REVIEW,
        index=True,
    )
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )

    finding: Mapped["Finding"] = relationship("Finding", back_populates="evidence")
    proponent: Mapped["Proponent"] = relationship(
        "Proponent", back_populates="evidence"
    )
    file: Mapped["File | None"] = relationship("File")
    reviewer: Mapped["User | None"] = relationship(
        "User", back_populates="evidence_reviews"
    )

    def __repr__(self) -> str:
        return f"<Evidence {self.id!s}>"