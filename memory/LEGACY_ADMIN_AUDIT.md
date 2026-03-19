# LEGACY ADMIN PORTAL COMPLETE AUDIT
## Source: /app/admin-site/app.js (8588 lines)
## Created: March 2026
## Purpose: Reference document for React portal migration - DO NOT MODIFY ENDPOINTS

---

## TAB 1: STAFF (Unified View)
**API Endpoints:**
- `GET /admin/unified-staff` - Get all staff
- `GET /counsellors` - Get counsellors
- `GET /peer-supporters` - Get peer supporters
- `PATCH /counsellors/{id}/status` - Update counsellor status
- `PATCH /peer-supporters/{id}/status` - Update peer status
- `POST /counsellors` - Add counsellor
- `POST /peer-supporters` - Add peer
- `PUT /counsellors/{id}` - Edit counsellor
- `PUT /peer-supporters/{id}` - Edit peer
- `DELETE /counsellors/{id}` - Delete counsellor
- `DELETE /peer-supporters/{id}` - Delete peer

**Features:**
- View all staff (counsellors + peers) in unified view
- Filter by role (all/counsellor/peer), status
- Status toggle buttons (available/busy/off for counsellors, available/limited/unavailable for peers)
- Edit/Delete staff buttons
- Add new counsellor/peer modals with full forms
- Users list with role badges
- Reset password modal

---

## TAB 2: ROTA
**API Endpoints:**
- `GET /shifts/` - Get all shifts
- `GET /counsellors` - Get counsellors (for staff list)
- `GET /peer-supporters` - Get peers (for staff list)
- `GET /shift-swaps/` - Get all swap requests
- `GET /shift-swaps/needs-approval` - Get pending swaps
- `POST /shift-swaps/{id}/approve` - Approve/reject swap

**Features:**
- Today's shifts display with staff cards (avatar initials, name, role, time)
- Tomorrow's shifts display
- 7-day week view with shift pills showing initials
- Coverage stats: counsellors today, peers today, total shifts this week, coverage gaps warning
- Swap requests panel with pending/all tabs
- Swap cards showing requester, date, time, responder, reason
- Approve/Reject swap buttons

**NOTE:** Legacy does NOT have "Add Shift" button - only displays existing shifts

---

## TAB 3: CMS
**API Endpoints:**
- `GET /cms/pages` - List all pages
- `GET /cms/pages/all` - List all pages with details
- `GET /cms/pages/{slug}` - Get specific page content
- `PUT /cms/sections/{id}` - Update section
- `PUT /cms/cards/{id}` - Update card
- `POST /cms/seed-public` - Seed default CMS content
- `DELETE /cms/cards/{id}` - Delete card

**Features:**
- Visual editor toggle vs List view
- Live preview in iframe
- Page selector dropdown
- Edit cards inline with modal (title, description, icon, image_url, color, route)
- Load defaults button
- Save changes button
- Unsaved changes indicator

---

## TAB 4: AI PERSONAS
**API Endpoints:**
- `GET /ai-characters/admin/all` - Get all AI characters
- `PUT /ai-characters/admin/{id}` - Update character (full edit)
- `PATCH /ai-characters/admin/{id}/status` - Toggle enabled/disabled
- `POST /ai-characters/seed-from-hardcoded` - Import default personas

**Features:**
- Grid display of AI characters
- Avatar images (relative paths like `/images/tommy.png` - needs API_URL prepended)
- Enable/Disable toggle switch per character
- Edit button opens modal with fields:
  - Name, Description, Personality, Background
  - Greeting message, Voice style
  - Is enabled checkbox, Order number
- Reorder drag handle
- Import defaults button

**Avatar URL Resolution:** `CONFIG.API_URL + avatar_path`

---

## TAB 5: BETA TESTING
**API Endpoints:**
- `GET /surveys/beta-enabled` - Check if beta is enabled {beta_enabled: bool}
- `POST /surveys/beta-enabled` - Toggle beta mode {enabled: bool}
- `GET /surveys/stats` - Get survey statistics
- `GET /surveys/responses?limit=50` - Get survey responses
- `GET /surveys/export` - Export CSV (direct download link)

