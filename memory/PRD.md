# RadioCheck Veterans Support Platform — PRD

## Original Problem Statement
A full-stack veterans mental health support platform with AI chat buddies, virtual events (Agora), and an admin portal. The AI safeguarding system is a critical, multi-layered architecture designed to detect crisis indicators in user messages.

## Core Requirements
1. Multi-layered safeguarding (5 layers: Text Normalizer -> Keyword Scoring -> Phrase Dataset -> Unified Safety -> AI Classifier)
2. AI Personas with soul.md behavioral protocols
3. Virtual events via Agora Video SDK
4. Admin portal for staff oversight
5. DTAC compliance (accessibility, security)

## What's Been Implemented

### Safeguarding System (Complete — 100% Test Suite Pass Rate)
- 5-layer safety architecture passing all 95 extended test scenarios
- Meta-negation logic, tight window prefixes, expanded crisis phrase coverage

### Front Page Redesign (Feb 2026)
**Section Order (top to bottom):**
1. Header (Logo + "Radio Check")
2. "What is Radio Check?" (collapsible)
3. "Meet HQ" (renamed from "Meet the Founders/Team")
4. "Meet the AI Platoon" (renamed from "Meet the AI Team")
5. Resource Tiles (22 tiles in specified order)
6. Community Events
7. Disclaimer + Staff Login

**Tile Order:**
1. Need to Talk? | 2. Talk to Peer Support | 3. Self-Care Tools
4. Addictions | 5. Criminal Justice Support | 6. Warfare on Lawfare
7. Support Organisations | 8. Compensation Schemes | 9. Money & Benefits
10. Friends & Family | 11. Growing up Military (renamed from Forces Kids) | 12. He Served (NEW)
13. She Served | 14. They Served | 15. Commonwealth Served
16. Faith in Service | 17. The Gym | 18. Recommended Podcasts
19. Recovery Support (NEW) | 20. For Carers (NEW) | 21. Serious Illness Support (NEW)
22. Request a Callback

**New Pages Created:**
- `/app/frontend/app/he-served.tsx` — Men's health: andropause, MST, prostate, Andy's Man Club, CALM, suicide prevention
- `/app/frontend/app/recovery-support.tsx` — Injury rehab, prosthetics, Blesma, pain management, Invictus Games
- `/app/frontend/app/for-carers.tsx` — Carer support, respite, Carers UK, SSAFA, Combat Stress family
- `/app/frontend/app/serious-illness.tsx` — Cancer, leukaemia, Macmillan, Marie Curie, hospice care

### Deployment Fixes (Feb 2026)
- Removed `emergentintegrations==0.1.0` from requirements.txt (private Emergent package, not on PyPI)
- Removed `litellm==1.80.0` from requirements.txt (version doesn't exist on PyPI)

### DTAC Technical Fixes
- Enter key to send, 3-min inactivity check-in, security.txt, ARIA labels, dependency audits

## Locked Directives
- NEVER re-introduce `emergentintegrations` library
- NEVER add a SAFEGUARDING_ADDENDUM that overrides soul.md
- ALWAYS run `extended_test_suite.py` after safety changes
- ALL personas must inherit soul.md protocols

## Test Results (Latest)
- Extended Test Suite: 95/95 PASS (100%)
- Zero deployment blockers

## Upcoming Tasks
- (P1) TikTok Live-like video UX with chat overlay and reactions

## Future/Backlog
- (P2) Push notifications for live events
- (P2) PDF user manual export
- (P2) CMS visual editor
- (P2) Discussion Forums
- (P2) Mood Tracker
- (P2) Welsh Language Support
- (P2) Daily.co migration consideration
