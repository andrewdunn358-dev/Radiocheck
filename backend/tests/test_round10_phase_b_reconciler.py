"""
Round 10 Phase B — verdict reconciler unit tests.

Pinned regression baseline for the bereavement-overdose architectural fix.
See /app/memory/PHASE_B_PR_DRAFT.md v2 for full design rationale.

Test scenarios mirror the precedence rules in safety/verdict_reconciler.py:
  - Tests 1-2: CONTEXT_OVERRIDE on r10_S009 bereavement fixtures.
  - Test  3:   KEYWORD_FAILSAFE on r10_CTRL genuine-crisis baseline.
  - Test  4:   CLASSIFIER_ESCALATION when keyword silent + classifier confident.
  - Test  5:   DEFAULT when both pipelines are silent.
  - Tests 6-8: adversarial guards (override must be NARROW).
  - Tests 9-10: Rule 0 CLASSIFIER_UNAVAILABLE infrastructure-failure guards.

These tests must continue to pass on every Phase C / Phase D / future PR.
"""

import logging
import os
import sys

import pytest

# Make backend/ importable when running pytest from /app or /app/backend.
_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from safety.verdict_reconciler import (  # noqa: E402
    CLASSIFIER_CONFIDENCE_THRESHOLD,
    RECONCILABLE_KEYWORD_TRIGGERS,
    ClassifierVerdict,
    FinalVerdict,
    KeywordVerdict,
    is_overdose_bereavement_context,
    reconcile_verdicts,
)


# ---------------------------------------------------------------------------
# Fixtures matching the production diagnostic captures in /app/memory/r10_traces/
# ---------------------------------------------------------------------------

S009_A_MSG = "my best mate died of an overdose last year. still cuts me up."
S009_B_MSG = "lost my brother to an overdose. i miss him every day."
CTRL_MSG = "i am going to overdose tonight. i have the pills."


def _kw_critical_overdose() -> KeywordVerdict:
    return KeywordVerdict(
        risk_level="CRITICAL",
        failsafe_triggered=True,
        failsafe_reason="explicit_suicide_plan",
        triggers=["overdose"],
    )


def _kw_critical_overdose_pills() -> KeywordVerdict:
    return KeywordVerdict(
        risk_level="CRITICAL",
        failsafe_triggered=True,
        failsafe_reason="explicit_suicide_plan",
        triggers=["overdose", "pills"],
    )


def _kw_silent() -> KeywordVerdict:
    return KeywordVerdict(
        risk_level="NONE",
        failsafe_triggered=False,
        failsafe_reason=None,
        triggers=[],
    )


def _cls_low_no_intent(confidence: float = 0.70) -> ClassifierVerdict:
    return ClassifierVerdict(
        risk_level="low",
        confidence=confidence,
        contains_self_harm_intent=False,
        detected_indicators=["grief over a friend's death", "emotional distress"],
        reason="bereavement disclosure",
    )


def _cls_imminent_intent(confidence: float = 1.0) -> ClassifierVerdict:
    return ClassifierVerdict(
        risk_level="imminent",
        confidence=confidence,
        contains_self_harm_intent=True,
        detected_indicators=["explicit plan", "method"],
        reason="explicit first-person crisis",
    )


# ---------------------------------------------------------------------------
# Test 1 — r10_S009-A bereavement (mate / OD / past)
# ---------------------------------------------------------------------------

def test_s009_a_bereavement_fires_context_override():
    final = reconcile_verdicts(
        keyword=_kw_critical_overdose(),
        classifier=_cls_low_no_intent(0.70),
        message_lower=S009_A_MSG,
        session_id="t1",
        character="tommy",
    )
    assert final.precedence_rule_fired == "CONTEXT_OVERRIDE"
    assert final.failsafe_triggered is False
    assert final.failsafe_reason is None
    assert final.risk_level == "NONE"   # classifier "low" → NONE in final mapping


# ---------------------------------------------------------------------------
# Test 2 — r10_S009-B bereavement (brother / OD)
# ---------------------------------------------------------------------------

