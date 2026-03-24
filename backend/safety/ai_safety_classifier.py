"""
AI-Based Semantic Safety Classifier for RadioCheck
====================================================

Uses OpenAI GPT to provide semantic analysis of messages for suicide risk detection.
This acts as a SECONDARY safety layer - rule-based detection always takes precedence.

Features:
- LLM-based risk classification (none, low, medium, high, imminent)
- Conversation context analysis (uses last 10-20 messages)
- Structured JSON output with confidence scores
- Fail-safe design: falls back to rule-based if AI fails
- Selective invocation to minimize latency and cost
- Caching for recent classifications

Target: <300ms added latency
"""

import os
import json
import logging
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from functools import lru_cache
import asyncio

from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# Try to import openai
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
    logger.info("[AISafetyClassifier] OpenAI SDK loaded successfully")
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("[AISafetyClassifier] OpenAI SDK not available - AI classification disabled")

# Configuration
AI_SAFETY_ENABLED = os.environ.get("AI_SAFETY_ENABLED", "true").lower() == "true"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
AI_MODEL = "gpt-4o-mini"  # Fast model for low latency
AI_PROVIDER = "openai"

# Risk level mapping
RISK_LEVELS = {
    "none": 0,
    "low": 25,
    "medium": 50,
    "high": 75,
    "imminent": 100
}

# Cache for recent classifications (message hash -> result)
_classification_cache: Dict[str, Dict[str, Any]] = {}
_cache_max_size = 100
_cache_ttl_seconds = 300  # 5 minutes

# System prompt for the AI classifier
CLASSIFIER_SYSTEM_PROMPT = """You are a mental health safety classifier for RadioCheck, a peer support app for veterans.

Your role is to analyze user messages and conversation history to detect signs of suicidal ideation, self-harm intent, or severe emotional distress.

IMPORTANT: Be sensitive but thorough. Veterans may express distress in ways that don't use explicit keywords.

CRITICAL - NEGATION HANDLING:
When a user EXPLICITLY NEGATES self-harm or suicidal intent, DO NOT flag this as a risk. Examples of explicit negation:
- "Not in a 'I want to hurt myself' way - just TIRED"
- "I'm not suicidal, just frustrated"
- "Not going to hurt myself, just venting"
- "I don't want to die, I'm just exhausted"
- "Just tired, not like depressed or anything"
- "Sick of it all but not in a bad way, you know?"

These are HEALTHY expressions of distress where the user is CLARIFYING they are NOT at risk.
When you see explicit negation, respond with risk_level: "none" or "low" - NOT "medium" or higher.

Risk Levels:
- none: No indicators of risk. Normal conversation. Includes explicit negation of self-harm.
- low: Mild distress or sadness, but no self-harm indicators. User may be venting or frustrated.
- medium: Moderate distress, hopelessness, or passive death wishes ("I wish I wasn't here") WITHOUT explicit negation.
- high: Active suicidal ideation, mentions of methods, or clear intent without immediate plan.
- imminent: Immediate risk - explicit plan, timeline, access to means, or goodbye messages.

Look for:
1. Direct statements of suicidal intent (BUT CHECK FOR NEGATION FIRST)
2. Indirect expressions ("I can't go on", "everyone would be better off")
3. Method mentions (pills, bridge, hanging, etc.)
4. Hopelessness and feeling trapped
5. Farewell or goodbye language
6. Sudden calm after distress (potential warning sign)
7. Giving away possessions or settling affairs
8. History of attempts or self-harm
9. Military-specific language (combat guilt, survivor guilt, "ending the mission")

ALWAYS respond with valid JSON only, no other text."""

