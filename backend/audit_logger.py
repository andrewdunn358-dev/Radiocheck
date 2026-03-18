"""
Audit Logging System
====================
Compliance-ready audit logging for safeguarding application.
Tracks sensitive operations for regulatory requirements.
"""

from datetime import datetime
from typing import Optional, Dict, Any
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class AuditEventType(str, Enum):
    # Authentication Events
    LOGIN_SUCCESS = "auth.login.success"
    LOGIN_FAILED = "auth.login.failed"
    LOGOUT = "auth.logout"
    PASSWORD_RESET = "auth.password_reset"
    
    # User Management
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    USER_ROLE_CHANGED = "user.role_changed"
    
    # Data Access
    DATA_VIEWED = "data.viewed"
    DATA_EXPORTED = "data.exported"
    REPORT_GENERATED = "data.report_generated"
    
    # Safeguarding Events
    SAFEGUARDING_ALERT = "safeguarding.alert"
    SAFEGUARDING_ESCALATION = "safeguarding.escalation"
    SAFEGUARDING_RESOLVED = "safeguarding.resolved"
    
    # AI/Chat Events
    AI_CHAT_SESSION = "ai.chat_session"
    AI_RESPONSE_FLAGGED = "ai.response_flagged"
    
    # Admin Actions
    KNOWLEDGE_BASE_MODIFIED = "admin.knowledge_base_modified"
    KNOWLEDGE_BASE_SEED = "admin.knowledge_base_seed"
    SETTINGS_CHANGED = "admin.settings_changed"
    
    # Live Support
    LIVE_CHAT_STARTED = "support.chat_started"
    LIVE_CHAT_ENDED = "support.chat_ended"
    LIVE_CALL_STARTED = "support.call_started"
    LIVE_CALL_ENDED = "support.call_ended"


async def log_audit_event(
    db,
    event_type: AuditEventType,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    user_role: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    action_details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    session_id: Optional[str] = None,
    outcome: str = "success",
    risk_level: Optional[str] = None
):
    """
    Log an audit event to the database.
    
    Args:
        db: Database connection
        event_type: Type of event from AuditEventType enum
        user_id: ID of the user performing the action
        user_email: Email of the user (for easier searching)
        user_role: Role of the user at time of action
        resource_type: Type of resource being accessed/modified
        resource_id: ID of the specific resource
        action_details: Additional context about the action
        ip_address: Client IP address
        user_agent: Client user agent string
        session_id: Session identifier
        outcome: "success", "failed", "partial"
        risk_level: For safeguarding events - "low", "medium", "high", "critical"
    """
    
    audit_record = {
        "timestamp": datetime.utcnow(),
        "event_type": event_type.value if isinstance(event_type, AuditEventType) else event_type,
        "user": {
            "id": user_id,
            "email": user_email,
            "role": user_role
        },
        "resource": {
            "type": resource_type,
            "id": resource_id
        },
        "action_details": action_details or {},
        "context": {
            "ip_address": ip_address,
            "user_agent": user_agent,
            "session_id": session_id
        },
        "outcome": outcome,
        "risk_level": risk_level
    }
    
    # Remove None values for cleaner storage
    audit_record = {k: v for k, v in audit_record.items() if v is not None}
    
    try:
        await db.audit_logs.insert_one(audit_record)
        
        # Also log to application logs for immediate visibility
        log_msg = f"AUDIT: {event_type} | User: {user_email or user_id or 'anonymous'} | Outcome: {outcome}"
        if risk_level:
            log_msg += f" | Risk: {risk_level}"
        
        if risk_level in ["high", "critical"]:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)
            
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")
        # Don't raise - audit logging should not break main functionality


async def get_audit_logs(
    db,
    event_type: Optional[str] = None,
    user_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    risk_level: Optional[str] = None,
    limit: int = 100
) -> list:
    """
    Retrieve audit logs with optional filtering.
    """
    query = {}
    
    if event_type:
        query["event_type"] = event_type
    if user_id:
        query["user.id"] = user_id
    if risk_level:
        query["risk_level"] = risk_level
    if start_date or end_date:
        query["timestamp"] = {}
        if start_date:
            query["timestamp"]["$gte"] = start_date
        if end_date:
            query["timestamp"]["$lte"] = end_date
    
    cursor = db.audit_logs.find(query).sort("timestamp", -1).limit(limit)
    logs = await cursor.to_list(length=limit)
    
    # Convert ObjectId to string for JSON serialization
    for log in logs:
        log["_id"] = str(log["_id"])
    
    return logs


async def get_audit_summary(db, days: int = 30) -> Dict[str, Any]:
    """
    Get summary statistics for audit logs.
    """
    from datetime import timedelta
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": "$event_type",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = await db.audit_logs.aggregate(pipeline).to_list(length=100)
    
    # Count by risk level for safeguarding events
    risk_pipeline = [
        {"$match": {
            "timestamp": {"$gte": start_date},
            "risk_level": {"$exists": True}
        }},
        {"$group": {
            "_id": "$risk_level",
            "count": {"$sum": 1}
        }}
    ]
    
    risk_results = await db.audit_logs.aggregate(risk_pipeline).to_list(length=10)
    
    return {
        "period_days": days,
        "events_by_type": {r["_id"]: r["count"] for r in results},
        "safeguarding_by_risk": {r["_id"]: r["count"] for r in risk_results},
        "total_events": sum(r["count"] for r in results)
    }


# Convenience functions for common audit events

async def audit_login(db, user_id: str, email: str, success: bool, ip: str = None):
    """Log a login attempt"""
    await log_audit_event(
        db,
        AuditEventType.LOGIN_SUCCESS if success else AuditEventType.LOGIN_FAILED,
        user_id=user_id if success else None,
        user_email=email,
        ip_address=ip,
        outcome="success" if success else "failed"
    )


async def audit_safeguarding_alert(
    db, 
    session_id: str, 
    risk_level: str, 
    score: int, 
    triggered_indicators: list
):
    """Log a safeguarding alert"""
    await log_audit_event(
        db,
        AuditEventType.SAFEGUARDING_ALERT,
        session_id=session_id,
        risk_level=risk_level,
        action_details={
            "score": score,
            "indicators": triggered_indicators[:10]  # Limit for storage
        }
    )


async def audit_data_export(db, user_id: str, email: str, export_type: str, record_count: int):
    """Log a data export"""
    await log_audit_event(
        db,
        AuditEventType.DATA_EXPORTED,
        user_id=user_id,
        user_email=email,
        resource_type=export_type,
        action_details={"record_count": record_count}
    )


async def audit_admin_action(db, user_id: str, email: str, action: str, details: dict = None):
    """Log an admin action"""
    await log_audit_event(
        db,
        AuditEventType.SETTINGS_CHANGED,
        user_id=user_id,
        user_email=email,
        action_details={"action": action, **(details or {})}
    )
