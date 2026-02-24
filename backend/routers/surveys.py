"""
Surveys Router - Beta feedback surveys with feature flag control
"""
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import csv
import io

router = APIRouter(prefix="/surveys", tags=["surveys"])

# ============================================
# Models
# ============================================

class PreSurveySubmission(BaseModel):
    """Pre-usage survey (shown on first app open)"""
    user_id: str
    wellbeing_score: int = Field(..., ge=1, le=10, description="How are you feeling? 1-10")
    anxiety_level: int = Field(..., ge=0, le=3, description="GAD-2 anxiety: 0=Not at all, 3=Nearly every day")
    mood_level: int = Field(..., ge=0, le=3, description="PHQ-2 mood: 0=Not at all, 3=Nearly every day")
    hopes: Optional[str] = Field(None, description="What do you hope to get from this app?")
    
class PostSurveySubmission(BaseModel):
    """Post-usage survey (shown after X days)"""
    user_id: str
    wellbeing_score: int = Field(..., ge=1, le=10, description="How are you feeling now? 1-10")
    anxiety_level: int = Field(..., ge=0, le=3, description="GAD-2 anxiety level")
    mood_level: int = Field(..., ge=0, le=3, description="PHQ-2 mood level")
    app_helped: int = Field(..., ge=1, le=5, description="Has the app helped? 1-5")
    would_recommend: int = Field(..., ge=0, le=10, description="NPS: Would recommend? 0-10")
    most_useful_feature: Optional[str] = None
    improvements: Optional[str] = None
    additional_feedback: Optional[str] = None

class FeatureFlagUpdate(BaseModel):
    enabled: bool

class SurveyResponse(BaseModel):
    success: bool
    message: str

# ============================================
# Feature Flag Endpoints
# ============================================

@router.get("/beta-enabled")
async def check_beta_enabled():
    """Check if beta testing mode is enabled"""
    from server import db
    
    settings = await db.app_settings.find_one({"key": "beta_testing"})
    enabled = settings.get("enabled", False) if settings else False
    
    return {"beta_enabled": enabled}

