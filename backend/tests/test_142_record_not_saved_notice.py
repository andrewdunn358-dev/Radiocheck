"""#142 C1: database-independent "record not saved" notice.

Ant, 22 Oct 2026 (Stage 1 approval). When a qualifying provisional safeguarding
alert cannot be persisted, a minimal notice goes to environment-configured
recipients through the Resend HTTP API with a short, configurable timeout.

- Provisional-alert persistence failure only. EXIT A/B unchanged.
- Minimal metadata. No message or history content, no portal link.
- No Mongo read or write.
- Never raises, and never delays the holding response beyond the timeout.
- One notice per failed turn, no rate limiting (sustained-failure test below).

Deterministic fault injection on the F2 harness (mongomock, scripted model,
stubbed email). The Resend transport is replaced; nothing leaves the process.
"""
import asyncio
import json
import logging
import os
import sys
import threading
import time

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from test_f2_pre_decision_exceptions import (  # noqa: E402
    A, B2, G, HOLDING, Harness, _fail_alert_insert, server, summary,
)

RECIPIENTS = "primary@example.org, backup@example.org"


@pytest.fixture
def h(monkeypatch):
    harness = Harness(monkeypatch)
    yield harness
    harness.close()


class Transport:
    """Stand-in for _f2_resend_post (the only network call)."""

    def __init__(self, status=200, delay=0.0, exc=None):
        self.status, self.delay, self.exc = status, delay, exc
        self.calls = []
        self.lock = threading.Lock()

    def __call__(self, payload, timeout):
        with self.lock:
            self.calls.append((payload, timeout))
        if self.delay:
            # Long enough to outlast the caller's wait (timeout + 0.5), short
            # enough not to slow CI.
            time.sleep(min(self.delay, timeout + 0.8))
        if self.exc:
            raise self.exc
        return self.status


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("SAFEGUARDING_FALLBACK_EMAILS", RECIPIENTS)
    monkeypatch.delenv("SAFEGUARDING_NOTICE_TIMEOUT_SECONDS", raising=False)
    monkeypatch.setattr(server, "RESEND_API_KEY", "re_test_key")
    t = Transport()
    monkeypatch.setattr(server, "_f2_resend_post", t, raising=False)
    return t


def _events(caplog, name):
    out = []
    for r in caplog.records:
        try:
            d = json.loads(r.getMessage())
        except Exception:
            continue
        if d.get("evt") == name:
            out.append(d)
    return out


def _persistence_failure_turn(h, sid=None, message=A):
    fail = ("unified", _fail_alert_insert)
    if sid is None:
        return h.turn(message, fail=fail)
    return h.send(sid, message, fail=fail)


# --- T1 -----------------------------------------------------------------------

def test_t1_one_notice_to_configured_recipients_and_response_unchanged(h, configured, caplog):
    with caplog.at_level(logging.ERROR):
        r = _persistence_failure_turn(h)
    s = summary(r)
    assert r["reply"] == HOLDING, "holding response byte-identical"
    assert r["alert_id"] is None and s["alerts"] == [] and s["emails"] == 0
    assert len(configured.calls) == 1
    payload, timeout = configured.calls[0]
    assert payload["to"] == ["primary@example.org", "backup@example.org"]
    assert payload["from"] == server.SENDER_EMAIL
    assert timeout == server.RECORD_NOT_SAVED_DEFAULT_TIMEOUT
    assert len(_events(caplog, "safety.record_not_saved_notice_sent")) == 1
    assert len(_events(caplog, "safety.provisional_email_not_sent")) == 1, "existing event kept"


# --- T2 -----------------------------------------------------------------------

class _NoDb:
    def __getattr__(self, name):
        raise AssertionError(f"record-not-saved notice touched the database: db.{name}")


def test_t2_notice_makes_no_database_access(configured, monkeypatch):
    monkeypatch.setattr(server, "db", _NoDb())
    out = asyncio.run(server._f2_send_record_not_saved_notice(
        alert_id="a" * 36, session_id="s" * 30, failed_components=["analyze_message_unified"],
        error_type="ServerSelectionTimeoutError"))
    assert out == "sent" and len(configured.calls) == 1


def test_t2b_handler_notice_survives_database_reads_failing_after_insert(h, configured, monkeypatch):
    """Insert fails, and every later database read/write in the turn fails too
    (the audit write and any settings read): the notice is still sent."""
    def everything_fails_after_insert(mp):
        cls = type(server.db.safeguarding_alerts)
        state = {"down": False}
        real = {m: getattr(cls, m) for m in ("insert_one", "find_one", "update_one", "count_documents")}

        async def insert_one(self, *a, **k):
            if getattr(self, "name", "") == "safeguarding_alerts":
                state["down"] = True          # from here on the database is gone
            if state["down"]:
                raise RuntimeError("db down")
            return await real["insert_one"](self, *a, **k)
        mp.setattr(cls, "insert_one", insert_one)

        def make(m):
            def guarded(self, *a, **k):
                if state["down"]:
                    raise RuntimeError("db down")
                return real[m](self, *a, **k)
            return guarded
        for m in ("find_one", "update_one", "count_documents"):
            mp.setattr(cls, m, make(m))

    r = h.turn(A, fail=("unified", everything_fails_after_insert))
    assert r["reply"] == HOLDING and len(configured.calls) == 1


