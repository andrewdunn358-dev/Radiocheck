"""
RadioCheck Safeguarding - Conversation Safety Monitor
======================================================
Version 1.0 - March 2026

Full conversation trajectory monitoring with pattern detection,
semantic analysis, and escalation tracking.

This module enhances the existing safety layers by analyzing
the ENTIRE conversation, not just individual messages.
"""

import asyncio
import logging
import re
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
import numpy as np

# Import phrase dataset
from .phrase_dataset import (
    ALL_PHRASES, PHRASES_BY_CATEGORY, CATEGORY_SEVERITY_ORDER,
    PhraseEntry, get_high_severity_phrases
)

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Conversation window settings
MAX_CONVERSATION_HISTORY = 50  # Maximum messages to track per conversation
MIN_MESSAGES_FOR_PATTERN = 3  # Minimum messages needed for pattern analysis

# Risk score thresholds
RISK_THRESHOLD_LOW = 30
RISK_THRESHOLD_MEDIUM = 50
RISK_THRESHOLD_HIGH = 70
RISK_THRESHOLD_IMMINENT = 90

# Escalation detection weights
ESCALATION_WEIGHTS = {
    "score_increase": 1.5,      # Weight for risk score increases
    "category_progression": 2.0, # Weight for moving up severity categories
    "rapid_escalation": 3.0,    # Weight for rapid escalation (within 5 msgs)
    "repetition": 1.3,          # Weight for repeated indicators
}

# Pattern detection configurations
CRISIS_PATTERNS = {
    "EMOTIONAL_DECLINE": {
        "sequence": ["distress", "hopelessness", "ideation"],
        "max_span_messages": 15,
        "escalation_bonus": 40,
    },
    "METHOD_INTRODUCTION": {
        "required": ["method"],
        "any_of": ["distress", "hopelessness", "ideation"],
        "max_span_messages": 10,
        "escalation_bonus": 50,
    },
    "INTENT_ESCALATION": {
        "sequence": ["ideation", "intent"],
        "max_span_messages": 8,
        "escalation_bonus": 70,
    },
    "FINALITY_BEHAVIOR": {
        "required": ["finality"],
        "any_of": ["intent", "method", "ideation"],
        "max_span_messages": 10,
        "escalation_bonus": 80,
    },
    "BURDEN_TO_IDEATION": {
        "sequence": ["burden", "ideation"],
        "max_span_messages": 12,
        "escalation_bonus": 25,
    },
    # NEW PATTERNS
    "REPEATED_IDEATION": {
        "count_category": "ideation",
        "min_count": 2,
        "max_span_messages": 50,
        "escalation_bonus": 50,
        "description": "Ideation appears multiple times across conversation",
    },
    "MULTIPLE_WEAK_SIGNALS": {
        "count_category": "distress",
        "min_count": 3,
        "max_span_messages": 5,
        "escalation_bonus": 30,
        "description": "Cluster of distress signals in recent messages",
    },
    "SUDDEN_EMOTIONAL_DROP": {
        "check_type": "emotional_drop",
        "drop_threshold": 0.4,
        "window_size": 10,
        "escalation_bonus": 25,
        "description": "Significant drop in emotional intensity",
    },
    "RAPID_ESCALATION": {
        "sequence": ["distress", "ideation", "method"],
        "max_time_minutes": 10,
        "max_span_messages": 10,
        "escalation_bonus": 60,
        "description": "Rapid emotional collapse within 10 minutes",
    },
    "METHOD_PERSISTENCE": {
        "check_type": "method_anywhere",
        "max_span_messages": 50,
        "escalation_bonus": 40,
        "description": "Method mentioned anywhere in last 50 messages",
    },
}


# ============================================================================
# DATA STRUCTURES
# ============================================================================

class RiskLevel(Enum):
    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    IMMINENT = "IMMINENT"


@dataclass
class MessageSafetyRecord:
    """Record of a single message's safety assessment."""
    timestamp: datetime
    message: str
    message_index: int
    risk_score: int
    risk_level: str
    detected_indicators: List[str]
    matched_phrases: List[str]
    categories_triggered: List[str]
    semantic_similarity_score: float = 0.0
    emotional_intensity: float = 0.0


