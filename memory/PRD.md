# Radio Check - Mental Health & Peer Support for Veterans

## Original Problem Statement
Build "Radio Check," a mental health and peer support application for veterans. Key requirements:
- Staff rota/calendar system with shift swap capabilities
- Content Management System (CMS) for app content editing
- Multi-layered safeguarding system for user chat monitoring
- WebRTC and live chat for user-to-staff communication
- Distinct AI personas for peer support

## Current Architecture
```
/app
├── backend/
│   ├── server.py           # Main FastAPI app
│   ├── webrtc_signaling.py # Socket.IO signaling for calls and chat
│   └── routers/            # Modularized route handlers
├── frontend/               # Expo/React Native web app
│   ├── app/                # App screens
│   │   ├── staff-webview.tsx   # WebView for staff portal (mobile)
│   │   ├── admin-webview.tsx   # WebView for admin portal (mobile)
│   │   └── portal.tsx          # Routes based on role
│   ├── hooks/              # useWebRTCCallWeb.ts for calls
│   └── public/images/      # Local avatar images
├── staff-portal/           # Static HTML/JS (hosted on 20i)
│   ├── app.js              # Staff portal logic
│   ├── webrtc-phone.js     # WebRTC calling
│   └── styles.css
└── admin-site/             # Static admin portal (20i)
```

## Mobile App Architecture (WebView Approach)

When staff/admin login to the mobile app:
```
Login → Check Role
├── role = 'user'      → Native veteran screens (home, AI chat, etc.)
├── role = 'counsellor'/'peer' → WebView loads staff.radiocheck.me
└── role = 'admin'     → WebView loads admin.radiocheck.me
```

**Benefits:**
- Single app for veterans and staff
- Reuses existing portal code
- Auto-login via token injection
- Native header with refresh/logout

## New Call/Chat Flow (Fixed)

**Problem**: Staff was seeing safeguarding alerts BEFORE user was ready to receive calls/chats.

**Solution**: Alerts now only appear when user is connected and ready:

### Call Flow:
1. Safeguarding triggers → modal shows to user
2. User clicks "Call a Supporter" → navigates to peer-support
3. User registers with WebRTC (waits for connection)
4. `request_human_call` emitted to notify staff
5. Staff sees call request banner → clicks "Call Now"
6. User receives incoming call → clicks Accept
7. WebRTC connection establishes

### Chat Flow:
1. Safeguarding triggers → modal shows to user
2. User clicks "Chat with a Supporter" → navigates to live-chat
3. User's `request_human_chat` emits to notify staff
4. Staff sees chat request banner → clicks "Accept"
5. Chat room created → both parties join

## What's Been Implemented

### Session - February 27, 2025 (Latest - COMPREHENSIVE FIX)

**ROOT CAUSE ANALYSIS COMPLETE:**

The call connection was failing because of a **call_id mismatch**:
1. Staff portal generates local `call_id` in `makeOutboundCall()`: `call_xxx_localTimestamp`
2. Backend generates DIFFERENT `call_id` in `call_initiate`: `call_xxx_serverTimestamp`
3. Backend sends `call_accepted` with server's `call_id`
4. Staff portal's `call_accepted` handler was NOT updating `currentCallId`
5. Staff sends `webrtc_offer` with WRONG `call_id`
6. Backend can't find the call → **offer silently dropped**
7. User never receives offer → **call hangs on "Connecting"**

**COMPREHENSIVE FIXES APPLIED:**

