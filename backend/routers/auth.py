"""
Authentication Router - Handles user authentication and management
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
import secrets
import os

from services.database import get_database
from models.schemas import (
    UserLogin, UserCreate, User, TokenResponse,
    ChangePassword, ResetPasswordRequest, ResetPassword, AdminResetPassword
)

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer()

# JWT Configuration
def get_jwt_secret():
    """Get JWT secret - read at runtime to ensure env vars are loaded"""
    return os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, get_jwt_secret(), algorithm=ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Validate JWT token and return current user - checks unified staff collection first"""
    db = get_database()
    secret_key = get_jwt_secret()
    try:
        payload = jwt.decode(credentials.credentials, secret_key, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # FIRST: Check unified staff collection (new system)
        # Check by id first, then by legacy_user_id (for tokens issued before migration)
        staff = await db.staff.find_one({"id": user_id})
        if not staff:
            staff = await db.staff.find_one({"legacy_user_id": user_id})
        
        if staff:
            return User(
                id=staff.get("id"),
                email=staff["email"],
                role=staff.get("role", "user"),
                name=staff.get("name", "")
            )
        
        # FALLBACK: Check legacy users collection
        # Try to find by 'id' field first, then by '_id' (for older users)
        user = await db.users.find_one({"id": user_id})
        if user is None:
            # Try ObjectId lookup for older users that don't have 'id' field
            from bson import ObjectId
            try:
                user = await db.users.find_one({"_id": ObjectId(user_id)})
            except:
                pass
        
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Get user ID from either 'id' field or '_id'
        actual_user_id = user.get("id") or str(user.get("_id", ""))
        return User(id=actual_user_id, email=user["email"], role=user.get("role", "user"), name=user.get("name", ""))
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


def require_role(*required_roles: str):
    """Dependency to require specific roles"""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker


@router.get("/debug-jwt")
async def debug_jwt():
    """Debug endpoint to check JWT configuration - REMOVE IN PRODUCTION"""
    secret = get_jwt_secret()
    return {
        "secret_length": len(secret),
        "secret_first_10": secret[:10] if len(secret) > 10 else secret,
        "secret_last_10": secret[-10:] if len(secret) > 10 else secret,
        "is_default": secret == "your-secret-key-change-in-production",
        "env_var_set": os.getenv("JWT_SECRET_KEY") is not None
    }


@router.post("/test-token")
async def test_token():
    """Create and immediately verify a token to test JWT is working"""
    secret = get_jwt_secret()
    
    # Create token
    test_data = {"sub": "test-user-123", "exp": datetime.utcnow() + timedelta(minutes=5)}
    token = jwt.encode(test_data, secret, algorithm=ALGORITHM)
    
    # Immediately decode it
    try:
        decoded = jwt.decode(token, secret, algorithms=[ALGORITHM])
        return {
            "success": True,
            "token_created": token[:50] + "...",
            "decoded_sub": decoded.get("sub"),
            "secret_length": len(secret)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "secret_length": len(secret)
        }


@router.post("/seed-admin")
async def seed_admin():
    """Create initial admin user if none exists - ONE TIME USE ONLY"""
    db = get_database()
    
    # Check if any admin exists
    existing_admin = await db.users.find_one({"role": "admin"})
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin already exists")
    
    # Create default admin
    user_id = str(uuid.uuid4())
    admin_data = {
        "id": user_id,
        "email": "admin@veteran.dbty.co.uk",
        "hashed_password": hash_password("ChangeThisPassword123!"),
        "role": "admin",
        "name": "Admin",
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(admin_data)
    return {"message": "Admin user created", "email": "admin@veteran.dbty.co.uk"}


@router.post("/reset-admin-password")
async def reset_admin_password():
    """Reset admin password - TEMPORARY ENDPOINT FOR RECOVERY"""
    db = get_database()
    
    # Find admin user
    admin = await db.users.find_one({"email": "admin@veteran.dbty.co.uk"})
    if not admin:
        # Create if doesn't exist
        user_id = str(uuid.uuid4())
        admin_data = {
            "id": user_id,
            "email": "admin@veteran.dbty.co.uk",
            "hashed_password": hash_password("ChangeThisPassword123!"),
            "role": "admin",
            "name": "Admin",
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(admin_data)
        return {"message": "Admin user created", "email": "admin@veteran.dbty.co.uk", "password": "ChangeThisPassword123!"}
    
    # Reset password
    await db.users.update_one(
        {"email": "admin@veteran.dbty.co.uk"},
        {"$set": {"hashed_password": hash_password("ChangeThisPassword123!"), "id": admin.get("id") or str(uuid.uuid4())}}
    )
    return {"message": "Admin password reset", "email": "admin@veteran.dbty.co.uk", "password": "ChangeThisPassword123!"}


@router.post("/seed-staff")
async def seed_staff():
    """Create initial staff users - ONE TIME USE"""
    db = get_database()
    
    staff_to_create = [
        {"name": "Anthony Donnelly", "email": "Anthony@radiocheck.me", "role": "admin", "password": "ChangeThisPassword123!"},
        {"name": "Rachel Webster", "email": "Rachel@radiocheck.me", "role": "admin", "password": "ChangeThisPassword123!"},
    ]
    
    created = []
    for staff in staff_to_create:
        # Check if exists
        existing = await db.users.find_one({"email": staff["email"].lower()})
        if existing:
            created.append({"email": staff["email"], "status": "already exists"})
            continue
        
        user_id = str(uuid.uuid4())
        user_data = {
            "id": user_id,
            "email": staff["email"].lower(),
            "hashed_password": hash_password(staff["password"]),
            "role": staff["role"],
            "name": staff["name"],
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user_data)
        created.append({"email": staff["email"], "name": staff["name"], "role": staff["role"], "status": "created"})
    
    return {"created": created, "default_password": "ChangeThisPassword123!"}


@router.get("/list-all-users")
async def list_all_users():
    """List all users in database - TEMPORARY ADMIN ENDPOINT"""
    db = get_database()
    
    users = await db.users.find({}, {"hashed_password": 0, "_id": 0}).to_list(100)
    return {"total": len(users), "users": users}


@router.post("/register", response_model=User)
async def register_user(user_input: UserCreate, current_user: User = Depends(require_role("admin"))):
    """Register a new user (admin only) - also creates staff profile"""
    db = get_database()
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_input.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_name = user_input.name or f"{user_input.first_name} {user_input.last_name}".strip() or user_input.email.split('@')[0]
    user_data = {
        "id": user_id,
        "email": user_input.email,
        "hashed_password": hash_password(user_input.password),
        "role": user_input.role,
        "name": user_name,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_data)
    
    # Auto-create staff profile based on role
    if user_input.role in ["counsellor", "supervisor"]:
        profile_data = {
            "id": str(uuid.uuid4()),
            "name": user_name,
            "specialization": user_input.specialization or "General",
            "status": "off",
            "next_available": None,
            "phone": user_input.phone or "",
            "sms": user_input.sms,
            "whatsapp": user_input.whatsapp,
            "user_id": user_id,
            "sip_extension": None,
            "sip_password": None,
            "created_at": datetime.utcnow()
        }
        await db.counsellors.insert_one(profile_data)
        
    elif user_input.role == "peer":
        profile_data = {
            "id": str(uuid.uuid4()),
            "firstName": user_name,
            "area": user_input.area or "General",
            "background": user_input.background or "Veteran",
            "yearsServed": user_input.yearsServed or "N/A",
            "status": "unavailable",
            "phone": user_input.phone or "",
            "sms": user_input.sms,
            "whatsapp": user_input.whatsapp,
            "user_id": user_id,
            "sip_extension": None,
            "sip_password": None,
            "created_at": datetime.utcnow()
        }
        await db.peer_supporters.insert_one(profile_data)
    
    return User(id=user_id, email=user_input.email, role=user_input.role, name=user_name)


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login and get JWT token - checks unified staff collection first, then legacy users"""
    db = get_database()
    
    # FIRST: Check unified staff collection (new system)
    staff = await db.staff.find_one({"email": credentials.email})
    
    if staff:
        # Found in unified staff collection
        password_hash = staff.get("password_hash")
        if not password_hash:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        if not verify_password(credentials.password, password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        staff_id = staff.get("id")
        
        # Update last_login
        await db.staff.update_one(
            {"email": credentials.email},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        token = create_access_token({"sub": staff_id})
        redirect = "/staff" if staff.get("role") in ["counsellor", "peer", "staff", "supervisor"] else None
        
        return TokenResponse(
            token=token,
            user=User(id=staff_id, email=staff["email"], role=staff.get("role", "user"), name=staff.get("name", "")),
            redirect=redirect
        )
    
    # FALLBACK: Check legacy users collection
    user = await db.users.find_one({"email": credentials.email})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check for password hash (support both field names for backwards compatibility)
    password_hash = user.get("hashed_password") or user.get("password_hash")
    if not password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Ensure user has an ID (generate if missing for legacy users)
    user_id = user.get("id") or str(user.get("_id", ""))
    if not user_id:
        import uuid
        user_id = str(uuid.uuid4())
        await db.users.update_one({"email": credentials.email}, {"$set": {"id": user_id}})
    
    # Update last_active timestamp for monitoring
    await db.users.update_one(
        {"email": credentials.email}, 
        {"$set": {"last_active": datetime.utcnow().isoformat()}}
    )
    
    token = create_access_token({"sub": user_id})
    redirect = "/staff" if user.get("role") in ["counsellor", "peer_supporter", "staff", "supervisor"] else None
    
    return TokenResponse(
        token=token,
        user=User(id=user_id, email=user["email"], role=user.get("role", "user"), name=user.get("name", "")),
        redirect=redirect
    )


@router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return current_user


@router.post("/change-password")
async def change_password(data: ChangePassword, current_user: User = Depends(get_current_user)):
    """Change current user's password"""
    db = get_database()
    user = await db.users.find_one({"id": current_user.id})
    
    if not verify_password(data.old_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"hashed_password": hash_password(data.new_password)}}
    )
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
async def forgot_password(request: ResetPasswordRequest):
    """Request a password reset email"""
    db = get_database()
    user = await db.users.find_one({"email": request.email})
    
    if not user:
        # Don't reveal if email exists
        return {"message": "If an account exists, a reset email has been sent"}
    
    reset_token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=24)
    
    await db.password_resets.insert_one({
        "user_id": user["id"],
        "token": reset_token,
        "expires": expires,
        "used": False
    })
    
    # TODO: Send email with reset link
    # await send_reset_email(request.email, reset_token)
    
    return {"message": "If an account exists, a reset email has been sent"}


