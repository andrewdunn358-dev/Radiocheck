"""Staff portal panic button -> backend contract (29 September 2026).

Live defect: the staff portal panic button (portal/src/app/staff/page.tsx)
posted staff_id/staff_name/reason/location/risk_level to
POST /api/safeguarding/panic-alert — the router stub whose schema requires
user_id and which has "TODO: Send notifications to staff". Every press was
rejected with 422, nothing was stored, nobody was notified, and the page still
told the user "Panic alert sent! A counsellor will be notified."

The established contract is the inline POST /api/panic-alert (server.py): it
persists the alert, emails counsellors/supervisors/admins and records
user-initiated provenance, and it is what the app's peer portal and the staff
AlertsTab already call. The portal now builds its request in
portal/src/lib/staffPanic.ts.

These tests run THAT module under Node to produce the exact request the portal
sends, and post it to the real FastAPI app in-process (mongomock, notification
spy). No network, no production. The portal-side half — success reported only
after backend success — is portal/tests/staffPanic.test.mjs.
"""
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

import pytest

pytest.importorskip("mongomock_motor")
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-not-used-anywhere-else")

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
PANIC_MODULE = REPO / "portal" / "src" / "lib" / "staffPanic.ts"


def _node_that_strips_types():
    node = shutil.which("node")
    if not node:
        return None
    out = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()
    m = re.match(r"v(\d+)\.(\d+)", out)
    if not m or (int(m.group(1)), int(m.group(2))) < (22, 6):
        return None
    return node


def _portal_request(user, reason):
    """The exact request portal/src/lib/staffPanic.ts builds."""
    node = _node_that_strips_types()
    if node is None:
        msg = "Node >= 22.6 is required to run the portal module"
        if os.environ.get("CI"):
            pytest.fail(msg)          # never silently skip the contract in CI
        pytest.skip(msg)
    script = (
        f"const m = await import({json.dumps(PANIC_MODULE.as_uri())});"
        f"process.stdout.write(JSON.stringify(m.buildStaffPanicRequest("
        f"'http://portal.test', 'tok', {json.dumps(user)}, {json.dumps(reason)})));"
    )
    res = subprocess.run([node, "--input-type=module", "-e", script],
                         capture_output=True, text=True, timeout=60)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


@pytest.fixture
def env():
    db = AsyncMongoMockClient()["panic_contract"]
    notified = []

    async def notify_spy(alert):
        notified.append(alert["id"])
        return True

    saved = (server.db, server.send_panic_alert_to_counsellors)
    server.db = db
    server.send_panic_alert_to_counsellors = notify_spy
    try:
        yield type("Env", (), {"db": db, "notified": notified, "client": TestClient(server.app)})
    finally:
        server.db, server.send_panic_alert_to_counsellors = saved


def _stored(db):
    async def read():
        return await db.panic_alerts.find({}, {"_id": 0}).to_list(10)
    return asyncio.run(read())


def _post(env, req):
    path = urlparse(req["url"]).path
    init = req["init"]
    return env.client.request(init["method"], path, content=init["body"], headers=init["headers"])


# --- 1 + 2: the real portal payload is accepted and stored ---------------------

def test_the_portal_request_targets_the_inline_panic_route():
    req = _portal_request({"name": "A Peer", "email": "peer@radiocheck.me"}, "need help now")
    assert urlparse(req["url"]).path == "/api/panic-alert"


def test_the_portal_payload_is_accepted_persisted_and_notified(env):
    req = _portal_request({"name": "A Peer", "email": "peer@radiocheck.me"}, "need help now")
    resp = _post(env, req)

    assert resp.status_code == 200, resp.text
    alert_id = resp.json()["id"]
    stored = _stored(env.db)
    assert len(stored) == 1
    assert stored[0]["id"] == alert_id, "the id the portal keys success on is the stored record's"
    assert stored[0]["user_name"] == "A Peer"
    assert stored[0]["location"] == "staff_portal"
    assert stored[0]["message"] == "need help now"
    assert stored[0]["status"] == "active"
    assert env.notified == [alert_id], "counsellors were not notified"


def test_the_default_message_payload_is_also_accepted(env):
    req = _portal_request({"email": "peer@radiocheck.me"}, "")
    resp = _post(env, req)
    assert resp.status_code == 200, resp.text
    assert _stored(env.db)[0]["message"] == "Staff member triggered panic button"


# --- 4: no success signal unless persisted -------------------------------------

def test_a_persistence_failure_is_not_a_success_response(env):
    """The portal keys success on 2xx + id. A failed insert must yield neither."""
    class _FailingCollection:
        async def insert_one(self, *_a, **_k):
            raise RuntimeError("database unavailable")

    class _FailingDb:
        panic_alerts = _FailingCollection()

    server.db = _FailingDb()          # restored by the fixture
    req = _portal_request({"name": "A Peer"}, "need help now")
    resp = _post(env, req)

    assert resp.status_code == 500
    assert "id" not in resp.json()
    assert env.notified == []


def test_the_shipped_payload_was_rejected_by_the_route_it_used(env):
    """Characterises the defect: what the page used to send, where it sent it."""
    import routers.safeguarding as sg
    sg_saved = sg.get_database
    sg.get_database = lambda: env.db
    try:
        resp = env.client.post("/api/safeguarding/panic-alert", json={
            "staff_id": "s1", "staff_name": "A Peer",
            "reason": "Staff member triggered panic button",
            "location": "staff_portal", "risk_level": "critical"})
    finally:
        sg.get_database = sg_saved
    assert resp.status_code == 422
    assert _stored(env.db) == []


# --- 5: the public intake stays usable without authentication -----------------

def test_the_inline_panic_route_still_accepts_an_unauthenticated_submission(env):
    resp = env.client.post("/api/panic-alert", json={"message": "help"})
    assert resp.status_code == 200, resp.text
    assert len(_stored(env.db)) == 1


def test_the_app_peer_portal_payload_is_unchanged_and_accepted(env):
    """frontend/app/peer-portal.tsx — the other caller of this route."""
    resp = env.client.post("/api/panic-alert", json={
        "user_name": "A Peer", "user_phone": "07000000000",
        "message": "Peer supporter needs immediate counsellor assistance"})
    assert resp.status_code == 200, resp.text
    assert _stored(env.db)[0]["user_phone"] == "07000000000"
