"""Validation Target Integrity — a validator result must apply to the artefact released.

Zentrafuge invariant, adjudicated 25 September 2026:

    A successful validation result obtained for one candidate response artefact
    must not be treated as authorising a different candidate artefact
    subsequently substituted for it; each validator whose result is relied upon
    to authorise a released artefact must have been evaluated against that
    artefact itself.

Two demonstrated cases in `server.buddy_chat`, reproduced end-to-end on main
`0755836` (docs/... judge-target-integrity falsification, 24 Sept 2026):

  1. STALE JUDGE TARGET. `judge_prompt` was built once from candidate A before
     the retry loop. A FAIL on attempt 1 regenerates B and rebinds `reply`, but
     the prompt was not rebuilt, so attempt 2 re-examined A. A PASS concerning A
     then released B, which nothing had judged.

  2. INHERITED GATE AUTHORISATION. `run_protocol_gates` runs once, on A, before
     the judge loop. The judge loop's regeneration replaces A with B and never
     re-gates, so B was released carrying A's gate authorisation — demonstrated
     with a B containing "no worries", which the brush-off gate rejects.

These tests drive the real `/api/ai-buddies/chat` handler. Every external
dependency is deterministic: the OpenAI client is a scripted fake that records
the prompt of every call (so the text actually submitted to each judge attempt
is observed, not inferred), Mongo is in-memory, and the classifier, geolocation
and email are stubbed. No live model call is made and no network is used.
"""
import os
import re
import sys
import uuid

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "validation_target_integrity_tests")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-not-a-key")

mongomock_motor = pytest.importorskip(
    "mongomock_motor",
    reason="mongomock-motor is required to drive buddy_chat without a Mongo server",
)

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402
import safety.unified_safety as unified_safety  # noqa: E402
from safety.protocol_gates import run_protocol_gates  # noqa: E402

JUDGE_PREFIX = "You are a strict behavioural judge"
REGEN_MARKER = "Previous response failed because"
MICRO_PREFIX = "You are generating a fallback"
# The judge prompt embeds the candidate between these two markers
# (safety/judge_prompt.py). Extracting it is how each attempt's actual
# validation target is observed.
JUDGED_TEXT_RE = re.compile(r'Assistant response: "(.*)"\n\nCheck the response', re.S)

# venting: loads a protocol (so the judge runs) but is NOT one of the gated
# protocols, which isolates case 1 from the gate.
VENTING_MESSAGE = "i'm so angry at the council, fed up with the lot of them"
# brush_off: a gated protocol, for case 2.
BRUSH_OFF_MESSAGE = "ignore me, i'm just being dramatic"


def _completion(text):
    message = type("M", (), {"content": text})()
    choice = type("Ch", (), {"message": message})()
    return type("C", (), {"choices": [choice]})()


class ScriptedOpenAI:
    """Records every call. `judge_verdicts` is consumed one per judge attempt."""

    def __init__(self, first_reply, regenerated_reply, judge_verdicts):
        self.first_reply = first_reply
        self.regenerated_reply = regenerated_reply
        self.judge_verdicts = list(judge_verdicts)
        self.judged_texts = []
        self.kinds = []
        self.chat = type("Chat", (), {"completions": self})()

    def create(self, *, model, messages, **kwargs):
        system = messages[0]["content"] if messages else ""
        if system.startswith(JUDGE_PREFIX):
            self.kinds.append("judge")
            match = JUDGED_TEXT_RE.search(system)
            assert match, "judge prompt shape changed; update JUDGED_TEXT_RE"
            self.judged_texts.append(match.group(1))
            assert self.judge_verdicts, "judge called more times than scripted"
            return _completion(self.judge_verdicts.pop(0))
        if any(REGEN_MARKER in m.get("content", "") for m in messages):
            self.kinds.append("regen")
            return _completion(self.regenerated_reply)
        if system.startswith(MICRO_PREFIX):
            self.kinds.append("micro_fallback")
            # Force the deterministic terminal rather than another generation.
            raise RuntimeError("test: micro-fallback generation disabled")
        self.kinds.append("main")
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
    """Drive one turn through the real handler with a scripted OpenAI client."""
    def _drive(message, first_reply, regenerated_reply, judge_verdicts):
        fake = ScriptedOpenAI(first_reply, regenerated_reply, judge_verdicts)
        monkeypatch.setattr(server, "buddy_openai_client", fake)
        monkeypatch.setattr(server, "gemini_client", None)
        monkeypatch.setattr(
            server, "db",
            mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"]],
        )
        monkeypatch.setattr(unified_safety, "classify_message_with_ai", _classifier_silent)
        monkeypatch.setattr(server, "lookup_ip_geolocation", _no_geo)
        monkeypatch.setattr(server, "send_safeguarding_email_notification", _no_email)

        session_id = f"vti-{uuid.uuid4().hex[:10]}"
        response = TestClient(server.app).post(
            "/api/ai-buddies/chat",
            json={"message": message, "sessionId": session_id, "character": "tommy"},
        )
        assert response.status_code == 200, response.text
        return fake, response.json()

    return _drive


# --- Case 1: the second judge attempt must evaluate the regenerated reply ----

A_VENT = "Sounds like the council have properly wound you up, mate. What did they do this time?"
B_VENT = "Fair enough. What's got you so wound up about them?"


