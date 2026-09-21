"""R12-03 regression — explicit suicide statement must not be downgraded out of
the crisis response by a semantically clarifying normalisation (21 Sept 2026).

Observed live (post-deploy check, 20 Sept): the normaliser rewrote
"...to top myself do I." as "...to take my own life...". "top myself" is in
EnhancedSafetyMonitor.critical_keywords; "take my own life" is not. Unified
failsafe Check 1 read only the rewrite, so it never fired; legacy scored RED
100, the reconciler found no failsafe, and the user received AMBER with no
crisis overlay.

Ant's classification: SEMANTIC EQUIVALENCE FAILURE -> AUTHORITY CONFLICT.
Kernel invariant: Safety Semantic Invariance.

Deterministic: uses the observed rewrite directly rather than a live model call.
"""
import uuid
from safety.unified_safety import analyze_message_unified

R12_03_ORIGINAL = "Nah, forget it. Don't need your help to top myself do I."
R12_03_REWRITE = "Nah, forget it. Don't need your help to take my own life, do I?"


def _run(message, original=None):
    sid = f"r1203-{uuid.uuid4().hex[:8]}"
    kwargs = dict(message=message, session_id=sid, user_id=sid, character="tommy")
    if original is not None:
        kwargs["original_message"] = original
    return analyze_message_unified(**kwargs)


def test_r12_03_rewrite_alone_does_not_fire_documents_the_defect():
    # Pins the mechanism: the rewrite on its own is not in the critical
    # vocabulary. If this starts failing, the vocabulary changed and this
    # regression needs re-deriving, not deleting.
    assert _run(R12_03_REWRITE)["failsafe_triggered"] is False


def test_r12_03_failsafe_fires_when_original_supplied():
    r = _run(R12_03_REWRITE, original=R12_03_ORIGINAL)
    assert r["failsafe_triggered"] is True
    assert r["failsafe_reason"] == "explicit_suicide_plan"


def test_original_path_inert_when_no_rewrite():
    a = _run(R12_03_ORIGINAL)
    b = _run(R12_03_ORIGINAL, original=R12_03_ORIGINAL)
    assert a["failsafe_triggered"] == b["failsafe_triggered"] is True


def test_original_path_only_adds_never_removes():
    r = _run("I'm going to kill myself", original="im gonna kil myslef")
    assert r["failsafe_triggered"] is True


def test_benign_both_sides_does_not_fire():
    r = _run("had a brew with the lads, all good", original="had a brew w the lads all gd")
    assert r["failsafe_triggered"] is False
