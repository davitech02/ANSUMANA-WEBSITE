"""Shared text normalization helpers."""


def normalize_email(email: str) -> str:
    """Normalize an email address to lowercase with whitespace trimmed."""
    return (email or "").strip().lower()