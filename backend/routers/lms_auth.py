"""
LMS authentication helpers.

Two kinds of caller use the LMS:
  * learners  - carry the learner JWT issued by /api/lms/learner/login
                (payload "type": "learner", "email": ...)
  * admins    - carry the normal staff JWT from /api/auth/login with role "admin"

Before this module existed the LMS trusted a `learner_email` query/body value
and the /api/lms/admin/* routes had no auth at all.
"""

from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from auth_config import get_jwt_secret
from routers.auth import get_current_user, require_role

ALGORITHM = "HS256"

_bearer = HTTPBearer(auto_error=False)

# Admin-only LMS routes
require_lms_admin = require_role("admin")


@dataclass
class LmsCaller:
    email: str
    is_admin: bool


async def get_lms_caller(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> LmsCaller:
    """Accept either a learner token or an admin staff token."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials

    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    if payload.get("type") == "learner":
        email = (payload.get("email") or "").lower()
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        return LmsCaller(email=email, is_admin=False)

    # Not a learner token: must be an admin staff token
    user = await get_current_user(credentials)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return LmsCaller(email=(user.email or "").lower(), is_admin=True)


def ensure_self(caller: LmsCaller, learner_email: str) -> None:
    """A learner may only act on their own record; admins may act on any."""
    if caller.is_admin:
        return
    if (learner_email or "").lower() != caller.email:
        raise HTTPException(status_code=403, detail="Not permitted for this learner")
