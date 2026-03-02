"""
Learning System Router
Handles AI learning from conversations with admin approval workflow
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/learning", tags=["learning"])

# Will be set by server.py
db = None

def set_db(database):
    global db
    db = database

# ============== MODELS ==============

class SafetyPattern(BaseModel):
    pattern: str
    pattern_type: str  # 'keyword', 'phrase', 'regex'
    category: str  # 'suicide', 'self_harm', 'crisis', 'abuse', etc.
    severity: str  # 'low', 'medium', 'high', 'critical'
    response_action: str  # 'flag', 'escalate', 'block', 'monitor'
    description: Optional[str] = None
    is_active: bool = True

class SafetyPatternUpdate(BaseModel):
    pattern: Optional[str] = None
    pattern_type: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    response_action: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ConversationLearning(BaseModel):
    conversation_id: str
    character_id: str
    category: str  # 'grief', 'anxiety', 'loneliness', 'crisis_deescalation', etc.
    context_summary: str  # Anonymized summary of the situation
    ai_response_pattern: str  # The effective response approach
    outcome: str  # 'positive', 'neutral', 'escalated'
    submitted_by: str  # staff_id who suggested this
    notes: Optional[str] = None

class LearningApproval(BaseModel):
    status: str  # 'approved', 'rejected'
    admin_notes: Optional[str] = None

class ResponseFeedback(BaseModel):
    conversation_id: str
    message_id: str
    character_id: str
    user_message: str
    ai_response: str
    feedback_type: str  # 'good', 'needs_improvement', 'inappropriate', 'missed_risk'
    staff_notes: Optional[str] = None
    suggested_response: Optional[str] = None

# ============== SAFETY PATTERNS ==============

@router.get("/patterns")
async def get_safety_patterns(
    category: Optional[str] = None,
    severity: Optional[str] = None,
    is_active: Optional[bool] = True
):
    """Get all safety patterns with optional filters"""
    query = {}
    if category:
        query["category"] = category
    if severity:
        query["severity"] = severity
    if is_active is not None:
        query["is_active"] = is_active
    
    patterns = await db.safety_patterns.find(query, {"_id": 0}).to_list(1000)
    return {"patterns": patterns, "count": len(patterns)}

@router.post("/patterns")
async def create_safety_pattern(pattern: SafetyPattern, admin_id: str):
    """Create a new safety pattern (admin only)"""
    pattern_dict = pattern.dict()
    pattern_dict["id"] = str(ObjectId())
    pattern_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    pattern_dict["created_by"] = admin_id
    pattern_dict["updated_at"] = None
    pattern_dict["updated_by"] = None
    
    await db.safety_patterns.insert_one(pattern_dict)
    pattern_dict.pop("_id", None)
    
    return {"message": "Pattern created", "pattern": pattern_dict}

@router.put("/patterns/{pattern_id}")
async def update_safety_pattern(pattern_id: str, update: SafetyPatternUpdate, admin_id: str):
    """Update a safety pattern (admin only)"""
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = admin_id
    
    result = await db.safety_patterns.update_one(
        {"id": pattern_id},
        {"$set": update_dict}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Pattern not found")
    
    return {"message": "Pattern updated"}

@router.delete("/patterns/{pattern_id}")
async def delete_safety_pattern(pattern_id: str):
    """Delete a safety pattern (admin only)"""
    result = await db.safety_patterns.delete_one({"id": pattern_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pattern not found")
    
    return {"message": "Pattern deleted"}

# ============== CONVERSATION LEARNINGS ==============

@router.get("/queue")
async def get_approval_queue(status: str = "pending"):
    """Get learnings pending approval"""
    learnings = await db.conversation_learnings.find(
        {"status": status},
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(100)
    
    return {"learnings": learnings, "count": len(learnings)}

@router.post("/submit")
async def submit_learning(learning: ConversationLearning):
    """Staff submits a conversation for learning (goes to approval queue)"""
    learning_dict = learning.dict()
    learning_dict["id"] = str(ObjectId())
    learning_dict["status"] = "pending"
    learning_dict["submitted_at"] = datetime.now(timezone.utc).isoformat()
    learning_dict["reviewed_by"] = None
    learning_dict["reviewed_at"] = None
    learning_dict["admin_notes"] = None
    
    await db.conversation_learnings.insert_one(learning_dict)
    
    return {"message": "Learning submitted for approval", "id": learning_dict["id"]}

@router.put("/approve/{learning_id}")
async def approve_learning(learning_id: str, approval: LearningApproval, admin_id: str):
    """Admin approves or rejects a learning"""
    update = {
        "status": approval.status,
        "reviewed_by": admin_id,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "admin_notes": approval.admin_notes
    }
    
    result = await db.conversation_learnings.update_one(
        {"id": learning_id},
        {"$set": update}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Learning not found")
    
    return {"message": f"Learning {approval.status}"}

@router.get("/approved")
async def get_approved_learnings(category: Optional[str] = None, limit: int = 50):
    """Get approved learnings for context retrieval"""
    query = {"status": "approved"}
    if category:
        query["category"] = category
    
    learnings = await db.conversation_learnings.find(
        query,
        {"_id": 0, "context_summary": 1, "ai_response_pattern": 1, "category": 1, "outcome": 1}
    ).sort("reviewed_at", -1).limit(limit).to_list(limit)
    
    return {"learnings": learnings}

# ============== RESPONSE FEEDBACK ==============

@router.post("/feedback")
async def submit_feedback(feedback: ResponseFeedback, staff_id: str):
    """Staff submits feedback on an AI response"""
    feedback_dict = feedback.dict()
    feedback_dict["id"] = str(ObjectId())
    feedback_dict["staff_id"] = staff_id
    feedback_dict["submitted_at"] = datetime.now(timezone.utc).isoformat()
    feedback_dict["status"] = "pending"
    feedback_dict["reviewed_by"] = None
    feedback_dict["reviewed_at"] = None
    
    await db.response_feedback.insert_one(feedback_dict)
    
    return {"message": "Feedback submitted", "id": feedback_dict["id"]}

@router.get("/feedback")
async def get_feedback(
    status: str = "pending",
    feedback_type: Optional[str] = None,
    limit: int = 50
):
    """Get response feedback for review"""
    query = {"status": status}
    if feedback_type:
        query["feedback_type"] = feedback_type
    
    feedback_list = await db.response_feedback.find(
        query,
        {"_id": 0}
    ).sort("submitted_at", -1).limit(limit).to_list(limit)
    
    return {"feedback": feedback_list, "count": len(feedback_list)}

@router.put("/feedback/{feedback_id}/review")
async def review_feedback(feedback_id: str, status: str, admin_id: str, notes: Optional[str] = None):
    """Admin reviews feedback"""
    update = {
        "status": status,
        "reviewed_by": admin_id,
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    if notes:
        update["admin_notes"] = notes
    
    result = await db.response_feedback.update_one(
        {"id": feedback_id},
        {"$set": update}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    return {"message": "Feedback reviewed"}

# ============== STATISTICS ==============

@router.get("/stats")
async def get_learning_stats():
    """Get statistics for the learning system"""
    stats = {
        "patterns": {
            "total": await db.safety_patterns.count_documents({}),
            "active": await db.safety_patterns.count_documents({"is_active": True}),
            "by_severity": {}
        },
        "learnings": {
            "pending": await db.conversation_learnings.count_documents({"status": "pending"}),
            "approved": await db.conversation_learnings.count_documents({"status": "approved"}),
            "rejected": await db.conversation_learnings.count_documents({"status": "rejected"})
        },
        "feedback": {
            "pending": await db.response_feedback.count_documents({"status": "pending"}),
            "reviewed": await db.response_feedback.count_documents({"status": {"$ne": "pending"}}),
            "by_type": {}
        }
    }
    
    # Get patterns by severity
    for severity in ["low", "medium", "high", "critical"]:
        count = await db.safety_patterns.count_documents({"severity": severity, "is_active": True})
        stats["patterns"]["by_severity"][severity] = count
    
    # Get feedback by type
    for fb_type in ["good", "needs_improvement", "inappropriate", "missed_risk"]:
        count = await db.response_feedback.count_documents({"feedback_type": fb_type})
        stats["feedback"]["by_type"][fb_type] = count
    
    return stats

# ============== SEED DEFAULT PATTERNS ==============

@router.post("/patterns/seed-defaults")
async def seed_default_patterns(admin_id: str):
    """Seed the database with default safety patterns from enhanced_safety_layer.py"""
    
    default_patterns = [
        # Critical - Immediate danger
        {"pattern": "want to die", "pattern_type": "phrase", "category": "suicide", "severity": "critical", "response_action": "escalate"},
        {"pattern": "kill myself", "pattern_type": "phrase", "category": "suicide", "severity": "critical", "response_action": "escalate"},
        {"pattern": "end it all", "pattern_type": "phrase", "category": "suicide", "severity": "critical", "response_action": "escalate"},
        {"pattern": "suicide", "pattern_type": "keyword", "category": "suicide", "severity": "critical", "response_action": "escalate"},
        {"pattern": "don't want to be here", "pattern_type": "phrase", "category": "suicide", "severity": "high", "response_action": "escalate"},
        {"pattern": "no point living", "pattern_type": "phrase", "category": "suicide", "severity": "critical", "response_action": "escalate"},
        {"pattern": "better off dead", "pattern_type": "phrase", "category": "suicide", "severity": "critical", "response_action": "escalate"},
        
        # High - Self harm
        {"pattern": "self harm", "pattern_type": "phrase", "category": "self_harm", "severity": "high", "response_action": "escalate"},
        {"pattern": "cutting myself", "pattern_type": "phrase", "category": "self_harm", "severity": "high", "response_action": "escalate"},
        {"pattern": "hurt myself", "pattern_type": "phrase", "category": "self_harm", "severity": "high", "response_action": "escalate"},
        {"pattern": "harming myself", "pattern_type": "phrase", "category": "self_harm", "severity": "high", "response_action": "escalate"},
        
        # High - Crisis indicators
        {"pattern": "can't go on", "pattern_type": "phrase", "category": "crisis", "severity": "high", "response_action": "escalate"},
        {"pattern": "given up", "pattern_type": "phrase", "category": "crisis", "severity": "high", "response_action": "flag"},
        {"pattern": "no hope", "pattern_type": "phrase", "category": "crisis", "severity": "high", "response_action": "flag"},
        {"pattern": "hopeless", "pattern_type": "keyword", "category": "crisis", "severity": "medium", "response_action": "flag"},
        {"pattern": "worthless", "pattern_type": "keyword", "category": "crisis", "severity": "medium", "response_action": "flag"},
        
        # Medium - Distress signals
        {"pattern": "can't cope", "pattern_type": "phrase", "category": "distress", "severity": "medium", "response_action": "flag"},
        {"pattern": "falling apart", "pattern_type": "phrase", "category": "distress", "severity": "medium", "response_action": "flag"},
        {"pattern": "breaking down", "pattern_type": "phrase", "category": "distress", "severity": "medium", "response_action": "flag"},
        {"pattern": "anxiety attack", "pattern_type": "phrase", "category": "distress", "severity": "medium", "response_action": "flag"},
        {"pattern": "panic attack", "pattern_type": "phrase", "category": "distress", "severity": "medium", "response_action": "flag"},
        
        # Substance abuse
        {"pattern": "drinking too much", "pattern_type": "phrase", "category": "substance", "severity": "medium", "response_action": "flag"},
        {"pattern": "can't stop drinking", "pattern_type": "phrase", "category": "substance", "severity": "high", "response_action": "flag"},
        {"pattern": "overdose", "pattern_type": "keyword", "category": "substance", "severity": "critical", "response_action": "escalate"},
        
        # Abuse/Violence
        {"pattern": "being abused", "pattern_type": "phrase", "category": "abuse", "severity": "high", "response_action": "escalate"},
        {"pattern": "hitting me", "pattern_type": "phrase", "category": "abuse", "severity": "high", "response_action": "escalate"},
        {"pattern": "domestic violence", "pattern_type": "phrase", "category": "abuse", "severity": "high", "response_action": "escalate"},
        
        # PTSD/Trauma
        {"pattern": "flashback", "pattern_type": "keyword", "category": "ptsd", "severity": "medium", "response_action": "flag"},
        {"pattern": "nightmares", "pattern_type": "keyword", "category": "ptsd", "severity": "low", "response_action": "monitor"},
        {"pattern": "can't sleep", "pattern_type": "phrase", "category": "ptsd", "severity": "low", "response_action": "monitor"},
        {"pattern": "triggered", "pattern_type": "keyword", "category": "ptsd", "severity": "medium", "response_action": "flag"},
    ]
    
    created_count = 0
    for pattern_data in default_patterns:
        # Check if pattern already exists
        existing = await db.safety_patterns.find_one({"pattern": pattern_data["pattern"]})
        if not existing:
            pattern_data["id"] = str(ObjectId())
            pattern_data["created_at"] = datetime.now(timezone.utc).isoformat()
            pattern_data["created_by"] = admin_id
            pattern_data["is_active"] = True
            pattern_data["description"] = f"Default {pattern_data['category']} pattern"
            await db.safety_patterns.insert_one(pattern_data)
            created_count += 1
    
    return {"message": f"Seeded {created_count} new patterns", "total_patterns": len(default_patterns)}