@dataclass
class ConversationSafetyState:
    """
    Maintains safety state for an entire conversation.
    This is the core data structure for trajectory analysis.
    """
    session_id: str
    user_id: str
    character: str
    started_at: datetime = field(default_factory=datetime.utcnow)
    
    # Message history (rolling window)
    message_history: deque = field(default_factory=lambda: deque(maxlen=MAX_CONVERSATION_HISTORY))
    total_message_count: int = 0
    
    # Risk tracking
    risk_scores: List[int] = field(default_factory=list)
    current_risk_level: str = "NONE"
    peak_risk_level: str = "NONE"
    risk_trend: str = "stable"  # stable, improving, escalating, critical
    
    # Category tracking
    categories_seen: Dict[str, int] = field(default_factory=dict)
    highest_category_reached: str = "none"
    
    # Pattern detection
    detected_patterns: List[str] = field(default_factory=list)
    pattern_bonus_applied: int = 0
    
    # Escalation tracking
    escalation_events: List[Dict] = field(default_factory=list)
    rapid_escalation_detected: bool = False
    
    # Semantic analysis
    semantic_alerts: List[Dict] = field(default_factory=list)
    
    # Intervention tracking
    crisis_resources_shown: bool = False
    staff_alert_triggered: bool = False
    human_referral_offered: bool = False
    
    # Calculated conversation risk
    conversation_risk_score: int = 0


@dataclass
class CandidatePhrase:
    """A phrase flagged for potential addition to the dataset."""
    phrase: str
    detected_at: datetime
    session_id: str
    user_id: str
    inferred_category: str
    context_risk_level: str
    embedding_vector: Optional[np.ndarray] = None
    reviewed: bool = False
    approved: bool = False


# ============================================================================
# GLOBAL STATE
# ============================================================================

# Active conversation states (session_id -> ConversationSafetyState)
conversation_states: Dict[str, ConversationSafetyState] = {}

# Candidate phrases for learning (requires human moderation)
candidate_phrase_memory: List[CandidatePhrase] = []

# Audit log for all safety assessments
safety_audit_log: List[Dict] = []

# Pre-computed phrase data for fast matching
_phrase_lookup: Dict[str, PhraseEntry] = {}
_phrases_by_weight: Dict[int, List[str]] = {}


# ============================================================================
# INITIALIZATION
# ============================================================================

def _initialize_phrase_lookup():
    """Pre-compute phrase lookup tables for performance."""
    global _phrase_lookup, _phrases_by_weight
    
    for phrase_entry in ALL_PHRASES:
        normalized = phrase_entry.phrase.lower().strip()
        _phrase_lookup[normalized] = phrase_entry
        
        weight = phrase_entry.severity_weight
        if weight not in _phrases_by_weight:
            _phrases_by_weight[weight] = []
        _phrases_by_weight[weight].append(normalized)
    
    logger.info(f"[ConversationSafetyMonitor] Initialized phrase lookup with {len(_phrase_lookup)} phrases")

# Initialize on module load
_initialize_phrase_lookup()


# ============================================================================
# CORE FUNCTIONS
# ============================================================================

def get_or_create_conversation_state(
    session_id: str,
    user_id: str,
    character: str
) -> ConversationSafetyState:
    """Get existing conversation state or create new one."""
    if session_id not in conversation_states:
        conversation_states[session_id] = ConversationSafetyState(
            session_id=session_id,
            user_id=user_id,
            character=character
        )
        logger.info(f"[ConversationSafetyMonitor] Created new state for session {session_id[:8]}...")
    
    return conversation_states[session_id]


