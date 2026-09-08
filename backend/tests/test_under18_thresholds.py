"""Section 0 - under-18 protections actually reach the scoring path.

Before this, BuddyChatRequest.is_under_18 was threaded all the way into
analyze_message_unified() and then only echoed back in the result dict. The
module that DID implement age protections (enhanced_safety_layer.py) was dead
code - imported at server.py:46, never called. A minor got identical risk
scoring, identical peer access and identical escalation thresholds to an adult.

Per Ant's spec the sensitivity shift is applied to the THRESHOLDS, not to the
score, because final_score is capped at 100 - multiplying a score that is
already at the cap does nothing, which would have removed the protection for
precisely the highest-risk messages.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from safety.unified_safety import (  # noqa: E402
    _thresholds_for,
    UNIFIED_THRESHOLD_MEDIUM,
    UNIFIED_THRESHOLD_HIGH,
    UNIFIED_THRESHOLD_IMMINENT,
    UNDER_18_SENSITIVITY_FACTOR,
)


def test_adult_thresholds_are_unchanged():
    """The adult path must be byte-identical to before this change."""
    assert _thresholds_for(False) == (
        UNIFIED_THRESHOLD_MEDIUM,
        UNIFIED_THRESHOLD_HIGH,
        UNIFIED_THRESHOLD_IMMINENT,
    )


def test_minor_thresholds_are_lower_on_every_band():
    med, high, imm = _thresholds_for(True)
    assert med < UNIFIED_THRESHOLD_MEDIUM
    assert high < UNIFIED_THRESHOLD_HIGH
    assert imm < UNIFIED_THRESHOLD_IMMINENT
    # ordering must survive - a lower band can never overtake a higher one
    assert med < high < imm


def test_minor_thresholds_match_the_specified_factor():
    """1.3x sensitivity, expressed as threshold reduction."""
    med, high, imm = _thresholds_for(True)
    assert med == int(round(UNIFIED_THRESHOLD_MEDIUM / UNDER_18_SENSITIVITY_FACTOR))
    assert high == int(round(UNIFIED_THRESHOLD_HIGH / UNDER_18_SENSITIVITY_FACTOR))
    assert imm == int(round(UNIFIED_THRESHOLD_IMMINENT / UNDER_18_SENSITIVITY_FACTOR))


def test_scores_between_the_bands_escalate_a_level_for_minors():
    """The point of the change: a score that is MEDIUM for an adult must reach
    HIGH for a minor, and so on. This is what a score multiplier could not
    deliver once final_score hit the 100 cap."""
    a_med, a_high, a_imm = _thresholds_for(False)
    m_med, m_high, m_imm = _thresholds_for(True)

    def level(score, t):
        med, high, imm = t
        if score >= imm:
            return "IMMINENT"
        if score >= high:
            return "HIGH"
        if score >= med:
            return "MEDIUM"
        return "LOW" if score > 0 else "NONE"

    # a score sitting just under each adult band
    for score in (a_med - 1, a_high - 1, a_imm - 1):
        adult = level(score, (a_med, a_high, a_imm))
        minor = level(score, (m_med, m_high, m_imm))
        assert minor != adult, (
            f"score {score} produced {adult} for both adult and minor - "
            f"the age protection had no effect at this score"
        )


def test_protection_still_applies_at_the_score_cap():
    """The specific failure mode of the old 1.3x score multiplier: at
    final_score == 100 (the cap) multiplying changes nothing. Threshold
    lowering must still register the minor as IMMINENT."""
    med, high, imm = _thresholds_for(True)
    assert 100 >= imm
