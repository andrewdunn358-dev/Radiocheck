# Phase C — Deterministic Protocol Gates (Checks B/C/D) — IMPLEMENTATION

**Type:** Implementation PR. Design pre-approved by Ant — see `memory/PHASE_C_PR_DRAFT.md`.
**Reviewers required (CODEOWNERS):** Ant (`@TheAIOldtimer`) + Andrew — touches `/backend/safety/` and `/backend/personas/soul_loader.py`.
**Status:** Draft for Ant's review. Not ready-to-merge until Ant signs off the code.

---

## What this PR does

Implements the deterministic post-generation gate for Round 9 Checks B (brush-off), C (identity), D (attachment), exactly as approved in the design draft. The gate runs in `server.buddy_chat` AFTER the persona reply and BEFORE the existing LLM judge. The LLM judge stays in place as the second, softer line.

Ant's review notes from the design sign-off are all incorporated (details below).

---

## Files changed (4)

| File | Change | Lines |
|------|--------|-------|
| `backend/safety/protocol_gates.py` | NEW — the gate module | +~430 |
| `backend/personas/soul_loader.py` | Import constants + append canonical phrase reference block (additive only) | +~50 |
| `backend/server.py` | Wire gate into `buddy_chat` before the LLM judge | +105 / -0 |
| `backend/tests/test_round10_phase_c_gates.py` | NEW — 21 tests | +~430 |

No other files touched. No deletions anywhere except none — every change is additive.

---

## Ant's review notes — how each was handled

1. **"i'm here mate" (brush-off) and "i'm here for you" (attachment) need close attention.**
   - Both phrases are in their respective fail lists. Both are covered by dedicated tests proving the redemption/ordering logic rescues the legitimate use:
     - `test_brush_off_pass_hold_redeems_im_here_mate` — "I'm here mate" PASSES when a warm-hold phrase ("didn't sound like nothing") is also present.
     - `test_attachment_im_here_for_you_before_redirect_fails` — "I'm here for you" FAILS before a redirect, PASSES after one.

2. **"data protection" dual-membership needs a comment so it doesn't look like a copy-paste error.**
   - Added an explicit `NOTE (per Ant's review)` comment on both `IDENTITY_PRIVACY_REGISTER` and `IDENTITY_PRIVACY_USER_TRIGGERS` explaining the intentional dual-membership (user-side = privacy trigger → legitimate; assistant-side unprompted = fail register).
   - Pinned by `test_identity_data_protection_dual_membership`, which asserts membership in both sets and tests both directions.

3. **Check D character-position ordering — confirmed fine.**
   - Implemented as character-position comparison (`_first_position`). Validation position `<` redirect position = FAIL.

4. **Check E — B/C/D only this PR.** No Check E code. Noted in the module docstring as deferred to Phase E.

5. **Check A deferral — agreed.** No Check A code. Noted in module docstring (needs semantic comparison, not phrase matching).

6. **20 tests, keep them all incl. the audit-log assertion.** 21 tests shipped (the 20 planned + one hint-mapping sanity test). Audit-log assertion present and verifies PII-safety (raw reply text never logged, sha256 prefix only).

7. **SHA-256 of reply — confirmed.** `emit_gate_audit_log` records `reply_sha256_16` (first 16 hex of sha256) + `reply_length`, never the raw reply. `matched_phrase` IS logged because it is a fixed string from our own canonical list, not free text.

---

## One implementation decision that deviates (conservatively) from the draft — needs Ant's nod

The design draft said soul_loader.py would "import these constants and format them into the system prompt at module load time," with "the wording around the lists stays human-written; only the lists themselves come from Python."

When I went to implement it, the current `ROUND7_JUDGE_PROMPT` does **not** contain clean bulleted lists — the Round 9 phrases live as parenthetical examples woven into prose (lines ~250–306). Restructuring that validated prose into interpolated lists would have changed the prompt text the persona model sees, on a file explicitly marked "DO NOT MODIFY without Zentrafuge sign-off."

So I took the **more conservative** path:

- The entire existing `ROUND7_JUDGE_PROMPT` prose is **byte-for-byte unchanged**.
- I import the constants and **append** one clearly-labelled `=== CANONICAL PHRASE REFERENCE ===` block built from them, after the existing `=== END BEHAVIOURAL CONTROL LAYER ===` marker.
- Net effect: single source of truth is achieved (the gate and the appended reference both read the same Python constants), no existing validated instruction is reworded, and the only change to what the model sees is an *added* explicit reference section.

This is additive rather than a restructure. If you'd prefer the fuller interpolation (replacing the prose examples with the constant-driven lists), say so and I'll do it — but I didn't want to silently reword validated safeguarding prompt text. Flagging for your call.

---

## How the gate integrates (server.py)

At the existing judge hook in `buddy_chat` (right where `primary_protocol` is finalised, before the LLM `judge_prompt`):

```
reply generated by persona LLM
        │
        ▼
run_protocol_gates(primary_protocol, reply, user_message)   ← NEW deterministic gate
emit_gate_audit_log(...)                                     ← evt: round10.protocol_gate
        │
   gate FAIL? ──yes──▶ conditioned regenerate (max 2, re-check gate each time)
        │                   │
        │              still failing after 2 ──▶ SAME micro-fallback path the
        │                                         LLM judge already uses
        │                                         (is_high_risk → spine entry;
        │                                          else generate_micro_fallback;
        │                                          banter post-filter; safe default)
        ▼
   gate PASS (or protocol outside B/C/D)
        │
        ▼
existing LLM judge runs unchanged   ← second, softer line of defence (lines ~6875+)
```

The gate's regenerate + fallback mechanics deliberately reuse the exact same helpers the LLM judge uses (`generate_micro_fallback`, `contains_banter_or_humour`, `is_high_risk`, `session['last_fallback_question']`), so there's one fallback behaviour, not two.

---

## Test results

```
backend/tests/test_round10_phase_c_gates.py ......... 21 passed
```

- 4 brush-off, 4 identity, 4 attachment, 2 orchestrator, 2 regenerate-loop, 1 audit-log, 3 Zentrafuge regression (S004/S005/S008), 1 hint-mapping sanity.
- Phase B reconciler pure-logic tests: 19 passed (the 8 that "fail" in the sandbox are MongoDB-connection integration tests — no DB in the sandbox; they pass against a real instance, and are unrelated to this change).

### Note on the regenerate-loop tests

The two regenerate-loop tests (`test_gate_fail_then_regenerate_passes`, `test_gate_fail_twice_falls_back`) exercise the gate decision logic against a fake OpenAI client, replicating the server loop body. They do **not** spin up the full FastAPI app + DB. This matches how this codebase already tests `buddy_chat` — the existing buddy-chat tests (`test_safeguarding.py`, `zentrafuge_test_suite.py`) hit a live running server over HTTP rather than mocking in-process. Phase D's end-to-end harness (separate PR) is the right home for full-stack `/api/ai-buddies/chat` assertions against a live instance, per the integrity report.

**Ask for Ant:** are the in-process regenerate-loop tests sufficient for this PR, or do you want a live-server end-to-end test added here before merge rather than deferring to Phase D?

---

## Safety wall

- `protocol_gates.py` is under `/backend/safety/` → already covered by the existing CODEOWNERS rule, auto-requests your review.
- No touches to `encryption.py`, `webrtc_signaling.py`, safeguarding collections, ENCRYPTED_FIELDS, panic/escalation/live-chat code.
- `verdict_reconciler.py` unchanged (Phase B's risk-level reconciliation is orthogonal to Phase C's protocol-rule gate).
- No persona `.md` files changed. soul_loader.py change is additive-only (existing prompt prose byte-for-byte identical).

---

## Review checklist for Ant

- [ ] The conservative soul_loader.py approach (append, don't restructure) — accept, or do the fuller interpolation?
- [ ] Phrase lists in `protocol_gates.py` — complete and accurate vs Zentrafuge Round 8/9? Anything to add/remove/reword?
- [ ] Regenerate-loop test depth — in-process sufficient, or add a live-server end-to-end here?
- [ ] Audit-log schema (`evt: round10.protocol_gate`, sha256-of-reply, matched_phrase in clear) — good?
- [ ] The gate runs its own max-2 regenerate loop BEFORE the LLM judge, which then runs its own max-2 loop on PASS. Comfortable with up to 2+2 regenerations worst case, or cap the combined total?
