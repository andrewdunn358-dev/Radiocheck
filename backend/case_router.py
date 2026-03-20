"""
Case Management API Router

Endpoints for managing triage cases with privacy controls:
- Counsellors can only see their own cases
- Admin can see all cases
- Peers cannot access case management
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
import logging

from case_management import (
    CaseRecord, CaseStatus, RiskLevel, ReferralStatus,
    TriageSessionNote, SafetyPlan, Referral, CheckIn, CheckInMethod,
    SessionOutcome, CaseTimelineEntry,
    create_timeline_entry, generate_handoff_summary,
    PROTECTIVE_FACTORS, WARNING_SIGNS, SESSION_ACTIONS, REFERRAL_SERVICES
)

# Will be set by main server
db = None
security = HTTPBearer()
get_current_user = None

def set_dependencies(database, current_user_func):
    """Set database and auth dependencies from main server"""
    global db, get_current_user
    db = database
    get_current_user = current_user_func


case_router = APIRouter(prefix="/cases", tags=["Case Management"])


# ============================================================================
# REQUEST MODELS
# ============================================================================

class CreateCaseRequest(BaseModel):
    """Request to create a case from safeguarding alert"""
    safeguarding_alert_id: str
    initial_notes: Optional[str] = None
    user_name: Optional[str] = None

class CreateCaseDirectRequest(BaseModel):
    """Request to create a case directly without a safeguarding alert"""
    user_name: str
    user_id: Optional[str] = None
    initial_notes: Optional[str] = None
    risk_level: Optional[str] = "medium"

class AddSessionRequest(BaseModel):
    """Request to add a triage session note"""
    presenting_issue: str
    risk_level: str = "moderate"
    protective_factors: List[str] = []
    warning_signs: List[str] = []
    outcome: str = "continue_monitoring"
    actions_taken: List[str] = []
    verbatim_quotes: Optional[str] = None
    next_steps: Optional[str] = None
    follow_up_date: Optional[str] = None
    duration_minutes: Optional[int] = None

class UpdateSafetyPlanRequest(BaseModel):
    """Request to create/update safety plan"""
    warning_signs: List[str] = []
    internal_coping: List[str] = []
    distractions: List[str] = []
    support_people: List[Dict[str, str]] = []
    professionals: List[Dict[str, str]] = []
    environment_safety: List[str] = []
    reasons_for_living: List[str] = []

class CreateReferralRequest(BaseModel):
    """Request to create a referral"""
    service_id: str
    service_name: str
    service_type: str
    urgency: str = "routine"
    notes: Optional[str] = None
    user_name: Optional[str] = None
    user_contact: Optional[str] = None
    service_info: Optional[Dict[str, str]] = None

class AddCheckInRequest(BaseModel):
    """Request to log a check-in"""
    method: str  # phone, in_app, sms, email
    contact_made: bool
    risk_level: Optional[str] = None
    notes: str = ""
    next_check_in: Optional[str] = None
    re_escalate: bool = False

class SessionOverrideRequest(BaseModel):
    """Request to override session cap"""
    reason: str

class ShareCaseRequest(BaseModel):
    """Request to share case with another counsellor"""
    counsellor_id: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_user_with_role_check(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user and verify they're a counsellor, peer, or admin"""
    user = await get_current_user(credentials)
    # Convert User model to dict if necessary
    if hasattr(user, 'dict'):
        user = user.dict() if callable(user.dict) else dict(user)
    elif hasattr(user, '__dict__'):
        user = vars(user)
    
    role = user.get("role", "")
    # Allow peers to access case management (for their own cases)
    if role not in ["admin", "supervisor", "counsellor", "staff", "peer"]:
        raise HTTPException(status_code=403, detail="Only staff members can access case management")
    return user


