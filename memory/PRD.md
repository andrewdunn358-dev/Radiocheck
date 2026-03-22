# Radiocheck Veterans Support Platform - PRD

## CRITICAL RULE - CHECK EVERY TIME BEFORE SAVING

**NEVER change these production URLs to preview URLs:**

| File | Variable | MUST BE |
|------|----------|---------|
| `/app/frontend/.env` | `EXPO_PUBLIC_BACKEND_URL` | `https://veterans-support-api.onrender.com` |
| `/app/frontend/.env` | `EXPO_PUBLIC_SITE_PASSWORD` | `radiocheck2025` |
| `/app/portal/.env.local` | `NEXT_PUBLIC_API_URL` | `https://veterans-support-api.onrender.com` |
| `/app/portal/.env.production` | `NEXT_PUBLIC_API_URL` | `https://veterans-support-api.onrender.com` |

**Before ANY save to GitHub, run this check:**
```bash
grep -r "preview.emergentagent.com" /app/frontend/.env /app/portal/.env* 2>/dev/null
```
If this returns ANY results, FIX THEM before saving.

---

## Original Problem Statement
The Radiocheck project is a complex mix of:
- **FastAPI backend** (deployed on Render - DO NOT TOUCH)
- **Next.js web portal** (`/portal/`) - the unified portal replacing legacy vanilla JS portals
- **Expo mobile app** (`/frontend/`) - React Native mobile app

## Architecture
```
/app
├── backend/                  # FastAPI + Socket.IO (deployed on Render)
│   ├── server.py            # Main API with audit logging
│   ├── webrtc_signaling.py  # Socket.IO signaling with heartbeat
│   └── audit_logger.py      # Audit logging functions
├── frontend/                 # Expo React Native mobile app
│   └── src/components/
│       └── SafeguardingCallModal.tsx  # WebRTC with audio quality enhancements
├── memory/
│   ├── PRD.md               # This file - project requirements
│   └── STAFF_PORTAL_AUDIT.md # Comprehensive staff portal audit
└── portal/                   # Next.js unified portal
    ├── src/app/
    │   ├── admin/page.tsx    # Admin portal - FULLY REFACTORED (414 lines)
    │   └── staff/page.tsx    # Staff portal - FULLY REFACTORED (1,166 lines)
    ├── src/components/
    │   ├── admin/tabs/       # 33 extracted admin tab components
    │   └── staff/tabs/       # 8 extracted staff tab components (ALL COMPLETE)
    │       ├── AlertsTab.tsx       # Safeguarding + Panic alerts with real-time polling
    │       ├── CallbacksTab.tsx    # Callback requests with Twilio integration
    │       ├── CasesTab.tsx        # Case management with modals
    │       ├── LiveChatTab.tsx     # Live chat with WebSocket handlers
    │       ├── NotesTab.tsx        # Staff notes with sharing
    │       ├── RotaTab.tsx         # Shift scheduling with calendar
    │       ├── SupervisionTab.tsx  # Supervisor escalation management
    │       └── TeamTab.tsx         # Team status and WebRTC calling
    ├── src/hooks/
    │   └── useWebRTCPhone.tsx  # WebRTC hook with Socket.IO stability
    └── src/lib/api.ts        # API functions with notes support
```

## Completed Work - December 2025

### Staff Portal FINAL Phase Refactoring - All Tabs Extracted (P0)
**Status**: ✅ COMPLETE (December 2025)

**Problem**: Complete refactoring of `/app/portal/src/app/staff/page.tsx` (3,907 lines) using the same phased approach as admin portal.

**Final Extraction Completed (Batch 2)**:
- Reduced `page.tsx` from **2,257 lines → 1,166 lines** (~48% additional reduction)
- Total reduction: **3,907 lines → 1,166 lines** (~70% total reduction)
- Created 5 additional tab components

**Components Extracted in Batch 2**:
1. **CallbacksTab.tsx** (270 lines):
   - ✅ Callback listing with sub-tabs (pending/active/completed)
   - ✅ Take/release/complete callback actions
   - ✅ Twilio phone integration for calling
   - ✅ `useCallbackCounts` hook for badge counts

