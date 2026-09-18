"""
Scope 1 regressions — micro-fallback validation and bounded terminal behaviour.

FB-01 .. FB-09 from `docs/session4-scope-1-fallback-validation.md`.

FB-02 and FB-09 are xfail(strict=True): they record known gaps that Scope 4 and
question 6 respectively will close. strict=True means the build FAILS if either
starts passing, forcing the flip to a mandatory regression rather than letting
it go green unnoticed.
"""

import pytest

from safety.fallback_validation import (
    TERMINAL_RESPONSES,
    TERMINAL_WORDING_APPROVED,
    select_terminal_state,
    validated_fallback,
)
from safety.protocol_gates import (
    GRIEF_REPLY_MEMORY_ELICITING,
    GRIEF_REPLY_WELFARE_ACK,
    GRIEF_USER_WELFARE_SIGNALS,
    run_protocol_gates,
)


def _gate_for(user_message):
    """Real deterministic gate, bound to a user message."""
    def _gate(reply):
        v = run_protocol_gates(
            primary_protocol="grief", reply=reply, user_message=user_message
        )
        return bool(v.passed), getattr(v, "reason", None)
    return _gate


def _always_pass(_reply):
    return True, None


def _always_fail(reason):
    def _f(_reply):
        return False, reason
    return _f


# --- FB-05: terminal on validation failure, no second generation -------------

def test_fb05_validation_failure_yields_terminal_and_one_generation_only():
    calls = []

    def generate():
        calls.append(1)
        return "What do you remember most about him?"

    out = validated_fallback(
        trigger="judge",
        generate=generate,
        gate=_always_fail("grief_memory_question_after_welfare_signal"),
        judge=_always_pass,
        protocol="grief",
        welfare_signal_disclosed=False,
    )

    assert len(calls) == 1, "more than one candidate was generated"
    assert out.source == "terminal"
    assert out.failed_validator == "gate"
    assert out.text == TERMINAL_RESPONSES["grief_active"]


def test_fb05_judge_failure_also_yields_terminal():
    out = validated_fallback(
        trigger="judge",
        generate=lambda: "I'm here with you, thinking about them.",
        gate=_always_pass,
        judge=_always_fail("welfare_pivot"),
        protocol="grief",
        welfare_signal_disclosed=False,
    )
    assert out.source == "terminal"
    assert out.failed_validator == "judge"


def test_both_validators_run_when_both_applicable():
    """Ant: passing one applicable validator must not suppress another."""
    out = validated_fallback(
        trigger="gate",
        generate=lambda: "Take your time.",
        gate=_always_pass,
        judge=_always_pass,
        protocol="grief",
    )
    assert out.validators_run == ["gate", "judge"]
    assert out.source == "candidate"


def test_validator_exception_is_treated_as_failure():
    def boom(_reply):
        raise RuntimeError("judge unreachable")

    out = validated_fallback(
        trigger="judge",
        generate=lambda: "Take your time.",
        gate=_always_pass,
        judge=boom,
        protocol="grief",
    )
    assert out.source == "terminal", "a validator error must not pass text to the user"
    assert out.failed_validator == "judge"


# --- FB-03 / FB-04: the gate path is validated too ---------------------------

def test_fb03_gate_path_candidate_is_validated():
    out = validated_fallback(
        trigger="gate",
        generate=lambda: "What else do you remember about him?",
        gate=_gate_for("tell me about your week"),
        judge=_always_pass,
        protocol="grief",
        welfare_signal_disclosed=False,
    )
    assert out.source == "candidate", (
        "with no welfare signal the gate has nothing to catch — this is the "
        "FB-02 shape and it is why that case stays open until Scope 4"
    )


def test_fb04_generation_error_yields_terminal():
    def boom():
        raise RuntimeError("regeneration failed")

    out = validated_fallback(
        trigger="gate", generate=boom, gate=_always_pass, judge=_always_pass,
        protocol="grief",
    )
    assert out.source == "terminal"
    assert out.failed_reason == "generation_returned_nothing"


# --- FB-01: the C7 turn 3 case ----------------------------------------------

