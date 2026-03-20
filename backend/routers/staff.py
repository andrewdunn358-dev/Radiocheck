"""
Staff Router - Counsellors and Peer Supporters management
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import uuid
from datetime import datetime

from services.database import get_database
from models.schemas import (
    CounsellorCreate, Counsellor, CounsellorStatusUpdate, CounsellorPublic,
    PeerSupporterCreate, PeerSupporter, PeerSupporterStatusUpdate, PeerSupporterPublic
)

# Import socket.io for real-time status sync
try:
    from webrtc_signaling import sio
    HAS_SOCKETIO = True
except ImportError:
    HAS_SOCKETIO = False

router = APIRouter(tags=["staff"])


# ==========================================
# Counsellors
# ==========================================

@router.post("/counsellors", response_model=Counsellor)
async def create_counsellor(counsellor: CounsellorCreate):
    """Create a new counsellor"""
    db = get_database()
    counsellor_data = counsellor.dict()
    counsellor_data["id"] = str(uuid.uuid4())
    counsellor_data["status"] = "offline"
    counsellor_data["created_at"] = datetime.utcnow()
    
    await db.counsellors.insert_one(counsellor_data)
    return {**counsellor_data, "_id": None}


@router.get("/counsellors", response_model=List[Counsellor])
async def get_counsellors():
    """Get all counsellors"""
    db = get_database()
    counsellors = await db.counsellors.find({}).to_list(100)
    return [{**c, "id": str(c.get("_id", c.get("id", "")))} for c in counsellors]


@router.get("/counsellors/available")
async def get_available_counsellors():
    """Get available counsellors (public view - no contact info)"""
    db = get_database()
    counsellors = await db.counsellors.find({"status": {"$ne": "offline"}}).to_list(100)
    return [{
        "id": str(c.get("_id", c.get("id", ""))),
        "name": c.get("name", ""),
        "specialization": c.get("specialization", ""),
        "status": c.get("status", "offline"),
        "user_id": c.get("user_id", "")  # For WebRTC calling - links to auth user
    } for c in counsellors]


@router.get("/counsellors/{counsellor_id}", response_model=Counsellor)
async def get_counsellor(counsellor_id: str):
    """Get a single counsellor by ID"""
    db = get_database()
    counsellor = await db.counsellors.find_one({"$or": [{"id": counsellor_id}, {"_id": counsellor_id}]})
    if not counsellor:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    counsellor["id"] = str(counsellor.get("_id", counsellor.get("id", "")))
    return counsellor


@router.put("/counsellors/{counsellor_id}", response_model=Counsellor)
async def update_counsellor(counsellor_id: str, updates: dict):
    """Update a counsellor"""
    db = get_database()
    updates["updated_at"] = datetime.utcnow()
    
    result = await db.counsellors.update_one(
        {"$or": [{"id": counsellor_id}, {"_id": counsellor_id}]},
        {"$set": updates}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    
    return await get_counsellor(counsellor_id)


# Unified status endpoint that works for both counsellors and peer supporters
@router.patch("/{staff_id}/status")
async def update_staff_status_unified(staff_id: str, status_update: CounsellorStatusUpdate):
    """Update staff status - works for both counsellors and peer supporters"""
    db = get_database()
    update_data = {k: v for k, v in status_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    staff_type = None
    
    # Try counsellors first
    result = await db.counsellors.update_one(
        {"$or": [{"id": staff_id}, {"user_id": staff_id}]},
        {"$set": update_data}
    )
    
    if result.modified_count > 0:
        staff_type = "counsellor"
    else:
        # Try peer supporters
        result = await db.peer_supporters.update_one(
            {"$or": [{"id": staff_id}, {"user_id": staff_id}]},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            staff_type = "peer"
    
    if not staff_type:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Emit socket event for real-time sync across all portals
    if HAS_SOCKETIO and status_update.status:
        try:
            import asyncio
            asyncio.create_task(sio.emit('staff_status_changed', {
                'user_id': staff_id,
                'status': status_update.status
            }))
        except Exception as e:
            print(f"[Staff] Failed to emit status change: {e}")
    
    return {"success": True, "type": staff_type}


@router.patch("/counsellors/{counsellor_id}/status")
async def update_counsellor_status(counsellor_id: str, status_update: CounsellorStatusUpdate):
    """Update counsellor status"""
    db = get_database()
    update_data = {k: v for k, v in status_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Query by id or user_id to handle different ID formats
    result = await db.counsellors.update_one(
        {"$or": [{"id": counsellor_id}, {"user_id": counsellor_id}]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    
    return {"success": True}


@router.delete("/counsellors/{counsellor_id}")
async def delete_counsellor(counsellor_id: str):
    """Delete a counsellor"""
    db = get_database()
    result = await db.counsellors.delete_one({"$or": [{"id": counsellor_id}, {"_id": counsellor_id}]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    
    return {"deleted": True}


# ==========================================
# Peer Supporters
# ==========================================

@router.post("/peer-supporters", response_model=PeerSupporter)
async def create_peer_supporter(peer: PeerSupporterCreate):
    """Create a new peer supporter"""
    db = get_database()
    peer_data = peer.dict()
    peer_data["id"] = str(uuid.uuid4())
    peer_data["status"] = "offline"
    peer_data["created_at"] = datetime.utcnow()
    
    await db.peer_supporters.insert_one(peer_data)
    return {**peer_data, "_id": None}


@router.get("/peer-supporters", response_model=List[PeerSupporter])
async def get_peer_supporters():
    """Get all peer supporters"""
    db = get_database()
    peers = await db.peer_supporters.find({}).to_list(100)
    return [{**p, "id": str(p.get("_id", p.get("id", "")))} for p in peers]


@router.get("/peer-supporters/available")
async def get_available_peer_supporters():
    """Get available peer supporters (public view - no contact info)"""
    db = get_database()
    peers = await db.peer_supporters.find({"status": {"$ne": "offline"}}).to_list(100)
    return [{
        "id": str(p.get("_id", p.get("id", ""))),
        "name": p.get("name", ""),
        "service_branch": p.get("service_branch", ""),
        "regiment": p.get("regiment", ""),
        "status": p.get("status", "offline"),
        "user_id": p.get("user_id", "")  # For WebRTC calling - links to auth user
    } for p in peers]


@router.get("/peer-supporters/{peer_id}", response_model=PeerSupporter)
async def get_peer_supporter(peer_id: str):
    """Get a single peer supporter by ID"""
    db = get_database()
    peer = await db.peer_supporters.find_one({"$or": [{"id": peer_id}, {"_id": peer_id}]})
    if not peer:
        raise HTTPException(status_code=404, detail="Peer supporter not found")
    peer["id"] = str(peer.get("_id", peer.get("id", "")))
    return peer


@router.put("/peer-supporters/{peer_id}", response_model=PeerSupporter)
async def update_peer_supporter(peer_id: str, updates: dict):
    """Update a peer supporter"""
    db = get_database()
    updates["updated_at"] = datetime.utcnow()
    
    result = await db.peer_supporters.update_one(
        {"$or": [{"id": peer_id}, {"_id": peer_id}]},
        {"$set": updates}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Peer supporter not found")
    
    return await get_peer_supporter(peer_id)


@router.patch("/peer-supporters/{peer_id}/status")
async def update_peer_supporter_status(peer_id: str, status_update: PeerSupporterStatusUpdate):
    """Update peer supporter status"""
    db = get_database()
    update_data = {k: v for k, v in status_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Query by id, _id, or user_id to handle different ID formats
    result = await db.peer_supporters.update_one(
        {"$or": [{"id": peer_id}, {"user_id": peer_id}]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Peer supporter not found")
    
    return {"success": True}


@router.delete("/peer-supporters/{peer_id}")
async def delete_peer_supporter(peer_id: str):
    """Delete a peer supporter"""
    db = get_database()
    result = await db.peer_supporters.delete_one({"$or": [{"id": peer_id}, {"_id": peer_id}]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Peer supporter not found")
    
    return {"deleted": True}
