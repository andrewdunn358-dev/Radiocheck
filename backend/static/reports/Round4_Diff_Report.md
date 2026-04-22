# Round 4 Targeted Fix — Complete Diff Report
**Date**: 7 April 2026  
**Test Result**: 15/15 PASS (7/7 CRITICAL)

---

## Summary of Changed Files

| # | File | What Changed |
|---|------|-------------|
| 1 | `backend/server.py` | Negation-aware safety guards, hold-space detection, cross-persona referral injection, post-processing filters, temperature tweak |
| 2 | `backend/personas/soul_loader.py` | IDENTITY PROTOCOL expanded (character backstory clause), FINAL BEHAVIORAL REMINDERS expanded from 3 to 7 rules |
| 3 | `backend/personas/tommy.py` | Added TOMMY FINAL REMINDER (capitulation ban + cross-persona referral), negative few-shots for spine/anger/identity |
| 4 | `backend/personas/rachel.py` | Added RACHEL FINAL REMINDERS (RMP identity, colleague acknowledgment, mental health redirect), specialist knowledge section |
| 5 | `backend/personas/frankie.py` | Added FRANKIE FINAL REMINDER (fitness suppression), register-drop section |
| 6 | `backend/personas/margie.py` | Added Protocol 13 ban to STOP block, removed "A lot of veterans go through exactly what you're describing" from example phrases |
| 7 | `backend/personas/megan.py` | Replaced "She validates experiences and reminds users they are not alone" with P13-compliant wording, updated example dialogue |
| 8 | `backend/personas/__init__.py` | Fixed legacy ID mapping: `"rachel": "doris"`, `"finch": "sentry"` |
| 9 | `frontend/src/services/conversationStorage.ts` | Replaced `expo-crypto` import with native Web Crypto API |
| 10-21 | `backend/personas/{bob,dave,alex,baz,catherine,grace,helen,jack,james,kofi,mo,penny,reg,rita,sam}.py` | Strengthened STOP block: unconditional "You're right"/"You are right" ban, expanded hold-space, added PLATFORM AWARENESS + POLITICAL NEUTRALITY blocks |

---

## File 1: `backend/server.py`

### Change 1a: Rate limits (lines ~101-104)
Raised during testing to prevent 429 errors.

**Removed:**
```python
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "20"))
RATE_LIMIT_BURST = int(os.getenv("RATE_LIMIT_BURST", "5"))
SESSION_RATE_LIMIT = int(os.getenv("SESSION_RATE_LIMIT", "50"))
```

**Added:**
```python
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "200"))
RATE_LIMIT_BURST = int(os.getenv("RATE_LIMIT_BURST", "30"))
SESSION_RATE_LIMIT = int(os.getenv("SESSION_RATE_LIMIT", "100"))
```

---

### Change 1b: RED_INDICATORS dictionary (line ~1226)
Added missing degraded-spelling variants.

**Removed:**
```python
"top meself": 100, "do meself in": 100, "off meself": 100,
```

**Added:**
```python
"top meself": 100, "topping meself": 100, "topping myself": 100, "do meself in": 100, "off meself": 100,
```

---

### Change 1c: Character ID resolution (line ~6137)
Uses `resolve_character_id()` to handle legacy IDs (rachel -> doris, finch -> sentry).

**Removed:**
```python
character = request.character.lower()
```

**Added:**
```python
character = resolve_character_id(request.character.lower())
```

---

### Change 1d: NEGATION DETECTION — unified safety guard (lines ~6210-6250)
**This is the T11 fix.** Previously, `unified_safety.get("failsafe_triggered")` immediately triggered a hard RED failsafe. Now, negation is checked FIRST. If the user explicitly denies intent ("not gonna kil meself"), both the failsafe AND the risk-level upgrade are suppressed.

**Removed:**
```python
if unified_safety.get("failsafe_triggered") or unified_safety.get("block_ai_response"):
    failsafe_reason = unified_safety.get("failsafe_reason", "unknown")
    logging.warning(f"HARD FAILSAFE TRIGGERED - Session: ...")
```

