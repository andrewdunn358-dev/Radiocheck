"""#144 Stage 1 (Ant, 23 Oct 2026): database outage before safeguarding assessment.

Contract under test (server):
  * The character-config and site-settings reads share a 2-second TOTAL deadline.
  * If either read fails or the deadline expires, the turn returns the existing F2
    holding response: HTTP 200, riskLevel "UNKNOWN", a distinct machine-readable
    outageReason, the existing response shape.
  * No safeguarding assessment, generation, judge, GREEN verdict, EXIT C,
    provisional RED, database write or per-turn staff notification on that path.
  * Successful reads keep their existing behaviour exactly.

Deterministic: in-memory Mongo, scripted model, stubbed classifier, injected
failures. One test uses a REAL Motor client against an unreachable server to
show the deadline and that the abandoned operation cannot change anything later.
"""
import asyncio
import json
import logging
import os
import sys
import time

import pytest
from pymongo.errors import ServerSelectionTimeoutError

sys.path.insert(0, os.path.dirname(__file__))

from test_f2_pre_decision_exceptions import (  # noqa: E402
    A, B2, HOLDING, LOST_YOU, N, Harness, server,
)
import safety.text_normalizer as text_normalizer  # noqa: E402

BENIGN = "had a quiet day down the allotment with the grandkids"
MESSAGES = [("crisis", A, "silent"), ("amber", B2, "high"), ("benign", BENIGN, "silent"),
            ("negated", N, "silent")]
RESPONSE_FIELDS = {"reply", "sessionId", "character", "characterName", "characterAvatar",
                   "safeguardingTriggered", "safeguardingAlertId", "riskLevel", "riskScore"}
READ_OPS = ("find_one", "find", "count_documents", "aggregate")
WRITE_OPS = ("insert_one", "insert_many", "update_one", "update_many", "replace_one",
             "delete_one", "delete_many", "find_one_and_update", "find_one_and_replace",
             "find_one_and_delete", "bulk_write")


def _collection_cls():
    return type(server.db["ai_characters"])


def _fail(only=None):
    """Make Mongo operations raise ServerSelectionTimeoutError, as a real outage
    does. only=None: every operation on every collection (full outage)."""
    def apply(mp):
        cls = _collection_cls()
        for op in READ_OPS + WRITE_OPS:
            real = getattr(cls, op, None)
            if real is None:
                continue

            def make(op=op, real=real):
                def wrapper(self, *a, **k):
                    if only is None or (self.name, op) in only:
                        if op == "find":
                            raise ServerSelectionTimeoutError(f"injected: {self.name}.{op}")

                        async def boom():
                            raise ServerSelectionTimeoutError(f"injected: {self.name}.{op}")
                        return boom()
                    return real(self, *a, **k)
                return wrapper
            mp.setattr(cls, op, make())
    return apply


def _slow(collection, seconds, marker=None):
    """Make <collection>.find_one take `seconds`; if it ever completes, it
    records that and writes a marker document (a late side effect)."""
    def apply(mp):
        cls = _collection_cls()
        real = cls.find_one

        def wrapper(self, *a, **k):
            if self.name != collection:
                return real(self, *a, **k)

            async def slow():
                await asyncio.sleep(seconds)
                if marker is not None:
                    marker["completed"] = True
                    await server.db.late_side_effects.insert_one({"from": collection})
                return await real(self, *a, **k)
            return slow()
        mp.setattr(cls, "find_one", wrapper)
    return apply


class _Spy:
    """Counts evaluation entry points and every attempted database write."""

    def __init__(self):
        self.calls = {"normaliser": 0, "legacy_scorer": 0, "unified": 0}
        self.writes = []

    def __call__(self, mp):
        real_norm = text_normalizer.normalise_text
        real_check = server.check_safeguarding
        real_unified = server.analyze_message_unified

        async def norm(*a, **k):
            self.calls["normaliser"] += 1
            return await real_norm(*a, **k)

        def check(*a, **k):
            self.calls["legacy_scorer"] += 1
            return real_check(*a, **k)

        def unified(*a, **k):
            self.calls["unified"] += 1
            return real_unified(*a, **k)
        mp.setattr(text_normalizer, "normalise_text", norm)
        mp.setattr(server, "check_safeguarding", check)
        mp.setattr(server, "analyze_message_unified", unified)
        cls = _collection_cls()
        for op in WRITE_OPS:
            real = getattr(cls, op, None)
            if real is None:
                continue

            def make(op=op, real=real):
                def wrapper(coll, *a, **k):
                    self.writes.append(f"{coll.name}.{op}")
                    return real(coll, *a, **k)
                return wrapper
            mp.setattr(cls, op, make())


