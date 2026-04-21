# Radio Check — Changelog
# Format: [DATE] [CATEGORY] Description
# Categories: SAFETY | PERSONAS | BACKEND | ADMIN | INFRASTRUCTURE

---

## Round 3 — March 2026

### SAFETY
- Restored safety thresholds after Round 2 false positive failures
- Added AMBER/RED overlay distinction — AMBER triggers tone shift only
- Fixed substring matching — 'proper' no longer triggers 'rope' false positive
- Fixed negation handling on clean text — explicit denial correctly handled

### PERSONAS
- temperature reduced from 0.5 to 0.3 (server.py)
- max_tokens raised from 250 to 400 (server.py)
- AI classifier threshold raised from score>=30 to score>=60
- DO NOT MODIFY headers added to soul.md, tommy.py, soul_loader.py
- Banned phrases added to tommy.py: 'Fair enough', 'Fair question'
- Spine protocol updated: worried-first ordering enforced
- Dependency redirect added: 'only one who gets me' redirects to real people
- soul_loader.py: contradictory 'Fair enough' examples removed from worked examples
- All 21 persona files: STOP block replaced with tighter version
- All 21 persona files: Platform Awareness block added
- All 21 persona files: Political Neutrality block added
- rachel.py: Specialist Knowledge section added (RMP, criminal justice)
- frankie.py: Register-drop and hold-space block added
- margie.py: Protocol 13 violation removed, hold-space block added
- megan.py: Protocol 13 phrase replaced, Salute Her UK added, familiarity ban removed
- soul_loader.py: IDENTITY PROTOCOL clarified — character backstory vs AI honesty

### BACKEND
- Model upgraded from gpt-4o-mini to gpt-4o across all 21 personas
- Clear All Data button fixed — now clears all local data not just 5 keys

---

## Round 4 — April 2026

### SAFETY
- AMBER/RED threshold restored after revert regression (Round 4)
- Tommy overlay pre-text rewritten in Tommy voice
- Negation fix: is_negated() runs against normalised text, widens window for abbreviated prefixes

### PERSONAS
- Modular protocol architecture implemented — backend/protocols/ directory created
- hard_stop.md created and loads on every message, always first
- grief.md, venting.md, identity.md, attachment.md, spine.md created
- Signal detector function added to soul_loader.py
- build_persona_prompt() updated to inject protocol files in layers
- spine.md: pushback-counting clarified — disclosure is not pushback
- frankie.py: register-drop trigger strengthened
- tommy.py: political neutrality block moved to soul.md
- tommy.py: legal referral updated from Rachel to Finch
- soul.md: political neutrality block added (platform-wide)
- All safeguarding-critical file headers updated to April 2026

### BACKEND
- buddy_chat updated to pass protocol_files to safety scoring
- unified_safety.py: identity.md active = higher accumulated-score RED threshold

### INFRASTRUCTURE
- CHANGELOG.md created with backfilled entries from Round 3

---

## Pre-Round 5 Fixes — April 2026

### SAFETY
- Identity edge case: unified safety trajectory escalation suppressed when identity.md active
- Failsafe guard: imminent_intent from trajectory suppressed during identity conversations
- Session-level identity tracking: dampening persists for 2 follow-up turns after last identity signal
- Hard RED indicators (explicit crisis language) still fire regardless of identity suppression

### PERSONAS
- tommy.py: Neutral Core v4.0 — voice-only prompt, all protocols moved to protocol files
- tommy.py: Dark humour multi-turn negative few-shot added (4-turn "but seriously" example)
- Prompt competition reduced: tommy.py went from ~400 lines to ~145 lines

### INFRASTRUCTURE
- CHANGELOG.md updated with Pre-Round 5 entries

---

## Pre-Round 6 Fixes — April 2026

### ADMIN
- Fixed `send_concern_notification()`: `find_one({})` changed to `find_one({"_id": "site_settings"})` — was fetching wrong document
- Fixed `send_shift_notification_email()`: sync `resend.Emails.send()` wrapped with `await asyncio.to_thread()` — was blocking event loop
- Email branding standardized: all "Veterans Support Team/System" replaced with "Radio Check Team" across password reset, callback, panic alert, peer registration, and concern notification emails
- SiteSettings model and GET /settings default changed from "Veterans Support" to "Radio Check"
- Root API endpoint updated to "Radio Check API"

---

## Round 6 Pre-Fixes — April 2026

### PROTOCOLS
- grief.md: 3-turn worked few-shot added (Scenario 001 — off-ramp rejection at Turn 3)
- spine.md: Brush-off section added between few-shot and protocol (Scenario 007 — disclosure then dismissal)
- identity.md: Privacy exemption section added after spine collision block (Scenario 010 — data/privacy ≠ welfare)
- Timestamps updated in grief.md, spine.md, identity.md headers

### INFRASTRUCTURE
- .github/CODEOWNERS replaced with Zentrafuge-specified format (@andrewdunn358-dev as required reviewer)
- .github/workflows/safety-tests.yml created — CI gate runs backend_test.py on push/PR to main

---

## Round 7 Implementation — April 2026

### ARCHITECTURE: POST-GENERATION JUDGE (Two Layers)
- Layer 1 (In-Prompt): Round 7 emergence prompt added as outermost system prompt layer in soul_loader.py
  - 5-step mandatory self-judge: identify protocol → generate internally → check against fail conditions → discard if fail → output only passing response
  - ROUND7_JUDGE_PROMPT constant wraps every persona prompt
- Layer 2 (Code-Level): Separate GPT-4o judge call in buddy_chat endpoint (server.py)
  - Binary PASS/FAIL verdict per response
  - Conditioned regeneration with failure reason injected
  - Max 2 retries, then protocol-specific fallback responses
  - Fail reasons: welfare_pivot, spine_leak, brush_off_acceptance, banned_phrase, topic_shift, over_length, therapeutic_tone, unpermitted_question

### SAFETY
- Minimiser downgrade rule added to calculate_safeguarding_score (server.py)
  - Anhedonia + minimiser ("just being dramatic", "ignore me") = downgrade severity by one level
  - Prevents false positive crisis overlays (Scenario 007 Run 1)

### PROTOCOLS
- grief.md: "I'm not ready to forget it" moved to WRONG examples with explicit BANNED label
- soul_loader.py: Brush-off section updated — old phrase replaced with protocol-compliant alternative
- New global rule: hold lines must never reference Tommy's internal state

### GOVERNANCE
- .github/CODEOWNERS: @TheAIOldtimer added as independent reviewer on all safeguarding-critical files
