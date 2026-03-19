# Admin Portal Fixes Summary
## March 2026

### Phase 1: Logs Tab Complete Overhaul

**Sub-tabs added:**
- ✅ Calls (existing)
- ✅ Chats (enhanced with View button + chat history modal)
- ✅ Safeguarding (enhanced with View/Acknowledge/Resolve actions + detail modal)
- ✅ Screening (NEW - shows screening submissions with risk scores)
- ✅ Callbacks (NEW - shows callback requests with type/status)
- ✅ Panic (NEW - shows panic alerts with location/responder)
- ✅ Audit (NEW - shows audit logs with event type filtering)

**API Endpoints added:**
- `GET /admin/logs/calls`
- `GET /admin/logs/chats`
- `GET /admin/logs/safeguarding`
- `GET /admin/logs/screening`
- `GET /admin/logs/callbacks`
- `GET /admin/logs/panic`
- `PATCH /safeguarding-alerts/{id}/acknowledge`
- `PATCH /safeguarding-alerts/{id}/resolve`
- `GET /safeguarding-alerts/{id}` (detail)
- `GET /live-chat/rooms/{id}/messages` (chat history)

**UI Features:**
- Chat history modal
- Safeguarding alert detail modal with tracking info, conversation history
- Audit log filtering by event type prefix
- Color-coded badges for risk levels, statuses, event types
- Urgent row highlighting for panic alerts

---

### Phase 2: Settings Tab Complete Rewrite

**Features added:**
- ✅ Logo display and URL input
- ✅ Email settings (admin notification, CSO, peer registration)
- ✅ Clear logs panel with type selection
- ✅ "DELETE ALL" confirmation for dangerous operations
- ✅ System info display

**API Endpoints added:**
- `GET /settings`
- `PUT /settings`
- `POST /admin/clear-logs`

---

### Phase 3: Session Management

**Features added:**
- ✅ 2-hour inactivity timeout
- ✅ 24-hour absolute token expiry
- ✅ Activity tracking (mousedown, mousemove, keydown, scroll, touchstart, click)
- ✅ Token time stored in localStorage
- ✅ URL security stripping (?password=, ?email=)
- ✅ Silent logout on expiry

---

### Earlier Fixes (carried over)

- ✅ Governance tab: 7 sub-tabs (Hazards, KPIs, Incidents, Moderation, CSO Approvals, Compliance, Reports)
- ✅ AI Personas Edit modal: All fields (ID, Bio, Category, Avatar, System Prompt)
- ✅ Logs tab return_rate error: Fixed object rendering
- ✅ Location Map: Added Leaflet map with markers

---

### Remaining Items (Not Yet Done)

**Phase 3 Remaining:**
- [ ] Compliance dashboard: GDPR metrics, staff wellbeing, open incidents/complaints lists
- [ ] Rota: Coverage stats, swap request management
- [ ] Monitoring: Server health progress bars, auto-refresh

**Future:**
- [ ] AI Learning tab (4 sub-tabs)
- [ ] Analytics charts (Chart.js)
- [ ] Full CMS visual editor

---

### Files Modified

- `/app/portal/src/app/admin/page.tsx` - Main admin page
- `/app/portal/src/app/components/LocationMap.tsx` - Leaflet map component

### Dependencies Added

- `react-leaflet`
- `leaflet`
- `@types/leaflet`
