# Portal Migration Audit Document
## Radio Check Admin & Staff Portal Feature Inventory

---

# ADMIN PORTAL (`/app/admin-site/`)

**Total Functions:** 270
**Total Lines:** ~8,600

## TABS / SECTIONS

### 1. STAFF TAB
**Features:**
- View all staff (counsellors + peers combined)
- Filter by type (All/Counsellors/Peers)
- Add new counsellor
- Add new peer supporter
- Edit counsellor details
- Edit peer details
- Delete staff member
- Toggle staff status (active/inactive)
- View staff profiles
- Profile-only add mode (create profile without login credentials)

**API Endpoints:**
- `GET /counsellors`
- `GET /peers`
- `POST /counsellors`
- `POST /peers`
- `PUT /counsellors/{id}`
- `PUT /peers/{id}`
- `DELETE /counsellors/{id}`
- `DELETE /peers/{id}`
- `PUT /counsellors/{id}/status`
- `PUT /peers/{id}/status`

---

### 2. ROTA TAB
**Features:**
- Weekly shift view
- Today's shifts display
- Tomorrow's shifts display
- Coverage statistics (morning/afternoon/evening/night)
- Swap requests management
- Approve/reject swap requests
- Filter swap requests (pending/all)

**API Endpoints:**
- `GET /shifts`
- `GET /shift-swaps`
- `PUT /shift-swaps/{id}/approve`
- `PUT /shift-swaps/{id}/reject`

---

### 3. CMS TAB
**Features:**
- Edit website content
- Preview content changes
- Page-by-page content management
- Section editing
- Card-based content editing
- Seed default content
- Live preview panel

**API Endpoints:**
- `GET /content`
- `PUT /content/{page}/{section}`
- `POST /content/seed`

---

### 4. AI PERSONAS TAB
**Features:**
- View all AI characters
- Add new AI persona
- Edit persona details (name, tagline, description, avatar, prompt)
- Delete persona
- Avatar upload/URL
- Seed personas from code
- Preview avatar
- Order/sort personas

**API Endpoints:**
- `GET /ai-characters`
- `POST /ai-characters`
- `PUT /ai-characters/{id}`
- `DELETE /ai-characters/{id}`
- `POST /ai-characters/seed`
- `POST /upload/avatar`

---

### 5. BETA TAB
**Features:**
- Manage beta features
- Toggle feature flags
- Beta user management

**API Endpoints:**
- `GET /beta-features`
- `PUT /beta-features/{id}`

---

### 6. COMPLIANCE TAB
**Features:**
- Compliance status dashboard
- Run compliance checks
- View compliance history
- GDPR compliance
- Data retention checks
- Security audit status

**API Endpoints:**
- `GET /compliance/status`
- `POST /compliance/check`

---

### 7. LOGS TAB
**Sub-tabs:**
- **Call Logs** - View all phone calls, duration, outcomes
- **Chat Logs** - Live chat sessions, view chat history
- **Safeguarding** - Safeguarding alerts with full details
- **Screening** - Screening submissions, update status
- **Callbacks** - Callback requests
- **Panic Alerts** - Emergency panic button alerts
- **Audit Logs** - Admin action audit trail (NEW)

**Features:**
- Export logs to CSV
- Filter by date range
- View detailed chat history
- Update screening status
- Mark alerts as reviewed

**API Endpoints:**
- `GET /call-logs`
- `GET /live-chat/rooms`
- `GET /safeguarding-alerts`
- `GET /safeguarding/screening-submissions`
- `PUT /safeguarding/screening/{id}/status`
- `GET /callbacks`
- `GET /panic-alerts`
- `GET /admin/audit-logs`
- `POST /logs/export`

---

### 8. MONITORING TAB
**Features:**
- Real-time system stats
- Active calls count
- Active chats count
- Queue depth
- Response times
- Safeguarding alert monitor
- Test safeguarding phrases
- View trigger phrases
- Auto-refresh toggle
- Progress bars for metrics

