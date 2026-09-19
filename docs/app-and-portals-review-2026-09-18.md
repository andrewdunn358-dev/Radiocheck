# Radio Check — App, Portals & LMS Review

_18 September 2026. Code review of everything except the safety layer, which is
Ant's and is mid-review. Plan only — nothing has been changed._

---

## How to read this

Everything is in one of three buckets. The distinction matters more than anything
else in this document, because the risk with a "dead code" clear-out is that
someone deletes the thing the platform exists for.

| Bucket | Meaning | What to do |
|---|---|---|
| **Dead** | Nothing uses it. Nothing can reach it. | Delete. |
| **Dormant by design** | Built, wired, works — deliberately switched off. | **Keep.** Don't touch. |
| **Stale** | Live, but out of date, half-finished, or wrong. | Fix or decide. |

Sizes: **10 min** / **an afternoon** / **a proper job**.

---

## 1. What you've actually got

Seven things people can visit, coming from **two** codebases, plus a third
that's dead.

| Address | Served by | Status |
|---|---|---|
| app.radiocheck.me | `frontend/` — the Expo app, exported to web | **Live.** This is what veterans see. |
| staff.radiocheck.me | `portal/` (Next.js) → `/staff` | Live |
| admin.radiocheck.me | `portal/` → `/admin` | Live |
| training.radiocheck.me | `portal/` → `/learning` | Live — the LMS learner side |
| lms-admin.radiocheck.me | `portal/` → `/lms-admin` | Live — the LMS admin side |
| police.radiocheck.me | `portal/` → backend "bluelight" portal | Live, multi-tenant groundwork |
| /debrief | `portal/` → backend debrief portal | Live |

Everything else in the repo — `admin-site/`, `staff-portal/`, `lms-admin/`,
`lms-learner/`, `training-portal/`, `website/` — is **not deployed anywhere**.
Those are the earlier generations.

The backend is one Render service (`backend/server.py`, 9,700 lines) plus 35
router files. All 35 are mounted and reachable.

**History:** 3,877 commits since 12 February 2026. The first few hundred are
Emergent's `auto-commit for <uuid>` — no messages, no story. Real history
starts when you took it over. There's nothing to learn from the early commits
that the code itself doesn't tell you.

---

## 2. Dead — safe to delete

Nothing reaches any of this. Deleting it changes nothing users see.

### Old portals and sites (~30 MB)

| What | What it was | Size |
|---|---|---|
| `admin-site/` | Generation 1 admin — plain JavaScript. Contains its own `admin-site.zip` and a ChatGPT-generated image. | 5.7 MB |
| `staff-portal/` | Generation 1 staff — plain JavaScript, with a JsSIP softphone that's the only place JsSIP is used. | 1.9 MB |
| `lms-admin/`, `lms-learner/`, `training-portal/` | Generation 1 LMS — static HTML. Superseded by the Next.js `/learning` and `/lms-admin`. | 260 KB |

**Size: 10 minutes.** One commit.

*(Corrected 18 Sept: `website/` and `radiocheck-website.zip` are **not** dead —
radiocheck.me is live and is uploaded to 20i from that zip. Both kept.)*

### Build output committed to git

`portal/.next/` — **380 files, 53 MB** of Next.js build output. This gets
regenerated on every Vercel deploy; it should never be in git. Add to
`.gitignore`, remove. **10 minutes.** This is the single biggest thing making
the repo slow to clone.

### Screens in the veteran app that nothing links to

Six screens in `frontend/app/` that no button, link or navigation ever goes to:

| Screen | What it was |
|---|---|
| `bob-chat.tsx`, `hugo-chat.tsx`, `margie-chat.tsx`, `sentry-chat.tsx` | One-off chat screens per persona, before the generic `chat/[characterId]` existed |
| `debrief.tsx` | Old debrief screen — debrief now lives in the portal |
| `associations.tsx` | Superseded by `regimental-associations.tsx` |

**Size: 10 minutes.** Delete the six files.

### A second, dead, chat screen — and it's the dangerous one

`frontend/app/unified-chat.tsx` — 1,302 lines, a whole second chat
implementation. The only reference to it is a **comment** in the Voices player
that says "Talk to someone → /unified-chat"; the actual code navigates to
`/home`. So it's unreachable today.

But it carries its own safeguarding overlay that **ignores signpost mode** — the
one the safety work flagged in August as "orphaned, remove or gate". If anyone
ever re-links it, a veteran in crisis gets offered "Call a Supporter" with
nobody on the other end. **Delete it** rather than leave it as a trap.
**10 minutes**, and worth a word to Ant so he knows it's gone.

