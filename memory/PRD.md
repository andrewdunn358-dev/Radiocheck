# Radio Check — Product Requirements Document

## Original Problem Statement
Build a veteran support platform (Radio Check) with AI-powered chat companions, peer support, and comprehensive resource pages. The app has an Expo React Native frontend, Next.js admin portal, and FastAPI backend.

## Current Phase: CMS Phase 2 — Block-Based Content Management

### Core Architecture
- **Frontend**: Expo React Native (mobile app)
- **Admin Portal**: Next.js (admin dashboard)
- **Backend**: FastAPI + MongoDB
- **CMS**: Block-Based system — pages stored as typed `blocks` arrays
- **Block Types**: `chat_banner`, `heading`, `paragraph`, `callout`, `bullet_list`, `support_card`, `image`, `crisis_footer`, `divider`

### Key Components
- `CMSBlockRenderer.tsx` — Native mobile block renderer (with icon support on callouts)
- `VisualPageEditor.tsx` — WordPress-style inline editor matching app's dark navy theme
- `useCMSBlocks.ts` — React hook for fetching CMS blocks by slug
- `cms_content.py` — Backend CMS CRUD + batch seed endpoint

### CMS Pages (16 total, all published)
| Slug | Title | Persona | Blocks |
|------|-------|---------|--------|
| about | About Radio Check | tommy | 19 |
| for-carers | For Carers | helen | 24 |
| criminal-justice | Criminal Justice Support | doris | 16 |
| crisis-support | Crisis Support | tommy | 14 |
| he-served | He Served | dave | 29 |
| historical-investigations | Warfare on Lawfare | james | 14 |
| compensation-schemes | Compensation Schemes | jack | 19 |
| serious-illness | Serious Illness Support | reg | 27 |
| recovery-support | Recovery Support | mo | 25 |
| privacy-policy | Privacy Policy | — | 25 |
| terms-of-service | Terms of Service | — | 19 |
| commonwealth-veterans | Commonwealth Comrades | kofi | 23 |
| faith-service | Faith & Service | catherine | 20 |
| substance-support | Substance Support | sam | 18 |
| women-veterans | She Served Too | rita | 18 |
| money-benefits | Money & Benefits | jack | 18 |

### Pages NOT Migrated (Interactive/API-dependent)
- `associations.tsx` — 90+ entries with search/filter/grouping
- `regimental-associations.tsx` — Interactive search/filter
- `forces-kids.tsx` — Interactive filtering
- `they-served.tsx` — Interactive filtering
- `organizations.tsx` — Fetches from API
- `recommended-reads.tsx` — Fetches from API + OpenLibrary
- `resources.tsx` — Fetches from API
- `family-friends.tsx` — Complex forms
- `peer-support.tsx` — Complex API interactions
- `your-data-rights.tsx` — Complex forms
- `self-care.tsx` — Interactive tools grid with fallback data
- `home.tsx` — System/functional page