def analyze_message_with_context(
    message: str,
    session_id: str,
    user_id: str,
    character: str,
    semantic_score: float = 0.0
) -> Dict[str, Any]:
    """
    Analyze a message within the context of the entire conversation.
    
    This is the main entry point that evaluates:
    1. Individual message risk
    2. Conversation trajectory
    3. Pattern detection
    4. Escalation analysis
    
    Returns comprehensive safety assessment.
    """
    start_time = time.time()
    
    # Get conversation state
    state = get_or_create_conversation_state(session_id, user_id, character)
    state.total_message_count += 1
    
    # Step 1: Analyze individual message
    message_analysis = _analyze_single_message(message, state.total_message_count)
    
    # Step 2: Add semantic score if provided
    message_analysis.semantic_similarity_score = semantic_score
    
    # Step 3: Calculate emotional intensity
    message_analysis.emotional_intensity = _calculate_emotional_intensity(message, message_analysis)
    
    # Step 4: Add to conversation history
    state.message_history.append(message_analysis)
    state.risk_scores.append(message_analysis.risk_score)
    
    # Step 5: Update category tracking
    for category in message_analysis.categories_triggered:
        state.categories_seen[category] = state.categories_seen.get(category, 0) + 1
        _update_highest_category(state, category)
    
    # Step 6: Detect patterns in conversation
    detected_patterns = _detect_crisis_patterns(state)
    if detected_patterns:
        state.detected_patterns.extend(detected_patterns)
    
    # Step 7: Calculate conversation-level risk
    conversation_risk = _calculate_conversation_risk(state, message_analysis)
    state.conversation_risk_score = conversation_risk["total_score"]
    
    # Step 8: Detect escalation
    escalation_analysis = _analyze_escalation(state)
    if escalation_analysis["is_escalating"]:
        state.escalation_events.append({
            "timestamp": datetime.utcnow().isoformat(),
            "message_index": state.total_message_count,
            "reason": escalation_analysis["reason"]
        })
        state.rapid_escalation_detected = escalation_analysis.get("rapid", False)
    
    # Step 9: Determine final risk level
    final_risk_level = _determine_risk_level(
        message_analysis.risk_score,
        conversation_risk["total_score"],
        state.detected_patterns,
        escalation_analysis["is_escalating"]
    )
    
    state.current_risk_level = final_risk_level
    if _compare_risk_levels(final_risk_level, state.peak_risk_level) > 0:
        state.peak_risk_level = final_risk_level
    
    # Step 10: Update risk trend
    state.risk_trend = _calculate_risk_trend(state)
    
    # Step 11: Check for immediate intervention need
    requires_intervention = (
        final_risk_level in ["HIGH", "IMMINENT"] or
        state.rapid_escalation_detected or
        len([p for p in state.detected_patterns if "INTENT" in p or "METHOD" in p]) > 0
    )
    
    # Calculate processing time
    processing_time_ms = (time.time() - start_time) * 1000
    
    # Build response
    result = {
        # Message-level analysis
        "message_risk_score": message_analysis.risk_score,
        "message_risk_level": message_analysis.risk_level,
        "matched_phrases": message_analysis.matched_phrases,
        "categories_triggered": message_analysis.categories_triggered,
        "emotional_intensity": message_analysis.emotional_intensity,
        
        # Conversation-level analysis
        "conversation_risk_score": state.conversation_risk_score,
        "conversation_risk_level": final_risk_level,
        "risk_trend": state.risk_trend,
        "peak_risk_level": state.peak_risk_level,
        "message_count": state.total_message_count,
        
        # Pattern detection
        "detected_patterns": state.detected_patterns,
        "pattern_bonus": conversation_risk.get("pattern_bonus", 0),
        
        # Escalation analysis
        "is_escalating": escalation_analysis["is_escalating"],
        "rapid_escalation": state.rapid_escalation_detected,
        "escalation_reason": escalation_analysis.get("reason"),
        
        # Intervention flags
        "requires_intervention": requires_intervention,
        "trigger_staff_alert": final_risk_level == "IMMINENT" or state.rapid_escalation_detected,
        "show_crisis_resources": final_risk_level in ["HIGH", "IMMINENT"],
        
        # Metadata
        "processing_time_ms": round(processing_time_ms, 2),
        "session_id": session_id,
    }
    
    # Log to audit trail
    _log_safety_assessment(state, message, result)
    
    return result


