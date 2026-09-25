"""Access control on routers/data_retention.py — containment regression.

Ant's contract, 25 September 2026:

    unauthenticated caller -> REFUSED -> handler side effects do not execute

for every route on this router, plus an authorised-path test showing the
dependency has not made the router unusable for a legitimate admin.

WHY THIS FILE EXISTS
--------------------
Before the containment PR, the router's docstring claimed "Admin only access"
and no code implemented it: `Depends` was imported and never used, no route
carried a dependency, the APIRouter declared none, server.py included it with
none, and the only middleware on the app is CORS. All five routes were
reachable by an unauthenticated caller, one of which deletes from `users`.

It is not enough to assert that a dependency appears in the source, so these
tests drive the real router through a representative FastAPI app and check the
database afterwards. Everything runs in-process against mongomock. NOTHING here
touches production and no test issues a network request or a destructive
production call.
"""
import asyncio
import os
import sys
import types

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
# A test-only signing secret. auth_config.get_jwt_secret() refuses to fall back
# to anything, so one must be present for the authorised-path test to sign a token.
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-not-used-anywhere-else")

import jwt  # noqa: E402
import routers.auth as auth  # noqa: E402
import routers.data_retention as dr  # noqa: E402
from auth_config import get_jwt_secret  # noqa: E402

PREFIX = "/api/admin/data-retention"
VICTIM = "a3f1c9e2-7b44-4d10-9f3e-2c5a8d6b1e07"
ADMIN_ID = "admin-0001"

# Every route on the router. The contract applies to all of them.
ALL_ROUTES = [
    ("DELETE", f"{PREFIX}/user-data/{VICTIM}"),
    ("POST", f"{PREFIX}/run"),
    ("GET", f"{PREFIX}/gdpr-requests"),
    ("GET", f"{PREFIX}/reports"),
    ("GET", f"{PREFIX}/status"),
]

DESTRUCTIVE_ROUTES = [r for r in ALL_ROUTES if r[0] in ("DELETE", "POST")]


class _CleanupSpy:
    """Stands in for scripts/data_retention.py so POST /run's side effect is
    observable without importing the real module (which would create
    backend/logs/ — the thing Ant has blocked until this PR is merged)."""

    def __init__(self):
        self.called_with = []

    async def run_retention_cleanup(self, dry_run: bool = True):
        self.called_with.append(dry_run)
        return {"status": "success", "dry_run": dry_run}


@pytest.fixture
def env():
    """A representative app plus a seeded database and a cleanup spy."""
    db = AsyncMongoMockClient()["veterans_support"]

    async def seed():
        await db.users.insert_one({"id": VICTIM, "email": "veteran@example.com"})
        await db.staff.insert_one({
            "id": ADMIN_ID, "email": "admin@radiocheck.me",
            "role": "admin", "name": "An Admin",
        })
        await db.chat_messages.insert_one({"user_id": VICTIM, "message": "i've had enough"})
        await db.safeguarding_alerts.insert_one({
            "user_id": VICTIM,
            "triggering_message": "i'm going to end it tonight",
            "client_ip": "86.8.47.29",
        })
        await db.gdpr_deletion_logs.insert_one({"user_id": VICTIM, "status": "completed"})

    asyncio.run(seed())

    spy = _CleanupSpy()
    fake = types.ModuleType("data_retention")
    fake.run_retention_cleanup = spy.run_retention_cleanup
    saved = sys.modules.get("data_retention")
    sys.modules["data_retention"] = fake

    dr.get_database = lambda: db
    auth.get_database = lambda: db        # the dependency resolves the admin here

    app = FastAPI()
    app.include_router(dr.router)          # exactly as server.py:9731 does
    yield types.SimpleNamespace(db=db, client=TestClient(app), spy=spy)

    if saved is None:
        sys.modules.pop("data_retention", None)
    else:
        sys.modules["data_retention"] = saved


def _admin_token():
    return jwt.encode({"sub": ADMIN_ID}, get_jwt_secret(), algorithm="HS256")


