# RadioCheck Veterans Support Platform - PRD

## Original Problem Statement
Build a comprehensive veterans support platform with admin portal, staff portal, mobile app, and virtual events. The platform includes AI companion personas for veteran mental health support, with a sophisticated safeguarding system.

## Completed Features

### Virtual Events with Agora (DONE - Feb 2026)
- [x] All platforms use Agora Video SDK (portal + mobile app)
- [x] Backend generates Agora RTC tokens (secured mode with App Certificate)
- [x] Admin portal: Event creation (virtual only) + Join button
- [x] Staff portal: Events tab with Join button
- [x] Mobile app: Events via AgoraMeetComponent
- [x] Token-based authentication (2-hour expiry)
- [x] Channel naming consistent: `radiocheck_event{id}`
- [x] Agora credentials moved from hardcoded to environment variables (AGORA_APP_ID, AGORA_APP_CERTIFICATE)

### Tommy AI Persona Enhancement (DONE - Feb 2026)
- [x] Enhanced Tommy persona prompt with full Capability Brief behavioral model
- [x] Trauma-informed responses (slow escalation, no false reassurance)
- [x] Anti-dependency architecture (not optimising for engagement)
- [x] Dark humour tolerance (match register, don't analyse)
- [x] Anger tolerance (hold space, don't redirect)
- [x] Honest AI identity (comfortable with ambiguity)
- [x] Session presence (maintain emotional arc continuity)
- [x] Banned phrases awareness (clinical language, pivot tic, performed warmth)
- [x] Grief protocol (ask about the person first, sit with loss)

### Negation Handling Fix - Scenario 008 (DONE - Feb 2026)
- [x] Enhanced is_negated() in safety/safety_monitor.py with em-dash/en-dash handling
- [x] Added UK slang negation patterns (knackered, shattered, done in)
- [x] Post-indicator joking detection (just joking, lol, haha)
- [x] Full-sentence scan for explicit denial constructions
- [x] Eliminated duplicate is_negated() from server.py (now imports from safety_monitor)
- [x] Verified genuine risk still correctly detected (not false-negated)

### Soul Document & Safeguarding Alignment (DONE - Feb 2026)
- [x] Soul Document (soul.md) contains 13 non-negotiable behavioral protocols
- [x] Soul injection applied to ALL 16 AI personas at runtime
- [x] SAFEGUARDING_ADDENDUM rewritten to align with Soul Document
- [x] Removed banned phrases (performed warmth, hollow validation) from addendum
- [x] Crisis resources preserved (Samaritans, Combat Stress, Veterans Gateway, NHS, 999)

### Portal Refactoring, Docs, Marketing, Subdomain Routing (DONE)
- All previously completed features remain intact

## Bug Fixes (Feb 2026)
- [x] Agora "invalid vendor key" error: Added server-side token generation
- [x] Staff portal 404: Fixed API endpoint to `/api/events/upcoming`
- [x] Mobile app "Video configuration missing": Added App ID fallback
- [x] Admin missing Join button: Removed isVirtualEvent check
- [x] Removed in-person/hybrid event type selector (always virtual)
- [x] Updated all DB events to virtual type
- [x] Hardcoded Agora credentials moved to .env

## Pending User Verification
- [ ] Camera auto-play on mobile join (retry loop fix deployed)
- [ ] Staff portal `.map()` crash (Array.isArray safety check deployed)

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

## Third-Party Integrations
- **Agora Video SDK**: App ID and Certificate loaded from backend .env
- **OpenAI GPT-4o-mini**: Primary AI provider for chat
- **Google Gemini 2.0 Flash**: Fallback AI provider

## Key API Endpoints
- `GET /api/events/upcoming` - List events
- `POST /api/events` - Create event (defaults to virtual)
- `POST /api/events/:id/join` - Join event (returns agora_token, agora_channel, agora_app_id)
- `GET /api/events/admin/attendance-history` - Historical attendance data
- `POST /api/ai-buddies/chat` - AI chat with persona (soul document + safeguarding injected)

## Architecture Notes
- **Soul Document**: `/app/backend/personas/soul.md` - 13 behavioral protocols
- **Soul Loader**: `/app/backend/personas/soul_loader.py` - Injects into all prompts
- **Safety Monitor**: `/app/backend/safety/safety_monitor.py` - Canonical is_negated()
- **Unified Safety**: `/app/backend/safety/unified_safety.py` - Multi-layer safety system
- **16 Personas**: `/app/backend/personas/` - Each inherits from soul document
- **Prompt Assembly**: `get_soul_injection() + persona_prompt + SAFEGUARDING_ADDENDUM`
