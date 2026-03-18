# Radio Check Portal Migration - Product Requirements Document

## Project Overview
Migration of legacy vanilla JavaScript portals (`admin-site`, `staff-portal`, `lms-admin`, `lms-learner`) into a single, unified Next.js 14 application at `/app/portal/`.

## Original Problem Statement
The legacy `app.js` files (over 8,400 lines each) became unmaintainable. The goal is to achieve 100% feature parity with modern, modular React components while improving the codebase structure and developer experience.

## Tech Stack
- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS
- **Backend**: FastAPI, Python, MongoDB
- **Real-time**: Socket.IO for WebRTC signaling and live chat
- **Voice**: Twilio for browser-to-phone calling
- **Deployment**: Vercel (portal), existing backend API

## Current Architecture
```
/app/portal/
├── src/
│   ├── app/
│   │   ├── learning/      # LMS Learner portal (COMPLETE)
│   │   ├── lms-admin/     # LMS Admin portal (COMPLETE)
│   │   └── staff/         # Staff portal (IN PROGRESS)
│   ├── hooks/
│   │   ├── useStaffAuth.tsx
│   │   ├── useWebRTCPhone.tsx  # NEW - WebRTC peer-to-peer calling
│   │   └── useTwilioPhone.tsx  # NEW - Twilio browser-to-phone
│   └── lib/
│       └── api.ts         # Centralized API client
```

## What's Been Implemented

### December 18, 2025 - Staff Portal Fixes
1. **WebRTC Phone Integration**
   - Created `useWebRTCPhone.tsx` hook with full Socket.IO integration
   - Created `useTwilioPhone.tsx` hook for Twilio browser calling
   - Added incoming call modal UI
   - Added active call UI with mute/end controls
   - Added call buttons on team member list

2. **API Fixes**
   - Fixed authentication to handle legacy users with `_id` instead of `id`
   - Fixed SafeguardingAlert to use `id` field from backend
   - Fixed LiveChatRoom to use correct `id` field
   - Fixed shift creation to pass user info as query params
   - Fixed live chat message format (`text`/`sender` instead of `message`)

3. **Real-time Connection**
   - Phone status now driven by actual WebRTC hook state
   - Chat connection status shows Socket.IO connection state
   - Removed fake checkPhoneStatus polling

### Previous Sessions
- LMS Learner portal migration (COMPLETE)
- LMS Admin portal migration (COMPLETE)
- Staff Portal UI migration (COMPLETE)
- Vercel deployment configuration

## Prioritized Backlog

### P0 - Critical
- [ ] Deploy to Vercel and verify all fixes work
- [ ] Test WebRTC calling between staff members
- [ ] Test live chat functionality
- [ ] Test status update (available/busy/offline)
- [ ] Test safeguarding alert acknowledge/resolve

### P1 - High Priority
- [ ] Begin Admin Portal migration to `/app/portal/src/app/admin`
- [ ] Staff status auto-reset after call/chat ends
- [ ] Twilio phone integration (browser-to-phone calls)

### P2 - Medium Priority
- [ ] Delete legacy directories after full migration approval
- [ ] Jitsi video chat for events
- [ ] AI Character sort order fix

### P3 - Future
- [ ] Native mobile app (iOS/Android)
- [ ] Discussion Forums
- [ ] Mood Tracker Journal
- [ ] Appointment Booking
- [ ] Welsh Language Support

## Key API Endpoints
- `POST /api/auth/login` - Staff login
- `GET /api/counsellors` - List counsellors
- `GET /api/peer-supporters` - List peer supporters
- `PATCH /api/counsellors/{id}/status` - Update counsellor status
- `GET /api/safeguarding-alerts` - List safeguarding alerts
- `PATCH /api/safeguarding-alerts/{id}/acknowledge` - Acknowledge alert
- `PATCH /api/safeguarding-alerts/{id}/resolve` - Resolve alert
- `GET /api/live-chat/rooms` - List active chat rooms
- `POST /api/live-chat/rooms/{id}/join` - Join a chat room
- `GET /api/twilio/status` - Check Twilio configuration
- Socket.IO: `/api/socket.io` - WebRTC signaling

## Test Credentials
- Email: `test@staff.com`
- Password: `test123`
- Role: Counsellor with supervisor access

## Known Issues
1. Some counsellor profiles missing `specialization`/`phone` fields cause 500 errors
2. Jitsi video chat blocked on user's side
3. Staff status doesn't auto-reset after calls (needs implementation)

## Deployment
- Portal: Vercel project with root directory `/portal`
- Backend: Existing API at `veterans-support-api.onrender.com`
- Subdomains: `staff.radiocheck.me`, `training.radiocheck.me`, etc.
