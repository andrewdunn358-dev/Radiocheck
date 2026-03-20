# ADMIN PORTAL COMPARISON: Legacy vs React

## PROGRESS UPDATE - March 2026 (Session 2)

### NEWLY COMPLETED FIXES (This Session):
1. ✅ Staff - Reset password modal (POST /auth/admin-reset-password)
2. ✅ Logs - Activity trend chart (Chart.js line - Calls/Chats/Alerts over 7 days)
3. ✅ Logs - Contact type chart (Chart.js doughnut - counsellor/peer/org/crisis_line)
4. ✅ Logs - Export CSV button (client-side, exports current sub-tab)
5. ✅ Logs - Clear logs button (POST /admin/clear-logs with confirmation)
6. ✅ AI Usage - Daily usage chart (Chart.js stacked bar with period selector)
7. ✅ AI Usage - Budget progress bars (color-coded: green<50%, amber 50-80%, red>80%)
8. ✅ Rota - Swap request Pending/All tab switcher with functional Approve/Reject buttons
9. ✅ Events - Edit event modal (PUT /events/admin/{id})
10. ✅ Events - View attendance modal (GET /events/admin/{id}/attendance)
11. ✅ Compliance - Document download links (Safeguarding, GDPR, Code of Conduct, Complaints)
12. ✅ Monitoring - Last updated timestamp
13. ✅ Monitoring - Auto-refresh every 30 seconds with cleanup on unmount
14. ✅ Fixed react-leaflet version conflict (downgraded to 4.2.1 for React 18 compatibility)

### PREVIOUSLY COMPLETED FIXES:
1. ✅ Staff - Status toggle buttons (Available/Busy/Off for counsellors, Available/Limited/Unavailable for peers)
2. ✅ Rota - Coverage stats section (Counsellors Today, Peers Today, Shifts This Week, Coverage Gaps)
3. ✅ Rota - Full interactive monthly calendar view
4. ✅ CMS - Load Defaults button, shows page content (title, sections, cards)
5. ✅ AI Personas - Edit modal, Enable/Disable toggle, Import Defaults button
6. ✅ Beta Testing - Survey responses list, Export CSV button
7. ✅ Compliance - Staff Wellbeing section, Run Security Review button, expanded metrics
8. ✅ Logs - App Usage Analytics, Daily/Browser/Device charts
9. ✅ Monitoring - Server health progress bars (CPU, Memory, Load), proper stats layout
10. ✅ Governance - Weekly/Monthly report buttons, full report display with KPIs, recommendations
11. ✅ Events - Create Event modal, Cancel button on events
12. ✅ AI Learning - Seed Defaults button, working Approve/Reject buttons
13. ✅ AI Usage - Character usage list
14. ✅ Time Tracking - Loads real data from backend

### ALSO FIXED:
- `.toFixed()` crash on non-numeric values (DATA TYPE ENFORCEMENT - added Number() wrapping)
- Legacy admin `loadDashboardData` → `loadLogsData` bug
- Compliance backend 401 auth error
- Login autocomplete warnings

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
| Add staff modal | Full form | ✅ Has modal | ✅ DONE |
| Edit staff modal | Full form | ✅ Has modal | ✅ DONE |
| Delete staff | DELETE endpoint | ✅ Has endpoint | ✅ DONE |
| Reset password modal | Modal with confirm | ✅ POST /auth/admin-reset-password | ✅ DONE |

---

## TAB 2: ROTA
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Monthly calendar view | Full calendar | ✅ Interactive calendar | ✅ DONE |
| Today's shifts | GET /shifts/ filtered | ✅ Has | ✅ DONE |
| Tomorrow's shifts | GET /shifts/ filtered | ✅ Has | ✅ DONE |
| Coverage stats | Calculated from shifts | ✅ Visible | ✅ DONE |
| Swap requests list | GET /shift-swaps/needs-approval | ✅ Has endpoint | ✅ DONE |
| Approve/Reject swap | POST /shift-swaps/{id}/approve | ✅ Functional | ✅ DONE |
| Pending/All tabs | Tab switcher | ✅ Implemented | ✅ DONE |
| Add Shift button | Modal | ✅ Has | ✅ DONE |

---

