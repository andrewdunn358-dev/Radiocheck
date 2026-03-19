# STAFF PORTAL COMPARISON: Legacy vs React
## Created: March 2026
## Purpose: Track migration progress and identify discrepancies

---

## PROGRESS UPDATE - March 2026

### INITIAL COMPARISON DONE
This document tracks what's been implemented in the React Staff Portal vs the legacy.

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
| Session timeout (2hr) | Activity tracking | ❌ Not implemented | ❌ MISSING |
| Absolute token expiry (24hr) | Token time check | ❌ Not implemented | ❌ MISSING |
| Activity listeners | Mouse/key/scroll/touch events | ❌ Not implemented | ❌ MISSING |
| Auto-logout warning | Notification before logout | ❌ Not implemented | ❌ MISSING |

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
| "No profile" warning | N/A (legacy assumes profile) | ✅ Warning banner | ✅ DONE |

---

## CALLBACKS SECTION

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /callbacks | ✅ | ✅ staffApi.getCallbacks | ✅ DONE |
| Active callbacks list | With badge count | ✅ Displays | ⚠️ PARTIAL - no tabs |
| Pending callbacks list | With badge count | ✅ Displays | ⚠️ PARTIAL - no tabs |
| Take callback | PATCH /callbacks/{id}/take | ✅ handleTakeCallback | ✅ DONE |
| Complete callback | PATCH /callbacks/{id}/complete | ✅ handleCompleteCallback | ✅ DONE |
| Release callback | PATCH /callbacks/{id}/release | ❌ Not found | ❌ MISSING |
| Filter by request_type | peer/counsellor based on role | ❌ Not filtering | ❌ MISSING |
| "Call Now" button | Twilio integration | ❌ Not found | ❌ MISSING |
| Card: phone, message, timestamp | Full details | ⚠️ Has phone, reason | ⚠️ PARTIAL |

**Missing Features:**
- Active/Pending tabs (currently single list)
- Release callback button
- Call Now button (Twilio)
- Filter by request_type based on role

---

## PANIC ALERTS

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /panic-alerts | ✅ | ✅ staffApi.getPanicAlerts | ✅ DONE |
| Role-based visibility | Only counsellor/supervisor/admin | ⚠️ All roles see | ⚠️ PARTIAL |
| Acknowledge alert | PATCH /panic-alerts/{id}/acknowledge | ❌ Not found | ❌ MISSING |
| Resolve alert | PATCH /panic-alerts/{id}/resolve | ❌ Not found | ❌ MISSING |
| "Call Now" button | For alerts with phone | ❌ Not found | ❌ MISSING |
| Badge count | In section header | ⚠️ Combined with safeguarding | ⚠️ PARTIAL |
| Trigger panic button (peers) | POST /panic-alert | ❌ Not implemented | ❌ MISSING |

**Missing Features:**
- Panic alert acknowledge/resolve actions
- Panic trigger button for peers
- Call Now button
- Role-based visibility (should hide from peers)

---

## SAFEGUARDING ALERTS

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /safeguarding-alerts | ✅ | ✅ staffApi.getSafeguardingAlerts | ✅ DONE |
| Filter active/acknowledged | ✅ | ⚠️ Shows all | ⚠️ PARTIAL |
| Acknowledge action | PATCH /safeguarding-alerts/{id}/acknowledge | ✅ handleAcknowledgeSafeguarding | ✅ DONE |
| Resolve action | PATCH /safeguarding-alerts/{id}/resolve | ✅ handleResolveSafeguarding | ✅ DONE |
| Risk badge (RED/AMBER/YELLOW) | Color-coded | ✅ getRiskBadgeColor | ✅ DONE |
| Contact captured status | Green/warning indicator | ❌ Not displayed | ❌ MISSING |
| Session ID display | ✅ | ❌ Not displayed | ❌ MISSING |
| Triggered indicators | List of phrases | ✅ trigger_phrases/triggered_indicators | ✅ DONE |
| Triggering message | Quoted | ✅ Displayed | ✅ DONE |
| Tracking info (IP, user agent) | Expandable section | ❌ Not displayed | ❌ MISSING |
| Location map (Leaflet) | With coordinates | ❌ Not implemented | ❌ MISSING |
| Conversation history | Collapsible, last 6 messages | ❌ Not implemented | ❌ MISSING |
| "Create Case" button | Opens modal | ❌ Not implemented | ❌ MISSING |
| Sound alert (new alerts) | Web Audio API, 3 beeps | ❌ Not implemented | ❌ MISSING |
| New alert banner | Auto-dismiss notification | ❌ Not implemented | ❌ MISSING |
| Polling (30s) | With sound on new | ✅ setInterval(loadAlerts, 30000) | ⚠️ PARTIAL - no sound |

