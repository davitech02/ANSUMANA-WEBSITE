"""Notification provider abstraction (Phase 11).

Each provider implements a single ``send`` method returning a normalized
:class:`ProviderResult`. Providers never raise: transport-level errors are
normalized into a ``ProviderResult`` with a safe, non-secret failure message
so credentials, tokens, and raw payloads are never leaked to callers, logs,
audit entries, or API consumers.

- :class:`EmailProvider` sends HTML email over SMTP using the standard
  library's ``smtplib`` with an explicit connect timeout.
- :class:`WhatsAppProvider` sends a text message over HTTP using ``requests``
  with an explicit timeout. The concrete upstream (Twilio/360dialog/generic)
  is selected via ``WHATSAPP_PROVIDER``; the generic adapter posts
  ``{"to", "from", "text"}`` to ``WHATSAPP_API_BASE_URL``.

All settings are read from ``current_app.config`` at send time so tests can
override them without restarting the app. No secrets are hardcoded here.
"""

from __future__ import annotations

import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr

import requests
from flask import current_app


@dataclass(frozen=True)
class ProviderResult:
    """Normalized outcome of a provider delivery attempt."""

    success: bool
    provider_message_id: str | None = None
    failure_code: str | None = None
    failure_message: str | None = None


def _not_configured(provider: str) -> ProviderResult:
    return ProviderResult(
        success=False,
        failure_code="provider_not_configured",
        failure_message=f"The {provider} provider is not configured.",
    )


def _provider_error(provider: str) -> ProviderResult:
    return ProviderResult(
        success=False,
        failure_code="provider_error",
        failure_message=f"The {provider} provider could not be reached.",
    )


class EmailProvider:
    """Send HTML email over SMTP with an explicit timeout."""

    def send(self, *, subject: str, body: str, body_html: str, recipient: str) -> ProviderResult:
        host = current_app.config.get("SMTP_HOST") or ""
        if not host:
            return _not_configured("email")
        port = int(current_app.config.get("SMTP_PORT", 587) or 587)
        use_tls = bool(current_app.config.get("SMTP_USE_TLS", True))
        use_ssl = bool(current_app.config.get("SMTP_USE_SSL", False))
        username = current_app.config.get("SMTP_USERNAME") or ""
        password = current_app.config.get("SMTP_PASSWORD") or ""
        timeout = int(current_app.config.get("NOTIFICATION_TIMEOUT", 15) or 15)
        sender_name = current_app.config.get("MAIL_FROM_NAME", "AEC Compliance Portal")
        sender_address = current_app.config.get("MAIL_FROM") or username

        message = EmailMessage()
        message["From"] = formataddr((sender_name, sender_address))
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        if body_html:
            message.add_alternative(body_html, subtype="html")

        try:
            if use_ssl:
                client = smtplib.SMTP_SSL(
                    host, port, timeout=timeout, context=ssl.create_default_context()
                )
            else:
                client = smtplib.SMTP(host, port, timeout=timeout)
            try:
                if not use_ssl and use_tls:
                    client.starttls(context=ssl.create_default_context())
                if username:
                    client.login(username, password)
                client.send_message(message)
            finally:
                try:
                    client.quit()
                except smtplib.SMTPServerDisconnected:
                    pass
        except (smtplib.SMTPException, OSError, TimeoutError):
            return _provider_error("email")
        return ProviderResult(success=True)


class WhatsAppProvider:
    """Send a text message over HTTP with an explicit timeout."""

    def send(self, *, recipient: str, body: str) -> ProviderResult:
        base_url = current_app.config.get("WHATSAPP_API_BASE_URL") or ""
        if not base_url:
            return _not_configured("WhatsApp")
        timeout = int(current_app.config.get("NOTIFICATION_TIMEOUT", 15) or 15)
        access_token = current_app.config.get("WHATSAPP_ACCESS_TOKEN") or ""
        sender_id = current_app.config.get("WHATSAPP_SENDER_ID") or ""
        provider = current_app.config.get("WHATSAPP_PROVIDER", "generic")

        headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
        payload = {
            "to": recipient,
            "from": sender_id,
            "text": body,
            "provider": provider,
        }

        try:
            response = requests.post(
                base_url.rstrip("/") + "/messages",
                json=payload,
                headers=headers,
                timeout=timeout,
            )
        except requests.RequestException:
            return _provider_error("WhatsApp")

        if response.status_code < 200 or response.status_code >= 300:
            return _provider_error("WhatsApp")
        return ProviderResult(success=True)


__all__ = ["EmailProvider", "ProviderResult", "WhatsAppProvider"]