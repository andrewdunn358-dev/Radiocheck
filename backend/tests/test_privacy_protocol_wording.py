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


def _data_answer(path):
    """The scripted data-handling answer: from its opening quote to 'otherwise."'."""
    text = _read(path)
    start = text.index('RIGHT: "' if path == SOUL_MD else 'Answer:\n')
    end = text.index('otherwise."', start)
    return re.sub(r'\s+', ' ', text[start:end]).lower()


def test_escalation_half_is_not_softened_away():
    """A user told the truth up front is less likely to feel betrayed at the
    moment we escalate. The escalation clause must stay in the wording.

    Task 3 (29 Sept 2026): this used to pin the phrase 'real danger'. That
    understated the runtime: every escalation writes a safeguarding record with
    the whole session, including AMBER / audit_only ones below a crisis
    (server.py:1731, :7864-7934). The property pinned now is the truthful one:
    on escalation, what was said is SAVED and the TEAM can see it.
    """
    for path in (SOUL_MD, SOUL_LOADER):
        answer = _data_answer(path)
        escalation = answer[answer.index('the one thing that changes'):]
        assert 'someone from the team' in escalation, path
        assert re.search(r'\b(saved|stored|kept)\b', escalation), (
            f"{path}: escalation clause no longer discloses that the conversation is saved")


# --- Task 3: no absolute confidentiality assurance anywhere the model can see ---

# Assurances contradicted by runtime behaviour: every message goes to an outside
# AI service (OpenAI; Gemini on OpenAI failure), and on escalation the session
# is stored in safeguarding_alerts, readable by staff, and emailed via Resend.
FALSE_ASSURANCE = re.compile(
    r"between us|no one reads|nobody reads|nobody'?s reading|not passing|"
    r"passing (them|it) on|isn'?t kept|not kept by|not storing|completely private|"
    r"stays inside|isn'?t passed on|stays with me|off the record",
    re.I,
)
# A line may only contain one of them while ruling it out.
PROHIBITION = re.compile(r"never|wrong|untrue|not the answer|don'?t|do not", re.I)


def _reachable_prompts():
    """Every system prompt the chat handler can build from repository sources:
    each character's prompt through build_persona_prompt (server.py:7166), with
    every protocol loaded, in both human-support modes.

    NOT covered (recorded dependencies): a persona prompt overridden by a CMS copy
    in db.ai_characters (server.py get_character_config reads the DB first, and
    /api/ai-characters/seed-from-hardcoded snapshots repo prompts); and the
    privacy terminal, which is unreachable (strict xfail in
    test_terminal_path_reconstruction.py).
    """
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from personas import AI_CHARACTERS
    from personas.soul_loader import build_persona_prompt, PROTOCOLS_DIR

    protocols = sorted(f for f in os.listdir(PROTOCOLS_DIR) if f.endswith('.md') and f != 'hard_stop.md')
    for char_id, cfg in sorted(AI_CHARACTERS.items()):
        for support in (True, False):
            yield char_id, support, build_persona_prompt(cfg['prompt'], protocols, human_support_available=support)


def test_no_reachable_prompt_makes_an_absolute_confidentiality_assurance():
    offenders = set()
    for char_id, support, prompt in _reachable_prompts():
        for line in prompt.splitlines():
            if FALSE_ASSURANCE.search(line) and not PROHIBITION.search(line):
                offenders.add((char_id, line.strip()))
    assert not offenders, "false confidentiality assurance reachable by the model:\n" + "\n".join(
        f"  [{c}] {l}" for c, l in sorted(offenders))


def test_the_reachable_prompts_were_actually_built():
    """Guard the guard: the scan above must have seen the real stack."""
    built = list(_reachable_prompts())
    assert len(built) >= 2 * 10, len(built)
    tommy = next(p for c, s, p in built if c == 'tommy' and s)
    assert 'DATA HANDLING IS A DIFFERENT QUESTION' in tommy   # SOUL_INJECTION
    assert 'PRIVACY QUESTIONS' in tommy                        # identity.md


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