2. **RotaTab.tsx** (260 lines):
   - ✅ Calendar view with shift indicators
   - ✅ Add shift modal
   - ✅ Delete shift and request swap functionality
   - ✅ Swap requests display

3. **TeamTab.tsx** (150 lines):
   - ✅ Team members on duty display
   - ✅ WebRTC call button for available members
   - ✅ Real-time status sync event listeners
   - ✅ Team stats breakdown (available/busy/offline)

4. **NotesTab.tsx** (350 lines):
   - ✅ My notes and shared notes tabs
   - ✅ Add/edit/delete note modals
   - ✅ Share note with team members modal
   - ✅ Author tracking and permissions

5. **SupervisionTab.tsx** (140 lines):
   - ✅ Supervisor-only access check
   - ✅ Pending/all escalations tabs
   - ✅ Acknowledge and resolve escalation actions

**Hook Exports for Parent Component**:
- `useAlertCounts(token)` - Returns alert data and counts for dashboard/badges
- `useLiveChatCounts(token)` - Returns chat data and counts for dashboard/badges
- `useCaseCounts(token)` - Returns case data and counts for dashboard/badges
- `useCallbackCounts(token)` - Returns callback data and counts for dashboard/badges

**Remaining in page.tsx (1,166 lines)**:
- Login UI and authentication form
- Sidebar navigation
- Dashboard tab (summary view - intentionally kept in main page)
- Session timeout warning
- WebRTC and Twilio phone UI in header
- Internal messages modal
- Panic button modal

**Verification**: Build successful (`next build` passed)

---

### Staff Portal Batch 1 Refactoring - AlertsTab/LiveChatTab/CasesTab Extraction (P1)
**Status**: ✅ COMPLETE (February 2026)

**Problem**: Begin refactoring of `/app/portal/src/app/staff/page.tsx` (3,907 lines) using the same phased approach as admin portal.

**Batch 1 Extraction Completed**:
- Reduced `page.tsx` from **3,907 lines → 2,257 lines** (~42% reduction)
- Created 3 new tab components (1,828 lines total)

**Critical Real-Time Handlers Moved** (VERIFIED):
1. **AlertsTab** (488 lines):
   - ✅ Safeguarding alerts polling (30s interval)
   - ✅ Panic alerts polling (30s interval)
   - ✅ Sound alert on new active alerts
   - ✅ Cleanup on unmount

2. **LiveChatTab** (645 lines):
   - ✅ Live chat rooms polling (30s interval)
   - ✅ `chat_request_confirmed` WebSocket event listener
   - ✅ `new_chat_message` WebSocket event listener
   - ✅ Sound alert on new waiting chats
   - ✅ AI Feedback modal (integrated)
   - ✅ All event listener cleanup on unmount

3. **CasesTab** (695 lines):
   - ✅ Case listing with filters
   - ✅ Case detail modal
   - ✅ Add session note modal
   - ✅ Create case modal
   - ✅ Escalate case modal

**Hook Exports for Parent Component**:
- `useAlertCounts(token)` - Returns alert data and counts for dashboard/badges
- `useLiveChatCounts(token)` - Returns chat data and counts for dashboard/badges
- `useCaseCounts(token)` - Returns case data and counts for dashboard/badges

**Verification**: Build successful (`next build` passed)

---

### Admin Portal FINAL Phase Refactoring - Complete Modularization (P0)
**Status**: ✅ COMPLETE (February 2026)

**Problem**: Complete the final refactoring pass of `/app/portal/src/app/admin/page.tsx` by extracting the remaining 8 tabs.

**Final Phase Extraction Completed**:
- Reduced `page.tsx` from **2,157 lines → 414 lines** (~81% reduction from this phase)
- **Total Admin Page Reduction**: 7,229 lines → 414 lines (**94% reduction overall!**)

**New Components Created in Final Phase**:
1. `/app/portal/src/components/admin/tabs/AIUsageTab.tsx` (264 lines)
   - Provider breakdown cards with budget bars
   - Daily usage charts (Line & Bar)
   - Recent usage table

