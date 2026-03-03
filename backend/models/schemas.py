"""
Pydantic models/schemas for the Veterans Support API
All data models are centralized here for easy maintenance
"""

from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


# ==================================
# Authentication Models
# ==================================

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"
    name: str = ""
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    sms: Optional[str] = None
    whatsapp: Optional[str] = None
    specialization: str = ""
    area: Optional[str] = None
    background: Optional[str] = None
    yearsServed: Optional[str] = None
    linked_staff_id: str = ""
    linked_staff_type: str = ""
    
    class Config:
        extra = "ignore"  # Ignore any extra fields not defined here

class User(BaseModel):
    id: str
    email: EmailStr
    role: str = "user"
    name: str = ""

class TokenResponse(BaseModel):
    token: str
    user: User
    redirect: Optional[str] = None

class ChangePassword(BaseModel):
    old_password: str
    new_password: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str
    new_password: str

class AdminResetPassword(BaseModel):
    user_id: str
    new_password: str


# ==================================
# Staff Models (Counsellors & Peers)
# ==================================

class CounsellorCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str = ""
    specialization: str = ""
    bio: str = ""
    is_available: bool = True
    status: str = "offline"

class Counsellor(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: str = ""
    specialization: str = ""
    bio: str = ""
    is_available: bool = True
    status: str = "offline"
    sip_extension: Optional[str] = None
    sip_password: Optional[str] = None

class CounsellorStatusUpdate(BaseModel):
    is_available: Optional[bool] = None
    status: Optional[str] = None

class CounsellorPublic(BaseModel):
    id: str
    name: str
    specialization: str = ""
    status: str = "offline"

class PeerSupporterPublic(BaseModel):
    id: str
    name: str
    service_branch: str = ""
    regiment: str = ""
    years_served: str = ""
    status: str = "offline"

class PeerSupporterCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str = ""
    service_branch: str = ""
    regiment: str = ""
    years_served: str = ""
    bio: str = ""
    is_available: bool = True
    status: str = "offline"

class PeerSupporter(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: str = ""
    service_branch: str = ""
    regiment: str = ""
    years_served: str = ""
    bio: str = ""
    is_available: bool = True
    status: str = "offline"
    sip_extension: Optional[str] = None
    sip_password: Optional[str] = None

class PeerSupporterStatusUpdate(BaseModel):
    is_available: Optional[bool] = None
    status: Optional[str] = None


# ==================================
# Organization Models
# ==================================

class OrganizationCreate(BaseModel):
    name: str
    service: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""

class Organization(BaseModel):
    id: str
    name: str
    service: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ==================================
# Peer Support Registration
# ==================================

class PeerSupportRegistration(BaseModel):
    id: str
    email: str
    service_branch: str
    regiment: str
    years_served: str
    bio: str
    motivation: str

class PeerSupportRegistrationCreate(BaseModel):
    email: str
    service_branch: str


# ==================================
# Call Logging
# ==================================

class CallIntentCreate(BaseModel):
    contact_type: str
    contact_id: str
    contact_name: str = ""
    phone_number: str = ""

class CallIntent(BaseModel):
    id: str
    user_id: str
    contact_type: str
    contact_id: str
    contact_name: str = ""
    phone_number: str = ""
    timestamp: str


# ==================================
# CMS Models - Extended for Multiple Page Types
# ==================================

# Page Types:
# - "standard" - Cards-based layout (default)
# - "article" - Blog/article style with rich text
# - "landing" - Hero + features layout
# - "contact" - Contact form page
# - "resources" - Resource list with categories
# - "gallery" - Image/media gallery

# Section Types:
# - "cards" - Grid of clickable cards
# - "hero" - Large banner with title/subtitle
# - "text" - Rich text content
# - "resources" - List of resources/links
# - "accordion" - Collapsible FAQ style
# - "testimonial" - Quotes/testimonials
# - "stats" - Statistics/numbers display
# - "cta" - Call-to-action banner

class PageContent(BaseModel):
    page_name: str
    hero_title: str = ""
    hero_subtitle: str = ""
    sections: List[Dict[str, Any]] = []
    resources: List[Dict[str, Any]] = []
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PageContentUpdate(BaseModel):
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    sections: Optional[List[Dict[str, Any]]] = None
    resources: Optional[List[Dict[str, Any]]] = None

class CMSPage(BaseModel):
    id: str = ""
    slug: str
    title: str
    description: str = ""
    meta_keywords: str = ""
    page_type: str = "standard"  # standard, article, landing, contact, resources, gallery
    layout: str = "default"  # default, sidebar, full-width
    hero_image: str = ""
    hero_overlay: bool = True
    is_visible: bool = True
    show_in_nav: bool = True
    nav_order: int = 0
    icon: str = ""  # Navigation icon
    parent_slug: str = ""  # For nested pages
    order: int = 0
    sections: List[Any] = []
    custom_css: str = ""  # Custom styling per page
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CMSSection(BaseModel):
    id: str = ""
    page_slug: str
    section_type: str = "cards"  # cards, hero, text, resources, accordion, testimonial, stats, cta
    title: str = ""
    subtitle: str = ""
    content: str = ""  # Rich text/HTML content
    background_color: str = ""
    background_image: str = ""
    text_color: str = ""
    layout: str = "default"  # default, centered, left-aligned, alternating
    columns: int = 2  # For card grids
    order: int = 0
    is_visible: bool = True
    cards: List[Any] = []
    items: List[Dict[str, Any]] = []  # For accordion/resources
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CMSCard(BaseModel):
    id: str = ""
    section_id: str
    card_type: str = "link"  # link, phone, resource, image, video, stat
    title: str
    description: str = ""
    icon: str = ""
    color: str = "#3b82f6"
    bg_color: str = "#1e3a5f"
    image_url: str = ""
    video_url: str = ""
    route: str = ""  # Internal link
    external_url: str = ""  # External link
    phone: str = ""
    stat_value: str = ""  # For stat cards
    stat_label: str = ""
    order: int = 0
    size: str = "default"  # default, small, large, featured
    is_visible: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CMSPageCreate(BaseModel):
    slug: str
    title: str
    description: str = ""
    meta_keywords: str = ""
    is_visible: bool = True
    order: int = 0

class CMSSectionCreate(BaseModel):
    page_slug: str
    section_type: str = "cards"
    title: str = ""
    subtitle: str = ""
    content: str = ""
    order: int = 0
    is_visible: bool = True

class CMSCardCreate(BaseModel):
    section_id: str
    card_type: str = "link"
    title: str
    description: str = ""
    icon: str = ""
    color: str = "#3b82f6"
    bg_color: str = "#1e3a5f"
    route: str = ""
    external_url: str = ""
    phone: str = ""
    order: int = 0
    is_visible: bool = True


# ==================================
# Resource Models
# ==================================

class ResourceCreate(BaseModel):
    title: str
    description: str
    category: str
    url: str = ""
    phone: str = ""
    icon: str = "book"
    order: int = 0

class Resource(BaseModel):
    id: str
    title: str
    description: str
    category: str
    url: str = ""
    phone: str = ""
    icon: str = "book"
    order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    url: Optional[str] = None
    phone: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None


# ==================================
# Callback & Alert Models
# ==================================

class CallbackRequestCreate(BaseModel):
    name: str
    phone: str
    preferred_time: str = ""
    reason: str = ""
    user_id: str = ""
    additional_notes: str = ""
    is_anonymous: bool = False

class CallbackRequest(BaseModel):
    id: str
    name: str
    phone: str
    preferred_time: str = ""
    reason: str = ""
    user_id: str = ""
    additional_notes: str = ""
    status: str = "pending"
    is_anonymous: bool = False
    assigned_to: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CallbackStatusUpdate(BaseModel):
    status: str
    notes: str = ""

class PanicAlertCreate(BaseModel):
    user_id: str
    location: str = ""
    message: str = ""

class PanicAlert(BaseModel):
    id: str
    user_id: str
    location: str = ""
    message: str = ""
    status: str = "active"
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SafeguardingAlert(BaseModel):
    id: str
    session_id: str
    user_id: str = "anonymous"
    risk_level: str
    message: str
    ai_response: str = ""
    followup_actions: List[str] = []
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str = "active"
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    notes: str = ""
    risk_score: float = 0.0
    risk_factors: Dict[str, Any] = {}
    crisis_resources: Dict[str, Any] = {}
    ip_geolocation: Optional[Dict[str, Any]] = None
    user_consent_status: str = "unknown"
    outreach_status: str = "none"
    outcome_assessment: str = ""
    audit_trail: List[Dict[str, Any]] = []


# ==================================
# Notes & Concerns
# ==================================

class NoteCreate(BaseModel):
    title: str
    content: str
    category: str = "general"
    is_private: bool = False
    client_id: str = ""

class Note(BaseModel):
    id: str
    author_id: str
    author_name: str = ""
    title: str
    content: str
    category: str = "general"
    is_private: bool = False
    client_id: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    is_private: Optional[bool] = None

class ConcernCreate(BaseModel):
    user_id: str
    concern_type: str
    severity: str
    description: str
    related_session_id: str = ""
    related_alert_id: str = ""
    notes: str = ""
    recommended_actions: List[str] = []

class Concern(BaseModel):
    id: str
    user_id: str
    concern_type: str
    severity: str
    description: str
    status: str = "open"
    related_session_id: str = ""
    related_alert_id: str = ""
    assigned_to: Optional[str] = None
    notes: str = ""
    recommended_actions: List[str] = []
    resolution_notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None


# ==================================
# Shifts / Rota
# ==================================

class ShiftCreate(BaseModel):
    date: str
    start_time: str
    end_time: str

class Shift(BaseModel):
    id: str
    user_id: str
    user_name: str = ""
    date: str
    start_time: str
    end_time: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ShiftUpdate(BaseModel):
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None


# ==================================
# Buddy Finder Models
# ==================================

class BuddyProfileCreate(BaseModel):
    display_name: str
    region: str = ""
    service_branch: str = ""
    regiment: str = ""
    years_served: str = ""
    bio: str = ""
    interests: List[str] = []
    contact_preference: str = "in_app"
    email: str = ""
    gdpr_consent: bool = False

class BuddyProfile(BaseModel):
    id: str
    user_id: str
    display_name: str
    region: str = ""
    service_branch: str = ""
    regiment: str = ""
    years_served: str = ""
    bio: str = ""
    interests: List[str] = []
    contact_preference: str = "in_app"
    email: str = ""
    gdpr_consent: bool = False
    is_active: bool = True
    last_active: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

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
    id: str
    from_profile_id: str
    to_profile_id: str
    message: str
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ==================================
# AI Buddies
# ==================================

class BuddyChatRequest(BaseModel):
    message: str
    buddy_name: str = "tommy"
    session_id: str = ""

class BuddyChatResponse(BaseModel):
    response: str
    session_id: str
    followup_action: Optional[str] = None
