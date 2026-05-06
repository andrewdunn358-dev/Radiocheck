## Phase B³ — Overlay-Gate Reconciler Hotfix

Closes the user-facing overlay symmetry of the Phase B² alert gate by adding reconciler-aware suppression to the `unified_risk` upgrade block in `buddy_chat()`.

### Problem statement

PR #8 (Phase B², `feat/round10-phase-b2-alert-gate-reconciler`) closed the split-authority bug on the alert-DB side: when the reconciler fires `CONTEXT_OVERRIDE`, the `safeguarding_alerts` record is now correctly written with `status="audit_only"` and hidden from the default staff queue. Production logs confirm this working.

However, the same production trace shows the user-facing crisis overlay still fires on the same message. The Phase B³ investigation (`/app/memory/PHASE_B3_INVESTIGATION_ANSWERS.md`) traced this to the `unified_risk` upgrade block in `buddy_chat()` at `backend/server.py:6555–6587`. That block reads the **raw** `unified_safety["risk_level"]` (pre-reconciler) and unconditionally upgrades the local `risk_level` to `"RED"` on `unified_risk == "IMMINENT"` — bypassing the reconciler's authority. Two adjacent blocks (`rapid_escalation` at ~6582 and `detected_patterns` at ~6588) share the same bypass shape.

This is the third recurrence of the split-authority pattern in Round 10 (Phase B → B² alert gate → B³ overlay gate), all structurally identical: a legacy verdict variable mutates downstream state without consulting the reconciler.

### Solution — Anthony's Option A scope

Three changes to `buddy_chat()` at `backend/server.py`, all additive, no deletions:

1. **New `elif` branch** in the existing negation/identity suppression chain at ~line 6555. When `not failsafe_should_fire and final_verdict.precedence_rule_fired == "CONTEXT_OVERRIDE"`, log and fall through without upgrading `risk_level`. Suppress action matches the verbose two-line `logging.info(...)` style of the adjacent `negation_confirmed` and `identity_active` branches — codebase consistency per Andrew's steer.
2. **Extend the `rapid_escalation` guard** at ~line 6582 with `and failsafe_should_fire`.
3. **Extend the `detected_patterns` guard** at ~line 6588 with `and failsafe_should_fire`.

The classifier blind spot identified in the investigation's open question 4 is consciously deferred per Anthony's Option A scope decision: the classifier's verdict already flows into the reconciler, so gating on `failsafe_should_fire` already gates on a synthesis that incorporates the classifier. Option B would be redundant.

### Variable-scope note (Anthony specifically requested this)

Grep-precise line numbers from this branch:

- `failsafe_should_fire` is **set at line 6397** (`failsafe_should_fire = final_verdict.failsafe_triggered`).
- It is then **finalised through line 6445** (mutated by the negation and identity-guard adjustment blocks between 6399 and 6445).
- The `unified_risk` upgrade block runs at **line 6555**, well after the variable is finalised.
- `final_verdict` (from the reconciler) is assigned at line 6371; `precedence_rule_fired` is a field on that dataclass.

Both `failsafe_should_fire` and `final_verdict` are **already in scope** at the point the upgrade block executes — no variable threading, no parameter passing, no refactoring required.

### Diff overview

Three changes, all in `backend/server.py`, all additive:

| # | Location | Change | Net lines |
|---|---|---|---|
| 1 | `server.py:~6555` | Insert new `elif not failsafe_should_fire and final_verdict.precedence_rule_fired == "CONTEXT_OVERRIDE":` branch with verbose `logging.info(...)` matching adjacent branches | +12 (incl. block comment + log call) |
| 2 | `server.py:~6582` | Extend `rapid_escalation` guard: `and failsafe_should_fire` | +0 (same line, extended expression) |
| 3 | `server.py:~6588` | Extend `detected_patterns` guard: `and failsafe_should_fire` | +0 (same line, extended expression) |

Comment at ~6582 expanded from one line to three lines to explain the third condition joining the existing two (`negation_confirmed`, `identity_active`). No deletions, no restructuring of the if/elif chain, no renames.

### Tests added

All in `backend/tests/test_round10_phase_b_reconciler.py`, appended below the existing Phase B² tests:

1. **`test_phase_b3_context_override_suppresses_overlay_upgrade`** — End-to-end via FastAPI `TestClient` with mocked classifier/OpenAI/geo/email. Drives the S009_B grief-bereavement fixture and asserts `safeguardingTriggered=False` and `riskLevel != "RED"` in the response payload. **See "Known incomplete coverage" section below — this test is marked `xfail(strict=True)` in this PR and will flip to passing when Phase B³.5 lands.**
2. **`test_phase_b3_genuine_crisis_still_triggers_overlay`** — Control. Classifier returns `imminent`/`contains_self_harm_intent=True` on a direct first-person intent message; asserts `safeguardingTriggered=True` and `riskLevel == "RED"`. Guards against the new gate being too aggressive.
3. **`test_phase_b3_rapid_escalation_gated_by_reconciler`** — Unit-level. Mirrors the extended guard expression at ~line 6582 and asserts the boolean invariant: `rapid_escalation` must be suppressed when `failsafe_should_fire is False`, and the existing `negation_confirmed` / `identity_active` guards still dominate.
4. **`test_phase_b3_detected_patterns_gated_by_reconciler`** — Unit-level. Same shape as test 3 for the `detected_patterns` guard at ~line 6588.

### Known incomplete coverage — pending Phase B³.5

One end-to-end test (`test_phase_b3_context_override_suppresses_overlay_upgrade`) is marked `@pytest.mark.xfail(strict=True)` with a reason string identifying the line-6334 leak vector. This is intentional and reviewed: the upstream initial assignment at `server.py:6334` (`risk_level = risk_data["risk_level"]` from `check_safeguarding()`) is a structurally distinct leak vector that requires its own gate. Phase B³.5 will close that vector and remove the xfail decorator as part of its diff. The decorator's removal is the close-out evidence for B³.5.

The line-6334 leak was surfaced by this test failing during B³ implementation; Emergent stopped at the original brief's §7 boundary and flagged to Anthony, who scoped the response in the Phase B³ fix addendum. Option A (drop/weaken the test) was rejected; Option C (two PRs, two named commits) was confirmed. Post-merge of B³, a full `risk_level` mutation audit (grep-walk of `buddy_chat()` lines 6320–7028) will classify every assignment before B³.5 is scoped and briefed.

`strict=True` on the decorator is mandatory: if line 6334 is silently fixed (or the fixture drifts), pytest will mark the run XPASS and fail the build — which is the desired outcome, because we need to know.

### Tests passing

- `test_round10_phase_b_reconciler.py`: **28 passed, 1 xfailed** (the strict-xfail test above).
- Full Round 9 + Round 10 safety regression: `test_round10_phase_b_reconciler.py` + `test_unified_safeguarding.py` + `test_round9_item6_session_bleed.py` + `test_round9_section5_regression.py` + `test_round9_items3_4_5_signals_judge.py` → **71 passed, 1 xfailed, 0 failed**.
- Phase B² test count from PR #8 (25) preserved; Phase B³ adds 4 new tests (3 passing + 1 strict-xfail).

### Out of scope (considered and deferred)

- **AI classifier blind spot** (investigation open question 4) — deferred per Anthony's Option A scope decision. The classifier's verdict already flows into the reconciler, so gating on `failsafe_should_fire` transitively respects it. Option B would be redundant.
- **Line-6334 initial assignment leak** — surfaced during implementation, scoped into Phase B³.5 per the addendum. See "Known incomplete coverage" above.
- **Duplicate `safety_audit_log` instances** (`backend/enhanced_safety_layer.py:288` vs `backend/safety/conversation_monitor.py:218`) — noted in the investigation's open question 2, not a safety-correctness issue; out of scope here.
- **Refactoring `buddy_chat()` to a state-machine model** — would structurally prevent future split-authority recurrence, but is a large rewrite and out of scope for a hotfix. Flagging for a future round.
- No drive-by lint, formatting, comment, import, or naming changes were made.

### Production retest plan (Anthony's close-out gate)

Per the addendum §3.5, Round 10 close-out is after **B³.5** merges, not after B³ alone. B³ is an interim merge. Anthony retests the following on production once B³.5 is deployed:

- **S009** — the grief-context scenario that surfaced the original bug (Tommy persona, "lost my brother to an overdose" flow). Expected: alert written with `status="audit_only"` (B² gate ✓), overlay does NOT render (B³ + B³.5 gates ✓), persona delivers grief response.
- **CTRL** — a control case, genuine crisis flow with first-person intent. Expected: alert written with `status="active"`, overlay renders, crisis response delivered.

Both run from clean incognito sessions on the deployed preview.

### CODEOWNERS

This is safety-layer code. **@theaioldtimer (Anthony)** must review via CODEOWNERS. This PR is in pre-review state — Andrew runs Claude pre-PR design pre-check first, then Anthony is tagged.

**Do not merge directly. Do not self-approve.**
