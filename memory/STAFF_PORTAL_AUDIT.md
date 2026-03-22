# Staff Portal Audit - /app/portal/src/app/staff/page.tsx

**Audit Date**: February 2026  
**Current Line Count**: 3,907 lines  
**Target Line Count**: ~150-300 lines (shell component)

---

## 1. Total Line Count

| Metric | Count |
|--------|-------|
| Total Lines | 3,907 |
| Blank Lines | ~150 |
| Code Lines | ~3,757 |

---

## 2. Major Sections with Line Ranges

| Section | Start Line | End Line | Lines | Description |
|---------|------------|----------|-------|-------------|
| Imports | 1 | 15 | 15 | React, hooks, icons, API imports |
| Type Definitions | 17 | 19 | 3 | TabType, AlertsSubTab, CallbacksSubTab |
| Constants | 21 | 24 | 4 | API_URL configuration |
| Component Start | 26 | 26 | 1 | Main export function |
| Auth Hook Usage | 27 | 27 | 1 | useStaffAuth hook |
| Login State | 29 | 34 | 6 | Login form state |
| App State | 36 | 42 | 7 | activeTab, soundEnabled, subTabs |
| Case Management State | 44 | 51 | 8 | selectedCase, filters, sessions |
| Session Timeout State | 53 | 58 | 6 | Timeout refs and warning |
| Sound Alert Refs | 60 | 64 | 5 | AudioContext, prev count refs |
| Phone/WebRTC State | 66 | 88 | 23 | Phone status, WebRTC, Twilio hooks |
| Debug Logging | 90 | 122 | 33 | useEffect for debugging |
| Data State | 124 | 141 | 18 | Alerts, chats, cases, callbacks, etc. |
| Modal State | 132 | 134 | 3 | Active chat room, messages |
| Additional Data State | 136 | 141 | 6 | Shifts, swaps, team, notes, escalations |
| Calendar State | 143 | 145 | 3 | Current month, selected date |
| Notes State | 147 | 163 | 17 | Notes tabs, add/edit/share modals |
| Shift Modal State | 165 | 170 | 6 | Add shift form fields |
| Escalations State | 172 | 173 | 2 | Escalations tab |
| Panic Button State | 175 | 178 | 4 | Panic modal, reason, triggering |
| AI Feedback Modal State | 180 | 184 | 5 | AI feedback form |
| Case Management State | 186 | 197 | 12 | Create/escalate case modals |
| **Data Loading Functions** | 199 | 291 | 93 | loadAlerts, loadLiveChats, etc. |
| **useEffects** | 293 | 560 | 268 | Data polling, event listeners, session timeout |
| **Handler Functions** | 562 | 1193 | 632 | Login, status, alert, chat, callback handlers |
| Loading Screen | 1195 | 1201 | 7 | Loading spinner |
| Login Screen | 1203 | 1281 | 79 | Login form JSX |
| Navigation Items | 1283 | 1294 | 12 | Nav item definitions |
| **Main JSX** | 1296 | 3905 | 2610 | Entire rendered UI |

---

## 3. TypeScript Interfaces Defined (Inline)

| Interface/Type | Line | Description |
|----------------|------|-------------|
| `TabType` | 17 | Union type for main tabs |
| `AlertsSubTab` | 18 | Union type for alerts sub-tabs |
| `CallbacksSubTab` | 19 | Union type for callbacks sub-tabs |

**Note**: Most interfaces are imported from `@/lib/api`:
- `SafeguardingAlert`
- `PanicAlert`
- `LiveChatRoom`
- `Case`
- `Callback`
- `Shift`
- `ShiftSwap`
- `TeamMember`
- `StaffNote`
- `Escalation`
- `LiveChatMessage`
- `InternalMessage`

---

## 4. Complete List of State Variables (useState Calls)

