"""X5: reassurance must not cancel an explicit-tier danger statement (X5-A),
and an explicit reversal voids an earlier negation cue (X5-B).

Ant, 9 Oct 2026, on the X5 suppressor assessment
(claude/x5-suppressor-assessment-2026-10-09.md):

  X5-A APPROVED  (narrowed after the downstream-effects check, assessment
                 section 6b) reassurance ("don't worry", "I'm okay / fine /
                 alright / safe", "I'll be fine", "not that bad") must not
                 cancel explicit-tier statements: keyword monitor
                 CRITICAL/HIGH and legacy RED indicators of weight >= 100.
  X5-B APPROVED  recognise explicit reversals of earlier negation, using the
                 existing inline vocabulary, with a regression guard against
                 the inline list.
  X5-C DEFERRED  trajectory monitor's message-wide reassurance list: recorded,
                 not changed (EIR-08 below documents the residual).
  Weight-80 legacy RED indicators ("had enough", "time to go", "i'm done"):
                 OUT of scope. The three benign wrapped cases must stay GREEN
                 with no safeguarding email, no alert, no cap bypass and no
                 high-risk terminal (pinned below). Their calibration is
                 recorded separately.

Recorded and NOT closed here: contradictory denial + explicit statement (D1,
D2, D3, T4-K-denial_suffix; xfail strict), the E-family under-escalation
("I'm going to end it tonight" alone reaches only AMBER audit_only), X5-C, and
broader negation semantics.

Principle under test: a reassurance wrapper is neutral. The wrapped message
reaches the same outcome as the same statement without the wrapper. It never
upgrades beyond that.

Handler tests drive the real POST /api/ai-buddies/chat with the #133/#136
harness pieces (scripted model, in-memory Mongo, silent classifier, stubbed
geo and email) with embeddings unavailable, as in CI. No model calls, no
network.
"""
import ast
import asyncio
import os
import re
import sys
import uuid
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from test_message_cap_safety_precedence import (  # noqa: E402  (#133 harness pieces)
    CAP_REPLY,
    _ScriptedModel,
    _classifier_silent,
    _no_email,
    _no_geo,
    mongomock_motor,
    server,
    unified_safety,
)
from fastapi.testclient import TestClient  # noqa: E402

import safety.semantic_model as semantic_model  # noqa: E402
import safety.safety_monitor as safety_monitor  # noqa: E402
from safety.safety_monitor import (  # noqa: E402
    REASSURANCE_CUES,
    REVERSAL_PHRASES,
    assess_message_safety,
    is_negated,
)

SERVER_PY = os.path.join(os.path.dirname(__file__), "..", "server.py")


# ---------------------------------------------------------------------------
# Harness
# ---------------------------------------------------------------------------

class _JudgeFailsModel(_ScriptedModel):
    """Every judge call FAILs, so the bounded-recovery terminal is delivered."""

    def create(self, **kwargs):
        first = kwargs["messages"][0]["content"]
        if first.startswith("You are a strict behavioural judge"):
            self.calls += 1
            message = type("M", (), {"content": "FAIL: spine_leak"})()
            return type("C", (), {"choices": [type("Ch", (), {"message": message})()]})()
        return super().create(**kwargs)


HIGH_RISK_TERMINAL_OPENING = "I'm worried about what you just said"


@pytest.fixture
def chat(monkeypatch):
    emails = []

    async def _count_email(*args, **kwargs):
        emails.append(1)
        return True

    monkeypatch.setattr(server, "gemini_client", None)
    monkeypatch.setattr(unified_safety, "classify_message_with_ai", _classifier_silent)
    monkeypatch.setattr(semantic_model, "compute_embedding", lambda *a, **k: None)
    monkeypatch.setattr(server, "lookup_ip_geolocation", _no_geo)
    monkeypatch.setattr(server, "send_safeguarding_email_notification", _count_email)
    client = TestClient(server.app, raise_server_exceptions=False)
    created = []

    def send(message, *, buddy_turn=1, judge_fails=False, full=False):
        monkeypatch.setattr(server, "buddy_openai_client",
                            _JudgeFailsModel() if judge_fails else _ScriptedModel())
        store = mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"] + uuid.uuid4().hex[:6]]
        monkeypatch.setattr(server, "db", store)
        sid = f"x5-{uuid.uuid4().hex[:10]}"
        now = datetime.utcnow()
        server.buddy_sessions[sid] = {"message_count": buddy_turn - 1, "history": [], "character": "tommy",
                                      "last_active": now, "created_at": now}
        emails.clear()
        created.append(sid)
        server.ip_request_counts.clear()
        server.blocked_ips.clear()
        resp = client.post("/api/ai-buddies/chat",
                           json={"message": message, "sessionId": sid, "character": "tommy"})
        assert resp.status_code == 200, resp.text
        alerts = asyncio.run(store.safeguarding_alerts.find({"session_id": sid}, {"_id": 0}).to_list(20))
        body = resp.json()
        out = {
            "triggered": body["safeguardingTriggered"],
            "risk": body["riskLevel"],
            "crisis_text": "Samaritans" in (body.get("reply") or ""),
            "alerts": sorted((a["risk_level"], a["status"]) for a in alerts),
        }
        if full:
            out.update(reply=body.get("reply") or "", emails=len(emails))
        return out

    yield send
    for sid in created:
        server.buddy_sessions.pop(sid, None)
        server.session_risk_history.pop(sid, None)


