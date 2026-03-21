# Radiocheck Veterans Support Platform - PRD

## 🚨 CRITICAL RULE - CHECK EVERY TIME BEFORE SAVING 🚨

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

The preview environment (`safeguard-call.preview.emergentagent.com`) is for testing code only. Production apps connect to Render (`veterans-support-api.onrender.com`).

---

## Original Problem Statement
The Radiocheck project is a complex mix of:
- **FastAPI backend** (deployed on Render - DO NOT TOUCH)
- **Next.js web portal** (`/portal/`) - the unified portal replacing legacy vanilla JS portals
- **Expo mobile app** (`/frontend/`) - React Native mobile app

The agent was tasked with fixing three specific issues after a refactoring broke several things.

## Architecture
```
/app
├── backend/                  # FastAPI + Socket.IO (deployed on Render, DO NOT TOUCH)
├── frontend/                 # Expo React Native mobile app
│   └── src/components/
│       └── SafeguardingCallModal.tsx  # FIXED - Socket.IO call request modal
└── portal/                   # Next.js unified portal (TARGET FOR FIXES)
    ├── src/app/
    │   ├── admin/page.tsx    # FIXED - Added feature toggles
    │   └── staff/page.tsx    # Staff portal
    └── .env.local            # Points to Render production API
```

## Completed Work - March 21, 2026

### Issue 1: SafeguardingCallModal.tsx (P0 - CRITICAL)
**Status**: ✅ FIXED

**What was done**:
- Completely rewrote `/frontend/src/components/SafeguardingCallModal.tsx`
- Changed from WebRTC-based approach to simpler Socket.IO-only implementation
- Implemented proper Socket.IO connection with `/api/socket.io` path
- Added `register` event emission for user registration
- Added `request_human_call` event emission to request calls
- Implemented listeners for `call_request_accepted` and `no_staff_available`
- Added 30-second timeout with automatic crisis line fallback
- Implemented multiple UI states: connecting, waiting, supporter_found, no_staff, timeout, error
- Added crisis line buttons (Samaritans 116 123, NHS 111, Emergency 999)

**Socket.IO Events**:
- Emits: `register`, `request_human_call`
- Listens: `call_request_accepted`, `no_staff_available`, `incoming_call`

### Issue 2: Admin Settings Toggles (P1)
**Status**: ✅ FIXED

**What was done**:
- Added new "Feature Toggles" section to `/portal/src/app/admin/page.tsx`
- Implemented 6 toggle switches that persist to backend API:
  1. Safeguarding Alerts toggle
  2. AI Chat Buddies toggle
  3. Live Chat toggle
  4. Callback Requests toggle
  5. Events toggle
  6. Panic Button toggle
- Each toggle calls `api.updateSettings()` with the new value on change
- Toggles use proper visual feedback (green=enabled, gray=disabled)

### Issue 3: Vercel Deployment (P2)
**Status**: ✅ VERIFIED

**What was done**:
- Verified TypeScript compiles without errors (`npx tsc --noEmit` succeeds)
- Verified Next.js build completes successfully (`yarn build` succeeds)
- Build output shows all 9 routes generated correctly
- `next.config.js` is Vercel-compatible with `output: 'standalone'`

## Backend API
- **Production URL**: `https://veterans-support-api.onrender.com`
- **Socket.IO Path**: `/api/socket.io`
- **Settings API**: `/api/settings` (GET/PUT)

## Key Files
1. `/frontend/src/components/SafeguardingCallModal.tsx` - New Socket.IO-based call modal
2. `/portal/src/app/admin/page.tsx` - Admin portal with new feature toggles
3. `/portal/.env.local` - Points to production Render API

## Testing Notes
- Admin portal login requires valid credentials on the production Render backend
- The preview environment frontend connects to production API
- Mobile app testing requires Expo with proper backend connectivity

## Constraints (DO NOT MODIFY)
- `/backend/` - FastAPI/Python code
- `/frontend/app/unified-chat.tsx` - Only add SafeguardingCallModal, don't refactor
- `/portal/src/hooks/useWebRTCPhone.tsx` - Working WebRTC hook

## User Credentials
- Test user: `kev@radiocheck.me` / `AS90155mm`

## Future Tasks (Backlog)
- WebRTC audio and disconnect issues (can't touch WebRTC hook)
- Socket.IO stability improvements
- Full CMS visual editor
- Discussion Forums
- Mood Tracker
- Welsh Language Support
