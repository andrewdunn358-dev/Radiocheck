"""
Regression test for Item 2: Live Support Requests preview must decrypt
`ENC:...` ciphertext before returning to staff.

Background:
    Previously two GET handlers were registered at /api/live-chat/rooms.
    The first (`list_live_chat_rooms`) won FastAPI route matching and did
    NOT decrypt `messages[*].text`, so staff saw raw `ENC:...` strings in
    the request preview for any room only present in the database.

    This test isolates the decryption helper and verifies the contract.
"""
import importlib
import sys
import pytest


@pytest.fixture(scope="module")
def server_module():
    # Ensure /app/backend is importable
    sys.path.insert(0, "/app/backend")
    return importlib.import_module("server")


def test_decrypt_helper_handles_encrypted_message_text(server_module):
    from encryption import encrypt_field

    plaintext = "I'm really struggling tonight, can someone talk?"
    encrypted = encrypt_field(plaintext)
    assert encrypted.startswith("ENC:"), "test precondition: value should encrypt"

    room = {
        "id": "room-test-1",
        "status": "active",
        "messages": [
            {"id": "m1", "text": encrypted, "sender": "user", "timestamp": "t"},
            {"id": "m2", "text": "plain staff reply", "sender": "staff", "timestamp": "t"},
        ],
    }

    decrypted_room = server_module._decrypt_live_chat_room_for_view(room)

    assert decrypted_room["messages"][0]["text"] == plaintext, (
        "encrypted message text must be decrypted before reaching staff UI"
    )
    assert decrypted_room["messages"][1]["text"] == "plain staff reply", (
        "plaintext messages must be left untouched"
    )
    # Original input must not be mutated
    assert room["messages"][0]["text"] == encrypted


def test_decrypt_helper_handles_encrypted_user_name(server_module):
    from encryption import encrypt_field

    plaintext = "John Doe"
    encrypted = encrypt_field(plaintext)
    assert encrypted.startswith("ENC:")

    room = {"id": "room-test-2", "status": "active", "user_name": encrypted, "messages": []}
    out = server_module._decrypt_live_chat_room_for_view(room)
    assert out["user_name"] == plaintext


def test_decrypt_helper_passthrough_when_no_encrypted_fields(server_module):
    room = {"id": "room-test-3", "status": "active", "messages": []}
    out = server_module._decrypt_live_chat_room_for_view(room)
    assert out == room


def test_first_live_chat_rooms_get_is_decrypting_handler(server_module):
    """The active GET /api/live-chat/rooms must be the decrypting handler.

    Note: a dormant `routers/live_chat.py` also registers this path against
    a different collection. FastAPI matches the FIRST registered route, so
    we assert that the active handler is the one that decrypts.
    """
    get_routes = [
        r for r in server_module._fastapi_app.routes
        if getattr(r, "path", "") == "/api/live-chat/rooms"
        and "GET" in getattr(r, "methods", set())
    ]
    assert len(get_routes) >= 1, "GET /api/live-chat/rooms must be registered"
    first = get_routes[0]
    assert first.endpoint.__name__ == "get_active_chat_rooms", (
        f"Expected first-matched handler to be `get_active_chat_rooms` "
        f"(the decrypting one); got `{first.endpoint.__name__}`"
    )