@pytest.fixture
def h(monkeypatch):
    harness = Harness(monkeypatch)
    yield harness
    harness.close()


def _evts(caplog):
    out = []
    for r in caplog.records:
        try:
            d = json.loads(r.getMessage())
        except Exception:
            continue
        if isinstance(d, dict) and "evt" in d:
            out.append(d)
    return out


def _assert_outage(r, reason, spy, caplog, sid):
    body = r["body"]
    assert set(body) == RESPONSE_FIELDS | {"outageReason"}, "existing shape + outageReason"
    assert body["reply"] == HOLDING == server.F2_HOLDING_RESPONSE
    assert "116 123" in body["reply"] and "999" in body["reply"]
    assert not body["reply"].startswith(LOST_YOU), "never EXIT C"
    assert body["riskLevel"] == "UNKNOWN", "never GREEN"
    assert body["safeguardingTriggered"] is False and body["safeguardingAlertId"] is None
    assert body["riskScore"] == 0
    assert body["outageReason"] == reason
    assert spy.calls == {"normaliser": 0, "legacy_scorer": 0, "unified": 0}, "no assessment"
    assert r["model_calls"] == 0, "no generation, no judge"
    assert r["emails"] == [], "no per-turn staff notification"
    assert r["alerts"] == [], "no alert, provisional or otherwise"
    assert spy.writes == [], "no database write"
    assert r["records"] == [], "no provenance record (no decision was made)"
    assert r["history_added"] == []
    assert server.buddy_sessions[sid]["message_count"] == 0, "session untouched"
    evts = [e for e in _evts(caplog) if e.get("session") == sid[:12]]
    assert [e["evt"] for e in evts] == ["safety.pre_assessment_unavailable"]
    assert evts[0]["reason"] == reason


# ---------------------------------------------------------------------------
# Fault-injection matrix: full outage / character-only / settings-only
#                         x crisis / AMBER / benign / negated
# ---------------------------------------------------------------------------

VARIANTS = [
    ("full_outage", None, "character_config_error"),
    ("character_only", {("ai_characters", "find_one")}, "character_config_error"),
    ("settings_only", {("settings", "find_one")}, "site_settings_error"),
]


@pytest.mark.parametrize("variant,only,reason", VARIANTS, ids=[v[0] for v in VARIANTS])
@pytest.mark.parametrize("label,message,classifier", MESSAGES, ids=[m[0] for m in MESSAGES])
def test_outage_returns_holding_response_and_stops(h, caplog, variant, only, reason,
                                                   label, message, classifier):
    caplog.set_level(logging.INFO)
    spy = _Spy()
    sid = h.new_session()
    r = h.send(sid, message, classifier=classifier, fail=(spy, _fail(only)))
    _assert_outage(r, reason, spy, caplog, sid)


def test_crisis_and_benign_get_the_same_outage_representation(h):
    a = h.turn(A, fail=(_fail(),))["body"]
    b = h.turn(BENIGN, fail=(_fail(),))["body"]
    a.pop("sessionId"), b.pop("sessionId")
    assert a == b


# ---------------------------------------------------------------------------
# Deadline (deterministic): 2 seconds TOTAL across both reads
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("collection,reason", [("ai_characters", "character_config_timeout"),
                                               ("settings", "site_settings_timeout")])
