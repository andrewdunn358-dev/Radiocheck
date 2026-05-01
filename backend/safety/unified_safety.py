"""
RadioCheck Safeguarding - Unified Safety System
================================================
Version 3.0 - March 2026

This module provides a unified interface to all safety layers:
1. Keyword-based safety monitor (existing)
2. Contextual risk scoring (existing)
3. Conversation trajectory monitoring (new)
4. Semantic similarity analysis (new)
5. Pattern detection (new)
6. AI-based semantic classifier (NEW - OpenAI)

The unified system evaluates EVERY message within the context
of the entire conversation and combines all detection methods.
"""

import logging
import time
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any

# Import existing safety modules
from .safety_monitor import assess_message_safety, EnhancedSafetyMonitor

# Import new modules
from .conversation_monitor import (
    analyze_message_with_context,
    get_conversation_summary,
    get_or_create_conversation_state,
    clear_conversation_state,
    flag_candidate_phrase,
    get_audit_log,
)
from .semantic_model import (
    full_semantic_analysis,
    analyze_semantic_risk,
    initialize_semantic_model,
)
from .phrase_dataset import get_phrase_count, CATEGORY_SEVERITY_ORDER

# Import AI classifier (new)
from .ai_safety_classifier import (
    classify_message_with_ai,
    should_invoke_ai_classifier,
    merge_ai_risk_with_existing,
    log_ai_classification,
    get_ai_classifier_status,
    get_ai_audit_log,
)

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Overall risk thresholds
UNIFIED_THRESHOLD_MEDIUM = 40
UNIFIED_THRESHOLD_HIGH = 60
UNIFIED_THRESHOLD_IMMINENT = 80

# Component weights for final score
COMPONENT_WEIGHTS = {
    "keyword": 0.30,        # Keyword-based detection
    "conversation": 0.35,   # Conversation trajectory
    "semantic": 0.25,       # Semantic similarity
    "pattern": 0.10,        # Pattern detection bonus
}

# Failsafe triggers (any of these = IMMINENT)
FAILSAFE_TRIGGERS = [
    "explicit_suicide_plan",
    "imminent_intent",
    "high_semantic_similarity_to_suicide",
    "rapid_escalation_with_method",
    "intent_confirmation",
]


# ============================================================================
# UNIFIED ANALYSIS FUNCTION
# ============================================================================