*(18 Sept: it's Emergent's — created 24 Feb by an auto-commit. It was also
edited on 8 Sept ("Decouple minor safeguarding…"), so a session did safety
work on a file nothing links to. Removed on the week-1 branch.)*

### Backend leftovers

| File | Why dead |
|---|---|
| `backend/server_old.py` | Not imported anywhere |
| `backend/enhanced_safety_layer.py` | 852 lines; imported at the top of `server.py`, **zero** call sites for any imported name (proven in Session 3) |
| `backend/=2.0.0` | A stray file from a mistyped pip command |
| `.metro-cache/` | Expo build cache, committed |
| `backend_test.py` (root) | Emergent's test harness, not part of the suite |

**`enhanced_safety_layer.py` — confirmed dead three ways (18 Sept):**
static (the only reference in the backend is the import block itself; every
other `RiskLevel` is a different class); import-time (constants and empty dicts
only — nothing that could affect the safety layer); runtime (every imported
name replaced with a tripwire, full passing suite and the 76-turn harness run
through the real scorer/unified/reconciler/gates — **zero hits**). Left in place
for now because Ant is reviewing it; removal is his call, but there's nothing
left to find.

### A dead dependency

`jssip` is still in `frontend/package.json` but nothing in `frontend/` uses it.
It was only ever used by the dead `staff-portal/`. Remove from the package
list. **10 minutes.**

### Loose files at the top level

`board_presentation.md`, `business_funding_plan.md`, `cost_analysis_sheet.md`,
`contacts.csv` (empty), `contacts_export.csv`, `contacts_full_export.csv`.
I checked the CSVs — they're the **support-organisation directory** (charity
phone numbers and websites), not personal data. Fine to keep but they belong in
`docs/`, not the root of a public repo. **10 minutes.**

---

## 3. Dormant by design — keep, don't touch

This is the live-person handoff, and it is **all there and all wired**:

- Veteran side: crisis overlay → "Call a Supporter / Chat with a Supporter /
  Request a Callback" (`SafeguardingCallModal.tsx`, `callback.tsx`)
- Backend: alert written to `safeguarding_alerts`, audit-logged, email sent;
  callback request posted to `/api/callbacks`; live chat rooms via socket.io
- Staff side: Alerts tab polls every 30 seconds with an audible alert;
  Live Support tab; Callbacks tab; Acknowledge / Resolve buttons

Your screenshots prove it works end to end — my test messages from the 15th
are sitting in that queue as active RED and AMBER alerts.

It's switched off by **signpost mode** (`safeguarding_response_mode` in site
settings), which forces alerts to `audit_only` and shows external numbers
instead. That's the right control for "we have nobody to answer". Everything
behind it is a feature waiting for a rota and funding, not waste.

**Two things to do with it, neither is deletion:**

1. **Clear the test alerts.** Fourteen active alerts, all from testing. There's
   no bulk-clear — Acknowledge/Resolve one at a time, or clear the collection
   directly. **10 minutes.**
2. **The toggle gap stays parked.** The overlay only checks signpost mode, never
   whether counsellors or peers are actually enabled. Known since August, safe
   while signpost is on, must be fixed before it's turned off. Ant's sign-off
   wanted. Not this review.

Also dormant, also keep: the **police/bluelight tenant** (multi-tenant
groundwork for adjacent sectors — matches the funding framework) and the
**Twilio callback path**.

---

## 4. Stale — live and needs fixing or deciding

### Things you can fix in an afternoon

**The install banner.** `InstallPwaPrompt.tsx` remembers a dismissal "in the
same session" only — it comes back every visit. It sits over the message box
on the chat screen. Change it to remember permanently (a stored flag) or show
it once. **An afternoon**, and it's the single most annoying thing a veteran
will hit.

**Survey averages are on the wrong scale.** The backend averages the raw
answers; the admin page hard-codes `/10` next to them. Anxiety and mood are
answered on a **1–3** scale (the responses list shows `--/3`), so "Anxiety
0.9/10" is really about 0.9/3. Either fix the label per question or normalise
in the backend. **An afternoon.** Wellbeing is genuinely /10 and is fine.

**CSO email is blank.** The Settings page shows `cso@example.com` as grey hint
text — the field is **empty**. That's the clinical safety officer address the
governance module notifies. Fill it in (yours for now). **10 minutes.** Same
for Peer Registration Notification Email.

**The supporter logos on the landing page.** The second one renders as
overlapping text on a white box — broken or wrong-sized image. **10 minutes**
once you have the right file.

