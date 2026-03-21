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

## Completed Work - December 2025

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
- [ ] (P2) Move logs to top of admin logs page (deferred)
- [ ] Admin panel refactoring (7000+ line file)
- [ ] Full CMS visual editor
- [ ] Discussion Forums
- [ ] Mood Tracker
- [ ] Welsh Language Support
- [ ] End-to-end WebRTC call testing on production

## Known Technical Debt
- `/portal/src/app/admin/page.tsx` is 7000+ lines - needs to be split into components
- WebRTC call flow involves 3 files that must be kept in sync