2. `/app/portal/src/components/admin/tabs/MonitoringTab.tsx` (156 lines)
   - Activity stats (calls, chats, AI sessions, callbacks)
   - User stats
   - Server health gauges (CPU, Memory, Load)
   - Auto-refresh every 30 seconds with cleanup on unmount

3. `/app/portal/src/components/admin/tabs/MigrationTab.tsx` (132 lines)
   - Legacy counts display
   - Run migration and fix passwords actions

4. `/app/portal/src/components/admin/tabs/CMSTab.tsx` (144 lines)
   - Page list sidebar
   - Page content viewer

5. `/app/portal/src/components/admin/tabs/BetaTestingTab.tsx` (210 lines)
   - Beta toggle
   - Pre/Post survey stats
   - Survey responses list

6. `/app/portal/src/components/admin/tabs/ComplianceTab.tsx` (246 lines)
   - GDPR metrics
   - Staff wellbeing section
   - Security incidents & complaints
   - Policy document downloads

7. `/app/portal/src/components/admin/tabs/LearningTab/` (488 lines total)
   - `index.tsx` - Main container with 4 sub-tabs
   - `PatternsSubTab.tsx` - Safety patterns with filters
   - `QueueSubTab.tsx` - Approval queue
   - `ApprovedSubTab.tsx` - Approved learnings list
   - `FeedbackSubTab.tsx` - Response feedback management

8. `/app/portal/src/components/admin/tabs/TimeTrackingTab.tsx` (291 lines)
   - Month selector
   - Summary cards (hours, cost, entries, avg daily)
   - Recent entries list
   - Category breakdown
   - Daily breakdown grid
   - Add time entry modal

**Final Admin Page Structure** (`page.tsx` - 414 lines):
- Imports
- Tab definitions array
- Auth hook usage
- Alert counter polling
- Message auto-clear
- Login form
- Main layout (sidebar, header, content area)
- Tab component rendering

**Verification**: Build successful, TypeScript compilation passes

---

### Admin Portal Phase 4 Refactoring - Rota/Governance/Events Extraction (P0)
**Status**: ✅ COMPLETE (February 2026)

**Problem**: Continue refactoring the admin portal by extracting Rota, Governance (with 7 sub-tabs), and Events tabs.

**Phase 4 Extraction Completed**:
- Reduced `page.tsx` from **3,891 lines → 2,157 lines** (~1,734 lines removed)

**New Components Created**:
1. `/app/portal/src/components/admin/tabs/RotaTab.tsx` (574 lines)
   - Full month calendar view
   - Add/Edit shift modal
   - Coverage stats
   - Swap request management (pending/all views)

2. `/app/portal/src/components/admin/tabs/GovernanceTab/` (1,007 lines total)
   - `index.tsx` - Main container with 7 sub-tabs
   - `HazardsSubTab.tsx` - Clinical safety hazard log
   - `KPIsSubTab.tsx` - Safeguarding KPIs dashboard
   - `IncidentsSubTab.tsx` - Incident management
   - `ModerationSubTab.tsx` - Peer report queue
   - `ApprovalsSubTab.tsx` - CSO pending approvals
   - `ComplianceSubTab.tsx` - AI compliance checker
   - `ReportsSubTab.tsx` - Summary reports with email scheduling

3. `/app/portal/src/components/admin/tabs/EventsTab.tsx` (369 lines)
   - Create/edit event modal
   - Upcoming and past events views
   - View attendance modal

**Total Admin Page Reduction**: 7,229 lines → 2,157 lines (**70% reduction!**)

**Verification**: Build successful, TypeScript compilation passes

---

### Admin Portal Phase 3 Refactoring - LogsTab Extraction (P0)
**Status**: ✅ COMPLETE (February 2026)

**Problem**: Continue refactoring the admin portal by extracting the Logs tab with its 7 sub-tabs.

**Phase 3 Extraction Completed**:
- Reduced `page.tsx` from **5,175 lines → 3,891 lines** (~1,284 lines removed)