# --- T3 -----------------------------------------------------------------------

def test_t3_content_is_minimal(h, configured):
    sid = h.new_session()
    full_sid = sid
    r = _persistence_failure_turn(h, sid=sid)
    payload, _ = configured.calls[0]
    body, subject = payload["text"], payload["subject"]
    alert_logged = [rec for rec in r["records"]]  # noqa: F841 (provenance kept as is)
    # Required
    assert "SAFEGUARDING RECORD NOT SAVED" in subject
    assert "NO PORTAL RECORD EXISTS FOR THIS ALERT" in body
    assert "PROVISIONAL — EVALUATION INCOMPLETE" in body
    assert full_sid[:12] in body
    assert "RuntimeError" in body, "exception type only"
    assert "analyze_message_unified" in body
    assert "Time (UTC):" in body and "Incident id:" in body
    # Forbidden
    assert A.lower() not in body.lower() and A.lower() not in subject.lower(), "no triggering message"
    assert len(full_sid) > 12 and full_sid not in body, "no full session id"
    assert "injected" not in body, "no exception message text"
    assert "http" not in body.lower() and "radiocheck.me" not in body.lower(), "no link"
    for forbidden in ("client_ip", "user_agent", "conversation", "tommy", "testclient"):
        assert forbidden not in body.lower()
    assert set(payload) == {"from", "to", "subject", "text"}, "no html, no attachments"


# --- T4 -----------------------------------------------------------------------

def test_t4_not_configured_sends_nothing(h, monkeypatch, caplog):
    monkeypatch.delenv("SAFEGUARDING_FALLBACK_EMAILS", raising=False)
    monkeypatch.setattr(server, "RESEND_API_KEY", "re_test_key")
    t = Transport()
    monkeypatch.setattr(server, "_f2_resend_post", t, raising=False)
    with caplog.at_level(logging.ERROR):
        r = _persistence_failure_turn(h)
    assert r["reply"] == HOLDING and t.calls == []
    ev = _events(caplog, "safety.record_not_saved_notice_not_sent")
    assert len(ev) == 1 and ev[0]["reason"] == "not_configured" and ev[0]["detail"] == "no_recipients"


def test_t4b_missing_resend_key_sends_nothing(h, configured, monkeypatch, caplog):
    monkeypatch.setattr(server, "RESEND_API_KEY", "")
    with caplog.at_level(logging.ERROR):
        _persistence_failure_turn(h)
    assert configured.calls == []
    assert _events(caplog, "safety.record_not_saved_notice_not_sent")[0]["detail"] == "no_resend_api_key"


# --- T5 -----------------------------------------------------------------------

@pytest.mark.parametrize("transport,detail", [
    (Transport(exc=RuntimeError("provider down")), "RuntimeError"),
    (Transport(status=500), "http_500"),
    (Transport(status=422), "http_422"),
])
def test_t5_send_failure_is_contained(h, configured, monkeypatch, caplog, transport, detail):
    monkeypatch.setattr(server, "_f2_resend_post", transport, raising=False)
    with caplog.at_level(logging.ERROR):
        r = _persistence_failure_turn(h)
    assert r["reply"] == HOLDING and r["alert_id"] is None
    ev = _events(caplog, "safety.record_not_saved_notice_not_sent")
    assert len(ev) == 1 and ev[0]["reason"] == "send_failed" and ev[0]["detail"] == detail


# --- T6: timeout (Ant: shorter, configurable default; tested) -----------------

def test_t6_default_timeout_is_short_and_bounded():
    assert server.RECORD_NOT_SAVED_DEFAULT_TIMEOUT == 3.0
    assert server.RECORD_NOT_SAVED_TIMEOUT_BOUNDS == (0.5, 10.0)


@pytest.mark.parametrize("env,expected", [
    (None, 3.0), ("1.5", 1.5), ("0.1", 0.5), ("60", 10.0), ("abc", 3.0), ("", 3.0),
])
def test_t6_timeout_is_configurable_and_clamped(monkeypatch, env, expected):
    if env is None:
        monkeypatch.delenv("SAFEGUARDING_NOTICE_TIMEOUT_SECONDS", raising=False)
    else:
        monkeypatch.setenv("SAFEGUARDING_NOTICE_TIMEOUT_SECONDS", env)
    assert server._f2_notice_timeout() == expected


