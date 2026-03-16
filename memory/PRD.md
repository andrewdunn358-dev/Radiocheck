# Radio Check - Product Requirements Document

## Original Problem Statement
Build "Radio Check," a mental health and peer support application for veterans and serving personnel. The project includes:
- React web application (Vercel)
- Python FastAPI backend (Render)
- Vanilla JS web portals for Admin and Staff (20i hosting)
- **NEW: LMS for volunteer training (20i hosting)**

## CRITICAL DEPLOYMENT NOTES

### DO NOT ADD TO requirements.txt:
- `emergentintegrations` - This is an Emergent preview-only package. It does NOT work on Render/production. NEVER add it to requirements.txt even if pip freeze includes it.

### Production Deployment:
- Backend: Render
- Frontend (mobile app): Vercel  
- Static portals (admin-site, staff-portal, lms-admin, lms-learner): 20i hosting

## Core Architecture
```
/app
├── admin-site/          # Vanilla JS admin portal (20i hosting)
├── backend/             # FastAPI backend (Render)
│   └── safety/          # Unified Safeguarding System (NEW)
├── frontend/            # React/Expo frontend (Vercel)
├── lms-admin/           # LMS Admin Dashboard (20i hosting) - NEW
├── lms-learner/         # LMS Learner Portal (20i hosting) - NEW
└── staff-portal/        # Vanilla JS staff portal (20i hosting)
```

## What's Been Implemented (March 2026)

### Session: March 16, 2026 - Compensation Schemes Page Enhanced

**Compensation Schemes Page - Full On-Page Summaries Added:**

Previously the compensation schemes page only had brief descriptions and links. Now each scheme has:
- Detailed description explaining what the scheme covers, eligibility, and process
- Key Facts section with bullet points for quick reference
- Clear call-to-action buttons

**7 Schemes Updated with Full Content:**

| Scheme | Type | Key Info Added |
|--------|------|----------------|
| Armed Forces Compensation Scheme (AFCS) | GOV.UK | Lump sums £1,236-£650,000, GIP, AFIP £172.75/week, 7-year limit, PTSD ranges |
| War Pension Scheme | GOV.UK | Weekly payments by disablement %, no time limit, gratuity for <20%, widows eligible |
| Tribunal Guide | GOV.UK | Appeals process, free representation available |
| Hearing Loss Claims (RBL) | Charity | Free expert guidance and tribunal representation |
| Matrix Agreement | Charity | DEADLINE 31 JULY 2026, 70,000+ eligible, £182k-£700k+ settlements |
| Royal British Legion | Charity | Free claims help, forms assistance, tribunal representation |
| Blesma | Charity | Specialist support for limbless veterans |

**Files Updated:**
- `frontend/app/compensation-schemes.tsx` - Added fullDescription and keyFacts to all schemes, updated card rendering with expanded layout

**Also Fixed:**
- Changed "Hugo" to "Jack" in the intro text (Hugo was replaced with Jack in previous session)

---

### Session: March 15, 2026 (Evening) - AI Character Consolidation

**Doris/Rachel Character Unification Complete:**

The AI characters "Doris" and "Rachel" have been consolidated into a single character named **Rachel**:

| Aspect | Before | After |
|--------|--------|-------|
| Display Name | "Doris" | "Rachel" |
| Internal ID | `doris` | `doris` (preserved for backwards compatibility) |
| Focus | Generic emotional support | Criminal justice support for veterans |
| Avatar | rachel.png | rachel.png |

**Files Updated:**
1. `backend/routers/ai_characters.py` - Updated helper functions to reflect Rachel's criminal justice focus
2. `frontend/src/services/characterService.ts` - Updated comments to reference Rachel
3. `frontend/app/criminal-justice.tsx` - Updated comment
4. `frontend/app/ai-buddies.tsx` - Updated comment
5. `staff-portal/app.js` - Updated character name display
6. `website/ai-team.html` - Updated character card comment
7. `website/script.js` - Updated AI description
8. `docs/RadioCheck_Platform_Overview.html` - Updated funding document
9. `scripts/create_board_presentation.py` - Updated presentation scripts
10. `scripts/create_feature_docs.py` - Updated documentation scripts
11. `scripts/create_technical_docs.py` - Updated technical docs
12. `backend/tests/test_safeguarding.py` - Updated test assertions
13. `backend/tests/test_iteration_15.py` - Updated test assertions
14. **Database**: Updated `ai_characters` collection with new description and bio

