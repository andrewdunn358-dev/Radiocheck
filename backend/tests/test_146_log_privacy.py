"""#146: operational logs must not carry conversation content or unnecessary
personal identifiers (Ant, 22 Oct 2026, Stage 1 approval, scopes A, B, C).

Falsification tests: every input carries unique canary strings (message text,
names, emails, phone numbers, IPs, GPS, user agents). Every log record at every
level, and every print() line, is captured; none may contain a canary or a
matched crisis phrase. Preservation tests check that the operational events,
decision evidence and correlation fields are still emitted.

Deterministic, in-process: mongomock, scripted model, stubbed classifier,
mocked HTTP transports. No network.
"""
import asyncio
import io
import json
import logging
import os
import re
import sys
import threading

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from test_f2_pre_decision_exceptions import (  # noqa: E402
    A, B2, E3, G, HOLDING, N, Harness, server, summary,
)

import log_privacy as lp  # noqa: E402
import safety.verdict_reconciler as reconciler  # noqa: E402
import safety.fallback_validation as fallback_validation  # noqa: E402
import safety.provenance as provenance  # noqa: E402
import safety.text_normalizer as text_normalizer  # noqa: E402
import safety.ai_safety_classifier as ai_safety_classifier  # noqa: E402
import safety.conversation_monitor as conversation_monitor  # noqa: E402

FAKE_IP = "203.0.113.77"
HMAC_KEY = "test-hmac-key-for-146-0123456789"
CRISIS_PHRASES = ("kill myself", "end it", "take it anymore", "overdose", "end my life", "can't take it")


# ---------------------------------------------------------------------------
# Capture: every log record (all loggers, DEBUG and up) and every print()
# ---------------------------------------------------------------------------

class _Capture(logging.Handler):
    def __init__(self):
        super().__init__(logging.DEBUG)
        self.lines = []
        self._lock = threading.Lock()

    def emit(self, record):
        try:
            msg = record.getMessage()
        except Exception:
            msg = str(record.msg)
        with self._lock:
            self.lines.append(f"{record.name}|{record.levelname}|{msg}")


@pytest.fixture
def cap(monkeypatch):
    monkeypatch.setenv(lp.IP_HMAC_KEY_ENV, HMAC_KEY)
    lp.guard_third_party_logging()
    c = _Capture()
    root = logging.getLogger()
    old_level = root.level
    root.addHandler(c)
    root.setLevel(logging.DEBUG)
    # print(): wrap the builtin (pytest re-swaps sys.stdout between fixture
    # setup and the test call, so a stdout tee would miss the call phase).
    import builtins
    real_print = builtins.print

    def recording_print(*args, **kwargs):
        if kwargs.get("file") in (None, sys.stdout, sys.__stdout__):
            text = kwargs.get("sep", " ").join(str(a) for a in args)
            if text.strip():
                with c._lock:
                    c.lines.append(f"print|STDOUT|{text.rstrip()}")
        return real_print(*args, **kwargs)
    monkeypatch.setattr(builtins, "print", recording_print)
    try:
        yield c
    finally:
        root.removeHandler(c)
        root.setLevel(old_level)


def _leaks(lines, canaries):
    # Code identifiers such as the detector name "is_overdose_bereavement_context"
    # are rule ids, not user text, so snake_case identifiers are ignored.
    out = []
    for line in lines:
        low = re.sub(r"\b[a-z0-9]+(?:_[a-z0-9]+)+\b", " ", line.lower())
        hit = [c for c in canaries if c and c.lower() in low]
        if hit:
            out.append((hit, line[:220]))
    return out


@pytest.fixture
def h(monkeypatch):
    harness = Harness(monkeypatch)
    yield harness
    harness.close()


def _events(lines, name):
    out = []
    for line in lines:
        _, _, msg = line.split("|", 2)
        try:
            d = json.loads(msg)
        except Exception:
            continue
        if isinstance(d, dict) and d.get("evt") == name:
            out.append(d)
    return out


# ---------------------------------------------------------------------------
# A. Conversation content: chat handler sweep
# ---------------------------------------------------------------------------