def test_t6_hanging_provider_does_not_hold_the_holding_response(h, configured, monkeypatch, caplog):
    monkeypatch.setenv("SAFEGUARDING_NOTICE_TIMEOUT_SECONDS", "0.5")
    monkeypatch.setattr(server, "_f2_resend_post", Transport(delay=30), raising=False)
    with caplog.at_level(logging.ERROR):
        t0 = time.monotonic()
        r = _persistence_failure_turn(h)
        elapsed = time.monotonic() - t0
    assert r["reply"] == HOLDING
    assert elapsed < 4.0, f"turn took {elapsed:.2f}s with a 0.5s notice timeout"
    ev = _events(caplog, "safety.record_not_saved_notice_not_sent")
    assert len(ev) == 1 and ev[0]["reason"] == "timeout"


def test_t6_real_transport_passes_the_timeout_to_requests(monkeypatch):
    """The production transport bounds both connect and read with the timeout."""
    seen = {}

    class _Resp:
        status_code = 200

    def fake_post(url, json=None, headers=None, timeout=None):
        seen.update(url=url, timeout=timeout, auth=headers.get("Authorization"))
        return _Resp()

    import requests
    monkeypatch.setattr(requests, "post", fake_post)
    monkeypatch.setattr(server, "RESEND_API_KEY", "re_test_key")
    assert server._f2_resend_post({"x": 1}, 1.5) == 200
    assert seen == {"url": "https://api.resend.com/emails", "timeout": (1.5, 1.5),
                    "auth": "Bearer re_test_key"}


# --- T7 / T8: scope ------------------------------------------------------------

def test_t7_no_notice_when_provisional_alert_is_saved(h, configured):
    r = h.turn(A, fail=("unified",))
    assert summary(r)["alerts"] == [("RED", "active", "provisional")] and summary(r)["emails"] == 1
    assert configured.calls == []


@pytest.mark.parametrize("message,classifier", [(A, "silent"), (B2, "high")], ids=["exit_a", "exit_b"])
def test_t8_exit_a_and_b_unchanged_and_get_no_notice(h, configured, message, classifier):
    r = h.turn(message, classifier=classifier, fail=(_fail_alert_insert,))
    assert configured.calls == [], "C1 is provisional-only"
    assert summary(r)["emails"] == 1, "existing EXIT A/B email behaviour unchanged"


def test_t8b_healthy_turns_send_no_notice(h, configured):
    for msg in (A, G):
        h.turn(msg)
    assert configured.calls == []


# --- T9: F2 unnotified mark kept ---------------------------------------------

def test_t9_notice_does_not_count_as_alert_delivery(h, configured):
    sid = h.new_session()
    _persistence_failure_turn(h, sid=sid, message=B2)
    assert len(configured.calls) == 1
    assert server.session_risk_history[sid][-1].get(server.F2_UNNOTIFIED_MARK) is True
    retry = summary(h.send(sid, B2, classifier="high"))
    assert retry["emails"] == 1, "later completed AMBER still sends the first-alert email"


# --- T10: startup warning ------------------------------------------------------

def test_t10_config_missing_warning(monkeypatch, caplog):
    monkeypatch.delenv("SAFEGUARDING_FALLBACK_EMAILS", raising=False)
    monkeypatch.setattr(server, "RESEND_API_KEY", "")
    with caplog.at_level(logging.WARNING):
        assert server._f2_check_record_not_saved_config() is False
    ev = _events(caplog, "safety.config_missing")
    assert len(ev) == 1 and set(ev[0]["missing"]) == {"SAFEGUARDING_FALLBACK_EMAILS", "RESEND_API_KEY"}


def test_t10_config_present_no_warning(configured, caplog):
    with caplog.at_level(logging.WARNING):
        assert server._f2_check_record_not_saved_config() is True
    assert _events(caplog, "safety.config_missing") == []


def test_t10_startup_hook_registered():
    hooks = [f.__name__ for f in server._fastapi_app.router.on_startup]
    assert "_f2_record_not_saved_config_startup_check" in hooks


def test_recipient_parsing(monkeypatch):
    monkeypatch.setenv("SAFEGUARDING_FALLBACK_EMAILS", " a@x.org,, b@x.org ,not-an-email, a@x.org ")
    assert server._f2_fallback_recipients() == ["a@x.org", "b@x.org"]


# --- Sustained failure (Ant: one notice per failed turn, no rate limit) --------