def analyze_message_unified(
    message: str,
    session_id: str,
    user_id: str,
    character: str = "bob",
    conversation_history: Optional[List[Dict]] = None,
    previous_sessions: Optional[List[Dict]] = None,  # NEW: for AI context
    is_under_18: bool = False,
) -> Dict[str, Any]:
    """
    Unified safety analysis combining all detection methods.
    
    This is the main entry point for all safety checks.
    It evaluates the message in context of the entire conversation.
    
    Args:
        message: The current user message
        session_id: Unique session identifier
        user_id: User identifier
        character: AI character name
        conversation_history: Optional pre-existing history (will be tracked automatically)
        previous_sessions: Previous session summaries from local storage (for AI context)
        is_under_18: Whether user is a minor (additional protections)
    
    Returns:
        Comprehensive safety assessment with intervention flags
    """
    start_time = time.time()
    
    # =========================================================================
    # LAYER 1: Keyword-based Safety Monitor (Existing)
    # Fast, deterministic keyword matching
    # =========================================================================
    keyword_result = assess_message_safety(message)
    keyword_score = _risk_level_to_score(keyword_result.get("risk_level", "none"))
    # Round 10 Phase B hotfix (Defect #2): safety_monitor returns the field as
    # `specific_triggers` (see safety_monitor.py:613), not `matched_keywords`.
    # The pre-hotfix key was wrong, so keyword_triggers was always [], which
    # silently disabled reconciler Rule 1 (CONTEXT_OVERRIDE). The label-string
    # format (e.g. "critical: 'overdose'") is normalised back to bare keyword
    # names by extract_verdicts_from_unified() in verdict_reconciler.py.
    keyword_triggers = keyword_result.get("specific_triggers", [])
    
    # =========================================================================
    # LAYER 2: Semantic Similarity Analysis (New)
    # Embedding-based detection of indirect expressions
    # =========================================================================
    semantic_result = full_semantic_analysis(message)
    semantic_score = semantic_result.get("combined_semantic_score", 0)
    
    # =========================================================================
    # LAYER 3: Conversation Trajectory Analysis (New)
    # Full context evaluation with pattern detection
    # =========================================================================
    conversation_result = analyze_message_with_context(
        message=message,
        session_id=session_id,
        user_id=user_id,
        character=character,
        semantic_score=semantic_result.get("highest_similarity", 0.0)
    )
    conversation_score = conversation_result.get("conversation_risk_score", 0)
    
    # =========================================================================
    # LAYER 4: AI-Based Semantic Classifier (NEW - OpenAI)
    # Deep semantic analysis using LLM - SELECTIVE INVOCATION
    # =========================================================================
    ai_result = None
    ai_score = 0
    ai_invoked = False
    
    # Check if we should invoke the AI classifier
    should_invoke_ai = should_invoke_ai_classifier(
        rule_based_score=keyword_score,
        keyword_triggered=bool(keyword_triggers),
        semantic_score=semantic_result.get("highest_similarity", 0),
        pattern_detected=bool(conversation_result.get("detected_patterns")),
        conversation_escalating=conversation_result.get("is_escalating", False)
    )
    
    if should_invoke_ai:
        try:
            # Get conversation history for AI context
            conv_state = get_or_create_conversation_state(session_id, user_id, character)
            # ConversationSafetyState is a dataclass, access attributes directly
            history_list = getattr(conv_state, 'history', []) if conv_state else []
            conv_history_for_ai = [
                {"role": msg.get("role", "user"), "text": msg.get("text", "")}
                for msg in history_list[-20:]  # Last 20 messages
            ]
            
            # Run AI classification synchronously using nest_asyncio or thread pool
            import concurrent.futures
            import functools
            
            def run_ai_classification():
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    return loop.run_until_complete(
                        classify_message_with_ai(
                            message=message,
                            conversation_history=conv_history_for_ai,
                            previous_sessions=previous_sessions,
                            use_cache=True
                        )
                    )
                finally:
                    loop.close()
            
            # Run in a thread pool to avoid event loop conflicts
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(run_ai_classification)
                ai_result = future.result(timeout=10)  # 10 second timeout
            
            ai_invoked = ai_result.get("ai_used", False)
            ai_score = ai_result.get("risk_score", 0)
            
            # Log AI classification
            log_ai_classification(
                session_id=session_id,
                message_preview=message[:100],
                result=ai_result
            )
            
            logger.info(
                f"[UnifiedSafety] AI Layer: invoked={ai_invoked}, "
                f"risk={ai_result.get('risk_level')}, score={ai_score}"
            )
            
        except Exception as e:
            logger.error(f"[UnifiedSafety] AI classification failed: {e}")
            ai_result = {"error": str(e), "ai_used": False}
    
    # =========================================================================
    # COMBINE SCORES
    # =========================================================================
    
    # Weighted combination (original layers)
    weighted_score = (
        keyword_score * COMPONENT_WEIGHTS["keyword"] +
        conversation_score * COMPONENT_WEIGHTS["conversation"] +
        semantic_score * COMPONENT_WEIGHTS["semantic"]
    )
    
    # Add pattern bonus
    pattern_bonus = conversation_result.get("pattern_bonus", 0) * COMPONENT_WEIGHTS["pattern"]
    weighted_score += pattern_bonus
    
    # If AI was invoked and found higher risk, boost the score
    if ai_invoked and ai_result:
        ai_risk_level = ai_result.get("risk_level", "none")
        ai_confidence = ai_result.get("confidence", 0)
        
        # AI can UPGRADE but not downgrade risk
        if ai_score > weighted_score and ai_confidence >= 0.6:
            # Blend AI score with weighted score (AI has max 30% influence)
            ai_influence = min(0.30, ai_confidence * 0.3)
            weighted_score = weighted_score * (1 - ai_influence) + ai_score * ai_influence
            logger.info(f"[UnifiedSafety] AI upgraded score: {weighted_score:.1f}")
    
    # Ensure score doesn't exceed 100
    final_score = min(int(weighted_score), 100)
    
    # =========================================================================
    # FAILSAFE CHECKS
    # These override the weighted score
    # =========================================================================
    failsafe_triggered = False
    failsafe_reason = None
    
    # Check 1: Explicit suicide plan (keyword)
    if keyword_result.get("risk_level") == "critical":
        failsafe_triggered = True
        failsafe_reason = "explicit_suicide_plan"
    
    # Check 2: Imminent intent from conversation
    if conversation_result.get("conversation_risk_level") == "IMMINENT":
        failsafe_triggered = True
        failsafe_reason = "imminent_intent"
    
    # Check 3: High semantic similarity to suicide statements
    if semantic_result.get("highest_similarity", 0) >= 0.85:
        if semantic_result.get("matched_category") in ["intent", "method"]:
            failsafe_triggered = True
            failsafe_reason = "high_semantic_similarity_to_suicide"
    
    # Check 4: Rapid escalation with method mention
    if (conversation_result.get("rapid_escalation") and 
        "method" in conversation_result.get("categories_triggered", [])):
        failsafe_triggered = True
        failsafe_reason = "rapid_escalation_with_method"
    
    # Check 5: Intent confirmation pattern
    if "INTENT_ESCALATION" in conversation_result.get("detected_patterns", []):
        failsafe_triggered = True
        failsafe_reason = "intent_confirmation"
    
    # =========================================================================
    # DETERMINE FINAL RISK LEVEL
    # =========================================================================
    if failsafe_triggered:
        final_risk_level = "IMMINENT"
        final_score = max(final_score, 95)
    elif final_score >= UNIFIED_THRESHOLD_IMMINENT:
        final_risk_level = "IMMINENT"
    elif final_score >= UNIFIED_THRESHOLD_HIGH:
        final_risk_level = "HIGH"
    elif final_score >= UNIFIED_THRESHOLD_MEDIUM:
        final_risk_level = "MEDIUM"
    elif final_score > 0:
        final_risk_level = "LOW"
    else:
        final_risk_level = "NONE"
    
    # =========================================================================
    # INTERVENTION DECISIONS
    # =========================================================================
    requires_intervention = (
        final_risk_level in ["HIGH", "IMMINENT"] or
        failsafe_triggered or
        conversation_result.get("is_escalating", False)
    )
    
    trigger_staff_alert = (
        final_risk_level == "IMMINENT" or
        failsafe_triggered or
        conversation_result.get("rapid_escalation", False)
    )
    
    show_crisis_resources = final_risk_level in ["HIGH", "IMMINENT"]
    
    block_ai_response = (
        failsafe_triggered and 
        failsafe_reason in ["explicit_suicide_plan", "imminent_intent"]
    )
    
    # =========================================================================
    # BUILD SAFETY WRAPPER (if needed)
    # =========================================================================
    safety_wrapper = None
    if show_crisis_resources:
        safety_wrapper = _generate_safety_wrapper(final_risk_level, character)
    
    # =========================================================================
    # CANDIDATE PHRASE LEARNING
    # If high risk but no keyword match, flag for review
    # =========================================================================
    if (final_score >= 60 and 
        not keyword_triggers and 
        semantic_result.get("highest_similarity", 0) >= 0.7):
        flag_candidate_phrase(
            phrase=message,
            session_id=session_id,
            user_id=user_id,
            inferred_category=semantic_result.get("matched_category", "unknown"),
            context_risk_level=final_risk_level,
        )
    
    # Calculate total processing time
    processing_time_ms = (time.time() - start_time) * 1000
    
    # =========================================================================
    # BUILD RESPONSE
    # =========================================================================
    return {
        # Overall assessment
        "risk_level": final_risk_level,
        "risk_score": final_score,
        "risk_trend": conversation_result.get("risk_trend", "stable"),
        
        # Component scores
        "component_scores": {
            "keyword": keyword_score,
            "conversation": conversation_score,
            "semantic": semantic_score,
            "pattern_bonus": int(pattern_bonus),
        },
        
        # Detailed triggers
        "keyword_triggers": keyword_triggers,
        "categories_triggered": conversation_result.get("categories_triggered", []),
        "detected_patterns": conversation_result.get("detected_patterns", []),
        "semantic_matches": semantic_result.get("indirect_expressions", []),
        
        # Conversation context
        "message_count": conversation_result.get("message_count", 1),
        "peak_risk_level": conversation_result.get("peak_risk_level", final_risk_level),
        "is_escalating": conversation_result.get("is_escalating", False),
        "rapid_escalation": conversation_result.get("rapid_escalation", False),
        
        # Failsafe status
        "failsafe_triggered": failsafe_triggered,
        "failsafe_reason": failsafe_reason,
        
        # Intervention flags
        "requires_intervention": requires_intervention,
        "trigger_staff_alert": trigger_staff_alert,
        "show_crisis_resources": show_crisis_resources,
        "block_ai_response": block_ai_response,
        
        # Response modifications
        "safety_wrapper": safety_wrapper,
        
        # AI Classifier results (NEW)
        "ai_classification": {
            "invoked": ai_invoked,
            "risk_level": ai_result.get("risk_level") if ai_result else None,
            "risk_score": ai_score,
            "confidence": ai_result.get("confidence") if ai_result else None,
            "contains_self_harm_intent": ai_result.get("contains_self_harm_intent") if ai_result else None,
            "detected_indicators": ai_result.get("detected_indicators", []) if ai_result else [],
            "reason": ai_result.get("reason") if ai_result else None,
            "cached": ai_result.get("cached") if ai_result else False,
            "processing_time_ms": ai_result.get("processing_time_ms") if ai_result else None,
        } if ai_result else {"invoked": False},
        
        # Metadata
        "processing_time_ms": round(processing_time_ms, 2),
        "session_id": session_id,
        "analysis_timestamp": datetime.utcnow().isoformat(),
        
        # Under-18 flag
        "is_under_18": is_under_18,
    }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _risk_level_to_score(level: str) -> int:
    """Convert risk level string to numeric score."""
    mapping = {
        "none": 0,
        "low": 25,
        "moderate": 40,
        "medium": 50,
        "high": 75,
        "critical": 95,
        "imminent": 100,
    }
    return mapping.get(level.lower(), 0)


