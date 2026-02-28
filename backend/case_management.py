"""
Case Management Module for Radio Check

Provides structured case records for triage counsellors to:
- Track user journeys from AI alert to external referral
- Document triage sessions (max 3)
- Create and manage safety plans
- Generate handoff summaries for Op COURAGE/NHS
- Monitor users during waiting periods

Privacy: Cases are visible only to assigned counsellor + admin
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
import uuid
import logging


# ============================================================================
# ENUMS
# ============================================================================

class CaseStatus(str, Enum):
    ACTIVE = "active"              # Active triage in progress
    MONITORING = "monitoring"      # Referred, monitoring during wait
    REFERRED = "referred"          # Fully transferred to external service
    CLOSED = "closed"              # Case closed

class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    IMMINENT = "imminent"

class ReferralStatus(str, Enum):
    DRAFT = "draft"                # Preparing handoff
    READY = "ready"                # Ready to send
    SUBMITTED = "submitted"        # Sent to external service
    ACKNOWLEDGED = "acknowledged"  # External service confirmed receipt
    WAITING = "waiting"            # User in queue
    ENGAGED = "engaged"            # User attending external service
    TRANSFERRED = "transferred"    # Case responsibility handed over

class CheckInMethod(str, Enum):
    PHONE = "phone"
    IN_APP = "in_app"
    SMS = "sms"
    EMAIL = "email"

class SessionOutcome(str, Enum):
    CONTINUE_MONITORING = "continue_monitoring"
    SCHEDULE_FOLLOWUP = "schedule_followup"
    INITIATE_REFERRAL = "initiate_referral"
    EMERGENCY_ESCALATION = "emergency_escalation"


# ============================================================================
# MODELS
# ============================================================================

class TriageSessionNote(BaseModel):
    """Individual triage session documentation"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_number: int  # 1, 2, or 3
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    duration_minutes: Optional[int] = None
    counsellor_id: str
    counsellor_name: str
    
    # Assessment
    presenting_issue: str
    risk_level: RiskLevel = RiskLevel.MODERATE
    
    # Factors (stored as lists of selected items)
    protective_factors: List[str] = []  # e.g., ["family", "employment", "hope"]
    warning_signs: List[str] = []       # e.g., ["isolation", "substance_use"]
    
    # Outcome
    outcome: SessionOutcome = SessionOutcome.CONTINUE_MONITORING
    actions_taken: List[str] = []       # e.g., ["safety_plan_created", "crisis_resources_provided"]
    verbatim_quotes: Optional[str] = None  # Key statements for handoff
    next_steps: Optional[str] = None
    follow_up_date: Optional[datetime] = None


class SafetyPlan(BaseModel):
    """Stanley-Brown style safety plan"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str  # counsellor_id
    created_by_name: str
    
    # Safety plan sections
    warning_signs: List[str] = []
    internal_coping: List[str] = []
    distractions: List[str] = []  # People/places that distract
    support_people: List[Dict[str, str]] = []  # [{name, phone}]
    professionals: List[Dict[str, str]] = []   # [{name, phone, role}]
    environment_safety: List[str] = []
    reasons_for_living: List[str] = []
    
    # Standard crisis contacts (always included)
    crisis_contacts: List[Dict[str, str]] = [
        {"name": "Samaritans", "phone": "116 123", "available": "24/7"},
        {"name": "Emergency Services", "phone": "999", "available": "24/7"},
        {"name": "Veterans Gateway", "phone": "0808 802 1212", "available": "24/7"},
    ]


class Referral(BaseModel):
    """Referral tracking to external service"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: ReferralStatus = ReferralStatus.DRAFT
    
    # Target service
    service_name: str  # e.g., "Op COURAGE North East"
    service_type: str  # e.g., "NHS", "Charity", "Op COURAGE"
    service_contact: Optional[str] = None
    
    # Urgency
    urgency: str = "routine"  # routine, urgent, emergency
    
    # Tracking
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    submitted_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    engaged_at: Optional[datetime] = None
    
    # Handoff
    handoff_summary: Optional[str] = None
    handoff_pdf_url: Optional[str] = None
    
    # Notes
    notes: Optional[str] = None


class CheckIn(BaseModel):
    """Follow-up check-in during waiting period"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    method: CheckInMethod
    counsellor_id: str
    counsellor_name: str
    
    # Outcome
    contact_made: bool = False
    risk_level: Optional[RiskLevel] = None
    notes: str = ""
    next_check_in: Optional[datetime] = None
    re_escalate: bool = False  # If risk increased


class CaseTimelineEntry(BaseModel):
    """Entry in case timeline"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    entry_type: str  # "ai_alert", "case_created", "session", "safety_plan", "referral", "check_in", "note"
    title: str
    description: Optional[str] = None
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    metadata: Dict[str, Any] = {}


