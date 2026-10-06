"""EXIT C pre-decision failure: the site-settings read (6 Oct 2026).

Before the fix, `db.settings.find_one({"_id": "site_settings"})` ran inside the
handler-wide try, after normalisation and the legacy scorer but BEFORE
analyze_message_unified, the reconciler and the EXIT A decision. A failure
there fell into EXIT C, which answered 200 with "Lost you for a second
there...", riskLevel GREEN and safeguardingTriggered False: a benign safety
result that had never been established, for a crisis message and an ordinary
one alike.

Ruling (Ant, 6 Oct 2026; design X2, containment D1 / C1b, consequences
accepted): a failure before an authoritative safety decision has been
established must not be represented as though an authoritative benign decision
had been produced. The three settings lines move, unchanged, to just before the
handler-wide try. A read failure now surfaces as the framework's 500, which
carries no safety fields; the chat client's existing catch shows its own
"having trouble connecting" message. No new catch, state or schema.

These tests drive the real /api/ai-buddies/chat handler with the #133/#134
harness pieces (scripted model that counts calls, in-memory Mongo, silent
classifier, stubbed geo and email) and the established EXIT A input. The
settings read is made to fail deterministically. No model calls, no network.
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

import safety.text_normalizer as text_normalizer  # noqa: E402

EXIT_C_PREFIX = "Lost you for a second"
SAFETY_FIELDS = ("riskLevel", "riskScore", "safeguardingTriggered", "safeguardingAlertId")


class _FailingSettings:
    def __init__(self, inner):
        self._inner = inner

    def __getattr__(self, name):
        return getattr(self._inner, name)

    async def find_one(self, *args, **kwargs):
        raise RuntimeError("injected: settings.find_one")


class _DBWithFailingSettings:
    def __init__(self, inner):
        self._inner = inner
        self.settings = _FailingSettings(inner.settings)

    def __getattr__(self, name):
        return getattr(self._inner, name)

    def __getitem__(self, name):
        if name == "settings":
            return self.settings
        return self._inner[name]


@pytest.fixture
def harness(monkeypatch):
    store = mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"] + uuid.uuid4().hex[:6]]
    model = _ScriptedModel()
    calls = {"normaliser": 0, "legacy_scorer": 0, "unified": 0}

    real_normalise = text_normalizer.normalise_text
    real_check = server.check_safeguarding
    real_unified = server.analyze_message_unified

    async def spy_normalise(*a, **k):
        calls["normaliser"] += 1
        return await real_normalise(*a, **k)

    def spy_check(*a, **k):
        calls["legacy_scorer"] += 1
        return real_check(*a, **k)

    def spy_unified(*a, **k):
        calls["unified"] += 1
        return real_unified(*a, **k)

    monkeypatch.setattr(text_normalizer, "normalise_text", spy_normalise)
    monkeypatch.setattr(server, "check_safeguarding", spy_check)
    monkeypatch.setattr(server, "analyze_message_unified", spy_unified)
    monkeypatch.setattr(server, "buddy_openai_client", model)
    monkeypatch.setattr(server, "gemini_client", None)
    monkeypatch.setattr(unified_safety, "classify_message_with_ai", _classifier_silent)
    monkeypatch.setattr(server, "lookup_ip_geolocation", _no_geo)
    monkeypatch.setattr(server, "send_safeguarding_email_notification", _no_email)
    # raise_server_exceptions=False: observe the framework's real 500 response.
    client = TestClient(server.app, raise_server_exceptions=False)
    created = []

    class H:
        pass

    h = H()
    h.store, h.calls, h.model = store, calls, model

    def send(message, *, fail_settings=False, settings_doc=None):
        if settings_doc is not None:
            asyncio.run(store.settings.insert_one(dict(settings_doc, _id="site_settings")))
        monkeypatch.setattr(server, "db", _DBWithFailingSettings(store) if fail_settings else store)
        sid = f"xc-{uuid.uuid4().hex[:10]}"
        now = datetime.utcnow()
        server.buddy_sessions[sid] = {"message_count": 0, "history": [], "character": "tommy",
                                      "last_active": now, "created_at": now}
        created.append(sid)
        server.ip_request_counts.clear()
        server.blocked_ips.clear()
        for k in calls:
            calls[k] = 0
        calls_before = model.calls
        resp = client.post("/api/ai-buddies/chat",
                           json={"message": message, "sessionId": sid, "character": "tommy"})
        return resp, sid, model.calls - calls_before

    def alerts(sid):
        return asyncio.run(store.safeguarding_alerts.find({"session_id": sid}, {"_id": 0}).to_list(20))

    h.send, h.alerts = send, alerts
    yield h
    for sid in created:
        server.buddy_sessions.pop(sid, None)
        server.session_message_counts.pop(sid, None)


def _assert_failure_representation(resp):
    """Framework 500: no BuddyChatResponse, no safety fields, not EXIT C."""
    assert resp.status_code == 500
    assert resp.headers["content-type"].startswith("text/plain")
    assert resp.text == "Internal Server Error"
    assert EXIT_C_PREFIX not in resp.text
    for field in SAFETY_FIELDS:
        assert field not in resp.text


# R1 -- normal crisis unchanged ------------------------------------------------

def test_r1_crisis_with_settings_read_ok_keeps_exit_a(harness):
    resp, sid, calls = harness.send(CRISIS_MESSAGE)
    assert resp.status_code == 200
    body = resp.json()
    assert not body["reply"].startswith(EXIT_C_PREFIX)
    assert body["safeguardingTriggered"] is True
    assert body["riskLevel"] == "RED"
    assert calls == 0
    alerts = harness.alerts(sid)
    assert len(alerts) == 1 and alerts[0]["status"] == "active"
    assert alerts[0]["id"] == body["safeguardingAlertId"]


# R2 -- crisis + settings failure -----------------------------------------------

def test_r2_crisis_with_settings_read_failure_is_not_reported_as_green(harness):
    resp, sid, calls = harness.send(CRISIS_MESSAGE, fail_settings=True)
    _assert_failure_representation(resp)
    assert harness.alerts(sid) == []
    assert calls == 0
    assert server.buddy_sessions[sid]["message_count"] == 0


# R3 -- benign + identical failure: same representation ------------------------

def test_r3_benign_with_settings_read_failure_is_identical_to_crisis(harness):
    crisis, sid_c, _ = harness.send(CRISIS_MESSAGE, fail_settings=True)
    benign, sid_b, calls = harness.send(BENIGN_MESSAGE, fail_settings=True)
    _assert_failure_representation(benign)
    assert benign.status_code == crisis.status_code
    assert benign.headers["content-type"] == crisis.headers["content-type"]
    assert benign.content == crisis.content
    assert harness.alerts(sid_b) == [] and harness.alerts(sid_c) == []
    assert calls == 0


# R4 -- ordering guard: evaluation did not occur --------------------------------

@pytest.mark.parametrize("message", [CRISIS_MESSAGE, BENIGN_MESSAGE])
def test_r4_settings_read_failure_stops_before_any_evaluation(harness, message):
    resp, _, _ = harness.send(message, fail_settings=True)
    assert resp.status_code == 500
    assert harness.calls == {"normaliser": 0, "legacy_scorer": 0, "unified": 0}


def test_r4_control_spies_fire_when_settings_read_succeeds(harness):
    resp, _, _ = harness.send(CRISIS_MESSAGE)
    assert resp.status_code == 200
    assert harness.calls["normaliser"] == 1
    assert harness.calls["legacy_scorer"] == 1
    assert harness.calls["unified"] == 1


# Differential: the moved settings still drive the same behaviour ---------------

def test_signpost_settings_still_apply_on_successful_read(harness):
    resp, sid, _ = harness.send(CRISIS_MESSAGE, settings_doc={
        "safeguarding_response_mode": "signpost",
        "counsellor_enabled": False,
        "peer_to_peer_enabled": False,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["safeguardingTriggered"] is True and body["riskLevel"] == "RED"
    # human_support_available False -> external-only crisis wording
    assert "Veterans Gateway" in body["reply"]
    assert "Connect with Counsellors" not in body["reply"]
    # signpost_mode -> alert recorded audit_only, kept off the staff queue
    alerts = harness.alerts(sid)
    assert len(alerts) == 1 and alerts[0]["status"] == "audit_only"
