## Phase B² — Alert-Gate Reconciler Hotfix

Closes the residual S009 failure identified in Round 10 retest.
Approved design via email from @theaioldtimer 4 May 2026.

### ⚠ Bundling notice — Phase 0 PR 1 included in this PR

This PR also includes the **Phase 0 PR 1** orphan-frontend-file deletions, even though the original plan was to ship them on a separate branch. Bundled here because the deletions are uncontroversial, the work was already staged in the same working tree, and cherry-picking would have added rebase risk for no review benefit. Andrew has signed off on the bundling.

Phase 0 PR 1 deletions in this PR (NOT safety-layer code, do not require CODEOWNERS safety review):

- `staff-portal/index-v2.html` (orphan, 2266 lines — planned rename to `index.html` never shipped)
- `admin-site/test-login.html` (orphan, 59 lines — predictable test login UI, attack surface)
- `admin-site/app-minimal.js` (orphan, 456 lines — dead legacy admin JS)
- `docs/IMPLEMENTATION_SUMMARY.md` (3 stale references replaced with `[REMOVED 2026-05-04]` historical notes)

The Phase B² safety-layer changes are scoped to `backend/server.py` (gate + GET filter, 56 lines) and `backend/tests/test_round10_phase_b_reconciler.py` (5 new tests, 345 lines). Everything else in the diff is either (a) Phase 0 PR 1 deletions listed above, (b) auto-generated preview-URL substitutions in test-file `BASE_URL` fallback strings (environment-driven, no test logic or assertions touched — confirmed by line-by-line audit), or (c) auto-generated platform metadata (`.emergent/`, changelog).

### Changes
- Gate the legacy alert-creation path on `failsafe_should_fire` (not `final_verdict.failsafe_triggered` — see commit message for rationale)
- When suppressed, write alert with `status="audit_only"` (Position 3 per Ant's decision)
- MEDIUM → GREEN mapping for suppressed audit-only records (conditional: only when classifier said "medium", and applied to the SafeguardingAlert DB record only — classifier cache untouched)
- Default alerts queue filters out `status="audit_only"`
- New optional query parameter `?include_audit_only=true` for retrospective queries (status field preserved verbatim in response)
- Integration tests for S009, CTRL, and identity-guard cases — 25/25 reconciler tests + 59/59 broader safety tests passing

### Out of scope (deferred — DO NOT FORGET)
- **Staff portal UI for viewing audit-only alerts.** Tracked as Phase 1D in `radiocheck-remediation-plan.md`. The backend data model and query endpoint are in place; the UI to surface them is a non-safety frontend change that belongs with the staff portal remediation work, not this safety-layer PR.
- All other Phase 1 staff portal fixes (XSS, apiCall signature, persona hardcoding, etc.) — separate PRs.
- Audit-stats endpoint (`/api/safeguarding-alerts/audit-stats`) for monitoring reconciler drift — deferred to post-B²-production observability work.

### Reviewers
- @theaioldtimer (CODEOWNERS — required, but NOT YET — this PR is in pre-review state pending design pre-check by Andrew)

### Retest gate
- Round 10 S009 + CTRL retest on production after deploy = close-out gate