def _analyze_single_message(message: str, message_index: int) -> MessageSafetyRecord:
    """Analyze a single message for risk indicators."""
    normalized = message.lower().strip()
    
    # CRITICAL: Check for explicit negation first
    # If user explicitly negates self-harm intent, skip safety flagging
    explicit_negations = [
        "not in a", "not like that", "not that way",
        "not suicidal", "not going to hurt", "not going to harm",
        "just tired", "just frustrated", "just angry", "just venting",
        "i'm not", "im not", "i am not", "not actually", "not literally",
        "don't want to die", "dont want to die", "not trying to die",
        "i'm safe", "im safe", "i am safe", "i'm okay", "im okay",
        "i'm fine", "im fine", "don't worry", "not what i mean",
        "not in that", "i want to hurt myself' way", "hurt myself way",
    ]
    
    has_explicit_negation = any(neg in normalized for neg in explicit_negations)
    
    # Also check for regex patterns
    import re
    negation_patterns = [
        r"not in a[n]?\s+['\"]?[\w\s]+['\"]?\s*way",  # "not in a 'X' way"
        r"just\s+(tired|frustrated|angry|venting|exhausted|fed up)",
    ]
    
    for pattern in negation_patterns:
        if re.search(pattern, normalized):
            has_explicit_negation = True
            break
    
    matched_phrases = []
    categories_triggered = []
    detected_indicators = []
    total_score = 0
    
    # Check against phrase dataset
    for phrase, entry in _phrase_lookup.items():
        if phrase in normalized:
            # If there's explicit negation, skip scoring for this phrase
            # but still track it for transparency
            if has_explicit_negation:
                detected_indicators.append(f"{entry.category}:{phrase}:NEGATED")
                continue  # Don't add to score
            
            matched_phrases.append(phrase)
            categories_triggered.append(entry.category)
            detected_indicators.append(f"{entry.category}:{phrase}")
            total_score += entry.severity_weight
    
    # Remove duplicate categories
    categories_triggered = list(set(categories_triggered))
    
    # Determine risk level for this message
    if total_score >= RISK_THRESHOLD_IMMINENT:
        risk_level = "IMMINENT"
    elif total_score >= RISK_THRESHOLD_HIGH:
        risk_level = "HIGH"
    elif total_score >= RISK_THRESHOLD_MEDIUM:
        risk_level = "MEDIUM"
    elif total_score >= RISK_THRESHOLD_LOW:
        risk_level = "LOW"
    else:
        risk_level = "NONE"
    
    return MessageSafetyRecord(
        timestamp=datetime.utcnow(),
        message=message,
        message_index=message_index,
        risk_score=min(total_score, 100),  # Cap at 100
        risk_level=risk_level,
        detected_indicators=detected_indicators,
        matched_phrases=matched_phrases,
        categories_triggered=categories_triggered,
    )


def _calculate_emotional_intensity(message: str, analysis: MessageSafetyRecord) -> float:
    """Calculate emotional intensity of a message (0.0 - 1.0)."""
    intensity = 0.0
    
    # Factor 1: Risk score contribution
    intensity += analysis.risk_score / 200.0  # Normalized
    
    # Factor 2: Exclamation marks and caps
    exclamations = message.count("!")
    intensity += min(exclamations * 0.05, 0.15)
    
    caps_ratio = sum(1 for c in message if c.isupper()) / max(len(message), 1)
    if caps_ratio > 0.5:
        intensity += 0.1
    
    # Factor 3: Strong emotional words
    strong_words = ["really", "so", "very", "extremely", "incredibly", "completely", "totally", "absolutely"]
    for word in strong_words:
        if word in message.lower():
            intensity += 0.05
    
    # Factor 4: Category severity
    for category in analysis.categories_triggered:
        category_idx = CATEGORY_SEVERITY_ORDER.index(category) if category in CATEGORY_SEVERITY_ORDER else 0
        intensity += category_idx * 0.02
    
    return min(intensity, 1.0)