**Features:**
- Beta enabled toggle switch (checkbox with toggleBetaMode function)
- Stats cards: pre-surveys count, post-surveys count, completion rate %, NPS score
- Improvement metrics with color coding:
  - Wellbeing change (green if positive)
  - Anxiety change (green if negative - lower is better)
  - Mood change
- Recent survey responses list showing:
  - Survey type (pre/post)
  - Date
  - Wellbeing score /10, Anxiety /3, Mood /3
  - Post-survey: App helped /5, Would recommend /10
  - User comments (hopes, improvements)
- Export CSV button

---

## TAB 6: COMPLIANCE
**API Endpoints:**
- `GET /compliance/dashboard` - Main dashboard data
- `GET /compliance/incidents?status=detected&status=investigating&status=contained` - Security incidents
- `GET /compliance/complaints?status=received&status=under_review&status=investigating` - Complaints
- `GET /compliance/audit-logs?limit=50` - Audit logs
- `POST /compliance/incidents` - Report new incident
- `POST /compliance/security/automated-review` - Run security review
- `POST /compliance/data-retention/run-cleanup` - Data cleanup

**Dashboard Data Structure:**
```
{
  gdpr: { consent_rate, data_exports_this_month, account_deletions_this_month, users_with_ai_consent, total_users },
  complaints: { open_complaints },
  staff_wellbeing: { checkins_this_week, staff_needing_support, pending_supervision_requests },
  security: { last_review_status, open_incidents },
  audit: { entries_this_week }
}
```

**Features:**
- GDPR section: consent rate %, exports, deletions, AI consent ratio
- Complaints count with list
- Staff wellbeing: checkins, support needed, supervision requests
- Security status badge, incidents list with severity badges
- Audit log count with view button
- Report incident modal (type, severity, title, description, affected systems)
- Run security review button
- Data retention cleanup button
- Download compliance documents (ROPA, BACP, GDPR Audit, Incident Response, etc.)

---

## TAB 7: LOGS & ANALYTICS
**API Endpoints:**
- `GET /call-logs?days={period}` - Call logs {total_calls, recent_logs[]}
- `GET /live-chat/rooms` - Chat rooms []
- `GET /safeguarding-alerts` - Safeguarding alerts []
- `GET /safeguarding/screening-submissions` - Screening submissions []
- `GET /callbacks` - Callback requests []
- `GET /panic-alerts` - Panic alerts []
- `GET /admin/audit-logs?limit=200` - Audit logs {logs[]}
- `GET /ai-chat/stats?days=7` - AI chat stats {total_sessions, total_messages, by_character[]}
- `GET /analytics/usage` - App usage analytics (see structure below)
- `GET /analytics/locations` - Location data with coordinates
- `GET /live-chat/rooms/{id}/messages` - Chat history

**App Usage Stats Structure:**
```
{
  currently_connected,
  '7_days': { unique_visitors },
  '30_days': { unique_visitors },
  '6_months': { unique_visitors },
  '12_months': { unique_visitors },
  regions: { england, scotland, wales, northern_ireland, other },
  daily_trend: [{ _id: 'YYYY-MM-DD', unique_visitors }],
  devices: { desktop, mobile, tablet },
  browsers: { chrome, safari, firefox, edge, other },
  operating_systems: { windows, apple, android, linux, other },
  return_rate: { percentage, returning_visitors, total_visitors },
  feature_usage: [{ page, visits }]
}
```

**Features:**
- Summary stat cards: Total Calls, Live Chats, Escalations, Panic Alerts, AI Chat Sessions, AI Messages
- Period selector dropdown (7/30/90 days)
- App Usage Analytics section:
  - Connected Now (green highlight), Last 7/30 days, 6/12 months
  - Visitors by Region with flag icons
  - Daily Trend (last 7 days)
  - Device Type with icons (mobile/desktop/tablet)
  - Browser with brand icons
  - Operating System with brand icons
  - Return Rate percentage with detail
  - Popular Features grid
- Location Map (Leaflet.js) with:
  - Blue markers for recent locations
  - Green markers for currently active users
  - Country breakdown
  - City breakdown
  - UK region breakdown
- Sub-tabs: Calls, Chats, Safeguarding, Screening, Callbacks, Panic, Audit
- Each sub-tab has table with relevant columns
- View chat history modal
- View safeguarding alert detail modal
- Acknowledge/Resolve safeguarding actions
- Activity trend line chart (Chart.js)
- Contact type doughnut chart
- Export CSV button
- Clear logs functionality

