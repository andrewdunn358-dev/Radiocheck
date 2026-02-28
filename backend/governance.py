"""
Clinical Safety Governance Module for Radio Check

Implements NHS Digital DCB0129-aligned governance structures:
- Clinical Safety Officer (CSO) role and approval workflows
- Hazard Log management
- Safeguarding KPI tracking
- Incident Management
- Peer Moderation System
- Audit logging with structured events
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import logging

# ============================================================================
# ENUMS
# ============================================================================

class HazardSeverity(str, Enum):
    NEGLIGIBLE = "negligible"      # 1
    MINOR = "minor"                # 2
    MODERATE = "moderate"          # 3
    MAJOR = "major"                # 4
    CATASTROPHIC = "catastrophic"  # 5

class HazardLikelihood(str, Enum):
    VERY_LOW = "very_low"      # 1
    LOW = "low"                # 2
    MEDIUM = "medium"          # 3
    HIGH = "high"              # 4
    VERY_HIGH = "very_high"    # 5

class HazardStatus(str, Enum):
    ACTIVE = "active"
    MITIGATED = "mitigated"
    CLOSED = "closed"
    UNDER_REVIEW = "under_review"

class IncidentLevel(str, Enum):
    LEVEL_1_MODERATE = "level_1_moderate"
    LEVEL_2_HIGH = "level_2_high"
    LEVEL_3_CRITICAL = "level_3_critical"

class IncidentStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    CLOSED = "closed"

class ModerationStatus(str, Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    WARNING_ISSUED = "warning_issued"
    SUSPENDED = "suspended"
    BANNED = "banned"

class GovernanceEventType(str, Enum):
    # Clinical Sign-offs
    CLINICAL_SIGN_OFF = "CLINICAL_SIGN_OFF"
    CSO_APPROVAL_REQUIRED = "CSO_APPROVAL_REQUIRED"
    CSO_APPROVAL_GRANTED = "CSO_APPROVAL_GRANTED"
    CSO_APPROVAL_DENIED = "CSO_APPROVAL_DENIED"
    
    # Hazard Log
    HAZARD_CREATED = "HAZARD_CREATED"
    HAZARD_UPDATED = "HAZARD_UPDATED"
    HAZARD_REVIEWED = "HAZARD_REVIEWED"
    HAZARD_CLOSED = "HAZARD_CLOSED"
    
    # KPIs
    KPI_REPORT_GENERATED = "KPI_REPORT_GENERATED"
    KPI_THRESHOLD_BREACHED = "KPI_THRESHOLD_BREACHED"
    
    # Risk Assessment
    AUTOMATED_RISK_ASSESSMENT = "AUTOMATED_RISK_ASSESSMENT"
    HUMAN_REVIEW_COMPLETED = "HUMAN_REVIEW_COMPLETED"
    
    # Peer Moderation
    PEER_REPORT_SUBMITTED = "PEER_REPORT_SUBMITTED"
    PEER_ACTION_TAKEN = "PEER_ACTION_TAKEN"
    USER_BLOCKED = "USER_BLOCKED"
    USER_SUSPENDED = "USER_SUSPENDED"
    USER_BANNED = "USER_BANNED"
    
    # Incidents
    INCIDENT_CREATED = "INCIDENT_CREATED"
    INCIDENT_UPDATED = "INCIDENT_UPDATED"
    INCIDENT_ESCALATED = "INCIDENT_ESCALATED"
    INCIDENT_CLOSED = "INCIDENT_CLOSED"
    
    # Audit
    AUDIT_EXPORT_GENERATED = "AUDIT_EXPORT_GENERATED"

# ============================================================================
# MODELS - Hazard Log
# ============================================================================

class HazardCreate(BaseModel):
    hazard_id: str = Field(..., description="Unique hazard ID (e.g., H1, H2)")
    title: str
    description: str
    cause: str
    potential_harm: str
    severity: HazardSeverity
    likelihood: HazardLikelihood
    mitigation: str
    owner: str
    review_date: Optional[datetime] = None

class Hazard(BaseModel):
    id: str = Field(default_factory=lambda: f"hazard_{datetime.now(timezone.utc).timestamp()}")
    hazard_id: str  # Human-readable ID like H1, H2
    title: str
    description: str
    cause: str
    potential_harm: str
    severity: HazardSeverity
    likelihood: HazardLikelihood
    risk_rating: int = 0  # Calculated: severity_value * likelihood_value
    mitigation: str
    residual_risk: str = "Medium"
    status: HazardStatus = HazardStatus.ACTIVE
    owner: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    review_date: Optional[datetime] = None
    last_reviewed_by: Optional[str] = None
    last_reviewed_at: Optional[datetime] = None
    cso_approved: bool = False
    cso_approved_by: Optional[str] = None
    cso_approved_at: Optional[datetime] = None

    def calculate_risk_rating(self):
        severity_values = {
            HazardSeverity.NEGLIGIBLE: 1,
            HazardSeverity.MINOR: 2,
            HazardSeverity.MODERATE: 3,
            HazardSeverity.MAJOR: 4,
            HazardSeverity.CATASTROPHIC: 5
        }
        likelihood_values = {
            HazardLikelihood.VERY_LOW: 1,
            HazardLikelihood.LOW: 2,
            HazardLikelihood.MEDIUM: 3,
            HazardLikelihood.HIGH: 4,
            HazardLikelihood.VERY_HIGH: 5
        }
        self.risk_rating = severity_values.get(self.severity, 3) * likelihood_values.get(self.likelihood, 3)
        
        # Calculate residual risk based on rating
        if self.risk_rating <= 4:
            self.residual_risk = "Low"
        elif self.risk_rating <= 9:
            self.residual_risk = "Medium"
        elif self.risk_rating <= 16:
            self.residual_risk = "High"
        else:
            self.residual_risk = "Critical"
        
        return self.risk_rating

# ============================================================================
# MODELS - Incidents
# ============================================================================

class IncidentCreate(BaseModel):
    title: str
    description: str
    level: IncidentLevel
    related_user_id: Optional[str] = None
    related_session_id: Optional[str] = None
    related_hazard_id: Optional[str] = None

class Incident(BaseModel):
    id: str = Field(default_factory=lambda: f"incident_{datetime.now(timezone.utc).timestamp()}")
    incident_number: str = ""  # Auto-generated: INC-YYYYMMDD-XXX
    title: str
    description: str
    level: IncidentLevel
    status: IncidentStatus = IncidentStatus.OPEN
    related_user_id: Optional[str] = None
    related_session_id: Optional[str] = None
    related_hazard_id: Optional[str] = None
    staff_response: Optional[str] = None
    resolution_summary: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = ""
    assigned_to: Optional[str] = None
    closed_at: Optional[datetime] = None
    closed_by: Optional[str] = None

# ============================================================================
# MODELS - Peer Moderation
# ============================================================================

class PeerReportCreate(BaseModel):
    reported_user_id: str
    reporter_user_id: str
    message_id: Optional[str] = None
    reason: str
    details: Optional[str] = None

class PeerReport(BaseModel):
    id: str = Field(default_factory=lambda: f"report_{datetime.now(timezone.utc).timestamp()}")
    reported_user_id: str
    reporter_user_id: str
    message_id: Optional[str] = None
    reason: str
    details: Optional[str] = None
    risk_score: Optional[int] = None
    status: ModerationStatus = ModerationStatus.PENDING
    action_taken: Optional[str] = None
    moderator_id: Optional[str] = None
    moderator_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None

class UserModerationStatus(BaseModel):
    user_id: str
    status: ModerationStatus = ModerationStatus.PENDING
    warnings_count: int = 0
    suspensions_count: int = 0
    is_banned: bool = False
    banned_at: Optional[datetime] = None
    banned_by: Optional[str] = None
    ban_reason: Optional[str] = None
    blocked_users: List[str] = []
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============================================================================
# MODELS - KPIs
# ============================================================================

class SafeguardingKPIs(BaseModel):
    period_start: datetime
    period_end: datetime
    
    # Response Times (in minutes)
    avg_high_risk_response_time: float = 0.0
    avg_imminent_risk_response_time: float = 0.0
    avg_staff_acknowledgement_time: float = 0.0
    
    # Percentages
    pct_high_risk_reviewed_in_sla: float = 0.0  # Target: > 90%
    escalation_accuracy_rate: float = 0.0       # Target: > 85%
    false_positive_rate: float = 0.0            # Target: < 15%
    
    # Counts
    total_high_risk_alerts: int = 0
    total_imminent_risk_alerts: int = 0
    total_medium_risk_alerts: int = 0
    total_low_risk_alerts: int = 0
    dependency_interventions: int = 0
    repeated_medium_risk_users_reviewed: int = 0
    
    # Distributions
    risk_level_distribution: Dict[str, int] = {}
    
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    generated_by: Optional[str] = None

# ============================================================================
# MODELS - Governance Audit Log
# ============================================================================

class GovernanceAuditEntry(BaseModel):
    id: str = Field(default_factory=lambda: f"audit_{datetime.now(timezone.utc).timestamp()}")
    event_type: GovernanceEventType
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Actor
    actor_id: Optional[str] = None
    actor_role: Optional[str] = None
    
    # Change details
    resource_type: str = ""  # hazard, incident, user, etc.
    resource_id: Optional[str] = None
    action: str = ""
    
    # For changes
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    
    # Explanation (human-readable)
    explanation: str = ""
    
    # Risk assessment specific
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    automated_decision_applied: bool = False
    human_review_required: bool = False
    human_review_completed: bool = False
    human_reviewer_id: Optional[str] = None
    
    # Additional metadata
    metadata: Dict[str, Any] = {}

# ============================================================================
# MODELS - CSO Approval
# ============================================================================

class CSOApprovalRequest(BaseModel):
    id: str = Field(default_factory=lambda: f"approval_{datetime.now(timezone.utc).timestamp()}")
    request_type: str  # risk_threshold_change, trigger_update, escalation_rule_change
    description: str
    requested_by: str
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Change details
    current_value: Dict[str, Any] = {}
    proposed_value: Dict[str, Any] = {}
    
    # Approval status
    status: str = "pending"  # pending, approved, denied
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

def log_governance_event(
    event_type: GovernanceEventType,
    resource_type: str,
    resource_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    actor_role: Optional[str] = None,
    action: str = "",
    old_value: Optional[Dict] = None,
    new_value: Optional[Dict] = None,
    explanation: str = "",
    risk_score: Optional[int] = None,
    risk_level: Optional[str] = None,
    automated_decision: bool = False,
    human_review_required: bool = False,
    metadata: Optional[Dict] = None
) -> GovernanceAuditEntry:
    """Create a structured governance audit log entry"""
    
    entry = GovernanceAuditEntry(
        event_type=event_type,
        resource_type=resource_type,
        resource_id=resource_id,
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        old_value=old_value,
        new_value=new_value,
        explanation=explanation,
        risk_score=risk_score,
        risk_level=risk_level,
        automated_decision_applied=automated_decision,
        human_review_required=human_review_required,
        metadata=metadata or {}
    )
    
    # Log to standard logging as well
    logging.info(f"GOVERNANCE_LOG: {event_type.value} - {resource_type}/{resource_id} - {action}")
    
    return entry

# ============================================================================
# PRE-POPULATED HAZARDS
# ============================================================================

DEFAULT_HAZARDS = [
    {
        "hazard_id": "H1",
        "title": "AI fails to detect suicidal ideation",
        "description": "The AI system fails to identify messages containing suicidal thoughts or intent",
        "cause": "Language ambiguity, indirect expressions, coded language",
        "potential_harm": "User in crisis does not receive appropriate intervention",
        "severity": HazardSeverity.CATASTROPHIC,
        "likelihood": HazardLikelihood.LOW,
        "mitigation": "Multi-layer detection, contextual scoring, session trend analysis, escalation review",
        "residual_risk": "Medium",
        "owner": "Clinical Safety Officer"
    },
    {
        "hazard_id": "H2",
        "title": "AI over-escalates benign content",
        "description": "AI triggers false positive alerts for non-crisis content",
        "cause": "Keyword sensitivity, lack of context understanding",
        "potential_harm": "Unnecessary distress to user, staff resource waste",
        "severity": HazardSeverity.MINOR,
        "likelihood": HazardLikelihood.MEDIUM,
        "mitigation": "Staff review required before intervention, contextual analysis",
        "residual_risk": "Low",
        "owner": "Clinical Safety Officer"
    },
    {
        "hazard_id": "H3",
        "title": "Staff miss urgent alert",
        "description": "Staff fail to respond to high/imminent risk alerts in time",
        "cause": "Human error, system not checked, alert fatigue",
        "potential_harm": "Delayed intervention for user in crisis",
        "severity": HazardSeverity.MAJOR,
        "likelihood": HazardLikelihood.LOW,
        "mitigation": "Email + dashboard alert + escalation timer + multiple staff notification",
        "residual_risk": "Medium",
        "owner": "Operations Manager"
    },
    {
        "hazard_id": "H4",
        "title": "Under-18 falsely declares 18+",
        "description": "Minor bypasses age gate by declaring incorrect age",
        "cause": "Self-declared age system, user deception",
        "potential_harm": "Minor accesses peer features without enhanced safeguards",
        "severity": HazardSeverity.MODERATE,
        "likelihood": HazardLikelihood.MEDIUM,
        "mitigation": "Clear declaration statement, universal safeguards still apply, peer features require additional verification",
        "residual_risk": "Medium",
        "owner": "Clinical Safety Officer"
    },
    {
        "hazard_id": "H5",
        "title": "Peer messaging abuse",
        "description": "Users send harmful content through peer messaging system",
        "cause": "User misconduct, malicious intent",
        "potential_harm": "Harassment, triggering content, exploitation",
        "severity": HazardSeverity.MODERATE,
        "likelihood": HazardLikelihood.LOW,
        "mitigation": "Message scanning, reporting system, block feature, moderation queue, suspension process",
        "residual_risk": "Low",
        "owner": "Moderation Team"
    },
    {
        "hazard_id": "H6",
        "title": "System outage during crisis",
        "description": "Platform becomes unavailable when user needs support",
        "cause": "Hosting failure, technical issues, DDoS",
        "potential_harm": "User unable to access support during crisis",
        "severity": HazardSeverity.MAJOR,
        "likelihood": HazardLikelihood.VERY_LOW,
        "mitigation": "Crisis numbers always visible on static page, redundancy hosting, uptime monitoring",
        "residual_risk": "Medium",
        "owner": "Technical Lead"
    },
    {
        "hazard_id": "H7",
        "title": "AI safety drift after update",
        "description": "Model updates cause degradation in safety detection",
        "cause": "Unintended model behaviour changes, insufficient testing",
        "potential_harm": "Reduced crisis detection accuracy",
        "severity": HazardSeverity.MAJOR,
        "likelihood": HazardLikelihood.LOW,
        "mitigation": "CSO approval required before release, regression testing, staged rollout",
        "residual_risk": "Low",
        "owner": "Clinical Safety Officer"
    }
]

# ============================================================================
# KPI TARGETS
# ============================================================================

KPI_TARGETS = {
    "high_risk_review_time_mins": 15,        # < 15 minutes
    "imminent_risk_contact_time_mins": 5,    # < 5 minutes
    "pct_high_risk_contacted": 90,           # > 90%
    "escalation_accuracy_rate": 85,          # > 85%
    "false_positive_rate": 15,               # < 15%
    "repeated_medium_risk_reviewed": 100,    # 100%
    "staff_acknowledgement_time_mins": 10    # < 10 minutes
}