| # | Variable | Type | Line | Purpose |
|---|----------|------|------|---------|
| 1 | `loginEmail` | `string` | 30 | Login form email |
| 2 | `loginPassword` | `string` | 31 | Login form password |
| 3 | `loginError` | `string` | 32 | Login error message |
| 4 | `loginLoading` | `boolean` | 33 | Login loading state |
| 5 | `rememberMe` | `boolean` | 34 | Remember me checkbox |
| 6 | `activeTab` | `TabType` | 37 | Current active tab |
| 7 | `soundEnabled` | `boolean` | 38 | Sound alerts toggle |
| 8 | `alertsSubTab` | `AlertsSubTab` | 41 | Alerts sub-tab |
| 9 | `callbacksSubTab` | `CallbacksSubTab` | 42 | Callbacks sub-tab |
| 10 | `selectedCase` | `Case \| null` | 45 | Selected case for modal |
| 11 | `showCaseModal` | `boolean` | 46 | Case detail modal visibility |
| 12 | `caseStatusFilter` | `string` | 47 | Case status filter |
| 13 | `caseRiskFilter` | `string` | 48 | Case risk filter |
| 14 | `showAddSessionModal` | `boolean` | 49 | Add session modal |
| 15 | `newSessionNote` | `string` | 50 | New session note content |
| 16 | `caseSessions` | `any[]` | 51 | Case sessions list |
| 17 | `showTimeoutWarning` | `boolean` | 58 | Session timeout warning |
| 18 | `phoneStatus` | `string` | 67 | Phone connection status |
| 19 | `chatConnected` | `boolean` | 68 | Chat connection status |
| 20 | `safeguardingAlerts` | `SafeguardingAlert[]` | 125 | Safeguarding alerts data |
| 21 | `panicAlerts` | `PanicAlert[]` | 126 | Panic alerts data |
| 22 | `liveChatRooms` | `LiveChatRoom[]` | 127 | Live chat rooms data |
| 23 | `cases` | `Case[]` | 128 | Cases data |
| 24 | `callbacks` | `Callback[]` | 129 | Callbacks data |
| 25 | `activeChatRoom` | `LiveChatRoom \| null` | 132 | Active chat room |
| 26 | `chatMessages` | `any[]` | 133 | Chat messages |
| 27 | `newMessage` | `string` | 134 | New message input |
| 28 | `shifts` | `Shift[]` | 137 | Shifts data |
| 29 | `swapRequests` | `ShiftSwap[]` | 138 | Swap requests data |
| 30 | `teamMembers` | `TeamMember[]` | 139 | Team members data |
| 31 | `notes` | `StaffNote[]` | 140 | Notes data |
| 32 | `escalations` | `Escalation[]` | 141 | Escalations data |
| 33 | `currentMonth` | `Date` | 144 | Calendar current month |
| 34 | `selectedDate` | `Date \| null` | 145 | Calendar selected date |
| 35 | `notesTab` | `'my' \| 'shared'` | 148 | Notes tab selection |
| 36 | `showAddNote` | `boolean` | 149 | Add note modal |
| 37 | `newNoteTitle` | `string` | 150 | New note title |
| 38 | `newNoteContent` | `string` | 151 | New note content |
| 39 | `newNoteShared` | `boolean` | 152 | New note shared flag |
| 40 | `newNoteTags` | `string[]` | 153 | New note tags |
| 41 | `editingNote` | `StaffNote \| null` | 154 | Note being edited |
| 42 | `showShareModal` | `string \| null` | 155 | Share modal note ID |
| 43 | `selectedShareUsers` | `string[]` | 156 | Selected users to share with |
| 44 | `showMessagesModal` | `boolean` | 159 | Messages modal visibility |
| 45 | `messages` | `InternalMessage[]` | 160 | Internal messages |
| 46 | `newMessageTo` | `string` | 161 | Message recipient |
| 47 | `newMessageContent` | `string` | 162 | Message content |
| 48 | `unreadMessageCount` | `number` | 163 | Unread message count |
| 49 | `showAddShift` | `boolean` | 166 | Add shift modal |
| 50 | `newShiftDate` | `string` | 167 | New shift date |
| 51 | `newShiftStart` | `string` | 168 | New shift start time |
| 52 | `newShiftEnd` | `string` | 169 | New shift end time |
| 53 | `newShiftType` | `string` | 170 | New shift type |
| 54 | `escalationsTab` | `'pending' \| 'all'` | 173 | Escalations tab |
| 55 | `showPanicModal` | `boolean` | 176 | Panic modal visibility |
| 56 | `panicReason` | `string` | 177 | Panic reason |
| 57 | `triggeringPanic` | `boolean` | 178 | Panic triggering state |
| 58 | `showAiFeedbackModal` | `boolean` | 181 | AI feedback modal |
| 59 | `aiFeedbackData` | `object \| null` | 182 | AI feedback data |
| 60 | `aiFeedbackRating` | `string \| null` | 183 | AI feedback rating |
| 61 | `aiFeedbackComment` | `string` | 184 | AI feedback comment |
| 62 | `showCreateCaseModal` | `boolean` | 187 | Create case modal |
| 63 | `showEscalateModal` | `boolean` | 188 | Escalate modal |
| 64 | `escalateCaseId` | `string \| null` | 189 | Case ID to escalate |
| 65 | `escalateTo` | `string` | 190 | Escalate to user |
| 66 | `escalateReason` | `string` | 191 | Escalation reason |
| 67 | `escalateNotes` | `string` | 192 | Escalation notes |
| 68 | `newCaseUserId` | `string` | 193 | New case user ID |
| 69 | `newCaseUserName` | `string` | 194 | New case user name |
| 70 | `newCaseNotes` | `string` | 195 | New case notes |
| 71 | `newCaseRiskLevel` | `string` | 196 | New case risk level |
| 72 | `availableCounsellors` | `any[]` | 197 | Available counsellors |

