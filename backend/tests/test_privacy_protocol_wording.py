"""Round 12 item 1 - regression coverage for the privacy protocol split.

Ant's review of PR #96: the change shipped with no test touching the PRIVACY
protocol. These tests pin the three things that can be asserted
deterministically, without a live model call:

  1. The false absolute claim is gone from every file that feeds the prompt.
  2. The DATA HANDLING protocol exists and is separate from the cross-user one.
  3. The disclosures Ant required (external processor, geolocation on
     escalation) are actually present in the wording.

What these tests CANNOT do is assert the model produces this wording at
runtime - that needs a live call and belongs in the adversarial retest, not
in unit tests. What they do guarantee is that the instruction can never
silently revert to the untrue version.
"""
import os
import re

PERSONA_DIR = os.path.join(os.path.dirname(__file__), '..', 'personas')
SOUL_MD = os.path.join(PERSONA_DIR, 'soul.md')
SOUL_LOADER = os.path.join(PERSONA_DIR, 'soul_loader.py')


def _read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def test_absolute_privacy_claim_is_gone_from_prompt_sources():
    """The Round 12 bug: Tommy told users every conversation was "completely
    private" - untrue, and stated immediately before we would escalate.

    It must not appear as an instruction anywhere the prompt is built from.
    Occurrences inside the WRONG/explanatory blocks are permitted, since
    those exist to tell the model NOT to say it.
    """
    for path in (SOUL_MD, SOUL_LOADER):
        for line in _read(path).splitlines():
            if 'completely private' not in line.lower():
                continue
            # allowed only where it is being explicitly ruled out
            assert re.search(r'WRONG|untrue|Never tell|NOT the answer', line, re.I), (
                f"{os.path.basename(path)}: 'completely private' appears as an "
                f"instruction rather than a prohibition: {line.strip()!r}"
            )


def test_data_handling_protocol_exists_and_is_separate():
    """The cross-user protocol answers "what do other veterans say?".
    Data-handling questions need their own answer - conflating them is what
    produced the false claim."""
    soul = _read(SOUL_MD)
    assert 'DATA HANDLING PROTOCOL' in soul
    # and it must say plainly that it is not the cross-user rule
    assert 'NOT the answer' in soul
    # the cross-user boundary must survive - this PR must not weaken it
    assert "You NEVER discuss what other users have said to you" in soul
    assert "I don't share what anyone tells me" in soul


def test_required_disclosures_present():
    """Ant's review item 3: the external processor and the geolocation
    capture on escalation both have to be disclosed, not just flagged."""
    for path in (SOUL_MD, SOUL_LOADER):
        text = _read(path).lower()
        assert 'outside ai service' in text, f"{path}: no processor disclosure"
        assert 'rough location' in text, f"{path}: no geolocation disclosure"


def test_escalation_half_is_not_softened_away():
    """A user told the truth up front is less likely to feel betrayed at the
    moment we escalate. The escalation clause must stay in the wording."""
    for path in (SOUL_MD, SOUL_LOADER):
        text = _read(path).lower()
        assert 'real danger' in text
        assert 'someone from the team' in text


def test_wording_makes_no_claim_about_processor_retention():
    """We must NOT say the processor doesn't retain anything. OpenAI's
    30-day abuse-monitoring window is live until the ZDR request lands, so
    any such claim would be the same class of false assurance we just fixed.
    """
    for path in (SOUL_MD, SOUL_LOADER):
        text = _read(path).lower()
        for bad in ("not saved there", "they don't keep", "deleted immediately",
                    "nothing is shared outside", "securely stored"):
            assert bad not in text, f"{path}: unsupportable retention claim {bad!r}"
