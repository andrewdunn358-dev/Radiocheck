# PRODUCTION CONFIGURATION - DO NOT MODIFY FOR TESTING

## CRITICAL: API URLs

The following config files contain PRODUCTION API URLs that should NEVER be changed to preview URLs:

### Staff Portal
- `/app/staff-portal/config.js` → `https://veterans-support-api.onrender.com`

### Admin Portal  
- `/app/admin-site/config.js` → `https://veterans-support-api.onrender.com`

## Why This Matters

When forking a session, agents sometimes change these URLs to the preview environment for testing. This breaks the PRODUCTION deployment because:

1. The user deploys code from this repo to their production hosting (Render, Vercel, etc.)
2. If config.js points to the preview URL, production users get 403 errors
3. The preview environment has different data/users than production

## Testing Guidelines

- **DO NOT** change config.js URLs to preview URLs
- **DO** test the preview environment using the preview URL directly in your browser/curl
- **DO** keep production config files pointing to production URLs at all times

## Production Infrastructure

- **Backend API**: `https://veterans-support-api.onrender.com` (hosted on Render)
- **Mobile App**: `https://app.radiocheck.me` (Expo/React Native)
- **Staff Portal**: `https://radiocheck.me/staff-portal`
- **Admin Portal**: `https://radiocheck.me/admin-site`
- **Marketing Website**: `https://radiocheck.me`

## Preview Environment (Emergent)

- Preview URL: `https://call-connect-test-1.preview.emergentagent.com`
- This is for testing ONLY - changes here don't affect production until deployed