---

### Session: March 15, 2026 - UI/UX Fixes & LMS Content Expansion (LATEST)

**UI/UX Fixes Completed:**

1. **Crisis Support Page Redesign:**
   - Tommy AI chat moved to TOP of page (was buried below)
   - Red 999 emergency bar REMOVED
   - Page flow: Tommy → "You're Not Alone" info → On-Duty Counsellors → Crisis Helplines
   - File: `frontend/app/crisis-support.tsx`

2. **Home Page Update:**
   - "Talk to a Veteran" renamed to "Talk to Peer Support"
   - Description: "Connect with those who understand"
   - File: `frontend/app/home.tsx`

**LMS Content Massively Expanded:**

ALL 14 modules now have comprehensive, production-quality training content:

| Module | Before | After | Status |
|--------|--------|-------|--------|
| m1-intro (Introduction) | 9,435 | 15,828 | ✅ EXPANDED |
| m2-algee (ALGEE Action Plan) | 5,748 | 17,100 | ✅ EXPANDED |
| m3-ethics (Ethics & Boundaries) | 6,399 | 14,176 | ✅ EXPANDED |
| m4-communication (Communication) | 6,083 | 12,216 | ✅ EXPANDED |
| m5-crisis (Crisis Support) | 6,586 | 10,117 | ✅ EXPANDED |
| m6-ptsd (PTSD) | 5,964 | 9,089 | ✅ EXPANDED |
| m7-depression (Depression/Anxiety) | 6,114 | 8,071 | ✅ EXPANDED |
| m8-selfcare (Self-Care) | 5,663 | 9,230 | ✅ EXPANDED |
| m9-substance (Substance Misuse) | 5,062 | 15,063 | ✅ EXPANDED |
| m10-safeguarding (Safeguarding) | 5,543 | 10,977 | ✅ EXPANDED |
| m11-diversity (Diversity) | 5,031 | 11,653 | ✅ EXPANDED |
| m12-practical (Practical Skills) | 4,727 | 11,722 | ✅ EXPANDED |
| m13-casestudies (Case Studies) | 7,232 | 13,063 | ✅ EXPANDED |
| m14-completion (Completion) | 4,913 | 11,719 | ✅ EXPANDED |

**Total content: 170,024 characters (was ~84,500)**
**Average per module: 12,144 characters (was ~6,000)**

**New Files:**
- `backend/routers/lms_curriculum_expanded.py` - 6 expanded modules (m2, m9-m12, m14)
- `backend/routers/lms_curriculum_expanded_part2.py` - 8 expanded modules (m1, m3-m8, m13)

---

### Session: March 14, 2026 - AI Safety Classifier & Local Storage

**MAJOR: AI-Enhanced Semantic Safety Classifier**

Added OpenAI GPT-4o-mini as a secondary safety layer for deeper semantic analysis of messages that rule-based detection might miss.

1. **AI Classification Layer (NEW)**
   - Uses OpenAI GPT-4o-mini via Emergent Universal Key
   - Classifies messages as: none, low, medium, high, imminent
   - Analyzes conversation context (last 10-20 messages)
   - Only invoked selectively (when thresholds triggered) to save cost/latency
   - AI can UPGRADE risk levels, but never downgrade from high/imminent
   - Caching for recent classifications (5 min TTL)

2. **Selective Invocation Rules**
   - Rule-based score >= 30
   - Keywords triggered
   - Semantic similarity >= 0.5
   - Concerning patterns detected
   - Conversation escalating

3. **New Files:**
   - `backend/safety/ai_safety_classifier.py` - Full AI classifier implementation