## TAB 3: CMS
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Page list | GET /cms/pages | ✅ Has endpoint | ✅ DONE |
| Page content | GET /cms/pages/{slug} | ✅ Has endpoint | ✅ DONE |
| Load defaults | POST /cms/seed-public | ✅ Has | ✅ DONE |
| Visual editor | Full WYSIWYG | ❌ Not implemented | ❌ MISSING |
| Preview iframe | Live preview | ❌ Not implemented | ❌ MISSING |

**Remaining Action Items:**
- [ ] CMS visual editor (FUTURE - complex feature)

---

## TAB 4: AI PERSONAS
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Character list | GET /ai-characters/admin/all | ✅ Has endpoint | ✅ DONE |
| Avatar display | API_URL + path | ✅ Fixed with resolveAvatarUrl | ✅ DONE |
| Enable/Disable toggle | PATCH /ai-characters/admin/{id}/status | ✅ Has | ✅ DONE |
| Edit character modal | PUT /ai-characters/admin/{id} | ✅ Has | ✅ DONE |
| Import defaults | POST /ai-characters/seed-from-hardcoded | ✅ Has | ✅ DONE |

---

## TAB 5: BETA TESTING
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Beta enabled status | GET /surveys/beta-enabled | ✅ Has endpoint | ✅ DONE |
| Toggle beta mode | POST /surveys/beta-enabled | ✅ Has endpoint | ✅ DONE |
| Stats display | GET /surveys/stats | ✅ Has endpoint | ✅ DONE |
| Survey responses list | GET /surveys/responses | ✅ Displayed | ✅ DONE |
| Export CSV | Link to /surveys/export | ✅ Has | ✅ DONE |
| Improvement metrics | wellbeing/anxiety/mood change | ✅ Color coded | ✅ DONE |

---

## TAB 6: COMPLIANCE
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Dashboard data | GET /compliance/dashboard | ✅ Has endpoint | ✅ DONE |
| GDPR metrics | consent_rate, exports, deletions | ✅ Displayed | ✅ DONE |
| Staff wellbeing | checkins, support, supervision | ✅ Displayed | ✅ DONE |
| Security status | last_review_status, incidents | ✅ Displayed | ✅ DONE |
| Incidents list | GET /compliance/incidents | ✅ Has endpoint | ✅ DONE |
| Complaints list | GET /compliance/complaints | ✅ Has endpoint | ✅ DONE |
| Run security review | POST /compliance/security/automated-review | ✅ Has | ✅ DONE |
| Document download links | Static PDF links | ✅ Added | ✅ DONE |
| Report incident modal | POST /compliance/incidents | ⚠️ PARTIAL | ⚠️ CHECK |

---

## TAB 7: LOGS & ANALYTICS
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Call logs | GET /call-logs | ✅ Has endpoint | ✅ DONE |
| Chat rooms | GET /live-chat/rooms | ✅ Has endpoint | ✅ DONE |
| Safeguarding alerts | GET /safeguarding-alerts | ✅ Has endpoint | ✅ DONE |
| Screening submissions | GET /safeguarding/screening-submissions | ✅ Has endpoint | ✅ DONE |
| Callbacks | GET /callbacks | ✅ Has endpoint | ✅ DONE |
| Panic alerts | GET /panic-alerts | ✅ Has endpoint | ✅ DONE |
| Audit logs | GET /admin/audit-logs | ✅ Has endpoint | ✅ DONE |
| AI chat stats | GET /ai-chat/stats | ✅ Has endpoint | ✅ DONE |
| App usage stats | GET /analytics/usage | ✅ Has endpoint | ✅ DONE |
| Location map | Leaflet | ✅ Has | ✅ DONE |
| Sub-tabs | 7 tabs | ✅ All present | ✅ DONE |
| Activity trend chart | Chart.js line | ✅ Added | ✅ DONE |
| Contact type chart | Chart.js doughnut | ✅ Added | ✅ DONE |
| Export CSV | Custom function | ✅ Added | ✅ DONE |
| Clear logs | POST /admin/clear-logs | ✅ Added | ✅ DONE |

---