**Total: 72 useState calls**

---

## 5. All API Functions / Fetch Calls

### From `staffApi` (imported from `@/lib/api`):

| Function | Line | Purpose |
|----------|------|---------|
| `staffApi.getSafeguardingAlerts(token)` | 208 | Load safeguarding alerts |
| `staffApi.getPanicAlerts(token)` | 209 | Load panic alerts |
| `staffApi.getLiveChatRooms(token)` | 223 | Load live chat rooms |
| `staffApi.getCases(token)` | 233 | Load cases |
| `staffApi.getCallbacks(token)` | 243 | Load callbacks |
| `staffApi.getShifts(token)` | 254 | Load shifts |
| `staffApi.getSwapRequests(token)` | 256 | Load swap requests |
| `staffApi.getTeamOnDuty(token)` | 265 | Load team members |
| `staffApi.getNotes(token)` | 275 | Load notes |
| `staffApi.getEscalations(token)` | 286 | Load escalations |
| `staffApi.acknowledgeSafeguardingAlert(token, id)` | 589 | Acknowledge safeguarding |
| `staffApi.resolveSafeguardingAlert(token, id)` | 599 | Resolve safeguarding |
| `staffApi.joinLiveChat(token, roomId, userId, name)` | 615 | Join chat room |
| `staffApi.getLiveChatMessages(token, roomId)` | 616 | Get chat messages |
| `staffApi.sendLiveChatMessage(token, roomId, message)` | 644 | Send chat message |
| `staffApi.endLiveChat(token, roomId)` | 674 | End chat |
| `staffApi.takeCallback(token, id)` | 687 | Take callback |
| `staffApi.completeCallback(token, id)` | 695 | Complete callback |
| `staffApi.releaseCallback(token, id)` | 705 | Release callback |
| `staffApi.acknowledgePanicAlert(token, id)` | 717 | Acknowledge panic |
| `staffApi.resolvePanicAlert(token, id)` | 727 | Resolve panic |
| `staffApi.triggerPanic(token)` | 739 | Trigger panic |
| `staffApi.addCaseSession(token, caseId, data)` | 751 | Add case session |
| `staffApi.getCaseSessions(token, caseId)` | 760 | Get case sessions |
| `staffApi.createShift(token, data, ...)` | 779 | Create shift |
| `staffApi.deleteShift(token, id)` | 803 | Delete shift |
| `staffApi.createSwapRequest(token, shiftId, reason)` | 815 | Request swap |
| `staffApi.createNote(token, data)` | 827 | Create note |
| `staffApi.deleteNote(token, id)` | 845 | Delete note |
| `staffApi.updateNote(token, id, data)` | 856 | Update note |
| `staffApi.shareNote(token, noteId, userIds)` | 873 | Share note |
| `staffApi.getMessages(token)` | 886 | Get messages |
| `staffApi.sendMessage(token, data)` | 897 | Send message |
| `staffApi.markMessageRead(token, id)` | 911 | Mark message read |
| `staffApi.acknowledgeEscalation(token, id)` | 930 | Acknowledge escalation |
| `staffApi.resolveEscalation(token, id)` | 940 | Resolve escalation |

