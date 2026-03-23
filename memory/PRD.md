# RadioCheck Veterans Support Platform - PRD

## Original Problem Statement
Build a comprehensive veterans support platform with:
1. Admin Portal - For managing content, users, events, and platform settings
2. Staff Portal - For staff members to manage veteran interactions and support
3. Mobile App - For veterans to access resources, events, and community features
4. Jitsi-based virtual events accessible from all platforms

## Core User Personas
- **Admins**: Platform administrators managing content and users
- **Staff**: Support workers assisting veterans
- **Veterans**: End users accessing resources and community features

## Completed Features

### Phase 1: Portal Refactoring (DONE - Dec 2025)
- [x] Admin Portal refactored from monolithic to modular components
- [x] Staff Portal refactored (3,907 → 271 lines)
- [x] Extracted 19+ reusable components and hooks

### Phase 2: Documentation (DONE - Dec 2025)
- [x] Created `/app/portal/public/docs/ADMIN_USER_MANUAL.md`
- [x] Created `/app/portal/public/docs/STAFF_USER_MANUAL.md`

### Phase 3: Virtual Events with Agora (DONE - Dec 2025)
- [x] Events feature scaffolding across all platforms
- [x] Admin portal: Event creation with video room generation
- [x] Staff portal: Events tab with join functionality
- [x] Mobile app: Events visibility and join button
- [x] Backend API: `/api/events/upcoming`, `POST /api/events`
- [x] Replaced Jitsi with Agora Video SDK for reliable video conferencing

### Phase 4: Marketing Website (DONE - Dec 2025)
- [x] Created modern landing page for radiocheck.me
- [x] Added "Meet the AI Team" section with 9 AI companions
- [x] Added portal links (app, staff, admin)
- [x] Created Privacy Policy page
- [x] Created Terms of Service page
- [x] Configured subdomain rewrites for Vercel deployment

## In Progress
None - All P0 items complete

## Upcoming Tasks (P1)
- [ ] Enhance Jitsi with TikTok Live-like UX (chat overlay, reactions)
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
│       └── events.py  # Event management API
├── frontend/          # React Native (Expo) Mobile App
│   └── src/
│       └── components/
│           ├── EventsSection.tsx
│           └── JitsiMeetComponent.tsx  # Reference implementation
└── portal/            # Next.js Admin/Staff Portal
    ├── public/docs/   # User manuals
    └── src/
        ├── app/
        │   ├── admin/page.tsx
        │   └── staff/page.tsx
        └── components/
            ├── admin/tabs/EventsTab.tsx
            ├── staff/tabs/EventsTab.tsx
            └── shared/JitsiRoom.tsx  # Fixed Dec 2025
```

## Key API Endpoints
- `GET /api/events/upcoming` - Fetch upcoming events
- `POST /api/events` - Create new event (admin only)
- `GET /api/events/:id` - Get single event details

## Database Schema (MongoDB)
- **events**: `{ title, description, date, event_type?, location?, jitsi_room_id?, created_by, created_at }`

## Third-Party Integrations
- **Agora Video SDK**: Video conferencing via Agora RTC (App ID: cfd84eb3fcd7490cbe366d8cd1a4d974)

## Known Issues
None currently active

## Testing Notes
- Portal build verification: `cd /app/portal && yarn build`
- Preview URL: https://event-join-fix.preview.emergentagent.com