**New LogsTab Components Created** (`/app/portal/src/components/admin/tabs/LogsTab/`):
1. `index.tsx` (790 lines)
   - Main container with stats summary cards
   - App usage analytics dashboard
   - Usage charts (Line, Bar, Doughnut)
   - Activity trend charts
   - Location map integration
   - Sub-tab navigation and routing

2. `CallsSubTab.tsx` (58 lines)
   - Call logs table with date/time, contact, type, method columns

3. `ChatsSubTab.tsx` (111 lines)
   - Chat rooms table
   - Chat History Modal for viewing conversation

4. `SafeguardingSubTab.tsx` (240 lines)
   - Safeguarding alerts table with risk levels
   - Safeguarding Alert Detail Modal
   - Acknowledge/Resolve actions

5. `ScreeningSubTab.tsx` (67 lines)
   - Screening submissions table with risk scores

6. `CallbacksSubTab.tsx` (58 lines)
   - Callback requests table with status tracking

7. `PanicSubTab.tsx` (50 lines)
   - Panic alerts table with animated active alerts

8. `AuditSubTab.tsx` (103 lines)
   - Audit logs table with event type filter

**Total LogsTab extracted**: 1,477 lines into reusable components

**Total Admin Page Reduction**: 7,229 lines → 3,891 lines (**46% reduction**)

**Verification**: Build successful, TypeScript compilation passes

**Remaining tabs to extract** (Phase 4+):
- RotaTab (~540 lines)
- GovernanceTab (7 sub-tabs, ~770 lines)
- EventsTab (~315 lines)
- AIUsageTab
- MonitoringTab
- MigrationTab
- CMSTab
- BetaTab
- ComplianceTab
- LearningTab
- TimeTrackingTab

---

### Admin Portal Phase 2 Refactoring - Tab Extraction (P0)
**Status**: ✅ COMPLETE (February 2026)

**Problem**: Continue refactoring the admin portal by extracting tab components.

**Phase 2 Extraction Completed**:
- Reduced `page.tsx` from **6,575 lines → 5,175 lines** (~1,400 lines removed)

**New Tab Components Created** (`/app/portal/src/components/admin/tabs/`):
1. `StaffTab.tsx` (681 lines)
   - Full staff management with CRUD operations
   - Search and filter functionality
   - Add Staff, Edit Staff, and Reset Password modals

2. `AIPersonasTab.tsx` (329 lines)
   - AI character grid with enable/disable toggles
   - Character editing modal
   - Import defaults functionality

3. `SettingsTab.tsx` (304 lines)
   - Logo settings
   - Email notification settings
   - Clear logs (danger zone)
   - System information
   - Feature toggles

**Total extracted**: 1,314 lines into reusable components

**Verification**: Build successful, admin portal login page renders correctly

**Remaining tabs to extract** (Phase 3+):
- LogsTab (7 sub-tabs, ~1,200 lines)
- RotaTab (~540 lines)
- GovernanceTab (7 sub-tabs, ~770 lines)
- EventsTab (~315 lines)
- Other smaller tabs

---

### Admin Portal Phase 1 Refactoring - Infrastructure Extraction (P0)
**Status**: ✅ COMPLETE (February 2026)

**Problem**: The admin portal page was a 7,229-line monolithic component that needed to be broken down.

**Phase 1 Extraction Completed**:
- Reduced `page.tsx` from **7,229 lines → 6,574 lines** (655 lines extracted)

**New Files Created**:
1. `/app/portal/src/types/admin.ts` (109 lines)
   - Extracted: User, StaffMember, CallLog, ChatRoom, SafeguardingAlert, AICharacter, AIUsageSummary interfaces

2. `/app/portal/src/lib/admin-api.ts` (478 lines)
   - Extracted: Full API client with 60+ methods
   - Includes: API_URL config, resolveAvatarUrl helper

3. `/app/portal/src/hooks/useMainAdminAuth.ts` (154 lines)
   - Extracted: Auth state, session management, login/logout handlers
   - Note: Named "useMainAdminAuth" to avoid conflict with existing useAdminAuth.tsx for LMS

4. `/app/portal/src/contexts/AdminContext.tsx` (85 lines)
   - Created: Shared context for error/success notifications, sidebar state
   - TODO comment added for future domain-specific context splitting

