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
