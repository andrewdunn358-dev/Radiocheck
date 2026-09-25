"""Access control on POST /api/shifts/send-reminders — containment regression.

Ant's contract, 25 September 2026:

    unauthenticated request -> AUTHORIZATION FAILURE
                            -> shift_reminders import/side effect NOT REACHED

WHY THIS ROUTE IS IN AN ACCESS-CONTROL PR ABOUT RETENTION
---------------------------------------------------------
It is the first link in a demonstrated chain, not an unrelated endpoint:

    anonymous POST /api/shifts/send-reminders
      -> handler imports scripts/shift_reminders.py
      -> that module calls log_dir.mkdir() at import time (:35)
      -> backend/logs/ now exists on the container
      -> the import failure that currently stops
         anonymous POST /api/admin/data-retention/run?dry_run=false
         from reaching the destructive sweep is gone

So the directory that was acting as an accidental barrier could be created
remotely by anyone. The barrier was never a control; this route is why it
cannot be relied on even as an accident.

The route also sends real email to staff, which is its own reason not to leave
it anonymous.

SCOPE: this route only. Ant explicitly did not authorise a wider survey of
routers/shifts.py, and none was done.

Everything here runs in-process. No network request, no production call, and
no test invokes the real reminder machinery.
"""
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-not-used-anywhere-else")

import jwt  # noqa: E402
import routers.shifts as shifts  # noqa: E402
from auth_config import get_jwt_secret  # noqa: E402

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(BACKEND, "logs")
PATH = "/api/shifts/send-reminders"


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(shifts.router, prefix="/api")   # exactly as server.py:9705 does
    return TestClient(app)


@pytest.fixture
def no_side_effects():
    """Make the two observable side effects of the import detectable.

    `shift_reminders` must not be in sys.modules and backend/logs/ must not
    exist, so that either appearing proves the import was reached.
    """
    saved = sys.modules.pop("shift_reminders", None)
    logs_existed = os.path.isdir(LOGS_DIR)
    if logs_existed:                       # pragma: no cover - local dev only
        pytest.skip("backend/logs/ already exists; cannot observe its creation")

    yield

    if os.path.isdir(LOGS_DIR) and not logs_existed:
        import shutil
        shutil.rmtree(LOGS_DIR, ignore_errors=True)
    sys.modules.pop("shift_reminders", None)
    if saved is not None:
        sys.modules["shift_reminders"] = saved


# --- the contract -----------------------------------------------------------

def test_unauthenticated_request_is_refused(client, no_side_effects):
    resp = client.post(PATH)
    assert resp.status_code in (401, 403), (
        f"{PATH} answered {resp.status_code} to a caller with no credentials"
    )


def test_refused_request_does_not_reach_the_import_or_its_side_effect(client, no_side_effects):
    """The whole point: authorisation must fail BEFORE the import runs."""
    client.post(PATH)                      # no credentials

    assert "shift_reminders" not in sys.modules, (
        "the handler imported shift_reminders despite the request being refused"
    )
    assert not os.path.isdir(LOGS_DIR), (
        "a refused request created backend/logs/ — the accidental barrier in "
        "front of the unauthenticated retention sweep can still be removed "
        "remotely"
    )


def test_bad_token_is_refused_before_the_import(client, no_side_effects):
    resp = client.post(PATH, headers={"Authorization": "Bearer not-a-token"})
    assert resp.status_code in (401, 403)
    assert "shift_reminders" not in sys.modules
    assert not os.path.isdir(LOGS_DIR)


def test_non_admin_is_refused_before_the_import(client, no_side_effects, monkeypatch):
    class _FakeDB:
        class _Coll:
            async def find_one(self, *_a, **_k):
                return {"id": "staff-2", "email": "c@rc.me", "role": "counsellor"}

        def __getattr__(self, _name):
            return self._Coll()

    monkeypatch.setattr("routers.auth.get_database", lambda: _FakeDB())
    token = jwt.encode({"sub": "staff-2"}, get_jwt_secret(), algorithm="HS256")

    resp = client.post(PATH, headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 403, f"a counsellor reached the route: {resp.status_code}"
    assert "shift_reminders" not in sys.modules
    assert not os.path.isdir(LOGS_DIR)


# --- the authorised path is not broken --------------------------------------

def test_an_admin_still_reaches_the_handler(client, no_side_effects, monkeypatch):
    """Proves the dependency has not made the route unusable.

    `shift_reminders` is stubbed so the real machinery never runs — no
    directory is created, no email is sent, no database is touched.
    """
    import types

    called = []
    stub = types.ModuleType("shift_reminders")

    async def check_and_send_reminders():
        called.append(True)
        return {"sent": 0, "checked": 0}

    stub.check_and_send_reminders = check_and_send_reminders
    sys.modules["shift_reminders"] = stub

    class _FakeDB:
        class _Coll:
            async def find_one(self, *_a, **_k):
                return {"id": "admin-1", "email": "admin@rc.me", "role": "admin"}

        def __getattr__(self, _name):
            return self._Coll()

    monkeypatch.setattr("routers.auth.get_database", lambda: _FakeDB())
    token = jwt.encode({"sub": "admin-1"}, get_jwt_secret(), algorithm="HS256")

    resp = client.post(PATH, headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200, (
        f"the dependency locked a legitimate admin out: {resp.status_code} {resp.text[:200]}"
    )
    assert called == [True], "the admin path did not reach the handler"


# --- the premise this containment rests on ----------------------------------

def test_importing_shift_reminders_really_does_create_the_log_directory(no_side_effects):
    """Pins the mechanism, so the chain cannot quietly stop being true.

    If scripts/shift_reminders.py stops creating backend/logs/ on import, this
    fails and the rationale recorded above needs revisiting. It is evidence,
    not an endorsement — the directory is not a security control either way.
    """
    sys.path.insert(0, os.path.join(BACKEND, "scripts"))
    import shift_reminders  # noqa: F401

    assert os.path.isdir(LOGS_DIR), (
        "importing shift_reminders no longer creates backend/logs/ — the "
        "documented failure chain has changed"
    )
