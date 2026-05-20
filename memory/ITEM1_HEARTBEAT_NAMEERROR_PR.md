# PR: Fix heartbeat NameError; relocate broadcast block to update_status (Item 1)

**Severity:** P1
**Safety-layer change:** YES (safety-adjacent — NOT self-cleared)
**CODEOWNERS review required:** `@TheAIOldtimer`

---

## Problem

The Socket.IO `heartbeat()` handler in `backend/webrtc_signaling.py` contained a trailing block that referenced two variables (`new_status`, `user_type`) that **don't exist in that handler's scope**. Every heartbeat from a connected client therefore raised `NameError`, producing log spam and — critically — silently breaking the staff status broadcast and DB persistence that the orphaned block was meant to perform.

Concurrently, the `update_status()` handler — where those variables *are* defined — only mutated in-memory state. It never broadcast `staff_status_changed` and never called `update_staff_status_in_db()`. The peer-staff view and admin dashboard therefore did not reflect live availability changes, and DB rows for counsellors / peer_supporters fell out of sync with their in-memory status.

## Root cause

A previous refactor accidentally left the broadcast + DB-persist block at the tail of `heartbeat()` instead of `update_status()`.

## Change

**Single change** — relocate the orphaned block from `heartbeat()` (which now ends after `heartbeat_ack`) into the body of `update_status()`, immediately after the existing in-memory mutation. **No new logic, no condition changes, no envelope changes.**

```diff
 async def update_status(sid, data):
     if sid in connected_users:
         new_status = data.get('status', 'available')
         old_status = connected_users[sid].get('status')
         user_id = connected_users[sid].get('user_id')
         user_type = connected_users[sid].get('user_type')

         connected_users[sid]['status'] = new_status
         logger.info(f"Status updated for {sid}: {old_status} -> {new_status}")
+
+        await sio.emit('staff_status_changed', {
+            'user_id': user_id,
+            'status': new_status
+        })
+
+        if user_type in ['counsellor', 'peer']:
+            await update_staff_status_in_db(user_id, user_type, new_status)


 async def heartbeat(sid, data):
     if sid in connected_users:
         user_id = data.get('user_id')
         connected_users[sid]['last_heartbeat'] = datetime.utcnow().isoformat()
         connected_users[sid]['last_activity'] = datetime.utcnow().isoformat()
         await sio.emit('heartbeat_ack', {...}, to=sid)
-
-        await sio.emit('staff_status_changed', {
-            'user_id': user_id,
-            'status': new_status        # NameError
-        })
-        if user_type in ['counsellor', 'peer']:   # NameError
-            await update_staff_status_in_db(user_id, user_type, new_status)
```

## Why this is safety-adjacent

The `status` field of a connected staff socket is the gating predicate inside `request_human_chat` (L1009–1045) and `request_human_call` (L1112–1138). When the broadcast and DB persistence were broken:

- Peer staff & admin dashboards displayed stale availability, so triagers couldn't see who was free.
- The in-memory state drifted from DB state, meaning REST consumers (e.g. routing logic that re-reads `counsellors.status` from DB) could route a crisis chat/call to a counsellor who had actually marked themselves `unavailable`.

This change does NOT modify the safeguarding logic itself — only restores the broadcast/persist contract that was always intended. **Flagged for `@TheAIOldtimer` review per CODEOWNERS rule for safety-adjacent paths. Not self-cleared.**

## Tests

New: `/app/backend/tests/test_webrtc_status_handlers.py`

- `test_heartbeat_does_not_raise_nameerror` — registers a fake socket, dispatches `heartbeat`, asserts (a) exactly one `heartbeat_ack`, (b) no `staff_status_changed` emitted from `heartbeat` (it belongs to `update_status` now), (c) no exception.
- `test_update_status_broadcasts_and_persists_for_counsellor` — fake socket of type `counsellor` → dispatch `update_status({"status": "limited"})` → assert broadcast payload `{user_id, status: "limited"}` and one DB persist call `(c-1, counsellor, limited)`.
- `test_update_status_does_not_persist_for_app_user` — same flow for `user_type='user'` → assert DB persist NOT invoked.

Run:
```
$ pytest tests/test_webrtc_status_handlers.py tests/test_live_chat_rooms_decryption.py tests/test_round9_items3_4_5_signals_judge.py
16 passed
```

## Out of scope (per session contract)

- The mobile WebRTC "ICE gathering" hang (Issue 2 — BLOCKED on mobile console logs).
- Frontend WebRTC error-swallowing (`SafeguardingCallModal.tsx` / `useWebRTCPhone.tsx` missing `webrtc_error` listeners).
- Encryption remediation (ENCRYPTION_KEY, safeguarding_alerts, audit_logs).
- AI Learning UI remnants on portal/staff-portal.