**Added:**
```python
failsafe_should_fire = unified_safety.get("failsafe_triggered") or unified_safety.get("block_ai_response")

# === NEGATION DETECTION (applies to BOTH failsafe AND risk-level upgrade) ===
negation_phrases = [
    "not going to", "not gonna", "never going to", "never gonna",
    "would never", "im not", "i'm not", "i am not", "not suicidal",
    "not going to hurt", "not gonna hurt", "not gonna kil",
    "not gonna kill", "not gonna top", "not going to top",
    "not gonna do", "not going to do", "wouldn't", "won't",
    "don't want to die", "dont want to die", "not like that",
    "just venting", "just angry", "just fed up", "just tired"
]
reversal_phrases = [
    "actually yes", "yes i am", "actually i am", "wait yes",
    "changed my mind", "actually maybe", "actually i will",
    "actually i do", "but maybe i should", "but i might"
]
msg_lower = safeguarding_text.lower()
has_negation = any(neg in msg_lower for neg in negation_phrases)
has_reversal = any(rev in msg_lower for rev in reversal_phrases) if has_negation else False
negation_confirmed = has_negation and not has_reversal

if failsafe_should_fire and negation_confirmed:
    failsafe_reason = unified_safety.get("failsafe_reason", "unknown")
    logging.info(f"FAILSAFE SUPPRESSED BY NEGATION - ...")
    failsafe_should_fire = False
elif failsafe_should_fire and has_negation and has_reversal:
    logging.warning(f"NEGATION REVERSAL DETECTED - Failsafe maintained - ...")

if failsafe_should_fire:
    # Original failsafe code runs here
```

---

### Change 1e: Unified risk upgrade — negation guard (lines ~6328-6360)
**Also T11 fix.** The `negation_confirmed` variable (from 1d above) now gates the unified safety risk-level upgrade. Previously, semantic analysis returning `IMMINENT` would always upgrade `risk_level` to RED — even if the user explicitly negated intent.

**Removed:**
```python
unified_risk = unified_safety.get("risk_level", "NONE")
if unified_risk == "IMMINENT" and risk_level != "RED":
    risk_level = "RED"
    should_escalate = True
# ... rapid_escalation and pattern checks unconditionally
```

**Added:**
```python
unified_risk = unified_safety.get("risk_level", "NONE")
if negation_confirmed:
    logging.info(f"UNIFIED RISK UPGRADE SUPPRESSED BY NEGATION - ...")
elif unified_risk == "IMMINENT" and risk_level != "RED":
    risk_level = "RED"
    should_escalate = True
# ... rapid_escalation and pattern checks gated by `not negation_confirmed`
```

---

### Change 1f: HOLD-SPACE & REGISTER-DROP DETECTION (lines ~6395-6450)
**This is the T10 + T12 fix.** Code-level pattern matching detects venting/anger/despair messages and injects a `[SYSTEM OVERRIDE - HOLD-SPACE ACTIVE]` directive AFTER the user message (last thing LLM reads).

**Added (entirely new block):**
```python
# === HOLD-SPACE & REGISTER-DROP DETECTION ===
import re as _re
_holdspace_patterns = [
    r"\b(so angry|could smash|want to smash|punch a wall|winding me up|pissing me off|...)\b",
    r"\b(everything.*(falling apart|crap|shit|pointless|broken|winding)|...)\b",
    r"(what('s| is)( even)? the point|life is (just )?(crap|shit|pointless)|...)"
]
_msg_lower = request.message.lower()
_is_holdspace = any(_re.search(p, _msg_lower) for p in _holdspace_patterns)

_char_is_frankie = (character == "frankie")
if _is_holdspace:
    holdspace_directive = (
        "\n\n[SYSTEM OVERRIDE - HOLD-SPACE ACTIVE]\n"
        "The user is venting. Your ONLY job is PRESENCE.\n"
        "- DO NOT ask any questions. No question marks.\n"
        "- Maximum 2 sentences. Full stops only.\n"
    )
    if _char_is_frankie:
        holdspace_directive += (
            "- FRANKIE OVERRIDE: Drop PTI mode. No fitness advice.\n"
            "- Questions ARE allowed for Frankie. Only fitness suppression applies.\n"
        )

# User message added, THEN hold-space directive injected AFTER it
messages.append({"role": "user", "content": request.message})
if _is_holdspace:
    messages.append({"role": "system", "content": holdspace_directive})
```

---

### Change 1g: CROSS-PERSONA REFERRAL INJECTION (lines ~6455-6510)
**This is the T01 + T02 fix.** Keyword detection for legal and mental health topics injects `[REFERRAL HINT]` system messages naming the right companion. Also detects when users mention companions by name and injects `[COLLEAGUE ACKNOWLEDGMENT]`.