def _generate_safety_wrapper(risk_level: str, character: str) -> Dict[str, Any]:
    """Generate appropriate safety wrapper for AI response."""
    if risk_level == "IMMINENT":
        return {
            "type": "crisis",
            "prepend_message": (
                "I can hear you're going through something really difficult right now. "
                "Your safety is what matters most to me. "
            ),
            "append_message": (
                "\n\nIf you're in immediate danger, please call 999 or go to A&E. "
                "You can also call Samaritans on 116 123 - they're available 24/7 and the call is free. "
                "You don't have to face this alone."
            ),
            "show_resources": True,
            "resources": [
                {"name": "Emergency Services", "number": "999", "type": "emergency"},
                {"name": "Samaritans", "number": "116 123", "type": "crisis", "available": "24/7"},
                {"name": "Crisis Text Line", "text": "SHOUT to 85258", "type": "text"},
            ],
        }
    elif risk_level == "HIGH":
        return {
            "type": "concern",
            "prepend_message": (
                "I'm concerned about what you're sharing with me. "
            ),
            "append_message": (
                "\n\nWould you like to speak to someone from our support team? "
                "If you need immediate support, Samaritans are available 24/7 on 116 123."
            ),
            "show_resources": True,
            "resources": [
                {"name": "Samaritans", "number": "116 123", "type": "crisis", "available": "24/7"},
                {"name": "CALM", "number": "0800 58 58 58", "type": "support", "available": "5pm-midnight"},
            ],
        }
    return None


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

