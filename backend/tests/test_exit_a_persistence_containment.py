"""EXIT A persistence containment (N3 / N5).

Once the failsafe has selected the crisis response, failure to persist the
safeguarding alert (N3) or the audit record (N5) must not replace that response
with the generic EXIT C reply ("Lost you for a second...", GREEN, score 0,
safeguardingTriggered False).

Reproduced on main 919425c5 before the fix (docs/evidence overnight study, N3/N5):
  alert insert raises  -> EXIT C, nothing persisted
  audit write raises   -> EXIT C, although the RED alert was already persisted

Contract (Ant, 26 Sept): Decision / Action Separation; Failure Must Not Become
Permission; Authoritative Decision Immutability. Persistence failure is logged
and contained at its own boundary. The already-authorised response is returned
unchanged. Email behaviour is a control, not a target.

These tests drive the real /api/ai-buddies/chat handler. Mongo is in-memory,
failures are injected deterministically, and the classifier, geolocation and
email are stubbed. No model call is made (the failsafe returns before
generation) and no network is used.
"""
import os
import sys
import uuid

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "exit_a_containment_tests")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-not-a-key")

mongomock_motor = pytest.importorskip(
    "mongomock_motor",
    reason="mongomock-motor is required to drive buddy_chat without a Mongo server",
)

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402
import safety.unified_safety as unified_safety  # noqa: E402

# Explicit current-turn intent: keyword monitor critical -> reconciler failsafe
# -> EXIT A, independent of any model layer.
CRISIS_MESSAGE = "I want to kill myself"
EXIT_C_REPLY_PREFIX = "Lost you for a second"


class _NoModelCalls:
    """The failsafe returns before generation, so any model call is a failure."""

    def __init__(self):
        self.calls = 0
        self.chat = type("Chat", (), {"completions": self})()

    def create(self, **kwargs):
        self.calls += 1
        raise AssertionError("EXIT A must not make a model call")


class _FailingInsertCollection:
    def __init__(self, inner):
        self._inner = inner

    def __getattr__(self, name):
        return getattr(self._inner, name)

    async def insert_one(self, *args, **kwargs):
        raise RuntimeError("injected: safeguarding_alerts.insert_one")


class _DBWithFailingAlertInsert:
    def __init__(self, inner):
        self._inner = inner
        self.safeguarding_alerts = _FailingInsertCollection(inner.safeguarding_alerts)

    def __getattr__(self, name):
        return getattr(self._inner, name)

    def __getitem__(self, name):
        if name == "safeguarding_alerts":
            return self.safeguarding_alerts
        return self._inner[name]


async def _no_geo(_ip):
    return None


async def _classifier_silent(message, conversation_history=None,
                             previous_sessions=None, use_cache=True):
    return {"ai_used": False, "risk_level": "none", "risk_score": 0,
            "confidence": 0.0, "contains_self_harm_intent": False,
            "detected_indicators": [], "reason": "test"}


@pytest.fixture
def crisis_turn(monkeypatch):
    """Drive one crisis turn. Returns (body, stored_db, emails_sent, model)."""
    def _drive(*, fail_alert_insert=False, fail_audit=False, fail_email=False):
        store = mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"] + uuid.uuid4().hex[:6]]
        db = _DBWithFailingAlertInsert(store) if fail_alert_insert else store
        model = _NoModelCalls()
        emails = []

        async def _email(alert, risk_data=None):
            emails.append(alert.id)
            if fail_email:
                raise RuntimeError("injected: email")
            return True

        monkeypatch.setattr(server, "buddy_openai_client", model)
        monkeypatch.setattr(server, "gemini_client", None)
        monkeypatch.setattr(server, "db", db)
        monkeypatch.setattr(unified_safety, "classify_message_with_ai", _classifier_silent)
        monkeypatch.setattr(server, "lookup_ip_geolocation", _no_geo)
        monkeypatch.setattr(server, "send_safeguarding_email_notification", _email)
        if fail_audit:
            async def _audit_raises(*args, **kwargs):
                raise RuntimeError("injected: audit_safeguarding_alert")
            monkeypatch.setattr(server, "audit_safeguarding_alert", _audit_raises)

        response = TestClient(server.app).post(
            "/api/ai-buddies/chat",
            json={"message": CRISIS_MESSAGE, "sessionId": f"exa-{uuid.uuid4().hex[:10]}",
                  "character": "tommy"},
        )
        assert response.status_code == 200, response.text
        return response.json(), store, emails, model

    return _drive


