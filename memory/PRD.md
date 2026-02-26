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
│   ├── hooks/              # useWebRTCCallWeb.ts for calls
│   └── public/images/      # Local avatar images
├── staff-portal/           # Static HTML/JS (hosted on 20i)
│   ├── app.js              # Staff portal logic
│   ├── webrtc-phone.js     # WebRTC calling
│   └── styles.css
└── admin-site/             # Static admin portal (20i)
```

## New Call/Chat Flow (Fixed)

**Problem**: Staff was seeing safeguarding alerts BEFORE user was ready to receive calls/chats.

**Solution**: Alerts now only appear when user is connected and ready:

### Call Flow:
1. Safeguarding triggers → modal shows to user
2. User clicks "Call a Supporter" → navigates to peer-support
3. User registers with WebRTC (2 second wait)
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

### Session - February 26, 2025 (Latest)

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
4. User testing of complete safeguarding flow

### P1 - Phase 3: Waiting Experience
1. "Staff busy" fallback screen
2. Breathing exercise animation while waiting
3. Auto-retry in background
4. "Switch to chat" option

### P2 - Backlog
1. External Callback Phone Integration (Twilio migration)
2. Full CMS Control - Migrate AI personas and Crisis Numbers to database
3. Ringtone improvements (current requires user click first)
4. Push notifications
5. Mood tracker journal
6. CMS editor overhaul
7. Production CORS/500 error on `/api/surveys/status/`

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
