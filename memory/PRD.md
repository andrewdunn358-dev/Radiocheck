# Radio Check - Mental Health Veterans Support Platform

## Product Requirements Document (PRD)
**Version 3.1 | March 2026**

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

### COMPLETED - March 2026 Update

#### Staff Portal Fixes (This Session)
- [x] Fixed `loadTeamOnDuty()` - was using undefined `API_URL` and `getAuthHeaders()`
- [x] Added missing `loadSwapRequests()` placeholder function
- [x] Fixed inline JavaScript in `index.html` - removed ES6 syntax, added function existence checks
- [x] All backend API tests passing (20/20)

#### Site Password Gate (This Session)
- [x] Added SiteGateContext to protect the entire app
- [x] Password screen appears before any app content loads
- [x] Password stored in environment variable `EXPO_PUBLIC_SITE_PASSWORD`
- [x] Default password: `radiocheck2025` (change this in production)
- [x] Unlocked state persisted in localStorage

#### Previous Work - December 2025

#### Case Management System
- [x] Backend API with 15+ endpoints
- [x] Case creation from safeguarding alerts
- [x] Privacy controls (counsellors see own cases only)
- [x] Triage session documentation
- [x] 3-session soft cap with override
- [x] Safety plan (Stanley-Brown template)
- [x] Referral tracking workflow
- [x] Check-in logging for monitoring
- [x] Handoff summary generation
- [x] Full conversation capture

#### Staff Portal V2
- [x] Tabbed interface (Dashboard, Cases, Alerts, Callbacks, Chat)
- [x] Morning review queue for overnight alerts
- [x] Case detail modal with sub-tabs
- [x] Session notes form
- [x] Safety plan editor
- [x] Referral form
- [x] Operating hours notice

#### Admin Portal Enhancements
- [x] Password reset with confirmation
- [x] Password complexity requirements
- [x] Password history (no reuse of last 3)
- [x] Email settings management
- [x] AI Compliance Checker
- [x] AI Personas CMS (create, edit, delete AI characters via database)

#### User App Features
- [x] Age gate with race condition fix
- [x] Website links on crisis support
- [x] Peer moderation (Report/Block)
- [x] Staff busy notice in safeguarding modal

#### Backend Improvements
- [x] Full conversation capture (not just last 20)
- [x] Trailing slash redirect fix
- [x] AI characters CMS-ready
- [x] Governance email notifications

#### Governance System
- [x] Hazard Register (7 core hazards)
- [x] KPI Dashboard
- [x] Incident Management with email alerts
- [x] CSO Approval workflow
- [x] Peer Moderation queue
- [x] Audit export

### PENDING - Requires Manual Action

#### Upload to 20i Hosting
- [ ] Admin portal files (app.js, index.html)
- [ ] Staff portal V2 (index-v2.html → index.html)

#### Configuration
- [ ] Verify radiocheck.me domain in Resend
- [ ] Production WebRTC testing

### BACKLOG

#### P1 - High Priority
- [ ] Twilio integration (browser-to-phone calling)
- [ ] Request claiming (dismiss for other staff)
- [ ] Push notifications

#### P2 - Medium Priority
- [ ] Mood tracker journal
- [ ] Welsh language support

#### P3 - Future
- [ ] Convert to pure Next.js
- [ ] Appointment booking
- [ ] Achievement badges
- [ ] CBT courses

---

## Non-Negotiable Boundaries

1. **We Do Not Provide Therapy** - Sessions capped at 3
2. **Peers Are Not Clinicians** - All risk concerns escalate
3. **No Fully Automated High-Risk Decisions** - Humans decide escalation
4. **Emergency Situations Escalate Immediately** - No delay
5. **Clear Role Separation** - Peer ≠ Triage ≠ Therapist

---

## Operating Hours

- **Human Support:** Monday - Friday, 9am - 5pm GMT
- **AI Engagement:** 24/7
- **Overnight Alerts:** Queued for morning review

---

## Compliance Frameworks

| Framework | Status |
|-----------|--------|
| NHS DCB0129 | Implemented |
| Samaritans AI Policy | Implemented |
| Online Safety Act | Implemented |
| ICO Data Protection | Implemented |

---

## Key Contacts

| Role | Email |
|------|-------|
| Admin Notifications | admin@radiocheck.me |
| CSO Notifications | admin@radiocheck.me |
| Peer Registration | admin@radiocheck.me |

---

## Documentation

- `/app/docs/RADIO_CHECK_FEATURES.md` - Complete feature list
- `/app/docs/DEVELOPER_HANDOVER.md` - Technical documentation
- `/app/docs/GOVERNANCE_OPERATIONS_GUIDE.md` - Governance procedures
- `/app/docs/IMPLEMENTATION_SUMMARY.md` - This session's changes
- `/app/docs/AI_SAFEGUARDING_FEATURES.md` - Safety system details

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@veteran.dbty.co.uk | ChangeThisPassword123! |
| Staff | sharon@radiocheck.me | ChangeThisPassword123! |

---

*Last Updated: March 2026*
*Next Review: June 2026*
