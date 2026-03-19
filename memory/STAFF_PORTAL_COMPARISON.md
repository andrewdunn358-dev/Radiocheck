# STAFF PORTAL COMPARISON: Legacy vs React
## Updated: March 2026
## Purpose: Track migration progress and identify discrepancies

---

## COMPREHENSIVE AUDIT COMPLETE - March 2026

### Source Files Audited
- **Legacy**: `/app/staff-portal/app.js` (3395 lines)
- **React**: `/app/portal/src/app/staff/page.tsx` (1774 lines)

---

## Status Legend:
- ✅ DONE - Fully implemented and matches legacy
- ⚠️ PARTIAL - Implemented but missing features
- ❌ MISSING - Not implemented at all
- 🔧 BROKEN - Implemented but not working

---

## AUTHENTICATION & SESSION

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Login form | POST /auth/login | ✅ useStaffAuth hook | ✅ DONE |
| Token storage | localStorage | ✅ localStorage | ✅ DONE |
| Role-based access | counsellor/peer/supervisor/admin | ✅ Has role check | ✅ DONE |
| **Session timeout (2hr)** | Activity tracking + auto-logout | ❌ Not implemented | ❌ MISSING |
| **Absolute token expiry (24hr)** | Token time check | ❌ Not implemented | ❌ MISSING |
| **Activity listeners** | Mouse/key/scroll/touch events | ❌ Not implemented | ❌ MISSING |
| **Auto-logout warning** | Notification before logout | ❌ Not implemented | ❌ MISSING |

**Critical Missing**: Session timeout is a security requirement.

---

## MY STATUS (Header/Sidebar)

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Status buttons | 3 buttons (Available/Busy/Off) | ✅ 3 buttons in sidebar | ✅ DONE |
| Current status display | Color-coded badge | ✅ Button highlights | ✅ DONE |
| PATCH counsellor status | /counsellors/{id}/status | ✅ Via updateStatus | ✅ DONE |
| PATCH peer status | /peer-supporters/{id}/status | ✅ Via updateStatus | ✅ DONE |
| Profile lookup by user_id | Find in profiles list | ✅ useStaffAuth handles | ✅ DONE |
| Socket.IO status sync | webRTCPhone.updateStatus | ⚠️ Via WebRTC hook | ⚠️ PARTIAL |
| "No profile" warning | N/A | ✅ Warning banner | ✅ DONE |

---

## CALLBACKS SECTION

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /callbacks | ✅ | ✅ staffApi.getCallbacks | ✅ DONE |
| **Active/Pending tabs** | Separate lists with badge counts | ❌ Single list | ❌ MISSING |
| Take callback | PATCH /callbacks/{id}/take | ✅ handleTakeCallback | ✅ DONE |
| Complete callback | PATCH /callbacks/{id}/complete | ✅ handleCompleteCallback | ✅ DONE |
| **Release callback** | PATCH /callbacks/{id}/release | ❌ Not found | ❌ MISSING |
| **Filter by request_type** | peer/counsellor based on role | ❌ Not filtering | ❌ MISSING |
| **"Call Now" button** | Twilio integration | ❌ Not found | ❌ MISSING |
| Card: phone, message, timestamp | Full details | ⚠️ Has phone, reason | ⚠️ PARTIAL |

**Critical Missing**:
- Active/Pending tabs with badge counts
- Release callback button
- Call Now button (Twilio)
- Filter by request_type based on role (peers see peer callbacks, counsellors see counsellor callbacks)

---

## PANIC ALERTS

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /panic-alerts | ✅ | ✅ staffApi.getPanicAlerts | ✅ DONE |
| **Role-based visibility** | Only counsellor/supervisor/admin see alerts | ⚠️ All roles see | ⚠️ PARTIAL |
| **Acknowledge alert** | PATCH /panic-alerts/{id}/acknowledge | ❌ Not found | ❌ MISSING |
| **Resolve alert** | PATCH /panic-alerts/{id}/resolve | ❌ Not found | ❌ MISSING |
| **"Call Now" button** | For alerts with phone | ❌ Not found | ❌ MISSING |
| Badge count | In section header | ⚠️ Combined with safeguarding | ⚠️ PARTIAL |
| **Trigger panic button (peers)** | POST /panic-alert | ❌ Not implemented | ❌ MISSING |