4. **New Endpoint:**
   - `POST /api/safety/generate-summary` - Generate AI session summaries

**MAJOR: Local Conversation Storage**

Store last 50 messages on user's device for cross-session context and AI memory.

1. **Frontend Storage Service:**
   - `frontend/src/services/conversationStorage.ts`
   - Stores 50 messages per character
   - AI-generated session summaries
   - Privacy controls (opt-out, delete, export)
   - Risk flags from previous sessions

2. **Features:**
   - Full transcripts (50 messages per character)
   - AI-generated summaries (key topics, emotional state, risk flags)
   - Feeds into safeguarding for cross-session monitoring
   - User can view/delete their history
   - User can opt-out entirely

**UI Improvements:**

1. **Home Page Redesigned:**
   - 2-column grid of square cards (instead of horizontal)
   - Logo properly centered at top
   - Matches reference design

2. **Live Chat Cleaned Up:**
   - Reduced header buttons (one back button, call button, more options)
   - Consolidated Report/Block/End Chat into single modal
   - Cleaner, more modern appearance

**Bug Fixes:**

1. **Call/Chat Status:**
   - Added `force_available` Socket.IO event
   - Auto-reset stuck staff statuses
   - Fixed socket reference issues

2. **Deployment:**
   - Removed emergentintegrations from requirements.txt

### Session: March 14, 2026 - Unified Safeguarding System Overhaul

**MAJOR: Conversation Trajectory Analysis & Semantic Detection**

Implemented comprehensive safeguarding system that evaluates the ENTIRE conversation trajectory, not just single messages. This upgrade combines:

1. **Full Conversation Monitoring (Section 1 & 6)**
   - Rolling 50-message history per session
   - Tracks risk scores, categories, patterns across messages
   - Calculates conversation-level risk combining all signals

2. **Pattern Detection Engine (Section 2)**
   - EMOTIONAL_DECLINE: distress → hopelessness → ideation
   - METHOD_INTRODUCTION: distress + method mention
   - INTENT_ESCALATION: ideation → intent
   - FINALITY_BEHAVIOR: finality + intent/method
   - BURDEN_TO_IDEATION: burden → ideation

3. **Semantic Similarity Model (Section 3)**
   - sentence-transformers/all-MiniLM-L6-v2 model
   - Detects suicidal intent even without exact keyword matches
   - Cosine similarity comparison against reference embeddings
   - Thresholds: HIGH (0.80), MEDIUM (0.70), LOW (0.60)

4. **Large Phrase Dataset (Section 4)**
   - **527 phrases** across 14 categories (exceeds 500+ requirement)
   - Categories: distress, hopelessness, passive_death_wish, ideation, method, intent, finality, self_harm, burden, isolation, veteran, uk_colloquial, emotional, relationship_loss
   - UK-specific phrases and veteran/military terminology

5. **Continuous Phrase Learning (Section 5)**
   - Candidate phrases flagged for human moderation
   - High-risk messages without keyword matches queued for review
   - No automatic unsupervised inclusion

6. **Safety Failsafe Rules (Section 7)**
   - Explicit suicide plan → IMMINENT
   - Imminent intent statement → IMMINENT
   - High semantic similarity to suicide → IMMINENT
   - Rapid escalation with method → IMMINENT
   - Intent confirmation pattern → IMMINENT

7. **Performance (Section 8)**
   - Average analysis time: 35.5ms (target <50ms) ✓

8. **Audit Logging (Section 9)**
   - All safety assessments logged with full context
   - Session ID, user ID, message preview, risk scores, patterns, trends
   - Filterable by time window and minimum risk level

9. **Compatibility (Section 10)**
   - Integrated with existing EnhancedSafetyLayer
   - Integrated with existing SafetyMonitor
   - No breaking changes to AI chat endpoint

**New Backend Files:**
- `backend/safety/__init__.py` - Module exports
- `backend/safety/conversation_monitor.py` - Conversation trajectory tracking
- `backend/safety/phrase_dataset.py` - 527 categorized phrases
- `backend/safety/semantic_model.py` - Semantic similarity analysis
- `backend/safety/unified_safety.py` - Orchestrates all safety layers
- `backend/safety/crisis_resources.py` - Location-aware crisis resources