CHAT = [
    ("benign", "ZQXCANARYA had a quiet day down the allotment", "silent", ()),
    ("amber", "ZQXCANARYB honestly I can't take it anymore mate", "high", ()),
    ("crisis", "ZQXCANARYC I want to kill myself tonight", "silent", ()),
    ("negated", "ZQXCANARYD I'm not going to kill myself, I promise", "silent", ()),
    ("grief", "my best mate Zqxdavid died of an overdose last year", "bereaved", ()),
    ("provisional", "ZQXCANARYF I want to kill myself", "silent", ("unified",)),
    ("legacy_fail", "ZQXCANARYH I'm going to end it tonight", "silent", ("check_safeguarding",)),
]


@pytest.mark.parametrize("cid,message,classifier,fail", CHAT, ids=[c[0] for c in CHAT])
def test_chat_logs_carry_no_message_content(h, cap, monkeypatch, cid, message, classifier, fail):
    async def geo(_ip):
        return {"geo_city": "Zqxcity", "geo_country": "UK", "geo_region": "Zqxregion",
                "geo_lat": 51.501, "geo_lon": -0.141}
    monkeypatch.setattr(server, "lookup_ip_geolocation", geo)
    monkeypatch.setattr(server, "get_client_ip", lambda req: FAKE_IP)
    sid = h.new_session()
    r = h.send(sid, message, classifier=classifier, fail=fail)
    canaries = re.findall(r"zqx\w+", message, re.I) + [message[:30], sid, FAKE_IP,
                                                       "Zqxcity", "Zqxregion", "51.501"]
    canaries += [p for p in CRISIS_PHRASES if p in message.lower()]
    assert _leaks(cap.lines, canaries) == [], cid
    # The turn still produces its normal outcome (logging changes only).
    assert r["reply"]


def test_grief_name_is_not_logged_but_its_presence_is(h, cap):
    r = h.turn("my best mate Zqxdavid died of an overdose last year", classifier="bereaved")
    assert _leaks(cap.lines, ["Zqxdavid"]) == []
    assert any("[Grief] Name: present=True" in line for line in cap.lines)
    assert r["reply"]


def test_normaliser_logs_lengths_not_text(cap, monkeypatch):
    class _Msg:
        content = "ZQXCANARYN rewritten I want to end my life"

    class _Choice:
        message = _Msg()

    class _Completion:
        choices = [_Choice()]

    class _Completions:
        async def create(self, **k):
            return _Completion()

    class _Client:
        chat = type("C", (), {"completions": _Completions()})()

    monkeypatch.setattr(text_normalizer, "should_normalise", lambda t: True)
    monkeypatch.setattr(text_normalizer, "_get_async_client", lambda: _Client())
    out, changed = asyncio.run(text_normalizer.normalise_text("ZQXCANARYM i wanna end it all lol"))
    assert changed and "ZQXCANARYN" in out, "behaviour unchanged"
    assert _leaks(cap.lines, ["ZQXCANARYM", "ZQXCANARYN", "end my life", "wanna end"]) == []
    assert any("[TextNormalizer] Normalised: len_in=" in line for line in cap.lines)


def test_classifier_parse_failure_does_not_log_raw_output(cap, monkeypatch):
    class _Msg:
        content = "not json at all ZQXCANARYR the user said they want to die"

    class _Completions:
        async def create(self, **k):
            return type("X", (), {"choices": [type("Y", (), {"message": _Msg()})()]})()

    class _Client:
        chat = type("C", (), {"completions": _Completions()})()

    monkeypatch.setattr(ai_safety_classifier, "_get_async_client", lambda: _Client())
    monkeypatch.setattr(ai_safety_classifier, "AI_SAFETY_ENABLED", True, raising=False)
    monkeypatch.setattr(ai_safety_classifier, "OPENAI_AVAILABLE", True, raising=False)
    result = asyncio.run(ai_safety_classifier.classify_message_with_ai(
        "ZQXCANARYQ I want to die", use_cache=False))
    assert result.get("error") == "Failed to parse AI response", "behaviour unchanged"
    assert _leaks(cap.lines, ["ZQXCANARYR", "ZQXCANARYQ", "want to die"]) == []
    assert any("Raw response withheld: len=" in line for line in cap.lines)