**Verification**: Build successful, admin portal login page renders correctly

**Next Phase**: Extract tab components (StaffTab, LogsTab, etc.) to `/app/portal/src/components/admin/tabs/`

---

### Admin Portal Full Audit (P0)
**Status**: ✅ COMPLETE (February 2026)

**Problem**: The admin portal page (`/app/portal/src/app/admin/page.tsx`) is a 7,229-line monolithic component that is unmaintainable.

**Audit Findings**:
- **15 main tabs** (Staff, Logs, AI Personas, AI Usage, Monitoring, Migration, Rota, CMS, Beta, Compliance, Governance, Events, AI Learning, Time Tracking, Settings)
- **7 log sub-tabs** (Calls, Chats, Safeguarding, Screening, Callbacks, Panic, Audit)
- **7 governance sub-tabs** (Hazards, KPIs, Incidents, Moderation, Approvals, Compliance, Reports)
- **4 learning sub-tabs** (Patterns, Queue, Approved, Feedback)
- **~90 state variables**
- **~50+ API endpoint functions**
- **~10 modal dialogs**

**Refactoring Plan Created**: See `/app/memory/ADMIN_PORTAL_AUDIT.md`

**Proposed Structure After Refactoring**:
- `/app/portal/src/lib/admin-api.ts` - API client ✅ DONE
- `/app/portal/src/types/admin.ts` - TypeScript interfaces ✅ DONE
- `/app/portal/src/hooks/useMainAdminAuth.ts` - Auth hook ✅ DONE
- `/app/portal/src/contexts/AdminContext.tsx` - Shared state ✅ DONE
- `/app/portal/src/components/admin/tabs/` - 30+ tab components (Phase 2)
- `/app/portal/src/components/admin/modals/` - 10+ modal components (Phase 3)
- `/app/portal/src/components/admin/ui/` - Shared UI components (Phase 4)

**Expected Outcome**: 7,229 lines → ~50 files averaging 100-150 lines each

---

### BUG FIX: Vercel Frontend Build Failure (P0)
**Status**: ✅ COMPLETE (February 2026)

**Root Cause**: The Expo frontend build was failing due to `require()` statements referencing non-existent image files. When using React Native/Expo, `require()` statements for local images must reference files that exist.

**Missing Images** (now generated):
- `jack.png` ✅ Generated - Ex-Royal Navy compensation expert
- `baz.png` ✅ Generated - Ex-Rifles transition specialist  
- `megan.png` ✅ Generated - Ex-RAF MERT women veterans specialist
- `penny.png` ✅ Generated - Ex-Royal Navy benefits specialist

**Fix Applied**:
- Generated 4 new photorealistic avatars using AI image generation
- Downloaded all 4 images to `/app/frontend/assets/images/`
- Restored full `require()` mappings in both frontend files
- Added `doris.png` which was available but not included

**Verification**: `npx expo export --platform web` completes successfully with all 58 static routes and 17 AI avatars

---

### LMS Portal Feature Parity Enhancement (P0)
**Status**: ✅ COMPLETE (February 2026)

**Problem**: The new Next.js Learning and LMS-Admin portals were missing key features compared to the legacy vanilla JS versions.

**Implemented Features**:

**Learning Portal (`/app/portal/src/app/learning/`)**:
1. **Mr Clark Floating Chat Widget** - New component `TutorChatWidget.tsx`
   - Floating widget visible on all learning pages
   - Mr Clark avatar + "Ask Mr Clark" button
   - Full chat window with history and typing indicators

2. **Tutor Introduction per Module**
   - Shows Mr Clark's personalized intro for each module
   - Fetches from `/api/lms/tutor/module-intro/{moduleId}`

3. **Reflection Questions System** - New component `ReflectionQuestions.tsx`
   - AI-evaluated reflection questions for critical modules
   - Required before quiz access
   - Competency tracking and feedback

**LMS Admin Portal (`/app/portal/src/app/lms-admin/`)**:
1. **Quiz Management Tab** - View quiz questions with correct answers
2. **Alerts Tab** - System alerts with mark all read
3. **Learner Progress Detail Modal** - Module completion breakdown
4. **Edit Learner Modal** - Edit name and notes
5. **Preview Course Button** - Opens learner portal in new tab