### Direct Fetch Calls:

| Function | Line | Endpoint | Purpose |
|----------|------|----------|---------|
| `fetch` | 1019 | `/api/safeguarding/panic-alert` | Trigger panic alert |
| `fetch` | 1048 | `/api/ai-feedback` | Submit AI feedback |
| `fetch` | 1079 | `/api/counsellors/available` | Load counsellors |
| `fetch` | 1093 | `/api/cases/direct` | Create case |
| `fetch` | 1128 | `/api/cases/${caseId}` | Get case details |
| `fetch` | 1158 | `/api/cases/${caseId}/share` | Share case |
| `fetch` | 1170 | `/api/cases/${caseId}/sessions` | Add escalation session |

---

## 6. All useEffect Hooks and Their Purpose

| # | Lines | Dependencies | Purpose |
|---|-------|--------------|---------|
| 1 | 91-106 | `[token, user, profile, ...]` | Debug logging for auth/WebRTC state |
| 2 | 109-122 | `[webrtcPhone.isRegistered, ...]` | Sync phone status from WebRTC hook |
| 3 | 294-316 | `[token, loadAlerts, ...]` | Initial data load + polling (30s intervals) |
| 4 | 319-345 | `[loadTeam]` | Listen for real-time status sync events |
| 5 | 350-413 | `[token, user, webrtcUserId, ...]` | Auto-open chat on `chat_request_confirmed` event |
| 6 | 416-462 | `[activeChatRoom, webrtcUserId, ...]` | Listen for real-time chat messages |
| 7 | 465-504 | `[token, logout, showTimeoutWarning]` | Session timeout logic (2hr inactivity) |
| 8 | 532-547 | `[safeguardingAlerts, liveChatRooms, ...]` | Play alert sound on new alerts |
| 9 | 550-555 | `[]` | Load sound preference from localStorage |
| 10 | 558-560 | `[soundEnabled]` | Save sound preference to localStorage |
| 11 | 919-923 | `[token, loadMessages]` | Load messages + poll every 30s |

**Total: 11 useEffect hooks**

---

## 7. All Tab/View Sections with Approximate Line Counts

| Tab/View | Start Line | End Line | Lines | Has Sub-tabs |
|----------|------------|----------|-------|--------------|
| Dashboard | 1686 | 1778 | 93 | No |
| Alerts | 1781 | 2059 | 279 | Yes (Safeguarding, Panic) |
| Live Chat | 2062 | 2182 | 121 | No |
| Cases | 2184 | 2301 | 118 | No |
| Callbacks | 2303 | 2475 | 173 | Yes (Pending, Active, Completed) |
| Rota | 2477 | 2600 | 124 | No |
| Team | 2603 | 2701 | 99 | No |
| Notes | 2704 | 2801 | 98 | Yes (My Notes, Shared) |
| Supervision | 2804 | 2890 | 87 | Yes (Pending, All) |

**Total Tab JSX: ~1,192 lines**

---

## 8. All Modal Dialogs

| Modal | Start Line | End Line | Lines | Purpose |
|-------|------------|----------|-------|---------|
| Incoming Call Modal | 1302 | 1330 | 29 | WebRTC incoming call |
| Active Call UI | 1333 | 1361 | 29 | WebRTC in-call controls |
| Incoming Chat Request Banner | 1364 | 1411 | 48 | Chat request notification |
| Incoming Call Request Banner | 1413 | 1458 | 46 | Call request notification |
| Session Timeout Warning | 2893 | 2914 | 22 | Session expiring warning |
| Live Chat Modal | 2916 | 3024 | 109 | Active chat conversation |
| Add Shift Modal | 3026 | 3090 | 65 | Add shift form |
| Add Note Modal | 3092 | 3143 | 52 | Add note form |
| Case Detail Modal | 3145 | 3259 | 115 | View case details |
| Add Session Modal | 3261 | 3293 | 33 | Add session note to case |
| Panic Button Modal | 3295 | 3344 | 50 | Trigger panic alert |
| AI Feedback Modal | 3346 | 3422 | 77 | Submit AI feedback |
| Create Case Modal | 3424 | 3510 | 87 | Create new case |
| Escalate Case Modal | 3512 | 3605 | 94 | Escalate case to counsellor |
| Case Detail Modal (duplicate) | 3607 | 3710 | 104 | View case details (duplicate?) |
| Edit Note Modal | 3712 | 3768 | 57 | Edit existing note |
| Share Note Modal | 3770 | 3826 | 57 | Share note with team |
| Internal Messages Modal | 3828 | 3903 | 76 | Internal messaging |