def test_a_hanging_read_is_cut_off_at_the_deadline(h, caplog, collection, reason):
    caplog.set_level(logging.INFO)
    spy = _Spy()
    sid = h.new_session()
    t0 = time.monotonic()
    r = h.send(sid, A, fail=(spy, _slow(collection, 30)))
    elapsed = time.monotonic() - t0
    assert server.PRE_ASSESSMENT_READ_DEADLINE_S == 2.0
    assert 1.9 <= elapsed < 4.0, elapsed
    _assert_outage(r, reason, spy, caplog, sid)


def test_deadline_is_a_total_across_both_reads(h, caplog):
    """1.2 s + 1.2 s: each read alone is within 2 s; together they are not."""
    caplog.set_level(logging.INFO)
    spy = _Spy()
    sid = h.new_session()
    t0 = time.monotonic()
    r = h.send(sid, A, fail=(spy, _slow("ai_characters", 1.2), _slow("settings", 1.2)))
    elapsed = time.monotonic() - t0
    assert 1.9 <= elapsed < 3.0, elapsed
    _assert_outage(r, "site_settings_timeout", spy, caplog, sid)


def test_reads_within_the_deadline_keep_normal_behaviour(h):
    r = h.turn(A, fail=(_slow("ai_characters", 0.5), _slow("settings", 0.5)))
    assert r["triggered"] is True and r["risk"] == "RED"
    assert "outageReason" not in r["body"]
    assert len(r["alerts"]) == 1


def test_a_timed_out_read_cannot_later_change_the_response_or_database(h):
    """A coroutine-level read (this stub) is cancelled at the deadline: its
    continuation (a late write) never runs, even after waiting well past when
    it would have completed. With real Motor the worker thread is not
    cancelled; it runs on to its own timeout and its result is discarded. Both
    reads are read-only, so neither can change state; the real-Motor test
    below covers that production behaviour."""
    marker = {"completed": False}
    sid = h.new_session()
    r = h.send(sid, A, fail=(_slow("settings", 2.5, marker),))
    assert r["body"]["outageReason"] == "site_settings_timeout"
    first = dict(r["body"])
    time.sleep(3.5)
    assert marker["completed"] is False
    assert asyncio.run(h.store.late_side_effects.count_documents({})) == 0
    assert asyncio.run(h.store.safeguarding_alerts.count_documents({})) == 0
    assert server.buddy_sessions[sid]["message_count"] == 0
    assert r["body"] == first


# ---------------------------------------------------------------------------
# Real Motor client against an unreachable MongoDB server
# ---------------------------------------------------------------------------

def test_real_motor_unreachable_server_is_cut_off_at_the_deadline(h, caplog):
    """Production client settings (serverSelectionTimeoutMS=10000) against a
    server that refuses connections. One event loop for the whole test so the
    abandoned operation's own 10 s failure happens while we watch."""
    import httpx
    from motor.motor_asyncio import AsyncIOMotorClient

    caplog.set_level(logging.INFO)
    spy = _Spy()
    sid = h.new_session()
    model_before = None

    async def scenario():
        nonlocal model_before
        real_db = AsyncIOMotorClient("mongodb://127.0.0.1:1", serverSelectionTimeoutMS=10000)["outage144"]
        with pytest.MonkeyPatch.context() as mp:
            spy(mp)
            mp.setattr(server, "db", real_db)
            server.ip_request_counts.clear()
            server.blocked_ips.clear()
            model_before = server.buddy_openai_client.calls
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
                t0 = time.monotonic()
                resp = await c.post("/api/ai-buddies/chat",
                                    json={"message": A, "sessionId": sid, "character": "tommy"})
                elapsed = time.monotonic() - t0
            body_at_response = resp.json()
            # Keep the loop alive past the abandoned call's own 10 s server-
            # selection timeout, then check nothing changed.
            await asyncio.sleep(10.5)
            return resp, elapsed, body_at_response

    from test_f2_pre_decision_exceptions import _ScriptedModel
    h.mp.setattr(server, "buddy_openai_client", _ScriptedModel())
    resp, elapsed, body = asyncio.run(scenario())
    assert resp.status_code == 200
    assert 1.9 <= elapsed < 3.5, elapsed
    assert body["reply"] == HOLDING and body["riskLevel"] == "UNKNOWN"
    assert body["outageReason"] == "character_config_timeout"
    assert spy.calls == {"normaliser": 0, "legacy_scorer": 0, "unified": 0}
    assert spy.writes == []
    assert server.buddy_openai_client.calls == model_before == 0
    assert h.emails == [] and h.records == []
    assert server.buddy_sessions[sid]["message_count"] == 0
    assert server.buddy_sessions[sid]["history"] == []
    evts = [e for e in _evts(caplog) if e.get("session") == sid[:12]]
    assert [e["evt"] for e in evts] == ["safety.pre_assessment_unavailable"], "nothing after the response"
    stray = [r.getMessage() for r in caplog.records
             if r.name == "asyncio" or "never retrieved" in r.getMessage() or "was never awaited" in r.getMessage()]
    assert stray == [], stray