**Missing Features:**
- Contact captured status indicator
- Session ID display
- Tracking info section (IP, location, user agent)
- Leaflet map for location
- Conversation history preview
- Create Case from Alert
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
| Chat modal | Full-screen dark theme | ❌ No modal visible | ❌ MISSING |
| Socket.IO real-time | chat_message event | ❌ Not using socket for chat | ❌ MISSING |
| Sound alert (new chats) | Web Audio API | ❌ Not implemented | ❌ MISSING |
| New chat banner | Auto-dismiss notification | ❌ Not implemented | ❌ MISSING |
| Polling (10s) | For new chats | ❌ Uses 30s like alerts | ⚠️ PARTIAL |
| Waiting time display | getWaitingTime() | ✅ formatTimeAgo | ✅ DONE |
| Safeguarding link indicator | Shows if linked to alert | ❌ Not displayed | ❌ MISSING |
| "Call from chat" button | Twilio call | ❌ Not implemented | ❌ MISSING |
| Force reset status after chat | force_available event | ❌ Not implemented | ❌ MISSING |

**Missing Features:**
- Chat modal UI (messages div not visible in code)
- Socket.IO for real-time messages
- Sound alerts for new chats
- New chat notification banner
- 10-second polling (uses 30s)
- Call from chat button
- Force reset status after ending chat

---

## NOTES SECTION

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /notes?include_shared=true | ✅ | ✅ staffApi.getNotes | ✅ DONE |
| My Notes tab | ✅ | ✅ notesTab state | ✅ DONE |
| Shared with Me tab | ✅ | ✅ notesTab state | ✅ DONE |
| Create note | POST /notes | ✅ handleAddNote | ✅ DONE |
| Delete note | DELETE /notes/{id} | ✅ handleDeleteNote | ✅ DONE |
| Edit note | PUT /notes/{id} | ❌ Not implemented | ❌ MISSING |
| Color picker (5 colors) | Yellow/blue/green/pink/purple | ❌ Not implemented | ❌ MISSING |
| Link to callback | Dropdown in modal | ❌ Not implemented | ❌ MISSING |
| Share with staff | Multi-select | ⚠️ Single checkbox | ⚠️ PARTIAL |
| GET /staff-users | For sharing dropdown | ❌ Not called | ❌ MISSING |

**Missing Features:**
- Edit note functionality
- Color picker for notes
- Link note to callback
- Share with specific staff (not just is_shared boolean)

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
| Only delete own shifts | Check user_id | ❌ Deletes any shift | ⚠️ PARTIAL |
| Selected day panel | Shows shifts for date | ✅ Shows in list below | ✅ DONE |

**Issues:**
- Should only allow deleting own shifts
- Query params format may differ

---

## TEAM ON DUTY

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Today tab | Filter shifts for today | ⚠️ Shows all members | ⚠️ PARTIAL |
| Tomorrow tab | Filter shifts for tomorrow | ❌ No tomorrow tab | ❌ MISSING |
| GET /shifts + /counsellors + /peers | Combined | ✅ staffApi.getTeamOnDuty | ⚠️ PARTIAL |
| Avatar with initials | getInitials() | ✅ Has initials | ✅ DONE |
| Shift time display | start_time - end_time | ❌ No time shown | ❌ MISSING |
| "(You)" indicator | For current user | ❌ Not implemented | ❌ MISSING |
| Call team member button | WebRTC call | ✅ webrtcPhone.makeCall | ✅ DONE |

**Missing Features:**
- Today/Tomorrow tab switcher
- Shift time display for team members
- "(You)" indicator for current user

---

## CASES SECTION

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| GET /cases | ✅ | ✅ staffApi.getCases | ✅ DONE |
| Filter by status | Dropdown | ❌ No filter UI | ❌ MISSING |
| Filter by risk_level | Dropdown | ❌ No filter UI | ❌ MISSING |
| Case card display | With actions | ⚠️ Table format | ⚠️ DIFFERENT |
| Morning review queue | GET /cases/morning-queue | ❌ Not implemented | ❌ MISSING |
| View case detail | Modal with sessions | ❌ Just "View" link | ❌ MISSING |
| Add session note | POST /cases/{id}/sessions | ❌ Not implemented | ❌ MISSING |
| Safety plan | PUT /cases/{id}/safety-plan | ❌ Not implemented | ❌ MISSING |
| Create referral | POST /cases/{id}/referrals | ❌ Not implemented | ❌ MISSING |
| Escalate to counsellor | For peers | ❌ Not implemented | ❌ MISSING |
| Share case | POST /cases/{id}/share | ❌ Not implemented | ❌ MISSING |
| Session count badge | X/6 sessions | ❌ Not displayed | ❌ MISSING |