---

## TAB 8: MONITORING
**API Endpoints:**
- `GET /admin/system-stats` - System statistics

**Stats Structure:**
```
{
  users: { total_registered, connected_staff },
  activity: { active_calls, active_ai_sessions_24h, active_live_chats, pending_callbacks },
  server: { cpu_percent, memory_percent },
  capacity: { current_load_percent }
}
```

**Features:**
- User stats: total registered, connected staff
- Activity stats: active calls, AI sessions (24h), live chats, pending callbacks
- Server health progress bars: CPU %, Memory %, Load %
- Color coding: green < 60%, yellow 60-80%, red > 80%
- Auto-refresh every 30 seconds when tab is active
- Manual refresh button
- Last updated timestamp

---

## TAB 9: GOVERNANCE
**API Endpoints:**
- `GET /governance/hazards` - Clinical hazards []
- `GET /governance/summary-report?period={7d|30d|weekly|monthly}` - Summary report
- `GET /governance/kpis` - KPI data
- `POST /governance/hazards` - Create hazard
- `PUT /governance/hazards/{id}` - Update hazard
- `PATCH /governance/hazards/{id}/status` - Update hazard status

**Sub-tabs:** Hazards, KPIs, Incidents, Moderation, Approvals, Compliance, Reports

**Summary Report Structure:**
```
{
  period, period_start, period_end, period_days, generated_at,
  safeguarding: { total_alerts, imminent_risk, high_risk, panic_alerts },
  kpis: { avg_response_time_high, avg_response_time_imminent, high_risk_sla_compliance },
  engagement: { ai_chat_sessions, live_chats, callbacks_requested, callback_completion_rate },
  recommendations: []
}
```

**Features:**
- Hazard log with risk matrix visualization
- Add hazard modal (title, description, risk level, category, mitigation)
- KPI dashboard with SLA metrics
- Weekly/monthly summary report generation
- Report display with safeguarding, KPIs, engagement sections
- Recommendations list
- Export functionality

---

## TAB 10: EVENTS
**API Endpoints:**
- `GET /events/admin/all?include_past={bool}` - Get all events []
- `GET /events/{id}` - Get single event
- `POST /events/admin/create` - Create event
- `PUT /events/admin/{id}` - Update event
- `DELETE /events/admin/{id}` - Cancel event
- `GET /events/admin/{id}/attendance` - View attendance

**Event Data Structure:**
```
{
  id, title, description, event_date, duration_minutes,
  host_name, max_participants, recurring, waiting_room_enabled,
  requires_moderation, status, participant_count
}
```

**Features:**
- Upcoming events list with cards showing:
  - Title, date/time, host, participants count
  - Status badges (scheduled/live/cancelled)
  - Join link for live events
- Past events toggle (show/hide)
- Create new event modal with fields:
  - Title, Description, Date/Time, Duration
  - Host name, Max participants, Recurring option
  - Waiting room enabled checkbox
- Edit event button
- Cancel event button with confirmation
- View attendance modal showing join/leave log

---

## TAB 11: AI LEARNING
**API Endpoints:**
- `GET /learning/stats` - Statistics {patterns: {active}, learnings: {pending, approved}, feedback: {pending}}
- `GET /learning/patterns?is_active=true&category={cat}&severity={sev}` - Safety patterns {patterns[]}
- `POST /learning/patterns?admin_id={id}` - Create pattern
- `PUT /learning/patterns/{id}` - Update pattern
- `DELETE /learning/patterns/{id}` - Delete pattern
- `POST /learning/patterns/seed-defaults?admin_id={id}` - Seed default patterns
- `GET /learning/queue?status=pending` - Approval queue {learnings[]}
- `PUT /learning/approve/{id}?admin_id={id}` - Approve/reject learning
- `GET /learning/approved?category={cat}` - Approved learnings {learnings[]}
- `GET /learning/feedback?status=pending&feedback_type={type}` - Response feedback {feedback[]}
- `PUT /learning/feedback/{id}` - Update feedback status

**Sub-tabs:** Patterns, Queue, Approved, Feedback

