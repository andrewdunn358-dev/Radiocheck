"""Retention enforcement — does the cleanup do what the policy says?

WHAT HAS ACTUALLY BEEN DECIDED
------------------------------
Ant's review of this branch, 25 September 2026, corrected an earlier draft of
this file that overstated his decision. The accurate position is:

    7-year identifiable safeguarding retention     DECIDED
    post-7-year deletion vs de-identification      NOT YET DECIDED
    exact de-identification contract               NOT YET DECIDED

and, separately:

    Ordinary AI-buddy conversation: ephemeral; not persistently stored.
    Safeguarding event: the persisted record, including the conversation
    history captured with it, is retained for 7 years, after which the
    retention policy should ACTUALLY be enforced.

`scripts/data_retention.py` contains a 2555-day *anonymise-rather-than-delete*
rule. **That is current implementation behaviour, not approved policy.** It
predates the decision above, and finding 1 below is what exposed that the
anonymise-vs-delete question had never consciously been decided at all. Nothing
in this file may be read as ratifying it, and no test here asserts it as policy.

TERMINOLOGY
-----------
These tests say **de-identification**, not anonymisation, for what the routine
is trying to do. Whether a retained dataset is genuinely anonymous is a
stronger privacy claim than whether particular database fields were cleared,
and it has not been established. Where `anonymize_document`, `_anonymized` and
`[ANONYMIZED]` appear, they are the code's own identifiers quoted verbatim.

TWO FINDINGS, both pinned below.

1. The routine removes no identifying field from a safeguarding alert.
   `anonymize_document()` replaces a fixed list of field NAMES — name, email,
   phone, user_name, user_email, patient_name, patient_email, counsellor_name,
   peer_name, message, content, encrypted_* — and a SafeguardingAlert has none
   of them. Its identifying fields are `triggering_message`,
   `conversation_history`, `ai_response`, `client_ip`, `user_agent`, `geo_*`,
   `session_id` and `notes`.

   Net effect: the record is stamped `_anonymized: True` and keeps the
   veteran's verbatim crisis message, the whole conversation, their IP, ISP,
   town and coordinates. The distinction Ant asked to have preserved:

       generic de-identification mechanism
           = demonstrated to work for at least CallbackRequest
       SafeguardingAlert mapping
           = demonstrated defective
       current result
           = identifying safeguarding data survives while the record
             can be stamped _anonymized=True

2. The module cannot be imported unless `backend/logs/` exists. The logging
   config calls `logging.FileHandler(ROOT_DIR / 'logs' / 'data_retention.log')`
   at import time; the directory is not in the repository and nothing creates
   it. Both retention endpoints import the module inside the request handler,
   so on a container without that directory the call raises FileNotFoundError.

   Production observation, 25 Sept 22:27 BST, by shell inspection rather than
   by calling the endpoint: `backend/logs/` is ABSENT on the deployed
   container, so the import failure is live there. Render provisions a fresh
   filesystem per deploy and that container started at 22:08, so this
   establishes the present state, not the history of earlier containers.

Which fields should be cleared, and what artefact — if any — Radio Check should
retain after seven years, are policy decisions. Nothing here implements or
presumes one.
"""
import asyncio
import os
import sys
import types

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RETENTION_SRC = os.path.join(BACKEND, "scripts", "data_retention.py")


def _load_retention_module(tmp_path):
    """Load scripts/data_retention.py with its file log redirected.

    The redirect exists so these tests do not depend on finding 2 being fixed.
    `test_retention_module_requires_a_log_directory_that_does_not_exist` pins
    that finding separately.
    """
    logdir = tmp_path / "logs"
    logdir.mkdir(exist_ok=True)
    src = open(RETENTION_SRC).read().replace(
        "logging.FileHandler(ROOT_DIR / 'logs' / 'data_retention.log')",
        f"logging.FileHandler({str(logdir / 'data_retention.log')!r})",
    )
    module = types.ModuleType("data_retention_under_test")
    module.__file__ = RETENTION_SRC
    exec(compile(src, RETENTION_SRC, "exec"), module.__dict__)
    return module


class _FakeCollection:
    def __init__(self, sink):
        self._sink = sink

    async def update_one(self, query, update):
        self._sink.update(update["$set"])


class _FakeDB:
    def __init__(self):
        self.written = {}

    def __getitem__(self, _name):
        return _FakeCollection(self.written)


def _safeguarding_alert():
    """The shape server.py actually writes (:6861-6874, :7888-7901)."""
    return {
        "_id": "objectid",
        "id": "alert-1",
        "session_id": "tommy-1790282099473-9kzpeacc5",
        "character": "tommy",
        "triggering_message": "i've had enough, i'm going to end it tonight",
        "ai_response": "I'm worried about what you just said, mate.",
        "risk_level": "RED",
        "risk_score": 95,
        "triggered_indicators": ["explicit_suicide_plan"],
        "status": "active",
        "conversation_history": [
            {"role": "user", "content": "my marriage is over"},
            {"role": "assistant", "content": "that sounds hard, mate"},
        ],
        "client_ip": "86.8.47.29",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "geo_city": "North Shields",
        "geo_region": "England",
        "geo_country": "UK",
        "geo_isp": "Virgin Media",
        "geo_lat": 55.01,
        "geo_lon": -1.44,
        "notes": "called him, he is safe",
    }


