## Phase B² — Alert-Gate Reconciler Hotfix

Closes the residual S009 failure identified in Round 10 retest.
Approved design via email from @theaioldtimer 4 May 2026.

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
