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
3. **OpenAI GPT-4o-mini** - AI chat personas (Tommy & Rachel)
4. **Resend** - Email notifications
5. **Socket.IO** - Real-time messaging and signaling

## User Roles
- **Veterans/Users**: Access app for support
- **Peer Supporters**: Veterans helping veterans, can escalate to counsellors
- **Counsellors**: Licensed mental health professionals
- **Admins**: System administration

## Implemented Features (P0 Complete)
- [x] AI Chat Personas (Tommy & Rachel)
- [x] Live Chat with staff
- [x] Callback request system
- [x] Safeguarding alert system with geolocation
- [x] Case management system
- [x] Staff rota/availability system
- [x] WebRTC in-app calling
- [x] Twilio browser-to-phone calling (completed Dec 2025)
- [x] Staff portal with tabbed interface
- [x] Admin content management system
- [x] Panic button (peer to counsellor escalation)
- [x] Session timeout and security

## Current Status (December 2025)

### Recently Fixed
- **Live Chat `Staff ID: undefined` bug** - Added localStorage fallback for staff user object in webrtc-phone.js

### Pending Issues
- Vercel deployment - lock file conflict resolved, needs redeployment
- Business Plan and Cost Analysis documents ready for download

## File Structure
```
/app
├── backend/           # FastAPI backend
│   ├── routers/       # API route handlers
│   │   └── twilio_calling.py  # Twilio voice integration
│   ├── server.py      # Main application
│   └── webrtc_signaling.py    # Socket.IO handlers
├── frontend/          # Expo React app
├── staff-portal/      # Staff interface
│   ├── app.js         # Main logic
│   ├── webrtc-phone.js # WebRTC and chat handling
│   └── twilio-phone.js # Twilio SDK integration
├── admin-site/        # Admin interface
└── memory/            # Documentation
```

## Backlog (P1/P2)
- [ ] Convert Expo to Next.js
- [ ] Welsh Language Support
- [ ] Mood Tracker Journal
- [ ] Appointment Booking System
- [ ] CBT Courses
- [ ] Achievement Badges
- [ ] Admin Portal stability improvements

## Key Credentials/Config
- Twilio credentials stored in backend/.env
- Staff portal uses production API: veterans-support-api.onrender.com
- Staff portal hosted at: staffportal.radiocheck.me

## Testing Notes
- Staff accounts: sharon@radiocheck.me (counsellor), kev@radiocheck.me (peer)
- Live chat requires both staff and user to be connected via Socket.IO
