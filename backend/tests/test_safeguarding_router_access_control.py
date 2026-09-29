"""Access control on routers/safeguarding.py — containment regression.

Contract (same shape as the retention-router containment, #125):

    unauthenticated caller -> REFUSED -> handler side effects do not execute

for every route that reads or changes stored records, plus authorised-path
tests showing a legitimate admin / supervisor is not locked out, and that the
two intake routes the app and portal submit to are still open.

WHY THIS FILE EXISTS
--------------------
Found during Task 3 (29 September 2026). No route in routers/safeguarding.py
checked the caller: the router declared no dependency, server.py includes it
with none (server.py:9731), and the only middleware on the app is CORS. So
GET /api/safeguarding/safeguarding-alerts returned every AI safeguarding alert
(triggering message, full conversation history, IP, geolocation) with no login,
and screening submissions and panic alerts could be read and changed the same
way. The equivalent server.py routes all require a login.

Everything runs in-process against mongomock. NOTHING here touches production.
"""
import asyncio
import os
import sys
import types

import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-not-used-anywhere-else")

import jwt  # noqa: E402
import routers.auth as auth  # noqa: E402
import routers.safeguarding as sg  # noqa: E402
from auth_config import get_jwt_secret  # noqa: E402

P = "/api/safeguarding"
ALERT_ID = "alert-0001"
SUB_ID = "sub-0001"
PANIC_ID = "panic-0001"

SECRET_MESSAGE = "SYNTHETIC-TRIGGERING-MESSAGE"
SECRET_HISTORY = "SYNTHETIC-CONVERSATION-HISTORY"
SECRET_IP = "203.0.113.9"
SECRET_DETAILS = "SYNTHETIC-PHQ9-DETAILS"

# Every route that reads or changes stored records. Query parameters are the
# ones each handler requires, so a request that got past the boundary would
# reach the handler rather than fail validation first.
STAFF_ROUTES = [
    ("GET", f"{P}/safeguarding-alerts"),
    ("GET", f"{P}/safeguarding-alerts/{ALERT_ID}"),
    ("GET", f"{P}/safeguarding-alerts/stats/summary"),
    ("PATCH", f"{P}/safeguarding-alerts/{ALERT_ID}/acknowledge?staff_id=x"),
    ("PATCH", f"{P}/safeguarding-alerts/{ALERT_ID}/resolve?staff_id=x"),
    ("PATCH", f"{P}/safeguarding-alerts/{ALERT_ID}/notes?notes=x"),
    ("GET", f"{P}/screening-submissions"),
    ("GET", f"{P}/screening-submissions/{SUB_ID}"),
    ("GET", f"{P}/screening-submissions/stats/summary"),
    ("PATCH", f"{P}/screening-submissions/{SUB_ID}/status?status=resolved"),
    ("GET", f"{P}/panic-alerts"),
    ("PATCH", f"{P}/panic-alerts/{PANIC_ID}/acknowledge?staff_id=x"),
    ("PATCH", f"{P}/panic-alerts/{PANIC_ID}/resolve?staff_id=x"),
]
MUTATING = [r for r in STAFF_ROUTES if r[0] == "PATCH"]
READS = [r for r in STAFF_ROUTES if r[0] == "GET"]

# The only routes deliberately left open, and why (see the module header).
PUBLIC_ROUTES = {("POST", "/safeguarding/concern"), ("POST", "/safeguarding/panic-alert")}

STAFF = {
    "admin-0001": "admin",
    "super-0001": "supervisor",
    "couns-0001": "counsellor",
    "peer-0001": "peer",
}


@pytest.fixture
def env():
    db = AsyncMongoMockClient()["veterans_support"]

    async def seed():
        for sid, role in STAFF.items():
            await db.staff.insert_one({"id": sid, "email": f"{sid}@radiocheck.me",
                                       "role": role, "name": sid})
        await db.safeguarding_alerts.insert_one({
            "id": ALERT_ID, "status": "active", "risk_level": "RED",
            "triggering_message": SECRET_MESSAGE,
            "conversation_history": [{"role": "user", "content": SECRET_HISTORY}],
            "client_ip": SECRET_IP, "geo_city": "Testville",
        })
        await db.screening_submissions.insert_one({
            "id": SUB_ID, "status": "pending", "severity": "high",
            "user_id": "u1", "user_name": "A Veteran", "details": SECRET_DETAILS,
        })
        await db.panic_alerts.insert_one({"id": PANIC_ID, "status": "active"})

    asyncio.run(seed())
    sg.get_database = lambda: db
    auth.get_database = lambda: db

    app = FastAPI()
    app.include_router(sg.router, prefix="/api")      # exactly as server.py:9731
    return types.SimpleNamespace(db=db, client=TestClient(app))