**API Endpoints:**
- `GET /monitoring/stats`
- `GET /safeguarding-alerts`
- `POST /safeguarding/test`
- `GET /safeguarding/phrases`

---

### 9. GOVERNANCE TAB
**Sub-tabs:**
- **Reports** - Generate compliance reports by period
- **Hazards** - Risk register, add/review hazards
- **KPIs** - Key performance indicators
- **Incidents** - Incident reporting and management
- **Approvals** - CSO approval queue
- **Moderation** - Content moderation queue

**Features:**
- Generate weekly/monthly/quarterly reports
- Print reports
- Export reports to PDF
- Email reports
- Schedule automated reports
- Add/edit hazards
- Review hazards
- KPI tracking with charts
- Incident logging
- CSO sign-off workflow
- Content moderation actions
- Export governance data

**API Endpoints:**
- `GET /governance/report`
- `POST /governance/report/email`
- `GET /governance/scheduled-reports`
- `POST /governance/scheduled-reports`
- `DELETE /governance/scheduled-reports/{email}`
- `GET /governance/hazards`
- `POST /governance/hazards`
- `PUT /governance/hazards/{id}`
- `GET /governance/kpis`
- `GET /governance/incidents`
- `POST /governance/incidents`
- `GET /governance/moderation-queue`
- `POST /governance/moderation/{id}/action`
- `GET /governance/cso-approvals`
- `POST /governance/cso-approvals/{id}`
- `POST /governance/cso-signoff`
- `GET /governance/export`

---

### 10. EVENTS TAB
**Features:**
- View all events
- Create new event
- Edit event
- Cancel event
- View event attendance
- Jitsi meeting integration
- Event categories
- RSVP tracking
- Join meeting button

**API Endpoints:**
- `GET /events`
- `POST /events`
- `PUT /events/{id}`
- `DELETE /events/{id}`
- `GET /events/{id}/attendance`

---

### 11. LEARNING TAB (AI Safety Learning)
**Sub-tabs:**
- **Dashboard** - Learning stats overview
- **Patterns** - Safety response patterns
- **Queue** - Approval queue for new learnings
- **Approved** - Approved learnings list
- **Feedback** - Response feedback review

**Features:**
- View learning statistics
- Manage safety patterns
- Add/delete patterns
- Approve/reject learning submissions
- Review feedback
- Convert feedback to learning
- Seed default patterns

**API Endpoints:**
- `GET /learning/stats`
- `GET /learning/patterns`
- `POST /learning/patterns`
- `DELETE /learning/patterns/{id}`
- `POST /learning/patterns/seed`
- `GET /learning/queue`
- `POST /learning/{id}/approve`
- `POST /learning/{id}/reject`
- `GET /learning/approved`
- `GET /learning/feedback`
- `PUT /learning/feedback/{id}`
- `POST /learning/feedback/{id}/convert`

---

### 12. TIME TRACKING TAB
**Features:**
- Staff time tracking
- Clock in/out
- View time logs
- Edit time entries
- Export timesheets

**API Endpoints:**
- `GET /timetracking`
- `POST /timetracking/clock-in`
- `POST /timetracking/clock-out`
- `PUT /timetracking/{id}`

---

### 13. AI USAGE TAB (NEW)
**Features:**
- Usage summary (total tokens, costs)
- Cost breakdown by provider (OpenAI/Gemini)
- Usage by AI character
- Daily usage chart
- Filter by time period
- Budget tracking

**API Endpoints:**
- `GET /admin/ai-usage/summary`
- `GET /admin/ai-usage/by-character`
- `GET /admin/ai-usage/daily`

---

### 14. SETTINGS TAB
**Features:**
- Email settings (SMTP configuration)
- Clear logs (by type)
- Logo upload/change
- System configuration
- Resource management
- Add/edit/delete resources
- Category management

**API Endpoints:**
- `GET /settings`
- `PUT /settings/email`
- `POST /logs/clear`
- `POST /upload/logo`
- `GET /resources`
- `POST /resources`
- `PUT /resources/{id}`
- `DELETE /resources/{id}`

