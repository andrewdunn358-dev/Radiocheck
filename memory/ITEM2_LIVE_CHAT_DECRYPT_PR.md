# PR: Fix ciphertext leak in `GET /api/live-chat/rooms` (Item 2)

**Severity:** P0
**Safety-layer change:** No (routing/serialization only)
**PII impact:** YES — this endpoint serves veteran message content to staff. Reviewers please verify the before/after carefully.

---

## Problem

Staff opening the "Live Support Requests" list in the portal saw raw `ENC:<…>` ciphertext as the message preview for many incoming requests, instead of the veteran's actual words.

## Root cause

`server.py` registered **two handlers on the same path & method**:

| Lines | Handler | Behavior |
|---|---|---|
| 7790–7818 (deleted) | `list_live_chat_rooms` | Merged memory + DB rooms. **Never decrypted** `messages[*].text`. |
| 7992–8026 (kept, hardened) | `get_active_chat_rooms` | Read DB only with filter `status ∈ {active, waiting}`. Decrypted `messages[*].text`. |

FastAPI matches the FIRST registered route on a path collision, so `list_live_chat_rooms` won and the decrypting handler was dead code.

Writes (`POST /live-chat/rooms/{id}/messages`) correctly call `encrypt_field(text)`, so data at rest was always encrypted — this was a pure read-path serialization bug. **No data integrity impact.**

## Change

1. **Delete** `list_live_chat_rooms` (the non-decrypting handler).
2. **Harden** the surviving `get_active_chat_rooms`:
   - Restore the previous broader filter `status != "ended"` (rather than `status ∈ {active, waiting}`) so we don't lose visibility on rooms in transient states.
   - Re-introduce the memory + DB merge so newly-created rooms not yet flushed to DB still appear (memory wins because it holds the freshest message stream as plaintext).
   - Extract decryption into a small helper `_decrypt_live_chat_room_for_view` that also decrypts top-level `user_name` (declared in `ENCRYPTED_FIELDS` for `live_chat_rooms`, currently dormant but decrypted defensively).
   - Plaintext values pass through untouched (`decrypt_field` is a no-op on non-`ENC:` strings).

## Before / After

**Before (response shape for a DB-only room):**
```json
{
  "id": "abc",
  "status": "active",
  "messages": [
    { "id": "m1", "text": "ENC:gAAAAABl...==", "sender": "user", "timestamp": "…" }
  ]
}
```

**After:**
```json
{
  "id": "abc",
  "status": "active",
  "messages": [
    { "id": "m1", "text": "I'm really struggling tonight, can someone talk?", "sender": "user", "timestamp": "…" }
  ]
}
```

## Tests

New: `/app/backend/tests/test_live_chat_rooms_decryption.py`
- `test_decrypt_helper_handles_encrypted_message_text` — encrypts, then asserts decryption round-trip and that plaintext messages are left untouched.
- `test_decrypt_helper_handles_encrypted_user_name` — same for top-level `user_name`.
- `test_decrypt_helper_passthrough_when_no_encrypted_fields` — no-op on plain rooms.
- `test_first_live_chat_rooms_get_is_decrypting_handler` — regression guard: the first-matched route resolves to `get_active_chat_rooms`. (Note: a dormant `routers/live_chat.py` also registers this path against a different collection; left untouched as out of scope.)

`pytest tests/test_live_chat_rooms_decryption.py` → **4 passed**.

## Out of scope (per session contract)

- No changes to `ENCRYPTION_KEY` handling.
- No changes to `safeguarding_alerts` / `audit_logs` encryption.
- The dormant duplicate router `/app/backend/routers/live_chat.py` (which operates on a different `chat_rooms` collection) is left untouched. It is shadowed by `api_router` for the colliding path; recommend separate triage in a later PR.