def _update_highest_category(state: ConversationSafetyState, category: str):
    """Update the highest severity category seen in conversation."""
    if category not in CATEGORY_SEVERITY_ORDER:
        return
    
    current_idx = CATEGORY_SEVERITY_ORDER.index(state.highest_category_reached) if state.highest_category_reached in CATEGORY_SEVERITY_ORDER else -1
    new_idx = CATEGORY_SEVERITY_ORDER.index(category)
    
    if new_idx > current_idx:
        state.highest_category_reached = category


def _detect_crisis_patterns(state: ConversationSafetyState) -> List[str]:
    """
    Detect crisis progression patterns in conversation history.
    
    Handles multiple pattern types:
    - sequence: Categories must appear in order
    - required + any_of: Must have all required AND at least one of any_of
    - count_category: Count occurrences of a category
    - check_type: Special checks (emotional_drop, method_anywhere)
    """
    if len(state.message_history) < MIN_MESSAGES_FOR_PATTERN:
        return []
    
    detected = []
    recent_messages = list(state.message_history)
    
    for pattern_name, pattern_config in CRISIS_PATTERNS.items():
        if pattern_name in state.detected_patterns:
            continue  # Already detected
        
        max_span = pattern_config.get("max_span_messages", 15)
        messages_to_check = recent_messages[-max_span:]
        
        # Get categories seen in recent messages
        recent_categories = []
        for msg in messages_to_check:
            recent_categories.extend(msg.categories_triggered)
        
        # === PATTERN TYPE: Sequence ===
        if "sequence" in pattern_config and "check_type" not in pattern_config:
            sequence = pattern_config["sequence"]
            
            # Check for time constraint (RAPID_ESCALATION)
            if "max_time_minutes" in pattern_config:
                if _check_sequence_pattern_with_time(
                    messages_to_check, 
                    sequence, 
                    pattern_config["max_time_minutes"]
                ):
                    detected.append(pattern_name)
                    logger.warning(f"[ConversationSafetyMonitor] Pattern detected: {pattern_name}")
                    continue
            else:
                if _check_sequence_pattern(recent_categories, sequence):
                    detected.append(pattern_name)
                    logger.warning(f"[ConversationSafetyMonitor] Pattern detected: {pattern_name}")
                    continue
        
        # === PATTERN TYPE: Required + Any Of ===
        if "required" in pattern_config and "any_of" in pattern_config:
            required = pattern_config["required"]
            any_of = pattern_config["any_of"]
            
            has_required = all(r in recent_categories for r in required)
            has_any = any(a in recent_categories for a in any_of)
            
            if has_required and has_any:
                detected.append(pattern_name)
                logger.warning(f"[ConversationSafetyMonitor] Pattern detected: {pattern_name}")
                continue
        
        # === PATTERN TYPE: Count Category (REPEATED_IDEATION, MULTIPLE_WEAK_SIGNALS) ===
        if "count_category" in pattern_config:
            category_to_count = pattern_config["count_category"]
            min_count = pattern_config.get("min_count", 2)
            
            count = sum(1 for cat in recent_categories if cat == category_to_count)
            if count >= min_count:
                detected.append(pattern_name)
                logger.warning(f"[ConversationSafetyMonitor] Pattern detected: {pattern_name} ({count}x {category_to_count})")
                continue
        
        # === PATTERN TYPE: Special Checks ===
        check_type = pattern_config.get("check_type")
        
        if check_type == "emotional_drop":
            # Check for sudden emotional drop
            if _detect_emotional_drop(messages_to_check, pattern_config.get("drop_threshold", 0.4)):
                detected.append(pattern_name)
                logger.warning(f"[ConversationSafetyMonitor] Pattern detected: {pattern_name}")
                continue
        
        elif check_type == "method_anywhere":
            # Check if method mentioned anywhere in history
            if "method" in recent_categories:
                detected.append(pattern_name)
                logger.warning(f"[ConversationSafetyMonitor] Pattern detected: {pattern_name}")
                continue
    
    return detected