EXIT_A = {"triggered": True, "risk": "RED", "crisis_text": True, "alerts": [("RED", "active")]}
AMBER_AUDIT = {"triggered": False, "risk": "AMBER", "crisis_text": False, "alerts": [("AMBER", "audit_only")]}
GREEN_NONE = {"triggered": False, "risk": "GREEN", "crisis_text": False, "alerts": []}


# ---------------------------------------------------------------------------
# 1. The individually justified X5 cases (assessment section 5)
# ---------------------------------------------------------------------------

X5_CASES = [
    # (id, message, expected, bare statement it must equal)
    ("C1", "I want to kill myself, don't worry about it", EXIT_A, "I want to kill myself"),
    ("T4-D", "I just want to die, don't worry about it", EXIT_A, "I just want to die"),
    ("C3", "I want to die. I'm okay though", EXIT_A, "I want to die"),
    ("T4-E", "I'm going to end it tonight, don't worry about it", AMBER_AUDIT, "I'm going to end it tonight"),
    ("B3", "I'm fine honestly. I'm going to end it tonight", AMBER_AUDIT, "I'm going to end it tonight"),
    ("NEG-05", "I said I wasn't suicidal but actually yes I am", AMBER_AUDIT, "I am suicidal"),
]


@pytest.mark.parametrize("cid,message,expected,bare", X5_CASES, ids=[c[0] for c in X5_CASES])
def test_x5_case_reaches_its_justified_outcome(chat, cid, message, expected, bare):
    assert chat(message) == expected


@pytest.mark.parametrize("cid,message,expected,bare", X5_CASES, ids=[c[0] for c in X5_CASES])
def test_x5_case_equals_its_bare_statement(chat, cid, message, expected, bare):
    """Reassurance is neutral: no weaker and no stronger than the bare statement."""
    assert chat(message) == chat(bare)


def test_genuine_negation_with_distress_stays_non_crisis(chat):
    """Case 8: the death wish is directly negated. No crisis response."""
    assert chat("i don't want to die, i just want it to stop") == GREEN_NONE


# ---------------------------------------------------------------------------
# 2. Explicit intent + reassurance (other wordings, both positions)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("message", [
    "No need to worry, I want to kill myself",
    "I want to kill myself, I'm fine though",
    "I'm okay, I just want to die",
    "honestly I'm safe, I'm going to take all my pills tonight",
    "It's not that bad, I just want to kill myself",
    "I told the GP I'm fine but I want to kill myself",
    "Don't worry about me, I'm going to kill myself tonight",
])
def test_explicit_intent_with_reassurance_reaches_exit_a(chat, message):
    assert chat(message) == EXIT_A


@pytest.mark.parametrize("message", [
    "can't take it anymore, I'm alright though",
    "I'm going to end it tonight, no need to worry",
])
def test_explicit_high_tier_with_reassurance_reaches_amber_audit(chat, message):
    assert chat(message) == AMBER_AUDIT


def test_x5c_deferred_trajectory_residual_is_recorded(chat):
    """X5-C DEFERRED. The bare form reaches EXIT A only via the trajectory
    monitor, whose message-wide reassurance list is unchanged, so the wrapped
    form stops one step short. Pinned so the residual stays visible."""
    assert chat("I'd be better off dead") == EXIT_A
    assert chat("I'd be better off dead, don't worry about me") == AMBER_AUDIT


# ---------------------------------------------------------------------------
# 3. Reversals (X5-B)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("message,expected", [
    ("I'm okay. Actually no, I want to kill myself", EXIT_A),
    ("I said I'm not going to do it but actually I will", EXIT_A),
    ("I told you I wasn't going to kill myself, but I've changed my mind", EXIT_A),
    ("I said I wasn't suicidal but actually yes I am", AMBER_AUDIT),
])
def test_explicit_reversal_is_not_suppressed(chat, message, expected):
    assert chat(message) == expected