def test_candidate_phrase_flag_does_not_log_the_message(cap):
    before = len(conversation_monitor.candidate_phrase_memory)
    conversation_monitor.flag_candidate_phrase(
        phrase="ZQXCANARYP everything is pointless and I am done with it all",
        session_id="sess-zqx-123456789", user_id="u", inferred_category="hopelessness",
        context_risk_level="high")
    assert len(conversation_monitor.candidate_phrase_memory) == before + 1, "still kept for review"
    assert _leaks(cap.lines, ["ZQXCANARYP", "pointless"]) == []


def test_judge_free_text_reason_is_withheld_from_logs_and_provenance(cap):
    out = fallback_validation.validated_fallback(
        trigger="micro", generate=lambda: "candidate reply text",
        judge=lambda c: (False, "The reply asks about Zqxdave after the user said ZQXCANARYJ"),
        session_label="sess-abc")
    assert out.failed_validator == "judge" and out.source == "terminal", "decision unchanged"
    assert out.failed_reason.startswith("The reply"), "the outcome object itself is unchanged"
    vals = fallback_validation.provenance_values(out, trigger="micro")
    assert vals["failed_reason"] == "unstructured"
    assert _leaks(cap.lines, ["Zqxdave", "ZQXCANARYJ"]) == []


@pytest.mark.parametrize("reason,expected", [
    ("welfare_pivot", "welfare_pivot"), ("brush_off_acceptance", "brush_off_acceptance"),
    ("spine_leak - said worried twice", "spine_leak"), ("generation_returned_nothing", "generation_returned_nothing"),
    ("judge_validator_error", "judge_validator_error"), ("The reply mentions Dave", "unstructured"),
    (None, None), ("", None),
])
def test_reason_codes_preserve_machine_evidence(reason, expected):
    assert lp.reason_code(reason) == expected
    assert fallback_validation._reason_code(reason) == expected


def test_pinned_lines_no_longer_write_content():
    src = open(os.path.join(os.path.dirname(__file__), "..", "server.py")).read()
    assert "Negation detected in: '{safeguarding_text[:60]}'" not in src
    assert "[Grief] Name: {session['grief_name']}" not in src
    assert "Negation detected (message length: {len(safeguarding_text)})" in src
    assert "[Grief] Name: present={bool(session['grief_name'])}" in src
    assert "Raw: {raw!r}" not in src, "micro-fallback refusal text no longer logged"


def test_pinned_regions_verify_after_controlled_repin():
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "differential"))
    from runtime_chain import PINNED_HASHES, verify_fidelity
    assert verify_fidelity() == {"crisis_override_and_grief_state": "OK",
                                 "negation_and_identity_guards": "OK", "correctives": "OK"}
    assert PINNED_HASHES["correctives"] == "9c9d871f7a4b70ea", "correctives not repinned"


# ---------------------------------------------------------------------------
# Reconciler and provenance contracts (decision 4)
# ---------------------------------------------------------------------------

def test_reconciler_audit_keeps_decision_evidence_without_phrases(cap):
    kw = reconciler.KeywordVerdict(risk_level="CRITICAL", failsafe_triggered=True,
                                   failsafe_reason="explicit_intent", triggers=["kill myself", "overdose"])
    v = reconciler.reconcile_verdicts(keyword=kw, classifier=None,
                                      message_lower="zqxcanaryk i want to kill myself",
                                      session_id="tommy-1729600000000-abcdefghi", character="tommy")
    assert v.failsafe_triggered and v.precedence_rule_fired, "verdict unchanged"
    ev = _events(cap.lines, "round10.reconcile")
    assert len(ev) == 1
    e = ev[0]
    assert e["session_id"] == "tommy-172960" and len(e["session_id"]) == 12
    assert e["kw"]["triggers_count"] == 2 and "triggers" not in e["kw"]
    assert e["kw"]["risk_level"] == "CRITICAL" and e["kw"]["failsafe"] is True
    assert e["kw"]["failsafe_reason"] == "explicit_intent"
    assert e["final"]["risk_level"] == v.risk_level and e["rule"] == v.precedence_rule_fired
    assert len(e["msg_sha256_16"]) == 16 and e["msg_length"] == len("zqxcanaryk i want to kill myself")
    assert "triggers_count=2" in e["reason"] or "triggers" not in v.reconciliation_reason
    assert _leaks(cap.lines, ["kill myself", "overdose", "zqxcanaryk", "abcdefghi"]) == []


