# RadioCheck CHANGELOG

## 2026-05-04 — Round 10 Phase B³ (Overlay-Gate Reconciler Hotfix)

### Problem
Phase B² (PR #8, merged) closed the alert-DB side of the split-authority bug:
reconciler-suppressed alerts now persist with `status="audit_only"` and stay
out of the default staff queue. Production logs confirm working.

However, the same production trace showed the user-facing crisis overlay
still fired on the same message. The Phase B³ investigation traced this to
the `unified_risk` upgrade block in `buddy_chat()` at `backend/server.py:6555–6587`
— a structural twin of the alert-DB block gated by B², but on the
response-payload side. Third recurrence of the split-authority pattern in
Round 10 (Phase B → B² → B³).

### Fix — Anthony's Option A scope (reconciler-aware upgrade-block gate)

Three additive changes inside `buddy_chat()`:

- **`backend/server.py:~6555`** — new `elif not failsafe_should_fire and
  final_verdict.precedence_rule_fired == "CONTEXT_OVERRIDE":` branch in the
  existing negation/identity suppression chain. Logs and falls through;
  does not upgrade `risk_level`. Log style matches the adjacent
  `negation_confirmed` / `identity_active` branches.
- **`backend/server.py:~6582`** — `rapid_escalation` guard extended with
  `and failsafe_should_fire`.
- **`backend/server.py:~6588`** — `detected_patterns` guard extended with
  `and failsafe_should_fire`.

Variable scope: `failsafe_should_fire` set at line 6397, finalised through
line 6445 (negation/identity adjustments), in scope at 6555. No threading,
no refactor.

### Known incomplete coverage — pending Phase B³.5
During implementation, a failing end-to-end test surfaced a second leak
vector at `server.py:6334` (the initial `risk_level = risk_data["risk_level"]`
assignment from `check_safeguarding()`), structurally upstream of the
upgrade-block fix. Per Anthony's addendum decision (Option C), B³.5 will
close that vector as a separate named PR. The failing test is retained in
B³ with `@pytest.mark.xfail(strict=True)` and a reason string identifying
the line-6334 vector — it flips to passing when B³.5 lands and removes the
decorator. Round 10 close-out retest (S009 + CTRL) happens after B³.5
merges, not after B³ alone.

Post-merge of B³, a full `risk_level` mutation audit of `buddy_chat()`
(lines 6320–7028) will enumerate every assignment before B³.5 is scoped.

### Tests
- New: `test_phase_b3_context_override_suppresses_overlay_upgrade` —
  end-to-end via `TestClient` with mocked classifier/OpenAI/geo/email,
  S009_B fixture. **Marked `xfail(strict=True)` pending B³.5.**
- New: `test_phase_b3_genuine_crisis_still_triggers_overlay` — control;
  genuine IMMINENT + intent must still fire overlay.
- New: `test_phase_b3_rapid_escalation_gated_by_reconciler` — unit-level
  guard-expression assertion.
- New: `test_phase_b3_detected_patterns_gated_by_reconciler` — unit-level
  guard-expression assertion.
- Round 10 reconciler suite: 28 passed, 1 xfailed.
- Full safety regression (reconciler + unified + session-bleed +
  section-5 + signals/judge): 71 passed, 1 xfailed, 0 failed.

### Files Modified
- `/app/backend/server.py` — new elif + two extended guards.
- `/app/backend/tests/test_round10_phase_b_reconciler.py` — 4 new tests +
  shared test helpers.
- `/app/memory/PHASE_B3_PR_DESCRIPTION.md` — new PR body per §4.2 of the
  original brief + §2.3 of the addendum.
- `/app/memory/CHANGELOG.md` — this entry.

### Branch
`feat/round10-phase-b3-overlay-reconciler-gate` — draft PR, Andrew Claude
pre-check first, then Anthony via CODEOWNERS. Do not merge.

---

## 2026-05-04 — Round 10 Phase B² (Alert-Gate Reconciler Hotfix)

### Problem
After Round 10 Phase B merged the verdict reconciler, the chat endpoint still
contained legacy escalation variables (`should_escalate`) that bypassed the
reconciler's `CONTEXT_OVERRIDE` decision. On bereavement fixtures (S009_a/b)
the reconciler correctly classified the message as a grief disclosure and
suppressed `failsafe_should_fire`, but the legacy alert-write block at
`server.py:6918` still fired an `active` AMBER/RED safeguarding alert into
the staff queue — generating false-positive alerts on bereaved users. This
was the 4th recurrence of the split-authority pattern (Round 8 → 9 → 10 → B²).

### Fix — Position 3 (Audit-Only Persistence)
Implemented an alert-gate inside `buddy_chat()` that respects the reconciler's
authority:

- **`backend/server.py:~6918`** — when `should_escalate=True` reaches the
  legacy alert-write block, but `failsafe_should_fire=False` (i.e. the
  reconciler did NOT trigger failsafe), the alert is persisted with
  `status="audit_only"` instead of `status="active"`.
- **MEDIUM → GREEN mapping is conditional**: applied to the persisted DB
  record only when the AI classifier said `risk_level=="medium"` AND the
  alert is being written audit_only. Other classifier levels (low/high/none)
  pass through unchanged. The classifier cache and in-memory verdicts are
  never mutated.
- **`GET /api/safeguarding-alerts`** — excludes `status="audit_only"`
  records by default. Pass `?include_audit_only=true` to include them.
  An explicit `?status=audit_only` filter overrides the default exclusion.
  The `status` field on each record is preserved verbatim so the staff
  portal can render audit_only alerts with a distinct visual treatment.

### Phase 0 PR 1 — Orphan Frontend File Cleanup (option (a))
Deleted three orphan, unmonitored attack-surface files and their stale doc
references:
- `/app/staff-portal/index-v2.html` — planned rename to `index.html` never
  shipped; live staff portal is `/app/portal/` (Next.js)
- `/app/admin-site/test-login.html` — predictable test login UI
- `/app/admin-site/app-minimal.js` — legacy minimal admin JS, dead code
- Stale references in `docs/IMPLEMENTATION_SUMMARY.md` replaced with
  `[REMOVED 2026-05-04]` historical notes for traceability

### Tests
- New: `test_phase_b2_get_safeguarding_alerts_excludes_audit_only_by_default`
- New: `test_phase_b2_get_safeguarding_alerts_include_audit_only_returns_them`
- New: `test_phase_b2_explicit_status_filter_overrides_default_exclusion`
- New: `test_phase_b2_alert_gate_logic_audit_only_when_reconciler_suppresses`
  (unit-level mapping policy assertion: medium→GREEN, others pass through)
- New: `test_integration_s009_b_writes_audit_only_alert_via_gate` (end-to-end
  via FastAPI TestClient, mocked classifier/OpenAI/geo/email)
- All 25 reconciler tests + 59 broader safety tests passing.

### Files Modified
- `/app/backend/server.py` — alert-gate logic, GET filter parameter
- `/app/backend/tests/test_round10_phase_b_reconciler.py` — 5 new tests
- `/app/docs/IMPLEMENTATION_SUMMARY.md` — orphan-file references annotated
- Deleted: `/app/staff-portal/index-v2.html`,
  `/app/admin-site/test-login.html`, `/app/admin-site/app-minimal.js`

### Branch
`feat/round10-phase-b2-alert-gate-reconciler` — to be pushed as draft PR
(pre-Ant design pre-check before Ant reviews; do not merge).

---

## 2026-02-24 — Extended Test Suite: 100% Pass Rate

### Fixes Applied
1. **Rate Limiter Localhost Exemption** — Exempted 127.0.0.1/localhost/::1 from IP rate limiting. Resolved 15+ false ERROR results in test suite caused by 429 throttling.

2. **Meta-Negation Logic** (`safety/safety_monitor.py`) — Added context-aware handling for phrases like "pretending im fine". Safety affirmations ("im fine", "im okay", etc.) are now skipped when preceded by meta-negation words ("pretending", "faking", "cant keep", etc.). Prevents false negatives where "i cant keep pretending im fine i want it to stop" was incorrectly treated as GREEN.

3. **Tight Window for Short Negation Prefixes** (`safety/safety_monitor.py`) — Short generic negation prefixes (≤2 words, e.g., "i dont", "not", "never") now use a 4-word window instead of the full 16-word window. Prevents cross-clause false negation where "i dont see the point" was incorrectly negating "want it to stop" 15 words later.

4. **Missing Crisis Phrases Added** (`server.py` RED_INDICATORS):
   - "feeling like dying" / "feel like dying" / "like dying" (80-90)
   - "disappear forever" / "want to disappear" (80-100)
   - "sleep forever" / "want to sleep forever" / "never wake up" (90-100)

5. **Panic/Distress Phrases Added** (`server.py` AMBER_INDICATORS):
   - "can't breathe" / "cant breathe" (40)
   - "can't stop crying" / "cant stop crying" (40)
   - "having a panic attack" / "panic attack" (40-45)

6. **Bot Protection Localhost Exemption** — Exempted localhost from user-agent bot detection checks.

### Test Results
- Extended Test Suite: **95/95 PASS (100%)**
- Zero deployment blockers
- All sections passing: Phonetic, Numeric, Fragments, Caps, No-Punctuation, Single-Word, Mixed, Regression, Soul Document, Multi-Persona, Cache Isolation, Load Testing, Normalizer Fallback, Classifier Fallback, Session Continuity, Prompt Injection, Security

### Files Modified
- `/app/backend/server.py` — Rate limiter localhost exemption, bot protection exemption, new RED/AMBER indicators
- `/app/backend/safety/safety_monitor.py` — Meta-negation logic, tight window for short prefixes
- `/app/backend/safety/ai_safety_classifier.py` — Added AI_PROVIDER variable
- `/app/backend/tests/extended_test_suite.py` — Updated API_URL to localhost
