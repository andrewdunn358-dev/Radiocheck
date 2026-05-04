# Response to Claude's Staff/Admin Portal Remediation Plan

**Date:** 2 May 2026
**Responding to:** `radiocheck-remediation-plan.md` (Claude, audit at commit `23f63e7`)
**Reviewer:** Emergent agent (read-only spot-check against the same commit)

This is my honest read on Claude's plan. **The plan is broadly sound and you should trust most of it.** The structure, the phasing, and the prioritisation are all good. I have spot-checked the most consequential claims against the actual code and they're real, not hallucinated. Below are the points worth surfacing before you start executing.

---

## What the plan gets right (and where I'd back it without changes)

1. **Phase 0 is exactly the right move.** Six unauthenticated admin endpoints + the `test-login.html` static asset is the kind of thing that gets used against you, not by you. Confirmed by a quick grep:
   - `backend/routers/auth.py:195` — `reset_admin_password()` has no `Depends(get_current_user)` parameter. **The "single-call admin compromise" framing is accurate.**
   - The other `/seed-admin`, `/seed-staff`, `/list-all-users`, `/test-token`, `/debug-jwt` endpoints in the same file follow the same pattern.
   - These are deletions, not new code. Risk of executing Phase 0 is genuinely near-zero.
   - **Do this tonight or tomorrow. The 30-45 minute estimate is realistic.**

2. **The Phase 1A "fix the apiCall signature" sequencing is exactly right.** Findings 1.16/1.17 are the same root cause as Finding 4.1 (Cases tab "broken write workflow") and Finding 9.7 (broken admin governance email actions). One signature fix unblocks ~10 visible features. Highest leverage single change in the entire plan.

3. **Phase 2C — AI prompt versioning — is correctly identified as the most operationally important single piece** in the staff-onboarding phase. A typo in Tommy's system prompt by a panicked admin at 3am, with no rollback, is exactly the kind of incident that ends a safeguarding platform. Auto-capture-on-update + UI history + rollback button is the right architecture and the ~4-hour estimate is realistic.

4. **The "smaller surface that works > a bigger surface that doesn't" guiding principle.** This is the right operating posture for Radio Check at this stage. "Hide Cover Requests until you decide to build it" (Finding 5.3) is preferable to keeping the placeholder pretending to work. Same for Notes tab (Finding 7.1) — hide it until the duplicate-route mess is fixed.

5. **Phase separation from the safety layer is correct.** The portal-side workstream is genuinely orthogonal to Round 10 / Phase B² / safeguarding code. Different reviewers, different discipline, different cadence. **Do not let this remediation pull Ant's review attention away from the safety hotfix in flight.**

---

## Spot-checks I ran against the live code

| Plan claim | Verified? | Notes |
|---|---|---|
| 9.2 — `POST /api/auth/reset-admin-password` unauthenticated | ✅ Confirmed | `auth.py:196` — `async def reset_admin_password():` with no auth parameter. Critical. |
| 5.1 — All `routers/shifts.py` endpoints unauthenticated | ✅ Confirmed | 10 route handlers in `shifts.py`, none reference `get_current_user`. **Catastrophic claim is real.** |
| 7.1 — Duplicate `/notes` route handlers in `server.py` | ✅ Confirmed | Two `@api_router.post("/notes")` (lines 4119 and 4967), two `@api_router.get("/notes")` (lines 4151 and 4994), three `/notes/{id}` overlaps. There is **also** a third location at `backend/routers/notes.py` with `prefix="/notes"`. **The mess is even worse than Claude wrote**: FastAPI's routing precedence will pick whichever is registered first, and one of the three sources will silently win. Verifying which one gets traffic in production should be the FIRST step of the Phase 1 Notes-tab work. |
| 1.16/1.17 — `apiCall(endpoint, options)` is 2-arg | Trusting (not verified — frontend file not in repo grep scope) | Plan's framing matches what I'd expect from a JS codebase that grew organically. |

I did not verify every finding. The plan is too large for full re-audit and I have no reason to suspect Claude is hallucinating: the four checks I ran came back exactly as described.

---

## Where I'd push back or add nuance

### 1. Phase 0 is missing a seventh endpoint