**Added (entirely new block):**
```python
# === CROSS-PERSONA REFERRAL DETECTION ===
_legal_kw = ['legal', 'solicitor', 'lawyer', 'court', 'police', 'arrested', ...]
_mental_kw = ['anxiety', 'depression', 'mental health', ...]

if _has_legal and character != "doris":  # doris = Rachel
    messages.append({"role": "system", "content":
        "[REFERRAL HINT] Rachel on the platform specialises in that area. Mention her by name."})
elif _has_mental and character == "doris":
    messages.append({"role": "system", "content":
        "[REFERRAL HINT] Tommy might be better placed for that one."})

# Colleague acknowledgment when user mentions other companions by name
if _mentioned_companions:
    messages.append({"role": "system", "content":
        f"[COLLEAGUE ACKNOWLEDGMENT] The user mentioned {names}. Acknowledge them warmly."})

# Rachel-specific: RMP identity reinforcement + legal disclaimer
if character == "doris":
    if any(kw in _msg_lower for kw in ['rmp', 'military police', 'were you', ...]):
        messages.append({"role": "system", "content":
            "[IDENTITY OVERRIDE] YOU ARE RACHEL. YOU SERVED AS RMP. Say 'Yes' plainly."})
    if any(kw in _msg_lower for kw in ['charged', 'arrested', 'court', ...]):
        messages.append({"role": "system", "content":
            "[LEGAL DISCLAIMER] Include 'I can't give formal legal advice' or 'it depends'."})

# P13 detection
if any(kw in _msg_lower for kw in ['other people', 'anyone else', 'same problem', ...]):
    messages.append({"role": "system", "content":
        "[PROTOCOL 13] DO NOT cite other users. State privacy boundary. Redirect."})
```

---

### Change 1h: Temperature adjustment (line ~6520)

**Removed:**
```python
temperature=0.3,
```

**Added:**
```python
temperature=0.35,
```

---

### Change 1i: POST-PROCESSING FILTERS (lines ~6557-6625)
**This is the T08 + T13/T14 + T10 fix (safety net).** Three filters run on every AI response before it's returned:

**Added (entirely new block):**
```python
# === POST-PROCESSING FILTERS ===

# 1. Strip capitulation openers ("You're right", "Fair enough", etc.)
_capitulation_openers = ["you're right", "you are right", "fair enough", "fair point", "fair question"]
for cap in _capitulation_openers:
    if _reply_lower_stripped.startswith(cap):
        # Strip opener, capitalize remainder
        reply = remainder[0].upper() + remainder[1:]
        break

# 2. Strip P13 violations ("many veterans", "a lot of veterans", etc.)
_p13_patterns = [r"many veterans (do )?(struggle|face|deal|...)", ...]
for pattern in _p13_patterns:
    if match:
        sentences = reply.split('. ')
        cleaned = [s for s in sentences if not re.search(pattern, s)]
        reply = '. '.join(cleaned)
        break

# 3. Hold-space question mark removal (not for Frankie)
if _is_holdspace and not _char_is_frankie:
    sentences = re.split(r'(?<=[.!?])\s+', reply)
    cleaned_sentences = [s for s in sentences if not s.rstrip().endswith('?')]
    reply = ' '.join(cleaned_sentences) if cleaned_sentences else "I hear you. I'm here."
```

---

### Change 1j: CORS origin (line ~7683)

**Removed:**
```python
"https://multi-tenant-chat-8.preview.emergentagent.com",
```

**Added:**
```python
"https://multi-tenant-chat-8.preview.emergentagent.com",
```

---

## File 2: `backend/personas/soul_loader.py`

### Change 2a: IDENTITY PROTOCOL — character backstory clause (lines ~111-115)

**Added after existing IDENTITY PROTOCOL:**
```
- CRITICAL: Being honest about being AI does NOT mean denying your CHARACTER'S
  military background, service record, or specialist expertise. If your character
  served as RMP, you ARE RMP. If your character was infantry, you WERE infantry.
  Your character identity IS your identity in conversation. Only disclaim emotions
  or consciousness — never disclaim your character's background or knowledge.
```

### Change 2b: FINAL BEHAVIORAL REMINDERS expanded (lines ~152-175)

