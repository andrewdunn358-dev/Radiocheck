"""
Regression test for Item 1: heartbeat NameError fix.

Background:
    The Socket.IO `heartbeat` handler historically contained a trailing block
    that referenced `new_status` and `user_type`, neither of which existed in
    that scope. Every heartbeat from a connected client raised NameError,
    silently breaking the staff status broadcast that the block was meant to
    perform.

    Fix: relocate the broadcast + DB-persist block to `update_status`, where
    the variables are actually defined. No logic change otherwise.

These tests use the real `sio.handlers` registry (no monkeypatching of socketio
internals).
"""
import asyncio
import importlib
import sys
import pytest


@pytest.fixture(scope="module")
def webrtc():
    sys.path.insert(0, "/app/backend")
    mod = importlib.import_module("webrtc_signaling")
    return mod


def _get_handler(webrtc, event_name):
    """Resolve the registered Socket.IO handler for an event.

    AsyncServer stores handlers under the default namespace '/'.
    """
    handlers = webrtc.sio.handlers.get('/', {})
    assert event_name in handlers, f"handler `{event_name}` not registered"
    return handlers[event_name]


def test_heartbeat_does_not_raise_nameerror(webrtc, monkeypatch):
    """Heartbeat for a registered user must NOT raise NameError."""
    test_sid = "test-sid-heartbeat-1"
    webrtc.connected_users[test_sid] = {
        "user_id": "u-heartbeat",
        "user_type": "user",
        "name": "Test User",
        "status": "available",
    }
    emitted = []

    async def fake_emit(event, payload=None, to=None, room=None, **kw):
        emitted.append((event, payload, to))

    monkeypatch.setattr(webrtc.sio, "emit", fake_emit)

    handler = _get_handler(webrtc, "heartbeat")
    try:
        asyncio.get_event_loop().run_until_complete(
            handler(test_sid, {"user_id": "u-heartbeat"})
        )
    finally:
        webrtc.connected_users.pop(test_sid, None)

    # Should ack the heartbeat and NOT crash.
    ack_events = [e for e in emitted if e[0] == "heartbeat_ack"]
    assert len(ack_events) == 1, f"expected exactly one heartbeat_ack, got {emitted}"
    # And it must NOT have emitted staff_status_changed (that belongs to update_status now).
    status_events = [e for e in emitted if e[0] == "staff_status_changed"]
    assert status_events == [], (
        f"heartbeat should no longer emit staff_status_changed; got {status_events}"
    )


def test_update_status_broadcasts_and_persists_for_counsellor(webrtc, monkeypatch):
    """update_status should: mutate in-memory status, broadcast change, and persist for staff."""
    test_sid = "test-sid-update-1"
    webrtc.connected_users[test_sid] = {
        "user_id": "c-1",
        "user_type": "counsellor",
        "name": "Test Counsellor",
        "status": "available",
    }
    emitted = []
    persisted = []

    async def fake_emit(event, payload=None, to=None, room=None, **kw):
        emitted.append((event, payload, to))

    async def fake_persist(user_id, user_type, status):
        persisted.append((user_id, user_type, status))

    monkeypatch.setattr(webrtc.sio, "emit", fake_emit)
    monkeypatch.setattr(webrtc, "update_staff_status_in_db", fake_persist)

    handler = _get_handler(webrtc, "update_status")
    try:
        asyncio.get_event_loop().run_until_complete(
            handler(test_sid, {"status": "limited"})
        )
    finally:
        webrtc.connected_users.pop(test_sid, None)

    # In-memory mutation already happened; we popped, so check via captured emit.
    status_events = [e for e in emitted if e[0] == "staff_status_changed"]
    assert len(status_events) == 1, f"expected one broadcast, got {emitted}"
    assert status_events[0][1] == {"user_id": "c-1", "status": "limited"}
    assert persisted == [("c-1", "counsellor", "limited")], (
        f"expected DB persist for counsellor; got {persisted}"
    )


def test_update_status_does_not_persist_for_app_user(webrtc, monkeypatch):
    """App users (user_type='user') should still broadcast but not hit the DB."""
    test_sid = "test-sid-update-2"
    webrtc.connected_users[test_sid] = {
        "user_id": "u-1",
        "user_type": "user",
        "name": "Test User",
        "status": "available",
    }
    persisted = []

    async def fake_emit(event, payload=None, to=None, room=None, **kw):
        pass

    async def fake_persist(user_id, user_type, status):
        persisted.append((user_id, user_type, status))

    monkeypatch.setattr(webrtc.sio, "emit", fake_emit)
    monkeypatch.setattr(webrtc, "update_staff_status_in_db", fake_persist)

    handler = _get_handler(webrtc, "update_status")
    try:
        asyncio.get_event_loop().run_until_complete(
            handler(test_sid, {"status": "limited"})
        )
    finally:
        webrtc.connected_users.pop(test_sid, None)

    assert persisted == [], f"app users must not be persisted to staff tables; got {persisted}"
