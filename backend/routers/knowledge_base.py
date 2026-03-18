"""
Knowledge Base Router - RAG (Retrieval Augmented Generation) system for AI characters
Enables AI characters to answer questions accurately using a curated knowledge base
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import uuid
from datetime import datetime
import logging
import re

from services.database import get_database
from pydantic import BaseModel

router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])
logger = logging.getLogger(__name__)


# Import auth dependency - will be set by main server
_require_admin = None

def set_auth_dependency(require_admin_func):
    """Set the admin authentication dependency from main server"""
    global _require_admin
    _require_admin = require_admin_func

def require_admin_auth():
    """Get the admin dependency - must be called inside route handler"""
    if _require_admin is None:
        raise HTTPException(status_code=500, detail="Auth not configured")
    return _require_admin


class KnowledgeEntry(BaseModel):
    title: str
    content: str
    category: str  # benefits, mental_health, housing, employment, legal, relationships, general
    tags: List[str] = []
    source: str = ""
    source_url: str = ""
    is_verified: bool = False
    applicable_regions: List[str] = ["UK"]  # For region-specific info


class KnowledgeQuery(BaseModel):
    query: str
    categories: List[str] = []
    limit: int = 5


# Pre-defined categories for veteran knowledge
KNOWLEDGE_CATEGORIES = {
    "benefits": "Benefits, pensions, and financial support",
    "mental_health": "Mental health resources and coping strategies",
    "housing": "Housing support and homelessness prevention",
    "employment": "Employment, training, and career transitions",
    "legal": "Legal rights and advocacy",
    "relationships": "Family, relationships, and social support",
    "health": "Physical health and NHS services for veterans",
    "social": "Social activities, community groups, and events",
    "crisis": "Crisis support and emergency resources",
    "general": "General veteran information and FAQs"
}


# ==================================
# Knowledge Entry Management
# ==================================

@router.post("/entries")
async def create_knowledge_entry(entry: KnowledgeEntry):
    """Add a new entry to the knowledge base"""
    db = get_database()
    
    entry_data = entry.dict()
    entry_data["id"] = str(uuid.uuid4())
    entry_data["created_at"] = datetime.utcnow()
    entry_data["updated_at"] = datetime.utcnow()
    entry_data["search_text"] = f"{entry.title} {entry.content} {' '.join(entry.tags)}".lower()
    
    await db.knowledge_base.insert_one(entry_data)
    
    return {
        "id": entry_data["id"],
        "message": "Knowledge entry created successfully"
    }


@router.get("/entries")
async def list_knowledge_entries(category: Optional[str] = None, verified_only: bool = False):
    """List all knowledge entries, optionally filtered"""
    db = get_database()
    
    query = {}
    if category:
        query["category"] = category
    if verified_only:
        query["is_verified"] = True
    
    entries = await db.knowledge_base.find(query).sort("title", 1).to_list(500)
    
    return [{
        "id": e["id"],
        "title": e["title"],
        "category": e["category"],
        "tags": e.get("tags", []),
        "is_verified": e.get("is_verified", False),
        "created_at": e["created_at"].isoformat()
    } for e in entries]


@router.get("/entries/{entry_id}")
async def get_knowledge_entry(entry_id: str):
    """Get a specific knowledge entry"""
    db = get_database()
    
    entry = await db.knowledge_base.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    entry["id"] = str(entry.get("_id", entry.get("id", "")))
    if "_id" in entry:
        del entry["_id"]
    if "search_text" in entry:
        del entry["search_text"]
    
    return entry


@router.put("/entries/{entry_id}")
async def update_knowledge_entry(entry_id: str, entry: KnowledgeEntry):
    """Update an existing knowledge entry"""
    db = get_database()
    
    update_data = entry.dict()
    update_data["updated_at"] = datetime.utcnow()
    update_data["search_text"] = f"{entry.title} {entry.content} {' '.join(entry.tags)}".lower()
    
    result = await db.knowledge_base.update_one(
        {"id": entry_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"message": "Entry updated successfully"}


@router.delete("/entries/{entry_id}")
async def delete_knowledge_entry(entry_id: str):
    """Delete a knowledge entry"""
    db = get_database()
    
    result = await db.knowledge_base.delete_one({"id": entry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"message": "Entry deleted"}


@router.patch("/entries/{entry_id}/verify")
async def verify_knowledge_entry(entry_id: str, is_verified: bool = True, verified_by: str = ""):
    """Mark an entry as verified/unverified"""
    db = get_database()
    
    result = await db.knowledge_base.update_one(
        {"id": entry_id},
        {"$set": {
            "is_verified": is_verified,
            "verified_by": verified_by,
            "verified_at": datetime.utcnow() if is_verified else None
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"message": f"Entry {'verified' if is_verified else 'unverified'}"}


# ==================================
# Knowledge Retrieval (RAG)
# ==================================

@router.post("/search")
async def search_knowledge_base(query: KnowledgeQuery):
    """
    Search the knowledge base for relevant information.
    This is the main RAG retrieval endpoint used by AI characters.
    """
    db = get_database()
    
    # Build search query
    search_terms = query.query.lower().split()
    
    # Create regex pattern for flexible matching
    regex_patterns = [{"search_text": {"$regex": term, "$options": "i"}} for term in search_terms if len(term) > 2]
    
    mongo_query = {}
    if regex_patterns:
        mongo_query["$or"] = regex_patterns
    if query.categories:
        mongo_query["category"] = {"$in": query.categories}
    
    # Prefer verified entries
    entries = await db.knowledge_base.find(mongo_query).sort("is_verified", -1).to_list(query.limit * 2)
    
    # Score results by relevance
    scored_entries = []
    for entry in entries:
        score = 0
        search_text = entry.get("search_text", "")
        
        # Score based on term matches
        for term in search_terms:
            if term in search_text:
                score += 1
            if term in entry.get("title", "").lower():
                score += 2  # Title matches worth more
            if term in entry.get("tags", []):
                score += 1.5
        
        # Verified entries get bonus
        if entry.get("is_verified"):
            score *= 1.2
        
        scored_entries.append((entry, score))
    
    # Sort by score and take top results
    scored_entries.sort(key=lambda x: x[1], reverse=True)
    top_entries = scored_entries[:query.limit]
    
    return {
        "query": query.query,
        "results": [{
            "id": e[0]["id"],
            "title": e[0]["title"],
            "content": e[0]["content"],
            "category": e[0]["category"],
            "tags": e[0].get("tags", []),
            "source": e[0].get("source", ""),
            "is_verified": e[0].get("is_verified", False),
            "relevance_score": e[1]
        } for e in top_entries],
        "total_found": len(scored_entries)
    }


@router.get("/context/{query}")
async def get_context_for_ai(query: str, categories: str = "", limit: int = 3):
    """
    Get context from knowledge base for AI character responses.
    Returns formatted context that can be injected into AI prompts.
    """
    db = get_database()
    
    # Parse categories if provided
    cat_list = [c.strip() for c in categories.split(",")] if categories else []
    
    # Search for relevant entries
    search_result = await search_knowledge_base(
        KnowledgeQuery(query=query, categories=cat_list, limit=limit)
    )
    
    # Format context for AI
    context_parts = []
    for result in search_result["results"]:
        if result["relevance_score"] > 0:
            context_parts.append(f"**{result['title']}**: {result['content']}")
    
    return {
        "query": query,
        "context": "\n\n".join(context_parts) if context_parts else "",
        "has_relevant_info": len(context_parts) > 0,
        "sources": [r["title"] for r in search_result["results"] if r["relevance_score"] > 0]
    }


# ==================================
# Category & Statistics
# ==================================

@router.get("/categories")
async def get_categories():
    """Get list of knowledge categories with descriptions"""
    return {"categories": KNOWLEDGE_CATEGORIES}


@router.get("/stats")
async def get_knowledge_stats():
    """Get statistics about the knowledge base"""
    db = get_database()
    
    total = await db.knowledge_base.count_documents({})
    verified = await db.knowledge_base.count_documents({"is_verified": True})
    
    # Count by category
    categories = {}
    for cat in KNOWLEDGE_CATEGORIES.keys():
        count = await db.knowledge_base.count_documents({"category": cat})
        categories[cat] = count
    
    return {
        "total_entries": total,
        "verified_entries": verified,
        "by_category": categories
    }


# ==================================
# Seed Default Knowledge (ADMIN ONLY)
# ==================================

@router.post("/seed")
async def seed_knowledge_base():
    """
    Seed the knowledge base with default veteran support information.
    
    SECURITY: This endpoint is DISABLED for public access.
    To seed the knowledge base, use the admin portal or direct database access.
    """
    # This endpoint is intentionally disabled for security
    # Knowledge base modifications should only happen via authenticated admin actions
    raise HTTPException(
        status_code=403, 
        detail="This endpoint is disabled for security. Use the admin portal to manage knowledge base."
    )
    
    db = get_database()
    
    # Log the action for audit
    logger.warning(f"AUDIT: Knowledge base seed initiated")
    
    # Check if already seeded
    existing = await db.knowledge_base.count_documents({})
    if existing > 0:
        return {"message": f"Knowledge base already has {existing} entries"}
    
    default_entries = [
        # Benefits
        {
            "title": "War Pension Scheme",
            "content": "The War Pension Scheme provides compensation for illness or injury caused by service before 6 April 2005. Contact the Veterans UK helpline on 0808 1914 218 for eligibility information.",
            "category": "benefits",
            "tags": ["pension", "compensation", "veterans-uk"],
            "source": "GOV.UK",
            "is_verified": True
        },
        {
            "title": "Armed Forces Compensation Scheme",
            "content": "AFCS provides compensation for injury or illness caused by service on or after 6 April 2005. Claims can be made through Veterans UK.",
            "category": "benefits",
            "tags": ["compensation", "injury", "afcs"],
            "source": "GOV.UK",
            "is_verified": True
        },
        {
            "title": "Veterans Railcard",
            "content": "Veterans can get 1/3 off rail fares with a Veterans Railcard. Costs £21 per year. Available to all who have served one day in the Armed Forces.",
            "category": "benefits",
            "tags": ["travel", "discount", "railcard"],
            "source": "HM Forces Railcard",
            "is_verified": True
        },
        # Mental Health
        {
            "title": "Combat Stress Helpline",
            "content": "Combat Stress provides mental health support for veterans. Their 24-hour helpline is 0800 138 1619. They offer residential treatment programmes and community outreach.",
            "category": "mental_health",
            "tags": ["crisis", "ptsd", "helpline", "combat-stress"],
            "source": "Combat Stress",
            "is_verified": True
        },
        {
            "title": "Op COURAGE NHS Service",
            "content": "Op COURAGE is the NHS mental health service for veterans. Get referred through your GP or self-refer. Provides specialist treatment for PTSD, depression, anxiety, and substance misuse.",
            "category": "mental_health",
            "tags": ["nhs", "treatment", "ptsd", "op-courage"],
            "source": "NHS",
            "is_verified": True
        },
        {
            "title": "Grounding Techniques for Flashbacks",
            "content": "During a flashback, try the 5-4-3-2-1 technique: Name 5 things you can see, 4 things you can touch, 3 things you can hear, 2 things you can smell, 1 thing you can taste. This helps bring you back to the present.",
            "category": "mental_health",
            "tags": ["coping", "flashback", "grounding", "technique"],
            "source": "Clinical Practice",
            "is_verified": True
        },
        # Housing
        {
            "title": "SSAFA Housing Assistance",
            "content": "SSAFA can help veterans with housing issues including homelessness prevention, rent deposits, and emergency accommodation. Call 0800 260 6767.",
            "category": "housing",
            "tags": ["ssafa", "homelessness", "emergency"],
            "source": "SSAFA",
            "is_verified": True
        },
        {
            "title": "Veterans Priority Housing",
            "content": "Veterans are given priority for social housing under the Armed Forces Covenant. Contact your local council's housing department and mention your veteran status.",
            "category": "housing",
            "tags": ["social-housing", "priority", "covenant"],
            "source": "Armed Forces Covenant",
            "is_verified": True
        },
        # Employment
        {
            "title": "Career Transition Partnership (CTP)",
            "content": "CTP helps service leavers transition to civilian employment. Offers CV writing, interview skills, and job matching. Access available up to 2 years before discharge.",
            "category": "employment",
            "tags": ["transition", "jobs", "cv", "ctp"],
            "source": "CTP",
            "is_verified": True
        },
        {
            "title": "Veterans Interview Guarantee",
            "content": "Many employers guarantee interviews for veterans who meet minimum criteria. Look for employers who have signed the Armed Forces Covenant.",
            "category": "employment",
            "tags": ["interview", "jobs", "covenant"],
            "source": "Armed Forces Covenant",
            "is_verified": True
        },
        # Crisis
        {
            "title": "Veterans Crisis Support",
            "content": "If you're a veteran in crisis, contact the Samaritans on 116 123 (24/7), Combat Stress helpline on 0800 138 1619, or in immediate danger call 999.",
            "category": "crisis",
            "tags": ["emergency", "helpline", "samaritans"],
            "source": "Multiple sources",
            "is_verified": True
        }
    ]
    
    for entry in default_entries:
        entry["id"] = str(uuid.uuid4())
        entry["created_at"] = datetime.utcnow()
        entry["updated_at"] = datetime.utcnow()
        entry["search_text"] = f"{entry['title']} {entry['content']} {' '.join(entry.get('tags', []))}".lower()
        entry["applicable_regions"] = ["UK"]
    
    await db.knowledge_base.insert_many(default_entries)
    
    return {"message": f"Seeded {len(default_entries)} knowledge entries"}
