"""
Transcription of the inline decision logic in `server.buddy_chat`.

WHY THIS FILE EXISTS
--------------------
The authoritative runtime outcome — the `risk_level` the client actually
receives — is not produced by any importable function. It is produced by
~370 lines of inline logic inside the `/api/ai-buddies/chat` handler, which
cannot be called without FastAPI, Mongo and OpenAI.

Session 3 has to report the authoritative runtime outcome as its own column
(Ant's spec: "legacy / raw unified / reconciled / authoritative runtime
outcome as separate results"). So this module transcribes that inline logic.

THIS IS A TRANSCRIPTION, NOT THE PRODUCTION CODE.
It changes no production behaviour and is imported by nothing in `backend/`
outside `tests/differential/`. Its fidelity is guarded two ways:

  1. `verify_fidelity()` hashes the source text of the transcribed regions in
     server.py, delimited by anchor comments rather than line numbers, and
     compares against pinned hashes. Any edit to those regions makes the
     harness report DRIFT and stop claiming fidelity.
  2. `backend/tests/test_differential_harness.py` asserts the same thing, so
     a future PR that changes the correctives fails a test instead of
     silently invalidating these results.

Transcribed from main `76d41e01` (#102), 15 September 2026.
Updated for the Scope 1 deferred clear-down, same day (branch safety/scope1-fallback-validation).

STRUCTURAL NOTE — TWO EXITS
---------------------------
The handler has two exits, and this matters for every result in the report:

  EXIT A (failsafe)  server.py:6891
      Reached when `failsafe_should_fire` survives the negation and identity
      guards. Returns immediately with safeguardingTriggered=True,
      riskLevel="RED", riskScore=<RAW UNIFIED risk_score>.
      *None of the nine correctives run on this path.*

  EXIT B (normal)    server.py:7792
      safeguardingTriggered=(risk_level=="RED"),
      riskScore=<LEGACY scorer score>.
      This is the path the correctives exist to patch.

The two exits report riskScore from two different scorers on two different
scales. Recorded per scenario as `exit_path`.
"""

from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

SERVER_PY = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "server.py",
)

# ---------------------------------------------------------------------------
# Transcribed constants — copied verbatim from server.py
# ---------------------------------------------------------------------------

# server.py:6463
CRISIS_OVERRIDE_PHRASES = [
    'plan', 'tonight', 'going to do it', 'end it',
    'kill myself', 'harm myself', 'hurt myself',
    'not going to be here', 'goodbye', "won't need this anymore"
]

# server.py:6710 — the FIFTH negation implementation; the one that gates the failsafe
NEGATION_PHRASES = [
    "not going to", "not gonna", "never going to", "never gonna",
    "would never", "im not", "i'm not", "i am not", "not suicidal",
    "not going to hurt", "not gonna hurt", "not gonna kil",
    "not gonna kill", "not gonna top", "not going to top",
    "not gonna do", "not going to do", "wouldn't", "won't",
    "don't want to die", "dont want to die", "not like that"
]

# server.py:6740
REVERSAL_PHRASES = [
    "actually yes", "yes i am", "actually i am", "wait yes",
    "changed my mind", "actually maybe", "actually i will",
    "actually i do", "but maybe i should", "but i might"
]

# server.py:6543 (inside the grief-persistence else-branch)
BRUSH_OFF_CHECK = [
    'ignore me', 'just being dramatic', "don't mind me", "dont mind me",
    'just being daft', 'being dramatic', 'forget i said'
]

CONCERNING_PATTERNS = ["INTENT_ESCALATION", "METHOD_INTRODUCTION", "FINALITY_BEHAVIOR"]


# ---------------------------------------------------------------------------
# Drift guard
# ---------------------------------------------------------------------------

# (region name, start anchor, end anchor)
_REGIONS = [
    (
        "crisis_override_and_grief_state",
        "        # CRITICAL: Crisis override — if current message contains genuine crisis language,",
        "        # Check for safeguarding concerns using weighted scoring system",
    ),
    (
        "negation_and_identity_guards",
        "        # === NEGATION DETECTION (applies to BOTH failsafe AND risk-level upgrade) ===",
        "        # --- Go-to-market: in signpost mode the staff-queue notification is",
    ),
    (
        "correctives",
        "        # Upgrade risk level based on unified analysis",
        "        # Get safety wrapper text (appended to persona response, not replacing)",
    ),
]

