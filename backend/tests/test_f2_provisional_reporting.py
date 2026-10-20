"""F2 item 2 (Ant, 20 Oct 23:09): provisional alerts are distinguishable in
staff stats and governance reporting. Presentation/reporting only.

A provisional alert is one carrying the existing "evaluation_incomplete"
indicator (written only by the F2 INCOMPLETE responder). It must not be
counted as a completed RED assessment; it is reported in its own bucket.
Definitive alerts are counted exactly as before.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import mongomock_motor  # noqa: E402
import pytest  # noqa: E402

import governance_router  # noqa: E402
import routers.safeguarding as safeguarding_router  # noqa: E402

PROV = ["evaluation_incomplete", "provisional_alert", "risk_score_not_available",
        "failed_component:analyze_message_unified"]


def _alerts(created):
    return [
        {"id": "d-red", "risk_level": "RED", "risk_score": 120, "status": "active",
         "triggered_indicators": ["explicit_intent"], "created_at": created},
        {"id": "d-amber", "risk_level": "AMBER", "risk_score": 60, "status": "active",
         "triggered_indicators": ["hopelessness"], "created_at": created},
        {"id": "p-red-1", "risk_level": "RED", "risk_score": 0, "status": "active",
         "triggered_indicators": PROV, "created_at": created},
        {"id": "p-red-2", "risk_level": "RED", "risk_score": 95, "status": "audit_only",
         "triggered_indicators": ["evaluation_incomplete", "provisional_alert",
                                  "risk_score_source:legacy_scorer"], "created_at": created},
    ]


@pytest.fixture
def store(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["f2_reporting"]
    monkeypatch.setattr(safeguarding_router, "get_database", lambda: db)
    monkeypatch.setattr(governance_router, "db", db)
    return db


def _run(coro):
    return asyncio.run(coro)


def test_stats_summary_counts_provisional_separately(store):
    _run(store.safeguarding_alerts.insert_many(_alerts(datetime.utcnow())))
    stats = _run(safeguarding_router.get_safeguarding_stats())
    assert stats["total"] == 4, "total is unchanged: every alert still counts"
    assert stats["by_status"]["active"] == 3, "status counts unchanged"
    assert stats["by_risk_level"] == {"RED": 1, "AMBER": 1, "YELLOW": 0, "PROVISIONAL": 2}


def test_stats_summary_without_provisional_is_unchanged(store):
    _run(store.safeguarding_alerts.insert_many(_alerts(datetime.utcnow())[:2]))
    stats = _run(safeguarding_router.get_safeguarding_stats())
    assert stats["by_risk_level"] == {"RED": 1, "AMBER": 1, "YELLOW": 0, "PROVISIONAL": 0}


def test_kpis_report_provisional_in_their_own_bucket(store):
    # The KPI query compares created_at against ISO strings (pre-existing; see
    # residual R-KPI in the result report), so the fixture uses that shape.
    created = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    _run(store.safeguarding_alerts.insert_many(_alerts(created)))
    out = _run(governance_router.get_safeguarding_kpis(days=30))
    k = out["kpis"]
    assert k["total_imminent_risk_alerts"] == 1, "only the definitive RED counts as imminent"
    assert k["total_high_risk_alerts"] == 2
    assert k["risk_level_distribution"]["provisional_incomplete"] == 2
    assert k["risk_level_distribution"]["imminent"] == 1


def test_summary_report_moves_provisional_out_of_red(store):
    _run(store.safeguarding_alerts.insert_many(_alerts(datetime.now(timezone.utc))))
    out = _run(governance_router.get_summary_report("weekly"))
    sg = out["safeguarding"]
    by_risk = sg["by_risk_level"]
    assert sg["total_alerts"] == 4, "total unchanged"
    assert by_risk.get("RED") == 1 and by_risk.get("AMBER") == 1 and by_risk.get("PROVISIONAL") == 2