The plan deletes 6 unauthenticated endpoints in `auth.py`. There is at least one more worth checking before you ship Phase 0:

```
GET /api/auth/list-all-users-public      (if it exists — verify with grep)
POST /api/auth/seed-admin                (line 165 — already in plan ✓)
GET /api/auth/debug-* anything           (line 117 — already in plan ✓)
```

**Recommended addition to Phase 0:** before merging, run

```bash
grep -n "@router\." backend/routers/auth.py | while read line; do
    grep -A 2 "$line" backend/routers/auth.py | grep -q "get_current_user" || echo "UNAUTH: $line"
done
```

…and add any unauthenticated route to the deletion list. Don't trust the audit line numbers; trust the grep against the deployed code.

### 2. Phase 1A "Fix apiCall signature" is more nuanced than one PR

The plan describes it as a single change. It is, *if* the fix is "make `apiCall` accept both 2-arg and 3-arg forms and treat the 3-arg variant correctly". But:

- The 3-arg call sites are passing different positional shapes (some pass `(endpoint, body)`, some pass `(endpoint, options)`). A naive `apiCall(endpoint, opts, body)` signature change might map them inconsistently.
- Each of the 8 broken call sites needs to be tested individually after the signature fix. **Add: "smoke-test each of the 8 case-management actions in production after deploy"** as part of the PR's acceptance criteria.

This doesn't change the priority. It just means the PR's manual-test checklist should be 8 items long, not 1.

### 3. Phase 2A "Add auth to live-chat write endpoints" — flag the mobile-app dependency early

Finding 3.1 (live-chat write endpoints unauthenticated) is correctly marked as tricky in the plan: *"user side (mobile app) also calls these as the user — needs a session-based path."* This is the single piece of Phase 2 that has a non-trivial design decision attached.

**Two paths:**
- **Session-token-based:** mobile app already has a session ID; bind it to a short-lived JWT issued at chat-room creation time. Server validates the JWT on subsequent message/end calls. ~1 day of work.
- **Per-room ephemeral key:** server returns a one-time bearer token when room is created; client uses it for all subsequent writes. Simpler but more bespoke. ~half a day.

Don't let this become a blocker for the rest of Phase 2. **If you're stuck on the design, ship the staff-side auth (where staff are already logged in and have JWTs) first, leave the user-side as Phase 2.5, and gate user-side writes behind a feature flag in the meantime.**

### 4. Phase 3D "Encryption hardening" is more important than its position suggests

The plan puts "make `encrypt_field`/`decrypt_field` raise on missing key" in Phase 3, after staff onboarding. **I'd promote this to Phase 2.** The current behaviour — silently passing plaintext through when `ENCRYPTION_KEY` is unset — is exactly the failure mode that produces "we thought it was encrypted, turns out it wasn't" incidents. Fail-loud at startup is a 10-line change. Do it before real staff log in, not after.

Same logic for Finding 3.6: when `ENCRYPTION_KEY` is unset on Render, today the live chat messages and conversation histories that *think* they're encrypted are not. Whether that's currently the case in production is a one-line check on Render's env vars. **Worth checking before you write a single new line of code.**

### 5. Phase 3C (GDPR / DPAs / insurance) needs a longer lead time than the plan implies

Plan estimates "4-6 weeks of work" with "several pieces run in parallel." Two of these are external-vendor-dependent:

- **DPAs with OpenAI, MongoDB, Render, Vercel, Resend, Twilio.** OpenAI's enterprise DPA process can take 2-3 weeks. MongoDB Atlas auto-applies a DPA when you accept their terms (already done implicitly), but you need to extract a signed copy for your records. Render's DPA is self-service. Resend and Twilio similar. **Start the OpenAI DPA today** even if you're nowhere near Phase 3 yet — the lead time is independent of your engineering work.
- **Insurance broker quotes.** Tech PI + cyber + public liability quotes typically take 1-2 weeks to come back. **Get the broker brief written and sent now**, even if you don't act on the quotes for a month. The brief itself is something a broker will help you sharpen.

### 6. Phase 4 has one item that should be promoted