**Critical Missing**:
- Panic alert acknowledge/resolve actions
- Panic trigger button for peers (big red button)
- Call Now button
- Role-based visibility (peers should NOT see panic alerts - they TRIGGER them)

---

## SAFEGUARDING ALERTS

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /safeguarding-alerts | ✅ | ✅ staffApi.getSafeguardingAlerts | ✅ DONE |
| Filter active/acknowledged | ✅ | ⚠️ Shows all | ⚠️ PARTIAL |
| Acknowledge action | PATCH /safeguarding-alerts/{id}/acknowledge | ✅ handleAcknowledgeSafeguarding | ✅ DONE |
| Resolve action | PATCH /safeguarding-alerts/{id}/resolve | ✅ handleResolveSafeguarding | ✅ DONE |
| Risk badge (RED/AMBER/YELLOW) | Color-coded | ✅ getRiskBadgeColor | ✅ DONE |
| **Contact captured status** | Green check/warning indicator | ❌ Not displayed | ❌ MISSING |
| **Session ID display** | ✅ | ❌ Not displayed | ❌ MISSING |
| Triggered indicators | List of phrases | ✅ trigger_phrases/triggered_indicators | ✅ DONE |
| Triggering message | Quoted | ✅ Displayed | ✅ DONE |
| **Tracking info (IP, user agent)** | Expandable section | ❌ Not displayed | ❌ MISSING |
| **Location map (Leaflet)** | With coordinates | ❌ Not implemented | ❌ MISSING |
| **Conversation history** | Collapsible, last 6 messages | ❌ Not implemented | ❌ MISSING |
| **"Create Case" button** | Opens modal | ❌ Not implemented | ❌ MISSING |
| **Sound alert (new alerts)** | Web Audio API, 3 beeps | ❌ Not implemented | ❌ MISSING |
| **New alert banner** | Auto-dismiss notification | ❌ Not implemented | ❌ MISSING |
| Polling (30s) | With sound on new | ✅ setInterval(loadAlerts, 30000) | ⚠️ PARTIAL - no sound |

**Critical Missing**:
- Contact captured status indicator
- Session ID display
- Tracking info section (IP, location, user agent, ISP, timezone)
- Leaflet map for location (coordinates available in data)
- Conversation history preview (collapsible, last 6 messages)
- Create Case from Alert button and modal
- Sound alerts for new safeguarding alerts
- New alert notification banner

---

## LIVE CHAT

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /live-chat/rooms | ✅ | ✅ staffApi.getLiveChatRooms | ✅ DONE |
| Join chat | POST /live-chat/rooms/{id}/join | ✅ handleJoinChat | ✅ DONE |
| Get messages | GET /live-chat/rooms/{id}/messages | ✅ staffApi.getLiveChatMessages | ✅ DONE |
| Send message | POST /live-chat/rooms/{id}/messages | ✅ handleSendMessage | ✅ DONE |
| End chat | POST /live-chat/rooms/{id}/end | ✅ handleEndChat | ✅ DONE |
| **Chat modal UI** | Full-screen dark theme | ⚠️ Basic modal exists | ⚠️ PARTIAL |
| **Socket.IO real-time** | chat_message event | ❌ Not using socket for chat | ❌ MISSING |
| **Sound alert (new chats)** | Web Audio API | ❌ Not implemented | ❌ MISSING |
| **New chat banner** | Auto-dismiss notification | ❌ Not implemented | ❌ MISSING |
| **Polling (10s)** | For new chats | ❌ Uses 30s like alerts | ⚠️ PARTIAL |
| Waiting time display | getWaitingTime() | ✅ formatTimeAgo | ✅ DONE |
| **Safeguarding link indicator** | Shows if linked to alert | ❌ Not displayed | ❌ MISSING |
| **"Call from chat" button** | Twilio call | ❌ Not implemented | ❌ MISSING |
| **Force reset status after chat** | force_available event | ❌ Not implemented | ❌ MISSING |