**Total Modal JSX: ~1,150 lines**

---

## 9. All Handler Functions

| # | Function | Lines | Purpose |
|---|----------|-------|---------|
| 1 | `loadAlerts` | 200-218 | Load safeguarding + panic alerts |
| 2 | `loadLiveChats` | 220-228 | Load live chat rooms |
| 3 | `loadCases` | 230-238 | Load cases |
| 4 | `loadCallbacks` | 240-248 | Load callbacks |
| 5 | `loadShifts` | 250-260 | Load shifts + swap requests |
| 6 | `loadTeam` | 262-270 | Load team members |
| 7 | `loadNotes` | 272-281 | Load notes |
| 8 | `loadEscalations` | 283-291 | Load escalations |
| 9 | `playAlertSound` | 507-529 | Play audio alert |
| 10 | `handleLogin` | 563-574 | Handle login form submit |
| 11 | `handleStatusChange` | 577-583 | Change staff status |
| 12 | `handleAcknowledgeSafeguarding` | 586-594 | Acknowledge safeguarding alert |
| 13 | `handleResolveSafeguarding` | 596-604 | Resolve safeguarding alert |
| 14 | `handleJoinChat` | 607-623 | Join live chat room |
| 15 | `handleSendMessage` | 625-664 | Send chat message |
| 16 | `handleEndChat` | 666-681 | End live chat |
| 17 | `handleTakeCallback` | 684-692 | Take callback |
| 18 | `handleCompleteCallback` | 694-702 | Complete callback |
| 19 | `handleReleaseCallback` | 704-712 | Release callback |
| 20 | `handleAcknowledgePanic` | 715-723 | Acknowledge panic alert |
| 21 | `handleResolvePanic` | 725-733 | Resolve panic alert |
| 22 | `handleTriggerPanic` | 735-746 | Trigger panic (confirm) |
| 23 | `handleAddSessionNote` | 748-766 | Add session note to case |
| 24 | `handleAddShift` | 776-798 | Add new shift |
| 25 | `handleDeleteShift` | 800-808 | Delete shift |
| 26 | `handleRequestSwap` | 810-821 | Request shift swap |
| 27 | `handleAddNote` | 824-840 | Add new note |
| 28 | `handleDeleteNote` | 842-850 | Delete note |
| 29 | `handleUpdateNote` | 853-867 | Update note |
| 30 | `handleShareNote` | 870-880 | Share note with users |
| 31 | `loadMessages` | 883-892 | Load internal messages |
| 32 | `handleSendInternalMessage` | 894-906 | Send internal message |
| 33 | `handleMarkMessageRead` | 908-916 | Mark message as read |
| 34 | `handleAcknowledgeEscalation` | 927-935 | Acknowledge escalation |
| 35 | `handleResolveEscalation` | 937-945 | Resolve escalation |
| 36 | `getDaysInMonth` | 948-956 | Calendar helper |
| 37 | `getShiftsForDate` | 958-961 | Get shifts for a date |
| 38 | `prevMonth` | 963-965 | Previous month navigation |
| 39 | `nextMonth` | 967-969 | Next month navigation |
| 40 | `formatTimeAgo` | 972-983 | Format date as "X ago" |
| 41 | `getRiskBadgeColor` | 985-993 | Get risk badge CSS class |
| 42 | `getStatusColor` | 995-1004 | Get status CSS class |
| 43 | `triggerPanicAlert` | 1015-1042 | Trigger panic (actual) |
| 44 | `submitAiFeedback` | 1045-1073 | Submit AI feedback |
| 45 | `loadAvailableCounsellors` | 1076-1087 | Load available counsellors |
| 46 | `handleCreateCase` | 1090-1121 | Create new case |
| 47 | `handleViewCase` | 1124-1141 | View case details |
| 48 | `handleOpenEscalate` | 1144-1151 | Open escalation modal |
| 49 | `handleEscalateCase` | 1154-1193 | Escalate case |

**Total: 49 handler functions**

---

## 10. Refactoring Plan

