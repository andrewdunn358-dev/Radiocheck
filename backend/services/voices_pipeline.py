"""
Veteran Voices — ingest pipeline (PR #B1).

Owns the chain that turns an admin's raw upload into a playable, captioned
clip stored on the Render persistent disk:

    raw upload  →  ffmpeg transcode/normalize  →  Whisper transcription
                                              →  caption segments
                                              →  duration probe
                                              →  saved file at AUDIO_STORAGE_PATH

DESIGN NOTES
============
- Pure helpers + one orchestrator (`process_upload`) — no DB access here.
  The admin router owns DB writes; this module is unit-testable on disk.
- `imageio-ffmpeg` ships a static ffmpeg binary on pip install so we don't
  depend on the Render base image having `apt-get install ffmpeg`.
- Whisper call wrapped in `asyncio.wait_for(...)` (per design Q6) so an
  upstream hang cannot stall an admin upload indefinitely. Failed clips
  are surfaced via `processingStatus=failed` + `processingError` in the
  caller.
- The orchestrator NEVER raises into the request handler: it returns a
  `PipelineResult` dataclass and the router decides DB shape. Any internal
  exception is captured as `error` on the result so the admin UI can show
  it without 500ing.

SAFETY WALL
===========
No imports from safety/, encryption, webrtc_signaling, or any safeguarding
module. This pipeline runs on contributor consent-confirmed audio only.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import subprocess
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

import imageio_ffmpeg
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tunables (env-overridable so prod / tests can differ without code changes)
# ---------------------------------------------------------------------------

AUDIO_STORAGE_PATH = os.environ.get("AUDIO_STORAGE_PATH", "/var/data/clips")

# Max raw upload accepted by the admin uploader (bytes). Audio: 100 MB
# (was 50 MB in PR #B1 — bumped per PR #C brief). Video: 500 MB. Both
# tunable via env. The router picks the right limit based on detected
# media type.
MAX_UPLOAD_BYTES_AUDIO = int(
    os.environ.get("VOICES_MAX_UPLOAD_BYTES_AUDIO", str(100 * 1024 * 1024))
)
MAX_UPLOAD_BYTES_VIDEO = int(
    os.environ.get("VOICES_MAX_UPLOAD_BYTES_VIDEO", str(500 * 1024 * 1024))
)
# Back-compat: tests / older callers that imported the legacy name.
# Resolves to the audio cap.
MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES_AUDIO

# Photos: 5 MB cap, PNG/JPG only. Stored under <storage>/photos/.
MAX_PHOTO_BYTES = int(os.environ.get("VOICES_MAX_PHOTO_BYTES", str(5 * 1024 * 1024)))
PHOTOS_SUBDIR = "photos"

# Whisper end-to-end deadline. 300s comfortably covers a ~5 min clip even on
# a cold worker; anything longer indicates a stuck request that we don't
# want blocking the FastAPI thread (Q6: asyncio.wait_for watchdog).
WHISPER_TIMEOUT_SECONDS = int(os.environ.get("VOICES_WHISPER_TIMEOUT_S", "300"))

# Whisper API hard-rejects files >25 MB with HTTP 413. We cap a touch
# lower (24 MB) so a borderline 96 kbps audio extract doesn't trip the
# upstream limit due to container overhead. At 96 kbps mono this still
# fits ~33 minutes of audio, which covers every realistic Voices clip.
# When this cap trips we surface a clean user-facing error instead of
# letting Whisper return a cryptic 413.
WHISPER_MAX_BYTES = int(
    os.environ.get("VOICES_WHISPER_MAX_BYTES", str(24 * 1024 * 1024))
)

# Target output: 96 kbps mono mp3 — small disk footprint, universally
# playable on mobile browsers and the Expo audio element. mono is the
# right choice for spoken-word veteran clips.
FFMPEG_TARGET_BITRATE = "96k"
FFMPEG_TARGET_CODEC = "libmp3lame"
FFMPEG_TARGET_CHANNELS = "1"  # mono
FFMPEG_TARGET_SAMPLE_RATE = "44100"

# Whisper model name. `whisper-1` is the only currently exposed
# OpenAI hosted Whisper endpoint and is what the project's existing
# OpenAI usage tracker (`ai_usage_tracker.py`) is configured for.
WHISPER_MODEL = "whisper-1"


# Lazy singleton — building AsyncOpenAI at import time would crash any unit
# test that doesn't set OPENAI_API_KEY. We construct on first use instead.
_openai_client: Optional[AsyncOpenAI] = None


def _get_openai_client() -> AsyncOpenAI:
    """Return a shared AsyncOpenAI client. Raises if the key is missing."""
    global _openai_client
    if _openai_client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set — cannot run the Voices "
                "transcription pipeline. Set it in Render env vars."
            )
        _openai_client = AsyncOpenAI(api_key=api_key)
    return _openai_client


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class PipelineResult:
    """Outcome of `process_upload`. The router uses these fields directly
    to fill the Clip DB document.

    `ok=False` means the router should set `processingStatus="failed"` and
    write `processingError` to the clip row. No partial files are left
    behind (cleanup is best-effort but attempted).

    `media_type` is set from the magic-byte sniff at ingest time so the
    router and the public response can branch player UI accordingly.
    """
    ok: bool
    media_type: str = "audio"  # 'audio' | 'video'
    audio_filename: Optional[str] = None  # filename only, lives inside AUDIO_STORAGE_PATH
    duration_seconds: int = 0
    transcript: str = ""
    captions: List[dict] = field(default_factory=list)  # [{start, end, text}]
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Filename sanitisation — defence-in-depth against path traversal
# ---------------------------------------------------------------------------

_SAFE_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9_.-]+")


def sanitize_filename(name: str) -> str:
    """Produce a server-controlled filename. We don't trust client names —
    they get sliced to alphanumerics + dash/dot/underscore, lowercased,
    and capped at 64 chars. The streaming endpoint also resolves the path
    inside AUDIO_STORAGE_PATH as a second line of defence.
    """
    base = name.strip().lower()
    base = _SAFE_FILENAME_CHARS.sub("_", base)
    base = base.strip("_.") or "clip"
    return base[:64]


# ---------------------------------------------------------------------------
# ffmpeg helpers
# ---------------------------------------------------------------------------

def _ffmpeg_binary() -> str:
    """Path to the bundled static ffmpeg binary (imageio-ffmpeg)."""
    return imageio_ffmpeg.get_ffmpeg_exe()


def _run_ffmpeg(args: List[str], timeout: int = 120) -> subprocess.CompletedProcess:
    """Run ffmpeg in a blocking subprocess. Caller wraps in
    `asyncio.to_thread` if invoked from async context.

    `check=False` so we can surface ffmpeg's stderr on the result instead
    of crashing the request.
    """
    cmd = [_ffmpeg_binary(), "-y", *args]
    logger.debug(f"[voices_pipeline] ffmpeg cmd: {' '.join(cmd)}")
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def _probe_duration_seconds(path: str) -> int:
    """Best-effort duration probe via ffmpeg stderr parsing.

    We deliberately don't depend on ffprobe (imageio-ffmpeg only ships
    ffmpeg, not ffprobe). Parsing the `Duration: HH:MM:SS.ms` line from
    ffmpeg's stderr is robust enough for our use case — admin can edit
    the duration in the UI if it ever mis-parses.
    """
    proc = subprocess.run(
        [_ffmpeg_binary(), "-i", path],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    stderr = proc.stderr or ""
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", stderr)
    if not m:
        return 0
    hours = int(m.group(1))
    minutes = int(m.group(2))
    seconds = float(m.group(3))
    return int(hours * 3600 + minutes * 60 + seconds)


def transcode_to_mp3(input_path: str, output_path: str) -> None:
    """Re-encode to mono 96kbps mp3. Raises on ffmpeg failure.

    Why re-encode every upload (even if it's already mp3)? Three reasons:
      1. Strip metadata (some uploads carry contributor PII in ID3 tags).
      2. Normalise sample rate / channels so the mobile player behaves
         consistently across browsers.
      3. Guarantee disk usage is predictable (96kbps mono = ~720KB / min).

    Audio fix (May 2026): added a `loudnorm` filter applying EBU R128
    broadcast normalisation (target -16 LUFS, true peak ceiling -1.5
    dBTP). Why:
      - Some OGG Opus voice uploads were arriving with peaks above 0
        dBFS (e.g. +4 dBFS measured on a real contribution). When the
        Opus decoder outputs float samples > 1.0 and ffmpeg converts
        to int16 for MP3 encoding, the over-range samples wrap around
        (e.g. +1.2 -> near minimum negative), producing audible
        clicks / pops scattered through playback. Loudnorm prevents
        this by bringing peaks into a defined headroom before the
        float->int16 step.
      - Loud and quiet uploads now sit at consistent perceived volume
        in the player — no more "I can barely hear this one, the next
        one's blowing my ears off" between clips.
      - -16 LUFS / -1.5 dBTP is the de-facto standard for podcast /
        voice content on Spotify, Apple Podcasts, BBC Sounds, etc.
    """
    proc = _run_ffmpeg([
        "-i", input_path,
        "-vn",  # discard any incidental video stream
        # EBU R128 loudness normalisation (single-pass). The filter
        # MUST run before the bitrate / encoding stage so the lame
        # encoder sees a properly-ranged float signal.
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-acodec", FFMPEG_TARGET_CODEC,
        "-ac", FFMPEG_TARGET_CHANNELS,
        "-ar", FFMPEG_TARGET_SAMPLE_RATE,
        "-b:a", FFMPEG_TARGET_BITRATE,
        "-map_metadata", "-1",  # strip ID3 tags / contributor PII
        output_path,
    ])
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg transcode failed (rc={proc.returncode}): "
            f"{(proc.stderr or '')[-500:]}"
        )


# ---------------------------------------------------------------------------
# Video transcode — MP4 H.264 + AAC, capped at 720p, ~1.5 Mbps
# ---------------------------------------------------------------------------

def transcode_to_mp4_720p(input_path: str, output_path: str) -> None:
    """Re-encode video to H.264 (libx264) + AAC, scaled down to 720p
    keeping aspect ratio. Same metadata-strip rationale as the audio
    path: kill any GPS / device / contributor PII in the source file
    before we put it on disk.

    Bitrate target ~1.5 Mbps suits a talking-head clip on mobile and
    keeps a 5-min file under ~60 MB. faststart moves the moov atom to
    the front so the mobile player can begin playback without
    downloading the whole file.
    """
    proc = _run_ffmpeg([
        "-i", input_path,
        # Scale to 720p max height while preserving aspect ratio; even
        # dimensions required by libx264.
        "-vf", "scale=-2:'min(720,ih)'",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-b:v", "1500k",
        "-maxrate", "1800k",
        "-bufsize", "3000k",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ac", "2",
        "-ar", "44100",
        "-map_metadata", "-1",  # strip GPS / device tags
        "-movflags", "+faststart",
        output_path,
    ], timeout=600)  # video can take longer; 10-min watchdog
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg video transcode failed (rc={proc.returncode}): "
            f"{(proc.stderr or '')[-500:]}"
        )


def extract_audio_for_whisper(input_path: str, output_path: str) -> None:
    """Strip an audio-only mono 96 kbps MP3 from a video file, purely
    for sending to Whisper. NOT for delivery — that's the MP4 produced
    by `transcode_to_mp4_720p`.

    This exists because Whisper's 25 MB upload cap fits ~3 minutes of
    H.264 video but ~33 minutes of 96 kbps mono audio. By transcribing
    against the audio-only extract we let admins upload long-form video
    clips (interviews, panel sessions) without hitting HTTP 413.

    `-vn` drops the video stream; `-map_metadata -1` keeps the same
    PII-stripping guarantee as the MP4 transcode.
    """
    proc = _run_ffmpeg([
        "-i", input_path,
        "-vn",
        "-acodec", FFMPEG_TARGET_CODEC,
        "-ac", FFMPEG_TARGET_CHANNELS,
        "-ar", FFMPEG_TARGET_SAMPLE_RATE,
        "-b:a", FFMPEG_TARGET_BITRATE,
        "-map_metadata", "-1",
        output_path,
    ], timeout=600)
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg audio-extract for Whisper failed (rc={proc.returncode}): "
            f"{(proc.stderr or '')[-500:]}"
        )


# ---------------------------------------------------------------------------
# Magic-byte media-type detection
# ---------------------------------------------------------------------------
# Extension is NOT trusted — admins occasionally rename files; client
# browsers occasionally lie about mime-types. We sniff the leading bytes
# of the upload to decide between audio / video. Whisper still runs on
# the result of transcode for both paths (it accepts mp4 as a container
# too).

# Each entry is (header_bytes, offset, kind). `kind` ∈ {"audio","video"}.
_MAGIC_SIGNATURES: tuple = (
    # MP4 / MOV / M4A all start "....ftyp...." at offset 4. We check
    # `ftyp` then sub-brand to split audio (M4A) vs video (MP4/MOV).
    (b"ftyp", 4, "ftyp"),
    # WAV (RIFF…WAVE)
    (b"RIFF", 0, "audio"),
    # MP3 frame header
    (b"ID3", 0, "audio"),
    (b"\xff\xfb", 0, "audio"),
    (b"\xff\xf3", 0, "audio"),
    (b"\xff\xf2", 0, "audio"),
    # OGG
    (b"OggS", 0, "audio"),
    # FLAC
    (b"fLaC", 0, "audio"),
    # AVI
    (b"AVI ", 8, "video"),
    # Matroska / WebM
    (b"\x1a\x45\xdf\xa3", 0, "video"),
)


def detect_media_type(raw_bytes: bytes, fallback_filename: str = "") -> Optional[str]:
    """Return 'audio' / 'video' from magic bytes, or None if unknown.

    `fallback_filename` is only consulted for the .m4a case where the
    container is mp4 but the content is audio-only — we use the
    extension as a tie-breaker since the ftyp sub-brand inspection is
    imperfect on weird encoders.
    """
    if not raw_bytes or len(raw_bytes) < 12:
        return None
    head = raw_bytes[:64]

    # ISO base media (mp4/mov/m4a/3gp) — read major brand at offset 8.
    if head[4:8] == b"ftyp":
        major = head[8:12]
        # Audio-only brands.
        if major in (b"M4A ", b"M4B ", b"mp42") and fallback_filename.lower().endswith(
            (".m4a", ".m4b")
        ):
            return "audio"
        # Everything else under ftyp is treated as video (mp4, mov, 3gp).
        return "video"

    for sig, offset, kind in _MAGIC_SIGNATURES:
        if kind == "ftyp":
            continue  # handled above
        if head[offset : offset + len(sig)] == sig:
            if kind == "audio" or kind == "video":
                return kind
    return None


# ---------------------------------------------------------------------------
# Contributor photo storage
# ---------------------------------------------------------------------------

_PHOTO_MAGIC: dict = {
    "png": b"\x89PNG\r\n\x1a\n",
    "jpg": b"\xff\xd8\xff",
}


def save_contributor_photo(
    raw_bytes: bytes, clip_id: str, storage_dir: Optional[str] = None
) -> str:
    """Persist a contributor photo to <storage>/photos/<clip_id>.<ext>.

    Returns the filename (NOT the full path). Caller stores this on the
    Clip row as `contributorPhotoFilename`; serving is via
    `/api/clips/photo/<clip_id>` (see routers/clips.py).

    Raises ValueError on size / format violations so the admin upload
    handler can surface a 400 to the UI.
    """
    storage_dir = storage_dir or AUDIO_STORAGE_PATH
    if not raw_bytes:
        raise ValueError("Empty photo upload.")
    if len(raw_bytes) > MAX_PHOTO_BYTES:
        raise ValueError(
            f"Photo too large: {len(raw_bytes)} bytes (max {MAX_PHOTO_BYTES})."
        )
    head = raw_bytes[:16]
    ext: Optional[str] = None
    for candidate_ext, magic in _PHOTO_MAGIC.items():
        if head.startswith(magic):
            ext = candidate_ext
            break
    if ext is None:
        raise ValueError("Photo must be PNG or JPG (other formats are rejected).")

    photos_dir = os.path.join(storage_dir, PHOTOS_SUBDIR)
    os.makedirs(photos_dir, exist_ok=True)
    safe_id = sanitize_filename(clip_id)
    if not safe_id:
        raise ValueError("Invalid clip_id for photo storage.")
    filename = f"{safe_id}.{ext}"
    path = os.path.join(photos_dir, filename)
    with open(path, "wb") as fh:
        fh.write(raw_bytes)
    return filename


def get_contributor_photo_path(
    filename: str, storage_dir: Optional[str] = None
) -> Optional[str]:
    """Resolve a photo filename to an absolute path inside the photos
    subdir, defending against path traversal. Returns None if the file
    doesn't exist or escapes the storage root."""
    storage_dir = storage_dir or AUDIO_STORAGE_PATH
    if not filename:
        return None
    safe_root = Path(os.path.join(storage_dir, PHOTOS_SUBDIR)).resolve()
    candidate = (safe_root / filename).resolve()
    try:
        candidate.relative_to(safe_root)
    except ValueError:
        return None
    return str(candidate) if candidate.is_file() else None


def delete_contributor_photo(
    filename: str, storage_dir: Optional[str] = None
) -> bool:
    """Best-effort photo cleanup. Returns True if a file was removed."""
    path = get_contributor_photo_path(filename, storage_dir=storage_dir)
    if not path:
        return False
    try:
        os.unlink(path)
        return True
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Whisper helper
# ---------------------------------------------------------------------------

async def transcribe_with_whisper(audio_path: str) -> tuple[str, List[dict]]:
    """Send `audio_path` to OpenAI Whisper, return (transcript, segments).

    `segments` is a list of {start, end, text} dicts — directly usable as
    `CaptionSegment` fodder.

    Wrapped in `asyncio.wait_for` (Q6 watchdog) so a network stall can't
    pin a request. On timeout we raise; the orchestrator turns this into
    a `PipelineResult(ok=False)`.
    """
    client = _get_openai_client()

    def _open_file():
        # Whisper SDK accepts a file-like; passing a path-tuple lets the
        # SDK infer the mime/extension for us. The file is closed by the
        # SDK after the upload completes.
        return open(audio_path, "rb")

    async def _call():
        with _open_file() as fh:
            return await client.audio.transcriptions.create(
                model=WHISPER_MODEL,
                file=fh,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

    result = await asyncio.wait_for(_call(), timeout=WHISPER_TIMEOUT_SECONDS)

    transcript = (getattr(result, "text", "") or "").strip()
    raw_segments = getattr(result, "segments", None) or []
    captions: List[dict] = []
    for seg in raw_segments:
        # SDK returns dicts in some versions, objects in others. Coerce.
        if isinstance(seg, dict):
            start = float(seg.get("start", 0.0))
            end = float(seg.get("end", 0.0))
            text = (seg.get("text") or "").strip()
        else:
            start = float(getattr(seg, "start", 0.0))
            end = float(getattr(seg, "end", 0.0))
            text = (getattr(seg, "text", "") or "").strip()
        if text:
            captions.append({"start": start, "end": end, "text": text})

    return transcript, captions


# ---------------------------------------------------------------------------
# Orchestrator — called by the admin router (POST /api/admin/clips)
# ---------------------------------------------------------------------------

async def process_upload(
    raw_bytes: bytes,
    original_filename: str,
    clip_id: str,
    storage_dir: Optional[str] = None,
    skip_transcription: bool = False,
) -> PipelineResult:
    """Run the full ingest pipeline on a raw uploaded audio or video payload.

    The transcoded file is ALWAYS saved as `<clip_id>.<ext>` (mp3 or mp4)
    inside `storage_dir`. The original filename is consulted only as a
    weak hint for the m4a-vs-mp4 disambiguation in the magic-byte sniff
    — it is NEVER used for the on-disk filename, so uploads with spaces,
    unicode, or no extension at all all work the same.

    Steps
    -----
      1. Reject empty uploads. We deliberately do NOT reject for filename
         weirdness — clip_id is a hex UUID, so the storage filename is
         always safe by construction.
      2. Sniff magic bytes to decide audio vs video.
      3. Reject oversized uploads against the right cap.
      4. Write raw bytes to a temp file inside storage_dir.
      5. Transcode:
           audio -> mono 96 kbps mp3
           video -> H.264/AAC mp4, 720p max, ~1.5 Mbps, +faststart
         Both paths strip ALL container metadata.
      6. Probe duration off the transcoded file.
      7. (optional) Transcribe via Whisper with watchdog.
      8. Delete the temp raw file. The transcoded `<clip_id>.<ext>`
         stays at AUDIO_STORAGE_PATH.

    On any failure we best-effort delete the partial output so we don't
    orphan unreachable files.
    """
    storage_dir = storage_dir or AUDIO_STORAGE_PATH
    os.makedirs(storage_dir, exist_ok=True)

    if not clip_id:
        return PipelineResult(ok=False, error="Missing clip_id for storage.")

    # --- 1. validate (empty)
    if not raw_bytes:
        return PipelineResult(ok=False, error="Uploaded file is empty.")

    # --- 2. magic-byte sniff
    media_type = detect_media_type(raw_bytes, fallback_filename=original_filename or "")
    if media_type is None:
        return PipelineResult(
            ok=False,
            error="Could not identify the file as audio or video (unsupported format).",
        )

    # --- 3. validate size against the right cap
    cap = MAX_UPLOAD_BYTES_VIDEO if media_type == "video" else MAX_UPLOAD_BYTES_AUDIO
    if len(raw_bytes) > cap:
        return PipelineResult(
            ok=False,
            media_type=media_type,
            error=f"File too large: {len(raw_bytes)} bytes (max {cap} for {media_type}).",
        )

    final_ext = ".mp4" if media_type == "video" else ".mp3"
    final_filename = f"{clip_id}{final_ext}"
    # Temp raw filename gets a unique suffix so concurrent uploads of the
    # same clip_id (shouldn't happen, but defence-in-depth) can't collide
    # while ffmpeg is still running.
    raw_filename = f"_raw_{clip_id}_{uuid.uuid4().hex[:8]}.bin"

    raw_path = os.path.join(storage_dir, raw_filename)
    final_path = os.path.join(storage_dir, final_filename)

    try:
        # --- 4. write raw
        with open(raw_path, "wb") as fh:
            fh.write(raw_bytes)

        # --- 5. transcode (blocking ffmpeg → off-thread)
        if media_type == "video":
            await asyncio.to_thread(transcode_to_mp4_720p, raw_path, final_path)
        else:
            await asyncio.to_thread(transcode_to_mp3, raw_path, final_path)

        # --- 5b. defensive: ffmpeg may have exited 0 but produced nothing
        # if the source was weird. Fail loudly here so the admin record
        # never claims processingStatus=ready without an on-disk file.
        if not os.path.isfile(final_path) or os.path.getsize(final_path) == 0:
            raise RuntimeError(
                "Transcode reported success but produced no output file."
            )

        # --- 6. duration
        duration = await asyncio.to_thread(_probe_duration_seconds, final_path)

        # --- 7. transcribe
        # For VIDEO clips we transcribe an audio-only extract — Whisper
        # only needs audio, and a 5+ minute H.264/AAC mp4 easily blows
        # past Whisper's 25 MB cap whereas a 96 kbps mono MP3 fits ~33
        # minutes of speech. Audio uploads skip this and feed the already
        # tiny transcoded MP3 directly.
        transcript = ""
        captions: List[dict] = []
        whisper_temp_path: Optional[str] = None
        if not skip_transcription:
            if media_type == "video":
                whisper_temp_path = os.path.join(
                    storage_dir, f"_whisper_{clip_id}_{uuid.uuid4().hex[:8]}.mp3"
                )
                await asyncio.to_thread(
                    extract_audio_for_whisper, final_path, whisper_temp_path
                )
                whisper_source = whisper_temp_path
            else:
                whisper_source = final_path

            # Defensive guard: if even the audio-only extract is over our
            # cap (someone uploaded a 40-min keynote), reject cleanly
            # instead of letting Whisper return a cryptic 413.
            try:
                whisper_size = os.path.getsize(whisper_source)
            except OSError:
                whisper_size = 0
            if whisper_size > WHISPER_MAX_BYTES:
                raise RuntimeError(
                    "Clip too long for transcription — max 30 minutes."
                )

            try:
                transcript, captions = await transcribe_with_whisper(whisper_source)
            finally:
                if whisper_temp_path:
                    _safe_unlink(whisper_temp_path)

        return PipelineResult(
            ok=True,
            media_type=media_type,
            audio_filename=final_filename,
            duration_seconds=duration,
            transcript=transcript,
            captions=captions,
        )

    except asyncio.TimeoutError:
        logger.exception("[voices_pipeline] Whisper watchdog tripped")
        _safe_unlink(final_path)
        return PipelineResult(
            ok=False,
            media_type=media_type,
            error=f"Transcription timed out after {WHISPER_TIMEOUT_SECONDS}s.",
        )
    except Exception as e:  # ffmpeg failure, whisper error, disk full, ...
        logger.exception("[voices_pipeline] pipeline failed")
        _safe_unlink(final_path)
        return PipelineResult(ok=False, media_type=media_type, error=str(e))
    finally:
        _safe_unlink(raw_path)


def _safe_unlink(path: str) -> None:
    """Best-effort delete. Never raises — the orchestrator must keep
    returning a PipelineResult even if cleanup fails."""
    try:
        if path and os.path.isfile(path):
            os.unlink(path)
    except OSError:
        logger.warning(f"[voices_pipeline] cleanup failed for {path}", exc_info=True)


def delete_clip_file(filename: str, storage_dir: Optional[str] = None) -> bool:
    """Delete a previously-stored clip mp3 from disk.

    Uses the same path-traversal defence as the streaming endpoint:
    the resolved path MUST sit inside `storage_dir`.

    Returns True if the file existed and was removed, False otherwise.
    """
    storage_dir = storage_dir or AUDIO_STORAGE_PATH
    if not filename:
        return False
    safe_root = Path(storage_dir).resolve()
    candidate = (safe_root / filename).resolve()
    try:
        candidate.relative_to(safe_root)
    except ValueError:
        logger.warning(f"[voices_pipeline] path-traversal blocked on delete: {filename}")
        return False
    if not candidate.is_file():
        return False
    try:
        candidate.unlink()
        return True
    except OSError:
        logger.warning(f"[voices_pipeline] failed to delete {candidate}", exc_info=True)
        return False


# Exported helper used by tests + the seed script for sanity checks.
__all__ = [
    "PipelineResult",
    "process_upload",
    "transcode_to_mp3",
    "transcode_to_mp4_720p",
    "extract_audio_for_whisper",
    "transcribe_with_whisper",
    "sanitize_filename",
    "delete_clip_file",
    "detect_media_type",
    "save_contributor_photo",
    "get_contributor_photo_path",
    "delete_contributor_photo",
    "WHISPER_TIMEOUT_SECONDS",
    "WHISPER_MAX_BYTES",
    "MAX_UPLOAD_BYTES",
    "MAX_UPLOAD_BYTES_AUDIO",
    "MAX_UPLOAD_BYTES_VIDEO",
    "MAX_PHOTO_BYTES",
    "PHOTOS_SUBDIR",
]
