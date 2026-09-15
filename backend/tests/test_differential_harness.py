"""
Guard tests for the Session 3 differential harness.

The harness reports the authoritative runtime outcome using a transcription of
inline logic in `server.buddy_chat` (`tests/differential/runtime_chain.py`).
A transcription is only evidence while it matches its source. These tests fail
the moment it stops matching, so a later PR that edits the correctives cannot
silently invalidate the Session 3 results.

They assert nothing about safety semantics and change no behaviour.
"""

import pytest

from tests.differential import reachability, runtime_chain


def test_transcribed_regions_match_server_py():
    """Every transcribed region of server.py still hashes to its pinned value."""
    status = runtime_chain.verify_fidelity()
    bad = {k: v for k, v in status.items() if v != "OK"}
    assert not bad, (
        "runtime_chain.py no longer matches server.py: "
        f"{bad}. The Session 3 differential results describe code that has since "
        "changed. Re-run the harness and re-pin with "
        "`python3 -m tests.differential.runtime_chain --repin`, and say so in the PR."
    )


def test_constants_match_server_py():
    """The copied phrase lists are still identical to the ones in server.py."""
    import re

    with open(runtime_chain.SERVER_PY, encoding="utf-8") as fh:
        src = fh.read()

    for phrase in runtime_chain.CRISIS_OVERRIDE_PHRASES:
        assert f"'{phrase}'" in src or f'"{phrase}"' in src, (
            f"crisis_override phrase {phrase!r} not found in server.py")
    for phrase in runtime_chain.NEGATION_PHRASES:
        assert f'"{phrase}"' in src or f"'{phrase}'" in src, (
            f"negation phrase {phrase!r} not found in server.py")

    # counts, so a REMOVED phrase is caught too, not just a changed one
    block = re.search(r"negation_phrases = \[(.*?)\]", src, re.S)
    assert block, "negation_phrases list not found in server.py"
    assert block.group(1).count(",") + 1 >= len(runtime_chain.NEGATION_PHRASES), (
        "server.py negation_phrases is shorter than the transcription")


def test_failsafe_block_still_returns_unconditionally():
    """The reachability proof's premise still holds.

    If this fails, the five branches Session 3 reported as unreachable may have
    become reachable — which changes the findings, for the better or worse.
    """
    proof = reachability.prove()
    assert proof["status"] == "PROVED", proof
    assert proof["returns_unconditionally"] is True, (
        "the `if failsafe_should_fire:` block no longer returns unconditionally; "
        "re-run the Session 3 reachability analysis")


def test_reachability_count_is_still_five():
    """Session 3 reported exactly five unreachable corrective branches."""
    report = reachability.full_report()
    assert report["total_unreachable"] == 5, (
        f"expected 5 unreachable branches as reported in Session 3, found "
        f"{report['total_unreachable']}: {report['unreachable_branches']} "
        f"{report['unreachable_elif_chain']}"
    )


def test_harness_imports_no_production_side_effects():
    """The harness must not be importable from production code."""
    import os
    backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    offenders = []
    for root, dirs, files in os.walk(backend):
        dirs[:] = [d for d in dirs if d not in {"tests", "__pycache__", ".git", "node_modules"}]
        for name in files:
            if not name.endswith(".py"):
                continue
            path = os.path.join(root, name)
            with open(path, encoding="utf-8", errors="replace") as fh:
                if "tests.differential" in fh.read():
                    offenders.append(os.path.relpath(path, backend))
    assert not offenders, f"production code imports the harness: {offenders}"


@pytest.mark.parametrize("scenario,expected_fires", [
    ("what's the plan for the weekend?", True),
    ("the plane was late getting into Brize", True),
    ("I was planning to get the garden done", True),
    ("see you tonight then", True),
    ("no override words at all here", False),
])
def test_crisis_override_substring_behaviour_is_as_transcribed(scenario, expected_fires):
    """Pins the as-found substring behaviour. NOT a claim that it is correct —
    Ant rules on that. If someone word-boundaries the list, this fails and the
    Session 3 experiment B numbers need re-running."""
    fires = any(p in scenario.lower() for p in runtime_chain.CRISIS_OVERRIDE_PHRASES)
    assert fires is expected_fires
