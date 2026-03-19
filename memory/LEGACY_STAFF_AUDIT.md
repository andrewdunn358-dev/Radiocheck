# LEGACY STAFF PORTAL COMPLETE AUDIT
## Source: /app/staff-portal/app.js (3395 lines)
## Created: March 2026
## Purpose: Reference document for React portal migration - DO NOT MODIFY ENDPOINTS

---

## OVERVIEW

The Staff Portal is used by **Counsellors**, **Peer Supporters**, **Supervisors**, and **Admins** to:
- Manage their availability status
- Handle callback requests
- Monitor and respond to panic/safeguarding alerts
- Participate in live chats with users
- Manage cases and clinical notes
- Schedule shifts via calendar
- Supervisors: manage team, escalations, and supervision notes

---

## AUTHENTICATION & SESSION MANAGEMENT

**API Endpoints:**
- `POST /auth/login` - Staff login (email, password)

**Features:**
- Token stored in `localStorage` as `staff_token`
- User object stored as `staff_user`
- Session timeout: 2 hours of inactivity
- Absolute token expiry: 24 hours
- Activity tracking on mouse/key/scroll/touch events
- Auto-logout with warning notification
- Role-based access control (`counsellor`, `peer`, `supervisor`, `admin`)

**localStorage Keys:**
- `staff_token` - JWT token
- `staff_user` - JSON user object
- `staff_token_time` - Token creation timestamp
- `staff_last_activity` - Last activity timestamp
- `alert_sound` - Sound preference (true/false)

---

## ROLE-BASED UI VISIBILITY

| Section | counsellor | peer | supervisor | admin |
|---------|------------|------|------------|-------|
| Panic Alerts (view) | YES | NO | YES | YES |
| Panic Button (trigger) | NO | YES | NO | NO |
| Safeguarding Alerts | YES | YES | YES | YES |
| Live Chats | YES | YES | YES | YES |
| Supervisor Tab | NO | NO | YES | YES |
| Escalate Section | YES | YES | NO | NO |

---

## MY STATUS (Header Section)