**Files Created**:
- `/app/portal/src/components/learning/TutorChatWidget.tsx`
- `/app/portal/src/components/learning/ReflectionQuestions.tsx`
- `/app/memory/LMS_PORTAL_AUDIT.md`

**Files Modified**:
- `/app/portal/src/app/learning/layout.tsx`
- `/app/portal/src/app/learning/module/[id]/page.tsx`
- `/app/portal/src/app/lms-admin/page.tsx`

**Verification**: Portal builds successfully with `npm run build`

---

## Completed Work - December 2025

### Notes Edit/Share & Internal Messaging
**Status**: ✅ COMPLETE

**What was implemented**:
- **Edit Notes**: Staff can now edit their notes after creation with an edit modal
- **Share Notes with Staff**: Added a share modal to select specific team members to share notes with
- **Internal Messaging System**: 
  - New `/api/messages` endpoints in backend for sending/receiving messages between staff
  - Messages button in staff portal sidebar with unread count badge
  - Messages modal showing conversation history and ability to send new messages
  - Mark messages as read functionality
- Backend models: `InternalMessageCreate`, `InternalMessage`
- API functions: `getMessages`, `sendMessage`, `markMessageRead`, `markAllMessagesRead`

### Callback Request & Twilio Fix
**Status**: ✅ COMPLETE

**What was fixed**:
- Fixed callback request failing due to missing `message` and `request_type` fields
- Fixed Twilio "all staff are busy" message by normalizing UK phone numbers (07xxx → +44xxx)
- Mobile app `.env` was pointing to preview URL instead of production - corrected

### Logo Update on Login Screens
**Status**: ✅ COMPLETE

**What was implemented**:
- Replaced Shield icon with Radiocheck logo on Staff Portal login screen (`/portal/src/app/staff/page.tsx`)
- Replaced Shield icon with Radiocheck logo on Admin Portal login screen (`/portal/src/app/admin/page.tsx`)
- Logo URL: `https://customer-assets.emergentagent.com/job_b298e80e-e613-4114-bd36-44dba2b1f918/artifacts/hcklvnmw_logo.png`

### P0 - Audit Logging Implementation
**Status**: ✅ COMPLETE

**What was implemented**:
- Added `audit_login()` calls in `/backend/routers/auth.py`:
  - Successful login (staff and legacy users)
  - Failed login (wrong password, user not found)
  - Includes IP address tracking
- Added `audit_safeguarding_alert()` call when alerts are created
- Added `audit_admin_action()` calls for:
  - Settings changes
  - Staff member creation/deletion
  - Callback taken/released/completed

### P1 - Staff Profile Editing for Admins
**Status**: ✅ COMPLETE

**What was implemented**:
- Enhanced Edit Staff Modal in `/portal/src/app/admin/page.tsx`:
  - Basic info (name, email, role, status)
  - Contact info (phone, SMS, WhatsApp)
  - Role-specific fields (specialization, area, years_served, background)
  - Supervisor privileges toggle
- Updated `StaffUpdate` model to include `status` field
- Updated `StaffMember` interface to include new fields

### Callback "Take" Button Fix
**Status**: ✅ COMPLETE

**What was fixed**:
- Backend was using `status: "in_progress"` but frontend checked for `status: "taken"`
- Updated `/backend/server.py` callback endpoints:
  - `PATCH /callbacks/{id}/take` now sets `status: "taken"` and `taken_by`/`taken_by_name` fields
  - `PATCH /callbacks/{id}/release` clears all assignment fields
  - `PATCH /callbacks/{id}/complete` records `completed_by` and `completed_by_name`
- All callback actions now include audit logging

### Interaction Notes System
**Status**: ✅ COMPLETE (NEW FEATURE)

**What was implemented**:
- Backend endpoints in `/backend/server.py`:
  - `POST /api/notes` - Create interaction note
  - `GET /api/notes` - Get notes (own + shared)
  - `GET /api/notes/{id}` - Get specific note
  - `PUT /api/notes/{id}` - Update note (author only)
  - `DELETE /api/notes/{id}` - Delete note (author/admin)
  - `POST /api/notes/{id}/share` - Share with specific staff