# Pinned at main 76d41e01. Regenerate deliberately with `python3 -m
# tests.differential.runtime_chain --repin` and say so in the PR.
PINNED_HASHES = {
    "crisis_override_and_grief_state": "5c3f2586d2a93155",
    "negation_and_identity_guards": "a8bd9937b02df27f",
    "correctives": "9c9d871f7a4b70ea",
}


def _read_server_source() -> str:
    with open(SERVER_PY, "r", encoding="utf-8") as fh:
        return fh.read()


def _region_text(source: str, start: str, end: str) -> Optional[str]:
    i = source.find(start)
    if i == -1:
        return None
    j = source.find(end, i + len(start))
    if j == -1:
        return None
    return source[i:j]


def region_hashes() -> Dict[str, Optional[str]]:
    """Hash each transcribed region of server.py, ignoring blank-line churn."""
    source = _read_server_source()
    out: Dict[str, Optional[str]] = {}
    for name, start, end in _REGIONS:
        text = _region_text(source, start, end)
        if text is None:
            out[name] = None
            continue
        squashed = "\n".join(
            line.rstrip() for line in text.splitlines() if line.strip()
        )
        out[name] = hashlib.sha256(squashed.encode("utf-8")).hexdigest()[:16]
    return out


def verify_fidelity() -> Dict[str, str]:
    """Return {region: OK | DRIFT | ANCHOR_NOT_FOUND | UNPINNED}."""
    current = region_hashes()
    status = {}
    for name, h in current.items():
        pinned = PINNED_HASHES.get(name)
        if h is None:
            status[name] = "ANCHOR_NOT_FOUND"
        elif pinned is None:
            status[name] = "UNPINNED"
        elif pinned == h:
            status[name] = "OK"
        else:
            status[name] = f"DRIFT (pinned {pinned}, now {h})"
    return status


# ---------------------------------------------------------------------------
# Pre-scoring state transitions (server.py:6463–6558)
# ---------------------------------------------------------------------------

@dataclass
class StateTransition:
    crisis_override: bool = False
    protocol_files: List[str] = field(default_factory=list)
    state_before: Dict[str, Any] = field(default_factory=dict)
    state_after: Dict[str, Any] = field(default_factory=dict)
    mutations: List[str] = field(default_factory=list)


_STATE_KEYS = [
    "grief_active_turns", "grief_name", "grief_pronoun", "grief_turn_count", "grief_pending_clear",
    "identity_active_turns", "spine_turn_count", "brush_off_turn_count",
]