# --- the contract: refused ---------------------------------------------------

@pytest.mark.parametrize("method,path", ALL_ROUTES)
def test_every_route_refuses_an_unauthenticated_caller(env, method, path):
    resp = env.client.request(method, path)
    assert resp.status_code in (401, 403), (
        f"{method} {path} answered {resp.status_code} to a caller with no credentials"
    )


@pytest.mark.parametrize("method,path", ALL_ROUTES)
def test_every_route_refuses_a_bad_token(env, method, path):
    resp = env.client.request(method, path, headers={"Authorization": "Bearer not-a-token"})
    assert resp.status_code in (401, 403)


@pytest.mark.parametrize("method,path", ALL_ROUTES)
def test_every_route_refuses_a_valid_token_for_a_non_admin(env, method, path):
    async def add_ordinary_user():
        await env.db.staff.insert_one({
            "id": "staff-0002", "email": "counsellor@radiocheck.me",
            "role": "counsellor", "name": "A Counsellor",
        })

    asyncio.run(add_ordinary_user())
    token = jwt.encode({"sub": "staff-0002"}, get_jwt_secret(), algorithm="HS256")

    resp = env.client.request(method, path, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403, (
        f"{method} {path} allowed a non-admin: {resp.status_code}"
    )


# --- the contract: side effects do not execute ------------------------------

def test_refused_delete_does_not_touch_the_database(env):
    """The destructive route's side effect must not be reached on refusal."""
    env.client.delete(f"{PREFIX}/user-data/{VICTIM}")   # no credentials

    async def read():
        return (
            await env.db.users.find_one({"id": VICTIM}),
            await env.db.safeguarding_alerts.find_one({}),
            await env.db.gdpr_deletion_logs.count_documents({}),
        )

    user, alert, log_count = asyncio.run(read())

    assert user is not None, "the account was deleted by a refused request"
    assert user["email"] == "veteran@example.com"
    assert alert["user_id"] == VICTIM, "the safeguarding link was severed by a refused request"
    assert "_gdpr_deleted" not in alert
    assert log_count == 1, "a refused request wrote a GDPR deletion log entry"


@pytest.mark.parametrize("query", ["", "?dry_run=true", "?dry_run=false"])
def test_refused_run_does_not_dispatch_the_cleanup(env, query):
    """Covers the chained path: ?dry_run=false must not reach the sweep."""
    resp = env.client.post(f"{PREFIX}/run{query}")

    assert resp.status_code in (401, 403)
    assert env.spy.called_with == [], (
        f"a refused POST /run{query} dispatched the cleanup: {env.spy.called_with}"
    )


# --- the contract: a legitimate admin is not locked out ---------------------

def test_an_authenticated_admin_can_still_read_status(env):
    resp = env.client.get(
        f"{PREFIX}/status", headers={"Authorization": f"Bearer {_admin_token()}"})

    assert resp.status_code == 200, (
        f"the dependency locked a legitimate admin out of /status: {resp.status_code} "
        f"{resp.text[:200]}"
    )
    assert len(resp.json()["retention_policies"]) == 7


def test_an_authenticated_admin_can_still_reach_the_cleanup_route(env):
    """Authorised path only, and only the non-mutating default.

    Proves the router is still usable end-to-end, without exercising the
    destructive branch anywhere.
    """
    resp = env.client.post(
        f"{PREFIX}/run?dry_run=true", headers={"Authorization": f"Bearer {_admin_token()}"})

    assert resp.status_code == 200
    assert env.spy.called_with == [True], "the admin path did not reach the handler"


# --- structural: the boundary is declared once, for the whole router --------

def test_the_dependency_is_declared_at_router_level(env):
    """A route added later must inherit the boundary rather than opt into it."""
    assert dr.router.dependencies, "the router-level dependency has been removed"
    assert len(dr.router.routes) == 5, (
        "a route was added or removed — confirm it inherits the admin dependency "
        "and update this count deliberately"
    )
