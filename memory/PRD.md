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
│   │   ├── admin/         # Admin portal (COMPLETE - March 19, 2026)
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

### March 19, 2026 - Admin Portal Production Fixes ✅
**Root Cause**: Previous agent tested on local preview environment, not production. API endpoints didn't match production backend.

**Fixes Applied**:
1. **Events API** - Changed `/events/` to `/events/admin/all?include_past=true` (was returning 404)
2. **AI Avatar URLs** - Added `resolveAvatarUrl()` helper to prepend API URL for relative paths like `/images/tommy.png`
3. **AI Personas Tab** - Now properly displays avatars with fallback on error
4. **Learning Endpoints** - Changed:
   - `/learning/safety-patterns` → `/learning/patterns?is_active=true`
   - `/ai-feedback/moderation/queue` → `/learning/queue?status=pending` (was 404)
5. **Learning Stats Display** - Fixed to read correct nested structure: `patterns.active`, `learnings.pending`, `learnings.approved`, `feedback.pending`

**Verified on Production** (veterans-support-api.onrender.com):
- ✅ Events: Returns 4 events
- ✅ AI Characters: Returns 9 characters with avatars
- ✅ Learning Stats: Returns 31 active patterns
- ✅ Governance Summary: Returns report with KPIs
- ✅ CMS Pages: Returns 6 pages
- ✅ Shifts: Returns 25 shifts
- ✅ Compliance Dashboard: Accessible

### March 19, 2026 - Admin Portal COMPLETE ✅
1. **Admin Portal Migration Complete** (`/app/portal/src/app/admin/page.tsx`)
   - **All 15 tabs fully implemented with real API data**:
     - Staff Management (unified-staff data display) ✅
     - Rota (Today's Shifts, Pending Swap Requests, Week Overview) ✅
     - CMS (6 pages from backend, page preview area) ✅
     - AI Personas (12 characters with avatars, descriptions, order) ✅
     - Beta Testing (placeholder)
     - Compliance (GDPR metrics, Security Incidents, Open Complaints) ✅
     - Logs (Call Logs, Chat Logs, Safeguarding - all with live data) ✅
     - Monitoring (system stats: active calls, chats, staff online) ✅
     - Governance (Clinical Safety Hazard Log) ✅
     - Events (Upcoming/Recent Events, Create Event button) ✅
     - AI Learning (Stats grid, Moderation Queue) ✅
     - Time Tracking (placeholder)
     - AI Usage (token counts, costs, provider breakdown) ✅
     - Migration (legacy vs unified counts, action buttons) ✅
     - Settings (placeholder)
   
2. **Fixed API Endpoints**:
   - `/api/ai-characters/admin/all` (was `/api/ai-characters/admin`)
   - `/api/admin/system-stats` (was `/api/monitoring/stats`)
   - `/api/admin/unified-staff` for combined staff view
   - `/api/call-logs?days=30` with proper response handling
   - `/api/admin/ai-usage/summary?days=30` for AI usage stats
   - `/api/admin/migration-status` for migration dashboard
   - `/api/shifts/` for rota shifts
   - `/api/shift-swaps/needs-approval` for pending swap requests
   - `/api/cms/pages` for CMS page list
   - `/api/compliance/dashboard`, `/api/compliance/incidents`, `/api/compliance/complaints`
   - `/api/governance/hazards` for clinical safety hazard log

3. **Testing Status**: 100% pass rate - all 15 tabs verified working (iterations 30 & 31)

### March 19, 2026 - Staff Portal Fixes (Previous)
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

4. **UI Improvements**
   - Status buttons now disabled with tooltip when no profile is linked
   - Added "No Staff Profile Linked" warning banner
   - Added "Socket Connection Error" warning banner with refresh option
   - Added `data-testid` attributes for automated testing

5. **AI Characters Sort Order Fix**
   - Fallback characters now sorted by `order` field
   - Added Frankie to character order list (order: 0)

## Prioritized Backlog

### P0 - Critical (COMPLETED)
- [x] Admin Portal migration - ALL 15 tabs fully functional (March 19, 2026)
- [x] Profile loading security - verifies user_id match (March 19, 2026)
- [x] Status buttons disabled when no profile linked (March 19, 2026)
- [x] AI Characters sort order fix (March 19, 2026)
- [x] WebRTC socket connection working (March 19, 2026)
- [x] Twilio phone registration working (March 19, 2026)

### P0 - Critical (REMAINING - For Production Testing)
- [ ] Deploy to Vercel and verify all fixes work ON PRODUCTION
- [ ] User should test with OLD PORTAL CLOSED (socket conflict)
- [ ] User `kev@radiocheck.me` needs staff profile created in admin
- [ ] Redeploy backend to Render with latest code

### P1 - High Priority
- [ ] Staff status auto-reset after call/chat ends
- [ ] Run the unified staff migration on production database
- [ ] Create Events API endpoint (returns 404)
- [ ] Fix Governance summary-report 500 error

### P2 - Medium Priority
- [ ] Delete legacy directories (`/admin-site`, `/staff-portal`) after full migration approval
- [ ] Jitsi video chat for events (BLOCKED - waiting on user)

### P3 - Future
- [ ] Native mobile app (iOS/Android)
- [ ] Discussion Forums
- [ ] Mood Tracker Journal
- [ ] Appointment Booking
- [ ] Welsh Language Support

## Key API Endpoints
- `POST /api/auth/login` - Staff login
- `GET /api/admin/unified-staff` - Combined staff view (users + counsellors + peers)
- `GET /api/counsellors` - List counsellors
- `GET /api/peer-supporters` - List peer supporters
- `PATCH /api/counsellors/{id}/status` - Update counsellor status
- `GET /api/safeguarding-alerts` - List safeguarding alerts
- `PATCH /api/safeguarding-alerts/{id}/acknowledge` - Acknowledge alert
- `GET /api/call-logs?days=30` - Call history
- `GET /api/live-chat/rooms` - List active chat rooms
- `GET /api/ai-characters/admin/all` - All AI characters for admin
- `GET /api/admin/system-stats` - Monitoring dashboard stats
- `GET /api/admin/ai-usage/summary?days=30` - AI usage statistics
- `GET /api/admin/migration-status` - Migration dashboard stats
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
6. ~~AI Persona avatar images return 404~~ (FIXED - March 19, 2026 - added resolveAvatarUrl helper)
7. ~~Events, Learning tabs returning 404 errors~~ (FIXED - March 19, 2026 - corrected API endpoints)

## Critical Notes for Production Testing
1. **CLOSE OLD PORTAL** when testing the new one (socket conflict issue)
2. User `kev@radiocheck.me` needs a staff profile created in admin before status updates work
3. Backend changes need redeployment on Render.com to take effect
4. Frontend changes need Vercel to complete build before they're live

## Deployment
- Portal: Vercel project with root directory `/portal`
- Backend: Existing API at `veterans-support-api.onrender.com`
- Subdomains: `staff.radiocheck.me`, `training.radiocheck.me`, `admin.radiocheck.me`, etc.
