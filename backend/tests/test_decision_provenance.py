"""Decision provenance — Discovery Session 2.

Tests the property Ant asked for: the live decision chain can be
reconstructed from one record, per request, with each value attributed to
the component that produced it — and without recording content.
"""
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from safety import provenance  # noqa: E402
from safety.provenance import (  # noqa: E402
    start_system_verdict, start_user_initiated_action, set_sink, reset_sink,
)


def _capture():
    out = []
    set_sink(out.append)
    return out


def teardown_function(_):
    reset_sink()


def test_record_carries_no_message_content():
    """The privacy property. The message is represented by a hash only."""
    out = _capture()
    msg = "I've got my old service revolver and I'm going to use it tonight"
    rec = start_system_verdict("sess-abc-123-xyz", "tommy", msg, False)
    rec.stage("legacy_result", source="legacy", risk_level="RED", score=150)
    rec.finish(risk_level="RED")

    payload = json.dumps(out[0])
    assert "revolver" not in payload
    assert "tonight" not in payload
    assert msg not in payload
    assert out[0]["msg_sha256_16"] is not None
    assert len(out[0]["msg_sha256_16"]) == 16
    assert out[0]["msg_length"] == len(msg)


def test_session_id_is_truncated_not_stored_in_full():
    out = _capture()
    rec = start_system_verdict("tommy-1788898856151-hdv2nx3bx", "tommy", "hi", False)
    rec.finish()
    assert out[0]["session"] == "tommy-178889"


def test_three_verdict_sources_are_recorded_independently():
    """Session 1's finding: legacy, raw unified and reconciled are never
    reconciled into one value in the live handler. Provenance must keep them
    as three separate stages so Session 3 can see where they disagree."""
    out = _capture()
    rec = start_system_verdict("s", "tommy", "m", False)
    rec.stage("legacy_result", source="server.calculate_safeguarding_score", risk_level="GREEN", score=10)
    rec.stage("raw_unified_result", source="safety.analyze_message_unified", risk_level="HIGH", risk_score=65)
    rec.stage("reconciled_result", source="safety.reconcile_verdicts", risk_level="HIGH", failsafe_triggered=False)
    rec.finish(risk_level="AMBER")

    names = [s["name"] for s in out[0]["stages"]]
    assert names == ["legacy_result", "raw_unified_result", "reconciled_result"]
    by = {s["name"]: s for s in out[0]["stages"]}
    assert by["legacy_result"]["values"]["risk_level"] == "GREEN"
    assert by["raw_unified_result"]["values"]["risk_level"] == "HIGH"
    assert by["reconciled_result"]["values"]["risk_level"] == "HIGH"
    # and each names its source
    assert by["legacy_result"]["source"].startswith("server.")
    assert by["raw_unified_result"]["source"].startswith("safety.")


def test_overrides_record_before_after_and_whether_anything_changed():
    """Each corrective block is recorded as an override with before/after.
    `changed` lets a query find requests where a corrective actually moved
    the outcome versus merely ran."""
    out = _capture()
    rec = start_system_verdict("s", "tommy", "m", False)
    rec.override("b35_initial_assignment_corrective", source="server.corrective_block",
                 variable="risk_level", before="RED", after="AMBER", reason="reconciler said no failsafe")
    rec.override("rule_2b_staff_review", source="server.corrective_block",
                 variable="risk_level", before="AMBER", after="AMBER", reason="already AMBER")
    rec.finish()

    ov = out[0]["overrides"]
    assert len(ov) == 2
    assert ov[0]["changed"] is True
    assert ov[1]["changed"] is False
    assert ov[0]["variable"] == "risk_level"


def test_user_initiated_action_is_a_distinct_kind_with_no_verdict():
    """Ant's ruling: a panic button is not a verdict. It must be
    distinguishable from system-detected escalation and must not carry
    verdict stages."""
    out = _capture()
    rec = start_user_initiated_action("sess-panic-1", None, "panic_button")
    rec.finish(alert_created=True, staff_notified=True)

    assert out[0]["kind"] == "user_initiated_action"
    assert out[0]["msg_sha256_16"] is None
    assert [s["name"] for s in out[0]["stages"]] == ["user_action"]
    assert out[0]["stages"][0]["values"]["action"] == "panic_button"
    assert "legacy_result" not in json.dumps(out[0])


def test_system_verdict_kind_is_distinct():
    out = _capture()
    start_system_verdict("s", "tommy", "m", False).finish()
    assert out[0]["kind"] == "system_verdict"


def test_sink_failure_never_raises_into_the_caller():
    """A provenance failure must never alter a safety decision. finish()
    swallows sink errors."""
    def bad_sink(_):
        raise RuntimeError("storage down")
    set_sink(bad_sink)
    rec = start_system_verdict("s", "tommy", "m", False)
    payload = rec.finish(risk_level="RED")  # must not raise
    assert payload["outcome"]["risk_level"] == "RED"


def test_storage_independent_default_sink_is_a_log_line():
    """Ant's ruling 3: no Mongo/Render assumptions in core safety logic.
    The default sink is a structured log line and nothing else."""
    reset_sink()
    assert provenance._sink is provenance._log_sink
    src = open(provenance.__file__, encoding="utf-8").read()
    for forbidden in ("pymongo", "motor", "db.", "render", "AsyncIOMotorClient"):
        assert forbidden not in src, f"provenance.py references host storage: {forbidden!r}"


def test_schema_version_present():
    out = _capture()
    start_system_verdict("s", "tommy", "m", False).finish()
    assert out[0]["schema"] == provenance.SCHEMA_VERSION


def test_server_instruments_every_stage_session1_identified():
    """Static check that the handler records each point Session 1 mapped as
    able to change the outcome. If a stage name disappears from server.py,
    the chain has a blind spot again."""
    server = open(os.path.join(os.path.dirname(__file__), '..', 'server.py'), encoding='utf-8').read()
    for stage in ("input_context", "legacy_result", "raw_unified_result",
                  "reconciled_result", "authoritative_runtime_vars",
                  "protocol_gate", "fallback_generation"):
        assert f'prov.stage("{stage}"' in server, f"stage {stage!r} not instrumented"
    for override in ("negation_suppression", "identity_suppression",
                     "b35_initial_assignment_corrective", "b35_overlay_gate_hotfix",
                     "rule_2b_staff_review", "rapid_escalation"):
        assert f'prov.override("{override}"' in server, f"override {override!r} not instrumented"
    assert "prov.finish(" in server
    assert "start_user_initiated_action" in server
