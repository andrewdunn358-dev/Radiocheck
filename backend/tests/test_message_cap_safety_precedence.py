"""Message cap: safety gets first refusal (live defect, 1 Oct 2026).

Before the fix, once a buddy session passed BUDDY_MAX_MESSAGES (30) every
later turn returned the fixed "Let's pause here for now..." reply before
normalisation, safety detection, reconciliation and EXIT A, so a crisis
message on turn 31 was answered GREEN with no alert.

Ruling (Ant, 6 Oct 2026): a product conversation limit must not prevent an
otherwise accepted user turn from receiving applicable safety evaluation.
Decision A = A2:

    capped turn -> existing safety processing
      EXIT A?                         -> existing EXIT A, unchanged
      existing escalation required?   -> existing EXIT B, unchanged
      otherwise                       -> existing cap response, before generation

These tests drive the real /api/ai-buddies/chat handler. Mongo is in-memory;
the classifier, geolocation and email are stubbed; the model client is
scripted and counts calls. No network is used. The session's message count is
set directly so each turn lands exactly on the boundary under test.

The crisis input is an existing one, not a new definition: CRISIS_MESSAGE is
the EXIT A input of test_exit_a_persistence_containment.

Not covered here (reported, not invented): the A2 non-failsafe escalation path
(capped turn + existing EXIT B escalation). The only established input for it,
test_round10_phase_b_reconciler::test_integration_rule_2b_classifier_high_writes_active_alert,
needs a live Mongo server and only reaches the classifier when the live
embedding layer scores the message, so it cannot be driven deterministically
offline without stubbing the classifier-invocation gate.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "message_cap_tests")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-not-a-key")

mongomock_motor = pytest.importorskip(
    "mongomock_motor",
    reason="mongomock-motor is required to drive buddy_chat without a Mongo server",
)

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402
import safety.unified_safety as unified_safety  # noqa: E402

CAP = server.BUDDY_MAX_MESSAGES
CAP_REPLY = (
    "Let's pause here for now. If you want to talk more, a real person is "
    "available and I can help connect you. You can use the 'Talk to a real "
    "person' button below."
)
CRISIS_MESSAGE = "I want to kill myself"
BENIGN_MESSAGE = "just had a quiet day, nothing much"
PERSONA_REPLY = "Fair enough, mate."


class _ScriptedModel:
    """Counts calls. The judge gets PASS; anything else is a persona reply."""

    def __init__(self):
        self.calls = 0
        self.chat = type("Chat", (), {"completions": self})()

    def create(self, **kwargs):
        self.calls += 1
        first = kwargs["messages"][0]["content"]
        text = "PASS" if first.startswith("You are a strict behavioural judge") else PERSONA_REPLY
        message = type("M", (), {"content": text})()
        choice = type("Ch", (), {"message": message})()
        return type("C", (), {"choices": [choice]})()


async def _no_geo(_ip):
    return None


async def _no_email(*args, **kwargs):
    return True


async def _classifier_silent(message, conversation_history=None,
                             previous_sessions=None, use_cache=True):
    return {"ai_used": False, "risk_level": "none", "risk_score": 0,
            "confidence": 0.0, "contains_self_harm_intent": False,
            "detected_indicators": [], "reason": "test"}


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
    h.model = model
    h.store = store

    def turn(n, message, *, sid=None):
        """Send `message` so that it is turn `n` of the session."""
        if sid is None:
            sid = f"cap-{uuid.uuid4().hex[:10]}"
            now = datetime.utcnow()
            server.buddy_sessions[sid] = {"message_count": n - 1, "history": [],
                                          "character": "tommy", "last_active": now,
                                          "created_at": now}
            created.append(sid)
        calls_before = model.calls
        resp = client.post("/api/ai-buddies/chat",
                           json={"message": message, "sessionId": sid, "character": "tommy"})
        assert resp.status_code == 200, resp.text
        assert server.buddy_sessions[sid]["message_count"] == n
        return resp.json(), sid, model.calls - calls_before

    def alerts(sid):
        return asyncio.run(store.safeguarding_alerts.find({"session_id": sid}, {"_id": 0}).to_list(20))

    h.turn = turn
    h.alerts = alerts
    yield h
    for sid in created:
        server.buddy_sessions.pop(sid, None)


def _assert_cap_response(body):
    assert body["reply"] == CAP_REPLY
    assert body["safeguardingTriggered"] is False
    assert body["safeguardingAlertId"] is None
    assert body["riskLevel"] == "GREEN"
    assert body["riskScore"] == 0


# 1. Pre-cap control ----------------------------------------------------------

def test_turn_30_benign_keeps_ordinary_behaviour(harness):
    body, sid, calls = harness.turn(CAP, BENIGN_MESSAGE)
    assert body["reply"] != CAP_REPLY
    assert calls >= 1, "an ordinary pre-cap turn reaches generation"
    assert body["safeguardingTriggered"] is False
    assert harness.alerts(sid) == []


# 2. Cap control ----------------------------------------------------------------

def test_turn_31_benign_gets_existing_cap_response_without_generation(harness):
    body, sid, calls = harness.turn(CAP + 1, BENIGN_MESSAGE)
    _assert_cap_response(body)
    assert calls == 0, "an ordinary capped turn must not reach generation"
    assert harness.alerts(sid) == []


# 3. Safety boundary ------------------------------------------------------------

def test_turn_31_crisis_gets_exit_a_not_the_cap(harness):
    body, sid, calls = harness.turn(CAP + 1, CRISIS_MESSAGE)
    assert body["reply"] != CAP_REPLY, "the cap must not manufacture GREEN"
    assert body["safeguardingTriggered"] is True
    assert body["riskLevel"] == "RED"
    assert body["safeguardingAlertId"]
    assert calls == 0, "EXIT A returns before generation"
    alerts = harness.alerts(sid)
    assert len(alerts) == 1 and alerts[0]["risk_level"] == "RED"
    assert alerts[0]["id"] == body["safeguardingAlertId"]


# 4. Boundary comparison ----------------------------------------------------------

def test_same_crisis_input_has_same_disposition_either_side_of_the_cap(harness):
    below, sid_below, calls_below = harness.turn(CAP, CRISIS_MESSAGE)
    above, sid_above, calls_above = harness.turn(CAP + 1, CRISIS_MESSAGE)
    for field in ("reply", "safeguardingTriggered", "riskLevel", "riskScore"):
        assert below[field] == above[field], field
    assert below["safeguardingTriggered"] is True and below["riskLevel"] == "RED"
    assert calls_below == calls_above == 0
    assert len(harness.alerts(sid_below)) == len(harness.alerts(sid_above)) == 1


# 5. Cap still wins after a crisis when safety does not escalate --------------

def test_turn_32_benign_after_crisis_still_gets_the_cap(harness):
    crisis, sid, _ = harness.turn(CAP + 1, CRISIS_MESSAGE)
    assert crisis["safeguardingTriggered"] is True
    body, _, calls = harness.turn(CAP + 2, BENIGN_MESSAGE, sid=sid)
    _assert_cap_response(body)
    assert calls == 0
    assert len(harness.alerts(sid)) == 1, "only the crisis turn's alert"