def _check_sequence_pattern_with_time(
    messages: List[MessageSafetyRecord], 
    sequence: List[str], 
    max_minutes: int
) -> bool:
    """Check if sequence appears within a time window."""
    seq_idx = 0
    first_match_time = None
    
    for msg in messages:
        for cat in msg.categories_triggered:
            if cat == sequence[seq_idx]:
                if seq_idx == 0:
                    first_match_time = msg.timestamp
                seq_idx += 1
                
                if seq_idx >= len(sequence):
                    # Check time constraint
                    if first_match_time:
                        time_diff = (msg.timestamp - first_match_time).total_seconds() / 60
                        return time_diff <= max_minutes
                    return True
                break
    
    return False


def _detect_emotional_drop(messages: List[MessageSafetyRecord], threshold: float) -> bool:
    """Detect sudden drop in emotional intensity."""
    if len(messages) < 3:
        return False
    
    intensities = [msg.emotional_intensity for msg in messages if msg.emotional_intensity > 0]
    
    if len(intensities) < 3:
        return False
    
    # Compare latest to average of previous
    latest = intensities[-1]
    previous_avg = sum(intensities[:-1]) / len(intensities[:-1])
    
    # Check for significant drop
    drop = previous_avg - latest
    return drop >= threshold
    
    return detected


def _check_sequence_pattern(categories: List[str], sequence: List[str]) -> bool:
    """Check if categories appear in order (not necessarily consecutive)."""
    seq_idx = 0
    for cat in categories:
        if cat == sequence[seq_idx]:
            seq_idx += 1
            if seq_idx >= len(sequence):
                return True
    return False


def _calculate_conversation_risk(
    state: ConversationSafetyState,
    current_message: MessageSafetyRecord
) -> Dict[str, Any]:
    """
    Calculate conversation-level risk score based on:
    - Weighted recent risk
    - Escalation pattern score
    - Repetition factor
    - Emotional intensity
    - Pattern bonus
    """
    if len(state.risk_scores) == 0:
        return {"total_score": current_message.risk_score, "components": {}}
    
    # Component 1: Weighted recent risk (more recent = more weight)
    recent_scores = list(state.risk_scores)[-10:]  # Last 10 messages
    weights = [0.5 + (i * 0.1) for i in range(len(recent_scores))]  # 0.5 to 1.4
    weighted_recent = sum(s * w for s, w in zip(recent_scores, weights)) / sum(weights)
    
    # Component 2: Escalation pattern score
    escalation_score = 0
    if len(state.risk_scores) >= 3:
        recent_3 = state.risk_scores[-3:]
        if recent_3[-1] > recent_3[0]:
            escalation_score = (recent_3[-1] - recent_3[0]) * ESCALATION_WEIGHTS["score_increase"]
    
    # Component 3: Repetition factor (repeated high-risk indicators)
    repetition_score = 0
    for category, count in state.categories_seen.items():
        if count > 1 and category in ["ideation", "method", "intent"]:
            repetition_score += count * 5 * ESCALATION_WEIGHTS["repetition"]
    
    # Component 4: Emotional intensity
    intensity_score = current_message.emotional_intensity * 15
    
    # Component 5: Pattern bonus
    pattern_bonus = 0
    for pattern in state.detected_patterns:
        if pattern in CRISIS_PATTERNS:
            pattern_bonus += CRISIS_PATTERNS[pattern].get("escalation_bonus", 20)
    
    state.pattern_bonus_applied = pattern_bonus
    
    # Total conversation risk
    total_score = (
        weighted_recent * 0.4 +
        escalation_score +
        repetition_score +
        intensity_score +
        pattern_bonus
    )
    
    return {
        "total_score": min(int(total_score), 100),
        "weighted_recent": round(weighted_recent, 1),
        "escalation_score": round(escalation_score, 1),
        "repetition_score": round(repetition_score, 1),
        "intensity_score": round(intensity_score, 1),
        "pattern_bonus": pattern_bonus,
    }


