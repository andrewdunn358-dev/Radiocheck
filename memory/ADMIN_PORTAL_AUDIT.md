# Admin Portal Full Audit & Refactoring Plan

## File: `/app/portal/src/app/admin/page.tsx`
## Total Lines: 7,229
## Date: December 2025

---

## EXECUTIVE SUMMARY

The admin portal is a **monolithic** React component containing:
- **15 main tabs** with complex functionality
- **7 log sub-tabs** within the Logs tab
- **7 governance sub-tabs** within the Governance tab
- **4 learning sub-tabs** within the AI Learning tab
- **~90+ state variables**
- **~50+ API endpoint functions**
- **~20+ handler functions**
- **Multiple modal dialogs**

This file is **impossible to maintain** in its current state and represents significant technical debt.

---

## FILE STRUCTURE BREAKDOWN

### Lines 1-59: Imports & Configuration
- React imports
- Lucide icons (50+ icons)
- Chart.js imports and registration
- Dynamic import for LocationMap
- API URL configuration
- Avatar URL resolver helper

### Lines 60-168: TypeScript Interfaces
- `User` - Basic user info
- `StaffMember` - Staff with profile details
- `CallLog` - Call logging
- `ChatRoom` - Live chat rooms
- `SafeguardingAlert` - Risk alerts with full details
- `AICharacter` - AI persona configuration
- `AIUsageSummary` - AI cost/usage tracking

### Lines 169-619: API Client Object (~450 lines)
Contains 60+ API methods organized by feature:
- Auth (login)
- Staff Management (CRUD, status updates)
- Migration endpoints
- Logs (calls, chats, safeguarding, screening, callbacks, panic, audit)
- AI Characters
- AI Usage
- Monitoring
- Rota/Shifts
- Events
- CMS
- Compliance
- Governance (hazards, KPIs, incidents, moderation, approvals, reports)
- Learning (patterns, queue, feedback)
- Beta Testing
- Time Tracking
- Settings

### Lines 620-648: Tab Definitions
- `TABS` array - 15 main tabs
- `LOG_SUBTABS` array - 7 sub-tabs

### Lines 650-835: State Declarations (~185 lines!)
**This is a major problem** - ~90 useState calls including:
- Auth state (token, user)
- UI state (activeTab, sidebarOpen, errors)
- Login state
- Data state for all tabs
- Modal states
- Form states
- Filter states

### Lines 837-989: useEffect Hooks
- Session restore
- Session timeout management
- Data loading on tab change
- Monitoring auto-refresh
- Alert counter polling

### Lines 991-1410: Data Loading Functions (~420 lines)
- `loadStaff()` - with legacy fallbacks
- `loadLogs()` - loads app usage + sub-tab data
- `loadAICharacters()`
- `loadAIUsage()`
- `loadMonitoring()`
- `loadMigrationStatus()`
- `loadRota()`
- `loadEvents()`
- `loadCMS()`
- `loadCompliance()`
- `loadGovernance()` + `loadGovernanceSubTabData()`
- `loadLearning()`
- `loadBetaTesting()`
- `loadTimeTracking()`
- Various handlers for time entries

### Lines 1411-1505: Event Handlers
- `handleLogin()`
- `handleLogout()`
- `handleCreateStaff()`
- `handleUpdateStaff()`
- `handleDeleteStaff()`
- `handleRunMigration()`
- `handleFixPasswords()`
- Staff filtering logic

### Lines 1506-1590: Loading & Login Screens
- Loading spinner
- Login form UI

### Lines 1590-1850: Main Layout & Staff Tab (~260 lines)
- Sidebar navigation
- Header with alert badge
- Staff tab with search, filter, table, status buttons

### Lines 1850-3054: Logs Tab (~1200 lines!)
- Stats summary cards
- App usage analytics section
- Location map
- AI chat stats
- Sub-tab navigation
- **Calls sub-tab** - call logs table
- **Chats sub-tab** - chat rooms table with history modal
- **Safeguarding sub-tab** - alerts table with detail modal
- **Screening sub-tab** - submissions table
- **Callbacks sub-tab** - callback requests table
- **Panic sub-tab** - panic alerts table
- **Audit sub-tab** - audit logs with filter