def test_second_judge_attempt_evaluates_the_regenerated_reply(chat):
    fake, body = chat(VENTING_MESSAGE, A_VENT, B_VENT, ["FAIL: therapeutic_tone", "PASS"])

    assert fake.kinds == ["main", "judge", "regen", "judge"], fake.kinds
    assert fake.judged_texts[0] == A_VENT, "attempt 1 must judge the first candidate"
    assert fake.judged_texts[1] == B_VENT, (
        "attempt 2 judged the wrong artefact: expected the regenerated reply, got "
        f"{fake.judged_texts[1]!r}"
    )
    # And the artefact the PASS concerned is the one released.
    assert body["reply"] == B_VENT


def test_a_pass_concerning_the_discarded_candidate_cannot_release_the_new_one(chat):
    """The control from the falsification: judge(A)=PASS, judge(B)=FAIL.

    Scripted so that whichever artefact attempt 2 receives decides the outcome.
    If attempt 2 examines A it PASSes and B is released unvalidated; examining B
    it FAILs and the bounded fallback runs instead. Releasing B here is the
    defect.
    """
    verdicts = ["FAIL: therapeutic_tone", "PASS_IF_STALE"]

    class ContentKeyedOpenAI(ScriptedOpenAI):
        def create(self, *, model, messages, **kwargs):
            system = messages[0]["content"] if messages else ""
            if system.startswith(JUDGE_PREFIX) and self.judge_verdicts[:1] == ["PASS_IF_STALE"]:
                judged = JUDGED_TEXT_RE.search(system).group(1)
                self.judge_verdicts[0] = (
                    "PASS" if judged == self.first_reply else "FAIL: brush_off_acceptance"
                )
            return super().create(model=model, messages=messages, **kwargs)

    fake = ContentKeyedOpenAI(A_VENT, B_VENT, verdicts)
    import types
    fake.chat = types.SimpleNamespace(completions=fake)

    original_client = server.buddy_openai_client
    original_db = server.db
    original_classifier = unified_safety.classify_message_with_ai
    original_geo = server.lookup_ip_geolocation
    original_email = server.send_safeguarding_email_notification
    try:
        server.buddy_openai_client = fake
        server.gemini_client = None
        server.db = mongomock_motor.AsyncMongoMockClient()[os.environ["DB_NAME"]]
        unified_safety.classify_message_with_ai = _classifier_silent
        server.lookup_ip_geolocation = _no_geo
        server.send_safeguarding_email_notification = _no_email
        session_id = f"vti-{uuid.uuid4().hex[:10]}"
        response = TestClient(server.app).post(
            "/api/ai-buddies/chat",
            json={"message": VENTING_MESSAGE, "sessionId": session_id, "character": "tommy"},
        )
    finally:
        server.buddy_openai_client = original_client
        server.db = original_db
        unified_safety.classify_message_with_ai = original_classifier
        server.lookup_ip_geolocation = original_geo
        server.send_safeguarding_email_notification = original_email

    assert response.status_code == 200, response.text
    assert fake.judged_texts[1] == B_VENT
    assert response.json()["reply"] != B_VENT, (
        "a verdict about the discarded candidate authorised release of the new one"
    )


# --- Case 2: a regenerated reply must not inherit the gate's authorisation ---

A_BRUSH = "Didn't sound like nothing to me, mate."
B_BRUSH = "No worries. I'm here if you need anything."


def test_gate_rejected_regeneration_is_not_released_on_the_first_candidates_gate_pass(chat):
    """A passes the brush-off gate; B would not. B must not inherit that pass."""
    verdict_on_a = run_protocol_gates(
        primary_protocol="brush_off", reply=A_BRUSH, user_message=BRUSH_OFF_MESSAGE
    )
    verdict_on_b = run_protocol_gates(
        primary_protocol="brush_off", reply=B_BRUSH, user_message=BRUSH_OFF_MESSAGE
    )
    assert verdict_on_a.passed, "fixture invalid: A must pass the gate"
    assert not verdict_on_b.passed, "fixture invalid: B must fail the gate"

    fake, body = chat(BRUSH_OFF_MESSAGE, A_BRUSH, B_BRUSH, ["FAIL: therapeutic_tone", "PASS"])

    assert body["reply"] != B_BRUSH, (
        "a reply the applicable deterministic gate rejects was released because the "
        "gate had only ever been run against the candidate it replaced"
    )


# --- Preservation: unchanged behaviour where no substitution happens ---------

def test_a_first_attempt_pass_releases_the_candidate_that_was_judged(chat):
    fake, body = chat(VENTING_MESSAGE, A_VENT, B_VENT, ["PASS"])

    assert fake.kinds == ["main", "judge"], fake.kinds
    assert fake.judged_texts == [A_VENT]
    assert body["reply"] == A_VENT


def test_two_failures_still_reach_the_bounded_terminal(chat):
    """The Scope 1 bound is unchanged: no third generation, deterministic terminal."""
    fake, body = chat(
        VENTING_MESSAGE, A_VENT, B_VENT,
        ["FAIL: therapeutic_tone", "FAIL: therapeutic_tone"],
    )

    assert fake.kinds.count("main") == 1
    assert fake.kinds.count("regen") == 1
    assert body["reply"] not in (A_VENT, B_VENT)
    assert body["safeguardingTriggered"] is False
