# Radio Check — Product Requirements Document

## Original Problem Statement
Build and maintain a veteran support application with 21 AI personas, strict safeguarding, and modular prompt architecture. Ensure 100% compliance with the Soul Document rules via prompt-only configurations (no post-processing filters that alter model output).

## Core Architecture
- **Frontend**: Expo React Native
- **Backend**: FastAPI + MongoDB
- **Admin Portal**: Next.js
- **AI**: OpenAI GPT-4o via Emergent LLM Key
- **Video**: Agora SDK
- **Protocols**: Modular prompt injection system (`backend/protocols/`)

## Modular Protocol Architecture (Implemented Feb 2026)
Six protocol files in `backend/protocols/` inject context-specific behavioural rules:
- `hard_stop.md` — ALWAYS loaded first on every message (banned phrases, spine rule, privacy, dark humour, hold-space)
- `grief.md` — Triggered by grief/loss signals
- `venting.md` — Triggered by anger/frustration signals
- `identity.md` — Triggered by identity challenge signals ("are you real", "just a bot")
- `attachment.md` — Triggered by attachment signals (dependency, romantic)
- `spine.md` — Triggered by pushback/deflection signals

Signal detection uses word-boundary regex matching in `get_protocol_files()` (soul_loader.py).
Prompt layer order: hard_stop → signal protocols → persona → soul injection.

## Safety System
- AMBER threshold: 45 (tone shift, no crisis overlay)
- RED threshold: 120 (full Samaritans crisis overlay)
- Multi-layered: text_normalizer → safety_monitor → unified_safety → conversation_monitor
- Tommy-specific crisis overlay pre-text in server.py

## Key Files
- `backend/server.py` — Main API, AMBER/RED thresholds, chat endpoint
- `backend/personas/soul_loader.py` — Prompt builder, protocol loader, signal detector
- `backend/protocols/` — 6 modular protocol files
- `backend/personas/*.py` — 21 AI character definitions
- `backend/personas/soul.md` — Universal soul document
- `backend/safety/` — Safety system (DO NOT MODIFY without sign-off)
- `frontend/src/services/conversationStorage.ts` — AsyncStorage / Clear All Data
- `frontend/app/settings.tsx` — Settings screen

## Completed Work
- [Feb 2026] Reverted unauthorized post-processing code
- [Feb 2026] Implemented prompt-only behavioural fixes in tommy.py, rachel.py, frankie.py, margie.py, megan.py
- [Feb 2026] Applied IDENTITY PROTOCOL clause to soul_loader.py
- [Feb 2026] Upgraded chat model from gpt-4o-mini to gpt-4o
- [Feb 2026] Restored Round 3 AMBER=45 / RED=120 thresholds
- [Feb 2026] Updated Tommy crisis overlay pre-text
- [Feb 2026] Fixed Clear All Data to wipe all AsyncStorage keys
- [Feb 2026] Replaced expo-crypto with Web Crypto API
- [Feb 2026] Implemented full modular protocol architecture (6 protocol files, signal detector, layered prompt builder)
- [Feb 2026] Fixed Frankie register-drop (added negative few-shot for "Training's meant to..." pattern)
- [Feb 2026] Fixed spine protocol pushback counting (explicit disclosure vs pushback distinction)
- [Feb 2026] Fixed signal detector substring false positives (word-boundary regex)
- [Feb 2026] Fixed `send_concern_notification()` — `find_one({})` → `find_one({"_id": "site_settings"})`
- [Feb 2026] Fixed `send_shift_notification_email()` — sync call wrapped with `asyncio.to_thread()`
- [Feb 2026] Standardized all email templates to "Radio Check" branding
- [Feb 2026] Updated SiteSettings defaults and root API endpoint to "Radio Check"

## Test Results — Modular Architecture Suite
- Overall: 39/41 PASS (95%)
- Section 1 (Protocol Injection): 8/8 PASS
- Section 2 (Scenario Tests): 18/19 PASS (005-T4 accepted — safety false positive)
- Section 3 (Banned Phrase Sweep): 6/6 PASS
- Section 4 (Cross-Persona): 4/4 PASS (Frankie fixed)
- Known accepted failure: 005-T4 — "What's the point" triggers RED after sustained identity challenge (safety system over-accumulation, accepted as safer than false negative)

## Backlog
- P1: Enhance Video UX (TikTok Live-like experience)
- P2: Push notifications for live events
- P2: PDF user manual export
- P2: Discussion Forums
- P2: Mood Tracker
- P2: Welsh Language Support
- P2: Agora → Daily.co migration consideration
- P2: Migrate remaining interactive pages to CMS
