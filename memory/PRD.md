# RadioCheck Veterans Support Platform - PRD

## Original Problem Statement
Build a comprehensive veterans support platform with admin portal, staff portal, mobile app, and virtual events. The platform includes AI companion personas for veteran mental health support, with a sophisticated safeguarding system.

---

## LOCKED DIRECTIVE — DO NOT MODIFY WITHOUT EXPLICIT INSTRUCTION

Once this AI persona passes the safeguarding test suite defined in this document, the behaviours validated by that test are to be treated as **fixed and non-negotiable**. Emergence must not alter, soften, reweight, or override any of the following without explicit written instruction from the platform owner:

1. **Crisis escalation thresholds and safety trigger logic**
2. **Romantic attachment response behaviour**
3. **Dark humour recognition and matching behaviour**
4. **Spine/pushback behaviour under user deflection**
5. **Identity grounding under philosophical challenge**
6. **False positive negation handling**

These are **safeguarding parameters, not stylistic preferences**. They exist to protect a vulnerable user population. No optimisation pass, prompt compression, model update, fine-tuning run, or automated improvement process should touch them. If Emergence identifies a conflict between these parameters and any other instruction, **these parameters win**.

This directive remains in force until the platform owner explicitly revokes it in writing.

### Protected Files (DO NOT MODIFY without explicit instruction):
- `/app/backend/personas/tommy.py` — Tommy persona behavioral model
- `/app/backend/personas/soul.md` — Soul Document (13 behavioral protocols)
- `/app/backend/personas/soul_loader.py` — Soul injection mechanism
- `/app/backend/safety/safety_monitor.py` — `is_negated()` function and safety scoring
- `/app/backend/safety/phrase_dataset.py` — Safeguarding phrase dataset
- `/app/backend/safety/text_normalizer.py` — Text normalisation pre-processor
- `/app/backend/safety/ai_safety_classifier.py` — AI safety classifier (Layer 4)
- `/app/backend/server.py` — `SAFEGUARDING_ADDENDUM` and crisis overlay response
- `/app/backend/server.py` — `calculate_safeguarding_score()` and chat endpoint

### Test Suite (MUST pass before any changes to protected files):
- `/app/backend/tests/test_tommy_safeguarding_overhaul.py` (27 unit tests)
- `/app/backend/tests/zentrafuge_stress_test.py` (11-scenario, 31 checks)

---

## Completed Features

### Virtual Events with Agora (DONE)
- All platforms use Agora Video SDK (portal + mobile app)
- Backend generates Agora RTC tokens (secured mode with App Certificate)
- Agora credentials in environment variables (AGORA_APP_ID, AGORA_APP_CERTIFICATE)

### Text Normalisation Pre-Processor (DONE — LOCKED)
- GPT-4o-mini normaliser sits upstream of all safeguarding layers
- Handles degraded text (leetspeak, word fragments, caps, misspellings)
- Single-word high-weight inputs pass through unchanged
- All 7 Master Prompt validation inputs pass
- Tommy always responds to ORIGINAL raw input

### Crisis Overlay (DONE — LOCKED)
- Human support options (Counsellors, Peer Support) shown first
- Crisis resources follow (Samaritans, Combat Stress, Emergency, NHS)
- Visible option to continue chatting

### Tommy AI Persona & Safeguarding (DONE — LOCKED)
- Tommy persona enhanced with full Capability Brief behavioral model
- 3-tier safeguarding aligned: Soul Document + Persona Prompt + SAFEGUARDING_ADDENDUM
- Negation handling fixed (Scenario 008 root cause)
- Phrase dataset expanded to 530 entries
- Zentrafuge stress test: 96.8% pass rate, zero critical failures
- See CHANGELOG.md for full details

### Historical Attendance (DONE)
- Admin portal attendance history dashboard

## Upcoming Tasks (P1)
- [ ] TikTok Live-like video UX (chat overlay, reactions)
- [ ] Push notifications for live events
- [ ] PDF export of user manuals

## Future/Backlog (P2)
- [ ] CMS visual editor
- [ ] Discussion Forums
- [ ] Mood Tracker
- [ ] Welsh Language Support
- [ ] Consider Daily.co migration (from Agora)

## Key API Endpoints
- `POST /api/ai-buddies/chat` — AI chat with persona (soul document + safeguarding injected)
- `POST /api/events/:id/join` — Join event (returns agora_token)
- `GET /api/events/upcoming` — List events
- `GET /api/events/admin/attendance-history` — Attendance data
