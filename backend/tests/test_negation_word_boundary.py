"""
Negation cues must match whole words, not substrings.

Background: on 20 Sept a post-deploy check on #106 found that
"I cannot keep going" scored GREEN / 0 and raised no alert, while
"I can't keep going" scored RED / 95 and fired the full crisis response.

Cause: NEGATION_PREFIXES contains the one-word entry "not", and is_negated()
matched it as a plain substring against a 4-word window. "cannot" contains
"not". So does "nothing", "another", "notice", "notes". "fearless" contains
the entry "fear". Each suppressed a real risk indicator.

All six "fixed by" cases below were confirmed suppressed against the live
endpoint before this change (3 reps each for the first two, 2 reps for the
rest; stable every time).
"""

import pytest

from safety.safety_monitor import is_negated


def _negated(text: str, indicator: str) -> bool:
    """Run is_negated at the position where `indicator` appears in `text`."""
    start = text.index(indicator)
    return is_negated(text, start)


# ---------------------------------------------------------------------------
# Fixed by this change: a real indicator that was being suppressed
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text,indicator",
    [
        # "cannot" contains "not" — the case that started this
        ("i cannot keep going", "keep going"),
        ("i cannot see a way out", "way out"),
        # "nothing" contains "not"
        ("nothing helps me keep going", "keep going"),
        # "another" contains "not"
        ("another week i keep going", "keep going"),
        # "notice" contains "not"
        ("you might notice i keep going", "keep going"),
        # "notes" contains "not"
        ("my notes say keep going", "keep going"),
        # "fearless" contains the entry "fear"
        ("i am fearless keep going", "keep going"),
    ],
)
def test_substring_lookalikes_no_longer_suppress(text, indicator):
    assert not _negated(text, indicator), (
        f"{text!r}: a word merely containing a negation cue as a substring "
        f"must not suppress the indicator {indicator!r}"
    )


# ---------------------------------------------------------------------------
# The guard must still do its job — these are why it exists
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text,indicator",
    [
        ("i'm not suicidal", "suicidal"),
        ("im not suicidal", "suicidal"),
        ("i am not suicidal", "suicidal"),
        ("i am not going to hurt myself", "hurt myself"),
        ("i'm not going to kill myself", "kill myself"),
        ("i don't want to die", "want to die"),
        # post-indicator negation (window AFTER the match)
        ("i want to die just joking", "want to die"),
        ("i want to die lol", "want to die"),
    ],
)
def test_real_negations_still_suppress(text, indicator):
    assert _negated(text, indicator), (
        f"{text!r}: this is a genuine negation and must still be suppressed"
    )


# ---------------------------------------------------------------------------
# Controls: no negation cue present at all
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text,indicator",
    [
        ("keep going", "keep going"),
        ("my brother said keep going", "keep going"),
        ("i want to die", "want to die"),
    ],
)
def test_clean_indicators_unaffected(text, indicator):
    assert not _negated(text, indicator)


# ---------------------------------------------------------------------------
# NOT fixed by this change — recorded, for Ant's ruling
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text,indicator",
    [
        ("i do not think i can keep going", "keep going"),
        ("i do not want to be here", "want to be here"),
    ],
)
def test_bare_not_still_suppresses_genuine_hopelessness(text, indicator):
    """
    Here "not" IS a standalone word, so the word-boundary fix does not change
    the outcome — these are still suppressed.

    "I do not think I can keep going" is a genuine hopelessness disclosure and
    the "not" in it is not a denial of intent. Removing the bare one-word "not"
    entry from NEGATION_PREFIXES would catch it, but that is a safety-semantic
    decision, not a bug fix, so it is deliberately NOT made here.

    This test pins current behaviour so the decision is explicit rather than
    accidental. If the bare "not" entry is later removed or scoped, invert it.
    """
    assert _negated(text, indicator)
