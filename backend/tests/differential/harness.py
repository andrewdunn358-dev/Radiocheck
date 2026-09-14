#!/usr/bin/env python3
"""
RadioCheck — Session 3 differential harness.

Runs every corpus scenario through each safety component independently AND
through the decision chain, and records the four verdict columns Ant specified
as separate results:

    legacy  |  raw unified  |  reconciled  |  authoritative runtime outcome

plus the contributing detector outputs inside unified (keyword, semantic,
trajectory/patterns, AI classifier), so disagreement can be explained rather
than just counted.

MAKES NO FIXES. Changes no production behaviour. Imports production code and
calls it; the only transcription is `runtime_chain.py`, which is hash-guarded
against the source it transcribes.

USAGE
-----
From `backend/`:

    # sandbox / offline — everything that does not need api.openai.com
    JWT_SECRET_KEY=x ADMIN_SEED_PASSWORD=y MONGO_URL=mongodb://localhost:27017 \
    OPENAI_API_KEY=sk-test-dummy GEMINI_API_KEY=dummy TEST_ADMIN_PASSWORD=dummy \
    python3 -m tests.differential.harness --out tests/differential/results

    # the other half, on a machine with a real key (Frankie)
    JWT_SECRET_KEY=x ADMIN_SEED_PASSWORD=y MONGO_URL=mongodb://localhost:27017 \
    OPENAI_API_KEY=<real key> GEMINI_API_KEY=dummy TEST_ADMIN_PASSWORD=dummy \
    python3 -m tests.differential.harness --live --force-classifier \
        --out tests/differential/results

`--force-classifier` bypasses `should_invoke_ai_classifier()` FOR THE HARNESS
ONLY, by calling the classifier directly. Production invocation behaviour is
untouched.

PRIVACY: no raw message text is written to any results file. Scenario IDs and
sha256 prefixes only.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(os.path.dirname(HERE))
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from tests.differential import classify as classify_mod           # noqa: E402
from tests.differential import reachability as reach              # noqa: E402
from tests.differential import runtime_chain as rc                # noqa: E402

CORPUS_PATH = os.path.join(HERE, "corpus.json")


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def sha12(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def _first_match(text_lower: str, phrases: List[str]) -> Optional[str]:
    for p in phrases:
        if p in text_lower:
            return p
    return None


# ---------------------------------------------------------------------------
# environment probe — which detectors are actually live
# ---------------------------------------------------------------------------

def probe_environment() -> Dict[str, Any]:
    from safety.semantic_model import full_semantic_analysis

    env: Dict[str, Any] = {
        "openai_key_present": bool(os.environ.get("OPENAI_API_KEY", "").startswith("sk-")
                                   and "dummy" not in os.environ.get("OPENAI_API_KEY", "")),
        "semantic_live": False,
        "classifier_live": False,
        "normaliser_model_live": False,
    }
    try:
        r = full_semantic_analysis("I want to end it all tonight")
        env["semantic_live"] = bool(r.get("highest_similarity", 0) > 0)
    except Exception as e:
        env["semantic_probe_error"] = str(e)[:120]
    env["classifier_live"] = env["openai_key_present"]
    env["normaliser_model_live"] = env["openai_key_present"]
    return env


# ---------------------------------------------------------------------------
# the per-turn run
# ---------------------------------------------------------------------------

class Runner:
    def __init__(self, live: bool, force_classifier: bool, env: Dict[str, Any]):
        self.live = live
        self.force_classifier = force_classifier
        self.env = env

        import server  # noqa
        from safety.unified_safety import analyze_message_unified
        from safety.verdict_reconciler import (extract_verdicts_from_unified,
                                               reconcile_verdicts)
        from safety.safety_monitor import assess_message_safety
        from safety.semantic_model import full_semantic_analysis
        from safety.conversation_monitor import analyze_message_with_context
        from safety.ai_safety_classifier import should_invoke_ai_classifier
        from safety.unified_safety import _risk_level_to_score
        from safety.text_normalizer import should_normalise
        from personas.soul_loader import get_protocol_files, extract_grief_name

        self.server = server
        self.analyze_message_unified = analyze_message_unified
        self.extract_verdicts_from_unified = extract_verdicts_from_unified
        self.reconcile_verdicts = reconcile_verdicts
        self.assess_message_safety = assess_message_safety
        self.full_semantic_analysis = full_semantic_analysis
        self.analyze_message_with_context = analyze_message_with_context
        self.should_invoke_ai_classifier = should_invoke_ai_classifier
        self._risk_level_to_score = _risk_level_to_score
        self.should_normalise = should_normalise
        self.get_protocol_files = get_protocol_files
        self.extract_grief_name = extract_grief_name

    # -- experiment C ------------------------------------------------------
    def normalise(self, text: str) -> Dict[str, Any]:
        """Record trigger logic and, when live, the model call. Never raises."""
        from safety import text_normalizer as tn

        out: Dict[str, Any] = {
            "normalise_triggered": False,
            "trigger_reasons": [],
            "normalise_invoked": False,
            "orig_sha": sha12(text),
            "norm_sha": sha12(text),
            "text_changed": False,
            "normalise_latency_ms": 0.0,
        }
        stripped = text.strip()
        if len(stripped.split()) > 1:
            if tn._has_numeric_substitutions(stripped):
                out["trigger_reasons"].append("numeric_substitutions")
            if tn._has_word_fragments(stripped):
                out["trigger_reasons"].append("word_fragments")
            if tn._is_excessive_caps(stripped):
                out["trigger_reasons"].append("excessive_caps")
            if tn._lacks_punctuation(stripped):
                out["trigger_reasons"].append("lacks_punctuation")
            fr = tn._dictionary_fail_rate(stripped)
            out["dictionary_fail_rate"] = round(fr, 3)
            if fr > 0.20:
                out["trigger_reasons"].append("dictionary_fail_rate")
        out["normalise_triggered"] = bool(out["trigger_reasons"])

        if self.live and self.env["normaliser_model_live"]:
            import asyncio
            t0 = time.time()
            try:
                normalised, was = asyncio.run(tn.normalise_text(text))
                out["normalise_invoked"] = bool(was)
                out["norm_sha"] = sha12(normalised)
                out["text_changed"] = normalised != text
                out["normalised_text"] = normalised  # used in-process only, stripped on write
            except Exception as e:
                out["normalise_error"] = str(e)[:120]
            out["normalise_latency_ms"] = round((time.time() - t0) * 1000, 1)
        else:
            # local, non-LLM half still runs in production on every input
            local = tn._normalise_negation_prefixes(text)
            out["local_prefix_expansion"] = local != text
            out["norm_sha"] = sha12(local)
            out["text_changed"] = local != text
            out["normalised_text"] = local
        return out

    # -- experiment A ------------------------------------------------------
    def force_classifier_run(self, text: str, session_id: str,
                             history: List[Dict[str, str]]) -> Dict[str, Any]:
        out: Dict[str, Any] = {"ai_forced_invoked": False,
                               "ai_forced_risk_level": None,
                               "ai_forced_score": None,
                               "ai_forced_latency_ms": None}
        if not (self.live and self.force_classifier and self.env["classifier_live"]):
            out["ai_forced_status"] = "NOT RUN (needs --live --force-classifier and a real key)"
            return out
        import asyncio
        from safety.ai_safety_classifier import classify_message_with_ai
        t0 = time.time()
        try:
            res = asyncio.run(classify_message_with_ai(
                message=text, conversation_history=history,
                previous_sessions=None, use_cache=False))
            out["ai_forced_invoked"] = bool(res.get("ai_used"))
            out["ai_forced_risk_level"] = res.get("risk_level")
            out["ai_forced_score"] = res.get("risk_score")
            out["ai_forced_status"] = "RUN"
        except Exception as e:
            out["ai_forced_status"] = f"ERROR {str(e)[:100]}"
        out["ai_forced_latency_ms"] = round((time.time() - t0) * 1000, 1)
        return out

    # -- one turn ----------------------------------------------------------
    def run_turn(self, *, scenario_id: str, turn_index: int, text: str,
                 category: str, expected_risk: str, experiments: List[str],
                 session_id: str, session: Dict[str, Any],
                 history: List[Dict[str, str]],
                 is_under_18: bool = False) -> Dict[str, Any]:

        row: Dict[str, Any] = {
            "scenario_id": scenario_id,
            "turn": turn_index,
            "category": category,
            "expected_risk": expected_risk,
            "experiments": "|".join(experiments),
            "text_sha": sha12(text),
            "n_words": len(text.split()),
        }

        # --- C: normalisation -------------------------------------------
        norm = self.normalise(text)
        safeguarding_text = norm.pop("normalised_text", text)
        row.update({k: v for k, v in norm.items()})
        row["trigger_reasons"] = "|".join(norm.get("trigger_reasons", []))

        # --- protocol selection (production calls this on the ORIGINAL) --
        protocol_files = list(self.get_protocol_files(text) or [])
        row["protocol_files_original"] = "|".join(protocol_files)
        pf_norm = list(self.get_protocol_files(safeguarding_text) or [])
        row["protocol_files_normalised"] = "|".join(pf_norm)
        row["grief_gate_sees_original"] = (pf_norm != protocol_files)

        # --- B: pre-scoring state ---------------------------------------
        tr = rc.apply_pre_scoring_state(
            message=text, session=session, protocol_files=protocol_files,
            extract_grief_name=self.extract_grief_name)
        protocol_files = tr.protocol_files
        row["crisis_override"] = tr.crisis_override
        row["crisis_override_match"] = _first_match(text.lower(), rc.CRISIS_OVERRIDE_PHRASES)
        row["crisis_override_benign"] = bool(
            tr.crisis_override and expected_risk in ("none", "low"))
        row["state_mutations"] = tr.mutations
        row["state_before"] = json.dumps(tr.state_before, default=str)
        row["state_after"] = json.dumps(tr.state_after, default=str)
        row["protocol_files_effective"] = "|".join(protocol_files)

        # --- 1. LEGACY ---------------------------------------------------
        should_escalate, risk_data = self.server.check_safeguarding(
            safeguarding_text, session_id, character_id="tommy",
            protocol_files=protocol_files)
        row["legacy_risk_level"] = risk_data.get("risk_level")
        row["legacy_score"] = risk_data.get("score")
        row["legacy_should_escalate"] = bool(should_escalate)
        row["legacy_triggers"] = "|".join(
            str(t.get("indicator")) for t in risk_data.get("triggered_indicators", []))

        # --- contributing detectors, run independently -------------------
        kw = self.assess_message_safety(safeguarding_text)
        # TWO SCALES, deliberately both recorded. assess_message_safety returns
        # `risk_score` on a 0-10 scale ("kill myself" = 10.0). unified_safety
        # does NOT use it: at unified_safety.py:147 it discards the number and
        # converts the *level* via _risk_level_to_score() to 0-100, and that is
        # what `should_invoke_ai_classifier(rule_based_score=...)` receives and
        # tests against 60. Reproducing the gate with the raw 0-10 number gives
        # the wrong answer, so use the converted one.
        row["det_keyword_raw_score_0_10"] = kw.get("risk_score")
        row["det_keyword_level"] = kw.get("risk_level")
        row["det_keyword_score"] = self._risk_level_to_score(kw.get("risk_level", "none"))
        row["det_keyword_triggers"] = "|".join(
            str(x) for x in (kw.get("specific_triggers") or [])[:6])

        sem = self.full_semantic_analysis(safeguarding_text)
        row["det_semantic_highest"] = round(float(sem.get("highest_similarity", 0) or 0), 3)
        row["det_semantic_combined"] = round(float(sem.get("combined_semantic_score", 0) or 0), 3)
        row["semantic_live"] = self.env["semantic_live"]
        row["normaliser_model_live"] = self.env["normaliser_model_live"]

        conv = self.analyze_message_with_context(
            message=safeguarding_text, session_id=session_id + "-det",
            user_id=session_id + "-det", character="tommy",
            semantic_score=sem.get("highest_similarity", 0.0))
        row["det_trajectory_score"] = conv.get("conversation_risk_score")
        row["det_patterns"] = "|".join(conv.get("detected_patterns") or [])
        row["det_is_escalating"] = bool(conv.get("is_escalating"))

        # --- A: is the classifier gate open? -----------------------------
        gate_open = self.should_invoke_ai_classifier(
            rule_based_score=row["det_keyword_score"] or 0,   # 0-100, as production
            keyword_triggered=bool(kw.get("specific_triggers")),
            semantic_score=sem.get("highest_similarity", 0),
            pattern_detected=bool(conv.get("detected_patterns")),
            conversation_escalating=bool(conv.get("is_escalating")),
        )
        row["ai_gate_open"] = bool(gate_open)
        row["ai_gate_reason"] = (
            "rule_score>=60" if (row["det_keyword_score"] or 0) >= 60 else
            "keyword_triggered" if kw.get("specific_triggers") else
            "semantic>=0.5" if (sem.get("highest_similarity", 0) or 0) >= 0.5 else
            "pattern" if conv.get("detected_patterns") else
            "escalating" if conv.get("is_escalating") else "closed"
        )

        # --- 2. RAW UNIFIED ----------------------------------------------
        t0 = time.time()
        unified = self.analyze_message_unified(
            message=safeguarding_text, session_id=session_id, user_id=session_id,
            character="tommy", is_under_18=is_under_18, human_support_available=True)
        row["unified_latency_ms"] = round((time.time() - t0) * 1000, 1)
        row["unified_risk_level"] = unified.get("risk_level")
        row["unified_risk_score"] = unified.get("risk_score")
        row["unified_failsafe"] = bool(unified.get("failsafe_triggered"))
        row["unified_failsafe_reason"] = unified.get("failsafe_reason")
        row["unified_keyword_score"] = (unified.get("component_scores") or {}).get("keyword")
        row["unified_semantic_score"] = (unified.get("component_scores") or {}).get("semantic")
        row["unified_conversation_score"] = (unified.get("component_scores") or {}).get("conversation")
        row["unified_patterns"] = "|".join(unified.get("detected_patterns") or [])
        row["unified_rapid_escalation"] = bool(unified.get("rapid_escalation"))
        row["unified_thresholds"] = json.dumps(unified.get("thresholds_applied"))
        aic = unified.get("ai_classification") or {}
        row["ai_invoked"] = bool(aic.get("invoked"))
        row["ai_risk_level"] = aic.get("risk_level")
        row["ai_live"] = self.env["classifier_live"]

        # --- A: forced classifier ---------------------------------------
        row.update(self.force_classifier_run(safeguarding_text, session_id, history))

        # --- 3. RECONCILED ------------------------------------------------
        kwv, clsv, cls_err = self.extract_verdicts_from_unified(unified)
        final_verdict = self.reconcile_verdicts(
            keyword=kwv, classifier=clsv, message_lower=safeguarding_text.lower(),
            classifier_error=cls_err, session_id=session_id, character="tommy")
        row["reconciled_risk_level"] = getattr(final_verdict, "risk_level", None)
        row["reconciled_failsafe"] = bool(getattr(final_verdict, "failsafe_triggered", False))
        row["reconciled_failsafe_reason"] = getattr(final_verdict, "failsafe_reason", None)
        row["reconciled_staff_review"] = bool(getattr(final_verdict, "staff_review_required", False))
        row["precedence_rule"] = getattr(final_verdict, "precedence_rule_fired", None)
        row["classifier_error"] = str(cls_err) if cls_err else ""

        # --- 4. AUTHORITATIVE RUNTIME OUTCOME -----------------------------
        outcome = rc.apply_runtime_chain(
            legacy_risk_level=row["legacy_risk_level"],
            legacy_should_escalate=row["legacy_should_escalate"],
            legacy_score=row["legacy_score"],
            unified=unified, final_verdict=final_verdict,
            safeguarding_text=safeguarding_text, protocol_files=protocol_files)
        row["runtime_risk_level"] = outcome.risk_level
        row["runtime_should_escalate"] = outcome.should_escalate
        row["runtime_safeguarding_triggered"] = outcome.safeguarding_triggered
        row["runtime_risk_score"] = outcome.risk_score
        row["risk_score_source"] = outcome.risk_score_source
        row["exit_path"] = outcome.exit_path
        row["overrides"] = outcome.overrides
        row["inline_negation_hit"] = outcome.has_negation
        row["inline_reversal_hit"] = outcome.has_reversal
        row["negation_confirmed"] = outcome.negation_confirmed

        # --- classification ----------------------------------------------
        row["findings"] = classify_mod.classify_row(row)
        return row


# ---------------------------------------------------------------------------
# driver
# ---------------------------------------------------------------------------

CSV_COLUMNS = [
    "scenario_id", "turn", "category", "expected_risk", "experiments", "text_sha",
    "legacy_risk_level", "legacy_score", "legacy_should_escalate",
    "unified_risk_level", "unified_risk_score", "unified_failsafe", "unified_failsafe_reason",
    "reconciled_risk_level", "reconciled_failsafe", "reconciled_staff_review", "precedence_rule",
    "runtime_risk_level", "runtime_should_escalate", "runtime_safeguarding_triggered",
    "runtime_risk_score", "risk_score_source", "exit_path", "overrides_joined",
    "det_keyword_score", "det_keyword_raw_score_0_10", "det_keyword_level",
    "det_semantic_highest", "det_trajectory_score",
    "det_patterns", "det_is_escalating", "semantic_live",
    "ai_gate_open", "ai_gate_reason", "ai_invoked", "ai_risk_level",
    "ai_forced_status", "ai_forced_risk_level", "ai_forced_latency_ms",
    "normalise_triggered", "trigger_reasons", "normalise_invoked", "text_changed",
    "orig_sha", "norm_sha", "dictionary_fail_rate", "normalise_latency_ms",
    "crisis_override", "crisis_override_match", "state_mutations_joined",
    "protocol_files_effective", "grief_gate_sees_original",
    "inline_negation_hit", "negation_confirmed",
    "unified_latency_ms", "findings_joined",
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "results"))
    ap.add_argument("--live", action="store_true",
                    help="enable OpenAI-dependent detectors (needs a real key)")
    ap.add_argument("--force-classifier", action="store_true",
                    help="also call the AI classifier directly, bypassing the gate "
                         "(harness only — production invocation is untouched)")
    ap.add_argument("--corpus", default=CORPUS_PATH)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    fidelity = rc.verify_fidelity()
    env = probe_environment()
    runner = Runner(live=args.live, force_classifier=args.force_classifier, env=env)

    with open(args.corpus, "r", encoding="utf-8") as fh:
        corpus = json.load(fh)

    rows: List[Dict[str, Any]] = []
    stamp = str(int(time.time()))

    for sc in corpus["single_turn"]:
        sid = f"h-{sc['id']}-{stamp}"
        session: Dict[str, Any] = {}
        rows.append(runner.run_turn(
            scenario_id=sc["id"], turn_index=1, text=sc["text"],
            category=sc["category"], expected_risk=sc["expected_risk"],
            experiments=sc.get("experiments", []), session_id=sid,
            session=session, history=[]))

    for sc in corpus["multi_turn"]:
        sid = f"h-{sc['id']}-{stamp}"
        session = {}
        history: List[Dict[str, str]] = []
        for i, turn in enumerate(sc["turns"], start=1):
            rows.append(runner.run_turn(
                scenario_id=sc["id"], turn_index=i, text=turn["text"],
                category=sc["category"], expected_risk=turn["expected_risk"],
                experiments=sc.get("experiments", []), session_id=sid,
                session=session, history=list(history)))
            history.append({"role": "user", "text": turn["text"]})
            history.append({"role": "assistant", "text": "[reply not generated — no model]"})

    all_findings = [f for r in rows for f in r["findings"]]

    meta = {
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "commit": os.popen("git -C %s rev-parse HEAD" % BACKEND).read().strip()[:12],
        "live": args.live,
        "force_classifier": args.force_classifier,
        "environment": env,
        "transcription_fidelity": fidelity,
        "static_reachability_proof": reach.full_report(),
        "detectors_not_run": [
            k for k, v in {
                "ai_classifier": env["classifier_live"],
                "semantic_embeddings": env["semantic_live"],
                "normaliser_model_call": env["normaliser_model_live"],
                "persona_generation": env["classifier_live"],
                "llm_judge": env["classifier_live"],
            }.items() if not v
        ],
        "scenario_count": len(rows),
        "finding_count": len(all_findings),
        "findings_by_category": classify_mod.summarise(all_findings),
    }

    json_path = os.path.join(args.out, "differential_results.json")
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump({"meta": meta, "rows": rows}, fh, indent=2, default=str)

    csv_path = os.path.join(args.out, "differential_results.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            flat = dict(r)
            flat["overrides_joined"] = "|".join(r.get("overrides") or [])
            flat["state_mutations_joined"] = "|".join(r.get("state_mutations") or [])
            flat["findings_joined"] = "|".join(
                f"{f['category']}:{f['code']}" for f in r["findings"])
            w.writerow(flat)

    print(json.dumps(meta, indent=2))
    print(f"\nwrote {json_path}\nwrote {csv_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
