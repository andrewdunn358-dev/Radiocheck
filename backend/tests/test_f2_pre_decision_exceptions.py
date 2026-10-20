"""F2: pre-decision exceptions must not produce false GREEN outcomes.

Ant, 20 Oct 2026, Stage 3 bounded repair authorisation (PD-1..PD-8) and the
contract rulings C1..C6 of the same day. Evidence:
claude/finding2-pre-decision-exceptions-evidence-2026-10-14.md.

Before (main 315eff9): an exception in check_safeguarding,
analyze_message_unified, extract_verdicts_from_unified or reconcile_verdicts
(including the reconciler's audit-log write) reached EXIT C: "Lost you for a
second there", GREEN/0, no alert, no email - 56 of 56 injected rows.

All failures here are DETERMINISTIC FAULT INJECTION. Nothing here claims how
often these paths occur in production.

Drives the real /api/ai-buddies/chat handler in-process (the #133/#136/#140
harness): mongomock, scripted persona/judge model, classifier stubbed,
geolocation stubbed, staff email captured. No network.
"""
import asyncio
import json
import logging
import os
import sys
import uuid
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from test_message_cap_safety_precedence import (  # noqa: E402  (#133 harness)
    _ScriptedModel,
    _classifier_silent,
    _no_geo,
    mongomock_motor,
    server,
    unified_safety,
)
from fastapi.testclient import TestClient  # noqa: E402

import safety.provenance as provenance  # noqa: E402
import safety.semantic_model as semantic_model  # noqa: E402
import safety.verdict_reconciler as reconciler  # noqa: E402

LOST_YOU = "Lost you for a second there"
HOLDING = server.F2_HOLDING_RESPONSE

# Messages (same set as the 14 Oct evidence, plus S009)
A = "I want to kill myself"                      # EXIT A, keyword failsafe
B1 = "I'm going to end it tonight"               # EXIT B, legacy RED -> AMBER audit_only
B2 = "can't take it anymore"                     # + classifier HIGH: Rule 2b, active
G = "just had a quiet day, nothing much"         # benign
N = "I'm not going to kill myself, I promise"    # negated
E3 = "I won't be around after tonight"           # failsafe removed by negation guard
S009 = "my best mate died of an overdose last year. still cuts me up."


async def _classifier_high(message, conversation_history=None, previous_sessions=None, use_cache=True):
    return {"ai_used": True, "risk_level": "high", "risk_score": 75, "confidence": 0.9,
            "contains_self_harm_intent": True, "detected_indicators": ["test"], "reason": "test-high"}


async def _classifier_bereaved(message, conversation_history=None, previous_sessions=None, use_cache=True):
    return {"ai_used": True, "risk_level": "low", "risk_score": 25, "confidence": 0.95,
            "contains_self_harm_intent": False, "detected_indicators": [], "reason": "bereavement"}


async def _classifier_error(message, conversation_history=None, previous_sessions=None, use_cache=True):
    raise RuntimeError("injected: classifier unavailable")


_REAL_SHOULD_INVOKE = unified_safety.should_invoke_ai_classifier

CLASSIFIERS = {"silent": _classifier_silent, "high": _classifier_high,
               "bereaved": _classifier_bereaved, "error": _classifier_error}


def _boom(name):
    def _raise(*a, **k):
        raise RuntimeError(f"injected: {name}")
    return _raise


def _aboom(name):
    async def _raise(*a, **k):
        raise RuntimeError(f"injected: {name}")
    return _raise


# name -> (module, attribute, async?)
INJECTION_POINTS = {
    "check_safeguarding": (server, "check_safeguarding", False),
    "legacy_scorer": (server, "calculate_safeguarding_score", False),
    "enhanced_monitor": (server, "assess_message_safety", False),
    "unified": (server, "analyze_message_unified", False),
    "unified_L1_keyword": (unified_safety, "assess_message_safety", False),
    "unified_L2_semantic": (unified_safety, "full_semantic_analysis", False),
    "unified_L3_trajectory": (unified_safety, "analyze_message_with_context", False),
    "extract": (reconciler, "extract_verdicts_from_unified", False),
    "reconcile": (reconciler, "reconcile_verdicts", False),
    "reconciler_audit_log": (reconciler, "_emit_audit_log_unguarded", False),
}