### Phase 1: Extract Shared Infrastructure (Already Exists)
**Status**: COMPLETE - The following already exist:

| Component | File | Lines |
|-----------|------|-------|
| Staff API Client | `/app/portal/src/lib/api.ts` | ~400 lines (staffApi section) |
| Types | `/app/portal/src/lib/api.ts` | Exported interfaces |
| Auth Hook | `/app/portal/src/hooks/useStaffAuth.tsx` | 254 lines |
| WebRTC Hook | `/app/portal/src/hooks/useWebRTCPhone.tsx` | Existing |
| Twilio Hook | `/app/portal/src/hooks/useTwilioPhone.tsx` | Existing |

### Phase 2: Extract Tab Components

| Tab | Target File | Estimated Lines | State to Move |
|-----|-------------|-----------------|---------------|
| Dashboard | `DashboardTab.tsx` | ~100 | Computed counts only |
| Alerts (Safeguarding + Panic) | `AlertsTab/index.tsx` | ~80 | alertsSubTab |
| - Safeguarding Sub-tab | `AlertsTab/SafeguardingSubTab.tsx` | ~150 | safeguardingAlerts handlers |
| - Panic Sub-tab | `AlertsTab/PanicSubTab.tsx` | ~120 | panicAlerts handlers |
| Live Chat | `LiveChatTab.tsx` | ~150 | liveChatRooms, activeChatRoom, chatMessages |
| Cases | `CasesTab.tsx` | ~200 | cases, filters, selectedCase |
| Callbacks | `CallbacksTab.tsx` | ~180 | callbacks, callbacksSubTab |
| Rota | `RotaTab.tsx` | ~200 | shifts, swapRequests, calendar state |
| Team | `TeamTab.tsx` | ~120 | teamMembers |
| Notes | `NotesTab.tsx` | ~150 | notes, notesTab, edit/share state |
| Supervision | `SupervisionTab.tsx` | ~100 | escalations, escalationsTab |

**Phase 2 Total: ~1,550 lines across 12 files**

### Phase 3: Extract Modal Components

| Modal | Target File | Estimated Lines |
|-------|-------------|-----------------|
| Incoming Call Modal | `modals/IncomingCallModal.tsx` | ~50 |
| Active Call UI | `modals/ActiveCallUI.tsx` | ~50 |
| Chat Request Banner | `modals/ChatRequestBanner.tsx` | ~60 |
| Call Request Banner | `modals/CallRequestBanner.tsx` | ~60 |
| Live Chat Modal | `modals/LiveChatModal.tsx` | ~120 |
| Add Shift Modal | `modals/AddShiftModal.tsx` | ~70 |
| Add Note Modal | `modals/AddNoteModal.tsx` | ~60 |
| Case Detail Modal | `modals/CaseDetailModal.tsx` | ~120 |
| Session Note Modal | `modals/SessionNoteModal.tsx` | ~50 |
| Panic Modal | `modals/PanicModal.tsx` | ~60 |
| AI Feedback Modal | `modals/AIFeedbackModal.tsx` | ~90 |
| Create Case Modal | `modals/CreateCaseModal.tsx` | ~100 |
| Escalate Case Modal | `modals/EscalateCaseModal.tsx` | ~100 |
| Edit Note Modal | `modals/EditNoteModal.tsx` | ~70 |
| Share Note Modal | `modals/ShareNoteModal.tsx` | ~70 |
| Messages Modal | `modals/MessagesModal.tsx` | ~90 |
| Timeout Warning | `modals/TimeoutWarningModal.tsx` | ~40 |

**Phase 3 Total: ~1,260 lines across 17 files**

### Phase 4: Extract Shared UI Components

| Component | Target File | Estimated Lines |
|-----------|-------------|-----------------|
| Sidebar | `layout/Sidebar.tsx` | ~100 |
| Connection Status | `layout/ConnectionStatus.tsx` | ~80 |
| Profile Warning | `layout/ProfileWarning.tsx` | ~30 |

**Phase 4 Total: ~210 lines across 3 files**

### Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| `page.tsx` lines | 3,907 | ~200-250 |
| Total component files | 1 | ~33 |
| Total lines (all files) | 3,907 | ~4,200 (with type safety) |

---

## 11. Implementation Order with Priority

### P0 - Critical (Phase 2A - High-Impact Tabs)