def test_reconciler_reason_unchanged_on_the_verdict_object():
    kw = reconciler.KeywordVerdict(risk_level="CRITICAL", failsafe_triggered=True,
                                   failsafe_reason="explicit_intent", triggers=["kill myself"])
    cls = reconciler.ClassifierVerdict(risk_level="high", confidence=0.9, contains_self_harm_intent=True,
                                       detected_indicators=[], reason="x")
    v = reconciler.reconcile_verdicts(keyword=kw, classifier=cls, message_lower="i want to kill myself")
    assert v.precedence_rule_fired == "KEYWORD_FAILSAFE"
    assert "triggers=['kill myself']" in v.reconciliation_reason, "FinalVerdict is not changed"


def test_provenance_record_still_carries_decision_fields(h, cap):
    records = []
    provenance.set_sink(records.append)
    try:
        h.turn(A)
    finally:
        provenance.reset_sink()
    rec = records[-1]
    assert rec["session"] and len(rec["session"]) <= 12
    assert len(rec["msg_sha256_16"]) == 16 and rec["msg_length"] > 0
    out = rec["outcome"]
    assert out["risk_level"] == "RED" and out["safeguarding_triggered"] is True
    stage_names = {s["name"] for s in rec["stages"]}
    assert {"reconciled_result"} <= stage_names


# ---------------------------------------------------------------------------
# B. Identifiers
# ---------------------------------------------------------------------------

def test_exit_b_alert_log_uses_keyed_ip_ref_and_no_city(h, cap, monkeypatch):
    async def geo(_ip):
        return {"geo_city": "Zqxcity", "geo_country": "UK"}
    monkeypatch.setattr(server, "lookup_ip_geolocation", geo)
    monkeypatch.setattr(server, "get_client_ip", lambda req: FAKE_IP)
    sid = h.new_session()
    r = h.send(sid, B2, classifier="high")
    assert summary(r)["alerts"], "alert still written"
    line = next(l for l in cap.lines if "SAFEGUARDING ALERT [" in l)
    assert lp.ip_ref(FAKE_IP) in line and FAKE_IP not in line and "Zqxcity" not in line
    assert f"Session: {sid[:12]} " in line and sid not in line.replace(sid[:12], "")
    assert "Country: UK" in line


def test_rate_limit_and_blocked_requests_log_ip_ref_only(h, cap, monkeypatch):
    from fastapi.testclient import TestClient
    monkeypatch.setattr(server, "get_client_ip", lambda req: FAKE_IP)
    sid = h.new_session()
    c = TestClient(server.app, raise_server_exceptions=False)
    r = c.post("/api/ai-buddies/chat", json={"message": "hi", "sessionId": sid, "character": "tommy"},
               headers={"user-agent": "Zqxbot-crawler/9.9 (zqx-agent-canary)"})
    assert r.status_code == 403
    server.block_ip(FAKE_IP, 1)
    server.blocked_ips.pop(FAKE_IP, None)
    assert _leaks(cap.lines, [FAKE_IP, "Zqxbot", "zqx-agent-canary"]) == []
    assert any("ua_family=bot" in l for l in cap.lines)
    assert any(lp.ip_ref(FAKE_IP) in l for l in cap.lines)