def _token(staff_id):
    return {"Authorization": f"Bearer {jwt.encode({'sub': staff_id}, get_jwt_secret(), algorithm='HS256')}"}


def _snapshot(db):
    async def read():
        return (
            await db.safeguarding_alerts.find_one({"id": ALERT_ID}, {"_id": 0}),
            await db.screening_submissions.find_one({"id": SUB_ID}, {"_id": 0}),
            await db.panic_alerts.find_one({"id": PANIC_ID}, {"_id": 0}),
        )
    return asyncio.run(read())


# --- refused -------------------------------------------------------------------

@pytest.mark.parametrize("method,path", STAFF_ROUTES)
def test_every_staff_route_refuses_an_unauthenticated_caller(env, method, path):
    resp = env.client.request(method, path)
    assert resp.status_code in (401, 403), f"{method} {path} -> {resp.status_code}"
    for secret in (SECRET_MESSAGE, SECRET_HISTORY, SECRET_IP, SECRET_DETAILS):
        assert secret not in resp.text


@pytest.mark.parametrize("method,path", STAFF_ROUTES)
def test_every_staff_route_refuses_a_bad_token(env, method, path):
    resp = env.client.request(method, path, headers={"Authorization": "Bearer not-a-token"})
    assert resp.status_code in (401, 403)


@pytest.mark.parametrize("role_id", ["couns-0001", "peer-0001"])
@pytest.mark.parametrize("method,path", STAFF_ROUTES)
def test_every_staff_route_refuses_staff_below_supervisor(env, method, path, role_id):
    resp = env.client.request(method, path, headers=_token(role_id))
    assert resp.status_code == 403, f"{method} {path} allowed {STAFF[role_id]}: {resp.status_code}"


@pytest.mark.parametrize("method,path", MUTATING)
def test_a_refused_change_does_not_touch_the_database(env, method, path):
    before = _snapshot(env.db)
    env.client.request(method, path)                          # no credentials
    env.client.request(method, path, headers=_token("peer-0001"))
    assert _snapshot(env.db) == before, f"a refused {method} {path} changed stored records"


# --- a legitimate admin / supervisor is not locked out -------------------------

@pytest.mark.parametrize("role_id", ["admin-0001", "super-0001"])
@pytest.mark.parametrize("method,path", READS)
def test_admin_and_supervisor_can_still_read(env, method, path, role_id):
    resp = env.client.request(method, path, headers=_token(role_id))
    assert resp.status_code == 200, f"{STAFF[role_id]} locked out of {path}: {resp.status_code}"


def test_the_portal_screening_status_action_still_works_for_an_admin(env):
    """The one client call into the protected group (portal/src/lib/admin-api.ts)."""
    resp = env.client.patch(f"{P}/screening-submissions/{SUB_ID}/status?status=resolved",
                            headers=_token("admin-0001"))
    assert resp.status_code == 200
    assert _snapshot(env.db)[1]["status"] == "resolved"


# --- the intake routes stay open ------------------------------------------------

def test_the_app_screening_form_can_still_submit_without_a_login(env):
    """frontend/app/mental-health-screening.tsx posts here."""
    resp = env.client.post(f"{P}/concern", json={
        "user_id": "u2", "concern_type": "mental_health_screening",
        "severity": "low", "details": "d"})
    assert resp.status_code == 200, resp.text


def test_the_panic_alert_intake_is_still_open(env):
    """The intake route stays reachable without a login, with the body its
    schema (models/schemas.py PanicAlertCreate) accepts.

    NOTE, pre-existing and NOT changed here: the portal staff panic button
    (portal/src/app/staff/page.tsx:178) posts staff_id/staff_name/reason, which
    this schema rejects with 422 on main as well. Reported separately.
    """
    resp = env.client.post(f"{P}/panic-alert", json={"user_id": "u3", "location": "app"})
    assert resp.status_code == 200, resp.text


# --- structural: nothing new is open by accident -------------------------------

def test_every_route_is_either_a_named_intake_route_or_protected():
    """A route added later must be protected, or deliberately listed as public."""
    seen = set()
    for route in sg.router.routes:
        assert isinstance(route, APIRoute)
        for method in route.methods:
            key = (method, route.path)
            seen.add(key)
            protected = any(
                getattr(d.dependency, "__qualname__", "").startswith("require_role")
                for d in route.dependencies
            )
            if key in PUBLIC_ROUTES:
                assert not protected, f"{key} is listed as public but is protected"
            else:
                assert protected, f"{key} is neither protected nor a named intake route"
    assert PUBLIC_ROUTES <= seen
    assert len(seen) == len(PUBLIC_ROUTES) + len(STAFF_ROUTES), (
        "a route was added or removed — confirm its access and update this count deliberately")
