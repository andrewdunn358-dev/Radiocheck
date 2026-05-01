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


# ---------------------------------------------------------------------------
# Integration tests — drive analyze_message_unified() end-to-end and reconcile.
#
# Round 10 Phase B hotfix (feat/round10-phase-b-hotfix-orphan-import):
# the unit tests above construct synthetic KeywordVerdict objects and so
# cannot detect:
#   - integration defects in the wiring between safety.unified_safety and
#     safety.verdict_reconciler (Defect #2: wrong dict key in unified_safety,
#     plus the label-format mismatch in safety_monitor's `specific_triggers`).
#   - missing/orphan imports in the legacy keyword path (Defect #1: NameError
#     at server.py:1566). Defect #1 is fixed by the deletion of that block;
#     this hotfix PR could not regress it because the call site no longer
#     exists. See feat/round10-phase-b-hotfix-orphan-import for context.
#
# These integration tests run the real safety_monitor, real unified_safety,
# real extract_verdicts_from_unified, and real reconcile_verdicts. Only the
# AI classifier is monkey-patched so CI does not require an OpenAI key.
# ---------------------------------------------------------------------------

from unittest.mock import patch  # noqa: E402

from safety.unified_safety import analyze_message_unified  # noqa: E402
from safety.verdict_reconciler import extract_verdicts_from_unified  # noqa: E402


async def _fake_classifier_low_no_intent(message, conversation_history=None,
                                          previous_sessions=None, use_cache=True):
    """Stand-in for safety.ai_safety_classifier.classify_message_with_ai.
    Returns a confident "no self-harm intent" verdict, matching the actual
    GPT-4o output captured for r10_S009 fixtures (confidence=0.70)."""
    return {
        "ai_used": True,
        "risk_level": "low",
        "risk_score": 25,
        "confidence": 0.70,
        "contains_self_harm_intent": False,
        "detected_indicators": [],
        "reason": "bereavement disclosure, third-person loss",
        "cached": False,
        "processing_time_ms": 0,
    }


async def _fake_classifier_imminent_intent(message, conversation_history=None,
                                            previous_sessions=None, use_cache=True):
    """Stand-in classifier verdict for genuine first-person crisis."""
    return {
        "ai_used": True,
        "risk_level": "imminent",
        "risk_score": 95,
        "confidence": 0.95,
        "contains_self_harm_intent": True,
        "detected_indicators": ["explicit_plan"],
        "reason": "first-person crisis, method named",
        "cached": False,
        "processing_time_ms": 0,
    }


def _run_end_to_end(message: str, classifier_coro):
    """Drive the real unified pipeline + reconciler and return FinalVerdict."""
    with patch("safety.unified_safety.classify_message_with_ai",
               new=classifier_coro):
        unified = analyze_message_unified(
            message=message,
            session_id="it_" + message[:12],
            user_id="it_" + message[:12],
            character="tommy",
            is_under_18=False,
        )
    kw, cls, err = extract_verdicts_from_unified(unified)
    return reconcile_verdicts(
        keyword=kw,
        classifier=cls,
        message_lower=message.lower(),
        classifier_error=err,
        session_id="it_" + message[:12],
        character="tommy",
    ), unified


def test_integration_s009_b_drives_end_to_end_to_context_override():
    """Round 10 S009_b regression baseline.

    With the hotfix in place, the real keyword pipeline → real unified pipeline
    → real reconciler chain must classify "lost my brother to an overdose…" as
    a bereavement disclosure (CONTEXT_OVERRIDE), NOT a crisis.

    Pre-hotfix this test would fail at TWO points:
      1. unified_safety["keyword_triggers"] would be []  (Defect #2).
      2. Even after #2, RECONCILABLE_KEYWORD_TRIGGERS={"overdose"} could not
         match safety_monitor's labelled "critical: 'overdose'"  (Option α gap).

    Post-hotfix the chain delivers final.precedence_rule_fired=="CONTEXT_OVERRIDE"
    and failsafe_triggered=False — i.e. the user receives the persona's grief
    response, not the crisis overlay.
    """
    final, unified = _run_end_to_end(S009_B_MSG, _fake_classifier_low_no_intent)

    # Confirm Defect #2 is fixed: keyword_triggers populated.
    assert unified.get("keyword_triggers"), (
        "Phase B Defect #2 regression: unified_safety['keyword_triggers'] is "
        "empty. Check unified_safety.py:121 reads 'specific_triggers' (the "
        "key safety_monitor actually emits), not 'matched_keywords'."
    )

    # Confirm Option α is in place: trigger labels were stripped to bare names.
    assert "overdose" in unified["keyword_triggers"][0] or any(
        t == "overdose" for t in [
            t.split(": '")[-1].rstrip("'") for t in unified["keyword_triggers"]
        ]
    ), "S009_b should match safety_monitor's 'overdose' critical keyword"

    # The reconciler is the one decision the chat endpoint reads. This assert
    # is the contract Round 10 closes against.
    assert final.precedence_rule_fired == "CONTEXT_OVERRIDE", (
        f"S009_b should fire CONTEXT_OVERRIDE; got {final.precedence_rule_fired}. "
        f"reason={final.reconciliation_reason}"
    )
    assert final.failsafe_triggered is False
    assert final.failsafe_reason is None


def test_integration_ctrl_drives_end_to_end_to_keyword_failsafe():
    """Round 10 CTRL regression baseline.

    Genuine first-person overdose crisis must still fire KEYWORD_FAILSAFE.
    The bereavement override must NEVER swallow a real disclosure of intent.

    This is the more important of the two integration tests — false-negatives
    on CTRL are a worse safety failure than false-positives on S009.

    Note: the real safety_monitor matches BOTH 'overdose' (critical keyword)
    AND 'pills' / 'means' (multiplier) for the CTRL fixture. After Option α
    normalisation, kw.triggers contains both bare names. Reconciler Rule 1's
    `all(t in RECONCILABLE_KEYWORD_TRIGGERS for t in keyword.triggers)` check
    fails (multiplier not reconcilable), so Rule 2 KEYWORD_FAILSAFE wins —
    which is the desired behaviour. Safer-by-default: any non-reconcilable
    co-trigger blocks the override.
    """
    # Even with a (hypothetical) incorrect classifier verdict, KEYWORD_FAILSAFE
    # must dominate. Use the imminent-intent classifier here — they should
    # AGREE on this message — but the rule would also fire if the classifier
    # were silent or low-confidence.
    final, unified = _run_end_to_end(CTRL_MSG, _fake_classifier_imminent_intent)

    assert unified.get("failsafe_triggered") is True
    assert unified.get("keyword_triggers"), (
        "Phase B Defect #2 regression: unified_safety['keyword_triggers'] is "
        "empty. Check unified_safety.py:121."
    )

    assert final.precedence_rule_fired == "KEYWORD_FAILSAFE", (
        f"CTRL must fire KEYWORD_FAILSAFE; got {final.precedence_rule_fired}. "
        f"reason={final.reconciliation_reason}"
    )
    assert final.failsafe_triggered is True
    assert final.risk_level == "IMMINENT"
