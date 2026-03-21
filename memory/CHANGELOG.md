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

**Symptoms:**
- When Kev (peer) accepts a call, Sarah's browser keeps ringing
- The `call_request_claimed` event is NOT reaching Sarah's console
- Sarah only sees `[WebRTCPhone] Dismissing request` when manually dismissed

**Root Cause Investigation:**
- Backend loop at line 1226 may not be finding Sarah's socket
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
