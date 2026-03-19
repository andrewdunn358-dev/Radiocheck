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

### March 19, 2026 - Staff Portal Fixes (Latest)
1. **CRITICAL: Unified Staff Data Model**
   - Created new `staff` collection that combines `users` + `counsellors` + `peer_supporters`
   - Single document per person with all their data
   - No more orphaned profiles or user/profile mismatch
   - New endpoints: `POST/GET/PATCH/DELETE /api/staff`, `GET /api/staff/me`
   - Migration endpoint: `POST /api/admin/migrate-to-unified-staff`
   - See `/app/memory/MIGRATION_NOTES.md` for full details

2. **CRITICAL: Multi-Device Socket Support**
   - Changed `user_to_socket` from `Dict[str, str]` to `user_to_sockets: Dict[str, set]`
   - A user can now have multiple tabs/devices connected simultaneously
   - When a call comes in, ALL of a user's devices ring
   - When answered on one device, other devices stop ringing via `call_answered_elsewhere` event
   - Fixes the root cause of "old portal steals calls from new portal"

3. **Profile Loading Security Fix**
   - Fixed profile loading to verify `user_id` matches logged-in user
   - Prevents showing wrong user's profile (e.g., "Sarah M" bug)
   - Added `user_id` field preservation in API response

2. **UI Improvements**
   - Status buttons now disabled with tooltip when no profile is linked
   - Added "No Staff Profile Linked" warning banner
   - Added "Socket Connection Error" warning banner with refresh option
   - Added `data-testid` attributes for automated testing

3. **AI Characters Sort Order Fix**
   - Fallback characters now sorted by `order` field
   - Added Frankie to character order list (order: 0)

4. **Code Quality**
   - Improved logging throughout profile loading flow
   - Enhanced error handling for edge cases

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

### P0 - Critical (COMPLETED)
- [x] Profile loading security - verifies user_id match (March 19, 2026)
- [x] Status buttons disabled when no profile linked (March 19, 2026)
- [x] AI Characters sort order fix (March 19, 2026)
- [x] WebRTC socket connection working (March 19, 2026)
- [x] Twilio phone registration working (March 19, 2026)

### P0 - Critical (REMAINING)
- [ ] Deploy to Vercel and verify all fixes work ON PRODUCTION
- [ ] User should test with OLD PORTAL CLOSED (socket conflict)
- [ ] User `kev@radiocheck.me` needs staff profile created in admin

### P1 - High Priority
- [ ] Begin Admin Portal migration to `/app/portal/src/app/admin`
- [ ] Staff status auto-reset after call/chat ends
- [ ] Twilio phone integration (browser-to-phone calls)

### P2 - Medium Priority
- [ ] Delete legacy directories after full migration approval
- [ ] Jitsi video chat for events (BLOCKED - waiting on user)
- [x] AI Character sort order fix (COMPLETED March 19, 2026)

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

### Admin (Production) - USE FOR ALL ADMIN TASKS
- **Email**: `admin@veteran.dbty.co.uk`
- **Password**: `AS90155mm`
- **API**: `https://veterans-support-api.onrender.com`

### Staff Test User (Local)
- Email: `test@staff.com`
- Password: `test123`
- Role: Counsellor with supervisor access

### Other Test User
- Email: `kev@radiocheck.me`
- Password: `AS90155mm`
- Note: This user has NO staff profile linked (will be fixed after migration)

## Known Issues
1. ~~Some counsellor profiles missing `specialization`/`phone` fields cause 500 errors~~ (FIXED)
2. Jitsi video chat blocked on user's side
3. Staff status doesn't auto-reset after calls (needs implementation)
4. ~~User sees wrong profile when profile loading fails~~ (FIXED - March 19, 2026)
5. **SOCKET CONFLICT**: Old and new portals fight for the same socket - close old portal when testing new one

## Critical Notes for Production Testing
1. **CLOSE OLD PORTAL** when testing the new one (socket conflict issue)
2. User `kev@radiocheck.me` needs a staff profile created in admin before status updates work
3. Backend changes need redeployment on Render.com to take effect
4. Frontend changes need Vercel to complete build before they're live

## Deployment
- Portal: Vercel project with root directory `/portal`
- Backend: Existing API at `veterans-support-api.onrender.com`
- Subdomains: `staff.radiocheck.me`, `training.radiocheck.me`, etc.