def _analyze_escalation(state: ConversationSafetyState) -> Dict[str, Any]:
    """Analyze if the conversation is escalating."""
    if len(state.risk_scores) < 3:
        return {"is_escalating": False}
    
    recent_scores = state.risk_scores[-5:]
    
    # Check for consistent increase
    is_increasing = all(recent_scores[i] <= recent_scores[i+1] for i in range(len(recent_scores)-1))
    
    # Check for rapid escalation (big jump in few messages)
    score_change = recent_scores[-1] - recent_scores[0]
    rapid_escalation = score_change > 40 and len(recent_scores) <= 5
    
    # Check for category progression
    category_progression = False
    if state.highest_category_reached in ["method", "intent", "finality"]:
        category_idx = CATEGORY_SEVERITY_ORDER.index(state.highest_category_reached)
        if category_idx >= 7:  # method, finality, intent
            category_progression = True
    
    is_escalating = is_increasing or rapid_escalation or category_progression
    
    reason = None
    if rapid_escalation:
        reason = f"Rapid escalation: +{score_change} points in {len(recent_scores)} messages"
    elif category_progression:
        reason = f"Category progression to {state.highest_category_reached}"
    elif is_increasing:
        reason = "Consistent risk score increase"
    
    return {
        "is_escalating": is_escalating,
        "rapid": rapid_escalation,
        "reason": reason,
        "score_change": score_change,
    }


def _determine_risk_level(
    message_score: int,
    conversation_score: int,
    patterns: List[str],
    is_escalating: bool
) -> str:
    """Determine final risk level combining all factors."""
    # Use the higher of message or conversation score
    effective_score = max(message_score, conversation_score)
    
    # Pattern-based override
    if any(p in ["INTENT_ESCALATION", "METHOD_INTRODUCTION"] for p in patterns):
        effective_score = max(effective_score, 80)
    
    # Escalation boost
    if is_escalating:
        effective_score = min(effective_score + 15, 100)
    
    # Determine level
    if effective_score >= RISK_THRESHOLD_IMMINENT:
        return "IMMINENT"
    elif effective_score >= RISK_THRESHOLD_HIGH:
        return "HIGH"
    elif effective_score >= RISK_THRESHOLD_MEDIUM:
        return "MEDIUM"
    elif effective_score >= RISK_THRESHOLD_LOW:
        return "LOW"
    return "NONE"


