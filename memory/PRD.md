# Radio Check - Product Requirements Document

## Project Overview
**Radio Check** is a mental health and peer support application for veterans.

---

## Session Summary - February 24, 2026 (Latest Update)

### ✅ Completed This Session (Latest Fork)

**🐛 Bug Fix - Counsellor Status 422 Error (Complete):**
- Fixed `PATCH /api/counsellors/{user_id}/status` endpoint returning 422 Unprocessable Content
- **Root Cause**: Pydantic validation pattern `^(available|busy|off)$` didn't match UI values (`limited`, `unavailable`)
- **Fix**: Updated `CounsellorStatusUpdate` model in `server.py` to accept `^(available|limited|unavailable)$`
- **File Changed**: `/app/backend/server.py` line 1080

**✅ Verified Working:**
- Callback request flow - creates callback and shows success confirmation page
- Staff portal can view all callbacks via `/api/callbacks`
- Auto-refresh every 30 seconds in staff portal

---

## Session Summary - February 23, 2026

### ✅ Completed That Session

**🔧 Production Deployment Fixes (Complete):**
1. ✅ **API URL Failsafe** - Created `/frontend/src/config/api.ts`
   - Prevents production builds from using preview URLs
   - Automatically falls back to production backend if misconfigured
   - Logs warnings when failsafe activates

2. ✅ **Updated ALL 20+ Frontend Files** to use safe API config:
   - `counsellors.tsx`, `peer-support.tsx` - Contact pages
   - `ai-buddies.tsx`, `ai-chat.tsx` - AI chat screens
   - `tommy-chat.tsx`, `doris-chat.tsx`, `hugo-chat.tsx`, `bob-chat.tsx`, `margie-chat.tsx`, `sentry-chat.tsx` - Individual AI persona screens
   - `organizations.tsx`, `resources.tsx` - Directory pages
   - `family-friends.tsx` - Family support
   - `counsellor-portal.tsx`, `peer-portal.tsx`, `admin.tsx` - Staff screens
   - `mental-health-screening.tsx` - PHQ-9/GAD-7 screening
   - `buddy-finder.tsx`, `live-chat.tsx`, `callback.tsx` - Communication features
   - `your-data-rights.tsx`, `my-availability.tsx` - Settings
   - `forgot-password.tsx`, `reset-password.tsx` - Auth flows
   - `podcasts.tsx` - Removed hardcoded preview URL

3. ✅ **Cron Job Helper** - Created `/backend/cron_runner.py`
   - Simplifies Render cron job setup
   - Handles path setup automatically
   - Commands: `shift_reminders`, `data_retention`

4. ✅ **Production Deployment Guide** - Created `/docs/PRODUCTION_DEPLOYMENT.md`
   - Complete architecture overview
   - Environment variables documentation
   - Cron job setup instructions
   - Troubleshooting guide

**📋 Verified Working:**
- Authentication flow (login, JWT tokens, protected endpoints)
- AI Buddies (Tommy and Doris) displaying correctly
- Mental Health Screening page
- All API endpoints tested and passing

---

### Previously Completed

**🩺 PHQ-9 / GAD-7 Mental Health Screening (Complete):**
- PHQ-9 (Depression) - 9 questions
- GAD-7 (Anxiety) - 7 questions
- Score interpretation with severity levels
- Share results with counsellor feature
- Crisis helpline links for severe cases

**🔄 Shift Swap / Cover Requests (Complete):**
- Full API for shift swaps
- Admin approval workflow
- Staff portal integration
- Email notifications

**📊 Earlier Features:**
- Staff Rota Dashboard (Admin + Staff portals)
- Cookie consent banners
- Report an Issue button
- Email shift reminders
- AI consent modals
- Mood tracking graph

---

## Production Deployment

### Architecture
```
Vercel (app.radiocheck.me)  →  Render (veterans-support-api.onrender.com)
20i (admin.radiocheck.me)   →  Render
20i (staff.radiocheck.me)   →  Render
```

### Cron Jobs (Render)
- **shift_reminders**: `cd backend && python cron_runner.py shift_reminders` (every 15 min)
- **data_retention**: `cd backend && python cron_runner.py data_retention` (daily 3 AM)

### Key Files for Deployment
- `/frontend/src/config/api.ts` - API URL failsafe
- `/backend/cron_runner.py` - Cron job runner
- `/docs/PRODUCTION_DEPLOYMENT.md` - Full deployment guide

---

## Remaining Tasks

### High Priority (P0)
- [x] API URL failsafe for production - DONE
- [x] Cron job setup helper - DONE

### Medium Priority (P1)
- [ ] Push notifications integration
- [ ] DPIA document for AI processing

### Future / Backlog
- [ ] Welsh language support
- [ ] SMS text reminders (Twilio)
- [ ] Structured CBT courses
- [ ] Consolidate AI chat screens into reusable component

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@veteran.dbty.co.uk | ChangeThisPassword123! |

---

*Last Updated: February 23, 2026*
