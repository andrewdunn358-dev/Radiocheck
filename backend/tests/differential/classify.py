"""
Classification of observed disagreements into Ant's five categories.

    INVOCATION FAILURE      a potentially useful detector was never allowed to run
    SIGNAL/SEMANTIC CONFLICT  contributing components interpret the same input differently
    AUTHORITY CONFLICT      a downstream or parallel mechanism contradicts/overrides
                            the intended authority
    CONTEXT LOSS            the safety path runs without a safety-relevant input it
                            should have received
    STATE MUTATION FAILURE  retained safety/relationship state is incorrectly created,
                            retained, cleared or altered

Rules here are mechanical and evidence-bearing: each returns the observed fact
that produced it, so a finding can be checked against the row without rerunning.
No rule asserts what the *correct* safeguarding answer is — that is Ant's call.
"""

from __future__ import annotations

from typing import Any, Dict, List

RISK_ORDER = {"NONE": 0, "GREEN": 0, "LOW": 1, "YELLOW": 1, "MEDIUM": 2,
              "AMBER": 2, "HIGH": 3, "RED": 4, "CRITICAL": 4, "IMMINENT": 4}


def _rank(level: Any) -> int:
    return RISK_ORDER.get(str(level or "NONE").upper(), 0)


def classify_row(row: Dict[str, Any]) -> List[Dict[str, str]]:
    """Return a list of {category, code, evidence} for one scenario row."""
    findings: List[Dict[str, str]] = []

    def add(category: str, code: str, evidence: str) -> None:
        findings.append({"category": category, "code": code, "evidence": evidence})

    legacy = row.get("legacy_risk_level")
    unified = row.get("unified_risk_level")
    reconciled = row.get("reconciled_risk_level")
    runtime = row.get("runtime_risk_level")

    # --- INVOCATION FAILURE -------------------------------------------------
    if row.get("ai_gate_open") is False:
        if row.get("ai_forced_risk_level") and _rank(row["ai_forced_risk_level"]) >= 2:
            add("INVOCATION FAILURE", "classifier_gated_out_but_would_detect",
                f"gate closed; forced classifier returned {row['ai_forced_risk_level']}")
        elif row.get("ai_forced_risk_level") is None and row.get("expected_risk") in ("high", "imminent"):
            add("INVOCATION FAILURE", "classifier_gated_out_on_high_expectation",
                "gate closed on a scenario Ant scores high/imminent; forced run NOT RUN "
                "(needs --live)")

    if row.get("precedence_rule") == "CLASSIFIER_UNAVAILABLE":
        add("INVOCATION FAILURE", "reconciler_deferred_to_keywords_only",
            "reconciler Rule 0 fired: classifier absent, so the reconciled verdict "
            "IS the unified keyword verdict — no independent second opinion existed")

    if row.get("semantic_live") is False and row.get("det_semantic_highest") == 0:
        add("INVOCATION FAILURE", "semantic_layer_unavailable",
            "semantic embeddings returned 0 because api.openai.com is unreachable; "
            "this layer contributes nothing to the score in this environment")

    # --- CONTEXT LOSS -------------------------------------------------------
    if row.get("normalise_triggered") and row.get("grief_gate_sees_original"):
        add("CONTEXT LOSS", "grief_gate_reads_unnormalised_text",
            "get_protocol_files() is called on request.message; the scorers below it "
            "are called on the normalised text")

    if (row.get("normaliser_model_live") and row.get("normalise_triggered")
            and row.get("normalise_invoked") is False):
        add("CONTEXT LOSS", "normalisation_triggered_but_not_applied",
            "should_normalise() True and the model was reachable, but the call "
            "did not change the text; detectors saw the original")

    # --- SIGNAL / SEMANTIC CONFLICT ----------------------------------------
    if legacy and unified and _rank(legacy) != _rank(unified):
        add("SIGNAL/SEMANTIC CONFLICT", "legacy_vs_unified",
            f"legacy={legacy} vs raw unified={unified} on identical input")

    # Three keyword numbers exist for the same message, on three scales:
    #   legacy_score              0-200+, RED at 120 (160 with identity active)
    #   det_keyword_raw_score     0-10, from assess_message_safety, DISCARDED by unified
    #   unified_keyword_score     0-100, level-mapped, the one the gate tests against 60
    # Compare like for like: does the legacy scorer say RED-territory while the
    # unified keyword layer says below-HIGH, or vice versa?
    kw = row.get("unified_keyword_score")
    ls = row.get("legacy_score")
    if isinstance(kw, (int, float)) and isinstance(ls, (int, float)):
        legacy_red = ls >= 120
        unified_high = kw >= 60
        if legacy_red != unified_high:
            add("SIGNAL/SEMANTIC CONFLICT", "keyword_scales_disagree",
                f"legacy score {ls} (RED at 120) says "
                f"{'RED' if legacy_red else 'below RED'}; unified keyword score {kw} "
                f"(HIGH at 60) says {'HIGH+' if unified_high else 'below HIGH'}")

    # NOTE: only meaningful when the classifier ACTUALLY ran. When it does not,
    # unified["ai_classification"]["risk_level"] still reports the string "none"
    # from the classifier's default_response — that is a display field, not a
    # verdict. extract_verdicts_from_unified() correctly returns classifier=None
    # on invoked=False, so the reconciler never sees a false "none" verdict.
    # An earlier draft of this rule compared the display field and produced five
    # false findings. Kept as a comment because it is an easy mistake to repeat.
    ai_lvl = row.get("ai_risk_level")
    if row.get("ai_invoked") and ai_lvl and unified and _rank(ai_lvl) != _rank(unified):
        add("SIGNAL/SEMANTIC CONFLICT", "classifier_vs_unified",
            f"AI classifier={ai_lvl} vs unified combined={unified}")

    # --- AUTHORITY CONFLICT -------------------------------------------------
    if reconciled and runtime and _rank(reconciled) != _rank(runtime):
        add("AUTHORITY CONFLICT", "reconciler_not_authoritative",
            f"reconciler said {reconciled}; the client received {runtime} "
            f"(overrides: {','.join(row.get('overrides') or []) or 'none'})")

    for ov in (row.get("overrides") or []):
        if ov == "negation_suppression":
            add("AUTHORITY CONFLICT", "inline_negation_overrides_reconciler",
                "server.py inline negation list set failsafe_should_fire=False "
                "after the reconciler had set it True")
        elif ov == "identity_suppression":
            add("AUTHORITY CONFLICT", "identity_guard_overrides_reconciler",
                "identity.md active suppressed a reconciler failsafe (imminent_intent)")
        elif ov.startswith("b35_"):
            add("AUTHORITY CONFLICT", "corrective_rewrote_risk_level",
                f"{ov} rewrote risk_level after assignment")
        elif ov == "upgrade_suppressed_by_negation":
            add("AUTHORITY CONFLICT", "negation_blocks_unified_upgrade",
                "unified risk upgrade suppressed by the inline negation list")

    if row.get("runtime_safeguarding_triggered") is False and row.get("reconciled_failsafe") is True:
        add("AUTHORITY CONFLICT", "failsafe_set_but_no_overlay",
            "reconciler failsafe_triggered=True but safeguardingTriggered=False reached the client")

    if row.get("exit_path") == "A_failsafe" and row.get("risk_score_source") == "raw_unified":
        add("AUTHORITY CONFLICT", "riskscore_scale_switches_by_exit",
            "failsafe exit reports riskScore from raw unified; normal exit reports it "
            "from the legacy scorer — two scales on the same field")

    # --- STATE MUTATION FAILURE --------------------------------------------
    if row.get("crisis_override") and row.get("crisis_override_benign") is True:
        add("STATE MUTATION FAILURE", "benign_message_cleared_protocol_state",
            f"crisis_override fired on a control message via substring "
            f"{row.get('crisis_override_match')!r}; cleared: "
            f"{','.join(row.get('state_mutations') or []) or 'nothing (no state set)'}")

    for m in (row.get("state_mutations") or []):
        if m == "grief_persisted:grief.md force-injected":
            add("STATE MUTATION FAILURE", "grief_forced_on_contentless_turn",
                "grief.md injected on a turn whose own content does not trigger it")
        if m == "identity_persisted:identity.md force-injected":
            add("STATE MUTATION FAILURE", "identity_forced_on_contentless_turn",
                "identity.md injected on a turn whose own content does not trigger it, "
                "which also opens the identity suppression branch above")

    return findings


def summarise(all_findings: List[Dict[str, Any]]) -> Dict[str, Dict[str, int]]:
    """Count findings by category then code."""
    out: Dict[str, Dict[str, int]] = {}
    for f in all_findings:
        out.setdefault(f["category"], {})
        out[f["category"]][f["code"]] = out[f["category"]].get(f["code"], 0) + 1
    return out