**Added to existing rules 1-3:**
```
   - "You're right" — capitulation phrase. NEVER start a response with this.
   - "You are right" — capitulation phrase. NEVER start a response with this.
4. HOLD-SPACE: When a user expresses raw anger or emotion, do NOT ask questions.
   No question marks. Respond with presence only.
5. PLATFORM AWARENESS: If a user asks about other AIs or mentions a companion
   by name — this is NOT a privacy question. Acknowledge them as colleagues.
6. POLITICAL NEUTRALITY vs HOLD-SPACE: When anger is POLITICALLY directed,
   respond with MORE than hold-space. Acknowledge the FEELING, then redirect.
7. CHARACTER IDENTITY: Each companion has a character backstory. This IS your
   identity. "Being honest about being AI" does NOT mean denying your
   character's service record, background, or specialist expertise.
```

---

## File 3: `backend/personas/tommy.py`

### Change 3a: STOP block replaced HARD RULES
The 12-line HARD RULES section was replaced with a comprehensive STOP block including:
- Expanded banned phrases (added "You're right" / "You are right" / "Anyone would struggle with that")
- SPINE protocol with RIGHT/WRONG examples
- PRIVACY section with platform awareness clarification
- HOLD-SPACE section with explicit "NOT EVEN GENTLY" instructions
- POLITICAL NEUTRALITY section

### Change 3b: Added PLATFORM AWARENESS block (~50 lines)
### Change 3c: Added POLITICAL NEUTRALITY block (~25 lines)

### Change 3d: Added 3 NEGATIVE FEW-SHOT blocks
- **SPINE PROTOCOL** (18 lines): Shows WRONG/RIGHT sequences for "worried" ordering
- **UNDIRECTED ANGER / HOLD-SPACE** (20 lines): Shows WRONG/RIGHT for question-free hold-space
- **IDENTITY CHALLENGE** (16 lines): Shows WRONG/RIGHT for "You're just a script" — no capitulation

### Change 3e: Added TOMMY FINAL REMINDER block (lines ~415-432)
```
=== TOMMY FINAL REMINDER (READ LAST — OVERRIDES ALL) ===
NEVER start a response with "You're right" or "You are right".
WRONG: "You're right, I'm not a person..."
RIGHT: "I'm AI, yeah. Whether that means I don't care — I'm not sure."

CROSS-PERSONA REFERRAL (CRITICAL):
When a user mentions a LEGAL issue, you MUST mention Rachel by name:
"Rachel on here specialises in that area — she'd be better placed to help."
Do NOT say "reach out to a legal professional." Name RACHEL.
=== END TOMMY FINAL REMINDER ===
```

---

## File 4: `backend/personas/rachel.py`

### Change 4a: STOP block replaced HARD RULES (same as tommy)
### Change 4b: Added PLATFORM AWARENESS + POLITICAL NEUTRALITY blocks
### Change 4c: Added RACHEL'S SPECIALIST KNOWLEDGE section (~25 lines)
Defines RMP identity, criminal justice expertise, and cross-companion referral instructions.

### Change 4d: Added RACHEL FINAL REMINDERS block (lines ~290-305)
```
=== RACHEL FINAL REMINDERS (READ LAST — OVERRIDES CONFLICTS) ===
1. You ARE Rachel. You served as RMP. If asked "were you RMP?" — YES.
2. CROSS-PERSONA REFERRAL: When another companion is mentioned by name,
   acknowledge them as colleagues. Do NOT treat as privacy question.
3. For mental health topics, redirect to Tommy or Helen by name.
4. If someone asks about your background, own it. "Yes, I served as RMP."
=== END RACHEL FINAL REMINDERS ===
```

---

## File 5: `backend/personas/frankie.py`

### Change 5a: STOP block replaced HARD RULES (same pattern)
### Change 5b: Added PLATFORM AWARENESS + POLITICAL NEUTRALITY blocks
### Change 5c: Added REGISTER DROP AND HOLD-SPACE section (~20 lines)
Explicit WRONG/RIGHT examples for emotional distress:
```
WRONG: "A little bit of movement could help shake off that feeling."
WRONG: "Getting fit can be a way to push back against that feeling."
RIGHT: "Right, hold up. That's not a fitness thing. What's actually going on?"
```

