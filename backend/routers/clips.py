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
    """Called by server.py at startup to inject the motor db handle.

    Also opportunistically creates the analytics index on `clip_plays.source`
    so future admin queries filtering by source ('app' vs 'public_c') stay
    cheap. Idempotent — Mongo's createIndex is a no-op if the index already
    exists. Fire-and-forget; index creation must never block startup.
    """
    global _db
    _db = database

    async def _ensure_source_index() -> None:
        try:
            await database.clip_plays.create_index("source")
        except Exception:
            logger.warning(
                "[voices] clip_plays.source index creation failed", exc_info=True
            )

    try:
        import asyncio as _asyncio
        loop = _asyncio.get_event_loop()
        loop.create_task(_ensure_source_index())
    except Exception:
        logger.warning("[voices] could not schedule clip_plays.source index", exc_info=True)


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

    Strips: transcript, adminNotes, internalNotes, processingStatus,
    processingError, uploadedByAdminId, audioFilename, _id.
    Adds: audioUrl pointing at our streaming endpoint, mediaType,
    contributorPhotoUrl resolution (on-disk file beats external URL).
    """
    base_url = str(request.base_url).rstrip("/")
    captions = [
        CaptionSegment(**c) if not isinstance(c, CaptionSegment) else c
        for c in (doc.get("captions") or [])
    ]
    # Photo URL resolution order: uploaded file > external URL > none.
    photo_filename = doc.get("contributorPhotoFilename")
    if photo_filename:
        photo_url: Optional[str] = f"{base_url}/api/clips/photo/{doc['id']}"
    else:
        photo_url = doc.get("contributorPhotoUrl")
    media_type_raw = doc.get("mediaType") or "audio"
    return ClipPublicResponse(
        id=doc["id"],
        contributorName=doc.get("contributorName", ""),
        contributorBio=doc.get("contributorBio", ""),
        contributorPhotoUrl=photo_url,
        audioUrl=f"{base_url}/api/clips/audio/{doc['id']}",
        mediaType=media_type_raw,
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
    extra_exclude_ids: Optional[list[str]] = None,
) -> Optional[dict]:
    """Random selection per spec.

    Steps:
      1. Pool = status=published clips.
      2. If not include_sensitive, exclude clips with any sensitivityFlag
         other than 'none'.
      3. Build exclusion set: clips this user played in the last 7 days,
         plus the user's last-served clip (so two consecutive calls
         differ), plus any `extra_exclude_ids` (used by the /c public
         route to honour the client's recent-5 cookie).
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

    # --- 3. recent plays + last-served + caller-supplied exclusions
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    recent_play_clip_ids = await db.clip_plays.distinct(
        "clipId",
        {"userId": user_id, "playedAt": {"$gte": cutoff}},
    )
    recent_set = set(recent_play_clip_ids or [])
    last_served = _last_random_by_user.get(user_id)
    if last_served:
        recent_set.add(last_served)
    if extra_exclude_ids:
        recent_set.update(extra_exclude_ids)

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
    exclude: Optional[str] = Query(
        None,
        description="Comma-separated list of clip IDs to exclude from this selection (caller-supplied recent ring).",
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ClipPublicResponse:
    """Return one published clip per the selection logic in `_select_random_clip`.

    Authentication: this PR-A endpoint takes user_id as a query param so the
    skeleton works for an unauthenticated demo. PR #C tightens this to read
    user_id from the JWT (see `get_current_user`) — out of scope here to
    keep PR #A small and reviewable.
    """
    extra_exclude = [s.strip() for s in (exclude or "").split(",") if s.strip()] or None
    clip = await _select_random_clip(
        db,
        user_id=user_id,
        include_sensitive=include_sensitive,
        extra_exclude_ids=extra_exclude,
    )
    if clip is None:
        raise HTTPException(status_code=404, detail="No published clips available")
    # Record last-served so the next call returns a different clip.
    _last_random_by_user[user_id] = clip["id"]
    return _to_public(clip, request)


@router.get("/clips/random-public", response_model=ClipPublicResponse)
async def get_random_clip_public(
    request: Request,
    anon_id: str = Query(
        ...,
        min_length=8,
        max_length=64,
        description="Anonymous device UUID (v4) generated client-side and persisted in the radiocheck_recent_c cookie.",
    ),
    exclude: Optional[str] = Query(
        None,
        description="Comma-separated list of recently-served clip IDs (last 5 from the device cookie).",
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ClipPublicResponse:
    """Public no-auth endpoint used by the /c NFC/QR route.

    SAFETY GUARANTEES (non-negotiable, by design):
      • `include_sensitive` is hard-coded to False — sensitive clips are
        NEVER served via this endpoint, regardless of what the client
        sends. The default audience for a wristband tap is "stranger in
        distress" and they must never receive high-sensitivity content
        cold.
      • Only `status=published` clips are eligible — already enforced
        upstream by `_select_random_clip` step 1.

    The anonymous device ID is namespaced with the `anon:` prefix on the
    `clip_plays.userId` field so admin queries can filter / segment
    public-route activity without colliding with real user IDs.
    """
    extra_exclude = [s.strip() for s in (exclude or "").split(",") if s.strip()] or None
    namespaced_user_id = f"anon:{anon_id}"
    clip = await _select_random_clip(
        db,
        user_id=namespaced_user_id,
        include_sensitive=False,   # SAFETY WALL — never serve sensitive via /c
        extra_exclude_ids=extra_exclude,
    )
    if clip is None:
        raise HTTPException(status_code=404, detail="No published clips available")
    _last_random_by_user[namespaced_user_id] = clip["id"]
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
    suffix = candidate.suffix.lower()
    if suffix == ".mp4":
        media_type = "video/mp4"
    elif suffix in (".m4a",):
        media_type = "audio/mp4"
    elif suffix == ".wav":
        media_type = "audio/wav"
    elif suffix == ".webm":
        media_type = "video/webm"
    else:
        media_type = "audio/mpeg"
    return FileResponse(str(candidate), media_type=media_type)


# ---------------------------------------------------------------------------
# Contributor photo serving (PR #C — replaces external URL field)
# ---------------------------------------------------------------------------

@router.get("/clips/photo/{clip_id}")
async def stream_clip_photo(
    clip_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Serve the contributor photo for a published clip.

    Same path-traversal defence as the audio endpoint — the resolved
    file must sit inside `<AUDIO_STORAGE_PATH>/photos/`. Returns 404
    for any clip without a photo on disk so the client can fall back
    to the text-only card.
    """
    clip = await db.clips.find_one(
        {"id": clip_id, "status": ClipStatus.published.value},
        {"_id": 0, "contributorPhotoFilename": 1},
    )
    if not clip or not clip.get("contributorPhotoFilename"):
        raise HTTPException(status_code=404, detail="Photo not found")

    filename = clip["contributorPhotoFilename"]
    safe_root = Path(os.path.join(AUDIO_STORAGE_PATH, "photos")).resolve()
    candidate = (safe_root / filename).resolve()
    try:
        candidate.relative_to(safe_root)
    except ValueError:
        logger.warning(f"[voices] Path-traversal blocked for photo {clip_id}")
        raise HTTPException(status_code=404, detail="Photo not found")
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="Photo not found")

    suffix = candidate.suffix.lower()
    media_type = "image/png" if suffix == ".png" else "image/jpeg"
    return FileResponse(str(candidate), media_type=media_type)


# ---------------------------------------------------------------------------
# Browse / library endpoints (PR #C)
# ---------------------------------------------------------------------------

def _filter_pool(
    docs: list[dict],
    *,
    category: Optional[str] = None,
    sensitivity_filter_off: bool = True,
    search: Optional[str] = None,
) -> list[dict]:
    """Apply category / sensitivity / text-search filters in-memory.

    `sensitivity_filter_off=True` (the default) means we EXCLUDE clips
    that have any sensitivityFlag other than 'none'. This matches the
    UX brief: the sensitivity filter excludes heaviest by default;
    the toggle lets a user opt in to see everything.

    Search matches case-insensitively across `contributorName` and the
    flattened `transcript` (admin transcript is internal, but matching
    against it is fine since we never return the raw transcript here).
    """
    out = docs
    if sensitivity_filter_off:
        out = [
            d for d in out
            if not [
                f for f in (d.get("sensitivityFlags") or [])
                if f and f != "none"
            ]
        ]
    if category:
        out = [d for d in out if category in (d.get("categories") or [])]
    if search:
        needle = search.strip().lower()
        if needle:
            out = [
                d for d in out
                if needle in (d.get("contributorName", "").lower())
                or needle in (d.get("transcript", "").lower())
            ]
    return out


@router.get("/clips", response_model=list[ClipPublicResponse])
async def browse_clips(
    request: Request,
    category: Optional[str] = Query(None, description="Filter to one ClipCategory."),
    search: Optional[str] = Query(None, description="Case-insensitive match on contributor name / transcript."),
    include_sensitive: bool = Query(
        False,
        description="If true, include clips with sensitivity flags other than 'none'.",
    ),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ClipPublicResponse]:
    """Library browse. Returns ONLY published clips. Newest first."""
    pool = await db.clips.find(
        {"status": ClipStatus.published.value}, {"_id": 0}
    ).sort("createdAt", -1).to_list(length=None)
    filtered = _filter_pool(
        pool,
        category=category,
        sensitivity_filter_off=not include_sensitive,
        search=search,
    )
    return [_to_public(c, request) for c in filtered[:limit]]


@router.get("/clips/categories", response_model=list[dict])
async def list_clip_categories(
    include_sensitive: bool = Query(False),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[dict]:
    """Return [{category, count}] across all published clips, respecting
    the sensitivity filter. Drives the Categories tab in the library."""
    pool = await db.clips.find(
        {"status": ClipStatus.published.value},
        {"_id": 0, "categories": 1, "sensitivityFlags": 1},
    ).to_list(length=None)
    pool = _filter_pool(pool, sensitivity_filter_off=not include_sensitive)
    counts: dict[str, int] = {}
    for d in pool:
        for cat in d.get("categories") or []:
            counts[cat] = counts.get(cat, 0) + 1
    return [{"category": k, "count": v} for k, v in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]


# ---------------------------------------------------------------------------
# Save / favourite (PR #C)
# ---------------------------------------------------------------------------

@router.post("/clips/{clip_id}/save", status_code=204)
async def save_clip(
    clip_id: str,
    user_id: str = Query(..., description="Veteran's local user_id."),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> None:
    """Idempotent: saving an already-saved clip is a no-op."""
    clip = await db.clips.find_one(
        {"id": clip_id, "status": ClipStatus.published.value}, {"_id": 0, "id": 1}
    )
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    await db.clip_saves.update_one(
        {"clipId": clip_id, "userId": user_id},
        {
            "$setOnInsert": {
                "clipId": clip_id,
                "userId": user_id,
                "savedAt": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )


@router.delete("/clips/{clip_id}/save", status_code=204)
async def unsave_clip(
    clip_id: str,
    user_id: str = Query(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> None:
    """Idempotent: unsaving a non-saved clip is a no-op."""
    await db.clip_saves.delete_one({"clipId": clip_id, "userId": user_id})


@router.get("/clips/saved", response_model=list[ClipPublicResponse])
async def list_saved_clips(
    request: Request,
    user_id: str = Query(...),
    include_sensitive: bool = Query(True, description="Saved clips show even sensitive ones by default — the user explicitly opted in by saving."),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ClipPublicResponse]:
    """Saved clips, newest-saved first. Filters out clips whose status
    is no longer 'published' (admins may have archived since save)."""
    saves = await db.clip_saves.find(
        {"userId": user_id}, {"_id": 0, "clipId": 1, "savedAt": 1}
    ).sort("savedAt", -1).to_list(length=None)
    if not saves:
        return []
    clip_ids = [s["clipId"] for s in saves]
    pool = await db.clips.find(
        {"id": {"$in": clip_ids}, "status": ClipStatus.published.value},
        {"_id": 0},
    ).to_list(length=None)
    if not include_sensitive:
        pool = _filter_pool(pool, sensitivity_filter_off=True)
    # Preserve save order.
    by_id = {c["id"]: c for c in pool}
    ordered = [by_id[s["clipId"]] for s in saves if s["clipId"] in by_id]
    return [_to_public(c, request) for c in ordered]


# ---------------------------------------------------------------------------
# Play tracking (PR #C — wired up from the player on every successful start)
# ---------------------------------------------------------------------------

@router.post("/clips/{clip_id}/play", status_code=204)
async def record_clip_play(
    clip_id: str,
    user_id: str = Query(..., description="Veteran's local user_id."),
    completion: Optional[float] = Query(
        None, ge=0.0, le=1.0, description="0.0-1.0; how much of the clip was heard."
    ),
    seconds_played: Optional[float] = Query(
        None, ge=0.0,
        description="Exact playback position in seconds at the moment "
                    "of recording (close, natural end, etc.). Optional; "
                    "back-compat with legacy callers that only pass completion.",
    ),
    total_duration: Optional[float] = Query(
        None, ge=0.0,
        description="The clip's total duration in seconds, as known by "
                    "the client at record time. Stored alongside "
                    "secondsPlayed for analytics aggregation.",
    ),
    source: Optional[str] = Query(
        "app",
        description="How the play was triggered. 'app' (in-app veteran, default) or 'public_c' (anonymous /c NFC/QR route).",
        pattern="^(app|public_c)$",
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> None:
    """Insert a play event. We INSERT a new row per play (rather than
    bumping a counter) so the random-selection logic can compute
    last-played-by-clip without an extra collection.

    The `source` field is indexed (see set_db) so future admin analytics
    can segment in-app plays vs public-route plays without a full scan.

    `secondsPlayed` + `totalDuration` are optional, persisted when
    provided. They unblock admin analytics that want to know exact close-
    time position rather than only the (sometimes-rounded) completion
    fraction.
    """
    clip = await db.clips.find_one(
        {"id": clip_id, "status": ClipStatus.published.value}, {"_id": 0, "id": 1}
    )
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    row: dict = {
        "clipId": clip_id,
        "userId": user_id,
        "playedAt": datetime.now(timezone.utc),
        "completion": float(completion) if completion is not None else None,
        "source": source or "app",
    }
    if seconds_played is not None:
        row["secondsPlayed"] = float(seconds_played)
    if total_duration is not None:
        row["totalDuration"] = float(total_duration)
    await db.clip_plays.insert_one(row)


@router.post("/clips/{clip_id}/skip", status_code=204)
async def record_clip_skip(
    clip_id: str,
    user_id: str = Query(..., description="Veteran's local user_id (or anon:<uuid>)."),
    seconds_played: float = Query(
        ..., ge=0.0,
        description="Playback position when the user skipped to next.",
    ),
    total_duration: float = Query(
        ..., ge=0.0,
        description="The clip's total duration in seconds at skip time.",
    ),
    source: Optional[str] = Query(
        "app",
        description="How the play was triggered. 'app' or 'public_c'.",
        pattern="^(app|public_c)$",
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> None:
    """Insert a SKIP event — a play row tagged `skipped=True`, with the
    closing position captured.

    Derived `completion` is `seconds_played / total_duration`, clamped
    to [0, 1]. Zero-duration safely yields `None` (no NaN), so
    aggregation `$avg` queries downstream don't poison their results.

    Analytics consumers should filter `skipped=True` to get the skip
    rate per clip, or aggregate `completion` across both skipped and
    non-skipped rows for average completion %.
    """
    clip = await db.clips.find_one(
        {"id": clip_id, "status": ClipStatus.published.value}, {"_id": 0, "id": 1}
    )
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    completion: Optional[float]
    if total_duration > 0:
        completion = max(0.0, min(1.0, seconds_played / total_duration))
    else:
        completion = None

    await db.clip_plays.insert_one(
        {
            "clipId": clip_id,
            "userId": user_id,
            "playedAt": datetime.now(timezone.utc),
            "completion": completion,
            "secondsPlayed": float(seconds_played),
            "totalDuration": float(total_duration),
            "skipped": True,
            "source": source or "app",
        }
    )


@router.get("/clips/recent", response_model=list[ClipPublicResponse])
async def list_recently_played_clips(
    request: Request,
    user_id: str = Query(...),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ClipPublicResponse]:
    """Most-recently-played clips for this user, deduped, newest first.
    Drives the 'Recently played' tab in the library.

    Filters out clips no longer in `status=published`."""
    plays = await db.clip_plays.find(
        {"userId": user_id}, {"_id": 0, "clipId": 1, "playedAt": 1}
    ).sort("playedAt", -1).to_list(length=None)
    if not plays:
        return []
    seen: set[str] = set()
    ordered_ids: list[str] = []
    for p in plays:
        cid = p["clipId"]
        if cid in seen:
            continue
        seen.add(cid)
        ordered_ids.append(cid)
        if len(ordered_ids) >= limit:
            break
    if not ordered_ids:
        return []
    pool = await db.clips.find(
        {"id": {"$in": ordered_ids}, "status": ClipStatus.published.value},
        {"_id": 0},
    ).to_list(length=None)
    by_id = {c["id"]: c for c in pool}
    return [_to_public(by_id[cid], request) for cid in ordered_ids if cid in by_id]


# ---------------------------------------------------------------------------
# Catch-all: single clip by id (registered LAST so literal-segment routes
# like /clips/saved, /clips/categories, /clips/recent, /clips/photo/{id}
# are matched first).
# ---------------------------------------------------------------------------

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
