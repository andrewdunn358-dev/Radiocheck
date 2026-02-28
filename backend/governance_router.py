"""
Governance API Router for Radio Check

Provides endpoints for:
- Hazard Log management
- Incident Management
- Safeguarding KPIs
- Peer Moderation
- CSO Approval workflows
- Audit Export
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging

from governance import (
    Hazard, HazardCreate, HazardStatus, HazardSeverity, HazardLikelihood,
    Incident, IncidentCreate, IncidentStatus, IncidentLevel,
    PeerReport, PeerReportCreate, ModerationStatus, UserModerationStatus,
    SafeguardingKPIs, GovernanceAuditEntry, GovernanceEventType,
    CSOApprovalRequest, DEFAULT_HAZARDS, KPI_TARGETS,
    log_governance_event
)

governance_router = APIRouter(prefix="/governance", tags=["governance"])

# Database reference - will be set from main server
db = None

def set_db(database):
    global db
    db = database

# ============================================================================
# HAZARD LOG ENDPOINTS
# ============================================================================

@governance_router.get("/hazards", response_model=List[dict])
async def get_hazards(
    status: Optional[HazardStatus] = None,
    include_closed: bool = False
):
    """Get all hazards from the hazard log"""
    try:
        query = {}
        if status:
            query["status"] = status.value
        elif not include_closed:
            query["status"] = {"$ne": HazardStatus.CLOSED.value}
        
        hazards = await db.hazards.find(query).sort("hazard_id", 1).to_list(100)
        
        # Remove MongoDB _id
        for h in hazards:
            h.pop("_id", None)
        
        return hazards
    except Exception as e:
        logging.error(f"Error fetching hazards: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch hazards")

@governance_router.post("/hazards", response_model=dict)
async def create_hazard(hazard: HazardCreate, actor_id: str = "system"):
    """Create a new hazard entry"""
    try:
        # Check for duplicate hazard_id
        existing = await db.hazards.find_one({"hazard_id": hazard.hazard_id})
        if existing:
            raise HTTPException(status_code=400, detail=f"Hazard {hazard.hazard_id} already exists")
        
        # Create hazard object
        hazard_obj = Hazard(**hazard.dict())
        hazard_obj.calculate_risk_rating()
        
        # Store in database
        hazard_dict = hazard_obj.dict()
        await db.hazards.insert_one(hazard_dict)
        
        # Log event
        audit_entry = log_governance_event(
            event_type=GovernanceEventType.HAZARD_CREATED,
            resource_type="hazard",
            resource_id=hazard.hazard_id,
            actor_id=actor_id,
            action="created",
            new_value=hazard_dict,
            explanation=f"New hazard '{hazard.title}' created with risk rating {hazard_obj.risk_rating}"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        hazard_dict.pop("_id", None)
        return hazard_dict
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating hazard: {e}")
        raise HTTPException(status_code=500, detail="Failed to create hazard")

@governance_router.put("/hazards/{hazard_id}", response_model=dict)
async def update_hazard(hazard_id: str, updates: dict, actor_id: str = "system"):
    """Update a hazard entry"""
    try:
        existing = await db.hazards.find_one({"hazard_id": hazard_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Hazard not found")
        
        old_value = {k: v for k, v in existing.items() if k != "_id"}
        
        # Apply updates
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Recalculate risk if severity or likelihood changed
        if "severity" in updates or "likelihood" in updates:
            severity = HazardSeverity(updates.get("severity", existing["severity"]))
            likelihood = HazardLikelihood(updates.get("likelihood", existing["likelihood"]))
            
            severity_values = {"negligible": 1, "minor": 2, "moderate": 3, "major": 4, "catastrophic": 5}
            likelihood_values = {"very_low": 1, "low": 2, "medium": 3, "high": 4, "very_high": 5}
            
            risk_rating = severity_values.get(severity.value, 3) * likelihood_values.get(likelihood.value, 3)
            updates["risk_rating"] = risk_rating
            
            if risk_rating <= 4:
                updates["residual_risk"] = "Low"
            elif risk_rating <= 9:
                updates["residual_risk"] = "Medium"
            elif risk_rating <= 16:
                updates["residual_risk"] = "High"
            else:
                updates["residual_risk"] = "Critical"
        
        await db.hazards.update_one({"hazard_id": hazard_id}, {"$set": updates})
        
        # Log event
        audit_entry = log_governance_event(
            event_type=GovernanceEventType.HAZARD_UPDATED,
            resource_type="hazard",
            resource_id=hazard_id,
            actor_id=actor_id,
            action="updated",
            old_value=old_value,
            new_value=updates,
            explanation=f"Hazard {hazard_id} updated"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        updated = await db.hazards.find_one({"hazard_id": hazard_id})
        updated.pop("_id", None)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating hazard: {e}")
        raise HTTPException(status_code=500, detail="Failed to update hazard")

@governance_router.post("/hazards/{hazard_id}/review", response_model=dict)
async def review_hazard(hazard_id: str, reviewer_id: str, notes: Optional[str] = None):
    """Mark a hazard as reviewed"""
    try:
        existing = await db.hazards.find_one({"hazard_id": hazard_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Hazard not found")
        
        updates = {
            "last_reviewed_by": reviewer_id,
            "last_reviewed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.hazards.update_one({"hazard_id": hazard_id}, {"$set": updates})
        
        # Log event
        audit_entry = log_governance_event(
            event_type=GovernanceEventType.HAZARD_REVIEWED,
            resource_type="hazard",
            resource_id=hazard_id,
            actor_id=reviewer_id,
            action="reviewed",
            explanation=f"Hazard {hazard_id} reviewed by {reviewer_id}. Notes: {notes or 'None'}"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        updated = await db.hazards.find_one({"hazard_id": hazard_id})
        updated.pop("_id", None)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error reviewing hazard: {e}")
        raise HTTPException(status_code=500, detail="Failed to review hazard")

@governance_router.post("/hazards/initialize")
async def initialize_default_hazards():
    """Initialize the hazard log with default hazards"""
    try:
        created = []
        for hazard_data in DEFAULT_HAZARDS:
            existing = await db.hazards.find_one({"hazard_id": hazard_data["hazard_id"]})
            if not existing:
                hazard = Hazard(**hazard_data)
                hazard.calculate_risk_rating()
                await db.hazards.insert_one(hazard.dict())
                created.append(hazard_data["hazard_id"])
        
        return {"message": f"Initialized {len(created)} hazards", "created": created}
    except Exception as e:
        logging.error(f"Error initializing hazards: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize hazards")

# ============================================================================
# INCIDENT MANAGEMENT ENDPOINTS
# ============================================================================

@governance_router.get("/incidents", response_model=List[dict])
async def get_incidents(
    status: Optional[IncidentStatus] = None,
    level: Optional[IncidentLevel] = None,
    limit: int = 50
):
    """Get incidents with optional filtering"""
    try:
        query = {}
        if status:
            query["status"] = status.value
        if level:
            query["level"] = level.value
        
        incidents = await db.incidents.find(query).sort("created_at", -1).to_list(limit)
        
        for inc in incidents:
            inc.pop("_id", None)
        
        return incidents
    except Exception as e:
        logging.error(f"Error fetching incidents: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch incidents")

@governance_router.post("/incidents", response_model=dict)
async def create_incident(incident: IncidentCreate, created_by: str = "system"):
    """Create a new incident"""
    try:
        # Generate incident number
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        count = await db.incidents.count_documents({"incident_number": {"$regex": f"^INC-{today}"}})
        incident_number = f"INC-{today}-{str(count + 1).zfill(3)}"
        
        incident_obj = Incident(**incident.dict())
        incident_obj.incident_number = incident_number
        incident_obj.created_by = created_by
        
        incident_dict = incident_obj.dict()
        await db.incidents.insert_one(incident_dict)
        
        # Log event
        audit_entry = log_governance_event(
            event_type=GovernanceEventType.INCIDENT_CREATED,
            resource_type="incident",
            resource_id=incident_number,
            actor_id=created_by,
            action="created",
            new_value={"level": incident.level.value, "title": incident.title},
            explanation=f"Incident {incident_number} created: {incident.title}"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        incident_dict.pop("_id", None)
        return incident_dict
    except Exception as e:
        logging.error(f"Error creating incident: {e}")
        raise HTTPException(status_code=500, detail="Failed to create incident")

@governance_router.put("/incidents/{incident_number}", response_model=dict)
async def update_incident(incident_number: str, updates: dict, actor_id: str = "system"):
    """Update an incident"""
    try:
        existing = await db.incidents.find_one({"incident_number": incident_number})
        if not existing:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Handle closure
        if updates.get("status") == IncidentStatus.CLOSED.value:
            updates["closed_at"] = datetime.now(timezone.utc).isoformat()
            updates["closed_by"] = actor_id
        
        await db.incidents.update_one({"incident_number": incident_number}, {"$set": updates})
        
        # Log event
        event_type = GovernanceEventType.INCIDENT_CLOSED if updates.get("status") == "closed" else GovernanceEventType.INCIDENT_UPDATED
        audit_entry = log_governance_event(
            event_type=event_type,
            resource_type="incident",
            resource_id=incident_number,
            actor_id=actor_id,
            action="updated" if event_type == GovernanceEventType.INCIDENT_UPDATED else "closed",
            new_value=updates,
            explanation=f"Incident {incident_number} updated"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        updated = await db.incidents.find_one({"incident_number": incident_number})
        updated.pop("_id", None)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating incident: {e}")
        raise HTTPException(status_code=500, detail="Failed to update incident")

# ============================================================================
# SAFEGUARDING KPIs ENDPOINTS
# ============================================================================

@governance_router.get("/kpis", response_model=dict)
async def get_safeguarding_kpis(
    days: int = Query(30, description="Number of days to calculate KPIs for")
):
    """Calculate and return safeguarding KPIs for the specified period"""
    try:
        period_end = datetime.now(timezone.utc)
        period_start = period_end - timedelta(days=days)
        
        # Get safeguarding alerts from the period
        alerts = await db.safeguarding_alerts.find({
            "created_at": {"$gte": period_start.isoformat(), "$lte": period_end.isoformat()}
        }).to_list(10000)
        
        # Get governance audit entries for risk assessments
        risk_assessments = await db.governance_audit.find({
            "event_type": "AUTOMATED_RISK_ASSESSMENT",
            "timestamp": {"$gte": period_start.isoformat()}
        }).to_list(10000)
        
        # Calculate metrics
        total_high_risk = len([a for a in alerts if a.get("risk_level") in ["HIGH", "AMBER", "RED"]])
        total_imminent = len([a for a in alerts if a.get("risk_level") == "RED" or a.get("requires_immediate_action")])
        total_medium = len([a for a in alerts if a.get("risk_level") in ["MEDIUM", "YELLOW"]])
        total_low = len([a for a in alerts if a.get("risk_level") in ["LOW", "GREEN"]])
        
        # Response times (for alerts that were acknowledged)
        acknowledged_alerts = [a for a in alerts if a.get("acknowledged_at") and a.get("created_at")]
        
        high_risk_response_times = []
        imminent_response_times = []
        
        for alert in acknowledged_alerts:
            try:
                created = datetime.fromisoformat(alert["created_at"].replace("Z", "+00:00"))
                acknowledged = datetime.fromisoformat(alert["acknowledged_at"].replace("Z", "+00:00"))
                response_mins = (acknowledged - created).total_seconds() / 60
                
                if alert.get("risk_level") in ["HIGH", "AMBER", "RED"]:
                    high_risk_response_times.append(response_mins)
                if alert.get("risk_level") == "RED" or alert.get("requires_immediate_action"):
                    imminent_response_times.append(response_mins)
            except:
                pass
        
        avg_high_risk_response = sum(high_risk_response_times) / len(high_risk_response_times) if high_risk_response_times else 0
        avg_imminent_response = sum(imminent_response_times) / len(imminent_response_times) if imminent_response_times else 0
        
        # SLA compliance
        within_sla = len([t for t in high_risk_response_times if t <= KPI_TARGETS["high_risk_review_time_mins"]])
        pct_within_sla = (within_sla / len(high_risk_response_times) * 100) if high_risk_response_times else 100
        
        # Risk distribution
        risk_distribution = {
            "imminent": total_imminent,
            "high": total_high_risk - total_imminent,
            "medium": total_medium,
            "low": total_low
        }
        
        kpis = SafeguardingKPIs(
            period_start=period_start,
            period_end=period_end,
            avg_high_risk_response_time=round(avg_high_risk_response, 2),
            avg_imminent_risk_response_time=round(avg_imminent_response, 2),
            pct_high_risk_reviewed_in_sla=round(pct_within_sla, 1),
            total_high_risk_alerts=total_high_risk,
            total_imminent_risk_alerts=total_imminent,
            total_medium_risk_alerts=total_medium,
            total_low_risk_alerts=total_low,
            risk_level_distribution=risk_distribution
        )
        
        # Log KPI generation
        audit_entry = log_governance_event(
            event_type=GovernanceEventType.KPI_REPORT_GENERATED,
            resource_type="kpi_report",
            action="generated",
            explanation=f"KPI report generated for {days} days period",
            metadata={"period_days": days}
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        return {
            "kpis": kpis.dict(),
            "targets": KPI_TARGETS,
            "period": {"start": period_start.isoformat(), "end": period_end.isoformat(), "days": days}
        }
    except Exception as e:
        logging.error(f"Error calculating KPIs: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate KPIs")

# ============================================================================
# PEER MODERATION ENDPOINTS
# ============================================================================

@governance_router.post("/peer-reports", response_model=dict)
async def submit_peer_report(report: PeerReportCreate):
    """Submit a peer message report"""
    try:
        report_obj = PeerReport(**report.dict())
        report_dict = report_obj.dict()
        
        await db.peer_reports.insert_one(report_dict)
        
        # Log event
        audit_entry = log_governance_event(
            event_type=GovernanceEventType.PEER_REPORT_SUBMITTED,
            resource_type="peer_report",
            resource_id=report_obj.id,
            action="submitted",
            explanation=f"Report submitted against user {report.reported_user_id} for: {report.reason}"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        report_dict.pop("_id", None)
        return report_dict
    except Exception as e:
        logging.error(f"Error submitting peer report: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit report")

@governance_router.get("/peer-reports", response_model=List[dict])
async def get_peer_reports(status: Optional[ModerationStatus] = None, limit: int = 50):
    """Get peer reports for moderation queue"""
    try:
        query = {}
        if status:
            query["status"] = status.value
        
        reports = await db.peer_reports.find(query).sort("created_at", -1).to_list(limit)
        
        for r in reports:
            r.pop("_id", None)
        
        return reports
    except Exception as e:
        logging.error(f"Error fetching peer reports: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch reports")

@governance_router.put("/peer-reports/{report_id}/action", response_model=dict)
async def take_moderation_action(
    report_id: str,
    action: ModerationStatus,
    moderator_id: str,
    notes: Optional[str] = None
):
    """Take moderation action on a peer report"""
    try:
        report = await db.peer_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        updates = {
            "status": action.value,
            "action_taken": action.value,
            "moderator_id": moderator_id,
            "moderator_notes": notes,
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.peer_reports.update_one({"id": report_id}, {"$set": updates})
        
        # Update user moderation status if needed
        if action in [ModerationStatus.WARNING_ISSUED, ModerationStatus.SUSPENDED, ModerationStatus.BANNED]:
            reported_user_id = report["reported_user_id"]
            user_status = await db.user_moderation.find_one({"user_id": reported_user_id})
            
            if not user_status:
                user_status = UserModerationStatus(user_id=reported_user_id).dict()
            
            if action == ModerationStatus.WARNING_ISSUED:
                user_status["warnings_count"] = user_status.get("warnings_count", 0) + 1
            elif action == ModerationStatus.SUSPENDED:
                user_status["suspensions_count"] = user_status.get("suspensions_count", 0) + 1
                user_status["status"] = "suspended"
            elif action == ModerationStatus.BANNED:
                user_status["is_banned"] = True
                user_status["banned_at"] = datetime.now(timezone.utc).isoformat()
                user_status["banned_by"] = moderator_id
                user_status["status"] = "banned"
            
            user_status["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            await db.user_moderation.update_one(
                {"user_id": reported_user_id},
                {"$set": user_status},
                upsert=True
            )
        
        # Log event
        audit_entry = log_governance_event(
            event_type=GovernanceEventType.PEER_ACTION_TAKEN,
            resource_type="peer_report",
            resource_id=report_id,
            actor_id=moderator_id,
            action=action.value,
            explanation=f"Moderation action {action.value} taken. Notes: {notes or 'None'}"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        updated = await db.peer_reports.find_one({"id": report_id})
        updated.pop("_id", None)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error taking moderation action: {e}")
        raise HTTPException(status_code=500, detail="Failed to take action")

@governance_router.post("/users/{user_id}/block", response_model=dict)
async def block_user(user_id: str, blocked_user_id: str):
    """Block a user"""
    try:
        await db.user_moderation.update_one(
            {"user_id": user_id},
            {"$addToSet": {"blocked_users": blocked_user_id}},
            upsert=True
        )
        
        audit_entry = log_governance_event(
            event_type=GovernanceEventType.USER_BLOCKED,
            resource_type="user",
            resource_id=user_id,
            action="blocked",
            explanation=f"User {user_id} blocked user {blocked_user_id}"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        return {"message": "User blocked", "blocked_user_id": blocked_user_id}
    except Exception as e:
        logging.error(f"Error blocking user: {e}")
        raise HTTPException(status_code=500, detail="Failed to block user")

# ============================================================================
# CSO APPROVAL ENDPOINTS
# ============================================================================

@governance_router.get("/cso/approvals", response_model=List[dict])
async def get_pending_approvals():
    """Get pending CSO approval requests"""
    try:
        approvals = await db.cso_approvals.find({"status": "pending"}).sort("requested_at", -1).to_list(50)
        for a in approvals:
            a.pop("_id", None)
        return approvals
    except Exception as e:
        logging.error(f"Error fetching approvals: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch approvals")

@governance_router.post("/cso/approvals", response_model=dict)
async def create_approval_request(
    request_type: str,
    description: str,
    current_value: dict,
    proposed_value: dict,
    requested_by: str
):
    """Create a new CSO approval request"""
    try:
        request = CSOApprovalRequest(
            request_type=request_type,
            description=description,
            requested_by=requested_by,
            current_value=current_value,
            proposed_value=proposed_value
        )
        
        await db.cso_approvals.insert_one(request.dict())
        
        audit_entry = log_governance_event(
            event_type=GovernanceEventType.CSO_APPROVAL_REQUIRED,
            resource_type="cso_approval",
            resource_id=request.id,
            actor_id=requested_by,
            action="requested",
            old_value=current_value,
            new_value=proposed_value,
            explanation=f"CSO approval requested for {request_type}: {description}"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        return request.dict()
    except Exception as e:
        logging.error(f"Error creating approval request: {e}")
        raise HTTPException(status_code=500, detail="Failed to create approval request")

@governance_router.put("/cso/approvals/{approval_id}", response_model=dict)
async def process_approval(
    approval_id: str,
    approved: bool,
    reviewer_id: str,
    notes: Optional[str] = None
):
    """Process a CSO approval request"""
    try:
        request = await db.cso_approvals.find_one({"id": approval_id})
        if not request:
            raise HTTPException(status_code=404, detail="Approval request not found")
        
        status = "approved" if approved else "denied"
        updates = {
            "status": status,
            "reviewed_by": reviewer_id,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_notes": notes
        }
        
        await db.cso_approvals.update_one({"id": approval_id}, {"$set": updates})
        
        event_type = GovernanceEventType.CSO_APPROVAL_GRANTED if approved else GovernanceEventType.CSO_APPROVAL_DENIED
        audit_entry = log_governance_event(
            event_type=event_type,
            resource_type="cso_approval",
            resource_id=approval_id,
            actor_id=reviewer_id,
            action=status,
            explanation=f"CSO {status} request {approval_id}. Notes: {notes or 'None'}"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        updated = await db.cso_approvals.find_one({"id": approval_id})
        updated.pop("_id", None)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing approval: {e}")
        raise HTTPException(status_code=500, detail="Failed to process approval")

# ============================================================================
# AUDIT EXPORT ENDPOINT
# ============================================================================

@governance_router.get("/export")
async def export_governance_data(
    include_hazards: bool = True,
    include_incidents: bool = True,
    include_kpis: bool = True,
    include_audit_log: bool = True,
    days: int = 30
):
    """Export governance data for audit purposes (no chat content)"""
    try:
        export_data = {
            "export_timestamp": datetime.now(timezone.utc).isoformat(),
            "period_days": days
        }
        
        if include_hazards:
            hazards = await db.hazards.find({}).to_list(100)
            for h in hazards:
                h.pop("_id", None)
            export_data["hazard_log"] = hazards
        
        if include_incidents:
            period_start = datetime.now(timezone.utc) - timedelta(days=days)
            incidents = await db.incidents.find({
                "created_at": {"$gte": period_start.isoformat()}
            }).to_list(500)
            for i in incidents:
                i.pop("_id", None)
            export_data["incidents"] = incidents
        
        if include_kpis:
            kpi_response = await get_safeguarding_kpis(days=days)
            export_data["kpis"] = kpi_response
        
        if include_audit_log:
            period_start = datetime.now(timezone.utc) - timedelta(days=days)
            audit_entries = await db.governance_audit.find({
                "timestamp": {"$gte": period_start.isoformat()}
            }).sort("timestamp", -1).to_list(1000)
            for a in audit_entries:
                a.pop("_id", None)
            export_data["audit_log"] = audit_entries
        
        # Log the export
        audit_entry = log_governance_event(
            event_type=GovernanceEventType.AUDIT_EXPORT_GENERATED,
            resource_type="export",
            action="generated",
            explanation=f"Governance data exported for {days} days period"
        )
        await db.governance_audit.insert_one(audit_entry.dict())
        
        return export_data
    except Exception as e:
        logging.error(f"Error exporting governance data: {e}")
        raise HTTPException(status_code=500, detail="Failed to export data")
