# Phase B³ Investigation — Answers for Anthony

> **Method.** Read-only grep + trace against `main` after PR #8 merge. No code changes, no commits, no fix proposals. Q2 was deliberately re-grepped from scratch rather than relying on session memory; findings match the prior session map (no drift).

## Q1 — Frontend overlay trigger

- **Field/event name driving overlay:** `data.safeguardingTriggered` (boolean field on the chat response payload)
- **Consumer (component file path + approx line):**
  - `frontend/app/unified-chat.tsx:529` — `if (data.safeguardingTriggered) { setCurrentAlertId(alertId); setShowSafeguardingModal(true); }`
  - `frontend/app/chat/[characterId].tsx:548` — same shape, mirror copy
  - The modal itself is `SafeguardingCallModal` (`frontend/src/components/SafeguardingCallModal.tsx`), rendered with `visible={showSafeguardingModal}` at `unified-chat.tsx:851` / `[characterId].tsx:934` / `unified-chat.tsx:1044` / `[characterId].tsx:1145`
- **Emitter (API/socket handler file path + approx line):**
  - `backend/server.py:7028` — `safeguardingTriggered=(risk_level == "RED")` inside the normal `BuddyChatResponse` return at the end of `buddy_chat()`
  - `backend/server.py:6530` — `safeguardingTriggered=True` inside the early-return block when `failsafe_should_fire` is True (the hard-failsafe path)
  - `backend/server.py:961` — `BuddyChatResponse.safeguardingTriggered: bool = False` (Pydantic model definition)
  - **No Socket.IO involvement.** Grep for `sio.emit.*safeguarding` / `sio.emit.*overlay` returns nothing — the overlay is driven entirely by the HTTP response payload of `POST /api/ai-buddies/chat`.
- **Data type:** boolean
- **Trace summary (≤5 lines):**
  1. Frontend POSTs to `/api/ai-buddies/chat` and reads `data.safeguardingTriggered` from the JSON response.
  2. Backend computes a local `risk_level` variable inside `buddy_chat()`. The boolean exposed to the frontend is purely `risk_level == "RED"` at line 7028 (or hard-coded `True` on the failsafe early-return at line 6530).
  3. There is **one** input to `safeguardingTriggered`: the local `risk_level` variable. There is no Socket.IO channel, no separate WebSocket event, and no reading of `final_verdict` directly into the response.
  4. Therefore, anything that mutates `risk_level` between line 6320 (initial assignment from `check_safeguarding`) and line 7028 (final return) determines whether the overlay shows.

---

## Q2 — `unified_safety`'s independent verdict

- **Producing function (file path + function name):** `backend/safety/unified_safety.py` → `analyze_message_unified()`
- **Inputs that function reads:**
  1. `assess_message_safety(message)` — keyword/regex layer (`safety/safety_monitor.py`), produces `keyword_result` (`unified_safety.py:119`)
  2. `full_semantic_analysis(message)` — embedding-similarity layer (`safety/semantic_model.py`), produces `semantic_result` (`unified_safety.py:133`)
  3. `analyze_message_with_context(...)` — conversation-trajectory layer (`safety/conversation_monitor.py`), produces `conversation_result` (`unified_safety.py:140`)
  4. `classify_message_with_ai(...)` — AI classifier layer (`safety/ai_safety_classifier.py`), produces `ai_result` (`unified_safety.py:187`). UPGRADE-only: blends in only when `ai_score > weighted_score` and confidence ≥ 0.6 (`unified_safety.py:242–246`).
  5. None of the above is the `FinalVerdict` from `safety/verdict_reconciler.reconcile_verdicts()`. The reconciler runs **after** `analyze_message_unified()` returns and is never read back inside this function.
- **Whether the reconciler's `failsafe=false` is consumed at all (yes / no / partially):** **No.** Not by `analyze_message_unified()`, and not by the local `risk_level` upgrade path that ultimately drives `safeguardingTriggered`. `failsafe_should_fire` (the local that *does* read from `final_verdict`) gates only the hard-failsafe early-return block (`server.py:6447`) and the Phase B² alert-write gate (`server.py:6932`). It does **not** gate the `unified_risk` upgrade block at `server.py:6555–6580`, which reads the **raw** `unified_safety["risk_level"]` and mutates the local `risk_level` variable that feeds the response payload.
- **If no: where is the reconciler's verdict expected to flow into `unified_safety`, and where is the connection broken?**
  - Wiring as it stands: `unified_safety` is passed INTO the reconciler (`server.py:6370`, `extract_verdicts_from_unified(unified_safety)`). The reconciler returns a `FinalVerdict` dataclass to a separate local (`final_verdict`). The dict `unified_safety` is never re-read from the reconciler and is never mutated post-reconciliation.
  - The connection break has two faces:
    1. **In `buddy_chat()` (server.py:6555–6580):** the `unified_risk` upgrade block reads `unified_safety.get("risk_level", "NONE")` (the pre-reconciler raw verdict) and unconditionally upgrades `risk_level` to RED on `unified_risk == "IMMINENT"`. There is no `if not failsafe_should_fire` (or similar reconciler-aware) guard around this block — it is the structural twin of the legacy alert-write block that Phase B² gated, but on the user-facing-overlay side rather than the alert-DB side.
    2. **In `unified_safety.py:288–300`:** `final_risk_level` is assigned `IMMINENT` whenever the function's *internal* `failsafe_triggered` is True (line 288), independent of whether the reconciler will later override that. So even the producer-side dict carries the unreconciled verdict.
