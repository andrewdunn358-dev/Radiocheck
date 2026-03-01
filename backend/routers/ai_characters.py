"""
AI Characters CMS Router
Manages AI persona definitions stored in database
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid
import logging
import os
import base64

router = APIRouter(prefix="/ai-characters", tags=["AI Characters CMS"])
security = HTTPBearer()

# Will be set by main server
db = None
get_current_user = None
AI_CHARACTERS_FALLBACK = None

# Directory for storing uploaded avatars
AVATAR_UPLOAD_DIR = "/app/backend/static/avatars"

def set_dependencies(database, current_user_func, fallback_characters):
    """Set database and auth dependencies from main server"""
    global db, get_current_user, AI_CHARACTERS_FALLBACK
    db = database
    get_current_user = current_user_func
    AI_CHARACTERS_FALLBACK = fallback_characters
    
    # Ensure avatar upload directory exists
    os.makedirs(AVATAR_UPLOAD_DIR, exist_ok=True)


# ============================================================================
# MODELS
# ============================================================================

class AICharacterCreate(BaseModel):
    """Request to create a new AI character"""
    id: str = Field(..., description="Unique character ID (lowercase, no spaces)")
    name: str = Field(..., description="Display name")
    description: str = Field(..., description="Short description shown in character list")
    bio: Optional[str] = Field(None, description="Longer biography for character detail view")
    prompt: str = Field(..., description="System prompt that defines the character's personality")
    avatar: Optional[str] = Field(None, description="Avatar image URL")
    is_enabled: bool = Field(True, description="Whether character is available to users")
    category: Optional[str] = Field("general", description="Category: general, family, addiction, legal, etc.")
    order: int = Field(0, description="Display order in character list")


class AICharacterUpdate(BaseModel):
    """Request to update an AI character"""
    name: Optional[str] = None
    description: Optional[str] = None
    bio: Optional[str] = None
    prompt: Optional[str] = None
    avatar: Optional[str] = None
    is_enabled: Optional[bool] = None
    category: Optional[str] = None
    order: Optional[int] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify user is admin"""
    user = await get_current_user(credentials)
    if hasattr(user, 'dict'):
        user = user.dict() if callable(user.dict) else dict(user)
    elif hasattr(user, '__dict__'):
        user = vars(user)
    
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ============================================================================
# PUBLIC ENDPOINTS (No Auth)
# ============================================================================

@router.get("")
async def get_all_characters():
    """Get all AI characters (public endpoint for app)"""
    try:
        # Try database first
        characters = await db.ai_characters.find(
            {"is_enabled": True},
            {"_id": 0, "prompt": 0}  # Don't expose prompts publicly
        ).sort("order", 1).to_list(50)
        
        if characters:
            return {"characters": characters, "source": "database"}
        
        # Fallback to hardcoded
        fallback_chars = []
        for char_id, char_data in AI_CHARACTERS_FALLBACK.items():
            fallback_chars.append({
                "id": char_id,
                "name": char_data["name"],
                "description": get_character_description(char_id),
                "avatar": char_data["avatar"],
                "is_enabled": True
            })
        
        return {"characters": fallback_chars, "source": "fallback"}
    except Exception as e:
        logging.error(f"Error fetching characters: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch characters")


@router.get("/{character_id}")
async def get_character(character_id: str):
    """Get single character details (public - no prompt)"""
    try:
        character = await db.ai_characters.find_one(
            {"id": character_id},
            {"_id": 0, "prompt": 0}
        )
        
        if character:
            return character
        
        # Fallback
        if character_id in AI_CHARACTERS_FALLBACK:
            char_data = AI_CHARACTERS_FALLBACK[character_id]
            return {
                "id": character_id,
                "name": char_data["name"],
                "description": get_character_description(character_id),
                "avatar": char_data["avatar"],
                "is_enabled": True
            }
        
        raise HTTPException(status_code=404, detail="Character not found")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching character: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch character")


# ============================================================================
# ADMIN ENDPOINTS (Auth Required)
# ============================================================================