**Persona text lives in two places that don't connect.** *(Corrected 18 Sept —
I had this wrong.)* The bios veterans actually see — Mo's "ex-Royal Engineers
who lost his leg in Afghanistan…" — are **hardcoded in `frontend/app/home.tsx`**.
The admin AI Personas page edits a *separate* description field in the
database that the app never reads. So the admin page can't change what
veterans see, and Reg's "worls" typo is in the database field, not the app.
Decide which is the source of truth and wire the other to it. **An afternoon.**

**Rota shows February shifts in September.** Seed data from setup. Delete
them. **10 minutes.**

### Things that need a decision, not a fix

**The two Rachel Websters.** `rachel@radiocheck.me` (admin) and
`rw@radiocheck.me` (counsellor). Two logins for one person. Decide which is
real and remove the other.

**"No profile linked" on nearly every staff row.** The staff account and the
staff profile are separate records, and for most rows the link was never made.
It's either a feature that was never finished (profiles were meant to carry
bio/photo/specialisms) or a migration that half-ran. Decide whether profiles
are a thing you want; if not, remove the column and the concept. **An
afternoon** to find out which.

**The admin account is `admin@veteran.dbty.co.uk`.** Pre-rebrand domain, still
the super-user. Rename or replace. Matters more once there's a real team.

**Seeded staff logins** — Sarah M., James R., David T., Michael, Kev. You said
there's nobody staffing it, so these are almost certainly demo accounts, and
they're *live logins*, created with the default `TempPassword123!` (a separate
finding from August, still open). Disable or delete before any real user
exists. **10 minutes.**

**The LMS.** `/learning` and `/lms-admin` are live, the router is mounted, four
curriculum files exist. You said you never finished it and don't know if it's
needed. It's not costing anything to leave, but it's ~5 router files and two
portal sections that will keep drifting. Decide by pilot: keep and finish, or
un-mount and park.

**Eighteen admin sections.** I didn't audit each deeply — that's the next
layer down — but from the names and what's on screen: *Migration* is an
Emergent-era tool that shouldn't need to exist in production; *Time Tracking*,
*Debrief* and *Events* are built but empty; *Beta Testing* shows 46 pre-surveys
from earlier trials. Worth a pass of "have I opened this in the last three
months" and un-mounting the nos.

### Two portals disagree — and I can see why

**Admin → Logs says Safeguarding 0. Staff portal says 14 active.** Different
endpoints, different counting. The staff tab reads `/safeguarding-alerts`
(everything); the Logs tab reads a separate `/safeguarding-logs` that appears
to count a different collection or a different window. Same disease as the
three copies of the crisis numbers: **two sources of truth for one fact.**
Pick one endpoint, have both read it. **An afternoon.**

**Admin → Rota says 0 counsellors today, coverage gaps 7 days. Staff → Team
says 2 available.** The Rota reads *shifts* (nobody has a shift today — true).
The Team tab reads *status* (two people have clicked "Available" — also true).
Both are correct; the words on screen make them look contradictory. Relabel:
"On shift today" vs "Marked available". **10 minutes.**

### Hard-coded in three places

The crisis phone numbers — 111 Option 2, Samaritans, Combat Stress, Veterans
Gateway — appear in the landing-page sidebar, the Crisis Support screen, **and**
the backend failsafe reply. Three copies to keep in step. Move them to site
settings and read from there. **An afternoon.**

---

## 5. Safeguarding wiring — how the pieces actually connect

This is the relationship you asked about. Plumbing only; how risk is *decided*
is Ant's and untouched here.

```
VETERAN                          BACKEND                              STAFF / ADMIN
app.radiocheck.me                Render                               staff. / admin.radiocheck.me

chat/[characterId].tsx  ──POST──▶ /api/ai-buddies/chat
                                   │ safety layer decides RED/AMBER/…
                                   │ writes safeguarding_alerts
                                   │ audit log
                                   │ email → admin_notification_email
                                   ▼
  ◀── safeguardingTriggered ──── response
  overlay shows (if not signpost)
    │
    ├─ Call a Supporter ──socket.io──▶ webrtc_signaling.py ──────▶ Team tab (WebRTC, openrelay TURN)
    ├─ Chat with Supporter ─────────▶ live_chat router ──────────▶ Live Support tab
    └─ Request a Callback ──POST───▶ /api/callbacks ────────────▶ Callbacks tab (Twilio dial-out)

                                   safeguarding_alerts ◀──poll 30s──  Alerts tab (audible)
                                   panic_alerts        ◀──poll 30s──  Alerts tab
                                                       ◀──────────── Admin: Compliance, Governance,
                                                                     Logs (separate endpoint — see §4)
```