class Harness:
    def __init__(self, monkeypatch):
        self.mp = monkeypatch
        self.records = []
        self.emails = []        # (alert, subject, html)
        self.sessions = []
        provenance.set_sink(self.records.append)
        monkeypatch.setattr(server, "gemini_client", None)
        monkeypatch.setattr(semantic_model, "compute_embedding", lambda *a, **k: None)
        monkeypatch.setattr(server, "lookup_ip_geolocation", _no_geo)

        async def _email(alert, risk_data=None):
            subject, html = server._build_safeguarding_email(alert, risk_data)
            self.emails.append((alert, subject, html))
            return True

        monkeypatch.setattr(server, "send_safeguarding_email_notification", _email)
        self.client = TestClient(server.app, raise_server_exceptions=False)
        self.store = None

    def new_session(self, signpost=False):
        self.store = mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"] + uuid.uuid4().hex[:6]]
        if signpost:
            asyncio.run(self.store.settings.insert_one(
                {"_id": "site_settings", "safeguarding_response_mode": "signpost"}))
        self.mp.setattr(server, "db", self.store)
        sid = f"f2-{uuid.uuid4().hex[:10]}"
        now = datetime.utcnow()
        server.buddy_sessions[sid] = {"message_count": 0, "history": [], "character": "tommy",
                                      "last_active": now, "created_at": now}
        server.session_risk_history.pop(sid, None)
        self.sessions.append(sid)
        return sid

    def send(self, sid, message, *, classifier="silent", fail=(), force_ai=False):
        model = _ScriptedModel()
        self.mp.setattr(server, "buddy_openai_client", model)
        self.mp.setattr(unified_safety, "classify_message_with_ai", CLASSIFIERS[classifier])
        # force_ai: make the classifier run even where its invocation gate
        # would skip it, so "classifier evidence present" is real.
        self.mp.setattr(unified_safety, "should_invoke_ai_classifier",
                        (lambda *a, **k: True) if force_ai else _REAL_SHOULD_INVOKE)
        with pytest.MonkeyPatch.context() as mp:
            for f in fail:
                if callable(f):
                    f(mp)
                    continue
                mod, attr, is_async = INJECTION_POINTS[f]
                mp.setattr(mod, attr, _aboom(f) if is_async else _boom(f))
            server.ip_request_counts.clear()
            server.blocked_ips.clear()
            email_before, rec_before = len(self.emails), len(self.records)
            hist_before = list(server.buddy_sessions[sid].get("history", []))
            resp = self.client.post("/api/ai-buddies/chat",
                                    json={"message": message, "sessionId": sid, "character": "tommy"})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        alerts = asyncio.run(self.store.safeguarding_alerts.find({"session_id": sid}, {"_id": 0}).to_list(50))
        return {
            "body": body,
            "reply": body["reply"],
            "triggered": body["safeguardingTriggered"],
            "risk": body["riskLevel"],
            "score": body["riskScore"],
            "alert_id": body.get("safeguardingAlertId"),
            "alerts": alerts,
            "emails": self.emails[email_before:],
            "records": self.records[rec_before:],
            "model_calls": model.calls,
            "history_added": server.buddy_sessions[sid].get("history", [])[len(hist_before):],
        }

    def turn(self, message, **kw):
        sid = self.new_session(signpost=kw.pop("signpost", False))
        return self.send(sid, message, **kw)

    def close(self):
        provenance.reset_sink()
        for sid in self.sessions:
            server.buddy_sessions.pop(sid, None)
            server.session_risk_history.pop(sid, None)


@pytest.fixture
def h(monkeypatch):
    harness = Harness(monkeypatch)
    yield harness
    harness.close()


