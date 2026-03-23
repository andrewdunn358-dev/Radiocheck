# RadioCheck Veterans Support Platform - PRD

## Original Problem Statement
Build a comprehensive veterans support platform with:
1. Admin Portal - For managing content, users, events, and platform settings
2. Staff Portal - For staff members to manage veteran interactions and support
3. Mobile App - For veterans to access resources, events, and community features
4. Video-based virtual events accessible from all platforms (now using Agora Video SDK)

## Core User Personas
- **Admins**: Platform administrators managing content and users
- **Staff**: Support workers assisting veterans
- **Veterans**: End users accessing resources and community features

## Completed Features

### Phase 1: Portal Refactoring (DONE)
- [x] Admin Portal refactored from monolithic to modular components
- [x] Staff Portal refactored (3,907 -> 271 lines)
- [x] Extracted 19+ reusable components and hooks

### Phase 2: Documentation (DONE)
- [x] Created `/app/portal/public/docs/ADMIN_USER_MANUAL.md`
- [x] Created `/app/portal/public/docs/STAFF_USER_MANUAL.md`

### Phase 3: Virtual Events with Agora (DONE - Feb 2026)
- [x] Events feature scaffolding across all platforms
- [x] Admin portal: Event creation (virtual only, no in-person/hybrid) + Join button
- [x] Staff portal: Events tab with Join button for all events
- [x] Mobile app: Events visibility and Join via Agora Video SDK
- [x] Backend API: `/api/events/upcoming`, `POST /api/events`, join returns Agora config
- [x] Replaced Jitsi with Agora Video SDK on ALL platforms
- [x] Agora channel naming consistent across platforms (`radiocheck_event{id}`)
- [x] All events default to virtual (removed in-person/hybrid options)

### Phase 4: Marketing Website (DONE)
- [x] Created modern landing page for radiocheck.me
- [x] Added "Meet the AI Team" section with 9 AI companions
- [x] Added portal links (app, staff, admin)
- [x] Privacy Policy and Terms of Service pages

### Phase 5: Subdomain Routing (DONE)
- [x] Next.js middleware for subdomain routing
- [x] Verified working on Vercel by user

## Bug Fixes (Feb 2026)
- [x] Staff portal 404 error: Fixed API endpoint from `/api/events` to `/api/events/upcoming`
- [x] Mobile app "Video configuration missing": Added Agora App ID fallback
- [x] Admin portal missing Join button: Removed `isVirtualEvent` check, all events are virtual
- [x] Events stored as "in-person": Updated all DB records and defaults to "virtual"
- [x] EventResponse missing `event_type`: Added field to Pydantic model
- [x] Removed event type selector from create form (always virtual)

## Upcoming Tasks (P1)
- [ ] Enhance video UX with TikTok Live-like experience (chat overlay, reactions)
- [ ] Add push notifications for live events
- [ ] Create PDF exports of user manuals

## Future/Backlog (P2)
- [ ] Full CMS visual editor
- [ ] Discussion Forums
- [ ] Mood Tracker
- [ ] Welsh Language Support

## Technical Architecture
```
/app
├── backend/           # FastAPI backend
│   └── routers/
│       └── events.py  # Event management API (Agora config, virtual-only)
├── frontend/          # React Native (Expo) Mobile App
│   └── src/
│       └── components/
│           ├── EventsSection.tsx        # Uses AgoraMeetComponent
│           └── AgoraMeetComponent.tsx   # Agora video for mobile
└── portal/            # Next.js Admin/Staff Portal
    └── src/
        ├── components/
        │   ├── admin/tabs/EventsTab.tsx   # Virtual-only events, Join button
        │   ├── staff/tabs/EventsTab.tsx   # Join button, correct API endpoint
        │   └── shared/AgoraRoom.tsx       # Agora video for portal
        └── middleware.ts                  # Subdomain routing
```

## Key API Endpoints
- `GET /api/events/upcoming` - Fetch upcoming events (includes event_type field)
- `POST /api/events` - Create new event (defaults to virtual)
- `POST /api/events/:id/join` - Join event (returns agora_channel, agora_app_id)

## Third-Party Integrations
- **Agora Video SDK**: Video conferencing on ALL platforms (App ID: cfd84eb3fcd7490cbe366d8cd1a4d974)
