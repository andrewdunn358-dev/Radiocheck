# Radio Check Veterans Support - Product Requirements Document

## Original Problem Statement
Migration of legacy JavaScript portals (admin, staff, LMS) into a unified Next.js/Expo application. Primary goals:
1. **(P0) Feature Parity**: New React portals must replicate all functionality of legacy vanilla JS portals
2. **(P0) Production Stability**: Application must build and run on Render without crashes
3. **(P0) Unified Codebase**: All portals consolidated within `/app/portal/`
4. **(P1) Improved Maintainability**: Modular, well-structured codebase

## Architecture
```
/app
├── backend/           # FastAPI backend
│   ├── routers/       # API route handlers
│   └── server.py      # Main server with Socket.IO
├── portal/            # Next.js unified portal (admin, staff, LMS)
│   └── src/
│       ├── app/       # Pages (staff/, admin/, lms-admin/, lms-learner/)
│       ├── hooks/     # React hooks (useWebRTCPhone, useStaffAuth, etc.)
│       └── lib/       # API client, utilities
├── frontend/          # Expo mobile app
│   └── hooks/         # Mobile WebRTC hooks
├── staff-portal/      # Legacy staff portal (vanilla JS) - TO BE REMOVED
├── admin-site/        # Legacy admin site - TO BE REMOVED
├── lms-admin/         # Legacy LMS admin - TO BE REMOVED
└── lms-learner/       # Legacy LMS learner - TO BE REMOVED
```

## What's Been Implemented

### December 2024

**WebRTC Call Connection Fix** (Dec 20)
- Fixed `user_offline` error by updating `/api/staff/me` to return correct `callable_user_id`
- Fixed `InvalidStateError` with `signalingState` check before setting remote description
- Fixed offer/answer race condition - only caller creates WebRTC offer

**Chat Window Auto-Open Fix** (Dec 20)
- Problem: Staff portal showed chat request banner but no chat window when accepted
- Solution: Added custom DOM event `chat_request_confirmed` dispatched from `useWebRTCPhone.tsx`
- `staff/page.tsx` listens for event and opens chat modal (matches legacy behavior)

**Safeguarding Alerts Display Fix** (Dec 20)
- Updated interface to match backend field names (`client_ip`, `geo_city`, etc.)
- Added conversation history expandable section
- Added tracking info display (IP, location, ISP, timezone, coordinates)

**Live Support Cards Enhancement** (Dec 20)
- Added "🚨 Linked to Safeguarding Alert" badge with risk level (RED/AMBER)
- Staff type badge (Counsellor/Peer Request)
- Message count and preview
- Red border for safeguarding-linked rooms

**Security: Session Storage Fix** (Dec 20)
- Added "Remember me" checkbox to login forms
- Default: `sessionStorage` (clears on tab close)
- With "Remember me": `localStorage` (persists)
- Applied to both new and legacy staff portals

**Ringtone Fix** (Dec 20)
- Replaced missing `/ringtone.mp3` with Web Audio API-generated UK-style double ring
- Uses 400Hz + 450Hz oscillators with burst pattern

## Pending Issues (P0)

### WebRTC Calls - No Audio & Disconnect Issues
- **Status**: IN PROGRESS
- **Symptom**: Calls connect but have no sound. When staff hangs up, call remains active on mobile app
- **Console shows**: `stream.active: false`, `Call ended: ended_by_peer`
- **Next step**: Audit mobile app's WebRTC hook at `/app/frontend/hooks/useWebRTCCall.ts`

### Staff Portal Audit - Missing Features
- **Status**: PENDING
- Compare new portal features against legacy `staff-portal/app.js`

### Chat Window Fix
- **Status**: FIX DEPLOYED - NEEDS USER VERIFICATION
- Deploy to production and test with safeguarding flow

## Pending Issues (P1)

### Admin Portal Fresh Audit (STEP 3)
- Compare new admin portal against legacy `admin-site/`

### Admin Settings Toggles Non-functional
- User reported toggles don't work

## In Progress Tasks

### LMS Portal Audit
- Comparing legacy `lms-admin/`, `lms-learner/`, `training-portal/` with new implementations
- Document all feature gaps

## Upcoming Tasks

1. Complete LMS portal audit
2. Complete Admin Portal audit (STEP 3)
3. Remove legacy code directories after feature parity confirmed

## Future/Backlog (P2)

- Full CMS visual editor with drag-and-drop
- Discussion Forums
- Mood Tracker Journal
- Appointment Booking
- Welsh Language Support

## Key Technical Decisions

### WebRTC ID Resolution
- Mobile app calls using `peer_supporters.user_id`
- Staff portal must register with same ID
- Solution: `/api/staff/me` returns `legacy_user_id` as `callable_user_id`

### Chat Window Opening
- Legacy: Direct function call `showLiveChatModal()` from socket handler
- New: Custom DOM event `chat_request_confirmed` → React event listener → open modal

### Browser Storage Strategy
- `sessionStorage`: Default for security on shared computers
- `localStorage`: Opt-in with "Remember me" checkbox

## Test Credentials
- Staff: `kev@radiocheck.me` / `AS90155mm` (may need verification)

## 3rd Party Integrations
- Socket.IO for real-time communication
- WebRTC for peer-to-peer calls
- Twilio for phone calls
- OpenAI for text embeddings (safety module)
- Jitsi Meet for video
- Leaflet.js for maps
- Chart.js for analytics
