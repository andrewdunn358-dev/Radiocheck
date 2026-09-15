"""
Single-source-of-truth regressions for the LLM judge prompt.

Ant, 15 Sept: "add a regression that proves the probe is consuming the current
canonical judge prompt and fails loudly if that relationship breaks again. I
don't want us fixing this particular source-shape dependency repeatedly as
server.py evolves."

Three consumers, one definition (safety/judge_prompt.py):

  1. runtime   — server.py's _build_judge_prompt closure must delegate to it
                 and server.py must contain NO inline copy of the rules text
  2. probe     — tests/differential/judge_probe.py must render through it
  3. .ps1      — tests/differential/judge_probe.ps1 must embed exactly it

These tests read source and files; they make no network calls.
"""

import os
import re

from safety.judge_prompt import (
    JUDGE_PROMPT_TEMPLATE,
    build_judge_prompt,
    template_fingerprint,
)

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER_PY = os.path.join(BACKEND, "server.py")
PROBE_PY = os.path.join(BACKEND, "tests", "differential", "judge_probe.py")
PROBE_PS1 = os.path.join(BACKEND, "tests", "differential", "judge_probe.ps1")

# A phrase that is unmistakably the judge rules text, used to detect copies.
SENTINEL = "strict behavioural judge"


def _read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


# --- the canonical module itself -------------------------------------------

def test_canonical_template_has_exactly_the_three_interpolations():
    slots = sorted(set(re.findall(r"\{([a-zA-Z_]+)\}", JUDGE_PROMPT_TEMPLATE)))
    assert slots == ["active_protocols_text", "candidate_reply", "user_message"], slots


def test_canonical_builder_renders_every_slot():
    p = build_judge_prompt(active_protocols_text="P!", user_message="U!", candidate_reply="R!")
    assert "P!" in p and "U!" in p and "R!" in p
    assert "{" not in p.replace("{}", ""), "unrendered placeholder left in prompt"
    assert SENTINEL in p


# --- 1. runtime consumes it, and does not carry its own copy -----------------

def test_server_has_no_inline_copy_of_the_judge_rules():
    src = _read(SERVER_PY)
    assert SENTINEL not in src, (
        "server.py contains judge rules text. The canonical prompt lives in "
        "safety/judge_prompt.py — an inline copy means the runtime and the probe "
        "can drift apart again."
    )


def test_server_closure_delegates_to_the_canonical_builder():
    src = _read(SERVER_PY)
    assert "from safety.judge_prompt import build_judge_prompt" in src
    m = re.search(r"def _build_judge_prompt\(candidate_reply: str\) -> str:(.*?)\n\n", src, re.S)
    assert m, "_build_judge_prompt closure not found in server.py"
    body = m.group(1)
    assert "_build_judge_prompt_canonical(" in body, (
        "the runtime closure no longer calls the canonical builder"
    )
    assert 'f"""' not in body and "f'''" not in body, (
        "the runtime closure has grown an inline f-string prompt again"
    )


def test_server_main_judge_path_still_uses_the_closure():
    src = _read(SERVER_PY)
    assert "judge_prompt = _build_judge_prompt(reply)" in src, (
        "the main judge path no longer routes through _build_judge_prompt"
    )


# --- 2. the Python probe consumes it, and does not scrape ---------------------

def test_probe_imports_the_canonical_builder_and_does_not_scrape():
    src = _read(PROBE_PY)
    assert "from safety.judge_prompt import" in src
    assert "build_judge_prompt" in src
    for scrape in ('judge_prompt = f"""', "extract_judge_prompt_template", "re.search(r'judge_prompt"):
        assert scrape not in src, f"probe still contains scraping code: {scrape!r}"


def test_probe_render_matches_the_runtime_prompt_exactly():
    from tests.differential.judge_probe import render
    args = dict(active_protocols_text="GRIEF", user_message="My dad died last month",
                candidate_reply="Take your time.")
    assert render("GRIEF", "My dad died last month", "Take your time.") == build_judge_prompt(**args)


# --- 3. the PowerShell probe embeds it, and is not stale ----------------------

def _ps1_embedded_template():
    src = _read(PROBE_PS1)
    m = re.search(r"\$template = @'\n(.*?)\n'@", src, re.S)
    assert m, "judge_probe.ps1 has no $template here-string"
    return m.group(1), src


def test_ps1_embedded_prompt_is_the_canonical_prompt():
    from tests.differential.judge_probe import ps1_template_text
    embedded, _ = _ps1_embedded_template()
    assert embedded == ps1_template_text(), (
        "judge_probe.ps1 is STALE — its embedded prompt differs from "
        "safety/judge_prompt.py. Regenerate with "
        "`python -m tests.differential.judge_probe --emit-ps1`."
    )


def test_ps1_fingerprint_matches_the_canonical_fingerprint():
    _, src = _ps1_embedded_template()
    m = re.search(r"\$fingerprint = '([0-9a-f]{16})'", src)
    assert m, "judge_probe.ps1 has no $fingerprint"
    assert m.group(1) == template_fingerprint(), (
        f"judge_probe.ps1 fingerprint {m.group(1)} != canonical {template_fingerprint()} "
        "— regenerate with --emit-ps1"
    )


def test_ps1_placeholders_round_trip():
    """The three <<...>> markers substitute back to the exact runtime prompt."""
    embedded, _ = _ps1_embedded_template()
    rendered = (embedded.replace("<<PROTOCOLS>>", "GRIEF")
                        .replace("<<USERMSG>>", "M")
                        .replace("<<REPLY>>", "R"))
    assert rendered == build_judge_prompt(active_protocols_text="GRIEF",
                                          user_message="M", candidate_reply="R")
