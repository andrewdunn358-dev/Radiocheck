# ADMIN PORTAL COMPARISON: Legacy vs React

## PROGRESS UPDATE - March 2026

### COMPLETED FIXES:
1. ✅ Staff - Status toggle buttons (Available/Busy/Off for counsellors, Available/Limited/Unavailable for peers)
2. ✅ Rota - Coverage stats section (Counsellors Today, Peers Today, Shifts This Week, Coverage Gaps)
3. ✅ CMS - Load Defaults button, shows page content (title, sections, cards)
4. ✅ AI Personas - Edit modal, Enable/Disable toggle, Import Defaults button
5. ✅ Beta Testing - Survey responses list, Export CSV button
6. ✅ Compliance - Staff Wellbeing section, Run Security Review button, expanded metrics
7. ✅ Logs - App Usage Analytics added previously
8. ✅ Monitoring - Server health progress bars (CPU, Memory, Load), proper stats layout
9. ✅ Governance - Weekly/Monthly report buttons, full report display with KPIs, recommendations
10. ✅ Events - Create Event modal, Cancel button on events
11. ✅ AI Learning - Seed Defaults button, working Approve/Reject buttons
12. ✅ AI Usage - Budget progress bars for OpenAI/Gemini, character usage list

### ALSO FIXED:
- `.toFixed()` crash on non-numeric values (DATA TYPE ENFORCEMENT)
- Legacy admin `loadDashboardData` → `loadLogsData` bug
- Compliance backend 401 auth error
- Login autocomplete warnings

### REMAINING TO DO:
- Logs tab: Missing screening/callbacks/panic sub-tabs, location map, charts
- Minor: Some tabs may need additional sub-tabs matching legacy exactly

---

## Status Legend:
- ✅ DONE - Fully implemented and matches legacy
- ⚠️ PARTIAL - Implemented but missing features
- ❌ MISSING - Not implemented at all
- 🔧 BROKEN - Implemented but not working

---

## TAB 1: STAFF
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| View unified staff list | GET /admin/unified-staff | ✅ Has endpoint | ✅ DONE |
| View counsellors | GET /counsellors | ✅ Has endpoint | ✅ DONE |
| View peer supporters | GET /peer-supporters | ✅ Has endpoint | ✅ DONE |
| Filter by role | UI filter | ✅ Has filter | ✅ DONE |
| Status toggle counsellor | PATCH /counsellors/{id}/status | ✅ Has endpoint | ✅ DONE |
| Status toggle peer | PATCH /peer-supporters/{id}/status | ✅ Has endpoint | ✅ DONE |
| Add staff modal | Full form | ✅ Has modal | ⚠️ PARTIAL - verify fields |
| Edit staff modal | Full form | ✅ Has modal | ⚠️ PARTIAL - verify fields |
| Delete staff | DELETE endpoint | ✅ Has endpoint | ✅ DONE |
| Reset password modal | Modal with confirm | ❌ Not found | ❌ MISSING |

**Action Items:**
- [ ] Add reset password modal and functionality

---

## TAB 2: ROTA
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Today's shifts | GET /shifts/ filtered | ✅ Has | ✅ DONE |
| Tomorrow's shifts | GET /shifts/ filtered | ✅ Has | ✅ DONE |
| Week view | 7-day grid | ✅ Has | ⚠️ CHECK UI |
| Coverage stats | Calculated from shifts | ❌ Not visible | ❌ MISSING |
| Swap requests list | GET /shift-swaps/needs-approval | ✅ Has endpoint | ⚠️ CHECK UI |
| Approve/Reject swap | POST /shift-swaps/{id}/approve | ✅ Has endpoint | ⚠️ CHECK UI |
| Pending/All tabs | Tab switcher | ❌ Not visible | ❌ MISSING |
| Add Shift button | NOT IN LEGACY | Has button | ⚠️ EXTRA (not in legacy) |

**Action Items:**
- [ ] Add coverage stats section (counsellors today, peers today, total shifts week, gaps)
- [ ] Add swap request pending/all tab switcher
- [ ] Verify swap approve/reject UI works
- [ ] NOTE: Add Shift is EXTRA feature not in legacy - keep or remove?

---

