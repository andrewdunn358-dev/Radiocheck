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


class ClipProcessingStatus(str, Enum):
    """Pipeline state for the admin uploader (PR #B1).

    Distinct from `ClipStatus` (draft/published/archived): a clip can be
    `status=draft` and `processingStatus=transcribing` simultaneously.
    Surfaced ONLY in admin payloads — never in `ClipPublicResponse`.
    """
    pending = "pending"          # row inserted, audio not yet processed
    transcoding = "transcoding"  # ffmpeg re-encode in flight
    transcribing = "transcribing"  # Whisper in flight
    ready = "ready"              # pipeline finished, captions/duration saved
    failed = "failed"            # pipeline aborted; see processingError


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class ClipMediaType(str, Enum):
    """Whether the clip is audio-only or contains video. Drives the
    transcode profile (audio -> mp3 mono; video -> mp4 720p H.264/AAC)
    and the veteran-facing player mode (mini-player thumbnail + full-
    screen video vs. audio-only with photo)."""
    audio = "audio"
    video = "video"


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
    contributorPhotoUrl: Optional[str] = None  # Set when external URL
    # Filename of a contributor photo on disk, sitting under
    # AUDIO_STORAGE_PATH/photos/. Served via /api/clips/photo/{id}.
    # Independent of `contributorPhotoUrl` (which supports an external URL
    # path if ever needed). Public response prefers the on-disk routed URL
    # when this is set.
    contributorPhotoFilename: Optional[str] = None

    # Audio/video storage — filename inside AUDIO_STORAGE_PATH (no raw path leaked)
    audioFilename: str
    durationSeconds: int
    # `audio` clips stream as mp3, `video` clips stream as mp4. The
    # streaming endpoint (`/api/clips/audio/{id}`) serves both; the
    # client decides player mode from this field.
    mediaType: ClipMediaType = ClipMediaType.audio
    # Authoritative on-disk-existence flags written at upload time and
    # refreshed by photo replace/remove. Admin UI uses these to decide
    # whether to render the player / image element rather than guessing
    # from the filename strings (which may point at orphaned uploads on
    # older rows). NOT in ENCRYPTED_FIELDS — pure operational metadata.
    hasAudio: bool = False
    hasPhoto: bool = False

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
    # Admin-only free-text notes (e.g. provenance, follow-up reminders).
    # Per design decision (PR #B1 Q4): NOT encrypted — contributor names and
    # admin context here are operational metadata, not service-user PII.
    # Do not add to ENCRYPTED_FIELDS.
    internalNotes: Optional[str] = None

    # Pipeline state (PR #B1). `status` is the editorial lifecycle
    # (draft/published/archived); `processingStatus` is the ingest pipeline
    # lifecycle (pending→transcoding→transcribing→ready / failed).
    # NEVER surfaced in `ClipPublicResponse`.
    processingStatus: ClipProcessingStatus = ClipProcessingStatus.pending
    processingError: Optional[str] = None  # last error message if failed

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
    not the on-disk path. `mediaType` tells the client which player to
    render (audio vs video).

    `contributorPhotoUrl` resolution order:
      1. If `contributorPhotoFilename` is set, use the on-disk routed URL
         `/api/clips/photo/<id>`.
      2. Else fall back to the legacy external URL field if present.
      3. Else null — the player falls back to a text-only card.
    """
    id: str
    contributorName: str
    contributorBio: str
    contributorPhotoUrl: Optional[str] = None
    audioUrl: str
    mediaType: ClipMediaType = ClipMediaType.audio
    durationSeconds: int
    captions: List[CaptionSegment] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    sensitivityFlags: List[str] = Field(default_factory=lambda: ["none"])
    recordingDate: Optional[str] = None
