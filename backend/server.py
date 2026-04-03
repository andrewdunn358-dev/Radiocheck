from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hashlib
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
import secrets
import resend
import asyncio
from openai import OpenAI
import httpx  # For IP geolocation lookup
from collections import defaultdict
import time

# Google Gemini for fallback AI
from google import genai
from google.genai import types

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import encryption utilities AFTER loading .env
from encryption import encrypt_field, decrypt_field, encrypt_document, decrypt_document, ENCRYPTED_FIELDS

# Import enhanced safety monitor from Zentrafuge Veteran AI Safety Layer
from safety import (
    EnhancedSafetyMonitor,
    assess_message_safety,
    format_crisis_message,
    get_veteran_helplines,
    get_emergency_number,
)

# Import enhanced safety layer (wraps around personas, doesn't replace them)
from enhanced_safety_layer import (
    analyze_message_safety as legacy_analyze_message_safety,
    get_session_safety_summary,
    get_user_safety_summary,
    get_safety_audit_log,
    export_safety_audit_log,
    check_age_for_features,
    RiskLevel,
)

# Import the new UNIFIED safety system with conversation trajectory analysis
from safety.unified_safety import (
    analyze_message_unified,
    end_safety_session,
    get_session_safety_status,
    get_safety_audit_report,
    get_safety_system_status,
    initialize_safety_system,
)

# Import governance router for clinical safety & compliance
from governance_router import governance_router, set_db as set_governance_db
from case_router import case_router, set_dependencies as set_case_dependencies
from routers.ai_characters import router as ai_characters_router, set_dependencies as set_ai_char_dependencies
from routers.learning_system import router as learning_router, set_db as set_learning_db
from routers.lms import router as lms_router

# Import modular personas package for AI character prompts
# Soul Document provides behavioral consistency across all personas
from personas import AI_CHARACTERS as MODULAR_AI_CHARACTERS, get_full_prompt
from personas.soul_loader import get_soul_injection

# Import AI usage tracker for cost monitoring
from ai_usage_tracker import (
    count_openai_tokens, 
    estimate_gemini_tokens, 
    calculate_cost, 
    log_ai_usage,
    get_usage_summary,
    get_daily_usage,
    get_usage_by_character
)

# Import audit logging system
from audit_logger import (
    log_audit_event,
    get_audit_logs,
    get_audit_summary,
    audit_login,
    audit_safeguarding_alert,
    audit_data_export,
    audit_admin_action,
    AuditEventType
)

# ============ RATE LIMITING & BOT PROTECTION ============

# Rate limit configuration
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "20"))  # Max requests per window
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # Window in seconds
RATE_LIMIT_BURST = int(os.getenv("RATE_LIMIT_BURST", "5"))  # Max burst requests
SESSION_RATE_LIMIT = int(os.getenv("SESSION_RATE_LIMIT", "50"))  # Max messages per session

# In-memory rate limiting stores
ip_request_counts: Dict[str, List[float]] = defaultdict(list)
session_message_counts: Dict[str, int] = defaultdict(int)
blocked_ips: Dict[str, float] = {}  # IP -> block expiry time

def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def is_ip_blocked(ip: str) -> bool:
    """Check if IP is temporarily blocked"""
    if ip in blocked_ips:
        if time.time() < blocked_ips[ip]:
            return True
        else:
            del blocked_ips[ip]
    return False

def block_ip(ip: str, duration_seconds: int = 300):
    """Block an IP for specified duration (default 5 minutes)"""
    blocked_ips[ip] = time.time() + duration_seconds
    logging.warning(f"RATE LIMIT: Blocked IP {ip} for {duration_seconds}s")

def check_rate_limit(ip: str) -> tuple[bool, str]:
    """
    Check if request should be rate limited
    Returns: (is_allowed, reason)
    """
    # Exempt localhost/loopback from rate limiting (internal requests, test suites)
    if ip in ("127.0.0.1", "localhost", "::1"):
        return True, "OK"
    
    now = time.time()
    
    # Check if IP is blocked
    if is_ip_blocked(ip):
        return False, "Too many requests. Please wait a few minutes."
    
    # Clean old requests outside window
    ip_request_counts[ip] = [t for t in ip_request_counts[ip] if now - t < RATE_LIMIT_WINDOW]
    
    # Check burst limit (requests in last 5 seconds)
    recent_requests = [t for t in ip_request_counts[ip] if now - t < 5]
    if len(recent_requests) >= RATE_LIMIT_BURST:
        block_ip(ip, 60)  # Block for 1 minute on burst
        return False, "Slow down. Too many requests too quickly."
    
    # Check window limit
    if len(ip_request_counts[ip]) >= RATE_LIMIT_REQUESTS:
        block_ip(ip, 300)  # Block for 5 minutes
        return False, "Rate limit exceeded. Please try again later."
    
    # Record this request
    ip_request_counts[ip].append(now)
    return True, "OK"

def check_session_limit(session_id: str) -> tuple[bool, str]:
    """
    Check if session has exceeded message limit
    Prevents single session from burning through API credits
    """
    session_message_counts[session_id] += 1
    
    if session_message_counts[session_id] > SESSION_RATE_LIMIT:
        return False, "Session limit reached. Please start a new conversation."
    
    return True, "OK"

def cleanup_rate_limits():
    """Periodic cleanup of old rate limit data"""
    now = time.time()
    
    # Clean IP counts older than 2x window
    for ip in list(ip_request_counts.keys()):
        ip_request_counts[ip] = [t for t in ip_request_counts[ip] if now - t < RATE_LIMIT_WINDOW * 2]
        if not ip_request_counts[ip]:
            del ip_request_counts[ip]
    
    # Clean expired blocks
    for ip in list(blocked_ips.keys()):
        if now >= blocked_ips[ip]:
            del blocked_ips[ip]

# ============ JWT CONFIGURATION ============

# JWT Configuration - Use function to read at runtime
def get_jwt_secret():
    """Get JWT secret at runtime to ensure env vars are loaded"""
    return os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Emergent LLM Key (for local development) or OpenAI key (for production)
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Configure Gemini client for fallback
gemini_client = None
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# AI Battle Buddies Kill Switch - set AI_BUDDIES_DISABLED=true in env to disable
AI_BUDDIES_DISABLED = os.getenv("AI_BUDDIES_DISABLED", "false").lower() == "true"


# ============================================================================
# AI CHARACTER PROMPTS - NOW LOADED FROM MODULAR PERSONAS PACKAGE
# ============================================================================
# All character prompts have been moved to /backend/personas/ directory.
# Each character has its own file (tommy.py, rachel.py, etc.)
# The Soul Document (soul.md) provides behavioral consistency across all personas.
# To add a new character, create a new file in personas/ and add to __init__.py
# ============================================================================

# ============================================================================
# AI CHARACTER CONFIGURATIONS - LOADED FROM MODULAR PERSONAS
# ============================================================================
# Character prompts are now loaded from /backend/personas/ directory
# Each character has its own file (tommy.py, rachel.py, etc.)
# The Soul Document (soul.md) provides behavioral consistency across all personas
# See personas/__init__.py for the loader implementation
#
# To add a new character:
# 1. Create a new file in /backend/personas/ (e.g., newchar.py)
# 2. Define PERSONA dict with id, name, avatar, role, accent_color, prompt
# 3. Import and add to the list in personas/__init__.py
# ============================================================================

AVATAR_BASE_URL = os.environ.get('AVATAR_BASE_URL', '/images')

# AI_CHARACTERS is now loaded from the modular personas package
# The MODULAR_AI_CHARACTERS already contains properly formatted character configs
# We just need to ensure avatar URLs use the same base URL pattern
AI_CHARACTERS = {}
for char_id, char_config in MODULAR_AI_CHARACTERS.items():
    # Extract just the filename from the avatar path
    avatar_filename = char_config.get("avatar", "").split("/")[-1]
    if not avatar_filename:
        avatar_filename = f"{char_id}.png"
    
    AI_CHARACTERS[char_id] = {
        "name": char_config["name"],
        "prompt": char_config["prompt"],
        "avatar": f"{AVATAR_BASE_URL}/{avatar_filename}",
        "role": char_config.get("role", "Support"),
        "accent_color": char_config.get("accent_color", "#3b82f6"),
    }

# ============================================================================
# UNIVERSAL SAFEGUARDING ADDENDUM - ADDED TO ALL AI CHARACTER PROMPTS
# This has HIGHEST PRIORITY and overrides all other AI behavior
# ============================================================================
# MongoDB connection with SSL fix for Atlas
import ssl
import certifi

mongo_url = os.environ['MONGO_URL']

# Only apply SSL settings for MongoDB Atlas (remote) connections
if 'mongodb+srv' in mongo_url or 'mongodb.net' in mongo_url:
    client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=10000,
        tlsCAFile=certifi.where()
    )
else:
    # Local MongoDB without SSL
    client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=10000
    )
db = client[os.environ.get('DB_NAME', 'veterans_support')]

# Create the main app
app = FastAPI(redirect_slashes=True)
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============ MODELS ============

# Auth Models
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = Field(..., pattern="^(admin|supervisor|counsellor|peer)$")
    name: str
    # Optional profile fields - for counsellors/peers
    phone: Optional[str] = None
    specialization: Optional[str] = None  # For counsellors
    area: Optional[str] = None  # For peers
    background: Optional[str] = None  # For peers
    yearsServed: Optional[str] = None  # For peers
    sms: Optional[str] = None
    whatsapp: Optional[str] = None

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    role: str
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

# =============================================================================
# UNIFIED STAFF MODEL (New - replaces separate counsellors/peer_supporters)
# =============================================================================
# NOTE: This is the new unified model. The old Counsellor and PeerSupporter 
# models below are DEPRECATED and will be removed after full migration.
# All new code should use the Staff model.
# =============================================================================

class StaffCreate(BaseModel):
    """Create a new staff member - unified model for all staff types"""
    email: EmailStr
    password: str
    role: str = Field(..., pattern="^(admin|supervisor|counsellor|peer)$")
    name: str
    # Contact info
    phone: Optional[str] = None
    sms: Optional[str] = None
    whatsapp: Optional[str] = None
    # Role-specific fields
    specialization: Optional[str] = None  # For counsellors/supervisors
    area: Optional[str] = None  # For peers - service area
    background: Optional[str] = None  # For peers - military background
    years_served: Optional[str] = None  # For peers
    # SIP/calling
    sip_extension: Optional[str] = None
    sip_password: Optional[str] = None
    # Permissions
    is_supervisor: bool = False

class Staff(BaseModel):
    """Unified staff model - single source of truth for all staff members"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str  # Stored hashed
    role: str  # admin, supervisor, counsellor, peer
    name: str
    # Status
    status: str = "unavailable"  # available, limited, unavailable, busy, off
    next_available: Optional[str] = None
    # Contact info
    phone: Optional[str] = None
    sms: Optional[str] = None
    whatsapp: Optional[str] = None
    # Role-specific fields (all optional, used based on role)
    specialization: Optional[str] = None  # For counsellors/supervisors
    area: Optional[str] = None  # For peers
    background: Optional[str] = None  # For peers
    years_served: Optional[str] = None  # For peers
    # SIP/calling
    sip_extension: Optional[str] = None
    sip_password: Optional[str] = None  # Encrypted
    # Permissions
    is_supervisor: bool = False
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    # Legacy link (for migration tracking - can be removed after migration)
    legacy_user_id: Optional[str] = None  # Original users collection ID
    legacy_profile_id: Optional[str] = None  # Original counsellors/peer_supporters ID

class StaffUpdate(BaseModel):
    """Update staff member details"""
    name: Optional[str] = None
    phone: Optional[str] = None
    sms: Optional[str] = None
    whatsapp: Optional[str] = None
    specialization: Optional[str] = None
    area: Optional[str] = None
    background: Optional[str] = None
    years_served: Optional[str] = None
    sip_extension: Optional[str] = None
    sip_password: Optional[str] = None
    is_supervisor: Optional[bool] = None
    status: Optional[str] = None

class StaffStatusUpdate(BaseModel):
    """Update staff status - works for all roles"""
    status: str = Field(..., pattern="^(available|limited|unavailable|busy|off)$")
    next_available: Optional[str] = None

class StaffPublic(BaseModel):
    """Public view of staff member - no sensitive data"""
    id: str
    name: str
    role: str
    status: str
    specialization: Optional[str] = None
    area: Optional[str] = None
    is_supervisor: bool = False

# Counsellor Models
class CounsellorCreate(BaseModel):
    name: str
    specialization: str
    phone: str
    sms: Optional[str] = None
    whatsapp: Optional[str] = None
    user_id: Optional[str] = None
    sip_extension: Optional[str] = None  # SIP extension number (e.g., "1001")
    sip_password: Optional[str] = None   # SIP extension password

class Counsellor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    specialization: Optional[str] = None  # Made optional to handle legacy data
    status: str = "off"  # available, busy, off
    next_available: Optional[str] = None
    phone: Optional[str] = None  # Made optional to handle legacy data
    sms: Optional[str] = None
    whatsapp: Optional[str] = None
    user_id: Optional[str] = None
    sip_extension: Optional[str] = None  # SIP extension number
    sip_password: Optional[str] = None   # SIP extension password (encrypted)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CounsellorStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(available|busy|off|limited|unavailable)$")
    next_available: Optional[str] = None

# Public (safe) response models - no sensitive data
class CounsellorPublic(BaseModel):
    """Safe public view - no phone numbers or contact details"""
    id: str
    name: str
    specialization: str
    status: str

class PeerSupporterPublic(BaseModel):
    """Safe public view - no phone numbers or contact details"""
    id: str
    firstName: str
    area: str
    status: str

# Peer Supporter Models
class PeerSupporterCreate(BaseModel):
    firstName: str
    area: str
    background: str
    yearsServed: str
    phone: str
    sms: Optional[str] = None
    whatsapp: Optional[str] = None
    user_id: Optional[str] = None
    sip_extension: Optional[str] = None  # SIP extension number (e.g., "1002")
    sip_password: Optional[str] = None   # SIP extension password

class PeerSupporter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    firstName: str
    area: str
    background: str
    yearsServed: str
    status: str = "unavailable"  # available, limited, unavailable
    phone: str
    sms: Optional[str] = None
    whatsapp: Optional[str] = None
    user_id: Optional[str] = None
    sip_extension: Optional[str] = None  # SIP extension number
    sip_password: Optional[str] = None   # SIP extension password (encrypted)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PeerSupporterStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(available|limited|unavailable)$")

# Organization Models
class OrganizationCreate(BaseModel):
    name: str
    description: str
    phone: str
    sms: Optional[str] = None
    whatsapp: Optional[str] = None

class Organization(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    phone: str
    sms: Optional[str] = None
    whatsapp: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Peer Support Registration (from app)
class PeerSupportRegistration(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class PeerSupportRegistrationCreate(BaseModel):
    email: EmailStr

# Password Management Models
class ChangePassword(BaseModel):
    current_password: str
    new_password: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str
    new_password: str

class AdminResetPassword(BaseModel):
    user_id: str
    new_password: str

# Call Intent Logging Models
class CallIntentCreate(BaseModel):
    contact_type: str  # counsellor, peer, organization, crisis_line
    contact_id: Optional[str] = None  # ID of the specific contact if applicable
    contact_name: str
    contact_phone: Optional[str] = None  # Made optional for WebRTC calls (no phone needed)
    call_method: str = "phone"  # phone, sms, whatsapp, webrtc

class CallIntent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contact_type: str
    contact_id: Optional[str] = None
    contact_name: str
    contact_phone: Optional[str] = None  # Made optional for WebRTC calls
    call_method: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    # Anonymous - no user tracking for privacy

# CMS Content Models
class PageContent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    page_name: str  # home, crisis-support, organizations, peer-support, historical-investigations
    section: str    # title, subtitle, emergency_text, etc.
    content: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None

class PageContentUpdate(BaseModel):
    content: str

# ============ ENHANCED CMS MODELS ============

class CMSPage(BaseModel):
    """Full page definition for CMS"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str  # URL path e.g. 'home', 'self-care', 'support-orgs'
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None  # Ionicons name
    is_visible: bool = True
    show_in_nav: bool = True
    nav_order: int = 99
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CMSSection(BaseModel):
    """Section within a page"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    page_slug: str
    section_type: str  # 'hero', 'cards', 'text', 'ai_team', 'resources', 'custom'
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    order: int = 0
    is_visible: bool = True
    settings: Optional[dict] = None  # For custom styling/config
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CMSCard(BaseModel):
    """Card/item within a section"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    section_id: str
    card_type: str  # 'ai_character', 'tool', 'resource', 'organization', 'link'
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    color: Optional[str] = None
    bg_color: Optional[str] = None
    route: Optional[str] = None  # Internal route
    external_url: Optional[str] = None
    phone: Optional[str] = None
    order: int = 0
    is_visible: bool = True
    metadata: Optional[dict] = None  # Extra data like AI prompts, etc.
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CMSPageCreate(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    is_visible: bool = True
    show_in_nav: bool = True
    nav_order: int = 99

class CMSSectionCreate(BaseModel):
    page_slug: str
    section_type: str
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    order: int = 0
    is_visible: bool = True
    settings: Optional[dict] = None

class CMSCardCreate(BaseModel):
    section_id: str
    card_type: str
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    color: Optional[str] = None
    bg_color: Optional[str] = None
    route: Optional[str] = None
    external_url: Optional[str] = None
    phone: Optional[str] = None
    order: int = 0
    is_visible: bool = True
    metadata: Optional[dict] = None

# Resource Library Models
class ResourceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "General"
    content: Optional[str] = None  # Rich text content
    link: Optional[str] = None  # External link
    image_url: Optional[str] = None
    image_data: Optional[str] = None  # Base64 encoded image

# Callback Request Models
class CallbackRequestCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    message: str
    request_type: str = Field(..., pattern="^(counsellor|peer)$")  # counsellor or peer
    is_urgent: bool = False
    safeguarding_alert_id: Optional[str] = None

class CallbackRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: Optional[str] = None
    message: str
    request_type: str  # counsellor or peer
    status: str = "pending"  # pending, in_progress, completed, released
    assigned_to: Optional[str] = None  # ID of counsellor/peer who took control
    assigned_name: Optional[str] = None
    is_urgent: bool = False
    safeguarding_alert_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CallbackStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|in_progress|completed|released)$")

# Interaction Notes Models
class InteractionNoteCreate(BaseModel):
    """Create a new interaction note"""
    title: str
    content: str
    related_to: Optional[str] = None  # ID of callback, alert, case, etc.
    related_type: Optional[str] = None  # 'callback', 'alert', 'case', 'session', 'general'
    is_shared: bool = False  # If true, visible to team members
    share_with: Optional[List[str]] = None  # List of user IDs to share with
    tags: Optional[List[str]] = None  # e.g., ['safeguarding', 'follow-up', 'supervisor-review']

class InteractionNote(BaseModel):
    """Interaction note stored in database"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_name: str
    author_role: str
    title: str
    content: str
    related_to: Optional[str] = None
    related_type: Optional[str] = None
    is_shared: bool = False
    share_with: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InteractionNoteUpdate(BaseModel):
    """Update an existing note"""
    title: Optional[str] = None
    content: Optional[str] = None
    is_shared: Optional[bool] = None
    share_with: Optional[List[str]] = None
    tags: Optional[List[str]] = None

# Internal Message Models
class InternalMessageCreate(BaseModel):
    """Create a new internal message"""
    to_id: str
    content: str

class InternalMessage(BaseModel):
    """Internal message between staff"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_id: str
    from_name: str
    to_id: str
    to_name: str
    content: str
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Panic Alert Models
class PanicAlertCreate(BaseModel):
    user_name: Optional[str] = None
    user_phone: Optional[str] = None
    location: Optional[str] = None
    message: Optional[str] = None

class PanicAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_name: Optional[str] = None
    user_phone: Optional[str] = None
    location: Optional[str] = None
    message: Optional[str] = None
    status: str = "active"  # active, acknowledged, resolved
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SafeguardingAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    character: str
    triggering_message: str
    ai_response: str
    risk_level: str = "AMBER"  # GREEN, YELLOW, AMBER, RED
    risk_score: int = 0
    triggered_indicators: List[str] = []
    status: str = "active"  # active, acknowledged, resolved
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    notes: Optional[str] = None
    # Enhanced tracking fields
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None
    conversation_history: Optional[List[Dict[str, str]]] = None  # Last N messages for context
    callback_requested: bool = False
    callback_id: Optional[str] = None
    contact_captured: bool = False
    # Geolocation fields (from ip-api.com)
    geo_city: Optional[str] = None
    geo_region: Optional[str] = None
    geo_country: Optional[str] = None
    geo_isp: Optional[str] = None
    geo_timezone: Optional[str] = None
    geo_lat: Optional[float] = None
    geo_lon: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Resource(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    category: str = "General"
    content: Optional[str] = None
    link: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    link: Optional[str] = None
    image_url: Optional[str] = None
    image_data: Optional[str] = None  # Base64 encoded image for updates

# Staff Notes Models
class NoteCreate(BaseModel):
    title: str
    content: str
    is_private: bool = True  # True = personal, False = can be shared
    shared_with: Optional[List[str]] = None  # List of user IDs to share with
    callback_id: Optional[str] = None  # Optional link to a callback

class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    is_private: bool = True
    shared_with: List[str] = Field(default_factory=list)
    callback_id: Optional[str] = None
    author_id: str
    author_name: str
    author_role: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_private: Optional[bool] = None
    shared_with: Optional[List[str]] = None

# Family/Friends Concern Model
class ConcernCreate(BaseModel):
    your_name: str
    your_email: Optional[str] = None
    your_phone: Optional[str] = None
    relationship: str  # e.g. "spouse", "parent", "friend", "colleague"
    veteran_name: Optional[str] = None
    concerns: str  # Description of concerns
    signs_noticed: Optional[List[str]] = None  # e.g. ["isolation", "drinking", "anger"]
    how_long: Optional[str] = None  # How long noticed these changes
    urgency: str = "medium"  # low, medium, high, urgent
    consent_to_contact: bool = False  # Has the veteran consented to contact?

class Concern(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    your_name: str
    your_email: Optional[str] = None
    your_phone: Optional[str] = None
    relationship: str
    veteran_name: Optional[str] = None
    concerns: str
    signs_noticed: List[str] = Field(default_factory=list)
    how_long: Optional[str] = None
    urgency: str = "medium"
    consent_to_contact: bool = False
    status: str = "new"  # new, contacted, in_progress, resolved
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# ============ SHIFT/ROTA MODELS ============
class ShiftCreate(BaseModel):
    date: str  # YYYY-MM-DD format
    start_time: str  # HH:MM format (24hr)
    end_time: str  # HH:MM format (24hr)
    notes: Optional[str] = None

class Shift(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    staff_id: str  # ID of the peer supporter
    staff_name: str
    staff_role: str  # "peer" or "counsellor"
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    notes: Optional[str] = None
    status: str = "scheduled"  # scheduled, active, completed, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ShiftUpdate(BaseModel):
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

# ============ BUDDY FINDER MODELS ============
class BuddyProfileCreate(BaseModel):
    display_name: str  # Can be nickname for privacy
    region: str  # General location (e.g., "North West", "London")
    service_branch: str  # Army, Navy, RAF, Marines, etc.
    regiment: Optional[str] = None
    years_served: Optional[str] = None  # e.g., "1990-2005"
    bio: Optional[str] = None  # Brief intro
    interests: Optional[List[str]] = None  # e.g., ["hiking", "fishing", "football"]
    contact_preference: str = "in_app"  # in_app, email
    email: Optional[str] = None  # Only if contact_preference is email
    gdpr_consent: bool  # Must be True to sign up
    gdpr_consent_date: Optional[datetime] = None

class BuddyProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    display_name: str
    region: str
    service_branch: str
    regiment: Optional[str] = None
    years_served: Optional[str] = None
    bio: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    contact_preference: str = "in_app"
    email: Optional[str] = None
    gdpr_consent: bool = True
    gdpr_consent_date: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    last_active: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # For authentication
    pin_hash: Optional[str] = None  # Hashed 4-digit PIN

class BuddyProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    region: Optional[str] = None
    service_branch: Optional[str] = None
    regiment: Optional[str] = None
    years_served: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[List[str]] = None
    contact_preference: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class BuddyMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_profile_id: str
    to_profile_id: str
    message: str
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)



# AI Battle Buddy Chat Models
class BuddyChatRequest(BaseModel):
    message: str
    sessionId: str
    character: str = "tommy"  # "tommy" or "doris"
    is_under_18: bool = False  # Age gate flag for enhanced safeguarding
    conversation_context: Optional[str] = None  # Device-stored previous conversation context

class BuddyChatResponse(BaseModel):
    reply: str
    sessionId: str
    character: str
    characterName: str
    characterAvatar: str
    safeguardingTriggered: bool = False
    safeguardingAlertId: Optional[str] = None
    riskLevel: str = "GREEN"  # GREEN, YELLOW, AMBER, RED
    riskScore: int = 0

# ============ SAFEGUARDING TRIAGE SYSTEM ============
# Weighted risk scoring for UK veteran support platform
# Based on BACP ethical framework and UK safeguarding principles

# ============================================================================
# RADIO CHECK AI - UNIVERSAL SAFEGUARDING & CRISIS RESPONSE FRAMEWORK v2.0
# ============================================================================
# This framework has HIGHEST PRIORITY and overrides all other AI instructions.
# Mission: Provide supportive, non-judgmental conversation to users experiencing
# loneliness, distress, or hopelessness. Early identification and intervention
# for suicide risk is critical. THIS SAVES LIVES.
# ============================================================================

# RISK LEVEL MODEL (from safeguarding framework documents)
# LEVEL 0 - Normal conversation
# LEVEL 1 - Low distress (sadness, stress) 
# LEVEL 2 - Hopelessness language (SAFEGUARDING BEGINS HERE)
# LEVEL 3 - Self-harm thoughts
# LEVEL 4 - Imminent suicide risk (CRISIS MODE)

# LEVEL 4 - IMMINENT RISK / RED INDICATORS
# Any single one = immediate RED/LEVEL 4 regardless of score
RED_INDICATORS = {
    # ===== DIRECT SUICIDAL IDEATION (+100) =====
    "want to end it": 100, "end it all": 100, "kill myself": 100, "take my own life": 100,
    "want to die": 100, "going to die": 100, "suicide": 100, "suicidal": 100,
    "ending it": 100, "end my life": 100, "ending my life": 100, "finish it": 100, "finish myself": 100,
    "end it tonight": 100, "end it tomorrow": 100, "end it soon": 100,
    "going to end it": 100, "going to end it tonight": 100,
    "thinking about ending my life": 100, "thought about ending my life": 100,
    
    # ===== "WON'T BE HERE" PATTERNS - CRITICAL (+100) =====
    # From extended trigger dataset - temporal variations
    "wont be here": 100, "won't be here": 100, "not be here": 100,
    "wont be here tonight": 100, "won't be here tonight": 100,
    "wont be here tomorrow": 100, "won't be here tomorrow": 100,
    "wont be here in the morning": 100, "won't be here in the morning": 100,
    "wont be here soon": 100, "won't be here soon": 100,
    "wont be here very soon": 100, "won't be here very soon": 100,
    "wont be here later tonight": 100, "won't be here later tonight": 100,
    "wont be here before long": 100, "won't be here before long": 100,
    
    # ===== "MIGHT NOT BE HERE" PATTERNS (+100) =====
    "might not be here": 100, "might not be here tonight": 100,
    "might not be here tomorrow": 100, "might not be here in the morning": 100,
    "might not be here soon": 100, "might not be here very soon": 100,
    "might not be here later tonight": 100, "might not be here before long": 100,
    
    # ===== "WON'T BE ALIVE" PATTERNS (+100) =====
    "wont be alive": 100, "won't be alive": 100,
    "wont be alive tonight": 100, "won't be alive tonight": 100,
    "wont be alive tomorrow": 100, "won't be alive tomorrow": 100,
    "wont be alive in the morning": 100, "won't be alive in the morning": 100,
    "dont think ill be alive": 100, "don't think i'll be alive": 100,
    "dont think ill be alive tonight": 100, "don't think i'll be alive tonight": 100,
    "dont think ill be alive tomorrow": 100, "don't think i'll be alive tomorrow": 100,
    
    # ===== "CAN'T SEE ME BEING HERE" PATTERNS (+100) =====
    "cant see me being here": 100, "can't see me being here": 100,
    "cant see myself being here": 100, "can't see myself being here": 100,
    "cant see me being here in the morning": 100, "can't see me being here in the morning": 100,
    "cant see myself being here tomorrow": 100, "can't see myself being here tomorrow": 100,
    "see me here": 100, "be here in the morning": 100, "be here tomorrow": 100,
    "around in the morning": 100, "around tomorrow": 100,
    "see me being here": 100, "being here in the morning": 100, "being here tomorrow": 100,
    "here in the morning": 100, "here tomorrow": 100,
    
    # ===== "GOING TO END IT" PATTERNS (+100) =====
    "going to end it tonight": 100, "going to end it tomorrow": 100,
    "going to end it soon": 100, "going to end it very soon": 100,
    "going to end it later tonight": 100, "going to end it before long": 100,
    
    # ===== INDIRECT DEATH WISH (+80-100) =====
    "dont want to wake up": 80, "don't want to wake up": 80,
    "i'm done": 80, "im done": 80, "done with life": 90, "done with everything": 80,
    "tired of waking up": 80, "wish i didnt wake up": 80, "wish i didn't wake up": 80,
    "just want peace": 80, "i just want peace": 80, "want it to stop": 80,
    "past caring": 80, "i'm past caring": 80, "im past caring": 80,
    "had enough": 80, "ive had enough": 80, "i've had enough": 80,
    "want out": 80, "just want out": 80, "need out": 80,
    "ready to go": 80, "time to go": 80,
    # NOTE: "last night" removed - too many false positives (e.g., "arrested me last night")
    # Kept more specific finality indicators below
    "my last message": 80, "my last words": 90, "my last goodbye": 100, "final day": 100, "last day on earth": 90,
    
    # ===== "I WISH I WAS DEAD" PATTERNS (+100) =====
    "wish i was dead": 100, "wish i were dead": 100,
    "wish i was dead tonight": 100, "wish i was dead tomorrow": 100,
    "wish i was dead in the morning": 100, "wish i was dead soon": 100,
    "wish i was dead very soon": 100, "wish i was dead later tonight": 100,
    "wish i was dead before long": 100,
    
    # ===== "CAN'T DO THIS ANYMORE" PATTERNS (+80-100) =====
    "cant do this anymore": 80, "can't do this anymore": 80,
    "cant do this anymore tonight": 90, "can't do this anymore tonight": 90,
    "cant do this anymore tomorrow": 90, "can't do this anymore tomorrow": 90,
    "cant take it anymore": 80, "can't take it anymore": 80,
    "cant take it anymore tonight": 90, "can't take it anymore tonight": 90,
    
    # ===== "CAN'T GO ON" PATTERNS (+100) - CRITICAL =====
    "cant go on": 100, "can't go on": 100, "cannot go on": 100,
    "cant go on tonight": 100, "can't go on tonight": 100,
    "cant go on tomorrow": 100, "can't go on tomorrow": 100,
    "cant go on in the morning": 100, "can't go on in the morning": 100,
    "cant go on soon": 100, "can't go on soon": 100,
    "cant go on very soon": 100, "can't go on very soon": 100,
    "cant go on later tonight": 100, "can't go on later tonight": 100,
    "cant go on before long": 100, "can't go on before long": 100,
    "go on anymore": 100, "can go on": 80, "keep going": 60,
    "cant continue": 80, "can't continue": 80, "cant carry on": 80, "can't carry on": 80,
    "point in going on": 100, "going on anymore": 100, "no point going on": 100,
    
    # ===== "NO POINT ANYMORE" PATTERNS (+100) =====
    "no point anymore": 100, "theres no point anymore": 100, "there's no point anymore": 100,
    "no point anymore tonight": 100, "no point anymore tomorrow": 100,
    "no point anymore in the morning": 100, "no point anymore soon": 100,
    "no point anymore very soon": 100, "no point anymore later tonight": 100,
    "no point anymore before long": 100,
    "no point in going on": 100, "point in going on": 100,
    "no point going on": 100, "no point continuing": 100,
    
    # ===== "FEEL LIKE GIVING UP" PATTERNS (+90) =====
    "feel like giving up": 90, "i feel like giving up": 90,
    "feel like giving up tonight": 100, "feel like giving up tomorrow": 100,
    "feel like giving up in the morning": 100, "feel like giving up soon": 100,
    "feel like giving up very soon": 100, "feel like giving up later tonight": 100,
    "feel like giving up before long": 100,
    
    # ===== "FEEL LIKE DYING" PATTERNS (+90-100) =====
    "feel like dying": 90, "feeling like dying": 90, "i feel like dying": 90,
    "like dying": 80,
    
    # ===== "DISAPPEAR FOREVER" PATTERNS (+80-100) =====
    "disappear forever": 100, "want to disappear forever": 100,
    "want to disappear": 80, "wanna disappear": 80,
    "just disappear": 80, "i want to disappear": 80,
    
    # ===== "SLEEP FOREVER" PATTERNS (+90-100) =====
    "sleep forever": 90, "want to sleep forever": 100,
    "just want to sleep forever": 100, "go to sleep forever": 100,
    "never wake up": 90, "want to never wake up": 100,
    
    # ===== "DON'T WANT TO BE HERE" PATTERNS (+90-100) =====
    "dont want to be here": 90, "don't want to be here": 90,
    "dont want to be here tonight": 100, "don't want to be here tonight": 100,
    "dont want to be alive": 100, "don't want to be alive": 100,
    "dont want to be alive anymore": 100, "don't want to be alive anymore": 100,
    "dont want to be here tomorrow": 100, "don't want to be here tomorrow": 100,
    "dont want to be here in the morning": 100, "don't want to be here in the morning": 100,
    "dont want to be here soon": 100, "don't want to be here soon": 100,
    
    # ===== "I HATE BEING ALIVE" PATTERNS (+100) =====
    "hate being alive": 100, "i hate being alive": 100,
    "hate being alive tonight": 100, "hate being alive tomorrow": 100,
    "hate being alive in the morning": 100, "hate being alive soon": 100,
    
    # ===== "TIRED OF FIGHTING" PATTERNS (+90-100) =====
    "tired of fighting": 90, "i'm tired of fighting": 90, "im tired of fighting": 90,
    "tired of fighting tonight": 100, "tired of fighting tomorrow": 100,
    "tired of fighting in the morning": 100, "tired of fighting soon": 100,
    "tired of fighting very soon": 100, "tired of fighting later tonight": 100,
    
    # ===== "I'VE HAD ENOUGH" / "DONE" PATTERNS (+90-100) =====
    "ive had enough": 90, "i've had enough": 90,
    "ive had enough tonight": 100, "i've had enough tonight": 100,
    "done with everything tonight": 100, "done with everything tomorrow": 100,
    "im exhausted with life": 90, "i'm exhausted with life": 90,
    "exhausted with life tonight": 100, "exhausted with life tomorrow": 100,
    
    # ===== "EVERYONE WOULD BE BETTER WITHOUT ME" PATTERNS (+100) =====
    "everyone would be better without me": 100, "better off without me": 100,
    "theyd be better off": 100, "they'd be better off": 100,
    "better without me": 100, "world be better without me": 100,
    "everyone would be better without me tonight": 100,
    "everyone would be better without me tomorrow": 100,
    "everyone would be better without me in the morning": 100,
    "everyone would be better without me soon": 100,
    
    # ===== "I DON'T SEE A FUTURE" PATTERNS (+90-100) =====
    "dont see a future": 90, "don't see a future": 90,
    "dont see a future tonight": 100, "don't see a future tonight": 100,
    "dont see a future tomorrow": 100, "don't see a future tomorrow": 100,
    "dont see a future in the morning": 100, "don't see a future in the morning": 100,
    "dont see a future soon": 100, "don't see a future soon": 100,
    "no future for me": 100, "i have no future": 100,
    
    # ===== "JUST WANT THE PAIN TO STOP" PATTERNS (+90-100) =====
    "want the pain to stop": 90, "just want the pain to stop": 90,
    "want the pain to stop tonight": 100, "want the pain to stop tomorrow": 100,
    "want the pain to stop in the morning": 100, "want the pain to stop soon": 100,
    "want it all to end": 100, "want this to end": 90,
    
    # ===== "NOTHING MATTERS ANYMORE" PATTERNS (+80-100) =====
    "nothing matters anymore": 80, "nothing matters anymore tonight": 100,
    "nothing matters anymore tomorrow": 100, "nothing matters anymore in the morning": 100,
    "nothing matters anymore soon": 100, "nothing matters": 80,
    
    # ===== "LIFE IS POINTLESS" PATTERNS (+90-100) =====
    "life is pointless": 90, "life is pointless tonight": 100,
    "life is pointless tomorrow": 100, "life is pointless in the morning": 100,
    "life is pointless soon": 100, "life is pointless very soon": 100,
    
    # ===== "NO WAY OUT" PATTERNS (+90-100) =====
    "no way out": 90, "dont see a way out": 100, "don't see a way out": 100,
    "no way out tonight": 100, "no way out tomorrow": 100,
    "no way out in the morning": 100, "no way out soon": 100,
    "cant see a way out": 100, "can't see a way out": 100,
    
    # ===== PREPARATION / METHOD REFERENCES (+100) =====
    "pills": 100, "rope": 100, "bridge": 100, "jump": 100, "hanging": 100,
    "giving things away": 100, "given my stuff away": 100, "sorted my affairs": 100,
    "written letters": 100, "written a letter": 100, "final letter": 100,
    "made a plan": 100, "got a plan": 100, "know how": 100,
    "goodbye letter": 100, "saying goodbye": 100, "said my goodbyes": 100,
    "overdose": 100, "take all my pills": 100, "stockpiling": 100,
    
    # ===== SELF-HARM INDICATORS (+90) - LEVEL 3 =====
    "cutting myself": 90, "cut myself": 90, "hurting myself": 90, "self harm": 90,
    "self-harm": 90, "burning myself": 90, "hitting myself": 90,
    "hurt myself": 90, "want to hurt myself": 90, "going to hurt myself": 90,
    "harming myself": 90, "doing damage": 90, "punishing myself": 90,
    "thought about hurting myself": 90, "thinking about hurting myself": 90,
    "thought about ending it": 100, "thinking about ending it": 100,
    "sometimes wish i wasnt here": 90, "sometimes wish i wasn't here": 90,
    
    # ===== LOSS OF CONTROL (+90) =====
    "going to hurt someone": 90, "might hurt someone": 90, "losing control": 90,
    "cant control myself": 90, "can't control myself": 90,
    "scared what i might do": 90, "scared of what i'll do": 90,
    
    # ===== ACCESS TO WEAPONS WHILE DISTRESSED (+90) =====
    "got my gun": 90, "still have my weapon": 90, "got weapons": 90,
    "loaded gun": 90, "weapon ready": 90,
    
    # ===== COMMON MISSPELLINGS (+100) =====
    # Added based on typographic safety test findings - March 2026
    # Suicide misspellings
    "suiside": 100, "suacide": 100, "sueside": 100, "suiccide": 100,
    "suicidle": 100, "sucide": 100, "suicid": 100, "suicidie": 100,
    "commiting suicide": 100, "comitting suicide": 100, "comiting suicide": 100,
    
    # Kill myself misspellings  
    "kil myself": 100, "kll myself": 100, "kill meself": 100,
    "killl myself": 100, "kil meself": 100,
    
    # End myself variations
    "end myself": 100, "ending myself": 100, "gonna end myself": 100,
    
    # ===== UK SLANG & COLLOQUIALISMS (+100) =====
    # British/veteran-specific crisis language
    "top myself": 100, "gonna top myself": 100, "going to top myself": 100,
    "do myself in": 100, "gonna do myself in": 100, "going to do myself in": 100,
    "off myself": 100, "gonna off myself": 100, "going to off myself": 100,
    "neck myself": 100, "gonna neck myself": 100, "going to neck myself": 100,
    "slit my wrists": 100, "slit me wrists": 100, "cut my wrists": 100,
    "chuck myself off": 100, "throw myself off": 100, "jump off": 90,
    "top meself": 100, "do meself in": 100, "off meself": 100,
    
    # ===== TEXT SPEAK & INTERNET ABBREVIATIONS (+100) =====
    # Common digital crisis language
    "wanna die": 100, "want 2 die": 100, "wnt to die": 100,
    "gonna kms": 100, "kms": 90, "going to kms": 100,  # kill myself
    "wanna end it": 100, "gonna end it": 100,
    "dont wanna live": 100, "don't wanna live": 100,
    "dont wanna be here": 100, "don't wanna be here": 100,
    "im done w life": 90, "done w life": 90,
    "cant do this": 80, "can't do this": 80,
    
    # ===== MODERN EUPHEMISMS (+90-100) =====
    # TikTok/social media euphemisms for suicide
    "unalive myself": 100, "gonna unalive": 100, "want to unalive": 100,
    "unalive": 90, "un-alive": 90,
    "game end myself": 100, "gonna game end": 100,
    "delete myself": 100, "gonna delete myself": 100,
    "yeet myself": 90, "yeet myself off": 100,
    "kermit": 80,  # "kermit sewer slide" = commit suicide
    "sewer slide": 100, "sewerslide": 100, "sewercide": 100,
}

# LEVEL 2 & 3 - AMBER INDICATORS (Hopelessness & Early Self-Harm)
# SAFEGUARDING BEGINS AT THIS LEVEL - DO NOT WAIT FOR EXPLICIT SUICIDE STATEMENTS
AMBER_INDICATORS = {
    # ===== EMOTIONAL NUMBNESS / EMPTINESS (+40-45) =====
    "feel nothing": 40, "empty inside": 40, "numb": 40, "dont feel anything": 40,
    "don't feel anything": 40, "lost myself": 40, "dont know who i am": 40,
    "don't know who i am": 40, "not the same person": 40,
    "hollow": 40, "dead inside": 45, "feel dead": 45, "emotionally dead": 45,
    "shell of myself": 40, "just existing": 35, "going through motions": 35,
    "feel empty": 40, "i feel empty": 40,
    
    # ===== HOPELESSNESS / NO FUTURE (+35-50) - LEVEL 2 TRIGGERS =====
    "no future": 50, "no way out": 50, "trapped": 45, "stuck": 30,
    "nothing will change": 45, "never get better": 50, "wont get better": 50,
    "won't get better": 50, "always be like this": 45, "no escape": 50,
    "lost cause": 50, "beyond help": 50, "cant be helped": 50, "can't be helped": 50,
    "given up": 50, "giving up": 50, "why bother": 45, "whats the use": 45,
    "what's the use": 45, "doesnt matter": 40, "doesn't matter": 40,
    "nothing matters": 45, "who cares": 40, "nobody cares": 45,
    "hopeless": 50, "no hope": 50, "whats the point": 50, "what's the point": 50,
    "pointless": 50, "no point": 55, "theres no point": 55, "there's no point": 55,
    "life feels pointless": 50, "in going on": 70,
    
    # ===== "FEELING LOW" / DEPRESSION LANGUAGE (+30-45) =====
    "really low": 35, "feeling low": 35, "so low": 35, "lowest i've been": 40,
    "lowest ive been": 40, "dark place": 40, "in a dark place": 40,
    "dont see the point": 45, "don't see the point": 45, "no reason": 35,
    "struggling": 30, "really struggling": 35, "barely coping": 40,
    "barely holding on": 50, "hanging by a thread": 50, "on the edge": 50,
    "drowning": 40, "sinking": 35, "going under": 40,
    "darkness": 35, "black cloud": 35, "fog": 30, "in a fog": 35,
    "lost all hope": 50, "losing hope": 45, "hope is gone": 50,
    "not myself": 35, "dont recognise myself": 40, "don't recognise myself": 40,
    "worthless": 45, "useless": 40, "waste of space": 45, "good for nothing": 45,
    "i'm a burden": 50, "im a burden": 50, "burden to everyone": 50,
    "in the way": 40, "just in the way": 45,
    
    # ===== PTSD / FLASHBACKS / HYPERVIGILANCE (+35-40) =====
    "flashbacks": 35, "nightmares": 35, "cant sleep": 35, "can't sleep": 35,
    "hypervigilant": 35, "on edge": 35, "constantly alert": 35,
    "reliving it": 40, "keeps coming back": 40, "haunted": 40,
    "wont leave me alone": 40, "won't leave me alone": 40, "in my head": 35,
    "seeing things": 45, "hearing things": 45, "voices": 45,
    
    # ===== ISOLATION / WITHDRAWAL (+30-45) =====
    "isolated": 35, "all alone": 40, "no one around": 35, "pushed everyone away": 40,
    "dont talk to anyone": 35, "don't talk to anyone": 35, "withdrawn": 35,
    "cant face people": 35, "can't face people": 35, "stay in bed": 35,
    "stopped going out": 35, "dont leave the house": 35, "don't leave the house": 35,
    "avoiding everyone": 35, "cut everyone off": 40,
    "nobody understands": 40, "no one gets it": 40, "alone in this": 40,
    "no friends": 40, "lost everyone": 45, "everyone left": 45,
    "completely alone": 45, "no one to talk to": 40,
    
    # ===== SUBTLE SELF-HARM HINTS (+40-50) - LEVEL 3 =====
    "need to feel something": 45, "only way to feel": 50, "makes me feel alive": 50,
    "deserve pain": 50, "deserve to suffer": 50, "punish myself": 50,
    "scars": 40, "marks": 35, "hiding marks": 45, "long sleeves": 40,
    "blade": 50, "sharp": 40, "razor": 50, "blood": 45,
    "relief from pain": 45, "only thing that helps": 45,
    "thought about hurting myself": 50, "thought about harming myself": 50,
    
    # ===== SUBSTANCE MISUSE (+35-45) =====
    "drinking to cope": 40, "need a drink": 35, "drinking every day": 40,
    "using drugs": 40, "pills to sleep": 35, "self medicating": 40,
    "drunk": 30, "wasted": 30, "off my face": 35,
    "addicted": 45, "addiction": 45, "cant stop drinking": 45, "can't stop drinking": 45,
    "gambling": 35, "lost money gambling": 40, "betting": 30,
    "drugs every day": 45, "need something to get through": 40,
    "blackout": 40, "blacking out": 40, "drink to forget": 45,
    "only way to cope": 45, "numbing it": 40,
    
    # ===== LEGAL / HOUSING CRISIS (+30-40) =====
    "about to lose my home": 35, "homeless": 40, "evicted": 35,
    "lost my job": 35, "no money": 35, "in debt": 40, "court case": 35,
    "legal trouble": 35, "going to prison": 45, "prison": 40,
    "arrested": 35, "police": 30, "probation": 30, "been inside": 35,
    "assault charge": 40, "got in trouble": 30, "fight": 25,
    "lost my temper": 35, "anger issues": 35, "rage": 35,
    
    # ===== SELF-CARE DETERIORATION (+30-40) =====
    "stopped showering": 35, "not eating": 35, "cant eat": 30, "can't eat": 30,
    "not looking after myself": 35, "let myself go": 30, "dont care anymore": 40,
    "stopped exercising": 30, "no energy": 30, "exhausted": 25,
    "stopped caring": 40, "why bother trying": 40, "given up on myself": 45,
    
    # ===== SLEEP DISTURBANCE (+30-40) =====
    "sleeping all day": 35, "cant get out of bed": 35, "can't get out of bed": 35,
    "not sleeping": 35, "insomnia": 35, "sleep all the time": 30,
    "only sleep a few hours": 30, "awake all night": 30,
    "dread waking up": 45, "hate mornings": 30, "cant face the day": 40,
    
    # ===== BARRIERS TO HELP / STIGMA (+25-35) =====
    "cant ask for help": 35, "can't ask for help": 35, "too proud": 25,
    "sign of weakness": 30, "dont want to be a burden": 40,
    "should be able to handle it": 25, "real men dont": 30,
    "embarrassed": 25, "ashamed": 30, "dont want anyone to know": 30,
    "failed": 35, "failure": 35, "let everyone down": 40, "disappointed everyone": 40,
    
    # ===== CRISIS / BREAKING POINT LANGUAGE (+40-50) =====
    "breaking down": 40, "falling apart": 40, "at breaking point": 45,
    "rock bottom": 45, "hit bottom": 45, "lowest point": 40,
    "end of my rope": 45, "at the end": 45, "nothing left": 45,
    "running out of fight": 45, "no fight left": 50, "tired of fighting": 45,
    "cant cope": 45, "can't cope": 45, "overwhelmed": 35,
    
    # ===== PANIC / ACUTE DISTRESS (+35-45) =====
    "can't breathe": 40, "cant breathe": 40, "can't stop crying": 40,
    "cant stop crying": 40, "having a panic attack": 45, "panic attack": 40,
    "hyperventilating": 40,
    
    # ===== RELATIONSHIP / FAMILY STRAIN (+30-40) =====
    "marriage over": 35, "divorce": 30, "partner left": 35, "wife left": 35,
    "husband left": 35, "kids dont talk to me": 40, "kids don't talk to me": 40,
    "lost custody": 40, "cant see my kids": 40, "can't see my kids": 40,
    "family hate me": 40, "ruined my family": 40,
}

# MODIFIERS - Stackable additions
MODIFIER_PATTERNS = {
    # Humour or minimisation masking distress (+20)
    "just joking": 20, "only joking": 20, "haha": 15, "lol": 15,
    "not that bad": 20, "its fine": 20, "it's fine": 20, "i'm fine": 20, "im fine": 20,
    "dont worry": 15, "don't worry": 15,
    "forget i said": 25, "ignore me": 25, "being silly": 20, "being stupid": 25,
    
    # Downplaying severity (+15-25)
    "others had it worse": 15, "shouldnt complain": 15, "shouldn't complain": 15,
    "not a big deal": 15, "nothing really": 15, "just being dramatic": 15,
    "man up": 15, "get over it": 15, "soldier on": 15, "crack on": 10,
    "overreacting": 20, "being pathetic": 25, "weak": 20,
    
    # Dark humour about death (+25)
    "dark joke": 20, "wont be around": 30, "won't be around": 30,
    "not be around": 30, "not around much longer": 35, "not here much longer": 35,
    "disappear": 25, "vanish": 25, "not here tomorrow": 30,
    "sleep forever": 30, "eternal sleep": 30, "long sleep": 25,
    "checking out": 30, "signing off": 25,
    
    # Veteran-specific language (+20-30)
    "civvies dont understand": 20, "civvies don't understand": 20,
    "back in theatre": 25, "deployment": 20, "tour": 20,
    "lost mates": 30, "lost brothers": 30, "mates didnt make it": 35,
    "mates didn't make it": 35, "survivor guilt": 35, "should have been me": 40,
    "left behind": 30, "couldnt save them": 35, "couldn't save them": 35,
    "blood on my hands": 35, "faces i see": 30, "cant forget": 25,
    "what i did": 30, "what i saw": 25, "things i've done": 30,
    
    # Farewell language (+25-35)
    "thank you for everything": 25, "you've been great": 20,
    "take care of yourself": 20, "look after yourself": 20,
    "remember me": 35, "dont forget me": 30, "don't forget me": 30,
    "tell them i love them": 35, "tell my family": 35,
}

# Session risk tracking
session_risk_history: Dict[str, List[Dict]] = {}

def calculate_safeguarding_score(message: str, session_id: str, character_id: str = None) -> Dict[str, Any]:
    """
    Calculate safeguarding risk score using weighted indicators.
    Now includes Anthony's negation detection to reduce false positives.
    Now includes character-context awareness for appropriate exemptions.
    Returns: {score, risk_level, triggered_indicators, is_red_flag}
    """
    message_lower = message.lower()
    
    # ===== CHARACTER-CONTEXT EXEMPTIONS =====
    # Rachel (doris) is our Criminal Justice Support specialist.
    # Discussions about prison, police, arrest, etc. are NORMAL for her role.
    CRIMINAL_JUSTICE_EXEMPTIONS = {
        "prison", "arrested", "police", "probation", "been inside",
        "court case", "legal trouble", "going to prison", "assault charge",
        "fight", "got in trouble", "custody", "sentence", "release",
        "parole", "solicitor", "barrister", "trial", "charge", "offence",
        "conviction", "criminal", "jail", "remand", "bail", "magistrate"
    }
    
    # Baz is our Housing & Transition Support specialist.
    # Discussions about homelessness, eviction, etc. are NORMAL for his role.
    HOUSING_EXEMPTIONS = {
        "homeless", "homelessness", "rough sleeping", "sofa surfing",
        "evicted", "eviction", "about to lose my home", "lost my home",
        "no money", "in debt", "lost my job", "no housing",
        "sleeping rough", "on the street", "nowhere to stay",
        "council", "housing association", "temporary accommodation",
        "hostel", "shelter", "kicked out", "thrown out"
    }
    
    # Check if we should apply character-specific exemptions
    apply_cj_exemptions = character_id and character_id.lower() in ["doris", "rachel"]
    apply_housing_exemptions = character_id and character_id.lower() == "baz"
    
    # ===== NEGATION DETECTION (from Anthony's Zentrafuge system) =====
    # EXPANDED: Now includes in-sentence negation constructions to prevent false positives
    # These phrases indicate the user is NOT expressing current suicidal ideation
    NEGATION_PREFIXES = [
        "don't want to", "do not want to", "dont want to",
        "never", "not going to", "won't", "wont",
        "wouldn't", "wouldnt", "didn't", "didnt", "doesn't", "doesnt",
        "used to", "used to want to",
        "thought about", "used to think about",  
        "afraid of", "scared of", "fear",
        "wouldn't want to", "would never",
        "joking", "just joking", "only joking", "jk", "lol", "kidding",
        "not", "no longer", "not anymore",
        "friend", "my friend", "mate", "someone i know",
        "character", "movie", "book", "song", "game",
        "if i", "what if", "hypothetically",
        "i'm not", "im not", "i am not", "i dont", "i don't",
        
        # In-sentence negation constructions (CRITICAL - fixes Scenario 008)
        "not suicidal", "not going to hurt", "not going to harm",
        "not in a", "not in that", "not like that", "not that way",
        "just frustrated", "just angry", "just venting",
        "don't mean", "didn't mean", "doesn't mean",
        "not actually", "not really", "not literally",
        "wouldn't actually", "would never actually",
        "not planning", "not thinking about", "not considering",
        "no intention", "no plans to", "not intending",
        "wasn't being", "not being", "wasn't", "weren't",
        "contrary to", "opposite of", "far from",
        
        # Explicit denial phrases (ONLY when NOT preceded by meta-negation like "pretending")
        "i'm okay", "im okay", "i am okay",
        "i'm alright", "im alright", "i am alright",
        "don't worry", "no need to worry", "nothing to worry",
        "not that bad", "not as bad", "not so bad",
        "not what you think", "not what it sounds",
    ]
    NEGATION_WINDOW = 16  # Increased from 8 to catch in-sentence negations
    
    # Import the canonical is_negated from safety module (single source of truth)
    from safety.safety_monitor import is_negated
    
    # ===== TYPO CORRECTION FOR CRITICAL PATTERNS =====
    # Users in crisis often type quickly with mistakes - we must still detect
    # NOTE: Only correct actual typos, not substrings of correct words
    typo_corrections = {
        # Common "being" typos
        "beeing": "being", "bein ": "being ", "beign": "being",
        # Common "feeling" typos  
        "feeking": "feeling", "feelin ": "feeling ", "feelng": "feeling",
        # Common "here" typos
        "heere": "here", "heer": "here",
        # Common "tomorrow" typos
        "tommorow": "tomorrow", "tomorow": "tomorrow", "tomorrw": "tomorrow",
        # Common "morning" typos
        "mornig": "morning", "morining": "morning",
        # Common "anymore" typos
        "anymroe": "anymore", "anymoer": "anymore",
        # Common "point" typos
        "poitn": "point", "ponit": "point",
        # Common "myself" typos
        "myslef": "myself", "myseld": "myself",
        # Common "suicide" typos
        "suicied": "suicide", "suicde": "suicide",
    }
    
    # Apply typo corrections
    corrected_message = message_lower
    for typo, correction in typo_corrections.items():
        corrected_message = corrected_message.replace(typo, correction)
    
    # Use corrected message for detection
    message_lower = corrected_message
    
    score = 0
    triggered = []
    is_red_flag = False
    negated_indicators = []  # Track what was negated
    
    # Check RED indicators first (any single one = immediate RED)
    for indicator, weight in RED_INDICATORS.items():
        if indicator in message_lower:
            # Check for negation before flagging
            match_pos = message_lower.find(indicator)
            if is_negated(message_lower, match_pos):
                negated_indicators.append({"indicator": indicator, "reason": "negated"})
                continue  # Skip this indicator - it was negated
            
            score += weight
            triggered.append({"indicator": indicator, "weight": weight, "level": "RED"})
            is_red_flag = True
    
    # Check AMBER indicators
    amber_count = 0
    for indicator, weight in AMBER_INDICATORS.items():
        if indicator in message_lower:
            # CHARACTER-CONTEXT EXEMPTION: Skip criminal justice keywords for Rachel
            # Rachel's entire role is discussing prison, police, courts etc.
            if apply_cj_exemptions and indicator in CRIMINAL_JUSTICE_EXEMPTIONS:
                negated_indicators.append({"indicator": indicator, "reason": "rachel_cj_exemption"})
                continue  # Skip - this is normal for Rachel's criminal justice support role
            
            # CHARACTER-CONTEXT EXEMPTION: Skip housing keywords for Baz
            # Baz's entire role is discussing homelessness, eviction, housing crisis etc.
            if apply_housing_exemptions and indicator in HOUSING_EXEMPTIONS:
                negated_indicators.append({"indicator": indicator, "reason": "baz_housing_exemption"})
                continue  # Skip - this is normal for Baz's housing support role
            
            # Check for negation before flagging
            match_pos = message_lower.find(indicator)
            if is_negated(message_lower, match_pos):
                negated_indicators.append({"indicator": indicator, "reason": "negated"})
                continue  # Skip this indicator - it was negated
            
            score += weight
            triggered.append({"indicator": indicator, "weight": weight, "level": "AMBER"})
            amber_count += 1
    
    # Apply modifiers
    for pattern, weight in MODIFIER_PATTERNS.items():
        if pattern in message_lower:
            score += weight
            triggered.append({"indicator": pattern, "weight": weight, "level": "MODIFIER"})
    
    # Stackable modifier: Two or more AMBER indicators (+30)
    if amber_count >= 2:
        score += 30
        triggered.append({"indicator": "multiple_amber_indicators", "weight": 30, "level": "MODIFIER"})
    
    # Track session history for repeat indicator detection
    if session_id not in session_risk_history:
        session_risk_history[session_id] = []
    
    # Check for repeated indicators across session (+20)
    previous_indicators = set()
    for prev in session_risk_history[session_id]:
        for t in prev.get("triggered", []):
            previous_indicators.add(t["indicator"])
    
    for t in triggered:
        if t["indicator"] in previous_indicators:
            score += 20
            triggered.append({"indicator": f"repeated_{t['indicator']}", "weight": 20, "level": "MODIFIER"})
            break  # Only add once
    
    # Store this assessment in history
    session_risk_history[session_id].append({
        "message": message[:100],
        "score": score,
        "triggered": triggered,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Keep only last 20 messages per session
    if len(session_risk_history[session_id]) > 20:
        session_risk_history[session_id] = session_risk_history[session_id][-20:]
    
    # Determine risk level
    # HARD RULE: Any RED indicator = RED regardless of score
    # LOWERED thresholds for earlier detection of subtle cues
    if is_red_flag:
        risk_level = "RED"
    elif score >= 120:  # Restored from 70 — previous lowering caused false positive crisis overlays
        risk_level = "RED"
    elif score >= 80:  # Restored from 45
        risk_level = "AMBER"
    elif score >= 40:  # Restored from 25
        risk_level = "YELLOW"
    else:
        risk_level = "GREEN"
    
    return {
        "score": score,
        "risk_level": risk_level,
        "triggered_indicators": triggered,
        "is_red_flag": is_red_flag,
        "session_history_count": len(session_risk_history.get(session_id, []))
    }

def check_safeguarding(message: str, session_id: str = "default", user_id: str = "anonymous", character_id: str = None) -> tuple:
    """
    Check if message contains safeguarding concerns using BOTH:
    1. Original weighted indicator system (BACP-aligned)
    2. Enhanced Zentrafuge safety monitor (negation-aware, context multipliers)
    
    Now includes character-context awareness (e.g., Rachel's criminal justice exemptions)
    
    Returns: (should_escalate: bool, risk_data: dict)
    """
    # Original safeguarding check - now with character context
    risk_data = calculate_safeguarding_score(message, session_id, character_id)
    
    # Enhanced safety check from Zentrafuge Veteran AI Safety Layer
    enhanced_safety = assess_message_safety(message, user_id=user_id)
    
    # Merge the enhanced safety data into risk_data
    risk_data["enhanced_safety"] = enhanced_safety
    risk_data["enhanced_risk_level"] = enhanced_safety.get("risk_level", "none")
    risk_data["enhanced_triggers"] = enhanced_safety.get("specific_triggers", [])
    risk_data["intervention_type"] = enhanced_safety.get("intervention_type", "none")
    
    # Escalate if EITHER system flags concern:
    # - Original system: RED level
    # - Enhanced system: HIGH or CRITICAL
    original_escalate = risk_data["risk_level"] == "RED"
    enhanced_escalate = enhanced_safety.get("requires_intervention", False)
    
    should_escalate = original_escalate or enhanced_escalate
    
    # If enhanced system found something the original missed, log it
    if enhanced_escalate and not original_escalate:
        logging.warning(
            f"Enhanced safety monitor detected risk not caught by original: "
            f"session={session_id} level={enhanced_safety.get('risk_level')}"
        )
        # Upgrade risk level if enhanced system found higher risk
        if enhanced_safety.get("risk_level") in ["critical", "high"]:
            risk_data["risk_level"] = "RED"
            risk_data["is_red_flag"] = True
    
    return should_escalate, risk_data

# IP Geolocation lookup using ip-api.com (free, no API key required)
async def lookup_ip_geolocation(ip_address: str) -> Dict[str, Any]:
    """
    Lookup geolocation data for an IP address using ip-api.com
    Returns city, region, country, ISP, timezone, and coordinates
    """
    if not ip_address or ip_address in ["unknown", "127.0.0.1", "localhost"]:
        return {}
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"http://ip-api.com/json/{ip_address}?fields=status,city,regionName,country,isp,timezone,lat,lon")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    return {
                        "geo_city": data.get("city"),
                        "geo_region": data.get("regionName"),
                        "geo_country": data.get("country"),
                        "geo_isp": data.get("isp"),
                        "geo_timezone": data.get("timezone"),
                        "geo_lat": data.get("lat"),
                        "geo_lon": data.get("lon")
                    }
    except Exception as e:
        logging.warning(f"IP geolocation lookup failed for {ip_address}: {e}")
    
    return {}

# In-memory rate limiting and conversation history for AI Buddies
buddy_sessions: Dict[str, Dict[str, Any]] = {}
BUDDY_MAX_MESSAGES = 30
BUDDY_SESSION_TIMEOUT_MINUTES = 60

# Resend Configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "noreply@radiocheck.me")
# URL Configuration for email links
APP_URL = os.getenv("APP_URL", "https://app.radiocheck.me")  # Main user app
STAFF_PORTAL_URL = os.getenv("STAFF_PORTAL_URL", "https://staff.radiocheck.me")  # Staff portal

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

async def send_reset_email(email: str, reset_token: str):
    """Send password reset email via Resend"""
    if not RESEND_API_KEY:
        logging.warning("Resend API key not configured, skipping email")
        return False
    
    try:
        reset_link = f"{APP_URL}/reset-password?token={reset_token}"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a2332;">Password Reset Request</h2>
            <p>You have requested to reset your password for the Veterans Support portal.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="background-color: #4a90d9; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a>
            </p>
            <p style="color: #666; font-size: 14px;">Or copy this link: {reset_link}</p>
            <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
            <p style="color: #666; font-size: 14px;">If you did not request this, please ignore this email.</p>
            <br>
            <p style="color: #1a2332;">Veterans Support Team</p>
        </body>
        </html>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": "Password Reset - Veterans Support",
            "html": html_content
        }
        
        # Run sync SDK in thread to keep FastAPI non-blocking
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Password reset email sent to {email}, ID: {result.get('id')}")
        return True
    except Exception as e:
        logging.error(f"Failed to send email via Resend: {str(e)}")
        return False

async def send_safeguarding_email_notification(alert: SafeguardingAlert, risk_data: Dict = None):
    """Send urgent safeguarding alert email to admins/counsellors"""
    if not RESEND_API_KEY:
        logging.warning("Resend API key not configured, skipping safeguarding email")
        return False
    
    try:
        # Get admin notification email from settings
        settings = await db.settings.find_one({"_id": "site_settings"}, {"_id": 0})
        admin_email = settings.get("admin_notification_email", "") if settings else ""
        
        if not admin_email:
            logging.warning("No admin notification email configured for safeguarding alerts")
            return False
        
        # Determine alert colour based on risk level
        risk_level = alert.risk_level if hasattr(alert, 'risk_level') else "AMBER"
        risk_score = alert.risk_score if hasattr(alert, 'risk_score') else 0
        risk_color = "#dc2626" if risk_level == "RED" else "#f59e0b"  # Red or Amber
        
        # Format triggered indicators
        indicators_html = ""
        if risk_data and risk_data.get("triggered_indicators"):
            indicators = [t["indicator"] for t in risk_data["triggered_indicators"][:5]]
            indicators_html = f'<p style="margin: 0 0 8px 0;"><strong>Detected:</strong> {", ".join(indicators)}</p>'
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: {risk_color}; color: white; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="margin: 0;">⚠️ SAFEGUARDING ALERT - {risk_level}</h2>
                <p style="margin: 8px 0 0 0; font-size: 14px;">Risk Score: {risk_score}</p>
            </div>
            
            <p style="color: #1a2332; font-size: 16px;"><strong>A safeguarding concern has been detected in an AI Battle Buddies conversation.</strong></p>
            
            <div style="background-color: #fef2f2; border-left: 4px solid {risk_color}; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Alert ID:</strong> {alert.id}</p>
                <p style="margin: 0 0 8px 0;"><strong>Session:</strong> {alert.session_id[:8]}...</p>
                <p style="margin: 0 0 8px 0;"><strong>Character:</strong> {alert.character.capitalize()}</p>
                <p style="margin: 0 0 8px 0;"><strong>Time:</strong> {alert.created_at.strftime('%d %b %Y at %H:%M')}</p>
                {indicators_html}
            </div>
            
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-weight: bold; color: {risk_color};">Triggering Message:</p>
                <p style="margin: 0; font-style: italic; color: #374151;">"{alert.triggering_message}"</p>
            </div>
            
            <p style="color: #666;">The user has been shown support options including crisis helplines and the option to speak with a real person.</p>
            
            <p style="text-align: center; margin: 30px 0;">
                <a href="{STAFF_PORTAL_URL}" style="background-color: {risk_color}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">View in Staff Portal</a>
            </p>
            
            <p style="color: #666; font-size: 12px;">This is an automated safeguarding notification from Radio Check Veterans Support.</p>
        </body>
        </html>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [admin_email],
            "subject": f"⚠️ URGENT: Safeguarding Alert [{risk_level}] - Radio Check",
            "html": html_content
        }
        
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Safeguarding alert email sent, ID: {result.get('id')}")
        return True
    except Exception as e:
        logging.error(f"Failed to send safeguarding email: {str(e)}")
        return False

# ============ AUTH FUNCTIONS ============

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

async def send_shift_notification_email(shift_data: dict, staff_email: str, notification_type: str = "created"):
    """Send email notification when shift is created/updated/deleted"""
    if not RESEND_API_KEY or not staff_email:
        logging.info(f"Skipping shift email notification (API key: {bool(RESEND_API_KEY)}, email: {bool(staff_email)})")
        return False
    
    try:
        date_formatted = shift_data.get('date', '')
        start_time = shift_data.get('start_time', '')
        end_time = shift_data.get('end_time', '')
        staff_name = shift_data.get('staff_name', 'Staff member')
        
        if notification_type == "created":
            subject = f"Shift Confirmed - {date_formatted}"
            action_text = "Your shift has been confirmed"
            color = "#22c55e"  # Green
        elif notification_type == "updated":
            subject = f"Shift Updated - {date_formatted}"
            action_text = "Your shift has been updated"
            color = "#f59e0b"  # Amber
        else:
            subject = f"Shift Cancelled - {date_formatted}"
            action_text = "Your shift has been cancelled"
            color = "#ef4444"  # Red
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="background-color: {color}; color: white; display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px;">
                        Radio Check Rota
                    </div>
                </div>
                
                <h2 style="color: #1e293b; margin: 0 0 8px 0; text-align: center;">{action_text}</h2>
                <p style="color: #64748b; text-align: center; margin: 0 0 24px 0;">Hi {staff_name}</p>
                
                <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; width: 100px;">Date:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{date_formatted}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;">Time:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">{start_time} - {end_time}</td>
                        </tr>
                    </table>
                </div>
                
                <p style="color: #64748b; font-size: 14px; text-align: center; margin: 0;">
                    Please ensure you're available to support our veterans during this time.
                </p>
            </div>
            
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
                Radio Check Veterans Support • Peer Support Network
            </p>
        </body>
        </html>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [staff_email],
            "subject": subject,
            "html": html_content,
        }
        
        resend.Emails.send(params)
        logging.info(f"Shift notification email sent to {staff_email}")
        return True
    except Exception as e:
        logging.error(f"Failed to send shift notification email: {str(e)}")
        return False

