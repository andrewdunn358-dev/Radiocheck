"""
Veteran Voices — Pydantic models for clips, plays, saves.

This feature is COMPLETELY INDEPENDENT of:
  - The AI Battle Buddies (no buddy-specialism categorisation, no
    cross-surfacing inside a Buddy conversation).
  - The safeguarding flow (`safeguarding_alerts`, `live_chat_rooms`,
    WebRTC signalling, panic alerts, escalations).
  - The Safety subsystem (`safety/*`) and field-level encryption
    (`ENCRYPTED_FIELDS`).

Categorisation is by USER SITUATION ONLY. Sensitivity flags are
content-warning labels and are a separate concept from categories.

Transcripts are stored for internal QC / admin search / caption
generation only. They MUST NOT be exposed in any veteran-facing
response payload — see `ClipPublicResponse` below.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class ClipStatus(str, Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class ClipCategory(str, Enum):
    """User situation categories. Veterans browse by these.

    NOT linked to AI Battle Buddy specialisms. Adding/removing requires
    coordinated frontend changes.
    """
    couldnt_sleep = "couldnt_sleep"
    anniversary = "anniversary"
    lost_purpose = "lost_purpose"
    family_doesnt_get_it = "family_doesnt_get_it"
    money_worries = "money_worries"
    anger = "anger"
    transition = "transition"
    loss = "loss"
    addiction_recovery = "addiction_recovery"
    physical_injury = "physical_injury"
    identity = "identity"
    faith = "faith"
    just_need_to_hear_a_voice = "just_need_to_hear_a_voice"


class SensitivityFlag(str, Enum):
    """Content-warning flags. Drives the random-feed sensitivity filter.

    Distinct from ClipCategory: a clip can be category="loss" (situation
    bucket) AND carry sensitivityFlag="loss" (graphic content about loss).
    By default the random endpoint excludes any clip with a flag other
    than `none` unless the caller's setting overrides.
    """
    none = "none"
    loss = "loss"
    mst = "MST"
    suicidal_ideation = "suicidal_ideation"
    addiction = "addiction"
    violence = "violence"


# ---------------------------------------------------------------------------
# Sub-documents
# ---------------------------------------------------------------------------

class CaptionSegment(BaseModel):
    """One line of time-synced captions for the player CC toggle.

    Whisper produces segment-level timing; we persist these for line-by-line
    sync in the player. NOT a full transcript — the user-facing payload
    surfaces only these timed lines, never a flat paragraph transcript.
    """
    start: float  # seconds from clip start
    end: float
    text: str


# ---------------------------------------------------------------------------
# Internal full model (DB-shape; never returned to veterans)
# ---------------------------------------------------------------------------

class Clip(BaseModel):
    """Full DB document. Use `ClipPublicResponse` for veteran-facing routes."""
    id: str
    contributorName: str  # Alias or first name only (per consent)
    contributorBio: str  # One line, max 80 chars (admin-enforced)
    contributorPhotoUrl: Optional[str] = None  # Only if consented

    # Audio storage — filename inside AUDIO_STORAGE_PATH (no raw path leaked)
    audioFilename: str
    durationSeconds: int

    # Internal-only: full transcript for admin search / QC. NEVER returned
    # in veteran-facing payloads — captions are the only user-facing text.
    transcript: str = ""
    captions: List[CaptionSegment] = Field(default_factory=list)

    categories: List[str] = Field(default_factory=list)
    sensitivityFlags: List[str] = Field(default_factory=lambda: ["none"])

    recordingDate: Optional[str] = None  # ISO date

    status: ClipStatus = ClipStatus.draft
    consentConfirmed: bool = False
    uploadedByAdminId: Optional[str] = None
    adminNotes: Optional[str] = None  # Admin-only, never exposed to veterans

    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ClipPlay(BaseModel):
    """One playback event. Stored separately to keep Clip docs small.

    Used by the random selection logic to exclude clips this user played
    in the last 7 days, and by admin analytics for completion / skip
    metrics.
    """
    id: str
    userId: str
    clipId: str
    playedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completionPercent: float = 0.0  # 0-100
    skipped: bool = False


class ClipSave(BaseModel):
    """Composite-key save record. (userId, clipId) is unique."""
    userId: str
    clipId: str
    savedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Veteran-facing response (NO transcript)
# ---------------------------------------------------------------------------

class ClipPublicResponse(BaseModel):
    """Shape returned to the veteran app. Strictly omits `transcript`,
    `adminNotes`, `uploadedByAdminId`, and the raw storage filename.

    `audioUrl` is the routed streaming endpoint (`/api/clips/audio/<id>`),
    not the on-disk path.
    """
    id: str
    contributorName: str
    contributorBio: str
    contributorPhotoUrl: Optional[str] = None
    audioUrl: str
    durationSeconds: int
    captions: List[CaptionSegment] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    sensitivityFlags: List[str] = Field(default_factory=lambda: ["none"])
    recordingDate: Optional[str] = None
