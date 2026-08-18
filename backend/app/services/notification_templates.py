"""Notification message templates (Phase 11).

Templates are defined in Python, not the database, so there is never any
template code executed at delivery time. Substitution is a safe, whitelist-
based ``{{ key }}`` replace: an unknown or missing key renders as an empty
string and dynamic values are HTML-escaped before they are placed in any HTML
email body, so context values (meeting links, names, phone numbers) can never
inject markup into the delivered message.

Each event type resolves to ``(subject, body_text, body_html)``. The plain
text body is used for WhatsApp and as the text/plain alternative for email;
the HTML body is derived from the plain text body with each line escaped and
wrapped in a paragraph.
"""

from __future__ import annotations

import html
import re
from typing import Any

_TEMPLATES: dict[str, dict[str, str]] = {
    "booking_confirmed": {
        "subject": "Booking confirmed",
        "body": (
            "Hello {{ name }}, your booking for {{ service }} has been "
            "confirmed by the AEC Compliance Team.\n\n"
            "Scheduled: {{ date }} at {{ time }}\n{{ meeting_link }}\n\n"
            "We look forward to speaking with you."
        ),
    },
    "booking_rescheduled": {
        "subject": "Booking rescheduled",
        "body": (
            "Hello {{ name }}, your booking for {{ service }} has been "
            "rescheduled by the AEC Compliance Team.\n\n"
            "New schedule: {{ date }} at {{ time }}\n{{ meeting_link }}\n\n"
            "Please contact us if this does not suit you."
        ),
    },
    "service_request_contacted": {
        "subject": "We received your service request",
        "body": (
            "Hello {{ name }}, thank you for contacting AEC. We have received "
            "your request regarding {{ service }} and our team will be in "
            "touch shortly."
        ),
    },
    "finding_verified": {
        "subject": "Corrective action verified",
        "body": (
            "Hello {{ name }}, the corrective action for the finding "
            "'{{ finding_title }}' has been verified as complete by the AEC "
            "Compliance Team."
        ),
    },
    "evidence_reviewed": {
        "subject": "Evidence review updated",
        "body": (
            "Hello {{ name }}, the evidence you submitted for the finding "
            "'{{ finding_title }}' has been reviewed. New status: "
            "{{ status }}."
        ),
    },
    "report_reminder": {
        "subject": "Report due soon",
        "body": (
            "Hello {{ name }}, your {{ report_type }} for the period "
            "{{ reporting_period }} is due on {{ due_date }}. Please submit "
            "your report on time to stay compliant."
        ),
    },
    "report_due": {
        "subject": "Report due today",
        "body": (
            "Hello {{ name }}, your {{ report_type }} for the period "
            "{{ reporting_period }} is due today ({{ due_date }}). Please "
            "submit your report today to stay compliant."
        ),
    },
    "report_overdue": {
        "subject": "Report overdue",
        "body": (
            "Hello {{ name }}, your {{ report_type }} for the period "
            "{{ reporting_period }} was due on {{ due_date }} and is now "
            "overdue. Please contact AEC to arrange submission and avoid "
            "regulatory sanctions."
        ),
    },
}

_PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")


def _substitute(template: str, context: dict[str, Any] | None) -> str:
    """Replace ``{{ key }}`` placeholders with context values.

    Missing or falsy values render as an empty string. Only simple identifier
    keys are accepted; anything else is left untouched by the regex.
    """
    values = context or {}

    def _replace(match: "re.Match[str]") -> str:
        value = values.get(match.group(1))
        if value is None:
            return ""
        return str(value)

    return _PLACEHOLDER.sub(_replace, template)


def to_html(body_text: str) -> str:
    """Escape and wrap each line of plain text in an HTML paragraph."""
    lines = [html.escape(line) for line in body_text.splitlines() if line.strip()]
    if not lines:
        return ""
    return "<p>" + "</p><p>".join(lines) + "</p>"


def render(event_type: str, context: dict[str, Any] | None = None):
    """Return ``(subject, body_text, body_html)`` for an event type.

    Raises ``KeyError`` for an unknown event type so misconfiguration fails
    fast instead of silently delivering an empty message.
    """
    template = _TEMPLATES[event_type]
    subject = _substitute(template["subject"], context)
    body_text = _substitute(template["body"], context)
    return subject, body_text, to_html(body_text)


def known_event_types() -> frozenset[str]:
    """Return the registered event type names (for validation/tests)."""
    return frozenset(_TEMPLATES)


__all__ = ["known_event_types", "render", "to_html"]