"""
Buddy Finder Router - Peer matching and messaging for veterans
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import uuid
from datetime import datetime

from services.database import get_database
from models.schemas import (
    BuddyProfileCreate, BuddyProfile, BuddyProfileUpdate, BuddyMessage
)

router = APIRouter(prefix="/buddy-finder", tags=["buddy-finder"])

# UK Regions for filtering
UK_REGIONS = [
    "Scotland", "Northern Ireland", "Wales",
    "North East", "North West", "Yorkshire", "East Midlands",
    "West Midlands", "East of England", "London",
    "South East", "South West", "Overseas/BFPO"
]

# Service branches
SERVICE_BRANCHES = [
    "British Army", "Royal Navy", "Royal Air Force",
    "Royal Marines", "Reserve Forces", "Other"
]


async def get_current_user_from_token(token: str):
    """Helper to decode JWT and get user"""
    import jwt
    from auth_config import get_jwt_secret

    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
        return payload.get("sub")
    except Exception:
        return None


@router.post("/signup")
async def create_buddy_profile(profile: BuddyProfileCreate, authorization: str = None):
    """Create a new buddy finder profile"""
    db = get_database()
    
    # In production, get user_id from JWT
    user_id = str(uuid.uuid4())  # Temporary for anonymous profiles
    
    profile_data = profile.dict()
    profile_data["id"] = str(uuid.uuid4())
    profile_data["user_id"] = user_id
    profile_data["is_active"] = True
    profile_data["last_active"] = datetime.utcnow()
    profile_data["created_at"] = datetime.utcnow()
    
    await db.buddy_profiles.insert_one(profile_data)
    return {**profile_data, "_id": None}


@router.get("/profiles")
async def get_buddy_profiles(
    region: Optional[str] = None,
    branch: Optional[str] = None,
    limit: int = 50
):
    """Get list of active buddy profiles with optional filters"""
    db = get_database()
    
    query = {"is_active": True}
    if region:
        query["region"] = region
    if branch:
        query["service_branch"] = branch
    
    profiles = await db.buddy_profiles.find(query).sort("last_active", -1).to_list(limit)
    
    return [{
        "id": p.get("id", str(p.get("_id", ""))),
        "display_name": p.get("display_name", ""),
        "region": p.get("region", ""),
        "service_branch": p.get("service_branch", ""),
        "regiment": p.get("regiment", ""),
        "years_served": p.get("years_served", ""),
        "bio": p.get("bio", ""),
        "interests": p.get("interests", []),
        "last_active": p.get("last_active", datetime.utcnow()).isoformat() if p.get("last_active") else None
    } for p in profiles]


@router.get("/profile/{profile_id}")
async def get_buddy_profile(profile_id: str):
    """Get a single buddy profile by ID"""
    db = get_database()
    profile = await db.buddy_profiles.find_one({"$or": [{"id": profile_id}, {"_id": profile_id}]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile["id"] = str(profile.get("_id", profile.get("id", "")))
    return profile


@router.put("/profile/{profile_id}")
async def update_buddy_profile(profile_id: str, updates: BuddyProfileUpdate):
    """Update a buddy profile"""
    db = get_database()
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["last_active"] = datetime.utcnow()
    
    result = await db.buddy_profiles.update_one(
        {"$or": [{"id": profile_id}, {"_id": profile_id}]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {"success": True}


@router.delete("/profile/{profile_id}")
async def delete_buddy_profile(profile_id: str):
    """Delete (deactivate) a buddy profile"""
    db = get_database()
    
    result = await db.buddy_profiles.update_one(
        {"$or": [{"id": profile_id}, {"_id": profile_id}]},
        {"$set": {"is_active": False}}
    )
    
    return {"deleted": result.modified_count > 0}


@router.post("/message")
async def send_buddy_message(
    to_profile_id: str,
    message: str,
    authorization: str = None
):
    """Send a message to another buddy"""
    db = get_database()
    
    # Validate recipient exists
    recipient = await db.buddy_profiles.find_one({"$or": [{"id": to_profile_id}, {"_id": to_profile_id}]})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # In production, get sender from JWT
    from_profile_id = "anonymous"  # Replace with actual user's profile
    
    message_data = {
        "id": str(uuid.uuid4()),
        "from_profile_id": from_profile_id,
        "to_profile_id": to_profile_id,
        "message": message,
        "is_read": False,
        "created_at": datetime.utcnow()
    }
    
    await db.buddy_messages.insert_one(message_data)
    return {"success": True, "message_id": message_data["id"]}


@router.get("/messages/{profile_id}")
async def get_buddy_messages(profile_id: str):
    """Get messages for a profile (sent and received)"""
    db = get_database()
    
    messages = await db.buddy_messages.find({
        "$or": [
            {"from_profile_id": profile_id},
            {"to_profile_id": profile_id}
        ]
    }).sort("created_at", -1).to_list(100)
    
    return [{
        "id": m.get("id", str(m.get("_id", ""))),
        "from_profile_id": m.get("from_profile_id"),
        "to_profile_id": m.get("to_profile_id"),
        "message": m.get("message"),
        "is_read": m.get("is_read", False),
        "created_at": m.get("created_at").isoformat() if m.get("created_at") else None
    } for m in messages]


@router.get("/inbox")
async def get_inbox(authorization: str = None):
    """Get inbox messages for the current user"""
    db = get_database()
    
    # In production, get user_id from JWT and find their profile
    # For now, return structure
    
    messages = await db.buddy_messages.find({}).sort("created_at", -1).to_list(50)
    
    # Enrich with sender/recipient names
    enriched = []
    for msg in messages:
        sender = await db.buddy_profiles.find_one({"id": msg.get("from_profile_id")})
        recipient = await db.buddy_profiles.find_one({"id": msg.get("to_profile_id")})
        
        enriched.append({
            "id": msg.get("id", str(msg.get("_id", ""))),
            "from_profile_id": msg.get("from_profile_id"),
            "to_profile_id": msg.get("to_profile_id"),
            "from_name": sender.get("display_name", "Unknown") if sender else "Unknown",
            "to_name": recipient.get("display_name", "Unknown") if recipient else "Unknown",
            "message": msg.get("message"),
            "is_read": msg.get("is_read", False),
            "is_sent": False,  # Determined by comparing with current user
            "created_at": msg.get("created_at").isoformat() if msg.get("created_at") else None
        })
    
    return {
        "messages": enriched,
        "unread_count": len([m for m in enriched if not m["is_read"]]),
        "has_profile": True
    }


@router.get("/regions")
async def get_regions():
    """Get list of UK regions for dropdown"""
    return {"regions": UK_REGIONS}


@router.get("/branches")
async def get_branches():
    """Get list of service branches for dropdown"""
    return {"branches": SERVICE_BRANCHES}
