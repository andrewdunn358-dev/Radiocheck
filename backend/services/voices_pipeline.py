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

# Max raw upload accepted by the admin uploader (bytes). 50MB lets us take
# ~10 min of high-bitrate WAV without bloating the disk. Tunable via env.
MAX_UPLOAD_BYTES = int(os.environ.get("VOICES_MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))

# Whisper end-to-end deadline. 300s comfortably covers a ~5 min clip even on
# a cold worker; anything longer indicates a stuck request that we don't
# want blocking the FastAPI thread (Q6: asyncio.wait_for watchdog).
WHISPER_TIMEOUT_SECONDS = int(os.environ.get("VOICES_WHISPER_TIMEOUT_S", "300"))

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
    """
    ok: bool
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
    """
    proc = _run_ffmpeg([
        "-i", input_path,
        "-vn",  # discard any incidental video stream
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
    storage_dir: Optional[str] = None,
    skip_transcription: bool = False,
) -> PipelineResult:
    """Run the full ingest pipeline on a raw uploaded audio payload.

    Steps
    -----
      1. Reject empty / oversized uploads (cheap early check).
      2. Write the raw bytes to a temp file inside storage_dir.
      3. Transcode → mono 96kbps mp3 with a server-generated filename.
      4. Probe duration off the transcoded file.
      5. (optional) Transcribe via Whisper with watchdog.
      6. Delete the temp raw file. The mp3 stays at AUDIO_STORAGE_PATH.

    Notes
    -----
    * `skip_transcription=True` is for unit tests that don't have an
      OpenAI key — the admin endpoint never passes it. It produces a
      PipelineResult with `captions=[]` and `transcript=""`.
    * On ANY failure we attempt to clean up the partial mp3 so we don't
      orphan unreachable files on the disk. Best-effort.
    """
    storage_dir = storage_dir or AUDIO_STORAGE_PATH
    os.makedirs(storage_dir, exist_ok=True)

    # --- 1. validate
    if not raw_bytes:
        return PipelineResult(ok=False, error="Uploaded file is empty.")
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        return PipelineResult(
            ok=False,
            error=f"File too large: {len(raw_bytes)} bytes (max {MAX_UPLOAD_BYTES}).",
        )

    safe_stem = sanitize_filename(Path(original_filename).stem) or "clip"
    unique_id = uuid.uuid4().hex[:12]
    raw_filename = f"_raw_{unique_id}_{safe_stem}{Path(original_filename).suffix.lower() or '.bin'}"
    final_filename = f"{unique_id}_{safe_stem}.mp3"

    raw_path = os.path.join(storage_dir, raw_filename)
    final_path = os.path.join(storage_dir, final_filename)

    try:
        # --- 2. write raw
        with open(raw_path, "wb") as fh:
            fh.write(raw_bytes)

        # --- 3. transcode (blocking ffmpeg → off-thread so the event loop
        # stays responsive for concurrent requests)
        await asyncio.to_thread(transcode_to_mp3, raw_path, final_path)

        # --- 4. duration
        duration = await asyncio.to_thread(_probe_duration_seconds, final_path)

        # --- 5. transcribe
        transcript = ""
        captions: List[dict] = []
        if not skip_transcription:
            transcript, captions = await transcribe_with_whisper(final_path)

        return PipelineResult(
            ok=True,
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
            error=f"Transcription timed out after {WHISPER_TIMEOUT_SECONDS}s.",
        )
    except Exception as e:  # ffmpeg failure, whisper error, disk full, ...
        logger.exception("[voices_pipeline] pipeline failed")
        _safe_unlink(final_path)
        return PipelineResult(ok=False, error=str(e))
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
    "transcribe_with_whisper",
    "sanitize_filename",
    "delete_clip_file",
    "WHISPER_TIMEOUT_SECONDS",
    "MAX_UPLOAD_BYTES",
]
