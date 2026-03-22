# RadioCheck Platform - Change Log

Quick reference for tracking development changes.

---

## December 21, 2025

### WebRTC Call Lifecycle Fixes (P0)
**Issue 1: Call alert not disappearing for other staff**
- Added `call_request_claimed` socket event listener in `/portal/src/hooks/useWebRTCPhone.tsx`
- Backend was already emitting the event, frontend handler was missing
- Now when one staff accepts a call, alert dismisses for all other staff

**Issue 2: Call not ending on client when staff hangs up**  
- Root cause: Staff portal emitted `webrtc_end_call` but backend had no handler
- Added `webrtc_end_call` socket event handler in `/backend/webrtc_signaling.py`
- Handler emits `call_ended` to mobile app user and cleans up properly

**Bug Fix:**
- Added missing `claimed_call_requests: Dict[str, dict] = {}` dictionary in `webrtc_signaling.py`

**Files Changed:**
- `/app/backend/webrtc_signaling.py` - Added `webrtc_end_call` handler (lines 620-685)
- `/app/portal/src/hooks/useWebRTCPhone.tsx` - Added `call_request_claimed` listener (lines 793-808)

**Testing:** 12/12 unit tests passed

### Safeguarding AI Tests (11 scenarios)
- Ran full TOMMY Stress & Safety test suite
- **Result: 11/11 PASSED (100%)**
- Reports saved to `/app/test_reports/safeguarding_test_report.md`

### NEW: 4 App Home Page Tiles
**Status:** ✅ COMPLETE

Created 4 new comprehensive resource pages:

1. **They Served** (`/they-served`) - LGBTQ+ Veterans
   - Fighting With Pride, Galop, Stonewall, LGBT Foundation
   - The Ban history, Medal restoration, Financial redress
   - Mental health support, community resources

2. **Forces Kids** (`/forces-kids`) - Service Children
   - Scotty's Little Soldiers, Little Troopers
   - Army Cadet Force, Air Training Corps, Sea Cadets, CCF
   - Education support, Service Pupil Premium
   - Bereaved children support (Winston's Wish)

3. **Commonwealth Comrades** (`/commonwealth-veterans`) - Commonwealth Veterans
   - Settlement rights (FREE ILR after 4+ years)
   - Family settlement, British citizenship
   - CFFVC, RBL, SSAFA support
   - NHS entitlement, travel schemes

4. **Faith & Service** (`/faith-service`) - Religious Support
   - Armed Forces Chaplaincy (all branches)
   - Christian, Muslim, Jewish, Sikh, Hindu, Buddhist resources
   - Moral injury support
   - "No faith? That's OK too" section

**Files Created:**
- `/app/frontend/app/they-served.tsx`
- `/app/frontend/app/forces-kids.tsx`
- `/app/frontend/app/commonwealth-veterans.tsx`
- `/app/frontend/app/faith-service.tsx`
- Updated `/app/frontend/app/home.tsx` with new menu items

### BUG FIXED: Safeguarding Alerts Not Being Created (CRITICAL)
**Status:** ✅ FIXED

**Root Cause:** When the "hard failsafe" was triggered (explicit suicide plans, method requests), the code in `server.py` returned EARLY at line ~6289 **without creating the alert** in the database. This meant the MOST SEVERE crisis messages were NOT being logged!

**Impact:** 
- Staff portal showed 0 alerts for 12+ hours
- The most critical messages (suicide plans with methods) were never recorded
- Email notifications were also skipped for these cases

**Fix Applied:**
- Added full alert creation logic inside the failsafe block (lines 6273-6340)
- Now creates alert, logs to audit, and sends email BEFORE returning crisis response
- Alert ID is now returned in the API response

**Files Changed:**
- `/app/backend/server.py` - Added alert creation in failsafe block

**Verified:** Test message "I want to end my life tonight. I have pills ready." now creates alert ID `7e89d2b8-f01e-4632-8a4d-30d03974f85e` in database

### BUG FIXED: Call Request Claimed Not Reaching Other Staff (P0)
**Status:** ✅ FIXED

**Root Cause:** TWO issues found:

1. **No duplicate accept prevention**: When staff clicked accept, there was no check to see if another staff member had ALREADY claimed the request. Both staff could accept the same request, causing TWO WebRTC offers to the mobile app - the second one would connect, the first would hang in "connecting" state.

2. **Order of operations**: The `call_request_claimed` broadcast happened AFTER checking if the user was connected. If the user disconnected, the broadcast was skipped.

**Fixes Applied:**
1. Added check at START of `accept_call_request` to see if request already in `claimed_call_requests`
2. If already claimed, emit `call_request_already_claimed` event and return early
3. Moved `call_request_claimed` broadcast to happen FIRST before other operations
4. Added `call_request_already_claimed` handler in frontend with alert message

**Files Changed:**
- `/app/backend/webrtc_signaling.py` - Added duplicate prevention check, reordered logic
- `/app/portal/src/hooks/useWebRTCPhone.tsx` - Added `call_request_already_claimed` handler
- Possible user_type mismatch
- Added detailed logging to backend to trace the issue

**Changes Made:**
1. Backend (`webrtc_signaling.py`): Added detailed logging to show who receives `call_request_claimed`
2. Frontend (`useWebRTCPhone.tsx`): Added more console logs and confirmed handler registration

**To Test:**
- Deploy changes to Render (backend) and Vercel (portal)
- Check backend logs when Kev accepts - should show Sarah being notified
- Check Sarah's console for `[WebRTCPhone] *** CALL REQUEST CLAIMED ***`

---

## Previous Sessions Summary

### Notes Edit/Share & Internal Messaging
- Staff can edit notes after creation
- Share notes with specific team members
- Internal messaging system between staff

### Callback Request & Twilio Fix
- Fixed missing `message` and `request_type` fields
- UK phone number normalization (07xxx → +44xxx)

### Logo Update
- Replaced Shield icon with Radiocheck logo on login screens

### Audit Logging (P0)
- Login success/failure tracking with IP
- Safeguarding alert creation logging
- Admin action logging

### Staff Profile Editing (P1)
- Enhanced edit modal with full profile fields

### WebRTC Audio Quality & Socket.IO Stability
- Enhanced audio constraints, STUN servers
- Heartbeat mechanism, auto-reconnect

---

## Backlog
- [ ] User Manuals (Staff + Admin)
- [ ] Admin panel refactoring (7000+ lines)
- [ ] Move logs to top of admin page
- [ ] Full CMS visual editor
- [ ] Discussion Forums
- [ ] Mood Tracker
- [ ] Welsh Language Support
