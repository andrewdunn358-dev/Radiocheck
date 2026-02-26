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

## What's Been Implemented

### Session - February 26, 2025

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

### Previous Sessions
- AI persona updates (Hugo, Catherine)
- Vercel build fix (Expo SDK 55)
- Safeguarding alert system
- Staff portal WebRTC integration

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
3. Test and verify new popup flow

### P1 - Phase 2: Staff Integration
1. Show call/chat requests INSIDE safeguarding alert card
2. Staff can accept call OR offer chat from same place
3. Link user requests to their safeguarding alert

### P1 - Phase 3: Waiting Experience
1. "Staff busy" fallback screen
2. Breathing exercise animation while waiting
3. Auto-retry in background
4. "Switch to chat" option

### P2 - Backlog
1. Ringtone improvements (current requires user click first)
2. Push notifications
3. Mood tracker journal
4. CMS editor overhaul

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
3. **Staff/Admin Portals**: Manual upload to 20i hosting