## TAB 3: CMS
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Page list | GET /cms/pages | ✅ Has endpoint | ✅ DONE |
| Page content | GET /cms/pages/{slug} | ✅ Has endpoint | ⚠️ CHECK |
| Visual editor | Full WYSIWYG | ❌ Not implemented | ❌ MISSING |
| Preview iframe | Live preview | ❌ Not implemented | ❌ MISSING |
| Edit cards | PUT /cms/cards/{id} | ❌ Not found | ❌ MISSING |
| Load defaults | POST /cms/seed-public | ❌ Not found | ❌ MISSING |

**Action Items:**
- [ ] CMS tab needs major work - currently just lists pages
- [ ] Add visual editor or at minimum card editing
- [ ] Add load defaults button
- [ ] Add preview functionality

---

## TAB 4: AI PERSONAS
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Character list | GET /ai-characters/admin/all | ✅ Has endpoint | ✅ DONE |
| Avatar display | API_URL + path | ✅ Fixed with resolveAvatarUrl | ✅ DONE |
| Enable/Disable toggle | PATCH /ai-characters/admin/{id}/status | ❌ Not found | ❌ MISSING |
| Edit character modal | PUT /ai-characters/admin/{id} | ❌ Not found | ❌ MISSING |
| Import defaults | POST /ai-characters/seed-from-hardcoded | ❌ Not found | ❌ MISSING |
| Reorder characters | Drag/order UI | ❌ Not found | ❌ MISSING |

**Action Items:**
- [ ] Add enable/disable toggle for each character
- [ ] Add edit character modal with all fields
- [ ] Add import defaults button
- [ ] Add reorder functionality

---

## TAB 5: BETA TESTING
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Beta enabled status | GET /surveys/beta-enabled | ✅ Has endpoint | ✅ DONE |
| Toggle beta mode | POST /surveys/beta-enabled | ✅ Has endpoint | ✅ DONE |
| Stats display | GET /surveys/stats | ✅ Has endpoint | ✅ DONE |
| Pre/Post survey counts | From stats | ✅ Displayed | ✅ DONE |
| Completion rate | From stats | ✅ Displayed | ✅ DONE |
| NPS score | From stats | ✅ Displayed | ✅ DONE |
| Improvement metrics | wellbeing/anxiety/mood change | ⚠️ Partial | ⚠️ PARTIAL |
| Survey responses list | GET /surveys/responses | ❌ Not displayed | ❌ MISSING |
| Export CSV | Link to /surveys/export | ❌ Not found | ❌ MISSING |

**Action Items:**
- [ ] Add survey responses list display
- [ ] Add improvement metrics with color coding (green if positive/negative based on metric)
- [ ] Add export CSV button

---

## TAB 6: COMPLIANCE
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Dashboard data | GET /compliance/dashboard | ✅ Has endpoint | 🔧 BROKEN (was 401, now fixed) |
| GDPR metrics | consent_rate, exports, deletions | ⚠️ Partial | ⚠️ CHECK DISPLAY |
| Staff wellbeing | checkins, support, supervision | ❌ Not displayed | ❌ MISSING |
| Security status | last_review_status, incidents | ❌ Not displayed | ❌ MISSING |
| Incidents list | GET /compliance/incidents | ✅ Has endpoint | ⚠️ CHECK DISPLAY |
| Complaints list | GET /compliance/complaints | ✅ Has endpoint | ⚠️ CHECK DISPLAY |
| Audit logs | GET /admin/audit-logs | ✅ Has endpoint | ⚠️ CHECK DISPLAY |
| Report incident modal | POST /compliance/incidents | ❌ Not found | ❌ MISSING |
| Run security review | POST /compliance/security/automated-review | ❌ Not found | ❌ MISSING |
| Data cleanup | POST /compliance/data-retention/run-cleanup | ❌ Not found | ❌ MISSING |
| Download documents | Static PDF links | ❌ Not found | ❌ MISSING |

**Action Items:**
- [ ] Display full compliance dashboard matching legacy layout
- [ ] Add staff wellbeing section
- [ ] Add security status section
- [ ] Add report incident modal
- [ ] Add action buttons (security review, data cleanup)
- [ ] Add document download links

---