**Features:**
- Stats cards: Active Patterns, Pending Queue (with badge), Approved, Pending Feedback (with badge)
- Safety Patterns section:
  - Filter by category, severity
  - Pattern cards with severity color badge
  - Edit/Delete buttons
  - Add Pattern modal (pattern text, type, category, severity, response action, description)
  - Seed Defaults button
- Approval Queue:
  - Cards showing category, submitter, context, AI response pattern, notes
  - Approve/Reject buttons with optional notes prompt
- Approved Learnings:
  - Filter by category
  - Cards showing category, outcome badge, context, response
- Response Feedback:
  - Filter by feedback type
  - Cards showing type badge, user message, AI response
  - Review actions

---

## TAB 12: AI USAGE
**API Endpoints:**
- `GET /admin/ai-usage/summary?days={days}` - Usage summary
- `GET /admin/ai-usage/by-character?days={days}` - Usage by character {by_character[]}
- `GET /admin/ai-usage/daily?days={days}` - Daily usage {daily_usage[]}

**Summary Structure:**
```
{
  total_cost_gbp, total_requests, total_tokens,
  providers: {
    openai: { cost_gbp, request_count, total_tokens, budget_limit_gbp, budget_remaining_gbp, budget_percentage_used },
    gemini: { cost_gbp, request_count, total_tokens, budget_limit_gbp, budget_remaining_gbp, budget_percentage_used }
  }
}
```

**Features:**
- Period selector (7/30/90 days)
- Total stats: cost, requests, tokens
- OpenAI card: cost, requests, tokens, budget bar with percentage
- Gemini card: cost, requests, tokens, budget bar with percentage
- Budget bars change color based on usage (green < 50%, yellow 50-80%, red > 80%)
- Character usage list showing name, requests, tokens, cost
- Daily usage stacked bar chart (Chart.js) - OpenAI green, Gemini blue

---

## TAB 13: TIME TRACKING
**Status:** Placeholder - No API calls implemented in legacy

---

## TAB 14: MIGRATION
**API Endpoints:**
- `GET /admin/migration-status` - Migration status {unified_staff_count, ...}

**Features:**
- Display unified staff count
- Migration status indicators

---

## TAB 15: SETTINGS
**Status:** Placeholder - No API calls implemented in legacy

---

## GLOBAL FEATURES

### Authentication
- Login: `POST /auth/login` → {token, user}
- Logout: Clear localStorage
- Session timeout: 2 hours inactivity, 24 hour absolute
- Activity tracking resets timeout on mouse/key/scroll events

### Alert Counter
- `GET /safeguarding-alerts?status=pending` - Polls every 30 seconds
- Badge shows count on Logs tab

### Notifications
- Toast notifications (success/error/warning/info)
- Auto-dismiss after 3 seconds

### Modals
- Generic modal system with overlay
- Close on X button or clicking overlay

### Data Export
- CSV export for logs
- PDF download for compliance documents

---

## DATA TYPE ENFORCEMENT (CRITICAL)

* All numeric values MUST remain numeric across the system
* DO NOT convert numbers to strings
* DO NOT return formatted numbers from the backend
* Formatting (e.g. toFixed) must ONLY happen in the frontend
* If a value is numeric in the original system, it MUST remain numeric

If a type cannot be guaranteed:
→ STOP and highlight the mismatch
DO NOT guess or coerce silently

---

## CRITICAL NOTES FOR REACT MIGRATION

1. **Avatar URLs**: AI character avatars use relative paths. Must prepend `API_URL` to get full URL.

2. **Auth Header**: All API calls need `Authorization: Bearer {token}` header.

3. **Error Handling**: 401 responses should trigger logout and show "Session expired" message.

4. **Data Structures**: API responses have specific structures - don't assume different formats.

5. **Chart.js**: Used for activity trend (line), contact type (doughnut), daily usage (stacked bar).

6. **Leaflet.js**: Used for location map with circle markers.

7. **No Add Shift**: Legacy Rota tab does NOT have ability to add shifts - only view and approve swaps.

8. **Sub-tabs**: Logs, Governance, and AI Learning tabs have internal sub-tab navigation.

9. **Polling**: Alert counter polls every 30 seconds, Monitoring auto-refreshes every 30 seconds.

10. **Toggle Functions**: Beta testing and AI character enable/disable use different endpoints (POST vs PATCH).
