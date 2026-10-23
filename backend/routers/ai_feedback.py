"""
AI Feedback Router - User feedback system for AI responses
Enables continuous improvement of AI prompts based on user feedback
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
import uuid
from datetime import datetime
import logging

from services.database import get_database
from pydantic import BaseModel

router = APIRouter(prefix="/ai-feedback", tags=["ai-feedback"])
logger = logging.getLogger(__name__)


class FeedbackCreate(BaseModel):
    session_id: str
    message_index: int  # Which message in the conversation
    ai_character: str  # tommy, sarah, marcus, etc.
    rating: int  # 1-5 stars or -1/0/1 for thumbs
    feedback_type: str = "rating"  # rating, thumbs, report
    comment: str = ""
    user_message: str = ""  # The user's message that prompted the AI response
    ai_response: str = ""  # The AI's response


class FeedbackAnalysis(BaseModel):
    character: str
    average_rating: float
    total_feedback: int
    positive_count: int
    negative_count: int
    common_issues: List[str]
    improvement_suggestions: List[str]


# ==================================
# Feedback Collection
# ==================================

@router.post("/submit")
async def submit_feedback(feedback: FeedbackCreate):
    """
    Submit feedback for an AI response.
    This helps improve the AI prompts over time.
    """
    db = get_database()
    
    feedback_data = {
        "id": str(uuid.uuid4()),
        "session_id": feedback.session_id,
        "message_index": feedback.message_index,
        "ai_character": feedback.ai_character,
        "rating": feedback.rating,
        "feedback_type": feedback.feedback_type,
        "comment": feedback.comment,
        "user_message": feedback.user_message,
        "ai_response": feedback.ai_response,
        "created_at": datetime.utcnow(),
        "analyzed": False
    }
    
    await db.ai_feedback.insert_one(feedback_data)
    
    # Update character performance metrics
    await update_character_metrics(db, feedback.ai_character, feedback.rating)
    
    return {
        "feedback_id": feedback_data["id"],
        "message": "Thank you for your feedback!"
    }


@router.post("/thumbs")
async def submit_thumbs_feedback(
    session_id: str,
    message_index: int,
    ai_character: str,
    is_positive: bool,
    ai_response: str = "",
    user_message: str = ""
):
    """Quick thumbs up/down feedback"""
    db = get_database()
    
    feedback_data = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "message_index": message_index,
        "ai_character": ai_character,
        "rating": 1 if is_positive else -1,
        "feedback_type": "thumbs",
        "comment": "",
        "user_message": user_message,
        "ai_response": ai_response,
        "created_at": datetime.utcnow(),
        "analyzed": False
    }
    
    await db.ai_feedback.insert_one(feedback_data)
    await update_character_metrics(db, ai_character, feedback_data["rating"])
    
    return {"feedback_id": feedback_data["id"]}


@router.post("/report")
async def report_response(
    session_id: str,
    message_index: int,
    ai_character: str,
    report_reason: str,
    ai_response: str = "",
    user_message: str = ""
):
    """
    Report a problematic AI response.
    Reasons: inappropriate, unhelpful, inaccurate, triggering, other
    """
    db = get_database()
    
    report_data = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "message_index": message_index,
        "ai_character": ai_character,
        "rating": -2,  # Severe negative
        "feedback_type": "report",
        "comment": report_reason,
        "user_message": user_message,
        "ai_response": ai_response,
        "created_at": datetime.utcnow(),
        "analyzed": False,
        "requires_review": True
    }
    
    await db.ai_feedback.insert_one(report_data)
    
    # Log for admin attention
    logger.warning(f"AI response reported: {ai_character} - reason_len={len(report_reason or '')}")
    
    return {
        "report_id": report_data["id"],
        "message": "Thank you for reporting this. We'll review it."
    }


# ==================================
# Analytics & Improvement
# ==================================

@router.get("/character/{character}")
async def get_character_feedback(character: str, days: int = 30):
    """Get feedback analytics for a specific AI character"""
    db = get_database()
    from datetime import timedelta
    
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    feedback_list = await db.ai_feedback.find({
        "ai_character": character,
        "created_at": {"$gte": cutoff}
    }).to_list(500)
    
    if not feedback_list:
        return {
            "character": character,
            "total_feedback": 0,
            "average_rating": 0,
            "positive_count": 0,
            "negative_count": 0,
            "report_count": 0
        }
    
    ratings = [f["rating"] for f in feedback_list if f.get("rating")]
    
    return {
        "character": character,
        "total_feedback": len(feedback_list),
        "average_rating": sum(ratings) / len(ratings) if ratings else 0,
        "positive_count": len([r for r in ratings if r > 0]),
        "negative_count": len([r for r in ratings if r < 0]),
        "report_count": len([f for f in feedback_list if f.get("feedback_type") == "report"]),
        "recent_comments": [f.get("comment", "") for f in feedback_list[-10:] if f.get("comment")]
    }


@router.get("/summary")
async def get_feedback_summary(days: int = 30):
    """Get overall feedback summary across all characters"""
    db = get_database()
    from datetime import timedelta
    
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Get all feedback
    all_feedback = await db.ai_feedback.find({
        "created_at": {"$gte": cutoff}
    }).to_list(2000)
    
    # Group by character
    characters = {}
    for f in all_feedback:
        char = f.get("ai_character", "unknown")
        if char not in characters:
            characters[char] = {"ratings": [], "reports": 0}
        if f.get("rating"):
            characters[char]["ratings"].append(f["rating"])
        if f.get("feedback_type") == "report":
            characters[char]["reports"] += 1
    
    summary = []
    for char, data in characters.items():
        ratings = data["ratings"]
        summary.append({
            "character": char,
            "total_feedback": len(ratings),
            "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else 0,
            "positive_percent": round(len([r for r in ratings if r > 0]) / len(ratings) * 100, 1) if ratings else 0,
            "report_count": data["reports"]
        })
    
    return {
        "period_days": days,
        "total_feedback": len(all_feedback),
        "characters": sorted(summary, key=lambda x: x["average_rating"], reverse=True)
    }


@router.get("/reports")
async def get_pending_reports(status: str = "pending"):
    """Get AI response reports for admin review"""
    db = get_database()
    
    reports = await db.ai_feedback.find({
        "feedback_type": "report",
        "requires_review": True
    }).sort("created_at", -1).to_list(100)
    
    return [{
        "id": r["id"],
        "ai_character": r["ai_character"],
        "reason": r.get("comment", ""),
        "user_message": r.get("user_message", ""),
        "ai_response": r.get("ai_response", ""),
        "created_at": r["created_at"].isoformat()
    } for r in reports]


@router.patch("/reports/{report_id}/resolve")
async def resolve_report(report_id: str, resolution: str, action_taken: str = ""):
    """Mark a report as resolved"""
    db = get_database()
    
    result = await db.ai_feedback.update_one(
        {"id": report_id},
        {"$set": {
            "requires_review": False,
            "resolution": resolution,
            "action_taken": action_taken,
            "resolved_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {"message": "Report resolved"}


# ==================================
# Improvement Suggestions
# ==================================

@router.get("/improvements/{character}")
async def get_improvement_suggestions(character: str):
    """
    Generate improvement suggestions based on negative feedback.
    Analyzes patterns in negative feedback to suggest prompt improvements.
    """
    db = get_database()
    
    # Get negative feedback for this character
    negative_feedback = await db.ai_feedback.find({
        "ai_character": character,
        "rating": {"$lt": 0}
    }).to_list(100)
    
    if not negative_feedback:
        return {
            "character": character,
            "suggestions": ["No negative feedback found - keep up the good work!"]
        }
    
    # Categorize issues
    issues = {
        "unhelpful": 0,
        "inappropriate": 0,
        "inaccurate": 0,
        "triggering": 0,
        "tone": 0,
        "other": 0
    }
    
    for f in negative_feedback:
        comment = f.get("comment", "").lower()
        if "help" in comment or "useful" in comment:
            issues["unhelpful"] += 1
        elif "inappropriate" in comment or "offensive" in comment:
            issues["inappropriate"] += 1
        elif "wrong" in comment or "inaccurate" in comment:
            issues["inaccurate"] += 1
        elif "trigger" in comment or "upset" in comment:
            issues["triggering"] += 1
        elif "tone" in comment or "cold" in comment or "robotic" in comment:
            issues["tone"] += 1
        else:
            issues["other"] += 1
    
    # Generate suggestions based on issues
    suggestions = []
    if issues["unhelpful"] > 2:
        suggestions.append("Consider adding more specific, actionable advice to responses")
    if issues["inappropriate"] > 0:
        suggestions.append("Review content filters and sensitivity guidelines")
    if issues["inaccurate"] > 2:
        suggestions.append("Update knowledge base with accurate veteran-specific information")
    if issues["triggering"] > 0:
        suggestions.append("Enhance trauma-informed language in prompts")
    if issues["tone"] > 2:
        suggestions.append("Adjust tone to be warmer and more empathetic")
    
    return {
        "character": character,
        "negative_feedback_count": len(negative_feedback),
        "issue_breakdown": issues,
        "suggestions": suggestions if suggestions else ["Review recent feedback for specific improvement areas"]
    }


# ==================================
# Helper Functions
# ==================================

async def update_character_metrics(db, character: str, rating: int):
    """Update aggregated metrics for an AI character"""
    await db.ai_character_metrics.update_one(
        {"character": character},
        {
            "$inc": {
                "total_feedback": 1,
                "total_rating": rating,
                "positive_count": 1 if rating > 0 else 0,
                "negative_count": 1 if rating < 0 else 0
            },
            "$set": {"updated_at": datetime.utcnow()}
        },
        upsert=True
    )