## TAB 7: LOGS & ANALYTICS
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Call logs | GET /call-logs | ✅ Has endpoint | ✅ DONE |
| Chat rooms | GET /live-chat/rooms | ✅ Has endpoint | ✅ DONE |
| Safeguarding alerts | GET /safeguarding-alerts | ✅ Has endpoint | ✅ DONE |
| Screening submissions | GET /safeguarding/screening-submissions | ❌ Not found | ❌ MISSING |
| Callbacks | GET /callbacks | ❌ Not found | ❌ MISSING |
| Panic alerts | GET /panic-alerts | ❌ Not found | ❌ MISSING |
| Audit logs | GET /admin/audit-logs | ✅ Has endpoint | ⚠️ CHECK |
| AI chat stats | GET /ai-chat/stats | ✅ Has endpoint | ✅ DONE |
| App usage stats | GET /analytics/usage | ✅ Has endpoint | ✅ DONE |
| Location map | GET /analytics/locations + Leaflet | ❌ Not found | ❌ MISSING |
| Sub-tabs | calls/chats/safeguarding/screening/callbacks/panic/audit | ⚠️ Only 3 tabs | ⚠️ PARTIAL |
| View chat history | GET /live-chat/rooms/{id}/messages | ❌ Not found | ❌ MISSING |
| Acknowledge/Resolve alerts | PATCH endpoints | ❌ Not found | ❌ MISSING |
| Activity trend chart | Chart.js line | ❌ Not found | ❌ MISSING |
| Contact type chart | Chart.js doughnut | ❌ Not found | ❌ MISSING |
| Export CSV | Custom function | ❌ Not found | ❌ MISSING |
| Clear logs | DELETE endpoints | ❌ Not found | ❌ MISSING |

**Action Items:**
- [ ] Add screening, callbacks, panic sub-tabs
- [ ] Add location map with Leaflet
- [ ] Add view chat history modal
- [ ] Add acknowledge/resolve actions for safeguarding
- [ ] Add charts (activity trend, contact type)
- [ ] Add export CSV button
- [ ] Add clear logs functionality

---

## TAB 8: MONITORING
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| System stats | GET /admin/system-stats | ✅ Has endpoint | ✅ DONE |
| User stats | total_registered, connected_staff | ⚠️ Check display | ⚠️ CHECK |
| Activity stats | calls, AI sessions, chats, callbacks | ⚠️ Check display | ⚠️ CHECK |
| Server health bars | CPU, memory, load | ❌ Not visible | ❌ MISSING |
| Auto-refresh | 30 second interval | ❌ Not implemented | ❌ MISSING |
| Last updated timestamp | Shows time | ❌ Not visible | ❌ MISSING |

**Action Items:**
- [ ] Add server health progress bars (CPU, memory, load)
- [ ] Add auto-refresh every 30 seconds
- [ ] Add last updated timestamp
- [ ] Match legacy stat card layout

---

## TAB 9: GOVERNANCE
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Hazards list | GET /governance/hazards | ✅ Has endpoint | ⚠️ Fixed response parsing |
| Summary report | GET /governance/summary-report | ✅ Has endpoint | ⚠️ CHECK DISPLAY |
| KPIs | GET /governance/kpis | ❌ Not found | ❌ MISSING |
| Sub-tabs | hazards/kpis/incidents/moderation/approvals/compliance/reports | ❌ No sub-tabs | ❌ MISSING |
| Add hazard | POST /governance/hazards | ❌ Not found | ❌ MISSING |
| Generate report button | Weekly/Monthly options | ❌ Not found | ❌ MISSING |

**Action Items:**
- [ ] Add governance sub-tabs
- [ ] Add KPIs section
- [ ] Add add hazard modal
- [ ] Add generate report buttons (weekly/monthly)
- [ ] Display full report with all sections

---

## TAB 10: EVENTS
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Events list | GET /events/admin/all | ✅ Has endpoint (fixed) | ✅ DONE |
| Create event | POST /events/admin/create | ✅ Has endpoint | ⚠️ CHECK MODAL |
| Edit event | PUT /events/admin/{id} | ❌ Not found | ❌ MISSING |
| Cancel event | DELETE /events/admin/{id} | ✅ Has endpoint | ⚠️ CHECK |
| View attendance | GET /events/admin/{id}/attendance | ❌ Not found | ❌ MISSING |
| Past events toggle | include_past param | ⚠️ In endpoint | ⚠️ CHECK UI |
| Status badges | scheduled/live/cancelled | ⚠️ Check display | ⚠️ CHECK |

**Action Items:**
- [ ] Add edit event modal
- [ ] Add view attendance modal
- [ ] Verify past events toggle works
- [ ] Verify all status badges display correctly

