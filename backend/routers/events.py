"""
Events Router - Virtual Coffee Morning & Community Events

Handles event scheduling, management, and Jitsi Meet integration
for community video chat events.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import secrets
import hashlib

router = APIRouter(prefix="/events", tags=["events"])

# Database reference (set by main app)
db = None

def set_db(database):
    global db
    db = database


# ============ MODELS ============

class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    event_date: datetime
    duration_minutes: int = Field(60, ge=15, le=240)  # 15 min to 4 hours
    max_participants: Optional[int] = Field(None, ge=2, le=100)
    host_name: str = Field(..., min_length=1, max_length=100)
    recurring: Optional[str] = Field(None)  # 'weekly', 'monthly', or None
    requires_moderation: bool = True
    waiting_room_enabled: bool = True


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    event_date: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=15, le=240)
    max_participants: Optional[int] = Field(None, ge=2, le=100)
    host_name: Optional[str] = Field(None, min_length=1, max_length=100)
    recurring: Optional[str] = None
    status: Optional[str] = None  # 'scheduled', 'live', 'ended', 'cancelled'


class EventResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    event_date: datetime
    duration_minutes: int
    max_participants: Optional[int]
    host_name: str
    recurring: Optional[str]
    status: str
    jitsi_room_name: str
    participant_count: int
    created_at: datetime
    requires_moderation: bool
    waiting_room_enabled: bool


class JoinEventResponse(BaseModel):
    event_id: str
    jitsi_room_name: str
    jitsi_domain: str
    display_name: str
    is_moderator: bool
    jwt_token: Optional[str]  # For Jitsi JWT auth if needed
    config: dict


class EventReminder(BaseModel):
    user_id: str
    event_id: str
    remind_at: List[str] = ["30min", "1day"]  # When to remind


# ============ HELPERS ============

def generate_jitsi_room_name(event_id: str, title: str) -> str:
    """Generate a unique, readable Jitsi room name"""
    # Create a hash-based suffix for uniqueness
    hash_suffix = hashlib.md5(event_id.encode()).hexdigest()[:8]
    # Clean title for URL
    clean_title = "".join(c if c.isalnum() else "" for c in title)[:20]
    return f"RadioCheck-{clean_title}-{hash_suffix}"


def serialize_event(event: dict) -> dict:
    """Convert MongoDB event document to response format"""
    return {
        "id": str(event["_id"]),
        "title": event["title"],
        "description": event.get("description"),
        "event_date": event["event_date"],
        "duration_minutes": event["duration_minutes"],
        "max_participants": event.get("max_participants"),
        "host_name": event["host_name"],
        "recurring": event.get("recurring"),
        "status": event.get("status", "scheduled"),
        "jitsi_room_name": event["jitsi_room_name"],
        "participant_count": len(event.get("participants", [])),
        "created_at": event["created_at"],
        "requires_moderation": event.get("requires_moderation", True),
        "waiting_room_enabled": event.get("waiting_room_enabled", True),
    }


# ============ ADMIN ENDPOINTS ============

@router.post("/admin/create", response_model=EventResponse)
async def create_event(event: EventCreate):
    """Create a new community event (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    event_id = str(ObjectId())
    jitsi_room_name = generate_jitsi_room_name(event_id, event.title)
    
    event_doc = {
        "_id": ObjectId(event_id),
        "title": event.title,
        "description": event.description,
        "event_date": event.event_date,
        "duration_minutes": event.duration_minutes,
        "max_participants": event.max_participants,
        "host_name": event.host_name,
        "recurring": event.recurring,
        "status": "scheduled",
        "jitsi_room_name": jitsi_room_name,
        "participants": [],
        "attendance_log": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "requires_moderation": event.requires_moderation,
        "waiting_room_enabled": event.waiting_room_enabled,
    }
    
    await db.events.insert_one(event_doc)
    
    # If recurring, create future instances
    if event.recurring:
        await create_recurring_events(event_doc)
    
    return serialize_event(event_doc)


async def create_recurring_events(base_event: dict, count: int = 4):
    """Create future recurring event instances"""
    if base_event.get("recurring") == "weekly":
        delta = timedelta(weeks=1)
    elif base_event.get("recurring") == "monthly":
        delta = timedelta(weeks=4)
    else:
        return
    
    for i in range(1, count + 1):
        future_date = base_event["event_date"] + (delta * i)
        event_id = str(ObjectId())
        
        future_event = {
            "_id": ObjectId(event_id),
            "title": base_event["title"],
            "description": base_event.get("description"),
            "event_date": future_date,
            "duration_minutes": base_event["duration_minutes"],
            "max_participants": base_event.get("max_participants"),
            "host_name": base_event["host_name"],
            "recurring": base_event.get("recurring"),
            "status": "scheduled",
            "jitsi_room_name": generate_jitsi_room_name(event_id, base_event["title"]),
            "participants": [],
            "attendance_log": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "parent_event_id": str(base_event["_id"]),
            "requires_moderation": base_event.get("requires_moderation", True),
            "waiting_room_enabled": base_event.get("waiting_room_enabled", True),
        }
        
        await db.events.insert_one(future_event)


@router.get("/admin/all", response_model=List[EventResponse])
async def get_all_events(
    status: Optional[str] = None,
    include_past: bool = False
):
    """Get all events (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    query = {}
    
    if status:
        query["status"] = status
    
    if not include_past:
        query["event_date"] = {"$gte": datetime.utcnow() - timedelta(hours=2)}
    
    events = await db.events.find(query).sort("event_date", 1).to_list(100)
    return [serialize_event(e) for e in events]


@router.put("/admin/{event_id}", response_model=EventResponse)
async def update_event(event_id: str, update: EventUpdate):
    """Update an event (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        obj_id = ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.events.find_one_and_update(
        {"_id": obj_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return serialize_event(result)


@router.delete("/admin/{event_id}")
async def delete_event(event_id: str):
    """Delete/cancel an event (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        obj_id = ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    # Soft delete - mark as cancelled
    result = await db.events.find_one_and_update(
        {"_id": obj_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.utcnow()}}
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {"message": "Event cancelled successfully"}


@router.get("/admin/{event_id}/attendance")
async def get_event_attendance(event_id: str):
    """Get attendance log for an event (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        obj_id = ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    event = await db.events.find_one({"_id": obj_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {
        "event_id": event_id,
        "title": event["title"],
        "event_date": event["event_date"],
        "total_participants": len(event.get("participants", [])),
        "attendance_log": event.get("attendance_log", [])
    }


# ============ USER ENDPOINTS ============

@router.get("/upcoming", response_model=List[EventResponse])
async def get_upcoming_events(limit: int = 10):
    """Get upcoming events visible to users"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    now = datetime.utcnow()
    
    # Get events that are scheduled or currently live
    events = await db.events.find({
        "status": {"$in": ["scheduled", "live"]},
        "event_date": {"$gte": now - timedelta(hours=2)}  # Include events that started up to 2 hours ago
    }).sort("event_date", 1).limit(limit).to_list(limit)
    
    return [serialize_event(e) for e in events]


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: str):
    """Get a single event by ID"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        obj_id = ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    event = await db.events.find_one({"_id": obj_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return serialize_event(event)


@router.post("/{event_id}/join", response_model=JoinEventResponse)
async def join_event(event_id: str, display_name: str = "Veteran", user_id: Optional[str] = None):
    """Join an event and get Jitsi room details"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        obj_id = ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    event = await db.events.find_one({"_id": obj_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if event is joinable
    now = datetime.utcnow()
    event_start = event["event_date"]
    event_end = event_start + timedelta(minutes=event["duration_minutes"])
    
    # Allow joining 10 minutes before start until event ends
    join_window_start = event_start - timedelta(minutes=10)
    
    if now < join_window_start:
        raise HTTPException(
            status_code=400, 
            detail=f"Event hasn't started yet. Opens at {join_window_start.isoformat()}"
        )
    
    if now > event_end:
        raise HTTPException(status_code=400, detail="Event has ended")
    
    if event.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Event was cancelled")
    
    # Check max participants
    if event.get("max_participants"):
        current_count = len(event.get("participants", []))
        if current_count >= event["max_participants"]:
            raise HTTPException(status_code=400, detail="Event is full")
    
    # Update event status to live if needed
    if event.get("status") == "scheduled" and now >= event_start:
        await db.events.update_one(
            {"_id": obj_id},
            {"$set": {"status": "live"}}
        )
    
    # Log participant join
    participant_id = user_id or f"anon_{secrets.token_hex(4)}"
    await db.events.update_one(
        {"_id": obj_id},
        {
            "$addToSet": {"participants": participant_id},
            "$push": {
                "attendance_log": {
                    "user_id": participant_id,
                    "display_name": display_name,
                    "joined_at": now,
                    "action": "joined"
                }
            }
        }
    )
    
    # Check if user is moderator (staff)
    is_moderator = False
    if user_id:
        staff = await db.staff.find_one({"user_id": user_id})
        is_moderator = staff is not None
    
    # Jitsi configuration
    jitsi_config = {
        "startWithAudioMuted": True,
        "startWithVideoMuted": False,
        "disableDeepLinking": True,
        "prejoinPageEnabled": event.get("waiting_room_enabled", True),
        "enableClosePage": False,
        "disableInviteFunctions": True,
        "hideConferenceSubject": False,
        "subject": event["title"],
        "toolbarButtons": [
            "camera",
            "chat",
            "desktop",
            "fullscreen",
            "hangup",
            "microphone",
            "participants-pane",
            "raisehand",
            "settings",
            "tileview",
            "toggle-camera",
        ],
        "interfaceConfigOverwrite": {
            "SHOW_JITSI_WATERMARK": False,
            "SHOW_WATERMARK_FOR_GUESTS": False,
            "TOOLBAR_ALWAYS_VISIBLE": True,
            "DISABLE_JOIN_LEAVE_NOTIFICATIONS": False,
            "MOBILE_APP_PROMO": False,
        }
    }
    
    # Add moderator-only buttons
    if is_moderator:
        jitsi_config["toolbarButtons"].extend([
            "mute-everyone",
            "mute-video-everyone",
            "security",
        ])
    
    return {
        "event_id": event_id,
        "jitsi_room_name": event["jitsi_room_name"],
        "jitsi_domain": "meet.jit.si",  # Public Jitsi server
        "display_name": display_name,
        "is_moderator": is_moderator,
        "jwt_token": None,  # Not using JWT auth for public Jitsi
        "config": jitsi_config
    }


@router.post("/{event_id}/leave")
async def leave_event(event_id: str, user_id: Optional[str] = None):
    """Log when a user leaves an event"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        obj_id = ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    participant_id = user_id or "anonymous"
    
    await db.events.update_one(
        {"_id": obj_id},
        {
            "$push": {
                "attendance_log": {
                    "user_id": participant_id,
                    "left_at": datetime.utcnow(),
                    "action": "left"
                }
            }
        }
    )
    
    return {"message": "Left event successfully"}


# ============ REMINDER ENDPOINTS ============

@router.post("/{event_id}/remind")
async def set_event_reminder(event_id: str, user_id: str):
    """Set a reminder for an event"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        obj_id = ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    event = await db.events.find_one({"_id": obj_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Store reminder
    reminder = {
        "user_id": user_id,
        "event_id": event_id,
        "event_title": event["title"],
        "event_date": event["event_date"],
        "remind_30min": False,
        "remind_1day": False,
        "created_at": datetime.utcnow()
    }
    
    await db.event_reminders.update_one(
        {"user_id": user_id, "event_id": event_id},
        {"$set": reminder},
        upsert=True
    )
    
    return {"message": "Reminder set successfully"}


@router.delete("/{event_id}/remind")
async def remove_event_reminder(event_id: str, user_id: str):
    """Remove a reminder for an event"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    await db.event_reminders.delete_one({
        "user_id": user_id,
        "event_id": event_id
    })
    
    return {"message": "Reminder removed"}


@router.get("/reminders/{user_id}")
async def get_user_reminders(user_id: str):
    """Get all reminders for a user"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    reminders = await db.event_reminders.find({
        "user_id": user_id,
        "event_date": {"$gte": datetime.utcnow()}
    }).to_list(50)
    
    return [{
        "event_id": r["event_id"],
        "event_title": r["event_title"],
        "event_date": r["event_date"]
    } for r in reminders]