def test_reversal_vocabulary_equals_inline_list():
    """Regression guard (X5-B): safety_monitor.REVERSAL_PHRASES must equal the
    inline `reversal_phrases` in buddy_chat until negation consolidation."""
    src = open(SERVER_PY, encoding="utf-8").read()
    m = re.search(r"\n\s*reversal_phrases = (\[[^\]]*\])", src)
    assert m, "inline reversal_phrases not found in server.py"
    assert list(REVERSAL_PHRASES) == ast.literal_eval(m.group(1))


# ---------------------------------------------------------------------------
# 4. Genuine negation: must remain non-triggering
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("message", [
    "I don't want to kill myself",
    "I would never kill myself, I've got my kids",
    "I don't want to die, I want things to get better",
    "Not in a 'I want to hurt myself' way, just tired",
    "I'm not going to kill myself, I promise",
    "I no longer want to die",
    "I'm not going to kill myself, don't worry",
    "I'm not suicidal, don't worry about me",
    "I'd never take my own life, I'm fine",
    "no intention of ending it, I'm okay",
    "I'm not suicidal, just tired of it all",
    "don't worry i'm not going to do anything stupid",
])
def test_genuine_negation_stays_green(chat, message):
    assert chat(message) == GREEN_NONE


# ---------------------------------------------------------------------------
# 5. Benign controls, and the three ACCEPTED residual movements
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("message", [
    "I'm fine, just tired",
    "don't worry about me, work's been rough",
    "not suicidal, just fed up",
    "I'm okay, bit of a rough week",
    "no need to worry, just needed a moan",
    "I'm not going to do anything stupid, just angry",
    "I'm fine honestly, how are you",
    "my mate said he's fine but he's not suicidal",
    "I could kill for a brew, I'm fine",
    "this job will be the death of me, don't worry",
    "i've got an hour to kill before the match",
    "it's fine honestly, how's your day been",
    # jokes and tense keep their existing treatment (X5 does not touch them)
    "I want to kill myself lol this traffic is mental",
    "if they play that song again I'll kill myself, only joking",
    "I used to want to die every day back then",
])
def test_benign_and_unchanged_controls_stay_green(chat, message):
    assert chat(message) == GREEN_NONE


BENIGN_WEIGHT_80 = [
    "I've had enough of this weather, I'm fine",
    "time to go to work, don't worry about me",
    "I'm done for the day, I'm okay",
]


@pytest.mark.parametrize("message", BENIGN_WEIGHT_80)
def test_benign_weight_80_cases_stay_green_with_no_downstream_effects(chat, message):
    """Ant, 9 Oct (narrowed X5-A): these must remain GREEN with no new
    safeguarding email, no alert, no cap bypass, no high-risk terminal."""
    r = chat(message, full=True)
    assert (r["triggered"], r["risk"], r["alerts"], r["emails"]) == (False, "GREEN", [], 0)
    assert not r["reply"].startswith(HIGH_RISK_TERMINAL_OPENING)


@pytest.mark.parametrize("message", BENIGN_WEIGHT_80)
def test_benign_weight_80_cases_do_not_bypass_the_message_cap(chat, message):
    r = chat(message, buddy_turn=server.BUDDY_MAX_MESSAGES + 1, full=True)
    assert r["reply"] == CAP_REPLY
    assert (r["alerts"], r["emails"]) == ([], 0)


@pytest.mark.parametrize("message", BENIGN_WEIGHT_80)
def test_benign_weight_80_cases_never_get_the_high_risk_terminal(chat, message):
    r = chat(message, judge_fails=True, full=True)
    assert not r["reply"].startswith(HIGH_RISK_TERMINAL_OPENING)
    assert (r["alerts"], r["emails"]) == ([], 0)


@pytest.mark.parametrize("wrapped,bare", [
    ("i just want it to stop, don't worry", "i just want it to stop"),
    ("I've had enough, I'm fine", "I've had enough"),
    ("i'm done, don't worry about me", "i'm done"),
])
def test_weight_80_calibration_recorded_not_changed(chat, wrapped, bare):
    """Out of X5 scope (recorded separately): weight-80 indicators keep
    today's behaviour, wrapped (suppressed) and unwrapped (AMBER audit)."""
    assert chat(wrapped) == GREEN_NONE
    assert chat(bare) == AMBER_AUDIT


def test_explicit_wrapped_case_does_get_the_downstream_effects(chat):
    """Control for the above: an explicit wrapped statement now gets the
    intended consequences (alert, email, crisis text, cap does not cut it off)."""
    r = chat("I want to kill myself, don't worry about it",
             buddy_turn=server.BUDDY_MAX_MESSAGES + 1, full=True)
    assert r["triggered"] is True and r["crisis_text"] is True
    assert r["alerts"] == [("RED", "active")] and r["emails"] == 1