### Lines 3054-3342: AI Personas Tab (~290 lines)
- Character grid with cards
- Enable/disable toggles
- Edit modal
- Character editing form

### Lines 3342-3574: AI Usage Tab (~230 lines)
- Provider breakdown cards
- Usage by character table
- Daily usage chart
- Period selector

### Lines 3574-3693: Monitoring Tab (~120 lines)
- System stats cards
- Auto-refresh indicator

### Lines 3693-3756: Migration Tab (~60 lines)
- Migration status display
- Run migration button
- Fix passwords button

### Lines 3756-4292: Rota Tab (~540 lines)
- Calendar view with monthly navigation
- Shifts display
- Pending swap requests
- Add shift modal
- Delete shift functionality

### Lines 4292-4405: CMS Tab (~110 lines)
- Pages list
- Seed defaults button
- Basic page editing (incomplete)

### Lines 4405-4577: Beta Testing Tab (~170 lines)
- Beta status toggle
- Stats display
- Recent responses table

### Lines 4577-4785: Compliance Tab (~210 lines)
- Dashboard metrics
- Incidents list
- Complaints list
- Audit logs

### Lines 4785-5557: Governance Tab (~770 lines)
With 7 sub-tabs:
- **Hazards** - hazard registry with review button
- **KPIs** - key performance indicators
- **Incidents** - incident list
- **Moderation** - peer reports with action buttons
- **Approvals** - CSO approval queue
- **Compliance** - compliance checker
- **Reports** - summary reports, email, scheduling

### Lines 5557-5872: Events Tab (~315 lines)
- Events table
- Add/Edit event modal
- View attendance modal
- Delete functionality

### Lines 5872-6190: AI Learning Tab (~320 lines)
With 4 sub-tabs:
- **Patterns** - safety patterns with filters
- **Queue** - moderation queue
- **Approved** - approved learnings
- **Feedback** - response feedback

### Lines 6190-6443: Time Tracking Tab (~250 lines)
- Monthly summary
- Categories breakdown
- Entries table
- Add entry modal

### Lines 6443-6845: Settings Tab (~400 lines)
- Logo upload
- Email notifications settings
- Clear logs (danger zone)
- System information
- Feature toggles
- CMS seed button
- AI character seed button

### Lines 6845-7230: Modals (~385 lines)
- Add Staff Modal
- Edit Staff Modal (comprehensive profile editor)
- Reset Password Modal
- Chat History Modal
- Safeguarding Alert Detail Modal
- AI Character Edit Modal
- Event Edit Modal
- View Attendance Modal
- Add Time Entry Modal

---

## TAB-BY-TAB FUNCTIONALITY SUMMARY

| Tab | Sub-tabs | Lines | Key Features |
|-----|----------|-------|--------------|
| Staff | - | ~260 | Search, filter, table, status toggle, CRUD, password reset |
| Logs | 7 | ~1200 | Analytics dashboard, call/chat/safeguarding/screening/callback/panic/audit logs |
| AI Personas | - | ~290 | Character grid, enable/disable, edit personas |
| AI Usage | - | ~230 | Cost tracking, provider breakdown, daily chart |
| Monitoring | - | ~120 | System stats, auto-refresh |
| Migration | - | ~60 | Database migration tools |
| Rota | - | ~540 | Calendar, shifts, swap requests |
| CMS | - | ~110 | Page management (basic) |
| Beta | - | ~170 | Beta testing toggle, responses |
| Compliance | - | ~210 | Dashboard, incidents, complaints |
| Governance | 7 | ~770 | Hazards, KPIs, incidents, moderation, approvals, reports |
| Events | - | ~315 | Event CRUD, attendance tracking |
| AI Learning | 4 | ~320 | Patterns, queue, approved, feedback |
| Time Tracking | - | ~250 | Monthly summary, entries |
| Settings | - | ~400 | System settings, feature toggles |

---

## REFACTORING PLAN

### Phase 1: Extract Shared Infrastructure
**Files to create:**

1. `/app/portal/src/lib/admin-api.ts` (~450 lines)
   - Move the entire `api` object
   - Export typed API client

2. `/app/portal/src/types/admin.ts` (~150 lines)
   - All TypeScript interfaces
   - Shared types

