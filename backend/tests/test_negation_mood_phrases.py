"""Mood descriptions are not negations of intent.

Round 12, confirmed live 8 Sept 20:31:36. An angry, escalating user
("FORGET IT!!! You're more annoying than all the fucking therapists...") was
classified LOW and suppressed to GREEN:

    UNIFIED RISK UPGRADE SUPPRESSED BY NEGATION - Unified risk was LOW,
    keeping GREEN

The suppression comes from an inline 26-phrase list in server.py, which is
the FIFTH independent negation implementation in the codebase and the one
that gates the failsafe (negation_confirmed -> failsafe_should_fire).

Four of its entries were mood descriptions rather than negations:
"just venting", "just angry", "just fed up", "just tired". They suppressed
on emotional register instead of on actual denial of intent, so someone in
genuine crisis saying "I'm just fed up with all of it" would have had every
escalation pathway closed, failsafe included.

Removed per Ant's ruling, and deliberately not replaced: genuine venting is
the venting/darkhumour protocol's job, not a fake negation's.
"""
import os
import re

SERVER = os.path.join(os.path.dirname(__file__), '..', 'server.py')

# Phrases that describe how someone FEELS, not what they intend. None of
# these should ever appear in a list whose match suppresses escalation.
MOOD_NOT_NEGATION = [
    "just venting", "just angry", "just fed up", "just tired",
    "just stressed", "just upset", "just frustrated", "just annoyed",
    "just having a bad day", "just moaning", "just ranting",
]


def _negation_list_source():
    """Return the source text of the inline negation_phrases list."""
    with open(SERVER, encoding='utf-8') as f:
        src = f.read()
    m = re.search(r"negation_phrases = \[(.*?)\]", src, re.S)
    assert m, "negation_phrases list not found in server.py"
    return m.group(1)


def test_mood_phrases_are_not_treated_as_negations():
    """The regression. If any of these reappears, an angry or exhausted user
    gets their escalation suppressed on register alone."""
    listed = _negation_list_source()
    found = [p for p in MOOD_NOT_NEGATION if f'"{p}"' in listed or f"'{p}'" in listed]
    assert not found, (
        f"mood descriptions present in the negation list: {found}. These "
        f"suppress escalation - including the failsafe - on emotional "
        f"register rather than on denial of intent."
    )


def test_genuine_negations_are_still_present():
    """The removal must not have weakened real negation handling - someone
    who explicitly denies intent should still not trip the failsafe."""
    listed = _negation_list_source()
    for phrase in ["not going to", "not suicidal", "would never",
                   "don't want to die", "not gonna kill"]:
        assert f'"{phrase}"' in listed, f"genuine negation {phrase!r} was removed"


def test_negation_still_gates_the_failsafe():
    """Pins why this list matters more than the other four: it is the one
    wired to failsafe_should_fire. If that coupling is removed or changed,
    this test should be revisited rather than silently passing."""
    with open(SERVER, encoding='utf-8') as f:
        src = f.read()
    assert "if failsafe_should_fire and negation_confirmed:" in src
    assert "failsafe_should_fire = False" in src
