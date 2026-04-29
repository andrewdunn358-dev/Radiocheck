"""
Authentication configuration — single source of truth for JWT signing secret.

Round 10 secrets-hygiene PR: replaces five separate inline JWT_SECRET_KEY env
fallbacks (server.py, routers/auth.py, routers/lms.py, routers/buddy_finder.py,
routers/compliance.py) with one lazy-read function that refuses to silently fall
back to a known placeholder string.

If JWT_SECRET_KEY is missing or set to the historical placeholder (detected
via SHA-256 so the literal does not appear in source), every code path that
needs to sign or verify a token raises a clear startup-style error rather than
producing tokens signed with a public-knowledge value.
"""

import hashlib
import os

# SHA-256 of the historical placeholder string that was hardcoded across the
# codebase before Round 10. The string itself is not stored here — only its
# hash — so the source contains nothing the secret scanner would flag, but we
# can still detect and refuse the placeholder if it ever ends up in the env var.
_HISTORICAL_PLACEHOLDER_SHA256 = (
    "0d356ede0ba49981912e357d2b5ef4a870a721fd186a5b0881e7425f08b68e13"
)


def _is_historical_placeholder(value: str) -> bool:
    return hashlib.sha256(value.encode("utf-8")).hexdigest() == _HISTORICAL_PLACEHOLDER_SHA256


def get_jwt_secret() -> str:
    """
    Return the JWT signing secret from the JWT_SECRET_KEY env var.

    Raises:
        RuntimeError: if JWT_SECRET_KEY is unset, empty, or still set to the
                      pre-Round-10 placeholder string. The caller should let this
                      propagate — there is no safe fallback for a missing signing key.
    """
    secret = os.environ.get("JWT_SECRET_KEY")
    if not secret:
        raise RuntimeError(
            "JWT_SECRET_KEY environment variable is required. "
            "Generate via: python3 -c \"import secrets; print(secrets.token_urlsafe(64))\""
        )
    if _is_historical_placeholder(secret):
        raise RuntimeError(
            "JWT_SECRET_KEY is set to the pre-Round-10 placeholder value, which is "
            "considered public. Rotate to a strong random value before continuing."
        )
    return secret


def get_admin_seed_password() -> str:
    """
    Return the bootstrap admin password from the ADMIN_SEED_PASSWORD env var.

    Used only by one-time-use bootstrap endpoints (/seed-admin, /reset-admin-password,
    /seed-staff, /init-system). If unset, those endpoints return HTTP 503 to the
    caller — production traffic is not affected.

    Raises:
        RuntimeError: if ADMIN_SEED_PASSWORD is unset or empty. The seed endpoints
                      catch this and convert it to a 503 with a clear remediation
                      message.
    """
    password = os.environ.get("ADMIN_SEED_PASSWORD")
    if not password:
        raise RuntimeError(
            "ADMIN_SEED_PASSWORD environment variable is required for this bootstrap "
            "endpoint. Set a strong value in the deployment environment, then retry."
        )
    return password
