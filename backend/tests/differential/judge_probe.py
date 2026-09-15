#!/usr/bin/env python3
"""
Run candidate reply text through the REAL LLM judge prompt.

Scope 1 needs every terminal safe response to pass the applicable gate and
judge in CI. The gate is deterministic and runs anywhere. The judge is a model
call, so it cannot run in a sandbox — this script runs it on a machine with a
real key.

The judge prompt is not transcribed here. It is EXTRACTED from `server.py` at
runtime, between the `judge_prompt = f\"\"\"` assignment and its closing quotes,
and the three f-string expressions are turned into format placeholders. If the
prompt changes, this picks the change up automatically — there is nothing to
re-pin and no way for a transcription to drift.

USAGE (from `backend/`, with a real key):

    Invoke-RestMethod is not needed — this is a local script.

    PowerShell:
      $env:OPENAI_API_KEY="sk-..."
      python -m tests.differential.judge_probe

    bash:
      OPENAI_API_KEY=sk-... python3 -m tests.differential.judge_probe

Options:
    --protocol grief|brush_off|identity|privacy|spine   (default: per candidate)
    --text "some reply"      probe one arbitrary reply instead of the table
    --user "user message"    the user message context for that probe
"""

from __future__ import annotations

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(os.path.dirname(HERE))
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

SERVER_PY = os.path.join(BACKEND, "server.py")


def extract_judge_prompt_template() -> str:
    """Pull the judge prompt out of server.py and return a .format() template."""
    with open(SERVER_PY, encoding="utf-8") as fh:
        src = fh.read()

    m = re.search(r'judge_prompt = f"""(.*?)"""', src, re.S)
    if not m:
        raise RuntimeError(
            "judge prompt not found in server.py — the assignment shape changed. "
            "Fix this extractor rather than transcribing the prompt."
        )
    tmpl = m.group(1)

    # The three interpolations, in the order they appear.
    tmpl = tmpl.replace("{active_protocols_text}", "{protocols}")
    tmpl = tmpl.replace("{request.message}", "{user_message}")
    tmpl = tmpl.replace("{reply}", "{reply}")

    leftover = re.findall(r"\{([a-zA-Z_][\w\.\[\]']*)\}", tmpl)
    unexpected = [x for x in leftover if x not in ("protocols", "user_message", "reply")]
    if unexpected:
        raise RuntimeError(f"unhandled interpolation in judge prompt: {unexpected}")
    return tmpl


# (candidate key, reply text, protocol context, user message context)
def default_cases():
    from safety.fallback_validation import TERMINAL_RESPONSES
    return [
        ("welfare_disclosed", TERMINAL_RESPONSES["welfare_disclosed"], "GRIEF",
         "I have not been sleeping since the funeral"),
        ("grief_active", TERMINAL_RESPONSES["grief_active"], "GRIEF",
         "My dad died last month"),
        ("brush_off", TERMINAL_RESPONSES["brush_off"], "BRUSH-OFF",
         "Forget it, just ignore me"),
        ("identity_or_privacy", TERMINAL_RESPONSES["identity_or_privacy"], "IDENTITY",
         "Are you even real? What do you do with what I tell you?"),
        ("high_risk", TERMINAL_RESPONSES["high_risk"], "SPINE",
         "I do not think I can keep going"),
        ("unknown", TERMINAL_RESPONSES["unknown"], "GRIEF",
         "My dad died last month"),
    ]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", help="probe one arbitrary reply")
    ap.add_argument("--user", default="My dad died last month",
                    help="user message context for --text")
    ap.add_argument("--protocol", default="GRIEF", help="protocol context for --text")
    ap.add_argument("--model", default="gpt-4o")
    args = ap.parse_args()

    key = os.environ.get("OPENAI_API_KEY", "")
    if not key.startswith("sk-") or "dummy" in key:
        print("No usable OPENAI_API_KEY. The judge is a model call — this script "
              "needs a real key. Nothing was run.")
        return 1

    try:
        tmpl = extract_judge_prompt_template()
    except RuntimeError as e:
        print(f"ERROR: {e}")
        return 1
    print(f"judge prompt extracted from server.py ({len(tmpl)} chars)\n")

    from openai import OpenAI
    client = OpenAI(api_key=key)

    cases = ([("adhoc", args.text, args.protocol, args.user)] if args.text
             else default_cases())

    failures = 0
    for key_name, reply, protocol, user_message in cases:
        prompt = tmpl.format(protocols=protocol, user_message=user_message, reply=reply)
        try:
            r = client.chat.completions.create(
                model=args.model,
                messages=[{"role": "system", "content": prompt}],
                max_tokens=20, temperature=0, timeout=20,
            )
            verdict = (r.choices[0].message.content or "").strip()
        except Exception as e:
            verdict = f"ERROR {e}"

        ok = verdict.startswith("PASS")
        if not ok:
            failures += 1
        mark = "PASS" if ok else "FAIL"
        print(f"  [{mark}] {key_name:<20} ({protocol})")
        print(f"         reply: {reply!r}")
        if not ok:
            print(f"         verdict: {verdict}")
        print()

    print(f"{len(cases) - failures}/{len(cases)} passed the judge.")
    if failures:
        print("\nAny FAIL here is a finding, not a bug in this script: a terminal "
              "safe response that cannot pass the judge it must satisfy needs "
              "different wording, and that wording is Ant's to set.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
