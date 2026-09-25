"""Task 1 — judge failure-open: an applicable validator that fails operationally
must not thereby permit the output it was there to authorise.

ADR-0003, already recorded, governs this. No new invariant is sought:

    Failure Must Not Become Permission — a mechanism required to authorise an
    output must not fail and thereby implicitly permit that output.

    Validator Contract Integrity — malformed or non-contract validator output
    cannot silently acquire authoritative policy meaning.

Radio Check already implements exactly this property one layer down. Session 4
Scope 1 states it in `safety/fallback_validation.py`:

    A validator that raises is treated as a FAILURE, not a pass. A fallback
    reaches the user only when every applicable validator affirmatively passed
    it.

The main judge loop in `server.buddy_chat` does the opposite. Four failure
classes are characterised separately here, because they do not share a runtime
path:

  exception            -> `except Exception … break`, candidate released
  timeout              -> APITimeoutError is an Exception, so same path (asserted,
                          not assumed)
  non-contract verdict -> matches neither `startswith("PASS")` nor
                          `startswith("FAIL")`, so NEITHER branch runs. The loop
                          silently iterates and the candidate is released. No
                          regeneration happens either, because regeneration
                          lives inside the FAIL branch.
  empty verdict        -> `(content or "").strip()` is "", same as above

Each test records which candidate every judge call actually evaluated, so a
failure-open finding here is not conflated with the Validation Target Integrity
target-mismatch corrected in #121 (ADR-0003 §17).

These drive the real `/api/ai-buddies/chat` handler. OpenAI is a scripted fake,
Mongo is in-memory, the classifier, geolocation and email are stubbed. No live
model call, no network.
"""
import os
import re
import sys
import uuid

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "judge_failure_open_tests")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-not-a-key")

mongomock_motor = pytest.importorskip(
    "mongomock_motor",
    reason="mongomock-motor is required to drive buddy_chat without a Mongo server",
)

import httpx  # noqa: E402
import openai  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402
import safety.unified_safety as unified_safety  # noqa: E402

JUDGE_PREFIX = "You are a strict behavioural judge"
REGEN_MARKER = "Previous response failed because"
MICRO_PREFIX = "You are generating a fallback"
JUDGED_TEXT_RE = re.compile(r'Assistant response: "(.*)"\n\nCheck the response', re.S)

# venting loads a protocol (so the judge runs) but is not a gated protocol, which
# keeps the deterministic gate out of the way and isolates the judge.
VENTING_MESSAGE = "i'm so angry at the council, fed up with the lot of them"

A_REPLY = "Sounds like the council have properly wound you up, mate. What did they do this time?"
B_REPLY = "Fair enough. What's got you so wound up about them?"


def _completion(text):
    message = type("M", (), {"content": text})()
    choice = type("Ch", (), {"message": message})()
    return type("C", (), {"choices": [choice]})()


class ScriptedOpenAI:
    """Records every call. `judge_script` yields one entry per judge attempt:
    a string verdict to return, or an Exception instance to raise."""

    def __init__(self, judge_script, first_reply=A_REPLY, regenerated_reply=B_REPLY,
                 micro_fallback=None):
        self.judge_script = list(judge_script)
        self.first_reply = first_reply
        self.regenerated_reply = regenerated_reply
        self.micro_fallback = micro_fallback
        self.calls = []            # ordered kinds
        self.judged = []           # ("A"|"B"|"other", raw text) per judge call
        self.chat = type("Chat", (), {"completions": self})()

    def _label(self, text):
        if text == self.first_reply:
            return "A"
        if text == self.regenerated_reply:
            return "B"
        return "other"

    def create(self, *, model, messages, **kwargs):
        system = messages[0]["content"] if messages else ""

        if system.startswith(JUDGE_PREFIX):
            self.calls.append("judge")
            match = JUDGED_TEXT_RE.search(system)
            assert match, "judge prompt shape changed; update JUDGED_TEXT_RE"
            judged = match.group(1)
            self.judged.append((self._label(judged), judged))
            assert self.judge_script, "judge called more times than scripted"
            nxt = self.judge_script.pop(0)
            if isinstance(nxt, BaseException):
                raise nxt
            return _completion(nxt)

        if any(REGEN_MARKER in m.get("content", "") for m in messages):
            self.calls.append("regen")
            return _completion(self.regenerated_reply)

        if system.startswith(MICRO_PREFIX):
            self.calls.append("micro_fallback")
            if self.micro_fallback is None:
                # Force the deterministic terminal rather than another generation.
                raise RuntimeError("test: micro-fallback generation disabled")
            return _completion(self.micro_fallback)

        self.calls.append("main")
        return _completion(self.first_reply)


async def _no_geo(_ip):
    return None


async def _no_email(*args, **kwargs):
    return None