class CaseRecord(BaseModel):
    """Main case record for triage"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_number: str = Field(default_factory=lambda: f"RC-{datetime.now().strftime('%Y')}-{str(uuid.uuid4())[:6].upper()}")
    
    # Status
    status: CaseStatus = CaseStatus.ACTIVE
    
    # User identification (anonymous until referral)
    session_id: str  # Links to AI conversation
    user_identifier: Optional[str] = None  # Anonymous ID or nickname
    user_name: Optional[str] = None  # Only collected at referral stage
    user_contact: Optional[str] = None  # Phone/email for referral
    service_info: Optional[Dict[str, str]] = None  # Branch, service dates etc.
    
    # Assignment (privacy - only assigned counsellor can see)
    assigned_to: str  # counsellor user_id
    assigned_to_name: str
    shared_with: List[str] = []  # Additional counsellor IDs if shared
    
    # Risk tracking
    current_risk: RiskLevel = RiskLevel.MODERATE
    risk_history: List[Dict[str, Any]] = []  # [{timestamp, level, source}]
    
    # Session tracking (max 3)
    session_count: int = 0
    sessions: List[TriageSessionNote] = []
    session_cap_override: Optional[Dict[str, Any]] = None  # {reason, approved_by, date}
    
    # Safety plan
    safety_plan: Optional[SafetyPlan] = None
    
    # Referral
    referral: Optional[Referral] = None
    
    # Check-ins (during waiting period)
    check_ins: List[CheckIn] = []
    next_check_in: Optional[datetime] = None
    
    # Timeline
    timeline: List[CaseTimelineEntry] = []
    
    # AI conversation (full transcript from safeguarding alert)
    ai_conversation: List[Dict[str, str]] = []
    safeguarding_alert_id: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    closed_at: Optional[datetime] = None
    closed_reason: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def create_timeline_entry(
    entry_type: str,
    title: str,
    description: str = None,
    actor_id: str = None,
    actor_name: str = None,
    metadata: Dict = None
) -> CaseTimelineEntry:
    """Create a timeline entry"""
    return CaseTimelineEntry(
        entry_type=entry_type,
        title=title,
        description=description,
        actor_id=actor_id,
        actor_name=actor_name,
        metadata=metadata or {}
    )


def generate_handoff_summary(case: CaseRecord) -> str:
    """Generate text summary for handoff to external service"""
    
    lines = []
    lines.append("RADIO CHECK - REFERRAL HANDOFF SUMMARY")
    lines.append("=" * 50)
    lines.append(f"Case ID: {case.case_number}")
    lines.append(f"Date: {datetime.now().strftime('%d %B %Y')}")
    lines.append("")
    
    # User info
    lines.append("USER INFORMATION")
    lines.append("-" * 30)
    if case.user_name:
        lines.append(f"Name: {case.user_name}")
    if case.user_contact:
        lines.append(f"Contact: {case.user_contact}")
    if case.service_info:
        for key, value in case.service_info.items():
            lines.append(f"{key}: {value}")
    lines.append("")
    
    # Risk summary
    lines.append("RISK SUMMARY")
    lines.append("-" * 30)
    lines.append(f"Current Risk Level: {case.current_risk.value.upper()}")
    if case.risk_history:
        lines.append("Risk History:")
        for entry in case.risk_history[-5:]:  # Last 5 entries
            lines.append(f"  - {entry.get('timestamp', 'Unknown')}: {entry.get('level', 'Unknown')}")
    lines.append("")
    
    # Sessions summary
    lines.append("TRIAGE SESSIONS")
    lines.append("-" * 30)
    lines.append(f"Sessions Completed: {case.session_count}/3")
    for session in case.sessions:
        lines.append(f"\nSession {session.session_number} ({session.date.strftime('%d %b %Y')})")
        lines.append(f"  Presenting Issue: {session.presenting_issue}")
        lines.append(f"  Risk Level: {session.risk_level.value}")
        lines.append(f"  Outcome: {session.outcome.value}")
        if session.verbatim_quotes:
            lines.append(f"  Key Quote: \"{session.verbatim_quotes}\"")
    lines.append("")
    
    # Safety plan
    if case.safety_plan:
        lines.append("SAFETY PLAN")
        lines.append("-" * 30)
        lines.append(f"Created: {case.safety_plan.created_at.strftime('%d %b %Y')}")
        lines.append("Warning signs identified: " + ", ".join(case.safety_plan.warning_signs) if case.safety_plan.warning_signs else "Warning signs: None documented")
        lines.append("")
    
    # Reason for referral
    if case.referral:
        lines.append("REFERRAL INFORMATION")
        lines.append("-" * 30)
        lines.append(f"Referred to: {case.referral.service_name}")
        lines.append(f"Urgency: {case.referral.urgency}")
        if case.referral.notes:
            lines.append(f"Notes: {case.referral.notes}")
    lines.append("")
    
    lines.append("=" * 50)
    lines.append("Prepared by Radio Check Triage Team")
    lines.append(f"Counsellor: {case.assigned_to_name}")
    lines.append("")
    lines.append("Radio Check provides 24/7 AI engagement with human triage")
    lines.append("support Mon-Fri 9am-5pm. For queries: admin@radiocheck.me")
    
    return "\n".join(lines)


# ============================================================================
# CONSTANTS
# ============================================================================

PROTECTIVE_FACTORS = [
    {"id": "family", "label": "Supportive family"},
    {"id": "partner", "label": "Supportive partner"},
    {"id": "friends", "label": "Social connections"},
    {"id": "employment", "label": "Employment (stable)"},
    {"id": "housing", "label": "Stable housing"},
    {"id": "hope", "label": "Expressed hope"},
    {"id": "pets", "label": "Pet/animal care"},
    {"id": "religion", "label": "Religious/spiritual beliefs"},
    {"id": "children", "label": "Children/dependents"},
    {"id": "future_plans", "label": "Future plans mentioned"},
    {"id": "treatment", "label": "Engaged with treatment"},
    {"id": "sobriety", "label": "Sober/in recovery"},
]

WARNING_SIGNS = [
    {"id": "isolation", "label": "Social isolation"},
    {"id": "substance", "label": "Substance use"},
    {"id": "recent_loss", "label": "Recent loss/bereavement"},
    {"id": "access_means", "label": "Access to means"},
    {"id": "previous_attempt", "label": "Previous attempt(s)"},
    {"id": "giving_away", "label": "Giving away possessions"},
    {"id": "hopelessness", "label": "Expressed hopelessness"},
    {"id": "sleep_changes", "label": "Sleep disturbances"},
    {"id": "appetite_changes", "label": "Appetite changes"},
    {"id": "agitation", "label": "Agitation/restlessness"},
    {"id": "reckless", "label": "Reckless behaviour"},
    {"id": "withdrawal", "label": "Withdrawal from activities"},
]

SESSION_ACTIONS = [
    {"id": "safety_plan_created", "label": "Safety plan created"},
    {"id": "safety_plan_updated", "label": "Safety plan updated"},
    {"id": "crisis_resources", "label": "Crisis resources provided"},
    {"id": "gp_contact", "label": "GP contact encouraged"},
    {"id": "referral_discussed", "label": "Referral discussed"},
    {"id": "coping_strategies", "label": "Coping strategies discussed"},
    {"id": "grounding_techniques", "label": "Grounding techniques taught"},
    {"id": "follow_up_arranged", "label": "Follow-up arranged"},
]

REFERRAL_SERVICES = [
    {"id": "op_courage_ne", "name": "Op COURAGE North East", "type": "Op COURAGE"},
    {"id": "op_courage_nw", "name": "Op COURAGE North West", "type": "Op COURAGE"},
    {"id": "op_courage_yh", "name": "Op COURAGE Yorkshire & Humber", "type": "Op COURAGE"},
    {"id": "op_courage_em", "name": "Op COURAGE East Midlands", "type": "Op COURAGE"},
    {"id": "op_courage_wm", "name": "Op COURAGE West Midlands", "type": "Op COURAGE"},
    {"id": "op_courage_ee", "name": "Op COURAGE East of England", "type": "Op COURAGE"},
    {"id": "op_courage_se", "name": "Op COURAGE South East", "type": "Op COURAGE"},
    {"id": "op_courage_sw", "name": "Op COURAGE South West", "type": "Op COURAGE"},
    {"id": "op_courage_lon", "name": "Op COURAGE London", "type": "Op COURAGE"},
    {"id": "nhs_iapt", "name": "NHS IAPT", "type": "NHS"},
    {"id": "nhs_cmht", "name": "NHS Community Mental Health Team", "type": "NHS"},
    {"id": "combat_stress", "name": "Combat Stress", "type": "Charity"},
    {"id": "help_for_heroes", "name": "Help for Heroes", "type": "Charity"},
    {"id": "ssafa", "name": "SSAFA", "type": "Charity"},
    {"id": "other", "name": "Other (specify)", "type": "Other"},
]
