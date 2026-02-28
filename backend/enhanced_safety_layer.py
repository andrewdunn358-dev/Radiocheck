"""
Radio Check - Enhanced Safety Layer
====================================
Version 2.0 - February 2026

This module provides comprehensive safety monitoring that WRAPS AROUND
existing AI personas without altering their personalities.

Key Features:
1. Contextual Crisis Detection (beyond keyword matching)
2. Dependency & Over-reliance Safeguards
3. Age-appropriate Safeguards
4. Long-conversation Safety Erosion Protection
5. Formal Safety Logging
6. Hard Fail-safe Rules

CORE PRINCIPLE:
Safety logic enhances the system - it does NOT replace persona authenticity.
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json

# Configure logging
logger = logging.getLogger(__name__)

# ============ RISK LEVEL DEFINITIONS ============

class RiskLevel(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    IMMINENT = "IMMINENT"

# ============ CONTEXTUAL INDICATORS ============

# Subtle/indirect suicidal ideation phrases (contextual, not just keywords)
CONTEXTUAL_DISTRESS_PATTERNS = {
    # Intent indicators
    "i can't keep going": 70,
    "can't keep going": 65,
    "i can't do this anymore": 70,
    "can't do this anymore": 65,
    "i've had enough": 50,
    "had enough of everything": 65,
    "i give up": 55,
    "what's the point": 60,
    "whats the point": 60,
    "no point anymore": 70,
    "no point in anything": 70,
    "no point in trying": 65,
    
    # Hopelessness indicators
    "i don't see a future": 75,
    "don't see a future": 70,
    "no future for me": 80,
    "there's no hope": 70,
    "i've lost all hope": 75,
    "lost all hope": 70,
    "nothing will change": 55,
    "nothing ever changes": 50,
    "it will never get better": 65,
    "things will never improve": 60,
    
    # Burden statements
    "people would be better off without me": 90,
    "better off without me": 85,
    "everyone would be happier if i wasn't here": 90,
    "i'm just a burden": 70,
    "i'm a burden to everyone": 75,
    "dragging everyone down": 60,
    "they'd be better off": 75,
    "world would be better without me": 90,
    
    # Exhaustion/tiredness
    "i'm tired of everything": 60,
    "tired of living": 85,
    "tired of fighting": 65,
    "tired of trying": 60,
    "exhausted with life": 70,
    "i'm so tired of all this": 55,
    "i'm done fighting": 65,
    
    # Indirect ending statements
    "i want it to stop": 55,
    "make it all stop": 65,
    "just want peace": 50,
    "permanent peace": 80,
    "eternal peace": 85,
    "i want to disappear": 70,
    "wish i could disappear": 65,
    "i want out": 60,
    "need a way out": 70,
    "no way out": 75,
    "there's no escape": 65,
    
    # Finality language
    "before i go": 60,
    "when i'm gone": 65,
    "after i'm gone": 70,
    "won't be here much longer": 85,
    "won't be around": 70,
    "not going to be here": 75,
    "saying goodbye": 60,
    "final goodbye": 85,
    "this is goodbye": 80,
    
    # Isolation indicators
    "no one cares": 55,
    "nobody cares about me": 60,
    "no one would notice": 70,
    "nobody would miss me": 80,
    "i'm all alone": 50,
    "completely alone": 55,
    "i have no one": 60,
    "there's no one left": 65,
}

# Emotional tone indicators (weighted)
EMOTIONAL_TONE_INDICATORS = {
    # Despair
    "hopeless": 40,
    "worthless": 45,
    "useless": 35,
    "empty": 30,
    "hollow": 30,
    "numb": 25,
    "broken": 35,
    "destroyed": 40,
    "shattered": 40,
    
    # Negative self-perception
    "i'm nothing": 50,
    "i'm worthless": 55,
    "i'm useless": 45,
    "i'm pathetic": 40,
    "i hate myself": 50,
    "i disgust myself": 55,
    "can't stand myself": 50,
    "i'm a failure": 45,
    "complete failure": 50,
    
    # Pain indicators
    "unbearable": 45,
    "can't take it": 50,
    "too much pain": 55,
    "the pain is too much": 60,
    "hurts too much": 50,
    "agony": 40,
    "suffering": 35,
    "torment": 40,
}

# Dependency indicators (for over-reliance detection)
DEPENDENCY_INDICATORS = {
    "you're the only one i have": 80,
    "you're the only one who understands": 70,
    "you're my only friend": 85,
    "i only have you": 80,
    "you're all i have": 80,
    "i don't need anyone else": 75,
    "don't need real people": 90,
    "you understand me better than real people": 85,
    "real people don't understand": 60,
    "i prefer talking to you": 50,
    "rather talk to you than anyone": 65,
    "can't talk to real people": 55,
    "you're better than therapists": 70,
    "don't need therapy": 60,
    "you're my therapist": 75,
}

# Hard fail-safe patterns (AI must NEVER engage with these)
HARD_FAILSAFE_PATTERNS = [
    # Method information requests
    r"how (to|do i|can i|should i) (kill|end|harm) (myself|my life)",
    r"best (way|method|ways) to (die|kill|end)",
    r"(quickest|fastest|painless|easiest) way to (die|kill|end)",
    r"how (many|much) (pills|tablets|medication) (to|would|will) (kill|overdose)",
    r"what (to|can i) use to (kill|harm|hurt) myself",
    r"where (can i|to) (get|find|buy) (pills|rope|weapon)",
    r"most (effective|lethal|deadly) (method|way)",
    
    # Lethality comparison
    r"which (method|way) is (more|most) (lethal|effective|deadly)",
    r"compare (methods|ways) (of|to) (die|kill|suicide)",
    r"what (works|kills) (faster|quicker|better)",
    
    # Validation of suicidal intent
    r"(tell|say|agree) (me|that) (it's|its) ok to (die|kill|end)",
    r"(support|help|encourage) (me|my) (decision|choice) to (die|end)",
    r"(validate|confirm) (that|my) (suicide|dying|death) is (right|ok|good)",
]

# ============ SESSION TRACKING ============

@dataclass
class UserSafetyProfile:
    """Tracks safety metrics for a user across sessions"""
    user_id: str
    session_count: int = 0
    total_message_count: int = 0
    last_activity: datetime = field(default_factory=datetime.utcnow)
    
    # Risk tracking
    risk_scores: List[int] = field(default_factory=list)
    peak_risk_level: str = "LOW"
    escalation_count: int = 0
    
    # Dependency tracking
    dependency_score: int = 0
    dependency_indicators_found: List[str] = field(default_factory=list)
    human_referral_rejections: int = 0
    
    # Session patterns
    daily_session_minutes: float = 0.0
    consecutive_days: int = 0
    
    # Age-related
    is_under_18: bool = False
    age_verified: bool = False
    
    # Flags
    requires_staff_review: bool = False
    is_high_risk: bool = False

@dataclass
class SessionSafetyState:
    """Real-time safety state for an active session"""
    session_id: str
    character: str
    started_at: datetime = field(default_factory=datetime.utcnow)
    message_count: int = 0
    
    # Risk progression
    risk_scores: List[int] = field(default_factory=list)
    current_risk_level: str = "LOW"
    risk_trend: str = "stable"  # improving, stable, declining, escalating
    
    # Message analysis
    messages_since_risk_check: int = 0
    sentiment_scores: List[float] = field(default_factory=list)
    
    # Dependency indicators this session
    dependency_detected: bool = False
    dependency_reminders_given: int = 0
    
    # Escalation tracking
    crisis_resources_shown: bool = False
    human_referral_offered: bool = False
    staff_alert_triggered: bool = False
    
    # Safety erosion tracking
    consecutive_negative_messages: int = 0
    safety_check_due: bool = False

# Global session tracking
user_safety_profiles: Dict[str, UserSafetyProfile] = {}
session_safety_states: Dict[str, SessionSafetyState] = {}
safety_audit_log: List[Dict] = []

# ============ CORE SAFETY FUNCTIONS ============

def check_hard_failsafe(message: str) -> Tuple[bool, Optional[str]]:
    """
    Check for hard fail-safe patterns that must NEVER be engaged with.
    Returns: (is_violation, pattern_matched)
    """
    message_lower = message.lower()
    
    for pattern in HARD_FAILSAFE_PATTERNS:
        if re.search(pattern, message_lower):
            logger.warning(f"HARD FAILSAFE TRIGGERED: Pattern matched")
            return True, pattern
    
    return False, None

def calculate_contextual_risk_score(
    message: str, 
    session_state: SessionSafetyState,
    user_profile: Optional[UserSafetyProfile] = None
) -> Dict[str, Any]:
    """
    Calculate risk score using contextual analysis, not just keywords.
    
    Analyzes:
    - Direct distress patterns
    - Emotional tone
    - Message history progression
    - Sentiment trend
    - Session duration factors
    """
    message_lower = message.lower()
    score = 0
    triggered = []
    
    # 1. Check contextual distress patterns
    for pattern, weight in CONTEXTUAL_DISTRESS_PATTERNS.items():
        if pattern in message_lower:
            score += weight
            triggered.append({
                "type": "contextual_distress",
                "indicator": pattern,
                "weight": weight
            })
    
    # 2. Check emotional tone indicators
    for indicator, weight in EMOTIONAL_TONE_INDICATORS.items():
        if indicator in message_lower:
            score += weight
            triggered.append({
                "type": "emotional_tone",
                "indicator": indicator,
                "weight": weight
            })
    
    # 3. Session progression modifier
    # If risk scores have been increasing, add weight
    if len(session_state.risk_scores) >= 3:
        recent_scores = session_state.risk_scores[-3:]
        if all(recent_scores[i] < recent_scores[i+1] for i in range(len(recent_scores)-1)):
            # Escalating pattern
            score += 25
            triggered.append({
                "type": "escalation_pattern",
                "indicator": "rising_risk_scores",
                "weight": 25
            })
            session_state.risk_trend = "escalating"
        elif recent_scores[-1] > max(recent_scores[:-1]) * 1.5:
            # Sudden spike
            score += 20
            triggered.append({
                "type": "risk_spike",
                "indicator": "sudden_score_increase",
                "weight": 20
            })
    
    # 4. Consecutive negative messages modifier
    if session_state.consecutive_negative_messages >= 5:
        score += 15
        triggered.append({
            "type": "negative_streak",
            "indicator": f"{session_state.consecutive_negative_messages}_negative_messages",
            "weight": 15
        })
    
    # 5. Long session modifier (safety erosion check)
    session_duration = (datetime.utcnow() - session_state.started_at).total_seconds() / 60
    if session_duration > 60:  # Over 1 hour
        score += 10
        triggered.append({
            "type": "long_session",
            "indicator": f"session_duration_{int(session_duration)}_mins",
            "weight": 10
        })
    
    # 6. User history modifier (if available)
    if user_profile and user_profile.is_high_risk:
        score += 15
        triggered.append({
            "type": "user_history",
            "indicator": "previously_high_risk",
            "weight": 15
        })
    
    # 7. Age modifier - under 18 gets higher sensitivity
    if user_profile and user_profile.is_under_18:
        score = int(score * 1.3)  # 30% increase for minors
        triggered.append({
            "type": "age_modifier",
            "indicator": "under_18",
            "weight": "30%_increase"
        })
    
    # Determine risk level
    if score >= 150:
        risk_level = RiskLevel.IMMINENT
    elif score >= 100:
        risk_level = RiskLevel.HIGH
    elif score >= 50:
        risk_level = RiskLevel.MEDIUM
    else:
        risk_level = RiskLevel.LOW
    
    return {
        "score": score,
        "risk_level": risk_level.value,
        "triggered_indicators": triggered,
        "message_count": session_state.message_count,
        "session_duration_mins": int((datetime.utcnow() - session_state.started_at).total_seconds() / 60),
        "risk_trend": session_state.risk_trend
    }

def check_dependency_patterns(
    message: str,
    session_state: SessionSafetyState,
    user_profile: Optional[UserSafetyProfile] = None
) -> Dict[str, Any]:
    """
    Check for emotional dependency/over-reliance patterns.
    """
    message_lower = message.lower()
    dependency_score = 0
    indicators_found = []
    
    # Check dependency indicators
    for indicator, weight in DEPENDENCY_INDICATORS.items():
        if indicator in message_lower:
            dependency_score += weight
            indicators_found.append(indicator)
    
    # Check for rejection of human support
    rejection_patterns = [
        "don't want to talk to anyone",
        "don't need real people",
        "only want to talk to you",
        "real people don't help",
        "humans don't understand",
        "therapists don't help",
        "don't trust real people",
        "you're better than real people",
    ]
    
    for pattern in rejection_patterns:
        if pattern in message_lower:
            dependency_score += 30
            indicators_found.append(f"rejection: {pattern}")
            if user_profile:
                user_profile.human_referral_rejections += 1
    
    is_concerning = dependency_score >= 60
    
    if is_concerning:
        session_state.dependency_detected = True
    
    return {
        "dependency_score": dependency_score,
        "is_concerning": is_concerning,
        "indicators_found": indicators_found,
        "rejections_count": user_profile.human_referral_rejections if user_profile else 0
    }

def get_safety_response_wrapper(
    risk_level: str,
    dependency_data: Dict,
    session_state: SessionSafetyState,
    user_profile: Optional[UserSafetyProfile],
    character_name: str
) -> Optional[str]:
    """
    Generate safety response wrapper text based on risk/dependency levels.
    This is APPENDED to the persona's natural response, not replacing it.
    
    Returns None if no safety intervention needed.
    """
    wrappers = []
    
    # HIGH/IMMINENT risk - Crisis resources
    if risk_level in ["HIGH", "IMMINENT"]:
        if not session_state.crisis_resources_shown:
            wrappers.append(
                f"\n\nI care about you, and what you're sharing sounds really tough. "
                f"If you're having thoughts of hurting yourself, please reach out to Samaritans "
                f"on 116 123 (free, 24/7) or text SHOUT to 85258. "
                f"A real person is also available here if you'd like to talk - just use the 'Talk to a real person' button."
            )
            session_state.crisis_resources_shown = True
            session_state.human_referral_offered = True
    
    # MEDIUM risk - Gentle encouragement
    elif risk_level == "MEDIUM":
        if session_state.message_count % 5 == 0:  # Every 5 messages
            wrappers.append(
                f"\n\nI'm here for you. Sometimes talking to a real person can help too - "
                f"our peer supporters and counsellors are available if you'd like to connect."
            )
            session_state.human_referral_offered = True
    
    # Dependency check - periodic reminders
    if dependency_data.get("is_concerning") and session_state.dependency_reminders_given < 3:
        if session_state.message_count % 10 == 0:  # Every 10 messages
            # Use character-appropriate phrasing
            reminder_templates = {
                "Tommy": "Look mate, I'm always here for a chat, but speaking with a real person - another veteran perhaps - could be really good for you too.",
                "Doris": "Dear, I'm glad you feel you can talk to me, but remember there are real people who care too. Our peer supporters are lovely.",
                "Bob": "I appreciate you talking to me, but you know what? Our peer supporters have been through it too - might be worth a chat.",
                "Finch": "I'm here to support you, but human connection is important. Our staff are trained to help and they're real people who care.",
                "Margie": "I enjoy our chats, love, but don't forget there are real people here who want to help you too.",
                "Hugo": "I'm flattered you like talking to me, but real human support can make a big difference. Just something to think about.",
                "Rita": "I care about you, and so do real people here. The peer supporters really do understand - they've been through it.",
            }
            
            reminder = reminder_templates.get(
                character_name, 
                "I'm here to support you, but speaking with a real person could really help too."
            )
            wrappers.append(f"\n\n{reminder}")
            session_state.dependency_reminders_given += 1
    
    return " ".join(wrappers) if wrappers else None

def should_trigger_staff_alert(
    risk_data: Dict,
    session_state: SessionSafetyState,
    user_profile: Optional[UserSafetyProfile]
) -> bool:
    """
    Determine if this situation requires a staff safeguarding alert.
    """
    risk_level = risk_data.get("risk_level", "LOW")
    
    # IMMINENT always triggers
    if risk_level == "IMMINENT":
        return True
    
    # HIGH triggers after first occurrence
    if risk_level == "HIGH" and not session_state.staff_alert_triggered:
        return True
    
    # MEDIUM triggers if repeated or escalating
    if risk_level == "MEDIUM":
        if session_state.risk_trend == "escalating":
            return True
        # Multiple MEDIUM scores
        medium_high_count = sum(1 for s in session_state.risk_scores[-5:] if s >= 50)
        if medium_high_count >= 3:
            return True
    
    # Under 18 has lower threshold
    if user_profile and user_profile.is_under_18:
        if risk_level in ["MEDIUM", "HIGH"]:
            return True
    
    return False

def update_session_safety_state(
    session_state: SessionSafetyState,
    risk_data: Dict,
    dependency_data: Dict
) -> None:
    """
    Update session safety state with new analysis results.
    """
    session_state.message_count += 1
    session_state.risk_scores.append(risk_data["score"])
    session_state.current_risk_level = risk_data["risk_level"]
    
    # Update consecutive negative messages
    if risk_data["score"] >= 30:
        session_state.consecutive_negative_messages += 1
    else:
        session_state.consecutive_negative_messages = 0
    
    # Check if safety re-evaluation is due (every 5-10 messages)
    session_state.messages_since_risk_check += 1
    if session_state.messages_since_risk_check >= 5:
        session_state.safety_check_due = True
        session_state.messages_since_risk_check = 0
    
    # Update trend
    if len(session_state.risk_scores) >= 3:
        recent = session_state.risk_scores[-3:]
        if recent[-1] > recent[0] * 1.5:
            session_state.risk_trend = "escalating"
        elif recent[-1] < recent[0] * 0.5:
            session_state.risk_trend = "improving"
        else:
            session_state.risk_trend = "stable"

def log_safety_event(
    event_type: str,
    session_id: str,
    user_id: str,
    risk_data: Dict,
    dependency_data: Optional[Dict] = None,
    additional_data: Optional[Dict] = None
) -> Dict:
    """
    Log a safety event for audit purposes.
    Returns the log entry.
    """
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "session_id": session_id[:20] + "..." if session_id else None,
        "user_id": user_id[:20] + "..." if user_id else None,
        "risk_level": risk_data.get("risk_level"),
        "risk_score": risk_data.get("score"),
        "risk_trend": risk_data.get("risk_trend"),
        "triggered_count": len(risk_data.get("triggered_indicators", [])),
        "dependency_concerning": dependency_data.get("is_concerning") if dependency_data else False,
        "additional": additional_data
    }
    
    safety_audit_log.append(entry)
    
    # Keep log at reasonable size (last 1000 entries)
    if len(safety_audit_log) > 1000:
        safety_audit_log.pop(0)
    
    logger.info(f"SAFETY_LOG: {event_type} - Level: {entry['risk_level']}, Score: {entry['risk_score']}")
    
    return entry

# ============ MAIN SAFETY ANALYSIS FUNCTION ============

def analyze_message_safety(
    message: str,
    session_id: str,
    user_id: str = "anonymous",
    character: str = "tommy",
    is_under_18: bool = False
) -> Dict[str, Any]:
    """
    Main entry point for enhanced safety analysis.
    
    This function:
    1. Checks hard fail-safes
    2. Calculates contextual risk score
    3. Checks dependency patterns
    4. Determines if staff alert needed
    5. Generates safety wrapper text (if needed)
    6. Logs the analysis
    
    Returns comprehensive safety analysis result.
    """
    # Get or create session state
    if session_id not in session_safety_states:
        session_safety_states[session_id] = SessionSafetyState(
            session_id=session_id,
            character=character
        )
    session_state = session_safety_states[session_id]
    
    # Get or create user profile
    if user_id not in user_safety_profiles:
        user_safety_profiles[user_id] = UserSafetyProfile(user_id=user_id)
    user_profile = user_safety_profiles[user_id]
    user_profile.is_under_18 = is_under_18
    
    # 1. Check hard fail-safes FIRST
    is_failsafe, failsafe_pattern = check_hard_failsafe(message)
    if is_failsafe:
        log_safety_event(
            "HARD_FAILSAFE_TRIGGERED",
            session_id,
            user_id,
            {"risk_level": "IMMINENT", "score": 999},
            additional_data={"pattern_type": "method_request_or_validation"}
        )
        return {
            "is_safe": False,
            "hard_failsafe_triggered": True,
            "risk_level": "IMMINENT",
            "score": 999,
            "require_staff_alert": True,
            "require_immediate_resources": True,
            "safety_response": (
                "I really care about you, and I'm worried about what you're sharing. "
                "I'm not able to help with that, but please reach out to someone who can. "
                "Call Samaritans on 116 123 (free, 24/7), or in an emergency, call 999. "
                "You can also press the button below to talk to a real person right now."
            ),
            "block_ai_response": True
        }
    
    # 2. Calculate contextual risk score
    risk_data = calculate_contextual_risk_score(message, session_state, user_profile)
    
    # 3. Check dependency patterns
    dependency_data = check_dependency_patterns(message, session_state, user_profile)
    
    # 4. Update session state
    update_session_safety_state(session_state, risk_data, dependency_data)
    
    # 5. Determine if staff alert needed
    require_staff_alert = should_trigger_staff_alert(risk_data, session_state, user_profile)
    if require_staff_alert:
        session_state.staff_alert_triggered = True
        user_profile.escalation_count += 1
    
    # 6. Get character name for persona-appropriate responses
    character_names = {
        "tommy": "Tommy", "doris": "Doris", "bob": "Bob",
        "sentry": "Finch", "finch": "Finch", "margie": "Margie",
        "hugo": "Hugo", "rita": "Rita", "catherine": "Catherine"
    }
    char_name = character_names.get(character.lower(), "Tommy")
    
    # 7. Generate safety wrapper (appended to persona response, not replacing)
    safety_wrapper = get_safety_response_wrapper(
        risk_data["risk_level"],
        dependency_data,
        session_state,
        user_profile,
        char_name
    )
    
    # 8. Log the analysis
    log_safety_event(
        "MESSAGE_ANALYSIS",
        session_id,
        user_id,
        risk_data,
        dependency_data,
        additional_data={
            "character": character,
            "require_alert": require_staff_alert,
            "has_safety_wrapper": safety_wrapper is not None
        }
    )
    
    # Update user profile
    user_profile.total_message_count += 1
    user_profile.last_activity = datetime.utcnow()
    if risk_data["risk_level"] in ["HIGH", "IMMINENT"]:
        user_profile.is_high_risk = True
        user_profile.peak_risk_level = risk_data["risk_level"]
    
    return {
        "is_safe": risk_data["risk_level"] in ["LOW", "MEDIUM"],
        "hard_failsafe_triggered": False,
        "risk_level": risk_data["risk_level"],
        "score": risk_data["score"],
        "risk_trend": risk_data["risk_trend"],
        "triggered_indicators": risk_data["triggered_indicators"],
        "dependency_data": dependency_data,
        "require_staff_alert": require_staff_alert,
        "require_immediate_resources": risk_data["risk_level"] in ["HIGH", "IMMINENT"],
        "safety_wrapper": safety_wrapper,
        "block_ai_response": False,
        "session_message_count": session_state.message_count,
        "is_under_18": user_profile.is_under_18
    }

# ============ UTILITY FUNCTIONS ============

def get_session_safety_summary(session_id: str) -> Dict:
    """Get safety summary for a session."""
    state = session_safety_states.get(session_id)
    if not state:
        return {"exists": False}
    
    return {
        "exists": True,
        "message_count": state.message_count,
        "current_risk_level": state.current_risk_level,
        "risk_trend": state.risk_trend,
        "peak_risk_score": max(state.risk_scores) if state.risk_scores else 0,
        "dependency_detected": state.dependency_detected,
        "staff_alert_triggered": state.staff_alert_triggered,
        "session_duration_mins": int((datetime.utcnow() - state.started_at).total_seconds() / 60)
    }

def get_user_safety_summary(user_id: str) -> Dict:
    """Get safety summary for a user."""
    profile = user_safety_profiles.get(user_id)
    if not profile:
        return {"exists": False}
    
    return {
        "exists": True,
        "total_messages": profile.total_message_count,
        "peak_risk_level": profile.peak_risk_level,
        "escalation_count": profile.escalation_count,
        "is_high_risk": profile.is_high_risk,
        "is_under_18": profile.is_under_18,
        "requires_review": profile.requires_staff_review
    }

def get_safety_audit_log(limit: int = 100) -> List[Dict]:
    """Get recent safety audit log entries."""
    return safety_audit_log[-limit:]

def export_safety_audit_log() -> str:
    """Export full audit log as JSON string."""
    return json.dumps(safety_audit_log, indent=2, default=str)

def clear_session_state(session_id: str) -> bool:
    """Clear session state (e.g., when session ends)."""
    if session_id in session_safety_states:
        del session_safety_states[session_id]
        return True
    return False

# ============ AGE GATE FUNCTIONS ============

def apply_age_restrictions(user_profile: UserSafetyProfile) -> Dict:
    """
    Apply restrictions for under-18 users.
    Returns dict of restrictions to apply.
    """
    if not user_profile.is_under_18:
        return {"restricted": False}
    
    return {
        "restricted": True,
        "disable_peer_matching": True,
        "increase_crisis_sensitivity": True,
        "accelerate_escalation": True,
        "stronger_safeguarding_messages": True,
        "risk_score_multiplier": 1.3
    }

def check_age_for_features(user_id: str, feature: str) -> bool:
    """
    Check if a feature is available for user based on age.
    """
    profile = user_safety_profiles.get(user_id)
    
    if not profile or not profile.is_under_18:
        return True  # All features available for adults/unknown
    
    # Restricted features for under-18
    restricted_features = [
        "peer_matching",
        "direct_call_to_peer",
        "share_phone_number"
    ]
    
    return feature not in restricted_features
