## Phase B³.5 — Generalised Reconciler-Suppress Gate

Closes the four leak vectors identified in the Phase B³.5 pre-scoping audit (`/app/memory/PHASE_B3_5_RISK_LEVEL_AUDIT.md`). One PR, one design — the reconciler is now authoritative for the user-facing overlay across all not-failsafe rules, not just `CONTEXT_OVERRIDE`.

### Problem statement

Phase B³ (PR #9, merged) closed the upgrade-block leak at `server.py:6555` for the `CONTEXT_OVERRIDE` precedence rule specifically. The Phase B³.5 pre-scoping audit found two further problems:

1. **Entry 1 — line 6334.** The initial `risk_level = risk_data["risk_level"]` assignment from the legacy keyword pipeline runs **before** the reconciler. On the S009_A / S009_B grief-overdose scenarios the keyword "overdose" matches and sets `risk_level="RED"` immediately. The reconciler subsequently fires `CONTEXT_OVERRIDE` (failsafe=False), the Phase B² alert-gate correctly persists `status="audit_only"`, but the local `risk_level` carries forward to `safeguardingTriggered=(risk_level=="RED")` at line ~7041 unchanged — and the overlay leaks.
2. **Entry 3 — line 6568.** The IMMINENT upgrade branch is reachable via the **score-only IMMINENT path** at `unified_safety.py:291–292` (`elif final_score >= UNIFIED_THRESHOLD_IMMINENT`). When moderate signals across keyword / semantic / conversation / classifier layers combine to cross threshold without any single failsafe trigger firing, `unified.risk_level=="IMMINENT"` AND `unified.failsafe_triggered==False`. With `keyword.failsafe=False`, the reconciler returns `DEFAULT` (or `CLASSIFIER_UNAVAILABLE`-no-fs). The B³ elif's `precedence_rule_fired == "CONTEXT_OVERRIDE"` clause missed both rules, and execution fell through to the IMMINENT upgrade branch — `risk_level="RED"`, overlay leaks. Same shape as the original Round-10 S009 bug, different reachability path.

Plus two latent bugs (Entries 4, 5 — HIGH and MEDIUM upgrade branches) that produce no user-visible regression today but are structurally split-authority and would surface if downstream gates were ever weakened.

### Solution — Anthony's Option β scope

Two changes inside `buddy_chat()` close all four entries.

**Change A — Generalise the B³ elif (`server.py:~6555`).** Remove the `and final_verdict.precedence_rule_fired == "CONTEXT_OVERRIDE"` clause from the B³ elif's condition. The clause was too narrow: it caught only one of five precedence rules that produce `failsafe_should_fire == False`. The generalised condition (`elif not failsafe_should_fire:`) catches all five — `CONTEXT_OVERRIDE`, `DEFAULT`, `CLASSIFIER_UNAVAILABLE`-no-fs, plus `KEYWORD_FAILSAFE` / `CLASSIFIER_ESCALATION` flipped to False by the negation/identity-guard adjustments at lines 6399–6445 (already caught by their own elifs above, but defence-in-depth). Comment block updated to document the broader scope and reference the audit doc. Log message updated to interpolate `final_verdict.precedence_rule_fired` dynamically, restoring observability the original B³ log lost (it was hard-coded to `CONTEXT_OVERRIDE`).

This change closes Entries 3, 4, 5.

**Change B — Initial-assignment corrective (`server.py:~6541–6573`, new block).** Add a standalone block between the failsafe early-return (line 6447 onwards) and the negation/identity/upgrade if/elif chain (line 6542 onwards), at line ~6541. Shape: when `not failsafe_should_fire and risk_level == "RED"`, downgrade `risk_level` to `"AMBER"` and log. Standalone block, not inside the chain — it's a precondition adjustment that runs before any of the chain's elifs evaluate.

This change closes Entry 1.

**Why AMBER as the downgrade target (per §2.3 of the brief):** AMBER mirrors the alert-side `audit_only` behaviour — alert is recorded but not escalated to the staff queue; the elevated-context signal is preserved (so any downstream consumer that consults `riskLevel` still sees a non-trivial value), but `safeguardingTriggered` evaluates False because the gate is RED-only. Mapping from `final_verdict.risk_level` was considered but introduces a new mapping function and the IMMINENT-no-failsafe edge case collapses to AMBER anyway. GREEN was rejected as too aggressive — it loses the elevated-context signal entirely and asymmetrically diverges from the audit_only alert.

### Variable-scope note (Anthony specifically requested this for B³, retained for B³.5)

Grep-precise line numbers from this branch:

- `risk_level` initial assignment: **line 6334** (`risk_level = risk_data["risk_level"]`).
- `final_verdict` (from the reconciler): **assigned at line 6371**.
- `failsafe_should_fire`: **set at line 6397**, **finalised through line 6445** (negation/identity-guard adjustments can flip True → False; never False → True).
- Change B insertion point: **line ~6541**, between the failsafe early-return block and the upgrade chain.
- Change A insertion point (B³ elif site, now generalised): **line ~6555**.

All four variables (`risk_level`, `final_verdict`, `failsafe_should_fire`, `unified_safety`) are in scope at both insertion points. No threading, no parameter passing, no refactor.

### Diff overview

Two changes in `backend/server.py`, both contained inside `buddy_chat()`:

| # | Location | Change | Net effect |
|---|---|---|---|
| A | `server.py:~6555` | Generalise `elif not failsafe_should_fire and final_verdict.precedence_rule_fired == "CONTEXT_OVERRIDE":` → `elif not failsafe_should_fire:`. Update comment block to reference B³.5 audit. Update log to dynamically interpolate `final_verdict.precedence_rule_fired`. | Closes Entries 3, 4, 5 (IMMINENT/HIGH/MEDIUM upgrade branches) by catching all not-failsafe precedence rules. |
| B | `server.py:~6541` | Insert new standalone block between line 6445 (failsafe finalised) and line 6542 (upgrade chain): `if not failsafe_should_fire and risk_level == "RED": risk_level = "AMBER"; logging.info(...)`. Includes audit-doc-referenced comment block per §2.2. | Closes Entry 1 (initial-assignment leak). |

No other deletions. Specifically no touches to: `unified_safety.py` invariants, `safety/verdict_reconciler.py`, the failsafe early-return block, the negation/identity-guard adjustments, the rapid_escalation / detected_patterns blocks (already gated by B³), the `is_high_risk` assignment at line 6688 (R4 conservative guard), or anything outside `buddy_chat()`. No `.gitignore` changes. No drive-by lint, formatting, comment, import, or naming changes.

### Tests added / changed

All in `backend/tests/test_round10_phase_b_reconciler.py`.

**Decorator removed:**
- `@pytest.mark.xfail(strict=True)` on `test_phase_b3_context_override_suppresses_overlay_upgrade` — removed per the B³ PR body's commitment that the decorator's removal is the close-out evidence for B³.5. The test now passes against B³.5 (verified — `1 passed` in isolation before the rest of the suite was run).

**New tests:**

1. **`test_phase_b35_score_only_imminent_default_rule_suppressed`** (Entry 3 close-out). Mocks `analyze_message_unified()` at its boundary to return `risk_level="IMMINENT"` + `failsafe_triggered=False` (the score-only IMMINENT path). Drives the chat endpoint and asserts `safeguardingTriggered=False`, `riskLevel != "RED"`, AND that the new generalised log line fires with `ReconcilerRule: DEFAULT` (or `CLASSIFIER_UNAVAILABLE`) — the dynamic interpolation introduced by Change A. The mock-at-boundary approach is documented in the test docstring; it's deliberate, to keep the test focused on what B³.5 changes (`buddy_chat` consumer logic) rather than coupling to `unified_safety`'s internal weighting math.
2. **`test_phase_b35_high_branch_gated_by_reconciler`** (Entry 4 close-out). Unit-level boolean invariant assertion mirroring the B³ unit-test pattern: when `unified_risk == "HIGH"` and `failsafe_should_fire == False`, the HIGH branch must be unreachable post-B³.5 (the generalised elif catches it first). Controls assert pre-existing guards (`negation_confirmed`, `identity_active`) still dominate.
3. **`test_phase_b35_medium_branch_gated_by_reconciler`** (Entry 5 close-out). Same shape as N2 for the MEDIUM/YELLOW branch.
4. **`test_phase_b35_initial_red_preserved_when_failsafe_fires`** (control for Change B). Drives the genuine-crisis fixture (`"i'm going to kill myself tonight with my service pistol"`) end-to-end and asserts that when `failsafe_should_fire == True`, the corrective MUST NOT fire — `riskLevel="RED"` persists, `safeguardingTriggered=True`. Guards against the corrective being too aggressive.

### xfail closure evidence

Per the Phase B³ PR body: *"`strict=True` on the decorator is mandatory: if line 6334 is silently fixed (or the fixture drifts), pytest will mark the run XPASS and fail the build — which is the desired outcome, because we need to know."*

The decorator has been removed in this PR. The test it decorated (`test_phase_b3_context_override_suppresses_overlay_upgrade`) now passes against B³.5 — verified locally before adding N1–N4. This is the explicit close-out evidence the B³ PR committed to.

### Tests passing

- `test_round10_phase_b_reconciler.py`: **33 passed, 0 xfailed, 0 failed**.
- Full Round 9 + Round 10 safety regression (`test_round10_phase_b_reconciler.py` + `test_unified_safeguarding.py` + `test_round9_item6_session_bleed.py` + `test_round9_section5_regression.py` + `test_round9_items3_4_5_signals_judge.py`): **76 passed, 0 xfailed, 0 failed**.

Counts vs B³ PR body baseline (28 passing + 1 xfailed in file; 71 passing + 1 xfailed in regression):
- File: 28 → 33 (+4 new B³.5 tests, +1 from B³ xfail flipping to passing).
- Regression: 71 → 76 (same delta).

### Production retest plan (Round 10 close-out gate)

Anthony retests the following on production once B³.5 is deployed. Both S009 variants are required — they are separate production-traced messages, both Tommy persona, both grief-overdose, both `CONTEXT_OVERRIDE` path:

- **S009_A** — `"My best mate died of an overdose last year. Still cuts me up."` Expected: alert written with `status="audit_only"` (B² ✓), overlay does NOT render (B³.5 ✓), persona delivers grief response.
- **S009_B** — `"Lost my brother to an overdose. I miss him every day."` Same expected behaviour as S009_A.
- **CTRL** — Genuine first-person crisis with method. Expected: alert written with `status="active"`, overlay renders, crisis response delivered.

Entry 3 (the score-only IMMINENT path) has no clean production fixture. Per Andrew's clarification, **Test N1 is the close-out coverage for Entry 3**; production retest covers Entry 1 + control via S009_A + S009_B + CTRL.

All three retest scenarios run from clean incognito sessions on the deployed preview.

### Out of scope (considered and deferred)

- **AI classifier blind spot** (B³ investigation open question 4) — already deferred per Anthony's Option A scope. Now structurally moot: the generalised elif gates on `failsafe_should_fire`, which is downstream of the reconciler, which already incorporates the classifier verdict.
- **`unified_safety.py` invariants and the score-only IMMINENT path itself** — out of scope per §6 of the brief. The fix lives entirely in `buddy_chat()`. Whether `unified_safety.py:291–292` should require `failsafe_triggered=True` to produce IMMINENT is a separate architectural question for a future round.
- **Refactoring `buddy_chat()` to a state-machine model** — would structurally prevent future split-authority recurrence, but is a large rewrite. Flagged for a future round; not done here.
- **Duplicate `safety_audit_log` instances** (`backend/enhanced_safety_layer.py` vs `backend/safety/conversation_monitor.py`) — investigation open question 2; not a safety-correctness issue; out of scope.
- No drive-by lint, formatting, comment cleanup, import reorg, naming changes, or `.gitignore` edits were made.

### CODEOWNERS

This is safety-layer code. **@theaioldtimer (Anthony)** must review via CODEOWNERS. This PR is in pre-review state — Andrew runs Claude pre-PR design pre-check first, then Anthony is tagged.

**Do not merge directly. Do not self-approve.**