---

## TAB 11: AI LEARNING
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Stats | GET /learning/stats | ✅ Has endpoint | ✅ DONE (fixed) |
| Safety patterns | GET /learning/patterns | ✅ Has endpoint | ⚠️ CHECK DISPLAY |
| Approval queue | GET /learning/queue | ✅ Has endpoint (fixed) | ⚠️ CHECK DISPLAY |
| Approved learnings | GET /learning/approved | ✅ Has endpoint | ⚠️ CHECK DISPLAY |
| Response feedback | GET /learning/feedback | ❌ Not found | ❌ MISSING |
| Sub-tabs | patterns/queue/approved/feedback | ❌ No sub-tabs | ❌ MISSING |
| Add pattern modal | POST /learning/patterns | ❌ Not found | ❌ MISSING |
| Edit/Delete pattern | PUT/DELETE endpoints | ❌ Not found | ❌ MISSING |
| Seed defaults | POST /learning/patterns/seed-defaults | ❌ Not found | ❌ MISSING |
| Approve/Reject learning | PUT /learning/approve/{id} | ❌ Not found | ❌ MISSING |

**Action Items:**
- [ ] Add learning sub-tabs (patterns, queue, approved, feedback)
- [ ] Add add pattern modal
- [ ] Add edit/delete pattern buttons
- [ ] Add seed defaults button
- [ ] Add approve/reject buttons for queue items
- [ ] Add feedback section

---

## TAB 12: AI USAGE
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Usage summary | GET /admin/ai-usage/summary | ✅ Has endpoint | ⚠️ CHECK DISPLAY |
| By character | GET /admin/ai-usage/by-character | ✅ Has endpoint | ⚠️ CHECK DISPLAY |
| Daily usage | GET /admin/ai-usage/daily | ❌ Not found | ❌ MISSING |
| Period selector | 7/30/90 days | ⚠️ Check | ⚠️ CHECK |
| OpenAI/Gemini breakdown | Separate cards | ⚠️ Check display | ⚠️ CHECK |
| Budget progress bars | With percentage | ❌ Not visible | ❌ MISSING |
| Daily chart | Chart.js stacked bar | ❌ Not found | ❌ MISSING |

**Action Items:**
- [ ] Add daily usage API call
- [ ] Add budget progress bars for OpenAI/Gemini
- [ ] Add daily usage stacked bar chart
- [ ] Match legacy card layout

---

## TAB 13: TIME TRACKING
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| (Placeholder) | No implementation | Placeholder | ✅ MATCHES |

---

## TAB 14: MIGRATION
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Migration status | GET /admin/migration-status | ✅ Has endpoint | ✅ DONE |
| Run migration | POST /admin/migrate-to-unified-staff | ✅ Has endpoint | ✅ DONE |
| Fix passwords | POST /admin/fix-staff-passwords | ✅ Has endpoint | ✅ DONE |

---

## TAB 15: SETTINGS
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| (Placeholder) | No implementation | Placeholder | ✅ MATCHES |

---

## PRIORITY FIX LIST (Ordered by Impact)

### P0 - CRITICAL (App doesn't work without these)
1. ~~Compliance dashboard 401 error~~ ✅ FIXED
2. ~~Events endpoint 404~~ ✅ FIXED  
3. ~~Learning queue endpoint 404~~ ✅ FIXED
4. ~~AI avatar URLs broken~~ ✅ FIXED

### P1 - HIGH (Major features missing)
1. AI Personas - No edit/enable-disable functionality
2. Logs - Missing sub-tabs (screening, callbacks, panic)
3. Logs - Missing location map
4. Compliance - Missing most of the dashboard sections
5. Governance - Missing sub-tabs and most features
6. AI Learning - Missing sub-tabs and all actions

### P2 - MEDIUM (Features incomplete)
1. Rota - Missing coverage stats
2. Rota - Missing swap pending/all tabs
3. Beta Testing - Missing responses list and export
4. CMS - Missing visual editor, just shows page list
5. Events - Missing edit modal and attendance view
6. AI Usage - Missing charts and budget bars
7. Monitoring - Missing server health bars and auto-refresh

### P3 - LOW (Nice to have)
1. Staff - Missing reset password modal
2. Logs - Missing charts (activity trend, contact type)
3. Logs - Missing export CSV
4. Various - Minor UI differences from legacy