def apply_pre_scoring_state(
    *,
    message: str,
    session: Dict[str, Any],
    protocol_files: List[str],
    extract_grief_name,
) -> StateTransition:
    """Transcription of server.py:6463–6558.

    NOTE the as-found asymmetry, preserved deliberately: `get_protocol_files`
    upstream is called on `request.message` (the ORIGINAL text), while the
    scorers below it are called on `safeguarding_text` (the NORMALISED text).
    The grief gate therefore never sees normalisation. Recorded, not fixed.
    """
    tr = StateTransition()
    tr.state_before = {k: session.get(k) for k in _STATE_KEYS}
    protocol_files = list(protocol_files)

    msg_lower = message.lower()
    crisis_override = any(p in msg_lower for p in CRISIS_OVERRIDE_PHRASES)
    tr.crisis_override = crisis_override

    # Session 4 Scope 1: deferred clear-down resolves at turn start.
    if session.pop('grief_pending_clear', False):
        session['grief_name'] = None
        session['grief_pronoun'] = None
        session['grief_turn_count'] = 0
        tr.mutations.append("turn_start:deferred_grief_clear_applied")

    if crisis_override:
        if 'identity_active_turns' in session:
            session['identity_active_turns'] = 0
            tr.mutations.append("crisis_override:identity_active_turns=0")
        if 'grief_active_turns' in session:
            session['grief_active_turns'] = 0
            tr.mutations.append("crisis_override:grief_active_turns=0")
        session['grief_name'] = None
        session['grief_pronoun'] = None
        session['grief_turn_count'] = 0
        tr.mutations.append("crisis_override:grief_subject_cleared")
    else:
        if 'grief.md' in protocol_files:
            session['grief_active_turns'] = 2
            session['grief_turn_count'] = session.get('grief_turn_count', 0) + 1
            tr.mutations.append("grief_detected:grief_active_turns=2")
            if session.get('grief_name') is None:
                extracted = extract_grief_name(message)
                if extracted:
                    session['grief_name'] = extracted
                    tr.mutations.append(f"grief_name_set")
                msg_l = message.lower()
                if any(w in msg_l for w in ['wife', 'mum', 'mother', 'sister', 'daughter', 'her ', ' her', ' she']):
                    session['grief_pronoun'] = 'she'
                elif any(w in msg_l for w in ['husband', 'dad', 'father', 'brother', 'son', 'his ', ' his', ' he ']):
                    session['grief_pronoun'] = 'he'
                else:
                    session['grief_pronoun'] = session.get('grief_pronoun', 'they')
        elif session.get('grief_active_turns', 0) > 0:
            if 'grief.md' not in protocol_files:
                protocol_files = protocol_files + ['grief.md']
                tr.mutations.append("grief_persisted:grief.md force-injected")
            session['grief_active_turns'] = session['grief_active_turns'] - 1
            session['grief_turn_count'] = session.get('grief_turn_count', 0) + 1
            if session['grief_active_turns'] == 0:
                session['grief_pending_clear'] = True
                tr.mutations.append("grief_episode_ending:clear_deferred_to_next_turn")

        if 'spine.md' in protocol_files:
            session['spine_turn_count'] = session.get('spine_turn_count', 0) + 1
        if any(s in message.lower() for s in BRUSH_OFF_CHECK):
            session['brush_off_turn_count'] = session.get('brush_off_turn_count', 0) + 1

        if 'identity.md' in protocol_files:
            session['identity_active_turns'] = 3
        elif session.get('identity_active_turns', 0) > 0:
            protocol_files = protocol_files + ['identity.md']
            session['identity_active_turns'] = session['identity_active_turns'] - 1
            tr.mutations.append("identity_persisted:identity.md force-injected")

    tr.protocol_files = protocol_files
    tr.state_after = {k: session.get(k) for k in _STATE_KEYS}
    return tr


# ---------------------------------------------------------------------------
# The decision chain (server.py:6696–7075, then the exits)
# ---------------------------------------------------------------------------

@dataclass
class RuntimeOutcome:
    risk_level: str
    should_escalate: bool
    failsafe_should_fire: bool
    safeguarding_triggered: bool
    risk_score: Any
    risk_score_source: str
    exit_path: str
    overrides: List[str] = field(default_factory=list)
    negation_confirmed: bool = False
    has_negation: bool = False
    has_reversal: bool = False
    identity_active: bool = False