def summary(r):
    """Compact view used in assertions and the evidence matrix."""
    kind = ("EXIT_C" if r["reply"].startswith(LOST_YOU) else
            "INCOMPLETE" if r["reply"] == HOLDING else
            "CRISIS" if r["triggered"] else "GENERATED")
    return {
        "kind": kind, "risk": r["risk"], "score": r["score"], "triggered": r["triggered"],
        "alerts": sorted((a["risk_level"], a["status"], "provisional" if "evaluation_incomplete" in a.get("triggered_indicators", []) else "definitive") for a in r["alerts"]),
        "emails": len(r["emails"]), "model_calls": r["model_calls"],
        "history_added": len(r["history_added"]),
        "prov_risk": (r["records"][-1]["outcome"].get("risk_level") if r["records"] else None),
    }


def outcome(r):
    assert len(r["records"]) == 1, "exactly one provenance record per turn"
    return r["records"][0]["outcome"]


def stages(r):
    return {s["name"]: s for s in r["records"][0]["stages"]}


ROUTES = {
    "A": dict(message=A),
    "B1": dict(message=B1),
    "B2": dict(message=B2, classifier="high"),
    "G": dict(message=G),
    "N": dict(message=N),
    "E3": dict(message=E3),
    "B1e": dict(message=B1, classifier="error"),
}

LEGACY_POINTS = ["check_safeguarding", "legacy_scorer", "enhanced_monitor"]
UNIFIED_POINTS = ["unified", "unified_L1_keyword", "unified_L2_semantic", "unified_L3_trajectory", "extract"]


# ---------------------------------------------------------------------------
# 1. Healthy controls: unchanged
# ---------------------------------------------------------------------------

def test_healthy_controls(h):
    a = summary(h.turn(**ROUTES["A"]))
    assert (a["kind"], a["risk"], a["triggered"], a["alerts"], a["emails"], a["model_calls"]) == \
        ("CRISIS", "RED", True, [("RED", "active", "definitive")], 1, 0)
    b1 = summary(h.turn(**ROUTES["B1"]))
    assert (b1["kind"], b1["risk"], b1["alerts"]) == ("GENERATED", "AMBER", [("AMBER", "audit_only", "definitive")])
    b2 = summary(h.turn(**ROUTES["B2"]))
    assert (b2["kind"], b2["risk"], b2["alerts"]) == ("GENERATED", "AMBER", [("AMBER", "active", "definitive")])
    g = summary(h.turn(**ROUTES["G"]))
    assert (g["kind"], g["risk"], g["score"], g["alerts"], g["emails"]) == ("GENERATED", "GREEN", 0, [], 0)


# ---------------------------------------------------------------------------
# 2. No injected failure returns EXIT C, and GREEN/0 only where the decision
#    is complete and matches the healthy result for that message.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("point", list(INJECTION_POINTS))
@pytest.mark.parametrize("route", list(ROUTES))
def test_no_injected_failure_reaches_exit_c_or_false_green(h, route, point):
    healthy = summary(h.turn(**ROUTES[route]))
    r = h.turn(**ROUTES[route], fail=(point,))
    s = summary(r)
    assert s["kind"] != "EXIT_C", f"{route}/{point} reached EXIT C"
    if s["risk"] == "GREEN" and s["score"] == 0:
        assert s == healthy, f"{route}/{point}: GREEN/0 but not identical to the healthy result"
    if s["kind"] == "INCOMPLETE":
        assert s["risk"] == "UNKNOWN" and s["triggered"] is False
        assert s["model_calls"] == 0, "no persona or judge call on INCOMPLETE"
        assert s["history_added"] == 0, "no fabricated turn in history"
        o = outcome(r)
        assert o["risk_level"] == "INCOMPLETE" and o["error"] == "SafetyEvaluationIncomplete"
        assert o["failed_components"], "failed component named"
        assert o["should_escalate"] is None and o["risk_score"] is None