def _alerts(store):
    import asyncio
    return asyncio.run(store.safeguarding_alerts.find({}, {"_id": 0}).to_list(10))


def _audits(store):
    import asyncio
    return asyncio.run(store.audit_logs.find({}, {"_id": 0}).to_list(10))


def _assert_authorised_crisis_response(body, healthy):
    """The already-selected EXIT A response, unchanged in every user-facing field."""
    assert not body["reply"].startswith(EXIT_C_REPLY_PREFIX), body["reply"]
    assert body["reply"] == healthy["reply"], "crisis wording must be unchanged"
    assert body["safeguardingTriggered"] is True
    assert body["riskLevel"] == "RED"
    assert body["riskScore"] == healthy["riskScore"]
    assert body["riskScore"] != 0


# --- Control A: healthy EXIT A ----------------------------------------------

def test_control_a_healthy_exit_a_delivers_crisis_response_and_persists(crisis_turn):
    body, store, emails, model = crisis_turn()

    assert body["safeguardingTriggered"] is True
    assert body["riskLevel"] == "RED"
    assert "Samaritans" in body["reply"] and "999" in body["reply"]
    assert not body["reply"].startswith(EXIT_C_REPLY_PREFIX)
    alerts = _alerts(store)
    assert [(a["risk_level"], a["status"]) for a in alerts] == [("RED", "active")]
    assert body["safeguardingAlertId"] == alerts[0]["id"]
    assert [a.get("event_type") for a in _audits(store)] == ["safeguarding.alert"]
    assert len(emails) == 1
    assert model.calls == 0


# --- Regression B: N3, alert insert fails ------------------------------------

def test_n3_alert_insert_failure_does_not_replace_the_crisis_response(crisis_turn):
    healthy, *_ = crisis_turn()
    body, store, emails, model = crisis_turn(fail_alert_insert=True)

    _assert_authorised_crisis_response(body, healthy)
    assert _alerts(store) == []          # the operational failure is real, not masked
    assert model.calls == 0


# --- Regression C: N5, audit fails after the alert persisted ------------------

def test_n5_audit_failure_does_not_replace_the_crisis_response(crisis_turn):
    healthy, *_ = crisis_turn()
    body, store, emails, model = crisis_turn(fail_audit=True)

    _assert_authorised_crisis_response(body, healthy)
    alerts = _alerts(store)
    assert [(a["risk_level"], a["status"]) for a in alerts] == [("RED", "active")], \
        "an alert that already persisted must be retained"
    assert body["safeguardingAlertId"] == alerts[0]["id"]
    assert _audits(store) == []
    assert model.calls == 0


def test_n3_and_n5_together_still_deliver_the_crisis_response(crisis_turn):
    healthy, *_ = crisis_turn()
    body, store, _, model = crisis_turn(fail_alert_insert=True, fail_audit=True)

    _assert_authorised_crisis_response(body, healthy)
    assert _alerts(store) == []
    assert model.calls == 0


# --- Control D: email failure, existing contained behaviour unchanged ---------

def test_control_d_email_failure_remains_contained(crisis_turn):
    healthy, *_ = crisis_turn()
    body, store, emails, model = crisis_turn(fail_email=True)

    _assert_authorised_crisis_response(body, healthy)
    assert len(emails) == 1
    assert [(a["risk_level"], a["status"]) for a in _alerts(store)] == [("RED", "active")]
    assert [a.get("event_type") for a in _audits(store)] == ["safeguarding.alert"]


def test_email_is_still_attempted_when_alert_and_audit_persistence_fail(crisis_turn):
    """Containment must not skip the staff notification that follows."""
    _, _, emails, _ = crisis_turn(fail_alert_insert=True, fail_audit=True)
    assert len(emails) == 1
