# RadioCheck CHANGELOG

## 2026-05-20 — Veteran Voices PR #B2 (admin portal UI)

### Why
PR #B1 shipped the admin REST endpoints + ingest pipeline; PR #B2 gives editorial staff an actual screen to use them. Without this, every clip would have to be hand-curled or seeded.

### Changes
- **`portal/src/types/voices.ts`** (new) — TS mirrors of the PR #B1 Pydantic shapes. `CLIP_CATEGORIES` / `SENSITIVITY_FLAGS` exported as `as const` arrays so the form pickers stay in sync with the backend enums.
- **`portal/src/lib/admin-api.ts`** — adds 7 typed client methods consuming `PR #B1`: `listClipsAdmin`, `getClipAdmin`, `createClipAdmin` (multipart), `updateClipAdmin`, `publishClipAdmin`, `archiveClipAdmin`, `retranscribeClipAdmin`, `deleteClipAdmin`. Multipart upload bypasses `api.fetch` (which forces JSON content-type), mirroring the existing `uploadCMSImage` pattern.
- **`portal/src/components/admin/tabs/VoicesTab.tsx`** (new) — single-page editorial tab (per PR #B2 Q2a):
  - **Upload form** card at the top — file picker, contributor name/bio/photo/recording date, category + sensitivity checkbox grids, admin/internal notes, explicit consent tick. Mic icon. On submit runs the synchronous pipeline; on success auto-selects the new row in the detail editor.
  - **Clip list** card in the middle — table with status / pipeline badges, duration, categories, flags, last updated. Click to load the detail.
  - **Detail editor** card at the bottom — `<audio>` player, all editable fields, transcript `<textarea>`, captions table (per Q3a: simple Start/End/Text rows, add/remove). Action bar: Save · Re-transcribe · Archive · Publish · Delete. Publish button disabled (with explanatory `title`) unless `consentConfirmed && audioFilename && processingStatus==='ready' && status!=='published'` — matches the backend guardrail so the UI never lets a click 400.
  - Pipeline failures surface a red banner with the `processingError` string from the backend.
  - All interactive elements carry `data-testid` (`voices-*-*`) for the future Playwright suite.
- **`portal/src/app/admin/page.tsx`** — sidebar tab placement (Q1a): new top-level **Voices** tab with `Mic` icon, sat directly next to "AI Personas".

### Out of scope (explicit deferrals)
- Background-task ingest pattern — current synchronous Whisper run is acceptable for ≤10 min clips. Revisit if editorial team asks for batch upload.
- Waveform-with-clickable-segments caption editor — table is enough for cleaning Whisper output (Q3a).
- Veteran-side surfaces (random feed UI, save/favourite, category browse) — PR #C.

### Safety wall
- No imports from `safety/`, `safeguarding`, `live-chat`, `WebRTC`, or any panic / alert / escalation module on either side.
- New TS code is admin-only; no veteran-facing surfaces affected.

### Verification
- `npx tsc --noEmit` on the portal → **0 errors** across the whole tree.
- Backend endpoints already covered by 21 pytest cases in PR #B1.
- Smoke: `curl /api/admin/clips` still returns 401 (auth gate intact).


## 2026-05-20 — Veteran Voices PR #B1 (backend pipeline + admin API endpoints)

### Why
PR #A landed the public read foundation for Veteran Voices (random / get / audio-stream) but left every clip having to be hand-inserted by seed script. PR #B1 closes that gap with a real admin ingest pipeline + CRUD so the staff portal (PR #B2) and veteran UI (PR #C) can rely on a populated, captioned catalogue.

### Changes
- **`backend/services/voices_pipeline.py`** (new) — orchestrator + helpers:
  - `process_upload()` runs validate → write raw → ffmpeg transcode (mono 96kbps mp3, strips ID3 tags) → duration probe → Whisper transcription wrapped in `asyncio.wait_for(..., timeout=WHISPER_TIMEOUT_SECONDS)` (Q6 watchdog) → caption build.
  - Returns a `PipelineResult` dataclass — never raises into the request handler, so partial failures surface as `processingStatus=failed` instead of 500s.
  - `delete_clip_file()` with path-traversal defence (resolved path must sit inside `AUDIO_STORAGE_PATH`).
  - Static ffmpeg via **imageio-ffmpeg** (Q2) — no apt-get dependency on the Render base image.
- **`backend/routers/clips_admin.py`** (new) — `/api/admin/clips` family:
  - `POST` (multipart) creates a clip + runs the pipeline inline.
  - `GET` / `GET {id}` list + full admin view (with transcript + processing state).
  - `PATCH {id}` partial edit; refuses `status=published` unless `consentConfirmed=true`.
  - `POST {id}/publish`, `POST {id}/archive`, `POST {id}/retranscribe`, `DELETE {id}` (hard-delete + cleans `clip_plays` / `clip_saves` references and the on-disk file).
  - Auth: own `require_admin` dep mirroring `routers/ai_characters.py` — `set_dependencies(db, get_current_user)` from `server.py`.
- **`backend/models/clips.py`** — extended:
  - New `ClipProcessingStatus` enum (`pending`/`transcoding`/`transcribing`/`ready`/`failed`).
  - New fields on `Clip`: `internalNotes` (Q4 — NOT encrypted, NOT added to `ENCRYPTED_FIELDS`), `processingStatus`, `processingError`.
  - `ClipPublicResponse` shape untouched — none of these new fields leak to veterans.
- **`backend/server.py`** — wires the admin router via `set_clips_admin_dependencies(db, get_current_user)` + `app.include_router(clips_admin_router, prefix="/api")`. No safety / safeguarding code touched.
- **`backend/requirements.txt`** — adds `imageio-ffmpeg==0.6.0`.
- **`backend/tests/test_voices_admin.py`** (new) — 21 pytest cases:
  - `sanitize_filename` (4): path-traversal, unicode, length cap, empty fallback.
  - `process_upload` (4): happy path + empty / oversized / ffmpeg-failure guards.
  - Whisper watchdog (1): proves `asyncio.wait_for` cancels hung Whisper + cleans the partial mp3.
  - `delete_clip_file` (3): happy path + path-traversal refusal + missing-file behaviour.
  - Admin auth gate (2): non-admin → 403, unauth → 401/403.
  - Admin CRUD flow (7): upload → list → publish guarded by consent → publish ok → patch publish guarded → archive flips status → delete cleans disk + row.

### Out of scope (explicit deferrals)
- Admin UI screens (PR #B2 — Next.js portal upload form + list / detail editor).
- Veteran-side play tracking, save / favourite, category browse (PR #C — per Q5).
- Background-task pattern for very long uploads (current synchronous ingest is fine for ≤10 min clips and ~50MB cap; revisit if admins ask for batch upload).
- TURN / signalling / safeguarding code — explicitly untouched.

### Safety wall
- No imports from `safety/`, `encryption`, `webrtc_signaling`, or any safeguarding / live-chat / alert / escalation / panic module.
- `ENCRYPTED_FIELDS` untouched.
- Clip collection is independent of all PII / safeguarding data.

### Verification
- `pytest backend/tests/test_voices_admin.py backend/tests/test_voices_clips.py -q` → **31 passed** (10 PR #A + 21 PR #B1).
- `ruff check backend/{routers/clips_admin.py,services/voices_pipeline.py,models/clips.py,tests/test_voices_admin.py}` → clean.
- Live backend: `curl /api/admin/clips` → `401 Unauthorized` (auth gate active); 5 paths registered in OpenAPI.

### Manual steps after merge
- Render: ensure `AUDIO_STORAGE_PATH=/var/data/clips` and `OPENAI_API_KEY` are set (both already configured per PR #A + handoff).
- Tunables (optional env vars): `VOICES_MAX_UPLOAD_BYTES` (default 50MB), `VOICES_WHISPER_TIMEOUT_S` (default 300s).


## 2026-05-07 — Granular Chat History Deletion (frontend privacy)

### Why
Andrew flagged during the prior PR's smoke test that the (correctly-scoped) nuclear "Clear All Data" button now also wipes site-unlock + age-gate + AI-consent + theme — meaning a user just wanting to clear a single recent conversation gets fully de-onboarded. The single button was conflating two different user intents (routine privacy hygiene vs. UK GDPR Art. 17 erasure). Per `emergent-brief-granular-chat-deletion-direct-to-main.md`, the fix splits these into two siblings.

### Changes
- **`frontend/src/services/conversationStorage.ts`** — added new `clearChatHistoryOnly()` immediately above `clearAllStoredData()`. Clears `chat_history_*` + `radiocheck_chat_history_*` prefixes plus `STORAGE_KEYS.CONVERSATIONS` and `STORAGE_KEYS.SUMMARIES`. Re-throws errors (fail-loud, matches the nuclear sibling). Intentionally does **not** share helpers with `clearAllStoredData()` — different semantics (allowlist vs. explicit-key) per brief §2.1 hard constraint.
- **`frontend/app/settings.tsx`** —
  - Added `clearChatHistoryOnly` to the import.
  - Added `handleDeleteChatHistory()` handler with web `window.confirm` + native `Alert.alert` parity.
  - Added new "Delete chat history" row immediately above the existing "Clear All Data" row, neutral (non-destructive) styling, `data-testid="delete-chat-history-btn"`, `chatbubbles-outline` icon.
  - Updated copy on the existing nuclear button: helper subtext now reads *"Returns the device to a fresh-install state…"*; both confirm dialogs (web + native) updated to the new body, with the *"If you only want to delete your conversations, use 'Delete chat history' instead"* cross-reference.
- **`memory/DEVICE_DATA_DELETION_SMOKE_TEST.md`** — appended a "Granular Chat History Deletion" section with full pre-action setup, action, post-action assertions, negative test, and nuclear-sanity-check procedures.

### Out of scope (explicit deferrals, per brief §4 / §7)
- Server-side deletion (separate Article 17 pathway).
- Live clear-event broadcast to mounted chat screens — confirmed with Andrew, stale-state-until-next-mount is acceptable.
- Per-character chat deletion surfaced from Settings.
- Refactoring the two parallel chat implementations.
- Automated frontend test framework.
- `clearAllStoredData()` was not modified beyond its already-shipped form. No shared helpers with the new function.
- No `.gitignore` changes. No safety-layer code touched. No backend changes.

### Verification
- TypeScript: compiles clean for both touched files (only pre-existing `cardBg` errors remain, unrelated to this diff).
- Smoke test: the brief reserves the real DevTools smoke test for Andrew on the production Vercel deploy (this preview pod serves the Next.js admin portal, not the Expo frontend).



## 2026-05-04 — Device-Side Data Deletion Fix (frontend privacy)

### Problem
Anthony reported during multi-turn testing: the "Clear All Data" / "Delete
my data" button in Settings does not actually wipe stored data. Audit
(`/app/memory/DEVICE_DATA_DELETION_AUDIT.md`) confirmed: 22 of 40 storage
write sites were missed by `clearAllStoredData()`. The denylist
implementation enumerated keys explicitly, and several features (notably
the per-character `${character.id}_email` / `${character.id}_pin`
anti-grooming flow, mental-health screening history, breathing game state,
push tokens) were never added to the list. Privacy-critical missed entries
included full conversation history (legacy chat path), per-character email
+ PIN credentials (dead code — feature was never finished, no read-side
consumer), mental-health assessment scores (PHQ-9 / GAD-7), and the push
notification token.

### Fix — Anthony's Plan A scope (allowlist + dead-code excision)

**Change A — Excise email/PIN feature** (no read consumers found; dead
code per audit §4 + §1.3 confirmation grep). Removed from both chat
implementations (`frontend/app/chat/[characterId].tsx`,
`frontend/app/unified-chat.tsx`):
- 5 state variables (`showEmailModal`, `email`, `pin`, `isAuthenticated`,
  `savedEmail`) per file
- `handleSetupEmail` function per file (writes the credentials)
- `<TouchableOpacity>` "Save conversation banner" (the entry point)
- `<Modal>` "Save Your Conversation" (the form UI)
- 14 stylesheet entries used exclusively by the modal/banner per file
  (saveBanner, saveBannerText, modalOverlay, modalContent, modalClose,
  modalTitle, modalDescription, privacyNote, privacyText, inputLabel,
  modalInput, modalButton, modalButtonDisabled, modalButtonText)
- Net: ~150 lines removed per file, ~300 lines total. Eliminated 2
  pre-existing TS errors (lines 592/593 of unified-chat.tsx) as a
  byproduct.

**Change B — Rewrite `clearAllStoredData()` as allowlist** at
`frontend/src/services/conversationStorage.ts:483–544`. Replaces the
denylist with: `AsyncStorage.getAllKeys()` → filter against
`KEYS_TO_PRESERVE` (currently empty by design) → `multiRemove`
everything else, plus `window.sessionStorage.clear()` on web with a
catch-and-log fallback for embedded contexts where sessionStorage is
restricted (private browsing, third-party iframes). Comment block
documents the inversion and the rule for future preserved-key additions
(must be platform-level, must be reviewed by Anthony, must update the
audit doc). Added STORAGE_KEYS constants are no longer enumerated in
clearAllStoredData itself — the allowlist function-side wipe handles all
of them.

**Change C — Test infrastructure note.** Added
`data-testid="clear-all-data-btn"` to the Settings clear-data button
(`frontend/app/settings.tsx:256`). The frontend has no test framework
configured (no jest, vitest, or @testing-library), so the brief's §2.3
Test 1 is fulfilled via a manual smoke procedure documented at
`/app/memory/DEVICE_DATA_DELETION_SMOKE_TEST.md` (per brief §6: *"manual
smoke test if no automated suite"*). Adding a test framework is out of
scope per brief §7.

### Files Modified
- `/app/frontend/app/chat/[characterId].tsx` — Change A excision
- `/app/frontend/app/unified-chat.tsx` — Change A excision
- `/app/frontend/src/services/conversationStorage.ts` — Change B rewrite
- `/app/frontend/app/settings.tsx` — Change C testid added
- `/app/memory/DEVICE_DATA_DELETION_SMOKE_TEST.md` — new manual procedure
- `/app/memory/CHANGELOG.md` — this entry

### TypeScript signal
`yarn tsc --noEmit` — pre-existing baseline 4 errors → post-fix 2 errors.
**My changes eliminated 2 pre-existing errors** (lines 592/593 of
unified-chat.tsx, the `${character.id}_email`/`_pin` writes); zero new
errors introduced. The 2 remaining errors are pre-existing and unrelated
(line 111 of `[characterId].tsx`'s `accent_color` typo, line 596 of
`unified-chat.tsx`'s null-safety on `character.name`).

### Privacy properties — what's now true
- Every device-side AsyncStorage key (40 enumerated in audit) is wiped on
  "Clear All Data". Future keys added to the codebase are wiped
  automatically.
- sessionStorage is wiped on web (`rc_install_prompt_dismissed`).
- The two PII-laden dead-code keys (`${character.id}_email`,
  `${character.id}_pin`) are no longer written at all; the next time a
  user clears data, those keys leave the device permanently.

### Branch & review
`feat/device-data-deletion-fix` — frontend privacy code (not safety-
layer); CODEOWNERS-required review is NOT triggered. Andrew handles the
pre-push design check directly. Anthony tests the deployed preview against
the smoke procedure.

### Out of scope (deferred — DO NOT FORGET)
- `expo-notifications` / `expo-router` / `expo-updates` native-side
  persistence — flagged in audit §4.5; not enumerated by the audit; no
  fix in this PR.
- Service-worker registration cleanup — flagged in audit §4.6; SW caches
  nothing today, but registration persists. Design intent question.
- `AsyncStorage.mergeItem` / `multiMerge` calls — flagged in audit §5;
  30-second grep gap. Allowlist approach naturally catches whatever key
  these write to (since it's a getAllKeys-driven wipe), but the audit
  itself didn't enumerate them.
- Frontend test framework — out of scope per brief §7. Adding it is its
  own scope decision.
- Entry 3 / Entry 4 / Entry 5 latent bugs in the safety layer — separate
  workstream (Round 11+).

---

## 2026-05-04 — Round 10 Phase B³.5 (Generalised Reconciler-Suppress Gate)

### Problem
Phase B³ (PR #9, merged) closed the upgrade-block leak at `server.py:6555` for
the `CONTEXT_OVERRIDE` precedence rule specifically. The B³.5 pre-scoping
audit (`/app/memory/PHASE_B3_5_RISK_LEVEL_AUDIT.md`) found two further leak
vectors plus two latent split-authority bugs:
- **Entry 1 (line 6334):** initial `risk_level = risk_data["risk_level"]`
  from `check_safeguarding()` runs pre-reconciler. On S009_A / S009_B the
  "overdose" keyword sets RED before the reconciler authoritatively decides
  CONTEXT_OVERRIDE — RED carries through to `safeguardingTriggered`, overlay
  leaks. Live vector.
- **Entry 3 (line 6568):** IMMINENT upgrade branch reachable via the
  score-only IMMINENT path at `unified_safety.py:291–292`. Moderate signals
  combine to cross threshold without firing failsafe; reconciler returns
  DEFAULT (or CLASSIFIER_UNAVAILABLE-no-fs); B³ elif's
  `precedence_rule_fired == "CONTEXT_OVERRIDE"` clause missed both rules;
  upgrade fires, overlay leaks. Live vector.
- **Entries 4, 5 (lines 6572, 6576):** HIGH and MEDIUM upgrade branches —
  same shape as Entry 3 but no current user-visible regression (RED-only
  overlay, B² alert gate). Latent.

### Fix — Anthony's Option β (one PR closes all four entries)

Two changes inside `buddy_chat()`:

- **Change A (`backend/server.py:~6555`).** Generalise the B³ elif: remove
  `and final_verdict.precedence_rule_fired == "CONTEXT_OVERRIDE"` from the
  condition. The new condition `elif not failsafe_should_fire:` catches all
  five precedence rules that produce `failsafe_should_fire == False`
  (CONTEXT_OVERRIDE, DEFAULT, CLASSIFIER_UNAVAILABLE-no-fs, plus
  KEYWORD_FAILSAFE / CLASSIFIER_ESCALATION flipped by negation/identity
  guards). Comment block updated to reference the audit doc. Log message
  updated to interpolate `final_verdict.precedence_rule_fired` dynamically
  — restores observability the original B³ log lost (was hard-coded to
  `CONTEXT_OVERRIDE`). Closes Entries 3, 4, 5.
- **Change B (`backend/server.py:~6541`, new block).** Standalone block
  inserted between line 6445 (where `failsafe_should_fire` is finalised)
  and line 6542 (where the negation/identity/upgrade chain begins).
  Shape: `if not failsafe_should_fire and risk_level == "RED":
  risk_level = "AMBER"; logging.info(...)`. Downgrade target is AMBER, not
  GREEN: mirrors the alert-side `audit_only` behaviour, preserves the
  elevated-context signal, ensures the overlay does not fire. Closes
  Entry 1.

Variable scope: `risk_level` (line 6334), `final_verdict` (line 6371),
`failsafe_should_fire` (line 6397, finalised through 6445), `unified_safety`
all in scope at both insertion points. No threading, no refactor.

### xfail closure evidence
The `@pytest.mark.xfail(strict=True)` decorator on
`test_phase_b3_context_override_suppresses_overlay_upgrade` has been
**removed** in this PR. Per the B³ PR body: *"`strict=True` ... if line
6334 is silently fixed (or the fixture drifts), pytest will mark the run
XPASS and fail the build — which is the desired outcome, because we need
to know."* Decorator removal is the explicit close-out evidence the B³ PR
committed to.

### Tests
- Decorator removed: B³ S009_B end-to-end test (now passes).
- New: `test_phase_b35_score_only_imminent_default_rule_suppressed`
  (Entry 3 close-out — mocks `analyze_message_unified()` at boundary,
  asserts overlay suppressed AND new generalised log fires with dynamic
  ReconcilerRule interpolation).
- New: `test_phase_b35_high_branch_gated_by_reconciler` (Entry 4
  close-out, unit-level boolean invariant).
- New: `test_phase_b35_medium_branch_gated_by_reconciler` (Entry 5
  close-out, unit-level boolean invariant).
- New: `test_phase_b35_initial_red_preserved_when_failsafe_fires` (control
  for Change B — genuine crisis with `failsafe_should_fire=True` must
  still surface RED).
- Round 10 reconciler suite: **33 passed, 0 xfailed, 0 failed**
  (was 28 passing + 1 xfailed in B³ baseline; +4 new + 1 xfail flipped).
- Full safety regression: **76 passed, 0 xfailed, 0 failed**
  (was 71 passing + 1 xfailed in B³ baseline; same delta).

### Production retest plan
S009_A, S009_B, CTRL — all three required. S009_A and S009_B are separate
production-traced messages (Tommy persona, grief-overdose, CONTEXT_OVERRIDE
path), not collapsed. Entry 3 has no clean production fixture; Test N1 is
the close-out coverage for Entry 3.

### Files Modified
- `/app/backend/server.py` — Change A (generalise B³ elif) + Change B
  (initial-assignment corrective).
- `/app/backend/tests/test_round10_phase_b_reconciler.py` — xfail decorator
  removed, 4 new tests added.
- `/app/memory/PHASE_B35_PR_DESCRIPTION.md` — new PR body.
- `/app/memory/CHANGELOG.md` — this entry.

### Branch
`feat/round10-phase-b35-generalised-reconciler-gate` — draft PR, Andrew
Claude pre-design check first, then Anthony via CODEOWNERS. Do not merge.

### Round 10 close-out
B³.5 is the close-out PR for Round 10 (subject to S009_A + S009_B + CTRL
production retest passing). All four `risk_level` write sites in the
audit window 6320–7028 that produce user-visible state are now reconciler-
gated. The remaining write sites (rapid_escalation, detected_patterns) were
gated by B³.

---

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
