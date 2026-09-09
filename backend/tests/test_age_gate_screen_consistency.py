"""Both peer-feature screens must gate off the same flag, the same way.

Ant's ruling on #97. buddy-finder.tsx gated peer_matching on isUnder18 alone;
peer-support.tsx gated on (!isAgeVerified || !isUnder18 || canMakePeerCalls).
A user who skipped the age gate (isAgeVerified false, isUnder18 true) was
therefore blocked on one screen and admitted on the other - the same person,
the same flag, opposite outcomes.

These are static checks on the source rather than rendering tests, because
there is no JS test harness in this repo. They cannot prove the screens
behave identically at runtime; what they DO prevent is the specific drift
that caused this - one screen quietly acquiring an extra condition that the
other does not have.
"""
import os
import re

APP_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'app')
BUDDY_FINDER = os.path.join(APP_DIR, 'buddy-finder.tsx')
PEER_SUPPORT = os.path.join(APP_DIR, 'peer-support.tsx')
HOOK = os.path.join(os.path.dirname(__file__), '..', '..',
                    'frontend', 'src', 'hooks', 'useAgeGate.ts')


def _read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def test_both_screens_derive_access_from_isFeatureAvailable_on_isUnder18():
    """Neither screen may invent its own age logic."""
    for path in (BUDDY_FINDER, PEER_SUPPORT):
        src = _read(path)
        assert re.search(r"isFeatureAvailable\(\s*'[a-z_]+'\s*,\s*isUnder18\s*\)", src), (
            f"{os.path.basename(path)}: peer access is not derived from "
            f"isFeatureAvailable(<feature>, isUnder18)"
        )


def test_neither_screen_gates_peer_access_on_isAgeVerified():
    """isAgeVerified is false for a user who SKIPPED the gate. Including it in
    the access condition re-opens the exact hole this PR closes: skip, and the
    restriction never applies."""
    for path in (BUDDY_FINDER, PEER_SUPPORT):
        src = _read(path)
        for line in src.splitlines():
            if 'canMakePeerCalls' not in line and 'canAccessFeature' not in line:
                continue
            if line.strip().startswith('//') or line.strip().startswith('*'):
                continue
            assert 'isAgeVerified' not in line, (
                f"{os.path.basename(path)}: peer access condition references "
                f"isAgeVerified, which is false for skippers: {line.strip()!r}"
            )


def test_skip_path_sets_the_minor_flag_not_just_a_soft_marker():
    """Ant's ruling: an unverified user is treated as a minor for BOTH
    thresholds and feature restrictions. If setAgeUnverifiedProtected stops
    setting isUnder18, peer restrictions silently stop applying to skippers
    while the thresholds keep working - the failure would be invisible."""
    src = _read(HOOK)
    block = src.split('const setAgeUnverifiedProtected')[1].split('}, [])')[0]
    assert 'setIsUnder18(true)' in block, (
        "setAgeUnverifiedProtected no longer sets isUnder18 - peer feature "
        "restrictions will not apply to users who skip the age gate"
    )
    assert 'setIsAgeUnverified(true)' in block, (
        "setAgeUnverifiedProtected must also flag WHY, so the UI can offer "
        "the way out instead of showing a silent block"
    )


def test_unverified_users_are_told_how_to_unlock():
    """A silent block reads as a broken feature. Ant's point: the exit is
    cheap (complete the DOB check) and should be stated."""
    src = _read(PEER_SUPPORT)
    assert 'isAgeUnverified' in src, "peer-support does not distinguish unverified from minor"
    assert re.search(r'[Vv]erify\s+[Yy]our\s+[Aa]ge', src), (
        "no 'verify your age' affordance for unverified users"
    )
