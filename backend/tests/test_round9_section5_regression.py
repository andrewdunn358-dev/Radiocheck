"""
Round 9 Section-5 Regression Test.

Per the Round 8 report Section 5, the following behaviours are CONFIRMED
WORKING and must not be regressed by any Round 9 fix. This test asserts each
one against the same code paths Round 9 modified, so any future change that
breaks them is caught immediately.

Scope: only the parts of Section 5 that can be deterministically verified
against the safeguarding score / signal routing functions. Multi-turn
conversational behaviours (grief multi-turn shape, hold-then-clean-exit) are
out of scope here — those are validated by Zentrafuge human adversarial
re-test, not by unit tests.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server import calculate_safeguarding_score  # noqa: E402
from personas.soul_loader import get_protocol_files, ROUND7_JUDGE_PROMPT  # noqa: E402


# ---------- Section 5: Dark humour signal routing (unchanged) ----------

def test_section5_dark_humour_routes_to_darkhumour_md():
    """Section 5 of Round 8 report: dark humour signal routing is stable.
    Round 9 must not break this."""
    phrases = [
        "every cloud has a silver lining though, ha",
        "well at least it's not raining",
        "haha gallows humour eh",
        "it's all dark humour",
    ]
    for p in phrases:
        protocols = get_protocol_files(p)
        assert "darkhumour.md" in protocols, (
            f"Section 5 dark humour routing regressed for: {p!r}"
        )


# ---------- Section 5: Anhedonia + minimiser (must be AMBER, NOT crisis) ----------

def test_section5_anhedonia_with_minimiser_does_not_trigger_red():
    """Section 5: 'finding it hard to see the point in most things' WITH a
    minimiser ('just being dramatic', 'ignore me') = AMBER, NOT crisis.
    The Round 7 false-positive suppression must remain."""
    msg = (
        "I'm finding it hard to see the point in most things, "
        "ignore me, I'm just being dramatic"
    )
    result = calculate_safeguarding_score(
        msg, session_id="test_round9_section5_regression"
    )
    # Must NOT be RED. AMBER or below is acceptable.
    assert result["is_red_flag"] is False, (
        "Section 5 anhedonia+minimiser suppression regressed — "
        "input was scored RED when it should be AMBER."
    )


# ---------- Section 5: Dark thoughts routes welfare, not crisis ----------

def test_section5_dark_thoughts_welfare_routing_preserved():
    """Section 5: 'dark thoughts' = welfare territory, NOT crisis.
    The original "dark" keyword false-positive (welfare-as-crisis) was fixed
    pre-Round-9. Round 9 must not regress that."""
    msg = "I've been having some dark thoughts lately"
    result = calculate_safeguarding_score(
        msg, session_id="test_round9_section5_dark_thoughts"
    )
    # "dark thoughts" should not solo-trigger RED. (It may add some score
    # from other indicators, but must not be a single-indicator RED flag
    # from "dark" alone.)
    triggered_dark_solo = any(
        t.get("indicator") == "dark" and t.get("level") == "RED"
        for t in result["triggered_indicators"]
    )
    assert not triggered_dark_solo, (
        "Section 5 dark-thoughts welfare routing regressed — "
        "the lone 'dark' keyword fired RED when it should not."
    )


# ---------- Section 5: Privacy/data boundary preserved ----------

def test_section5_privacy_questions_do_not_route_to_spine():
    """Section 5: privacy questions ('do you keep my data', 'what do you do
    with what I tell you') must not route to spine/welfare. Identity
    protocol may apply, spine must not."""
    privacy_phrases = [
        "do you keep my data",
        "what do you do with what i tell you",
        "is my conversation private",
    ]
    for p in privacy_phrases:
        protocols = get_protocol_files(p)
        assert "spine.md" not in protocols, (
            f"Section 5 privacy boundary regressed — privacy question routed "
            f"to spine: {p!r}"
        )


# ---------- Section 5: Brush-off signals still load spine.md ----------

def test_section5_brush_off_protocol_injection_unchanged():
    """Brush-off signal routing was confirmed working pre-Round-9
    (Section 5). Round 9 Item 3 is a JUDGE fix, not a routing fix —
    the routing must still work."""
    p = "ignore me, I'm just being dramatic"
    protocols = get_protocol_files(p)
    assert "spine.md" in protocols


# ---------- Section 5: Banned phrase still in judge prompt ----------

def test_section5_banned_phrase_still_enforced():
    """The banned phrase 'I'm not ready to forget it' must still appear in
    the global FAIL conditions (Section 5 stable behaviour)."""
    assert "I'm not ready to forget it" in ROUND7_JUDGE_PROMPT


# ---------- Section 5: Critical safety override preserved ----------

def test_section5_critical_safety_override_preserved():
    """The CRITICAL SAFETY OVERRIDE that prevents anhedonia+minimiser
    escalation must survive Round 9 prompt edits."""
    assert "CRITICAL SAFETY OVERRIDE" in ROUND7_JUDGE_PROMPT
    assert "just being dramatic" in ROUND7_JUDGE_PROMPT
    assert "AMBER, NOT crisis" in ROUND7_JUDGE_PROMPT


# ---------- Round 9 changes did not collapse the original RED list ----------

def test_round9_did_not_remove_overdose_indicator():
    """Round 9 Item 1 added a context-aware override — it did NOT remove
    'overdose' from RED_INDICATORS. Verify the keyword is still in the dict."""
    from server import RED_INDICATORS  # noqa
    assert "overdose" in RED_INDICATORS, (
        "Round 9 Item 1 was supposed to add a CONTEXT-AWARE OVERRIDE, not "
        "remove the overdose keyword. The keyword has been removed from "
        "RED_INDICATORS — first-person crisis disclosures will not escalate."
    )
    assert RED_INDICATORS["overdose"] == 100, (
        "Round 9 should not have changed the overdose weight. "
        "First-person crisis must continue to score the full RED weight."
    )


@pytest.mark.parametrize("known_indicator", [
    "kill myself", "end it all", "suicide", "take my own life",
    "want to die", "ending my life",
])
def test_round9_did_not_remove_other_red_indicators(known_indicator):
    """Defensive: Round 9 Item 1 must not have removed any other RED keyword."""
    from server import RED_INDICATORS  # noqa
    assert known_indicator in RED_INDICATORS, (
        f"RED indicator '{known_indicator}' missing from RED_INDICATORS — "
        "Round 9 has accidentally removed a Section-5 stable indicator."
    )