1. **AlertsTab** - Most complex, highest safety risk
   - `AlertsTab/index.tsx`
   - `AlertsTab/SafeguardingSubTab.tsx`
   - `AlertsTab/PanicSubTab.tsx`

2. **LiveChatTab** - Real-time critical functionality
   - Includes WebRTC integration
   - Must handle real-time events properly

3. **CasesTab** - Core workflow
   - Complex state management
   - Multiple modals

4. **CallbacksTab** - Active workflow feature
   - Twilio integration
   - Sub-tabs

### P1 - Important (Phase 2B - Supporting Tabs)

5. **DashboardTab** - Entry point, simpler
6. **RotaTab** - Calendar logic
7. **TeamTab** - Straightforward
8. **SupervisionTab** - Supervisor-only

### P2 - Lower Priority (Phase 2C + Phase 3)

9. **NotesTab** - Less critical
10. **Modal extraction** - Can be done incrementally
11. **Layout components** - Polish

---

## 12. Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebRTC/Socket.IO event handlers | Breaking real-time calls/chat | Extract carefully, test thoroughly, keep event listeners in parent initially |
| Session timeout logic | Security vulnerability | Keep in main component or dedicated provider |
| Sound alerts timing | UX degradation | Keep refs and counters close to data |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| State synchronization | Data inconsistency | Consider context provider for shared state |
| Modal z-index conflicts | UI issues | Consistent z-index management |
| Twilio phone integration | Callback calls fail | Keep Twilio hook usage centralized |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| CSS class changes | Visual regression | Keep original classes unchanged |
| TypeScript errors | Build failure | Run `next build` after each phase |
| Import path changes | Build failure | Use absolute imports (`@/components/...`) |

### Recommendations

1. **Create a StaffPortalContext** for shared state (alerts, callbacks, team, etc.)
2. **Keep WebRTC and Twilio hooks in main component** initially
3. **Extract tabs one at a time** with build verification
4. **Test real-time features** (calls, chat, alerts) after each phase
5. **Consider feature flags** to gradually roll out refactored components

---

## Appendix: File Structure After Refactoring

```
/app/portal/src/
├── app/
│   └── staff/
│       └── page.tsx                    # ~200 lines (shell only)
├── components/
│   └── staff/
│       ├── tabs/
│       │   ├── DashboardTab.tsx
│       │   ├── AlertsTab/
│       │   │   ├── index.tsx
│       │   │   ├── SafeguardingSubTab.tsx
│       │   │   └── PanicSubTab.tsx
│       │   ├── LiveChatTab.tsx
│       │   ├── CasesTab.tsx
│       │   ├── CallbacksTab.tsx
│       │   ├── RotaTab.tsx
│       │   ├── TeamTab.tsx
│       │   ├── NotesTab.tsx
│       │   └── SupervisionTab.tsx
│       ├── modals/
│       │   ├── IncomingCallModal.tsx
│       │   ├── ActiveCallUI.tsx
│       │   ├── ChatRequestBanner.tsx
│       │   ├── CallRequestBanner.tsx
│       │   ├── LiveChatModal.tsx
│       │   ├── AddShiftModal.tsx
│       │   ├── AddNoteModal.tsx
│       │   ├── CaseDetailModal.tsx
│       │   ├── SessionNoteModal.tsx
│       │   ├── PanicModal.tsx
│       │   ├── AIFeedbackModal.tsx
│       │   ├── CreateCaseModal.tsx
│       │   ├── EscalateCaseModal.tsx
│       │   ├── EditNoteModal.tsx
│       │   ├── ShareNoteModal.tsx
│       │   ├── MessagesModal.tsx
│       │   └── TimeoutWarningModal.tsx
│       └── layout/
│           ├── Sidebar.tsx
│           ├── ConnectionStatus.tsx
│           └── ProfileWarning.tsx
├── contexts/
│   └── StaffPortalContext.tsx          # Shared state provider
├── hooks/
│   └── useStaffAuth.tsx                # Already exists
└── lib/
    └── api.ts                          # Already exists
```

---

**Next Steps**: 
1. Get user approval on refactoring plan
2. Start with Phase 2A (AlertsTab) following the admin portal pattern
3. Run `next build` after each extraction
4. Test real-time features manually before moving to next phase
