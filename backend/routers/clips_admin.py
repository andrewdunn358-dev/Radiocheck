"""
Veteran Voices — admin clip-management endpoints (PR #B1).

Scope of THIS file:
  - POST   /api/admin/clips                   create + ingest a new clip
  - GET    /api/admin/clips                   list all clips (any status)
  - GET    /api/admin/clips/{id}              full admin view of one clip
  - PATCH  /api/admin/clips/{id}              edit metadata / captions
  - POST   /api/admin/clips/{id}/publish      flip status=published
  - POST   /api/admin/clips/{id}/archive      flip status=archived
  - POST   /api/admin/clips/{id}/retranscribe re-run Whisper on existing audio
  - DELETE /api/admin/clips/{id}              hard delete + remove file

OUT OF SCOPE (later PRs):
  - Admin UI (PR #B2 — Next.js portal screens)
  - Veteran-side save/favourite endpoints (PR #C)
  - Per-category browse / play-tracking endpoints (PR #C)

AUTH
====
Every endpoint here is gated by `require_admin` injected from `server.py`
(`set_admin_dependency`). Role check is `role == "admin"` — matches the
pattern in `routers/ai_characters.py`.

SAFETY WALL
===========
No imports from safety/, encryption.py, safeguarding routers, live_chat,
webrtc_signaling, or any panic/alert/escalation module. The Clip
collection is independent of all PII / safeguarding data.

The router intentionally does NOT add any fields to `ENCRYPTED_FIELDS`:
contributor names are public consented aliases, transcripts are recorded
voice content (not service-user PII), internalNotes are operational admin
text (Q4: don't encrypt internalNotes).
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from models.clips import (
    CaptionSegment,
    ClipMediaType,
    ClipProcessingStatus,
    ClipStatus,
)
from services.voices_pipeline import (
    delete_clip_file,
    delete_contributor_photo,
    process_upload,
    save_contributor_photo,
    transcribe_with_whisper,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/clips", tags=["Veteran Voices — Admin"])
security = HTTPBearer()


# ---------------------------------------------------------------------------
# Dependency wiring (mirrors the pattern used by routers/ai_characters.py —
# server.py injects db + get_current_user at startup; this router defines
# its own thin `require_admin` that adds the role check).
# ---------------------------------------------------------------------------

_db: Optional[AsyncIOMotorDatabase] = None
_get_current_user: Optional[Callable[..., Any]] = None


def set_dependencies(database: AsyncIOMotorDatabase, current_user_func: Callable[..., Any]) -> None:
    """Called by server.py at startup. `current_user_func` is the project's
    `get_current_user` JWT resolver."""
    global _db, _get_current_user
    _db = database
    _get_current_user = current_user_func


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise HTTPException(status_code=500, detail="voices admin router db not initialised")
    return _db


async def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Any:
    """FastAPI dependency: resolve the JWT and gate on role == 'admin'.
    Mirrors `routers/ai_characters.py::require_admin` exactly so the
    behaviour (and any future auth fixes there) stays consistent."""
    if _get_current_user is None:
        raise HTTPException(status_code=500, detail="voices admin auth not initialised")
    user = await _get_current_user(credentials)
    # User may be a Pydantic model or a dict depending on call path.
    if hasattr(user, "dict") and callable(user.dict):
        user_data = user.dict()
    elif hasattr(user, "model_dump") and callable(user.model_dump):
        user_data = user.model_dump()
    elif hasattr(user, "__dict__"):
        user_data = vars(user)
    else:
        user_data = dict(user)
    if user_data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_data


# ---------------------------------------------------------------------------
# Pydantic shapes
# ---------------------------------------------------------------------------

class ClipAdminResponse(BaseModel):
    """Full admin payload — includes transcript, processing status, all
    metadata. NEVER returned from veteran-facing endpoints."""
    id: str
    contributorName: str
    contributorBio: str
    contributorPhotoUrl: Optional[str] = None
    contributorPhotoFilename: Optional[str] = None
    audioFilename: str
    mediaType: str = "audio"
    durationSeconds: int
    transcript: str
    captions: List[CaptionSegment]
    categories: List[str]
    sensitivityFlags: List[str]
    recordingDate: Optional[str] = None
    status: str
    consentConfirmed: bool
    uploadedByAdminId: Optional[str] = None
    adminNotes: Optional[str] = None
    internalNotes: Optional[str] = None
    processingStatus: str
    processingError: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


class ClipAdminListItem(BaseModel):
    """Compact row used by the admin list view."""
    id: str
    contributorName: str
    durationSeconds: int
    mediaType: str = "audio"
    status: str
    processingStatus: str
    categories: List[str]
    sensitivityFlags: List[str]
    createdAt: datetime
    updatedAt: datetime


class ClipUpdateRequest(BaseModel):
    """Editable fields. Anything not provided is left unchanged.

    `audioFilename` and `id` are intentionally non-editable — once a file
    is on disk the admin must DELETE + re-upload to replace it.
    """
    contributorName: Optional[str] = None
    contributorBio: Optional[str] = Field(default=None, max_length=80)
    contributorPhotoUrl: Optional[str] = None
    transcript: Optional[str] = None
    captions: Optional[List[CaptionSegment]] = None
    categories: Optional[List[str]] = None
    sensitivityFlags: Optional[List[str]] = None
    recordingDate: Optional[str] = None
    consentConfirmed: Optional[bool] = None
    adminNotes: Optional[str] = None
    internalNotes: Optional[str] = None
    status: Optional[ClipStatus] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_internal(doc: dict) -> dict:
    """Drop Mongo `_id` from a clip doc before serialising."""
    doc.pop("_id", None)
    return doc


def _to_admin_response(doc: dict) -> ClipAdminResponse:
    """Build the full admin payload (includes transcript + processing
    state). Defensively defaults missing fields so older PR #A rows
    (pre-pipeline) don't 500 the list view."""
    captions = [
        CaptionSegment(**c) if not isinstance(c, CaptionSegment) else c
        for c in (doc.get("captions") or [])
    ]
    return ClipAdminResponse(
        id=doc["id"],
        contributorName=doc.get("contributorName", ""),
        contributorBio=doc.get("contributorBio", ""),
        contributorPhotoUrl=doc.get("contributorPhotoUrl"),
        contributorPhotoFilename=doc.get("contributorPhotoFilename"),
        audioFilename=doc.get("audioFilename", ""),
        mediaType=str(doc.get("mediaType", ClipMediaType.audio.value)),
        durationSeconds=int(doc.get("durationSeconds", 0)),
        transcript=doc.get("transcript", ""),
        captions=captions,
        categories=list(doc.get("categories") or []),
        sensitivityFlags=list(doc.get("sensitivityFlags") or ["none"]),
        recordingDate=doc.get("recordingDate"),
        status=str(doc.get("status", ClipStatus.draft.value)),
        consentConfirmed=bool(doc.get("consentConfirmed", False)),
        uploadedByAdminId=doc.get("uploadedByAdminId"),
        adminNotes=doc.get("adminNotes"),
        internalNotes=doc.get("internalNotes"),
        processingStatus=str(doc.get("processingStatus", ClipProcessingStatus.ready.value)),
        processingError=doc.get("processingError"),
        createdAt=doc.get("createdAt") or datetime.now(timezone.utc),
        updatedAt=doc.get("updatedAt") or datetime.now(timezone.utc),
    )


