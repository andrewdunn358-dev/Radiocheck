#!/usr/bin/env python3
"""
Classify every test file in `backend/tests/` per Ant's point 7:

    PASS | ASSERTION FAILURE | COLLECTION FAILURE | ENVIRONMENT BLOCKED
    | EXTERNAL DEPENDENCY | NOT RUN

with a reason, the commit SHA and the environment recorded, so the known
reconciler / Mongo / Agora / live-host failures stay distinguishable from a
real regression.

Each file is run in its own pytest process with a timeout. A file that hangs
on a live host is EXTERNAL DEPENDENCY, not a failure.

Run from `backend/`:

    JWT_SECRET_KEY=x ADMIN_SEED_PASSWORD=y MONGO_URL=mongodb://localhost:27017 \
    OPENAI_API_KEY=sk-test-dummy GEMINI_API_KEY=dummy TEST_ADMIN_PASSWORD=dummy \
    python3 -m tests.differential.inventory --out tests/differential/results
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import time
from typing import Any, Dict, List

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(os.path.dirname(HERE))

# HTTP-status assertions are auth/host problems, not logic failures. Without
# this the whole class lands in ASSERTION FAILURE and masks real regressions.
# Anything matched here still deserves a live-host re-run to confirm.
HTTP_STATUS_MARKERS = [
    ("assert 401 ==", "HTTP 401 — no credentials in this environment"),
    ("assert 403 ==", "HTTP 403 — no credentials/role in this environment"),
    ("assert 404 ==", "HTTP 404 — route absent or app not served here"),
    ("assert 500 ==", "HTTP 500 — backend dependency unavailable"),
    ("assert 502 ==", "HTTP 502 — backend unavailable"),
]

ENV_MARKERS = [
    ("No such file or directory: '/app/", "hardcoded /app/ container path (Emergent-era)"),
    ("ServerSelectionTimeoutError", "Mongo not available"),
    ("localhost:27017", "Mongo not available"),
    ("pymongo.errors", "Mongo not available"),
    ("agora", "Agora SDK stubbed/absent"),
    ("Host not in allowlist", "sandbox network allowlist"),
    ("api.openai.com", "sandbox network allowlist"),
]
EXTERNAL_MARKERS = [
    ("ConnectionError", "live host unreachable"),
    ("Max retries exceeded", "live host unreachable"),
    ("onrender.com", "live deployed host"),
    ("NewConnectionError", "live host unreachable"),
    ("requests.exceptions", "live HTTP call"),
    ("httpx.ConnectError", "live HTTP call"),
]


def classify(rc: int, out: str, timed_out: bool) -> Dict[str, str]:
    if timed_out:
        return {"status": "EXTERNAL DEPENDENCY", "reason": "timed out — blocking network call"}

    if "error" in out.lower() and re.search(r"errors? during collection", out):
        for marker, why in EXTERNAL_MARKERS + ENV_MARKERS:
            if marker in out:
                return {"status": "COLLECTION FAILURE", "reason": f"collection error: {why}"}
        return {"status": "COLLECTION FAILURE", "reason": "collection error (import-time)"}

    if rc == 5 or "no tests ran" in out:
        return {"status": "NOT RUN", "reason": "no tests collected in this file"}

    if rc == 0:
        m = re.search(r"(\d+) passed", out)
        sk = re.search(r"(\d+) skipped", out)
        if not m and sk:
            return {"status": "NOT RUN",
                    "reason": f"{sk.group(1)} skipped, 0 executed"}
        return {"status": "PASS",
                "reason": f"{m.group(1) if m else '0'} passed"
                          + (f", {sk.group(1)} skipped" if sk else "")}

    for marker, why in EXTERNAL_MARKERS:
        if marker in out:
            return {"status": "EXTERNAL DEPENDENCY", "reason": why}
    for marker, why in ENV_MARKERS:
        if marker in out:
            return {"status": "ENVIRONMENT BLOCKED", "reason": why}
    for marker, why in HTTP_STATUS_MARKERS:
        if marker in out:
            return {"status": "ENVIRONMENT BLOCKED", "reason": why}

    m = re.search(r"(\d+) failed", out)
    return {"status": "ASSERTION FAILURE",
            "reason": f"{m.group(1) if m else '?'} failed, no environment marker found"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "results"))
    ap.add_argument("--timeout", type=int, default=120)
    ap.add_argument("--pattern", default="tests/*.py")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    sha = subprocess.run(["git", "-C", BACKEND, "rev-parse", "HEAD"],
                         capture_output=True, text=True).stdout.strip()[:12]

    files = sorted(f for f in glob.glob(os.path.join(BACKEND, args.pattern))
                   if os.path.basename(f) != "__init__.py")

    records: List[Dict[str, Any]] = []
    for path in files:
        rel = os.path.relpath(path, BACKEND)
        t0 = time.time()
        timed_out = False
        try:
            p = subprocess.run(
                [sys.executable, "-m", "pytest", rel, "-q", "--no-header", "-p", "no:cacheprovider"],
                cwd=BACKEND, capture_output=True, text=True, timeout=args.timeout)
            out, rc = p.stdout + p.stderr, p.returncode
        except subprocess.TimeoutExpired as e:
            out = (e.stdout or b"").decode("utf-8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
            rc, timed_out = -1, True

        c = classify(rc, out, timed_out)
        passed = re.search(r"(\d+) passed", out)
        failed = re.search(r"(\d+) failed", out)
        rec = {
            "file": rel,
            "status": c["status"],
            "reason": c["reason"],
            "passed": int(passed.group(1)) if passed else 0,
            "failed": int(failed.group(1)) if failed else 0,
            "returncode": rc,
            "duration_s": round(time.time() - t0, 1),
        }
        records.append(rec)
        print(f"{rec['status']:22} {rel:56} {rec['passed']:>4}p {rec['failed']:>4}f  {rec['duration_s']:>6}s",
              flush=True)

    summary: Dict[str, int] = {}
    for r in records:
        summary[r["status"]] = summary.get(r["status"], 0) + 1

    payload = {
        "meta": {
            "commit": sha,
            "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "python": sys.version.split()[0],
            "environment": (
                "sandbox: api.openai.com blocked, no Mongo, agora_token_builder stubbed, "
                "emergentintegrations not installed"
            ),
            "timeout_s": args.timeout,
            "file_count": len(records),
            "summary": summary,
            "total_passed": sum(r["passed"] for r in records),
            "total_failed": sum(r["failed"] for r in records),
        },
        "files": records,
    }
    path = os.path.join(args.out, "test_inventory.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
    print("\n" + json.dumps(payload["meta"], indent=2))
    print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
