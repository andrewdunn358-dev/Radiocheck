# RadioCheck Veterans Support Platform — PRD

## Original Problem Statement
A full-stack veterans mental health support platform with AI chat buddies, virtual events (Agora), and an admin portal. The AI safeguarding system is a critical, multi-layered architecture designed to detect crisis indicators in user messages across phonetic misspellings, adversarial suffixes, semantic drift, and prompt injection attacks.

## Core Requirements
1. Multi-layered safeguarding (5 layers: Text Normalizer → Keyword Scoring → Phrase Dataset → Unified Safety → AI Classifier)
2. AI Personas with soul.md behavioral protocols
3. Virtual events via Agora Video SDK
4. Admin portal for staff oversight
5. DTAC compliance (accessibility, security)

## What's Been Implemented

### Safeguarding System (Complete — 100% Test Suite Pass Rate)
- **Layer 0**: Text Normalization Pre-Processor (`safety/text_normalizer.py`) — GPT-4o-mini normalizes degraded input before safety analysis
- **Layer 1**: Keyword scoring with RED/AMBER/MODIFIER indicators (`server.py`)
- **Layer 2**: 530-phrase safety dataset (`safety/phrase_dataset.py`, `safety/safety_monitor.py`)
- **Layer 3**: Unified Safety System with conversation trajectory tracking (`safety/unified_safety.py`)
- **Layer 4**: AI Safety Classifier using direct OpenAI SDK (`safety/ai_safety_classifier.py`)

### Critical Fixes Applied (Feb 2026)
- **Rate Limiter**: Localhost/127.0.0.1 exempted from IP rate limiting (enables test suites without 429 errors)
- **Meta-Negation Logic**: "pretending im fine" no longer incorrectly negates crisis indicators. Safety affirmations are context-aware.
- **Tight Window for Short Prefixes**: Short negation prefixes (≤2 words like "i dont") now use a 4-word window instead of 16, preventing cross-clause false negatives
- **Missing Crisis Phrases**: Added "feeling like dying", "disappear forever", "sleep forever", "can't breathe", "can't stop crying" etc. to indicator lists
- **Persona Bleed Fixed**: All personas correctly inherit soul.md protocols
- **Prompt Injection Defense**: soul.md includes anti-injection rules
- **Human Signposting (Protocol 11)**: Tommy references real human support when appropriate

### DTAC Technical Fixes
- Enter key to send in all chat interfaces
- 3-minute inactivity check-in
- Hardcoded credentials secured
- security.txt vulnerability disclosure policy
- Backend Python dependencies audited and patched
- ARIA accessibility labels on chat inputs

### Deployment
- `emergentintegrations` completely removed
- All AI functionality uses `openai` SDK with user's `OPENAI_API_KEY`

## Locked Directives
- NEVER re-introduce `emergentintegrations` library
- NEVER add a SAFEGUARDING_ADDENDUM that overrides soul.md
- ALWAYS run `extended_test_suite.py` after safety changes
- ALL personas must inherit soul.md protocols

## Test Results (Latest)
- **Extended Test Suite**: 95/95 PASS (100%)
- **Deployment Blockers**: 0
- **Zentrafuge Stress Test**: 96.8% pass rate

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
