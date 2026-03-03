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

## User Roles (Hierarchy)
1. **Admin** - Full system access, content management, user creation
2. **Supervisor** - Team management, escalation handling, 1:1 supervision notes (NEW)
3. **Counsellor** - Clinical support, case management, live chat
4. **Peer Supporter** - Peer support, escalate to counsellors/supervisors

## AI Characters (10 total)
1. **Frankie** - PTI Physical Training Instructor with 12-week programme & gamification
2. **Tommy** - Battle buddy, straight-talking support
3. **Rachel** (formerly Doris) - Nurturing, compassionate presence
4. **Bob** - Down-to-earth ex-Para
5. **Finch** - Military law expertise
6. **Hugo** - Wellbeing coach & services navigator
7. **Margie** - Addiction support
8. **Rita** - Family support
9. **Catherine** - Self-care & mindfulness

## Main App Sections
1. **Need to Talk?** - Crisis support (Primary)
2. **The Gym** (NEW) - Frankie's 12-week fitness programme
3. **Talk to a Veteran** - Peer support
4. **Warfare on Lawfare** - Historical investigations
5. **Support Organisations** - Directory
6. **Self-Care Tools** - Journal, grounding, breathing
7. **Friends & Family** - Support for loved ones (includes Bereavement Support)
8. **Addictions** - Substance support
9. **Criminal Justice Support** - Prison/leaving support
10. **Recommended Podcasts** - Veteran stories
11. **Request a Callback** - We'll call you back

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
- [x] **The Gym** - Full fitness feature with:
  - 12-week progressive programme (3 phases)
  - Standards Score gamification
  - 6 Badges to earn
  - Military Challenge Ladder
  - Veteran fitness resources
  - Progress tracking (localStorage)
- [x] **Bereavement Support** - Military-specific grief support:
  - 8 specialist resources (DMWS, Cruse, Scotty's Little Soldiers, etc.)
  - Phone numbers and external links
  - Featured DMWS card
- [x] **Supervisor Role** (NEW - March 2026):
  - New role between Admin and Staff
  - Team management - view counsellors and peers
  - 1:1 Supervision notes for staff members
  - Escalation workflow - staff can escalate to supervisors
  - Confidential note marking (HR-sensitive)
  - Backend: 19/20 tests passed (95% success rate)

## Current Status (March 2026)

### Recently Implemented (This Session)
- **Supervisor Role** - Full implementation:
  - Backend: `POST/GET /api/supervision/notes`, `GET /api/supervision/team`
  - Backend: `POST/GET/PATCH /api/escalations` with acknowledge/resolve workflow
  - Admin Portal: Supervisor option in role dropdown
  - Staff Portal: Supervision tab, escalation button, team management UI
  - MongoDB collections: `supervision_notes`, `escalations`
  - Test accounts: supervisor@radiocheck.me / Sup123!

- **Bereavement Support Section** - New feature in Friends & Family page:
  - 8 military bereavement resources (DMWS, Cruse, Scotty's Little Soldiers, etc.)
  - Featured DMWS card highlighting Defence Medical Welfare Service
  - Phone numbers and external links for all resources
  - Purple theme for sensitive topic

### Previously Implemented
- **Frankie PTI Character** - Full AI persona with PTI banter
- **The Gym Page** - Complete fitness feature
- **Rachel Name Fix** - Doris → Rachel throughout

### Pending Issues
- **Live Chat UI** - Messages not visible in staff portal (fix ready, needs 20i upload)
- **AI Character Sort Order** - Frankie not appearing first on homepage
- **Callback Notifications** - Blocked on Resend domain verification

## File Structure
```
/app
├── backend/
│   ├── server.py              # Supervisor endpoints, supervision_notes
│   ├── routers/
│   │   ├── auth.py            # Supervisor role in login redirect
│   │   ├── ai_characters.py
│   │   └── cms.py
│   └── enhanced_safety_layer.py
├── frontend/
│   ├── app/
│   │   ├── home.tsx           # The Gym card added
│   │   ├── gym.tsx            # The Gym page
│   │   └── family-friends.tsx # Bereavement support section
│   └── public/images/
│       └── frankie.png        # Frankie avatar
├── admin-site/
│   └── app.js                 # Supervisor role dropdown (needs upload to 20i)
├── staff-portal/
│   ├── app.js                 # Supervisor features (needs upload to 20i)
│   ├── index.html             # Supervision tab UI (needs upload to 20i)
│   └── styles.css             # Supervisor badge styles
└── memory/
    └── PRD.md
```

## Files Needing 20i Upload (User Action)
- `/app/admin-site/app.js` - Supervisor role in user creation
- `/app/admin-site/index.html` - No changes this session
- `/app/staff-portal/app.js` - Supervisor features, escalation functions
- `/app/staff-portal/index.html` - Supervision tab, escalation modal
- `/app/staff-portal/styles.css` - Supervisor badge styling

## Backlog (P1/P2)
- [ ] Fix AI Character Sort Order (P2)
- [ ] Add Frankie to external website AI Team
- [ ] Implement Gym Finder API (currently mocked)
- [ ] Convert Expo to Next.js
- [ ] Welsh Language Support
- [ ] Mood Tracker Journal
- [ ] Appointment Booking System
- [ ] CBT Courses
- [ ] Admin Reporting features end-to-end testing

## Key Credentials/Config
- Twilio credentials in backend/.env
- Staff portal: staffportal.radiocheck.me (20i)
- Production API: veterans-support-api.onrender.com
- Test supervisor: supervisor@radiocheck.me / Sup123!
- Test admin: admin@veteran.dbty.co.uk / Admin123!