CLASSIFIER_USER_TEMPLATE = """Analyze this message for suicide/self-harm risk.

CURRENT MESSAGE:
{current_message}

CONVERSATION HISTORY (most recent first):
{conversation_history}

PREVIOUS SESSION CONTEXT (if available):
{session_context}

Respond with JSON only:
{{
  "risk_level": "none|low|medium|high|imminent",
  "confidence": 0.0-1.0,
  "contains_self_harm_intent": true|false,
  "detected_indicators": ["list", "of", "indicators"],
  "reason": "brief explanation"
}}"""


def _get_cache_key(message: str, history_hash: str) -> str:
    """Generate a cache key for the message and history."""
    combined = f"{message}:{history_hash}"
    return hashlib.md5(combined.encode()).hexdigest()


def _clean_cache():
    """Remove expired entries from cache."""
    global _classification_cache
    now = datetime.now(timezone.utc).timestamp()
    expired_keys = [
        k for k, v in _classification_cache.items()
        if now - v.get("timestamp", 0) > _cache_ttl_seconds
    ]
    for k in expired_keys:
        del _classification_cache[k]
    
    # Also trim if too large
    if len(_classification_cache) > _cache_max_size:
        # Remove oldest entries
        sorted_items = sorted(_classification_cache.items(), key=lambda x: x[1].get("timestamp", 0))
        for k, _ in sorted_items[:len(sorted_items) - _cache_max_size]:
            del _classification_cache[k]


def format_conversation_history(history: List[Dict[str, Any]], max_messages: int = 15, max_chars: int = 3000) -> str:
    """Format conversation history for the AI prompt."""
    if not history:
        return "No previous messages in this session."
    
    # Take most recent messages first
    recent = history[-max_messages:] if len(history) > max_messages else history
    
    formatted_lines = []
    total_chars = 0
    
    for msg in reversed(recent):  # Most recent first
        role = msg.get("role", "user")
        text = msg.get("text", msg.get("content", ""))[:500]  # Truncate long messages
        timestamp = msg.get("timestamp", "")
        
        line = f"[{role}] {text}"
        if total_chars + len(line) > max_chars:
            break
        formatted_lines.append(line)
        total_chars += len(line)
    
    return "\n".join(formatted_lines) if formatted_lines else "No previous messages."


def format_session_context(previous_sessions: List[Dict[str, Any]], max_sessions: int = 3) -> str:
    """Format previous session summaries for context."""
    if not previous_sessions:
        return "No previous session data available."
    
    recent = previous_sessions[-max_sessions:] if len(previous_sessions) > max_sessions else previous_sessions
    
    formatted = []
    for session in recent:
        date = session.get("date", "Unknown date")
        summary = session.get("summary", "No summary")
        risk_flags = session.get("risk_flags", [])
        
        line = f"- {date}: {summary}"
        if risk_flags:
            line += f" [Flags: {', '.join(risk_flags)}]"
        formatted.append(line)
    
    return "\n".join(formatted) if formatted else "No previous session data."