def _parse_csv_list(raw: Optional[str]) -> List[str]:
    """Parse a comma-separated form field into a clean list of trimmed
    non-empty strings."""
    if not raw:
        return []
    return [s.strip() for s in raw.split(",") if s.strip()]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=ClipAdminResponse, status_code=201)
async def create_clip(
    audio: UploadFile = File(..., description="Source audio OR video file. Audio: wav/mp3/m4a/ogg/flac (≤100 MB). Video: mp4/mov/mkv/avi/webm (≤500 MB)."),
    contributorName: str = Form(..., description="Display alias / first name."),
    contributorBio: str = Form(..., description="One-line bio, ≤80 chars."),
    categories: str = Form(
        "",
        description="Comma-separated ClipCategory values (e.g. 'couldnt_sleep,transition').",
    ),
    sensitivityFlags: str = Form(
        "none",
        description="Comma-separated SensitivityFlag values; default 'none'.",
    ),
    contributorPhoto: Optional[UploadFile] = File(
        None, description="Optional contributor photo (PNG or JPG, ≤5 MB)."
    ),
    contributorPhotoUrl: Optional[str] = Form(None),
    recordingDate: Optional[str] = Form(None, description="ISO date the clip was recorded."),
    consentConfirmed: bool = Form(
        False,
        description="Admin must tick the consent confirmation before this can flip to published.",
    ),
    adminNotes: Optional[str] = Form(None),
    internalNotes: Optional[str] = Form(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: Any = Depends(require_admin),
) -> ClipAdminResponse:
    """Upload a fresh clip. Runs the full pipeline inline (transcode +
    Whisper) so the admin gets immediate feedback on whether the file is
    usable. Failed ingest still creates a `status=draft,
    processingStatus=failed` row so the admin can fix metadata + retry.

    Photo handling (PR #C gap closure):
      - If `contributorPhoto` is supplied, it's saved under
        `<AUDIO_STORAGE_PATH>/photos/<clip_id>.<ext>` (PNG/JPG only,
        ≤5MB). Filename is stored on the row as
        `contributorPhotoFilename` and exposed via /api/clips/photo/<id>.
      - If the photo fails validation, the rest of the upload still
        succeeds; the failure is appended to `processingError`.

    The clip is ALWAYS created as `status=draft`. A separate publish step
    (`POST /api/admin/clips/{id}/publish`) handles going live.
    """
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No filename on upload.")

    raw_bytes = await audio.read()

    pipeline = await process_upload(
        raw_bytes=raw_bytes,
        original_filename=audio.filename,
    )

    clip_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    admin_id = (
        getattr(current_admin, "id", None)
        if hasattr(current_admin, "id")
        else (current_admin.get("id") if isinstance(current_admin, dict) else None)
    )

    # ---- Optional contributor photo (saved after we have a clip_id).
    photo_filename: Optional[str] = None
    photo_error: Optional[str] = None
    if contributorPhoto is not None and contributorPhoto.filename:
        photo_bytes = await contributorPhoto.read()
        if photo_bytes:
            try:
                photo_filename = save_contributor_photo(photo_bytes, clip_id)
            except ValueError as ve:
                photo_error = f"Photo upload rejected: {ve}"
                logger.warning(f"[voices_admin] {photo_error}")

    # Compose processingError text if BOTH pipeline failed + photo failed.
    combined_error = pipeline.error
    if photo_error:
        combined_error = (combined_error + " | " + photo_error) if combined_error else photo_error

    doc: dict = {
        "id": clip_id,
        "contributorName": contributorName.strip(),
        "contributorBio": contributorBio.strip()[:80],
        "contributorPhotoUrl": (contributorPhotoUrl or None),
        "contributorPhotoFilename": photo_filename,
        "audioFilename": pipeline.audio_filename or "",
        "mediaType": (
            ClipMediaType.video.value if pipeline.media_type == "video"
            else ClipMediaType.audio.value
        ),
        "durationSeconds": pipeline.duration_seconds,
        "transcript": pipeline.transcript,
        "captions": pipeline.captions,
        "categories": _parse_csv_list(categories),
        "sensitivityFlags": _parse_csv_list(sensitivityFlags) or ["none"],
        "recordingDate": recordingDate,
        "status": ClipStatus.draft.value,
        "consentConfirmed": bool(consentConfirmed),
        "uploadedByAdminId": admin_id,
        "adminNotes": adminNotes,
        "internalNotes": internalNotes,
        "processingStatus": (
            ClipProcessingStatus.ready.value if pipeline.ok
            else ClipProcessingStatus.failed.value
        ),
        "processingError": combined_error,
        "createdAt": now,
        "updatedAt": now,
    }

    await db.clips.insert_one(dict(doc))  # copy so the local dict is _id-free
    logger.info(
        f"[voices_admin] created clip {clip_id} "
        f"(media={pipeline.media_type}, pipeline_ok={pipeline.ok}, "
        f"duration={pipeline.duration_seconds}s, photo={'yes' if photo_filename else 'no'})"
    )
    return _to_admin_response(doc)


@router.get("", response_model=List[ClipAdminListItem])
async def list_clips(
    status: Optional[ClipStatus] = Query(None, description="Filter by editorial status."),
    processing_status: Optional[ClipProcessingStatus] = Query(
        None, description="Filter by pipeline status."
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: Any = Depends(require_admin),
) -> List[ClipAdminListItem]:
    """List every clip (any status). Compact payload — the admin UI fetches
    the full record via GET /api/admin/clips/{id} when opening a row."""
    query: dict = {}
    if status is not None:
        query["status"] = status.value
    if processing_status is not None:
        query["processingStatus"] = processing_status.value

    cursor = db.clips.find(query, {"_id": 0}).sort("createdAt", -1)
    docs = await cursor.to_list(length=None)
    return [
        ClipAdminListItem(
            id=d["id"],
            contributorName=d.get("contributorName", ""),
            durationSeconds=int(d.get("durationSeconds", 0)),
            mediaType=str(d.get("mediaType", ClipMediaType.audio.value)),
            status=str(d.get("status", ClipStatus.draft.value)),
            processingStatus=str(d.get("processingStatus", ClipProcessingStatus.ready.value)),
            categories=list(d.get("categories") or []),
            sensitivityFlags=list(d.get("sensitivityFlags") or ["none"]),
            createdAt=d.get("createdAt") or datetime.now(timezone.utc),
            updatedAt=d.get("updatedAt") or datetime.now(timezone.utc),
        )
        for d in docs
    ]


@router.get("/{clip_id}", response_model=ClipAdminResponse)
async def get_clip_admin(
    clip_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: Any = Depends(require_admin),
) -> ClipAdminResponse:
    """Full admin view — includes transcript, processing status, internal
    notes. Distinct from the veteran-facing `GET /api/clips/{id}` which
    returns 404 for drafts/archived."""
    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    return _to_admin_response(doc)


@router.patch("/{clip_id}", response_model=ClipAdminResponse)
async def update_clip(
    clip_id: str,
    payload: ClipUpdateRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: Any = Depends(require_admin),
) -> ClipAdminResponse:
    """Partial update. Only the fields supplied are written; everything
    else is left intact.

    Guardrails:
      * `status=published` requires `consentConfirmed=true` already
        on the doc (or being set in the same request) — otherwise we
        reject so a half-completed row never goes live.
    """
    existing = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Clip not found")

    update: dict = {}

    # Per-field mapping. Pydantic gives us a model; we read explicitly so
    # we don't accidentally write None over a field the admin left blank.
    if payload.contributorName is not None:
        update["contributorName"] = payload.contributorName.strip()
    if payload.contributorBio is not None:
        update["contributorBio"] = payload.contributorBio.strip()[:80]
    if payload.contributorPhotoUrl is not None:
        update["contributorPhotoUrl"] = payload.contributorPhotoUrl or None
    if payload.transcript is not None:
        update["transcript"] = payload.transcript
    if payload.captions is not None:
        update["captions"] = [c.model_dump() for c in payload.captions]
    if payload.categories is not None:
        update["categories"] = payload.categories
    if payload.sensitivityFlags is not None:
        update["sensitivityFlags"] = payload.sensitivityFlags or ["none"]
    if payload.recordingDate is not None:
        update["recordingDate"] = payload.recordingDate
    if payload.consentConfirmed is not None:
        update["consentConfirmed"] = payload.consentConfirmed
    if payload.adminNotes is not None:
        update["adminNotes"] = payload.adminNotes
    if payload.internalNotes is not None:
        update["internalNotes"] = payload.internalNotes

    if payload.status is not None:
        consent_after = (
            update.get("consentConfirmed")
            if "consentConfirmed" in update
            else existing.get("consentConfirmed", False)
        )
        if payload.status == ClipStatus.published and not consent_after:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cannot publish: consentConfirmed must be true. "
                    "Confirm contributor consent in the same update."
                ),
            )
        update["status"] = payload.status.value

    if update:
        update["updatedAt"] = datetime.now(timezone.utc)
        await db.clips.update_one({"id": clip_id}, {"$set": update})

    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    assert doc is not None  # we just confirmed it exists
    return _to_admin_response(doc)