**New API Endpoints:**
- `GET /api/safety/debug` - System status (phrases, model, sessions)
- `GET /api/safety/audit` - Safety audit report with filtering

**Component Weights:**
- Keyword detection: 30%
- Conversation trajectory: 35%
- Semantic similarity: 25%
- Pattern bonus: 10%

**Test Coverage:**
- `backend/tests/test_unified_safeguarding.py` - 16 unit tests, 100% pass
- All 10 system objective sections verified

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
- **Preview**: https://vet-compensation.preview.emergentagent.com
  - Learner Portal: `/api/training/`
  - LMS Admin: `/api/lms-admin/`
  - Main Admin: `/api/admin/`
  - Staff Portal: `/api/portal/`

## Test Credentials
- Preview Password: `radiocheck1358`
- Test Learner: `test@example.com` / `testpass123`

## Time Tracking System (NEW - March 15, 2026)

### Purpose
Track work hours for invoicing when Radio Check goes live.

### Location
Admin Portal → "Time Tracking" tab

### Features
- Manual time entry (Date, Hours, Minutes, Category, Description)
- Monthly/category filtering
- Hours by category pie chart
- Daily activity bar chart
- Excel export for invoicing
- Categories: Development, Admin Portal, Staff Portal, LMS Admin, LMS Learning, App Testing, Support, Training, Documentation, Meetings, Other

### WORKFLOW: Log Time After Each Session
**After every Emergent development session:**
1. Go to Admin Portal → Time Tracking
2. Click "Add Entry"
3. Enter: Date, Hours worked, Category (usually "Development"), Description of work done
4. Click Save

### Files
- `backend/routers/timetracking.py` - API endpoints
- `admin-site/time-tracking.js` - Frontend logic
- `admin-site/index.html` - Tab and modal UI

### API Endpoints
- `GET /api/timetracking/entries` - List entries with filters
- `POST /api/timetracking/entries` - Add entry
- `PUT /api/timetracking/entries/{id}` - Update entry
- `DELETE /api/timetracking/entries/{id}` - Delete entry
- `GET /api/timetracking/summary` - Monthly summary
- `GET /api/timetracking/export?month=YYYY-MM` - Excel download
- `POST /api/timetracking/seed-historical` - Load sample data
- `DELETE /api/timetracking/clear-all?confirm=true` - Clear all entries

## UI/UX Fixes Completed (March 15, 2026)

### Crisis Support Page Redesign
- **Tommy AI Chat moved to TOP of page** - First thing users see
- **Red 999 Emergency bar REMOVED** - Was causing user confusion
- **Page flow**: Tommy → "You're Not Alone" info → On-Duty Counsellors → Crisis Helplines
- File: `frontend/app/crisis-support.tsx`

### Home Page Update
- **"Talk to a Veteran" renamed to "Talk to Peer Support"** with description "Connect with those who understand"
- File: `frontend/app/home.tsx` (FALLBACK_MENU_ITEMS)

### Previous UI Fixes (Done in earlier session)
1. ✅ Global AI Disclaimer - Shows only once per app open (not per chat)
2. ✅ AI Characters restructured - Rachel/Doris to criminal-justice page
3. ✅ Organizations page - 999 bar removed, Hugo AI at top
4. ✅ "Meet the AI Team" → "Meet the Team" with real founder placeholders
5. ✅ Voice dictation note added to AI consent disclaimer
6. ✅ Training links added to admin/staff portals
7. ✅ Phone field made optional in staff creation forms
8. ✅ More organizations added to backend database


## DEPLOYMENT REMINDER - MOBILE APP
**When deploying mobile app (iOS/Android):**
- Ensure mobile app connects to the SAME database as the web app
- Both web and mobile should share: MongoDB (users, AI characters, events, time tracking, etc.)
- Use the same backend API endpoints
- Authentication tokens should work across both platforms