async def classify_message_with_ai(
    message: str,
    conversation_history: List[Dict[str, Any]] = None,
    previous_sessions: List[Dict[str, Any]] = None,
    use_cache: bool = True
) -> Dict[str, Any]:
    """
    Classify a message using the AI model.
    
    Args:
        message: The current user message
        conversation_history: List of previous messages in this session
        previous_sessions: List of previous session summaries (from local storage)
        use_cache: Whether to use cached results
    
    Returns:
        Dict with risk_level, confidence, contains_self_harm_intent, detected_indicators, reason
    """
    
    # Default response for failures
    default_response = {
        "risk_level": "none",
        "risk_score": 0,
        "confidence": 0.0,
        "contains_self_harm_intent": False,
        "detected_indicators": [],
        "reason": "AI classification unavailable",
        "ai_used": False,
        "cached": False,
        "error": None
    }
    
    # Check if AI is enabled and available
    if not AI_SAFETY_ENABLED:
        default_response["reason"] = "AI safety classification disabled"
        return default_response
    
    if not OPENAI_AVAILABLE:
        default_response["reason"] = "OpenAI SDK not available"
        return default_response
    
    if not OPENAI_API_KEY:
        default_response["reason"] = "No OPENAI_API_KEY configured"
        return default_response
    
    try:
        # Clean cache periodically
        _clean_cache()
        
        # Generate cache key
        history_hash = hashlib.md5(
            json.dumps(conversation_history or [], default=str).encode()
        ).hexdigest()[:8]
        cache_key = _get_cache_key(message, history_hash)
        
        # Check cache
        if use_cache and cache_key in _classification_cache:
            cached = _classification_cache[cache_key]
            if datetime.now(timezone.utc).timestamp() - cached.get("timestamp", 0) < _cache_ttl_seconds:
                logger.info(f"[AISafetyClassifier] Cache hit for message")
                result = cached.get("result", default_response).copy()
                result["cached"] = True
                return result
        
        # Format the prompt
        history_text = format_conversation_history(conversation_history or [])
        session_text = format_session_context(previous_sessions or [])
        
        user_prompt = CLASSIFIER_USER_TEMPLATE.format(
            current_message=message[:1000],  # Truncate very long messages
            conversation_history=history_text,
            session_context=session_text
        )
        
        # Call OpenAI directly using your own API key
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        
        start_time = datetime.now(timezone.utc)
        completion = await client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": CLASSIFIER_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=200,
            temperature=0.1,
        )
        response_text = completion.choices[0].message.content or ""
        elapsed_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
        
        logger.info(f"[AISafetyClassifier] AI response in {elapsed_ms:.0f}ms")
        
        # Parse JSON response
        try:
            # Clean the response - sometimes models add markdown
            clean_response = response_text.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            result = json.loads(clean_response)
        except json.JSONDecodeError as e:
            logger.error(f"[AISafetyClassifier] Failed to parse AI response: {e}")
            logger.error(f"[AISafetyClassifier] Raw response: {response_text[:500]}")
            default_response["error"] = "Failed to parse AI response"
            return default_response
        
        # Validate and normalize the response
        risk_level = result.get("risk_level", "none").lower()
        if risk_level not in RISK_LEVELS:
            risk_level = "none"
        
        classified_result = {
            "risk_level": risk_level,
            "risk_score": RISK_LEVELS.get(risk_level, 0),
            "confidence": min(1.0, max(0.0, float(result.get("confidence", 0.5)))),
            "contains_self_harm_intent": bool(result.get("contains_self_harm_intent", False)),
            "detected_indicators": result.get("detected_indicators", []),
            "reason": result.get("reason", "AI analysis completed"),
            "ai_used": True,
            "cached": False,
            "processing_time_ms": elapsed_ms,
            "error": None
        }
        
        # Cache the result
        _classification_cache[cache_key] = {
            "result": classified_result,
            "timestamp": datetime.now(timezone.utc).timestamp()
        }
        
        logger.info(
            f"[AISafetyClassifier] Classified: risk={risk_level}, "
            f"confidence={classified_result['confidence']:.2f}, "
            f"self_harm={classified_result['contains_self_harm_intent']}"
        )
        
        return classified_result
        
    except Exception as e:
        logger.error(f"[AISafetyClassifier] Error during classification: {e}")
        default_response["error"] = str(e)
        return default_response


def should_invoke_ai_classifier(
    rule_based_score: int,
    keyword_triggered: bool,
    semantic_score: float,
    pattern_detected: bool,
    conversation_escalating: bool
) -> bool:
    """
    Determine if we should invoke the AI classifier.
    
    Selective invocation to minimize latency and API costs.
    Only call AI when there's reason to believe deeper analysis is needed.
    """
    
    # Always invoke for higher rule-based scores
    if rule_based_score >= 30:
        return True
    
    # Invoke if keywords were triggered
    if keyword_triggered:
        return True
    
    # Invoke if semantic similarity is elevated
    if semantic_score >= 0.5:
        return True
    
    # Invoke if concerning patterns detected
    if pattern_detected:
        return True
    
    # Invoke if conversation is escalating
    if conversation_escalating:
        return True
    
    return False


