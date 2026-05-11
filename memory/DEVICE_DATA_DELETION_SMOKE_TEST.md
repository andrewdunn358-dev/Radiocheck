# Device-Data-Deletion Fix — Manual Smoke Test Procedure

> **Why this is a manual procedure rather than an automated test:** the frontend has no test framework configured (no `jest`, no `vitest`, no `@testing-library`, no `test` script in `package.json`). Per the fix brief §6: *"Test 1 in §2.3 is non-negotiable. Even if other test infrastructure isn't there yet, this test must run somehow (manual smoke test if no automated suite)."* §7 of the brief explicitly authorises surfacing the missing framework rather than adding one (out of scope).
>
> The procedure below is the manual equivalent of the §2.3 Test 1 specification. It verifies the only assertion that brief deemed non-negotiable: **`AsyncStorage.getAllKeys()` returns an empty array (or only `KEYS_TO_PRESERVE` entries) after `clearAllStoredData()`**.
>
> Run this once on the deployed preview before requesting Andrew's pre-push design check, and once more on production after deploy as the close-out gate.

---

## Procedure

### Setup (≈3 minutes)

1. Open the deployed Radio Check preview in a fresh browser session (incognito / private window).
2. Open browser DevTools → Application tab → IndexedDB → look for `RKStorage` (the AsyncStorage backing store on web). If absent, AsyncStorage hasn't been touched yet — that's fine.
3. Use the app to write data across as many of the storage surfaces as possible:
   - Pass the age gate.
   - Pass the site password gate.
   - Have a chat with Tommy (the unified-chat path — writes `chat_history_${characterId}`).
   - Have a chat with another character via the legacy chat route if reachable (writes `radiocheck_chat_history_${character.id}`).
   - Write a journal entry (`@veterans_journal_entries`).
   - Log a mood (`@veterans_mood_entries`, `@veterans_last_checkin`).
   - Open the breathing game and complete one round (`breathing_*` keys).
   - Open Frankie / gym (`frankie_progress`).
   - Toggle a theme preference (`@veterans_app_theme`).
   - Favourite a counsellor and a peer (`@veterans_favorite_*`).
   - Trigger the cookie-consent banner (`cookie_consent`).
   - Trigger the location permission flow (`location_permission_asked` and/or `last_known_location`).
   - Trigger the install-PWA prompt and dismiss it (`rc_install_prompt_dismissed` in `sessionStorage`).

### Pre-clear assertion

4. In the DevTools console, run:
   ```javascript
   const ks = await (await import('@react-native-async-storage/async-storage')).default.getAllKeys();
   console.log('Pre-clear AsyncStorage keys:', ks.length, ks);
   console.log('Pre-clear sessionStorage keys:', Object.keys(window.sessionStorage));
   ```
   Expected: a non-empty array of AsyncStorage keys (typically ≥10 if you exercised the surfaces above), and `['rc_install_prompt_dismissed']` (or similar) in sessionStorage.
   
   *Note:* if the console import path doesn't resolve in the bundled web app, run the same getAllKeys check via a temporary debug button in dev mode, or use the "Storage" panel in DevTools to enumerate IndexedDB→`RKStorage`→`catalystLocalStorage` entries.

### Trigger deletion

5. Settings → "Clear All Data" (now decorated with `data-testid="clear-all-data-btn"`).
6. Confirm in the modal/native dialog.
7. Wait for the success toast / alert ("All local data has been deleted. You are starting fresh.").

### Post-clear assertion (THE TEST)

8. **Without reloading the page**, run in DevTools console:
   ```javascript
   const ks = await (await import('@react-native-async-storage/async-storage')).default.getAllKeys();
   console.log('Post-clear AsyncStorage keys:', ks.length, ks);
   console.log('Post-clear sessionStorage keys:', Object.keys(window.sessionStorage));
   ```
   
   **Expected:**
   - AsyncStorage: `0` keys, OR keys consisting only of items in `KEYS_TO_PRESERVE` (currently empty by design — so 0 is the only acceptable outcome).
   - sessionStorage: `0` keys (no `rc_install_prompt_dismissed`).

