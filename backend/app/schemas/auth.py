"""Request/response schemas for the auth API."""

from __future__ import annotations

from marshmallow import (
    EXCLUDE,
    Schema,
    ValidationError,
    fields,
    validate,
    validates_schema,
)


class RegisterSchema(Schema):
    """Validates the POST /api/auth/register request body.

    ``role``/``proponent_id`` are intentionally not fields: any client-supplied
    value is silently dropped (``EXCLUDE``) and the service always assigns
    ``UserRole.CLIENT``.
    """

    class Meta:
        unknown = EXCLUDE

    full_name = fields.Str(
        required=True, validate=validate.Length(min=2, max=150)
    )
    email = fields.Email(required=True, validate=validate.Length(max=320))
    password = fields.Str(
        required=True, validate=validate.Length(min=8, max=128)
    )
    company_name = fields.Str(
        validate=validate.Length(min=1, max=200), load_default=None
    )


class LoginSchema(Schema):
    """Validates the POST /api/auth/login request body."""

    class Meta:
        unknown = EXCLUDE

    email = fields.Email(required=True, validate=validate.Length(max=320))
    password = fields.Str(required=True, validate=validate.Length(max=128))


class ForgotPasswordSchema(Schema):
    """Validates the POST /api/auth/forgot-password request body."""

    class Meta:
        unknown = EXCLUDE

    email = fields.Email(required=True, validate=validate.Length(max=320))


class ResetPasswordSchema(Schema):
    """Validates the POST /api/auth/reset-password request body."""

    class Meta:
        unknown = EXCLUDE

    token = fields.Str(required=True)
    password = fields.Str(
        required=True, validate=validate.Length(min=8, max=128)
    )
    confirm = fields.Str(required=True)

    @validates_schema
    def _passwords_match(self, data, **kwargs):
        if data.get("password") != data.get("confirm"):
            raise ValidationError({"confirm": "Passwords do not match."})


def _enum_value(value):
    """Return the stored value for an enum member (or the value itself)."""
    return value.value if hasattr(value, "value") else value


class UserSchema(Schema):
    """Public user representation — never exposes ``password_hash``."""

    id = fields.UUID()
    email = fields.Email()
    full_name = fields.Str()
    phone = fields.Str(allow_none=True)
    county = fields.Str(allow_none=True)
    district = fields.Str(allow_none=True)
    role = fields.Function(lambda u: _enum_value(u.role))
    is_active = fields.Bool()
    proponent_id = fields.UUID(allow_none=True)
    created_at = fields.DateTime()
    last_login_at = fields.DateTime(allow_none=True)


class ProponentSchema(Schema):
    """Public proponent representation."""

    id = fields.UUID()
    company_name = fields.Str()
    contact_person = fields.Str()
    email = fields.Email()
    phone = fields.Str(allow_none=True)
    whatsapp_number = fields.Str(allow_none=True)
    project_type = fields.Function(lambda p: _enum_value(p.project_type))
    county = fields.Str(allow_none=True)
    district = fields.Str(allow_none=True)
    project_location = fields.Str(allow_none=True)
    project_description = fields.Str(allow_none=True)
    status = fields.Function(lambda p: _enum_value(p.status))
    created_at = fields.DateTime()
