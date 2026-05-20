"""
Veteran Voices — public clip read endpoints (PR #A).

Scope of THIS file (PR #A only):
  - GET /api/clips/random      — sensitivity-aware weighted random pick
  - GET /api/clips/:id         — single clip metadata (public payload)
  - GET /api/clips/audio/:id   — streams the audio file from disk

Out of scope here (later PRs):
  - POST /api/clips/:id/play   (PR #C)
  - POST /api/clips/:id/save   (PR #C)
  - GET  /api/clips?category=  (PR #C)
  - POST /api/admin/clips      (PR #B)

SAFETY WALL
===========
This router does not import from `safety/`, `encryption`, or any of the
safeguarding / live-chat / WebRTC modules. It owns only the `clips`,
`clip_plays`, and `clip_saves` collections.

STORAGE
=======
Audio files live on a Render persistent disk mounted at /var/data.
The path is configurable via the `AUDIO_STORAGE_PATH` env var (default
`/var/data/clips`). The directory is created at module import time so a
fresh disk works out of the box.
"""
from __future__ import annotations

import logging
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.clips import (
    CaptionSegment,
    ClipPublicResponse,
    ClipStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Storage path setup
# ---------------------------------------------------------------------------

AUDIO_STORAGE_PATH = os.environ.get("AUDIO_STORAGE_PATH", "/var/data/clips")

try:
    os.makedirs(AUDIO_STORAGE_PATH, exist_ok=True)
    logger.info(f"[voices] AUDIO_STORAGE_PATH ready: {AUDIO_STORAGE_PATH}")
except OSError as e:
    # Don't crash the whole app on import — log loudly and let endpoint-time
    # errors surface to the admin uploader. Read endpoints will still work
    # for clips whose audioFilename happens to exist.
    logger.error(f"[voices] Could not create AUDIO_STORAGE_PATH={AUDIO_STORAGE_PATH}: {e}")


# ---------------------------------------------------------------------------
# DB dependency wiring (set by server.py via set_db, mirroring other routers)
# ---------------------------------------------------------------------------

_db: Optional[AsyncIOMotorDatabase] = None


def set_db(database: AsyncIOMotorDatabase) -> None:
    """Called by server.py at startup to inject the motor db handle."""
    global _db
    _db = database


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise HTTPException(status_code=500, detail="voices router db not initialised")
    return _db


# ---------------------------------------------------------------------------
# Selection state — last-served-per-user (in-memory; survives within process)
# ---------------------------------------------------------------------------

# Tracks the most-recently-returned clipId per userId so that two consecutive
# /random calls from the same user are guaranteed to return different clips.
# In-memory is fine — worst case after a process restart the user might see
# the same clip twice in a row, which is acceptable. No DB write hot-path.
_last_random_by_user: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_public(doc: dict, request: Request) -> ClipPublicResponse:
    """Convert a DB doc into the veteran-facing payload.

    Strips: transcript, adminNotes, uploadedByAdminId, audioFilename, _id.
    Adds: audioUrl pointing at our streaming endpoint.
    """
    base_url = str(request.base_url).rstrip("/")
    captions = [
        CaptionSegment(**c) if not isinstance(c, CaptionSegment) else c
        for c in (doc.get("captions") or [])
    ]
    return ClipPublicResponse(
        id=doc["id"],
        contributorName=doc.get("contributorName", ""),
        contributorBio=doc.get("contributorBio", ""),
        contributorPhotoUrl=doc.get("contributorPhotoUrl"),
        audioUrl=f"{base_url}/api/clips/audio/{doc['id']}",
        durationSeconds=int(doc.get("durationSeconds", 0)),
        captions=captions,
        categories=list(doc.get("categories") or []),
        sensitivityFlags=list(doc.get("sensitivityFlags") or ["none"]),
        recordingDate=doc.get("recordingDate"),
    )


async def _select_random_clip(
    db: AsyncIOMotorDatabase,
    user_id: str,
    include_sensitive: bool,
) -> Optional[dict]:
    """Random selection per spec.

    Steps:
      1. Pool = status=published clips.
      2. If not include_sensitive, exclude clips with any sensitivityFlag
         other than 'none'.
      3. Build exclusion set: clips this user played in the last 7 days,
         plus the user's last-served clip (so two consecutive calls
         differ).
      4. Prefer clips the user has NEVER played (weight = 1.0); fall back
         to least-recently-played from the 7-day-excluded list if every
         remaining clip was already heard. (Implemented as: if the
         unheard pool is empty after the exclusions, drop the 7-day
         exclusion and pick the least-recently-played that the user
         has played.)
      5. Random pick from the chosen weighted pool.
    """
    # --- 1. base filter
    query: dict = {"status": ClipStatus.published.value}
    pool = await db.clips.find(query, {"_id": 0}).to_list(length=None)

    # --- 2. sensitivity filter
    if not include_sensitive:
        pool = [
            c for c in pool
            if not [f for f in (c.get("sensitivityFlags") or []) if f and f != "none"]
        ]

    if not pool:
        return None

    # --- 3. recent plays + last-served exclusions
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    recent_play_clip_ids = await db.clip_plays.distinct(
        "clipId",
        {"userId": user_id, "playedAt": {"$gte": cutoff}},
    )
    recent_set = set(recent_play_clip_ids or [])
    last_served = _last_random_by_user.get(user_id)
    if last_served:
        recent_set.add(last_served)

    # --- 4. prefer unheard
    all_user_played = await db.clip_plays.distinct("clipId", {"userId": user_id})
    heard_set = set(all_user_played or [])

    unheard_unexcluded = [
        c for c in pool
        if c["id"] not in recent_set and c["id"] not in heard_set
    ]
    if unheard_unexcluded:
        return random.choice(unheard_unexcluded)

    heard_unexcluded = [c for c in pool if c["id"] not in recent_set]
    if heard_unexcluded:
        # Least-recently-played first.
        ids = [c["id"] for c in heard_unexcluded]
        play_docs = await db.clip_plays.find(
            {"userId": user_id, "clipId": {"$in": ids}},
            {"_id": 0, "clipId": 1, "playedAt": 1},
        ).to_list(length=None)
        last_play_by_clip = {}
        for p in play_docs:
            cid = p["clipId"]
            t = p["playedAt"]
            if cid not in last_play_by_clip or t > last_play_by_clip[cid]:
                last_play_by_clip[cid] = t
        heard_unexcluded.sort(
            key=lambda c: last_play_by_clip.get(c["id"], datetime.min.replace(tzinfo=timezone.utc))
        )
        return heard_unexcluded[0]

    # --- 5. ultimate fallback: drop ALL exclusions, pure random over pool.
    return random.choice(pool)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/clips/random", response_model=ClipPublicResponse)
async def get_random_clip(
    request: Request,
    user_id: str = Query(..., description="Authenticated veteran's user_id"),
    include_sensitive: bool = Query(
        False,
        description="If true, sensitivity-flagged clips are eligible for random selection. Default false.",
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ClipPublicResponse:
    """Return one published clip per the selection logic in `_select_random_clip`.

    Authentication: this PR-A endpoint takes user_id as a query param so the
    skeleton works for an unauthenticated demo. PR #C tightens this to read
    user_id from the JWT (see `get_current_user`) — out of scope here to
    keep PR #A small and reviewable.
    """
    clip = await _select_random_clip(db, user_id=user_id, include_sensitive=include_sensitive)
    if clip is None:
        raise HTTPException(status_code=404, detail="No published clips available")
    # Record last-served so the next call returns a different clip.
    _last_random_by_user[user_id] = clip["id"]
    return _to_public(clip, request)


@router.get("/clips/{clip_id}", response_model=ClipPublicResponse)
async def get_clip_by_id(
    clip_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ClipPublicResponse:
    """Single-clip metadata. Only `published` clips are returned to veterans.

    Archived / draft clips return 404 even if the caller knows the id.
    """
    clip = await db.clips.find_one(
        {"id": clip_id, "status": ClipStatus.published.value},
        {"_id": 0},
    )
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    return _to_public(clip, request)


@router.get("/clips/audio/{clip_id}")
async def stream_clip_audio(
    clip_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Stream the audio file from disk.

    The raw on-disk path is never exposed in any response; only the routed
    URL (`/api/clips/audio/<clip_id>`) is. Files outside AUDIO_STORAGE_PATH
    cannot be reached even with a crafted clip_id — we resolve via the DB
    record's audioFilename (which the admin upload PR will sanitize).
    """
    clip = await db.clips.find_one(
        {"id": clip_id, "status": ClipStatus.published.value},
        {"_id": 0, "audioFilename": 1},
    )
    if not clip or not clip.get("audioFilename"):
        raise HTTPException(status_code=404, detail="Clip audio not found")

    filename = clip["audioFilename"]
    # Defensive: refuse any path-traversal attempt even if it slipped past
    # the upload sanitiser. AUDIO_STORAGE_PATH is the only allowed root.
    safe_root = Path(AUDIO_STORAGE_PATH).resolve()
    candidate = (safe_root / filename).resolve()
    try:
        candidate.relative_to(safe_root)
    except ValueError:
        logger.warning(f"[voices] Path-traversal attempt blocked for clip {clip_id}")
        raise HTTPException(status_code=404, detail="Clip audio not found")

    if not candidate.is_file():
        logger.warning(f"[voices] Audio file missing on disk: {candidate}")
        raise HTTPException(status_code=404, detail="Clip audio not found")

    # FileResponse handles Range requests for seekable players out of the box.
    media_type = "audio/mpeg"
    suffix = candidate.suffix.lower()
    if suffix in (".m4a", ".mp4"):
        media_type = "audio/mp4"
    elif suffix == ".wav":
        media_type = "audio/wav"
    return FileResponse(str(candidate), media_type=media_type)
