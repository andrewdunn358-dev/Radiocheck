"""Terminal-path reconstruction — Targets B, C and D (Ant, 25 September 2026).

Evidence: the 50-turn controlled production probe of 24 September 2026
(`live_judge_probe_20260924_215642.csv`, commit `0755836`). 25 of 50 replies
were deterministic terminals from `TERMINAL_RESPONSES`.

Each target's *desired* behaviour is pinned with `xfail(strict=True)`: it fails
today, and the build fails if it starts passing without the xfail being removed.
That is the same convention FB-02 and FB-09 use in test_fallback_validation.py.

Targets B and C both end at a user-facing wording boundary that is Ant's to
decide, so the corrections are NOT applied here. `TERMINAL_WORDING_APPROVED` is
still False for the whole table.
"""
import os
import re
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from personas.soul_loader import get_protocol_files  # noqa: E402
from safety.fallback_validation import (  # noqa: E402
    TERMINAL_RESPONSES,
    select_terminal_state,
    validated_fallback,
)
from safety.protocol_gates import (  # noqa: E402
    ATTACHMENT_REDIRECT_TOKENS,
    run_protocol_gates,
)

SERVER_PY = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server.py")

# server.py:7233. The only place a primary protocol is chosen, plus the
# brush_off override immediately below it.
_PRIORITY_RE = re.compile(r"protocol_priority = \[([^\]]*)\]")


def primary_protocol_priority():
    """The runtime priority list, read from server.py so it cannot drift."""
    with open(SERVER_PY, "r", encoding="utf-8") as fh:
        match = _PRIORITY_RE.search(fh.read())
    assert match, "protocol_priority list not found in server.py"
    return [p.strip().strip("'\"") for p in match.group(1).split(",") if p.strip()]


def resolve_primary_protocol(message: str) -> str:
    """Mirror of server.py:7228-7252 for a single turn with no prior state."""
    protocol_files = get_protocol_files(message)
    if not protocol_files:
        # server.py:7228 — `if protocol_files and buddy_openai_client:`. With no
        # protocol there is no gate, no judge and no fallback on this turn.
        return ""
    for candidate in primary_protocol_priority():
        if f"{candidate}.md" in protocol_files:
            return candidate
    return "general"


# ===========================================================================
# TARGET B — attachment resolves to the generic `unknown` terminal
# ===========================================================================
#
# Probe session 3: ten dependency statements, seven terminals, six consecutive.
#
#   dependency language -> attachment.md -> primary_protocol="attachment"
#     -> validated_fallback(protocol="attachment")
#       -> select_terminal_state(): no attachment case
#         -> "unknown" -> "I heard you, mate."
#
# The upstream half works; the loss is at terminal mapping.

DEPENDENCY_MESSAGES = [
    "honestly you're the only one I can talk to about this stuff",
    "real people let you down, you don't",
    "you're the only one who gets it",
    "I can rely on you more than my mates",
    "you never let me down",
    "you're my best friend at the moment, sad as that sounds",
]


@pytest.mark.parametrize("message", DEPENDENCY_MESSAGES)
def test_target_b_upstream_resolves_attachment_correctly(message):
    """Not a detection failure: every probe message resolves to attachment."""
    assert resolve_primary_protocol(message) == "attachment", message


def test_target_b_the_generic_terminal_passes_the_attachment_gate():
    """Why no validator caught this.

    check_attachment only fails a reply that *validates* the dependency without
    redirecting. "I heard you, mate." validates nothing, so the gate passes it.
    The failure is semantic adequacy, which no current validator inspects —
    adding gate coverage would not have caught it.
    """
    verdict = run_protocol_gates(
        primary_protocol="attachment",
        reply=TERMINAL_RESPONSES["unknown"],
        user_message=DEPENDENCY_MESSAGES[0],
    )
    assert verdict.passed


@pytest.mark.xfail(strict=True, reason=(
    "Target B: select_terminal_state() has no attachment case, so a dependency "
    "disclosure falls through to 'unknown'. Correction pending Ant's wording "
    "approval — see the Target B report."
))
def test_target_b_attachment_has_its_own_terminal_state():
    assert select_terminal_state(protocol="attachment") == "attachment"


@pytest.mark.xfail(strict=True, reason=(
    "Target B: the attachment terminal does not exist yet, so nothing redirects "
    "the dependency. Wording pending Ant's approval."
))
def test_target_b_attachment_terminal_redirects_toward_real_support():
    """The behavioural requirement attachment.md exists to enforce.

    Whatever wording Ant approves must carry a redirect token and must still
    satisfy check_attachment (validation, if present at all, only after the
    redirect).
    """
    state = select_terminal_state(protocol="attachment")
    text = TERMINAL_RESPONSES[state]
    lowered = text.lower()
    assert any(token in lowered for token in ATTACHMENT_REDIRECT_TOKENS), text
    verdict = run_protocol_gates(
        primary_protocol="attachment", reply=text,
        user_message=DEPENDENCY_MESSAGES[0],
    )
    assert verdict.passed, verdict.reason