- **Trace summary (≤10 lines):**
  1. `analyze_message_unified()` (unified_safety.py:113–411) computes its own `failsafe_triggered` from 5 independent checks (lines 255–282): critical keyword, conversation IMMINENT, high semantic similarity, rapid-escalation-with-method, INTENT_ESCALATION pattern.
  2. `final_risk_level` is set to `"IMMINENT"` if any of those 5 fire (line 288–290), regardless of context.
  3. The function returns the dict containing `"risk_level": final_risk_level` and `"risk_score": final_score` at line 354–356.
  4. Back in `buddy_chat()`, the reconciler is then called on the unified dict (`server.py:6371`). It returns `final_verdict` to a separate local. `unified_safety` is unchanged.
  5. The "UNIFIED SAFETY - … - ReconcilerRule: …" log line at server.py:6381–6390 concatenates `unified_safety.get('risk_level')` (raw) and `final_verdict.precedence_rule_fired` (reconciled) into one string. That is the apparent self-contradiction Anthony observed in production — two independent computations printed together, neither one consuming the other.
  6. The risk-level upgrade block at lines 6555–6580 (`elif unified_risk == "IMMINENT" and risk_level != "RED": risk_level = "RED"`) reads the raw value from step 1–3, with no reconciler awareness.
  7. `safeguardingTriggered=(risk_level == "RED")` at line 7028 then surfaces this raw verdict to the frontend.
  8. Result: when a CONTEXT_OVERRIDE fires, the alert DB record is correctly suppressed to `audit_only` (Phase B² gate working), but the chat response payload still reports `safeguardingTriggered=True` because the upgrade block ran on the raw `unified_safety["risk_level"]`. The user sees the crisis overlay; the staff queue stays clean.

---

## Q3 — `conversation_monitor` routing

- **Source of `SAFETY INTERVENTION REQUIRED` log (file path + function):** `backend/safety/conversation_monitor.py:894` inside `_log_safety_assessment(state, message, result)` (the helper called from `analyze_message_with_context()` at the end of every per-message analysis).
- **All downstream effects (list each — DB write, response payload field, socket emit, queue push, log-only, etc., with file paths):**
  1. **`logger.warning(...)`** (`conversation_monitor.py:894–899`) — Python logging only. Goes to stdout/stderr/log file via the standard logging handler. No transport to client.
  2. **`safety_audit_log.append(audit_entry)`** (`conversation_monitor.py:886`) — appends to an in-memory list capped at 10,000 entries (lines 889–890). The list is module-level and dies with the process.
  3. The `safety_audit_log` list has only one read consumer in this module: `get_audit_log()` at `conversation_monitor.py:999`. That function is **not imported anywhere** (`grep -rn "from .conversation_monitor import.*get_audit_log\|from safety.conversation_monitor import.*get_audit_log"` returns nothing). It is unreachable from the API surface as wired today.
  4. There is a separate `safety_audit_log` (and `get_safety_audit_log` / `export_safety_audit_log` helpers) in `backend/enhanced_safety_layer.py:288, 802, 806`. Those helpers ARE imported in `server.py:50–51` but **never called** in `server.py` (`grep -n "get_safety_audit_log\|export_safety_audit_log" server.py` shows imports only, no call sites). So even that audit log is currently un-surfaced.
  5. **No DB write.** Grep `db\..*\.insert.*requires_intervention` / `db\..*\.insert.*audit_log` returns nothing.
  6. **No socket emit.** Grep `sio.emit.*intervention` / `sio.emit.*audit` returns nothing.
  7. **No response-payload field directly named after this log.** `requires_intervention` does propagate from `conversation_result` into `unified_safety["requires_intervention"]` at unified_safety.py:305–309 and 383, but: (a) that field is never read by `buddy_chat()` (grep `unified_safety.*requires_intervention` returns nothing in server.py), and (b) it's a recomputation, not the same field — it ORs `final_risk_level in ["HIGH", "IMMINENT"]` with `failsafe_triggered` and `is_escalating`.
  8. **Indirect effect** that *does* surface: `conversation_result["conversation_risk_level"]` (separate field, set in the same function as the log) flows into unified_safety's failsafe trigger at `unified_safety.py:264–266` (`if conversation_result.get("conversation_risk_level") == "IMMINENT": failsafe_triggered = True`). That `failsafe_triggered` then drives `final_risk_level == "IMMINENT"` (line 288–290), which drives the `unified_risk` upgrade in `buddy_chat()` at line 6555, which drives `risk_level = "RED"`, which drives `safeguardingTriggered = True`. So the conversation_monitor's verdict reaches the user via unified_safety, but **not via the `[SAFETY INTERVENTION REQUIRED]` log line itself** — that log is a side-effect-free observability hook on the same state.
