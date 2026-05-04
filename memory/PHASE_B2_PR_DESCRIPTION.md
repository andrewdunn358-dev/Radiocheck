## Phase B² — Alert-Gate Reconciler Hotfix

Closes the residual S009 failure identified in Round 10 retest.
Approved design via email from @theaioldtimer 4 May 2026.

### Changes
- Gate the legacy alert-creation path on `failsafe_should_fire` (not `final_verdict.failsafe_triggered` — see commit message for rationale)
- When suppressed, write alert with `status="audit_only"` (Position 3 per Ant's decision)
- MEDIUM → GREEN mapping for suppressed audit-only records
- Default alerts queue filters out `status="audit_only"`
- New optional query parameter `?include_audit_only=true` for retrospective queries
- Integration tests for S009, CTRL, and identity-guard cases

### Out of scope (deferred — DO NOT FORGET)
- **Staff portal UI for viewing audit-only alerts.** Tracked as a Phase 1 frontend task in `radiocheck-remediation-plan.md`. The backend data model and query endpoint are in place; the UI to surface them is a non-safety frontend change that belongs with the staff portal remediation work, not this safety-layer PR.
- All other Phase 1 staff portal fixes (XSS, apiCall signature, persona hardcoding, etc.) — separate PRs.

### Reviewers
- @theaioldtimer (CODEOWNERS — required)

### Retest gate
- Round 10 S009 + CTRL retest on production after deploy = close-out gate
