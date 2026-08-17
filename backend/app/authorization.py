"""Role-based access control and proponent (tenant) ownership isolation.

Separation of concerns (see the approved Phase 5 architecture):

- Authentication ("who is this user?"): :mod:`app.auth` (JWT + DB resolution).
- RBAC ("what role does the user hold?"): this module's ``admin_required`` /
  ``client_required`` decorators.
- Ownership ("which proponent does the user belong to?"): this module's
  ``require_proponent`` / ``force_client_proponent_id`` / ``require_file``.
- Business rules ("may the user act on this resource?"): the route/service
  layer.

The frontend is never trusted. Roles and proponent ids are always read from
the database-resolved user identity; any client-supplied ``role`` or
``proponent_id`` (in request bodies or query strings) is ignored. Cross-tenant
access returns HTTP 404 (not 403) so the existence of other tenants' records
is never revealed.
"""

from __future__ import annotations

import uuid
from functools import wraps

from flask import g

from .auth import get_authenticated_user, require_user
from .extensions import db
from .models import Evidence, File, Permit, UserRole
from .utils.errors import ApiError


def _forbidden() -> ApiError:
    return ApiError(
        "You do not have permission to access this resource.",
        status_code=403,
        code="forbidden",
    )


def _not_found() -> ApiError:
    return ApiError("Resource not found.", status_code=404, code="not_found")


def _identity_user():
    """Return the DB-resolved current user.

    Prefers the instance already attached by :func:`require_user`; falls back
    to a fresh resolution for helpers used outside a role-decorated route.
    """
    user = g.get("current_user")
    if user is not None:
        return user
    return get_authenticated_user()


def require_role(*roles):
    """Return a decorator requiring the current user to hold one of ``roles``.

    The role is read from the database identity (never the request body).
    Users holding any other role — including clients hitting admin-only
    endpoints and admins hitting client-only endpoints — receive 403.
    """

    def decorator(fn):
        @wraps(fn)
        @require_user
        def wrapper(*args, **kwargs):
            if g.current_user.role not in roles:
                raise _forbidden()
            return fn(*args, **kwargs)

        return wrapper

    return decorator


admin_required = require_role(UserRole.ADMIN)
client_required = require_role(UserRole.CLIENT)


def force_client_proponent_id() -> uuid.UUID:
    """Return the authenticated client's proponent id for write operations.

    The value always comes from the database identity. Callers must use it as
    the authoritative proponent id and must ignore any client-supplied value.
    Raises 403 when the client has no proponent (nothing to own).
    """
    user = get_authenticated_user()
    if user.role != UserRole.CLIENT or user.proponent_id is None:
        raise _forbidden()
    return user.proponent_id


def scoped_query(model, proponent_id, *, proponent_column="proponent_id"):
    """Return a SQL-level query restricted to a single proponent.

    The ownership predicate is part of the SQL statement itself; records are
    never fetched and filtered afterward.
    """
    return model.query.filter(getattr(model, proponent_column) == proponent_id)


def get_resource_or_404(model, resource_id):
    """Resolve any resource by id (admin scope). 404 when missing."""
    record = model.query.filter(model.id == resource_id).first()
    if record is None:
        raise _not_found()
    return record


def require_proponent(model, resource_id, *, proponent_column="proponent_id"):
    """Resolve a resource the current user may access.

    Admins may resolve any resource by id across all proponents. Clients are
    scoped to their own proponent at the SQL level; a cross-tenant id is
    indistinguishable from a missing one and returns 404 (no enumeration).
    """
    user = _identity_user()
    query = model.query.filter(model.id == resource_id)
    if user.role == UserRole.CLIENT:
        if user.proponent_id is None:
            raise _not_found()
        query = query.filter(getattr(model, proponent_column) == user.proponent_id)
    record = query.first()
    if record is None:
        raise _not_found()
    return record


def require_file(file_id: uuid.UUID) -> File:
    """Resolve a file the current user may access.

    Files carry no proponent id; ownership is derived from the referencing
    permit or evidence. A client may access a file only when one of their own
    permits or evidence references it; otherwise 404. Admins resolve by id.
    """
    user = _identity_user()
    if user.role == UserRole.CLIENT:
        if user.proponent_id is None:
            raise _not_found()
        file = _proponent_file_or_none(file_id, user.proponent_id)
        if file is None:
            raise _not_found()
        return file
    file = db.session.get(File, file_id)
    if file is None:
        raise _not_found()
    return file


def _proponent_file_or_none(
    file_id: uuid.UUID, proponent_id: uuid.UUID
) -> File | None:
    """Return a file referenced by one of the proponent's permits/evidence."""
    file = db.session.get(File, file_id)
    if file is None:
        return None
    referenced = (
        db.session.query(Permit.id)
        .filter(Permit.file_id == file.id, Permit.proponent_id == proponent_id)
        .first()
        is not None
        or db.session.query(Evidence.id)
        .filter(Evidence.file_id == file.id, Evidence.proponent_id == proponent_id)
        .first()
        is not None
    )
    return file if referenced else None
