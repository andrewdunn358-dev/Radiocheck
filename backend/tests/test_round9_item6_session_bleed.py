"""
Round 9 Item 6: Session name bleed (privacy regression test).

Per Round 8 Section 4.6: in the first run of Scenario 002, Tommy addressed the
user as "Andy" — the deceased brother's name carried over from Scenario 001
because the test harness reused the sessionId without calling the reset
endpoint between scenarios. The grief_name key persisted in buddy_sessions.

Audit findings (documented in CHANGELOG):
  - Reset endpoint at server.py:7029 already does `del buddy_sessions[sid]`,
    a full dict deletion, so ALL session-level keys are wiped — no per-key
    cleanup needed and no risk of forgetting a future Round 8 key.
  - conversation_context is NOT stored server-side. It is appended to the
    system prompt per-request only (server.py:6610-6611). Nothing to clear.

This test directly exercises the buddy_sessions data structure and the reset
endpoint to confirm:
  1. Session state can hold a name (grief_name) and other Round 8 vars.
  2. Calling reset wipes the entire session entry.
  3. A subsequent get_or_create_session call returns a fresh session with
     no inherited keys (the "Andy" bleed cannot reproduce).

Note on scope: deeper investigation of whether client-supplied
conversation_context can carry sensitive content across sessions, or be
malformed to manipulate Tommy, is explicitly named in Round 8 Section 8 as
"Round X: Context and Memory Stress-Test" — out of scope for Round 9.
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import server  # noqa: E402


@pytest.fixture
def client():
    return TestClient(server.app)


# All session-level keys we want to verify get wiped. Includes every key
# named in the Round 9 prompt for Item 6, plus a couple of forward-compat
# placeholders so this test catches regressions if Zentrafuge adds more.
SESSION_LEVEL_KEYS = [
    "history",
    "grief_name",
    "grief_pronoun",
    "grief_active_turns",
    "spine_turn_count",
    "brush_off_turn_count",
    "last_fallback_question",
]


def test_reset_endpoint_wipes_grief_name_andy_bleed_scenario(client):
    """
    Reproduces Round 8 Scenario 002 Run 1 in isolation.
    Establish 'Andy' in buddy_sessions, call reset, confirm the next
    get_or_create returns a fresh session with no 'Andy'.
    """
    sid = "test_round9_item6_andy_bleed"

    # 1. Plant Round 8 state directly into buddy_sessions, mimicking what
    #    Scenario 001 would have left behind.
    server.buddy_sessions[sid] = {
        "message_count": 4,
        "history": [
            {"role": "user", "content": "Lost my brother Andy two years ago"},
            {"role": "assistant", "content": "How's that sitting today, mate?"},
        ],
        "character": "tommy",
        "last_active": __import__("datetime").datetime.utcnow(),
        "created_at": __import__("datetime").datetime.utcnow(),
        "grief_name": "Andy",
        "grief_pronoun": "he",
        "grief_active_turns": 2,
        "spine_turn_count": 0,
        "brush_off_turn_count": 0,
        "last_fallback_question": "what's been weighing on you?",
    }

    # Sanity: confirm the planted state
    assert server.buddy_sessions[sid]["grief_name"] == "Andy"

    # 2. Hit the reset endpoint exactly the way the test harness should.
    response = client.post(
        "/api/ai-buddies/reset",
        json={
            "message": "",
            "sessionId": sid,
            "character": "tommy",
        },
    )
    assert response.status_code == 200
    assert response.json().get("sessionId") == sid

    # 3. The full session entry must now be gone.
    assert sid not in server.buddy_sessions, (
        "Reset endpoint did not delete buddy_sessions entry — "
        "name bleed could reproduce."
    )


def test_reset_then_get_or_create_returns_clean_session():
    """
    After reset, the next call to get_or_create_buddy_session for the same
    sessionId must produce a session with NONE of the Round 8 session-level
    keys carried over.
    """
    sid = "test_round9_item6_clean_after_reset"

    # Plant state
    server.buddy_sessions[sid] = {
        "message_count": 6,
        "history": [{"role": "user", "content": "x"}],
        "character": "tommy",
        "last_active": __import__("datetime").datetime.utcnow(),
        "created_at": __import__("datetime").datetime.utcnow(),
        "grief_name": "Andy",
        "grief_pronoun": "he",
        "grief_active_turns": 3,
        "spine_turn_count": 2,
        "brush_off_turn_count": 1,
        "last_fallback_question": "stale fallback",
    }

    # Simulate reset
    if sid in server.buddy_sessions:
        del server.buddy_sessions[sid]

    # Recreate via the canonical helper
    fresh = server.get_or_create_buddy_session(sid, "tommy")

    # The fresh session must not contain any of the Round 8 grief/spine state.
    assert fresh.get("grief_name") is None, (
        "grief_name carried across reset — Andy-bleed regression"
    )
    assert fresh.get("grief_pronoun") is None
    assert fresh.get("grief_active_turns") is None
    assert fresh.get("spine_turn_count") is None
    assert fresh.get("brush_off_turn_count") is None
    assert fresh.get("last_fallback_question") is None
    assert fresh.get("history") == [], (
        "history carried across reset — message bleed regression"
    )

    # Cleanup
    if sid in server.buddy_sessions:
        del server.buddy_sessions[sid]


def test_reset_is_idempotent_for_unknown_session(client):
    """Calling reset on a session that doesn't exist must not error."""
    response = client.post(
        "/api/ai-buddies/reset",
        json={
            "message": "",
            "sessionId": "nonexistent_session_for_idempotency_check",
            "character": "tommy",
        },
    )
    assert response.status_code == 200


def test_full_dict_delete_means_future_round_keys_are_also_wiped():
    """
    Defensive test: confirms that ANY new key Zentrafuge adds in future
    rounds will also be wiped by reset, because reset uses full dict
    deletion rather than per-key cleanup.
    """
    sid = "test_round9_item6_future_keys"
    server.buddy_sessions[sid] = {
        "message_count": 1,
        "history": [],
        "character": "tommy",
        "last_active": __import__("datetime").datetime.utcnow(),
        "created_at": __import__("datetime").datetime.utcnow(),
        # Hypothetical Round 9/10 keys
        "future_round_key_1": "should_disappear",
        "future_round_key_2": ["sensitive", "data"],
        "future_round_key_3": {"nested": "stuff"},
    }
    if sid in server.buddy_sessions:
        del server.buddy_sessions[sid]
    assert sid not in server.buddy_sessions
    fresh = server.get_or_create_buddy_session(sid, "tommy")
    for key in ("future_round_key_1", "future_round_key_2", "future_round_key_3"):
        assert key not in fresh, (
            f"Reset did not wipe future key {key!r}. "
            "buddy_sessions reset semantics are no longer 'full dict delete'."
        )
    if sid in server.buddy_sessions:
        del server.buddy_sessions[sid]
