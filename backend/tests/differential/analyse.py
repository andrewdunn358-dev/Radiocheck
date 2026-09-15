#!/usr/bin/env python3
"""
Turn `differential_results.json` into the three experiment tables and the
disagreement summary, as markdown.

    python3 -m tests.differential.analyse --results tests/differential/results
"""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, Dict, List

HERE = os.path.dirname(os.path.abspath(__file__))


def md_table(headers: List[str], rows: List[List[Any]]) -> str:
    out = ["| " + " | ".join(headers) + " |",
           "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        out.append("| " + " | ".join("" if c is None else str(c) for c in r) + " |")
    return "\n".join(out)


def experiment_a(rows: List[Dict[str, Any]]) -> str:
    sel = [r for r in rows if "A" in (r.get("experiments") or "")]
    body = []
    for r in sel:
        body.append([
            r["scenario_id"], r["turn"], r["expected_risk"],
            r["det_keyword_score"], r["det_semantic_highest"],
            r["det_trajectory_score"], r["det_patterns"] or "—",
            "OPEN" if r["ai_gate_open"] else "CLOSED", r["ai_gate_reason"],
            r.get("ai_forced_risk_level") or r.get("ai_forced_status", "NOT RUN"),
            r.get("ai_forced_latency_ms") or "—",
            r["reconciled_risk_level"], r["runtime_risk_level"],
            "YES" if r["runtime_safeguarding_triggered"] else "no",
        ])
    silent_but_expected = [
        r for r in sel
        if not r["ai_gate_open"] and r["expected_risk"] in ("high", "imminent")
    ]
    txt = md_table(
        ["scenario", "turn", "expected", "kw", "sem", "traj", "patterns",
         "gate", "gate reason", "forced result", "forced ms",
         "reconciled", "runtime", "overlay"], body)
    txt += (
        f"\n\n**Gate closed on {len(silent_but_expected)} of {len(sel)} experiment-A "
        f"scenarios that Ant scores high or imminent**: "
        + ", ".join(sorted({r["scenario_id"] for r in silent_but_expected}))
        + ".\n"
    )
    return txt


def experiment_b(rows: List[Dict[str, Any]]) -> str:
    sel = [r for r in rows if "B" in (r.get("experiments") or "")]
    body = []
    for r in sel:
        body.append([
            r["scenario_id"], r["turn"], r["expected_risk"],
            "YES" if r["crisis_override"] else "no",
            (r.get("crisis_override_match") or "—"),
            r.get("state_mutations_joined") or "|".join(r.get("state_mutations") or []) or "—",
            r["protocol_files_effective"] or "—",
            r["runtime_risk_level"],
        ])
    benign = [r for r in sel if r["crisis_override"] and r["expected_risk"] in ("none", "low")]
    txt = md_table(
        ["scenario", "turn", "expected", "override fired", "matched substring",
         "state mutations", "protocols after", "runtime"], body)
    txt += (
        f"\n\n**crisis_override fired on {len(benign)} scenarios Ant scores "
        f"none/low**: "
        + ", ".join(f"{r['scenario_id']}#{r['turn']} ({r['crisis_override_match']})"
                    for r in benign)
        + ".\n"
    )
    return txt


def experiment_c(rows: List[Dict[str, Any]]) -> str:
    sel = [r for r in rows if "C" in (r.get("experiments") or "")] or rows
    body = []
    for r in sel:
        body.append([
            r["scenario_id"], r["turn"], r["orig_sha"], r["norm_sha"],
            "YES" if r["text_changed"] else "no",
            "YES" if r["normalise_triggered"] else "no",
            r.get("trigger_reasons") or "—",
            r.get("dictionary_fail_rate", "—"),
            "YES" if r.get("normalise_invoked") else "no",
            r.get("normalise_latency_ms", 0),
            r["runtime_risk_level"],
        ])
    trig = [r for r in rows if r["normalise_triggered"]]
    benign_trig = [r for r in trig if r["expected_risk"] in ("none", "low")]
    txt = md_table(
        ["scenario", "turn", "orig hash", "norm hash", "differs", "triggered",
         "trigger reasons", "dict fail rate", "model called", "ms", "runtime"], body)
    txt += (
        f"\n\n**Trigger rate across the whole corpus: {len(trig)}/{len(rows)} "
        f"({100*len(trig)//max(len(rows),1)}%)**, of which {len(benign_trig)} are "
        f"scenarios Ant scores none/low.\n"
    )
    reasons: Dict[str, int] = {}
    for r in trig:
        for reason in (r.get("trigger_reasons") or "").split("|"):
            if reason:
                reasons[reason] = reasons.get(reason, 0) + 1
    txt += "\nTrigger condition breakdown:\n\n" + md_table(
        ["condition", "scenarios"], sorted(reasons.items(), key=lambda kv: -kv[1]))
    return txt


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=os.path.join(HERE, "results"))
    args = ap.parse_args()

    with open(os.path.join(args.results, "differential_results.json"), encoding="utf-8") as fh:
        data = json.load(fh)
    rows = data["rows"]

    parts = ["## Experiment A — AI classifier invocation gate\n", experiment_a(rows),
             "\n## Experiment B — crisis_override state clearing\n", experiment_b(rows),
             "\n## Experiment C — text normaliser\n", experiment_c(rows)]

    out = os.path.join(args.results, "experiment_tables.md")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(parts) + "\n")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