- **Does any effect surface to the user-facing view? (yes / no, with one-line explanation):** **No, the log line itself is observability-only.** But the underlying state it announces (conversation_monitor's `conversation_risk_level == "IMMINENT"`) reaches the user-facing overlay indirectly via unified_safety's failsafe-trigger pathway described above. Killing the log would not change user-facing behaviour; killing or gating the underlying conversation_monitor verdict would.

---

## Architectural shape — synthesis (≤10 lines)

There are **three independent verdict producers** in the safety pipeline:

1. **`unified_safety` dict** — pre-reconciler, computed by `analyze_message_unified()` from keyword + semantic + conversation_monitor + AI classifier layers. Produces its own `risk_level` and `failsafe_triggered`.
2. **`conversation_monitor`** — one of the layers fed into `unified_safety`, but also emits its own `requires_intervention` flag (the `[SAFETY INTERVENTION REQUIRED]` log line) and its own `conversation_risk_level` which feeds back into unified_safety's failsafe checks.
3. **`reconciler` (`final_verdict`)** — runs *after* `unified_safety` has already produced its verdict, takes that verdict + the AI classifier's verdict as INPUT, and returns a `FinalVerdict` dataclass to a *separate* local.

Currently authoritative for the user-facing overlay: **`unified_safety`'s raw `risk_level`**, propagated through the `unified_risk` upgrade block at `server.py:6555–6580` to the local `risk_level`, then to `safeguardingTriggered=(risk_level == "RED")` at `server.py:7028`. The reconciler's verdict is authoritative ONLY for (a) the hard-failsafe early-return block, and (b) the Phase B² alert-write gate. The user-facing overlay path bypasses the reconciler entirely.

Where the reconciler's verdict would need to be wired to make the overlay consistent with the alert gate: the `unified_risk` upgrade block at `server.py:6555–6580` is the analogue, on the response-payload side, of the alert-write block that Phase B² gated. A reconciler-aware guard at the same architectural position would close the symmetry. (Per brief: not proposing a fix — flagging the location only.)

---

## Open questions / uncertainty

1. **Brief framing nuance.** The brief describes the production log line `UNIFIED SAFETY - Risk: IMMINENT, Score: 95, ReconcilerRule: CONTEXT_OVERRIDE` as "internally self-contradictory… `unified_safety` is *aware* of the reconciler's rule, then reports `Risk: IMMINENT`… regardless." From the code, `unified_safety` is **not** aware of the reconciler — the log line at `server.py:6381–6390` is composed inside `buddy_chat()` (not inside `unified_safety`) and concatenates two independent sources: the unified dict's raw `risk_level` and `final_verdict.precedence_rule_fired`. So `unified_safety` itself never sees the reconciler. The log line is the only place the two appear together. This is a difference of framing rather than substance — Anthony's underlying conclusion (split authority, unaudited consumer) is correct, but the unawareness is structural rather than the producer ignoring a value it received. Flagging per the brief's "don't silently correct" rule.
2. **Two `safety_audit_log` instances exist** — one in `backend/enhanced_safety_layer.py:288`, one in `backend/safety/conversation_monitor.py:218`. Different module-level lists, both named the same. The conversation_monitor one feeds the `[SAFETY INTERVENTION REQUIRED]` log; the enhanced_safety_layer one is what gets imported into `server.py` at lines 50–51 (but never called). Worth noting because future reads of the audit log need to know which one they're reading.
3. **Failsafe early-return at `server.py:6530`** sends `safeguardingTriggered=True` directly. This is reconciler-gated correctly via `failsafe_should_fire` (line 6447) — i.e. when the reconciler fires CONTEXT_OVERRIDE, that branch does NOT execute. So the user-facing overlay leak documented in Q1/Q2 is specifically via the *non-failsafe* upgrade path at lines 6555–6580, not via the failsafe block. Anthony's prod log is consistent with this: the overlay fired despite the alert being audit_only, which means the failsafe block was correctly skipped and the upgrade block correctly leaked.
4. **Out-of-scope observation, not actioned, flagged per brief §5:** the AI classifier's `risk_level` (`unified_safety["ai_classification"]["risk_level"]`) is read on the audit_only mapping path (`server.py:6956`, Phase B²) but is NOT read by the `unified_risk` upgrade block at lines 6555–6580. So the overlay path is also blind to the classifier's verdict, not just the reconciler's. Whether this matters is a Phase B³ scoping question, not an investigation answer.
