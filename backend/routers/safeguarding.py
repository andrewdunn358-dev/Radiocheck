"""
Safeguarding Router - Panic alerts and safeguarding alerts management
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime

from services.database import get_database
from models.schemas import PanicAlertCreate, PanicAlert, SafeguardingAlert
from routers.auth import require_role

# CONTAINMENT, 29 September 2026
# ------------------------------
# Until this change no route in this file checked who was calling. The router
# declared no dependency, server.py includes it with none, and the only
# middleware on the app is CORS. So GET /api/safeguarding/safeguarding-alerts
# returned every AI safeguarding alert — triggering message, full conversation
# history, IP address, geolocation — to an unauthenticated caller, and the
# screening-submission and panic-alert routes could likewise be read and
# changed by anyone. The equivalent routes in server.py all require a login.
#
# Two sub-routers, merged into `router` at the bottom of this file so server.py
# is unchanged:
#
#   _public_router  the two intake routes the app/portal submit to. Left open
#                   deliberately: POST /concern is called by the mental-health
#                   screening screen (frontend/app/mental-health-screening.tsx)
#                   and POST /panic-alert by the staff portal panic button.
#                   Neither returns stored records.
#
#   _staff_router   every route that reads or changes stored records. Requires
#                   admin or supervisor — the same boundary server.py already
#                   applies to screening submissions (get_screening_submissions).
#                   The one client call into this group, the portal's
#                   PATCH /safeguarding/screening-submissions/{id}/status
#                   (portal/src/lib/admin-api.ts), is an admin action and sends
#                   its bearer token.
#
# The dependency sits on the sub-router, not on each route, so a route added
# to _staff_router later inherits the boundary instead of opting into it.
# `require_role` is Radio Check's existing gate (routers/auth.py); no new
# authentication mechanism is introduced, and no handler body is changed.
router = APIRouter(prefix="/safeguarding", tags=["safeguarding"])
_public_router = APIRouter()
_staff_router = APIRouter(dependencies=[Depends(require_role("admin", "supervisor"))])


# ==========================================
# Screening Submissions (PHQ-9, GAD-7)
# ==========================================

class ScreeningSubmission(BaseModel):
    user_id: str
    user_name: str = "Anonymous"
    concern_type: str  # 'mental_health_screening'
    severity: str  # 'low', 'medium', 'high'
    details: str
    source: str = "app_screening"

@_public_router.post("/concern")
async def submit_screening_concern(submission: ScreeningSubmission):
    """Submit a screening result for counsellor review"""
    db = get_database()
    
    concern_data = {
        "id": str(uuid.uuid4()),
        "user_id": submission.user_id,
        "user_name": submission.user_name,
        "concern_type": submission.concern_type,
        "severity": submission.severity,
        "details": submission.details,
        "source": submission.source,
        "status": "pending",  # pending, reviewed, contacted, resolved
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.screening_submissions.insert_one(concern_data)
    
    return {"success": True, "id": concern_data["id"], "message": "Submission received"}


@_staff_router.get("/screening-submissions")
async def get_screening_submissions(status: Optional[str] = None, severity: Optional[str] = None):
    """Get all screening submissions for staff review"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    
    submissions = await db.screening_submissions.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return submissions


