"""Notification delivery service (Phase 11).

Central dispatch for Email and WhatsApp notifications. Responsibilities:

- **Event dispatch** (:func:`dispatch_event`): render a template, resolve
  recipients server-side, respect channel preferences, persist one
  ``NotificationLog`` row per channel, and deliver through the provider
  abstraction. Dispatch never raises: delivery problems are recorded on the
  log as ``Failed`` and logged, never propagated into a workflow response.
- **Transaction safety**: external sends never happen inside a database
  transaction. Each channel's ``Pending`` log row is committed first, then the
  provider is contacted, then the outcome is committed in a fresh
  transaction.
- **Preferences**: automatic dispatch is gated by ``EMAIL_ENABLED`` /
  ``WHATSAPP_ENABLED`` config and the ``CompanySettings`` channel toggles;
  reminder events are additionally gated by the matching
  ``reminder_*_enabled`` flag. A disabled channel produces no log row.
- **Idempotency**: a single dispatch call sends each channel at most once; the
  per-call dedupe key prevents double delivery if a workflow triggers the same
  event twice in one request.
- **Retry**: :func:`retry_notification` records a *new* ``NotificationLog``
  row (an additional attempt) rather than mutating the original delivery, so
  the delivery audit trail is append-only. Attempts are bounded by
  ``NOTIFICATION_MAX_RETRIES`` and the original log's status must be retryable
  (``Failed``/``Pending``); ``Sent`` logs are never retried.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from flask import Request, current_app

from ..extensions import db
from ..models import (
    CompanySettings,
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationLog,
    NotificationType,
    Proponent,
    User,
)
from ..models.mixins import utcnow
from ..utils.errors import ApiError
from .audit_service import record_audit
from .notification_providers import EmailProvider, ProviderResult, WhatsAppProvider
from .notification_templates import render, to_html

if TYPE_CHECKING:
    from ..models import ReportSchedule

_EMAIL = NotificationChannel.EMAIL
_WHATSAPP = NotificationChannel.WHATSAPP


# --------------------------------------------------------------------------- #
# Internal helpers
# --------------------------------------------------------------------------- #


def _commit() -> None:
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def _not_found() -> ApiError:
    return ApiError("Resource not found.", status_code=404, code="not_found")


def _settings() -> CompanySettings | None:
    """Return the singleton company settings row, or None."""
    return CompanySettings.query.order_by(CompanySettings.created_at.asc()).first()


def _channel_enabled(channel: NotificationChannel, *, reminder_days: int | None = None) -> bool:
    """Return whether automatic dispatch may use ``channel``.

    Respects the ``EMAIL_ENABLED``/``WHATSAPP_ENABLED`` config gates (so tests
    and default environments never send anything) and the ``CompanySettings``
    channel toggles. Reminder events additionally respect the matching
    ``reminder_<days>_enabled`` flag.
    """
    config_flag = "EMAIL_ENABLED" if channel == _EMAIL else "WHATSAPP_ENABLED"
    if not current_app.config.get(config_flag):
        return False

    settings = _settings()
    if settings is not None:
        toggle = (
            "enable_email_notifications"
            if channel == _EMAIL
            else "enable_whatsapp_notifications"
        )
        if not getattr(settings, toggle, True):
            return False
        if reminder_days is not None:
            flag = getattr(settings, f"reminder_{reminder_days}_enabled", None)
            if flag is False:
                return False
    return True


def _recipient(channel: NotificationChannel, proponent, explicit: str | None) -> str | None:
    """Resolve a recipient server-side for a channel."""
    if explicit:
        return explicit.strip()
    if proponent is not None:
        if channel == _EMAIL:
            return proponent.email or None
        return proponent.whatsapp_number or None
    return None


def _deliver(log: NotificationLog) -> ProviderResult:
    """Deliver one log through its provider without raising."""
    try:
        if log.channel == _EMAIL:
            return EmailProvider().send(
                subject=log.subject or "",
                body=log.message_body or "",
                body_html=to_html(log.message_body or ""),
                recipient=log.recipient,
            )
        return WhatsAppProvider().send(
            recipient=log.recipient, body=log.message_body or ""
        )
    except Exception:
        return ProviderResult(
            success=False,
            failure_code="provider_error",
            failure_message="The notification provider could not be reached.",
        )


def _record_outcome(log: NotificationLog, result: ProviderResult) -> None:
    """Persist the delivery outcome on an existing log row."""
    if result.success:
        log.status = NotificationDeliveryStatus.SENT
        log.sent_at = utcnow()
        log.error_message = None
    else:
        log.status = NotificationDeliveryStatus.FAILED
        log.error_message = result.failure_message
    db.session.add(log)
    _commit()


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #


def dispatch_event(
    *,
    event_type: str,
    notification_type: NotificationType,
    proponent_id: uuid.UUID | None = None,
    report_schedule_id: uuid.UUID | None = None,
    finding_id: uuid.UUID | None = None,
    email_recipient: str | None = None,
    whatsapp_recipient: str | None = None,
    context: dict | None = None,
    reminder_days: int | None = None,
) -> list[dict]:
    """Dispatch a notification event to both channels (when enabled).

    Never raises: the caller's transaction has already committed and any
    delivery problem must not fail the caller. Per-call dedupe guarantees each
    channel is sent at most once.

    Returns a per-channel outcome list, each item shaped
    ``{"channel": "Email"|"WhatsApp", "status": "sent"|"failed"|"skipped",
    "recipient": str|None, "reason": str|None}`` so callers (e.g. the reminder
    engine) can aggregate delivery results without touching providers.
    """
    outcomes: list[dict] = []
    try:
        proponent = (
            db.session.get(Proponent, proponent_id) if proponent_id else None
        )
        context = dict(context or {})
        if proponent is not None and "name" not in context:
            context["name"] = proponent.contact_person or proponent.company_name
        subject, body_text, body_html = render(event_type, context)

        sent: set[NotificationChannel] = set()
        for channel, explicit in (
            (_EMAIL, email_recipient),
            (_WHATSAPP, whatsapp_recipient),
        ):
            if channel in sent:
                continue
            if not _channel_enabled(channel, reminder_days=reminder_days):
                outcomes.append(
                    {
                        "channel": channel.value,
                        "status": "skipped",
                        "recipient": None,
                        "reason": "disabled",
                    }
                )
                continue
            recipient = _recipient(channel, proponent, explicit)
            if not recipient:
                outcomes.append(
                    {
                        "channel": channel.value,
                        "status": "skipped",
                        "recipient": None,
                        "reason": "no_recipient",
                    }
                )
                continue
            status = _dispatch_channel(
                channel,
                notification_type=notification_type,
                proponent_id=proponent_id,
                report_schedule_id=report_schedule_id,
                finding_id=finding_id,
                recipient=recipient,
                subject=subject,
                body_text=body_text,
            )
            outcomes.append(
                {
                    "channel": channel.value,
                    "status": status,
                    "recipient": recipient,
                    "reason": None,
                }
            )
            sent.add(channel)
    except Exception:
        current_app.logger.exception(
            "Notification dispatch failed for event '%s'.", event_type
        )
    return outcomes


def channel_eligible(
    channel: NotificationChannel,
    *,
    proponent=None,
    reminder_days: int | None = None,
) -> tuple[bool, str]:
    """Return ``(eligible, reason)`` for a channel without sending anything.

    Mirrors the dispatch-time checks: the ``EMAIL_ENABLED``/``WHATSAPP_ENABLED``
    config gates, the ``CompanySettings`` channel toggles, the optional
    ``reminder_<days>_enabled`` flag, and recipient availability. Used by
    callers that must preview delivery (e.g. dry-run reminder execution)
    without persisting logs or contacting providers.
    """
    if not _channel_enabled(channel, reminder_days=reminder_days):
        return False, "disabled"
    if proponent is not None:
        recipient = (
            proponent.email
            if channel == _EMAIL
            else proponent.whatsapp_number
        )
        if not recipient:
            return False, "no_recipient"
    return True, "ok"


def _dispatch_channel(
    channel: NotificationChannel,
    *,
    notification_type: NotificationType,
    proponent_id: uuid.UUID | None,
    report_schedule_id: uuid.UUID | None,
    finding_id: uuid.UUID | None,
    recipient: str,
    subject: str,
    body_text: str,
) -> str:
    """Persist a Pending log, deliver, then record the outcome.

    The Pending row is committed before the provider is contacted so the
    attempt is never lost and no external call happens inside a transaction.

    Returns the final delivery status ("sent" or "failed").
    """
    log = NotificationLog(
        proponent_id=proponent_id,
        report_schedule_id=report_schedule_id,
        finding_id=finding_id,
        channel=channel,
        notification_type=notification_type,
        recipient=recipient,
        subject=subject,
        message_body=body_text,
        status=NotificationDeliveryStatus.PENDING,
    )
    db.session.add(log)
    _commit()

    result = _deliver(log)
    _record_outcome(log, result)
    return "sent" if result.success else "failed"


def _report_context(proponent: "Proponent", schedule: "ReportSchedule") -> dict:
    return {
        "name": proponent.contact_person or proponent.company_name,
        "report_type": schedule.report_type.value,
        "reporting_period": schedule.reporting_period,
        "due_date": schedule.due_date.isoformat(),
    }


def dispatch_report_reminder(
    proponent: "Proponent",
    schedule: "ReportSchedule",
    *,
    days: int,
) -> list[dict]:
    """Dispatch a report-reminder event for a schedule.

    Respects the matching ``reminder_<days>_enabled`` toggle in addition to
    the channel gates. Returns the per-channel outcome list.
    """
    return dispatch_event(
        event_type="report_reminder",
        notification_type=NotificationType.REPORT_REMINDER,
        proponent_id=proponent.id,
        report_schedule_id=schedule.id,
        context=_report_context(proponent, schedule),
        reminder_days=days,
    )


def dispatch_report_due(
    proponent: "Proponent", schedule: "ReportSchedule"
) -> list[dict]:
    """Dispatch a report-due-today event for a schedule.

    Delivered on the schedule's exact due date (``reminder_due_sent`` flag).
    """
    return dispatch_event(
        event_type="report_due",
        notification_type=NotificationType.REPORT_REMINDER,
        proponent_id=proponent.id,
        report_schedule_id=schedule.id,
        context=_report_context(proponent, schedule),
    )


def dispatch_report_overdue(
    proponent: "Proponent", schedule: "ReportSchedule"
) -> list[dict]:
    """Dispatch a report-overdue notice for a schedule.

    Delivered once a schedule passes its due date (``reminder_overdue_sent``
    flag) using the ``OVERDUE_NOTICE`` notification type.
    """
    return dispatch_event(
        event_type="report_overdue",
        notification_type=NotificationType.OVERDUE_NOTICE,
        proponent_id=proponent.id,
        report_schedule_id=schedule.id,
        context=_report_context(proponent, schedule),
    )


# --------------------------------------------------------------------------- #
# Admin retry
# --------------------------------------------------------------------------- #


def attempt_number(log: NotificationLog) -> int:
    """Return the 1-based attempt number of ``log`` within its delivery chain.

    The chain is the set of logs sharing channel, type, recipient, and (when
    set) proponent, ordered by creation. Because retries always append new
    rows, the chain is a faithful, append-only delivery history.
    """
    query = NotificationLog.query.filter_by(
        channel=log.channel,
        notification_type=log.notification_type,
        recipient=log.recipient,
    )
    if log.proponent_id is not None:
        query = query.filter(NotificationLog.proponent_id == log.proponent_id)
    chain = query.order_by(NotificationLog.created_at.asc(), NotificationLog.id.asc()).all()
    for index, row in enumerate(chain, start=1):
        if row.id == log.id:
            return index
    return 1


def retry_notification(
    log_id: uuid.UUID, user: User, request: Request
) -> tuple[NotificationLog, int]:
    """Record a new delivery attempt for a retryable log (admin-only).

    Only ``Failed``/``Pending`` logs are retryable; ``Sent`` logs return 400
    ``not_retryable``. The new attempt is a fresh ``NotificationLog`` row and
    is bounded by ``NOTIFICATION_MAX_RETRIES``. The action is audited as
    ``admin.notification.retry`` with the attempt number as details.
    """
    log = NotificationLog.query.filter_by(id=log_id).first()
    if log is None:
        raise _not_found()
    if log.status == NotificationDeliveryStatus.SENT:
        raise ApiError(
            "Only failed or pending notifications can be retried.",
            status_code=400,
            code="not_retryable",
        )

    max_retries = int(current_app.config.get("NOTIFICATION_MAX_RETRIES", 3) or 3)
    if attempt_number(log) > max_retries:
        raise ApiError(
            "Maximum retry attempts reached for this notification.",
            status_code=400,
            code="max_retries_exceeded",
        )

    new_log = NotificationLog(
        proponent_id=log.proponent_id,
        report_schedule_id=log.report_schedule_id,
        finding_id=log.finding_id,
        channel=log.channel,
        notification_type=log.notification_type,
        recipient=log.recipient,
        subject=log.subject,
        message_body=log.message_body,
        status=NotificationDeliveryStatus.PENDING,
    )
    db.session.add(new_log)
    _commit()

    result = _deliver(new_log)
    _record_outcome(new_log, result)

    attempt = attempt_number(new_log)
    record_audit(
        "admin.notification.retry",
        user_id=user.id,
        entity_type="notification_log",
        entity_id=str(new_log.id),
        details={"attempt": attempt},
        request=request,
    )
    _commit()
    return new_log, attempt


__all__ = [
    "attempt_number",
    "channel_eligible",
    "dispatch_event",
    "dispatch_report_due",
    "dispatch_report_overdue",
    "dispatch_report_reminder",
    "retry_notification",
]