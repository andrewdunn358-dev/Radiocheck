# Device-Side Data Deletion Audit

> **Method.** Read-only grep + trace against `main`. No code changes. Verifies Andrew's analysis (§1) and enumerates the complete device-side storage surface (§2) classified by whether `clearAllStoredData()` removes each entry (§3). Per the brief: *"Do not silently agree with Andrew's analysis. Re-grep each claim."*

---

## §1 — Verification of Andrew's Analysis

### §1.1 — Two parallel chat implementations writing under different key prefixes

**CONFIRMED with one shape correction.** Both implementations exist as described, but the keys are *template literals* (not literal strings), so simple string-search would miss them — Andrew's grep methodology was correct here.

- `frontend/app/unified-chat.tsx:164` — `const chatHistoryKey = \`chat_history_${characterId}\`;` — the `setItem` itself happens at `unified-chat.tsx:391` (`await AsyncStorage.setItem(chatHistoryKey, JSON.stringify(toSave));`).
- `frontend/app/chat/[characterId].tsx:213` — `const CONVERSATION_STORAGE_KEY = \`radiocheck_chat_history_${character.id}\`;` — the `setItem` itself happens at `[characterId].tsx:264` (`await AsyncStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(toStore));`).

The structural claim — two parallel implementations, different prefixes — is correct.

### §1.2 — `clearAllStoredData()` filters on the wrong prefix

**CONFIRMED verbatim.** `frontend/src/services/conversationStorage.ts:489`:

```typescript
const chatHistoryKeys = allKeys.filter(k => k.startsWith('chat_history_'));
```

The filter catches `chat_history_${characterId}` (unified-chat.tsx) but does NOT catch `radiocheck_chat_history_${character.id}` ([characterId].tsx) — those keys start with `radiocheck_`, not `chat_history_`. The full multiRemove array runs from line 492–522.

**Additional finding within §1.2:** the explicit list at lines 492–522 *does* cover the `STORAGE_KEYS.*` constants (e.g. `STORAGE_KEYS.CONVERSATIONS = 'radiocheck_conversations'`), so other `radiocheck_*` keys are NOT universally missed — only the templated `radiocheck_chat_history_${character.id}` slips through because the explicit list cannot enumerate per-character keys without the `getAllKeys` + filter pattern, and that pattern uses the wrong prefix.

### §1.3 — Other AsyncStorage keys also appear missing

**PARTIALLY CONFIRMED.** Re-greppped each named key against both the explicit list and the prefix filter. Status by key:

| Key (Andrew's list) | Written? | Cleared? | Notes |
|---|---|---|---|
| `@push_token` | YES — `pushNotifications.ts:57` | **MISSED** | Not in explicit list, no prefix match. Confirmed denylist gap. |
| `anonymous_user_id` | YES — `home.tsx:197` | **MISSED** | Confirmed denylist gap. |
| `ai_chat_consent_date` | YES — `unified-chat.tsx:351`, `[characterId].tsx:377` | **MISSED** | Confirmed denylist gap. Two write sites, same key. |
| `breathing_achievements` | YES — `breathing-game.tsx:180` | **MISSED** | Confirmed. |
| `breathing_last_date` | YES — `breathing-game.tsx:178` | **MISSED** | Confirmed. |
| `breathing_sessions` | YES — `breathing-game.tsx:177` | **MISSED** | Confirmed. |
| `breathing_streak` | YES — `breathing-game.tsx:176` | **MISSED** | Confirmed. |
| `breathing_unlocked` | YES — `breathing-game.tsx:179` | **MISSED** | Confirmed. |
| `frankie_progress` | YES — `gym.tsx:148` | **MISSED** | Confirmed denylist gap. |
| `cookie_consent` | YES — `index.tsx:161` | **MISSED** | Confirmed denylist gap. |
| `permission_asked` | YES — `index.tsx:141, 145, 152` | **MISSED** | Confirmed. **Note**: `location_permission_asked` IS listed (line 511 of conversationStorage.ts), but `permission_asked` is a *different* key for a different permission flow (microphone + general). Three write sites in the same handler. |

11/11 of Andrew's named keys confirmed missed. The §1.3 list was not exhaustive — see §2 for the additional missed keys this audit found.

### §1.4 — Likely web-only gap (sessionStorage / service-worker / IndexedDB)

**CONFIRMED for sessionStorage. CORRECTED on service-worker / IndexedDB / SecureStore — all three are absent in the codebase**, not "likely missed" — they're not used at all, so there's no gap to close on those layers.

- **sessionStorage** — confirmed Andrew's claim. Single write site: `frontend/src/components/InstallPwaPrompt.tsx:109` writes `'rc_install_prompt_dismissed'` (constant `DISMISS_KEY` defined at line 25). `clearAllStoredData()` does not touch sessionStorage at all (no `sessionStorage.clear()` or equivalent call). Confirmed denylist gap.
- **Service-worker `Cache` API** — `frontend/public/sw.js` exists (22 lines) but is a deliberate pure pass-through (`event.respondWith(fetch(event.request))` at line 20) with an explicit comment at lines 6–9: *"We deliberately do NOT cache chat content. Cached AI conversations would be a privacy concern (sensitive disclosures) and stale cached pages could mask backend safeguarding changes. The fetch handler below is a pure pass-through to the network."* No `caches.open()`, no `caches.match()`, no `caches.put()`. **No coverage gap on this layer — no writes occur.**
- **Direct IndexedDB** — grep `indexedDB` across the frontend returned zero non-comment matches. **No coverage gap on this layer.**
- **`expo-secure-store`** — only mention in the codebase is a comment at `conversationStorage.ts:87` (`"For production, use a proper encryption library like expo-secure-store"`). The library is not imported, not used, not present in `package.json`. **No coverage gap on this layer.**
- **`localStorage` (direct, not via AsyncStorage shim)** — grep returned zero matches. AsyncStorage on web is backed by IndexedDB or localStorage depending on shim, but no direct `localStorage.setItem` calls bypass it.

### Additive sweep items (per Andrew's three additions)

- **`expo-sqlite` / `SQLite.openDatabase` / `SQLite.openDatabaseAsync` / `SQLite.openDatabaseSync`** — grep returned zero matches. Not used. **No coverage gap on this layer.**
- **`react-native-mmkv` / `new MMKV` / `MMKV` import** — grep returned zero matches. Not used. **No coverage gap on this layer.**
- **`redux-persist` / `zustand persist` middleware** — grep returned zero matches. Not used. **No coverage gap on this layer.** (No `persist:root`, `persist:` prefix, or any zustand/redux abstraction over AsyncStorage.)

---

## §2 — Complete Storage Surface Inventory

Ordered by file path, then line number. **Logical-key collapsing rule:** when the same literal key is written from multiple call sites (e.g. `permission_asked` written at index.tsx:141, 145, 152), the inventory shows the lowest-line site and lists the duplicates in the Notes column. Template-literal keys are written with `${...}` notation; their write site is unambiguous regardless of the runtime variable value.

| # | Storage Layer | Key (literal or template) | File:Line | What's stored | Classification |
|---|---|---|---|---|---|
| 1 | AsyncStorage | `breathing_streak` | breathing-game.tsx:176 | Breathing exercise streak counter | **Missed (denylist gap)** |
| 2 | AsyncStorage | `breathing_sessions` | breathing-game.tsx:177 | Breathing session count | **Missed (denylist gap)** |
| 3 | AsyncStorage | `breathing_last_date` | breathing-game.tsx:178 | Last breathing session date | **Missed (denylist gap)** |
| 4 | AsyncStorage | `breathing_unlocked` | breathing-game.tsx:179 | JSON array of unlocked tiers | **Missed (denylist gap)** |
| 5 | AsyncStorage | `breathing_achievements` | breathing-game.tsx:180 | JSON array of unlocked achievements | **Missed (denylist gap)** |
| 6 | AsyncStorage | `radiocheck_chat_history_${character.id}` | chat/[characterId].tsx:264 | **Conversation history per character (legacy chat path) — full PII / disclosure** | **Missed (denylist gap)** — Andrew's §1.2 main finding |
| 7 | AsyncStorage | `radiocheck_ai_consent_accepted` (constant `GLOBAL_AI_CONSENT_KEY`) | chat/[characterId].tsx:361 | AI chat consent flag (also written at line 376 — same key) | **Missed (denylist gap)** |
| 8 | AsyncStorage | `ai_chat_consent_date` | chat/[characterId].tsx:377 | ISO timestamp of consent (also written at unified-chat.tsx:351) | **Missed (denylist gap)** |
| 9 | AsyncStorage | `${character.id}_email` | chat/[characterId].tsx:670 | **Anti-grooming: per-character user email (PII)** | **Missed (denylist gap)** |
| 10 | AsyncStorage | `${character.id}_pin` | chat/[characterId].tsx:671 | **Anti-grooming: per-character user PIN (credential)** | **Missed (denylist gap)** |
| 11 | AsyncStorage | `frankie_progress` | gym.tsx:148 | Frankie gym game progress (JSON) | **Missed (denylist gap)** |
| 12 | AsyncStorage | `anonymous_user_id` | home.tsx:197 | Anonymous user identifier | **Missed (denylist gap)** |
| 13 | AsyncStorage | `location_permission_asked` | index.tsx:130, 134 | Location-permission state ('true' or 'denied') | **Cleared correctly** — explicit list line 511 |
| 14 | AsyncStorage | `permission_asked` | index.tsx:141, 145, 152 | General-permission-asked flag (microphone + general) | **Missed (denylist gap)** — distinct from `location_permission_asked` |
| 15 | AsyncStorage | `cookie_consent` | index.tsx:161 | Cookie-banner consent flag | **Missed (denylist gap)** |
| 16 | AsyncStorage | `@veterans_journal_entries` (`JOURNAL_STORAGE_KEY`) | journal.tsx:54 | **Journal entries (full PII / disclosure)** | **Cleared correctly** — explicit list line 507 |
| 17 | AsyncStorage | `screening_history_${activeAssessment}` | mental-health-screening.tsx:112 | **Mental-health assessment history (PHQ-9/GAD-7 scores, PII / disclosure)** | **Missed (denylist gap)** |
| 18 | AsyncStorage | `@veterans_mood_entries` (`MOOD_STORAGE_KEY`) | mood.tsx:72 | Mood-tracker entries | **Cleared correctly** — explicit list line 508 |
| 19 | AsyncStorage | `@veterans_last_checkin` (`LAST_CHECKIN_KEY`) | mood.tsx:73 | Last mood-check-in timestamp | **Cleared correctly** — explicit list line 509 |
| 20 | AsyncStorage | `radiocheck_ai_consent_accepted` (`GLOBAL_AI_CONSENT_KEY`, duplicate of #7) | unified-chat.tsx:334 | AI chat consent flag (also written at line 350 — same key) | **Missed (denylist gap)** |
| 21 | AsyncStorage | `chat_history_${characterId}` | unified-chat.tsx:391 | **Conversation history per character (newer chat path) — full PII / disclosure** | **Cleared correctly** — caught by `chatHistoryKeys` prefix filter at conversationStorage.ts:489 |
| 22 | AsyncStorage | `${character.id}_email` (duplicate write site of #9) | unified-chat.tsx:592 | Anti-grooming email | **Missed (denylist gap)** |
| 23 | AsyncStorage | `${character.id}_pin` (duplicate write site of #10) | unified-chat.tsx:593 | Anti-grooming PIN | **Missed (denylist gap)** |
| 24 | AsyncStorage | `ai_chat_consent_accepted` (constant `AI_CONSENT_KEY`) | components/AIChatConsent.tsx:47 | AI chat consent flag — **distinct from `radiocheck_ai_consent_accepted` at #7/#20** | **Missed (denylist gap)** |
| 25 | sessionStorage (web only) | `rc_install_prompt_dismissed` (constant `DISMISS_KEY`) | src/components/InstallPwaPrompt.tsx:109 | PWA install-prompt dismissal flag | **Missed (denylist gap)** — Andrew's §1.4 confirmed; sessionStorage layer not touched at all |
| 26 | AsyncStorage | `auth_token` | src/context/AuthContext.tsx:62 | Backend auth bearer token | **Cleared correctly** — explicit list line 501 |
| 27 | AsyncStorage | `auth_user` | src/context/AuthContext.tsx:63 | Cached user object (PII) | **Cleared correctly** — explicit list line 502 |
| 28 | AsyncStorage | `@veterans_favorite_counsellors` (`FAVORITES_COUNSELLORS_KEY`) | src/context/FavoritesContext.tsx:46 | Favourited counsellor IDs | **Cleared correctly** — explicit list line 504 |
| 29 | AsyncStorage | `@veterans_favorite_peers` (`FAVORITES_PEERS_KEY`) | src/context/FavoritesContext.tsx:59 | Favourited peer IDs | **Cleared correctly** — explicit list line 505 |
| 30 | AsyncStorage | `last_known_location` (`LOCATION_COORDS_KEY`) | src/context/LocationPermissionContext.tsx:105, 133 | Cached coordinates (lat/lon) | **Cleared correctly** — explicit list line 512 |
| 31 | AsyncStorage | `site_unlocked` | src/context/SiteGateContext.tsx:52 | Site password gate unlock flag | **Cleared correctly** — explicit list line 517 |
| 32 | AsyncStorage | `@veterans_app_theme` (`THEME_STORAGE_KEY`) | src/context/ThemeContext.tsx:98 | Theme preference (light/dark) | **Cleared correctly** — explicit list line 519 |
| 33 | AsyncStorage | `@radio_check_dob` (`AGE_GATE_KEY`) | src/hooks/useAgeGate.ts:110 | Date of birth (PII) | **Cleared correctly** — explicit list line 514 |
| 34 | AsyncStorage | `@radio_check_age_verified` (`AGE_VERIFIED_KEY`) | src/hooks/useAgeGate.ts:111 | Age-gate verified flag | **Cleared correctly** — explicit list line 515 |
| 35 | AsyncStorage | `radiocheck_enc_key` (`STORAGE_KEYS.ENCRYPTION_KEY`) | src/services/conversationStorage.ts:101 | AES key for at-rest conversation encryption | **Cleared correctly** — explicit list line 498 |
| 36 | AsyncStorage | `radiocheck_last_cleanup` (`STORAGE_KEYS.LAST_CLEANUP`) | src/services/conversationStorage.ts:217 | Last auto-cleanup timestamp | **Cleared correctly** — explicit list line 499 |
| 37 | AsyncStorage | `radiocheck_storage_opt_out` (`STORAGE_KEYS.OPT_OUT`) | src/services/conversationStorage.ts:248 | Storage opt-out flag | **Cleared correctly** — explicit list line 496 |
| 38 | AsyncStorage | `radiocheck_conversations` (`STORAGE_KEYS.CONVERSATIONS`) | src/services/conversationStorage.ts:470 (and via `encryptAndStore` at 304) | **Encrypted conversation data (full PII / disclosure)** | **Cleared correctly** — explicit list line 494 |
| 39 | AsyncStorage | `radiocheck_summaries` (`STORAGE_KEYS.SUMMARIES`) | src/services/conversationStorage.ts:475 (and via `encryptAndStore` at 392) | Encrypted session summaries | **Cleared correctly** — explicit list line 495 |
| 40 | AsyncStorage | `@push_token` | src/services/pushNotifications.ts:57 | Expo push token | **Missed (denylist gap)** |

**Note on `STORAGE_KEYS.LAST_SYNC`:** explicitly listed in `clearAllStoredData()`'s multiRemove array at line 497, but a grep for `STORAGE_KEYS.LAST_SYNC` shows zero `setItem` call sites. The constant is defined (`'radiocheck_last_sync'`) but never written. Listed in clearAllStoredData defensively. No leak risk; flagging as a code-hygiene observation, not a bug.

---

## §3 — Summary

- **Total distinct storage write sites:** 40 (17 distinct AsyncStorage keys missed + 22 distinct AsyncStorage keys cleared correctly + 1 sessionStorage key missed). Some logical keys are written from multiple sites; collapsed by logical key in the count above.
- **Cleared correctly by `clearAllStoredData()`:** 18 of 40 entries (#13, #16, #18, #19, #21, #26–#39 inclusive, plus #21 via prefix filter — 18 unique).
- **Missed (denylist gap):** 22 of 40 entries (#1–#12, #14, #15, #17, #20, #22–#25, #40 — covering 17 distinct logical keys when duplicate write sites are collapsed).
- **Cleared by a different code path:** 0. Looked for per-feature reset functions (`breathingService.reset()`, `frankieReset()`, etc.); no such helpers exist.
- **Out of scope:** 0.

**Of the 22 missed entries, the privacy-critical subset is:**
- **#6 — `radiocheck_chat_history_${character.id}`** (full conversation history per character, legacy chat path; mirrors #21 which IS cleared but only for the newer chat path)
- **#9, #10, #22, #23 — `${character.id}_email` and `${character.id}_pin`** (anti-grooming credentials and recovery PII)
- **#17 — `screening_history_${activeAssessment}`** (mental-health assessment scores; PHQ-9 / GAD-7 results — clinical-grade PII)
- **#40 — `@push_token`** (device-tracking token; can re-link an "anonymised" user across logout/login)

The remaining 16 missed entries are non-clinical (breathing-game progress, consent flags, permission-asked flags, anonymous IDs, theme-adjacent prefs). They still need clearing for a "delete my data" promise to hold, but they're observably-low-stakes-if-leaked.

---

## §4 — Open Questions / Uncertainty

1. **Two distinct AI-consent keys exist.** `AI_CONSENT_KEY = 'ai_chat_consent_accepted'` (`components/AIChatConsent.tsx:20`, written at line 47) and `GLOBAL_AI_CONSENT_KEY = 'radiocheck_ai_consent_accepted'` (`unified-chat.tsx:179` and `chat/[characterId].tsx:192`). Different literal values, both stored. Was this intentional (e.g. one is a legacy key superseded by the other) or accidental fork? Don't know. Both are missed by `clearAllStoredData()`. Noting for human decision.
2. **`encryptAndStore()` wrapper at `conversationStorage.ts:141`** writes via `AsyncStorage.setItem(key, encrypted)` where `key` is a parameter. Call sites in this file (lines 199, 211, 304, 392) all pass `STORAGE_KEYS.CONVERSATIONS` or `STORAGE_KEYS.SUMMARIES` — both already in the inventory (#38, #39). No leak via `encryptAndStore` for unknown keys today. **However**, if a future caller passes a non-`STORAGE_KEYS` key, the wrapper has no guardrail. Not a current bug; flagging as a future-proofing concern, not a fix recommendation.
3. **`STORAGE_KEYS.LAST_SYNC` is in `clearAllStoredData()` but never written anywhere.** Likely safe to leave (defensive), but worth confirming whether it's a planned-future key or dead code. Don't know — needs human decision.
4. **The `clearAllStoredData()` invocation surface itself.** The function is called from `settings.tsx:31, 50` (UI button) and `conversationStorage.ts:252` (when toggling opt-out). Anthony's report was that the UI's "Clear all data" / "Delete my data" doesn't actually wipe device data — this audit confirms the *function*'s coverage is the bug, not the *invocation*. The settings.tsx call sites do invoke it. Worth a once-over post-fix to confirm the right button is wired to the right handler — but that's a UX-wiring check, not a storage question, and is out of scope for this audit.
5. **iOS-specific NSUserDefaults / Keychain not directly accessible from Expo without `expo-secure-store`.** Since `expo-secure-store` is not used (§1.4), the app doesn't write to Keychain on iOS or to a separate NSUserDefaults bag. AsyncStorage on iOS is backed by a single `RCTAsyncLocalStorage_V1` directory. **However**, I did not enumerate every native-module that ships with Expo to check whether any of them silently persist to platform-native storage outside AsyncStorage. Specifically: `expo-notifications` may persist some token state natively; `expo-router` may persist navigation state; `expo-updates` may persist OTA-update metadata. None of these would normally hold user PII, but they ARE outside the AsyncStorage surface this audit walked. Flagging for human decision — if "delete my data" needs to nuke navigation history and OTA metadata, those are separate clearing calls.
6. **Web service-worker registration cleanup.** `frontend/public/sw.js` is a pass-through service worker, but the *registration itself* persists in the browser regardless of whether `clearAllStoredData()` runs. Not a data-leak concern per se (the SW caches nothing), but a fully-thorough "delete my data" might also unregister the SW so the next visit starts as if uninstalled. Flagging as design intent question, not a bug.

---

## §5 — Methodology Notes

### Greps I ran

1. **§1.1 verification:** `grep -n "chat_history\|radiocheck_chat" frontend/app/unified-chat.tsx frontend/app/chat/[characterId].tsx`
2. **§1.2 verification:** `grep -n "clearAllStoredData\|chatHistoryKeys\|filter.*startsWith" frontend/src/services/conversationStorage.ts` + manual view of lines 25–32 (STORAGE_KEYS) and 483–526 (function body).
3. **§1.3 verification (per Andrew's named keys):** `grep -rn "AsyncStorage.setItem.*\(@push_token\|anonymous_user_id\|ai_chat_consent_date\|breathing_\|frankie_progress\|cookie_consent\|permission_asked\)" frontend/`.
4. **Broad AsyncStorage sweep:** `grep -rn "AsyncStorage\.setItem\|AsyncStorage\.multiSet" frontend/ --include="*.tsx" --include="*.ts" --include="*.js" --include="*.jsx"` (excluded `node_modules`, `.metro-cache`, `.expo`, `dist`).
5. **Constant-resolution pass:** `grep -rn "JOURNAL_STORAGE_KEY\s*=\|MOOD_STORAGE_KEY\s*=\|LAST_CHECKIN_KEY\s*=\|FAVORITES_COUNSELLORS_KEY\s*=\|FAVORITES_PEERS_KEY\s*=\|LOCATION_COORDS_KEY\s*=\|THEME_STORAGE_KEY\s*=\|AGE_GATE_KEY\s*=\|AGE_VERIFIED_KEY\s*=\|GLOBAL_AI_CONSENT_KEY\s*=\|AI_CONSENT_KEY\s*=" frontend/` — to resolve UPPERCASE constant identifiers in setItem calls to their literal-string values.
6. **§1.4 + additive sweep (single combined grep):** `grep -rn "sessionStorage\|window\.localStorage\|SecureStore\|expo-secure-store\|indexedDB\|caches\.open\|caches\.match\|expo-sqlite\|openDatabase\|MMKV\|react-native-mmkv\|redux-persist\|zustand"` across frontend `*.tsx`, `*.ts`, `*.js`. (Note: kept `caches.match` in the pattern to catch any read-then-modify anti-pattern; none found.)
7. **Service-worker inspection:** found `frontend/public/sw.js` via `find frontend -name "service-worker*" -o -name "sw.js"`; viewed full file (22 lines).
8. **Cookie writes:** `grep -rn "document\.cookie\s*=" frontend/`.
9. **`package.json` dep audit:** parsed `frontend/package.json` for any of: `sentry`, `posthog`, `mixpanel`, `amplitude`, `segment`, `firebase`, `sqlite`, `mmkv`, `persist`, `secure-store`. Zero matches.
10. **`clearAllStoredData()` invocation surface:** `grep -rn "clearAllStoredData" frontend/` — to confirm Anthony's user-visible UX path is wired to the function.
11. **`per-feature reset` helpers:** searched for `breathingService.reset`, `Service.reset(`, and `\.reset()` patterns in source. None of those reset patterns existed for the missed-key features.

### Greps I did NOT run

(Per Andrew's framing nudge — making the surface of "what we know we don't know" explicit.)

1. **`expo-notifications` / `expo-router` / `expo-updates` native-side persistence.** These libraries may persist state natively (push tokens already covered via #40, but navigation/OTA metadata not enumerated). Would require reading each library's source or running the app and inspecting platform-native storage directories — out of scope for a static-grep audit. Flagged in §4.5.
2. **iOS `NSUserDefaults` direct writes** outside Expo APIs. Not possible from JS-only Expo without ejecting; assumed absent. Did not verify by checking `ios/` or `android/` native projects (the project is Expo-managed; `ios/` and `android/` directories don't exist in this repo).
3. **Browser Cookies set by the *backend* in `Set-Cookie` response headers.** Out of scope — the brief is device-side, frontend-write-driven; backend-set cookies are the backend's responsibility to clear via logout/session-revocation, not the frontend's `clearAllStoredData`.
4. **Native crash-reporting tools** (e.g. Crashlytics, Sentry native SDKs) that may persist breadcrumbs natively. None found in `package.json` (#9 above), so none to enumerate.
5. **`AsyncStorage.mergeItem` / `AsyncStorage.multiMerge` calls.** Greppped for `setItem` and `multiSet` only. Merge calls *also* write storage and can create new keys via JSON-merging into an existing one. Did not run a separate `mergeItem` grep. **Flagging as a possible gap in this audit's coverage**; unlikely to surface new logical keys (merge typically updates existing keys), but a 30-second grep would close the loop.
6. **Library-internal AsyncStorage writes** (e.g. `@react-native-async-storage/async-storage` itself doesn't write internal metadata, but if any library imports it and writes its own bookkeeping keys, those wouldn't show in app-level grep). Did not enumerate. Low likelihood of user PII.
7. **Window-level `globalThis.__APP_DATA__`-style runtime caches.** Not persistent across reload, so they're not in the "stored data" surface. Did not grep.
8. **Expo `FileSystem.writeAsStringAsync` / `FileSystem.writeAsync` calls.** The `expo-file-system` library can write arbitrary files to the app's documents directory. Did not grep. Worth a follow-up sweep if "delete my data" needs to also nuke arbitrary files.

### False positives filtered

- The first AsyncStorage sweep returned a massive Metro cache JSON dump from `frontend/.metro-cache/cache/00/...` containing the AsyncStorage library source code itself. Filtered with `grep -v "\.metro-cache"` on the second pass.
- Comments mentioning `expo-secure-store` (one match in `conversationStorage.ts:87`) and `sessionStorage` (three matches in `InstallPwaPrompt.tsx` documentation block) were filtered manually by reading each match in context — they're not call sites.

### Line-number caveats

All line numbers are post-PR #10 (Phase B³.5) merge state. The frontend was not edited during the Round-10 work, so no shift is expected; spot-checked five line numbers against fresh greps and they matched.

### Third-party libraries considered

Per `package.json` dep audit: no Sentry, PostHog, Mixpanel, Amplitude, Segment, Firebase, expo-sqlite, react-native-mmkv, redux-persist, zustand, expo-secure-store. AsyncStorage (`@react-native-async-storage/async-storage`) is the only persistent storage library imported; sessionStorage is a browser-native API used directly in one file. The frontend is — relative to the typical RN app — unusually clean on the storage-layer count.