@router.post("/beta-enabled")
async def set_beta_enabled(flag: FeatureFlagUpdate):
    """Enable or disable beta testing mode (admin only)"""
    from server import db
    
    await db.app_settings.update_one(
        {"key": "beta_testing"},
        {"$set": {"enabled": flag.enabled, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return {"success": True, "beta_enabled": flag.enabled}

# ============================================
# Survey Submission Endpoints
# ============================================

@router.post("/pre", response_model=SurveyResponse)
async def submit_pre_survey(survey: PreSurveySubmission):
    """Submit pre-usage survey"""
    from server import db
    
    # Check if beta mode is enabled
    settings = await db.app_settings.find_one({"key": "beta_testing"})
    if not settings or not settings.get("enabled", False):
        raise HTTPException(status_code=403, detail="Beta testing is not enabled")
    
    # Check if user already submitted pre-survey
    existing = await db.survey_responses.find_one({
        "user_id": survey.user_id,
        "survey_type": "pre"
    })
    
    if existing:
        return SurveyResponse(success=False, message="Pre-survey already submitted")
    
    # Store survey
    await db.survey_responses.insert_one({
        "user_id": survey.user_id,
        "survey_type": "pre",
        "wellbeing_score": survey.wellbeing_score,
        "anxiety_level": survey.anxiety_level,
        "mood_level": survey.mood_level,
        "hopes": survey.hopes,
        "submitted_at": datetime.now(timezone.utc)
    })
    
    return SurveyResponse(success=True, message="Thank you for your feedback!")

@router.post("/post", response_model=SurveyResponse)
async def submit_post_survey(survey: PostSurveySubmission):
    """Submit post-usage survey"""
    from server import db
    
    # Check if beta mode is enabled
    settings = await db.app_settings.find_one({"key": "beta_testing"})
    if not settings or not settings.get("enabled", False):
        raise HTTPException(status_code=403, detail="Beta testing is not enabled")
    
    # Check if user already submitted post-survey
    existing = await db.survey_responses.find_one({
        "user_id": survey.user_id,
        "survey_type": "post"
    })
    
    if existing:
        return SurveyResponse(success=False, message="Post-survey already submitted")
    
    # Store survey
    await db.survey_responses.insert_one({
        "user_id": survey.user_id,
        "survey_type": "post",
        "wellbeing_score": survey.wellbeing_score,
        "anxiety_level": survey.anxiety_level,
        "mood_level": survey.mood_level,
        "app_helped": survey.app_helped,
        "would_recommend": survey.would_recommend,
        "most_useful_feature": survey.most_useful_feature,
        "improvements": survey.improvements,
        "additional_feedback": survey.additional_feedback,
        "submitted_at": datetime.now(timezone.utc)
    })
    
    return SurveyResponse(success=True, message="Thank you for your valuable feedback!")

@router.get("/status/{user_id}")
async def get_survey_status(user_id: str):
    """Check which surveys a user has completed"""
    from server import db
    
    pre = await db.survey_responses.find_one({"user_id": user_id, "survey_type": "pre"})
    post = await db.survey_responses.find_one({"user_id": user_id, "survey_type": "post"})
    
    # Get pre-survey date to calculate if post-survey should show
    pre_date = pre.get("submitted_at") if pre else None
    days_since_pre = 0
    if pre_date:
        days_since_pre = (datetime.now(timezone.utc) - pre_date).days
    
    return {
        "pre_completed": pre is not None,
        "post_completed": post is not None,
        "days_since_pre": days_since_pre,
        "show_post_survey": pre is not None and post is None and days_since_pre >= 7
    }

# ============================================
# Admin Endpoints
# ============================================

@router.get("/responses")
async def get_all_responses(survey_type: Optional[str] = None, limit: int = 100):
    """Get all survey responses (admin)"""
    from server import db
    
    query = {}
    if survey_type:
        query["survey_type"] = survey_type
    
    responses = await db.survey_responses.find(query).sort("submitted_at", -1).limit(limit).to_list(limit)
    
    # Convert ObjectId to string
    for r in responses:
        r["_id"] = str(r["_id"])
        if "submitted_at" in r:
            r["submitted_at"] = r["submitted_at"].isoformat()
    
    return {"responses": responses, "count": len(responses)}

@router.get("/stats")
async def get_survey_stats():
    """Get aggregated survey statistics (admin)"""
    from server import db
    
    # Count responses
    pre_count = await db.survey_responses.count_documents({"survey_type": "pre"})
    post_count = await db.survey_responses.count_documents({"survey_type": "post"})
    
    # Calculate averages for pre-survey
    pre_pipeline = [
        {"$match": {"survey_type": "pre"}},
        {"$group": {
            "_id": None,
            "avg_wellbeing": {"$avg": "$wellbeing_score"},
            "avg_anxiety": {"$avg": "$anxiety_level"},
            "avg_mood": {"$avg": "$mood_level"}
        }}
    ]
    pre_stats = await db.survey_responses.aggregate(pre_pipeline).to_list(1)
    
    # Calculate averages for post-survey
    post_pipeline = [
        {"$match": {"survey_type": "post"}},
        {"$group": {
            "_id": None,
            "avg_wellbeing": {"$avg": "$wellbeing_score"},
            "avg_anxiety": {"$avg": "$anxiety_level"},
            "avg_mood": {"$avg": "$mood_level"},
            "avg_app_helped": {"$avg": "$app_helped"},
            "avg_recommend": {"$avg": "$would_recommend"}
        }}
    ]
    post_stats = await db.survey_responses.aggregate(post_pipeline).to_list(1)
    
    # Calculate improvement (post - pre)
    improvement = {}
    if pre_stats and post_stats:
        pre = pre_stats[0]
        post = post_stats[0]
        improvement = {
            "wellbeing_change": round((post.get("avg_wellbeing", 0) or 0) - (pre.get("avg_wellbeing", 0) or 0), 2),
            "anxiety_change": round((post.get("avg_anxiety", 0) or 0) - (pre.get("avg_anxiety", 0) or 0), 2),
            "mood_change": round((post.get("avg_mood", 0) or 0) - (pre.get("avg_mood", 0) or 0), 2)
        }
    
    return {
        "total_pre_surveys": pre_count,
        "total_post_surveys": post_count,
        "completion_rate": round(post_count / pre_count * 100, 1) if pre_count > 0 else 0,
        "pre_averages": pre_stats[0] if pre_stats else {},
        "post_averages": post_stats[0] if post_stats else {},
        "improvement": improvement,
        "nps_score": round(post_stats[0].get("avg_recommend", 0) or 0, 1) if post_stats else 0
    }

@router.get("/export")
async def export_responses_csv():
    """Export all survey responses as CSV (admin)"""
    from server import db
    
    responses = await db.survey_responses.find({}).sort("submitted_at", -1).to_list(1000)
    
    # Create CSV
    output = io.StringIO()
    
    fieldnames = [
        "user_id", "survey_type", "submitted_at",
        "wellbeing_score", "anxiety_level", "mood_level", "hopes",
        "app_helped", "would_recommend", "most_useful_feature", 
        "improvements", "additional_feedback"
    ]
    
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    
    for r in responses:
        row = {k: r.get(k, "") for k in fieldnames}
        if "submitted_at" in r and r["submitted_at"]:
            row["submitted_at"] = r["submitted_at"].isoformat()
        writer.writerow(row)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=beta_survey_responses_{datetime.now().strftime('%Y%m%d')}.csv"}
    )