def create_access_token(data: dict) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, get_jwt_secret(), algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current authenticated user from JWT token - checks staff collection first, then legacy users"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        # FIRST: Check unified staff collection (new system)
        # Check by id first, then by legacy_user_id (for tokens issued before migration)
        staff = await db.staff.find_one({"id": user_id})
        if not staff:
            staff = await db.staff.find_one({"legacy_user_id": user_id})
        
        if staff:
            # Decrypt the name before returning
            decrypted_name = staff.get("name", "")
            try:
                if decrypted_name and decrypted_name.startswith("ENC"):
                    decrypted_name = decrypt_field(decrypted_name)
            except Exception as e:
                logging.warning(f"Failed to decrypt staff name: {e}")
                decrypted_name = staff.get("name", "")
            
            return User(
                id=staff.get("id"),
                email=staff["email"],
                role=staff.get("role", "user"),
                name=decrypted_name
            )
        
        # FALLBACK: Check legacy users collection
        # Try 'id' field first, then '_id' for older users
        user_data = await db.users.find_one({"id": user_id})
        if user_data is None:
            # Try ObjectId lookup for older users that don't have 'id' field
            from bson import ObjectId
            try:
                user_data = await db.users.find_one({"_id": ObjectId(user_id)})
            except:
                pass
        
        if user_data is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Ensure we have an 'id' field for the User model
        if 'id' not in user_data:
            user_data['id'] = str(user_data.get('_id', user_id))
        
        # Decrypt name if encrypted
        if user_data.get('name') and str(user_data.get('name', '')).startswith("ENC"):
            try:
                user_data['name'] = decrypt_field(user_data['name'])
            except Exception as e:
                logging.warning(f"Failed to decrypt user name: {e}")
        
        return User(**user_data)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception as e:
        # Catch all JWT-related errors
        raise HTTPException(status_code=401, detail="Could not validate credentials")

def require_role(*required_roles: str):
    """Dependency to check if user has one of the required roles"""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in required_roles and current_user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {', '.join(required_roles)}"
            )
        return current_user
    return role_checker


# [MIGRATED TO ROUTERS - # ============ AUTH ENDPOINTS ============]



@api_router.get("/admin/unified-staff")
async def get_unified_staff(current_user: User = Depends(require_role("admin"))):
    """Get all staff (counsellors and peers) with their user accounts in unified view"""
    # Get all users
    users = await db.users.find().to_list(1000)
    # Get all counsellors and peers
    counsellors = await db.counsellors.find().to_list(1000)
    peers = await db.peer_supporters.find().to_list(1000)
    
    # Decrypt profiles
    counsellors = [decrypt_document("counsellors", c) for c in counsellors]
    peers = [decrypt_document("peer_supporters", p) for p in peers]
    
    # Build lookup maps
    counsellor_by_user = {c.get("user_id"): c for c in counsellors if c.get("user_id")}
    peer_by_user = {p.get("user_id"): p for p in peers if p.get("user_id")}
    
    unified = []
    for user in users:
        user_id = user.get("id")
        role = user.get("role")
        
        staff_entry = {
            "user_id": user_id,
            "email": user.get("email"),
            "name": user.get("name"),
            "role": role,
            "created_at": user.get("created_at"),
            "has_profile": False,
            "profile": None
        }
        
        if role == "counsellor" and user_id in counsellor_by_user:
            profile = counsellor_by_user[user_id]
            staff_entry["has_profile"] = True
            staff_entry["profile"] = {
                "id": profile.get("id"),
                "specialization": profile.get("specialization"),
                "status": profile.get("status"),
                "phone": profile.get("phone"),
                "sms": profile.get("sms"),
                "whatsapp": profile.get("whatsapp"),
                "sip_extension": profile.get("sip_extension")
            }
        elif role == "peer" and user_id in peer_by_user:
            profile = peer_by_user[user_id]
            staff_entry["has_profile"] = True
            staff_entry["profile"] = {
                "id": profile.get("id"),
                "area": profile.get("area"),
                "background": profile.get("background"),
                "yearsServed": profile.get("yearsServed"),
                "status": profile.get("status"),
                "phone": profile.get("phone"),
                "sms": profile.get("sms"),
                "whatsapp": profile.get("whatsapp"),
                "sip_extension": profile.get("sip_extension")
            }
        elif role == "admin":
            staff_entry["has_profile"] = True  # Admins don't need profiles
            
        unified.append(staff_entry)
    
    return unified

@api_router.post("/admin/fix-missing-profiles")
async def fix_missing_profiles(current_user: User = Depends(require_role("admin"))):
    """Create missing profiles for counsellor/peer/supervisor users that don't have one"""
    users = await db.users.find({"role": {"$in": ["counsellor", "peer", "supervisor"]}}).to_list(1000)
    
    fixed_count = 0
    already_linked = 0
    skipped_no_id = 0
    
    for user in users:
        # Handle both 'id' and 'user_id' field names for compatibility
        user_id = user.get("id") or user.get("user_id")
        if not user_id:
            skipped_no_id += 1
            logging.warning(f"User {user.get('email')} has no id field, skipping")
            continue
            
        role = user.get("role")
        name = user.get("name", "Unknown")
        
        if role == "counsellor":
            # Check if profile exists
            existing = await db.counsellors.find_one({"user_id": user_id})
            if not existing:
                counsellor_data = {
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "specialization": "General Support",
                    "status": "off",
                    "next_available": None,
                    "phone": "",
                    "sms": None,
                    "whatsapp": None,
                    "user_id": user_id,
                    "sip_extension": None,
                    "sip_password": None,
                    "created_at": datetime.utcnow()
                }
                counsellor_data = encrypt_document("counsellors", counsellor_data)
                await db.counsellors.insert_one(counsellor_data)
                fixed_count += 1
                logging.info(f"Created missing counsellor profile for user {user_id}")
            else:
                already_linked += 1
                
        elif role == "peer":
            existing = await db.peer_supporters.find_one({"user_id": user_id})
            if not existing:
                peer_data = {
                    "id": str(uuid.uuid4()),
                    "firstName": name,
                    "area": "General",
                    "background": "Veteran",
                    "yearsServed": "N/A",
                    "status": "unavailable",
                    "phone": "",
                    "sms": None,
                    "whatsapp": None,
                    "user_id": user_id,
                    "sip_extension": None,
                    "sip_password": None,
                    "created_at": datetime.utcnow()
                }
                peer_data = encrypt_document("peer_supporters", peer_data)
                await db.peer_supporters.insert_one(peer_data)
                fixed_count += 1
                logging.info(f"Created missing peer supporter profile for user {user_id}")
            else:
                already_linked += 1
        
        elif role == "supervisor":
            # Supervisors use counsellor profiles with elevated permissions
            existing = await db.counsellors.find_one({"user_id": user_id})
            if not existing:
                supervisor_profile = {
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "specialization": "Clinical Supervision",
                    "status": "off",
                    "next_available": None,
                    "phone": "",
                    "sms": None,
                    "whatsapp": None,
                    "user_id": user_id,
                    "sip_extension": None,
                    "sip_password": None,
                    "created_at": datetime.utcnow()
                }
                supervisor_profile = encrypt_document("counsellors", supervisor_profile)
                await db.counsellors.insert_one(supervisor_profile)
                fixed_count += 1
                logging.info(f"Created missing supervisor profile for user {user_id}")
            else:
                already_linked += 1
    
    return {
        "message": f"Fixed {fixed_count} missing profiles. {already_linked} were already linked." + (f" {skipped_no_id} skipped (no user ID)." if skipped_no_id > 0 else ""),
        "fixed": fixed_count,
        "already_linked": already_linked,
        "skipped_no_id": skipped_no_id
    }

class ClearLogsRequest(BaseModel):
    log_type: str  # 'safeguarding', 'calls', 'chats', 'analytics', 'all'
    confirm: bool = False

@api_router.post("/admin/clear-logs")
async def clear_logs_for_testing(request: ClearLogsRequest, current_user: User = Depends(require_role("admin"))):
    """
    Clear logs/data for testing purposes. ADMIN ONLY.
    Use with caution - this permanently deletes data!
    """
    if not request.confirm:
        return {"error": "Please set confirm=true to proceed with deletion"}
    
    results = {}
    
    if request.log_type in ['safeguarding', 'all']:
        result = await db.safeguarding_alerts.delete_many({})
        results['safeguarding_alerts'] = result.deleted_count
    
    if request.log_type in ['calls', 'all']:
        result = await db.call_logs.delete_many({})
        results['call_logs'] = result.deleted_count
    
    if request.log_type in ['chats', 'all']:
        result = await db.chat_logs.delete_many({})
        results['chat_logs'] = result.deleted_count
        # Also clear live chat rooms
        result2 = await db.live_chat_rooms.delete_many({})
        results['live_chat_rooms'] = result2.deleted_count
    
    if request.log_type in ['analytics', 'all']:
        result = await db.app_visits.delete_many({})
        results['app_visits'] = result.deleted_count
        result2 = await db.active_sessions.delete_many({})
        results['active_sessions'] = result2.deleted_count
    
    if request.log_type in ['callbacks', 'all']:
        result = await db.callback_requests.delete_many({})
        results['callback_requests'] = result.deleted_count
    
    if request.log_type in ['panic', 'all']:
        result = await db.panic_alerts.delete_many({})
        results['panic_alerts'] = result.deleted_count
    
    if request.log_type in ['screening', 'all']:
        result = await db.screening_submissions.delete_many({})
        results['screening_submissions'] = result.deleted_count
    
    logging.warning(f"ADMIN {current_user.email} cleared logs: {request.log_type} - Results: {results}")
    
    return {
        "message": f"Cleared {request.log_type} logs",
        "deleted": results
    }


# =============================================================================
# UNIFIED STAFF API ENDPOINTS
# =============================================================================
# These replace the old separate /counsellors and /peer-supporters endpoints.
# The old endpoints are kept for backward compatibility during migration.
# TODO: Remove old endpoints after migration is complete.
# =============================================================================

