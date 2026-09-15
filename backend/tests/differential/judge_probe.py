#!/usr/bin/env python3
"""
Run candidate reply text through the REAL LLM judge prompt.

Scope 1 needs every terminal safe response to pass the applicable gate and
judge in CI. The gate is deterministic and runs anywhere. The judge is a model
call, so it cannot run in a sandbox — this script runs it on a machine with a
real key.

The judge prompt is neither transcribed nor scraped. It is IMPORTED from
`safety/judge_prompt.py`, the single canonical definition the runtime itself
uses (Ant, 15 Sept). If that relationship ever breaks,
`tests/test_judge_prompt_single_source.py` fails.

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

from safety.judge_prompt import (  # noqa: E402  — canonical, dependency-free
    build_judge_prompt,
    template_fingerprint,
)


def render(protocols: str, user_message: str, reply: str) -> str:
    """The exact prompt the runtime would use for this reply. Single source:
    safety/judge_prompt.py. Nothing is scraped from server.py any more."""
    return build_judge_prompt(active_protocols_text=protocols,
                              user_message=user_message, candidate_reply=reply)


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


PS1_PATH = os.path.join(HERE, "judge_probe.ps1")


def ps1_template_text() -> str:
    """The prompt as it must appear inside the .ps1 here-string."""
    from safety.judge_prompt import JUDGE_PROMPT_TEMPLATE
    return (JUDGE_PROMPT_TEMPLATE
            .replace("{active_protocols_text}", "<<PROTOCOLS>>")
            .replace("{user_message}", "<<USERMSG>>")
            .replace("{candidate_reply}", "<<REPLY>>"))


def emit_ps1() -> int:
    """Regenerate judge_probe.ps1. The CI regression compares the file's
    embedded here-string to ps1_template_text(), so a stale .ps1 fails."""
    import json as _json
    from safety.fallback_validation import TERMINAL_RESPONSES
    cases = default_cases() + [
        ("s4P3_gate_rejected", "Tell me about the drinking.", "GRIEF", "The drinking is bad since"),
    ]
    fp = template_fingerprint()
    body = ps1_template_text()
    assert "'@" not in body, "prompt contains a PowerShell here-string terminator"
    L = ["# RadioCheck - judge probe via Invoke-RestMethod (no Python needed)",
         f"# GENERATED from backend/safety/judge_prompt.py - fingerprint {fp}",
         "# Regenerate with: python -m tests.differential.judge_probe --emit-ps1",
         "# A CI test fails if this file's embedded prompt drifts from the canonical one.",
         "#", "#   $env:OPENAI_API_KEY=\"sk-...\"", "#   .\\judge_probe.ps1", "",
         "if (-not $env:OPENAI_API_KEY) { Write-Host 'Set $env:OPENAI_API_KEY first'; exit 1 }", "",
         f"$fingerprint = '{fp}'", "$template = @'", body, "'@", "", "$cases = @("]
    for k, r, proto, um in cases:
        L.append("  @{ name='%s'; protocol='%s'; user=%s; reply=%s }" % (k, proto, _json.dumps(um), _json.dumps(r)))
    L += [")", "", PS1_LOOP]
    with open(PS1_PATH, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L))
    print(f"wrote {PS1_PATH} (fingerprint {fp}, {len(cases)} cases)")
    return 0


PS1_LOOP = '''foreach ($c in $cases) {
  $prompt = $template.Replace('<<PROTOCOLS>>', $c.protocol).Replace('<<USERMSG>>', $c.user).Replace('<<REPLY>>', $c.reply)
  $body = @{ model = 'gpt-4o'; messages = @(@{ role = 'system'; content = $prompt }); max_tokens = 20; temperature = 0 } | ConvertTo-Json -Depth 5
  try {
    $r = Invoke-RestMethod -Uri 'https://api.openai.com/v1/chat/completions' -Method Post `
         -Headers @{ Authorization = "Bearer $env:OPENAI_API_KEY" } `
         -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
    $verdict = $r.choices[0].message.content.Trim()
  } catch { $verdict = "ERROR $_" }
  $mark = if ($verdict.StartsWith('PASS')) { 'PASS' } else { 'FAIL' }
  Write-Host ("[{0}] {1} ({2})" -f $mark, $c.name, $c.protocol)
  Write-Host ("      reply:   {0}" -f $c.reply)
  Write-Host ("      verdict: {0}" -f $verdict)
  Write-Host ''
}
Write-Host ("prompt fingerprint {0}" -f $fingerprint)'''


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", help="probe one arbitrary reply")
    ap.add_argument("--user", default="My dad died last month",
                    help="user message context for --text")
    ap.add_argument("--protocol", default="GRIEF", help="protocol context for --text")
    ap.add_argument("--model", default="gpt-4o")
    ap.add_argument("--emit-ps1", action="store_true",
                    help="regenerate judge_probe.ps1 from the canonical prompt and exit")
    args = ap.parse_args()

    if args.emit_ps1:
        return emit_ps1()

    key = os.environ.get("OPENAI_API_KEY", "")
    if not key.startswith("sk-") or "dummy" in key:
        print("No usable OPENAI_API_KEY. The judge is a model call — this script "
              "needs a real key. Nothing was run.")
        return 1

    print(f"canonical judge prompt: safety/judge_prompt.py "
          f"(fingerprint {template_fingerprint()})\n")

    from openai import OpenAI
    client = OpenAI(api_key=key)

    cases = ([("adhoc", args.text, args.protocol, args.user)] if args.text
             else default_cases())

    failures = 0
    for key_name, reply, protocol, user_message in cases:
        prompt = render(protocol, user_message, reply)
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
