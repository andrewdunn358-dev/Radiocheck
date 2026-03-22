# Radiocheck Veterans Support Platform - PRD

## CRITICAL RULE - CHECK EVERY TIME BEFORE SAVING

**NEVER change these production URLs to preview URLs:**

| File | Variable | MUST BE |
|------|----------|---------|
| `/app/frontend/.env` | `EXPO_PUBLIC_BACKEND_URL` | `https://veterans-support-api.onrender.com` |
| `/app/frontend/.env` | `EXPO_PUBLIC_SITE_PASSWORD` | `radiocheck2025` |
| `/app/portal/.env.local` | `NEXT_PUBLIC_API_URL` | `https://veterans-support-api.onrender.com` |
| `/app/portal/.env.production` | `NEXT_PUBLIC_API_URL` | `https://veterans-support-api.onrender.com` |

**Before ANY save to GitHub, run this check:**
```bash
grep -r "preview.emergentagent.com" /app/frontend/.env /app/portal/.env* 2>/dev/null
```
If this returns ANY results, FIX THEM before saving.

---

## Original Problem Statement
The Radiocheck project is a complex mix of:
- **FastAPI backend** (deployed on Render - DO NOT TOUCH)
- **Next.js web portal** (`/portal/`) - the unified portal replacing legacy vanilla JS portals
- **Expo mobile app** (`/frontend/`) - React Native mobile app

## Architecture
```
/app
├── backend/                  # FastAPI + Socket.IO (deployed on Render)
│   ├── server.py            # Main API with audit logging
│   ├── webrtc_signaling.py  # Socket.IO signaling with heartbeat
│   └── audit_logger.py      # Audit logging functions
├── frontend/                 # Expo React Native mobile app
│   └── src/components/
│       └── SafeguardingCallModal.tsx  # WebRTC with audio quality enhancements
└── portal/                   # Next.js unified portal
    ├── src/app/
    │   ├── admin/page.tsx    # Admin portal with staff profile editing
    │   └── staff/page.tsx    # Staff portal with callbacks
    ├── src/hooks/
    │   └── useWebRTCPhone.tsx  # WebRTC hook with Socket.IO stability
    └── src/lib/api.ts        # API functions with notes support
```

## Completed Work - March 2026

### BUG FIX: Vercel Frontend Build Failure (P0)
**Status**: ✅ COMPLETE (March 22, 2026)

**Root Cause**: The Expo frontend build was failing due to `require()` statements referencing non-existent image files. When using React Native/Expo, `require()` statements for local images must reference files that exist.

**Missing Images** (now generated):
- `jack.png` ✅ Generated - Ex-Royal Navy compensation expert
- `baz.png` ✅ Generated - Ex-Rifles transition specialist  
- `megan.png` ✅ Generated - Ex-RAF MERT women veterans specialist
- `penny.png` ✅ Generated - Ex-Royal Navy benefits specialist

**Fix Applied**:
- Generated 4 new photorealistic avatars using AI image generation
- Downloaded all 4 images to `/app/frontend/assets/images/`
- Restored full `require()` mappings in both frontend files
- Added `doris.png` which was available but not included

**Verification**: `npx expo export --platform web` completes successfully with all 58 static routes and 17 AI avatars

---

## Completed Work - December 2025

### Notes Edit/Share & Internal Messaging
**Status**: ✅ COMPLETE

**What was implemented**:
- **Edit Notes**: Staff can now edit their notes after creation with an edit modal
- **Share Notes with Staff**: Added a share modal to select specific team members to share notes with
- **Internal Messaging System**: 
  - New `/api/messages` endpoints in backend for sending/receiving messages between staff
  - Messages button in staff portal sidebar with unread count badge
  - Messages modal showing conversation history and ability to send new messages
  - Mark messages as read functionality
- Backend models: `InternalMessageCreate`, `InternalMessage`
- API functions: `getMessages`, `sendMessage`, `markMessageRead`, `markAllMessagesRead`

### Callback Request & Twilio Fix
**Status**: ✅ COMPLETE

**What was fixed**:
- Fixed callback request failing due to missing `message` and `request_type` fields
- Fixed Twilio "all staff are busy" message by normalizing UK phone numbers (07xxx → +44xxx)
- Mobile app `.env` was pointing to preview URL instead of production - corrected

### Logo Update on Login Screens
**Status**: ✅ COMPLETE

**What was implemented**:
- Replaced Shield icon with Radiocheck logo on Staff Portal login screen (`/portal/src/app/staff/page.tsx`)
- Replaced Shield icon with Radiocheck logo on Admin Portal login screen (`/portal/src/app/admin/page.tsx`)
- Logo URL: `https://customer-assets.emergentagent.com/job_b298e80e-e613-4114-bd36-44dba2b1f918/artifacts/hcklvnmw_logo.png`

### P0 - Audit Logging Implementation
**Status**: ✅ COMPLETE

**What was implemented**:
- Added `audit_login()` calls in `/backend/routers/auth.py`:
  - Successful login (staff and legacy users)
  - Failed login (wrong password, user not found)
  - Includes IP address tracking
- Added `audit_safeguarding_alert()` call when alerts are created
- Added `audit_admin_action()` calls for:
  - Settings changes
  - Staff member creation/deletion
  - Callback taken/released/completed

