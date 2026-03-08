# Radio Check - Product Requirements Document

## Original Problem Statement
Build "Radio Check," a mental health and peer support application for veterans and serving personnel. The project includes:
- React web application (Vercel)
- Python FastAPI backend (Render)
- Vanilla JS web portals for Admin and Staff (20i hosting)
- **NEW: LMS for volunteer training (20i hosting)**

## Core Architecture
```
/app
├── admin-site/          # Vanilla JS admin portal (20i hosting)
├── backend/             # FastAPI backend (Render)
├── frontend/            # React/Expo frontend (Vercel)
├── lms-admin/           # LMS Admin Dashboard (20i hosting) - NEW
├── lms-learner/         # LMS Learner Portal (20i hosting) - NEW
└── staff-portal/        # Vanilla JS staff portal (20i hosting)
```

## What's Been Implemented (March 2026)

### Session: March 8, 2026 - Evening (Latest)

**AI TUTOR: Mr Clark Implementation**

- **Mr Clark**: AI-powered course tutor with avatar and personalized module introductions
- **Competency-Based Assessment**: Written reflections evaluated by GPT-4o-mini against BACP competency framework
- **Critical Module Reflections**: Ethics, Crisis, and Safeguarding modules require written submissions before quiz
- **Final Assessment**: 3-question scenario/reflection assessment for course completion
- **Admin Review System**: Flagged submissions can be reviewed and overridden by human admins

**New Backend Files:**
- `backend/routers/ai_tutor.py` - Complete AI tutor system with:
  - `/api/lms/tutor/info` - Get Mr Clark's information
  - `/api/lms/tutor/module-intro/{module_id}` - Module introductions
  - `/api/lms/tutor/reflection-questions/{module_id}` - Critical module reflections
  - `/api/lms/tutor/submit-reflection` - Submit and evaluate written responses
  - `/api/lms/tutor/final-assessment` - Final course assessment
  - `/api/lms/admin/reflections` - Admin view of submissions
  - `/api/lms/admin/final-assessments` - Admin view of final assessments

**Mr Clark Features:**
- Personalized introduction for each of 14 modules
- Scenario-based questions (e.g., "A veteran tells you...")
- Reflection questions (e.g., "Explain in your own words...")
- Key competency checking: Ethics, Crisis, Safeguarding, Communication, PTSD Awareness
- Constructive feedback with pass/fail/needs-review outcomes
- Admin flagging for concerning or unclear responses

**LMS Portal Updates:**
- Tutor introduction card with avatar at top of each module
- Reflection notice on critical modules
- Full reflection submission UI with character counting
- AI-evaluated results display with competency feedback

**CRITICAL SECURITY FIX: Secure Learner Authentication**

- **Password-based login implemented** for learner portal
- Learners must now set a password after admin approval
- bcrypt password hashing for secure storage
- JWT tokens for session management (7-day expiry)

**New Backend Endpoints:**
- `POST /api/lms/learner/login` - Email + password login
- `POST /api/lms/learner/set-password` - Set password after approval
- `GET /api/lms/learner/check-status/{email}` - Check if password is set
- `GET /api/lms/admin/module/{module_id}` - Full module details with quiz

**LMS Admin Portal Improvements:**
- Quiz questions now display in full (instead of placeholder)
- Module edit modal shows actual content, images, quiz info
- External links display for each module

**LMS Learner Portal Improvements:**
- Login modal now requires email AND password
- "Set Password" modal for first-time login after approval
- Module hero images display at top of content
- External links section with "Further Reading"
- Radio Check logo in header (clickable to radiocheck.me)
- Toast notifications for errors

**Static File Routing Fix:**
- All portals now accessible via `/api/` prefix for Kubernetes ingress compatibility
- `/api/training/` - Learner portal
- `/api/lms-admin/` - Admin portal
- `/api/admin/` - Main admin site
- `/api/portal/` - Staff portal

**Files Modified:**
- `backend/routers/lms.py` - Added auth endpoints, bcrypt, JWT
- `lms-learner/app.js` - Password login flow, set password modal
- `lms-learner/index.html` - Password field in login modal
- `lms-learner/style.css` - Logo, module images, external links styling
- `lms-admin/index.html` - Real quiz display, module edit modal
- `backend/server.py` - Changed static file mount paths to /api/

### Session: March 8, 2026 - Earlier

**COMPLETE LMS (Learning Management System) Implementation**

**Course: "Radio Check Peer to Peer Training" - All 14 Modules**

1. **Module 1**: Introduction to Mental Health
2. **Module 2**: The ALGEE Action Plan  
3. **Module 3**: Ethics and Boundaries (CRITICAL - 100% Required)
4. **Module 4**: Communication Skills for Peer Supporters
5. **Module 5**: Crisis Support and Suicide Awareness (CRITICAL - 100% Required)
6. **Module 6**: Understanding PTSD in Veterans
7. **Module 7**: Depression and Anxiety in Veterans
8. **Module 8**: Self-Care for Peer Supporters
9. **Module 9**: Substance Misuse and Addiction
10. **Module 10**: Safeguarding (CRITICAL - 100% Required)
11. **Module 11**: Diversity and Inclusion in Peer Support
12. **Module 12**: Practical Skills and Resources
13. **Module 13**: Case Studies and Scenarios
14. **Module 14**: Course Completion and Next Steps