def test_geolocation_lookup_does_not_put_the_ip_in_any_log(cap, monkeypatch):
    import httpx
    real = httpx.AsyncClient

    def handler(req):
        return httpx.Response(200, json={"status": "success", "city": "Zqxcity", "country": "UK"})

    class Fake(real):
        def __init__(self, *a, **k):
            k["transport"] = httpx.MockTransport(handler)
            super().__init__(*a, **k)
    monkeypatch.setattr(httpx, "AsyncClient", Fake)
    out = asyncio.run(server.lookup_ip_geolocation(FAKE_IP))
    assert out.get("geo_city") == "Zqxcity", "lookup unchanged"
    assert _leaks(cap.lines, [FAKE_IP]) == []

    def failing(req):
        raise httpx.ConnectError(f"cannot reach http://ip-api.com/json/{FAKE_IP}")

    class Failing(real):
        def __init__(self, *a, **k):
            k["transport"] = httpx.MockTransport(failing)
            super().__init__(*a, **k)
    monkeypatch.setattr(httpx, "AsyncClient", Failing)
    assert asyncio.run(server.lookup_ip_geolocation(FAKE_IP)) == {}
    assert _leaks(cap.lines, [FAKE_IP]) == []
    assert any("IP geolocation lookup failed for ip:" in l and "ConnectError" in l for l in cap.lines)


@pytest.mark.parametrize("path,body,canaries", [
    ("/api/peer-support/register", {"email": "zqxpeer@example.org"}, ["zqxpeer"]),
    ("/api/concerns", {"your_name": "Zqxconcernname", "your_email": "zqxconcern@example.org",
                       "your_phone": "07000999111", "relationship": "zqxspouse",
                       "veteran_name": "Zqxveteranname", "concerns": "ZQXCANARYJ he talks about ending it",
                       "urgency": "high"},
     ["Zqxconcernname", "zqxconcern", "07000999111", "zqxspouse", "Zqxveteranname", "ZQXCANARYJ"]),
    ("/api/callbacks", {"name": "Zqxcallbackname", "phone": "07000999222", "email": "zqxcb@example.org",
                        "message": "ZQXCANARYK please call me", "request_type": "counsellor"},
     ["Zqxcallbackname", "07000999222", "zqxcb", "ZQXCANARYK"]),
    ("/api/call-logs", {"contact_type": "counsellor", "contact_name": "Zqxcontactname",
                        "contact_phone": "07000999333", "call_method": "phone"},
     ["07000999333"]),
], ids=["peer_register", "concern", "callback", "call_intent"])
def test_public_endpoints_log_no_personal_data(h, cap, monkeypatch, path, body, canaries):
    from fastapi.testclient import TestClient
    h.new_session()
    # Let the email paths succeed so their "sent" log lines are reached.
    import resend
    monkeypatch.setattr(server, "RESEND_API_KEY", "re_test_key", raising=False)
    monkeypatch.setattr(resend.Emails, "send", staticmethod(lambda params: {"id": "email-146"}))
    r = TestClient(server.app, raise_server_exceptions=False).post(path, json=body)
    assert r.status_code == 200, r.text
    if path == "/api/callbacks":
        assert any("Callback confirmation email sent" in l for l in cap.lines), "changed line reached"
    assert _leaks(cap.lines, canaries) == []


def test_ai_feedback_report_reason_not_logged(h, cap, monkeypatch):
    from fastapi.testclient import TestClient
    import routers.ai_feedback as ai_feedback
    h.new_session()
    monkeypatch.setattr(ai_feedback, "get_database", lambda: server.db)
    c = TestClient(server.app, raise_server_exceptions=False)
    r = c.post("/api/ai-feedback/report", params={
        "session_id": "s", "message_index": 1, "ai_character": "tommy",
        "report_reason": "ZQXCANARYW the bot told me to end it"})
    assert r.status_code == 200, r.text
    assert any("AI response reported: tommy - reason_len=" in l for l in cap.lines)
    assert _leaks(cap.lines, ["ZQXCANARYW"]) == []


def test_gps_location_update_logs_no_coordinates(h, cap):
    from fastapi.testclient import TestClient
    h.new_session()
    asyncio.run(server.db.safeguarding_alerts.insert_one({"id": "alert-gps-1", "session_id": "s"}))
    r = TestClient(server.app, raise_server_exceptions=False).patch(
        "/api/safeguarding-alerts/alert-gps-1/location",
        json={"gps_lat": 51.501234, "gps_lon": -0.141987, "gps_accuracy": 12})
    assert r.status_code == 200, r.text
    assert _leaks(cap.lines, ["51.501234", "-0.141987", "0.141987"]) == []
    assert any("alert-gps-1 updated with GPS location (accuracy: 12" in l for l in cap.lines)


