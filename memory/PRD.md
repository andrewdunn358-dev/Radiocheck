# Radio Check - Mental Health Veterans Support Platform

## Product Requirements Document (PRD)
**Version 3.2 | March 2026**

---

## Original Problem Statement

Build "Radio Check," a mental health and peer support application for veterans. The project includes a React web application, a Python FastAPI backend, and web portals for Admin and Staff. The core goal is to provide immediate, reliable real-time support (audio calls and text chat) to users.

### Service Definition
Radio Check is a clinically governed early-intervention and safeguarding platform designed to:
- Provide immediate human connection
- Detect escalating risk early
- Stabilise distress
- Triage appropriately
- Bridge users into the right external services

**We are NOT:** A therapy provider, crisis emergency service, or replacement for NHS/statutory services.
**We ARE:** The structured bridge between isolation and formal support.

---

## Core Requirements

### 1. Immediate Engagement
- Anonymous or confidential conversations
- AI-supported structured conversation
- Trained peer listeners
- Escalation to triage staff when required

### 2. Risk Detection & Monitoring
- Multi-layer contextual AI risk scoring
- Human review of high-risk cases
- Structured escalation pathways
- Documented safeguarding oversight

### 3. Short-Term Stabilisation
- 1-3 structured triage sessions (capped)
- Safety planning
- Emotional containment techniques
- Crisis coping tools

### 4. Referral & Bridging
- NHS / Op COURAGE referrals
- Local services guidance
- Follow-up monitoring during waiting periods
- Re-escalation if risk increases

---

## Technical Architecture

### Stack
- **Frontend:** React Native (Expo) - Web deployment
- **Backend:** Python FastAPI
- **Database:** MongoDB Atlas
- **Real-time:** Socket.IO + WebRTC
- **AI:** OpenAI GPT-4
- **Email:** Resend
- **Hosting:** Vercel (frontend), Render (backend), 20i (static portals)

### Key Components
```
/app
├── frontend/          # React Native (Expo) app
├── backend/           # FastAPI server
├── admin-site/        # Static admin portal
├── staff-portal/      # Static staff portal
└── docs/              # Documentation
```

---

## Implementation Status

### COMPLETED - March 2026 Session 3

#### Staff Portal Live Chat Fixes (This Session)
- [x] Added `chat_request_confirmed` Socket.IO listener to auto-open chat modal when staff accepts
- [x] Staff now joins Socket.IO room when accepting chat for real-time messaging
- [x] Added `new_chat_message` listener for real-time message display in staff portal
- [x] Added `user_left_chat` listener for disconnect notifications
- [x] Updated `sendChatMessage()` to emit via Socket.IO for real-time delivery
- [x] Backend `accept_chat_request` handler now creates room in both memory and database

#### Frontend Character Loading Improvements (This Session)
- [x] Reordered render checks: loading state now always shows before consent modal
- [x] Fixed consent check timing - waits for `characterLoading` to be false
- [x] Added debug logging for character merge process
- [x] Character service merges API data with static fallbacks correctly

### COMPLETED - Previous Sessions

#### Site Password Gate
- [x] SiteGateContext protects entire app
- [x] Password stored in `EXPO_PUBLIC_SITE_PASSWORD`
- [x] Default: `radiocheck2025`

#### Staff Portal Fixes
- [x] Fixed token extraction (`data.token` not `data.access_token`)
- [x] Added Cases tab with case management
- [x] Fixed shift creation with `user_id` parameter
- [x] Morning review queue for overnight alerts

#### Core Features
- [x] AI Chat with 8 characters (Tommy, Doris/Rachel, Bob, Finch, Margie, Hugo, Rita, Catherine)
- [x] Safeguarding detection and alerts
- [x] WebRTC voice/video calls
- [x] Live chat between users and staff
- [x] Case management system
- [x] Staff rota/shift management

---

## Known Issues / User Action Required

### AI Character Name (Doris → Rachel)
**Status:** Frontend static config has "Rachel", but production database has "Doris"
**Action Required:** User must update the character name in Admin CMS:
1. Go to Admin Portal → AI Personas
2. Edit "Doris" and change name to "Rachel"
3. Click Save
4. Refresh the app (may need to clear browser cache)

**Technical Note:** The frontend correctly merges API data with static fallbacks. When the database is updated to "Rachel", the app will display "Rachel" everywhere.

### Deployment to 20i
**Important:** After any changes to `staff-portal/app.js` or `webrtc-phone.js`:
1. Download the updated files from this environment
2. Upload to 20i hosting
3. Force browser cache clear (Ctrl+Shift+R)

---

## Upcoming Tasks

### P0 - Critical
- [ ] Verify live chat connection works end-to-end after staff-portal deploy
- [ ] Update database character name from "Doris" to "Rachel" via Admin CMS

### P1 - High Priority
- [ ] Twilio browser-to-phone integration
- [ ] Safeguarding request claiming (prevent multiple staff responding)
- [ ] Fix chat close navigation (return to AI chat, not home)

### P2 - Medium Priority
- [ ] Convert Expo app to Next.js for better performance
- [ ] Mood tracker journal feature
- [ ] Welsh language support

---

## Key API Endpoints

### AI Characters
- `GET /api/ai-characters` - Get all enabled characters
- `PUT /api/ai-characters/{id}` - Update character (admin auth required)

### Live Chat
- Socket.IO events:
  - `incoming_chat_request` - Staff receives chat request
  - `accept_chat_request` - Staff accepts
  - `chat_request_confirmed` - Server confirms room created
  - `new_chat_message` - Real-time message
  - `user_left_chat` - User disconnected

### Staff Portal
- `POST /api/auth/login` - Staff login
- `GET /api/cases/morning-queue` - Morning review queue
- `POST /api/cases` - Create case

---

## Files Modified This Session

### Staff Portal
- `/app/staff-portal/webrtc-phone.js` - Added Socket.IO handlers for chat confirmation and messages
- `/app/staff-portal/app.js` - Updated sendChatMessage to emit via Socket.IO

### Frontend
- `/app/frontend/app/unified-chat.tsx` - Fixed character loading order and consent timing

### Backend
- `/app/backend/webrtc_signaling.py` - Chat room creation in accept_chat_request handler (unchanged, verified)