# ---------------------------------------------------------------------------
# 3. Crisis with an authoritative failsafe (PD-7, PD-4 case ii)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("point", LEGACY_POINTS + ["reconcile"])
def test_crisis_A_is_still_delivered(h, point):
    r = h.turn(**ROUTES["A"], fail=(point,))
    s = summary(r)
    assert (s["kind"], s["risk"], s["triggered"], s["model_calls"]) == ("CRISIS", "RED", True, 0)
    assert s["alerts"] == [("RED", "active", "definitive")] and s["emails"] == 1


@pytest.mark.parametrize("point", LEGACY_POINTS)
def test_exit_a_without_legacy_records_unknown_not_negative(h, point):
    o = outcome(h.turn(**ROUTES["A"], fail=(point,)))
    assert o["failsafe_fired"] is True
    assert o["should_escalate"] is None, "unknown legacy result must not be recorded as False"
    assert o["legacy_unavailable"] is True and "check_safeguarding" in o["failed_components"]


def test_reconciler_failure_with_classifier_high_on_crisis_A(h):
    r = h.turn(A, classifier="high", fail=("reconcile",))
    s = summary(r)
    assert (s["kind"], s["risk"], s["triggered"]) == ("CRISIS", "RED", True)
    assert s["alerts"] == [("RED", "active", "definitive")] and s["emails"] == 1
    st = stages(r)["reconciled_result"]
    assert st["values"]["precedence_rule_fired"] == "RECONCILER_FAILED_KEYWORD_ONLY"


@pytest.mark.parametrize("message", [N, E3], ids=["N", "E3"])
def test_reconciler_failure_classifier_high_negated_is_incomplete(h, message):
    """PD-4: classifier evidence present + failsafe removed by a guard -> INCOMPLETE."""
    r = h.turn(message, classifier="high", force_ai=True, fail=("reconcile",))
    s = summary(r)
    st = stages(r)["raw_unified_result"]["values"]
    assert st["ai_invoked"] is True and st["ai_risk_level"] == "high", "classifier evidence present"
    assert s["kind"] == "INCOMPLETE", s
    assert s["model_calls"] == 0
    assert s["alerts"] == [] and s["emails"] == 0, "no provisional alert for negated N/E3"


@pytest.mark.parametrize("point", LEGACY_POINTS)
def test_guard_removed_failsafe_without_legacy_is_incomplete(h, point):
    """E3 + legacy failure: the failsafe fires then the negation guard removes it."""
    s = summary(h.turn(**ROUTES["E3"], fail=(point,)))
    assert s["kind"] == "INCOMPLETE" and s["model_calls"] == 0


# ---------------------------------------------------------------------------
# 4. Reconciler fallback scope (PD-4) and Rule 2b never downgraded
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("route", ["B1", "B1e", "G"])
def test_reconciler_fallback_case_i_matches_healthy(h, route):
    healthy = summary(h.turn(**ROUTES[route]))
    r = h.turn(**ROUTES[route], fail=("reconcile",))
    assert summary(r) == {**healthy, "prov_risk": healthy["prov_risk"]}
    st = stages(r)["reconciled_result"]["values"]
    assert st["precedence_rule_fired"] == "RECONCILER_FAILED_KEYWORD_ONLY"


def test_rule_2b_staff_review_is_never_downgraded_by_fallback(h):
    s = summary(h.turn(**ROUTES["B2"], fail=("reconcile",)))
    assert s["kind"] == "INCOMPLETE"
    assert ("AMBER", "audit_only", "definitive") not in s["alerts"]


# ---------------------------------------------------------------------------
# 5. Simultaneous failures
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("route", ["A", "E3", "B1", "G"])
def test_simultaneous_check_safeguarding_and_reconciler_failure(h, route):
    healthy = summary(h.turn(**ROUTES[route]))
    s = summary(h.turn(**ROUTES[route], fail=("check_safeguarding", "reconcile")))
    assert s["kind"] in ("CRISIS", "INCOMPLETE"), s
    assert s["kind"] != "EXIT_C" and s["model_calls"] == 0
    if route == "A":
        assert s["kind"] == "CRISIS" and s["alerts"] == [("RED", "active", "definitive")]
    if s["risk"] == "GREEN":
        assert s == healthy


