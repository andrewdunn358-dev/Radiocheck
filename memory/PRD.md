# Radio Check - Product Requirements Document

## Project Overview
**Radio Check** is a mental health and peer support application for veterans, featuring:
- React Native mobile app (Expo)
- Python FastAPI backend
- MongoDB database
- Static HTML admin and staff portals

## Session Summary - February 22, 2026 (Latest)

### ✅ Completed This Session

**🔴 P0 - Hugo Avatar Update (Done):**
1. ✅ **Generated new Hugo avatar** - Black man in late 20s with long dreads
2. ✅ **Updated server.py** - AI_CHARACTERS definition with new avatar URL
3. ✅ **Updated home.tsx** - FALLBACK_AI_TEAM with new avatar
4. ✅ **Updated self-care.tsx** - HUGO_AVATAR constant updated
5. ✅ **Updated MongoDB** - cms_cards collection updated for Hugo cards

**🟠 P1 - Backend Modularization (Complete):**
6. ✅ **Included all 4 missing routers** - auth, cms, shifts, buddy_finder now included
7. ✅ **Added GDPR endpoints to auth.py router** - /my-data/export, DELETE /me, /my-data/categories
8. ✅ **Backend now has 16 active routers** - All functional, API tested and working
9. ✅ **Removed 1187 lines of duplicate code from server.py** - File reduced from 6374 to 5187 lines (19% reduction)
10. ✅ **Fixed CMS router ObjectId serialization** - Proper MongoDB _id handling

### 🔄 Requires User Action

| Task | Action Required |
|------|-----------------|
| **Hugo Avatar** | Visible in app after next frontend load (hot reload) |
| **Admin Portal** | Redeploy `/app/admin-site/` files to production (includes Compliance tab) |
| **Staff Portal** | Redeploy `/app/staff-portal/` files to production |
| **Mobile App** | Rebuild with Expo EAS if using production build |

### User-Facing (Mobile App)
- User authentication (JWT)
- 7 AI chat personas with crisis detection (Tommy, Doris, Bob, Finch, Margie, Hugo, Rita)
- **Knowledge Base Integration** - AI characters now use verified UK veteran information
- Staff availability calendar
- Buddy Finder with peer matching and messaging
- Message inbox
- Educational resources
- Crisis/panic button (SOS)

### Admin Portal
- Visual CMS Editor (WYSIWYG) - edit app content via phone preview
- Logs & Analytics dashboard with Chart.js visualizations
- Staff management (unified view)
- Safeguarding alerts management
- Prompt improvement workflow
- **Test data cleanup endpoint** - Remove test counsellors/peer supporters

### Staff Portal
- Shift calendar and rota management
- Callback queue
- Live chat rooms
- Case notes

## Technical Architecture

### Backend Structure (Fully Modularized)
```
/app/backend/
├── server.py                    # Main entry + AI chat with Knowledge Base
├── compliance.py                # Compliance models and helpers
├── routers/                     # 16 modular API routers
│   ├── auth.py                  # Authentication + push tokens
│   ├── cms.py                   # Content Management System
│   ├── shifts.py                # Staff scheduling
│   ├── compliance.py            # GDPR, BACP, audit logging, data protection
│   ├── buddy_finder.py          # Peer matching
│   ├── staff.py                 # Counsellors/Peers
│   ├── organizations.py         # Support orgs
│   ├── resources.py             # Educational materials
│   ├── safeguarding.py          # Alerts management
│   ├── callbacks.py             # Callback requests
│   ├── live_chat.py             # Chat rooms
│   ├── notes.py                 # Staff notes
│   ├── concerns.py              # Family concerns
│   ├── message_queue.py         # Offline messaging
│   ├── ai_feedback.py           # AI feedback system
│   └── knowledge_base.py        # RAG for AI
├── models/schemas.py            # Centralized Pydantic models
└── services/database.py         # DB utilities
```

## Session Work Summary (Feb 22, 2026)

### Completed This Session:

1. **AI Knowledge Base Integration** ✅
   - AI characters now pull verified UK veteran info from knowledge base
   - Seeded with 11 entries (benefits, mental health, housing, etc.)
   - Endpoints: `/api/knowledge-base/*`

2. **Logo Bug Fixed** ✅
   - Fixed `source={{ uri: NEW_LOGO_URL }}` → `source={NEW_LOGO_URL}` in home.tsx

3. **CMS Editor Improvements** ✅
   - Fixed syntax error (extra `}`)
   - Added dynamic page loading from API
   - **Note:** Admin portal needs redeployment to production

4. **Test Data Cleanup Endpoint** ✅
   - `DELETE /api/admin/cleanup-test-data` - finds and removes test users
   - Preview mode (default) shows what will be deleted
   - Add `?confirm=true` to actually delete

5. **GDPR/BACP Compliance Documentation** ✅
   - Created `/app/docs/ROPA.md` - Record of Processing Activities
   - Created `/app/docs/BACP_ETHICAL_FRAMEWORK_COMPLIANCE.md`
   - Implementation checklists included

6. **AI Testing Strategy** ✅
   - Created `/app/docs/AI_TESTING_STRATEGY.md`
   - Automated test scripts
   - Load testing approach
   - Regression test suite

### Production Actions Required:

1. **Redeploy Admin Portal**
   - Copy `/app/admin-site/*` files to production
   - CMS editor won't work until this is done
   - See `/app/admin-site/DEPLOYMENT_GUIDE.md`

2. **Clean Up Test Users**
   ```bash
   # Preview what will be deleted
   curl -X DELETE "https://veterans-support-api.onrender.com/api/admin/cleanup-test-data" \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Actually delete (add ?confirm=true)
   curl -X DELETE "https://veterans-support-api.onrender.com/api/admin/cleanup-test-data?confirm=true" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Remaining Tasks

### High Priority
- [ ] Add AI chat consent screen (BACP/GDPR requirement)
- [ ] Implement audit logging for data access
- [ ] Staff wellbeing features in Staff Portal

### Medium Priority
- [ ] Accessibility review (screen readers, contrast)
- [ ] Staff supervision request system
- [ ] Cookie consent banner on website

### Future
- [ ] WebRTC audio calls (already working with P2P)
- [ ] Welsh language support

## Key Files Changed This Session
- `/app/backend/server.py` - Added knowledge base integration, cleanup endpoint
- `/app/frontend/app/home.tsx` - Fixed logo source
- `/app/admin-site/app.js` - Fixed syntax error, dynamic page loading
- `/app/backend/routers/` - All 15 routers created
- `/app/docs/` - New compliance and testing documentation

## API Endpoints Summary

### New Endpoints
- `GET /api/knowledge-base/categories` - KB categories
- `POST /api/knowledge-base/search` - Search KB
- `GET /api/knowledge-base/context/{query}` - AI context
- `POST /api/ai-feedback/thumbs` - Quick feedback
- `GET /api/ai-feedback/summary` - Analytics
- `GET /api/message-queue/stats` - Queue stats
- `DELETE /api/admin/cleanup-test-data` - Remove test data

### Existing Key Endpoints
- `POST /api/auth/login` - User login
- `GET /api/auth/my-data/export` - GDPR data export
- `DELETE /api/auth/me` - Account deletion
- `POST /api/ai-buddies/chat` - AI chat (now with KB)
