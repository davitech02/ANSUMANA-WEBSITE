"""Marshmallow schemas package."""

from .auth import (
    ForgotPasswordSchema,
    LoginSchema,
    ProponentSchema,
    RegisterSchema,
    ResetPasswordSchema,
    UserSchema,
)

__all__ = [
    "ForgotPasswordSchema",
    "LoginSchema",
    "ProponentSchema",
    "RegisterSchema",
    "ResetPasswordSchema",
    "UserSchema",
]