@router.get("/admin/all")
async def get_all_characters_admin(user: dict = Depends(require_admin)):
    """Get all AI characters with full details including prompts (admin only)"""
    try:
        characters = await db.ai_characters.find({}, {"_id": 0}).sort("order", 1).to_list(50)
        
        # If no DB characters, return fallback with prompts
        if not characters:
            fallback_chars = []
            for char_id, char_data in AI_CHARACTERS_FALLBACK.items():
                fallback_chars.append({
                    "id": char_id,
                    "name": char_data["name"],
                    "description": get_character_description(char_id),
                    "prompt": char_data["prompt"][:500] + "..." if len(char_data["prompt"]) > 500 else char_data["prompt"],
                    "avatar": char_data["avatar"],
                    "is_enabled": True,
                    "is_hardcoded": True  # Flag to indicate this is from code
                })
            return {"characters": fallback_chars, "source": "fallback", "hint": "These are hardcoded. Create new characters to override."}
        
        return {"characters": characters, "source": "database"}
    except Exception as e:
        logging.error(f"Error fetching admin characters: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch characters")


@router.get("/admin/{character_id}")
async def get_character_admin(character_id: str, user: dict = Depends(require_admin)):
    """Get full character details including prompt (admin only)"""
    try:
        character = await db.ai_characters.find_one({"id": character_id}, {"_id": 0})
        
        if character:
            return character
        
        # Fallback with full prompt
        if character_id in AI_CHARACTERS_FALLBACK:
            char_data = AI_CHARACTERS_FALLBACK[character_id]
            return {
                "id": character_id,
                "name": char_data["name"],
                "description": get_character_description(character_id),
                "prompt": char_data["prompt"],
                "avatar": char_data["avatar"],
                "is_enabled": True,
                "is_hardcoded": True
            }
        
        raise HTTPException(status_code=404, detail="Character not found")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching character: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch character")


@router.post("")
async def create_character(request: AICharacterCreate, user: dict = Depends(require_admin)):
    """Create a new AI character (admin only)"""
    try:
        # Check if ID already exists
        existing = await db.ai_characters.find_one({"id": request.id})
        if existing:
            raise HTTPException(status_code=400, detail=f"Character ID '{request.id}' already exists")
        
        character_data = request.dict()
        character_data["created_at"] = datetime.now(timezone.utc)
        character_data["updated_at"] = datetime.now(timezone.utc)
        character_data["created_by"] = user.get("id") or user.get("user_id")
        
        await db.ai_characters.insert_one(character_data)
        
        # Return without _id
        character_data.pop("_id", None)
        return {"message": "Character created", "character": character_data}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating character: {e}")
        raise HTTPException(status_code=500, detail="Failed to create character")


@router.put("/{character_id}")
async def update_character(character_id: str, request: AICharacterUpdate, user: dict = Depends(require_admin)):
    """Update an AI character (admin only)"""
    try:
        # Build update dict with only provided fields
        update_data = {k: v for k, v in request.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_data["updated_at"] = datetime.now(timezone.utc)
        update_data["updated_by"] = user.get("id") or user.get("user_id")
        
        # Check if character exists in DB
        existing = await db.ai_characters.find_one({"id": character_id})
        
        if existing:
            # Update existing
            await db.ai_characters.update_one({"id": character_id}, {"$set": update_data})
            return {"message": "Character updated"}
        else:
            # If it's a hardcoded character, create a DB override
            if character_id in AI_CHARACTERS_FALLBACK:
                # Create DB entry with hardcoded values + updates
                char_data = AI_CHARACTERS_FALLBACK[character_id]
                new_char = {
                    "id": character_id,
                    "name": char_data["name"],
                    "description": get_character_description(character_id),
                    "prompt": char_data["prompt"],
                    "avatar": char_data["avatar"],
                    "is_enabled": True,
                    "created_at": datetime.now(timezone.utc),
                    "created_by": user.get("id") or user.get("user_id"),
                    **update_data
                }
                await db.ai_characters.insert_one(new_char)
                return {"message": "Character override created in database"}
            else:
                raise HTTPException(status_code=404, detail="Character not found")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating character: {e}")
        raise HTTPException(status_code=500, detail="Failed to update character")


@router.delete("/{character_id}")
async def delete_character(character_id: str, user: dict = Depends(require_admin)):
    """Delete an AI character (admin only) - only works for DB characters"""
    try:
        result = await db.ai_characters.delete_one({"id": character_id})
        
        if result.deleted_count == 0:
            if character_id in AI_CHARACTERS_FALLBACK:
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot delete hardcoded character. Disable it instead by setting is_enabled=false."
                )
            raise HTTPException(status_code=404, detail="Character not found")
        
        return {"message": "Character deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting character: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete character")