@_staff_router.get("/screening-submissions/{submission_id}")
async def get_screening_submission(submission_id: str):
    """Get a single screening submission"""
    db = get_database()
    
    submission = await db.screening_submissions.find_one({"$or": [{"id": submission_id}, {"_id": submission_id}]}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    return submission


@_staff_router.patch("/screening-submissions/{submission_id}/status")
async def update_screening_status(submission_id: str, status: str, notes: str = "", assigned_to: str = None, assigned_to_name: str = None):
    """Update screening submission status"""
    db = get_database()
    
    update_data = {
        "status": status,
        "updated_at": datetime.utcnow()
    }
    
    if notes:
        update_data["staff_notes"] = notes
    if assigned_to:
        update_data["assigned_to"] = assigned_to
    if assigned_to_name:
        update_data["assigned_to_name"] = assigned_to_name
    if status == "resolved":
        update_data["resolved_at"] = datetime.utcnow()
    if status == "contacted":
        update_data["contacted_at"] = datetime.utcnow()
    
    result = await db.screening_submissions.update_one(
        {"$or": [{"id": submission_id}, {"_id": submission_id}]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    return {"success": True}


@_staff_router.get("/screening-submissions/stats/summary")
async def get_screening_stats():
    """Get screening submission statistics"""
    db = get_database()
    
    total = await db.screening_submissions.count_documents({})
    pending = await db.screening_submissions.count_documents({"status": "pending"})
    reviewed = await db.screening_submissions.count_documents({"status": "reviewed"})
    contacted = await db.screening_submissions.count_documents({"status": "contacted"})
    resolved = await db.screening_submissions.count_documents({"status": "resolved"})
    
    # By severity
    high = await db.screening_submissions.count_documents({"severity": "high"})
    medium = await db.screening_submissions.count_documents({"severity": "medium"})
    low = await db.screening_submissions.count_documents({"severity": "low"})
    
    return {
        "total": total,
        "by_status": {
            "pending": pending,
            "reviewed": reviewed,
            "contacted": contacted,
            "resolved": resolved
        },
        "by_severity": {
            "high": high,
            "medium": medium,
            "low": low
        }
    }


# ==========================================
# Panic Alerts
# ==========================================

@_public_router.post("/panic-alert")
async def create_panic_alert(alert: PanicAlertCreate):
    """Create a panic alert (SOS button pressed)"""
    db = get_database()
    
    alert_data = alert.dict()
    alert_data["id"] = str(uuid.uuid4())
    alert_data["status"] = "active"
    alert_data["created_at"] = datetime.utcnow()
    
    await db.panic_alerts.insert_one(alert_data)
    
    # TODO: Send notifications to staff
    # await notify_staff_of_panic_alert(alert_data)
    
    # Remove _id before returning
    alert_data.pop("_id", None)
    return alert_data


@_staff_router.get("/panic-alerts")
async def get_panic_alerts(status: Optional[str] = None):
    """Get all panic alerts, optionally filtered by status"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    alerts = await db.panic_alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return alerts


@_staff_router.patch("/panic-alerts/{alert_id}/acknowledge")
async def acknowledge_panic_alert(alert_id: str, staff_id: str, staff_name: str = ""):
    """Acknowledge a panic alert"""
    db = get_database()
    
    result = await db.panic_alerts.update_one(
        {"$or": [{"id": alert_id}, {"_id": alert_id}]},
        {"$set": {
            "status": "acknowledged",
            "acknowledged_by": staff_id,
            "acknowledged_by_name": staff_name,
            "acknowledged_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True}


@_staff_router.patch("/panic-alerts/{alert_id}/resolve")
async def resolve_panic_alert(alert_id: str, staff_id: str, notes: str = ""):
    """Resolve a panic alert"""
    db = get_database()
    
    result = await db.panic_alerts.update_one(
        {"$or": [{"id": alert_id}, {"_id": alert_id}]},
        {"$set": {
            "status": "resolved",
            "resolved_by": staff_id,
            "resolved_at": datetime.utcnow(),
            "resolution_notes": notes
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True}


# ==========================================
# Safeguarding Alerts (AI-triggered)
# ==========================================

@_staff_router.get("/safeguarding-alerts")
async def get_safeguarding_alerts(status: Optional[str] = None, risk_level: Optional[str] = None):
    """Get safeguarding alerts from AI chat sessions"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if risk_level:
        query["risk_level"] = risk_level
    
    alerts = await db.safeguarding_alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return alerts


@_staff_router.get("/safeguarding-alerts/{alert_id}")
async def get_safeguarding_alert(alert_id: str):
    """Get a single safeguarding alert with full details"""
    db = get_database()
    
    alert = await db.safeguarding_alerts.find_one({"$or": [{"id": alert_id}, {"_id": alert_id}]}, {"_id": 0})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return alert


@_staff_router.patch("/safeguarding-alerts/{alert_id}/acknowledge")
async def acknowledge_safeguarding_alert(alert_id: str, staff_id: str, staff_name: str = ""):
    """Acknowledge a safeguarding alert"""
    db = get_database()
    
    result = await db.safeguarding_alerts.update_one(
        {"$or": [{"id": alert_id}, {"_id": alert_id}]},
        {"$set": {
            "status": "acknowledged",
            "acknowledged_by": staff_id,
            "acknowledged_by_name": staff_name,
            "acknowledged_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True}


@_staff_router.patch("/safeguarding-alerts/{alert_id}/resolve")
async def resolve_safeguarding_alert(alert_id: str, staff_id: str, notes: str = "", outcome: str = ""):
    """Resolve a safeguarding alert"""
    db = get_database()
    
    result = await db.safeguarding_alerts.update_one(
        {"$or": [{"id": alert_id}, {"_id": alert_id}]},
        {"$set": {
            "status": "resolved",
            "resolved_by": staff_id,
            "resolved_at": datetime.utcnow(),
            "resolution_notes": notes,
            "outcome_assessment": outcome
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True}


@_staff_router.patch("/safeguarding-alerts/{alert_id}/notes")
async def update_safeguarding_notes(alert_id: str, notes: str):
    """Update notes on a safeguarding alert"""
    db = get_database()
    
    result = await db.safeguarding_alerts.update_one(
        {"$or": [{"id": alert_id}, {"_id": alert_id}]},
        {"$set": {"notes": notes, "updated_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True}


@_staff_router.get("/safeguarding-alerts/stats/summary")
async def get_safeguarding_stats():
    """Get summary statistics for safeguarding alerts"""
    db = get_database()
    
    total = await db.safeguarding_alerts.count_documents({})
    active = await db.safeguarding_alerts.count_documents({"status": "active"})
    acknowledged = await db.safeguarding_alerts.count_documents({"status": "acknowledged"})
    resolved = await db.safeguarding_alerts.count_documents({"status": "resolved"})
    
    # Count by risk level
    red = await db.safeguarding_alerts.count_documents({"risk_level": "RED"})
    amber = await db.safeguarding_alerts.count_documents({"risk_level": "AMBER"})
    yellow = await db.safeguarding_alerts.count_documents({"risk_level": "YELLOW"})
    
    return {
        "total": total,
        "by_status": {
            "active": active,
            "acknowledged": acknowledged,
            "resolved": resolved
        },
        "by_risk_level": {
            "RED": red,
            "AMBER": amber,
            "YELLOW": yellow
        }
    }


# Merge the two groups into the router server.py includes (server.py:9731).
router.include_router(_public_router)
router.include_router(_staff_router)