1. **CRITICAL FIX in `webrtc-phone.js` - `call_accepted` handler:**
   - Now updates `currentCallId` from `data.call_id` (server's authoritative ID)
   - This ensures WebRTC signaling uses the correct call ID

2. **Added `call_ringing` handler** in `webrtc-phone.js`:
   - Also updates `currentCallId` as a backup sync point

3. **Added `webrtc_error` event handler** in `webrtc-phone.js`:
   - Shows meaningful error message when WebRTC signaling fails

4. **Enhanced `webrtc_offer` handler in backend:**
   - Now logs all active call IDs when a mismatch occurs
   - Emits `webrtc_error` back to sender so they know the offer failed
   - Checks if target is still connected before forwarding

5. **Fixed chat room collection** in `accept_chat_request`:
   - Was inserting into `db.chat_rooms`
   - Now inserts into `db.live_chat_rooms` AND `live_chat_rooms` dict
   - Matches the API endpoints in `server.py`

6. **Improved socket initialization** in `useWebRTCCallWeb.ts`:
   - Now fully recreates socket if disconnected (was just reconnecting without re-attaching listeners)

7. **Improved socket wait logic** in `peer-support.tsx`:
   - Now polls every 500ms until socket is confirmed connected
   - Was using fixed 2s timeout which could fail on slow connections

**Key Files Modified:**
- `staff-portal/webrtc-phone.js` - call_id sync fix, error handling
- `staff-portal/app.js` - Added logging for chat acceptance flow
- `frontend/hooks/useWebRTCCallWeb.ts` - Socket reconnection fix, logging
- `frontend/app/peer-support.tsx` - Socket wait polling
- `backend/webrtc_signaling.py` - Error handling, logging, chat room fix

### Session - February 26, 2025 (Previous)

**Session - February 27, 2025 - Chat Fix Continuation:**

**Chat Fix Applied:**
1. **User ID mismatch in chat flow** - User was registering with `userId` but sending chat request with `sessionId`. Fixed `live-chat.tsx` to register with `sessionId || userId` for consistency.
2. **Chat room collection fix** - Already fixed in earlier commit, room now created in `live_chat_rooms` collection.
3. **Added `chat_request_expired` handler** - Staff portal now shows notification when chat request expires (user disconnected).
4. **Removed "Chat with User" button from safeguarding alerts** - As requested, since chat requires user to initiate first.

**Key Files Modified:**
- `staff-portal/app.js` - Removed chat buttons from safeguarding alerts, added `chat_request_expired` handler
- `frontend/app/live-chat.tsx` - Fixed user registration ID mismatch
- `backend/server.py` - Added better logging and fallback for `/live-chat/rooms/{room_id}/join` API

**Bug Fixes:**
1. **Chat banner timing** - Added 1.5s delay before showing generic chat banner to allow safeguarding alerts to load first
2. **Messages disappearing in chat** - Fixed by disabling polling when Socket.IO is connected (set `socketChatConnected` flag)
3. **Call from safeguarding alert not working** - Fixed by checking `window.pendingChatRequest.user_id` first (which has the actual Socket.IO user ID), instead of using the AI chat session ID
4. **Incoming call UI missing** - Added Accept/Reject buttons for incoming calls on the user's waiting screen

**New Features:**
1. **"Waiting for Support" Screen** - When user clicks "Call a Supporter", they see a waiting screen with:
   - Pulsing phone icon
   - Status messages that update over time
   - Option to switch to text chat
   - Cancel button
2. **Incoming Call UI** - Users now see "Accept" and "Decline" buttons when staff calls them
3. **Call Button in Chat Modal** - Staff can escalate from text chat to voice call without leaving the chat

**Safeguarding Flow - Phase 2 Complete:**
- ✅ Added `data-session-id` attribute to safeguarding alert cards in staff portal
- ✅ Created `acceptPendingChatFromAlert` function for accepting chats from alert cards
- ✅ Updated frontend chat screens (`chat/[characterId].tsx`, `unified-chat.tsx`) to pass `sessionId` and `alertId` when navigating to live-chat or peer-support
- ✅ Updated `live-chat.tsx` to include `session_id` in `request_human_chat` socket emit
- ✅ Updated backend `webrtc_signaling.py` to include `session_id` in `incoming_chat_request` events sent to staff
- ✅ Added CSS for `.user-request-indicator` component in `staff-portal/styles.css`
- ✅ User registers with WebRTC when waiting for call - staff can now call them directly

**Key Files Modified:**
- `staff-portal/app.js` - renderSafeguardingAlerts, setupLiveChatRequestListeners, acceptPendingChatFromAlert, initiateStaffCall, joinChatRoomSocket, leaveChatRoomSocket, startChatPolling, callUserFromChat
- `staff-portal/styles.css` - Added user-request-indicator CSS, call button styling
- `frontend/app/peer-support.tsx` - Waiting for support screen, incoming call Accept/Reject UI
- `frontend/app/chat/[characterId].tsx` - handleConnectToStaff passes sessionId
- `frontend/app/unified-chat.tsx` - handleConnectToStaff passes sessionId
- `frontend/app/live-chat.tsx` - requestHumanChat includes session_id
- `backend/webrtc_signaling.py` - request_human_chat handler includes session_id

### Previous Session - February 26, 2025

**WebRTC Audio Fix:**
- Added ExpressTURN credentials (user's account)
- TURN relay candidates now being generated
- Audio calls working both directions

**Safeguarding Popup Redesign (Phase 1):**
- New 2-button design: "Call a Supporter" OR "Chat with a Supporter"
- "Request a Callback" as secondary option
- Updated both chat screens (unified-chat.tsx, chat/[characterId].tsx)

**Staff Portal Improvements:**
- initiateStaffCall tries session ID directly
- staff_chat_invite Socket.IO handler added
- Web Audio API ringtone (UK double-ring pattern)

**Local Assets:**
- All avatar images moved to /public/images/
- Updated all paths from /assets/images/ to /images/
- Images: tommy, doris, bob, finch, margie, hugo, rita, catherine

## Current TURN Server Config
```javascript
// ExpressTURN - user's account
{
    urls: 'turn:free.expressturn.com:3478',
    username: '000000002087494108',
    credential: 'VGqVfeznpN8ZxyueC6MSG71Sso8='
}
```

## Upcoming Tasks (Prioritized)

### P0 - Immediate
1. ✅ WebRTC audio working
2. ✅ Safeguarding popup with Call/Chat options
3. ✅ Phase 2 - Link chat requests to safeguarding alerts
4. ✅ Age Gate System - DOB collection and under-18 restrictions
5. User testing of complete safeguarding flow

### P1 - Phase 3: Waiting Experience
1. "Staff busy" fallback screen
2. Breathing exercise animation while waiting
3. Auto-retry in background
4. "Switch to chat" option

### P2 - Backlog
1. External Callback Phone Integration (Twilio migration - pending phone number)
2. Full CMS Control - Migrate AI personas and Crisis Numbers to database
3. Ringtone improvements (current requires user click first)
4. Push notifications
5. Mood tracker journal
6. CMS editor overhaul
7. Production CORS/500 error on `/api/surveys/status/`

## Latest Update - December 28, 2025

### Age Gate Bug Fix (COMPLETED - Critical) - VERIFIED
- **BUG FIXED**: Under-18 users could previously access peer-to-peer support despite the age restriction
- **Root Cause**: Race condition - `isLoading` state from useAgeGateContext was not being used, causing `isUnder18` to be `false` during initial render
- **FIX APPLIED**:
  1. Added `isLoading: isAgeLoading` from useAgeGateContext (line 30-31)
  2. Added loading spinner while age data loads from AsyncStorage (line 557-562)
  3. Updated both restriction screen and main content conditions to check `!isAgeLoading` first
- **VERIFIED**: Testing agent confirmed the fix - restriction screen shows immediately without any content flash

### Website Links for Crisis Organizations (COMPLETED)
Added website links to all organizations on the Crisis Support page:
- Samaritans → samaritans.org
- Combat Stress → combatstress.org.uk
- Veterans Gateway → veteransgateway.org.uk
- SSAFA → ssafa.org.uk
- East Durham Veterans Trust → eastdurhamveteranstrust.org.uk

### Governance Email Notifications (COMPLETED)
Implemented automatic email notifications for the governance system:

**Email Triggers:**
- **New Incident Created**: Emails sent to CSO + Admin based on severity
  - Level 3 (Critical): Immediate notification to both
  - Level 2 (High): Within-shift notification
  - Level 1 (Moderate): Admin only
- **CSO Approval Required**: Emails CSO when approval needed

**Configuration:**
- CSO Email: `admin@radiocheck.me` (configurable via Settings API)
- Admin Email: `admin@radiocheck.me` (configurable via Settings API)
- Domain verification required in Resend for email delivery

**Settings Model Updated:**
- Added `cso_email` field to `SiteSettings` model
- All governance emails configurable via `/api/settings`

### Documentation Updates (COMPLETED)
- **Created**: `/app/docs/DEVELOPER_HANDOVER.md` - Comprehensive developer guide
  - System architecture explanation
  - All API router documentation
  - WebRTC flow diagrams
  - Database schema details
  - Troubleshooting guide
- **Updated**: `/app/docs/RADIO_CHECK_FEATURES.md` - Added governance features
- **Updated**: `/app/docs/GOVERNANCE_OPERATIONS_GUIDE.md` - Email notification section

### Clinical Safety Governance Implementation (COMPLETED)
Implemented comprehensive NHS DCB0129-aligned governance system:

**Backend Components:**
- `/app/backend/governance.py` - Governance models (Hazards, Incidents, KPIs, Moderation)
- `/app/backend/governance_router.py` - API endpoints for governance

**Admin Portal Features:**
- **Hazard Register**: Track and manage safety hazards with risk scoring
- **Safeguarding KPIs**: Monitor response times, SLA compliance, alert volumes
- **Incident Management**: Log and track safety incidents by severity level
- **Peer Moderation**: Review user reports, issue warnings/suspensions/bans
- **CSO Approvals**: Clinical Safety Officer sign-off workflow

**API Endpoints:**
- `GET/POST /api/governance/hazards` - Hazard log management
- `GET /api/governance/kpis` - Safeguarding performance metrics
- `GET/POST /api/governance/incidents` - Incident management
- `GET/POST /api/governance/peer-reports` - Peer moderation queue
- `GET/POST /api/governance/cso/approvals` - CSO approval workflow
- `GET /api/governance/export` - Audit data export

**Pre-populated 7 Core Hazards:**
- H1: AI fails to detect suicidal ideation
- H2: AI over-escalates benign content
- H3: Staff miss urgent alert
- H4: Under-18 falsely declares 18+
- H5: Peer messaging abuse
- H6: System outage during crisis
- H7: AI safety drift after update

**Samaritans AI Policy Compliance**: 9/9 applicable areas addressed

### Age Gate Implementation (COMPLETED)
Implemented comprehensive age safeguarding system per user requirements:

**Frontend Components:**
- `/app/frontend/src/hooks/useAgeGate.ts` - Age state management
- `/app/frontend/src/context/AgeGateContext.tsx` - Global age context
- `/app/frontend/src/components/AgeGateModal.tsx` - DOB collection UI
- `/app/frontend/src/components/AgeRestrictedBanner.tsx` - Restriction display

**Features:**
- DOB collection at first launch (after cookie/permission modals)
- DOB stored LOCALLY on device only (privacy-first)
- Under-18 detection with feature restrictions:
  - Peer Matching: DISABLED
  - Direct Peer Calls: DISABLED  
  - AI Chat Support: ENABLED
  - Crisis Support: ENABLED
  - Staff Chat: ENABLED
- 30% increased crisis sensitivity for minors
- 1.3x risk score multiplier
- Friendly "Extra Protection Enabled" info screen
- Greyed-out restricted features with alternatives

**Backend Updates:**
- `is_under_18` flag added to `/api/ai-buddies/chat` request
- Enhanced safety layer applies 1.3x multiplier for under-18 users
- Risk level automatically elevated for young users

**Documentation Updated:**
- `/app/docs/AI_SAFEGUARDING_FEATURES.md` - Complete safety & governance documentation
- Samaritans compliance scorecard added
- Clinical Safety Governance section added
- Hazard Log documented
- KPI targets documented

**Configuration:**
- Peer registration emails now sent to: `admin@radiocheck.me`

## 3rd Party Integrations
- **OpenAI GPT-4**: AI chat personas
- **Resend**: Email notifications
- **ExpressTURN**: TURN server for WebRTC

## Test Credentials
- **Admin**: admin@veteran.dbty.co.uk / ChangeThisPassword123!
- **Staff**: sharon@radiocheck.me / ChangeThisPassword123!

## Deployment Process
1. **Frontend**: Push to GitHub → Vercel auto-deploys
2. **Backend**: Push to GitHub → Render auto-deploys
3. **Staff/Admin Portals**: Manual upload to 20i hosting (app.js, webrtc-phone.js, styles.css)
