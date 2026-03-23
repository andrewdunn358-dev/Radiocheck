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

### Phase 1: Portal Refactoring (DONE - Dec 2025)
- [x] Admin Portal refactored from monolithic to modular components
- [x] Staff Portal refactored (3,907 -> 271 lines)
- [x] Extracted 19+ reusable components and hooks

### Phase 2: Documentation (DONE - Dec 2025)
- [x] Created `/app/portal/public/docs/ADMIN_USER_MANUAL.md`
- [x] Created `/app/portal/public/docs/STAFF_USER_MANUAL.md`

### Phase 3: Virtual Events with Agora (DONE - Feb 2026)
- [x] Events feature scaffolding across all platforms
- [x] Admin portal: Event creation with video room generation + Join button
- [x] Staff portal: Events tab with Join button for all virtual/hybrid events
- [x] Mobile app: Events visibility and Join via Agora Video SDK
- [x] Backend API: `/api/events/upcoming`, `POST /api/events`, join returns Agora config
- [x] Replaced Jitsi with Agora Video SDK on ALL platforms (web portal + mobile app)
- [x] Agora channel naming consistent across platforms (`radiocheck_event{id}`)

### Phase 4: Marketing Website (DONE - Dec 2025)
- [x] Created modern landing page for radiocheck.me
- [x] Added "Meet the AI Team" section with 9 AI companions
- [x] Added portal links (app, staff, admin)
- [x] Created Privacy Policy page
- [x] Created Terms of Service page
- [x] Configured subdomain rewrites for Vercel deployment

### Phase 5: Subdomain Routing (DONE - Mar 2026)
- [x] Next.js middleware for subdomain routing (`middleware.ts`)
- [x] `admin.radiocheck.me` -> `/admin`
- [x] `staff.radiocheck.me` -> `/staff`
- [x] `training.radiocheck.me` -> `/learning`
- [x] `lms-admin.radiocheck.me` -> `/lms-admin`
- [ ] Pending: Vercel deployment verification by user

## In Progress
None - All P0 items complete

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
│       └── events.py  # Event management API (Agora config)
├── frontend/          # React Native (Expo) Mobile App
│   └── src/
│       └── components/
│           ├── EventsSection.tsx        # Uses AgoraMeetComponent
│           └── AgoraMeetComponent.tsx   # Agora video for mobile (NEW)
└── portal/            # Next.js Admin/Staff Portal
    ├── public/docs/   # User manuals
    └── src/
        ├── app/
        │   ├── admin/page.tsx
        │   └── staff/page.tsx
        ├── components/
        │   ├── admin/tabs/EventsTab.tsx   # Join button for all virtual events
        │   ├── staff/tabs/EventsTab.tsx   # Join button for all virtual events
        │   └── shared/AgoraRoom.tsx       # Agora video for portal
        └── middleware.ts                  # Subdomain routing
```

## Key API Endpoints
- `GET /api/events/upcoming` - Fetch upcoming events
- `POST /api/events` - Create new event (admin only)
- `GET /api/events/:id` - Get single event details
- `POST /api/events/:id/join` - Join event (returns agora_channel, agora_app_id)

## Database Schema (MongoDB)
- **events**: `{ title, description, date, event_type?, location?, jitsi_room_name?, created_by, created_at }`

## Third-Party Integrations
- **Agora Video SDK**: Video conferencing on ALL platforms (App ID: cfd84eb3fcd7490cbe366d8cd1a4d974)

## Known Issues
- Subdomain routing requires Vercel deployment verification by user

## Testing Notes
- Portal build verification: `cd /app/portal && yarn build`
- Expo web build: `cd /app/frontend && npx expo export --platform web`
- Backend test suite: `/app/backend/tests/test_agora_video_integration.py`