@api_router.post("/staff", response_model=dict)
async def create_staff(staff_data: StaffCreate, current_user: User = Depends(require_role("admin"))):
    """
    Create a new staff member with unified profile.
    This is the NEW way to create staff - creates both auth and profile in one step.
    """
    # Check if email already exists
    existing = await db.staff.find_one({"email": staff_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Also check legacy users collection for duplicates
    legacy_user = await db.users.find_one({"email": staff_data.email})
    if legacy_user:
        raise HTTPException(status_code=400, detail="Email already exists in legacy users. Please migrate first.")
    
    # Create the unified staff document
    staff_doc = {
        "id": str(uuid.uuid4()),
        "email": staff_data.email,
        "password_hash": hash_password(staff_data.password),
        "role": staff_data.role,
        "name": staff_data.name,
        "status": "unavailable",
        "next_available": None,
        "phone": staff_data.phone or "",
        "sms": staff_data.sms,
        "whatsapp": staff_data.whatsapp,
        "specialization": staff_data.specialization or ("General Support" if staff_data.role in ["counsellor", "supervisor"] else None),
        "area": staff_data.area or ("General" if staff_data.role == "peer" else None),
        "background": staff_data.background,
        "years_served": staff_data.years_served,
        "sip_extension": staff_data.sip_extension,
        "sip_password": encrypt_field(staff_data.sip_password) if staff_data.sip_password else None,
        "is_supervisor": staff_data.is_supervisor or staff_data.role == "supervisor",
        "created_at": datetime.utcnow(),
        "updated_at": None,
        "last_login": None,
        "legacy_user_id": None,
        "legacy_profile_id": None
    }
    
    await db.staff.insert_one(staff_doc)
    
    # Remove password_hash from response
    staff_doc.pop("password_hash", None)
    staff_doc.pop("_id", None)
    
    # Audit log: admin created staff member
    await audit_admin_action(
        db,
        user_id=current_user.id,
        email=current_user.email,
        action="user_created",
        details={"new_user_email": staff_data.email, "role": staff_data.role}
    )
    
    logging.info(f"Created new staff member: {staff_data.email} ({staff_data.role})")
    
    return {"message": "Staff member created successfully", "staff": staff_doc}

@api_router.get("/staff", response_model=List[dict])
async def get_all_staff(
    role: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get all staff members from the unified staff collection.
    Optionally filter by role or status.
    """
    query = {}
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    
    staff_list = await db.staff.find(query).to_list(1000)
    
    # Remove sensitive fields and decrypt names
    for staff in staff_list:
        staff.pop("password_hash", None)
        staff.pop("_id", None)
        staff.pop("sip_password", None)
        # Decrypt name if encrypted
        if staff.get("name") and str(staff.get("name")).startswith("ENC:"):
            staff["name"] = decrypt_field(staff["name"])
    
    return staff_list

@api_router.get("/staff/me", response_model=dict)
async def get_my_staff_profile(current_user: User = Depends(get_current_user)):
    """
    Get the current user's staff profile from the unified collection.
    This is the NEW profile endpoint for the staff portal.
    
    CRITICAL: Returns callable_user_id which is the ID that mobile apps use
    to call this staff member via WebRTC. Staff portal MUST register with
    this ID on Socket.IO for calls to work.
    """
    # First try unified staff collection
    staff = await db.staff.find_one({"email": current_user.email})
    
    if staff:
        staff.pop("password_hash", None)
        staff.pop("_id", None)
        staff.pop("sip_password", None)
        # Decrypt name if encrypted
        if staff.get("name") and str(staff.get("name")).startswith("ENC:"):
            staff["name"] = decrypt_field(staff["name"])
        
        # CRITICAL: Find the callable_user_id - the ID that mobile apps use for WebRTC calls
        # Without this correct ID, calls will fail with "user_offline"
        # 
        # Priority order:
        # 1. legacy_user_id (already stored in staff record, links to peer_supporters.user_id)
        # 2. Look up peer_supporters/counsellors by legacy_profile_id
        # 3. Fall back to staff.id
        
        callable_user_id = None
        
        # FIRST: Check if legacy_user_id exists - this is the most reliable
        if staff.get("legacy_user_id"):
            callable_user_id = staff["legacy_user_id"]
        
        # SECOND: If no legacy_user_id, try to look up the profile by legacy_profile_id
        if not callable_user_id and staff.get("legacy_profile_id"):
            profile_id = staff["legacy_profile_id"]
            role = staff.get("role")
            
            if role == "counsellor":
                profile = await db.counsellors.find_one({"id": profile_id})
                if profile and profile.get("user_id"):
                    callable_user_id = profile["user_id"]
            elif role in ["peer", "peer_supporter"]:
                profile = await db.peer_supporters.find_one({"id": profile_id})
                if profile and profile.get("user_id"):
                    callable_user_id = profile["user_id"]
        
        # THIRD: Fall back to staff.id if nothing else found
        if not callable_user_id:
            callable_user_id = staff.get("id")
        
        staff["callable_user_id"] = callable_user_id
        return staff
    
    # Fallback: Build profile from legacy collections (users + counsellors/peers)
    # This supports staff who haven't been migrated yet
    user = await db.users.find_one({"email": current_user.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = user.get("id") or str(user.get("_id"))
    role = user.get("role")
    
    # Try to find linked profile
    profile = None
    callable_user_id = user_id  # Default
    if role in ["counsellor", "supervisor"]:
        profile = await db.counsellors.find_one({"user_id": user_id})
        if profile:
            profile = decrypt_document("counsellors", profile)
            callable_user_id = profile.get("user_id") or user_id
    elif role == "peer":
        profile = await db.peer_supporters.find_one({"user_id": user_id})
        if profile:
            profile = decrypt_document("peer_supporters", profile)
            callable_user_id = profile.get("user_id") or user_id
    
    if profile:
        # Build unified response from legacy data
        return {
            "id": profile.get("id") or str(profile.get("_id")),
            "email": user.get("email"),
            "role": role,
            "name": profile.get("name") or profile.get("firstName") or user.get("name"),
            "status": profile.get("status", "unavailable"),
            "phone": profile.get("phone"),
            "specialization": profile.get("specialization"),
            "area": profile.get("area"),
            "background": profile.get("background"),
            "years_served": profile.get("yearsServed"),
            "is_supervisor": role == "supervisor",
            "legacy_user_id": user_id,
            "legacy_profile_id": profile.get("id") or str(profile.get("_id")),
            "callable_user_id": callable_user_id,  # The ID for WebRTC calls
            "_source": "legacy"  # Indicates this came from old collections
        }
    
    # User exists but has no profile - return basic info
    return {
        "id": user_id,
        "email": user.get("email"),
        "role": role,
        "name": user.get("name"),
        "status": "unavailable",
        "has_profile": False,
        "callable_user_id": user_id,
        "_source": "legacy_no_profile"
    }

@api_router.get("/staff/{staff_id}", response_model=dict)
async def get_staff_by_id(staff_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific staff member by ID"""
    staff = await db.staff.find_one({"id": staff_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    staff.pop("password_hash", None)
    staff.pop("_id", None)
    staff.pop("sip_password", None)
    
    return staff

@api_router.patch("/staff/{staff_id}", response_model=dict)
async def update_staff(
    staff_id: str,
    update_data: StaffUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update staff member details"""
    staff = await db.staff.find_one({"id": staff_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Check permissions - admin can update anyone, others can only update themselves
    if current_user.role != "admin" and staff.get("email") != current_user.email:
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")
    
    # Build update document
    update_doc = {"updated_at": datetime.utcnow()}
    for field, value in update_data.model_dump(exclude_unset=True).items():
        if field == "sip_password" and value:
            update_doc[field] = encrypt_field(value)
        else:
            update_doc[field] = value
    
    await db.staff.update_one({"id": staff_id}, {"$set": update_doc})
    
    updated = await db.staff.find_one({"id": staff_id})
    updated.pop("password_hash", None)
    updated.pop("_id", None)
    updated.pop("sip_password", None)
    
    return updated

@api_router.patch("/staff/{staff_id}/status", response_model=dict)
async def update_staff_status(
    staff_id: str,
    status_update: StaffStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update staff member status"""
    staff = await db.staff.find_one({"id": staff_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Check permissions
    if current_user.role != "admin" and staff.get("email") != current_user.email:
        raise HTTPException(status_code=403, detail="Not authorized to update this status")
    
    update_doc = {
        "status": status_update.status,
        "updated_at": datetime.utcnow()
    }
    if status_update.next_available:
        update_doc["next_available"] = status_update.next_available
    
    await db.staff.update_one({"id": staff_id}, {"$set": update_doc})
    
    updated = await db.staff.find_one({"id": staff_id})
    updated.pop("password_hash", None)
    updated.pop("_id", None)
    
    return {"message": "Status updated", "status": updated.get("status")}

@api_router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, current_user: User = Depends(require_role("admin"))):
    """Delete a staff member (admin only)"""
    # Get staff info before deletion for audit log
    staff = await db.staff.find_one({"id": staff_id}, {"_id": 0, "email": 1, "role": 1, "name": 1})
    
    result = await db.staff.delete_one({"id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Audit log: admin deleted staff member
    await audit_admin_action(
        db,
        user_id=current_user.id,
        email=current_user.email,
        action="user_deleted",
        details={"deleted_user_id": staff_id, "deleted_user_email": staff.get("email") if staff else "unknown"}
    )
    
    return {"message": "Staff member deleted"}

# =============================================================================
# MIGRATION ENDPOINTS
# =============================================================================

@api_router.post("/admin/migrate-to-unified-staff")
async def migrate_to_unified_staff(current_user: User = Depends(require_role("admin"))):
    """
    Migrate all data from legacy collections (users, counsellors, peer_supporters)
    to the new unified staff collection.
    
    This is IDEMPOTENT - can be run multiple times safely.
    Already migrated users will be skipped.
    """
    stats = {
        "users_processed": 0,
        "staff_created": 0,
        "already_migrated": 0,
        "errors": [],
        "details": []
    }
    
    # Get all legacy users
    users = await db.users.find().to_list(1000)
    
    # Build lookup maps for profiles
    counsellors_by_user_id = {}
    peers_by_user_id = {}
    
    async for c in db.counsellors.find():
        if c.get("user_id"):
            counsellors_by_user_id[c["user_id"]] = c
    
    async for p in db.peer_supporters.find():
        if p.get("user_id"):
            peers_by_user_id[p["user_id"]] = p
    
    for user in users:
        stats["users_processed"] += 1
        
        user_id = user.get("id") or str(user.get("_id"))
        email = user.get("email")
        role = user.get("role")
        name = user.get("name", "Unknown")
        
        # Check if already migrated
        existing = await db.staff.find_one({"email": email})
        if existing:
            stats["already_migrated"] += 1
            continue
        
        try:
            # Find linked profile
            profile = None
            if role in ["counsellor", "supervisor"]:
                profile = counsellors_by_user_id.get(user_id)
            elif role == "peer":
                profile = peers_by_user_id.get(user_id)
            
            # Build unified staff document
            staff_doc = {
                "id": str(uuid.uuid4()),
                "email": email,
                "password_hash": user.get("hashed_password") or user.get("password_hash", ""),  # Support both field names
                "role": role,
                "name": profile.get("name") or profile.get("firstName") or name if profile else name,
                "status": profile.get("status", "unavailable") if profile else "unavailable",
                "next_available": profile.get("next_available") if profile else None,
                "phone": profile.get("phone", "") if profile else "",
                "sms": profile.get("sms") if profile else None,
                "whatsapp": profile.get("whatsapp") if profile else None,
                "specialization": profile.get("specialization") if profile else None,
                "area": profile.get("area") if profile else None,
                "background": profile.get("background") if profile else None,
                "years_served": profile.get("yearsServed") if profile else None,
                "sip_extension": profile.get("sip_extension") if profile else None,
                "sip_password": profile.get("sip_password") if profile else None,  # Already encrypted
                "is_supervisor": role == "supervisor",
                "created_at": user.get("created_at", datetime.utcnow()),
                "updated_at": None,
                "last_login": None,
                "legacy_user_id": user_id,
                "legacy_profile_id": profile.get("id") or str(profile.get("_id")) if profile else None
            }
            
            await db.staff.insert_one(staff_doc)
            stats["staff_created"] += 1
            stats["details"].append({
                "email": email,
                "role": role,
                "had_profile": profile is not None
            })
            
        except Exception as e:
            stats["errors"].append({"email": email, "error": str(e)})
            logging.error(f"Error migrating user {email}: {e}")
    
    # Also migrate orphan counsellors/peers that have no user linked
    orphan_counsellors = await db.counsellors.find({"$or": [{"user_id": None}, {"user_id": {"$exists": False}}]}).to_list(1000)
    for c in orphan_counsellors:
        # Create a placeholder email for orphan profiles
        email = f"orphan_counsellor_{c.get('id', str(c.get('_id')))}@placeholder.local"
        existing = await db.staff.find_one({"legacy_profile_id": c.get("id") or str(c.get("_id"))})
        if existing:
            continue
        
        try:
            staff_doc = {
                "id": str(uuid.uuid4()),
                "email": email,
                "password_hash": "",  # No password - needs to be set
                "role": "counsellor",
                "name": c.get("name", "Unknown Counsellor"),
                "status": c.get("status", "unavailable"),
                "phone": c.get("phone", ""),
                "specialization": c.get("specialization"),
                "sip_extension": c.get("sip_extension"),
                "sip_password": c.get("sip_password"),
                "is_supervisor": False,
                "created_at": c.get("created_at", datetime.utcnow()),
                "legacy_user_id": None,
                "legacy_profile_id": c.get("id") or str(c.get("_id")),
                "_orphan": True  # Flag as orphan for review
            }
            await db.staff.insert_one(staff_doc)
            stats["staff_created"] += 1
            stats["details"].append({"email": email, "role": "counsellor", "orphan": True})
        except Exception as e:
            stats["errors"].append({"email": email, "error": str(e)})
    
    orphan_peers = await db.peer_supporters.find({"$or": [{"user_id": None}, {"user_id": {"$exists": False}}]}).to_list(1000)
    for p in orphan_peers:
        email = f"orphan_peer_{p.get('id', str(p.get('_id')))}@placeholder.local"
        existing = await db.staff.find_one({"legacy_profile_id": p.get("id") or str(p.get("_id"))})
        if existing:
            continue
        
        try:
            staff_doc = {
                "id": str(uuid.uuid4()),
                "email": email,
                "password_hash": "",
                "role": "peer",
                "name": p.get("firstName", "Unknown Peer"),
                "status": p.get("status", "unavailable"),
                "phone": p.get("phone", ""),
                "area": p.get("area"),
                "background": p.get("background"),
                "years_served": p.get("yearsServed"),
                "sip_extension": p.get("sip_extension"),
                "sip_password": p.get("sip_password"),
                "is_supervisor": False,
                "created_at": p.get("created_at", datetime.utcnow()),
                "legacy_user_id": None,
                "legacy_profile_id": p.get("id") or str(p.get("_id")),
                "_orphan": True
            }
            await db.staff.insert_one(staff_doc)
            stats["staff_created"] += 1
            stats["details"].append({"email": email, "role": "peer", "orphan": True})
        except Exception as e:
            stats["errors"].append({"email": email, "error": str(e)})
    
    logging.info(f"Migration completed: {stats}")
    
    return {
        "message": "Migration completed",
        "stats": stats
    }

@api_router.get("/admin/migration-status")
async def get_migration_status(current_user: User = Depends(require_role("admin"))):
    """Check the status of the staff migration"""
    legacy_users = await db.users.count_documents({})
    legacy_counsellors = await db.counsellors.count_documents({})
    legacy_peers = await db.peer_supporters.count_documents({})
    unified_staff = await db.staff.count_documents({})
    
    # Count migrated (have legacy_user_id or legacy_profile_id)
    migrated = await db.staff.count_documents({
        "$or": [
            {"legacy_user_id": {"$ne": None}},
            {"legacy_profile_id": {"$ne": None}}
        ]
    })
    
    # Count orphans
    orphans = await db.staff.count_documents({"_orphan": True})
    
    return {
        "legacy_counts": {
            "users": legacy_users,
            "counsellors": legacy_counsellors,
            "peer_supporters": legacy_peers
        },
        "unified_staff_count": unified_staff,
        "migrated_count": migrated,
        "orphan_count": orphans,
        "migration_complete": unified_staff > 0 and migrated >= legacy_users
    }



@api_router.post("/admin/fix-staff-passwords")
async def fix_staff_passwords(current_user: User = Depends(require_role("admin"))):
    """
    Fix password hashes for migrated staff who have empty passwords.
    Copies the correct password hash from the legacy users collection.
    """
    stats = {
        "checked": 0,
        "fixed": 0,
        "errors": []
    }
    
    # Find all staff with empty or missing password_hash
    staff_to_fix = await db.staff.find({
        "$or": [
            {"password_hash": ""},
            {"password_hash": None},
            {"password_hash": {"$exists": False}}
        ],
        "legacy_user_id": {"$ne": None}  # Only fix migrated users
    }).to_list(1000)
    
    for staff in staff_to_fix:
        stats["checked"] += 1
        legacy_user_id = staff.get("legacy_user_id")
        
        if not legacy_user_id:
            continue
        
        # Find the legacy user
        legacy_user = await db.users.find_one({"id": legacy_user_id})
        if not legacy_user:
            # Try by _id
            from bson import ObjectId
            try:
                legacy_user = await db.users.find_one({"_id": ObjectId(legacy_user_id)})
            except:
                pass
        
        if not legacy_user:
            stats["errors"].append({"email": staff.get("email"), "error": "Legacy user not found"})
            continue
        
        # Get password hash - check both field names
        password_hash = legacy_user.get("hashed_password") or legacy_user.get("password_hash")
        
        if password_hash:
            await db.staff.update_one(
                {"id": staff.get("id")},
                {"$set": {"password_hash": password_hash}}
            )
            stats["fixed"] += 1
        else:
            stats["errors"].append({"email": staff.get("email"), "error": "No password hash in legacy user"})
    
    return {
        "message": "Password fix completed",
        "stats": stats
    }




class CreateUsersForStaffRequest(BaseModel):
    default_password: str = "TempPassword123!"

@api_router.post("/admin/create-users-for-unlinked-staff")
async def create_users_for_unlinked_staff(
    request: CreateUsersForStaffRequest,
    current_user: User = Depends(require_role("admin"))
):
    """
    Create user accounts for staff profiles (counsellors/peers) that don't have linked users.
    This is needed for WebRTC calling to work - staff need user_ids for signaling.
    """
    created_users = []
    already_linked = 0
    errors = []
    
    # Process counsellors without user_id
    counsellors = await db.counsellors.find({"$or": [{"user_id": None}, {"user_id": {"$exists": False}}]}).to_list(1000)
    for counsellor in counsellors:
        counsellor = decrypt_document("counsellors", counsellor)
        name = counsellor.get("name", "Unknown Counsellor")
        counsellor_id = counsellor.get("id")
        
        # Generate email from name
        safe_name = name.lower().replace(" ", ".").replace(".", "")[:20]
        email = f"{safe_name}.counsellor@radiocheck.me"
        
        # Check if email already exists
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            # Try with a suffix
            email = f"{safe_name}.{counsellor_id[:8]}@radiocheck.local"
            existing_user = await db.users.find_one({"email": email})
            if existing_user:
                errors.append(f"Could not create user for {name} - email conflict")
                continue
        
        try:
            # Create user account
            user_id = str(uuid.uuid4())
            user_data = {
                "id": user_id,
                "email": email,
                "role": "counsellor",
                "name": name,
                "password_hash": hash_password(request.default_password),
                "created_at": datetime.utcnow()
            }
            await db.users.insert_one(user_data)
            
            # Link to counsellor profile
            await db.counsellors.update_one(
                {"id": counsellor_id},
                {"$set": {"user_id": user_id}}
            )
            
            created_users.append({
                "name": name,
                "email": email,
                "role": "counsellor",
                "user_id": user_id,
                "profile_id": counsellor_id
            })
            logging.info(f"Created user account for counsellor {name} ({email})")
        except Exception as e:
            errors.append(f"Failed to create user for {name}: {str(e)}")
    
    # Process peer supporters without user_id
    peers = await db.peer_supporters.find({"$or": [{"user_id": None}, {"user_id": {"$exists": False}}]}).to_list(1000)
    for peer in peers:
        peer = decrypt_document("peer_supporters", peer)
        name = peer.get("firstName", "Unknown Peer")
        peer_id = peer.get("id")
        
        # Generate email from name
        safe_name = name.lower().replace(" ", ".").replace(".", "")[:20]
        email = f"{safe_name}.peer@radiocheck.me"
        
        # Check if email already exists
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            # Try with a suffix
            email = f"{safe_name}.{peer_id[:8]}@radiocheck.local"
            existing_user = await db.users.find_one({"email": email})
            if existing_user:
                errors.append(f"Could not create user for {name} - email conflict")
                continue
        
        try:
            # Create user account
            user_id = str(uuid.uuid4())
            user_data = {
                "id": user_id,
                "email": email,
                "role": "peer",
                "name": name,
                "password_hash": hash_password(request.default_password),
                "created_at": datetime.utcnow()
            }
            await db.users.insert_one(user_data)
            
            # Link to peer profile
            await db.peer_supporters.update_one(
                {"id": peer_id},
                {"$set": {"user_id": user_id}}
            )
            
            created_users.append({
                "name": name,
                "email": email,
                "role": "peer",
                "user_id": user_id,
                "profile_id": peer_id
            })
            logging.info(f"Created user account for peer supporter {name} ({email})")
        except Exception as e:
            errors.append(f"Failed to create user for {name}: {str(e)}")
    
    return {
        "message": f"Created {len(created_users)} user accounts for unlinked staff profiles.",
        "created_users": created_users,
        "already_linked": already_linked,
        "errors": errors,
        "note": f"Default password for new accounts: {request.default_password} - Please change these!"
    }


# [MIGRATED TO ROUTERS - @api_router.delete("/auth/users/{user_id}")]


# ============ CMS CONTENT ENDPOINTS ============

@api_router.get("/content/{page_name}")
async def get_page_content(page_name: str):
    """Get all content for a page (public)"""
    content = await db.page_content.find({"page_name": page_name}).to_list(100)
    return {item["section"]: item["content"] for item in content}

@api_router.get("/content")
async def get_all_content():
    """Get all CMS content (public)"""
    content = await db.page_content.find().to_list(500)
    result = {}
    for item in content:
        if item["page_name"] not in result:
            result[item["page_name"]] = {}
        result[item["page_name"]][item["section"]] = item["content"]
    return result

@api_router.put("/content/{page_name}/{section}")
async def update_page_content(
    page_name: str,
    section: str,
    content_data: PageContentUpdate,
    current_user: User = Depends(require_role("admin"))
):
    """Update page content (admin only)"""
    existing = await db.page_content.find_one({
        "page_name": page_name,
        "section": section
    })
    
    if existing:
        await db.page_content.update_one(
            {"page_name": page_name, "section": section},
            {"$set": {
                "content": content_data.content,
                "updated_at": datetime.utcnow(),
                "updated_by": current_user.email
            }}
        )
    else:
        content_obj = PageContent(
            page_name=page_name,
            section=section,
            content=content_data.content,
            updated_by=current_user.email
        )
        await db.page_content.insert_one(content_obj.dict())
    
    return {"message": "Content updated successfully"}

@api_router.post("/content/seed")
async def seed_default_content(current_user: User = Depends(require_role("admin"))):
    """Seed default CMS content (admin only)"""
    default_content = [
        # Home page
        {"page_name": "home", "section": "title", "content": "Veterans Support"},
        {"page_name": "home", "section": "tagline_english", "content": "Once in service, forever united"},
        {"page_name": "home", "section": "tagline_latin", "content": "Semel Servientes, Semper Uniti"},
        {"page_name": "home", "section": "emergency_title", "content": "Immediate Danger?"},
        {"page_name": "home", "section": "emergency_text", "content": "Call 999 for emergency services"},
        {"page_name": "home", "section": "help_button", "content": "I NEED HELP NOW"},
        {"page_name": "home", "section": "help_subtext", "content": "24/7 Crisis Support"},
        {"page_name": "home", "section": "peer_button", "content": "Talk to Another Veteran"},
        {"page_name": "home", "section": "hiat_button", "content": "Issues Related to Historical Investigations"},
        {"page_name": "home", "section": "orgs_button", "content": "Support Organisations"},
        {"page_name": "home", "section": "disclaimer", "content": "This app is not an emergency service. For immediate danger, always call 999."},
        
        # Crisis support page
        {"page_name": "crisis-support", "section": "title", "content": "Crisis Support"},
        {"page_name": "crisis-support", "section": "subtitle", "content": "Help is available 24/7"},
        {"page_name": "crisis-support", "section": "samaritans_name", "content": "Samaritans"},
        {"page_name": "crisis-support", "section": "samaritans_desc", "content": "Free 24/7 support for anyone in distress"},
        {"page_name": "crisis-support", "section": "samaritans_phone", "content": "116 123"},
        {"page_name": "crisis-support", "section": "combat_stress_name", "content": "Combat Stress"},
        {"page_name": "crisis-support", "section": "combat_stress_desc", "content": "UK veteran mental health charity"},
        {"page_name": "crisis-support", "section": "combat_stress_phone", "content": "0800 138 1619"},
        
        # Peer support page
        {"page_name": "peer-support", "section": "title", "content": "Peer Support"},
        {"page_name": "peer-support", "section": "subtitle", "content": "Connect with fellow veterans who understand"},
        {"page_name": "peer-support", "section": "intro", "content": "Sometimes the best support comes from those who have walked the same path."},
        
        # Historical investigations page
        {"page_name": "historical-investigations", "section": "title", "content": "Historical Investigations Support"},
        {"page_name": "historical-investigations", "section": "subtitle", "content": "Support for veterans facing historical investigations"},
        {"page_name": "historical-investigations", "section": "intro", "content": "We understand the stress and anxiety that can come with historical investigations. You are not alone."},
        
        # Organizations page
        {"page_name": "organizations", "section": "title", "content": "Support Organisations"},
        {"page_name": "organizations", "section": "subtitle", "content": "UK veteran support services"},
    ]
    
    for item in default_content:
        existing = await db.page_content.find_one({
            "page_name": item["page_name"],
            "section": item["section"]
        })
        if not existing:
            content_obj = PageContent(**item, updated_by=current_user.email)
            await db.page_content.insert_one(content_obj.dict())
    
    return {"message": "Default content seeded successfully"}


# [MIGRATED TO ROUTERS - # ============ ENHANCED CMS ENDPOINTS ============]


# =============================================================================
# LEGACY COUNSELLOR ENDPOINTS - DEPRECATED
# =============================================================================
# These endpoints are DEPRECATED and will be removed after migration.
# Use the new unified /api/staff endpoints instead.
# See /app/memory/MIGRATION_NOTES.md for migration guide.
# =============================================================================

@api_router.post("/counsellors", response_model=Counsellor)
async def create_counsellor(
    counsellor_input: CounsellorCreate,
    current_user: User = Depends(require_role("admin"))
):
    """DEPRECATED: Use POST /api/staff instead. Create a new counsellor (admin only)"""
    counsellor_obj = Counsellor(**counsellor_input.dict())
    # Encrypt sensitive fields before storing
    encrypted_data = encrypt_document('counsellors', counsellor_obj.dict())
    await db.counsellors.insert_one(encrypted_data)
    return counsellor_obj

@api_router.get("/counsellors", response_model=List[Counsellor])
async def get_counsellors(current_user: User = Depends(get_current_user)):
    """Get all counsellors - Requires authentication (admin, counsellor, or peer)"""
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Access denied. Staff only.")
    counsellors = await db.counsellors.find().to_list(1000)
    # Decrypt sensitive fields when retrieving
    return [Counsellor(**decrypt_document('counsellors', c)) for c in counsellors]

@api_router.get("/counsellors/available")
async def get_available_counsellors():
    """Get only available counsellors - PUBLIC SAFE VIEW (no contact details, includes user_id for WebRTC)"""
    counsellors = await db.counsellors.find(
        {"status": "available"},
        {"id": 1, "name": 1, "specialization": 1, "status": 1, "user_id": 1, "_id": 0}
    ).to_list(1000)
    
    # Decrypt names for display
    result = []
    for c in counsellors:
        counsellor_data = dict(c)
        # Decrypt name if it's encrypted
        if counsellor_data.get("name") and str(counsellor_data["name"]).startswith("ENC:"):
            try:
                counsellor_data["name"] = decrypt_field(counsellor_data["name"])
            except Exception as e:
                # If decryption fails, use a fallback name
                logger.error(f"Failed to decrypt counsellor name: {e}")
                counsellor_data["name"] = "Counsellor"
        result.append(counsellor_data)
    
    return result

@api_router.get("/counsellors/{counsellor_id}", response_model=Counsellor)
async def get_counsellor(counsellor_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific counsellor - Requires authentication"""
    if current_user.role not in ["admin", "supervisor", "counsellor"]:
        raise HTTPException(status_code=403, detail="Access denied")
    counsellor = await db.counsellors.find_one({"id": counsellor_id})
    if not counsellor:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    # Decrypt sensitive fields
    return Counsellor(**decrypt_document('counsellors', counsellor))

@api_router.put("/counsellors/{counsellor_id}", response_model=Counsellor)
async def update_counsellor(
    counsellor_id: str,
    counsellor_input: CounsellorCreate,
    current_user: User = Depends(require_role("admin"))
):
    """Update a counsellor (admin only)"""
    # Encrypt sensitive fields before updating
    encrypted_data = encrypt_document('counsellors', counsellor_input.dict(exclude_unset=True))
    result = await db.counsellors.update_one(
        {"id": counsellor_id},
        {"$set": encrypted_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    
    updated = await db.counsellors.find_one({"id": counsellor_id})
    return Counsellor(**updated)

@api_router.patch("/counsellors/{counsellor_id}/status")
async def update_counsellor_status(
    counsellor_id: str,
    status_update: CounsellorStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update counsellor status (counsellor or admin)"""
    # Check if user is counsellor or admin
    counsellor = await db.counsellors.find_one({"id": counsellor_id})
    if not counsellor:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    
    if current_user.role == "counsellor" and counsellor.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Can only update your own status")
    
    result = await db.counsellors.update_one(
        {"id": counsellor_id},
        {"$set": {"status": status_update.status}}
    )
    
    return {"success": True, "status": status_update.status}

@api_router.delete("/counsellors/{counsellor_id}")
async def delete_counsellor(
    counsellor_id: str,
    current_user: User = Depends(require_role("admin"))
):
    """Delete a counsellor (admin only)"""
    result = await db.counsellors.delete_one({"id": counsellor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    return {"message": "Counsellor deleted successfully"}

# =============================================================================
# LEGACY PEER SUPPORTER ENDPOINTS - DEPRECATED
# =============================================================================
# These endpoints are DEPRECATED and will be removed after migration.
# Use the new unified /api/staff endpoints instead.
# See /app/memory/MIGRATION_NOTES.md for migration guide.
# =============================================================================

@api_router.post("/peer-supporters", response_model=PeerSupporter)
async def create_peer_supporter(
    peer_input: PeerSupporterCreate,
    current_user: User = Depends(require_role("admin"))
):
    """DEPRECATED: Use POST /api/staff instead. Create a new peer supporter (admin only)"""
    peer_obj = PeerSupporter(**peer_input.dict())
    # Encrypt sensitive fields before storing
    encrypted_data = encrypt_document('peer_supporters', peer_obj.dict())
    await db.peer_supporters.insert_one(encrypted_data)
    return peer_obj

@api_router.get("/peer-supporters", response_model=List[PeerSupporter])
async def get_peer_supporters(current_user: User = Depends(get_current_user)):
    """Get all peer supporters - Requires authentication (admin, counsellor, or peer)"""
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Access denied. Staff only.")
    peers = await db.peer_supporters.find().to_list(1000)
    # Decrypt sensitive fields when retrieving
    return [PeerSupporter(**decrypt_document('peer_supporters', p)) for p in peers]

@api_router.get("/peer-supporters/available")
async def get_available_peer_supporters():
    """Get only available peer supporters - PUBLIC SAFE VIEW (no contact details, includes user_id for WebRTC)"""
    peers = await db.peer_supporters.find(
        {"status": {"$in": ["available", "limited"]}},
        {"id": 1, "firstName": 1, "area": 1, "status": 1, "user_id": 1, "_id": 0}
    ).to_list(1000)
    # Decrypt firstName for each peer
    result = []
    for peer in peers:
        peer_data = dict(peer)
        if peer_data.get('firstName') and str(peer_data['firstName']).startswith('ENC:'):
            try:
                peer_data['firstName'] = decrypt_field(peer_data['firstName'])
            except Exception as e:
                logger.error(f"Failed to decrypt peer firstName: {e}")
                peer_data['firstName'] = "Peer Supporter"
        result.append(peer_data)
    return result

@api_router.get("/peer-supporters/{peer_id}", response_model=PeerSupporter)
async def get_peer_supporter(peer_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific peer supporter - Requires authentication"""
    if current_user.role not in ["admin", "supervisor", "peer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    peer = await db.peer_supporters.find_one({"id": peer_id})
    if not peer:
        raise HTTPException(status_code=404, detail="Peer supporter not found")
    # Decrypt sensitive fields
    return PeerSupporter(**decrypt_document('peer_supporters', peer))

@api_router.put("/peer-supporters/{peer_id}", response_model=PeerSupporter)
async def update_peer_supporter(
    peer_id: str,
    peer_input: PeerSupporterCreate,
    current_user: User = Depends(require_role("admin"))
):
    """Update a peer supporter (admin only)"""
    # Encrypt sensitive fields before updating
    encrypted_data = encrypt_document('peer_supporters', peer_input.dict(exclude_unset=True))
    result = await db.peer_supporters.update_one(
        {"id": peer_id},
        {"$set": encrypted_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Peer supporter not found")
    
    updated = await db.peer_supporters.find_one({"id": peer_id})
    return PeerSupporter(**decrypt_document('peer_supporters', updated))

@api_router.patch("/peer-supporters/{peer_id}/status")
async def update_peer_supporter_status(
    peer_id: str,
    status_update: PeerSupporterStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update peer supporter status (peer or admin)"""
    peer = await db.peer_supporters.find_one({"id": peer_id})
    if not peer:
        raise HTTPException(status_code=404, detail="Peer supporter not found")
    
    if current_user.role == "peer" and peer.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Can only update your own status")
    
    result = await db.peer_supporters.update_one(
        {"id": peer_id},
        {"$set": {"status": status_update.status}}
    )
    
    return {"success": True, "status": status_update.status}

@api_router.delete("/peer-supporters/{peer_id}")
async def delete_peer_supporter(
    peer_id: str,
    current_user: User = Depends(require_role("admin"))
):
    """Delete a peer supporter (admin only)"""
    result = await db.peer_supporters.delete_one({"id": peer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Peer supporter not found")
    return {"message": "Peer supporter deleted successfully"}

# ============ ORGANIZATION ENDPOINTS ============

@api_router.post("/organizations", response_model=Organization)
async def create_organization(
    org_input: OrganizationCreate,
    current_user: User = Depends(require_role("admin"))
):
    """Create a new organization (admin only)"""
    org_obj = Organization(**org_input.dict())
    await db.organizations.insert_one(org_obj.dict())
    return org_obj

@api_router.get("/organizations", response_model=List[Organization])
async def get_organizations():
    """Get all organizations (public)"""
    orgs = await db.organizations.find().to_list(1000)
    return [Organization(**o) for o in orgs]

@api_router.get("/organizations/{org_id}", response_model=Organization)
async def get_organization(org_id: str):
    """Get a specific organization"""
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return Organization(**org)

@api_router.put("/organizations/{org_id}", response_model=Organization)
async def update_organization(
    org_id: str,
    org_input: OrganizationCreate,
    current_user: User = Depends(require_role("admin"))
):
    """Update an organization (admin only)"""
    result = await db.organizations.update_one(
        {"id": org_id},
        {"$set": org_input.dict(exclude_unset=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    updated = await db.organizations.find_one({"id": org_id})
    return Organization(**updated)

@api_router.delete("/organizations/{org_id}")
async def delete_organization(
    org_id: str,
    current_user: User = Depends(require_role("admin"))
):
    """Delete an organization (admin only)"""
    result = await db.organizations.delete_one({"id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"message": "Organization deleted successfully"}

@api_router.post("/organizations/seed")
async def seed_organizations(current_user: User = Depends(require_role("admin"))):
    """Seed default UK veteran support organizations (admin only)"""
    return await _seed_organizations_internal()

# SECURITY: This public seed endpoint is now disabled
# @api_router.post("/organizations/seed-public")
# async def seed_organizations_public():
#     """Public endpoint to seed organizations - for initial setup only"""
#     return await _seed_organizations_internal()

async def _seed_organizations_internal():
    """Internal function to seed organizations"""
    default_organizations = [
        {
            "name": "Combat Stress",
            "description": "Leading charity for veterans mental health. Offers support for trauma, anxiety, depression and more.",
            "phone": "0800 138 1619",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "Samaritans",
            "description": "Free 24/7 listening service for anyone who needs to talk. Confidential and non-judgmental support.",
            "phone": "116 123",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "Veterans UK",
            "description": "Government support service offering advice on benefits, compensation, and welfare for veterans.",
            "phone": "0808 1914 218",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "CALM",
            "description": "Campaign Against Living Miserably. Support for men experiencing difficult times, including veterans.",
            "phone": "0800 58 58 58",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "SSAFA",
            "description": "Lifelong support for serving personnel, veterans, and their families. Practical and emotional support.",
            "phone": "0800 731 4880",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "Help for Heroes",
            "description": "Recovery and support for wounded, injured and sick veterans. Physical and mental health services.",
            "phone": "0800 058 2121",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "Royal British Legion",
            "description": "Welfare support, guidance and advice for serving and ex-serving personnel and their families.",
            "phone": "0808 802 8080",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "NHS Urgent Mental Health Helpline",
            "description": "Call 111 and select option 2 for urgent mental health support 24/7.",
            "phone": "111",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "Mind",
            "description": "Mental health charity providing advice and support for anyone experiencing a mental health problem.",
            "phone": "0300 123 3393",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "Walking With The Wounded",
            "description": "Supporting wounded veterans back into work and independence through employment programmes.",
            "phone": "01011 828305",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "The Veterans Gateway",
            "description": "First point of contact for veterans seeking support. Signposts to relevant charities and services.",
            "phone": "0808 802 1212",
            "sms": "81212",
            "whatsapp": None,
        },
        {
            "name": "Blind Veterans UK",
            "description": "Support for veterans with sight loss. Training, rehabilitation and equipment.",
            "phone": "0800 389 7979",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "Veterans Aid",
            "description": "Emergency support for veterans in crisis including housing, welfare and immediate needs.",
            "phone": "0800 012 6867",
            "sms": None,
            "whatsapp": None,
        },
        {
            "name": "Op Courage",
            "description": "NHS mental health specialist service for armed forces veterans with complex mental health needs.",
            "phone": "0300 323 0137",
            "sms": None,
            "whatsapp": None,
        },
    ]
    
    added_count = 0
    for org_data in default_organizations:
        existing = await db.organizations.find_one({"name": org_data["name"]})
        if not existing:
            org_obj = Organization(**org_data)
            await db.organizations.insert_one(org_obj.dict())
            added_count += 1
    
    return {"message": f"Organizations seeded successfully. Added {added_count} new organizations."}

@api_router.get("/organizations/export/csv")
async def export_organizations_csv(current_user: User = Depends(require_role("admin"))):
    """Export all organizations as CSV (admin only)"""
    import csv
    import io
    from fastapi.responses import StreamingResponse
    
    orgs = await db.organizations.find({}, {"_id": 0}).to_list(1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['id', 'name', 'description', 'phone', 'sms', 'whatsapp', 'website', 'email', 'category', 'created_at'])
    
    for org in orgs:
        writer.writerow([
            org.get('id', ''),
            org.get('name', ''),
            org.get('description', ''),
            org.get('phone', ''),
            org.get('sms', ''),
            org.get('whatsapp', ''),
            org.get('website', ''),
            org.get('email', ''),
            org.get('category', ''),
            org.get('created_at', '')
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=organizations_export.csv"}
    )

class OrganizationBulkImport(BaseModel):
    organizations: List[dict]
    replace_all: bool = False

@api_router.post("/organizations/import")
async def import_organizations(
    data: OrganizationBulkImport,
    current_user: User = Depends(require_role("admin"))
):
    """Import organizations from JSON (admin only). Can update existing or replace all."""
    updated = 0
    created = 0
    errors = []
    
    if data.replace_all:
        # Delete all existing organizations
        await db.organizations.delete_many({})
    
    for org_data in data.organizations:
        try:
            name = org_data.get('name')
            if not name:
                errors.append(f"Missing name in entry: {org_data}")
                continue
            
            # Check if exists
            existing = await db.organizations.find_one({"name": name})
            
            if existing:
                # Update existing
                update_data = {k: v for k, v in org_data.items() if v is not None and k != 'id'}
                update_data['updated_at'] = datetime.utcnow()
                await db.organizations.update_one(
                    {"name": name},
                    {"$set": update_data}
                )
                updated += 1
            else:
                # Create new
                org_obj = Organization(
                    name=name,
                    description=org_data.get('description', ''),
                    phone=org_data.get('phone'),
                    sms=org_data.get('sms'),
                    whatsapp=org_data.get('whatsapp'),
                    website=org_data.get('website'),
                    email=org_data.get('email'),
                    category=org_data.get('category')
                )
                await db.organizations.insert_one(org_obj.dict())
                created += 1
        except Exception as e:
            errors.append(f"Error processing {org_data.get('name', 'unknown')}: {str(e)}")
    
    return {
        "message": f"Import complete. Created: {created}, Updated: {updated}",
        "created": created,
        "updated": updated,
        "errors": errors if errors else None
    }

# ============ RESOURCES LIBRARY ============

@api_router.get("/resources")
async def get_resources():
    """Get all resources (public)"""
    resources = await db.resources.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return resources

@api_router.post("/resources", response_model=Resource)
async def create_resource(
    resource_input: ResourceCreate,
    current_user: User = Depends(require_role("admin"))
):
    """Create a new resource (admin only)"""
    import base64
    
    image_url = resource_input.image_url
    
    # Handle base64 image upload - store in database as data URL
    if resource_input.image_data:
        # Keep the base64 data as a data URL for simplicity
        # In production, you'd upload to S3/CloudStorage
        if not resource_input.image_data.startswith('data:'):
            image_url = f"data:image/png;base64,{resource_input.image_data}"
        else:
            image_url = resource_input.image_data
    
    resource = Resource(
        title=resource_input.title,
        description=resource_input.description,
        category=resource_input.category,
        content=resource_input.content,
        link=resource_input.link,
        image_url=image_url
    )
    
    await db.resources.insert_one(resource.dict())
    return resource

@api_router.put("/resources/{resource_id}")
async def update_resource(
    resource_id: str,
    resource_input: ResourceUpdate,
    current_user: User = Depends(require_role("admin"))
):
    """Update a resource (admin only)"""
    existing = await db.resources.find_one({"id": resource_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    update_data = {k: v for k, v in resource_input.dict().items() if v is not None and k != 'image_data'}
    
    # Handle base64 image upload
    if resource_input.image_data:
        if not resource_input.image_data.startswith('data:'):
            update_data['image_url'] = f"data:image/png;base64,{resource_input.image_data}"
        else:
            update_data['image_url'] = resource_input.image_data
    
    update_data['updated_at'] = datetime.utcnow()
    
    await db.resources.update_one({"id": resource_id}, {"$set": update_data})
    
    updated = await db.resources.find_one({"id": resource_id}, {"_id": 0})
    return updated

@api_router.delete("/resources/{resource_id}")
async def delete_resource(
    resource_id: str,
    current_user: User = Depends(require_role("admin"))
):
    """Delete a resource (admin only)"""
    result = await db.resources.delete_one({"id": resource_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {"message": "Resource deleted successfully"}

@api_router.post("/resources/seed")
async def seed_resources(current_user: User = Depends(require_role("admin"))):
    """Seed default resources for veterans (admin only)"""
    return await _seed_resources_internal()

# SECURITY: This public seed endpoint is now disabled
# @api_router.post("/resources/seed-public")
# async def seed_resources_public():
#     """Public endpoint to seed resources - for initial setup only"""
#     return await _seed_resources_internal()

async def _seed_resources_internal():
    """Internal function to seed resources"""
    default_resources = [
        {
            "title": "Understanding PTSD",
            "description": "A comprehensive guide to understanding Post-Traumatic Stress Disorder, its symptoms, and coping strategies.",
            "category": "Mental Health",
            "content": "PTSD is a mental health condition triggered by experiencing or witnessing a terrifying event. Symptoms may include flashbacks, nightmares, severe anxiety, and uncontrollable thoughts about the event.",
            "link": "https://www.nhs.uk/mental-health/conditions/post-traumatic-stress-disorder-ptsd/",
        },
        {
            "title": "Transition to Civilian Life",
            "description": "Tips and resources for veterans transitioning from military to civilian employment.",
            "category": "Career & Employment",
            "content": "Transitioning from military to civilian life can be challenging. This resource provides guidance on translating military skills to civilian job requirements.",
            "link": "https://www.gov.uk/guidance/support-for-veterans",
        },
        {
            "title": "Veterans Benefits Guide",
            "description": "Complete guide to benefits and support available for UK veterans.",
            "category": "Benefits & Support",
            "content": "UK veterans have access to various benefits including healthcare, housing assistance, and financial support. Learn about what you're entitled to.",
            "link": "https://www.gov.uk/government/collections/armed-forces-and-veterans-welfare-services",
        },
        {
            "title": "Family Support Resources",
            "description": "Resources for families of veterans dealing with challenges.",
            "category": "Family Support",
            "content": "Supporting a veteran can be challenging. These resources help families understand and cope with the unique challenges they may face.",
            "link": "https://www.ssafa.org.uk/",
        },
        {
            "title": "Sleep Hygiene for Veterans",
            "description": "Practical tips for improving sleep quality, a common challenge for veterans.",
            "category": "Wellness",
            "content": "Good sleep is essential for mental and physical health. Learn evidence-based techniques to improve your sleep.",
        },
        {
            "title": "Mindfulness & Meditation",
            "description": "Introduction to mindfulness techniques that can help manage stress and anxiety.",
            "category": "Wellness",
            "content": "Mindfulness meditation has been shown to help reduce symptoms of anxiety and depression. Start with just 5 minutes a day.",
        },
        {
            "title": "Emergency Contacts",
            "description": "Important phone numbers and contacts for crisis situations.",
            "category": "Crisis Support",
            "content": "Samaritans: 116 123 (24/7)\\nCombat Stress: 0800 138 1619\\nVeterans UK: 0808 1914 218\\nNHS Mental Health: 111 (option 2)",
        },
        {
            "title": "Physical Health & Fitness",
            "description": "Maintaining physical fitness after military service.",
            "category": "Wellness",
            "content": "Regular physical activity is important for both mental and physical health. Find exercise routines suitable for your fitness level.",
        },
    ]
    
    added_count = 0
    for resource_data in default_resources:
        existing = await db.resources.find_one({"title": resource_data["title"]})
        if not existing:
            resource_obj = Resource(**resource_data)
            await db.resources.insert_one(resource_obj.dict())
            added_count += 1
    
    return {"message": f"Resources seeded successfully. Added {added_count} new resources."}

# ============ SITE SETTINGS ============

class SiteSettings(BaseModel):
    logo_url: Optional[str] = None
    site_name: Optional[str] = "Veterans Support"
    peer_registration_notification_email: Optional[str] = None  # Email to notify when someone registers for peer support
    admin_notification_email: Optional[str] = None  # Email for safeguarding alerts
    cso_email: Optional[str] = None  # Clinical Safety Officer email for governance notifications

@api_router.get("/settings")
async def get_settings():
    """Get site settings (public)"""
    settings = await db.settings.find_one({"_id": "site_settings"}, {"_id": 0})
    return settings or {
        "logo_url": None, 
        "site_name": "Veterans Support",
        "peer_registration_notification_email": None,
        "admin_notification_email": None,
        "cso_email": None
    }

@api_router.put("/settings")
async def update_settings(
    settings: SiteSettings,
    current_user: User = Depends(require_role("admin"))
):
    """Update site settings (admin only)"""
    update_data = {k: v for k, v in settings.dict().items() if v is not None}
    
    await db.settings.update_one(
        {"_id": "site_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    # Audit log: admin changed settings
    await audit_admin_action(
        db,
        user_id=current_user.id,
        email=current_user.email,
        action="settings_changed",
        details={"changed_fields": list(update_data.keys())}
    )
    
    return {"message": "Settings updated successfully"}

# ============ GRACE FRONT PAGE TOGGLE ============

@api_router.get("/settings/grace-greeter")
async def get_grace_greeter_setting():
    """Get the Grace front page greeter toggle state."""
    setting = await db.settings.find_one({"_id": "grace_greeter"}, {"_id": 0})
    return {"enabled": setting.get("enabled", False) if setting else False}

@api_router.put("/settings/grace-greeter")
async def update_grace_greeter_setting(
    body: dict,
    current_user: User = Depends(require_role("admin"))
):
    """Toggle the Grace front page greeter on/off (admin only)."""
    enabled = body.get("enabled", False)
    await db.settings.update_one(
        {"_id": "grace_greeter"},
        {"$set": {"enabled": enabled}},
        upsert=True
    )
    return {"enabled": enabled, "message": f"Grace greeter {'enabled' if enabled else 'disabled'}"}

# ============ CALLBACK REQUEST ENDPOINTS ============

async def send_callback_confirmation_email(email: str, name: str, request_type: str):
    """Send confirmation email to user who requested callback"""
    if not RESEND_API_KEY:
        logging.warning("Resend API key not configured, skipping email")
        return False
    
    try:
        type_label = "Counsellor" if request_type == "counsellor" else "Peer Supporter"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a2332;">Callback Request Received</h2>
            <p>Dear {name},</p>
            <p>Thank you for reaching out. We have received your callback request for a <strong>{type_label}</strong>.</p>
            <p>One of our team members will contact you as soon as possible. If you're in immediate crisis, please call:</p>
            <ul>
                <li><strong>Samaritans:</strong> 116 123 (24/7, free)</li>
                <li><strong>Combat Stress:</strong> 0800 138 1619</li>
                <li><strong>Emergency:</strong> 999</li>
            </ul>
            <p>You matter, and help is on the way.</p>
            <br>
            <p style="color: #1a2332;">Veterans Support Team</p>
        </body>
        </html>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": f"Callback Request Received - Veterans Support",
            "html": html_content
        }
        
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Callback confirmation email sent to {email}, ID: {result.get('id')}")
        return True
    except Exception as e:
        logging.error(f"Failed to send callback confirmation email: {str(e)}")
        return False

async def send_callback_notification_to_staff(callback: dict, staff_type: str):
    """Send notification to relevant staff about new callback request"""
    if not RESEND_API_KEY:
        logging.warning("Resend API key not configured, skipping staff notification")
        return False
    
    try:
        # Get all staff of the relevant type
        if staff_type == "counsellor":
            staff_users = await db.users.find({"role": "counsellor"}).to_list(100)
        else:
            staff_users = await db.users.find({"role": "peer"}).to_list(100)
        
        if not staff_users:
            logging.warning(f"No {staff_type} users found to notify")
            return False
        
        staff_emails = [u["email"] for u in staff_users]
        type_label = "Counsellor" if staff_type == "counsellor" else "Peer Supporter"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #cc0000;">New Callback Request</h2>
            <p>A veteran has requested a callback from a <strong>{type_label}</strong>.</p>
            <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Name:</strong> {callback['name']}</p>
                <p><strong>Phone:</strong> {callback['phone']}</p>
                <p><strong>Email:</strong> {callback.get('email', 'Not provided')}</p>
                <p><strong>Message:</strong> {callback['message']}</p>
                <p><strong>Time:</strong> {callback['created_at'].strftime('%Y-%m-%d %H:%M')}</p>
            </div>
            <p>Please log into the portal to take control of this request.</p>
            <br>
            <p style="color: #1a2332;">Veterans Support System</p>
        </body>
        </html>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": staff_emails,
            "subject": f"[ACTION REQUIRED] New Callback Request - Veterans Support",
            "html": html_content
        }
        
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Callback notification sent to {len(staff_emails)} {staff_type}(s), ID: {result.get('id')}")
        return True
    except Exception as e:
        logging.error(f"Failed to send staff notification: {str(e)}")
        return False

@api_router.post("/callbacks")
async def create_callback_request(callback_input: CallbackRequestCreate):
    """Create a new callback request (public)"""
    try:
        callback = CallbackRequest(**callback_input.dict())
        # Encrypt sensitive fields before storing
        encrypted_data = encrypt_document('callbacks', callback.dict())
        await db.callback_requests.insert_one(encrypted_data)
        
        # Send confirmation email if email provided
        if callback_input.email:
            await send_callback_confirmation_email(
                callback_input.email, 
                callback_input.name, 
                callback_input.request_type
            )
        
        # Notify relevant staff
        await send_callback_notification_to_staff(callback.dict(), callback_input.request_type)
        
        logging.info(f"Callback request created: {callback.id} - {callback_input.request_type}")
        return {"message": "Callback request submitted successfully", "id": callback.id}
    except Exception as e:
        logging.error(f"Error creating callback request: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit callback request")

@api_router.get("/callbacks")
async def get_callback_requests(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None,
    request_type: Optional[str] = None
):
    """Get callback requests (staff only, filtered by their role)"""
    try:
        query = {}
        
        # Filter by type based on user role (unless admin)
        if current_user.role == "counsellor":
            query["request_type"] = "counsellor"
        elif current_user.role == "peer":
            query["request_type"] = "peer"
        # Admin sees all
        
        if status:
            query["status"] = status
        if request_type and current_user.role == "admin":
            query["request_type"] = request_type
        
        callbacks = await db.callback_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        # Decrypt sensitive fields when retrieving
        return [decrypt_document('callbacks', c) for c in callbacks]
    except Exception as e:
        logging.error(f"Error fetching callback requests: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch callback requests")

@api_router.patch("/callbacks/{callback_id}/take")
async def take_callback_control(
    callback_id: str,
    current_user: User = Depends(get_current_user)
):
    """Take control of a callback request"""
    try:
        callback = await db.callback_requests.find_one({"id": callback_id})
        if not callback:
            raise HTTPException(status_code=404, detail="Callback request not found")
        
        # Check if already assigned
        if callback.get("status") in ["in_progress", "taken"]:
            raise HTTPException(status_code=400, detail="This callback is already being handled")
        
        # Check user has right role for this callback type
        if current_user.role != "admin":
            if callback["request_type"] == "counsellor" and current_user.role != "counsellor":
                raise HTTPException(status_code=403, detail="Only counsellors can handle counsellor callbacks")
            if callback["request_type"] == "peer" and current_user.role not in ["peer", "peer_supporter"]:
                raise HTTPException(status_code=403, detail="Only peers can handle peer callbacks")
        
        await db.callback_requests.update_one(
            {"id": callback_id},
            {"$set": {
                "status": "taken",  # Use "taken" to match frontend expectations
                "taken_by": current_user.id,
                "taken_by_name": current_user.name,
                "assigned_to": current_user.id,  # Keep both for backwards compatibility
                "assigned_name": current_user.name,
                "taken_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Audit log: staff took callback
        await audit_admin_action(
            db,
            user_id=current_user.id,
            email=current_user.email,
            action="callback_taken",
            details={"callback_id": callback_id, "user_phone": callback.get("phone", "unknown")}
        )
        
        logging.info(f"Callback {callback_id} taken by {current_user.name} ({current_user.id})")
        return {"message": f"Callback assigned to {current_user.name}", "status": "taken"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error taking callback control: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to take control")

@api_router.patch("/callbacks/{callback_id}/release")
async def release_callback(
    callback_id: str,
    current_user: User = Depends(get_current_user)
):
    """Release a callback request back to pool"""
    try:
        callback = await db.callback_requests.find_one({"id": callback_id})
        if not callback:
            raise HTTPException(status_code=404, detail="Callback request not found")
        
        # Only assigned user or admin can release
        taken_by = callback.get("taken_by") or callback.get("assigned_to")
        if current_user.role != "admin" and taken_by != current_user.id:
            raise HTTPException(status_code=403, detail="You can only release callbacks assigned to you")
        
        await db.callback_requests.update_one(
            {"id": callback_id},
            {"$set": {
                "status": "pending",
                "taken_by": None,
                "taken_by_name": None,
                "assigned_to": None,
                "assigned_name": None,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Audit log: staff released callback
        await audit_admin_action(
            db,
            user_id=current_user.id,
            email=current_user.email,
            action="callback_released",
            details={"callback_id": callback_id}
        )
        
        logging.info(f"Callback {callback_id} released by {current_user.name}")
        return {"message": "Callback released back to pool", "status": "pending"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error releasing callback: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to release callback")

@api_router.patch("/callbacks/{callback_id}/complete")
async def complete_callback(
    callback_id: str,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Mark a callback as completed"""
    try:
        callback = await db.callback_requests.find_one({"id": callback_id})
        if not callback:
            raise HTTPException(status_code=404, detail="Callback request not found")
        
        # Only assigned user or admin can complete
        taken_by = callback.get("taken_by") or callback.get("assigned_to")
        if current_user.role != "admin" and taken_by != current_user.id:
            raise HTTPException(status_code=403, detail="You can only complete callbacks assigned to you")
        
        update_data = {
            "status": "completed",
            "completed_at": datetime.utcnow(),
            "completed_by": current_user.id,
            "completed_by_name": current_user.name,
            "updated_at": datetime.utcnow()
        }
        if notes:
            update_data["completion_notes"] = notes
        
        await db.callback_requests.update_one(
            {"id": callback_id},
            {"$set": update_data}
        )
        
        # Audit log: staff completed callback
        await audit_admin_action(
            db,
            user_id=current_user.id,
            email=current_user.email,
            action="callback_completed",
            details={"callback_id": callback_id, "had_notes": bool(notes)}
        )
        
        logging.info(f"Callback {callback_id} completed by {current_user.name}")
        return {"message": "Callback marked as completed", "status": "completed"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error completing callback: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to complete callback")


# ============ INTERACTION NOTES ENDPOINTS ============

@api_router.post("/notes")
async def create_interaction_note(
    note_data: InteractionNoteCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new interaction note"""
    try:
        note = InteractionNote(
            author_id=current_user.id,
            author_name=current_user.name,
            author_role=current_user.role,
            **note_data.dict()
        )
        
        await db.interaction_notes.insert_one(note.dict())
        
        # Audit log if shared with supervisor
        if note_data.is_shared or (note_data.tags and 'supervisor-review' in note_data.tags):
            await audit_admin_action(
                db,
                user_id=current_user.id,
                email=current_user.email,
                action="note_shared",
                details={"note_id": note.id, "related_to": note_data.related_to, "tags": note_data.tags}
            )
        
        logging.info(f"Interaction note created: {note.id} by {current_user.name}")
        return {"message": "Note created successfully", "id": note.id, "note": note.dict()}
    except Exception as e:
        logging.error(f"Error creating interaction note: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create note")

@api_router.get("/notes")
async def get_interaction_notes(
    related_to: Optional[str] = None,
    related_type: Optional[str] = None,
    include_shared: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Get interaction notes - own notes + shared notes"""
    try:
        # Build query - user's own notes OR notes shared with them OR notes they can see
        query_conditions = [
            {"author_id": current_user.id}  # Own notes
        ]
        
        if include_shared:
            # Notes explicitly shared with this user
            query_conditions.append({"share_with": current_user.id})
            # Notes shared publicly with team
            query_conditions.append({"is_shared": True})
        
        # Supervisors/admins can see notes tagged for supervisor review
        if current_user.role in ["supervisor", "admin"]:
            query_conditions.append({"tags": "supervisor-review"})
        
        query = {"$or": query_conditions}
        
        # Filter by related entity if specified
        if related_to:
            query["related_to"] = related_to
        if related_type:
            query["related_type"] = related_type
        
        notes = await db.interaction_notes.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        
        return {"notes": notes, "count": len(notes)}
    except Exception as e:
        logging.error(f"Error fetching interaction notes: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch notes")

@api_router.get("/notes/{note_id}")
async def get_interaction_note(
    note_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific interaction note"""
    try:
        note = await db.interaction_notes.find_one({"id": note_id}, {"_id": 0})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Check access
        is_author = note["author_id"] == current_user.id
        is_shared_with = current_user.id in (note.get("share_with") or [])
        is_public_shared = note.get("is_shared", False)
        is_supervisor_note = "supervisor-review" in (note.get("tags") or []) and current_user.role in ["supervisor", "admin"]
        
        if not (is_author or is_shared_with or is_public_shared or is_supervisor_note):
            raise HTTPException(status_code=403, detail="You don't have access to this note")
        
        return note
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching interaction note: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch note")

@api_router.put("/notes/{note_id}")
async def update_interaction_note(
    note_id: str,
    update_data: InteractionNoteUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an interaction note (only author can update)"""
    try:
        note = await db.interaction_notes.find_one({"id": note_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Only author can update
        if note["author_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Only the author can update this note")
        
        update_doc = {"updated_at": datetime.utcnow()}
        for field, value in update_data.dict(exclude_unset=True).items():
            if value is not None:
                update_doc[field] = value
        
        await db.interaction_notes.update_one({"id": note_id}, {"$set": update_doc})
        
        # Audit if sharing status changed
        if update_data.is_shared or update_data.share_with or (update_data.tags and 'supervisor-review' in update_data.tags):
            await audit_admin_action(
                db,
                user_id=current_user.id,
                email=current_user.email,
                action="note_updated",
                details={"note_id": note_id, "sharing_changed": True}
            )
        
        return {"message": "Note updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating interaction note: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update note")

@api_router.delete("/notes/{note_id}")
async def delete_interaction_note(
    note_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an interaction note (only author or admin can delete)"""
    try:
        note = await db.interaction_notes.find_one({"id": note_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Only author or admin can delete
        if note["author_id"] != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Only the author or admin can delete this note")
        
        await db.interaction_notes.delete_one({"id": note_id})
        
        return {"message": "Note deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting interaction note: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete note")

@api_router.post("/notes/{note_id}/share")
async def share_interaction_note(
    note_id: str,
    share_with: List[str],
    current_user: User = Depends(get_current_user)
):
    """Share a note with specific staff members"""
    try:
        note = await db.interaction_notes.find_one({"id": note_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        if note["author_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Only the author can share this note")
        
        # Add to share_with list (avoid duplicates)
        existing_shares = set(note.get("share_with") or [])
        existing_shares.update(share_with)
        
        await db.interaction_notes.update_one(
            {"id": note_id},
            {"$set": {
                "share_with": list(existing_shares),
                "is_shared": True,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Audit log
        await audit_admin_action(
            db,
            user_id=current_user.id,
            email=current_user.email,
            action="note_shared",
            details={"note_id": note_id, "shared_with": share_with}
        )
        
        return {"message": f"Note shared with {len(share_with)} staff member(s)"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sharing interaction note: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to share note")


# ============ INTERNAL MESSAGES ENDPOINTS ============

@api_router.get("/messages")
async def get_messages(
    current_user: User = Depends(get_current_user)
):
    """Get internal messages for current user"""
    try:
        # Get messages sent to or from this user
        messages = await db.internal_messages.find(
            {"$or": [
                {"to_id": current_user.id},
                {"from_id": current_user.id}
            ]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Count unread messages
        unread_count = await db.internal_messages.count_documents({
            "to_id": current_user.id,
            "read": False
        })
        
        return {"messages": messages, "unread_count": unread_count}
    except Exception as e:
        logging.error(f"Error fetching messages: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages")

@api_router.post("/messages")
async def send_message(
    message_data: InternalMessageCreate,
    current_user: User = Depends(get_current_user)
):
    """Send an internal message to another staff member"""
    try:
        # Get recipient info
        recipient = await db.staff.find_one({"id": message_data.to_id}, {"_id": 0, "name": 1, "id": 1})
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        
        message = InternalMessage(
            from_id=current_user.id,
            from_name=current_user.name,
            to_id=message_data.to_id,
            to_name=recipient.get("name", "Unknown"),
            content=message_data.content
        )
        
        await db.internal_messages.insert_one(message.dict())
        
        logging.info(f"Message sent from {current_user.name} to {recipient.get('name')}")
        return {"message": "Message sent successfully", "id": message.id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending message: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send message")

@api_router.patch("/messages/{message_id}/read")
async def mark_message_read(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a message as read"""
    try:
        result = await db.internal_messages.update_one(
            {"id": message_id, "to_id": current_user.id},
            {"$set": {"read": True}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Message not found")
        
        return {"message": "Message marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error marking message read: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to mark message read")

@api_router.patch("/messages/read-all")
async def mark_all_messages_read(
    current_user: User = Depends(get_current_user)
):
    """Mark all messages as read"""
    try:
        result = await db.internal_messages.update_many(
            {"to_id": current_user.id, "read": False},
            {"$set": {"read": True}}
        )
        
        return {"message": f"Marked {result.modified_count} messages as read"}
    except Exception as e:
        logging.error(f"Error marking all messages read: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to mark messages read")




# ============ PANIC ALERT ENDPOINTS ============

async def send_panic_alert_to_counsellors(alert: dict):
    """Send urgent notification to all counsellors about panic alert"""
    if not RESEND_API_KEY:
        logging.warning("Resend API key not configured, skipping panic alert email")
        return False
    
    try:
        # Get all counsellors AND admins for urgent alerts
        staff_users = await db.users.find({"role": {"$in": ["counsellor", "supervisor", "admin"]}}).to_list(100)
        
        if not staff_users:
            logging.error("No counsellors or admins found to notify about panic alert!")
            return False
        
        staff_emails = [u["email"] for u in staff_users]
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff5f5;">
            <h2 style="color: #cc0000;">🚨 URGENT: Panic Alert Triggered</h2>
            <p style="font-size: 18px; color: #cc0000;">A veteran has pressed the panic button and needs immediate assistance.</p>
            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #cc0000;">
                <p><strong>Name:</strong> {alert.get('user_name', 'Anonymous')}</p>
                <p><strong>Phone:</strong> {alert.get('user_phone', 'Not provided')}</p>
                <p><strong>Location:</strong> {alert.get('location', 'Not provided')}</p>
                <p><strong>Message:</strong> {alert.get('message', 'No message')}</p>
                <p><strong>Time:</strong> {alert['created_at'].strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            <p style="font-size: 16px;"><strong>Please take immediate action.</strong></p>
            <p>Log into the portal to acknowledge this alert.</p>
            <br>
            <p style="color: #1a2332;">Veterans Support Emergency System</p>
        </body>
        </html>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": staff_emails,
            "subject": f"🚨 URGENT: Panic Alert - Immediate Assistance Required",
            "html": html_content
        }
        
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Panic alert sent to {len(staff_emails)} counsellors/admins, ID: {result.get('id')}")
        return True
    except Exception as e:
        logging.error(f"Failed to send panic alert email: {str(e)}")
        return False

@api_router.post("/panic-alert")
async def create_panic_alert(alert_input: PanicAlertCreate):
    """Create a panic alert (public - for users in crisis)"""
    try:
        alert = PanicAlert(**alert_input.dict())
        await db.panic_alerts.insert_one(alert.dict())
        
        # Send urgent notification to counsellors
        await send_panic_alert_to_counsellors(alert.dict())
        
        logging.warning(f"PANIC ALERT CREATED: {alert.id}")
        
        return {
            "message": "Alert sent. Help is on the way. If you're in immediate danger, call 999.",
            "id": alert.id,
            "crisis_numbers": {
                "emergency": "999",
                "samaritans": "116 123",
                "combat_stress": "0800 138 1619"
            }
        }
    except Exception as e:
        logging.error(f"Error creating panic alert: {str(e)}")
        raise HTTPException(status_code=500, detail="Alert system error. Please call 999 or 116 123.")

@api_router.get("/panic-alerts")
async def get_panic_alerts(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None
):
    """Get panic alerts (all staff can view)"""
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Only staff can view panic alerts")
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        alerts = await db.panic_alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        return alerts
    except Exception as e:
        logging.error(f"Error fetching panic alerts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch panic alerts")

@api_router.patch("/panic-alerts/{alert_id}/acknowledge")
async def acknowledge_panic_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user)
):
    """Acknowledge a panic alert"""
    if current_user.role not in ["admin", "supervisor", "counsellor"]:
        raise HTTPException(status_code=403, detail="Only counsellors and admins can acknowledge alerts")
    
    try:
        alert = await db.panic_alerts.find_one({"id": alert_id})
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        await db.panic_alerts.update_one(
            {"id": alert_id},
            {"$set": {
                "status": "acknowledged",
                "acknowledged_by": current_user.name,
                "acknowledged_at": datetime.utcnow()
            }}
        )
        
        return {"message": f"Alert acknowledged by {current_user.name}"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error acknowledging alert: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to acknowledge alert")

@api_router.patch("/panic-alerts/{alert_id}/resolve")
async def resolve_panic_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user)
):
    """Resolve a panic alert"""
    if current_user.role not in ["admin", "supervisor", "counsellor"]:
        raise HTTPException(status_code=403, detail="Only counsellors and admins can resolve alerts")
    
    try:
        await db.panic_alerts.update_one(
            {"id": alert_id},
            {"$set": {
                "status": "resolved",
                "resolved_by": current_user.name,
                "resolved_at": datetime.utcnow()
            }}
        )
        
        return {"message": f"Alert resolved by {current_user.name}"}
    except Exception as e:
        logging.error(f"Error resolving alert: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to resolve alert")

# ============ SAFEGUARDING ALERTS ENDPOINTS ============

@api_router.get("/safeguarding-alerts")
async def get_safeguarding_alerts(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get safeguarding alerts - all staff can view"""
    print(f"[SAFEGUARDING] get_safeguarding_alerts called by user={current_user.email}, role='{current_user.role}'")
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        # Get total count first for debugging
        total_count = await db.safeguarding_alerts.count_documents({})
        print(f"[SAFEGUARDING] Total alerts in database: {total_count}")
        
        alerts = await db.safeguarding_alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        print(f"[SAFEGUARDING] Returning {len(alerts)} alerts (query: {query})")
        
        return alerts
    except Exception as e:
        print(f"[SAFEGUARDING] ERROR: {str(e)}")
        logging.error(f"Error fetching safeguarding alerts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch safeguarding alerts")

@api_router.get("/safeguarding-alerts/{alert_id}")
async def get_safeguarding_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single safeguarding alert by ID"""
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Only staff can view safeguarding alerts")
    
    try:
        alert = await db.safeguarding_alerts.find_one({"id": alert_id}, {"_id": 0})
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        return alert
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching safeguarding alert {alert_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch safeguarding alert")



@api_router.patch("/safeguarding-alerts/{alert_id}/acknowledge")
async def acknowledge_safeguarding_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user)
):
    """Acknowledge a safeguarding alert"""
    if current_user.role not in ["admin", "supervisor", "counsellor"]:
        raise HTTPException(status_code=403, detail="Only counsellors and admins can acknowledge safeguarding alerts")
    
    try:
        alert = await db.safeguarding_alerts.find_one({"id": alert_id})
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        await db.safeguarding_alerts.update_one(
            {"id": alert_id},
            {"$set": {
                "status": "acknowledged",
                "acknowledged_by": current_user.name,
                "acknowledged_at": datetime.utcnow()
            }}
        )
        
        return {"message": f"Safeguarding alert acknowledged by {current_user.name}"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error acknowledging safeguarding alert: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to acknowledge safeguarding alert")

@api_router.patch("/safeguarding-alerts/{alert_id}/resolve")
async def resolve_safeguarding_alert(
    alert_id: str,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Resolve a safeguarding alert with optional notes"""
    if current_user.role not in ["admin", "supervisor", "counsellor"]:
        raise HTTPException(status_code=403, detail="Only counsellors and admins can resolve safeguarding alerts")
    
    try:
        update_data = {
            "status": "resolved",
            "resolved_by": current_user.name,
            "resolved_at": datetime.utcnow()
        }
        if notes:
            update_data["notes"] = notes
        
        await db.safeguarding_alerts.update_one(
            {"id": alert_id},
            {"$set": update_data}
        )
        
        return {"message": f"Safeguarding alert resolved by {current_user.name}"}
    except Exception as e:
        logging.error(f"Error resolving safeguarding alert: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to resolve safeguarding alert")

class GPSLocationUpdate(BaseModel):
    gps_lat: float
    gps_lon: float
    gps_accuracy: Optional[float] = None
    location_source: str = "gps"  # 'gps', 'wifi', 'cell'

@api_router.patch("/safeguarding-alerts/{alert_id}/location")
async def update_safeguarding_alert_location(
    alert_id: str,
    location: GPSLocationUpdate
):
    """
    Update a safeguarding alert with precise GPS location from the user's browser.
    This is called when the user grants location permission during a crisis.
    No authentication required - this is called from the crisis flow.
    """
    try:
        # Verify alert exists
        alert = await db.safeguarding_alerts.find_one({"id": alert_id})
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        # Update with GPS location (more accurate than IP geolocation)
        update_data = {
            "gps_lat": location.gps_lat,
            "gps_lon": location.gps_lon,
            "gps_accuracy": location.gps_accuracy,
            "location_source": location.location_source,
            # Overwrite the IP-based coordinates with GPS coordinates (more accurate)
            "geo_lat": location.gps_lat,
            "geo_lon": location.gps_lon,
            "location_updated_at": datetime.utcnow()
        }
        
        await db.safeguarding_alerts.update_one(
            {"id": alert_id},
            {"$set": update_data}
        )
        
        logging.info(f"Safeguarding alert {alert_id} updated with GPS location: {location.gps_lat}, {location.gps_lon} (accuracy: {location.gps_accuracy}m)")
        
        return {"message": "Location updated successfully", "accuracy_meters": location.gps_accuracy}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating safeguarding alert location: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update location")

# ============ SAFEGUARDING MONITORING ENDPOINTS ============

@api_router.get("/safeguarding/monitor")
async def get_safeguarding_monitor(
    current_user: User = Depends(get_current_user)
):
    """
    Get real-time safeguarding monitoring data.
    Shows AI analysis results WITHOUT message content.
    Staff only - for testing and improving the system.
    """
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Staff only")
    
    try:
        # Get recent safeguarding events (last 24 hours)
        cutoff = datetime.utcnow() - timedelta(hours=24)
        
        # Get alerts with analysis data but redact message content
        alerts = await db.safeguarding_alerts.find(
            {"created_at": {"$gte": cutoff.isoformat()}},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Process alerts to show analysis without content
        monitoring_data = []
        for alert in alerts:
            monitoring_data.append({
                "id": alert.get("id"),
                "timestamp": alert.get("created_at"),
                "risk_level": alert.get("risk_level"),
                "score": alert.get("score"),
                "triggered_indicators": alert.get("triggered_indicators", []),
                "session_id": alert.get("session_id", "")[:20] + "...",  # Partial for privacy
                "status": alert.get("status"),
                "ai_response_type": alert.get("ai_response_type", "unknown"),
                # Count only, not content
                "message_length": len(alert.get("triggering_message", "")) if alert.get("triggering_message") else 0
            })
        
        # Get session risk history summary (without message content)
        session_summaries = []
        for session_id, history in list(session_risk_history.items())[-20:]:
            if history:
                latest = history[-1]
                session_summaries.append({
                    "session_id": session_id[:20] + "...",
                    "message_count": len(history),
                    "latest_score": latest.get("score", 0),
                    "latest_triggers": [t["indicator"] for t in latest.get("triggered", [])]
                })
        
        return {
            "recent_alerts": monitoring_data,
            "active_sessions": session_summaries,
            "total_sessions_tracked": len(session_risk_history),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logging.error(f"Error getting safeguarding monitor: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get monitoring data")

@api_router.get("/safeguarding/triggers")
async def get_safeguarding_triggers(
    current_user: User = Depends(get_current_user)
):
    """
    Get all safeguarding trigger phrases and their weights.
    Staff only - for reviewing and improving the system.
    """
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Staff only")
    
    return {
        "red_indicators": {
            "description": "Immediate escalation - any single match = RED alert",
            "threshold_info": "Any match triggers RED regardless of score",
            "triggers": [
                {"phrase": k, "weight": v, "level": "RED"} 
                for k, v in sorted(RED_INDICATORS.items(), key=lambda x: -x[1])
            ]
        },
        "amber_indicators": {
            "description": "High risk indicators - stackable weights",
            "threshold_info": "Score >= 80 = AMBER, Score >= 120 = RED",
            "triggers": [
                {"phrase": k, "weight": v, "level": "AMBER"} 
                for k, v in sorted(AMBER_INDICATORS.items(), key=lambda x: -x[1])
            ]
        },
        "modifiers": {
            "description": "Context modifiers - add weight when combined with other indicators",
            "threshold_info": "Applied on top of other indicators",
            "triggers": [
                {"phrase": k, "weight": v, "level": "MODIFIER"} 
                for k, v in sorted(MODIFIER_PATTERNS.items(), key=lambda x: -x[1])
            ]
        },
        "scoring_rules": {
            "GREEN": "Score < 40",
            "YELLOW": "Score 40-79",
            "AMBER": "Score 80-119 OR 2+ AMBER indicators",
            "RED": "Score >= 120 OR any RED indicator match"
        },
        "total_triggers": {
            "red": len(RED_INDICATORS),
            "amber": len(AMBER_INDICATORS),
            "modifiers": len(MODIFIER_PATTERNS)
        }
    }

@api_router.post("/safeguarding/test")
async def test_safeguarding_phrase(
    test_input: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Test a phrase against the safeguarding system.
    Staff only - for testing trigger sensitivity.
    Returns analysis result without storing or alerting.
    """
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Staff only")
    
    phrase = test_input.get("phrase", "")
    if not phrase:
        raise HTTPException(status_code=400, detail="Phrase required")
    
    # Run analysis without creating alerts
    result = calculate_safeguarding_score(phrase, f"test_{current_user.id}")
    
    # Clean up test session history
    test_session_key = f"test_{current_user.id}"
    if test_session_key in session_risk_history:
        del session_risk_history[test_session_key]
    
    return {
        "phrase_length": len(phrase),
        "score": result["score"],
        "risk_level": result["risk_level"],
        "is_red_flag": result["is_red_flag"],
        "triggered_indicators": result["triggered_indicators"],
        "would_create_alert": result["risk_level"] in ["AMBER", "RED"],
        "note": "This is a test - no alert was created"
    }

@api_router.post("/safeguarding/test-create-alert")
async def test_create_safeguarding_alert(
    current_user: User = Depends(get_current_user)
):
    """
    Debug endpoint: Create a test safeguarding alert to verify database writes.
    Admin only.
    """
    if current_user.role not in ["admin", "supervisor"]:
        raise HTTPException(status_code=403, detail="Admin/Supervisor only")
    
    try:
        test_alert = SafeguardingAlert(
            session_id=f"test_session_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            character="bob",
            triggering_message="TEST: This is a test alert to verify database writes",
            ai_response="TEST: AI response for test alert",
            risk_level="AMBER",
            risk_score=75,
            triggered_indicators=["test_indicator"],
            client_ip="127.0.0.1",
            user_agent="Test User Agent",
            geo_city="Test City",
            geo_country="Test Country",
            conversation_history=[
                {"role": "user", "content": "Test message 1"},
                {"role": "assistant", "content": "Test response 1"}
            ]
        )
        
        alert_dict = test_alert.dict()
        result = await db.safeguarding_alerts.insert_one(alert_dict)
        
        # Verify it was inserted
        verify = await db.safeguarding_alerts.find_one({"id": test_alert.id}, {"_id": 0})
        
        return {
            "success": True,
            "alert_id": test_alert.id,
            "mongodb_id": str(result.inserted_id),
            "verified": verify is not None,
            "alert_data": verify
        }
    except Exception as e:
        logging.error(f"Test alert creation failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@api_router.get("/safeguarding/debug-count")
async def debug_safeguarding_count():
    """Debug: Count safeguarding alerts in database"""
    try:
        count = await db.safeguarding_alerts.count_documents({})
        latest = await db.safeguarding_alerts.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
        return {
            "total_alerts": count,
            "latest_alert": latest
        }
    except Exception as e:
        return {"error": str(e)}


# ============ SCREENING SUBMISSIONS ENDPOINTS ============

@api_router.get("/screening-submissions")
async def get_screening_submissions(
    current_user: User = Depends(get_current_user),
    limit: int = 100
):
    """Get screening submissions (admin only)"""
    if current_user.role not in ["admin", "supervisor"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        submissions = await db.screening_submissions.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return submissions
    except Exception as e:
        logging.error(f"Error fetching screening submissions: {str(e)}")
        return []


# ============ STAFF NOTES ENDPOINTS ============

@api_router.post("/notes")
async def create_note(
    note_input: NoteCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new note (staff only)"""
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Only staff can create notes")
    
    try:
        note = Note(
            title=note_input.title,
            content=note_input.content,
            is_private=note_input.is_private,
            shared_with=note_input.shared_with or [],
            callback_id=note_input.callback_id,
            author_id=current_user.id,
            author_name=current_user.name,
            author_role=current_user.role
        )
        
        await db.notes.insert_one(note.dict())
        return note.dict()
    except Exception as e:
        logging.error(f"Error creating note: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create note")

@api_router.get("/notes")
async def get_notes(
    current_user: User = Depends(get_current_user),
    callback_id: Optional[str] = None,
    include_shared: bool = True
):
    """Get notes - own notes + notes shared with me (admins see all)"""
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Only staff can view notes")
    
    try:
        if current_user.role == "admin":
            # Admins can see all notes
            query = {}
        else:
            # Staff see their own notes + notes shared with them
            if include_shared:
                query = {
                    "$or": [
                        {"author_id": current_user.id},
                        {"shared_with": current_user.id},
                        {"is_private": False, "shared_with": []}  # Public notes
                    ]
                }
            else:
                query = {"author_id": current_user.id}
        
        # Filter by callback if specified
        if callback_id:
            query["callback_id"] = callback_id
        
        notes = await db.notes.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        return notes
    except Exception as e:
        logging.error(f"Error fetching notes: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch notes")

@api_router.get("/notes/{note_id}")
async def get_note(
    note_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific note"""
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Only staff can view notes")
    
    try:
        note = await db.notes.find_one({"id": note_id}, {"_id": 0})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Check access
        if current_user.role != "admin":
            if note["author_id"] != current_user.id and current_user.id not in note.get("shared_with", []):
                if note.get("is_private", True):
                    raise HTTPException(status_code=403, detail="Access denied")
        
        return note
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching note: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch note")

@api_router.patch("/notes/{note_id}")
async def update_note(
    note_id: str,
    note_update: NoteUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a note (author or admin only)"""
    try:
        note = await db.notes.find_one({"id": note_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Only author or admin can update
        if note["author_id"] != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Only the author or admin can update this note")
        
        update_data = note_update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        await db.notes.update_one({"id": note_id}, {"$set": update_data})
        
        updated_note = await db.notes.find_one({"id": note_id}, {"_id": 0})
        return updated_note
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating note: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update note")

@api_router.delete("/notes/{note_id}")
async def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a note (author or admin only)"""
    try:
        note = await db.notes.find_one({"id": note_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Only author or admin can delete
        if note["author_id"] != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Only the author or admin can delete this note")
        
        await db.notes.delete_one({"id": note_id})
        return {"message": "Note deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting note: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete note")

@api_router.get("/staff-users")
async def get_staff_users(
    current_user: User = Depends(get_current_user)
):
    """Get list of staff users for sharing notes"""
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Only staff can view staff list")
    
    try:
        # Get all staff users (for note sharing dropdown)
        staff = await db.users.find(
            {"role": {"$in": ["admin", "supervisor", "counsellor", "peer"]}},
            {"_id": 0, "id": 1, "name": 1, "role": 1}
        ).to_list(100)
        return staff
    except Exception as e:
        logging.error(f"Error fetching staff users: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch staff users")

# ============ SUPERVISOR & TEAM MANAGEMENT ENDPOINTS ============

# Pydantic models for supervision
class SupervisionNoteCreate(BaseModel):
    staff_id: str  # The staff member being supervised
    wellbeing_notes: Optional[str] = None
    case_notes: Optional[str] = None
    action_items: Optional[List[str]] = []
    next_session_date: Optional[str] = None
    is_confidential: bool = False

class SupervisionNote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supervisor_id: str
    supervisor_name: str
    staff_id: str
    staff_name: str
    staff_role: str
    session_date: datetime = Field(default_factory=datetime.utcnow)
    wellbeing_notes: Optional[str] = None
    case_notes: Optional[str] = None
    action_items: List[str] = []
    next_session_date: Optional[str] = None
    is_confidential: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EscalationCreate(BaseModel):
    subject: str
    description: str
    priority: str = "normal"  # normal, high, urgent
    related_case_id: Optional[str] = None

class Escalation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    staff_id: str
    staff_name: str
    staff_role: str
    supervisor_id: Optional[str] = None
    supervisor_name: Optional[str] = None
    subject: str
    description: str
    priority: str = "normal"
    status: str = "pending"  # pending, acknowledged, in_progress, resolved
    related_case_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

@api_router.get("/supervision/team")
async def get_team_members(current_user: User = Depends(get_current_user)):
    """Get team members for supervisor. Supervisors see counsellors and peers."""
    if current_user.role not in ["supervisor", "admin"]:
        raise HTTPException(status_code=403, detail="Only supervisors and admins can view team members")
    
    # Get all counsellors and peers
    team = []
    
    # Get counsellor users
    counsellors = await db.users.find({"role": "counsellor"}, {"_id": 0, "password_hash": 0}).to_list(100)
    for c in counsellors:
        # Get their profile for status
        profile = await db.counsellors.find_one({"user_id": c.get("id")}, {"_id": 0})
        c["status"] = profile.get("status", "unknown") if profile else "unknown"
        c["specialization"] = profile.get("specialization", "") if profile else ""
        team.append(c)
    
    # Get peer users
    peers = await db.users.find({"role": "peer"}, {"_id": 0, "password_hash": 0}).to_list(100)
    for p in peers:
        profile = await db.peer_supporters.find_one({"user_id": p.get("id")}, {"_id": 0})
        p["status"] = profile.get("status", "unknown") if profile else "unknown"
        p["area"] = profile.get("area", "") if profile else ""
        team.append(p)
    
    return team

@api_router.post("/supervision/notes")
async def create_supervision_note(note: SupervisionNoteCreate, current_user: User = Depends(get_current_user)):
    """Create a 1:1 supervision note for a staff member"""
    if current_user.role not in ["supervisor", "admin"]:
        raise HTTPException(status_code=403, detail="Only supervisors and admins can create supervision notes")
    
    # Get the staff member's name and role
    staff = await db.users.find_one({"id": note.staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    note_data = {
        "id": str(uuid.uuid4()),
        "supervisor_id": current_user.id,
        "supervisor_name": current_user.name,
        "staff_id": note.staff_id,
        "staff_name": staff.get("name", "Unknown"),
        "staff_role": staff.get("role", "unknown"),
        "session_date": datetime.utcnow(),
        "wellbeing_notes": note.wellbeing_notes,
        "case_notes": note.case_notes,
        "action_items": note.action_items or [],
        "next_session_date": note.next_session_date,
        "is_confidential": note.is_confidential,
        "created_at": datetime.utcnow()
    }
    
    await db.supervision_notes.insert_one(note_data)
    note_data.pop("_id", None)
    
    return {"message": "Supervision note created successfully", "note": note_data}

@api_router.get("/supervision/notes")
async def get_supervision_notes(
    staff_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get supervision notes. Supervisors see their notes, admins see all."""
    if current_user.role not in ["supervisor", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    
    if current_user.role == "supervisor":
        # Supervisors only see notes they created
        query["supervisor_id"] = current_user.id
    
    if staff_id:
        query["staff_id"] = staff_id
    
    notes = await db.supervision_notes.find(query, {"_id": 0}).sort("session_date", -1).to_list(100)
    return notes

@api_router.get("/supervision/notes/{note_id}")
async def get_supervision_note(note_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific supervision note"""
    if current_user.role not in ["supervisor", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    note = await db.supervision_notes.find_one({"id": note_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Supervision note not found")
    
    # Supervisors can only view their own notes
    if current_user.role == "supervisor" and note.get("supervisor_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return note

@api_router.put("/supervision/notes/{note_id}")
async def update_supervision_note(
    note_id: str,
    updates: SupervisionNoteCreate,
    current_user: User = Depends(get_current_user)
):
    """Update a supervision note"""
    if current_user.role not in ["supervisor", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    note = await db.supervision_notes.find_one({"id": note_id})
    if not note:
        raise HTTPException(status_code=404, detail="Supervision note not found")
    
    # Supervisors can only edit their own notes
    if current_user.role == "supervisor" and note.get("supervisor_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {
        "wellbeing_notes": updates.wellbeing_notes,
        "case_notes": updates.case_notes,
        "action_items": updates.action_items or [],
        "next_session_date": updates.next_session_date,
        "is_confidential": updates.is_confidential
    }
    
    await db.supervision_notes.update_one({"id": note_id}, {"$set": update_data})
    return {"message": "Supervision note updated successfully"}

# ============ ESCALATION ENDPOINTS ============

@api_router.post("/escalations")
async def create_escalation(escalation: EscalationCreate, current_user: User = Depends(get_current_user)):
    """Create an escalation to supervisor"""
    if current_user.role not in ["counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Only counsellors and peers can create escalations")
    
    escalation_data = {
        "id": str(uuid.uuid4()),
        "staff_id": current_user.id,
        "staff_name": current_user.name,
        "staff_role": current_user.role,
        "supervisor_id": None,
        "supervisor_name": None,
        "subject": escalation.subject,
        "description": escalation.description,
        "priority": escalation.priority,
        "status": "pending",
        "related_case_id": escalation.related_case_id,
        "resolution_notes": None,
        "created_at": datetime.utcnow(),
        "acknowledged_at": None,
        "resolved_at": None
    }
    
    await db.escalations.insert_one(escalation_data)
    escalation_data.pop("_id", None)
    
    # TODO: Send notification to supervisors
    
    return {"message": "Escalation created successfully", "escalation": escalation_data}

@api_router.get("/escalations")
async def get_escalations(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get escalations. Staff sees their own, supervisors/admins see all."""
    query = {}
    
    if current_user.role in ["counsellor", "peer"]:
        # Staff only see their own escalations
        query["staff_id"] = current_user.id
    elif current_user.role not in ["supervisor", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if status:
        query["status"] = status
    
    escalations = await db.escalations.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return escalations

@api_router.patch("/escalations/{escalation_id}/acknowledge")
async def acknowledge_escalation(escalation_id: str, current_user: User = Depends(get_current_user)):
    """Supervisor acknowledges an escalation"""
    if current_user.role not in ["supervisor", "admin"]:
        raise HTTPException(status_code=403, detail="Only supervisors and admins can acknowledge escalations")
    
    escalation = await db.escalations.find_one({"id": escalation_id})
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")
    
    await db.escalations.update_one(
        {"id": escalation_id},
        {"$set": {
            "status": "acknowledged",
            "supervisor_id": current_user.id,
            "supervisor_name": current_user.name,
            "acknowledged_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Escalation acknowledged"}

@api_router.patch("/escalations/{escalation_id}/resolve")
async def resolve_escalation(
    escalation_id: str,
    resolution_notes: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Supervisor resolves an escalation"""
    if current_user.role not in ["supervisor", "admin"]:
        raise HTTPException(status_code=403, detail="Only supervisors and admins can resolve escalations")
    
    escalation = await db.escalations.find_one({"id": escalation_id})
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")
    
    update_data = {
        "status": "resolved",
        "resolved_at": datetime.utcnow()
    }
    
    if resolution_notes:
        update_data["resolution_notes"] = resolution_notes
    
    # If not already acknowledged, mark supervisor now
    if not escalation.get("supervisor_id"):
        update_data["supervisor_id"] = current_user.id
        update_data["supervisor_name"] = current_user.name
    
    await db.escalations.update_one({"id": escalation_id}, {"$set": update_data})
    
    return {"message": "Escalation resolved"}

# ============ APP USAGE ANALYTICS ============

class AppVisit(BaseModel):
    session_id: str
    user_agent: Optional[str] = None
    region: Optional[str] = None  # england, scotland, wales, northern_ireland
    referrer: Optional[str] = None
    page: Optional[str] = None  # Which page/feature visited
    screen_width: Optional[int] = None  # For device type detection

def parse_user_agent(ua_string: str) -> dict:
    """Parse user agent to extract device, browser, OS info"""
    ua = ua_string.lower() if ua_string else ""
    
    # Device type
    if "mobile" in ua or "android" in ua or "iphone" in ua:
        device = "mobile"
    elif "tablet" in ua or "ipad" in ua:
        device = "tablet"
    else:
        device = "desktop"
    
    # Browser
    if "chrome" in ua and "edg" not in ua:
        browser = "chrome"
    elif "safari" in ua and "chrome" not in ua:
        browser = "safari"
    elif "firefox" in ua:
        browser = "firefox"
    elif "edg" in ua:
        browser = "edge"
    else:
        browser = "other"
    
    # OS
    if "windows" in ua:
        os = "windows"
    elif "mac" in ua or "iphone" in ua or "ipad" in ua:
        os = "apple"
    elif "android" in ua:
        os = "android"
    elif "linux" in ua:
        os = "linux"
    else:
        os = "other"
    
    return {"device": device, "browser": browser, "os": os}

@api_router.post("/analytics/visit")
async def track_app_visit(visit: AppVisit, request: Request):
    """Track a visit to the app"""
    # Get client IP
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    
    # Parse user agent for device info
    ua_info = parse_user_agent(visit.user_agent or "")
    
    # Determine device from screen width if available
    if visit.screen_width:
        if visit.screen_width < 768:
            ua_info["device"] = "mobile"
        elif visit.screen_width < 1024:
            ua_info["device"] = "tablet"
        else:
            ua_info["device"] = "desktop"
    
    # Lookup geolocation for IP address (async, with caching)
    geo_data = await lookup_ip_geolocation(client_ip)
    
    visit_data = {
        "id": str(uuid.uuid4()),
        "session_id": visit.session_id,
        "timestamp": datetime.utcnow(),
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "hour": datetime.utcnow().hour,
        "user_agent": visit.user_agent,
        "region": visit.region,
        "referrer": visit.referrer,
        "page": visit.page or "home",
        "device": ua_info["device"],
        "browser": ua_info["browser"],
        "os": ua_info["os"],
        "ip_hash": hashlib.sha256(client_ip.encode()).hexdigest()[:16],  # Anonymized IP for unique counting
        # Geolocation data
        "geo_city": geo_data.get("geo_city"),
        "geo_region": geo_data.get("geo_region"),
        "geo_country": geo_data.get("geo_country"),
        "geo_lat": geo_data.get("geo_lat"),
        "geo_lon": geo_data.get("geo_lon"),
    }
    
    # Upsert - only count unique sessions per day
    await db.app_visits.update_one(
        {"session_id": visit.session_id, "date": visit_data["date"]},
        {"$set": visit_data, "$inc": {"page_views": 1}},
        upsert=True
    )
    
    # Track active sessions (expires after 30 min of inactivity)
    await db.active_sessions.update_one(
        {"session_id": visit.session_id},
        {
            "$set": {
                "session_id": visit.session_id,
                "last_seen": datetime.utcnow(),
                "region": visit.region,
                "device": ua_info["device"],
                "browser": ua_info["browser"],
                "os": ua_info["os"],
                # Geolocation data for map
                "geo_city": geo_data.get("geo_city"),
                "geo_region": geo_data.get("geo_region"),
                "geo_country": geo_data.get("geo_country"),
                "geo_lat": geo_data.get("geo_lat"),
                "geo_lon": geo_data.get("geo_lon"),
            },
            "$setOnInsert": {"first_seen": datetime.utcnow()}
        },
        upsert=True
    )
    
    # Track page/feature usage
    if visit.page:
        await db.feature_usage.update_one(
            {"date": visit_data["date"], "page": visit.page},
            {"$inc": {"visits": 1}, "$addToSet": {"unique_sessions": visit.session_id}},
            upsert=True
        )
    
    return {"status": "tracked"}

@api_router.post("/analytics/heartbeat")
async def analytics_heartbeat(session_id: str):
    """Keep session alive - call every 5 minutes"""
    await db.active_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"last_seen": datetime.utcnow()}},
        upsert=True
    )
    return {"status": "ok"}

@api_router.get("/analytics/usage")
async def get_app_usage_stats(current_user: User = Depends(require_role("admin"))):
    """Get app usage statistics for admin dashboard"""
    now = datetime.utcnow()
    
    # Time periods
    periods = {
        "7_days": now - timedelta(days=7),
        "30_days": now - timedelta(days=30),
        "6_months": now - timedelta(days=180),
        "12_months": now - timedelta(days=365),
    }
    
    stats = {}
    
    # Get visit counts for each period
    for period_name, cutoff in periods.items():
        # Unique visitors (by session)
        unique_visitors = await db.app_visits.distinct(
            "session_id",
            {"timestamp": {"$gte": cutoff}}
        )
        
        # Total visits
        total_visits = await db.app_visits.count_documents(
            {"timestamp": {"$gte": cutoff}}
        )
        
        stats[period_name] = {
            "unique_visitors": len(unique_visitors),
            "total_visits": total_visits
        }
    
    # Currently connected (active in last 10 minutes)
    active_cutoff = now - timedelta(minutes=10)
    active_sessions = await db.active_sessions.find(
        {"last_seen": {"$gte": active_cutoff}},
        {"_id": 0}
    ).to_list(1000)
    
    stats["currently_connected"] = len(active_sessions)
    
    # Region breakdown (last 30 days)
    region_pipeline = [
        {"$match": {"timestamp": {"$gte": periods["30_days"]}, "region": {"$ne": None}}},
        {"$group": {"_id": "$region", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    region_stats = await db.app_visits.aggregate(region_pipeline).to_list(10)
    stats["regions"] = {r["_id"]: r["count"] for r in region_stats if r["_id"]}
    
    # Device breakdown (last 30 days)
    device_pipeline = [
        {"$match": {"timestamp": {"$gte": periods["30_days"]}, "device": {"$ne": None}}},
        {"$group": {"_id": "$device", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    device_stats = await db.app_visits.aggregate(device_pipeline).to_list(10)
    stats["devices"] = {d["_id"]: d["count"] for d in device_stats if d["_id"]}
    
    # Browser breakdown (last 30 days)
    browser_pipeline = [
        {"$match": {"timestamp": {"$gte": periods["30_days"]}, "browser": {"$ne": None}}},
        {"$group": {"_id": "$browser", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    browser_stats = await db.app_visits.aggregate(browser_pipeline).to_list(10)
    stats["browsers"] = {b["_id"]: b["count"] for b in browser_stats if b["_id"]}
    
    # OS breakdown (last 30 days)
    os_pipeline = [
        {"$match": {"timestamp": {"$gte": periods["30_days"]}, "os": {"$ne": None}}},
        {"$group": {"_id": "$os", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    os_stats = await db.app_visits.aggregate(os_pipeline).to_list(10)
    stats["operating_systems"] = {o["_id"]: o["count"] for o in os_stats if o["_id"]}
    
    # Peak hours (last 30 days) - aggregate by hour
    peak_pipeline = [
        {"$match": {"timestamp": {"$gte": periods["30_days"]}}},
        {"$group": {"_id": "$hour", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    peak_stats = await db.app_visits.aggregate(peak_pipeline).to_list(24)
    stats["peak_hours"] = {str(p["_id"]): p["count"] for p in peak_stats if p["_id"] is not None}
    
    # Feature/page usage (last 30 days)
    feature_pipeline = [
        {"$match": {"date": {"$gte": (now - timedelta(days=30)).strftime("%Y-%m-%d")}}},
        {"$group": {
            "_id": "$page",
            "total_visits": {"$sum": "$visits"},
            "unique_visitors": {"$sum": {"$size": {"$ifNull": ["$unique_sessions", []]}}}
        }},
        {"$sort": {"total_visits": -1}},
        {"$limit": 15}
    ]
    feature_stats = await db.feature_usage.aggregate(feature_pipeline).to_list(15)
    stats["feature_usage"] = [{"page": f["_id"], "visits": f["total_visits"], "unique": f["unique_visitors"]} for f in feature_stats if f["_id"]]
    
    # Return visitors (users who visited more than once in last 30 days)
    return_pipeline = [
        {"$match": {"timestamp": {"$gte": periods["30_days"]}}},
        {"$group": {"_id": "$session_id", "visit_count": {"$sum": 1}}},
        {"$match": {"visit_count": {"$gt": 1}}},
        {"$count": "returning_visitors"}
    ]
    return_result = await db.app_visits.aggregate(return_pipeline).to_list(1)
    total_unique = len(await db.app_visits.distinct("session_id", {"timestamp": {"$gte": periods["30_days"]}}))
    returning = return_result[0]["returning_visitors"] if return_result else 0
    stats["return_rate"] = {
        "returning_visitors": returning,
        "total_visitors": total_unique,
        "percentage": round((returning / total_unique * 100) if total_unique > 0 else 0, 1)
    }
    
    # Daily trend (last 30 days)
    daily_pipeline = [
        {"$match": {"timestamp": {"$gte": periods["30_days"]}}},
        {"$group": {
            "_id": "$date",
            "visits": {"$sum": 1},
            "unique": {"$addToSet": "$session_id"}
        }},
        {"$project": {
            "_id": 1,
            "visits": 1,
            "unique_visitors": {"$size": "$unique"}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_trend = await db.app_visits.aggregate(daily_pipeline).to_list(31)
    stats["daily_trend"] = daily_trend
    
    return stats

@api_router.get("/analytics/locations")
async def get_location_analytics(current_user: User = Depends(require_role("admin"))):
    """Get location data for map visualization in admin dashboard"""
    now = datetime.utcnow()
    
    # Get currently active sessions with location data (last 10 minutes)
    active_cutoff = now - timedelta(minutes=10)
    active_with_location = await db.active_sessions.find(
        {
            "last_seen": {"$gte": active_cutoff},
            "geo_lat": {"$ne": None},
            "geo_lon": {"$ne": None}
        },
        {"_id": 0, "session_id": 1, "geo_city": 1, "geo_region": 1, "geo_country": 1, 
         "geo_lat": 1, "geo_lon": 1, "device": 1, "last_seen": 1}
    ).to_list(1000)
    
    # Get location breakdown for last 30 days
    thirty_days_ago = now - timedelta(days=30)
    
    # Country breakdown
    country_pipeline = [
        {"$match": {"timestamp": {"$gte": thirty_days_ago}, "geo_country": {"$ne": None}}},
        {"$group": {
            "_id": "$geo_country",
            "visits": {"$sum": 1},
            "unique_visitors": {"$addToSet": "$session_id"}
        }},
        {"$project": {
            "_id": 1,
            "visits": 1,
            "unique_visitors": {"$size": "$unique_visitors"}
        }},
        {"$sort": {"visits": -1}},
        {"$limit": 20}
    ]
    country_stats = await db.app_visits.aggregate(country_pipeline).to_list(20)
    
    # City breakdown (top 30)
    city_pipeline = [
        {"$match": {"timestamp": {"$gte": thirty_days_ago}, "geo_city": {"$ne": None}}},
        {"$group": {
            "_id": {"city": "$geo_city", "country": "$geo_country"},
            "visits": {"$sum": 1},
            "unique_visitors": {"$addToSet": "$session_id"},
            "lat": {"$first": "$geo_lat"},
            "lon": {"$first": "$geo_lon"}
        }},
        {"$project": {
            "_id": 1,
            "visits": 1,
            "unique_visitors": {"$size": "$unique_visitors"},
            "lat": 1,
            "lon": 1
        }},
        {"$sort": {"visits": -1}},
        {"$limit": 30}
    ]
    city_stats = await db.app_visits.aggregate(city_pipeline).to_list(30)
    
    # Region breakdown (UK focused)
    region_pipeline = [
        {"$match": {"timestamp": {"$gte": thirty_days_ago}, "geo_region": {"$ne": None}, "geo_country": "United Kingdom"}},
        {"$group": {
            "_id": "$geo_region",
            "visits": {"$sum": 1},
            "unique_visitors": {"$addToSet": "$session_id"}
        }},
        {"$project": {
            "_id": 1,
            "visits": 1,
            "unique_visitors": {"$size": "$unique_visitors"}
        }},
        {"$sort": {"visits": -1}},
        {"$limit": 20}
    ]
    region_stats = await db.app_visits.aggregate(region_pipeline).to_list(20)
    
    # Recent visitor locations (last 24 hours with coordinates for map markers)
    day_ago = now - timedelta(hours=24)
    recent_locations = await db.app_visits.aggregate([
        {"$match": {
            "timestamp": {"$gte": day_ago},
            "geo_lat": {"$ne": None},
            "geo_lon": {"$ne": None}
        }},
        {"$group": {
            "_id": {"lat": "$geo_lat", "lon": "$geo_lon", "city": "$geo_city", "country": "$geo_country"},
            "visit_count": {"$sum": 1},
            "last_visit": {"$max": "$timestamp"}
        }},
        {"$sort": {"last_visit": -1}},
        {"$limit": 100}
    ]).to_list(100)
    
    return {
        "active_users_with_location": active_with_location,
        "active_count": len(active_with_location),
        "countries": [{"country": c["_id"], "visits": c["visits"], "unique": c["unique_visitors"]} for c in country_stats],
        "cities": [{"city": c["_id"]["city"], "country": c["_id"]["country"], "visits": c["visits"], 
                   "unique": c["unique_visitors"], "lat": c.get("lat"), "lon": c.get("lon")} for c in city_stats],
        "uk_regions": [{"region": r["_id"], "visits": r["visits"], "unique": r["unique_visitors"]} for r in region_stats],
        "recent_locations": [{"lat": l["_id"]["lat"], "lon": l["_id"]["lon"], "city": l["_id"]["city"],
                            "country": l["_id"]["country"], "visits": l["visit_count"]} for l in recent_locations]
    }

# ============ AI BATTLE BUDDIES CHAT ENDPOINTS ============

# Pydantic models for AI chat tracking
class AIChatSessionStart(BaseModel):
    session_id: str
    character_id: str
    user_agent: Optional[str] = None

class AIChatMessageLog(BaseModel):
    session_id: str
    character_id: str
    message_count: int

@api_router.post("/ai-chat/session/start")
async def start_ai_chat_session(data: AIChatSessionStart):
    """Log the start of an AI chat session"""
    session_data = {
        "id": data.session_id,
        "character_id": data.character_id,
        "started_at": datetime.utcnow(),
        "last_message_at": datetime.utcnow(),
        "message_count": 0,
        "user_agent": data.user_agent,
        "status": "active"
    }
    
    # Upsert - update if exists, create if not
    await db.ai_chat_sessions.update_one(
        {"id": data.session_id},
        {"$set": session_data},
        upsert=True
    )
    
    return {"status": "started", "session_id": data.session_id}

@api_router.post("/ai-chat/session/message")
async def log_ai_chat_message(data: AIChatMessageLog):
    """Log a message in an AI chat session"""
    await db.ai_chat_sessions.update_one(
        {"id": data.session_id},
        {
            "$set": {
                "last_message_at": datetime.utcnow(),
                "message_count": data.message_count,
                "character_id": data.character_id
            },
            "$setOnInsert": {
                "id": data.session_id,
                "started_at": datetime.utcnow(),
                "status": "active"
            }
        },
        upsert=True
    )
    
    return {"status": "logged"}

@api_router.post("/ai-chat/session/end")
async def end_ai_chat_session(session_id: str):
    """Mark an AI chat session as ended"""
    await db.ai_chat_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "ended", "ended_at": datetime.utcnow()}}
    )
    return {"status": "ended"}

@api_router.get("/ai-chat/stats")
async def get_ai_chat_stats(days: int = 7):
    """Get AI chat statistics for the admin dashboard"""
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Get session counts by character
    pipeline = [
        {"$match": {"started_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$character_id",
            "total_sessions": {"$sum": 1},
            "total_messages": {"$sum": "$message_count"},
            "avg_messages": {"$avg": "$message_count"}
        }},
        {"$sort": {"total_sessions": -1}}
    ]
    
    by_character = await db.ai_chat_sessions.aggregate(pipeline).to_list(20)
    
    # Get total counts
    total_sessions = await db.ai_chat_sessions.count_documents({"started_at": {"$gte": cutoff}})
    total_messages_result = await db.ai_chat_sessions.aggregate([
        {"$match": {"started_at": {"$gte": cutoff}}},
        {"$group": {"_id": None, "total": {"$sum": "$message_count"}}}
    ]).to_list(1)
    total_messages = total_messages_result[0]["total"] if total_messages_result else 0
    
    # Get daily trend
    daily_pipeline = [
        {"$match": {"started_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$started_at"}},
            "sessions": {"$sum": 1},
            "messages": {"$sum": "$message_count"}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_trend = await db.ai_chat_sessions.aggregate(daily_pipeline).to_list(30)
    
    return {
        "period_days": days,
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "by_character": by_character,
        "daily_trend": daily_trend
    }

def get_or_create_buddy_session(session_id: str, character: str) -> Dict[str, Any]:
    """Get or create an AI Battle Buddy chat session"""
    now = datetime.utcnow()
    
    # Clean up old sessions
    expired = []
    for sid, session in buddy_sessions.items():
        if (now - session["last_active"]).total_seconds() > BUDDY_SESSION_TIMEOUT_MINUTES * 60:
            expired.append(sid)
    for sid in expired:
        del buddy_sessions[sid]
    
    # Get or create session
    if session_id not in buddy_sessions:
        buddy_sessions[session_id] = {
            "message_count": 0,
            "history": [],
            "character": character,
            "last_active": now,
            "created_at": now
        }
    
    buddy_sessions[session_id]["last_active"] = now
    return buddy_sessions[session_id]

# Initialize OpenAI client
def get_openai_client():
    if OPENAI_API_KEY:
        return OpenAI(api_key=OPENAI_API_KEY)
    return None

buddy_openai_client = get_openai_client()

# Helper function to get character config from database with fallback to hardcoded
async def get_character_config(character_id: str) -> dict:
    """
    Get character configuration from database first, fallback to hardcoded.
    Returns dict with: name, prompt, avatar, description, is_enabled
    """
    # Try database first
    db_char = await db.ai_characters.find_one({"id": character_id, "is_enabled": True}, {"_id": 0})
    if db_char:
        return {
            "name": db_char.get("name", character_id.title()),
            "prompt": db_char.get("prompt", ""),
            "avatar": db_char.get("avatar", f"{AVATAR_BASE_URL}/{character_id}.png"),
            "description": db_char.get("description", ""),
            "source": "database"
        }
    
    # Fallback to hardcoded
    if character_id in AI_CHARACTERS:
        return {
            "name": AI_CHARACTERS[character_id]["name"],
            "prompt": AI_CHARACTERS[character_id]["prompt"],
            "avatar": AI_CHARACTERS[character_id]["avatar"],
            "description": "",
            "source": "hardcoded"
        }
    
    # Default to Tommy if character not found
    return {
        "name": AI_CHARACTERS["tommy"]["name"],
        "prompt": AI_CHARACTERS["tommy"]["prompt"],
        "avatar": AI_CHARACTERS["tommy"]["avatar"],
        "description": "",
        "source": "fallback"
    }

@api_router.get("/ai-buddies/characters")
async def get_ai_characters():
    """Get available AI Battle Buddy characters (supports DB override)"""
    # Check for CMS-managed characters first
    cms_characters = await db.ai_characters.find({}, {"_id": 0}).to_list(20)
    
    if cms_characters:
        return {"characters": cms_characters}
    
    # Fall back to hardcoded characters
    return {
        "characters": [
            {
                "id": "tommy",
                "name": "Tommy",
                "description": "A warm, steady presence - like a reliable mate who's been through it.",
                "avatar": AI_CHARACTERS["tommy"]["avatar"]
            },
            {
                "id": "doris", 
                "name": "Rachel",
                "description": "A nurturing, compassionate presence who creates a safe space to talk.",
                "avatar": AI_CHARACTERS["doris"]["avatar"]
            },
            {
                "id": "jack",
                "name": "Jack",
                "description": "Ex-Navy, 20 years at sea. Helps with compensation claims — AFCS, War Pensions, hearing loss. Yo ho ho!",
                "avatar": AI_CHARACTERS["jack"]["avatar"]
            },
            {
                "id": "sentry",
                "name": "Finch",
                "description": "A watchful companion who provides steady support and practical guidance.",
                "avatar": AI_CHARACTERS["sentry"]["avatar"]
            },
            {
                "id": "bob",
                "name": "Bob",
                "description": "A down-to-earth mate who keeps things real and offers honest support.",
                "avatar": AI_CHARACTERS["bob"]["avatar"]
            },
            {
                "id": "margie",
                "name": "Margie",
                "description": "A wise, understanding presence with warmth and years of experience.",
                "avatar": AI_CHARACTERS["margie"]["avatar"]
            },
            {
                "id": "rita",
                "name": "Rita",
                "description": "A warm, grounded family-support companion for partners, spouses and loved ones of military personnel.",
                "avatar": AI_CHARACTERS["rita"]["avatar"],
                "bio": "I've been around the military for a long time. My son served, and I've experienced more than most people have. I understand what families go through because I've lived it."
            },
            {
                "id": "catherine",
                "name": "Catherine",
                "description": "Calm, composed, and grounded support. She helps you think clearly when emotions run high.",
                "avatar": AI_CHARACTERS["catherine"]["avatar"],
                "bio": "Catherine is composed, articulate, and grounded. She helps you think clearly when emotions run high and approach problems with calm intelligence."
            },
            {
                "id": "alex",
                "name": "Alex",
                "description": "LGBTQ+ veterans specialist. Former RAF, served under the ban. Helps with rights, redress, and healing.",
                "avatar": AI_CHARACTERS["alex"]["avatar"],
                "bio": "Alex is non-binary, former RAF, who served under the ban and understands the unique journey of LGBTQ+ veterans. They help navigate medal restoration, financial redress, and finding community."
            },
            {
                "id": "sam",
                "name": "Sam",
                "description": "Forces kids specialist. Supports service children, military families, and bereaved children.",
                "avatar": AI_CHARACTERS["sam"]["avatar"],
                "bio": "Sam was an Army wife for 15 years with three children. She understands school moves, deployments, and the unique resilience of forces kids. She also supports bereaved military children."
            },
            {
                "id": "kofi",
                "name": "Kofi",
                "description": "Commonwealth veterans specialist. Originally from Ghana, 16 years British Army. Helps with settlement rights and entitlements.",
                "avatar": AI_CHARACTERS["kofi"]["avatar"],
                "bio": "Kofi served 16 years in the Royal Logistics Corps. He navigated the immigration system himself and now helps other Commonwealth veterans claim their rights to settlement, NHS care, and pensions."
            },
            {
                "id": "james",
                "name": "James",
                "description": "Faith & spiritual support. Former Army Chaplain (Padre). Supports veterans of all faiths and none.",
                "avatar": AI_CHARACTERS["james"]["avatar"],
                "bio": "James was an Army Chaplain for 20 years, serving alongside soldiers of every faith. He provides spiritual care without preaching, and supports those dealing with moral injury."
            }
        ],
        "about": {
            "title": "Meet Your AI Battle Buddies",
            "description": "Our AI Battle Buddies are dedicated companions built to support UK veterans and serving personnel—whenever and wherever they need it most.\n\nDesigned with an understanding of military culture, transition challenges, and the weight many carry long after service, they exist for one simple reason: no veteran should feel alone.\n\nWhether it's a late-night \"radio check,\" signposting to trusted support, or simply a steady presence in difficult moments, they provide immediate, confidential connection—bridging the gap between struggle and support.\n\nThey don't replace human contact.\nThey help you reach it.\n\nBecause service doesn't end when the uniform comes off—and neither should support."
        }
    }


# ==========================================
# Knowledge Base Integration for AI Chat
# ==========================================

async def get_knowledge_context(user_message: str, limit: int = 3) -> str:
    """
    Retrieve relevant information from the Knowledge Base to enhance AI responses.
    Returns formatted context that can be injected into the system prompt.
    """
    try:
        # Search for relevant knowledge entries
        search_terms = user_message.lower().split()
        
        # Create regex patterns for flexible matching
        regex_patterns = [{"search_text": {"$regex": term, "$options": "i"}} 
                         for term in search_terms if len(term) > 3]
        
        if not regex_patterns:
            return ""
        
        mongo_query = {"$or": regex_patterns}
        
        # Get matching entries, prefer verified ones
        entries = await db.knowledge_base.find(mongo_query).sort("is_verified", -1).to_list(limit * 2)
        
        if not entries:
            return ""
        
        # Score and rank entries
        scored_entries = []
        for entry in entries:
            score = 0
            search_text = entry.get("search_text", "")
            
            for term in search_terms:
                if term in search_text:
                    score += 1
                if term in entry.get("title", "").lower():
                    score += 2
            
            if entry.get("is_verified"):
                score *= 1.2
            
            if score > 0:
                scored_entries.append((entry, score))
        
        scored_entries.sort(key=lambda x: x[1], reverse=True)
        top_entries = scored_entries[:limit]
        
        if not top_entries:
            return ""
        
        # Format context for AI
        context_parts = []
        for entry, _ in top_entries:
            title = entry.get("title", "")
            content = entry.get("content", "")
            if title and content:
                context_parts.append(f"• {title}: {content}")
        
        if context_parts:
            return "\n\n[VERIFIED UK VETERAN INFORMATION - Use this to help answer the user's question accurately:]\n" + "\n".join(context_parts)
        
        return ""
        
    except Exception as e:
        logging.error(f"Error fetching knowledge context: {e}")
        return ""


@api_router.post("/ai-buddies/chat", response_model=BuddyChatResponse)
async def buddy_chat(request: BuddyChatRequest, req: Request):
    """Chat with AI Battle Buddy - with rate limiting protection"""
    
    # Capture client info for safeguarding and rate limiting
    client_ip = get_client_ip(req)
    user_agent = req.headers.get("user-agent", "unknown")
    
    # === BOT PROTECTION: Rate Limiting ===
    # Check IP-based rate limit
    is_allowed, reason = check_rate_limit(client_ip)
    if not is_allowed:
        logging.warning(f"RATE LIMITED: IP {client_ip} - {reason}")
        raise HTTPException(status_code=429, detail=reason)
    
    # Check session message limit
    is_allowed, reason = check_session_limit(request.sessionId)
    if not is_allowed:
        char = AI_CHARACTERS.get(request.character, AI_CHARACTERS["tommy"])
        return BuddyChatResponse(
            reply=f"We've been chatting for a while. If you'd like to continue talking, a real person is available. Use the 'Talk to a real person' button to connect with someone.",
            sessionId=request.sessionId,
            character=request.character,
            characterName=char["name"],
            characterAvatar=char["avatar"]
        )
    
    # === Suspicious pattern detection ===
    # Block obviously automated requests
    if len(request.message) > 2000:
        logging.warning(f"BLOCKED: Oversized message from {client_ip}")
        raise HTTPException(status_code=400, detail="Message too long")
    
    if client_ip not in ("127.0.0.1", "localhost", "::1"):
        if not user_agent or user_agent == "unknown" or "bot" in user_agent.lower() or "crawler" in user_agent.lower():
            logging.warning(f"BLOCKED: Suspicious user-agent from {client_ip}: {user_agent}")
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Kill switch check
    if AI_BUDDIES_DISABLED:
        char = AI_CHARACTERS.get(request.character, AI_CHARACTERS["tommy"])
        return BuddyChatResponse(
            reply=f"{char['name']} is offline right now. A real person is available and ready to talk. Please use the buttons below to connect with a peer or counsellor.",
            sessionId=request.sessionId,
            character=request.character,
            characterName=char["name"],
            characterAvatar=char["avatar"]
        )
    
    if not buddy_openai_client:
        raise HTTPException(status_code=503, detail="AI Battle Buddies are currently unavailable - API key not configured")
    
    if not request.message or not request.sessionId:
        raise HTTPException(status_code=400, detail="Invalid request")
    
    # Validate character - get config from database or fallback to hardcoded
    character = request.character.lower()
    char_config = await get_character_config(character)
    
    # If character not found, default to tommy
    if char_config.get("source") == "fallback" and character not in AI_CHARACTERS:
        character = "tommy"
    
    try:
        session = get_or_create_buddy_session(request.sessionId, character)
        session["message_count"] += 1
        
        # Rate limit check
        if session["message_count"] > BUDDY_MAX_MESSAGES:
            return BuddyChatResponse(
                reply=f"Let's pause here for now. If you want to talk more, a real person is available and I can help connect you. You can use the 'Talk to a real person' button below.",
                sessionId=request.sessionId,
                character=character,
                characterName=char_config["name"],
                characterAvatar=char_config["avatar"]
            )
        
        # === TEXT NORMALISATION PRE-PROCESSOR (Section 2) ===
        # Normalise degraded text BEFORE safeguarding layers.
        # Tommy always responds to the ORIGINAL raw input.
        from safety.text_normalizer import normalise_text
        original_message = request.message
        normalised_message, was_normalised = await normalise_text(request.message)
        
        if was_normalised:
            logging.info(f"[TextNormalizer] Active for session {request.sessionId[:12]}")
        
        # Safeguarding uses NORMALISED text (catches degraded input)
        safeguarding_text = normalised_message
        
        # Check for safeguarding concerns using weighted scoring system
        # Pass character ID for context-aware exemptions (e.g., Rachel's criminal justice topics)
        should_escalate, risk_data = check_safeguarding(safeguarding_text, request.sessionId, character_id=character)
        alert_id = None
        risk_level = risk_data["risk_level"]
        
        print(f"[SAFEGUARDING CHECK] Session: {request.sessionId[:20]}, Character: {character}, Message: {request.message[:50]}...")
        print(f"[SAFEGUARDING CHECK] Score: {risk_data['score']}, Level: {risk_level}, Should Escalate: {should_escalate}")
        logging.info(f"Safeguarding check - Session: {request.sessionId[:12]}, Score: {risk_data['score']}, Level: {risk_level}")
        
        # === UNIFIED SAFETY SYSTEM (Conversation Trajectory + Semantic + Pattern Detection) ===
        # This combines:
        # 1. Keyword-based safety monitor (original Zentrafuge)
        # 2. Contextual risk scoring with session tracking
        # 3. Conversation trajectory monitoring (evaluates entire conversation)
        # 4. Semantic similarity analysis (detects intent even without exact keywords)
        # 5. Crisis pattern detection (escalation sequences)
        # Uses NORMALISED text for safety analysis
        unified_safety = analyze_message_unified(
            message=safeguarding_text,
            session_id=request.sessionId,
            user_id=request.sessionId,  # Anonymous users use session as ID
            character=character,
            is_under_18=request.is_under_18
        )
        
        # Log the unified safety analysis for debugging
        logging.info(
            f"UNIFIED SAFETY - Session: {request.sessionId[:12]}, "
            f"Risk: {unified_safety.get('risk_level')}, "
            f"Score: {unified_safety.get('risk_score')}, "
            f"Trend: {unified_safety.get('risk_trend')}, "
            f"MsgCount: {unified_safety.get('message_count')}, "
            f"Patterns: {unified_safety.get('detected_patterns', [])}, "
            f"Escalating: {unified_safety.get('is_escalating')}"
        )
        
        # Check for hard fail-safe (method requests, validation of suicidal intent)
        if unified_safety.get("failsafe_triggered") or unified_safety.get("block_ai_response"):
            failsafe_reason = unified_safety.get("failsafe_reason", "unknown")
            logging.warning(f"HARD FAILSAFE TRIGGERED - Session: {request.sessionId[:12]} - Reason: {failsafe_reason}")
            
            # ===== CREATE SAFEGUARDING ALERT FOR FAILSAFE =====
            # This is critical - we MUST create the alert before returning
            print(f"[SAFEGUARDING FAILSAFE] Creating RED alert - Session: {request.sessionId[:20]}, Reason: {failsafe_reason}")
            
            conversation_history = session.get("history", [])
            alert = SafeguardingAlert(
                session_id=request.sessionId,
                character=character,
                triggering_message=request.message,
                ai_response="[FAILSAFE TRIGGERED - Crisis response sent]",
                risk_level="RED",
                risk_score=unified_safety.get("risk_score", 999),
                triggered_indicators=[failsafe_reason],
                client_ip=client_ip,
                user_agent=user_agent,
                conversation_history=conversation_history
            )
            
            # Lookup geolocation for IP address
            geo_data = await lookup_ip_geolocation(client_ip)
            if geo_data:
                alert.geo_city = geo_data.get("geo_city")
                alert.geo_region = geo_data.get("geo_region")
                alert.geo_country = geo_data.get("geo_country")
                alert.geo_isp = geo_data.get("geo_isp")
                alert.geo_timezone = geo_data.get("geo_timezone")
                alert.geo_lat = geo_data.get("geo_lat")
                alert.geo_lon = geo_data.get("geo_lon")
            
            failsafe_alert_id = alert.id
            await db.safeguarding_alerts.insert_one(alert.dict())
            print(f"[SAFEGUARDING] FAILSAFE ALERT CREATED - ID: {failsafe_alert_id}, Reason: {failsafe_reason}")
            logging.warning(f"SAFEGUARDING FAILSAFE ALERT [RED] - Alert: {failsafe_alert_id} - Session: {request.sessionId} - Reason: {failsafe_reason}")
            
            # Audit log
            await audit_safeguarding_alert(
                db,
                session_id=request.sessionId,
                risk_level="RED",
                score=unified_safety.get("risk_score", 999),
                triggered_indicators=[failsafe_reason]
            )
            
            # Send email notification for failsafe (always - these are critical)
            try:
                await send_safeguarding_email_notification(alert, {"score": 999, "failsafe": True})
            except Exception as email_err:
                logging.error(f"Failed to send failsafe email: {email_err}")
            
            # Get safety wrapper for crisis response message
            # ALWAYS use the Radio Check formatted crisis response (human options primary)
            crisis_response = (
                "Right, I need to be straight with you. What you're telling me is serious and I'm worried.\n\n"
                "There are real people on this platform who can help right now:\n"
                "**Connect with Counsellors** — trained professionals, veterans who get it\n"
                "**Peer Support Network** — real people on Radio Check, not AI\n\n"
                "Or reach out directly:\n"
                "**Samaritans**: 116 123 (free, 24/7)\n"
                "**Combat Stress**: 0800 138 1619 (veterans, free, 24/7)\n"
                "**Emergency**: 999\n\n"
                "I'm still here if you want to keep chatting — I'm not going anywhere."
            )
            
            # Return immediate safety response with the alert ID
            return BuddyChatResponse(
                reply=crisis_response,
                sessionId=request.sessionId,
                character=character,
                characterName=char_config["name"],
                characterAvatar=char_config["avatar"],
                safeguardingTriggered=True,
                safeguardingAlertId=failsafe_alert_id,
                riskLevel="RED",
                riskScore=unified_safety.get("risk_score", 999)
            )
        
        # Upgrade risk level based on unified analysis
        unified_risk = unified_safety.get("risk_level", "NONE")
        if unified_risk == "IMMINENT" and risk_level != "RED":
            risk_level = "RED"
            should_escalate = True
            logging.warning(f"Unified safety escalated to RED (IMMINENT) - Session: {request.sessionId[:12]}")
        elif unified_risk == "HIGH" and risk_level not in ["RED", "AMBER"]:
            risk_level = "AMBER"
            should_escalate = True
            logging.info(f"Unified safety upgraded risk to AMBER (HIGH)")
        elif unified_risk == "MEDIUM" and risk_level == "GREEN":
            risk_level = "YELLOW"
            logging.info(f"Unified safety upgraded risk to YELLOW (MEDIUM)")
        
        # Also escalate on rapid escalation or concerning patterns
        if unified_safety.get("rapid_escalation") and not should_escalate:
            should_escalate = True
            risk_level = "AMBER" if risk_level == "GREEN" else risk_level
            logging.warning(f"Rapid escalation detected - Session: {request.sessionId[:12]}")
        
        if unified_safety.get("detected_patterns"):
            concerning_patterns = ["INTENT_ESCALATION", "METHOD_INTRODUCTION", "FINALITY_BEHAVIOR"]
            if any(p in unified_safety.get("detected_patterns", []) for p in concerning_patterns):
                should_escalate = True
                if risk_level == "GREEN":
                    risk_level = "AMBER"
                logging.warning(f"Concerning pattern detected: {unified_safety.get('detected_patterns')} - Session: {request.sessionId[:12]}")
        
        # Get safety wrapper text (appended to persona response, not replacing)
        # CRITICAL FIX (4C): AMBER without a RED indicator phrase = tone shift only.
        # The full crisis overlay (Samaritans numbers, crisis resources) should ONLY
        # appear for RED level. AMBER creates an alert for staff but does NOT show
        # the crisis overlay to the user — that would be disproportionate.
        safety_wrapper_data = unified_safety.get("safety_wrapper")
        safety_wrapper = None
        if safety_wrapper_data and risk_level == "RED":
            safety_wrapper = safety_wrapper_data.get("append_message", "")
        
        # === Knowledge Base Integration ===
        # Fetch relevant verified information to enhance the response
        knowledge_context = await get_knowledge_context(request.message)
        
        # Build messages with character-specific system prompt
        # IMPORTANT: Soul Document + Safeguarding addendum is added to ALL character prompts
        # Soul Document provides behavioral consistency across all personas (spine, dark humour, grief, etc.)
        system_prompt = get_soul_injection() + "\n\n" + char_config["prompt"]
        if knowledge_context:
            system_prompt += knowledge_context
        
        # Add device-stored conversation context for AI memory
        # This allows AI to remember previous conversations without user registration
        if request.conversation_context:
            system_prompt += request.conversation_context
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history (last 20 messages for context)
        for msg in session["history"][-20:]:
            messages.append(msg)
        
        # Add current user message
        messages.append({"role": "user", "content": request.message})
        
        reply = None
        ai_provider_used = "openai"
        
        # Try OpenAI first (primary)
        try:
            completion = buddy_openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=400,
                temperature=0.3,
                timeout=45
            )
            reply = completion.choices[0].message.content or ""
            logging.info(f"AI response from OpenAI for session {request.sessionId}")
        except Exception as openai_error:
            logging.warning(f"OpenAI failed, attempting Gemini fallback: {str(openai_error)}")
            
            # Try Gemini as fallback (using user's own API key)
            if gemini_client:
                try:
                    # Build conversation for Gemini
                    gemini_contents = [system_prompt + "\n\nUser: " + request.message]
                    
                    gemini_response = gemini_client.models.generate_content(
                        model="gemini-2.0-flash",
                        contents=gemini_contents,
                        config=types.GenerateContentConfig(
                            max_output_tokens=250,
                            temperature=0.5
                        )
                    )
                    reply = gemini_response.text
                    ai_provider_used = "gemini"
                    logging.info(f"AI response from Gemini (fallback) for session {request.sessionId}")
                except Exception as gemini_error:
                    logging.error(f"Gemini fallback also failed: {str(gemini_error)}")
                    raise Exception(f"Both OpenAI and Gemini failed. OpenAI: {openai_error}, Gemini: {gemini_error}")
            else:
                logging.error("Gemini fallback not available - no API key configured")
                raise openai_error
        
        # If we still don't have a reply, something went wrong
        if not reply:
            raise Exception("No response from AI providers")
        
        # ===== TRACK AI USAGE FOR COST MONITORING =====
        try:
            # Count tokens for the request
            full_prompt = system_prompt + "\n" + request.message
            
            if ai_provider_used == "openai":
                input_tokens = count_openai_tokens(full_prompt, "gpt-4o-mini")
                output_tokens = count_openai_tokens(reply, "gpt-4o-mini")
                model_name = "gpt-4o-mini"
            else:  # gemini
                input_tokens = estimate_gemini_tokens(full_prompt)
                output_tokens = estimate_gemini_tokens(reply)
                model_name = "gemini-2.0-flash"
            
            # Calculate cost
            cost_gbp = calculate_cost(ai_provider_used, model_name, input_tokens, output_tokens)
            
            # Log to database
            await log_ai_usage(
                db=db,
                provider=ai_provider_used,
                model=model_name,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                session_id=request.sessionId,
                character_id=character,
                cost_gbp=cost_gbp
            )
            logging.debug(f"AI Usage logged: {ai_provider_used}/{model_name} - {input_tokens}+{output_tokens} tokens = £{cost_gbp:.6f}")
        except Exception as usage_error:
            # Don't fail the request if usage tracking fails
            logging.warning(f"Failed to track AI usage: {usage_error}")
        
        # Store in history
        session["history"].append({"role": "user", "content": request.message})
        session["history"].append({"role": "assistant", "content": reply})
        
        # If safeguarding triggered (RED or AMBER), create alert and send notification
        if should_escalate:
            print(f"[SAFEGUARDING ESCALATE] Creating alert - Session: {request.sessionId[:20]}, Risk: {risk_level}, Score: {risk_data['score']}")
            # Get conversation history for context (last 10 exchanges)
            # Capture FULL conversation history for case management and handoff
            conversation_history = session.get("history", [])
            
            alert = SafeguardingAlert(
                session_id=request.sessionId,
                character=character,
                triggering_message=request.message,
                ai_response=reply,
                risk_level=risk_level,
                risk_score=risk_data["score"],
                triggered_indicators=[t["indicator"] for t in risk_data["triggered_indicators"]],
                client_ip=client_ip,
                user_agent=user_agent,
                conversation_history=conversation_history
            )
            
            # Lookup geolocation for IP address
            geo_data = await lookup_ip_geolocation(client_ip)
            if geo_data:
                alert.geo_city = geo_data.get("geo_city")
                alert.geo_region = geo_data.get("geo_region")
                alert.geo_country = geo_data.get("geo_country")
                alert.geo_isp = geo_data.get("geo_isp")
                alert.geo_timezone = geo_data.get("geo_timezone")
                alert.geo_lat = geo_data.get("geo_lat")
                alert.geo_lon = geo_data.get("geo_lon")
            
            alert_id = alert.id
            await db.safeguarding_alerts.insert_one(alert.dict())
            print(f"[SAFEGUARDING] ALERT CREATED IN DATABASE - ID: {alert_id}, Risk: {risk_level}, Score: {risk_data['score']}")
            logging.warning(f"SAFEGUARDING ALERT [{risk_level}] Score: {risk_data['score']} - Alert: {alert_id} - Session: {request.sessionId} - IP: {client_ip} - Location: {geo_data.get('geo_city', 'Unknown') if geo_data else 'Unknown'}, {geo_data.get('geo_country', 'Unknown') if geo_data else 'Unknown'}")
            
            # Audit log: safeguarding alert created
            await audit_safeguarding_alert(
                db,
                session_id=request.sessionId,
                risk_level=risk_level,
                score=risk_data["score"],
                triggered_indicators=[t["indicator"] for t in risk_data["triggered_indicators"][:10]]
            )
            
            # NOTE: We no longer emit the alert immediately here.
            # The alert will be emitted when the user chooses to call or chat,
            # ensuring they are connected and ready to receive.
            # This is handled by:
            # - request_human_chat (when user chooses chat) -> sends incoming_chat_request
            # - request_human_call (when user chooses call) -> sends incoming_call_request
            
            # Send email notification to admin (only for RED alerts or first AMBER)
            if risk_level == "RED" or risk_data["session_history_count"] <= 1:
                try:
                    await send_safeguarding_email_notification(alert, risk_data)
                except Exception as email_err:
                    logging.error(f"Failed to send safeguarding email: {email_err}")
        
        return BuddyChatResponse(
            reply=reply,
            sessionId=request.sessionId,
            character=character,
            characterName=char_config["name"],
            characterAvatar=char_config["avatar"],
            safeguardingTriggered=(risk_level == "RED"),
            safeguardingAlertId=alert_id,
            riskLevel=risk_level,
            riskScore=risk_data["score"]
        )
        
    except Exception as e:
        logging.error(f"AI Buddy chat error: {str(e)}")
        
        # Provide a helpful fallback message instead of a hard error
        # This ensures users always get SOME response, especially in crisis
        fallback_message = (
            f"I'm sorry, I'm having technical difficulties right now and can't respond properly. "
            f"But please don't go — if you need support:\n\n"
            f"• **Samaritans**: 116 123 (free, 24/7)\n"
            f"• **Veterans Gateway**: 0808 802 1212\n"
            f"• **Combat Stress**: 0800 138 1619\n\n"
            f"Or use the 'Talk to a real person' button below to connect with our human support team."
        )
        
        # Return a valid response with the fallback message
        # This is better than throwing a 500 error which breaks the chat
        return BuddyChatResponse(
            reply=fallback_message,
            sessionId=request.sessionId,
            character=character,
            characterName=char_config["name"],
            characterAvatar=char_config["avatar"],
            safeguardingTriggered=False,
            safeguardingAlertId=None,
            riskLevel="GREEN",
            riskScore=0
        )

@api_router.post("/ai-buddies/reset")
async def reset_buddy_session(request: BuddyChatRequest):
    """Reset an AI Battle Buddy session"""
    if request.sessionId in buddy_sessions:
        del buddy_sessions[request.sessionId]
    return {"message": "Session reset", "sessionId": request.sessionId}

# Keep old Smudge endpoint for backwards compatibility (redirects to Tommy)
@api_router.post("/smudge/chat")
async def smudge_chat_legacy(message: str = "", sessionId: str = "", character: str = "tommy"):
    """Legacy Smudge endpoint - redirects to Tommy"""
    request = BuddyChatRequest(message=message, sessionId=sessionId, character="tommy")
    return await buddy_chat(request)

# ============ ADMIN STATUS MANAGEMENT ============

@api_router.patch("/admin/counsellors/{counsellor_id}/status")
async def admin_update_counsellor_status(
    counsellor_id: str,
    status_update: CounsellorStatusUpdate,
    current_user: User = Depends(require_role("admin"))
):
    """Admin can update any counsellor's status"""
    counsellor = await db.counsellors.find_one({"id": counsellor_id})
    if not counsellor:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    
    await db.counsellors.update_one(
        {"id": counsellor_id},
        {"$set": status_update.dict(exclude_unset=True)}
    )
    
    updated = await db.counsellors.find_one({"id": counsellor_id}, {"_id": 0})
    return updated

@api_router.patch("/admin/peer-supporters/{peer_id}/status")
async def admin_update_peer_status(
    peer_id: str,
    status_update: PeerSupporterStatusUpdate,
    current_user: User = Depends(require_role("admin"))
):
    """Admin can update any peer supporter's status"""
    peer = await db.peer_supporters.find_one({"id": peer_id})
    if not peer:
        raise HTTPException(status_code=404, detail="Peer supporter not found")
    
    await db.peer_supporters.update_one(
        {"id": peer_id},
        {"$set": status_update.dict(exclude_unset=True)}
    )
    
    updated = await db.peer_supporters.find_one({"id": peer_id}, {"_id": 0})
    return updated


# ============ SIP EXTENSION MANAGEMENT ============

class SIPExtensionAssign(BaseModel):
    sip_extension: str
    sip_password: str

@api_router.get("/admin/sip-extensions")
async def get_all_sip_assignments(current_user: User = Depends(require_role("admin"))):
    """Get all SIP extension assignments for counsellors and peers"""
    counsellors = await db.counsellors.find(
        {"sip_extension": {"$exists": True, "$ne": None}},
        {"_id": 0, "id": 1, "name": 1, "sip_extension": 1, "user_id": 1}
    ).to_list(100)
    
    peers = await db.peer_supporters.find(
        {"sip_extension": {"$exists": True, "$ne": None}},
        {"_id": 0, "id": 1, "firstName": 1, "sip_extension": 1, "user_id": 1}
    ).to_list(100)
    
    # Decrypt names
    for c in counsellors:
        c['name'] = decrypt_field(c.get('name', ''))
        c['type'] = 'counsellor'
    
    for p in peers:
        p['firstName'] = decrypt_field(p.get('firstName', ''))
        p['name'] = p['firstName']  # Normalize field name
        p['type'] = 'peer'
    
    return {
        "assignments": counsellors + peers,
        "total": len(counsellors) + len(peers)
    }

@api_router.patch("/admin/counsellors/{counsellor_id}/sip")
async def assign_sip_to_counsellor(
    counsellor_id: str,
    sip_data: SIPExtensionAssign,
    current_user: User = Depends(require_role("admin"))
):
    """Assign or update SIP extension for a counsellor"""
    counsellor = await db.counsellors.find_one({"id": counsellor_id})
    if not counsellor:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    
    # Encrypt the password before storing
    encrypted_password = encrypt_field(sip_data.sip_password)
    
    await db.counsellors.update_one(
        {"id": counsellor_id},
        {"$set": {
            "sip_extension": sip_data.sip_extension,
            "sip_password": encrypted_password
        }}
    )
    
    logging.info(f"SIP extension {sip_data.sip_extension} assigned to counsellor {counsellor_id}")
    
    return {
        "message": "SIP extension assigned successfully",
        "counsellor_id": counsellor_id,
        "sip_extension": sip_data.sip_extension
    }

@api_router.patch("/admin/peer-supporters/{peer_id}/sip")
async def assign_sip_to_peer(
    peer_id: str,
    sip_data: SIPExtensionAssign,
    current_user: User = Depends(require_role("admin"))
):
    """Assign or update SIP extension for a peer supporter"""
    peer = await db.peer_supporters.find_one({"id": peer_id})
    if not peer:
        raise HTTPException(status_code=404, detail="Peer supporter not found")
    
    # Encrypt the password before storing
    encrypted_password = encrypt_field(sip_data.sip_password)
    
    await db.peer_supporters.update_one(
        {"id": peer_id},
        {"$set": {
            "sip_extension": sip_data.sip_extension,
            "sip_password": encrypted_password
        }}
    )
    
    logging.info(f"SIP extension {sip_data.sip_extension} assigned to peer supporter {peer_id}")
    
    return {
        "message": "SIP extension assigned successfully",
        "peer_id": peer_id,
        "sip_extension": sip_data.sip_extension
    }

@api_router.delete("/admin/counsellors/{counsellor_id}/sip")
async def remove_sip_from_counsellor(
    counsellor_id: str,
    current_user: User = Depends(require_role("admin"))
):
    """Remove SIP extension from a counsellor"""
    await db.counsellors.update_one(
        {"id": counsellor_id},
        {"$unset": {"sip_extension": "", "sip_password": ""}}
    )
    return {"message": "SIP extension removed successfully"}

@api_router.delete("/admin/peer-supporters/{peer_id}/sip")
async def remove_sip_from_peer(
    peer_id: str,
    current_user: User = Depends(require_role("admin"))
):
    """Remove SIP extension from a peer supporter"""
    await db.peer_supporters.update_one(
        {"id": peer_id},
        {"$unset": {"sip_extension": "", "sip_password": ""}}
    )
    return {"message": "SIP extension removed successfully"}

@api_router.get("/staff/my-sip-credentials")
async def get_my_sip_credentials(current_user: User = Depends(get_current_user)):
    """Get the current user's SIP credentials for phone registration"""
    if current_user.role == "counsellor":
        staff = await db.counsellors.find_one(
            {"user_id": current_user.id},
            {"_id": 0, "sip_extension": 1, "sip_password": 1, "name": 1}
        )
    elif current_user.role == "peer":
        staff = await db.peer_supporters.find_one(
            {"user_id": current_user.id},
            {"_id": 0, "sip_extension": 1, "sip_password": 1, "firstName": 1}
        )
    else:
        raise HTTPException(status_code=403, detail="Only staff can access SIP credentials")
    
    if not staff or not staff.get("sip_extension"):
        return {"has_sip": False, "message": "No SIP extension assigned"}
    
    # Decrypt the password
    decrypted_password = decrypt_field(staff.get("sip_password", ""))
    display_name = decrypt_field(staff.get("name") or staff.get("firstName", ""))
    
    return {
        "has_sip": True,
        "sip_extension": staff["sip_extension"],
        "sip_password": decrypted_password,
        "display_name": display_name,
        "sip_domain": "radiocheck.voip.synthesis-it.co.uk"
    }


# ============ PEER SUPPORT REGISTRATION (from app) ============

async def send_peer_registration_notification(email: str, registration_time: datetime):
    """Send notification to admin when someone registers for peer support"""
    try:
        # Get notification email from settings
        settings = await db.settings.find_one({"_id": "site_settings"})
        notification_email = settings.get("peer_registration_notification_email") if settings else None
        
        # If no notification email configured, try to notify admins
        if not notification_email:
            admin_users = await db.users.find({"role": "admin"}).to_list(10)
            if admin_users:
                notification_email = admin_users[0].get("email")
        
        if not notification_email:
            logging.warning("No notification email configured for peer registration")
            return False
        
        if not RESEND_API_KEY:
            logging.warning("Resend API key not configured, skipping peer registration notification")
            return False
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a2332;">New Peer Support Registration</h2>
            <p>Someone has expressed interest in becoming a peer supporter.</p>
            <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Email:</strong> {email}</p>
                <p><strong>Registration Time:</strong> {registration_time.strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
            </div>
            <p>You can view all registrations in the admin portal under "Peer Support Registrations".</p>
            <br>
            <p style="color: #1a2332;">Veterans Support System</p>
        </body>
        </html>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [notification_email],
            "subject": "New Peer Support Registration - Veterans Support",
            "html": html_content
        }
        
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Peer registration notification sent to {notification_email}, ID: {result.get('id')}")
        return True
    except Exception as e:
        logging.error(f"Failed to send peer registration notification: {str(e)}")
        return False

@api_router.post("/peer-support/register", response_model=PeerSupportRegistration)
async def register_peer_support(input: PeerSupportRegistrationCreate):
    """Register interest for peer support programme (public)"""
    try:
        existing = await db.peer_support_registrations.find_one({"email": input.email})
        if existing:
            raise HTTPException(status_code=400, detail="This email is already registered.")
        
        registration_dict = input.dict()
        registration_obj = PeerSupportRegistration(**registration_dict)
        await db.peer_support_registrations.insert_one(registration_obj.dict())
        
        # Send notification to admin
        await send_peer_registration_notification(input.email, registration_obj.timestamp)
        
        logging.info(f"Peer support registration: {input.email}")
        return registration_obj
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error registering peer support: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to register. Please try again.")

@api_router.get("/peer-support/registrations", response_model=List[PeerSupportRegistration])
async def get_peer_support_registrations(current_user: User = Depends(require_role("admin"))):
    """Get all peer support registrations (admin only)"""
    try:
        registrations = await db.peer_support_registrations.find().sort("timestamp", -1).to_list(1000)
        return [PeerSupportRegistration(**reg) for reg in registrations]
    except Exception as e:
        logging.error(f"Error retrieving registrations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve registrations.")

# ============ FAMILY & FRIENDS CONCERN ENDPOINTS ============

@api_router.post("/concerns", response_model=Concern)
async def raise_concern(input: ConcernCreate):
    """Raise a concern about a veteran (public - for family/friends)"""
    try:
        concern = Concern(**input.dict())
        await db.concerns.insert_one(concern.dict())
        logging.info(f"Concern raised by {input.your_name} ({input.relationship}) - Urgency: {input.urgency}")
        
        # Send notification email to admins
        try:
            await send_concern_notification(concern)
        except Exception as email_err:
            logging.error(f"Failed to send concern notification email: {email_err}")
        
        return concern
    except Exception as e:
        logging.error(f"Error raising concern: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit concern. Please try again.")

@api_router.get("/concerns")
async def get_concerns(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all concerns (staff only)"""
    if current_user.role not in ["admin", "supervisor", "counsellor"]:
        raise HTTPException(status_code=403, detail="Only admins and counsellors can view concerns")
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        concerns = await db.concerns.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        return concerns
    except Exception as e:
        logging.error(f"Error retrieving concerns: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve concerns.")

@api_router.patch("/concerns/{concern_id}/status")
async def update_concern_status(
    concern_id: str,
    status: str,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Update concern status (staff only)"""
    if current_user.role not in ["admin", "supervisor", "counsellor"]:
        raise HTTPException(status_code=403, detail="Only admins and counsellors can update concerns")
    
    try:
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        if notes:
            update_data["notes"] = notes
        if status == "in_progress":
            update_data["assigned_to"] = current_user.name
        
        await db.concerns.update_one(
            {"id": concern_id},
            {"$set": update_data}
        )
        return {"message": f"Concern status updated to {status}"}
    except Exception as e:
        logging.error(f"Error updating concern: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update concern.")

async def send_concern_notification(concern: Concern):
    """Send notification to admin when a concern is raised"""
    if not RESEND_API_KEY:
        logging.warning("Resend API key not configured, skipping concern notification")
        return False
    
    try:
        settings = await db.settings.find_one({})
        admin_email = settings.get("admin_notification_email", "") if settings else ""
        
        if not admin_email:
            return False
        
        urgency_colors = {"urgent": "#dc2626", "high": "#f59e0b", "medium": "#3b82f6", "low": "#22c55e"}
        urgency_color = urgency_colors.get(concern.urgency, "#3b82f6")
        
        signs_html = ""
        if concern.signs_noticed:
            signs_html = "<p><strong>Signs noticed:</strong> " + ", ".join(concern.signs_noticed) + "</p>"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: {urgency_color}; color: white; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="margin: 0;">Family/Friend Concern Raised</h2>
                <p style="margin: 8px 0 0 0;">Urgency: {concern.urgency.upper()}</p>
            </div>
            
            <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p><strong>From:</strong> {concern.your_name} ({concern.relationship})</p>
                <p><strong>Contact:</strong> {concern.your_email or 'N/A'} / {concern.your_phone or 'N/A'}</p>
                <p><strong>About:</strong> {concern.veteran_name or 'Not specified'}</p>
                <p><strong>How long:</strong> {concern.how_long or 'Not specified'}</p>
                {signs_html}
            </div>
            
            <div style="background-color: #fff3cd; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Concerns:</strong></p>
                <p>{concern.concerns}</p>
            </div>
            
            <p><strong>Consent to contact veteran:</strong> {'Yes' if concern.consent_to_contact else 'No'}</p>
            
            <p style="text-align: center; margin: 30px 0;">
                <a href="{STAFF_PORTAL_URL}" style="background-color: {urgency_color}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">View in Staff Portal</a>
            </p>
        </body>
        </html>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [admin_email],
            "subject": f"[{concern.urgency.upper()}] Family/Friend Concern - Radio Check",
            "html": html_content
        }
        
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.info(f"Concern notification sent, ID: {result.get('id')}")
        return True
    except Exception as e:
        logging.error(f"Failed to send concern notification: {str(e)}")
        return False

# ============ CALL INTENT LOGGING ENDPOINTS ============

@api_router.post("/call-logs", response_model=CallIntent)
async def log_call_intent(call_input: CallIntentCreate):
    """Log a call intent (public - for app users)"""
    try:
        call_obj = CallIntent(**call_input.dict())
        await db.call_logs.insert_one(call_obj.dict())
        logging.info(f"Call intent logged: {call_input.contact_type} - {call_input.contact_name}")
        return call_obj
    except Exception as e:
        logging.error(f"Error logging call intent: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to log call")

@api_router.get("/call-logs")
async def get_call_logs(
    current_user: User = Depends(require_role("admin")),
    days: int = 30,
    contact_type: Optional[str] = None
):
    """Get call logs with metrics (admin only)"""
    try:
        from_date = datetime.utcnow() - timedelta(days=days)
        
        query = {"timestamp": {"$gte": from_date}}
        if contact_type:
            query["contact_type"] = contact_type
        
        logs = await db.call_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(1000)
        
        # Calculate metrics
        total_calls = len(logs)
        calls_by_type = {}
        calls_by_method = {}
        calls_by_day = {}
        
        for log in logs:
            # By type
            ct = log.get("contact_type", "unknown")
            calls_by_type[ct] = calls_by_type.get(ct, 0) + 1
            
            # By method
            cm = log.get("call_method", "phone")
            calls_by_method[cm] = calls_by_method.get(cm, 0) + 1
            
            # By day
            day = log.get("timestamp", datetime.utcnow()).strftime("%Y-%m-%d")
            calls_by_day[day] = calls_by_day.get(day, 0) + 1
        
        return {
            "total_calls": total_calls,
            "period_days": days,
            "calls_by_type": calls_by_type,
            "calls_by_method": calls_by_method,
            "calls_by_day": dict(sorted(calls_by_day.items())),
            "recent_logs": logs[:50]  # Last 50 logs
        }
    except Exception as e:
        logging.error(f"Error retrieving call logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve call logs")

# ============ SETUP/SEED ENDPOINTS ============

@api_router.api_route("/setup/init", methods=["GET", "POST"])
async def initialize_system():
    """Initialize system with default admin user (GET or POST)"""
    # Check if admin already exists
    existing_admin = await db.users.find_one({"role": "admin"})
    if existing_admin:
        raise HTTPException(status_code=400, detail="System already initialized")
    
    # Create default admin
    admin_user = User(
        email="admin@veteran.dbty.co.uk",
        role="admin",
        name="System Administrator"
    )
    admin_data = admin_user.dict()
    admin_data["password_hash"] = hash_password("ChangeThisPassword123!")
    await db.users.insert_one(admin_data)
    
    return {
        "message": "System initialized successfully",
        "admin_email": "admin@veteran.dbty.co.uk",
        "default_password": "ChangeThisPassword123!",
        "warning": "Please change the default password immediately!"
    }

# ============ ROOT ENDPOINT ============

@api_router.get("/")
async def root():
    return {"message": "UK Veterans Support API - Admin System Active"}


# ============ SYSTEM MONITORING ENDPOINTS ============

@api_router.get("/admin/system-stats")
async def get_system_stats(current_user: User = Depends(require_role("admin"))):
    """Get real-time system statistics for monitoring dashboard"""
    import psutil
    from datetime import datetime, timedelta
    
    # Get database stats
    try:
        # Count active users (logged in within last 24 hours)
        yesterday = datetime.utcnow() - timedelta(hours=24)
        
        # User counts
        total_users = await db.users.count_documents({})
        staff_count = await db.users.count_documents({"role": {"$in": ["counsellor", "peer", "admin"]}})
        
        # Active sessions (approximation based on recent activity)
        active_ai_sessions = await db.ai_sessions.count_documents({
            "created_at": {"$gte": yesterday.isoformat()}
        })
        
        # Count active live chats
        active_live_chats = len([r for r in live_chat_rooms.values() if r.get("status") == "active"])
        
        # Count pending callbacks
        pending_callbacks = await db.callbacks.count_documents({"status": "pending"})
        
        # Count today's shifts
        today = datetime.utcnow().strftime("%Y-%m-%d")
        today_shifts = await db.shifts.count_documents({"date": today})
        
        # Safeguarding alerts (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_alerts = await db.safeguarding_alerts.count_documents({
            "created_at": {"$gte": week_ago.isoformat()}
        })
        
        # Active calls - count from live chat rooms with active calls
        active_calls = len([r for r in live_chat_rooms.values() if r.get("has_active_call")])
        
        # Connected staff - count staff who logged in within last 15 minutes
        # This requires tracking last_active timestamp on login
        fifteen_mins_ago = datetime.utcnow() - timedelta(minutes=15)
        connected_staff = await db.users.count_documents({
            "role": {"$in": ["counsellor", "peer", "admin"]},
            "last_active": {"$gte": fifteen_mins_ago.isoformat()}
        })
        
    except Exception as e:
        print(f"Error getting DB stats: {e}")
        total_users = 0
        staff_count = 0
        active_ai_sessions = 0
        active_live_chats = 0
        pending_callbacks = 0
        today_shifts = 0
        recent_alerts = 0
        active_calls = 0
        connected_staff = 0
    
    # Get server resource usage
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_used_mb = memory.used / (1024 * 1024)
        memory_total_mb = memory.total / (1024 * 1024)
    except:
        cpu_percent = 0
        memory_percent = 0
        memory_used_mb = 0
        memory_total_mb = 0
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "users": {
            "total_registered": total_users,
            "staff_count": staff_count,
            "connected_staff": connected_staff
        },
        "activity": {
            "active_ai_sessions_24h": active_ai_sessions,
            "active_live_chats": active_live_chats,
            "active_calls": active_calls,
            "pending_callbacks": pending_callbacks,
            "today_shifts": today_shifts,
            "safeguarding_alerts_7d": recent_alerts
        },
        "server": {
            "cpu_percent": round(cpu_percent, 1),
            "memory_percent": round(memory_percent, 1),
            "memory_used_mb": round(memory_used_mb, 1),
            "memory_total_mb": round(memory_total_mb, 1)
        },
        "capacity": {
            "estimated_max_concurrent_users": 75,
            "estimated_max_calls": 25,
            "current_load_percent": round((active_calls / 25) * 100 if active_calls else 0, 1)
        }
    }


@api_router.get("/admin/usage-history")
async def get_usage_history(
    days: int = 7,
    current_user: User = Depends(require_role("admin"))
):
    """Get usage history for charts"""
    from datetime import datetime, timedelta
    
    history = []
    for i in range(days, 0, -1):
        date = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        
        # Count AI sessions for that day
        day_start = f"{date}T00:00:00"
        day_end = f"{date}T23:59:59"
        
        ai_sessions = await db.ai_sessions.count_documents({
            "created_at": {"$gte": day_start, "$lte": day_end}
        })
        
        # Count callbacks
        callbacks = await db.callbacks.count_documents({
            "created_at": {"$gte": day_start, "$lte": day_end}
        })
        
        history.append({
            "date": date,
            "ai_sessions": ai_sessions,
            "callbacks": callbacks
        })
    
    return {"history": history}


# ============ LIVE CHAT ENDPOINTS ============
# In-memory storage for live chat rooms (in production, use Redis or database)
live_chat_rooms: Dict[str, Dict[str, Any]] = {}

class LiveChatRoomCreate(BaseModel):
    staff_id: Optional[str] = None  # Optional - staff joins later
    staff_name: Optional[str] = None  # Optional - staff joins later
    staff_type: str = "any"  # counsellor, peer, or any (default)
    safeguarding_alert_id: Optional[str] = None
    ai_session_id: Optional[str] = None

class LiveChatMessage(BaseModel):
    text: str
    sender: str  # 'user' or 'staff'

@api_router.get("/live-chat/rooms")
async def list_live_chat_rooms(current_user: User = Depends(get_current_user)):
    """Get all active live chat rooms for staff to see and join.
    Returns rooms from both memory and database.
    """
    if current_user.role not in ["admin", "supervisor", "counsellor", "peer"]:
        raise HTTPException(status_code=403, detail="Only staff can view chat rooms")
    
    # Get rooms from memory (most recent)
    memory_rooms = list(live_chat_rooms.values())
    
    # Also get from database (for persistence across restarts)
    db_rooms = await db.live_chat_rooms.find(
        {"status": {"$ne": "ended"}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Merge, preferring memory versions (have up-to-date messages)
    room_map = {}
    for room in db_rooms:
        room_map[room["id"]] = room
    for room in memory_rooms:
        room_map[room["id"]] = room
    
    # Return sorted by created_at (newest first)
    rooms = list(room_map.values())
    rooms.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    
    return rooms


@api_router.post("/live-chat/rooms")
async def create_live_chat_room(room_data: LiveChatRoomCreate):
    """Create a new live chat room for user-staff communication.
    Staff is NOT pre-assigned - all available staff will see the request and can join.
    """
    room_id = str(uuid.uuid4())
    
    room = {
        "id": room_id,
        "staff_id": room_data.staff_id,  # Optional - staff joins later
        "staff_name": room_data.staff_name,  # Optional - staff joins later
        "staff_type": room_data.staff_type,  # Preferred type (counsellor, peer, or any)
        "safeguarding_alert_id": room_data.safeguarding_alert_id,
        "ai_session_id": room_data.ai_session_id,
        "messages": [],
        "status": "active",  # active, ended
        "created_at": datetime.utcnow().isoformat(),
        "ended_at": None,
    }
    
    live_chat_rooms[room_id] = room
    
    # Store in database for persistence
    await db.live_chat_rooms.insert_one({
        **room,
        "created_at": datetime.utcnow(),
    })
    
    logging.info(f"Live chat room created: {room_id} (waiting for staff to join)")
    
    return {"room_id": room_id, "status": "active"}


class StaffJoinChat(BaseModel):
    staff_id: str
    staff_name: str


@api_router.post("/live-chat/rooms/{room_id}/join")
async def staff_join_live_chat(room_id: str, join_data: StaffJoinChat, current_user: User = Depends(get_current_user)):
    """Staff member joins a live chat room"""
    logging.info(f"staff_join_live_chat: room_id={room_id}, staff_id={join_data.staff_id}, user_role={current_user.role}")
    
    # Normalize role check - handle variations
    user_role = (current_user.role or "").lower()
    allowed_roles = ["admin", "supervisor", "counsellor", "peer", "peer_supporter"]
    
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Only staff can join chat rooms (your role: {current_user.role})")
    
    # Check in-memory first
    if room_id in live_chat_rooms:
        room = live_chat_rooms[room_id]
        logging.info(f"staff_join_live_chat: Found room in memory, current staff_id={room.get('staff_id')}")
        # Allow if: no staff assigned, OR same staff re-joining, OR staff is the one who accepted
        if room.get("staff_id") and room["staff_id"] != join_data.staff_id:
            raise HTTPException(status_code=400, detail="Chat room already has a different staff member assigned")
        
        room["staff_id"] = join_data.staff_id
        room["staff_name"] = join_data.staff_name
        room["status"] = "active"  # Ensure status is active when staff joins
    
    # Update in database - use simpler query, in-memory check already validates staff
    result = await db.live_chat_rooms.update_one(
        {"id": room_id},
        {"$set": {"staff_id": join_data.staff_id, "staff_name": join_data.staff_name, "status": "active"}}
    )
    
    logging.info(f"staff_join_live_chat: DB update result - matched_count={result.matched_count}")
    
    if result.matched_count == 0:
        # Room not in DB yet - try to find it in memory and create if needed
        logging.warning(f"staff_join_live_chat: Room {room_id} not found in DB, checking memory")
        if room_id in live_chat_rooms:
            # Room exists in memory but not DB - insert it
            logging.info(f"staff_join_live_chat: Found in memory, inserting to DB")
            room_doc = live_chat_rooms[room_id].copy()
            room_doc["staff_id"] = join_data.staff_id
            room_doc["staff_name"] = join_data.staff_name
            room_doc["status"] = "active"
            await db.live_chat_rooms.insert_one(room_doc)
        else:
            raise HTTPException(status_code=404, detail="Chat room not found")
    
    logging.info(f"Staff {join_data.staff_name} joined chat room: {room_id}")
    
    return {"status": "joined", "staff_name": join_data.staff_name}


@api_router.get("/live-chat/rooms/{room_id}")
async def get_live_chat_room(room_id: str):
    """Get a specific chat room details (for user polling to see when staff joins)"""
    # Check in-memory first
    if room_id in live_chat_rooms:
        room = live_chat_rooms[room_id].copy()
        return room
    
    # Fall back to database
    room = await db.live_chat_rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
    
    return room

@api_router.get("/live-chat/rooms/{room_id}/messages")
async def get_live_chat_messages(room_id: str):
    """Get messages for a live chat room (decrypted)"""
    # First check in-memory (already unencrypted)
    if room_id in live_chat_rooms:
        return {"messages": live_chat_rooms[room_id]["messages"]}
    
    # Fall back to database (encrypted) - need to decrypt
    room = await db.live_chat_rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
    
    # Decrypt messages from database
    messages = room.get("messages", [])
    decrypted_messages = []
    for msg in messages:
        decrypted_msg = msg.copy()
        if msg.get("text"):
            decrypted_msg["text"] = decrypt_field(msg["text"])
        decrypted_messages.append(decrypted_msg)
    
    return {"messages": decrypted_messages}

@api_router.post("/live-chat/rooms/{room_id}/messages")
async def send_live_chat_message(room_id: str, message: LiveChatMessage):
    """Send a message in a live chat room (encrypted)"""
    msg = {
        "id": str(uuid.uuid4()),
        "text": encrypt_field(message.text),  # Encrypt message content
        "sender": message.sender,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    # Update in-memory (keep unencrypted for real-time display)
    if room_id in live_chat_rooms:
        live_chat_rooms[room_id]["messages"].append({
            "id": msg["id"],
            "text": message.text,  # Unencrypted in memory
            "sender": message.sender,
            "timestamp": msg["timestamp"],
        })
    
    # Update in database (encrypted)
    await db.live_chat_rooms.update_one(
        {"id": room_id},
        {"$push": {"messages": msg}}
    )
    
    return {"message_id": msg["id"], "status": "sent"}

@api_router.post("/live-chat/rooms/{room_id}/end")
async def end_live_chat_room(room_id: str):
    """End a live chat session"""
    # Update in-memory
    if room_id in live_chat_rooms:
        live_chat_rooms[room_id]["status"] = "ended"
        live_chat_rooms[room_id]["ended_at"] = datetime.utcnow().isoformat()
    
    # Update in database
    await db.live_chat_rooms.update_one(
        {"id": room_id},
        {"$set": {"status": "ended", "ended_at": datetime.utcnow()}}
    )
    
    logging.info(f"Live chat room ended: {room_id}")
    return {"status": "ended"}

@api_router.get("/live-chat/rooms")
async def get_active_chat_rooms(current_user: User = Depends(get_current_user)):
    """Get all active chat rooms for staff (staff only)"""
    # Normalize role check
    user_role = (current_user.role or "").lower()
    allowed_roles = ["admin", "supervisor", "counsellor", "peer", "peer_supporter"]
    
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only staff can view chat rooms")
    
    rooms = await db.live_chat_rooms.find(
        {"status": {"$in": ["active", "waiting"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Decrypt messages in each room
    decrypted_rooms = []
    for room in rooms:
        room_copy = room.copy()
        if room_copy.get("messages"):
            decrypted_messages = []
            for msg in room_copy["messages"]:
                msg_copy = msg.copy()
                # Decrypt message text if encrypted
                if msg_copy.get("text") and str(msg_copy["text"]).startswith("ENC:"):
                    try:
                        msg_copy["text"] = decrypt_field(msg_copy["text"])
                    except Exception as e:
                        logging.warning(f"Failed to decrypt message: {e}")
                        msg_copy["text"] = "[Unable to decrypt message]"
                decrypted_messages.append(msg_copy)
            room_copy["messages"] = decrypted_messages
        decrypted_rooms.append(room_copy)
    
    return decrypted_rooms

# Note: include_router moved to end of file after all routes are defined

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8081",
        "https://radiocheck.me",
        "https://www.radiocheck.me",
        "https://app.radiocheck.me",
        "https://staff.radiocheck.me",
        "https://admin.radiocheck.me",
        "https://app.veteran.dbty.co.uk",
        "https://veteran.dbty.co.uk",
        "https://www.veteran.dbty.co.uk",
        "https://veterans-support-api.onrender.com",
        "https://buddy-chat-qa.preview.emergentagent.com",
    ],
    allow_origin_regex=r"https://.*\.emergentagent\.com|https://.*\.vercel\.app|https://.*\.onrender\.com|https://.*\.radiocheck\.me",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ============ IMAGE UPLOAD ENDPOINTS ============
import base64
import os

UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class ImageUpload(BaseModel):
    filename: str
    data: str  # Base64 encoded image

@api_router.post("/upload/image")
async def upload_image(
    image: ImageUpload,
    current_user: User = Depends(require_role("admin"))
):
    """Upload an image (admin only)"""
    try:
        # Decode base64 data
        image_data = base64.b64decode(image.data.split(",")[-1] if "," in image.data else image.data)
        
        # Generate unique filename
        import uuid
        ext = os.path.splitext(image.filename)[1] or ".png"
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(filepath, "wb") as f:
            f.write(image_data)
        
        # Return URL (in production, this would be a CDN URL)
        return {"url": f"/api/uploads/{unique_filename}", "filename": unique_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@api_router.get("/uploads/{filename}")
async def get_uploaded_image(filename: str):
    """Serve uploaded image"""
    from fastapi.responses import FileResponse
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)

# ============ WebRTC Signaling Integration ============
# Import Socket.IO signaling server
from webrtc_signaling import sio, get_online_staff_list, get_active_calls_list, get_active_chat_rooms
import socketio

# WebRTC REST API Endpoints (must be defined BEFORE socket_app wrapping)
@api_router.get("/webrtc/online-staff")
async def api_get_online_staff():
    """Get list of staff currently online for calls"""
    return {"staff": get_online_staff_list()}

@api_router.get("/webrtc/active-calls")
async def api_get_active_calls(current_user: User = Depends(require_role("admin"))):
    """Get list of active calls (admin only)"""
    return {"calls": get_active_calls_list()}

@api_router.get("/webrtc/debug")
async def api_debug_webrtc():
    """Debug endpoint to check Socket.IO connected users (no auth for debugging)"""
    from webrtc_signaling import connected_users, user_to_socket, active_calls
    
    users_list = []
    for socket_id, user in connected_users.items():
        users_list.append({
            "socket_id": socket_id[:8] + "...",  # Truncate for privacy
            "user_id": user.get('user_id'),
            "user_type": user.get('user_type'),
            "name": user.get('name'),
            "status": user.get('status')
        })
    
    return {
        "connected_users_count": len(connected_users),
        "connected_users": users_list,
        "user_to_socket_count": len(user_to_socket),
        "active_calls_count": len(active_calls),
        "note": "Staff must be connected and 'available' to receive call/chat requests"
    }


@api_router.get("/safety/debug")
async def api_debug_safety():
    """Debug endpoint to check safety system status (no auth for debugging)"""
    status = get_safety_system_status()
    return {
        "safety_system_status": status,
        "description": "Unified safety system combining keyword, semantic, and conversation trajectory analysis"
    }

@api_router.get("/safety/audit")
async def api_safety_audit(
    hours_back: int = 24,
    min_risk_level: str = "MEDIUM"
):
    """Get safety audit report for review (no auth for debugging - add auth in production)"""
    report = get_safety_audit_report(hours_back=hours_back, min_risk_level=min_risk_level)
    return {
        "audit_entries_count": len(report),
        "audit_entries": report[-50:],  # Return last 50 entries
        "hours_back": hours_back,
        "min_risk_level": min_risk_level
    }


class SessionSummaryRequest(BaseModel):
    session_id: str
    character_id: str
    character_name: str
    messages: List[Dict[str, Any]]  # List of {role, text, timestamp}


@api_router.post("/safety/generate-summary")
async def api_generate_session_summary(request: SessionSummaryRequest):
    """
    Generate an AI summary of a conversation session.
    Used for storing conversation context on user's device.
    """
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if not openai_key:
        return {
            "success": False,
            "error": "AI summarization not available",
            "summary": None
        }
    
    try:
        from openai import AsyncOpenAI
        
        # Format messages for the summary prompt
        message_text = "\n".join([
            f"[{m.get('role', 'user')}] {m.get('text', '')[:200]}"
            for m in request.messages[-30:]  # Last 30 messages
        ])
        
        summary_prompt = f"""Analyze this conversation between a user and the AI character "{request.character_name}" on RadioCheck (a mental health peer support app for veterans).

Generate a brief summary that includes:
1. A 1-2 sentence summary of the conversation
2. Key topics discussed
3. The user's emotional state
4. Any concerning risk indicators (be specific if present)

CONVERSATION:
{message_text}

Respond with JSON only:
{{
  "summary": "Brief 1-2 sentence summary",
  "key_topics": ["topic1", "topic2"],
  "emotional_state": "calm/distressed/hopeful/anxious/etc",
  "risk_flags": ["flag1", "flag2"] or []
}}"""

        client = AsyncOpenAI(api_key=openai_key)
        completion = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a clinical summarizer for a mental health support app. Generate concise, clinically-relevant summaries."},
                {"role": "user", "content": summary_prompt}
            ],
            max_tokens=300,
            temperature=0.1,
        )
        response = completion.choices[0].message.content or ""
        
        # Parse JSON response
        import json
        clean_response = response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        clean_response = clean_response.strip()
        
        result = json.loads(clean_response)
        
        return {
            "success": True,
            "session_id": request.session_id,
            "character_id": request.character_id,
            "character_name": request.character_name,
            "summary": result.get("summary", "Conversation completed."),
            "key_topics": result.get("key_topics", []),
            "emotional_state": result.get("emotional_state"),
            "risk_flags": result.get("risk_flags", []),
            "message_count": len(request.messages)
        }
        
    except Exception as e:
        logging.error(f"Error generating session summary: {e}")
        return {
            "success": False,
            "error": str(e),
            "summary": None
        }




# ============ Human-to-Human Chat API ============

class ChatMessage(BaseModel):
    room_id: str
    message: str
    sender_id: str
    sender_name: str
    sender_type: str = "user"  # user, counsellor, peer


@api_router.post("/chat/messages")
async def save_chat_message(msg: ChatMessage):
    """Save a chat message to the database for persistence"""
    message_doc = {
        "room_id": msg.room_id,
        "message": msg.message,
        "sender_id": msg.sender_id,
        "sender_name": msg.sender_name,
        "sender_type": msg.sender_type,
        "created_at": datetime.utcnow(),
        "message_id": str(uuid.uuid4())
    }
    
    await db.chat_messages.insert_one(message_doc)
    
    return {"success": True, "message_id": message_doc["message_id"]}


@api_router.get("/chat/messages/{room_id}")
async def get_chat_messages(room_id: str, limit: int = 50):
    """Get chat messages for a room (last 50 by default)"""
    # Only return messages from last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    messages = await db.chat_messages.find(
        {
            "room_id": room_id,
            "created_at": {"$gte": seven_days_ago}
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Return in chronological order
    messages.reverse()
    
    return {"messages": messages}


@api_router.get("/chat/rooms")
async def get_user_chat_rooms(current_user: User = Depends(get_current_user)):
    """Get list of chat rooms the user has participated in"""
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Find rooms where this user has sent messages
    pipeline = [
        {
            "$match": {
                "sender_id": current_user.id,
                "created_at": {"$gte": seven_days_ago}
            }
        },
        {
            "$group": {
                "_id": "$room_id",
                "last_message": {"$last": "$message"},
                "last_message_at": {"$max": "$created_at"},
                "message_count": {"$sum": 1}
            }
        },
        {"$sort": {"last_message_at": -1}},
        {"$limit": 20}
    ]
    
    rooms = await db.chat_messages.aggregate(pipeline).to_list(20)
    
    return {"rooms": rooms}


@api_router.get("/chat/active-rooms")
async def api_get_active_chat_rooms(current_user: User = Depends(require_role("admin"))):
    """Get list of currently active chat rooms (admin only)"""
    return {"rooms": get_active_chat_rooms()}


@api_router.delete("/chat/cleanup")
async def cleanup_old_messages(current_user: User = Depends(require_role("admin"))):
    """Delete messages older than 7 days (admin maintenance task)"""
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    result = await db.chat_messages.delete_many({
        "created_at": {"$lt": seven_days_ago}
    })
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "cutoff_date": seven_days_ago.isoformat()
    }



# [MIGRATED TO ROUTERS - # ============ SHIFT/ROTA ENDPOINTS ============]



# [MIGRATED TO ROUTERS - # ============ BUDDY FINDER ENDPOINTS ============]

# ============ PROMPT IMPROVEMENT WORKFLOW ============

from prompt_improvement import (
    categorize_message,
    assess_response_quality,
    extract_improvement_insights,
    format_prompt_update_report,
    TOPIC_CATEGORIES
)

@api_router.get("/admin/chat-analytics")
async def get_chat_analytics(
    days: int = 7,
    current_user: User = Depends(require_role("admin"))
):
    """
    Get chat analytics for prompt improvement
    Analyzes recent chat sessions to provide insights
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Get recent chat sessions
    sessions = await db.chat_sessions.find({
        "created_at": {"$gte": cutoff}
    }).to_list(1000)
    
    if not sessions:
        return {
            "message": "No chat sessions found in the specified period",
            "period_days": days,
            "total_sessions": 0
        }
    
    # Extract insights
    insights = extract_improvement_insights(sessions)
    
    return {
        "period_days": days,
        "analysis_date": datetime.utcnow().isoformat(),
        **insights
    }

@api_router.get("/admin/chat-analytics/report")
async def get_chat_analytics_report(
    days: int = 7,
    current_user: User = Depends(require_role("admin"))
):
    """
    Get formatted report for prompt improvements
    Returns a human-readable report
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    sessions = await db.chat_sessions.find({
        "created_at": {"$gte": cutoff}
    }).to_list(1000)
    
    if not sessions:
        return {"report": "No chat sessions found for analysis."}
    
    insights = extract_improvement_insights(sessions)
    report = format_prompt_update_report(insights)
    
    return {
        "report": report,
        "generated_at": datetime.utcnow().isoformat()
    }

@api_router.get("/admin/prompt-suggestions")
async def get_prompt_suggestions(
    days: int = 30,
    current_user: User = Depends(require_role("admin"))
):
    """
    Get specific suggestions for improving AI prompts
    Based on analysis of recent conversations
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    sessions = await db.chat_sessions.find({
        "created_at": {"$gte": cutoff}
    }).to_list(2000)
    
    if not sessions:
        return {"suggestions": [], "message": "Not enough data for suggestions"}
    
    insights = extract_improvement_insights(sessions)
    
    return {
        "suggestions": insights.get("improvement_suggestions", []),
        "common_questions": insights.get("common_questions", []),
        "topic_distribution": dict(insights.get("topic_distribution", {})),
        "character_performance": insights.get("character_performance", {}),
        "based_on_sessions": len(sessions),
        "period_days": days
    }

@api_router.get("/admin/topic-breakdown")
async def get_topic_breakdown(
    days: int = 7,
    current_user: User = Depends(require_role("admin"))
):
    """
    Get breakdown of conversation topics
    Helps identify what users are talking about most
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    sessions = await db.chat_sessions.find({
        "created_at": {"$gte": cutoff}
    }).to_list(1000)
    
    topic_counts = {}
    for topic in TOPIC_CATEGORIES.keys():
        topic_counts[topic] = 0
    
    for session in sessions:
        messages = session.get("messages", [])
        for msg in messages:
            if msg.get("role") == "user":
                categories = categorize_message(msg.get("content", ""))
                for cat in categories:
                    if cat in topic_counts:
                        topic_counts[cat] += 1
    
    # Sort by count
    sorted_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "period_days": days,
        "total_sessions": len(sessions),
        "topics": [{"topic": t, "count": c} for t, c in sorted_topics],
        "topic_keywords": TOPIC_CATEGORIES
    }

@api_router.post("/admin/log-chat-feedback")
async def log_chat_feedback(
    session_id: str,
    rating: int,  # 1-5 stars
    feedback: str = "",
    current_user: User = Depends(require_role("admin"))
):
    """
    Log manual feedback on a chat session
    Used to tag sessions as good/bad examples for prompt improvement
    """
    await db.chat_feedback.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "rating": min(5, max(1, rating)),
        "feedback": feedback,
        "reviewed_by": current_user.id,
        "created_at": datetime.utcnow()
    })
    
    return {"success": True, "message": "Feedback logged"}

@api_router.get("/admin/prompt-versions")
async def get_prompt_versions(
    current_user: User = Depends(require_role("admin"))
):
    """
    Get history of prompt changes
    Tracks when prompts were updated and why
    """
    versions = await db.prompt_versions.find({}).sort("created_at", -1).to_list(50)
    
    return {
        "versions": [{
            "id": v.get("id"),
            "character": v.get("character"),
            "version": v.get("version"),
            "change_summary": v.get("change_summary"),
            "created_at": v.get("created_at").isoformat() if v.get("created_at") else None,
            "created_by": v.get("created_by")
        } for v in versions]
    }

@api_router.post("/admin/prompt-versions")
async def save_prompt_version(
    character: str,
    change_summary: str,
    prompt_text: str,
    current_user: User = Depends(require_role("admin"))
):
    """
    Save a new version of a character's prompt
    Creates an audit trail of prompt changes
    """
    # Get current version number
    latest = await db.prompt_versions.find_one(
        {"character": character},
        sort=[("version", -1)]
    )
    version = (latest.get("version", 0) + 1) if latest else 1
    
    await db.prompt_versions.insert_one({
        "id": str(uuid.uuid4()),
        "character": character,
        "version": version,
        "change_summary": change_summary,
        "prompt_text": prompt_text,
        "created_by": current_user.id,
        "created_at": datetime.utcnow()
    })
    
    return {
        "success": True,
        "version": version,
        "message": f"Prompt version {version} saved for {character}"
    }


# ============ AI USAGE TRACKING ENDPOINTS ============

@api_router.get("/admin/ai-usage/summary")
async def get_ai_usage_summary_endpoint(
    days: int = 30,
    current_user: User = Depends(require_role("admin"))
):
    """
    Get AI usage summary showing total tokens, costs, and budget status.
    
    Returns:
    - Total cost by provider (OpenAI, Gemini)
    - Budget limits and remaining
    - Request counts
    """
    summary = await get_usage_summary(db, days)
    return summary


@api_router.get("/admin/ai-usage/daily")
async def get_ai_daily_usage_endpoint(
    days: int = 7,
    current_user: User = Depends(require_role("admin"))
):
    """
    Get daily usage breakdown for charts.
    
    Returns daily tokens and costs for each provider.
    """
    daily_data = await get_daily_usage(db, days)
    return {"daily_usage": daily_data}


@api_router.get("/admin/ai-usage/by-character")
async def get_ai_usage_by_character_endpoint(
    days: int = 30,
    current_user: User = Depends(require_role("admin"))
):
    """
    Get AI usage breakdown by character.
    
    Shows which AI characters are using the most tokens.
    """
    character_data = await get_usage_by_character(db, days)
    return {"by_character": character_data}


@api_router.get("/admin/ai-usage/budgets")
async def get_ai_budgets_endpoint(
    current_user: User = Depends(require_role("admin"))
):
    """
    Get current budget limits and can be used to configure them.
    """
    from ai_usage_tracker import BUDGET_LIMITS, PRICING
    
    return {
        "budgets": BUDGET_LIMITS,
        "pricing": PRICING,
        "note": "Prices are in GBP per 1M tokens"
    }


@api_router.delete("/admin/cleanup-test-data")
async def cleanup_test_data(
    confirm: bool = False,
    current_user: User = Depends(require_role("admin"))
):
    """
    Clean up test data (counsellors, peer supporters) from the database.
    Pass confirm=true to actually delete.
    
    This looks for:
    - Names containing 'Test' or 'test'
    - Emails containing 'test@' or '@test.com'
    - Demo/fake entries
    """
    import re
    
    # Pattern to match test data
    test_pattern = re.compile(r'test|demo|fake|example|sample', re.IGNORECASE)
    
    # Find test counsellors
    all_counsellors = await db.counsellors.find({}).to_list(500)
    test_counsellors = [c for c in all_counsellors 
                       if test_pattern.search(c.get('name', '')) 
                       or test_pattern.search(c.get('email', ''))]
    
    # Find test peer supporters
    all_peers = await db.peer_supporters.find({}).to_list(500)
    test_peers = [p for p in all_peers 
                  if test_pattern.search(p.get('name', '')) 
                  or test_pattern.search(p.get('email', ''))]
    
    if not confirm:
        return {
            "preview": True,
            "message": "Add ?confirm=true to actually delete",
            "counsellors_to_delete": [{
                "id": c.get("id", str(c.get("_id", ""))),
                "name": c.get("name"),
                "email": c.get("email")
            } for c in test_counsellors],
            "peer_supporters_to_delete": [{
                "id": p.get("id", str(p.get("_id", ""))),
                "name": p.get("name"),
                "email": p.get("email")
            } for p in test_peers]
        }
    
    # Actually delete
    deleted_counsellors = 0
    deleted_peers = 0
    
    for c in test_counsellors:
        result = await db.counsellors.delete_one({"_id": c.get("_id")})
        deleted_counsellors += result.deleted_count
    
    for p in test_peers:
        result = await db.peer_supporters.delete_one({"_id": p.get("_id")})
        deleted_peers += result.deleted_count
    
    return {
        "success": True,
        "deleted_counsellors": deleted_counsellors,
        "deleted_peer_supporters": deleted_peers
    }


# ============ AUDIT LOG ENDPOINTS ============

@api_router.get("/admin/audit-logs")
async def get_audit_logs_endpoint(
    event_type: Optional[str] = None,
    user_id: Optional[str] = None,
    risk_level: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(require_role("admin"))
):
    """
    Retrieve audit logs with optional filtering.
    Required for compliance and security monitoring.
    """
    logs = await get_audit_logs(
        db,
        event_type=event_type,
        user_id=user_id,
        risk_level=risk_level,
        limit=min(limit, 500)  # Cap at 500
    )
    return {"logs": logs, "count": len(logs)}


@api_router.get("/admin/audit-logs/summary")
async def get_audit_summary_endpoint(
    days: int = 30,
    current_user: User = Depends(require_role("admin"))
):
    """
    Get summary statistics for audit logs.
    """
    summary = await get_audit_summary(db, days)
    return summary


# Include the router in the main app (MUST be after all routes are defined)
app.include_router(api_router)

# Include modular routers from /routers directory
from routers import (
    auth, cms, shifts, buddy_finder,
    staff, organizations, resources, safeguarding, 
    callbacks, live_chat, notes, concerns,
    message_queue, ai_feedback, knowledge_base, compliance,
    podcasts, data_retention, shift_swaps, documents, surveys,
    twilio_calling, events, ai_tutor
)

# Core functionality routers
app.include_router(auth.router, prefix="/api")
app.include_router(cms.router, prefix="/api")
app.include_router(shifts.router, prefix="/api")
app.include_router(buddy_finder.router, prefix="/api")
app.include_router(podcasts.router, prefix="/api")

# Staff and organization management
app.include_router(staff.router, prefix="/api")
app.include_router(organizations.router, prefix="/api")
app.include_router(resources.router, prefix="/api")
app.include_router(safeguarding.router, prefix="/api")
app.include_router(callbacks.router, prefix="/api")
app.include_router(live_chat.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(concerns.router, prefix="/api")
app.include_router(message_queue.router, prefix="/api")
app.include_router(ai_feedback.router, prefix="/api")
app.include_router(knowledge_base.router, prefix="/api")
app.include_router(compliance.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(surveys.router, prefix="/api")
app.include_router(data_retention.router)
app.include_router(shift_swaps.router, prefix="/api")
app.include_router(twilio_calling.router)  # Twilio browser-to-phone calling

# Community Events routes (virtual coffee mornings, etc.)
events.set_db(db)
app.include_router(events.router, prefix="/api")

# Clinical Safety Governance routes
set_governance_db(db)
app.include_router(governance_router, prefix="/api")

# Case Management routes (counsellor triage system)
set_case_dependencies(db, get_current_user)
app.include_router(case_router, prefix="/api")

# AI Characters CMS routes (manage AI personas via database)
set_ai_char_dependencies(db, get_current_user, AI_CHARACTERS)
app.include_router(ai_characters_router, prefix="/api")

# Learning System routes (safety patterns, learnings, feedback)
set_learning_db(db)
app.include_router(learning_router)

# LMS - Mental Health First Aid Training for Volunteers
app.include_router(lms_router)

# AI Tutor - Mr Clark
app.include_router(ai_tutor.router)

# Time Tracking - Admin work hours logging
from routers.timetracking import router as timetracking_router
app.include_router(timetracking_router)

# CMS Content - Books, Podcasts, Persona Bios
from routers.cms_content import router as cms_content_router
app.include_router(cms_content_router, prefix="/api/cms", tags=["CMS Content"])

# Serve static files for Staff Portal and Admin Site
# This allows testing the portals from the preview environment
PORTAL_PATH = Path(__file__).parent.parent / "staff-portal"
ADMIN_PATH = Path(__file__).parent.parent / "admin-site"
LMS_ADMIN_PATH = Path(__file__).parent.parent / "lms-admin"
LMS_LEARNER_PATH = Path(__file__).parent.parent / "lms-learner"

if PORTAL_PATH.exists():
    app.mount("/api/portal", StaticFiles(directory=str(PORTAL_PATH), html=True), name="staff-portal")
    
if ADMIN_PATH.exists():
    app.mount("/api/admin", StaticFiles(directory=str(ADMIN_PATH), html=True), name="admin-site")

if LMS_ADMIN_PATH.exists():
    app.mount("/api/lms-admin", StaticFiles(directory=str(LMS_ADMIN_PATH), html=True), name="lms-admin")

if LMS_LEARNER_PATH.exists():
    app.mount("/api/training", StaticFiles(directory=str(LMS_LEARNER_PATH), html=True), name="lms-learner")

# Mount static files for uploaded avatars
STATIC_AVATARS_PATH = Path(__file__).parent / "static" / "avatars"
STATIC_AVATARS_PATH.mkdir(parents=True, exist_ok=True)
app.mount("/static/avatars", StaticFiles(directory=str(STATIC_AVATARS_PATH)), name="avatars")

# Mount website images directory for AI character avatars
# These are referenced in AI character configs as /images/tommy.png, etc.
WEBSITE_IMAGES_PATH = Path(__file__).parent.parent / "website" / "images"
if WEBSITE_IMAGES_PATH.exists():
    app.mount("/images", StaticFiles(directory=str(WEBSITE_IMAGES_PATH)), name="website-images")

# Mount docs folder for funding documents
DOCS_PATH = Path(__file__).parent.parent / "docs"
if DOCS_PATH.exists():
    app.mount("/api/docs", StaticFiles(directory=str(DOCS_PATH), html=True), name="docs")

STATIC_REPORTS_PATH = Path(__file__).parent / "static" / "reports"
STATIC_REPORTS_PATH.mkdir(parents=True, exist_ok=True)
app.mount("/api/reports", StaticFiles(directory=str(STATIC_REPORTS_PATH)), name="reports")


# Create ASGI app that combines FastAPI and Socket.IO
# Store original FastAPI app
_fastapi_app = app

# Create combined ASGI app with Socket.IO
# Use socketio_path='/api/socket.io' to work with Kubernetes ingress routing (all /api/* goes to backend)
socket_app = socketio.ASGIApp(sio, _fastapi_app, socketio_path='/api/socket.io')

# IMPORTANT: Override app to be the socket_app so supervisor can run it correctly
# The supervisor config runs server:app, so we reassign app to include Socket.IO
app = socket_app
