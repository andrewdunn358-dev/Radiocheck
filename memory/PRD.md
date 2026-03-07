# Radio Check - Product Requirements Document

## Original Problem Statement
Build "Radio Check," a mental health and peer support application for veterans and serving personnel. The project includes:
- React web application (Vercel)
- Python FastAPI backend (Render)
- Vanilla JS web portals for Admin and Staff (20i hosting)

## Core Architecture
```
/app
├── admin-site/          # Vanilla JS admin portal (20i hosting)
├── backend/             # FastAPI backend (Render)
├── frontend/            # React/Expo frontend (Vercel)
└── staff-portal/        # Vanilla JS staff portal (20i hosting)
```

## What's Been Implemented (March 2026)

### Session: March 7, 2026
**Safari/iPhone/Android Onboarding Fixes**
- Fixed Age Gate modal not working on iPhones - replaced HTML `<select>` with iOS-friendly FlatList pickers
- Fixed cookie consent being cut off on Safari/small viewports - converted to compact inline banner
- Fixed permissions modal being cut off - made more compact with maxHeight constraint
- Added ScrollView wrapper to Age Gate modal for scrolling on small screens
- **Added Age Gate to home.tsx** - ensures Age Gate shows even on direct navigation to /home
- **Fixed modal priority** - Age Gate now shows BEFORE the Beta Survey on home page
- All modals now fit within Safari's smaller viewport on desktop and mobile

Files changed:
- `frontend/src/components/AgeGateModal.tsx` - iOS-friendly pickers, ScrollView, compact styles
- `frontend/app/index.tsx` - Compact cookie banner, compact permissions modal
- `frontend/app/home.tsx` - Added Age Gate modal fallback, fixed modal priority over survey

### Session: March 6, 2026
**Location Permission on First Load**
- Modified `index.tsx` to include location permission alongside microphone in the "Enable Permissions" modal
- Created `LocationPermissionContext.tsx` to track and provide location permission state
- Location permission is now requested during initial app onboarding

**In-Page Safeguarding Call Modal**
- Created `SafeguardingCallModal.tsx` - full WebRTC call experience in a modal
- Updated `chat/[characterId].tsx` and `unified-chat.tsx` to use in-page call modal
- Users no longer redirect to `/peer-support` - call happens on chat page
- GPS location is requested and sent to backend when call is initiated

**Desktop Responsive Layout**
- `ResponsiveWrapper.tsx` provides centered mobile view with side-panel branding
- Left panel: Radio Check logo, feature list
- Center: Phone-framed app content
- Right panel: Emergency contact numbers

### Previous Session Work
- WebRTC Safeguarding Call Flow (Fixed)
- Location Analytics Map (Leaflet.js)
- Clear Logs Feature for Admin
- Browser Geolocation API integration
- Admin Security Fix (credentials in URL)
- Admin Modal Fix (duplicate closeModal function)
- Staff Portal UI Fix (logo sizing)
- Post-call Redirect to homepage

## Key Files
- `frontend/app/index.tsx` - Landing page with permissions modal
- `frontend/app/chat/[characterId].tsx` - AI chat with safeguarding
- `frontend/src/context/LocationPermissionContext.tsx` - Location state
- `frontend/src/components/SafeguardingCallModal.tsx` - In-page call UI
- `frontend/src/components/ResponsiveWrapper.tsx` - Desktop layout
- `frontend/src/components/AgeGateModal.tsx` - iOS-friendly date picker
- `backend/server.py` - FastAPI backend

## API Endpoints
- `/api/safeguarding-alerts/{alert_id}/location` - PATCH to update GPS coords
- `/api/analytics/locations` - GET for admin location map
- `/admin/clear-logs` - POST to clear test logs
- Socket.IO events for WebRTC signaling

## Pending Issues (P0-P2)

### P0 - Critical
- **Deployment Verification**: User needs to deploy latest AgeGateModal.tsx to Vercel to fix iPhone issue

### P1 - High Priority  
- AI Character sort order not respecting `order` field from database

### P2 - Medium Priority
- End-to-end testing of admin reporting features (PDF export/email)
- Full regression testing of safeguarding call flow

## Future Tasks
- Rewrite admin-site and staff-portal from vanilla JS to React
- Mood Tracker Journal
- Appointment Booking, Secure Messaging, CBT courses
- Welsh Language Support

## Third-Party Integrations
- Twilio: WebRTC and phone calling
- OpenAI gpt-4o-mini: AI chat personas
- Resend: Email (blocked on domain verification)
- Leaflet.js: Location maps
- fpdf2: PDF generation

## Deployment Environments
- **Frontend**: Vercel (https://[domain])
- **Backend**: Render (https://[domain])
- **Admin/Staff Portals**: 20i hosting
- **Preview**: https://vet-support-1.preview.emergentagent.com

## Credentials
- Preview Password: `radiocheck1358`