# ---------------------------------------------------------------------------
# 6. Failures inside the fallback and inside the INCOMPLETE responder
# ---------------------------------------------------------------------------

def _break_fallback(mp):
    mp.setattr(reconciler, "_keyword_risk_score", _boom("fallback construction"))


@pytest.mark.parametrize("route", ["A", "B1", "G"])
def test_failure_inside_fallback_construction_is_incomplete(h, route):
    s = summary(h.turn(**ROUTES[route], fail=("reconcile", _break_fallback)))
    assert s["kind"] == "INCOMPLETE", s


def _break_responder(mp):
    mp.setattr(server, "_f2_incomplete_response", _aboom("incomplete responder"))


def _break_email(mp):
    mp.setattr(server, "send_safeguarding_email_notification", _aboom("email"))


def _break_provenance_finish(mp):
    real_start = provenance.start_system_verdict

    def start(*a, **k):
        p = real_start(*a, **k)
        p.finish = _boom("prov.finish")
        return p
    mp.setattr(provenance, "start_system_verdict", start)


@pytest.mark.parametrize("breaker", [_break_responder, _break_email, _break_provenance_finish],
                         ids=["responder", "email", "provenance"])
@pytest.mark.parametrize("route", ["A", "G"])
def test_failure_inside_incomplete_responder_still_holds(h, route, breaker):
    s = summary(h.turn(**ROUTES[route], fail=("unified", breaker)))
    assert s["kind"] == "INCOMPLETE" and s["risk"] == "UNKNOWN" and s["model_calls"] == 0


# ---------------------------------------------------------------------------
# 7. S009 bereavement with reconciler failure (PD-5)
# ---------------------------------------------------------------------------

def test_s009_healthy_unchanged_and_conservative_on_reconciler_failure(h):
    healthy = h.turn(S009, classifier="bereaved")
    hs = summary(healthy)
    assert hs["kind"] == "GENERATED", "healthy S009: Rule 1 bereavement override applies, no crisis"
    assert stages(healthy)["reconciled_result"]["values"]["precedence_rule_fired"] == "CONTEXT_OVERRIDE"
    r = h.turn(S009, classifier="bereaved", fail=("reconcile",))
    s = summary(r)
    # Conservative: Rule 1 was NOT evaluated, the keyword failsafe stands.
    assert s["kind"] == "CRISIS" and s["risk"] == "RED"
    st = stages(r)["reconciled_result"]["values"]
    assert st["precedence_rule_fired"] == "RECONCILER_FAILED_KEYWORD_ONLY"
    assert outcome(r)["reconciler_fallback_case"] == "ii"


# ---------------------------------------------------------------------------
# 8. Provisional staff signalling (PD-6, C2, C3) and the retry sequence
# ---------------------------------------------------------------------------

def _provisional_route():
    """A unified-layer failure on a message whose legacy result is RED."""
    return dict(message=A, fail=("unified",))


def test_provisional_alert_on_surviving_legacy_red(h):
    r = h.turn(**_provisional_route())
    s = summary(r)
    assert s["kind"] == "INCOMPLETE"
    assert s["alerts"] == [("RED", "active", "provisional")]
    a = r["alerts"][0]
    assert "evaluation_incomplete" in a["triggered_indicators"]
    assert "risk_score_source:legacy_scorer" in a["triggered_indicators"]
    assert "failed_component:analyze_message_unified" in a["triggered_indicators"]
    assert a["ai_response"] == server.F2_PROVISIONAL_AI_RESPONSE
    assert isinstance(a["risk_score"], int) and a["risk_score"] > 0, "a genuine surviving score, not 0"
    alert, subject, html = r["emails"][0]
    assert "PROVISIONAL SAFEGUARDING ALERT — EVALUATION INCOMPLETE" in subject
    assert "URGENT: Safeguarding Alert [RED]" not in subject
    assert "not a completed assessment" in html and "evaluation incomplete" in html
    assert "Risk Score:" not in html, "the completed-assessment score line is not used"
    assert r["alert_id"] == a["id"], "id returned only because it was persisted"
    assert outcome(r)["provisional_alert_created"] is True