@pytest.mark.parametrize("transport_kind", ["ok", "failing", "hanging"])
def test_sustained_failures_remain_contained(h, configured, monkeypatch, caplog, transport_kind):
    monkeypatch.setenv("SAFEGUARDING_NOTICE_TIMEOUT_SECONDS", "0.5")
    transport = {"ok": Transport(), "failing": Transport(exc=RuntimeError("down")),
                 "hanging": Transport(delay=30)}[transport_kind]
    monkeypatch.setattr(server, "_f2_resend_post", transport, raising=False)
    n = 20
    same_session = h.new_session()
    with caplog.at_level(logging.ERROR):
        t0 = time.monotonic()
        for i in range(n):
            sid = same_session if i % 2 else None
            r = _persistence_failure_turn(h, sid=sid)
            assert r["reply"] == HOLDING and r["alert_id"] is None
        elapsed = time.monotonic() - t0
    sent = _events(caplog, "safety.record_not_saved_notice_sent")
    not_sent = _events(caplog, "safety.record_not_saved_notice_not_sent")
    assert len(sent) + len(not_sent) == n, "one notice attempt per failed turn, no rate limiting"
    assert len(transport.calls) == n if transport_kind != "hanging" else len(transport.calls) <= n
    if transport_kind == "ok":
        assert len(sent) == n
    else:
        assert len(not_sent) == n
    assert elapsed < n * 4.0
    # The service still works normally afterwards.
    after = summary(h.turn(B2, classifier="high"))
    assert after["kind"] == "GENERATED" and after["emails"] == 1
    crisis = summary(h.turn(A))
    assert crisis["kind"] == "CRISIS" and crisis["emails"] == 1


# --- Review follow-ups ---------------------------------------------------------

def test_environment_line_uses_only_radiocheck_env(monkeypatch):
    monkeypatch.setenv("RENDER_SERVICE_NAME", "veterans-support-api")
    monkeypatch.delenv("RADIOCHECK_ENV", raising=False)
    _, body = server._f2_record_not_saved_content(
        alert_id="x", session_id="s" * 20, failed_components=["c"], error_type="E", occurred_at="t")
    assert "veterans-support-api" not in body and "Environment:         unspecified" in body
    monkeypatch.setenv("RADIOCHECK_ENV", "staging")
    _, body = server._f2_record_not_saved_content(
        alert_id="x", session_id="s" * 20, failed_components=["c"], error_type="E", occurred_at="t")
    assert "Environment:         staging" in body


def _notice(**kw):
    return server._f2_send_record_not_saved_notice(
        alert_id=kw.get("alert_id", "a" * 36), session_id="s" * 30,
        failed_components=["analyze_message_unified"], error_type="RuntimeError")


def test_t6_added_latency_is_bounded_by_timeout(configured, monkeypatch):
    """Measured on the notice itself inside one event loop: the veteran's
    response waits at most timeout + 0.5 s, whatever the provider does."""
    monkeypatch.setenv("SAFEGUARDING_NOTICE_TIMEOUT_SECONDS", "0.5")
    monkeypatch.setattr(server, "_f2_resend_post", Transport(delay=30), raising=False)

    async def run():
        t0 = time.monotonic()
        out = await _notice()
        return out, time.monotonic() - t0
    out, elapsed = asyncio.run(run())
    assert out == "timeout" and elapsed < 0.5 + 0.5 + 0.3, elapsed


def test_hung_provider_cannot_exhaust_the_shared_thread_pool(configured, monkeypatch, caplog):
    """More concurrent notices than notice workers, provider hung: the notices
    beyond the pool are reported as queued_not_started, and an unrelated
    asyncio.to_thread job (as used by the existing email sends) still runs
    immediately because the notice uses its own executor."""
    monkeypatch.setenv("SAFEGUARDING_NOTICE_TIMEOUT_SECONDS", "0.5")
    monkeypatch.setattr(server, "_f2_resend_post", Transport(delay=30), raising=False)
    monkeypatch.setattr(server, "_F2_NOTICE_EXECUTOR", None)
    pool = server.RECORD_NOT_SAVED_POOL_SIZE
    extra = 2

    async def run():
        notices = [asyncio.create_task(_notice(alert_id=f"id-{i}")) for i in range(pool + extra)]
        await asyncio.sleep(0.1)
        t0 = time.monotonic()
        assert await asyncio.to_thread(lambda: 42) == 42
        unrelated = time.monotonic() - t0
        results = await asyncio.gather(*notices)
        return results, unrelated
    with caplog.at_level(logging.ERROR):
        results, unrelated = asyncio.run(run())
    assert unrelated < 0.3, f"shared pool blocked for {unrelated:.2f}s"
    assert results == ["timeout"] * (pool + extra)
    details = sorted(e["detail"] for e in _events(caplog, "safety.record_not_saved_notice_not_sent"))
    assert details.count("queued_not_started") == extra and details.count("0.5s") == pool
    time.sleep(1.4)  # let the hung workers finish before the next test
