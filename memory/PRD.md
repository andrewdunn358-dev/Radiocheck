# Radio Check - Product Requirements Document

## Project Overview
**Radio Check** is a mental health and peer support application for veterans, featuring:
- React Native mobile app (Expo)
- Python FastAPI backend
- MongoDB database
- Static HTML admin and staff portals

---

## Session Summary - February 22-23, 2026 (Latest)

### ✅ Completed This Session

**🔴 P0 - GDPR AI Consent Modal Rollout (Complete):**
1. ✅ **Created AIConsentModal component** - Reusable GDPR consent modal at `/frontend/src/components/AIConsentModal.tsx`
2. ✅ **Implemented in sentry-chat.tsx** - Consent required before AI interaction
3. ✅ **Implemented in hugo-chat.tsx** - Consent modal with character-specific name
4. ✅ **Implemented in margie-chat.tsx** - Consent modal for substance support AI
5. ✅ **Implemented in bob-chat.tsx** - Consent modal for peer support AI
   - All AI chat screens now show disclosure:
     - AI is not a trained counsellor
     - What AI can/cannot do
     - Privacy & data handling
     - Crisis numbers (Samaritans 116 123, Combat Stress)
     - Consent stored locally per character

**🟠 P1 - Data Retention System (Complete):**
6. ✅ **Created data_retention.py script** - `/backend/scripts/data_retention.py`
   - Automated data cleanup per GDPR retention policies
   - Supports --dry-run mode for testing
   - Retention periods:
     - Chat messages: 90 days (anonymize)
     - Safeguarding alerts: 7 years (anonymize)
     - Callback requests: 1 year (anonymize)
     - Call logs: 1 year (anonymize)
     - Panic alerts: 1 year (delete)
     - Compliance logs: 2 years (delete)

7. ✅ **Created data retention API router** - `/backend/routers/data_retention.py`
   - `GET /api/admin/data-retention/status` - View policies & last cleanup report
   - `POST /api/admin/data-retention/run` - Trigger cleanup (with dry_run option)
   - `GET /api/admin/data-retention/reports` - Audit trail of cleanups
   - `DELETE /api/admin/data-retention/user-data/{user_id}` - GDPR "Right to be Forgotten"
   - `GET /api/admin/data-retention/gdpr-requests` - Log of deletion requests

**🟢 Mood Tracking Enhancement (Complete):**
8. ✅ **Added visual mood timeline graph** - `/frontend/app/mood.tsx`
   - Interactive graph showing mood over time
   - Y-axis: Mood emoji scale (😢 to 😊)
   - Data points with mood color coding
   - Trend indicator (📈 Improving / 📉 Declining / ➡️ Stable)
   - X-axis: Date labels
   - Period selector: 7 Days / 30 Days / All Time

**🟣 Push Notifications for Shifts (Backend Ready):**
9. ✅ **Shifts router has push notification infrastructure** - `/backend/routers/shifts.py`
   - `send_push_notification()` - Expo push API integration
   - Notifications sent on shift create/update/delete
   - `POST /api/shifts/register-push-token` - Register user's push token
   - Email notifications via Resend also available

### 🔄 Pending User Action

| Task | Action Required |
|------|-----------------|
| **Push Notifications** | Install `expo-notifications` in frontend for token registration |
| **Data Retention Cron** | Schedule `python scripts/data_retention.py` as daily cron job on production |
| **Admin Portal** | Redeploy `/app/admin-site/` to see Compliance tab |

---

## Previous Session Work (Feb 22, 2026)

### Completed:
- ✅ Backend modularization (16 routers, 1187 lines removed from server.py)
- ✅ Podcasts feature with YouTube integration
- ✅ Hugo avatar update
- ✅ Legal & permissions pages (data-rights, safeguarding-policy)
- ✅ First-launch microphone permission modal
- ✅ CMS ObjectId serialization fix

---

## Core Features

### User-Facing (Mobile App)
- User authentication (JWT)
- 7 AI chat personas with crisis detection (Tommy, Doris, Bob, Finch, Margie, Hugo, Rita)
- **AI Consent Modal** - GDPR compliance before AI interaction
- **Knowledge Base Integration** - AI uses verified UK veteran information
- Staff availability calendar
- Buddy Finder with peer matching
- **Mood Tracking with Graphs** - Historical view and trend analysis
- Educational resources
- Podcasts section (8 curated veteran podcasts)
- Crisis/panic button (SOS)