async def check_case_access(case_id: str, user: dict) -> dict:
    """Check if user has access to a case and return it"""
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    user_role = user.get("role", "")
    user_id = user.get("id") or user.get("user_id")
    
    # Admin and supervisor can see all
    if user_role in ["admin", "supervisor"]:
        return case
    
    # Counsellor can see own cases or shared cases
    if user_role in ["counsellor", "staff"]:
        if case["assigned_to"] != user_id and user_id not in case.get("shared_with", []):
            raise HTTPException(status_code=403, detail="You don't have access to this case")
        return case
    
    # Peer can only see their own assigned cases
    if user_role == "peer":
        if case["assigned_to"] != user_id:
            raise HTTPException(status_code=403, detail="You don't have access to this case")
        return case
    
    # Default: deny access
    raise HTTPException(status_code=403, detail="You don't have access to this case")


# ============================================================================
# ENDPOINTS - CASE LISTING
# ============================================================================

@case_router.get("")
async def get_my_cases(
    status: Optional[str] = None,
    user: dict = Depends(get_user_with_role_check)
):
    """Get cases for logged-in staff member (or all for admin)"""
    try:
        user_id = user.get("id") or user.get("user_id")
        user_role = user.get("role", "")
        
        # Build query based on role
        if user_role == "admin":
            # Admin sees all cases
            query = {}
        elif user_role in ["supervisor", "counsellor", "staff"]:
            # Counsellors/supervisors see own cases + shared with them
            query = {
                "$or": [
                    {"assigned_to": user_id},
                    {"shared_with": user_id}
                ]
            }
        elif user_role == "peer":
            # Peers only see their own assigned cases (can escalate but not see others)
            query = {"assigned_to": user_id}
        else:
            query = {"assigned_to": user_id}
        
        if status:
            query["status"] = status
        
        cases = await db.cases.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
        
        # Return summary view (don't include full conversation in list)
        for case in cases:
            case.pop("ai_conversation", None)
            case.pop("timeline", None)
        
        return cases
    except Exception as e:
        logging.error(f"Error fetching cases: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch cases")


@case_router.get("/morning-queue")
async def get_morning_queue(user: dict = Depends(get_user_with_role_check)):
    """Get overnight alerts that need review (for morning queue)"""
    try:
        # Get unacknowledged alerts from overnight (after 5pm yesterday, before 9am today)
        now = datetime.now(timezone.utc)
        today_9am = now.replace(hour=9, minute=0, second=0, microsecond=0)
        
        # Find alerts that haven't been converted to cases yet
        alerts = await db.safeguarding_alerts.find({
            "status": "active",
            # Optionally filter by time, but for now get all active
        }, {"_id": 0}).sort("created_at", -1).to_list(50)
        
        # Categorize by priority
        high_priority = []
        standard = []
        
        for alert in alerts:
            risk = alert.get("risk_level", "AMBER")
            if risk in ["RED", "HIGH"]:
                high_priority.append(alert)
            else:
                standard.append(alert)
        
        return {
            "high_priority": high_priority,
            "standard": standard,
            "total_pending": len(alerts)
        }
    except Exception as e:
        logging.error(f"Error fetching morning queue: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch morning queue")


@case_router.get("/monitoring")
async def get_monitoring_cases(user: dict = Depends(get_user_with_role_check)):
    """Get cases in monitoring status (referred, waiting for external service)"""
    try:
        user_id = user.get("id") or user.get("user_id")
        
        if user["role"] == "admin":
            query = {"status": "monitoring"}
        else:
            query = {
                "status": "monitoring",
                "$or": [
                    {"assigned_to": user_id},
                    {"shared_with": user_id}
                ]
            }
        
        cases = await db.cases.find(query, {"_id": 0}).sort("next_check_in", 1).to_list(50)
        
        # Add check-in status
        now = datetime.now(timezone.utc)
        for case in cases:
            case.pop("ai_conversation", None)
            case.pop("timeline", None)
            
            if case.get("next_check_in"):
                next_check = case["next_check_in"]
                if isinstance(next_check, str):
                    next_check = datetime.fromisoformat(next_check.replace("Z", "+00:00"))
                case["check_in_overdue"] = next_check < now
        
        return cases
    except Exception as e:
        logging.error(f"Error fetching monitoring cases: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch monitoring cases")


# ============================================================================
# ENDPOINTS - CASE CRUD
# ============================================================================