@router.post("/reset-password")
async def reset_password(reset_data: ResetPassword):
    """Reset password using token"""
    db = get_database()
    reset_record = await db.password_resets.find_one({
        "token": reset_data.token,
        "used": False,
        "expires": {"$gt": datetime.utcnow()}
    })
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    await db.users.update_one(
        {"id": reset_record["user_id"]},
        {"$set": {"hashed_password": hash_password(reset_data.new_password)}}
    )
    
    await db.password_resets.update_one(
        {"token": reset_data.token},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password reset successfully"}


@router.post("/admin-reset-password")
async def admin_reset_password(data: AdminResetPassword, current_user: User = Depends(require_role("admin"))):
    """Admin can reset any user's password with complexity requirements"""
    db = get_database()
    
    # Get the user
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_password = data.new_password
    user_name = user.get("name", "")
    
    # Validate password complexity
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    
    if not any(c.isupper() for c in new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    
    if not any(c.islower() for c in new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    
    # Check if password contains user's name
    if user_name:
        name_parts = user_name.lower().split()
        password_lower = new_password.lower()
        for part in name_parts:
            if len(part) >= 3 and part in password_lower:
                raise HTTPException(status_code=400, detail="Password cannot contain your name")
    
    # Check password history (last 3 passwords)
    password_history = user.get("password_history", [])
    
    for old_hash in password_history[-3:]:
        try:
            if verify_password(new_password, old_hash):
                raise HTTPException(status_code=400, detail="Cannot reuse any of your last 3 passwords")
        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception:
            pass  # If hash comparison fails for other reasons, skip
    
    # Also check current password
    current_hash = user.get("hashed_password") or user.get("password_hash")
    if current_hash:
        try:
            if verify_password(new_password, current_hash):
                raise HTTPException(status_code=400, detail="Cannot reuse any of your last 3 passwords")
        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception:
            pass  # If hash comparison fails for other reasons, skip
    
    # Create new hash
    new_hash = hash_password(new_password)
    
    # Update password history (keep last 3)
    if current_hash:
        password_history.append(current_hash)
    password_history = password_history[-3:]  # Keep only last 3
    
    # Update user's password
    result = await db.users.update_one(
        {"id": data.user_id},
        {"$set": {
            "hashed_password": new_hash,
            "password_hash": new_hash,  # Some places use this field name
            "password_history": password_history,
            "password_changed_at": datetime.utcnow(),
            "password_changed_by": current_user.id
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update password")
    
    return {"message": "Password reset successfully"}


@router.get("/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(require_role("admin"))):
    """Get all users (admin only)"""
    db = get_database()
    users = await db.users.find({}).to_list(1000)
    return [User(id=u["id"], email=u["email"], role=u.get("role", "user"), name=u.get("name", "")) for u in users]


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(require_role("admin"))):
    """Delete a user (admin only)"""
    db = get_database()
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted"}



# ==================================
# Push Notification Token Management
# ==================================

from pydantic import BaseModel

class PushTokenUpdate(BaseModel):
    push_token: str
    device_type: str = "expo"  # expo, fcm, apns


@router.post("/push-token")
async def register_push_token(token_data: PushTokenUpdate, current_user: User = Depends(get_current_user)):
    """Register or update push notification token for current user"""
    db = get_database()
    
    result = await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "push_token": token_data.push_token,
            "device_type": token_data.device_type,
            "push_token_updated_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Push token registered successfully"}


@router.delete("/push-token")
async def remove_push_token(current_user: User = Depends(get_current_user)):
    """Remove push notification token (e.g., on logout)"""
    db = get_database()
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$unset": {"push_token": "", "device_type": ""}}
    )
    
    return {"message": "Push token removed"}


# ==================================
# GDPR Data Rights Endpoints
# ==================================

@router.get("/my-data/export")
async def export_my_data(current_user: User = Depends(get_current_user)):
    """
    GDPR Article 15 - Right of Access
    Export all personal data associated with the current user
    """
    db = get_database()
    user_data = {
        "request_date": datetime.utcnow().isoformat(),
        "user_id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "name": current_user.name,
        "data_categories": {}
    }
    
    # Get full user record
    full_user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "password_hash": 0, "hashed_password": 0})
    if full_user:
        user_data["data_categories"]["account"] = full_user
    
    # Get buddy profile
    buddy_profile = await db.buddy_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    if buddy_profile:
        user_data["data_categories"]["buddy_profile"] = buddy_profile
    
    # Get buddy messages (sent and received)
    if buddy_profile:
        profile_id = buddy_profile.get("id")
        messages = await db.buddy_messages.find({
            "$or": [{"from_profile_id": profile_id}, {"to_profile_id": profile_id}]
        }, {"_id": 0}).to_list(1000)
        if messages:
            user_data["data_categories"]["buddy_messages"] = messages
    
    # Get shifts
    shifts = await db.shifts.find({"user_id": current_user.id}, {"_id": 0}).to_list(500)
    if shifts:
        user_data["data_categories"]["shifts"] = shifts
    
    # Get callback requests
    callbacks = await db.callback_requests.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)
    if callbacks:
        user_data["data_categories"]["callback_requests"] = callbacks
    
    # Get notes authored by user
    notes = await db.notes.find({"author_id": current_user.id}, {"_id": 0}).to_list(500)
    if notes:
        user_data["data_categories"]["notes"] = notes
    
    # Get concerns related to user
    concerns = await db.concerns.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)
    if concerns:
        user_data["data_categories"]["concerns"] = concerns
    
    # Get safeguarding alerts
    alerts = await db.safeguarding_alerts.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)
    if alerts:
        user_data["data_categories"]["safeguarding_alerts"] = alerts
    
    # Get counsellor/peer supporter profile if applicable
    if current_user.role == "counsellor":
        counsellor = await db.counsellors.find_one({"user_id": current_user.id}, {"_id": 0})
        if counsellor:
            user_data["data_categories"]["counsellor_profile"] = counsellor
    elif current_user.role in ["peer", "peer_supporter"]:
        peer = await db.peer_supporters.find_one({"user_id": current_user.id}, {"_id": 0})
        if peer:
            user_data["data_categories"]["peer_supporter_profile"] = peer
    
    return user_data


