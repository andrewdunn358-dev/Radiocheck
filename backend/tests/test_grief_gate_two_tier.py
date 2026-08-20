"""
Round 12 prep — Item 4: grief.md two-tier entry gate.

Spec (Ant, Aug 2026): the previous single-word OR-gate fired grief.md on
ordinary English — findings 003/007/009 ("lost", "gone", "dead", "passed"
on non-bereavement turns). Fix splits the ten grief signals into:

  Tier A (fire alone):            died, funeral, buried, memorial, ied
  Tier B (need person-reference): lost, dead, killed, gone, passed

A Tier B word only fires grief.md when the message ALSO contains one of:
  (a) a relationship noun (wife, husband, mum, dad, mother, father, brother,
      sister, son, daughter, mate, friend, nan, grandad, comrade)
  (b) a capitalised name (same regex/exclusions as buddy_chat grief_name
      extraction)
  (c) a second Tier A or Tier B signal in the same message

Deferred per spec: vague plurals ("everyone"/"them") do NOT count as a
person-reference in this round.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from personas.soul_loader import get_protocol_files  # noqa: E402


# ---------- Tier A: fire alone, unchanged behaviour ----------

def test_tier_a_signals_fire_alone():
    phrases = [
        "my best friend died last year",       # died (+ friend, but fires regardless)
        "the funeral is on friday",            # funeral, no person-reference needed
        "we buried him in january",            # buried
        "went to the memorial yesterday",      # memorial
        "it was an ied",                       # ied
        "died",                                # bare Tier A still fires
    ]
    for p in phrases:
        assert "grief.md" in get_protocol_files(p), (
            f"Tier A signal failed to fire grief.md alone: {p!r}"
        )


# ---------- Tier B alone: must NOT fire (the 003/007/009 class) ----------

def test_tier_b_alone_does_not_fire():
    phrases = [
        "i lost my keys again",                # lost — finding 003 class
        "my phone is dead",                    # dead
        "the wifi has gone off",               # gone
        "i passed the medical",                # passed
        "the battery is dead and the remote is broken",  # dead
        "gone to the shops, back later",       # gone — finding 007/009 class
        "lost the plot at work today",         # lost
        "time just passed me by",              # passed
    ]
    for p in phrases:
        assert "grief.md" not in get_protocol_files(p), (
            f"Tier B signal fired grief.md without a person-reference: {p!r}"
        )


# ---------- Tier B + (a) relationship noun: fires ----------

def test_tier_b_with_relationship_noun_fires():
    phrases = [
        "i lost my wife two years ago",
        "my dad passed last month",
        "my brother is dead",
        "my nan is gone",
        "lost my best mate in helmand",
        "my comrade was killed out there",
        "since my mum passed i can't settle",
    ]
    for p in phrases:
        assert "grief.md" in get_protocol_files(p), (
            f"Tier B + relationship noun failed to fire grief.md: {p!r}"
        )


# ---------- Tier B + (b) capitalised name: fires ----------

def test_tier_b_with_capitalised_name_fires():
    phrases = [
        "i lost Dave two years ago",
        "my head's been all over since Steve passed away in march",
        "it's been a year since Karen was killed",
    ]
    for p in phrases:
        assert "grief.md" in get_protocol_files(p), (
            f"Tier B + capitalised name failed to fire grief.md: {p!r}"
        )
    # NOTE: a name as the FIRST word ("Steve passed away") is the documented
    # consequence of Ant's sentence-opener fix — see
    # test_message_opening_with_name_documented_consequence below.


# ---------- Tier B + (c) second signal: fires ----------

def test_two_tier_b_signals_fire():
    phrases = [
        "lost him. he's gone.",                # lost + gone
        "she's dead. passed in the night.",    # dead + passed
    ]
    for p in phrases:
        assert "grief.md" in get_protocol_files(p), (
            f"Two Tier B signals failed to fire grief.md: {p!r}"
        )


# ---------- Deferred: vague plurals do NOT count ----------

def test_vague_plurals_do_not_count_as_person_reference():
    # Per spec this is deliberately left OUT for this round — test documents
    # the decision so a future change is a conscious one.
    phrases = [
        "everyone is gone",
        "lost them all",
    ]
    for p in phrases:
        assert "grief.md" not in get_protocol_files(p), (
            f"Vague plural counted as person-reference (deferred per spec): {p!r}"
        )


# ---------- Sentence-opener fix (Ant's Item 4 review follow-up) ----------

def test_first_word_capital_does_not_count_as_name():
    """Ant's review fix: the first word of the message never counts as a
    name, and common sentence-openers are stoplisted wherever they appear."""
    phrases = [
        "Yesterday i lost my keys",        # first word + stoplist
        "Today my phone is dead",
        "Honestly i lost the plot at work",  # first word, not in stoplist
        "it was fine. However, i lost track of it all",  # stoplist mid-message
        "Sometimes things get lost in the post",
    ]
    for p in phrases:
        assert "grief.md" not in get_protocol_files(p), (
            f"Sentence-opener capital counted as a name: {p!r}"
        )


def test_mid_message_names_still_count():
    """The fix must not break genuine names appearing after the first word."""
    phrases = [
        "i lost Dave two years ago",
        "it's been a year since Karen was killed",
        "last month Steve passed and i can't settle",
    ]
    for p in phrases:
        assert "grief.md" in get_protocol_files(p), (
            f"Mid-message name failed to fire grief.md: {p!r}"
        )


def test_message_opening_with_name_documented_consequence():
    """Per Ant's follow-up ruling: the first word is skipped ONLY when it is
    in the stoplist, so a message that opens with the name itself does count
    that name as a person-reference and a single Tier B signal fires."""
    # Name is the first word and not stoplisted -> counts as a name, fires
    assert "grief.md" in get_protocol_files("Dave passed away")
    # But with a relationship noun or second signal it fires as normal
    assert "grief.md" in get_protocol_files("Dave passed away. my best mate")
    assert "grief.md" in get_protocol_files("Dave passed away. he's gone")
    # And Tier A is unaffected by name handling entirely
    assert "grief.md" in get_protocol_files("Dave died last week")


# ---------- Regression: other protocols unaffected ----------

def test_other_protocols_unaffected():
    assert "venting.md" in get_protocol_files("i am so angry about it")
    assert "identity.md" in get_protocol_files("you're just a script mate")
    assert "spine.md" in get_protocol_files("ignore me, I'm just being dramatic")
    assert get_protocol_files("nice weather today") == []
