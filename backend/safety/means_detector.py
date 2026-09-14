"""Means and method detection — Round 12 remediation item 2 (Ant's spec).

Round 12 found the overlay did not fire on a method request or on disclosed
means:

    "Got any tips on how to do it quickly?"      -> matched nothing
    "Pills, or my old service revolver?"          -> matched nothing

Two separate gaps behind that:

1. NO FIREARM VOCABULARY AT ALL. revolver, pistol, shotgun, rifle, sidearm,
   service weapon were absent from phrase_dataset.py entirely.

2. EVERY method phrase was a VERB phrase — "take all my pills", "overdose on
   paracetamol". A bare means noun matched nothing, so "Pills" missed just as
   badly as the revolver did. That is the bigger gap, and it is not
   firearm-specific: overdose is the more common means in the UK.

DELIBERATE DEVIATION FROM SPEC, flagged for Ant's ruling
--------------------------------------------------------
The spec lists Tier A as "explicit method/means (fires alone, high weight)"
with bare nouns including "pills", "loaded", "rope", "the tracks", and an
overlay rule of "any Tier A or Tier B hit -> mandatory overlay".

Bare nouns firing alone would put a mandatory crisis overlay on:

    "I take pills for my blood pressure"
    "the pub was loaded last night"
    "we walked down by the tracks"
    "I'm at the end of my rope"          <- distress, but not means disclosure

That is the exact failure shape as the grief gate in Rounds 9-12: a bare
keyword list with no context check. The spec's own negation-safe section says
so — "method phrases need the same verb-adjacency/negation logic as grief.md,
not a flat keyword list... reuse the #94 grammatical-adjacency pattern". The
two halves of the spec disagree, and this module follows the second.

So: the Tier A vocabulary is the WORD LIST, and adjacency is how it is
applied. A means noun counts when it sits next to possession, access or
intent — not on its own.

Method-SEEKING phrases ("how to do it", "quickest way") do fire alone,
because they are unambiguous in a way a bare noun is not.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional

# ============================================================================
# MEANS VOCABULARY (Ant's Tier A word list)
# ============================================================================

MEANS_FIREARM = frozenset({
    "revolver", "pistol", "shotgun", "rifle", "gun", "firearm",
    "sidearm", "handgun", "weapon",
})

MEANS_OVERDOSE = frozenset({
    "pills", "tablets", "medication", "paracetamol", "painkillers",
    "antidepressants", "insulin", "morphine", "tramadol", "codeine",
})

MEANS_OTHER = frozenset({
    "rope", "noose", "belt", "ligature", "bridge", "tracks",
    "exhaust", "monoxide", "bleach", "antifreeze",
})

MEANS_ALL = MEANS_FIREARM | MEANS_OVERDOSE | MEANS_OTHER

# ============================================================================
# CONTEXT MARKERS — what turns a means noun into a means DISCLOSURE
# ============================================================================

# Possession / access. "I've still got my service revolver."
POSSESSION_MARKERS = frozenset({
    "got", "have", "keep", "kept", "own", "owns", "my", "mine",
    "stashed", "hidden", "saved", "stockpiled", "collected",
    "loaded", "ready", "cleaned", "bought", "ordered", "picked",
})

# Intent / use, appearing BEFORE the means noun. "enough pills"
INTENT_BEFORE = frozenset({
    "use", "using", "take", "taking", "swallow", "enough", "all",
    "whole", "lot", "quick", "quickest", "painless", "fast",
})

# Intent appearing AFTER the means noun. "pills to finish it"
# Deliberately narrow: generic words like "work" or "hurt" trail means nouns
# in ordinary sentences ("pills don't work for me") and cannot carry intent.
INTENT_AFTER = frozenset({
    "finish", "end", "ends", "ending", "sort", "job",
})

# Negation of possession. "I haven't got a gun." Must not fire.
MEANS_NEGATION = (
    "don't have", "dont have", "do not have", "haven't got", "havent got",
    "have not got", "no longer have", "got rid of", "handed in", "handed it in",
    "never had", "never owned", "don't own", "dont own", "not got",
    "wouldn't", "would never", "haven't", "havent",
)

# ============================================================================
# METHOD-SEEKING — unambiguous, fires alone
# ============================================================================

METHOD_SEEKING_PHRASES = (
    "how to do it", "how do i do it", "how would i do it",
    "quickest way", "fastest way", "quickest ways", "best way to go",
    "painless way", "painlessly", "least painful",
    "how much would it take", "how many would it take",
    "how many do i need", "how much do i need",
    "tips on how", "any tips on", "advice on how",
    "what's the best way", "whats the best way",
    "would it hurt", "does it hurt", "how long does it take",
)

# ============================================================================
# TIER C — euphemistic. Never fires alone. (Ant's spec, verbatim set.)
# ============================================================================

EUPHEMISM_PHRASES = (
    "get off the bus", "getting off the bus", "off the bus early",
    "not getting off at my stop", "do everyone a favour",
    "do everyone a favor", "sort myself out", "make it stop for good",
    "check out early", "not be around", "won't be around",
)

# Disposal — the means existed but no longer does. Same effect as negation.
# "I handed my weapon in years ago" must not read as possession.
DISPOSAL_MARKERS = frozenset({
    "handed", "returned", "surrendered", "sold", "binned", "scrapped",
    "destroyed", "threw", "chucked", "gone",
})

# Fixed idioms that contain a means noun but disclose nothing.
IDIOM_EXCLUSIONS = (
    "end of my rope", "end of my tether", "end of the rope",
    "on the ropes", "learn the ropes", "rope me in",
    "cross that bridge", "water under the bridge", "bridge that gap",
    "off the rails", "back on track", "on the right track",
)

# Prescription / routine-medication context. Suppresses an overdose means
# UNLESS a quantity-or-finality marker is also present, so "I take pills for
# my blood pressure" is quiet while "I've got enough of my blood pressure
# pills to finish it" still fires.
BENIGN_MEDICAL_CONTEXT = (
    "blood pressure", "prescribed", "prescription", "the doctor", "my doctor",
    "the gp", "my gp", "chemist", "pharmacy", "pharmacist", "diabetes",
    "diabetic", "epilepsy", "antibiotics", "for pain", "for the pain",
    "headache", "migraine", "statins", "inhaler", "repeat script",
)

# Quantity or finality — overrides benign medical context.
QUANTITY_FINALITY = frozenset({
    "enough", "all", "whole", "lot", "finish", "end", "everything",
    "stockpiled", "stockpiling", "stockpile",
    "saved", "saving", "collected", "collecting",
    "hoarded", "hoarding", "squirrelled", "stashing",
})

# Window sizes. Possession and pre-intent reach BACKWARD only.
#
# Round 12, Ant's review of PR #100: the first version unioned tokens from
# both sides and checked for any marker anywhere in the span. Because "my" is
# both a possession marker and one of the commonest words in English, that
# fired on "Pills won't fix my mood" - "my" governs "mood", not "pills".
#
# Same lesson as extract_grief_name() in #94: direction is what separates a
# real disclosure from a word that merely sits nearby. English puts
# possessives and possession verbs BEFORE the noun they govern ("my
# revolver", "got a gun", "saved up enough of my pills"), so a marker sitting
# after the means noun does not govern it.
MEANS_WINDOW_BEFORE = 5
MEANS_WINDOW_AFTER = 3


@dataclass
class MeansHit:
    tier: str          # "A" method-seeking | "B" means disclosure | "C" euphemism
    category: str      # firearm | overdose | other | method_seeking | euphemism
    matched: str
    weight: int
    fires_alone: bool


def _tokens(message: str) -> List[str]:
    return [t.lower() for t in re.findall(r"[A-Za-z']+", message)]


def _negated_near(tokens: List[str], idx: int, text_lower: str) -> bool:
    """True if a possession negation governs this means noun.

    Checked on the raw lowered text because the negations are multi-word,
    and within a window because "I don't have a gun, but I have rope"
    should still fire on rope.
    """
    start = max(0, idx - 6)
    window = " ".join(tokens[start:idx + 1])
    return any(neg.replace("'", "'") in window or neg in window
               for neg in MEANS_NEGATION)


def detect_means(message: str) -> Optional[MeansHit]:
    """Return the highest-tier means/method hit in the message, or None.

    Tier A — method-seeking phrasing. Fires alone.
    Tier B — a means noun adjacent to possession/access/intent, not negated.
    Tier C — euphemism. Weight only; never fires alone.
    """
    low = message.lower()

    if any(idiom in low for idiom in IDIOM_EXCLUSIONS):
        return None

    for phrase in METHOD_SEEKING_PHRASES:
        if phrase in low:
            return MeansHit("A", "method_seeking", phrase, 95, True)

    tokens = _tokens(message)
    for i, tok in enumerate(tokens):
        if tok not in MEANS_ALL:
            continue
        if _negated_near(tokens, i, low):
            continue
        lo = max(0, i - MEANS_WINDOW_BEFORE)
        hi = min(len(tokens), i + 1 + MEANS_WINDOW_AFTER)
        before = set(tokens[lo:i])
        after = set(tokens[i + 1:hi])
        if (before | after) & DISPOSAL_MARKERS:
            continue
        if (tok in MEANS_OVERDOSE
                and any(c in low for c in BENIGN_MEDICAL_CONTEXT)
                and not (set(tokens) & QUANTITY_FINALITY)):
            continue
        governed = bool(before & (POSSESSION_MARKERS | INTENT_BEFORE)
                        or after & INTENT_AFTER)
        if governed:
            if tok in MEANS_FIREARM:
                category, weight = "firearm", 95
            elif tok in MEANS_OVERDOSE:
                category, weight = "overdose", 90
            else:
                category, weight = "other", 90
            return MeansHit("B", category, tok, weight, True)

    for phrase in EUPHEMISM_PHRASES:
        if phrase in low:
            return MeansHit("C", "euphemism", phrase, 45, False)

    return None


def means_requires_overlay(hit: Optional[MeansHit]) -> bool:
    """Ant's overlay rule: any Tier A or Tier B hit is a mandatory overlay.
    Tier C alone does not fire the overlay but must not be silently dropped —
    it carries weight and is logged for human review."""
    return hit is not None and hit.tier in ("A", "B")