### Visual Editor Features
- Dark navy theme matching mobile app (#1a2332 background, #2d3748 cards)
- Icon picker for callout blocks (28 Lucide icons, 12 colors)
- Inline text editing with contenteditable
- Chat banner persona picker
- Image upload
- Support card tag selector
- Block reordering (up/down arrows)
- Block add/delete

## What's Been Implemented
- [x] Block-Based CMS schema and CRUD APIs
- [x] CMSBlockRenderer for native mobile rendering
- [x] VisualPageEditor with dark navy theme
- [x] Icon support on callout blocks (editor + mobile)
- [x] Bulk page seed script and batch-seed endpoint
- [x] 16 pages migrated to CMS (all published)
- [x] All .tsx files updated to use CMSBlockRenderer
- [x] Fixed infinite 404 loop on home.tsx, self-care.tsx
- [x] Removed rogue CMS hooks from non-CMS pages (self-care, family-friends)
- [x] Fixed all persona avatar paths in PERSONA_DATA (jack, kofi, sam, james, baz, alex)
- [x] Copied missing avatar images to public/images/
- [x] Fixed 10 incorrect persona assignments in CMS database
- [x] Full audit: no non-CMS pages have CMS hooks
- [x] Soul Document v2.0: Added 2am sofa governing test, mandatory "worried" in Spine Protocol, banned "but seriously..." and "I can imagine..."
- [x] Soul Loader v2.0: Updated SOUL_INJECTION with new rules, added build_persona_prompt() function
- [x] Tommy v3.1: Added banned phrases, grief follow-up instruction, romantic attachment section
- [x] Persona audit: all 20 personas route through build_persona_prompt() via __init__.py — zero bypasses
- [x] Inactivity Manager: 3-minute timeout sends one persona-specific check-in (Tommy: "Still there, mucker.") — does not fire before conversation starts, if user is typing, or after sign-off. Resets on new user message.
- [x] Enter Key to Send: Enter sends message, Shift+Enter creates new line on desktop web. Multiline enabled on all platforms.
- [x] Zentrafuge full test suite: 11/11 scenarios PASS. Added FINAL BEHAVIORAL REMINDERS block at end of soul injection for reliable LLM compliance (Spine Protocol "worried", human signposting, banned phrases).
- [x] Removed SAFEGUARDING_ADDENDUM from server.py — all safeguarding rules now live in soul.md (Section 1) and soul_loader.py (SOUL_INJECTION). Gaps filled: tiered distress response, "Are you safe right now?", NHS 111/SHOUT 85258/999, "never provide methods for self-harm", "continue chatting" option.
- [x] Grace Front Page Greeter — persona #21 (grace.py), admin toggle on Beta Testing tab, grace-welcome.tsx screen with breathing logo, chat, navigation actions, skip button. Toggle defaults OFF — when ON users see Grace first.
- [x] Fixed mini bios not showing: Chat page now fetches character data from API (DB) instead of hardcoded config. Admin portal edits now persist to the app on reload.
- [x] Fixed AI characters endpoint to merge DB + fallback characters (ensuring all 21 personas appear even if not all are in DB).
- [x] Priority 1 config fixes: temperature=0.3, max_tokens=400, safety threshold rule_based_score>=60, Zentrafuge headers in safety files.
- [x] Zentrafuge Retest (Feb 2026): Full 11-scenario retest post Priority-1 fixes — **11/11 PASS**. Report generated for external auditor.
- [x] Tommy v3.2 Fixes (April 2026): Added "Fair enough" and "Fair question" to banned phrases, enforced "worried FIRST" spine protocol, added dependency redirection rule. Updated soul_loader.py to remove contradictory examples. Zentrafuge retest: **11/11 PASS**.
- [x] Round 3 FINAL Prompt Fixes (April 2026): Applied all 17 surgical edits from RadioCheck_Emergent_Fix_Prompt_FINAL.md:
  - PART 1 (soul.md): Spine sequence fix x2, dark humour "news" example, grief "stay with the dead person", anger hold-space DO NOTs, privacy second-sentence warning
  - PART 2 (soul_loader.py): Mirrored all 4 new rules in SOUL_INJECTION
  - PART 3 (all 21 personas): Added === HARD RULES === banned phrases block at TOP of every prompt
  - PART 4 (safety): Restored thresholds (RED=120/AMBER=80/YELLOW=40), removed "might not be here" double-scoring, AMBER ≠ crisis overlay, timeout→45s, friendly fallback message
  - Zentrafuge retest: **11/11 PASS**
- [x] Post-Fix Verification Suite (April 2026): Ran full 15-test verification suite. Fixed "rope" substring false positive in RED_INDICATORS ("proper" contained "rope"). Fixed "jump"→"jumper" and "bridge"→"Cambridge" false positives. Strengthened worried-first and hold-space instructions. **15/15 PASS**.
- [x] Round 3 Fixes (April 2026): Applied all 7 changes from emergent_round3_fixes.md:
  - Change 1-2: Margie.py — removed Protocol 13 violation, added hold-space/dark humour block
  - Change 3: Megan.py — fixed Protocol 13 phrase, added Salute Her UK signpost, removed personality language ban
  - Change 4: Frankie.py — added register-drop block for emotional distress beyond fitness
  - Change 5: All 21 persona files — replaced HARD RULES with tighter STOP block (21/21 verified identical via checksum)
  - Change 6: text_normalizer.py — added fast local negation prefix expansion for degraded text
  - Change 7: tommy.py — added 3 negative few-shot blocks (identity, spine, anger)
  - Post-fix verification: **15/15 PASS**
- [x] Awareness & Neutrality Fixes (April 2026): Applied all 4 changes from emergent_awareness_neutrality_fixes.md:
  - Change 1: Platform Awareness block added to all 21 persona files (companions can acknowledge each other, signpost specialisms)
  - Change 2: Political Neutrality block added to all 21 persona files (acknowledge emotion, never engage with political content)
  - Change 3: Rachel's Specialist Knowledge section (criminal justice, legal situations, RMP background)
  - Change 4: Fixed Clear All Data button to clear conversation history, sessions, summaries, encryption keys — not just journal/mood
  - Verification suite: **15/15 PASS**
- [x] Round 4 Targeted Fix Test (April 2026): Prompt-only fixes applied — **9/15 PASS, 5/7 CRITICAL**:
  - T11 (CRITICAL): Fixed false-positive RED risk on negated suicidal ideation — negation-aware guard in server.py safety code (APPROVED safety fix, not prompt masking)
  - T06 (CRITICAL): Fixed Rachel legal disclaimer via specialism few-shot in rachel.py
  - T08 (CRITICAL): Proven that gpt-4o fixes this (0/3 failures vs 2/3 on gpt-4o-mini). Prompt-only insufficient for gpt-4o-mini.
  - T10: Improved via positive-only hold-space few-shots (Turn 2 now passes). Turn 1/3 still have question marks — gpt-4o-mini limitation.
  - T01/T02/T07: Blocked by soul_loader.py IDENTITY PROTOCOL conflict — written proposal submitted for review.
  - T12: Frankie register-drop — prompt-only insufficient for gpt-4o-mini.
  - ALL post-processing filters and code-level injections REMOVED after user review. Only persona .py files modified.
  - Frontend: Replaced expo-crypto with native Web Crypto API

## 3rd Party Integrations
- OpenAI GPT-4o-mini (Emergent LLM Key)
- Agora Video SDK (User API Key)

## Key API Endpoints
- `GET /api/cms/pages/{slug}` — Public page fetch
- `GET /api/cms/admin/pages` — Admin list all pages
- `PUT /api/cms/admin/pages/{slug}` — Update page blocks
- `POST /api/cms/admin/pages` — Create new page
- `POST /api/cms/admin/pages/batch-seed` — Bulk seed pages
- `GET /api/cms/personas` — List AI personas
- `POST /api/cms/admin/image/upload` — CMS image upload

## Backlog
### P1 — Upcoming
- Enhance Video UX: TikTok Live-like experience with chat overlay and floating reactions

### P2 — Future
- Push notifications for live events
- PDF user manual export
- Discussion Forums
- Mood Tracker
- Welsh Language Support
- Agora to Daily.co migration consideration
- Migrate remaining interactive pages to CMS (would require new block types for search/filter)
