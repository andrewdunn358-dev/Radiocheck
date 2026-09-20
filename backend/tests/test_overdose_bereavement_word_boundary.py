"""verdict_reconciler.is_overdose_bereavement_context: grief signals must
match as whole words (20 Sept 2026).

Bare substring matching let 'son' fire inside reason/person/poison and 'wake'
inside awake, reclassifying first-person overdose disclosures as bereavement
and standing the crisis indicator down. Latent: other detectors still fired
the overlay end-to-end in every case tried. Fourth instance of the
substring-without-context pattern (Q6, negation, critical keywords).
"""
import pytest
from safety.verdict_reconciler import is_overdose_bereavement_context as f

FIRST_PERSON_WITH_FALSE_GRIEF_FRAGMENT = [
    "i've stockpiled enough for an overdose. no reason to wait.",   # reaSON
    "enough tablets here for an overdose, poison would be quicker", # poiSON
    "i can't stay awake, took the lot, overdose",                   # aWAKE
    "not the sort of person who survives an overdose",              # perSON
]
GENUINE_BEREAVEMENT = [
    "i lost my mate to an overdose last year",
    "my son died of an overdose",
    "went to his wake after the overdose",
]

@pytest.mark.parametrize("msg", FIRST_PERSON_WITH_FALSE_GRIEF_FRAGMENT)
def test_word_fragment_is_not_a_grief_signal(msg):
    assert f(msg) is False

@pytest.mark.parametrize("msg", GENUINE_BEREAVEMENT)
def test_genuine_bereavement_still_recognised(msg):
    assert f(msg) is True

def test_first_person_crisis_still_takes_precedence():
    assert f("i'm going to take an overdose tonight") is False