def apply_runtime_chain(
    *,
    legacy_risk_level: str,
    legacy_should_escalate: bool,
    legacy_score: Any,
    unified: Dict[str, Any],
    final_verdict: Any,
    safeguarding_text: str,
    protocol_files: List[str],
) -> RuntimeOutcome:
    """Transcription of the inline chain. Order is load-bearing — do not tidy."""
    risk_level = legacy_risk_level          # server.py:6562
    should_escalate = bool(legacy_should_escalate)
    overrides: List[str] = []

    # 6696
    failsafe_should_fire = bool(getattr(final_verdict, "failsafe_triggered", False))

    # 6707–6763 — inline negation, the fifth implementation
    msg_lower = safeguarding_text.lower()
    has_negation = any(neg in msg_lower for neg in NEGATION_PHRASES)
    has_reversal = any(rev in msg_lower for rev in REVERSAL_PHRASES) if has_negation else False
    negation_confirmed = has_negation and not has_reversal

    current_turn_explicit = bool(unified.get("current_turn_explicit", False))

    if failsafe_should_fire and negation_confirmed and current_turn_explicit:
        overrides.append("negation_suppression_blocked_explicit")
    elif failsafe_should_fire and negation_confirmed:
        failsafe_should_fire = False
        overrides.append("negation_suppression")

    # 6769–6787 — identity guard
    identity_active = bool(protocol_files) and 'identity.md' in protocol_files
    if failsafe_should_fire and identity_active and current_turn_explicit:
        overrides.append("identity_suppression_blocked_explicit")
    elif failsafe_should_fire and identity_active:
        if unified.get("failsafe_reason", "unknown") == "imminent_intent":
            failsafe_should_fire = False
            overrides.append("identity_suppression")

    # 6795–6902 — EXIT A. Returns before any corrective runs.
    if failsafe_should_fire:
        return RuntimeOutcome(
            risk_level="RED",
            should_escalate=True,
            failsafe_should_fire=True,
            safeguarding_triggered=True,
            risk_score=unified.get("risk_score", 999),
            risk_score_source="raw_unified",
            exit_path="A_failsafe",
            overrides=overrides,
            negation_confirmed=negation_confirmed,
            has_negation=has_negation,
            has_reversal=has_reversal,
            identity_active=identity_active,
        )

    unified_risk = unified.get("risk_level", "NONE")

    # 6933–6947 — B³.5 initial-assignment corrective
    if not failsafe_should_fire and risk_level == "RED":
        risk_level = "AMBER"
        overrides.append("b35_initial_assignment_corrective")

    # 6949–7013 — the if/elif chain. Only ONE branch can run.
    if negation_confirmed:
        overrides.append("upgrade_suppressed_by_negation")
    elif identity_active and unified_risk not in ["IMMINENT"]:
        overrides.append("upgrade_suppressed_by_identity")
    elif not failsafe_should_fire:
        # Always true here — EXIT A already returned. The three branches below
        # are therefore UNREACHABLE on this path. Recorded, not fixed.
        overrides.append("upgrade_suppressed_by_reconciler")
    elif unified_risk == "IMMINENT" and risk_level != "RED":
        risk_level = "RED"
        should_escalate = True
        overrides.append("b35_overlay_gate_hotfix:IMMINENT")
    elif unified_risk == "HIGH" and risk_level not in ["RED", "AMBER"]:
        risk_level = "AMBER"
        should_escalate = True
        overrides.append("b35_overlay_gate_hotfix:HIGH")
    elif unified_risk == "MEDIUM" and risk_level == "GREEN":
        risk_level = "YELLOW"
        overrides.append("b35_overlay_gate_hotfix:MEDIUM")

    # 7028–7046 — RULE 2b, reconciler-authoritative
    if getattr(final_verdict, "staff_review_required", False):
        should_escalate = True
        if risk_level in ("GREEN", "YELLOW"):
            risk_level = "AMBER"
        overrides.append("rule_2b_staff_review")

    # 7050–7060 — rapid escalation (gated on failsafe_should_fire: unreachable here)
    if (not negation_confirmed and not identity_active and failsafe_should_fire
            and unified.get("rapid_escalation") and not should_escalate):
        should_escalate = True
        risk_level = "AMBER" if risk_level == "GREEN" else risk_level
        overrides.append("rapid_escalation")

    # 7062–7075 — concerning patterns (same gate, same unreachability)
    if (not negation_confirmed and not identity_active and failsafe_should_fire
            and unified.get("detected_patterns")):
        if any(p in unified.get("detected_patterns", []) for p in CONCERNING_PATTERNS):
            should_escalate = True
            if risk_level == "GREEN":
                risk_level = "AMBER"
            overrides.append("concerning_patterns")

    # 7792 — EXIT B
    return RuntimeOutcome(
        risk_level=risk_level,
        should_escalate=should_escalate,
        failsafe_should_fire=False,
        safeguarding_triggered=(risk_level == "RED"),
        risk_score=legacy_score,
        risk_score_source="legacy_scorer",
        exit_path="B_normal",
        overrides=overrides,
        negation_confirmed=negation_confirmed,
        has_negation=has_negation,
        has_reversal=has_reversal,
        identity_active=identity_active,
    )


if __name__ == "__main__":
    import json as _json
    import sys
    if "--repin" in sys.argv:
        print(_json.dumps(region_hashes(), indent=2))
    else:
        print(_json.dumps(verify_fidelity(), indent=2))
