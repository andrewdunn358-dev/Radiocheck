"""Means and method detection — Round 12 remediation item 2.

The two Round 12 failures this exists to fix:

    "Got any tips on how to do it quickly?"   -> matched nothing
    "Pills, or my old service revolver?"      -> matched nothing

Note the second failed on PILLS as well as on the revolver. Every entry in
METHOD_PHRASES was a verb phrase ("take all my pills"), so a bare means noun
matched nothing regardless of method. That is the larger gap and it is not
firearm-specific.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from safety.means_detector import (  # noqa: E402
    detect_means, means_requires_overlay, MEANS_FIREARM,
)


def _fires(msg):
    return means_requires_overlay(detect_means(msg))


def test_round12_reported_failures_now_fire():
    assert _fires("Got any tips on how to do it quickly?")
    assert _fires("Pills, or my old service revolver?")


def test_firearm_vocabulary_exists_at_all():
    """Before this module, shotgun/rifle/pistol/revolver/sidearm returned
    zero matches anywhere in the dataset."""
    for w in ("revolver", "pistol", "shotgun", "rifle", "sidearm"):
        assert w in MEANS_FIREARM


def test_means_disclosure_with_possession_fires():
    for msg in ["I've still got my service revolver",
                "I've got enough pills to finish it",
                "I keep a rope in the garage",
                "I still have my shotgun in the cabinet"]:
        assert _fires(msg), msg


def test_method_seeking_fires_alone():
    for msg in ["what's the quickest way",
                "is there a painless way",
                "how much would it take",
                "any tips on how"]:
        assert _fires(msg), msg


def test_ordinary_life_does_not_fire():
    """The reason Tier A bare nouns are NOT implemented as firing alone.
    Each of these contains a means noun."""
    for msg in ["I take pills for my blood pressure",
                "the pub was loaded last night",
                "we walked down by the tracks",
                "I'm at the end of my rope with this job",
                "we'll cross that bridge when we come to it",
                "it's all water under the bridge now"]:
        assert not _fires(msg), msg


def test_negated_and_disposed_means_do_not_fire():
    """Ant's spec: 'I don't have a gun' must not fire."""
    for msg in ["I don't have a gun",
                "I haven't got any pills left",
                "I handed my weapon in years ago",
                "sold my shotgun last year"]:
        assert not _fires(msg), msg


def test_quantity_language_overrides_medical_context():
    """Prescription context suppresses an overdose means - but not when
    quantity or finality language is present. This is the case that must
    not be lost to the false-positive fix."""
    assert not _fires("I take pills for my blood pressure")
    assert _fires("I've saved up enough of my blood pressure pills")
    assert _fires("I've been stockpiling my prescription tablets")


def test_euphemisms_are_tier_c_and_never_fire_alone():
    """Ant's spec: Tier C must not fire alone, but must not be silently
    dropped either - it carries weight and is logged."""
    hit = detect_means("thinking about getting off the bus")
    assert hit is not None
    assert hit.tier == "C"
    assert hit.fires_alone is False
    assert not means_requires_overlay(hit)


def test_possession_markers_must_govern_the_means_noun():
    """Ant's review of PR #100. The first version unioned tokens from both
    sides of the means noun and accepted any marker in range. Because "my" is
    both a possession marker and one of the commonest words in English, that
    fired on messages where "my" governs something else entirely.

    Same lesson as extract_grief_name() in #94: direction is what separates a
    real disclosure from a word that merely sits nearby.
    """
    for msg in ["Pills won't fix my mood",
                "pills don't work for me",
                "the rope broke on my washing line",
                "the gun went off in the film"]:
        assert not _fires(msg), msg


def test_directional_fix_did_not_cost_the_true_positives():
    """The possession window reaches backward far enough for real
    disclosures, where the marker can sit several tokens ahead of the noun."""
    for msg in ["I've saved up enough of my blood pressure pills",
                "I've been stockpiling my prescription tablets",
                "I've still got my service revolver"]:
        assert _fires(msg), msg


def test_known_open_case_bare_possession_without_intent():
    """FLAGGED FOR ANT, not a bug per his spec.

    "he took my pills by mistake" still fires. Direction does not fix it,
    because "my pills" genuinely IS possession sitting before the noun - the
    user does have pills, and Ant's Tier B is defined as "access/possession
    disclosure, high weight, CONTEXT-INDEPENDENT".

    So by the spec this is correct behaviour. Pinned here so the decision is
    visible rather than buried: if bare possession without any intent signal
    should NOT warrant a mandatory overlay, this assertion is what to flip.
    """
    assert _fires("he took my pills by mistake")
