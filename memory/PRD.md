# Radio Check - UK Veterans Mental Health Support Platform

## Product Overview
Radio Check is a comprehensive mental health and peer support application designed specifically for UK military veterans. The platform provides 24/7 access to AI-powered support, live chat with trained counsellors and peer supporters, and emergency callback services.

## Core Architecture
- **Frontend**: React/Expo web application
- **Backend**: Python FastAPI with MongoDB
- **Admin Portal**: Vanilla JS/HTML (hosted on 20i)
- **Staff Portal**: Vanilla JS/HTML (hosted on 20i)
- **Hosting**: Frontend on Vercel, Backend on Render

## Key Integrations
1. **Twilio Voice SDK** - Browser-to-phone calling for staff (WORKING)
2. **ExpressTURN** - WebRTC NAT traversal for in-app calls
3. **OpenAI GPT-4o-mini** - AI chat personas
4. **Resend** - Email notifications
5. **Socket.IO** - Real-time messaging and signaling

## AI Characters (10 total)
1. **Frankie** (NEW) - PTI Physical Training Instructor with 12-week programme
2. **Tommy** - Battle buddy, straight-talking support
3. **Rachel** (formerly Doris) - Nurturing, compassionate presence
4. **Bob** - Down-to-earth ex-Para
5. **Finch** - Military law expertise
6. **Hugo** - Wellbeing coach & services navigator
7. **Margie** - Addiction support
8. **Rita** - Family support
9. **Catherine** - Self-care & mindfulness

## Implemented Features
- [x] AI Chat Personas (9 characters + Frankie)
- [x] Live Chat with staff
- [x] Callback request system
- [x] Safeguarding alert system with geolocation
- [x] Case management system
- [x] Staff rota/availability system
- [x] WebRTC in-app calling
- [x] Twilio browser-to-phone calling
- [x] Staff portal with tabbed interface
- [x] Admin content management system
- [x] Panic button (peer to counsellor escalation)
- [x] Session timeout and security
- [x] Frankie PTI with 12-week programme

## Current Status (March 2026)

### Recently Implemented (This Session)
- **Frankie PTI Character** - Full implementation with:
  - Military PTI banter and personality
  - 12-week progressive fitness programme (3 phases)
  - Standards Score gamification system
  - Military Challenge Ladder
  - Safety override for injuries/medical issues
  - Avatar generated and integrated

### Pending Issues
- **Live Chat UI** - Messages not visible in staff portal (fix ready, needs 20i deployment)
- **Vercel Build** - Lock file conflict resolved, needs push

## File Structure
```
/app
├── backend/
│   ├── server.py              # FRANKIE_SYSTEM_PROMPT added
│   ├── routers/
│   │   ├── ai_characters.py   # Frankie descriptions added
│   │   └── cms.py             # Frankie in CMS defaults
│   └── enhanced_safety_layer.py # Frankie in character mappings
├── frontend/
│   ├── app/home.tsx           # Frankie FIRST in carousel
│   └── assets/images/
│       └── frankie.png        # NEW avatar
├── staff-portal/              # Needs upload to 20i
│   ├── app.js                 # Live chat fix
│   ├── webrtc-phone.js        # Socket handler fix
│   └── styles.css             # Message visibility fix
└── memory/
    └── PRD.md
```

## Backlog (P1/P2)
- [ ] Frankie localStorage progress tracking
- [ ] Convert Expo to Next.js
- [ ] Welsh Language Support
- [ ] Mood Tracker Journal
- [ ] Appointment Booking System
- [ ] CBT Courses
- [ ] Achievement Badges

## Key Credentials/Config
- Twilio credentials in backend/.env
- Staff portal: staffportal.radiocheck.me (20i)
- Production API: veterans-support-api.onrender.com

## Testing Notes
- Frankie chat tested and working
- PTI banter verified
- 12-week programme knowledge confirmed