**Each Module Includes:**
- Comprehensive text content with external links for further reading
- Custom generated images
- Multiple quiz types (MCQ, True/False, Scenario-based)
- 80% pass rate (100% for critical modules)
- Links to NHS, Mind, Combat Stress, BACP, and other resources

**LMS Backend API** (`backend/routers/lms.py`, `lms_curriculum.py`, `lms_curriculum_part2.py`):
- Volunteer registration with admin alerts
- Admin approve/reject registrations with auto-enrollment
- **NEW: Admin manual learner add** (bypass registration)
- Learner enrollment and progress tracking
- Module content delivery with sequential learning
- Quiz submission and grading
- Certificate generation and verification
- All endpoints use async MongoDB operations (motor)

**LMS Admin Dashboard** (`lms-admin/index.html`):
- Dashboard with stats (pending registrations, learners, certificates)
- Volunteer registrations management (approve/reject)
- **NEW: "Add Learner Manually" button** - enroll learners directly
- Learner progress monitoring
- Module and quiz management
- Certificate verification and revocation
- Alert system for new registrations

**LMS Learner Portal** (`lms-learner/`):
- Landing page with course overview
- Registration of interest form
- Login system (email-based)
- Dashboard with progress circle
- Module cards with completion status
- Quiz system with results breakdown
- Certificate generation on completion

**Event Joining Logic Fix**
- Removed time-gating from event joining (frontend and backend)
- Users can now join any scheduled/live event for testing
- "Join Now" buttons appear for all non-cancelled events

### Session: March 7, 2026 (Previous)

**Comprehensive AI Safeguarding Framework v2.0 Implementation**
Based on 4 safeguarding documents provided by user:
- radio_check_ai_master_safeguarding_pack.txt
- radio_check_complete_ai_safeguarding_framework.txt
- extended_ai_safeguarding_dataset.txt
- ai_safeguarding_response_library.txt

**Risk Detection System (backend/server.py):**
- 4-Level Risk Model implemented:
  - LEVEL 0: Normal conversation
  - LEVEL 1: Low distress
  - LEVEL 2: Hopelessness (SAFEGUARDING BEGINS)
  - LEVEL 3: Self-harm thoughts
  - LEVEL 4: Imminent suicide risk (CRISIS MODE)
- ~308 RED_INDICATORS (immediate escalation patterns)
- ~255 AMBER_INDICATORS (hopelessness/distress patterns)
- Temporal variations: "tonight", "tomorrow", "in the morning", "soon"
- Typo correction for common crisis typing errors
- Lowered thresholds: RED ≥70, AMBER ≥45, YELLOW ≥25

**AI Response Templates (SAFEGUARDING_ADDENDUM):**
- Universal safeguarding protocol added to ALL AI character prompts
- Level-specific response guidelines
- Crisis resources: NHS 111 Option 2, Samaritans 116 123, Text SHOUT 85258
- Safety check questions: "Are you safe where you are right now?"
- Empathetic response templates

**NHS 111 Option 2 Integration:**
- Added as primary crisis resource across all UI components
- AIConsentModal, ResponsiveWrapper, crisis-support.tsx, safeguarding.tsx

**Admin Portal Events Fix:**
- Fixed showToast → showNotification in app.js

### Session: March 7, 2026 (Continued)
**Virtual Coffee Morning / Community Events Feature**
- Created backend Events API (`backend/routers/events.py`):
  - CRUD operations for events (create, read, update, delete)
  - Join event endpoint with Jitsi room details
  - Attendance tracking and logging
  - Reminder system for upcoming events
  - Recurring event support (weekly/monthly)
- Created frontend EventsSection component (`frontend/src/components/EventsSection.tsx`):
  - Shows upcoming events on home page (above AI Team section)
  - Join Now button for live/upcoming events
  - Remind Me button for future events
  - Horizontal scrollable event cards
- Created JitsiMeetComponent (`frontend/src/components/JitsiMeetComponent.tsx`):
  - Embeds Jitsi Meet video conferencing
  - Full-screen video call modal
  - Moderator controls for staff
- Added Events management to Admin Portal:
  - New "Events" tab in admin navigation
  - Create/Edit/Cancel events
  - View attendance logs
  - Event status filtering

**Safari/iPhone/Android Onboarding Fixes**
- Fixed Age Gate modal not working on iPhones - replaced HTML `<select>` with iOS-friendly FlatList pickers
- Fixed cookie consent being cut off on Safari/small viewports - converted to compact inline banner
- Fixed permissions modal being cut off - made more compact with maxHeight constraint
- Added ScrollView wrapper to Age Gate modal for scrolling on small screens
- **Added Age Gate to home.tsx** - ensures Age Gate shows even on direct navigation to /home
- **Fixed modal priority** - Age Gate now shows BEFORE the Beta Survey on home page
- All modals now fit within Safari's smaller viewport on desktop and mobile