**API Endpoints:**
- `GET /counsellors` - Get all counsellors (to find current user's profile)
- `GET /peer-supporters` - Get all peers (to find current user's profile)
- `PATCH /counsellors/{id}/status` - Update counsellor status
- `PATCH /peer-supporters/{id}/status` - Update peer status

**Status Values:**
- `available` - Green, displayed as "Available"
- `limited` - Yellow, displayed as "Busy"
- `unavailable` - Red, displayed as "Off Duty"

**Features:**
- Three status buttons: Available (green), Busy (yellow), Off Duty (red)
- Current status badge with color-coded background
- Status synced with Socket.IO for real-time chat availability
- Profile lookup: Find user's profile by matching `user_id` in profiles list

**Critical Implementation:**
```javascript
// Profile loading - MUST match user_id
if (role === 'counsellor') {
    profiles = await apiCall('/counsellors');
    myProfile = profiles.find(p => p.user_id === currentUser.id);
} else if (role === 'peer') {
    profiles = await apiCall('/peer-supporters');
    myProfile = profiles.find(p => p.user_id === currentUser.id);
}
```

---

## CALLBACKS SECTION

**API Endpoints:**
- `GET /callbacks` - Get all callbacks
- `PATCH /callbacks/{id}/take` - Assign callback to self
- `PATCH /callbacks/{id}/complete` - Mark callback complete
- `PATCH /callbacks/{id}/release` - Release callback back to pending

**Features:**
- Two tabs: "Active Callbacks" and "Pending Callbacks"
- Badge counts for each tab
- Filter by request_type based on user role:
  - Peers see only `request_type === 'peer'`
  - Counsellors see only `request_type === 'counsellor'`
- Card display showing:
  - Name, status badge, phone number
  - Message content
  - Created timestamp
  - Actions: Take/Complete/Release/Call Now

**Active Callbacks Actions:**
- "Call Now" button (Twilio integration)
- "Complete" button
- "Release" button

**Pending Callbacks Actions:**
- "Take Callback" button

---

## PANIC ALERTS (Counsellors/Supervisors/Admins Only)

**API Endpoints:**
- `GET /panic-alerts` - Get all panic alerts
- `PATCH /panic-alerts/{id}/acknowledge` - Acknowledge alert
- `PATCH /panic-alerts/{id}/resolve` - Resolve alert
- `POST /panic-alert` - Trigger panic (peers only)

**Features:**
- Displays active and acknowledged alerts
- Badge count in section header
- Card showing:
  - User name, status badge
  - Phone number (if available)
  - Message
  - Created timestamp
- Actions: Call Now, Acknowledge, Resolve

**Peers Panic Button:**
- Large red button to trigger panic
- Prompts for optional message
- Sends: user_name, user_phone (from profile), message

---

## SAFEGUARDING ALERTS SECTION

**API Endpoints:**
- `GET /safeguarding-alerts` - Get all alerts
- `PATCH /safeguarding-alerts/{id}/acknowledge` - Acknowledge
- `PATCH /safeguarding-alerts/{id}/resolve?notes={notes}` - Resolve with optional notes

**Features:**
- Real-time polling every 30 seconds
- Sound alerts for new alerts (Web Audio API - 3 ascending beeps)
- New alert banner notification (auto-dismiss after 10 seconds)
- Pulsing effect on section when active alerts exist
- Sound toggle button in header

**Card Display:**
- AI Character icon (Tommy/Rachel)
- Risk level badge (RED/AMBER/YELLOW) with score
- Contact captured status (green check or warning)
- Session ID
- Triggered indicators list
- Triggering message quote
- Tracking info section:
  - Location (city, region, country)
  - ISP
  - Timezone
  - IP Address
  - User Agent/Device
  - **Map** (Leaflet.js with coordinates)
- Collapsible conversation history (last 6 messages)
- Timestamp, acknowledged by

**Actions:**
- Acknowledge (for active alerts)
- Resolve (prompts for notes)
- Create Case

**Create Case from Alert Modal:**
- User name input (optional)
- Initial notes textarea (pre-filled with alert info)
- Creates case via `POST /cases`

---

## LIVE CHAT SECTION

**API Endpoints:**
- `GET /live-chat/rooms` - Get all active chat rooms
- `POST /live-chat/rooms/{id}/join` - Join a chat (assigns staff)
- `GET /live-chat/rooms/{id}/messages` - Get chat messages
- `POST /live-chat/rooms/{id}/messages` - Send message
- `POST /live-chat/rooms/{id}/end` - End the chat

**Features:**
- Real-time polling every 10 seconds
- Sound alerts for new chats
- New chat banner notification (auto-dismiss after 15 seconds)
- Pulsing effect when waiting chats exist

**Chat List Card Display:**
- Staff type badge (Counsellor/Peer Request)
- Waiting time
- Message count
- Safeguarding alert link indicator (if linked)
- Latest message preview
- Start timestamp
- "Join Chat" button

**Live Chat Modal:**
- Full-screen modal with dark theme
- Message bubbles (staff = gray, user = blue)
- Message input with Enter key support
- Socket.IO real-time message delivery
- "Call" button to call user
- "End Chat" button (with confirmation)

**Socket.IO Events:**
- `chat_message` - Send message
- `leave_chat_room` - Leave room (resets status)
- `force_available` - Force reset status after chat

---

## NOTES SECTION

**API Endpoints:**
- `GET /notes?include_shared=true` - Get all notes
- `GET /notes/{id}` - Get single note
- `POST /notes` - Create note
- `PUT /notes/{id}` - Update note
- `DELETE /notes/{id}` - Delete note
- `GET /staff-users` - Get staff list for sharing

**Features:**
- Two tabs: "My Notes" and "Shared with Me"
- Badge counts for each tab
- Color-coded note cards (yellow, blue, green, pink, purple)

**Note Card Display:**
- Title, content preview
- Color indicator
- Callback link (if linked)
- "Private" or "Shared with X" badge
- Created timestamp
- Edit/Delete buttons

**Add/Edit Note Modal:**
- Title input
- Content textarea
- Color picker (5 options)
- Link to callback dropdown
- Share toggle with staff multi-select
- Save/Cancel buttons

---

## SHIFT CALENDAR SECTION

**API Endpoints:**
- `GET /shifts?date_from={from}&date_to={to}` - Get shifts for date range
- `POST /shifts/?user_id={id}&user_name={name}&user_email={email}` - Create shift
- `DELETE /shifts/{id}` - Delete shift

**Features:**
- Full month calendar view
- Navigation arrows (prev/next month)
- Month/Year title
- Day cells show:
  - Date number
  - Shift indicator dots (blue for shifts)
  - Clickable to show day details

**Selected Day Panel:**
- Shows all shifts for selected date
- Each shift shows:
  - Name (with initials avatar)
  - Time range (start - end)
  - Delete button (for own shifts only)
- "Add Your Availability" button

**Add Shift Modal:**
- Date picker (defaults to selected date or today)
- Start time input
- End time input
- Save/Cancel buttons

---

## TEAM ON DUTY SECTION (Sidebar)

**API Endpoints:**
- `GET /shifts` - Get shifts
- `GET /counsellors` - Get counsellors
- `GET /peer-supporters` - Get peers

**Features:**
- Two tabs: "Today" and "Tomorrow"
- Shows staff on duty for selected day
- Each member shows:
  - Avatar with initials
  - Name (with "(You)" if current user)
  - Role (Counsellor/Peer Supporter)
  - Shift time range
- Empty state when no shifts scheduled

---

## CASES SECTION (Tab)

**API Endpoints:**
- `GET /cases?status={status}&risk_level={level}` - Get cases
- `GET /cases/{id}` - Get single case
- `POST /cases` - Create case
- `GET /cases/morning-queue` - Get morning review queue
- `POST /cases/{id}/sessions` - Add session note
- `PUT /cases/{id}/safety-plan` - Update safety plan
- `POST /cases/{id}/referrals` - Create referral
- `POST /cases/{id}/share` - Share case with counsellor
- `GET /users/staff` - Get staff list for escalation

**Features:**
- Filter by status and risk level
- Cases badge count (active cases)
- Morning review queue section (overnight alerts)

**Case Card Display:**
- User name
- Session count
- Status tag, risk level tag
- Safety plan indicator (if exists)
- Last session preview
- Actions: View, Add Note, Escalate

**Case Detail Modal:**
- Case header with user name
- Status, risk level, session count badges
- Safety plan section (if exists)
- Session history list
- Actions based on role:
  - All: Add Session Note, Edit/Create Safety Plan
  - Peers: Escalate to Counsellor button
  - Counsellors+: Create Referral button

**Add Session Note Modal:**
- Presenting issue textarea
- Risk level dropdown (low/moderate/high/critical)
- Outcome dropdown (continue_monitoring/escalate_to_nhs/refer_to_service/close_case)
- Next steps textarea

**Safety Plan Modal:**
- Warning signs (one per line)
- Coping strategies (one per line)
- Reasons for living (one per line)

**Create Referral Modal:**
- Service type dropdown
- Service name input
- Urgency dropdown (routine/urgent/emergency)
- Notes textarea

**Escalate to Counsellor Modal (Peers):**
- Counsellor dropdown (loads from /users/staff)
- Reason dropdown (high_risk/complex_needs/safeguarding/session_limit/other)
- Additional notes textarea

---

## AI LEARNING FEEDBACK SECTION

**API Endpoints:**
- `POST /learning/feedback?staff_id={id}` - Submit AI response feedback
- `POST /learning/submit` - Submit conversation for learning

**Features:**
- Feedback modal for reviewing AI responses
- Feedback types: good, needs_improvement, inappropriate, missed_risk
- Staff notes and suggested response fields

**Learning Submission Modal:**
- Category dropdown (grief, anxiety, loneliness, crisis_deescalation, ptsd, relationship, transition, substance)
- Context summary (anonymized)
- Effective response pattern
- Outcome dropdown (positive/neutral/escalated)
- Additional notes

---

## SUPERVISOR TAB (Supervisors/Admins Only)

### Team Members Section

**API Endpoints:**
- `GET /supervision/team` - Get team members

**Features:**
- List of team members with:
  - Name, role, status badge
  - Specialization/area
  - "Add Note" button
  - "View History" button

### Escalations Section

**API Endpoints:**
- `GET /escalations?status={status}` - Get escalations
- `PATCH /escalations/{id}/acknowledge` - Acknowledge
- `PATCH /escalations/{id}/resolve?resolution_notes={notes}` - Resolve

**Features:**
- Filter tabs: Pending, Acknowledged, Resolved, All
- Badge count for pending
- Escalation card shows:
  - Subject, priority badge (urgent/high/normal)
  - From staff (name, role)
  - Status badge
  - Description
  - Timestamp
  - Handled by (if acknowledged)
  - Resolution notes (if resolved)
- Actions: Acknowledge, Resolve (with notes prompt)

### Supervision Notes Section

**API Endpoints:**
- `GET /supervision/notes?staff_id={id}` - Get supervision notes
- `POST /supervision/notes` - Create note

**Features:**
- List of supervision notes
- Confidential HR notes marked
- Card shows:
  - Staff name, role
  - Session date
  - Wellbeing notes
  - Case notes
  - Action items list
  - Next session date
  - Edit button

**Add Supervision Note Modal:**
- Staff dropdown
- Wellbeing notes textarea
- Case review notes textarea
- Action items (one per line)
- Next session date picker
- Confidential (HR only) checkbox

---

## ESCALATION MODAL (Counsellors/Peers)

**API Endpoints:**
- `POST /escalations` - Create escalation

**Modal Fields:**
- Subject input
- Description textarea
- Priority dropdown (normal/high/urgent)
- Linked case dropdown (optional)

---

## WEBRTC & TWILIO PHONE INTEGRATION

**Features:**
- WebRTC phone initialization on portal load
- Socket.IO connection for signaling
- Status sync between database and Socket.IO
- Twilio browser-to-phone calling
- "Call Now" buttons throughout app

**Phone Status UI:**
- Shows: Online, Offline, Connecting..., Phone N/A, No Ext, Phone Error

**Twilio Call Function:**
```javascript
twilioCallUser(phone, name, callbackId)
```

---

## SOUND ALERTS

**Features:**
- Web Audio API for reliable playback
- Three ascending beeps (800Hz, 1000Hz, 1200Hz)
- Toggle button in header
- Sound preference stored in localStorage

---

## POLLING INTERVALS

| Feature | Interval | Notes |
|---------|----------|-------|
| Callbacks/Notes | 30 seconds | Auto-refresh |
| Panic Alerts | 30 seconds | Auto-refresh |
| Safeguarding Alerts | 30 seconds | With sound |
| Live Chats | 10 seconds | With sound |
| Chat Messages | 3 seconds | Fallback when no socket |
| Supervisor Data | 30 seconds | Team, escalations |

---

## UI COMPONENTS

### Notification Toast
- Types: success, error, warning, info
- Auto-dismiss after 3 seconds

### Generic Modal System
- Stacking support (sub-modals)
- "Back to Case" navigation
- Close on X button

### New Alert Banner
- Fixed position banner for new safeguarding alerts
- "View" button scrolls to section
- Auto-dismiss after 10 seconds

### New Live Chat Banner
- Fixed position banner for new chats
- "View" button scrolls to section
- Auto-dismiss after 15 seconds

---

## DATA-TESTID ATTRIBUTES (for automated testing)

- `callback-card-{id}` - Callback cards
- `call-btn-{id}` - Call buttons
- `alert-card-{id}` - Alert cards
- `call-alert-{id}` - Alert call buttons

---

## CRITICAL NOTES FOR REACT MIGRATION

1. **Profile Loading**: MUST find profile by matching `user_id` to `currentUser.id`. Do NOT show wrong profile.

2. **Status Sync**: When updating status, MUST also update Socket.IO status via `window.webRTCPhone.updateStatus(status)`.

3. **Sound Alerts**: Use Web Audio API for reliable cross-browser playback. Three beeps at 800Hz, 1000Hz, 1200Hz.

4. **Leaflet Maps**: Safeguarding alerts with coordinates show location map. Use OpenStreetMap tiles.

5. **Socket.IO Chat**: Real-time chat messages via Socket.IO. Fallback to polling if socket unavailable.

6. **Role-Based Visibility**: Many sections hidden/shown based on user role. Check carefully.

7. **Session Timeout**: 2-hour inactivity timeout, 24-hour absolute token expiry. Track activity events.

8. **Escalation Flow**: Peers escalate to counsellors, counsellors escalate via escalation modal to supervisors.

9. **Case Management**: Cases have sessions, safety plans, and referrals. Session limit is 6.

10. **Modal Stacking**: Sub-modals (Add Session, Safety Plan, Referral) stack on Case Detail modal.

---

## COMPLETE API ENDPOINT LIST

### Authentication
- `POST /auth/login`

### Profile
- `GET /counsellors`
- `GET /peer-supporters`
- `PATCH /counsellors/{id}/status`
- `PATCH /peer-supporters/{id}/status`

### Callbacks
- `GET /callbacks`
- `PATCH /callbacks/{id}/take`
- `PATCH /callbacks/{id}/complete`
- `PATCH /callbacks/{id}/release`

### Panic Alerts
- `GET /panic-alerts`
- `POST /panic-alert`
- `PATCH /panic-alerts/{id}/acknowledge`
- `PATCH /panic-alerts/{id}/resolve`

### Safeguarding Alerts
- `GET /safeguarding-alerts`
- `PATCH /safeguarding-alerts/{id}/acknowledge`
- `PATCH /safeguarding-alerts/{id}/resolve`

### Live Chat
- `GET /live-chat/rooms`
- `POST /live-chat/rooms/{id}/join`
- `GET /live-chat/rooms/{id}/messages`
- `POST /live-chat/rooms/{id}/messages`
- `POST /live-chat/rooms/{id}/end`

### Notes
- `GET /notes?include_shared=true`
- `GET /notes/{id}`
- `POST /notes`
- `PUT /notes/{id}`
- `DELETE /notes/{id}`
- `GET /staff-users`

### Shifts
- `GET /shifts?date_from={}&date_to={}`
- `POST /shifts/?user_id={}&user_name={}&user_email={}`
- `DELETE /shifts/{id}`

### Cases
- `GET /cases`
- `GET /cases/{id}`
- `POST /cases`
- `GET /cases/morning-queue`
- `POST /cases/{id}/sessions`
- `PUT /cases/{id}/safety-plan`
- `POST /cases/{id}/referrals`
- `POST /cases/{id}/share`
- `GET /users/staff`

### AI Learning
- `POST /learning/feedback?staff_id={}`
- `POST /learning/submit`

### Supervisor
- `GET /supervision/team`
- `GET /supervision/notes`
- `POST /supervision/notes`
- `GET /escalations`
- `POST /escalations`
- `PATCH /escalations/{id}/acknowledge`
- `PATCH /escalations/{id}/resolve`

---

## TABS/SECTIONS IN ORDER

1. **Header** - Status buttons, user info, phone status, sound toggle
2. **Callbacks** - Active + Pending callbacks
3. **Panic Alerts** - For counsellors/supervisors (or Panic Button for peers)
4. **Safeguarding Alerts** - AI-triggered alerts
5. **Live Chats** - Active chat requests
6. **Notes** - Personal and shared notes
7. **Shift Calendar** - Monthly calendar view
8. **Team On Duty** - Sidebar showing today/tomorrow staff
9. **Cases** - Case management (via tab)
10. **Supervisor** - Team, Escalations, Supervision Notes (via tab)
