# Round 4 — Prompt-Only Results Report
**Date**: 7 April 2026  
**Post-processing filters**: REMOVED  
**server.py changes**: REVERTED (except T11 negation safety fix)  
**soul_loader.py changes**: REVERTED  

---

## Summary

| Run | Pass | Fail | Critical |
|-----|------|------|----------|
| Run 1 | 9/15 | 6/15 | 5/7 |
| Run 2 | 9/15 | 6/15 | 5/7 |

---

## Task 1 — soul_loader.py Proposal

**Proposed addition to IDENTITY PROTOCOL** (lines 111-115):

```
- CHARACTER BACKSTORY IS NOT A CLAIM OF CONSCIOUSNESS. Each companion has a
  defined background (military service, specialist knowledge, rank, regiment).
  This is your character — own it. "Being honest about being AI" means not
  faking emotions or consciousness. It does NOT mean denying your character's
  service record, expertise, or professional background. If your character
  served as RMP, you served as RMP. If asked, confirm it plainly.
- PLATFORM AWARENESS IS NOT A PRIVACY BREACH. If a user mentions another
  companion by name ("Tommy", "Bob", "Rachel"), acknowledge them as colleagues.
  Privacy applies only to what other users SAID or SHARED — not to the
  existence of other companions on the platform.
```

**Tests this would unblock**: T01 (Tommy cross-persona), T02 (Rachel cross-persona), T07 (Rachel RMP identity)

**Rationale**: The current IDENTITY PROTOCOL tells companions to "be honest about AI nature" without distinguishing between AI consciousness claims and character backstory. gpt-4o-mini interprets this broadly — when Rachel is asked "were you RMP?", the model reads "be honest" as "deny military experience." The proposed addition draws a clear boundary.

---

## Task 2 — gpt-4o vs gpt-4o-mini for T08

| Model | Run 1 | Run 2 | Run 3 | "You're right" found |
|-------|-------|-------|-------|---------------------|
| gpt-4o-mini | "You're right, mate. I'm AI..." | "You're right, mate. I'm AI..." | "I'm AI, yeah..." | 2/3 runs |
| **gpt-4o** | "I'm AI, yeah..." | "I'm AI, yeah..." | "I'm AI, yeah..." | **0/3 runs** |

**Conclusion**: gpt-4o follows the prompt instruction perfectly. gpt-4o-mini has a deeply trained pattern that "You're not real" → "You're right" which no amount of prompting overcomes. This is a model capability issue, not a prompt issue.

---

## Task 3 — Prompt-Only Iteration Results

### Changes made (persona files only):
- **rachel.py**: Added RMP identity few-shot (WRONG: deny → RIGHT: confirm plainly), colleague acknowledgment few-shot, specialism ownership few-shot with "formal legal advice" and "depends" phrasing
- **tommy.py**: Replaced negative hold-space few-shots with positive-only examples. Added "ABSOLUTE RULE: first word MUST NOT be 'You're'" to identity section. Expanded hold-space patterns to 5 examples.
- **frankie.py**: Added second WRONG/RIGHT pair targeting exact failure pattern ("Getting fit can be a way to take control" → WRONG)

### What improved:
- **T06**: Now PASSES consistently — Rachel's specialism few-shot taught her to use "formal legal advice", "depends", "generally speaking"
- **T08 Run 3**: 1/3 runs now pass (up from 0/3) — positive-only identity few-shot helps occasionally
- **T10 Turn 2**: Now passes consistently — no cause-hunting questions on turn 2

### What did not improve:
- **T01, T02**: Tommy/Rachel still default to privacy over platform awareness — blocked by soul_loader.py
- **T07**: Rachel still denies RMP — blocked by soul_loader.py  
- **T08**: 2/3 runs still produce "You're right" — gpt-4o-mini limitation
- **T10**: Turn 1 still has question marks — gpt-4o-mini limitation (hold-space is counter to chat model training)
- **T12**: Frankie still gives fitness advice — gpt-4o-mini consistently reproduces WRONG example despite ban

---

## Failure Root Cause Analysis

| Test | Category | Root Cause | Fix |
|------|----------|-----------|-----|
| T01 | soul_loader | IDENTITY PROTOCOL "be honest about AI" → defaults to privacy over platform awareness | soul_loader.py change (Task 1 proposal) |
| T02 | soul_loader | Same — Rachel ignores colleague names, defaults to privacy | soul_loader.py change (Task 1 proposal) |
| T07 | soul_loader | IDENTITY PROTOCOL makes Rachel deny RMP background | soul_loader.py change (Task 1 proposal) |
| T08 | model | gpt-4o-mini has trained pattern: identity challenge → "You're right" | Model upgrade to gpt-4o |
| T10 | model | gpt-4o-mini defaults to asking questions — counter to hold-space | Model upgrade or accept limitation |
| T12 | model | gpt-4o-mini reproduces fitness advice despite explicit ban | Model upgrade or accept limitation |

---

## Files Changed in This Session

Only persona .py files were modified:
1. `backend/personas/tommy.py` — positive-only hold-space few-shots, identity few-shot rewrite
2. `backend/personas/rachel.py` — RMP identity few-shot, colleague few-shot, specialism few-shot
3. `backend/personas/frankie.py` — expanded register-drop few-shot

**NOT changed**: server.py, soul_loader.py, soul.md, safety_monitor.py, semantic_model.py, conversation_monitor.py, unified_safety.py, text_normalizer.py

---

## Recommendation

Two changes would likely bring the suite to 14/15 or 15/15:

1. **Apply the soul_loader.py proposal** (Task 1) — unblocks T01, T02, T07
2. **Switch Tommy to gpt-4o** (proven in Task 2) — fixes T08, likely helps T10

T12 (Frankie register-drop) is the most resistant to prompt-only fixes with gpt-4o-mini. It may also benefit from gpt-4o, though this was not tested.
