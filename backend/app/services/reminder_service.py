"""Automated reminder engine (Phase 12).

Scheduled, DB-backed reminder execution for ``ReportSchedule`` rows. The
engine is deliberately scheduler-agnostic: :func:`run_reminders` is a
deterministic, callable service that a future cron worker, a ``flask`` CLI
command, or the admin API can invoke. No Celery/Redis/APScheduler.

Design decisions:

- **SQL-level discovery**: candidate schedules for each reminder window are
  selected with database filters (due-date window, actionable status,
  soft-delete flags, unsent reminder flag) and paginated batches, so the
  engine never loads the full table or does Python-side scanning.
- **Atomic claim for concurrency**: each window is idempotentized through the
  existing ``reminder_*_sent`` columns on ``ReportSchedule`` (no new schema).
  Before delivery the engine claims the window with
  ``UPDATE ... WHERE reminder_<window>_sent = FALSE``; only one concurrent run
  can win the claim (``rowcount == 1``), guaranteeing a schedule is never
  double-reminded even when runs overlap. A lost claim counts as a skip.
- **Window toggles are respected before claiming**: a disabled
  ``reminder_<days>_enabled`` setting means the window is never examined, so
  the flag is never consumed by a run that should not have sent.
- **Delivery always through the notification service**: dispatch (and the
  config/CompanySettings/channel-preference gates) lives in
  :mod:`app.services.notification_service`; this module never talks to a
  provider directly. Due and overdue windows use the ``REPORT_REMINDER`` and
  ``OVERDUE_NOTICE`` types respectively.
- **Dry run**: ``dry_run=True`` computes what would be sent (same gates) but
  claims nothing, persists nothing, and contacts nothing.
- **Safety**: a single failed delivery is recorded as ``failed`` and never
  aborts the run; aggregated counts are returned (no secrets, recipients, or
  raw provider output).
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import update
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import (
    CompanySettings,
    NotificationChannel,
    Proponent,
    ReportSchedule,
    ReportStatus,
)
from ..models.mixins import utcnow
from .audit_service import record_audit
from .notification_service import (
    channel_eligible,
    dispatch_report_due,
    dispatch_report_overdue,
    dispatch_report_reminder,
)

_EMAIL = NotificationChannel.EMAIL
_WHATSAPP = NotificationChannel.WHATSAPP

_REMINDER_WINDOWS = ("30", "14", "7", "1", "due", "overdue")

_WINDOW_LABELS = {
    "30": "30_days",
    "14": "14_days",
    "7": "7_days",
    "1": "1_day",
    "due": "due",
    "overdue": "overdue",
}

_ACTIONABLE_STATUSES = (ReportStatus.PENDING, ReportStatus.OVERDUE)

_DEFAULT_BATCH_SIZE = 200


# --------------------------------------------------------------------------- #
# Internal helpers
# --------------------------------------------------------------------------- #


def _commit() -> None:
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def _flag(window: str) -> str:
    """Return the idempotency flag column for a reminder window."""
    if window == "due":
        return "reminder_due_sent"
    if window == "overdue":
        return "reminder_overdue_sent"
    return f"reminder_{window}_sent"


def _window_enabled(settings: CompanySettings | None, window: str) -> bool:
    """Return whether a reminder window is enabled (settings may be None).

    Due/overdue windows have no CompanySettings toggle, so they are always
    enabled (delivery still respects the channel config/preference gates).
    """
    if window in ("due", "overdue"):
        return True
    if settings is None:
        return True
    return bool(getattr(settings, f"reminder_{window}_enabled", True))


def _candidates(today: date, window: str, batch_size: int, last_id) -> list:
    """SQL-level candidate query for one reminder window batch.

    Uses keyset pagination (``id > last_id``) rather than ``OFFSET`` so that
    claiming flags mid-run (which shrinks the filtered candidate set) never
    causes rows to be skipped between batches.
    """
    flag = _flag(window)
    query = (
        ReportSchedule.query.filter(
            ReportSchedule.is_deleted.is_(False),
            ReportSchedule.status.in_(_ACTIONABLE_STATUSES),
            ReportSchedule.proponent.has(Proponent.is_deleted.is_(False)),
            getattr(ReportSchedule, flag).is_(False),
        )
        .options(joinedload(ReportSchedule.proponent))
        .order_by(ReportSchedule.id.asc())
    )
    if window == "overdue":
        query = query.filter(ReportSchedule.due_date < today)
    elif window == "due":
        query = query.filter(ReportSchedule.due_date == today)
    else:
        query = query.filter(
            ReportSchedule.due_date == today + timedelta(days=int(window))
        )
    if last_id is not None:
        query = query.filter(ReportSchedule.id > last_id)
    return query.limit(batch_size).all()


def _claim(schedule_id, window: str) -> bool:
    """Atomically claim a reminder window; True only if this run won.

    The ``WHERE reminder_<window>_sent = FALSE`` guard makes the claim
    race-safe: a concurrent run that already flipped the flag cannot match,
    so exactly one run per schedule/window ever dispatches.
    """
    flag = _flag(window)
    flag_column = getattr(ReportSchedule, flag)
    result = db.session.execute(
        update(ReportSchedule)
        .where(
            ReportSchedule.id == schedule_id,
            flag_column.is_(False),
        )
        .values({flag_column: True})
    )
    if result.rowcount != 1:
        return False
    _commit()
    return True


def _dispatch(schedule: ReportSchedule, window: str) -> list[dict]:
    """Dispatch the window event through the notification service."""
    proponent = schedule.proponent
    if proponent is None or proponent.is_deleted:
        return []
    if window == "due":
        return dispatch_report_due(proponent, schedule)
    if window == "overdue":
        return dispatch_report_overdue(proponent, schedule)
    return dispatch_report_reminder(proponent, schedule, days=int(window))


def _would_dispatch(schedule: ReportSchedule, window: str) -> list[str]:
    """Dry-run per-channel prediction: "sent" or "skipped" per channel."""
    proponent = schedule.proponent
    if proponent is None or proponent.is_deleted:
        return []
    reminder_days = int(window) if window not in ("due", "overdue") else None
    statuses = []
    for channel in (_EMAIL, _WHATSAPP):
        eligible, _reason = channel_eligible(
            channel, proponent=proponent, reminder_days=reminder_days
        )
        statuses.append("sent" if eligible else "skipped")
    return statuses


# --------------------------------------------------------------------------- #
# Run
# --------------------------------------------------------------------------- #


def _process(schedule: ReportSchedule, window: str, dry_run: bool, result: dict) -> None:
    """Process a single candidate schedule against a window."""
    if dry_run:
        result["eligible"] += 1
        for status in _would_dispatch(schedule, window):
            if status == "sent":
                result["sent"] += 1
            else:
                result["skipped"] += 1
        return

    if not _claim(schedule.id, window):
        result["skipped"] += 1
        return
    result["eligible"] += 1

    for outcome in _dispatch(schedule, window):
        status = outcome["status"]
        if status == "sent":
            result["sent"] += 1
        elif status == "failed":
            result["failed"] += 1
        else:
            result["channel_skips"] += 1


def _run_window(
    window: str,
    today: date,
    settings: CompanySettings | None,
    dry_run: bool,
    batch_size: int,
) -> dict:
    """Discover and process every candidate for one reminder window."""
    result = {
        "processed": 0,
        "eligible": 0,
        "sent": 0,
        "failed": 0,
        "skipped": 0,
        "channel_skips": 0,
    }
    if not _window_enabled(settings, window):
        return result

    last_id = None
    while True:
        candidates = _candidates(today, window, batch_size, last_id)
        if not candidates:
            break
        result["processed"] += len(candidates)
        for schedule in candidates:
            _process(schedule, window, dry_run, result)
        last_id = candidates[-1].id
    return result


def run_reminders(
    *,
    now=None,
    dry_run: bool = False,
    batch_size: int = _DEFAULT_BATCH_SIZE,
    actor=None,
    request=None,
) -> dict:
    """Run the reminder engine and return an aggregated run summary.

    :param now: injectable reference time (defaults to ``utcnow()``); the UTC
        date derived from it drives every due-date window, so runs are
        deterministic under a fixed clock.
    :param dry_run: preview without claiming, sending, or persisting.
    :param batch_size: candidate batch size per window/page (SQL ``LIMIT``).
    :param actor: when provided (an admin ``User``), an ``admin.reminders.run``
        audit entry is recorded with safe aggregate counts.
    :param request: Flask request used for audit metadata when ``actor`` is
        provided.

    Returns a summary with totals and a per-window breakdown. It never
    contains secrets, recipients, or raw provider output.
    """
    now = now or utcnow()
    today = now.date()
    settings = CompanySettings.query.order_by(
        CompanySettings.created_at.asc()
    ).first()

    windows = {
        label: _run_window(window, today, settings, dry_run, batch_size)
        for window, label in _WINDOW_LABELS.items()
    }
    totals = {
        key: sum(window[key] for window in windows.values())
        for key in ("processed", "eligible", "sent", "failed", "skipped", "channel_skips")
    }

    summary = {
        "run_at": now.isoformat(),
        "dry_run": bool(dry_run),
        "processed": totals["processed"],
        "eligible": totals["eligible"],
        "sent": totals["sent"],
        "failed": totals["failed"],
        "skipped": totals["skipped"],
        "channel_skips": totals["channel_skips"],
        "windows": windows,
    }

    if actor is not None:
        record_audit(
            "admin.reminders.run",
            user_id=actor.id,
            entity_type="reminder_run",
            details={
                "dry_run": summary["dry_run"],
                "processed": totals["processed"],
                "eligible": totals["eligible"],
                "sent": totals["sent"],
                "failed": totals["failed"],
                "skipped": totals["skipped"],
            },
            request=request,
        )
        _commit()

    return summary


__all__ = ["run_reminders"]