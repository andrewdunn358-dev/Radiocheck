#!/usr/bin/env python3
"""
RadioCheck — safeguarding path CLI probe.

Type a message, see what every layer concluded and what the client would have
received. Session state persists across lines, so multi-turn behaviour (grief
persistence, crisis_override clearing, escalating trajectory) can be tested by
hand the way a real conversation would hit it.

READ-ONLY. Calls production code and the hash-guarded transcription of the
inline handler chain. Writes nothing, touches no database, changes no
behaviour.

RUN IT (from `backend/`):

    JWT_SECRET_KEY=x ADMIN_SEED_PASSWORD=y MONGO_URL=mongodb://localhost:27017 \
    OPENAI_API_KEY=sk-test-dummy GEMINI_API_KEY=dummy TEST_ADMIN_PASSWORD=dummy \
    python3 -m tests.differential.cli

With a real OPENAI_API_KEY, add --live to enable the AI classifier, semantic
embeddings and the normaliser model call. Without it those layers are dark and
the banner says so.

One-shot, no prompt:

    python3 -m tests.differential.cli -m "I've got a plan and it's tonight"

Commands inside the prompt:

    :reset          start a fresh session (clears grief/identity state)
    :state          show the current session state dict
    :json           dump the full result row for the last message
    :under18 on|off toggle the client-asserted age flag
    :force          run the AI classifier even if the gate is closed (--live only)
    :help           this list
    :quit           exit
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(os.path.dirname(HERE))
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)


class C:
    """ANSI colours, disabled when not a tty or when NO_COLOR is set."""
    on = sys.stdout.isatty() and not os.environ.get("NO_COLOR")
    R = "\033[31m" if on else ""
    Y = "\033[33m" if on else ""
    G = "\033[32m" if on else ""
    B = "\033[34m" if on else ""
    DIM = "\033[2m" if on else ""
    BOLD = "\033[1m" if on else ""
    X = "\033[0m" if on else ""


def colour_level(level: Any) -> str:
    s = str(level)
    if s in ("RED", "CRITICAL", "IMMINENT"):
        return f"{C.R}{C.BOLD}{s}{C.X}"
    if s in ("AMBER", "HIGH", "MEDIUM"):
        return f"{C.Y}{s}{C.X}"
    if s in ("YELLOW", "LOW"):
        return f"{C.B}{s}{C.X}"
    return f"{C.DIM}{s}{C.X}"


def banner(runner, env: Dict[str, Any], fidelity: Dict[str, str]) -> None:
    print(f"\n{C.BOLD}RadioCheck safeguarding probe{C.X} — read-only, no writes\n")
    dark = [k for k, v in {
        "AI classifier": env["classifier_live"],
        "semantic embeddings": env["semantic_live"],
        "normaliser model call": env["normaliser_model_live"],
    }.items() if not v]
    if dark:
        print(f"  {C.Y}DARK LAYERS:{C.X} {', '.join(dark)} — no OpenAI reachable.")
        print(f"  {C.DIM}Results below are the offline subset. Re-run with a real "
              f"OPENAI_API_KEY and --live for the full path.{C.X}")
    else:
        print(f"  {C.G}All detector layers live.{C.X}")
    bad = {k: v for k, v in fidelity.items() if v != "OK"}
    if bad:
        print(f"  {C.R}TRANSCRIPTION DRIFT:{C.X} {bad}")
        print(f"  {C.R}The runtime column below may no longer match server.py.{C.X}")
    else:
        print(f"  {C.DIM}runtime chain transcription: verified against server.py{C.X}")
    print(f"\n  {C.DIM}:help for commands, :quit to exit{C.X}\n")


def render(row: Dict[str, Any]) -> None:
    w = 26
    print()
    print(f"  {C.BOLD}{'layer':<{w}}{'verdict':<12}{'detail'}{C.X}")
    print(f"  {C.DIM}{'-'*74}{C.X}")

    print(f"  {'1. legacy scorer':<{w}}{colour_level(row['legacy_risk_level']):<21}"
          f"score {row['legacy_score']}"
          + (f"  triggers: {row['legacy_triggers']}" if row['legacy_triggers'] else ""))

    print(f"  {'2. raw unified':<{w}}{colour_level(row['unified_risk_level']):<21}"
          f"score {row['unified_risk_score']}  failsafe={row['unified_failsafe']}"
          + (f" ({row['unified_failsafe_reason']})" if row['unified_failsafe_reason'] else ""))

    print(f"  {'3. reconciler':<{w}}{colour_level(row['reconciled_risk_level']):<21}"
          f"failsafe={row['reconciled_failsafe']}  rule={row['precedence_rule']}"
          + (f"  staff_review={row['reconciled_staff_review']}"
             if row['reconciled_staff_review'] else ""))

    overlay = row["runtime_safeguarding_triggered"]
    flag = f"{C.R}{C.BOLD}OVERLAY FIRES{C.X}" if overlay else f"{C.DIM}no overlay{C.X}"
    print(f"  {'4. CLIENT RECEIVES':<{w}}{colour_level(row['runtime_risk_level']):<21}"
          f"{flag}  riskScore {row['runtime_risk_score']} "
          f"({row['risk_score_source']})  exit {row['exit_path']}")

    print(f"\n  {C.DIM}detectors{C.X}   keyword {row['det_keyword_score']}"
          f" | semantic {row['det_semantic_highest']}"
          f"{'' if row['semantic_live'] else ' (dark)'}"
          f" | trajectory {row['det_trajectory_score']}"
          f" | patterns {row['det_patterns'] or '—'}"
          f" | escalating {row['det_is_escalating']}")

    gate = f"{C.G}OPEN{C.X}" if row["ai_gate_open"] else f"{C.Y}CLOSED{C.X}"
    print(f"  {C.DIM}classifier{C.X}  gate {gate} ({row['ai_gate_reason']})"
          f" | invoked {row['ai_invoked']}"
          + (f" | forced: {row.get('ai_forced_risk_level') or row.get('ai_forced_status')}"
             if row.get("ai_forced_status") else ""))

    norm = "yes" if row["normalise_triggered"] else "no"
    print(f"  {C.DIM}normaliser{C.X}  triggered {norm}"
          + (f" ({row['trigger_reasons']})" if row["trigger_reasons"] else "")
          + f" | model called {row.get('normalise_invoked')}"
          + f" | text changed {row['text_changed']}")

    print(f"  {C.DIM}protocols{C.X}   {row['protocol_files_effective'] or '—'}"
          + (f"   {C.Y}[crisis_override fired on '{row['crisis_override_match']}']{C.X}"
             if row["crisis_override"] else ""))

    if row.get("state_mutations"):
        print(f"  {C.DIM}state{C.X}       {' | '.join(row['state_mutations'])}")

    if row.get("overrides"):
        print(f"\n  {C.Y}overrides applied to the runtime verdict:{C.X}")
        for o in row["overrides"]:
            print(f"    • {o}")

    if row.get("findings"):
        print(f"\n  {C.BOLD}classified disagreements:{C.X}")
        seen = set()
        for f in row["findings"]:
            key = (f["category"], f["code"])
            if key in seen:
                continue
            seen.add(key)
            print(f"    [{f['category']}] {f['code']}")
            print(f"      {C.DIM}{f['evidence']}{C.X}")
    print()


def main() -> int:
    ap = argparse.ArgumentParser(description="RadioCheck safeguarding path probe")
    ap.add_argument("-m", "--message", help="one-shot: run this message and exit")
    ap.add_argument("--live", action="store_true",
                    help="enable OpenAI-dependent layers (needs a real key)")
    ap.add_argument("--force-classifier", action="store_true",
                    help="also call the classifier directly, bypassing the gate")
    ap.add_argument("--under18", action="store_true",
                    help="set the client-asserted is_under_18 flag")
    ap.add_argument("--json", action="store_true",
                    help="one-shot mode: print the raw row as JSON instead")
    args = ap.parse_args()

    from tests.differential import harness as H
    from tests.differential import runtime_chain as rc

    env = H.probe_environment()
    fidelity = rc.verify_fidelity()
    runner = H.Runner(live=args.live, force_classifier=args.force_classifier, env=env)

    import time
    sid = f"cli-{int(time.time())}"
    session: Dict[str, Any] = {}
    history: List[Dict[str, str]] = []
    turn = 0
    under18 = args.under18
    last: Dict[str, Any] = {}

    def run(text: str) -> Dict[str, Any]:
        nonlocal turn
        turn += 1
        row = runner.run_turn(
            scenario_id="cli", turn_index=turn, text=text,
            category="manual", expected_risk="unspecified",
            experiments=["A", "B", "C"], session_id=sid,
            session=session, history=list(history), is_under_18=under18)
        history.append({"role": "user", "text": text})
        history.append({"role": "assistant", "text": "[no reply generated — probe only]"})
        return row

    if args.message:
        row = run(args.message)
        if args.json:
            print(json.dumps(row, indent=2, default=str))
        else:
            render(row)
        return 0

    banner(runner, env, fidelity)

    while True:
        try:
            line = input(f"{C.BOLD}msg{C.X} {C.DIM}({turn+1}){C.X}> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not line:
            continue

        if line in (":quit", ":q", ":exit"):
            return 0
        if line == ":help":
            print(__doc__.split("Commands inside the prompt:")[1])
            continue
        if line == ":reset":
            sid = f"cli-{int(time.time())}"
            session.clear()
            history.clear()
            turn = 0
            print(f"  {C.DIM}new session{C.X}\n")
            continue
        if line == ":state":
            print("  " + json.dumps(session, indent=2, default=str).replace("\n", "\n  "))
            print()
            continue
        if line == ":json":
            print(json.dumps(last, indent=2, default=str) if last
                  else "  nothing run yet")
            continue
        if line.startswith(":under18"):
            under18 = line.endswith("on")
            print(f"  {C.DIM}is_under_18 = {under18}{C.X}\n")
            continue
        if line == ":force":
            if not env["classifier_live"]:
                print(f"  {C.Y}no live key — forcing would do nothing{C.X}\n")
            else:
                runner.force_classifier = True
                print(f"  {C.DIM}forced classifier enabled{C.X}\n")
            continue
        if line.startswith(":"):
            print(f"  {C.DIM}unknown command — :help{C.X}\n")
            continue

        try:
            last = run(line)
            render(last)
        except Exception as e:  # a probe should never take the session down
            print(f"  {C.R}probe error:{C.X} {type(e).__name__}: {e}\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