---

### GLOBAL FEATURES
- Session timeout (2 hours inactivity)
- Token expiry (24 hours)
- Activity tracking
- Toast notifications
- Modal system
- Delete confirmations
- Forgot password flow
- Cookie consent management
- Real-time alert counter badge
- Responsive design

---

# STAFF PORTAL (`/app/staff-portal/`)

**Total Functions:** ~120
**Total Lines:** ~3,400

## TABS / SECTIONS

### 1. DASHBOARD TAB
**Features:**
- My status indicator (available/busy/offline)
- Quick status change
- Today's statistics
- Active alerts count
- Pending callbacks count
- WebRTC phone integration
- Incoming call handling
- Alert sound toggle

**API Endpoints:**
- `GET /staff/profile`
- `PUT /staff/status`
- `GET /stats/today`

---

### 2. ALERTS TAB
**Sub-sections:**
- Safeguarding alerts
- Panic alerts
- Live support requests

**Features:**
- Real-time alert polling (30 sec interval)
- New alert sound notification
- New alert banner
- Acknowledge alerts
- Resolve alerts
- View alert history
- Create case from alert
- Risk level badges
- Trigger phrase highlighting
- Location display (if available)
- Alert expansion/collapse
- Safeguarding alert detail modal

**API Endpoints:**
- `GET /safeguarding-alerts`
- `PUT /safeguarding-alerts/{id}/acknowledge`
- `PUT /safeguarding-alerts/{id}/resolve`
- `GET /panic-alerts`
- `PUT /panic-alerts/{id}/acknowledge`
- `PUT /panic-alerts/{id}/resolve`
- `POST /panic/trigger` (emergency panic)

---

### 3. LIVE SUPPORT TAB
**Features:**
- Real-time chat polling
- View waiting users
- Join chat session
- Live chat modal
- Send/receive messages
- Call user from chat (WebRTC)
- End chat session
- Chat history display
- Waiting time indicator

**API Endpoints:**
- `GET /live-chat/rooms`
- `GET /live-chat/rooms/{id}/messages`
- `POST /live-chat/rooms/{id}/messages`
- `POST /live-chat/rooms/{id}/join`
- `PUT /live-chat/rooms/{id}/end`

---

### 4. CASES TAB
**Sub-tabs:**
- Active cases
- My cases
- Morning review queue

**Features:**
- View all cases
- Open case details
- Add session notes
- Edit safety plan
- Create referral
- Escalate to counsellor
- Escalate case (general)
- Case timeline
- Risk level tracking
- Create case from alert

**API Endpoints:**
- `GET /cases`
- `GET /cases/{id}`
- `POST /cases`
- `PUT /cases/{id}`
- `POST /cases/{id}/notes`
- `PUT /cases/{id}/safety-plan`
- `POST /cases/{id}/referral`
- `POST /cases/{id}/escalate`
- `GET /cases/morning-review`

---

### 5. CALLBACKS TAB
**Sub-tabs:**
- Active callbacks
- Completed callbacks

**Features:**
- View callback requests
- Take callback (assign to self)
- Complete callback
- Release callback
- Priority indicators
- User contact details

**API Endpoints:**
- `GET /callbacks`
- `PUT /callbacks/{id}/take`
- `PUT /callbacks/{id}/complete`
- `PUT /callbacks/{id}/release`

---

### 6. ROTA TAB
**Features:**
- Calendar view (month)
- View shifts by day
- Add new shift
- Edit shift
- Delete shift
- Request shift swap
- View swap requests
- Previous/next month navigation

**API Endpoints:**
- `GET /shifts`
- `POST /shifts`
- `PUT /shifts/{id}`
- `DELETE /shifts/{id}`
- `GET /shift-swaps`
- `POST /shift-swaps`

---

### 7. TEAM TAB
**Sub-tabs:**
- Today's team
- Tomorrow's team

**Features:**
- View who's on duty
- Staff status indicators
- Initials avatars
- Role display (counsellor/peer)