@router.post("/upload-avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    """Upload an avatar image for AI characters (admin only)"""
    try:
        # Validate file type
        allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: PNG, JPEG, WebP, GIF"
            )
        
        # Validate file size (max 2MB)
        content = await file.read()
        if len(content) > 2 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 2MB")
        
        # Generate unique filename
        ext = file.filename.split(".")[-1] if "." in file.filename else "png"
        unique_id = str(uuid.uuid4())[:8]
        filename = f"avatar_{unique_id}.{ext}"
        filepath = os.path.join(AVATAR_UPLOAD_DIR, filename)
        
        # Save file
        with open(filepath, "wb") as f:
            f.write(content)
        
        # Return the URL path (will be served from /static/avatars/)
        avatar_url = f"/static/avatars/{filename}"
        
        return {
            "message": "Avatar uploaded successfully",
            "avatar_url": avatar_url,
            "filename": filename
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading avatar: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload avatar")


@router.post("/seed-from-hardcoded")
async def seed_characters_from_hardcoded(user: dict = Depends(require_admin)):
    """Seed database with all hardcoded characters (admin only)"""
    try:
        seeded = 0
        skipped = 0
        
        for char_id, char_data in AI_CHARACTERS_FALLBACK.items():
            # Check if already in DB
            existing = await db.ai_characters.find_one({"id": char_id})
            if existing:
                skipped += 1
                continue
            
            new_char = {
                "id": char_id,
                "name": char_data["name"],
                "description": get_character_description(char_id),
                "bio": get_character_bio(char_id),
                "prompt": char_data["prompt"],
                "avatar": char_data["avatar"],
                "is_enabled": True,
                "category": get_character_category(char_id),
                "order": get_character_order(char_id),
                "created_at": datetime.now(timezone.utc),
                "created_by": user.get("id") or user.get("user_id")
            }
            await db.ai_characters.insert_one(new_char)
            seeded += 1
        
        return {
            "message": f"Seeded {seeded} characters, skipped {skipped} existing",
            "seeded": seeded,
            "skipped": skipped
        }
    except Exception as e:
        logging.error(f"Error seeding characters: {e}")
        raise HTTPException(status_code=500, detail="Failed to seed characters")


# ============================================================================
# HELPER DATA
# ============================================================================

def get_character_description(char_id: str) -> str:
    """Get description for hardcoded character"""
    descriptions = {
        "tommy": "A warm, steady presence - like a reliable mate who's been through it.",
        "doris": "A nurturing, compassionate presence who creates a safe space to talk.",
        "bob": "A down-to-earth mate who keeps things real and offers honest support.",
        "sentry": "Knowledgeable companion with expertise in UK military law.",
        "hugo": "Your guide to UK veteran support systems - housing, jobs, benefits, legal help.",
        "margie": "A wise, understanding presence with warmth and years of experience in addiction support.",
        "rita": "A warm, grounded family-support companion for partners, spouses and loved ones.",
        "catherine": "Calm, composed, and grounded support. Helps you think clearly when emotions run high."
    }
    return descriptions.get(char_id, "AI companion")


def get_character_bio(char_id: str) -> str:
    """Get bio for hardcoded character"""
    bios = {
        "tommy": "Tommy is your straightforward battle buddy. A no-nonsense mate who tells it like it is, but always has your back.",
        "doris": "Doris is a nurturing, compassionate presence who creates a safe space to talk. Think of her as a warm cuppa on a difficult day.",
        "bob": "Bob is a down-to-earth ex-Para who keeps things real. He's been around the block and knows what it's like.",
        "sentry": "Finch is a knowledgeable companion with expertise in UK military law. He provides steady support and practical guidance.",
        "hugo": "Hugo is a 35-year-old wellbeing coach focused on mental health, resilience and daily habits.",
        "margie": "Margie specialises in supporting those dealing with all types of addiction. She brings warmth and years of experience.",
        "rita": "Rita is a warm, grounded family-support companion. Her son served, and she understands what families go through.",
        "catherine": "Catherine is composed, articulate, and grounded. She helps you think clearly when emotions run high."
    }
    return bios.get(char_id, "")


def get_character_category(char_id: str) -> str:
    """Get category for hardcoded character"""
    categories = {
        "tommy": "general",
        "doris": "general",
        "bob": "general",
        "sentry": "legal",
        "hugo": "wellbeing",
        "margie": "addiction",
        "rita": "family",
        "catherine": "wellbeing"
    }
    return categories.get(char_id, "general")


def get_character_order(char_id: str) -> int:
    """Get display order for hardcoded character"""
    orders = {
        "tommy": 1,
        "doris": 2,
        "bob": 3,
        "sentry": 4,
        "hugo": 5,
        "margie": 6,
        "rita": 7,
        "catherine": 8
    }
    return orders.get(char_id, 99)