- Notes can be:
  - Linked to callbacks, alerts, cases, sessions
  - Tagged (e.g., `supervisor-review`, `follow-up`)
  - Shared with team or specific staff members
- Supervisors/admins can see notes tagged `supervisor-review`
- Updated `/portal/src/lib/api.ts` with full notes API support

### WebRTC Audio Quality Improvements
**Status**: ✅ COMPLETE

**What was implemented**:
- Enhanced audio constraints in both files:
  - `echoCancellation: true`
  - `noiseSuppression: true`
  - `autoGainControl: true`
  - `sampleRate: 48000`
- Added more STUN servers for better connectivity
- Added ICE connection state monitoring with auto-restart on failure
- Added ICE gathering state logging
- Improved disconnection handling (3-second grace period before error)
- Better audio element lifecycle management

### Socket.IO Stability Improvements
**Status**: ✅ COMPLETE

**What was implemented**:
- Enhanced socket configuration in `/portal/src/hooks/useWebRTCPhone.tsx`:
  - `reconnectionAttempts: Infinity` (keep trying forever)
  - `reconnectionDelayMax: 5000`
  - `timeout: 20000`
- Added reconnection state handling with auto-re-registration
- Added heartbeat mechanism (30-second interval)
- Added `heartbeat` event handler in `/backend/webrtc_signaling.py`
- Better disconnect reason handling

### P0 - WebRTC Call Lifecycle Fixes
**Status**: ✅ COMPLETE (December 2025)

**Issue 1: Call alert not disappearing for other staff when one accepts**
- Backend already emitted `call_request_claimed` event in `accept_call_request` handler
- Added new `call_request_claimed` socket listener in `/portal/src/hooks/useWebRTCPhone.tsx`
- Listener checks if `request_id` matches the pending request before dismissing
- This ensures call alerts disappear for all staff when any staff member accepts

**Issue 2: Call not ending on client when staff hangs up**
- Root cause: Staff portal emitted `webrtc_end_call` event but backend had no handler
- Added `webrtc_end_call` socket event handler in `/backend/webrtc_signaling.py`
- Handler properly emits `call_ended` to the other party (mobile app user)
- Resets all user statuses to 'available' and removes call from active_calls
- Mobile app's `call_ended` listener in `SafeguardingCallModal.tsx` triggers cleanup

**Bug Fix**: Added missing `claimed_call_requests: Dict[str, dict] = {}` dictionary

## Backend API
- **Production URL**: `https://veterans-support-api.onrender.com`
- **Socket.IO Path**: `/api/socket.io`
- **Key Endpoints**:
  - `/api/auth/login` - Login with audit logging
  - `/api/callbacks` - CRUD for callbacks
  - `/api/notes` - Interaction notes system
  - `/api/staff/{id}` - Staff management

## User Credentials
- Test user: `kev@radiocheck.me` / `AS90155mm`

## Future Tasks (Backlog)
- [ ] (P0) Continue Admin Portal Refactoring - Extract remaining tabs (Rota, Governance, Events, etc.)
- [ ] (P1) Staff Portal Refactoring - `/portal/src/app/staff/page.tsx` (3,907 lines)
- [ ] (P1) **User Manuals**:
  - [ ] Staff User Manual - Guide for peer supporters and counsellors
  - [ ] Admin User Manual - Guide for administrators and supervisors
- [ ] (P2) Move logs to top of admin logs page (deferred)
- [ ] (P2) Full CMS visual editor
- [ ] (P2) Discussion Forums
- [ ] (P2) Mood Tracker
- [ ] (P2) Welsh Language Support
- [ ] End-to-end WebRTC call testing on production

## Known Technical Debt
- `/portal/src/app/admin/page.tsx` is 2,157 lines (down from 7,229 - 70% reduced) - continue refactoring remaining tabs
- `/portal/src/app/staff/page.tsx` is 3,907 lines - needs to be audited and refactored
- WebRTC call flow involves 3 files that must be kept in sync