def test_twilio_voice_webhook_masks_numbers_and_drops_form_and_headers(h, cap):
    from fastapi.testclient import TestClient
    h.new_session()
    form = {"To": "07700900123", "From": "+447700900456", "CallSid": "CA123", "Caller": "client:Zqxstaff",
            "FromCity": "Zqxtown", "FromZip": "ZQ1 1XX", "StaffName": "Zqxstaffname"}
    r = TestClient(server.app, raise_server_exceptions=False).post(
        "/api/twilio/voice", data=form, headers={"X-Twilio-Signature": "zqxsignaturecanary"})
    assert r.status_code in (200, 500)
    assert _leaks(cap.lines, ["07700900123", "7700900123", "447700900456", "Zqxtown", "ZQ1 1XX",
                              "zqxsignaturecanary", "Zqxstaffname"]) == []
    assert any("To=***123" in l for l in cap.lines)


def test_twilio_library_logger_is_capped(cap):
    lp.guard_third_party_logging()
    logging.getLogger("twilio.http_client").info("POST Request: https://api.twilio.com Data: To=+447700900999")
    assert _leaks(cap.lines, ["447700900999"]) == []


# --- WebRTC ------------------------------------------------------------------

def _run_ws(coro):
    return asyncio.run(coro)


def test_webrtc_handover_logs_no_names_or_full_session_ids(cap, monkeypatch):
    import webrtc_signaling as ws
    import mongomock_motor
    from unittest.mock import AsyncMock

    db = mongomock_motor.AsyncMongoMockClient()["ws146"]
    monkeypatch.setattr(ws, "get_database", lambda: db)
    monkeypatch.setattr(ws.sio, "emit", AsyncMock())
    monkeypatch.setattr(ws.sio, "enter_room", AsyncMock(), raising=False)
    monkeypatch.setattr(ws, "connected_users", {})
    monkeypatch.setattr(ws, "user_to_sockets", {})
    vet_sid_full = "tommy-1729600000000-zqxrandom"
    _run_ws(ws.register("sock-staff", {"user_id": "staff-1", "user_type": "counsellor",
                                       "name": "Staff One", "status": "available"}))
    _run_ws(ws.register("sock-vet", {"user_id": vet_sid_full, "user_type": "user",
                                     "name": "Zqxveteranname"}))
    _run_ws(ws.request_human_chat("sock-vet", {"user_id": vet_sid_full, "user_name": "Zqxveteranname",
                                               "session_id": vet_sid_full, "alert_id": "a1"}))
    _run_ws(ws.request_human_call("sock-vet", {"user_id": vet_sid_full, "user_name": "Zqxveteranname",
                                               "session_id": vet_sid_full, "alert_id": "a1"}))
    _run_ws(ws.join_chat_room("sock-vet", {"room_id": "r1", "user_id": vet_sid_full, "name": "Zqxveteranname"}))
    _run_ws(ws.chat_message("sock-vet", {"room_id": "r1", "message": "ZQXCANARYL I can't cope",
                                         "sender_id": vet_sid_full, "sender_name": "Zqxveteranname"}))
    assert _leaks(cap.lines, ["Zqxveteranname", "zqxrandom", "ZQXCANARYL"]) == []
    assert any(vet_sid_full[:12] in l for l in cap.lines), "12-character reference still correlates"


def test_socketio_packet_logging_is_capped():
    lp.guard_third_party_logging()
    for name in ("engineio.server", "socketio.server"):
        assert not logging.getLogger(name).isEnabledFor(logging.INFO), name
        assert logging.getLogger(name).isEnabledFor(logging.WARNING), name


# ---------------------------------------------------------------------------
# C. Exception text in chat and safeguarding logs
# ---------------------------------------------------------------------------