3. `/app/portal/src/hooks/useAdminAuth.ts` (~100 lines)
   - Token management
   - Session timeout
   - Login/logout handlers

4. `/app/portal/src/contexts/AdminContext.tsx` (~80 lines)
   - Shared state context
   - Error/success notifications

### Phase 2: Extract Tab Components
**Create `/app/portal/src/components/admin/tabs/` folder:**

| Component | Current Lines | Priority |
|-----------|--------------|----------|
| `StaffTab.tsx` | ~260 | P0 |
| `LogsTab/index.tsx` | ~200 | P0 |
| `LogsTab/CallsSubTab.tsx` | ~100 | P1 |
| `LogsTab/ChatsSubTab.tsx` | ~150 | P1 |
| `LogsTab/SafeguardingSubTab.tsx` | ~300 | P1 |
| `LogsTab/ScreeningSubTab.tsx` | ~100 | P1 |
| `LogsTab/CallbacksSubTab.tsx` | ~80 | P1 |
| `LogsTab/PanicSubTab.tsx` | ~80 | P1 |
| `LogsTab/AuditSubTab.tsx` | ~100 | P1 |
| `AIPersonasTab.tsx` | ~290 | P1 |
| `AIUsageTab.tsx` | ~230 | P1 |
| `MonitoringTab.tsx` | ~120 | P2 |
| `MigrationTab.tsx` | ~60 | P2 |
| `RotaTab.tsx` | ~540 | P1 |
| `CMSTab.tsx` | ~110 | P2 |
| `BetaTestingTab.tsx` | ~170 | P2 |
| `ComplianceTab.tsx` | ~210 | P1 |
| `GovernanceTab/index.tsx` | ~150 | P1 |
| `GovernanceTab/HazardsSubTab.tsx` | ~100 | P2 |
| `GovernanceTab/KPIsSubTab.tsx` | ~100 | P2 |
| `GovernanceTab/IncidentsSubTab.tsx` | ~80 | P2 |
| `GovernanceTab/ModerationSubTab.tsx` | ~100 | P2 |
| `GovernanceTab/ApprovalsSubTab.tsx` | ~100 | P2 |
| `GovernanceTab/ComplianceSubTab.tsx` | ~80 | P2 |
| `GovernanceTab/ReportsSubTab.tsx` | ~150 | P2 |
| `EventsTab.tsx` | ~315 | P1 |
| `LearningTab/index.tsx` | ~100 | P1 |
| `LearningTab/PatternsSubTab.tsx` | ~100 | P2 |
| `LearningTab/QueueSubTab.tsx` | ~80 | P2 |
| `LearningTab/ApprovedSubTab.tsx` | ~60 | P2 |
| `LearningTab/FeedbackSubTab.tsx` | ~80 | P2 |
| `TimeTrackingTab.tsx` | ~250 | P2 |
| `SettingsTab.tsx` | ~400 | P1 |

### Phase 3: Extract Modal Components
**Create `/app/portal/src/components/admin/modals/` folder:**

| Modal | Lines | Priority |
|-------|-------|----------|
| `AddStaffModal.tsx` | ~100 | P0 |
| `EditStaffModal.tsx` | ~200 | P0 |
| `ResetPasswordModal.tsx` | ~50 | P1 |
| `ChatHistoryModal.tsx` | ~60 | P1 |
| `SafeguardingAlertModal.tsx` | ~150 | P1 |
| `AICharacterModal.tsx` | ~150 | P1 |
| `EventModal.tsx` | ~150 | P1 |
| `AttendanceModal.tsx` | ~60 | P2 |
| `AddTimeEntryModal.tsx` | ~80 | P2 |
| `AddShiftModal.tsx` | ~80 | P2 |

### Phase 4: Extract Shared UI Components
**Create `/app/portal/src/components/admin/ui/` folder:**

| Component | Purpose |
|-----------|---------|
| `AdminSidebar.tsx` | Navigation sidebar |
| `AdminHeader.tsx` | Header with alert badge |
| `StatsCard.tsx` | Reusable stats card |
| `DataTable.tsx` | Generic data table |
| `TabNavigation.tsx` | Sub-tab navigation |
| `StatusBadge.tsx` | Status indicator |
| `ConfirmDialog.tsx` | Confirmation modal |