def end_safety_session(session_id: str) -> Dict[str, Any]:
    """
    End a safety monitoring session and return summary.
    Call this when a chat session ends.
    """
    summary = get_conversation_summary(session_id)
    clear_conversation_state(session_id)
    return summary or {"session_id": session_id, "status": "not_found"}


def get_session_safety_status(session_id: str) -> Dict[str, Any]:
    """Get current safety status for a session."""
    summary = get_conversation_summary(session_id)
    if not summary:
        return {"session_id": session_id, "status": "no_active_session"}
    return summary


# ============================================================================
# AUDIT AND REPORTING
# ============================================================================

def get_safety_audit_report(
    session_id: Optional[str] = None,
    hours_back: int = 24,
    min_risk_level: str = "MEDIUM"
) -> List[Dict]:
    """
    Get safety audit report for review.
    
    Args:
        session_id: Filter by specific session (optional)
        hours_back: How many hours of history to include
        min_risk_level: Minimum risk level to include
    """
    from datetime import timedelta
    
    since = datetime.utcnow() - timedelta(hours=hours_back)
    entries = get_audit_log(session_id=session_id, since=since)
    
    # Filter by risk level
    risk_order = ["NONE", "LOW", "MEDIUM", "HIGH", "IMMINENT"]
    min_idx = risk_order.index(min_risk_level) if min_risk_level in risk_order else 0
    
    filtered = [
        e for e in entries
        if risk_order.index(e.get("risk_level", "NONE")) >= min_idx
    ]
    
    return filtered


# ============================================================================
# SYSTEM STATUS
# ============================================================================

def get_safety_system_status() -> Dict[str, Any]:
    """Get status of all safety system components."""
    from .semantic_model import _model_loaded
    from .conversation_monitor import conversation_states
    
    return {
        "phrase_dataset_size": get_phrase_count(),
        "semantic_model_loaded": _model_loaded,
        "active_sessions": len(conversation_states),
        "category_count": len(CATEGORY_SEVERITY_ORDER),
        "component_weights": COMPONENT_WEIGHTS,
        "thresholds": {
            "medium": UNIFIED_THRESHOLD_MEDIUM,
            "high": UNIFIED_THRESHOLD_HIGH,
            "imminent": UNIFIED_THRESHOLD_IMMINENT,
        },
        "status": "operational",
    }


# ============================================================================
# INITIALIZATION
# ============================================================================

def initialize_safety_system():
    """Initialize all safety system components."""
    try:
        # Initialize semantic model
        initialize_semantic_model()
        
        logger.info(f"[UnifiedSafetySystem] Initialized with {get_phrase_count()} phrases")
        logger.info(f"[UnifiedSafetySystem] Component weights: {COMPONENT_WEIGHTS}")
        return True
    except Exception as e:
        logger.error(f"[UnifiedSafetySystem] Initialization failed: {e}")
        return False


# Initialize on module load
print(f"[UnifiedSafetySystem] Module loaded - combining keyword, semantic, and trajectory analysis")