# ---------------------------------------------------------------------------
# Successful reads: behaviour unchanged
# ---------------------------------------------------------------------------

def test_healthy_crisis_is_unchanged(h):
    r = h.turn(A)
    assert set(r["body"]) == RESPONSE_FIELDS, "no outageReason, shape unchanged"
    assert r["triggered"] is True and r["risk"] == "RED"
    assert len(r["alerts"]) == 1 and r["alerts"][0]["status"] == "active"
    assert len(r["emails"]) == 1 and r["model_calls"] == 0


@pytest.mark.parametrize("label,message,classifier", MESSAGES[1:], ids=[m[0] for m in MESSAGES[1:]])
def test_healthy_turns_are_unchanged(h, label, message, classifier):
    spy = _Spy()
    r = h.send(h.new_session(), message, classifier=classifier, fail=(spy,))
    assert set(r["body"]) == RESPONSE_FIELDS
    assert r["risk"] != "UNKNOWN" and r["reply"] != HOLDING
    assert spy.calls == {"normaliser": 1, "legacy_scorer": 1, "unified": 1}


@pytest.mark.parametrize("settings,in_app_help,status", [
    (None, True, "active"),                                   # defaults
    ({"peer_to_peer_enabled": False}, False, "active"),       # human support off, not signpost
    ({"safeguarding_response_mode": "signpost"}, True, "audit_only"),
])
def test_successful_settings_read_still_drives_the_off_mode_flags(h, settings, in_app_help, status):
    sid = h.new_session()
    if settings:
        asyncio.run(h.store.settings.insert_one(dict(settings, _id="site_settings")))
    r = h.send(sid, A)
    assert r["triggered"] is True and "outageReason" not in r["body"]
    assert ("Connect with Counsellors" in r["reply"]) is in_app_help
    assert len(r["alerts"]) == 1 and r["alerts"][0]["status"] == status


def test_outage_responder_never_raises_without_persona_data(h, monkeypatch):
    monkeypatch.setattr(server, "AI_CHARACTERS", {})
    r = h.turn(A, fail=(_fail(),))
    assert r["body"]["reply"] == HOLDING and r["body"]["characterName"] == "Radio Check"


def test_outage_reasons_are_a_closed_set():
    assert server.PRE_ASSESSMENT_OUTAGE_REASONS == (
        "character_config_timeout", "character_config_error",
        "site_settings_timeout", "site_settings_error")


# ---------------------------------------------------------------------------
# Client contract: the three chat clients show exactly the approved wording
# ---------------------------------------------------------------------------

def test_client_crisis_support_wording_is_the_approved_holding_response():
    import shutil
    import subprocess
    node = shutil.which("node")
    if node is None:
        pytest.skip("node not available (CI installs Node 22)")
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    for rel in ("frontend/src/utils/chatReply.ts", "portal/src/lib/chatReply.ts"):
        path = os.path.join(root, rel)
        out = subprocess.run(
            [node, "--experimental-strip-types", "--input-type=module", "-e",
             f"import {{ CRISIS_SUPPORT_FALLBACK }} from {json.dumps('file://' + path)};"
             "process.stdout.write(JSON.stringify(CRISIS_SUPPORT_FALLBACK));"],
            capture_output=True, text=True, timeout=60)
        assert out.returncode == 0, out.stderr
        assert json.loads(out.stdout) == server.F2_HOLDING_RESPONSE, rel