### P1 - Staff Profile Editing for Admins
**Status**: ✅ COMPLETE

**What was implemented**:
- Enhanced Edit Staff Modal in `/portal/src/app/admin/page.tsx`:
  - Basic info (name, email, role, status)
  - Contact info (phone, SMS, WhatsApp)
  - Role-specific fields (specialization, area, years_served, background)
  - Supervisor privileges toggle
- Updated `StaffUpdate` model to include `status` field
- Updated `StaffMember` interface to include new fields

### Callback "Take" Button Fix
**Status**: ✅ COMPLETE

**What was fixed**:
- Backend was using `status: "in_progress"` but frontend checked for `status: "taken"`
- Updated `/backend/server.py` callback endpoints:
  - `PATCH /callbacks/{id}/take` now sets `status: "taken"` and `taken_by`/`taken_by_name` fields
  - `PATCH /callbacks/{id}/release` clears all assignment fields
  - `PATCH /callbacks/{id}/complete` records `completed_by` and `completed_by_name`
- All callback actions now include audit logging

### Interaction Notes System
**Status**: ✅ COMPLETE (NEW FEATURE)

**What was implemented**:
- Backend endpoints in `/backend/server.py`:
  - `POST /api/notes` - Create interaction note
  - `GET /api/notes` - Get notes (own + shared)
  - `GET /api/notes/{id}` - Get specific note
  - `PUT /api/notes/{id}` - Update note (author only)
  - `DELETE /api/notes/{id}` - Delete note (author/admin)
  - `POST /api/notes/{id}/share` - Share with specific staff
- Notes can be:
  - Linked to callbacks, alerts, cases, sessions
  - Tagged (e.g., `supervisor-review`, `follow-up`)
  - Shared with team or specific staff members
- Supervisors/admins can see notes tagged `supervisor-review`
- Updated `/portal/src/lib/api.ts` with full notes API support

### WebRTC Audio Quality Improvements
**Status**: ✅ COMPLETE

**What was implemented**:
- Enhanced audio constraints in both files:
  - `echoCancellation: true`
  - `noiseSuppression: true`
  - `autoGainControl: true`
  - `sampleRate: 48000`
- Added more STUN servers for better connectivity
- Added ICE connection state monitoring with auto-restart on failure
- Added ICE gathering state logging
- Improved disconnection handling (3-second grace period before error)
- Better audio element lifecycle management

### Socket.IO Stability Improvements
**Status**: ✅ COMPLETE

**What was implemented**:
- Enhanced socket configuration in `/portal/src/hooks/useWebRTCPhone.tsx`:
  - `reconnectionAttempts: Infinity` (keep trying forever)
  - `reconnectionDelayMax: 5000`
  - `timeout: 20000`
- Added reconnection state handling with auto-re-registration
- Added heartbeat mechanism (30-second interval)
- Added `heartbeat` event handler in `/backend/webrtc_signaling.py`
- Better disconnect reason handling

### P0 - WebRTC Call Lifecycle Fixes
**Status**: ✅ COMPLETE (December 2025)

**Issue 1: Call alert not disappearing for other staff when one accepts**
- Backend already emitted `call_request_claimed` event in `accept_call_request` handler
- Added new `call_request_claimed` socket listener in `/portal/src/hooks/useWebRTCPhone.tsx`
- Listener checks if `request_id` matches the pending request before dismissing
- This ensures call alerts disappear for all staff when any staff member accepts

**Issue 2: Call not ending on client when staff hangs up**
- Root cause: Staff portal emitted `webrtc_end_call` event but backend had no handler
- Added `webrtc_end_call` socket event handler in `/backend/webrtc_signaling.py`
- Handler properly emits `call_ended` to the other party (mobile app user)
- Resets all user statuses to 'available' and removes call from active_calls
- Mobile app's `call_ended` listener in `SafeguardingCallModal.tsx` triggers cleanup

**Bug Fix**: Added missing `claimed_call_requests: Dict[str, dict] = {}` dictionary

## Backend API
- **Production URL**: `https://veterans-support-api.onrender.com`
- **Socket.IO Path**: `/api/socket.io`
- **Key Endpoints**:
  - `/api/auth/login` - Login with audit logging
  - `/api/callbacks` - CRUD for callbacks
  - `/api/notes` - Interaction notes system
  - `/api/staff/{id}` - Staff management

## User Credentials
- Test user: `kev@radiocheck.me` / `AS90155mm`

## Future Tasks (Backlog)
- [ ] (P1) **User Manuals**:
  - [ ] Staff User Manual - Guide for peer supporters and counsellors
  - [ ] Admin User Manual - Guide for administrators and supervisors
- [ ] (P1) Admin panel refactoring (7000+ line file - `/portal/src/app/admin/page.tsx`)
- [ ] (P1) Staff panel refactoring (4000+ line file - `/portal/src/app/staff/page.tsx`)
- [ ] (P2) Move logs to top of admin logs page (deferred)
- [ ] (P2) Full CMS visual editor
- [ ] (P2) Discussion Forums
- [ ] (P2) Mood Tracker
- [ ] (P2) Welsh Language Support
- [ ] End-to-end WebRTC call testing on production

## Known Technical Debt
- `/portal/src/app/admin/page.tsx` is 7000+ lines - needs to be split into components
- WebRTC call flow involves 3 files that must be kept in sync