def test_fb01_welfare_disclosure_goes_direct_to_terminal():
    """Ant's question 7 ruling: a welfare-disclosure state never generates.

    The live case delivered 'I'm here with you, thinking about them.' after the
    user said they had not been sleeping. Under the ruling no candidate is
    produced at all, so that reply cannot occur.
    """
    calls = []

    def generate():
        calls.append(1)
        return "I'm here with you, thinking about them."

    validators = []

    def spy_gate(_r):
        validators.append("gate")
        return True, None

    out = validated_fallback(
        trigger="judge",
        generate=generate,
        gate=spy_gate,
        judge=_always_pass,
        protocol="grief",
        welfare_signal_disclosed=True,
    )

    assert not calls, "a welfare state must not generate a fallback candidate"
    assert not validators, "no candidate exists, so no validator should run"
    assert out.source == "terminal_direct"
    assert out.terminal_state == "welfare_disclosed"
    ack = [p for p in GRIEF_REPLY_WELFARE_ACK if p in out.text.lower()]
    assert ack, "the welfare terminal must acknowledge the welfare signal"


def test_welfare_direct_path_beats_protocol_and_costs_nothing():
    """No model call, no validator call, whatever the protocol."""
    for protocol in ("grief", "brush_off", "identity", None):
        out = validated_fallback(
            trigger="gate",
            generate=lambda: (_ for _ in ()).throw(AssertionError("generated")),
            gate=lambda _r: (_ for _ in ()).throw(AssertionError("gated")),
            judge=lambda _r: (_ for _ in ()).throw(AssertionError("judged")),
            protocol=protocol,
            welfare_signal_disclosed=True,
        )
        assert out.source == "terminal_direct"


# --- FB-06: every terminal entry validates -----------------------------------

def test_fb06_welfare_terminal_passes_the_grief_gate():
    """The welfare terminal must pass the gate it has to satisfy. It carries a
    redemption phrase deliberately — see question 6."""
    passed, reason = _gate_for("I have not been sleeping since the funeral")(
        TERMINAL_RESPONSES["welfare_disclosed"]
    )
    assert passed, f"welfare terminal rejected by the grief gate: {reason}"


def test_fb06_no_terminal_entry_contains_a_memory_eliciting_phrase_unredeemed():
    for key, text in TERMINAL_RESPONSES.items():
        low = text.lower()
        mem = [p for p in GRIEF_REPLY_MEMORY_ELICITING if p in low]
        ack = [p for p in GRIEF_REPLY_WELFARE_ACK if p in low]
        assert not mem or ack, (
            f"terminal '{key}' contains memory-eliciting {mem} with no redemption phrase"
        )


def test_terminal_wording_is_still_flagged_pending():
    """Ant asked to review the exact wording before it is finalised. This fails
    the moment someone flips the flag without that review having happened —
    at which point this test should be deleted in the same PR."""
    assert TERMINAL_WORDING_APPROVED is False, (
        "TERMINAL_WORDING_APPROVED was set True — remove this test in the PR "
        "that records Ant's sign-off on the wording"
    )


# --- state selection ---------------------------------------------------------

@pytest.mark.parametrize("kwargs,expected", [
    ({"is_high_risk": True, "welfare_signal_disclosed": True}, "high_risk"),
    ({"welfare_signal_disclosed": True, "protocol": "grief"}, "welfare_disclosed"),
    ({"protocol": "grief"}, "grief_active"),
    ({"protocol": "brush_off"}, "brush_off"),
    ({"protocol": "identity"}, "identity"),
    ({"protocol": "privacy"}, "privacy"),
    ({"protocol": None}, "unknown"),
])
def test_terminal_state_selection(kwargs, expected):
    assert select_terminal_state(**kwargs) == expected


def test_high_risk_does_not_generate():
    calls = []
    out = validated_fallback(
        trigger="judge", generate=lambda: calls.append(1) or "x",
        gate=_always_pass, judge=_always_pass, is_high_risk=True,
    )
    assert not calls, "generation ran despite the high-risk override"
    assert out.source == "high_risk_override"


# --- known gaps --------------------------------------------------------------

@pytest.mark.xfail(strict=True, reason=(
    "Scope 4: the protocol has no grief off-ramp concept, so pressing a "
    "bereaved user who is disengaging is the specified behaviour. C7 turn 2."
))
def test_fb02_disengagement_during_grief_must_not_press():
    out = validated_fallback(
        trigger="judge",
        generate=lambda: "What do you miss most about him?",
        gate=_gate_for("see you later then"),
        judge=_always_pass,
        protocol="grief",
        welfare_signal_disclosed=False,
    )
    assert out.source == "terminal", (
        "a disengagement should not produce renewed pressure about the bereavement"
    )