def _calculate_risk_trend(state: ConversationSafetyState) -> str:
    """Calculate the overall trend of risk in conversation."""
    if len(state.risk_scores) < 3:
        return "stable"
    
    recent = state.risk_scores[-5:]
    avg_first_half = sum(recent[:len(recent)//2]) / (len(recent)//2) if len(recent) > 1 else recent[0]
    avg_second_half = sum(recent[len(recent)//2:]) / (len(recent) - len(recent)//2)
    
    diff = avg_second_half - avg_first_half
    
    if state.current_risk_level == "IMMINENT":
        return "critical"
    elif diff > 15:
        return "escalating"
    elif diff < -10:
        return "improving"
    return "stable"


def _compare_risk_levels(level1: str, level2: str) -> int:
    """Compare two risk levels. Returns >0 if level1 > level2."""
    levels = ["NONE", "LOW", "MEDIUM", "HIGH", "IMMINENT"]
    idx1 = levels.index(level1) if level1 in levels else 0
    idx2 = levels.index(level2) if level2 in levels else 0
    return idx1 - idx2


def _log_safety_assessment(
    state: ConversationSafetyState,
    message: str,
    result: Dict[str, Any]
):
    """Log safety assessment for audit."""
    audit_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "session_id": state.session_id,
        "user_id": state.user_id,
        "message_index": state.total_message_count,
        "message_preview": message[:100] + "..." if len(message) > 100 else message,
        "message_risk_score": result["message_risk_score"],
        "conversation_risk_score": result["conversation_risk_score"],
        "risk_level": result["conversation_risk_level"],
        "risk_trend": result["risk_trend"],
        "detected_patterns": result["detected_patterns"],
        "is_escalating": result["is_escalating"],
        "requires_intervention": result["requires_intervention"],
        "processing_time_ms": result["processing_time_ms"],
    }
    
    safety_audit_log.append(audit_entry)
    
    # Keep audit log size manageable
    if len(safety_audit_log) > 10000:
        safety_audit_log.pop(0)
    
    # Log warnings for high-risk assessments
    if result["requires_intervention"]:
        logger.warning(
            f"[SAFETY INTERVENTION REQUIRED] session={state.session_id[:8]}... "
            f"level={result['conversation_risk_level']} "
            f"trend={result['risk_trend']} "
            f"patterns={result['detected_patterns']}"
        )


# ============================================================================
# CANDIDATE PHRASE LEARNING
# ============================================================================

def flag_candidate_phrase(
    phrase: str,
    session_id: str,
    user_id: str,
    inferred_category: str,
    context_risk_level: str,
    embedding_vector: Optional[np.ndarray] = None
):
    """
    Flag a phrase as a candidate for addition to the dataset.
    Requires human moderation before inclusion.
    """
    # Don't add if already in dataset
    if phrase.lower().strip() in _phrase_lookup:
        return
    
    # Don't add duplicates to candidates
    for existing in candidate_phrase_memory:
        if existing.phrase.lower() == phrase.lower():
            return
    
    candidate = CandidatePhrase(
        phrase=phrase,
        detected_at=datetime.utcnow(),
        session_id=session_id,
        user_id=user_id,
        inferred_category=inferred_category,
        context_risk_level=context_risk_level,
        embedding_vector=embedding_vector,
    )
    
    candidate_phrase_memory.append(candidate)
    
    logger.info(f"[ConversationSafetyMonitor] Flagged candidate phrase: '{phrase}' -> {inferred_category}")


def get_candidate_phrases_for_review() -> List[Dict]:
    """Get candidate phrases awaiting human review."""
    return [
        {
            "phrase": c.phrase,
            "detected_at": c.detected_at.isoformat(),
            "inferred_category": c.inferred_category,
            "context_risk_level": c.context_risk_level,
            "reviewed": c.reviewed,
        }
        for c in candidate_phrase_memory
        if not c.reviewed
    ]


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

def get_conversation_summary(session_id: str) -> Optional[Dict]:
    """Get safety summary for a conversation."""
    state = conversation_states.get(session_id)
    if not state:
        return None
    
    return {
        "session_id": session_id,
        "user_id": state.user_id,
        "character": state.character,
        "started_at": state.started_at.isoformat(),
        "message_count": state.total_message_count,
        "current_risk_level": state.current_risk_level,
        "peak_risk_level": state.peak_risk_level,
        "risk_trend": state.risk_trend,
        "conversation_risk_score": state.conversation_risk_score,
        "detected_patterns": state.detected_patterns,
        "categories_seen": state.categories_seen,
        "highest_category": state.highest_category_reached,
        "escalation_events_count": len(state.escalation_events),
        "rapid_escalation_detected": state.rapid_escalation_detected,
        "staff_alert_triggered": state.staff_alert_triggered,
    }


def clear_conversation_state(session_id: str):
    """Clear state for a session (e.g., after resolution)."""
    if session_id in conversation_states:
        del conversation_states[session_id]
        logger.info(f"[ConversationSafetyMonitor] Cleared state for session {session_id[:8]}...")


def get_audit_log(
    session_id: Optional[str] = None,
    since: Optional[datetime] = None,
    limit: int = 100
) -> List[Dict]:
    """Get audit log entries for review."""
    entries = safety_audit_log
    
    if session_id:
        entries = [e for e in entries if e["session_id"] == session_id]
    
    if since:
        entries = [e for e in entries if datetime.fromisoformat(e["timestamp"]) > since]
    
    return entries[-limit:]


# ============================================================================
# MODULE INFO
# ============================================================================

print(f"[ConversationSafetyMonitor] Module loaded - tracking conversation trajectories with {len(ALL_PHRASES)} phrases")