@case_router.post("")
async def create_case(
    request: CreateCaseRequest,
    user: dict = Depends(get_user_with_role_check)
):
    """Create a new case from a safeguarding alert"""
    try:
        user_id = user.get("id") or user.get("user_id")
        user_name = user.get("name", "Unknown")
        
        # Get the safeguarding alert
        alert = await db.safeguarding_alerts.find_one(
            {"id": request.safeguarding_alert_id},
            {"_id": 0}
        )
        if not alert:
            raise HTTPException(status_code=404, detail="Safeguarding alert not found")
        
        # Check if case already exists for this alert
        existing = await db.cases.find_one({"safeguarding_alert_id": request.safeguarding_alert_id})
        if existing:
            raise HTTPException(status_code=400, detail="Case already exists for this alert")
        
        # Create case record
        # Map risk level from alert (uppercase) to case model (lowercase)
        alert_risk = alert.get("risk_level", "moderate").lower()
        if alert_risk not in ["low", "moderate", "high", "imminent"]:
            # Map RED to high, AMBER to moderate
            risk_map = {"red": "high", "amber": "moderate", "green": "low", "yellow": "moderate"}
            alert_risk = risk_map.get(alert_risk, "moderate")
        
        # Use provided user_name or default from alert/session
        case_user_name = request.user_name or alert.get("user_name") or f"Session {alert.get('session_id', 'unknown')[:8]}"
        
        case = CaseRecord(
            session_id=alert.get("session_id", "unknown"),
            user_name=case_user_name,
            safeguarding_alert_id=request.safeguarding_alert_id,
            assigned_to=user_id,
            assigned_to_name=user_name,
            current_risk=RiskLevel(alert_risk),
            ai_conversation=alert.get("conversation_history", [])
        )
        
        # Add initial risk to history
        case.risk_history.append({
            "timestamp": alert.get("created_at", datetime.now(timezone.utc)).isoformat(),
            "level": alert.get("risk_level", "AMBER"),
            "source": "ai_detection",
            "score": alert.get("risk_score", 0)
        })
        
        # Add timeline entries
        case.timeline.append(create_timeline_entry(
            entry_type="ai_alert",
            title="AI Safeguarding Alert",
            description=f"Risk level: {alert.get('risk_level', 'AMBER')} - Triggered by: {alert.get('triggering_message', 'Unknown')[:100]}",
            metadata={"alert_id": request.safeguarding_alert_id}
        ))
        
        case.timeline.append(create_timeline_entry(
            entry_type="case_created",
            title="Case Created",
            description=request.initial_notes,
            actor_id=user_id,
            actor_name=user_name
        ))
        
        # Save case
        case_dict = case.dict()
        await db.cases.insert_one(case_dict)
        
        # Update alert status
        await db.safeguarding_alerts.update_one(
            {"id": request.safeguarding_alert_id},
            {"$set": {"status": "case_created", "case_id": case.id}}
        )
        
        case_dict.pop("_id", None)
        return case_dict
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating case: {e}")
        raise HTTPException(status_code=500, detail="Failed to create case")