IDENTIFYING_FIELDS = [
    "triggering_message",
    "conversation_history",
    "ai_response",
    "client_ip",
    "user_agent",
    "geo_city",
    "geo_region",
    "geo_isp",
    "geo_lat",
    "geo_lon",
    "session_id",
    "notes",
]


# --- Control: the mechanism itself works -----------------------------------

def test_control_the_routine_does_clear_a_callback_request(tmp_path):
    """CallbackRequest has name/phone/email/message — all in the list.

    This is the half of Ant's distinction that says the generic mechanism is
    demonstrated to work for at least one model. It does not establish that the
    resulting record is anonymous, only that those fields were cleared.
    """
    module = _load_retention_module(tmp_path)
    db = _FakeDB()
    callback = {
        "_id": "objectid", "id": "cb-1",
        "name": "A Veteran", "phone": "07700900000",
        "email": "someone@example.com", "message": "please ring me back",
        "request_type": "counsellor",
    }
    asyncio.run(module.anonymize_document(db, "callback_requests", callback, dry_run=False))

    for field in ("name", "phone", "email", "message"):
        assert field in db.written, f"{field} was not cleared"
    assert db.written["message"].startswith("[CONTENT REMOVED")


# --- Finding 1 --------------------------------------------------------------

def test_the_routine_currently_clears_nothing_on_a_safeguarding_alert(tmp_path):
    """Characterisation. Pinned so the gap is visible, not to bless it."""
    module = _load_retention_module(tmp_path)
    db = _FakeDB()
    asyncio.run(module.anonymize_document(
        db, "safeguarding_alerts", _safeguarding_alert(), dry_run=False))

    assert set(db.written) == {"_anonymized", "_anonymized_at"}, (
        "expected the current behaviour: only the stamp is written, and no "
        "identifying field is touched"
    )
    assert db.written["_anonymized"] is True


@pytest.mark.xfail(strict=True, reason=(
    "Retention finding 1: anonymize_document() matches field NAMES, and a "
    "SafeguardingAlert has none of them. The verbatim crisis message survives a "
    "run the stats report as successful. Which fields should be cleared — and "
    "what artefact, if any, should be retained after seven years — are Ant's "
    "decisions and are NOT YET MADE. Do not close this by extending the list."
))
@pytest.mark.parametrize("field", IDENTIFYING_FIELDS)
def test_de_identifying_a_safeguarding_alert_clears_its_identifying_fields(tmp_path, field):
    module = _load_retention_module(tmp_path)
    db = _FakeDB()
    asyncio.run(module.anonymize_document(
        db, "safeguarding_alerts", _safeguarding_alert(), dry_run=False))

    assert field in db.written, (
        f"{field} survived unchanged, yet the record is stamped _anonymized=True"
    )


def test_current_implementation_applies_a_2555_day_anonymise_rule(tmp_path):
    """CHARACTERISATION of current implementation behaviour — NOT approved policy.

    An earlier draft of this test was named
    `test_safeguarding_alerts_are_anonymised_not_deleted_after_seven_years` and
    described itself as pinning "the policy Ant confirmed". Ant's review of this
    branch corrected that: he decided the 7-year identifiable retention period
    and did NOT decide that the disposition at the end of it is anonymisation
    rather than deletion. Finding 1 is what exposed that the second question had
    never consciously been answered.

    So this test records what the code does today and nothing more. It exists so
    that a change to the period or the action surfaces for a human decision
    instead of drifting — not to ratify either value.

        post-7-year deletion vs de-identification   NOT YET DECIDED
        exact de-identification contract            NOT YET DECIDED

    If the decision is later made and differs from what is asserted here, this
    test SHOULD fail, and the correct response is to change it deliberately.
    """
    source = open(RETENTION_SRC).read()
    assert "('safeguarding_alerts', 2555, 'created_at')" in source, (
        "the 2555-day anonymise rule currently implemented for "
        "safeguarding_alerts has moved or changed — confirm against the "
        "retention decision of the day before updating this assertion"
    )
    assert "'safeguarding_alerts': 2555" in source


# --- Finding 2 --------------------------------------------------------------

@pytest.mark.xfail(strict=True, reason=(
    "Retention finding 2: the module configures a FileHandler at import time "
    "pointing at backend/logs/, which is not in the repository and is created "
    "by nothing. Both retention endpoints import it inside the request handler."
))
def test_retention_module_imports_without_a_preexisting_log_directory():
    logs_dir = os.path.join(BACKEND, "logs")
    assert os.path.isdir(logs_dir), (
        "backend/logs/ does not exist, so importing scripts/data_retention.py "
        "raises FileNotFoundError and POST /api/data-retention/run fails"
    )