@pytest.mark.parametrize("route", ["N", "E3", "G"])
def test_no_provisional_alert_without_qualifying_evidence(h, route):
    """Negated N/E3 and benign G: no provisional alert or email. (Classifier-only
    HIGH evidence is covered by the N/E3 reconciler-failure test above.)"""
    for point in ("unified", "check_safeguarding", "reconcile"):
        s = summary(h.turn(**ROUTES[route], fail=(point,)))
        if s["kind"] == "INCOMPLETE":
            assert s["alerts"] == [] and s["emails"] == 0, (route, point)


@pytest.mark.parametrize("route", ["B1", "B2"])
def test_legacy_red_without_failsafe_gives_provisional_alert_on_incomplete(h, route):
    """Recorded for Ant: B1/B2 have a legacy RED result. On the healthy path the
    reconciler writes B1 as AMBER audit_only and B2 as AMBER active (Rule 2b).
    On a unified-layer failure there is no reconciled view, so PD-6 applies to
    the surviving legacy RED: a provisional, labelled, active alert."""
    s = summary(h.turn(**ROUTES[route], fail=("unified",)))
    assert s["kind"] == "INCOMPLETE"
    assert s["alerts"] == [("RED", "active", "provisional")] and s["emails"] == 1


def test_retry_after_incomplete_gives_two_distinct_auditable_alerts(h):
    """C2: what staff see and receive when an INCOMPLETE turn is retried."""
    sid = h.new_session()
    first = h.send(sid, A, fail=("unified",))
    second = h.send(sid, A)
    assert summary(first)["kind"] == "INCOMPLETE"
    assert summary(second)["kind"] == "CRISIS"
    alerts = sorted(second["alerts"], key=lambda a: a["created_at"])
    assert len(alerts) == 2, "two separate records, neither merged nor overwritten"
    prov_alert, def_alert = alerts
    assert {prov_alert["session_id"], def_alert["session_id"]} == {sid}, "traceable to the same session"
    assert "evaluation_incomplete" in prov_alert["triggered_indicators"]
    assert "evaluation_incomplete" not in def_alert["triggered_indicators"]
    assert prov_alert["status"] == "active" and def_alert["status"] == "active"
    subjects = [first["emails"][0][1], second["emails"][0][1]]
    assert "PROVISIONAL SAFEGUARDING ALERT — EVALUATION INCOMPLETE" in subjects[0]
    assert subjects[1] == "⚠️ URGENT: Safeguarding Alert [RED] - Radio Check"


def test_provisional_alert_in_signpost_mode_is_audit_only(h):
    r = h.turn(**_provisional_route(), signpost=True)
    assert summary(r)["alerts"] == [("RED", "audit_only", "provisional")]


def test_score_line_rules():
    base = dict(session_id="s", character="tommy", triggering_message="m", ai_response="x", risk_level="RED")
    with_score = server.SafeguardingAlert(**base, risk_score=120,
                                          triggered_indicators=["evaluation_incomplete", "risk_score_source:legacy_scorer"])
    assert server._provisional_score_line(with_score) == \
        "Risk score: 120 (from the legacy scorer only — evaluation incomplete)"
    no_score = server.SafeguardingAlert(**base, risk_score=0,
                                        triggered_indicators=["evaluation_incomplete", "risk_score_not_available"])
    assert server._provisional_score_line(no_score) == "Risk score: not available — evaluation incomplete"


