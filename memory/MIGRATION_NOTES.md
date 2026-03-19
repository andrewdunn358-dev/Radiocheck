# Staff Data Model Migration Notes

## Migration Date: March 19, 2026

## Overview

This document describes the migration from the old fragmented data model (separate `users`, `counsellors`, `peer_supporters` collections) to the new unified `staff` collection.

## Old Architecture (DEPRECATED)

```
users                  counsellors            peer_supporters
├─ id                  ├─ id                  ├─ id
├─ email               ├─ name                ├─ firstName
├─ password_hash       ├─ specialization      ├─ area
├─ role                ├─ phone               ├─ background
├─ name                ├─ status              ├─ phone
└─ created_at          ├─ user_id ────┐       ├─ status
                       └─ sip_*       │       ├─ user_id ────┐
                                      │       └─ sip_*       │
                                      └──────────────────────┘
```

### Problems with Old Architecture:
1. **User/Profile Disconnect**: Users could exist without profiles
2. **Redundant Data**: Name stored in both users AND profiles
3. **Complex Queries**: Had to join users + counsellors/peers to get full picture
4. **Role Confusion**: Peer supporters and counsellors had different status values

## New Architecture (UNIFIED)

```
staff (single collection)
├─ id
├─ email
├─ password_hash
├─ role: "admin" | "supervisor" | "counsellor" | "peer"
├─ name
├─ status: "available" | "limited" | "unavailable" | "busy" | "off"
├─ phone
├─ sms
├─ whatsapp
├─ specialization  (for counsellors/supervisors)
├─ area            (for peers)
├─ background      (for peers)
├─ years_served    (for peers)
├─ sip_extension
├─ sip_password
├─ is_supervisor
├─ created_at
├─ updated_at
├─ last_login
├─ legacy_user_id      (migration tracking)
└─ legacy_profile_id   (migration tracking)
```

### Benefits:
1. **Single Source of Truth**: One document = one person
2. **No Orphan Profiles**: Can't have user without profile data
3. **Simpler Queries**: No joins needed
4. **Unified Status**: All roles use the same status values
5. **Easier Maintenance**: One model to update

## Migration Steps

### 1. Run Migration Endpoint (Admin Only)
```bash
curl -X POST {API_URL}/api/admin/migrate-to-unified-staff \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
```

### 2. Check Migration Status
```bash
curl {API_URL}/api/admin/migration-status \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
```

### 3. Verify Staff Data
```bash
curl {API_URL}/api/staff \
  -H "Authorization: Bearer {TOKEN}"
```

## API Changes

### New Endpoints (USE THESE)
- `POST /api/staff` - Create staff member (unified)
- `GET /api/staff` - List all staff
- `GET /api/staff/me` - Get current user's profile
- `GET /api/staff/{id}` - Get staff by ID
- `PATCH /api/staff/{id}` - Update staff
- `PATCH /api/staff/{id}/status` - Update status
- `DELETE /api/staff/{id}` - Delete staff

### Deprecated Endpoints (TO BE REMOVED)
- `POST /api/counsellors` → Use `POST /api/staff`
- `GET /api/counsellors` → Use `GET /api/staff?role=counsellor`
- `PATCH /api/counsellors/{id}/status` → Use `PATCH /api/staff/{id}/status`
- `POST /api/peer-supporters` → Use `POST /api/staff`
- `GET /api/peer-supporters` → Use `GET /api/staff?role=peer`
- `PATCH /api/peer-supporters/{id}/status` → Use `PATCH /api/staff/{id}/status`

## Frontend Changes

### Staff Portal (`/app/portal/src/lib/api.ts`)
- `getProfile()` now calls `/staff/me` first, falls back to legacy
- `updateStatus()` tries `/staff/{id}/status` first, falls back to legacy

### Admin Portal (`/app/admin-site/app.js`)
- TODO: Update to use new `/api/staff` endpoints
- TODO: Update staff creation form to use unified endpoint

## Code Cleanup TODO

After migration is complete and verified:

1. **Backend (`/app/backend/server.py`)**:
   - [ ] Remove `Counsellor`, `CounsellorCreate`, `CounsellorStatusUpdate` models
   - [ ] Remove `PeerSupporter`, `PeerSupporterCreate`, `PeerSupporterStatusUpdate` models
   - [ ] Remove all `/counsellors/*` endpoints
   - [ ] Remove all `/peer-supporters/*` endpoints
   - [ ] Remove `/admin/fix-missing-profiles` endpoint
   - [ ] Remove `/admin/create-users-for-unlinked-staff` endpoint

2. **Frontend (`/app/portal/src/lib/api.ts`)**:
   - [ ] Remove legacy fallback code in `getProfile()`
   - [ ] Remove legacy fallback code in `updateStatus()`

3. **Admin Portal (`/app/admin-site/app.js`)**:
   - [ ] Remove separate counsellor/peer forms
   - [ ] Use unified staff creation/management

4. **Database**:
   - [ ] Archive `users` collection (keep for reference)
   - [ ] Archive `counsellors` collection
   - [ ] Archive `peer_supporters` collection

## Testing Checklist

- [ ] Migration endpoint runs without errors
- [ ] All existing users are migrated to `staff` collection
- [ ] Login works with migrated accounts
- [ ] `/staff/me` returns correct profile
- [ ] Status updates work via new endpoint
- [ ] Admin can create new staff via `/api/staff`
- [ ] Old endpoints still work (backward compatibility)
- [ ] Staff portal shows correct user info

## Rollback Plan

If issues arise:
1. The old collections (`users`, `counsellors`, `peer_supporters`) are NOT deleted
2. The login and auth code falls back to legacy collections
3. Frontend falls back to legacy endpoints if unified fails
4. Simply revert frontend to always use legacy endpoints if needed