def test_alert_insert_failure_logs_exception_type_not_text(h, cap):
    def fail_insert(mp):
        cls = type(server.db.safeguarding_alerts)
        real = cls.insert_one

        async def insert_one(self, *a, **k):
            if getattr(self, "name", "") == "safeguarding_alerts":
                raise RuntimeError("E11000 duplicate key: triggering_message ZQXCANARYE")
            return await real(self, *a, **k)
        mp.setattr(cls, "insert_one", insert_one)
    h.turn(A, fail=(fail_insert,))
    h.turn(B2, classifier="high", fail=(fail_insert,))
    h.turn(A, fail=("unified", fail_insert))
    assert _leaks(cap.lines, ["ZQXCANARYE", "duplicate key"]) == []
    assert any("ALERT NOT PERSISTED" in l and "RuntimeError" in l for l in cap.lines)
    assert any("EXIT B alert insert FAILED" in l and "RuntimeError" in l for l in cap.lines)


# ---------------------------------------------------------------------------
# IP HMAC (decision 3)
# ---------------------------------------------------------------------------

def test_ip_ref_is_keyed_and_stable(monkeypatch):
    monkeypatch.setenv(lp.IP_HMAC_KEY_ENV, HMAC_KEY)
    a, b = lp.ip_ref(FAKE_IP), lp.ip_ref(FAKE_IP)
    assert a == b and re.fullmatch(r"ip:[0-9a-f]{12}", a)
    assert FAKE_IP not in a
    import hashlib
    assert a != "ip:" + hashlib.sha256(FAKE_IP.encode()).hexdigest()[:12], "not an unkeyed hash"
    monkeypatch.setenv(lp.IP_HMAC_KEY_ENV, HMAC_KEY + "-other")
    assert lp.ip_ref(FAKE_IP) != a, "depends on the key"
    assert lp.ip_ref("") == "ip:none"


@pytest.mark.parametrize("key", [None, "", "short"])
def test_ip_ref_without_a_usable_key_never_emits_ip_or_unkeyed_hash(monkeypatch, caplog, key):
    if key is None:
        monkeypatch.delenv(lp.IP_HMAC_KEY_ENV, raising=False)
    else:
        monkeypatch.setenv(lp.IP_HMAC_KEY_ENV, key)
    monkeypatch.setattr(lp, "_config_warned", set())
    with caplog.at_level(logging.WARNING):
        refs = {lp.ip_ref(FAKE_IP), lp.ip_ref("198.51.100.9")}
    assert refs == {lp.IP_UNKEYED}
    ev = [json.loads(r.getMessage()) for r in caplog.records if "privacy.config_missing" in r.getMessage()]
    assert len(ev) == 1, "warned once"
    assert ev[0]["missing"] == lp.IP_HMAC_KEY_ENV


def test_hmac_key_never_appears_in_logs(h, cap, monkeypatch):
    monkeypatch.setattr(server, "get_client_ip", lambda req: FAKE_IP)
    monkeypatch.setattr(lp, "_config_warned", set())
    h.turn(B2, classifier="high")
    lp.ip_ref(FAKE_IP)
    assert _leaks(cap.lines, [HMAC_KEY]) == []


# ---------------------------------------------------------------------------
# Logging configuration safeguard (decision 7)
# ---------------------------------------------------------------------------