def test_definitive_email_is_byte_identical_to_main():
    """The normal (non-provisional) email is built exactly as before F2."""
    alert = server.SafeguardingAlert(session_id="sess-1234567890", character="tommy",
                                     triggering_message="m", ai_response="x",
                                     risk_level="RED", risk_score=95, triggered_indicators=["x"])
    subject, html = server._build_safeguarding_email(alert, None)
    assert subject == "⚠️ URGENT: Safeguarding Alert [RED] - Radio Check"
    assert '<h2 style="margin: 0;">⚠️ SAFEGUARDING ALERT - RED</h2>' in html
    assert "Risk Score: 95" in html
    assert "        <html>\n        <body" in html, "original indentation preserved"


# ---------------------------------------------------------------------------
# 9. Reconciler audit-log failure (PD-8)
# ---------------------------------------------------------------------------

def test_audit_log_failure_keeps_verdict_and_emits_event(caplog):
    kw = reconciler.KeywordVerdict(risk_level="CRITICAL", failsafe_triggered=True,
                                   failsafe_reason="explicit_intent", triggers=["kill myself"])
    healthy = reconciler.reconcile_verdicts(keyword=kw, classifier=None, message_lower="i want to kill myself")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(reconciler, "_emit_audit_log_unguarded", _boom("audit write"))
        with caplog.at_level(logging.ERROR, logger="safety.reconciler.audit_failure"):
            v = reconciler.reconcile_verdicts(keyword=kw, classifier=None,
                                              message_lower="i want to kill myself", session_id="sess-abc")
    assert v == healthy, "the already constructed FinalVerdict survives unchanged"
    events = [json.loads(r.getMessage()) for r in caplog.records
              if r.name == "safety.reconciler.audit_failure"]
    assert len(events) == 1 and events[0]["evt"] == "round10.reconcile.audit_failed"
    assert events[0]["rule"] == "CLASSIFIER_UNAVAILABLE"


@pytest.mark.parametrize("route", ["A", "B1", "B2", "G"])
def test_audit_log_failure_is_identical_to_healthy_at_the_handler(h, route):
    healthy = summary(h.turn(**ROUTES[route]))
    assert summary(h.turn(**ROUTES[route], fail=("reconciler_audit_log",))) == healthy


# ---------------------------------------------------------------------------
# 10. Next turn, consumer contract
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("point", ["check_safeguarding", "unified", "reconcile", "extract"])
def test_next_healthy_turn_is_not_corrupted(h, point):
    sid = h.new_session()
    h.send(sid, G, fail=(point,))
    after = summary(h.send(sid, G))
    assert after["kind"] == "GENERATED" and after["risk"] == "GREEN"
    sid2 = h.new_session()
    h.send(sid2, G, fail=(point,))
    crisis = summary(h.send(sid2, A))
    assert crisis["kind"] == "CRISIS", "a crisis on the following turn is still caught"


def test_incomplete_wire_contract(h):
    r = h.turn(G, fail=("unified",))
    b = r["body"]
    assert b["reply"] == (
        "Sorry, something went wrong and I couldn't process your message properly. "
        "Please try sending it again. If you need someone to talk to now, you can call "
        "Samaritans free on 116 123. If you or someone else is in immediate danger, call 999.")
    assert b["riskLevel"] == "UNKNOWN" and b["riskScore"] == 0 and isinstance(b["riskScore"], int)
    assert b["safeguardingTriggered"] is False and b["safeguardingAlertId"] is None
    o = outcome(r)
    assert o["risk_level"] == "INCOMPLETE" and o["risk_score"] is None
    assert o["failed_components"] == ["analyze_message_unified"]


def test_frontend_consumers_do_not_read_risk_fields():
    """C3 evidence: no client consumer reads riskScore or riskLevel."""
    root = os.path.join(os.path.dirname(__file__), "..", "..")
    files = ["frontend/app/chat/[characterId].tsx", "frontend/app/grace-welcome.tsx",
             "portal/src/app/police/page.tsx"]
    for f in files:
        src = open(os.path.join(root, f), encoding="utf-8").read()
        assert "data.riskScore" not in src and "data.riskLevel" not in src, f