9. **Reload the page** and verify:
   - Site password gate prompts you (because `site_unlocked` is gone).
   - Age gate prompts you (because `@radio_check_dob` and `@radio_check_age_verified` are gone).
   - Chat history with Tommy shows fresh — no prior messages.
   - Journal is empty.
   - Mood tracker shows no history.
   - Theme reset to default (whichever `useColorScheme()` reports).
   - PWA install prompt re-appears (because `rc_install_prompt_dismissed` is gone).

If all 11 expected outcomes hold (8 asserted + 3 follow-up reload checks), the fix is verified. If ANY asserted outcome differs, do not push — surface the deviation.

### Failure modes to watch for

- **AsyncStorage post-clear count > 0:** the allowlist filter let something through. Read `keysToRemove` vs `allKeys` in the function and check for a key that crashed during `multiRemove` (it should fail-loud via the `console.error` in the catch block).
- **sessionStorage post-clear count > 0:** the `window.sessionStorage` undefined-check is too restrictive, OR the `clear()` call itself threw and was logged but ignored. Check the console for the `[ConversationStorage] sessionStorage clear failed:` warning.
- **Reload doesn't re-prompt for age/site gate:** there's a separate persistence layer this audit missed. Document the surface and surface to Andrew before pushing.

---

## §2 — Coverage notes

This procedure covers Test 1 from the brief's §2.3 (the non-negotiable test). It does NOT automate the other tests Andrew listed (sessionStorage cleared, regression test for one preserved key once `KEYS_TO_PRESERVE` is non-empty, no exception thrown). Those are implicit assertions inside the manual reload check (step 9) — if any preserved key were specified and survived, you'd see its effects on reload — but they're not separable test cases without a framework.

When a frontend test framework is added (separate scope decision, future round), this procedure should be replaced with `@testing-library/react-native` + `jest` automated tests asserting the same invariants.

---

## §3 — Coverage gaps Andrew flagged in the audit

The procedure does NOT verify the §4 open questions from the audit (those are out of scope of "deletion works"):
- `expo-notifications` / `expo-router` / `expo-updates` native-side persistence (audit §4.5)
- Service-worker registration cleanup (audit §4.6)
- `AsyncStorage.mergeItem` / `multiMerge` calls (audit §5 grep gap)
- `expo-file-system` arbitrary file writes (audit §5 grep gap)

These remain as audit-doc-tracked concerns. If any is later promoted to a fix, that's a separate brief.

---

## Granular Chat History Deletion

> **Scope:** Verifies the new `clearChatHistoryOnly()` granular control alongside the existing nuclear `clearAllStoredData()`. This is the post-merge / production smoke test referenced in `emergent-brief-granular-chat-deletion-direct-to-main.md` §3.

### Pre-action setup

1. Open the production URL in incognito / private mode.
2. Complete site-unlock + age gate + AI consent.
3. Have a chat exchange with at least one persona (writes `chat_history_*` keys).
4. Optionally start a chat with a second persona via the legacy chat path if reachable (writes `radiocheck_chat_history_*` keys).
5. DevTools → Application → IndexedDB (`RKStorage`) and confirm `chat_history_*` and/or `radiocheck_chat_history_*` keys exist alongside other keys (`@radio_check_dob`, `site_unlocked`, etc.).

### Action

Settings → **Delete chat history** → confirm dialog → confirm.

### Post-action assertions

- `chat_history_*` keys are gone.
- `radiocheck_chat_history_*` keys are gone.
- `radiocheck_conversations` and `radiocheck_summaries` keys are gone.
- Everything else is *still there*: `site_unlocked`, `@radio_check_dob`, `@radio_check_age_verified`, AI consent keys, theme, etc.
- Reload the page: site stays unlocked, age gate does NOT re-prompt, AI consent does NOT re-prompt.
- Open a chat with the same persona: opens fresh, no prior conversation visible.
- `sessionStorage` is *not* cleared (intentional — that's `clearAllStoredData`'s job).

### Negative test

Trigger **Delete chat history** when no chat history is present → confirm no error, no crash, button just succeeds quietly.

### Sanity-check the nuclear option

Re-run the existing **Clear All Data** action and confirm it still wipes everything per the §2 procedure above. Adding the granular function must not have broken the nuclear one.
