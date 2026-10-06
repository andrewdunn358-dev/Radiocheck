"""Session limit (SESSION_RATE_LIMIT): safety gets first refusal.

Before the fix, once a sessionId passed SESSION_RATE_LIMIT (100) requests,
check_session_limit returned its fixed GREEN "We've been chatting for a
while..." reply before request acceptance, normalisation, safety detection,
reconciliation and EXIT A, so a crisis message at request 101 was answered
GREEN with no alert.

Existing ruling (Ant, 6 Oct 2026): a product conversation limit must not
prevent an otherwise accepted user turn from receiving applicable safety
evaluation. Same A2 ordering as the 30-message cap (#133):

    accepted request -> existing safety processing
      EXIT A?                        -> existing EXIT A, unchanged
      existing escalation required?  -> existing EXIT B, unchanged
      product limit exceeded?        -> existing applicable limit response
                                        (session-limit wording wins)

Accepted ordering correction: an over-limit request that fails an existing
acceptance check now gets that existing rejection (e.g. 400 for >2,000 chars)
rather than the limit reply.

These tests reuse the #133 harness pieces unchanged (scripted model that counts
calls, in-memory Mongo, silent classifier, stubbed geo and email) and the same
established EXIT A input. The session request counter and buddy turn counter
are set directly so each request lands on the boundary under test.

Not covered here (same evidence limitation as #133, not invented): the A2
non-failsafe escalation path over the limit. The only established input for it
needs a live Mongo server and the live embedding layer to reach the classifier,
so it cannot be driven deterministically offline.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from test_message_cap_safety_precedence import (  # noqa: E402  (#133 harness pieces)
    BENIGN_MESSAGE,
    CAP_REPLY,
    CRISIS_MESSAGE,
    _ScriptedModel,
    _classifier_silent,
    _no_email,
    _no_geo,
    mongomock_motor,
    server,
    unified_safety,
)
from fastapi.testclient import TestClient  # noqa: E402

LIMIT = server.SESSION_RATE_LIMIT
CAP = server.BUDDY_MAX_MESSAGES
SESSION_LIMIT_REPLY = (
    "We've been chatting for a while. If you'd like to continue talking, a "
    "real person is available. Use the 'Talk to a real person' button to "
    "connect with someone."
)


@pytest.fixture
def harness(monkeypatch):
    store = mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"] + uuid.uuid4().hex[:6]]
    model = _ScriptedModel()
    monkeypatch.setattr(server, "buddy_openai_client", model)
    monkeypatch.setattr(server, "gemini_client", None)
    monkeypatch.setattr(server, "db", store)
    monkeypatch.setattr(unified_safety, "classify_message_with_ai", _classifier_silent)
    monkeypatch.setattr(server, "lookup_ip_geolocation", _no_geo)
    monkeypatch.setattr(server, "send_safeguarding_email_notification", _no_email)
    client = TestClient(server.app)
    created = []

    class H:
        pass

    h = H()

    def request(n, message, *, sid=None, buddy_turn=1):
        """Send `message` as session request `n` (buddy turn `buddy_turn` for a new sid)."""
        if sid is None:
            sid = f"sl-{uuid.uuid4().hex[:10]}"
            now = datetime.utcnow()
            server.session_message_counts[sid] = n - 1
            server.buddy_sessions[sid] = {"message_count": buddy_turn - 1, "history": [],
                                          "character": "tommy", "last_active": now,
                                          "created_at": now}
            created.append(sid)
        calls_before = model.calls
        resp = client.post("/api/ai-buddies/chat",
                           json={"message": message, "sessionId": sid, "character": "tommy"})
        assert server.session_message_counts[sid] == n
        return resp, sid, model.calls - calls_before

    def ok(n, message, **kw):
        resp, sid, calls = request(n, message, **kw)
        assert resp.status_code == 200, resp.text
        return resp.json(), sid, calls

    def alerts(sid):
        return asyncio.run(store.safeguarding_alerts.find({"session_id": sid}, {"_id": 0}).to_list(20))

    h.request, h.ok, h.alerts = request, ok, alerts
    yield h
    for sid in created:
        server.buddy_sessions.pop(sid, None)
        server.session_message_counts.pop(sid, None)


def _assert_session_limit_response(body):
    assert body["reply"] == SESSION_LIMIT_REPLY
    assert body["safeguardingTriggered"] is False
    assert body["safeguardingAlertId"] is None
    assert body["riskLevel"] == "GREEN"
    assert body["riskScore"] == 0


# 1. Below the limit: ordinary behaviour ---------------------------------------

def test_request_100_benign_keeps_ordinary_behaviour(harness):
    body, sid, calls = harness.ok(LIMIT, BENIGN_MESSAGE)
    assert body["reply"] not in (SESSION_LIMIT_REPLY, CAP_REPLY)
    assert calls >= 1, "an ordinary turn below both limits reaches generation"
    assert body["safeguardingTriggered"] is False
    assert harness.alerts(sid) == []


# 2. Over the limit, benign: existing limit response, no generation ------------

def test_request_101_benign_gets_existing_session_limit_response(harness):
    body, sid, calls = harness.ok(LIMIT + 1, BENIGN_MESSAGE)
    _assert_session_limit_response(body)
    assert calls == 0, "an ordinary over-limit turn must not reach generation"
    assert harness.alerts(sid) == []


# 3. Over the limit, crisis: existing EXIT A ------------------------------------

def test_request_101_crisis_gets_exit_a_not_the_limit(harness):
    body, sid, calls = harness.ok(LIMIT + 1, CRISIS_MESSAGE)
    assert body["reply"] != SESSION_LIMIT_REPLY, "the limit must not manufacture GREEN"
    assert body["safeguardingTriggered"] is True
    assert body["riskLevel"] == "RED"
    assert calls == 0, "EXIT A returns before generation"
    alerts = harness.alerts(sid)
    assert len(alerts) == 1 and alerts[0]["risk_level"] == "RED"
    assert alerts[0]["id"] == body["safeguardingAlertId"]


# 4. Boundary comparison ----------------------------------------------------------

def test_same_crisis_input_has_same_disposition_either_side_of_the_limit(harness):
    below, sid_below, calls_below = harness.ok(LIMIT, CRISIS_MESSAGE)
    above, sid_above, calls_above = harness.ok(LIMIT + 1, CRISIS_MESSAGE)
    for field in ("reply", "safeguardingTriggered", "riskLevel", "riskScore"):
        assert below[field] == above[field], field
    assert below["safeguardingTriggered"] is True and below["riskLevel"] == "RED"
    assert calls_below == calls_above == 0
    assert len(harness.alerts(sid_below)) == len(harness.alerts(sid_above)) == 1


# 5. The limit still wins after a crisis when safety does not escalate --------

def test_request_102_benign_after_crisis_still_gets_the_limit(harness):
    crisis, sid, _ = harness.ok(LIMIT + 1, CRISIS_MESSAGE)
    assert crisis["safeguardingTriggered"] is True
    body, _, calls = harness.ok(LIMIT + 2, BENIGN_MESSAGE, sid=sid)
    _assert_session_limit_response(body)
    assert calls == 0
    assert len(harness.alerts(sid)) == 1, "only the crisis turn's alert"


# 6. Both product limits exceeded ------------------------------------------------

def test_both_limits_benign_gets_session_limit_wording(harness):
    body, sid, calls = harness.ok(LIMIT + 1, BENIGN_MESSAGE, buddy_turn=CAP + 1)
    _assert_session_limit_response(body)
    assert body["reply"] != CAP_REPLY
    assert calls == 0
    assert harness.alerts(sid) == []


def test_both_limits_crisis_gets_exit_a(harness):
    body, sid, calls = harness.ok(LIMIT + 1, CRISIS_MESSAGE, buddy_turn=CAP + 1)
    assert body["reply"] not in (SESSION_LIMIT_REPLY, CAP_REPLY)
    assert body["safeguardingTriggered"] is True
    assert body["riskLevel"] == "RED"
    assert calls == 0
    assert len(harness.alerts(sid)) == 1


# 7. Accepted ordering correction: acceptance checks before the limit ----------

def test_request_101_oversized_gets_existing_400_not_the_limit_reply(harness):
    resp, sid, calls = harness.request(LIMIT + 1, "x" * 2001)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Message too long"
    assert calls == 0
    assert harness.alerts(sid) == []