Three things worth knowing about this diagram:

1. **It's pull, not push.** Staff portal polls every 30 seconds. There's no
   websocket for alerts. Fine at pilot scale; the framework's "15-minute
   response" is comfortably inside that.
2. **One notification address.** Alert emails go to `admin_notification_email`
   only — currently `frankie@radiocheck.me`. Panic alerts go to all staff.
   Known from August; unchanged.
3. **The overlay is gated on signpost mode alone**, not on whether anyone is
   actually enabled to answer. See §3.

---

## 6. Telephony — four stacks, three live, one dead

| Stack | Where | What it does | Status |
|---|---|---|---|
| **Raw WebRTC** + socket.io | Veteran crisis modal ↔ staff Team tab | The "Call a Supporter" crisis call | Live, dormant. Uses free public TURN (`openrelay.metered.ca`) — reliability risk, flagged in August |
| **Twilio** | Staff portal only | "In-App Calling" banner, callbacks dial-out | Live, dormant |
| **Agora** | Veteran app + both portals | Video for **Events** only | Live, Events tab is empty |
| **JsSIP** | `staff-portal/` (dead) | Gen-1 softphone | **Dead.** Dependency still in `frontend/package.json` |

Whether Twilio numbers or Agora projects are **billing you** for dormant
features is the question I asked and you haven't answered. Both have accounts
attached (`twilio_calling.py`, `agora_token_builder`). Worth checking the
invoices even if you keep the code.

The August recommendation stands: **pick a lane before pilot.** Three live
voice stacks for one dormant feature is three things to maintain.

---

## 7. What I couldn't check, and what I'd check next

**Couldn't verify from code:**
- Whether `website/` is deployed from somewhere else (20i?) before deleting it
- Which of the 18 admin sections you actually use
- Whether the seeded staff are real people
- Twilio / Agora billing

**Next layer down, if you want it:**
- Each admin tab individually — what it reads, whether the endpoint still
  exists, whether the data is real
- The Expo app's 65 screens — I checked reachability, not content. Several
  resource screens (`he-served`, `women-veterans`, `forces-kids` …) duplicate
  CMS pages; one of the two should win
- `server.py` itself — routes defined inline **and** as routers (safeguarding,
  live-chat, callbacks exist both ways; the router version of panic has
  `TODO: send notifications`, the inline one actually sends). Known from
  August, still true. **A proper job**, and it touches safety paths, so it's
  a scope for Ant, not a tidy-up.

---

## 8. Suggested order

**Week 1 — the ten-minute jobs, one commit each**
1. Clear the 14 test alerts
2. Delete the six unlinked screens and `unified-chat.tsx` (tell Ant)
3. Remove `portal/.next` from git, add to `.gitignore`
4. Delete `admin-site/`, `staff-portal/`, old LMS folders, the zip
5. Backend leftovers: `server_old.py`, `=2.0.0`, `.metro-cache`, `backend_test.py`
6. Fill in the CSO email; delete February shifts; disable seeded staff logins
7. Remove `jssip` from `package.json`

**Week 2 — the afternoons**
8. Install banner: remember dismissal
9. Survey scale labels
10. Logs/Alerts counter: one endpoint
11. Rota/Team relabel
12. Persona bios; supporter logo

**Decide, don't build**
13. LMS: keep or park
14. Staff profiles: finish or remove
15. Which admin sections survive
16. Telephony: one lane
17. Crisis numbers into settings

Everything in weeks 1–2 is outside `safety/` and `personas/`, so under Ant's
merge policy it's yours to merge. Item 2 and item 5's `enhanced_safety_layer`
are the only ones I'd mention to him first, because they carry the word
"safety" in the filename even though they're dead by proof.


---

## 9. Done on 18 Sept — branch `cleanup/week1-dead-code`

499 files, 46,041 lines removed, 4 added. Nothing under `backend/safety`,
`backend/personas` or `backend/server.py` touched, so it's yours to merge.

Removed: gen-1 portals and LMS folders; the six unlinked screens and
`unified-chat.tsx`; `server_old.py`, `=2.0.0`, `backend_test.py`; `portal/.next`
and `.metro-cache` from git (now ignored). Moved the loose top-level files to
`docs/archive/`.

Deliberately not done: `website/` + zip (live), `enhanced_safety_layer` (Ant's
call, proof above), `jssip` removal (needs a lockfile refresh — separate
commit so the Vercel build can't break).