**API Endpoints:**
- `GET /staff/on-duty`
- `GET /shifts/today`
- `GET /shifts/tomorrow`

---

### 8. NOTES TAB
**Sub-tabs:**
- My notes
- Shared notes

**Features:**
- Create personal notes
- Create shared notes
- Edit notes
- Delete notes
- Share with specific staff
- Note categories
- Search notes

**API Endpoints:**
- `GET /notes`
- `POST /notes`
- `PUT /notes/{id}`
- `DELETE /notes/{id}`

---

### 9. SUPERVISION TAB (Supervisors Only)
**Features:**
- View team members
- View member notes
- Add supervision notes
- View escalations
- Acknowledge escalation
- Resolve escalation
- Filter escalations by status
- Escalation modal

**API Endpoints:**
- `GET /staff/team`
- `GET /supervision/notes`
- `POST /supervision/notes`
- `GET /escalations`
- `PUT /escalations/{id}/acknowledge`
- `PUT /escalations/{id}/resolve`

---

### GLOBAL FEATURES
- Session timeout (2 hours inactivity)
- Token expiry (24 hours)
- Activity tracking
- Toast notifications
- Modal system
- WebRTC phone integration
- Alert sound system (Web Audio API)
- Sound toggle with persistence
- Real-time polling
- Responsive design
- Feedback modal for AI responses
- Submit for learning feature

---

## WEBRTC/PHONE FEATURES (`twilio-phone.js`, `webrtc-phone.js`)
- Twilio Device initialization
- Incoming call handling
- Outgoing call making
- Call status UI updates
- Mute/unmute
- Hold/unhold
- Call transfer
- DTMF tones
- Call from chat integration

---

## SHARED COMPONENTS NEEDED

### UI Components:
- Toast notification system
- Modal system (generic, delete confirm, form modals)
- Tab navigation
- Table with sorting/filtering
- Status badges
- Calendar component
- Charts (activity trends, coverage, KPIs)
- Progress bars
- Avatar/initials component
- Card components
- Form inputs (text, select, textarea, checkbox, date picker)
- Loading spinners
- Alert banners
- Pagination

### Hooks/Services:
- Auth context (session management, timeout, token refresh)
- API client with error handling
- Real-time polling hook
- WebSocket connection (for future)
- Sound notification hook
- Local storage persistence
- Toast context

### Utilities:
- Date formatting
- Time ago formatting
- CSV export
- PDF generation
- HTML escaping
- Initials extraction

---

## MIGRATION PRIORITY

### Phase 1 - Critical (Staff Portal)
1. Dashboard with status
2. Alerts (safeguarding, panic, live support)
3. Live chat
4. Cases management
5. Callbacks

### Phase 2 - Important (Staff Portal)
6. Rota/shifts
7. Team view
8. Notes
9. Supervision (supervisors only)

### Phase 3 - Admin Portal Core
10. Staff management
11. AI Personas
12. Logs (all sub-tabs)
13. Monitoring

### Phase 4 - Admin Portal Extended
14. Rota management
15. CMS
16. Events
17. Settings

### Phase 5 - Admin Portal Governance
18. Governance (all sub-tabs)
19. Learning/Safety patterns
20. Compliance
21. Time tracking
22. AI Usage
23. Beta features

---

## RISK AREAS

1. **WebRTC Phone** - Complex integration, needs careful testing
2. **Real-time alerts** - Critical for safeguarding, must be reliable
3. **Live chat** - Real-time messaging, needs polling or WebSocket
4. **Session management** - Security-critical
5. **File uploads** - Avatar, logo, resources
6. **Charts/reporting** - Governance reports, KPIs
7. **Jitsi integration** - Events video conferencing

---

## TOTAL API ENDPOINTS TO IMPLEMENT

- Staff Portal: ~45 endpoints
- Admin Portal: ~85 endpoints
- Shared/Auth: ~10 endpoints

**Total: ~140 API endpoint integrations**

---

*Document generated: March 2026*
*This audit covers all features visible in the codebase as of this date.*