Files changed:
- `frontend/src/components/AgeGateModal.tsx` - iOS-friendly pickers, ScrollView, compact styles
- `frontend/app/index.tsx` - Compact cookie banner, compact permissions modal
- `frontend/app/home.tsx` - Added Age Gate modal fallback, fixed modal priority, added EventsSection
- `backend/routers/events.py` - NEW: Events API
- `backend/server.py` - Added events router
- `frontend/src/components/EventsSection.tsx` - NEW: Events UI
- `frontend/src/components/JitsiMeetComponent.tsx` - NEW: Jitsi embed
- `admin-site/index.html` - Added Events tab and modals
- `admin-site/app.js` - Added Events management functions

### Session: March 6, 2026
**Location Permission on First Load**
- Modified `index.tsx` to include location permission alongside microphone in the "Enable Permissions" modal
- Created `LocationPermissionContext.tsx` to track and provide location permission state
- Location permission is now requested during initial app onboarding

**In-Page Safeguarding Call Modal**
- Created `SafeguardingCallModal.tsx` - full WebRTC call experience in a modal
- Updated `chat/[characterId].tsx` and `unified-chat.tsx` to use in-page call modal
- Users no longer redirect to `/peer-support` - call happens on chat page
- GPS location is requested and sent to backend when call is initiated

**Desktop Responsive Layout**
- `ResponsiveWrapper.tsx` provides centered mobile view with side-panel branding
- Left panel: Radio Check logo, feature list
- Center: Phone-framed app content
- Right panel: Emergency contact numbers

### Previous Session Work
- WebRTC Safeguarding Call Flow (Fixed)
- Location Analytics Map (Leaflet.js)
- Clear Logs Feature for Admin
- Browser Geolocation API integration
- Admin Security Fix (credentials in URL)
- Admin Modal Fix (duplicate closeModal function)
- Staff Portal UI Fix (logo sizing)
- Post-call Redirect to homepage

## Key Files
- `frontend/app/index.tsx` - Landing page with permissions modal
- `frontend/app/chat/[characterId].tsx` - AI chat with safeguarding
- `frontend/src/context/LocationPermissionContext.tsx` - Location state
- `frontend/src/components/SafeguardingCallModal.tsx` - In-page call UI
- `frontend/src/components/ResponsiveWrapper.tsx` - Desktop layout
- `frontend/src/components/AgeGateModal.tsx` - iOS-friendly date picker
- `backend/server.py` - FastAPI backend

## API Endpoints
- `/api/safeguarding-alerts/{alert_id}/location` - PATCH to update GPS coords
- `/api/analytics/locations` - GET for admin location map
- `/admin/clear-logs` - POST to clear test logs
- Socket.IO events for WebRTC signaling

## Pending Issues (P0-P2)

### P0 - Critical
- **RESOLVED (March 8, 2026)**: Learner registration was insecure (email-only, no password) - Fixed by implementing password-based authentication with bcrypt hashing and JWT tokens
- **Deployment Verification**: User needs to deploy latest files to 20i hosting:
  - `/app/lms-admin/index.html`
  - `/app/lms-learner/index.html`, `app.js`, `style.css`

### P1 - High Priority  
- AI Character sort order not respecting `order` field from database
- End-to-end testing of Community Events flow (Admin creates → User joins Jitsi)

### P2 - Medium Priority
- End-to-end testing of admin reporting features (PDF export/email)
- Full regression testing of safeguarding call flow
- Consolidate vanilla JS portals into single React app (tech debt)

## Future Tasks
- Rewrite admin-site, staff-portal, lms-admin, lms-learner from vanilla JS to React
- LMS Discussion Forums
- Enhanced safeguarding ("Anthony's code" features)
- Mood Tracker Journal
- Appointment Booking, Secure Messaging, CBT courses
- Welsh Language Support

## Third-Party Integrations
- Twilio: WebRTC and phone calling
- OpenAI gpt-4o-mini: AI chat personas
- Resend: Email notifications (LMS approval/rejection)
- Leaflet.js: Location maps
- fpdf2: PDF generation
- bcrypt: Password hashing
- PyJWT: Token generation

## Deployment Environments
- **Frontend**: Vercel (https://[domain])
- **Backend**: Render (https://[domain])
- **Admin/Staff/LMS Portals**: 20i hosting
- **Preview**: https://bacp-training.preview.emergentagent.com
  - Learner Portal: `/api/training/`
  - LMS Admin: `/api/lms-admin/`
  - Main Admin: `/api/admin/`
  - Staff Portal: `/api/portal/`

## Test Credentials
- Preview Password: `radiocheck1358`
- Test Learner: `test@example.com` / `testpass123`