@router.post("/{clip_id}/publish", response_model=ClipAdminResponse)
async def publish_clip(
    clip_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: Any = Depends(require_admin),
) -> ClipAdminResponse:
    """Convenience endpoint: flip status to `published`. Refuses if
    `consentConfirmed` is false or the pipeline never produced audio."""
    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    if not doc.get("consentConfirmed"):
        raise HTTPException(status_code=400, detail="consentConfirmed must be true to publish")
    if not doc.get("audioFilename"):
        raise HTTPException(status_code=400, detail="Clip has no audio file on disk")
    if doc.get("processingStatus") != ClipProcessingStatus.ready.value:
        raise HTTPException(
            status_code=400,
            detail=f"Clip pipeline not ready (processingStatus={doc.get('processingStatus')})",
        )

    await db.clips.update_one(
        {"id": clip_id},
        {"$set": {"status": ClipStatus.published.value, "updatedAt": datetime.now(timezone.utc)}},
    )
    doc["status"] = ClipStatus.published.value
    doc["updatedAt"] = datetime.now(timezone.utc)
    return _to_admin_response(doc)


@router.post("/{clip_id}/archive", response_model=ClipAdminResponse)
async def archive_clip(
    clip_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: Any = Depends(require_admin),
) -> ClipAdminResponse:
    """Soft-remove a clip from the veteran feed without deleting the file.
    Reversible via PATCH `status=draft|published`."""
    result = await db.clips.update_one(
        {"id": clip_id},
        {"$set": {"status": ClipStatus.archived.value, "updatedAt": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Clip not found")
    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    assert doc is not None
    return _to_admin_response(doc)


@router.post("/{clip_id}/retranscribe", response_model=ClipAdminResponse)
async def retranscribe_clip(
    clip_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: Any = Depends(require_admin),
) -> ClipAdminResponse:
    """Re-run Whisper against the existing on-disk audio. Useful when the
    admin notices a bad transcription or when the model is upgraded.

    Does NOT re-transcode — the original mp3 is left in place.
    """
    from services.voices_pipeline import AUDIO_STORAGE_PATH  # local import to keep top tidy

    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    filename = doc.get("audioFilename")
    if not filename:
        raise HTTPException(status_code=400, detail="Clip has no audio file to transcribe")

    audio_path = os.path.join(AUDIO_STORAGE_PATH, filename)
    if not os.path.isfile(audio_path):
        raise HTTPException(status_code=400, detail="Audio file missing on disk")

    # Flip to transcribing so the admin UI can poll/spin.
    await db.clips.update_one(
        {"id": clip_id},
        {
            "$set": {
                "processingStatus": ClipProcessingStatus.transcribing.value,
                "processingError": None,
                "updatedAt": datetime.now(timezone.utc),
            }
        },
    )

    try:
        transcript, captions = await transcribe_with_whisper(audio_path)
        await db.clips.update_one(
            {"id": clip_id},
            {
                "$set": {
                    "transcript": transcript,
                    "captions": captions,
                    "processingStatus": ClipProcessingStatus.ready.value,
                    "processingError": None,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
    except Exception as e:  # noqa: BLE001 — surface to admin UI not 500
        logger.exception(f"[voices_admin] retranscribe failed for {clip_id}")
        await db.clips.update_one(
            {"id": clip_id},
            {
                "$set": {
                    "processingStatus": ClipProcessingStatus.failed.value,
                    "processingError": str(e),
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    assert doc is not None
    return _to_admin_response(doc)


@router.post("/{clip_id}/photo", response_model=ClipAdminResponse)
async def replace_clip_photo(
    clip_id: str,
    contributorPhoto: UploadFile = File(..., description="PNG/JPG, ≤5 MB."),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: Any = Depends(require_admin),
) -> ClipAdminResponse:
    """Replace (or set, if absent) the contributor photo on an existing
    clip. Old photo file is removed from disk after the new one is
    written. PR #C gap-closure endpoint so admins can fix a missing
    photo without re-running the full Whisper pipeline."""
    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    raw = await contributorPhoto.read()
    try:
        new_filename = save_contributor_photo(raw, clip_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    old_filename = doc.get("contributorPhotoFilename")
    if old_filename and old_filename != new_filename:
        delete_contributor_photo(old_filename)

    await db.clips.update_one(
        {"id": clip_id},
        {
            "$set": {
                "contributorPhotoFilename": new_filename,
                "updatedAt": datetime.now(timezone.utc),
            }
        },
    )
    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    assert doc is not None
    return _to_admin_response(doc)


@router.delete("/{clip_id}/photo", response_model=ClipAdminResponse)
async def remove_clip_photo(
    clip_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: Any = Depends(require_admin),
) -> ClipAdminResponse:
    """Remove the contributor photo. Clip falls back to a text-only card
    on the veteran side."""
    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")
    filename = doc.get("contributorPhotoFilename")
    if filename:
        delete_contributor_photo(filename)
    await db.clips.update_one(
        {"id": clip_id},
        {
            "$set": {
                "contributorPhotoFilename": None,
                "updatedAt": datetime.now(timezone.utc),
            }
        },
    )
    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    assert doc is not None
    return _to_admin_response(doc)


@router.delete("/{clip_id}", status_code=204)
async def delete_clip(
    clip_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: Any = Depends(require_admin),
) -> None:
    """Hard-delete a clip row AND remove its mp3/mp4 + photo from disk.

    Most admin workflows should prefer `POST .../archive` (reversible).
    This endpoint is for legal removals (e.g. consent withdrawn).
    """
    doc = await db.clips.find_one({"id": clip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clip not found")

    filename = doc.get("audioFilename")
    if filename:
        delete_clip_file(filename)
    photo_filename = doc.get("contributorPhotoFilename")
    if photo_filename:
        delete_contributor_photo(photo_filename)

    # Also delete dependent play/save records so analytics don't carry a
    # ghost reference.
    await db.clip_plays.delete_many({"clipId": clip_id})
    await db.clip_saves.delete_many({"clipId": clip_id})
    await db.clips.delete_one({"id": clip_id})

    logger.info(f"[voices_admin] hard-deleted clip {clip_id}")
