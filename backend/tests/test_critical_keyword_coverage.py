"""Critical-keyword coverage and comparative-frame guard.

Two defects, 20 Sept 2026, found by differential run (results/live/):

1. Explicit self-killing statements scored 100 by server.RED_INDICATORS but
   absent from EnhancedSafetyMonitor.critical_keywords could not fire the
   deterministic failsafe. With the AI classifier unreachable or its gate
   closed, they were delivered AMBER with no crisis overlay.

2. critical_keywords matched as a bare substring, so comparative banter
   ("I'd rather top myself than go back there") fired a full crisis overlay.

Deliberately NOT changed: "if" conditionals still fire. Conditional
suicidality is a recognised risk presentation.
"""
import pytest
from safety.safety_monitor import assess_message_safety

MUST_BE_CRITICAL = [
    "I'm going to take my own life",
    "I'm going to neck myself",
    "I feel suicidal",
    "Nah, forget it. Don't need your help to top myself do I.",
    "I'm going to kill myself",          # control, critical before the change
    "I'm going to end myself tonight",
    "thinking about ending my life",
    "I'm going to slit my wrists",
]

MUST_NOT_BE_CRITICAL = [
    "I'm not suicidal by the way",                            # negation
    "my old oppo topped himself in 2019",                     # third person
    "the scoff in that cookhouse would make you top yourself", # second person
    "I need to pick up my pills from the chemist",            # fragment
    "we had a brew and a laugh, all good mate",               # benign
    "I'd rather top myself than go back there",               # comparative
    "I'd sooner neck myself than sit through that again",     # comparative
]

CONDITIONALS_MUST_STILL_FIRE = [
    "I'll kill myself if she leaves me",
    "I'll top myself if I have to do another duty",
]


@pytest.mark.parametrize("msg", MUST_BE_CRITICAL)
def test_explicit_disclosure_is_critical(msg):
    assert assess_message_safety(msg).get("risk_level") == "critical", (
        f"{msg!r} must reach the deterministic failsafe without the AI "
        "classifier. Regression of the 20 Sept coverage gap."
    )


@pytest.mark.parametrize("msg", MUST_NOT_BE_CRITICAL)
def test_non_disclosure_is_not_critical(msg):
    assert assess_message_safety(msg).get("risk_level") != "critical", (
        f"{msg!r} must not fire a crisis overlay. False positive."
    )


@pytest.mark.parametrize("msg", CONDITIONALS_MUST_STILL_FIRE)
def test_conditional_suicidality_still_fires(msg):
    assert assess_message_safety(msg).get("risk_level") == "critical", (
        f"{msg!r} must still fire. The comparative guard must not widen to "
        "cover 'if' conditionals — conditional suicidality is real risk."
    )


def test_legacy_and_failsafe_lists_do_not_drift():
    """Every explicit self-killing phrase at 100 in the legacy table must be
    reachable by the deterministic failsafe. Pins the gap closed."""
    import server
    from safety.safety_monitor import EnhancedSafetyMonitor
    critical = set(EnhancedSafetyMonitor().critical_keywords)
    explicit = [p for p in server.RED_INDICATORS
                if server.RED_INDICATORS[p] >= 100
                and ("myself" in p or "my own life" in p or "my life" in p)]
    missing = sorted(p for p in explicit
                     if not any(c in p or p in c for c in critical))
    assert not missing, f"explicit self-killing phrases not reachable: {missing}"