**Missing Features:**
- Case detail modal
- Add session note modal
- Safety plan create/edit
- Create referral modal
- Escalate to counsellor (peers)
- Morning review queue
- Filter dropdowns
- Session count with limit (6)

---

## AI LEARNING FEEDBACK

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Feedback modal | POST /learning/feedback | ❌ Not implemented | ❌ MISSING |
| Learning submission | POST /learning/submit | ❌ Not implemented | ❌ MISSING |
| Category selection | grief/anxiety/etc | ❌ Not implemented | ❌ MISSING |

---

## SUPERVISOR TAB

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Team members list | GET /supervision/team | ❌ Not calling this endpoint | ❌ MISSING |
| Add supervision note | ❌ Not implemented | ❌ MISSING |
| View member notes | ❌ Not implemented | ❌ MISSING |
| Escalations list | GET /escalations | ✅ staffApi.getEscalations | ✅ DONE |
| Filter escalations | Pending/Acknowledged/Resolved/All | ✅ escalationsTab | ⚠️ PARTIAL - only 2 tabs |
| Acknowledge escalation | PATCH /escalations/{id}/acknowledge | ✅ handleAcknowledgeEscalation | ✅ DONE |
| Resolve escalation | PATCH /escalations/{id}/resolve | ✅ handleResolveEscalation | ✅ DONE |
| Supervision notes | GET/POST /supervision/notes | ❌ Not implemented | ❌ MISSING |
| HR confidential flag | is_confidential | ❌ Not implemented | ❌ MISSING |

**Missing Features:**
- Team members section (different from Team On Duty)
- Supervision notes CRUD
- Full escalation filter tabs
- HR confidential notes

---

## ESCALATION MODAL (Counsellors/Peers)

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Create escalation | POST /escalations | ❌ Not implemented | ❌ MISSING |
| Subject/description | ✅ | ❌ Not implemented | ❌ MISSING |
| Priority dropdown | normal/high/urgent | ❌ Not implemented | ❌ MISSING |
| Link to case | Optional | ❌ Not implemented | ❌ MISSING |

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

---

## SOUND ALERTS

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Sound toggle button | In header | ✅ In sidebar | ✅ DONE |
| Sound preference storage | localStorage | ✅ soundEnabled state | ⚠️ PARTIAL - not persisted |
| Web Audio API beeps | 3 ascending beeps | ❌ No sound implementation | ❌ MISSING |
| Play on new alerts | Safeguarding + live chat | ❌ Not implemented | ❌ MISSING |

**Missing Features:**
- Actual sound playback
- Persist sound preference
- Play on new safeguarding alerts
- Play on new live chats

---

## GENERAL UI

| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Notification toast | showNotification() | ❌ No toast system | ❌ MISSING |
| Generic modal system | With stacking | ❌ No modal system | ❌ MISSING |
| "Back to Case" navigation | ✅ | ❌ No modal stacking | ❌ MISSING |

---

## PRIORITY FIX LIST (Ordered by Impact)

### P0 - CRITICAL (Core functionality broken/missing)
1. 🔧 **WebRTC calls not working** - Backend multi-session issue
2. ❌ **Panic alerts** - No actions (acknowledge/resolve), no trigger button
3. ❌ **Live chat modal** - Can't actually chat (no message UI visible)
4. ❌ **Sound alerts** - No audible notifications for new alerts/chats

### P1 - HIGH (Major features missing)
1. ❌ Case management - No detail modal, no session notes, no safety plan
2. ❌ Safeguarding alerts - Missing tracking info, map, conversation history, create case
3. ❌ Callbacks - Missing release, filter by type, call now button
4. ❌ Session timeout - No inactivity tracking
5. ❌ Supervisor - Missing team section, supervision notes

### P2 - MEDIUM (Features incomplete)
1. ⚠️ Team on duty - Missing today/tomorrow tabs, shift times
2. ⚠️ Notes - Missing edit, color picker, link to callback
3. ⚠️ Escalations - Missing create escalation for staff
4. ❌ AI Learning feedback - Not implemented at all

### P3 - LOW (Nice to have)
1. ❌ Notification toast system
2. ❌ Generic modal with stacking
3. ⚠️ Various UI polish items

---

## SUMMARY

**React Portal Completion Estimate: ~40%**

The React Staff Portal has:
- ✅ Authentication and login
- ✅ Status management
- ✅ Basic data loading for all sections
- ✅ WebRTC/Twilio phone integration
- ✅ Shift calendar

Major gaps:
- ❌ No working live chat UI
- ❌ No sound alerts
- ❌ No case management features
- ❌ Panic alerts not functional
- ❌ Many missing action buttons and modals
- ❌ No session timeout
- ❌ Supervisor features incomplete
