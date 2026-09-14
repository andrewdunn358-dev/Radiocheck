#!/usr/bin/env python3
"""
One-shot environment setup for the differential harness and CLI probe.

Replaces the grep/heredoc pipeline from the handover, which is bash-only and
does not run on Windows. Works on Windows, macOS and Linux.

    cd backend
    python -m tests.differential.setup_env

What it does:

  1. filters `requirements.txt` to drop packages that cannot install here
     (`agora_token_builder` has no wheel and its sdist fails to build;
     `emergentintegrations` is not on PyPI)
  2. pip-installs the rest, with `--ignore-installed PyJWT` because Debian's
     PyJWT has no RECORD file and aborts the whole install without it
  3. writes an `agora_token_builder` stub into site-packages so imports resolve

The stub is written to site-packages, NEVER into the repo.

Flags: --dry-run to see what it would do; --no-stub to skip step 3.
"""

from __future__ import annotations

import argparse
import os
import re
import site
import subprocess
import sys
import sysconfig
import tempfile

SKIP = re.compile(r"emergentintegrations|agora[-_]token[-_]builder", re.I)

STUB = '''"""Test stub. Written by tests/differential/setup_env.py — not part of the repo."""


class RtcTokenBuilder:
    @staticmethod
    def buildTokenWithUid(*a, **k):
        return "stub-token"

    @staticmethod
    def buildTokenWithAccount(*a, **k):
        return "stub-token"


class RtmTokenBuilder:
    @staticmethod
    def buildToken(*a, **k):
        return "stub-token"
'''


def backend_dir() -> str:
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def site_packages_dir() -> str:
    for getter in (lambda: site.getsitepackages()[0],
                   lambda: sysconfig.get_paths()["purelib"],
                   site.getusersitepackages):
        try:
            d = getter()
            if d and os.path.isdir(d):
                return d
        except Exception:
            continue
    raise RuntimeError("could not locate site-packages")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-stub", action="store_true")
    ap.add_argument("--break-system-packages", action="store_true",
                    help="needed on Debian/Ubuntu system Python, not on Windows")
    args = ap.parse_args()

    req = os.path.join(backend_dir(), "requirements.txt")
    if not os.path.exists(req):
        print(f"ERROR: {req} not found. Run this from the repo's `backend` directory.")
        return 1

    with open(req, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
    keep = [l for l in lines if not SKIP.search(l)]
    dropped = [l for l in lines if SKIP.search(l)]

    print(f"requirements.txt: {len(lines)} lines, keeping {len(keep)}")
    for d in dropped:
        print(f"  dropped: {d}")

    tmp = os.path.join(tempfile.gettempdir(), "radiocheck_reqs.txt")
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write("\n".join(keep) + "\n")

    cmd = [sys.executable, "-m", "pip", "install", "-r", tmp, "-q",
           "--ignore-installed", "PyJWT"]
    if args.break_system_packages:
        cmd.append("--break-system-packages")

    print("\n$ " + " ".join(cmd))
    if not args.dry_run:
        rc = subprocess.call(cmd)
        if rc != 0:
            print(f"\npip exited {rc}. Fix the error above and re-run.")
            return rc

    if not args.no_stub:
        target = os.path.join(site_packages_dir(), "agora_token_builder.py")
        print(f"\nwriting agora stub: {target}")
        if not args.dry_run:
            try:
                with open(target, "w", encoding="utf-8") as fh:
                    fh.write(STUB)
            except PermissionError:
                print("  PERMISSION DENIED — re-run the shell as administrator, or"
                      " use a virtualenv, or pass --no-stub and expect"
                      " test_round9_section5_regression.py to fail at import.")
                return 1

    print("\nDone. Now run:  python -m tests.differential.cli")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