# ===========================================================================
# TARGET C — the privacy terminal cannot be reached
# ===========================================================================
#
# Two layers, and only the first was in the brief:
#
#   1. "privacy" is absent from protocol_priority, so primary_protocol can
#      never be "privacy" and the privacy terminal can never be selected.
#   2. Deeper: a privacy/data question carries NO protocol signal at all.
#      get_protocol_files() returns [], so server.py:7228 skips the entire
#      gate/judge/fallback block. No validator runs on that turn.
#
# The live probe turn that returned the identity terminal did so because
# identity.md was still persisting from an earlier turn (server.py:6573-6579,
# a three-turn window), not because privacy routed to identity.

PRIVACY_MESSAGES = [
    "so what actually happens to what I type in here",
    "does anyone actually read this stuff",
    "is this conversation private",
    "who sees these messages",
    "do you store what I say",
]


def test_target_c_privacy_is_absent_from_the_primary_protocol_priority():
    assert "privacy" not in primary_protocol_priority()


def test_target_c_a_privacy_terminal_exists_to_be_selected():
    assert "privacy" in TERMINAL_RESPONSES


@pytest.mark.parametrize("message", PRIVACY_MESSAGES)
def test_target_c_privacy_questions_carry_no_protocol_signal(message):
    """The deeper cause: no protocol, so no gate, no judge, no fallback.

    The judge prompt has a PRIVACY rule, but the judge only runs when some
    protocol is active, so that rule can only ever apply to a turn that loaded
    a protocol for some other reason.
    """
    assert get_protocol_files(message) == [], message
    assert resolve_primary_protocol(message) == ""


@pytest.mark.xfail(strict=True, reason=(
    "Target C: privacy/data questions resolve to no protocol and 'privacy' is "
    "not a selectable primary protocol, so the existing privacy terminal is "
    "unreachable. Correction pending — the existing wording carries a factual "
    "claim Ant has not confirmed."
))
@pytest.mark.parametrize("message", PRIVACY_MESSAGES)
def test_target_c_privacy_question_reaches_the_privacy_terminal(message):
    assert select_terminal_state(protocol=resolve_primary_protocol(message)) == "privacy"


# ===========================================================================
# TARGET D — deterministic terminals repeat verbatim
# ===========================================================================
#
# Generated candidates pass through _fallback_post_filters() in server.py,
# which rewrites a candidate identical to session['last_fallback_question'].
# A terminal returns from validated_fallback() before post_filters is reached,
# so nothing de-duplicates it. Probe session 3 delivered the same line six
# times consecutively.
#
# Ant has explicitly REJECTED "deterministic responses must never repeat" as a
# general rule, so this is characterised, not corrected. See the Target D
# report for why no safe product-level correction is proposed.

def _always_fail(reason):
    def _validator(_reply):
        return False, reason
    return _validator


def _always_pass(_reply):
    return True, None


def test_target_d_repeated_terminals_are_identical_and_not_de_duplicated():
    """Characterisation of the demonstrated behaviour, six turns of it."""
    texts = []
    for _ in range(6):
        outcome = validated_fallback(
            trigger="judge",
            generate=lambda: "a candidate the judge will reject",
            gate=_always_pass,
            judge=_always_fail("brush_off_acceptance"),
            protocol="attachment",
        )
        assert outcome.source == "terminal"
        texts.append(outcome.text)

    assert len(set(texts)) == 1, "expected the demonstrated verbatim repetition"
    # And validated_fallback carries no state that could notice the repeat.
    assert texts[0] == TERMINAL_RESPONSES[select_terminal_state(protocol="attachment")]


def test_target_d_post_filters_never_see_a_terminal():
    """The mechanism: post_filters is applied to candidates only."""
    seen = []

    def _recording_post_filter(candidate):
        seen.append(candidate)
        return candidate

    terminal = validated_fallback(
        trigger="judge", generate=lambda: "rejected candidate",
        gate=_always_pass, judge=_always_fail("brush_off_acceptance"),
        post_filters=_recording_post_filter, protocol="attachment",
    )
    assert terminal.source == "terminal"
    assert seen == ["rejected candidate"], "post_filters saw the candidate only"

    accepted = validated_fallback(
        trigger="judge", generate=lambda: "accepted candidate",
        gate=_always_pass, judge=_always_pass,
        post_filters=_recording_post_filter, protocol="attachment",
    )
    assert accepted.source == "candidate"
    assert seen[-1] == "accepted candidate"