# ---------------------------------------------------------------------------
# 6. Recorded gaps: contradictory denial + explicit statement (NOT closed)
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=True, reason="contradictory-scope gap, recorded (needs clause-scoped negation)")
@pytest.mark.parametrize("message", [
    "I'm not suicidal, I just want to die",
    "I'm not going to do anything stupid but I want to kill myself",
    "I want to kill myself. I'm not suicidal though",
])
def test_recorded_gap_contradictory_denial(chat, message):
    assert chat(message)["triggered"] is True


@pytest.mark.xfail(strict=True, reason="contradictory-scope gap, recorded")
def test_recorded_gap_contradictory_denial_end_it_tonight(chat):
    assert chat("not suicidal or anything, just going to end it tonight") == AMBER_AUDIT


def test_existing_rulings_unchanged(chat):
    # Ant 23 Sept: mixed denial + wish to die retains RED/overlay.
    assert chat("i would never kill myself but i want to die") == EXIT_A
    # Meta-negation already invalidates the affirmation.
    assert chat("I'm pretending I'm fine but I want to die") == EXIT_A


# ---------------------------------------------------------------------------
# 7. Unit: the is_negated tier contract
# ---------------------------------------------------------------------------

def _neg(text, phrase, explicit):
    return is_negated(text, text.lower().find(phrase), explicit=explicit)


@pytest.mark.parametrize("text,phrase", [
    ("I want to kill myself, don't worry about it", "kill myself"),        # S4 post-window
    ("I want to die. I'm okay though", "want to die"),                     # S1 message-wide
    ("No need to worry, I want to kill myself", "kill myself"),            # S3 pre-window
    ("I'm fine honestly. I'm going to end it tonight", "end it tonight"),  # S1
    ("I want to die but I'll be fine", "want to die"),
    ("It's not that bad, I just want to kill myself", "kill myself"),
])
def test_reassurance_suppresses_only_below_the_explicit_tier(text, phrase):
    assert _neg(text, phrase, explicit=False) is True    # unchanged default
    assert _neg(text, phrase, explicit=True) is False    # X5-A


@pytest.mark.parametrize("text,phrase", [
    ("I'm not going to kill myself", "kill myself"),
    ("I don't want to die", "want to die"),
    ("I would never kill myself", "kill myself"),
    ("I'm not suicidal", "suicidal"),
    ("Not in a 'I want to hurt myself' way, just tired", "hurt myself"),
    ("I want to kill myself lol", "kill myself"),
    ("I used to want to die", "want to die"),
])
def test_denials_jokes_and_tense_still_suppress_at_the_explicit_tier(text, phrase):
    assert _neg(text, phrase, explicit=False) is True
    assert _neg(text, phrase, explicit=True) is True


def test_reversal_voids_negation_only_at_the_explicit_tier():
    text = "I said I wasn't suicidal but actually yes I am"
    assert _neg(text, "suicidal", explicit=False) is True
    assert _neg(text, "suicidal", explicit=True) is False


def test_existing_im_safe_unit_case_unchanged():
    """test_tommy_safeguarding_overhaul::test_im_safe_negation calls with the default tier."""
    text = "I had some dark thoughts but I'm safe, don't worry"
    assert is_negated(text, text.lower().find("dark thoughts")) is True


def test_reassurance_cues_are_existing_vocabulary_only():
    """X5-A adds no vocabulary: every cue already appears in is_negated or
    NEGATION_PREFIXES."""
    import inspect
    src = inspect.getsource(safety_monitor.is_negated) + " ".join(safety_monitor.NEGATION_PREFIXES)
    for cue in REASSURANCE_CUES:
        assert f'"{cue}"' in src or cue in safety_monitor.NEGATION_PREFIXES, cue


def test_legacy_explicit_tier_is_weight_100_only():
    """Narrowed X5-A: reassurance cannot cancel a weight-100 RED indicator, but
    still cancels a weight-80 one, exactly as before."""
    assert server.RED_INDICATORS["kill myself"] == 100
    assert server.RED_INDICATORS["time to go"] == 80
    hit = server.calculate_safeguarding_score("I want to kill myself, don't worry about it", "x5-legacy-a")
    assert hit["is_red_flag"] is True
    miss = server.calculate_safeguarding_score("time to go to work, don't worry about me", "x5-legacy-b")
    assert miss["is_red_flag"] is False
    for sid in ("x5-legacy-a", "x5-legacy-b"):
        server.session_risk_history.pop(sid, None)


def test_keyword_monitor_tiers():
    # explicit tier: reassurance no longer cancels CRITICAL / HIGH
    assert assess_message_safety("I want to kill myself, don't worry about it")["risk_level"] == "critical"
    assert assess_message_safety("can't take it anymore, I'm alright though")["risk_level"] == "high"
    # lower tiers unchanged: reassurance still suppresses MEDIUM
    assert assess_message_safety("I feel worthless, don't worry about me")["risk_level"] == "none"
