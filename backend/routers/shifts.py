"""
Shifts Router - Staff scheduling and rota management with push notifications
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import uuid
from datetime import datetime, date
import os
import resend
import logging

from services.database import get_database
from models.schemas import ShiftCreate, Shift, ShiftUpdate

router = APIRouter(prefix="/shifts", tags=["shifts"])
logger = logging.getLogger(__name__)

# Initialize Resend for email notifications
resend.api_key = os.getenv("RESEND_API_KEY")


async def send_shift_notification(shift_data: dict, staff_email: str, notification_type: str = "created"):
    """Send email notification for shift changes"""
    if not resend.api_key:
        logger.warning("RESEND_API_KEY not set, skipping email notification")
        return False
    
    subject_map = {
        "created": "New Shift Assigned - Radio Check",
        "updated": "Shift Updated - Radio Check",
        "deleted": "Shift Cancelled - Radio Check"
    }
    
    try:
        resend.Emails.send({
            "from": "Radio Check <noreply@radiocheck.me>",
            "to": [staff_email],
            "subject": subject_map.get(notification_type, "Shift Notification"),
            "html": f"""
                <h2>Radio Check - Shift Notification</h2>
                <p>Your shift has been {notification_type}:</p>
                <ul>
                    <li><strong>Date:</strong> {shift_data.get('date', 'N/A')}</li>
                    <li><strong>Start Time:</strong> {shift_data.get('start_time', 'N/A')}</li>
                    <li><strong>End Time:</strong> {shift_data.get('end_time', 'N/A')}</li>
                </ul>
                <p>Log in to the staff portal for more details.</p>
            """
        })
        logger.info(f"Shift notification email sent to {staff_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send shift notification: {e}")
        return False


async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """
    Send push notification to a user
    This integrates with Expo Push Notifications for React Native
    """
    db = get_database()
    
    # Get user's push token
    user = await db.users.find_one({"id": user_id})
    push_token = user.get("push_token") if user else None
    
    if not push_token:
        logger.warning(f"No push token for user {user_id}")
        return False
    
    try:
        import httpx
        
        message = {
            "to": push_token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {}
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                logger.info(f"Push notification sent to user {user_id}")
                return True
            else:
                logger.error(f"Push notification failed: {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")
        return False


@router.get("/")
async def get_shifts(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: Optional[str] = None
):
    """Get all shifts with optional date range filter"""
    db = get_database()
    
    query = {}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if user_id:
        query["user_id"] = user_id
    
    shifts = await db.shifts.find(query).sort("date", 1).to_list(500)
    
    return [{
        "id": s.get("id", str(s.get("_id", ""))),
        "user_id": s.get("user_id"),
        "user_name": s.get("user_name", ""),
        "date": s.get("date"),
        "start_time": s.get("start_time"),
        "end_time": s.get("end_time"),
        "created_at": s.get("created_at").isoformat() if s.get("created_at") else None
    } for s in shifts]


@router.get("/today")
async def get_today_shifts():
    """Get all shifts for today"""
    db = get_database()
    today = date.today().isoformat()
    
    shifts = await db.shifts.find({"date": today}).to_list(100)
    
    return [{
        "id": s.get("id", str(s.get("_id", ""))),
        "user_id": s.get("user_id"),
        "user_name": s.get("user_name", ""),
        "date": s.get("date"),
        "start_time": s.get("start_time"),
        "end_time": s.get("end_time")
    } for s in shifts]


@router.get("/my-shifts")
async def get_my_shifts(user_id: str):
    """Get shifts for a specific user"""
    db = get_database()
    
    shifts = await db.shifts.find({"user_id": user_id}).sort("date", 1).to_list(100)
    
    return [{
        "id": s.get("id", str(s.get("_id", ""))),
        "date": s.get("date"),
        "start_time": s.get("start_time"),
        "end_time": s.get("end_time")
    } for s in shifts]


@router.post("/")
async def create_shift(shift: ShiftCreate, user_id: str, user_name: str = "", user_email: str = ""):
    """Create a new shift with notifications"""
    db = get_database()
    
    shift_data = shift.dict()
    shift_data["id"] = str(uuid.uuid4())
    shift_data["user_id"] = user_id
    shift_data["user_name"] = user_name
    shift_data["created_at"] = datetime.utcnow()
    shift_data["updated_at"] = datetime.utcnow()
    
    await db.shifts.insert_one(shift_data)
    
    # Send notifications
    if user_email:
        await send_shift_notification(shift_data, user_email, "created")
    
    # Send push notification
    await send_push_notification(
        user_id,
        "New Shift Assigned",
        f"You have a new shift on {shift.date} from {shift.start_time} to {shift.end_time}",
        {"type": "shift_created", "shift_id": shift_data["id"]}
    )
    
    return {**shift_data, "_id": None}


@router.put("/{shift_id}")
async def update_shift(shift_id: str, updates: ShiftUpdate):
    """Update a shift with notifications"""
    db = get_database()
    
    # Get existing shift for notification
    existing = await db.shifts.find_one({"$or": [{"id": shift_id}, {"_id": shift_id}]})
    if not existing:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.shifts.update_one(
        {"$or": [{"id": shift_id}, {"_id": shift_id}]},
        {"$set": update_data}
    )
    
    # Send push notification
    await send_push_notification(
        existing.get("user_id"),
        "Shift Updated",
        f"Your shift on {existing.get('date')} has been updated",
        {"type": "shift_updated", "shift_id": shift_id}
    )
    
    return {"success": True}


@router.delete("/{shift_id}")
async def delete_shift(shift_id: str):
    """Delete a shift with notifications"""
    db = get_database()
    
    # Get shift for notification before deleting
    shift = await db.shifts.find_one({"$or": [{"id": shift_id}, {"_id": shift_id}]})
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    await db.shifts.delete_one({"$or": [{"id": shift_id}, {"_id": shift_id}]})
    
    # Send push notification
    await send_push_notification(
        shift.get("user_id"),
        "Shift Cancelled",
        f"Your shift on {shift.get('date')} has been cancelled",
        {"type": "shift_deleted", "shift_id": shift_id}
    )
    
    return {"deleted": True}


@router.get("/coverage")
async def get_shift_coverage(start_date: str, end_date: str):
    """Get shift coverage summary for a date range"""
    db = get_database()
    
    shifts = await db.shifts.find({
        "date": {"$gte": start_date, "$lte": end_date}
    }).to_list(1000)
    
    # Group by date
    coverage = {}
    for shift in shifts:
        date_key = shift.get("date")
        if date_key not in coverage:
            coverage[date_key] = {"shifts": [], "total_hours": 0}
        
        coverage[date_key]["shifts"].append({
            "user_name": shift.get("user_name", ""),
            "start_time": shift.get("start_time"),
            "end_time": shift.get("end_time")
        })
        
        # Calculate hours (simplified)
        try:
            start = datetime.strptime(shift.get("start_time", "09:00"), "%H:%M")
            end = datetime.strptime(shift.get("end_time", "17:00"), "%H:%M")
            hours = (end - start).seconds / 3600
            coverage[date_key]["total_hours"] += hours
        except (ValueError, KeyError):
            pass
    
    return coverage


@router.post("/register-push-token")
async def register_push_token(user_id: str, push_token: str):
    """Register a push notification token for a user"""
    db = get_database()
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"push_token": push_token}},
        upsert=True
    )
    
    return {"success": True}


@router.post("/send-reminders")
async def send_shift_reminders():
    """
    Manually trigger shift reminder check.
    This will send email reminders to staff with shifts in the next 24 hours.
    
    In production, this should be called by a cron job every 15 minutes:
    */15 * * * * curl -X POST https://api.radiocheck.me/api/shifts/send-reminders
    """
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts'))
    
    from shift_reminders import check_and_send_reminders
    
    result = await check_and_send_reminders()
    return result


@router.get("/reminder-status")
async def get_reminder_status():
    """Get status of sent reminders for auditing"""
    db = get_database()
    
    # Get recent reminders
    cursor = db.sent_reminders.find(
        {},
        {'_id': 0}
    ).sort('sent_at', -1).limit(50)
    
    reminders = await cursor.to_list(length=50)
    
    # Get counts by type
    count_24h = await db.sent_reminders.count_documents({'reminder_type': '24_hour'})
    count_1h = await db.sent_reminders.count_documents({'reminder_type': '1_hour'})
    
    return {
        'total_24h_reminders': count_24h,
        'total_1h_reminders': count_1h,
        'recent_reminders': reminders
    }