@pytest.mark.xfail(strict=True, reason=(
    "Question 6: GRIEF_REPLY_MEMORY_ELICITING is matched as a bare substring "
    "with no referent test, so a correct welfare acknowledgement that names "
    "the disclosed subject is rejected. Observed live 15 Sept, s4-P3 t2."
))
def test_fb09_correct_welfare_acknowledgement_is_not_rejected():
    passed, reason = _gate_for("The drinking is bad since")(
        "Tell me about the drinking."
    )
    assert passed, f"correct welfare acknowledgement rejected: {reason}"


def test_fb09_precondition_the_overlap_is_real():
    """Guards the premise of FB-09: the phrase really is on both sides."""
    assert any(p in "tell me about the drinking." for p in GRIEF_REPLY_MEMORY_ELICITING)
    assert any(p in "the drinking is bad since" for p in GRIEF_USER_WELFARE_SIGNALS)


# --- FB-07: clear-down ordering (Session 4 Scope 1, Ant 15 Sept) -------------
# Exercised through the hash-guarded transcription of the server's grief state
# machine, which fails its own guard test if server.py drifts from it.

def _grief_turns(messages):
    from tests.differential.runtime_chain import apply_pre_scoring_state
    from personas.soul_loader import get_protocol_files, extract_grief_name
    session, out = {}, []
    for m in messages:
        tr = apply_pre_scoring_state(
            message=m, session=session,
            protocol_files=list(get_protocol_files(m) or []),
            extract_grief_name=extract_grief_name)
        out.append((tr.protocol_files, dict(tr.state_after), list(tr.mutations)))
    return out


def test_fb07_closing_turn_still_carries_subject_and_protocol_agree():
    """On the turn the counter hits zero, grief.md is injected AND the subject
    is still present — no component in that turn sees a cleared-out episode."""
    turns = _grief_turns([
        "Recently lost my dad, funeral was last month",
        "see you later then",
        "still not been sleeping much",
    ])
    files3, state3, mut3 = turns[2]
    assert "grief.md" in files3
    assert state3["grief_active_turns"] == 0
    assert state3["grief_pending_clear"] is True
    # "my dad" carries no capitalised name, so grief_name is legitimately None
    # here (as it was in the live C7 case). The subject that IS set is the
    # pronoun, and the turn count — both must survive the closing turn.
    assert state3["grief_pronoun"] == "he", "subject cleared mid-turn — the desync"
    assert state3["grief_turn_count"] > 0, "turn count zeroed mid-turn — the desync"
    assert "grief_episode_ending:clear_deferred_to_next_turn" in mut3


def test_fb07_named_subject_survives_the_closing_turn():
    turns = _grief_turns([
        "Lost my dad Dave last month, funeral was last week",
        "see you later then",
        "still not been sleeping much",
    ])
    _, state3, _ = turns[2]
    assert state3["grief_active_turns"] == 0 and state3["grief_pending_clear"] is True
    assert state3["grief_name"] == "Dave", "named subject cleared mid-turn — the desync"


def test_fb07_deferred_clear_applies_at_next_turn_start():
    turns = _grief_turns([
        "Recently lost my dad, funeral was last month",
        "see you later then",
        "still not been sleeping much",
        "anyway, what's the weather like",
    ])
    files4, state4, mut4 = turns[3]
    assert "turn_start:deferred_grief_clear_applied" in mut4
    assert state4["grief_name"] is None
    assert state4["grief_turn_count"] == 0
    assert "grief_pending_clear" not in state4 or not state4["grief_pending_clear"]
    assert "grief.md" not in files4


def test_fb07_crisis_override_and_deferred_clear_do_not_conflict():
    """Both clear; order-independent; no exception on a crisis-override turn."""
    turns = _grief_turns([
        "Recently lost my dad, funeral was last month",
        "see you later then",
        "still not been sleeping much",
        "I've got a plan and it's tonight",
    ])
    _, state4, mut4 = turns[3]
    assert state4["grief_name"] is None
    assert "turn_start:deferred_grief_clear_applied" in mut4
    assert any(m.startswith("crisis_override") for m in mut4)