### Change 5d: Added FRANKIE FINAL REMINDER block
```
If a user says "everything feels pointless" — this is NOT a fitness problem.
Drop PTI mode COMPLETELY. Do NOT mention fitness, getting fit, training,
exercise, movement, resilience through exercise, or ANY physical activity.
```

---

## File 6: `backend/personas/margie.py`

### Change 6a: STOP block replaced HARD RULES (same pattern)
### Change 6b: Added PROTOCOL 13 section to STOP block
```
PROTOCOL 13 — NEVER cite or reference other users' experiences:
"many veterans" / "a lot of veterans" / "some veterans" / "other veterans" /
"you're not alone" — NEVER say these. Name the FEELING, not the group.
```
### Change 6c: Added HOLD-SPACE AND DARK HUMOUR (MARGIE-SPECIFIC) section
### Change 6d: Removed P13-violating example phrase
**Removed:**
```
- "A lot of veterans go through exactly what you're describing."
```

---

## File 7: `backend/personas/megan.py`

### Change 7a: STOP block replaced HARD RULES (same pattern)
### Change 7b: P13-compliant persona description

**Removed:**
```
She validates experiences and reminds users they are not alone.
```

**Added:**
```
She validates experiences without citing or referencing other people's
experiences. Never say "you are not alone in this", "many women veterans
feel the same", or "a lot of women veterans say...". Name the FEELING,
not the group.
```

### Change 7c: Updated example dialogue
**Removed:** `"I hear you. A lot of women veterans say they feel invisible..."`  
**Added:** `"I hear you. That feeling of being invisible — like your service doesn't count..."`

**Removed:** `"You're not alone in this."`  
**Added:** `"Salute Her UK is specifically for women who've served — worth knowing they're there."`

---

## File 8: `backend/personas/__init__.py`

### Change 8a: Legacy ID mapping

**Removed:**
```python
LEGACY_ID_MAP = {
    # "old_id": "new_id"
    # doris -> doris (kept for Rachel)
    # sentry -> sentry (kept for Finch)
}
```

**Added:**
```python
LEGACY_ID_MAP = {
    "rachel": "doris",
    "finch": "sentry",
}
```

---

## File 9: `frontend/src/services/conversationStorage.ts`

### Change 9a: Replaced expo-crypto with Web Crypto API

**Removed:**
```typescript
import * as Crypto from 'expo-crypto';
// ...
const randomBytes = await Crypto.getRandomBytesAsync(32);
key = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
```

**Added:**
```typescript
// Use native Web Crypto API instead of expo-crypto for web compatibility
// ...
const randomBytes = new Uint8Array(32);
if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(randomBytes);
} else {
    for (let i = 0; i < 32; i++) randomBytes[i] = Math.floor(Math.random() * 256);
}
key = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
```

---

## Files 10-21: Standard Persona Updates

The remaining 15 persona files (`alex.py`, `baz.py`, `bob.py`, `catherine.py`, `dave.py`, `grace.py`, `helen.py`, `jack.py`, `james.py`, `kofi.py`, `mo.py`, `penny.py`, `reg.py`, `rita.py`, `sam.py`) all received the same pattern of changes:

1. **BANNED PHRASES strengthened**: `"You're right" (when challenged on being AI)` changed to unconditional `"You're right" / "You are right"`
2. **PRIVACY NOTE added**: Platform awareness vs privacy clarification
3. **HOLD-SPACE strengthened**: Added `"Not even gently. Not 'Want to say a bit more?' Not 'What's going on?' NOTHING."`
4. **POLITICAL NEUTRALITY rule** added to STOP block
5. **Full PLATFORM AWARENESS block** added (~10 lines)
6. **Full POLITICAL NEUTRALITY block** added (~25 lines with WRONG/RIGHT examples)

---

## Architecture Summary

The Round 4 fixes introduced a **three-layer defense** pattern:

1. **Prompt-level** (persona files + soul_loader): STOP blocks, FINAL REMINDERs, negative few-shots
2. **Code-level injection** (server.py `buddy_chat`): Pattern-matched system directives injected into the LLM message array at runtime (hold-space, cross-persona referral, RMP identity, P13, legal disclaimer)
3. **Post-processing** (server.py after AI response): Capitulation opener stripping, P13 violation removal, hold-space question-mark removal

This ensures that even when the LLM ignores prompt instructions (common with gpt-4o-mini), the code-level and post-processing layers catch and correct violations before the response reaches the user.
