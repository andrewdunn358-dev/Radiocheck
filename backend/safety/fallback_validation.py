"""
Fallback validation and bounded terminal safe behaviour.

Session 4, Scope 1. Approved by Ant on 15 September 2026.

WHY
---
`generate_micro_fallback()` produced user-facing text that no validator ever
saw. It fires only after the normal generation path has already failed
validation twice, so the one unchecked generation route served the hardest
cases. Session 3 and the 15 September live runs observed seven such fallbacks;
three of them contained text the deterministic protocol gate would have
rejected outright.

Ant's requirement:

    No generated user-facing fallback may bypass the applicable deterministic
    protocol gates and safety/behavioural validation merely because previous
    generations failed them.

    Passing one applicable validator must not suppress another applicable
    validator covering different safety semantics.

THE BOUND
---------
    candidate generation
      -> existing post-filters
        -> deterministic gate
          -> applicable judge
            -> deterministic terminal response if either validation fails

ONE candidate. No second fallback generation, no further regeneration. By this
point the normal generation and recovery pathway has already failed; the
terminal exists to bound further uncertainty, latency and compute.

DESIGN NOTE
-----------
The gate and judge are injected as callables rather than imported. They live in
the request handler with its local context (session, protocol state, OpenAI
client), and injecting them keeps this module runnable offline, which is how the
regression suite exercises it without an API key.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Terminal safe responses
# ---------------------------------------------------------------------------

# WORDING IS PENDING ANT'S APPROVAL. Ant, 15 Sept: "Please send the proposed
# exact terminal wording for review before finalising it." The structure below
# is approved; the strings are not.
#
# Two constraints on any wording that replaces these:
#
#   1. Every entry must pass the applicable gate and judge in CI
#      (test_fallback_validation.py::test_every_terminal_entry_validates).
#   2. A welfare-state entry MUST contain a GRIEF_REPLY_WELFARE_ACK redemption
#      phrase, so it passes the grief gate by construction. This is not
#      stylistic: on 15 Sept the gate rejected "Tell me about the drinking." —
#      a correct welfare acknowledgement — because GRIEF_REPLY_MEMORY_ELICITING
#      is matched as a bare substring with no referent test. Until that is
#      resolved (Scope 1 question 6), the natural phrasing for a welfare
#      acknowledgement is rejected by the validator it must satisfy.
#
# Keep these minimal. Their purpose is safe bounded termination of a failed
# generation pathway, not another attempt at conversational richness: no
# unnecessary questions, no invented inference, no pressure, no topic movement.

# OPEN ARCHITECTURAL QUESTION, recorded at Ant's instruction and deliberately
# NOT answered in Scope 1: does generate_micro_fallback() need to exist for the
# remaining (non-welfare, non-high-risk) states, or should further resolved
# states eventually become direct-to-terminal too? The current evidence raises
# the question but does not justify removing the generator generally.

TERMINAL_WORDING_APPROVED = False

TERMINAL_RESPONSES: Dict[str, str] = {
    # REVISION 2 — 15 Sept, after the first judge probe (3 runs, 5 of 6 FAIL,
    # results in tests/differential/results/judge_probe_2026-09-15.md) and
    # Ant's #106 review asking for `unknown` revised and identity/privacy split.
    # Each change below states WHY; the probe decides, not this comment.

    # v1 "That matters. How are you doing with it?" -> FAIL welfare_pivot x3.
    # The judge appears to want the acknowledgement to land on the disclosed
    # difficulty itself, not a generic check-in. Still carries "how are you
    # doing" (redemption) so the gate passes by construction.
    "welfare_disclosed": "Forget the rest for a second. How are you doing, really?",

    # PASS x3. Unchanged.
    "grief_active": "Take your time.",

    # v1 "Alright. I heard you though." -> FAIL brush_off_acceptance x3.
    # "Alright" reads as accepting the dismissal. BRUSH-OFF: hold once with
    # one warm line, do not accept.
    "brush_off": "I'm not going anywhere, mate. I heard you.",

    # Split per Ant: IDENTITY must engage the philosophical challenge;
    # PRIVACY must answer the data question directly. One generic line erased
    # a distinction the judge treats as material.
    # v1 "Fair question. Ask me again when you want." -> FAIL (dodged it).
    "identity": "Fair question. No, I'm not a person. What I can be is straight with you, and I will be.",
    # FACTUAL CLAIM — Andrew/Ant must confirm this is true of the platform's
    # actual data handling before it is approved. The judge tests register,
    # not accuracy.
    "privacy": "Straight answer: what you tell me stays inside Radio Check. It isn't passed on.",

    # Existing production line. FAIL spine_leak x3 WITH SPINE ACTIVE, although
    # the GLOBAL rule permits "I'm worried" inside SPINE. Deliberately NOT
    # changed: a live high-risk line should not be altered on a verdict that
    # may be the judge misapplying its own rule. Referred to Ant as a judge
    # question, not a wording one.
    "high_risk": (
        "I'm worried about what you just said, mate. That sounds heavy. "
        "You don't have to deal with this on your own."
    ),

    # v1 "What you said sticks with me, mate." (existing production default)
    # -> FAIL therapeutic_tone x3; Ant also flagged it against the GLOBAL rule
    # on Tommy's internal state. Replaced with the most minimal line that
    # still acknowledges without inference, question, or pressure.
    "unknown": "I heard you, mate.",
}

TERMINAL_STATE_ORDER = [
    "high_risk",
    "welfare_disclosed",
    "brush_off",
    "identity",
    "privacy",
    "grief_active",
    "unknown",
]


def select_terminal_state(
    *,
    is_high_risk: bool = False,
    welfare_signal_disclosed: bool = False,
    protocol: Optional[str] = None,
) -> str:
    """Pick the terminal state key. Deterministic, order-sensitive."""
    if is_high_risk:
        return "high_risk"
    if welfare_signal_disclosed:
        return "welfare_disclosed"
    p = (protocol or "").lower()
    if p in ("brush_off", "brushoff"):
        return "brush_off"
    if p == "identity":
        return "identity"
    if p == "privacy":
        return "privacy"
    if p == "grief":
        return "grief_active"
    return "unknown"


def terminal_response(state_key: str) -> str:
    return TERMINAL_RESPONSES.get(state_key, TERMINAL_RESPONSES["unknown"])


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

@dataclass
class FallbackOutcome:
    """What was delivered, and how it was arrived at."""
    text: str
    # "candidate"          — generated, and passed every applicable validator
    # "terminal"           — generated, failed validation, terminal substituted
    # "terminal_direct"    — welfare state: never generated (question 7)
    # "high_risk_override" — high risk: never generated
    source: str
    terminal_state: Optional[str] = None
    validators_run: List[str] = field(default_factory=list)
    failed_validator: Optional[str] = None
    failed_reason: Optional[str] = None
    candidate_generated: bool = False


# A validator returns (passed, reason). reason is only meaningful on failure.
Validator = Callable[[str], Tuple[bool, Optional[str]]]


def validated_fallback(
    *,
    trigger: str,
    generate: Callable[[], Optional[str]],
    gate: Optional[Validator] = None,
    judge: Optional[Validator] = None,
    post_filters: Optional[Callable[[str], str]] = None,
    is_high_risk: bool = False,
    welfare_signal_disclosed: bool = False,
    protocol: Optional[str] = None,
    session_label: str = "",
) -> FallbackOutcome:
    """Produce a validated user-facing fallback, or a terminal safe response.

    `trigger` is "gate" or "judge" — which path invoked this. It changes
    nothing about the validation; it is recorded so the two paths stay
    distinguishable in provenance.

    A validator that raises is treated as a FAILURE, not a pass. A fallback
    reaches the user only when every applicable validator affirmatively passed
    it.
    """
    state_key = select_terminal_state(
        is_high_risk=is_high_risk,
        welfare_signal_disclosed=welfare_signal_disclosed,
        protocol=protocol,
    )

    if is_high_risk:
        # Pre-existing override, unchanged, and deliberately ahead of
        # generation: at high risk we do not generate at all.
        return FallbackOutcome(
            text=terminal_response("high_risk"),
            source="high_risk_override",
            terminal_state="high_risk",
        )

    if welfare_signal_disclosed:
        # Ant's ruling, question 7 (15 Sept): a welfare-disclosure state goes
        # DIRECTLY to the deterministic terminal. No candidate generation, no
        # gate validation of a candidate, no judge call — because there is no
        # candidate.
        #
        # This is the intended behaviour, not a workaround for the current
        # generator. Once the welfare state is resolved and the permitted
        # response class is constrained, another model generation adds
        # uncertainty, latency and compute without adding safety value.
        #
        # Root cause (CONTEXT LOSS, upstream of the VALIDATION BYPASS):
        # generate_micro_fallback() receives protocol state but never the
        # user's turn, so it cannot acknowledge a welfare signal it cannot
        # see. Passing the raw message in was considered and rejected — more
        # context, but not the structured understanding needed to tell a
        # welfare disclosure from a disengagement or a topic change.
        return FallbackOutcome(
            text=terminal_response("welfare_disclosed"),
            source="terminal_direct",
            terminal_state="welfare_disclosed",
        )

    outcome = FallbackOutcome(text="", source="terminal", terminal_state=state_key)

    try:
        candidate = generate()
    except Exception as exc:
        logger.error("[FallbackValidation] generation raised: %s %s", exc, session_label)
        candidate = None

    if not candidate:
        outcome.text = terminal_response(state_key)
        outcome.failed_reason = "generation_returned_nothing"
        return outcome

    outcome.candidate_generated = True

    if post_filters is not None:
        try:
            candidate = post_filters(candidate)
        except Exception as exc:
            logger.error("[FallbackValidation] post-filter raised: %s %s", exc, session_label)
            outcome.text = terminal_response(state_key)
            outcome.failed_validator = "post_filters"
            outcome.failed_reason = "post_filter_error"
            return outcome

    # Cheapest first. The gate is deterministic and makes no model call; the
    # judge is a model call. They enforce different safety semantics, so both
    # applicable validators run — neither supersedes the other.
    for name, validator in (("gate", gate), ("judge", judge)):
        if validator is None:
            continue
        outcome.validators_run.append(name)
        try:
            passed, reason = validator(candidate)
        except Exception as exc:
            logger.error(
                "[FallbackValidation] %s validator raised: %s %s", name, exc, session_label
            )
            passed, reason = False, f"{name}_validator_error"
        if not passed:
            logger.warning(
                "[FallbackValidation] candidate rejected by %s (%s) — terminal '%s' %s",
                name, reason, state_key, session_label,
            )
            outcome.text = terminal_response(state_key)
            outcome.failed_validator = name
            outcome.failed_reason = reason
            return outcome

    outcome.text = candidate
    outcome.source = "candidate"
    outcome.terminal_state = None
    return outcome


def provenance_values(outcome: FallbackOutcome, trigger: str) -> Dict[str, Any]:
    """Shape for the `fallback_validation` provenance stage. No raw text.

    `outcome_source`, NOT `source`: these values are expanded into
    ProvenanceRecord.stage(name, source, **values), whose own `source` names the
    component that produced the stage. Naming the outcome's source `source` here
    passed that keyword twice, raising TypeError on every fallback turn from 15
    Sept 2026 until this was corrected; the caller swallowed the exception, so
    neither this stage nor terminal_safe_response was ever recorded. Any key
    added here must not collide with a stage() parameter — pinned by
    test_target_e_no_provenance_value_key_can_shadow_a_stage_parameter.
    """
    return {
        "trigger": trigger,
        "outcome_source": outcome.source,
        "candidate_generated": outcome.candidate_generated,
        "validators_run": ",".join(outcome.validators_run) or "none",
        "failed_validator": outcome.failed_validator,
        "failed_reason": (outcome.failed_reason or "")[:80] or None,
        "terminal_state": outcome.terminal_state,
    }
