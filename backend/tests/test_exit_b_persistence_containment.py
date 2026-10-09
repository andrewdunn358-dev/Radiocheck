"""N3: EXIT B alert/audit persistence failures must not replace an established
safeguarding disposition with EXIT C's GREEN/0 fallback.

Ant, 9 Oct 2026 (authorised after R2 merged at a55c1ce). Evidence:
claude/n3-exit-b-persistence-evidence-2026-10-09.md.

Before: on an escalated EXIT B turn, `insert_one` on safeguarding_alerts and
the `audit_safeguarding_alert` call had no local guard. A failure went to the
handler-wide except (EXIT C), which returned "Lost you for a second there"
with GREEN / 0 / safeguardingTriggered False. No alert and no staff email,
the generated reply was discarded, history held a reply the user never saw,
and provenance recorded ERROR.

Authorised containment (EXIT B alert block only):
  1. alert insert failure contained locally;
  2. audit-call exception contained independently;
  3. provenance alert_created = actual successful persistence;
  4. established response, risk fields and the staff email attempt preserved.

Not changed: detection, classification, wording, model calls, N2 (the alert id
is still returned as before), EXIT C itself.

Routes (deterministic, no model calls beyond the scripted persona/judge):
  B1  legacy RED, no failsafe -> AMBER audit_only     "I'm going to end it tonight"
  B2  classifier HIGH -> Rule 2b staff review, active  "can't take it anymore"
  B3  B2 in signpost mode -> audit_only
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
    _ScriptedModel,
    _classifier_silent,
    _no_geo,
    mongomock_motor,
    server,
    unified_safety,
)
from test_exit_a_persistence_containment import _DBWithFailingAlertInsert  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import safety.provenance as provenance  # noqa: E402
import safety.semantic_model as semantic_model  # noqa: E402

LOST_YOU = "Lost you for a second there"
B1 = "I'm going to end it tonight"
B2 = "can't take it anymore"
EXIT_A_MSG = "I want to kill myself"
BENIGN = "just had a quiet day, nothing much"


async def _classifier_high(message, conversation_history=None, previous_sessions=None, use_cache=True):
    return {"ai_used": True, "risk_level": "high", "risk_score": 75, "confidence": 0.9,
            "contains_self_harm_intent": True, "detected_indicators": ["test"], "reason": "test-high"}


class _FailingAuditCollection:
    def __init__(self, inner):
        self._inner = inner

    def __getattr__(self, name):
        return getattr(self._inner, name)

    async def insert_one(self, *args, **kwargs):
        raise RuntimeError("injected: audit_logs.insert_one")


class _DBWithFailingAuditCollection:
    def __init__(self, inner):
        self._inner = inner
        self.audit_logs = _FailingAuditCollection(inner.audit_logs)

    def __getattr__(self, name):
        return getattr(self._inner, name)

    def __getitem__(self, name):
        return self.audit_logs if name == "audit_logs" else self._inner[name]


@pytest.fixture
def turn(monkeypatch):
    emails = []
    records = []

    async def _count_email(*args, **kwargs):
        emails.append(1)
        return True

    async def _audit_raises(*args, **kwargs):
        raise RuntimeError("injected: audit_safeguarding_alert")

    provenance.set_sink(records.append)
    monkeypatch.setattr(server, "gemini_client", None)
    monkeypatch.setattr(semantic_model, "compute_embedding", lambda *a, **k: None)
    monkeypatch.setattr(server, "lookup_ip_geolocation", _no_geo)
    monkeypatch.setattr(server, "send_safeguarding_email_notification", _count_email)
    real_audit = server.audit_safeguarding_alert
    client = TestClient(server.app, raise_server_exceptions=False)
    created = []

    def send(message, *, classifier="silent", fail=(), signpost=False):
        model = _ScriptedModel()
        monkeypatch.setattr(server, "buddy_openai_client", model)
        monkeypatch.setattr(unified_safety, "classify_message_with_ai",
                            _classifier_high if classifier == "high" else _classifier_silent)
        store = mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"] + uuid.uuid4().hex[:6]]
        if signpost:
            asyncio.run(store.settings.insert_one(
                {"_id": "site_settings", "safeguarding_response_mode": "signpost"}))
        db = store
        if "alert_insert" in fail:
            db = _DBWithFailingAlertInsert(db)
        if "audit_collection" in fail:
            db = _DBWithFailingAuditCollection(db)
        monkeypatch.setattr(server, "db", db)
        monkeypatch.setattr(server, "audit_safeguarding_alert",
                            _audit_raises if "audit_call" in fail else real_audit)
        sid = f"n3-{uuid.uuid4().hex[:10]}"
        now = datetime.utcnow()
        server.buddy_sessions[sid] = {"message_count": 0, "history": [], "character": "tommy",
                                      "last_active": now, "created_at": now}
        created.append(sid)
        server.ip_request_counts.clear()
        server.blocked_ips.clear()
        server.session_risk_history.pop(sid, None)
        emails.clear()
        before = len(records)
        resp = client.post("/api/ai-buddies/chat",
                           json={"message": message, "sessionId": sid, "character": "tommy"})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        alerts = asyncio.run(store.safeguarding_alerts.find({"session_id": sid}, {"_id": 0}).to_list(20))
        audits = asyncio.run(store.audit_logs.find({"context.session_id": sid}, {"_id": 0}).to_list(20))
        recs = records[before:]
        return {
            "reply": body["reply"],
            "triggered": body["safeguardingTriggered"],
            "risk": body["riskLevel"],
            "score": body["riskScore"],
            "alerts": sorted((a["risk_level"], a["status"]) for a in alerts),
            "audit_rows": len(audits),
            "emails": len(emails),
            "history": list(server.buddy_sessions[sid].get("history", [])),
            "records": recs,
            "model_calls": model.calls,
        }

    yield send
    provenance.reset_sink()
    for sid in created:
        server.buddy_sessions.pop(sid, None)
        server.session_risk_history.pop(sid, None)


def _wire(r):
    return (r["reply"], r["triggered"], r["risk"], r["score"])


def _outcome(r):
    assert len(r["records"]) == 1, "exactly one provenance record"
    return r["records"][0]["outcome"]


ROUTES = [
    pytest.param(dict(message=B1), ("AMBER", "audit_only"), id="B1_legacy_audit_only"),
    pytest.param(dict(message=B2, classifier="high"), ("AMBER", "active"), id="B2_rule2b_staff_review"),
    pytest.param(dict(message=B2, classifier="high", signpost=True), ("AMBER", "audit_only"), id="B3_signpost"),
]


# 1. Healthy paths ------------------------------------------------------------

@pytest.mark.parametrize("route,alert", ROUTES)
def test_healthy_escalated_exit_b(turn, route, alert):
    r = turn(**route)
    assert not r["reply"].startswith(LOST_YOU)
    assert r["risk"] == "AMBER" and r["triggered"] is False
    assert r["alerts"] == [alert]
    assert r["audit_rows"] == 1 and r["emails"] == 1
    out = _outcome(r)
    assert out["risk_level"] == "AMBER" and out["should_escalate"] is True
    assert out["alert_created"] is True and not out.get("error")


# 2. Alert insertion failure ----------------------------------------------------

@pytest.mark.parametrize("route,alert", ROUTES)
def test_alert_insert_failure_preserves_established_disposition(turn, route, alert):
    healthy = turn(**route)
    r = turn(**route, fail=("alert_insert",))
    assert _wire(r) == _wire(healthy), "response identical to the healthy path"
    assert not r["reply"].startswith(LOST_YOU)
    assert r["alerts"] == []                  # not stored, as designed
    assert r["emails"] == 1                   # staff email still attempted
    assert r["audit_rows"] == 1               # audit unaffected
    out = _outcome(r)
    assert out["risk_level"] == "AMBER" and out["should_escalate"] is True
    assert out["alert_created"] is False      # actual persistence, not id existence
    assert not out.get("error")


# 3. Audit failures ------------------------------------------------------------

@pytest.mark.parametrize("route,alert", ROUTES)
def test_audit_call_failure_is_contained(turn, route, alert):
    healthy = turn(**route)
    r = turn(**route, fail=("audit_call",))
    assert _wire(r) == _wire(healthy)
    assert r["alerts"] == [alert] and r["emails"] == 1 and r["audit_rows"] == 0
    assert _outcome(r)["alert_created"] is True


def test_audit_database_failure_stays_contained(turn):
    """Already contained inside log_audit_event before N3; unchanged."""
    healthy = turn(B1)
    r = turn(B1, fail=("audit_collection",))
    assert _wire(r) == _wire(healthy)
    assert r["alerts"] == [("AMBER", "audit_only")] and r["emails"] == 1 and r["audit_rows"] == 0


# 4. Combined failures ---------------------------------------------------------

@pytest.mark.parametrize("route,alert", ROUTES)
def test_alert_and_audit_failures_together(turn, route, alert):
    healthy = turn(**route)
    r = turn(**route, fail=("alert_insert", "audit_call"))
    assert _wire(r) == _wire(healthy)
    assert r["alerts"] == [] and r["audit_rows"] == 0
    assert r["emails"] == 1
    out = _outcome(r)
    assert out["risk_level"] == "AMBER" and out["alert_created"] is False and not out.get("error")


# 5. History consistency -------------------------------------------------------

@pytest.mark.parametrize("fail", [("alert_insert",), ("audit_call",), ("alert_insert", "audit_call")])
def test_history_matches_the_reply_the_user_received(turn, fail):
    r = turn(B2, classifier="high", fail=fail)
    assert r["history"][-1] == {"role": "assistant", "content": r["reply"]}
    assert r["history"][-2] == {"role": "user", "content": B2}
    assert not r["reply"].startswith(LOST_YOU)


# 6. EXIT A parity (#127 / #136 unchanged) ---------------------------------------

def test_exit_a_insert_failure_unchanged(turn):
    healthy = turn(EXIT_A_MSG)
    r = turn(EXIT_A_MSG, fail=("alert_insert",))
    assert _wire(r) == _wire(healthy)
    assert r["triggered"] is True and r["risk"] == "RED"
    assert r["alerts"] == [] and r["emails"] == 1 and r["model_calls"] == 0
    assert _outcome(r)["alert_created"] is False


# 7. Benign controls -------------------------------------------------------------

@pytest.mark.parametrize("fail", [(), ("alert_insert",), ("audit_call",), ("alert_insert", "audit_call")])
def test_benign_turn_unaffected(turn, fail):
    r = turn(BENIGN, fail=fail)
    assert not r["reply"].startswith(LOST_YOU)
    assert (r["triggered"], r["risk"], r["score"]) == (False, "GREEN", 0)
    assert r["alerts"] == [] and r["emails"] == 0 and r["audit_rows"] == 0
    assert _outcome(r)["alert_created"] is False
