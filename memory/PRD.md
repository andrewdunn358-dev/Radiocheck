# Radio Check - Product Requirements Document

## Project Overview
**Radio Check** is a mental health and peer support application for veterans.

---

## Session Summary - February 23, 2026 (Latest Update)

### ✅ Completed This Session (Latest Fork)

**🔧 Production Deployment Fixes (Complete):**
1. ✅ **API URL Failsafe** - Created `/frontend/src/config/api.ts`
   - Prevents production builds from using preview URLs
   - Automatically falls back to production backend if misconfigured
   - Logs warnings when failsafe activates

2. ✅ **Updated Frontend Files** to use safe API config:
   - `ai-buddies.tsx` - AI Buddies page
   - `ai-chat.tsx` - AI Chat component
   - `podcasts.tsx` - Removed hardcoded preview URL
   - `mental-health-screening.tsx` - Removed localhost fallback

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
