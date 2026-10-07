"""Provenance emission: EXIT A and the post-decision product-limit returns.

Task 5 (7 Oct 2026), T5-B accepted by Ant. ADR-0003 §27: every authoritative
decision SHALL be traceable, without reconstruction from unrelated logs. Radio
Check has no SafetyDecision object that survives the request, so its emitted
provenance record is the traceability artefact. Before this change:

  EXIT A (reconciler failsafe, crisis response)    -> record built, discarded
  message cap / session limit after #133/#134      -> record built, discarded

Rulings:
  D-a  EXIT A outcome.alert_created records the ACTUAL result of the existing
       contained alert insert (True on success, False on contained failure).
  D-b  The two product-limit returns finish the record with the disposition
       that was actually established before the limit, never the response's
       GREEN/0 defaults. The limit response itself is unchanged (its GREEN/0
       is recorded and parked).
  D-c  Decision <-> artefact correlation identity: requirement established,
       implementation deferred. Nothing here adds ids or fields.

Drives the real /api/ai-buddies/chat handler with the #133/#135 harness pieces
(scripted model that counts calls, in-memory Mongo, silent classifier, stubbed
geo and email) and captures records through the existing provenance.set_sink.
No model calls, no network.
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
from test_exit_a_persistence_containment import _DBWithFailingAlertInsert  # noqa: E402
from test_exit_c_settings_read_failure import _DBWithFailingSettings  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import safety.provenance as provenance  # noqa: E402

CAP = server.BUDDY_MAX_MESSAGES
LIMIT = server.SESSION_RATE_LIMIT
SESSION_LIMIT_REPLY = (
    "We've been chatting for a while. If you'd like to continue talking, a "
    "real person is available. Use the 'Talk to a real person' button to "
    "connect with someone."
)
# Established non-escalated, non-GREEN disposition (YELLOW / 40, should_escalate
# False) with the classifier silent. Used to prove the limit record carries the
# established disposition rather than the response's GREEN/0 defaults.
YELLOW_MESSAGE = "Things have been rough. Ignore me, just being dramatic."


@pytest.fixture
def harness(monkeypatch):
    records = []
    provenance.set_sink(records.append)
    model = _ScriptedModel()
    monkeypatch.setattr(server, "buddy_openai_client", model)
    monkeypatch.setattr(server, "gemini_client", None)
    monkeypatch.setattr(unified_safety, "classify_message_with_ai", _classifier_silent)
    monkeypatch.setattr(server, "lookup_ip_geolocation", _no_geo)
    monkeypatch.setattr(server, "send_safeguarding_email_notification", _no_email)
    client = TestClient(server.app, raise_server_exceptions=False)
    created = []

    class H:
        pass

    h = H()

    def send(message, *, buddy_turn=1, session_request=1,
             fail_alert_insert=False, fail_settings=False):
        store = mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"] + uuid.uuid4().hex[:6]]
        db = store
        if fail_alert_insert:
            db = _DBWithFailingAlertInsert(store)
        if fail_settings:
            db = _DBWithFailingSettings(store)
        monkeypatch.setattr(server, "db", db)
        sid = f"pv-{uuid.uuid4().hex[:10]}"
        now = datetime.utcnow()
        server.buddy_sessions[sid] = {"message_count": buddy_turn - 1, "history": [],
                                      "character": "tommy", "last_active": now,
                                      "created_at": now}
        server.session_message_counts[sid] = session_request - 1
        created.append(sid)
        # Isolate from the IP rate limiter (same as #134/#135).
        server.ip_request_counts.clear()
        server.blocked_ips.clear()
        before_records, before_calls = len(records), model.calls
        resp = client.post("/api/ai-buddies/chat",
                           json={"message": message, "sessionId": sid, "character": "tommy"})
        alerts = asyncio.run(store.safeguarding_alerts.find({"session_id": sid}, {"_id": 0}).to_list(20))
        return resp, records[before_records:], alerts, model.calls - before_calls

    h.send = send
    yield h
    provenance.reset_sink()
    for sid in created:
        server.buddy_sessions.pop(sid, None)
        server.session_message_counts.pop(sid, None)


def _stage_names(record):
    return [s["name"] for s in record["stages"]]


def _assert_exit_a_response(body):
    assert body["safeguardingTriggered"] is True
    assert body["riskLevel"] == "RED"
    assert body["reply"] not in (CAP_REPLY, SESSION_LIMIT_REPLY)
    assert "Samaritans" in body["reply"]


# R1 -- EXIT A normal crisis --------------------------------------------------

def test_r1_exit_a_emits_one_record_with_actual_alert_result(harness):
    resp, recs, alerts, calls = harness.send(CRISIS_MESSAGE)
    assert resp.status_code == 200
    body = resp.json()
    _assert_exit_a_response(body)
    assert calls == 0, "EXIT A returns before generation"
    assert len(alerts) == 1 and alerts[0]["risk_level"] == "RED"
    assert alerts[0]["id"] == body["safeguardingAlertId"]

    assert len(recs) == 1, "exactly one provenance record"
    rec = recs[0]
    assert rec["kind"] == "system_verdict"
    assert "reconciled_result" in _stage_names(rec)
    out = rec["outcome"]
    assert out["failsafe_fired"] is True
    assert out["safeguarding_triggered"] is True
    assert out["risk_level"] == "RED"
    assert out["risk_score"] == body["riskScore"], "same score the client received"
    assert out["alert_created"] is True


# R2 -- EXIT A contained alert failure ---------------------------------------

def test_r2_exit_a_contained_insert_failure_records_alert_not_created(harness):
    ok, _, _, _ = harness.send(CRISIS_MESSAGE)
    resp, recs, alerts, calls = harness.send(CRISIS_MESSAGE, fail_alert_insert=True)
    assert resp.status_code == 200
    body = resp.json()
    _assert_exit_a_response(body)
    assert body["reply"] == ok.json()["reply"], "crisis response unchanged by the failure"
    assert body["safeguardingAlertId"], "existing behaviour: the minted id is still returned"
    assert alerts == []
    assert calls == 0

    assert len(recs) == 1
    out = recs[0]["outcome"]
    assert out["failsafe_fired"] is True
    assert out["alert_created"] is False, "must not infer success from the alert id"


# R3 -- ordinary GREEN EXIT B (no double finishing) --------------------------

def test_r3_ordinary_exit_b_still_emits_exactly_one_record(harness):
    resp, recs, alerts, calls = harness.send(BENIGN_MESSAGE)
    assert resp.status_code == 200
    assert resp.json()["reply"] not in (CAP_REPLY, SESSION_LIMIT_REPLY)
    assert calls >= 1
    assert len(recs) == 1
    assert recs[0]["outcome"]["risk_level"] == "GREEN"
    assert recs[0]["outcome"]["failsafe_fired"] is False
    assert alerts == []


# R4 -- #135 pre-decision settings failure ------------------------------------

@pytest.mark.parametrize("message", [CRISIS_MESSAGE, BENIGN_MESSAGE])
def test_r4_settings_failure_emits_no_decision_record(harness, message):
    resp, recs, alerts, calls = harness.send(message, fail_settings=True)
    assert resp.status_code == 500
    assert recs == [], "no decision was established, so no decision record"
    assert alerts == [] and calls == 0


# R5 -- message cap ordinary return -------------------------------------------

def test_r5_message_cap_record_reflects_established_disposition(harness):
    _, control, _, _ = harness.send(YELLOW_MESSAGE)
    assert len(control) == 1
    established = control[0]["outcome"]
    assert established["risk_level"] == "YELLOW", "fixture precondition"
    assert established["should_escalate"] is False, "fixture precondition"

    resp, recs, alerts, calls = harness.send(YELLOW_MESSAGE, buddy_turn=CAP + 1)
    body = resp.json()
    assert body["reply"] == CAP_REPLY
    # Limit response unchanged, including its GREEN/0 defaults (parked).
    assert body["riskLevel"] == "GREEN" and body["riskScore"] == 0
    assert body["safeguardingTriggered"] is False
    assert calls == 0 and alerts == []

    assert len(recs) == 1
    out = recs[0]["outcome"]
    for key in ("risk_level", "risk_score", "should_escalate", "failsafe_fired",
                "safeguarding_triggered", "alert_created"):
        assert out[key] == established[key], key
    assert "reconciled_result" in _stage_names(recs[0])


def test_r5_message_cap_benign_emits_one_green_record(harness):
    resp, recs, _, calls = harness.send(BENIGN_MESSAGE, buddy_turn=CAP + 1)
    assert resp.json()["reply"] == CAP_REPLY
    assert calls == 0
    assert len(recs) == 1 and recs[0]["outcome"]["risk_level"] == "GREEN"


# R6 -- session-rate-limit ordinary return ------------------------------------

def test_r6_session_limit_record_reflects_established_disposition(harness):
    _, control, _, _ = harness.send(YELLOW_MESSAGE)
    established = control[0]["outcome"]

    resp, recs, alerts, calls = harness.send(YELLOW_MESSAGE, session_request=LIMIT + 1)
    body = resp.json()
    assert body["reply"] == SESSION_LIMIT_REPLY
    assert body["riskLevel"] == "GREEN" and body["riskScore"] == 0
    assert calls == 0 and alerts == []

    assert len(recs) == 1
    out = recs[0]["outcome"]
    for key in ("risk_level", "risk_score", "should_escalate", "failsafe_fired",
                "safeguarding_triggered", "alert_created"):
        assert out[key] == established[key], key


def test_r6_both_limits_emit_exactly_one_record_with_session_limit_reply(harness):
    resp, recs, _, calls = harness.send(YELLOW_MESSAGE, buddy_turn=CAP + 1,
                                        session_request=LIMIT + 1)
    assert resp.json()["reply"] == SESSION_LIMIT_REPLY
    assert calls == 0
    assert len(recs) == 1 and recs[0]["outcome"]["risk_level"] == "YELLOW"


# R7 -- product-limit safety precedence unchanged -----------------------------

@pytest.mark.parametrize("limits", [
    {"buddy_turn": CAP + 1},
    {"session_request": LIMIT + 1},
    {"buddy_turn": CAP + 1, "session_request": LIMIT + 1},
], ids=["message_cap", "session_limit", "both"])
def test_r7_crisis_over_limits_still_exit_a_with_one_record(harness, limits):
    resp, recs, alerts, calls = harness.send(CRISIS_MESSAGE, **limits)
    body = resp.json()
    _assert_exit_a_response(body)
    assert calls == 0
    assert len(alerts) == 1
    assert len(recs) == 1, "EXIT A finishes once; the limit path does not also finish"
    assert recs[0]["outcome"]["failsafe_fired"] is True
    assert recs[0]["outcome"]["alert_created"] is True