def test_third_party_debug_payload_logging_cannot_be_enabled_by_accident(monkeypatch, caplog):
    monkeypatch.setenv("OPENAI_LOG", "debug")
    for name in ("openai", "openai._base_client", "httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.DEBUG)
    root = logging.getLogger()
    monkeypatch.setattr(root, "level", root.level)  # restored after the test
    root.setLevel(logging.DEBUG)
    with caplog.at_level(logging.DEBUG):
        applied = lp.guard_third_party_logging()
        logging.getLogger("openai._base_client").debug("Request options: {'json_data': {'messages': 'ZQXCANARYO'}}")
        logging.getLogger("httpx").info(f"HTTP Request: GET http://ip-api.com/json/{FAKE_IP}")
        logging.getLogger("httpx").warning("httpx warning still flows")
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "ZQXCANARYO" not in text and FAKE_IP not in text
    assert "httpx warning still flows" in text, "warnings and errors preserved"
    assert "privacy.third_party_debug_blocked" in text
    assert all(v == "WARNING" for v in applied.values())


def test_guard_is_installed_at_import_and_at_startup():
    for name in ("openai", "httpx", "httpcore", "engineio.server", "socketio.server", "twilio"):
        assert logging.getLogger(name).getEffectiveLevel() >= logging.WARNING, name
    hooks = [f.__name__ for f in server._fastapi_app.router.on_startup]
    assert "_log_privacy_startup_guard" in hooks


# ---------------------------------------------------------------------------
# Preservation: required safeguarding events still emitted
# ---------------------------------------------------------------------------

def test_required_safeguarding_events_still_emitted(h, cap):
    h.turn(A)                                  # EXIT A
    h.turn(B2, classifier="high")              # EXIT B
    h.turn(A, fail=("unified",))               # F2 INCOMPLETE + provisional
    h.turn(G, fail=("reconcile",))             # reconciler fallback
    joined = "\n".join(cap.lines)
    for marker in ("SAFEGUARDING FAILSAFE ALERT [RED]", "SAFEGUARDING ALERT [AMBER]",
                   "SAFEGUARDING PROVISIONAL ALERT [EVALUATION INCOMPLETE]",
                   "CRITICAL SAFETY ALERT", "[SAFEGUARDING CHECK] Session:"):
        assert marker in joined, marker
    for evt in ("round10.reconcile", "safety.precheck_component_failed", "safety.evaluation_incomplete",
                "safety.reconciler_fallback"):
        assert _events(cap.lines, evt), evt


def test_safety_monitor_keeps_the_concern_category_without_the_phrase(h, cap):
    h.turn(A)
    assert any("CRITICAL SAFETY ALERT" in l and "concern=immediate_suicide_risk" in l for l in cap.lines)
    assert _leaks([l for l in cap.lines if "SAFETY ALERT" in l], ["kill myself"]) == []


# ---------------------------------------------------------------------------
# Static sweep: no raw exception text in chat / safeguarding log lines
# ---------------------------------------------------------------------------

_RAW_EXC = re.compile(
    r"(logging\.(?:error|warning|info|exception|critical)|logger\.(?:error|warning|info)|print)"
    r"\(f[\"'].*\{(?:str\()?(?:e|_pe|exc|judge_error|usage_error|openai_error|gemini_error)\)?\}")


def _pinned_spans(src):
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "differential"))
    import runtime_chain as rc
    spans = []
    for _name, start, end in rc._REGIONS:
        i = src.find(start)
        spans.append((i, src.find(end, i + len(start)) + len(end)))
    return spans


def test_no_raw_exception_text_in_chat_and_safeguarding_logs():
    here = os.path.dirname(__file__)
    src = open(os.path.join(here, "..", "server.py")).read()
    spans = _pinned_spans(src)
    # Chat handler, F2/provisional path, safeguarding alert/panic endpoints,
    # public endpoints, live chat. Pinned regions are excluded (controlled
    # repin is limited to the two authorised log lines).
    scoped = ("async def buddy_chat", "async def send_safeguarding_email",
              "async def create_panic_alert", "async def get_safeguarding_alerts",
              "async def raise_concern", "async def create_callback_request",
              "async def log_call_intent", "async def register_peer_support")
    bad, pos = [], 0
    for n, line in enumerate(src.split("\n"), 1):
        if _RAW_EXC.search(line) and not any(a <= pos < b for a, b in spans):
            bad.append((n, line.strip()[:100]))
        pos += len(line) + 1
    in_scope = []
    for n, line in bad:
        owner = None
        for m in re.finditer(r"^(async )?def (\w+)", src, re.M):
            if src.count("\n", 0, m.start()) + 1 <= n:
                owner = m.group(0)
        if owner and any(owner.startswith(s) for s in scoped):
            in_scope.append((n, owner, line))
    assert in_scope == []
    for f in ("safety/unified_safety.py", "safety/ai_safety_classifier.py", "safety/text_normalizer.py",
              "safety/semantic_model.py", "safety/safety_monitor.py", "safety/provenance.py",
              "safety/fallback_validation.py"):
        text = open(os.path.join(here, "..", f)).read()
        assert not [l for l in text.split("\n") if _RAW_EXC.search(l)], f