@case_router.post("/direct")
async def create_case_direct(
    request: CreateCaseDirectRequest,
    user: dict = Depends(get_user_with_role_check)
):
    """Create a new case directly without a safeguarding alert (for staff-initiated cases)"""
    try:
        user_id = user.get("id") or user.get("user_id")
        user_name = user.get("name", "Unknown")
        
        # Map risk level 
        risk_map = {"low": "low", "medium": "moderate", "moderate": "moderate", "high": "high", "critical": "imminent"}
        risk_level = risk_map.get(request.risk_level, "moderate")
        
        case = CaseRecord(
            session_id=f"manual_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            user_name=request.user_name,
            assigned_to=user_id,
            assigned_to_name=user_name,
            current_risk=RiskLevel(risk_level),
            ai_conversation=[]
        )
        
        # Set user_id if provided
        if request.user_id:
            case.user_id = request.user_id
        
        # Add initial risk to history
        case.risk_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": request.risk_level.upper() if request.risk_level else "MEDIUM",
            "source": "staff_created",
            "score": 0
        })
        
        # Add timeline entry
        case.timeline.append(create_timeline_entry(
            entry_type="case_created",
            title="Case Created Manually",
            description=request.initial_notes or "Case created by staff member",
            actor_id=user_id,
            actor_name=user_name
        ))
        
        # Add initial session if notes provided
        if request.initial_notes:
            case.sessions.append({
                "id": f"session_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                "session_number": 1,
                "date": datetime.now(timezone.utc).isoformat(),
                "presenting_issue": request.initial_notes,
                "risk_level": request.risk_level or "medium",
                "protective_factors": [],
                "warning_signs": [],
                "outcome": "continue_monitoring",
                "actions_taken": ["Case opened for monitoring"],
                "counsellor_id": user_id,
                "counsellor_name": user_name,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            case.session_count = 1
        
        # Save to database
        case_dict = case.dict()
        await db.cases.insert_one(case_dict)
        
        case_dict.pop("_id", None)
        return case_dict
        
    except Exception as e:
        logging.error(f"Error creating case directly: {e}")
        raise HTTPException(status_code=500, detail="Failed to create case")


@case_router.get("/{case_id}")
async def get_case(
    case_id: str,
    user: dict = Depends(get_user_with_role_check)
):
    """Get full case details"""
    return await check_case_access(case_id, user)


@case_router.patch("/{case_id}/status")
async def update_case_status(
    case_id: str,
    status: str,
    reason: Optional[str] = None,
    user: dict = Depends(get_user_with_role_check)
):
    """Update case status"""
    case = await check_case_access(case_id, user)
    user_id = user.get("id") or user.get("user_id")
    user_name = user.get("name", "Unknown")
    
    try:
        update_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if status == "closed":
            update_data["closed_at"] = datetime.now(timezone.utc)
            update_data["closed_reason"] = reason
        
        await db.cases.update_one(
            {"id": case_id},
            {
                "$set": update_data,
                "$push": {
                    "timeline": create_timeline_entry(
                        entry_type="status_change",
                        title=f"Status changed to {status}",
                        description=reason,
                        actor_id=user_id,
                        actor_name=user_name
                    ).dict()
                }
            }
        )
        
        return {"message": "Status updated", "status": status}
    except Exception as e:
        logging.error(f"Error updating case status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update status")


# ============================================================================
# ENDPOINTS - TRIAGE SESSIONS
# ============================================================================

@case_router.post("/{case_id}/sessions")
async def add_triage_session(
    case_id: str,
    request: AddSessionRequest,
    user: dict = Depends(get_user_with_role_check)
):
    """Add a triage session note to a case"""
    case = await check_case_access(case_id, user)
    user_id = user.get("id") or user.get("user_id")
    user_name = user.get("name", "Unknown")
    
    try:
        current_count = case.get("session_count", 0)
        
        # Check session cap (soft warning)
        if current_count >= 3 and not case.get("session_cap_override"):
            return {
                "warning": True,
                "message": "Session cap reached (3/3). Override required to add more sessions.",
                "action_required": "session_override"
            }
        
        # Create session note
        session = TriageSessionNote(
            session_number=current_count + 1,
            counsellor_id=user_id,
            counsellor_name=user_name,
            presenting_issue=request.presenting_issue,
            risk_level=RiskLevel(request.risk_level),
            protective_factors=request.protective_factors,
            warning_signs=request.warning_signs,
            outcome=SessionOutcome(request.outcome),
            actions_taken=request.actions_taken,
            verbatim_quotes=request.verbatim_quotes,
            next_steps=request.next_steps,
            duration_minutes=request.duration_minutes
        )
        
        if request.follow_up_date:
            session.follow_up_date = datetime.fromisoformat(request.follow_up_date.replace("Z", "+00:00"))
        
        # Update case
        update_data = {
            "session_count": current_count + 1,
            "current_risk": request.risk_level,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if request.follow_up_date:
            update_data["next_check_in"] = session.follow_up_date
        
        await db.cases.update_one(
            {"id": case_id},
            {
                "$set": update_data,
                "$push": {
                    "sessions": session.dict(),
                    "risk_history": {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "level": request.risk_level,
                        "source": "triage_session",
                        "session_number": current_count + 1
                    },
                    "timeline": create_timeline_entry(
                        entry_type="session",
                        title=f"Triage Session {current_count + 1}",
                        description=f"Risk: {request.risk_level} | Outcome: {request.outcome}",
                        actor_id=user_id,
                        actor_name=user_name,
                        metadata={"session_id": session.id}
                    ).dict()
                }
            }
        )
        
        return {"message": "Session added", "session_number": current_count + 1, "session": session.dict()}
    except Exception as e:
        logging.error(f"Error adding session: {e}")
        raise HTTPException(status_code=500, detail="Failed to add session")


@case_router.post("/{case_id}/session-override")
async def override_session_cap(
    case_id: str,
    request: SessionOverrideRequest,
    user: dict = Depends(get_user_with_role_check)
):
    """Override the 3-session cap with reason"""
    case = await check_case_access(case_id, user)
    user_id = user.get("id") or user.get("user_id")
    user_name = user.get("name", "Unknown")
    
    try:
        override_data = {
            "reason": request.reason,
            "approved_by": user_id,
            "approved_by_name": user_name,
            "date": datetime.now(timezone.utc).isoformat()
        }
        
        await db.cases.update_one(
            {"id": case_id},
            {
                "$set": {
                    "session_cap_override": override_data,
                    "updated_at": datetime.now(timezone.utc)
                },
                "$push": {
                    "timeline": create_timeline_entry(
                        entry_type="override",
                        title="Session Cap Override",
                        description=request.reason,
                        actor_id=user_id,
                        actor_name=user_name
                    ).dict()
                }
            }
        )
        
        return {"message": "Session cap override approved", "override": override_data}
    except Exception as e:
        logging.error(f"Error overriding session cap: {e}")
        raise HTTPException(status_code=500, detail="Failed to override session cap")


# ============================================================================
# ENDPOINTS - SAFETY PLAN
# ============================================================================

@case_router.put("/{case_id}/safety-plan")
async def update_safety_plan(
    case_id: str,
    request: UpdateSafetyPlanRequest,
    user: dict = Depends(get_user_with_role_check)
):
    """Create or update safety plan"""
    case = await check_case_access(case_id, user)
    user_id = user.get("id") or user.get("user_id")
    user_name = user.get("name", "Unknown")
    
    try:
        existing_plan = case.get("safety_plan")
        
        # Build safety plan kwargs - don't pass id if creating new (let default factory handle it)
        plan_kwargs = {
            "warning_signs": request.warning_signs,
            "internal_coping": request.internal_coping,
            "distractions": request.distractions,
            "support_people": request.support_people,
            "professionals": request.professionals,
            "environment_safety": request.environment_safety,
            "reasons_for_living": request.reasons_for_living,
            "created_by": existing_plan["created_by"] if existing_plan else user_id,
            "created_by_name": existing_plan["created_by_name"] if existing_plan else user_name,
        }
        
        if existing_plan:
            plan_kwargs["id"] = existing_plan["id"]
            plan_kwargs["created_at"] = existing_plan["created_at"]
        else:
            plan_kwargs["created_at"] = datetime.now(timezone.utc)
        
        safety_plan = SafetyPlan(**plan_kwargs)
        safety_plan.updated_at = datetime.now(timezone.utc)
        
        entry_type = "safety_plan_updated" if existing_plan else "safety_plan_created"
        entry_title = "Safety Plan Updated" if existing_plan else "Safety Plan Created"
        
        await db.cases.update_one(
            {"id": case_id},
            {
                "$set": {
                    "safety_plan": safety_plan.dict(),
                    "updated_at": datetime.now(timezone.utc)
                },
                "$push": {
                    "timeline": create_timeline_entry(
                        entry_type=entry_type,
                        title=entry_title,
                        actor_id=user_id,
                        actor_name=user_name
                    ).dict()
                }
            }
        )
        
        return {"message": entry_title, "safety_plan": safety_plan.dict()}
    except Exception as e:
        logging.error(f"Error updating safety plan: {e}")
        raise HTTPException(status_code=500, detail="Failed to update safety plan")


# ============================================================================
# ENDPOINTS - REFERRAL
# ============================================================================

@case_router.post("/{case_id}/referral")
async def create_referral(
    case_id: str,
    request: CreateReferralRequest,
    user: dict = Depends(get_user_with_role_check)
):
    """Create a referral to external service"""
    case = await check_case_access(case_id, user)
    user_id = user.get("id") or user.get("user_id")
    user_name = user.get("name", "Unknown")
    
    try:
        referral = Referral(
            service_name=request.service_name,
            service_type=request.service_type,
            urgency=request.urgency,
            notes=request.notes
        )
        
        # Update user info for referral (name collected at this stage)
        update_data = {
            "referral": referral.dict(),
            "status": "monitoring",
            "updated_at": datetime.now(timezone.utc)
        }
        
        if request.user_name:
            update_data["user_name"] = request.user_name
        if request.user_contact:
            update_data["user_contact"] = request.user_contact
        if request.service_info:
            update_data["service_info"] = request.service_info
        
        await db.cases.update_one(
            {"id": case_id},
            {
                "$set": update_data,
                "$push": {
                    "timeline": create_timeline_entry(
                        entry_type="referral",
                        title=f"Referral Created - {request.service_name}",
                        description=f"Urgency: {request.urgency}",
                        actor_id=user_id,
                        actor_name=user_name,
                        metadata={"referral_id": referral.id, "service": request.service_name}
                    ).dict()
                }
            }
        )
        
        return {"message": "Referral created", "referral": referral.dict()}
    except Exception as e:
        logging.error(f"Error creating referral: {e}")
        raise HTTPException(status_code=500, detail="Failed to create referral")


@case_router.patch("/{case_id}/referral/status")
async def update_referral_status(
    case_id: str,
    status: str,
    notes: Optional[str] = None,
    user: dict = Depends(get_user_with_role_check)
):
    """Update referral status"""
    case = await check_case_access(case_id, user)
    user_id = user.get("id") or user.get("user_id")
    user_name = user.get("name", "Unknown")
    
    try:
        if not case.get("referral"):
            raise HTTPException(status_code=400, detail="No referral exists for this case")
        
        timestamp_field = None
        if status == "submitted":
            timestamp_field = "referral.submitted_at"
        elif status == "acknowledged":
            timestamp_field = "referral.acknowledged_at"
        elif status == "engaged":
            timestamp_field = "referral.engaged_at"
        
        update_set = {
            "referral.status": status,
            "updated_at": datetime.now(timezone.utc)
        }
        if timestamp_field:
            update_set[timestamp_field] = datetime.now(timezone.utc)
        if notes:
            update_set["referral.notes"] = notes
        
        # If transferred, close the case
        if status == "transferred":
            update_set["status"] = "referred"
        
        await db.cases.update_one(
            {"id": case_id},
            {
                "$set": update_set,
                "$push": {
                    "timeline": create_timeline_entry(
                        entry_type="referral_update",
                        title=f"Referral Status: {status}",
                        description=notes,
                        actor_id=user_id,
                        actor_name=user_name
                    ).dict()
                }
            }
        )
        
        return {"message": "Referral status updated", "status": status}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating referral status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update referral status")


@case_router.get("/{case_id}/handoff-summary")
async def get_handoff_summary(
    case_id: str,
    user: dict = Depends(get_user_with_role_check)
):
    """Generate handoff summary for external service"""
    case_dict = await check_case_access(case_id, user)
    
    try:
        # Convert dict back to model for helper function
        case = CaseRecord(**case_dict)
        summary = generate_handoff_summary(case)
        
        return {
            "case_id": case_id,
            "case_number": case.case_number,
            "summary_text": summary,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logging.error(f"Error generating handoff summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate summary")


# ============================================================================
# ENDPOINTS - CHECK-INS
# ============================================================================

@case_router.post("/{case_id}/check-ins")
async def add_check_in(
    case_id: str,
    request: AddCheckInRequest,
    user: dict = Depends(get_user_with_role_check)
):
    """Log a check-in during waiting period"""
    case = await check_case_access(case_id, user)
    user_id = user.get("id") or user.get("user_id")
    user_name = user.get("name", "Unknown")
    
    try:
        check_in = CheckIn(
            method=CheckInMethod(request.method),
            counsellor_id=user_id,
            counsellor_name=user_name,
            contact_made=request.contact_made,
            risk_level=RiskLevel(request.risk_level) if request.risk_level else None,
            notes=request.notes,
            re_escalate=request.re_escalate
        )
        
        if request.next_check_in:
            check_in.next_check_in = datetime.fromisoformat(request.next_check_in.replace("Z", "+00:00"))
        
        update_data = {
            "updated_at": datetime.now(timezone.utc)
        }
        
        if request.next_check_in:
            update_data["next_check_in"] = check_in.next_check_in
        
        if request.risk_level:
            update_data["current_risk"] = request.risk_level
        
        # If re-escalating, change status back to active
        if request.re_escalate:
            update_data["status"] = "active"
        
        await db.cases.update_one(
            {"id": case_id},
            {
                "$set": update_data,
                "$push": {
                    "check_ins": check_in.dict(),
                    "timeline": create_timeline_entry(
                        entry_type="check_in",
                        title=f"Check-in ({request.method})",
                        description=f"Contact made: {'Yes' if request.contact_made else 'No'}" + (f" | Re-escalated" if request.re_escalate else ""),
                        actor_id=user_id,
                        actor_name=user_name,
                        metadata={"check_in_id": check_in.id}
                    ).dict()
                }
            }
        )
        
        if request.risk_level:
            await db.cases.update_one(
                {"id": case_id},
                {
                    "$push": {
                        "risk_history": {
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "level": request.risk_level,
                            "source": "check_in"
                        }
                    }
                }
            )
        
        return {"message": "Check-in logged", "check_in": check_in.dict()}
    except Exception as e:
        logging.error(f"Error adding check-in: {e}")
        raise HTTPException(status_code=500, detail="Failed to add check-in")


# ============================================================================
# ENDPOINTS - SHARING
# ============================================================================

@case_router.post("/{case_id}/share")
async def share_case(
    case_id: str,
    request: ShareCaseRequest,
    user: dict = Depends(get_user_with_role_check)
):
    """Share case with another counsellor"""
    case = await check_case_access(case_id, user)
    user_id = user.get("id") or user.get("user_id")
    user_name = user.get("name", "Unknown")
    
    try:
        # Verify target counsellor exists
        target = await db.users.find_one({"id": request.counsellor_id}, {"_id": 0})
        if not target:
            raise HTTPException(status_code=404, detail="Counsellor not found")
        if target.get("role") not in ["counsellor", "supervisor", "staff", "admin"]:
            raise HTTPException(status_code=400, detail="Can only share with counsellors or supervisors")
        
        await db.cases.update_one(
            {"id": case_id},
            {
                "$addToSet": {"shared_with": request.counsellor_id},
                "$set": {"updated_at": datetime.now(timezone.utc)},
                "$push": {
                    "timeline": create_timeline_entry(
                        entry_type="shared",
                        title=f"Case shared with {target.get('name', 'Unknown')}",
                        actor_id=user_id,
                        actor_name=user_name,
                        metadata={"shared_with": request.counsellor_id}
                    ).dict()
                }
            }
        )
        
        return {"message": f"Case shared with {target.get('name', 'Unknown')}"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sharing case: {e}")
        raise HTTPException(status_code=500, detail="Failed to share case")


# ============================================================================
# ENDPOINTS - CONSTANTS
# ============================================================================

@case_router.get("/options/protective-factors")
async def get_protective_factors():
    """Get list of protective factors"""
    return PROTECTIVE_FACTORS

@case_router.get("/options/warning-signs")
async def get_warning_signs():
    """Get list of warning signs"""
    return WARNING_SIGNS

@case_router.get("/options/session-actions")
async def get_session_actions():
    """Get list of session actions"""
    return SESSION_ACTIONS

@case_router.get("/options/referral-services")
async def get_referral_services():
    """Get list of referral services"""
    return REFERRAL_SERVICES