@router.delete("/me")
async def delete_my_account(current_user: User = Depends(get_current_user)):
    """
    GDPR Article 17 - Right to Erasure ("Right to be Forgotten")
    Delete own account and all associated personal data
    
    Note: Some data may be retained for safeguarding/legal compliance
    """
    db = get_database()
    user_id = current_user.id
    deleted_data = {
        "user_id": user_id,
        "deletion_date": datetime.utcnow().isoformat(),
        "deleted_records": {}
    }
    
    # Delete buddy profile and associated messages
    buddy_profile = await db.buddy_profiles.find_one({"user_id": user_id})
    if buddy_profile:
        profile_id = buddy_profile.get("id")
        # Delete messages where user was sender or recipient
        msg_result = await db.buddy_messages.delete_many({
            "$or": [{"from_profile_id": profile_id}, {"to_profile_id": profile_id}]
        })
        deleted_data["deleted_records"]["buddy_messages"] = msg_result.deleted_count
        
        # Delete profile
        await db.buddy_profiles.delete_one({"user_id": user_id})
        deleted_data["deleted_records"]["buddy_profile"] = 1
    
    # Delete shifts
    shifts_result = await db.shifts.delete_many({"user_id": user_id})
    deleted_data["deleted_records"]["shifts"] = shifts_result.deleted_count
    
    # Delete callback requests (anonymize rather than delete for safeguarding)
    await db.callback_requests.update_many(
        {"user_id": user_id},
        {"$set": {"user_id": "DELETED_USER", "name": "REDACTED", "phone": "REDACTED"}}
    )
    
    # Delete notes
    notes_result = await db.notes.delete_many({"author_id": user_id})
    deleted_data["deleted_records"]["notes"] = notes_result.deleted_count
    
    # Anonymize concerns (retain for safeguarding)
    await db.concerns.update_many(
        {"user_id": user_id},
        {"$set": {"user_id": "DELETED_USER"}}
    )
    
    # Anonymize safeguarding alerts (legal retention requirement)
    await db.safeguarding_alerts.update_many(
        {"user_id": user_id},
        {"$set": {"user_id": "DELETED_USER"}}
    )
    
    # Delete counsellor/peer profile
    await db.counsellors.delete_many({"user_id": user_id})
    await db.peer_supporters.delete_many({"user_id": user_id})
    
    # Delete password reset tokens
    await db.password_resets.delete_many({"user_id": user_id})
    
    # Finally delete user account
    await db.users.delete_one({"id": user_id})
    deleted_data["deleted_records"]["user_account"] = 1
    
    deleted_data["message"] = "Account and personal data deleted. Some anonymized records retained for safeguarding compliance."
    return deleted_data


@router.get("/my-data/categories")
async def get_my_data_categories(current_user: User = Depends(get_current_user)):
    """
    Get summary of what data categories exist for the current user
    Helps users understand what data we hold before requesting full export
    """
    db = get_database()
    categories = []
    
    categories.append({"category": "account", "exists": True, "description": "Your account information"})
    
    buddy_profile = await db.buddy_profiles.find_one({"user_id": current_user.id})
    categories.append({
        "category": "buddy_profile", 
        "exists": buddy_profile is not None,
        "description": "Your Buddy Finder profile"
    })
    
    if buddy_profile:
        profile_id = buddy_profile.get("id")
        msg_count = await db.buddy_messages.count_documents({
            "$or": [{"from_profile_id": profile_id}, {"to_profile_id": profile_id}]
        })
        categories.append({
            "category": "buddy_messages",
            "exists": msg_count > 0,
            "count": msg_count,
            "description": "Messages sent/received via Buddy Finder"
        })
    
    shift_count = await db.shifts.count_documents({"user_id": current_user.id})
    categories.append({
        "category": "shifts",
        "exists": shift_count > 0,
        "count": shift_count,
        "description": "Your scheduled shifts"
    })
    
    return {"user_id": current_user.id, "data_categories": categories}