def merge_ai_risk_with_existing(
    rule_based_risk: str,
    ai_risk: str,
    ai_confidence: float
) -> str:
    """
    Merge AI risk level with existing rule-based risk.
    
    CRITICAL: Rule-based detection ALWAYS takes precedence for high-risk cases.
    AI can only UPGRADE risk, never downgrade from high/imminent.
    """
    
    risk_order = ["none", "low", "medium", "high", "imminent"]
    
    rule_idx = risk_order.index(rule_based_risk) if rule_based_risk in risk_order else 0
    ai_idx = risk_order.index(ai_risk) if ai_risk in risk_order else 0
    
    # Rule-based high/imminent ALWAYS wins
    if rule_idx >= risk_order.index("high"):
        return rule_based_risk
    
    # If AI detected higher risk with good confidence, upgrade
    if ai_idx > rule_idx and ai_confidence >= 0.6:
        return ai_risk
    
    # If AI detected lower, keep rule-based (fail-safe)
    return rule_based_risk


# Audit logging for AI classifications
_ai_audit_log: List[Dict[str, Any]] = []
_ai_audit_max_entries = 500


def log_ai_classification(
    session_id: str,
    message_preview: str,
    result: Dict[str, Any],
    merged_risk: str = None
):
    """Log AI classification for audit purposes."""
    global _ai_audit_log
    
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id[:12] if session_id else "unknown",
        "message_preview": message_preview[:100],
        "ai_risk_level": result.get("risk_level"),
        "ai_confidence": result.get("confidence"),
        "contains_self_harm_intent": result.get("contains_self_harm_intent"),
        "detected_indicators": result.get("detected_indicators", []),
        "reason": result.get("reason"),
        "merged_risk": merged_risk,
        "ai_used": result.get("ai_used"),
        "cached": result.get("cached"),
        "processing_time_ms": result.get("processing_time_ms"),
        "error": result.get("error")
    }
    
    _ai_audit_log.append(entry)
    
    # Trim if too large
    if len(_ai_audit_log) > _ai_audit_max_entries:
        _ai_audit_log = _ai_audit_log[-_ai_audit_max_entries:]


def get_ai_audit_log(hours_back: int = 24, min_risk: str = "low") -> List[Dict[str, Any]]:
    """Get AI classification audit log."""
    risk_order = ["none", "low", "medium", "high", "imminent"]
    min_idx = risk_order.index(min_risk) if min_risk in risk_order else 0
    
    cutoff = datetime.now(timezone.utc).timestamp() - (hours_back * 3600)
    
    filtered = []
    for entry in _ai_audit_log:
        try:
            entry_time = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00")).timestamp()
            if entry_time < cutoff:
                continue
            
            entry_risk = entry.get("ai_risk_level", "none")
            entry_idx = risk_order.index(entry_risk) if entry_risk in risk_order else 0
            if entry_idx >= min_idx:
                filtered.append(entry)
        except:
            continue
    
    return filtered


def get_ai_classifier_status() -> Dict[str, Any]:
    """Get AI classifier status for monitoring."""
    return {
        "enabled": AI_SAFETY_ENABLED,
        "available": OPENAI_AVAILABLE,
        "has_api_key": bool(OPENAI_API_KEY),
        "model": AI_MODEL,
        "provider": AI_PROVIDER,
        "cache_size": len(_classification_cache),
        "audit_log_size": len(_ai_audit_log),
        "status": "operational" if (AI_SAFETY_ENABLED and OPENAI_AVAILABLE and OPENAI_API_KEY) else "disabled"
    }


# Module initialization
logger.info(f"[AISafetyClassifier] Module loaded - enabled={AI_SAFETY_ENABLED}, available={OPENAI_AVAILABLE}")
