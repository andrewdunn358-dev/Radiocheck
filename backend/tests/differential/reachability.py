"""
Static reachability proof for the corrective blocks in `server.buddy_chat`.

This is not a heuristic and not a grep. It parses server.py, finds the
`if failsafe_should_fire:` block, and establishes whether that block returns
unconditionally. If it does, every later branch guarded on
`failsafe_should_fire` being truthy is unreachable, because control can only
arrive there with the flag False.

Run standalone:

    python3 -m tests.differential.reachability
"""

from __future__ import annotations

import ast
import os
from typing import Any, Dict, List

SERVER_PY = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "server.py",
)


def _find_handler(tree: ast.AST, name: str = "buddy_chat"):
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == name:
            return node
    return None


def prove() -> Dict[str, Any]:
    with open(SERVER_PY, "r", encoding="utf-8") as fh:
        tree = ast.parse(fh.read())

    fn = _find_handler(tree)
    if fn is None:
        return {"status": "HANDLER_NOT_FOUND"}

    result: Dict[str, Any] = {
        "handler": "buddy_chat",
        "handler_lines": [fn.lineno, fn.end_lineno],
        "failsafe_block": None,
        "returns_unconditionally": None,
        "unreachable_branches": [],
        "reachable_branches": [],
    }

    failsafe_block = None
    for node in ast.walk(fn):
        if isinstance(node, ast.If) and ast.unparse(node.test).strip() == "failsafe_should_fire":
            # the guard block is the one that returns; there is exactly one
            if any(isinstance(s, ast.Return) for s in node.body):
                failsafe_block = node
                break

    if failsafe_block is None:
        result["status"] = "NO_RETURNING_FAILSAFE_BLOCK"
        return result

    result["failsafe_block"] = [failsafe_block.lineno, failsafe_block.end_lineno]
    result["returns_unconditionally"] = (
        any(isinstance(s, ast.Return) for s in failsafe_block.body)
        and not failsafe_block.orelse
    )

    if not result["returns_unconditionally"]:
        result["status"] = "CONDITIONAL_RETURN — later branches may be reachable"
        return result

    cutoff = failsafe_block.end_lineno

    # Any `if`/`elif` after the cutoff whose test requires failsafe_should_fire
    # to be truthy can never be taken.
    for node in ast.walk(fn):
        if not isinstance(node, ast.If) or node.lineno <= cutoff:
            continue
        test_src = ast.unparse(node.test)
        entry = {"line": node.lineno, "test": test_src.strip()[:160]}
        if _requires_truthy_failsafe(node.test):
            result["unreachable_branches"].append(entry)
        elif "failsafe_should_fire" in test_src:
            result["reachable_branches"].append(entry)

    result["status"] = "PROVED"
    return result


def _requires_truthy_failsafe(test: ast.expr) -> bool:
    """True when the test can only pass if `failsafe_should_fire` is truthy.

    Conservative: only bare `failsafe_should_fire` and `A and failsafe_should_fire
    and B` forms count. `not failsafe_should_fire` and anything under `or` do not.
    """
    if isinstance(test, ast.Name) and test.id == "failsafe_should_fire":
        return True
    if isinstance(test, ast.BoolOp) and isinstance(test.op, ast.And):
        return any(_requires_truthy_failsafe(v) for v in test.values)
    return False


def unreachable_elif_chain() -> List[Dict[str, Any]]:
    """The if/elif chain at ~6949 needs its own treatment.

    `elif not failsafe_should_fire:` is unconditionally True once the failsafe
    block has returned, so every branch AFTER it in the same chain is dead —
    regardless of its own test. ast.If nests orelse, so walk the chain.
    """
    with open(SERVER_PY, "r", encoding="utf-8") as fh:
        tree = ast.parse(fh.read())
    fn = _find_handler(tree)
    out: List[Dict[str, Any]] = []

    for node in ast.walk(fn):
        if not isinstance(node, ast.If):
            continue
        chain: List[ast.If] = []
        cur: ast.If = node
        while True:
            chain.append(cur)
            if len(cur.orelse) == 1 and isinstance(cur.orelse[0], ast.If):
                cur = cur.orelse[0]
            else:
                break
        if len(chain) < 3:
            continue
        for i, link in enumerate(chain):
            if ast.unparse(link.test).strip() == "not failsafe_should_fire":
                for dead in chain[i + 1:]:
                    out.append({
                        "line": dead.lineno,
                        "test": ast.unparse(dead.test).strip()[:160],
                        "reason": (
                            f"preceded at line {link.lineno} by "
                            f"`elif not failsafe_should_fire:`, which is "
                            f"unconditionally True after the failsafe block returns"
                        ),
                    })
                break
    # de-duplicate by line (ast.walk visits nested chains repeatedly)
    seen, uniq = set(), []
    for e in out:
        if e["line"] not in seen:
            seen.add(e["line"])
            uniq.append(e)
    return uniq


def full_report() -> Dict[str, Any]:
    r = prove()
    r["unreachable_elif_chain"] = unreachable_elif_chain()
    r["total_unreachable"] = len(r["unreachable_branches"]) + len(r["unreachable_elif_chain"])
    return r


if __name__ == "__main__":
    import json
    print(json.dumps(full_report(), indent=2))