async def _classifier_silent(message, conversation_history=None,
                             previous_sessions=None, use_cache=True):
    return {"ai_used": False, "risk_level": "none", "risk_score": 0,
            "confidence": 0.0, "contains_self_harm_intent": False,
            "detected_indicators": [], "reason": "test"}


@pytest.fixture
def chat(monkeypatch):
    def _drive(judge_script, message=VENTING_MESSAGE, **kwargs):
        fake = ScriptedOpenAI(judge_script, **kwargs)
        monkeypatch.setattr(server, "buddy_openai_client", fake)
        monkeypatch.setattr(server, "gemini_client", None)
        monkeypatch.setattr(
            server, "db",
            mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"]],
        )
        monkeypatch.setattr(unified_safety, "classify_message_with_ai", _classifier_silent)
        monkeypatch.setattr(server, "lookup_ip_geolocation", _no_geo)
        monkeypatch.setattr(server, "send_safeguarding_email_notification", _no_email)

        session_id = f"jfo-{uuid.uuid4().hex[:10]}"
        response = TestClient(server.app).post(
            "/api/ai-buddies/chat",
            json={"message": message, "sessionId": session_id, "character": "tommy"},
        )
        assert response.status_code == 200, response.text
        return fake, response.json()

    return _drive


def _timeout_error():
    return openai.APITimeoutError(request=httpx.Request("POST", "https://api.openai.com/v1/x"))


def _api_error():
    return openai.APIConnectionError(request=httpx.Request("POST", "https://api.openai.com/v1/x"))


# --- Controls: the two contract outcomes behave as designed -----------------

def test_control_valid_pass_releases_the_candidate_that_passed(chat):
    fake, body = chat(["PASS"])

    assert fake.calls == ["main", "judge"]
    assert fake.judged[0][0] == "A"
    assert body["reply"] == A_REPLY


def test_control_valid_fail_twice_reaches_bounded_recovery(chat):
    fake, body = chat(["FAIL: therapeutic_tone", "FAIL: therapeutic_tone"])

    assert fake.calls.count("regen") == 1
    assert [label for label, _ in fake.judged] == ["A", "B"]
    assert body["reply"] not in (A_REPLY, B_REPLY), "must not release an unvalidated candidate"


# --- Failure classes, characterised separately ------------------------------

FAILURE_CLASSES = [
    pytest.param(_api_error, id="exception"),
    pytest.param(_timeout_error, id="timeout"),
]


@pytest.mark.parametrize("make_error", FAILURE_CLASSES)
def test_validator_operational_failure_does_not_release_the_candidate(chat, make_error):
    """Exception and timeout are asserted separately, not assumed to be one path."""
    fake, body = chat([make_error()])

    judged_labels = [label for label, _ in fake.judged]
    assert judged_labels == ["A"], judged_labels   # not a target-mismatch case
    assert body["reply"] != A_REPLY, (
        "an applicable validator failed operationally and produced no affirmative "
        "result, yet the candidate it was there to authorise reached the user"
    )


@pytest.mark.parametrize("verdict", [
    pytest.param("Hmm, hard to say.", id="non_contract_prose"),
    pytest.param("MAYBE", id="non_contract_token"),
    pytest.param("", id="empty"),
    pytest.param(None, id="null_content"),
])
def test_non_contract_verdict_does_not_release_the_candidate(chat, verdict):
    """A verdict matching neither PASS nor FAIL is not an affirmative result.

    Scripted for both attempts: on current main neither branch runs, so the loop
    simply iterates, no regeneration occurs, and the candidate is released.
    """
    fake, body = chat([verdict, verdict])

    assert body["reply"] != A_REPLY, (
        f"non-contract verdict {verdict!r} acquired the meaning of a PASS"
    )


def test_non_contract_verdict_does_not_consume_a_regeneration(chat):
    """Characterisation: regeneration lives inside the FAIL branch only.

    Recorded because it explains why the non-contract case cannot be treated as
    a FAIL by accident — there is no fail_reason to condition a regeneration on.
    """
    fake, _ = chat(["Hmm, hard to say.", "Hmm, hard to say."])

    assert "regen" not in fake.calls
    assert [label for label, _ in fake.judged] == ["A", "A"]


def test_failure_on_the_second_attempt_does_not_release_the_regeneration(chat):
    """The interaction with #121: attempt 2 correctly evaluates B, then fails.

    B has been through the gate (VTI second half) but has no affirmative judge
    result, so it must not be released on the strength of a failed validator.
    """
    fake, body = chat(["FAIL: therapeutic_tone", _api_error()])

    assert [label for label, _ in fake.judged] == ["A", "B"]
    assert fake.calls.count("regen") == 1
    assert body["reply"] != B_REPLY, (
        "the regenerated candidate was released although the validator that "
        "should have authorised it failed"
    )