### Admin Portal
- Visual CMS Editor (WYSIWYG)
- Logs & Analytics dashboard
- Staff management
- Safeguarding alerts
- **Data Retention Management** - GDPR compliance tools
- Test data cleanup endpoint

### Staff Portal
- Shift calendar with notifications
- Callback queue
- Live chat rooms
- Case notes

---

## Technical Architecture

### Backend Structure (17 Routers)
```
/app/backend/
├── server.py                    # Main entry + AI chat
├── routers/                     # 17 modular API routers
│   ├── auth.py                  # Authentication + push tokens
│   ├── cms.py                   # Content Management System
│   ├── shifts.py                # Staff scheduling + push notifications
│   ├── compliance.py            # GDPR, BACP, audit logging
│   ├── data_retention.py        # NEW: Data retention management
│   ├── buddy_finder.py          # Peer matching
│   ├── podcasts.py              # Podcast feeds
│   └── ... (10 more routers)
├── scripts/
│   ├── data_retention.py        # NEW: Automated cleanup script
│   └── migrate_encrypt_pii.py
├── models/schemas.py            # Pydantic models
└── services/database.py         # DB utilities
```

### Frontend Structure
```
/app/frontend/app/
├── hugo-chat.tsx                # Updated: AI consent modal
├── margie-chat.tsx              # Updated: AI consent modal
├── bob-chat.tsx                 # Updated: AI consent modal
├── sentry-chat.tsx              # Updated: AI consent modal
├── mood.tsx                     # Updated: Mood timeline graph
├── podcasts.tsx                 # YouTube integration
├── your-data-rights.tsx         # GDPR rights
└── safeguarding-policy.tsx      # Safety policy

/app/frontend/src/components/
└── AIConsentModal.tsx           # NEW: Reusable consent component
```

---

## Remaining Tasks

### High Priority (P0)
- [ ] Install expo-notifications for push token registration in frontend
- [ ] Schedule data retention cron job in production
- [ ] Cookie consent banner on admin portal & marketing website

### Medium Priority (P1)
- [ ] PHQ-9 / GAD-7 mental health screening tools
- [ ] Create DPIA document for AI processing
- [ ] "Report an Issue" button on settings page
- [ ] Verify Compliance UI in Admin Portal

### Future / Backlog
- [ ] Consolidate AI chat screens into single reusable component (major refactor)
- [ ] Welsh language support
- [ ] Staff supervision request system
- [ ] Structured CBT courses
- [ ] App store assets (screenshots, marketing copy)

---

## API Endpoints Summary

### New Endpoints (This Session)
- `GET /api/admin/data-retention/status` - Retention policy status
- `POST /api/admin/data-retention/run?dry_run=true` - Run cleanup
- `GET /api/admin/data-retention/reports` - Cleanup audit trail
- `DELETE /api/admin/data-retention/user-data/{user_id}` - GDPR deletion
- `GET /api/admin/data-retention/gdpr-requests` - Deletion request log

### Key Existing Endpoints
- `POST /api/auth/login` - User login
- `GET /api/auth/my-data/export` - GDPR data export
- `DELETE /api/auth/me` - Account deletion
- `POST /api/ai-buddies/chat` - AI chat with knowledge base
- `GET /api/shifts/` - Get shifts
- `POST /api/shifts/register-push-token` - Register push notifications

---

## Compliance Status

### GDPR
- ✅ AI consent modal (all chat screens)
- ✅ Data export endpoint
- ✅ Account deletion endpoint
- ✅ Data retention script with policies
- ✅ Right to be forgotten API
- ⏳ Cookie consent banner (pending)

### BACP
- ✅ AI disclosure in consent modal
- ✅ Crisis numbers prominently displayed
- ✅ Safeguarding alerts system
- ✅ Safeguarding policy page
- ⏳ Complaints button (pending)

---

## Key Files Changed This Session
- `/app/frontend/app/hugo-chat.tsx` - AI consent modal
- `/app/frontend/app/margie-chat.tsx` - AI consent modal
- `/app/frontend/app/bob-chat.tsx` - AI consent modal
- `/app/frontend/app/mood.tsx` - Timeline graph enhancement
- `/app/frontend/src/components/AIConsentModal.tsx` - Reusable component
- `/app/backend/scripts/data_retention.py` - NEW: Cleanup script
- `/app/backend/routers/data_retention.py` - NEW: Admin API
- `/app/backend/server.py` - Added data_retention router

---

*Last Updated: February 23, 2026*