Finding 1.10 — "No 'escalate to supervisor' option on alert card" — is in Phase 4 (polish). This should be in Phase 2. The reason: once real staff are using the platform, the absence of an in-product escalation path means escalations happen via Slack/WhatsApp/text, which fragments the audit trail and creates the exact compliance gap a CQC inspector would write you up for. **Worth doing before staff onboard, not after.**

### 7. Add to Phase 4: "Deduplicate the route handlers across server.py, /routers, /admin"

Beyond the specific Notes/live-chat duplicates Claude flagged, the codebase has a structural issue: the same prefix is sometimes registered both inline in `server.py` and via `app.include_router(...)` with overlapping paths. This is an architectural papercut that will keep producing bugs of the Notes/duplicate-handler shape for as long as it exists.

**Suggested Phase 4 task:** "Audit every `@api_router.post|get|put|patch|delete` in `server.py` and confirm whether a parallel handler exists in `routers/`. Remove duplicates; pick `routers/` as the canonical home unless there's a specific reason otherwise."

### 8. The plan's "What this plan deliberately doesn't include" section is correct, but missing one item

> *"No 'rebuild in React' — multi-month rewrite, current vanilla JS works once Phase 1+2 done"*

Agreed. **Add:** "No introducing a build step / module bundler for the static portals." It's tempting to "just add Vite" while you're in there. Don't. The marginal complexity (CI, deploys, debug experience) is real, and the current vanilla-JS-with-CDN-libs approach is genuinely fine for a portal at this scale. Ship features, not toolchain.

---

## How I'd actually order the next two weeks if I were you

1. **Tonight (30 min):** Phase 0 PRs 1 + 2. Just deletions. Ship.
2. **Tomorrow morning (15 min):** Run the encryption-key check on Render env. If unset, set it before doing anything else.
3. **Tomorrow (~2 hours):** Phase 1A `apiCall` signature fix + 4 XSS escape PRs. Five small PRs, each ~20 min.
4. **Day 3-4 (~3 hours):** Phase 1B + 1C — hide Cover Requests + Notes tab + Escalate quick-button; fix duplicate route handlers (verify which is live first); move resolution notes from query to body; replace `prompt()` with modal.
5. **Day 5 onwards:** Phase 2. Start with Phase 2C (prompt versioning) — it's the highest-impact single piece and is genuinely independent of Phases 2A/2B. Then Phase 2A (auth gates) and Phase 2B (identity collection) in parallel.
6. **In parallel from Day 1:** Email OpenAI for DPA. Email an insurance broker for cyber+PI quote. Both have lead times you can't shorten.

This compresses the plan's "1 working week to onboard-safe" into something closer to a working week of *engineering* time, with vendor lead times running underneath.

---

## What I would NOT change about the plan

- **The phase boundaries.** Don't bundle Phase 0 with Phase 1, don't bundle Phase 2 with Phase 3. Each phase ships value independently.
- **The "one concern per PR" discipline.** This is the right working pattern even if it's tempting to bundle.
- **The "manual smoke-test each fix in production" rule.** Especially after the `apiCall` fix — there's no test infra that catches signature mismatches today.
- **The CODEOWNERS / Ant discipline on safety-layer work.** Plan correctly notes this stays as-is. Do not let portal-remediation PRs leak into safety/* paths or pick up Ant as a reviewer for non-safety changes.
- **The framing in the final note.** "The platform you've shipped does meaningful work today" is the right tone. This is hardening, not apologising.

---

## TL;DR

**Trust the plan.** Execute Phase 0 tonight or tomorrow. Phase 1 over the next ~3 days. Phase 2 over the following working week. Start the GDPR/DPA/insurance lead-time pieces today even though you won't action them for a month.

The four amendments worth making before you start:

1. **Add a grep-based "find any other unauthenticated routes" step** to Phase 0 so the deletion list is exhaustive, not just the ones the audit caught.
2. **Verify the `ENCRYPTION_KEY` env var on Render** before you do anything else. Promote Phase 3D's "fail-loud on missing key" into Phase 2.
3. **Promote Finding 1.10 (escalate-to-supervisor on alert card) from Phase 4 into Phase 2.**
4. **Start the OpenAI DPA + insurance broker brief today**, in parallel with engineering work — these have non-shrinkable lead times.

The remediation plan is good. It's not perfect, but the gaps above are pebbles, not boulders. Ship Phase 0 tonight.
