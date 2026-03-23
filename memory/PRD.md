# RadioCheck Veterans Support Platform - PRD

## Original Problem Statement
Build a comprehensive veterans support platform with admin portal, staff portal, mobile app, and virtual events using Agora Video SDK.

## Completed Features

### Virtual Events with Agora (DONE - Feb 2026)
- [x] All platforms use Agora Video SDK (portal + mobile app)
- [x] Backend generates Agora RTC tokens (secured mode with App Certificate)
- [x] Admin portal: Event creation (virtual only) + Join button
- [x] Staff portal: Events tab with Join button
- [x] Mobile app: Events via AgoraMeetComponent
- [x] Token-based authentication (2-hour expiry)
- [x] Channel naming consistent: `radiocheck_event{id}`

### Portal Refactoring, Docs, Marketing, Subdomain Routing (DONE)
- All previously completed features remain intact

## Bug Fixes (Feb 2026)
- [x] Agora "invalid vendor key" error: Added server-side token generation using App Certificate
- [x] Staff portal 404: Fixed API endpoint to `/api/events/upcoming`
- [x] Mobile app "Video configuration missing": Added App ID fallback
- [x] Admin missing Join button: Removed isVirtualEvent check (all events are virtual)
- [x] Removed in-person/hybrid event type selector (always virtual)
- [x] Updated all DB events to virtual type

## Upcoming Tasks (P1)
- [ ] TikTok Live-like video UX (chat overlay, reactions)
- [ ] Push notifications for live events
- [ ] PDF export of user manuals

## Future/Backlog (P2)
- [ ] CMS visual editor, Discussion Forums, Mood Tracker, Welsh Language Support

## Third-Party Integrations
- **Agora Video SDK**: App ID `cfd84eb3fcd7490cbe366d8cd1a4d974`, App Certificate on backend only
- Token generated server-side via `agora-token-builder` Python library

## Key API Endpoints
- `GET /api/events/upcoming` - List events (includes event_type)
- `POST /api/events` - Create event (defaults to virtual)
- `POST /api/events/:id/join` - Join event (returns agora_token, agora_channel, agora_app_id)