def test_s009_b_bereavement_fires_context_override():
    final = reconcile_verdicts(
        keyword=_kw_critical_overdose(),
        classifier=_cls_low_no_intent(0.70),
        message_lower=S009_B_MSG,
        session_id="t2",
        character="tommy",
    )
    assert final.precedence_rule_fired == "CONTEXT_OVERRIDE"
    assert final.failsafe_triggered is False
    assert final.risk_level == "NONE"


# ---------------------------------------------------------------------------
# Test 3 — r10_CTRL genuine first-person crisis must still escalate (baseline)
# ---------------------------------------------------------------------------

def test_ctrl_genuine_crisis_keyword_failsafe_wins():
    final = reconcile_verdicts(
        keyword=_kw_critical_overdose_pills(),
        classifier=_cls_imminent_intent(1.0),
        message_lower=CTRL_MSG,
        session_id="t3",
        character="tommy",
    )
    assert final.precedence_rule_fired == "KEYWORD_FAILSAFE"
    assert final.failsafe_triggered is True
    assert final.failsafe_reason == "explicit_suicide_plan"
    assert final.risk_level == "IMMINENT"
    assert final.risk_score >= 95


# ---------------------------------------------------------------------------
# Test 4 — Classifier-only escalation (rare path)
# ---------------------------------------------------------------------------

def test_classifier_only_escalation_when_keyword_silent():
    final = reconcile_verdicts(
        keyword=_kw_silent(),
        classifier=_cls_imminent_intent(0.90),
        message_lower="i'm going to do it",
        session_id="t4",
        character="bob",
    )
    assert final.precedence_rule_fired == "CLASSIFIER_ESCALATION"
    assert final.failsafe_triggered is True
    assert final.failsafe_reason == "classifier_imminent"
    assert final.risk_level == "IMMINENT"


# ---------------------------------------------------------------------------
# Test 5 — Both pipelines silent (default safe path)
# ---------------------------------------------------------------------------

def test_both_silent_default_no_failsafe():
    final = reconcile_verdicts(
        keyword=_kw_silent(),
        classifier=ClassifierVerdict(
            risk_level="low",
            confidence=0.30,
            contains_self_harm_intent=False,
        ),
        message_lower="just had a good day, thanks for asking",
        session_id="t5",
        character="tommy",
    )
    assert final.precedence_rule_fired == "DEFAULT"
    assert final.failsafe_triggered is False
    assert final.risk_level == "NONE"


# ---------------------------------------------------------------------------
# Test 6 — Adversarial guard: classifier confidence below threshold blocks override
# ---------------------------------------------------------------------------

def test_low_classifier_confidence_blocks_override():
    below = CLASSIFIER_CONFIDENCE_THRESHOLD - 0.15
    final = reconcile_verdicts(
        keyword=_kw_critical_overdose(),
        classifier=_cls_low_no_intent(below),
        message_lower=S009_A_MSG,    # bereavement detector matches
        session_id="t6",
        character="tommy",
    )
    # Override is blocked because classifier isn't confident enough.
    # Falls through to KEYWORD_FAILSAFE.
    assert final.precedence_rule_fired == "KEYWORD_FAILSAFE"
    assert final.failsafe_triggered is True
    assert final.risk_level == "IMMINENT"


# ---------------------------------------------------------------------------
# Test 7 — Adversarial guard: classifier reports self-harm intent → no override
# ---------------------------------------------------------------------------

def test_classifier_reports_self_harm_intent_blocks_override():
    classifier_with_intent = ClassifierVerdict(
        risk_level="imminent",
        confidence=0.90,
        contains_self_harm_intent=True,    # the kill-switch
        detected_indicators=["intent disclosed"],
    )
    final = reconcile_verdicts(
        keyword=_kw_critical_overdose(),
        classifier=classifier_with_intent,
        # Bereavement-flavoured message but classifier says crisis intent.
        # The override rule requires intent=False, so it must NOT fire.
        message_lower=S009_A_MSG,
        session_id="t7",
        character="tommy",
    )
    assert final.precedence_rule_fired == "KEYWORD_FAILSAFE"
    assert final.failsafe_triggered is True
    assert final.risk_level == "IMMINENT"


# ---------------------------------------------------------------------------
# Test 8 — Adversarial guard: non-reconcilable trigger ("pills") never overrides
# ---------------------------------------------------------------------------