---

## IMPLEMENTATION ORDER

### Step 1: Infrastructure (Day 1)
1. Create `admin-api.ts` with full API client
2. Create `admin.ts` types file
3. Create `useAdminAuth.ts` hook
4. Create `AdminContext.tsx`
5. Update main page to use new infrastructure

### Step 2: Extract High-Priority Tabs (Day 2-3)
1. `StaffTab.tsx` with `AddStaffModal.tsx` and `EditStaffModal.tsx`
2. `SettingsTab.tsx`
3. `AIPersonasTab.tsx` with `AICharacterModal.tsx`

### Step 3: Extract Logs Tab (Day 4-5)
1. `LogsTab/index.tsx` (main container with analytics)
2. All 7 sub-tab components
3. `ChatHistoryModal.tsx`
4. `SafeguardingAlertModal.tsx`

### Step 4: Extract Remaining P1 Tabs (Day 6-7)
1. `RotaTab.tsx` with `AddShiftModal.tsx`
2. `ComplianceTab.tsx`
3. `EventsTab.tsx` with `EventModal.tsx`, `AttendanceModal.tsx`
4. `GovernanceTab/` folder

### Step 5: Extract P2 Tabs (Day 8-10)
1. `AIUsageTab.tsx`
2. `MonitoringTab.tsx`
3. `MigrationTab.tsx`
4. `CMSTab.tsx`
5. `BetaTestingTab.tsx`
6. `LearningTab/` folder
7. `TimeTrackingTab.tsx`

### Step 6: Final Cleanup
1. Extract shared UI components
2. Add proper error boundaries
3. Add loading skeletons
4. Add TypeScript strict checks
5. Update imports throughout

---

## EXPECTED OUTCOMES

### Before Refactoring
- **1 file**: 7,229 lines
- **Maintainability**: Very poor
- **Testability**: Nearly impossible
- **Developer experience**: Frustrating

### After Refactoring
- **~50 files**: Average 100-150 lines each
- **Maintainability**: Excellent
- **Testability**: Each component can be unit tested
- **Developer experience**: Pleasant, intuitive

### Main Page After Refactoring (~200 lines)
```tsx
// /app/portal/src/app/admin/page.tsx
'use client';

import { AdminProvider } from '@/contexts/AdminContext';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import AdminSidebar from '@/components/admin/ui/AdminSidebar';
import AdminHeader from '@/components/admin/ui/AdminHeader';
import StaffTab from '@/components/admin/tabs/StaffTab';
import LogsTab from '@/components/admin/tabs/LogsTab';
// ... other tab imports

export default function AdminPortal() {
  const { token, user, isLoading, login, logout } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('staff');

  if (isLoading) return <LoadingSpinner />;
  if (!token) return <LoginForm onLogin={login} />;

  return (
    <AdminProvider>
      <div className="min-h-screen bg-gray-900 text-white flex">
        <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 overflow-auto">
          <AdminHeader />
          <div className="p-6">
            {activeTab === 'staff' && <StaffTab />}
            {activeTab === 'logs' && <LogsTab />}
            {/* ... other tabs */}
          </div>
        </main>
      </div>
    </AdminProvider>
  );
}
```

---

## RISK ASSESSMENT

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing functionality | Medium | High | Incremental refactoring, test each tab |
| Inconsistent styling | Low | Medium | Keep existing CSS classes |
| State management issues | Medium | High | Use context carefully, test state flow |
| API call failures | Low | Medium | Keep API client unchanged initially |

---

## RECOMMENDATION

**Start with Phase 1 (Infrastructure)** to establish the foundation, then **incrementally extract one tab at a time**, testing thoroughly after each extraction. This approach minimizes risk while steadily reducing the file size.

**Priority order for tab extraction:**
1. Staff (most used, straightforward)
2. Settings (self-contained)
3. AI Personas (moderate complexity)
4. Logs (complex but critical)
5. Rest of tabs in parallel

The refactoring can be done safely without breaking the production application if we:
1. Keep the main file working throughout
2. Extract and test one component at a time
3. Use the same API client and types throughout
4. Maintain existing CSS classes and styling