**Critical Missing**:
- Socket.IO for real-time messages (currently REST only)
- Sound alerts for new chats
- 10-second polling (currently 30s - chats are more urgent)
- Call from chat button
- Force reset status to available after ending chat

---

## NOTES SECTION

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /notes?include_shared=true | ✅ | ✅ staffApi.getNotes | ✅ DONE |
| My Notes tab | ✅ | ✅ notesTab state | ✅ DONE |
| Shared with Me tab | ✅ | ✅ notesTab state | ✅ DONE |
| Create note | POST /notes | ✅ handleAddNote | ✅ DONE |
| Delete note | DELETE /notes/{id} | ✅ handleDeleteNote | ✅ DONE |
| **Edit note** | PUT /notes/{id} | ❌ Not implemented | ❌ MISSING |
| **Color picker (5 colors)** | Yellow/blue/green/pink/purple | ❌ Not implemented | ❌ MISSING |
| **Link to callback** | Dropdown in modal | ❌ Not implemented | ❌ MISSING |
| Share with staff | Multi-select | ⚠️ Single checkbox | ⚠️ PARTIAL |
| **GET /staff-users** | For sharing dropdown | ❌ Not called | ❌ MISSING |

**Missing Features**:
- Edit note functionality
- Color picker for notes
- Link note to callback
- Share with specific staff members (not just is_shared boolean)

---

## SHIFT CALENDAR

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /shifts (with date range) | ✅ | ✅ staffApi.getShifts | ✅ DONE |
| Month calendar view | ✅ | ✅ getDaysInMonth | ✅ DONE |
| Prev/next month navigation | ✅ | ✅ prevMonth/nextMonth | ✅ DONE |
| Day click → show shifts | ✅ | ✅ setSelectedDate | ✅ DONE |
| Shift indicator dots | Blue dots on days | ✅ Green dots | ✅ DONE |
| Add shift | POST /shifts/ (with query params) | ✅ handleAddShift | ✅ DONE |
| Delete shift | DELETE /shifts/{id} | ✅ handleDeleteShift | ✅ DONE |
| Request swap | Creates swap request | ✅ handleRequestSwap | ✅ DONE |
| **Only delete own shifts** | Check user_id | ❌ Deletes any shift | ⚠️ PARTIAL |
| Selected day panel | Shows shifts for date | ✅ Shows in list below | ✅ DONE |

**Issues**:
- Should only allow deleting own shifts (check user_id match)

---

## TEAM ON DUTY

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| **Today tab** | Filter shifts for today | ⚠️ Shows all members | ⚠️ PARTIAL |
| **Tomorrow tab** | Filter shifts for tomorrow | ❌ No tomorrow tab | ❌ MISSING |
| GET /shifts + /counsellors + /peers | Combined | ✅ staffApi.getTeamOnDuty | ⚠️ PARTIAL |
| Avatar with initials | getInitials() | ✅ Has initials | ✅ DONE |
| **Shift time display** | start_time - end_time | ❌ No time shown | ❌ MISSING |
| **"(You)" indicator** | For current user | ❌ Not implemented | ❌ MISSING |
| Call team member button | WebRTC call | ✅ webrtcPhone.makeCall | ✅ DONE |

**Missing Features**:
- Today/Tomorrow tab switcher
- Shift time display for team members
- "(You)" indicator for current user

---