## TAB 8: MONITORING
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| System stats | GET /admin/system-stats | ✅ Has endpoint | ✅ DONE |
| User stats | total_registered, connected_staff | ✅ Displayed | ✅ DONE |
| Activity stats | calls, AI sessions, chats, callbacks | ✅ Displayed | ✅ DONE |
| Server health bars | CPU, memory, load | ✅ Visible | ✅ DONE |
| Auto-refresh | 30 second interval | ✅ Implemented | ✅ DONE |
| Last updated timestamp | Shows time | ✅ Added | ✅ DONE |

---

## TAB 9: GOVERNANCE
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Hazards list | GET /governance/hazards | ✅ Has endpoint | ✅ DONE |
| Summary report | GET /governance/summary-report | ✅ Has endpoint | ✅ DONE |
| KPIs | GET /governance/kpis | ✅ Has | ✅ DONE |
| Sub-tabs | All 7 tabs | ✅ Has | ✅ DONE |
| Add hazard | POST /governance/hazards | ✅ Has | ✅ DONE |
| Generate report button | Weekly/Monthly options | ✅ Has | ✅ DONE |

---

## TAB 10: EVENTS
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Events list | GET /events/admin/all | ✅ Has endpoint | ✅ DONE |
| Create event | POST /events/admin/create | ✅ Has endpoint | ✅ DONE |
| Edit event | PUT /events/admin/{id} | ✅ Added | ✅ DONE |
| Cancel event | DELETE /events/admin/{id} | ✅ Has endpoint | ✅ DONE |
| View attendance | GET /events/admin/{id}/attendance | ✅ Added | ✅ DONE |

---

## TAB 11: AI LEARNING
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Stats | GET /learning/stats | ✅ Has endpoint | ✅ DONE |
| Safety patterns | GET /learning/patterns | ✅ Has | ✅ DONE |
| Approval queue | GET /learning/queue | ✅ Has endpoint | ✅ DONE |
| Approved learnings | GET /learning/approved | ✅ Has endpoint | ✅ DONE |
| Sub-tabs | 4 tabs | ✅ Has | ✅ DONE |
| Seed defaults | POST /learning/patterns/seed-defaults | ✅ Has | ✅ DONE |
| Approve/Reject learning | PUT /learning/approve/{id} | ✅ Has | ✅ DONE |

---

## TAB 12: AI USAGE
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Usage summary | GET /admin/ai-usage/summary | ✅ Has endpoint | ✅ DONE |
| By character | GET /admin/ai-usage/by-character | ✅ Has endpoint | ✅ DONE |
| Daily usage | GET /admin/ai-usage/daily | ✅ Added | ✅ DONE |
| Period selector | 7/14/30/60/90 days | ✅ Has | ✅ DONE |
| OpenAI/Gemini breakdown | Separate cards | ✅ Displayed | ✅ DONE |
| Budget progress bars | With percentage, color-coded | ✅ Added | ✅ DONE |
| Daily chart | Chart.js stacked bar | ✅ Added | ✅ DONE |

---

## TAB 13: TIME TRACKING
| Feature | Legacy | React | Status |
|---------|--------|-------|--------|
| Summary stats | GET /timetracking/summary | ✅ Has | ✅ DONE |
| Entries list | GET /timetracking/entries | ✅ Has | ✅ DONE |

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
| Logo upload | File upload | ⚠️ CHECK | ⚠️ PARTIAL |
| Email fields | admin/cso/peer emails | ⚠️ CHECK | ⚠️ PARTIAL |

---

## REMAINING ITEMS

### P1 - MEDIUM (Nice to have)
1. CMS - Visual editor (complex feature - would need significant work)
2. Settings - Verify logo upload and email fields work properly

### P2 - LOW (Future)
1. CMS - Preview iframe
2. Staff - Verify all Add/Edit modal fields match legacy exactly

---

## DATA TYPE ENFORCEMENT STATUS
All numeric fields now use Number() wrapper before calling .toFixed():
- ✅ aiUsage.total_cost_gbp
- ✅ aiUsage.providers.openai.cost_gbp
- ✅ aiUsage.providers.openai.budget_limit_gbp
- ✅ aiUsage.providers.openai.budget_remaining_gbp
- ✅ aiUsage.providers.openai.budget_percentage_used
- ✅ aiUsage.providers.gemini.* (same fields)
- ✅ by_character[].cost_gbp
- ✅ daily_usage[].cost_gbp
