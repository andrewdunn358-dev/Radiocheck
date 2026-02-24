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

**🔧 CMS Pages Fix (Complete):**
- Added missing CMS pages `self-care` and `family-friends` to production database
- Added public seed endpoint `/api/cms/seed-public` for easier database population
- **File Changed**: `/app/backend/routers/cms.py`

**🎨 AI Chat Consolidation (Complete - Major Refactor):**
- Created unified AI chat component with theme support at `/app/frontend/app/chat/[characterId].tsx`
- Created AI character config at `/app/frontend/src/config/ai-characters.ts` with all 6 characters
- Characters: Hugo, Bob, Margie, Sentry (Finch), Tommy, Doris
- All chats now properly respect dark/light theme
- Reduced code duplication from ~6000 lines across 5 files to ~800 lines in 2 files
- Updated home.tsx routes to use new unified chat paths (`/chat/hugo`, `/chat/bob`, etc.)

**📁 New Files Created:**
- `/app/frontend/src/config/ai-characters.ts` - Character configuration
- `/app/frontend/app/chat/[characterId].tsx` - Dynamic unified chat route
- `/app/frontend/app/unified-chat.tsx` - Alternative unified chat entry point

**✅ Verified Working:**
- Callback request flow - creates callback and shows success confirmation page
- Staff portal can view all callbacks via `/api/callbacks`
- Auto-refresh every 30 seconds in staff portal
- New unified chat routes work with theme support

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
- [x] Counsellor status 422 error fix - DONE (Feb 24)
- [x] CMS pages missing (self-care, family-friends) - DONE (Feb 24)
- [x] AI Chat theme support - DONE (Feb 24) - Consolidated to unified component

### Medium Priority (P1)
- [ ] Push notifications integration
- [ ] DPIA document for AI processing
- [ ] Verify Render cron job is working
- [ ] Delete old AI chat files (hugo-chat.tsx, bob-chat.tsx, etc.) after production testing

### Future / Backlog
- [ ] Welsh language support
- [ ] SMS text reminders (Twilio)
- [ ] Structured CBT courses
- [ ] Mood tracking enhancements (filtering, trend analysis)

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@veteran.dbty.co.uk | ChangeThisPassword123! |

---

*Last Updated: February 24, 2026*