## CASES SECTION

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /cases | ✅ | ✅ staffApi.getCases | ✅ DONE |
| **Filter by status** | Dropdown | ❌ No filter UI | ❌ MISSING |
| **Filter by risk_level** | Dropdown | ❌ No filter UI | ❌ MISSING |
| Case card display | With actions | ⚠️ Table format | ⚠️ DIFFERENT |
| **Morning review queue** | GET /cases/morning-queue | ❌ Not implemented | ❌ MISSING |
| **View case detail** | Modal with sessions | ❌ Just "View" link | ❌ MISSING |
| **Add session note** | POST /cases/{id}/sessions | ❌ Not implemented | ❌ MISSING |
| **Safety plan** | PUT /cases/{id}/safety-plan | ❌ Not implemented | ❌ MISSING |
| **Create referral** | POST /cases/{id}/referrals | ❌ Not implemented | ❌ MISSING |
| **Escalate to counsellor (peers)** | POST /cases/{id}/share | ❌ Not implemented | ❌ MISSING |
| **Share case** | POST /cases/{id}/share | ❌ Not implemented | ❌ MISSING |
| **Session count badge** | X/6 sessions | ❌ Not displayed | ❌ MISSING |

**Critical Missing**:
- Case detail modal (with sessions, safety plan, referrals)
- Add session note modal
- Safety plan create/edit modal
- Create referral modal
- Escalate to counsellor (peers) functionality
- Morning review queue
- Filter dropdowns (status, risk_level)
- Session count with limit (6)

---

## AI LEARNING FEEDBACK

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| **Feedback modal** | POST /learning/feedback | ❌ Not implemented | ❌ MISSING |
| **Learning submission** | POST /learning/submit | ❌ Not implemented | ❌ MISSING |
| **Category selection** | grief/anxiety/etc | ❌ Not implemented | ❌ MISSING |

**Entire feature missing in React portal.**

---

## SUPERVISOR TAB

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| **Team members list** | GET /supervision/team | ❌ Not calling this endpoint | ❌ MISSING |
| **Add supervision note** | POST /supervision/notes | ❌ Not implemented | ❌ MISSING |
| **View member notes** | GET /supervision/notes?staff_id={} | ❌ Not implemented | ❌ MISSING |
| Escalations list | GET /escalations | ✅ staffApi.getEscalations | ✅ DONE |
| Filter escalations | Pending/Acknowledged/Resolved/All | ✅ escalationsTab | ⚠️ PARTIAL - only 2 tabs |
| Acknowledge escalation | PATCH /escalations/{id}/acknowledge | ✅ handleAcknowledgeEscalation | ✅ DONE |
| Resolve escalation | PATCH /escalations/{id}/resolve | ✅ handleResolveEscalation | ✅ DONE |
| **Supervision notes CRUD** | GET/POST /supervision/notes | ❌ Not implemented | ❌ MISSING |
| **HR confidential flag** | is_confidential | ❌ Not implemented | ❌ MISSING |

**Missing Features**:
- Team members section (different from Team On Duty)
- Supervision notes CRUD
- Full escalation filter tabs (All 4: Pending/Acknowledged/Resolved/All)
- HR confidential notes

---

## ESCALATION MODAL (Counsellors/Peers)

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| **Create escalation** | POST /escalations | ❌ Not implemented | ❌ MISSING |
| **Subject/description** | ✅ | ❌ Not implemented | ❌ MISSING |
| **Priority dropdown** | normal/high/urgent | ❌ Not implemented | ❌ MISSING |
| **Link to case** | Optional | ❌ Not implemented | ❌ MISSING |

**Entire create escalation feature missing.**

---

## WEBRTC & CALLING

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| WebRTC initialization | WebRTCPhone.init() | ✅ useWebRTCPhone hook | ✅ DONE |
| Twilio phone | TwilioPhone.init() | ✅ useTwilioPhone hook | ✅ DONE |
| Incoming call UI | Full-screen modal | ✅ Incoming call modal | ✅ DONE |
| Active call UI | Fixed bottom-right | ✅ Active call overlay | ✅ DONE |
| Mute toggle | ✅ | ✅ toggleMute | ✅ DONE |
| End call | ✅ | ✅ endCall | ✅ DONE |
| Phone status display | Online/Offline/Connecting | ✅ Connection status banners | ✅ DONE |
| **Multi-session support** | N/A (legacy issue) | 🔧 BROKEN - backend issue | 🔧 BROKEN |