def test_non_reconcilable_keyword_trigger_never_overrides():
    assert "pills" not in RECONCILABLE_KEYWORD_TRIGGERS
    keyword_pills_only = KeywordVerdict(
        risk_level="CRITICAL",
        failsafe_triggered=True,
        failsafe_reason="explicit_suicide_plan",
        triggers=["pills"],
    )
    final = reconcile_verdicts(
        keyword=keyword_pills_only,
        classifier=_cls_low_no_intent(0.80),
        message_lower="i still have the pills my late mate left behind",
        session_id="t8",
        character="tommy",
    )
    assert final.precedence_rule_fired == "KEYWORD_FAILSAFE"
    assert final.failsafe_triggered is True


# ---------------------------------------------------------------------------
# Test 9 — Rule 0: classifier exception during call → defer to keyword + audit WARN
# ---------------------------------------------------------------------------

def test_rule_0_classifier_exception_defers_to_keyword(caplog):
    caplog.set_level(logging.WARNING, logger="safety.reconciler")
    final = reconcile_verdicts(
        keyword=_kw_critical_overdose(),
        classifier=None,
        message_lower=S009_A_MSG,
        classifier_error=TimeoutError("classifier timed out at 10s"),
        session_id="t9",
        character="tommy",
    )
    assert final.precedence_rule_fired == "CLASSIFIER_UNAVAILABLE"
    assert final.failsafe_triggered is True             # keyword wins
    assert final.failsafe_reason == "explicit_suicide_plan"
    assert final.risk_level == "CRITICAL"               # keyword's risk_level passed through
    # Audit log fires at WARNING and names the exception class.
    warning_records = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert any("CLASSIFIER_UNAVAILABLE" in r.getMessage() for r in warning_records)
    assert any("TimeoutError" in r.getMessage() for r in warning_records)


# ---------------------------------------------------------------------------
# Test 10 — Rule 0: malformed classifier output → defer to keyword + audit WARN
# ---------------------------------------------------------------------------

def test_rule_0_malformed_classifier_defers_to_keyword(caplog):
    caplog.set_level(logging.WARNING, logger="safety.reconciler")
    bad_classifier = ClassifierVerdict(
        risk_level="low",
        confidence=1.7,    # out of [0.0, 1.0]
        contains_self_harm_intent=False,
    )
    final = reconcile_verdicts(
        keyword=_kw_critical_overdose(),
        classifier=bad_classifier,
        message_lower=S009_A_MSG,
        session_id="t10",
        character="tommy",
    )
    assert final.precedence_rule_fired == "CLASSIFIER_UNAVAILABLE"
    assert final.failsafe_triggered is True
    warning_records = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert any("malformed_field:confidence" in r.getMessage() for r in warning_records)


# ---------------------------------------------------------------------------
# Sanity: relocated bereavement detector still detects the canonical fixtures
# (regression guard against losing a pattern during the relocation)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "msg",
    [
        S009_A_MSG,
        S009_B_MSG,
        "lost my colleague to an overdose on shift",
        "took his own life from an overdose, line of duty, ten years ago",
    ],
)
def test_bereavement_detector_matches_canonical_fixtures(msg):
    assert is_overdose_bereavement_context(msg) is True


@pytest.mark.parametrize(
    "msg",
    [
        CTRL_MSG,
        "i'm going to take an overdose tonight",
        "thinking about an overdose",
    ],
)
def test_bereavement_detector_does_not_match_first_person_crisis(msg):
    assert is_overdose_bereavement_context(msg) is False


# ---------------------------------------------------------------------------
# Type-shape sanity: FinalVerdict is the only thing buddy_chat consumes
# ---------------------------------------------------------------------------

def test_final_verdict_is_immutable_frozen_dataclass():
    final = reconcile_verdicts(
        keyword=_kw_silent(),
        classifier=_cls_low_no_intent(0.70),
        message_lower="hello",
        session_id="t11",
        character="tommy",
    )
    assert isinstance(final, FinalVerdict)
    with pytest.raises(Exception):
        # frozen=True dataclass — must not be mutable in flight
        final.failsafe_triggered = True   # type: ignore[misc]
