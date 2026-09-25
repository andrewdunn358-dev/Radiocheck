"""Access control on routers/data_retention.py.

Bounded investigation commissioned by Ant, 25 September 2026, after the
retention archaeology surfaced the control surface rather than the policy.

    DELETE /api/admin/data-retention/user-data/{user_id}

The router's docstring says "Admin only access". No route in the file applies
any authentication or authorisation:

    - `Depends` is imported (:8) and never used
    - no route carries a dependency
    - the APIRouter (:20) declares no `dependencies=`
    - `server.py:9731` includes it with no `dependencies=`
    - the only middleware on the app is CORS (`server.py:8938`)

Everything here runs against a mongomock database in-process. NOTHING in this
file touches production, and no test issues a network request.

The characterisation tests PASS — they record what the code does today. The
xfail(strict=True) tests are the contract Radio Check does not currently meet;
CI fails if any of them silently starts passing, which is the point.
"""
import asyncio
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")

import routers.data_retention as dr  # noqa: E402

PREFIX = "/api/admin/data-retention"
VICTIM = "a3f1c9e2-7b44-4d10-9f3e-2c5a8d6b1e07"

# Every route on this router. `/run` is excluded from the live-call tests
# because it imports scripts/data_retention.py inside the handler and then
# opens a Mongo connection; its access-control status is asserted statically
# in test_no_route_on_this_router_declares_a_dependency.
READ_ROUTES = [
    ("GET", f"{PREFIX}/status"),
    ("GET", f"{PREFIX}/reports"),
    ("GET", f"{PREFIX}/gdpr-requests"),
]


def _client(db):
    """A representative app: the real router, included exactly as server.py does."""
    dr.get_database = lambda: db
    app = FastAPI()
    app.include_router(dr.router)          # server.py:9731 — no prefix, no dependencies
    return TestClient(app)


def _seeded_db():
    db = AsyncMongoMockClient()["veterans_support"]

    async def seed():
        await db.users.insert_one({"id": VICTIM, "email": "veteran@example.com"})
        await db.chat_messages.insert_one({"user_id": VICTIM, "message": "i've had enough"})
        await db.safeguarding_alerts.insert_one({
            "user_id": VICTIM,
            "triggering_message": "i'm going to end it tonight",
            "conversation_history": [{"role": "user", "content": "my marriage is over"}],
            "client_ip": "86.8.47.29",
            "risk_level": "RED",
        })
        await db.notes.insert_one({"user_id": VICTIM, "content": "counsellor note"})
        await db.gdpr_deletion_logs.insert_one({"user_id": VICTIM, "status": "completed"})

    asyncio.run(seed())
    return db


# --- C: reachability -------------------------------------------------------

def test_unauthenticated_delete_reaches_the_destructive_handler():
    """Characterisation. Recorded so the gap is visible, not to bless it."""
    db = _seeded_db()
    client = _client(db)

    resp = client.delete(f"{PREFIX}/user-data/{VICTIM}")   # no Authorization, no cookie

    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    assert resp.json()["details"]["users"] == {"action": "deleted", "count": 1}


@pytest.mark.xfail(strict=True, reason=(
    "ACCESS CONTROL: DELETE /user-data/{user_id} applies no authentication or "
    "authorisation. An unauthenticated caller reaches a handler that deletes "
    "from `users`. The sibling route in routers/compliance.py:615-616 does "
    "require_admin(); this one does not."
))
def test_delete_user_data_rejects_an_unauthenticated_caller():
    db = _seeded_db()
    resp = _client(db).delete(f"{PREFIX}/user-data/{VICTIM}")
    assert resp.status_code in (401, 403), (
        f"expected the request to be refused, got {resp.status_code}"
    )


@pytest.mark.xfail(strict=True, reason=(
    "ACCESS CONTROL: the read routes on this router disclose retention "
    "statistics, record volumes and the real user_ids of previously deleted "
    "users, with no authentication."
))
@pytest.mark.parametrize("method,path", READ_ROUTES)
def test_read_routes_reject_an_unauthenticated_caller(method, path):
    db = _seeded_db()
    resp = _client(db).request(method, path)
    assert resp.status_code in (401, 403), (
        f"{method} {path} answered {resp.status_code} to an unauthenticated caller"
    )


def test_no_route_on_this_router_declares_a_dependency():
    """Static assertion covering /run too, without invoking it.

    Pins the whole router rather than the routes the other tests can call.
    """
    assert not dr.router.dependencies, "router-level dependencies appeared"
    offenders = [
        r.path for r in dr.router.routes
        if not getattr(r, "dependencies", None)
    ]
    assert len(offenders) == 5, f"expected 5 undefended routes, found {offenders}"


# --- D/E: what the handler actually does -----------------------------------

def test_deletion_severs_the_safeguarding_record_but_leaves_the_crisis_message():
    """Characterisation, and the reason this matters beyond access control.

    The handler sets user_id to '[DELETED_USER]' and writes a `message` field.
    A SafeguardingAlert keeps its content in `triggering_message` and
    `conversation_history`, which the handler never touches. So the call
    destroys the link to the person while preserving what they said — the
    opposite of both erasure and of the 7-year safeguarding audit trail.
    """
    db = _seeded_db()
    client = _client(db)
    client.delete(f"{PREFIX}/user-data/{VICTIM}")

    async def read():
        return await db.safeguarding_alerts.find_one({})

    alert = asyncio.run(read())

    assert alert["user_id"] == "[DELETED_USER]"          # link destroyed
    assert alert["triggering_message"] == "i'm going to end it tonight"   # content kept
    assert alert["conversation_history"]                                  # content kept
    assert alert["client_ip"] == "86.8.47.29"                             # identifier kept
    assert alert["message"] == "[CONTENT REMOVED PER GDPR REQUEST]"       # field CREATED


# --- F: reachability evidence, not an access-control substitute ------------

def test_response_body_reveals_whether_a_user_id_exists():
    """user_ids are uuid4, so they are not guessable — that is a practical
    constraint on exploitation, NOT a control. Recorded as such: the endpoint
    answers the existence question for any id supplied, unauthenticated."""
    db = _seeded_db()
    client = _client(db)

    real = client.delete(f"{PREFIX}/user-data/{VICTIM}").json()["details"]
    absent = client.delete(f"{PREFIX}/user-data/no-such-user").json()["details"]

    assert real["users"]["count"] == 1
    assert absent["users"]["count"] == 0


def test_gdpr_request_log_discloses_real_user_ids():
    """The deletion log stores the real user_id (routers/data_retention.py:136)
    and /gdpr-requests returns it unauthenticated — so the router itself
    publishes valid ids for users whose data has already been deleted."""
    db = _seeded_db()
    body = _client(db).get(f"{PREFIX}/gdpr-requests").json()
    assert body["gdpr_deletion_requests"][0]["user_id"] == VICTIM