**Known Bug**: Backend `/app/backend/webrtc_signaling.py` doesn't support multiple sessions per user, causing call failures.

---

## SOUND ALERTS

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Sound toggle button | In header | ✅ In sidebar | ✅ DONE |
| **Sound preference storage** | localStorage | ❌ Not persisted | ⚠️ PARTIAL |
| **Web Audio API beeps** | 3 ascending beeps (800Hz, 1000Hz, 1200Hz) | ❌ No sound implementation | ❌ MISSING |
| **Play on new alerts** | Safeguarding + live chat | ❌ Not implemented | ❌ MISSING |

**Critical Missing**:
- Actual sound playback implementation
- Persist sound preference to localStorage
- Play on new safeguarding alerts
- Play on new live chats

---

## GENERAL UI

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| **Notification toast** | showNotification() | ❌ No toast system | ❌ MISSING |
| **Generic modal system** | With stacking support | ❌ No modal system | ❌ MISSING |
| **"Back to Case" navigation** | ✅ | ❌ No modal stacking | ❌ MISSING |

---

## PRIORITY FIX LIST (Ordered by Impact)

### P0 - CRITICAL (Core functionality broken/missing)
1. 🔧 **WebRTC calls not working** - Backend multi-session issue in `/app/backend/webrtc_signaling.py`
2. ❌ **Panic alerts** - No actions (acknowledge/resolve), no trigger button for peers
3. ❌ **Sound alerts** - No audible notifications for new alerts/chats
4. ❌ **Session timeout** - Security requirement not implemented

### P1 - HIGH (Major features missing)
1. ❌ **Case management** - No detail modal, no session notes, no safety plan, no referrals
2. ❌ **Safeguarding alerts** - Missing tracking info, map, conversation history, create case
3. ❌ **Callbacks** - Missing release, filter by type, call now button, active/pending tabs
4. ❌ **Live chat** - Missing Socket.IO real-time, sound alerts, 10s polling
5. ❌ **Supervisor features** - Missing team section, supervision notes CRUD
6. ❌ **Create escalation** - Staff cannot escalate to supervisors

### P2 - MEDIUM (Features incomplete)
1. ⚠️ **Team on duty** - Missing today/tomorrow tabs, shift times
2. ⚠️ **Notes** - Missing edit, color picker, link to callback
3. ⚠️ **AI Learning feedback** - Not implemented at all

### P3 - LOW (Nice to have)
1. ❌ Notification toast system
2. ❌ Generic modal with stacking
3. ⚠️ Various UI polish items

---

## SUMMARY

**React Portal Completion Estimate: ~35%**

The React Staff Portal has:
- ✅ Authentication and login
- ✅ Status management
- ✅ Basic data loading for all sections
- ✅ WebRTC/Twilio phone integration (but backend broken)
- ✅ Shift calendar (mostly complete)

**Major gaps**:
- ❌ No sound alerts (critical for real-time support app)
- ❌ No case management features (sessions, safety plans, referrals)
- ❌ Panic alerts not functional (can't acknowledge/resolve/trigger)
- ❌ Many missing action buttons and modals
- ❌ No session timeout (security issue)
- ❌ Supervisor features incomplete
- ❌ Create escalation missing
- 🔧 WebRTC calls broken (backend issue)

---

## NEXT STEPS

1. **Fix WebRTC** - Refactor `/app/backend/webrtc_signaling.py` for multi-session support
2. **Implement Sound Alerts** - Web Audio API with 3 ascending beeps
3. **Add Session Timeout** - Activity tracking with auto-logout
4. **Complete Panic Alerts** - Acknowledge/resolve actions + trigger button for peers
5. **Build Case Management** - Detail modal with all sub-modals
6. **Enhance Safeguarding** - Tracking info, map, conversation history, create case
7. **Fix Callbacks** - Tabs, release button, call now, filter by type
8. **Complete Supervisor Tab** - Team section, supervision notes
9. **Add Create Escalation** - Modal for staff to escalate to supervisors
