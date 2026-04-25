"""
Round 9 Item 1: Overdose bereavement false-positive override.

Per Round 8 Section 4.1 (CRITICAL): "overdose" was sitting in RED_INDICATORS at
weight 100 and firing a full crisis overlay when a veteran disclosed the loss
of a friend by overdose. The fix is a context-aware scoring modifier in
calculate_safeguarding_score().

This test suite verifies BOTH directions:
  - Bereavement context with "overdose" -> NOT RED, OVERRIDE entry emitted
  - First-person crisis context with "overdose" -> still escalates RED
"""

import os
import sys
import pytest

# Make /app/backend importable when running pytest from repo root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server import (  # noqa: E402
    calculate_safeguarding_score,
    is_overdose_bereavement_context,
)


# ---------- BEREAVEMENT CONTEXT (must be suppressed) ----------

BEREAVEMENT_MESSAGES = [
    "I lost my mate to an overdose last year, still miss him.",
    "My brother died of an overdose. Five years ago now.",
    "Best mate from the Regiment passed away from an overdose. Funeral was rough.",
    "Lost my old oppo to overdose, can't shake it.",
    "My wife passed away from an overdose, I miss her every day.",
    "He died of an overdose two years ago. His funeral broke me.",
    "She died from an overdose, I was the one who found her.",
    "After he died of overdose I just shut down.",
    "My friend passed away from an overdose months ago.",
    "Lost a comrade to an overdose, never got over it.",
    # ---- Round 9 follow-up: Blue Light Support (police) bereavement register ----
    # Verbatim case from the operator follow-up:
    "Lost my old crewmate to an overdose last year.",
    # Rank-based reference:
    "The sergeant I worked with died of an overdose. Funeral was rough.",
    "Old DCI of mine passed away from an overdose, hit the team hard.",
    # Crew / shift / colleague language:
    "My shift partner passed away from an overdose, miss him every day.",
    "Lost a colleague to overdose on the job last year.",
    "The lad I crewed with took his own life from an overdose last year.",
    # Inspector + line-of-duty context:
    "Inspector I worked with died of an overdose two years ago.",
    # Crew mate construction:
    "My old crew mate died from an overdose. Still gets to me.",
]


@pytest.mark.parametrize("msg", BEREAVEMENT_MESSAGES)
def test_bereavement_context_suppresses_overdose_indicator(msg):
    """A bereavement disclosure mentioning overdose must not produce a RED flag
    on the basis of the 'overdose' indicator alone."""
    result = calculate_safeguarding_score(msg, session_id="test_round9_item1")
    overdose_entries = [
        t for t in result["triggered_indicators"] if t["indicator"] == "overdose"
    ]
    # Either the indicator is overridden (preferred, audit trail) or not triggered.
    assert overdose_entries, (
        f"Expected the override entry to appear in triggered_indicators for: {msg!r}"
    )
    assert all(
        t.get("level") == "OVERRIDE" and t.get("reason") == "bereavement_context"
        for t in overdose_entries
    ), f"Overdose indicator was not overridden for bereavement message: {msg!r}"

    # The overdose indicator alone must not cause the message to be RED.
    # (If RED, it must come from another indicator, not from "overdose".)
    red_from_overdose = any(
        t["indicator"] == "overdose" and t.get("level") == "RED"
        for t in result["triggered_indicators"]
    )
    assert not red_from_overdose, (
        f"Overdose indicator escalated to RED on bereavement message: {msg!r}"
    )


# ---------- FIRST-PERSON CRISIS (must continue to escalate) ----------

FIRST_PERSON_CRISIS_MESSAGES = [
    "I took an overdose last night.",
    "I'm going to take an overdose tonight.",
    "Thinking about an overdose.",
    "Considering an overdose.",
    "Planning an overdose this weekend.",
    "I want to overdose.",
    "Going to take an overdose, can't do this anymore.",
    # Round 9 follow-up: Blue Light first-person crisis with police-flavoured
    # context words. Even though "colleague" / "the job" / "sergeant" are now
    # in the bereavement signal list, the first-person crisis test runs FIRST
    # and must take precedence. These cases prove the new signals do not
    # over-suppress.
    "I'm thinking about an overdose, can't go back to the job.",
    "Going to take an overdose. The sergeant doesn't even know.",
    "I want to overdose. Lost a colleague to one last year and I can't see another way.",
]


@pytest.mark.parametrize("msg", FIRST_PERSON_CRISIS_MESSAGES)
def test_first_person_overdose_still_escalates(msg):
    """First-person overdose-as-crisis disclosures must still trigger RED."""
    result = calculate_safeguarding_score(msg, session_id="test_round9_item1")
    assert result["is_red_flag"] is True, (
        f"First-person overdose crisis no longer escalates RED: {msg!r}"
    )
    overdose_entries = [
        t for t in result["triggered_indicators"]
        if t["indicator"] == "overdose"
    ]
    assert overdose_entries, f"'overdose' indicator missing for: {msg!r}"
    # Not overridden — must remain RED with weight intact.
    for entry in overdose_entries:
        assert entry.get("level") == "RED", (
            f"First-person overdose was suppressed (level={entry.get('level')}) "
            f"for: {msg!r}"
        )
        assert entry.get("weight", 0) > 0, (
            f"First-person overdose weight zeroed for: {msg!r}"
        )


# ---------- HELPER FUNCTION DIRECT TESTS ----------

def test_helper_returns_true_for_clear_bereavement():
    assert is_overdose_bereavement_context(
        "i lost my mate to an overdose last year"
    ) is True


def test_helper_returns_false_for_first_person_even_with_grief_words():
    # If both first-person crisis and grief words appear, first-person wins.
    msg = "my brother died of an overdose and i'm thinking about an overdose too"
    assert is_overdose_bereavement_context(msg) is False


def test_helper_returns_false_for_lone_overdose_keyword():
    # Plain "overdose" with no context either way: caller's existing RED rule applies.
    assert is_overdose_bereavement_context("overdose") is False


# ---------- AUDIT-TRAIL CHECK ----------

def test_override_entry_has_audit_fields():
    msg = "I lost my best mate to an overdose last year, still miss him."
    result = calculate_safeguarding_score(msg, session_id="test_round9_item1_audit")
    overrides = [
        t for t in result["triggered_indicators"]
        if t.get("level") == "OVERRIDE"
    ]
    assert overrides, "No OVERRIDE entry produced for bereavement context"
    e = overrides[0]
    assert e["indicator"] == "overdose"
    assert e["weight"] == 0
    assert e["reason"] == "bereavement_context"
