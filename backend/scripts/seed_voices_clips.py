"""
Seed script for Veteran Voices — 3 placeholder clips.

Run with:
    cd /app/backend && python -m scripts.seed_voices_clips                     # safe: clips inserted as DRAFT
    cd /app/backend && python -m scripts.seed_voices_clips --publish-for-local-dev   # local dev only: marks as PUBLISHED so /api/clips/random returns them

What this does
==============
- Creates 3 clips with silent 30-second WAV audio on disk at
  $AUDIO_STORAGE_PATH so PR #C frontend work has something to render
  the player against.
- DEFAULTS TO status=DRAFT — even if someone runs this against the
  production database by accident, no real user can ever be served
  thirty seconds of silence via /api/clips/random (which filters to
  status=published only).
- The --publish-for-local-dev flag explicitly opts in to status=published.
  Intended ONLY for local development against a local MongoDB. Never use
  this flag against prod.
- Idempotent: existing clips are re-upserted (status field is updated to
  reflect the current flag, so running with the flag promotes them and
  running without demotes them back to draft).
- These are NOT real veteran-contributed clips. PR #B's admin upload
  flow is how real content enters the system.

Safety wall
===========
This script touches ONLY the `clips` collection. It does not write to
safeguarding / live-chat / alert / encryption collections.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running as a script: `python scripts/seed_voices_clips.py`
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Load backend/.env so MONGO_URL / DB_NAME / AUDIO_STORAGE_PATH are available
# whether the script is invoked from supervisor, CLI, or CI.
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:
    # dotenv is a backend dep; if it's missing the env vars must be exported
    # by the caller, so just proceed.
    pass

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from models.clips import ClipStatus  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AUDIO_STORAGE_PATH = os.environ.get("AUDIO_STORAGE_PATH", "/var/data/clips")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "veterans_support")


def _write_silent_wav(path: Path, duration_seconds: int = 30, sample_rate: int = 22050) -> None:
    """Write a valid silent mono 16-bit PCM WAV file.

    Tiny by design — 30s @ 22.05kHz mono = ~1.3MB. Just enough for the
    player to load without erroring on decode.
    """
    n_samples = duration_seconds * sample_rate
    byte_rate = sample_rate * 2  # mono, 16-bit
    data_size = n_samples * 2
    with open(path, "wb") as f:
        # RIFF header
        f.write(b"RIFF")
        f.write(struct.pack("<I", 36 + data_size))
        f.write(b"WAVE")
        # fmt chunk
        f.write(b"fmt ")
        f.write(struct.pack("<I", 16))           # PCM chunk size
        f.write(struct.pack("<H", 1))            # PCM
        f.write(struct.pack("<H", 1))            # mono
        f.write(struct.pack("<I", sample_rate))
        f.write(struct.pack("<I", byte_rate))
        f.write(struct.pack("<H", 2))            # block align
        f.write(struct.pack("<H", 16))           # bits per sample
        # data chunk
        f.write(b"data")
        f.write(struct.pack("<I", data_size))
        f.write(b"\x00" * data_size)


PLACEHOLDERS = [
    {
        "id": "clip_seed_couldnt_sleep_001",
        "contributorName": "Alex",
        "contributorBio": "Royal Engineers, served 2009–2019",
        "audioFilename": "clip_seed_couldnt_sleep_001.wav",
        "durationSeconds": 30,
        "categories": ["couldnt_sleep"],
        "sensitivityFlags": ["none"],
        "captions": [
            {"start": 0.0, "end": 5.0, "text": "Couldn't sleep again last night."},
            {"start": 5.0, "end": 15.0, "text": "Just lay there. Didn't fight it. Sometimes that's all you can do."},
            {"start": 15.0, "end": 30.0, "text": "And the morning came anyway. It does. Hold on for that."},
        ],
    },
    {
        "id": "clip_seed_anniversary_001",
        "contributorName": "Sam",
        "contributorBio": "RLC, served 2003–2014",
        "audioFilename": "clip_seed_anniversary_001.wav",
        "durationSeconds": 30,
        "categories": ["anniversary"],
        "sensitivityFlags": ["none"],
        "captions": [
            {"start": 0.0, "end": 8.0, "text": "Today's the anniversary. I see it on the calendar weeks before."},
            {"start": 8.0, "end": 20.0, "text": "I don't dress it up anymore. I light a candle. I sit with it."},
            {"start": 20.0, "end": 30.0, "text": "You're allowed to remember. You're allowed to be okay too."},
        ],
    },
    {
        "id": "clip_seed_lost_purpose_001",
        "contributorName": "Jordan",
        "contributorBio": "REME, served 2012–2022",
        "audioFilename": "clip_seed_lost_purpose_001.wav",
        "durationSeconds": 30,
        "categories": ["lost_purpose", "transition"],
        "sensitivityFlags": ["none"],
        "captions": [
            {"start": 0.0, "end": 6.0, "text": "When I left I didn't know who I was without the uniform."},
            {"start": 6.0, "end": 18.0, "text": "Took me two years to figure out it wasn't me that was missing. It was the job."},
            {"start": 18.0, "end": 30.0, "text": "You're still you. The bit you're looking for is a routine, not yourself."},
        ],
    },
]


async def main(publish_for_local_dev: bool = False) -> None:
    if not MONGO_URL:
        raise RuntimeError("MONGO_URL is not set; refusing to run.")

    os.makedirs(AUDIO_STORAGE_PATH, exist_ok=True)
    storage_dir = Path(AUDIO_STORAGE_PATH)

    # SAFETY: default is DRAFT so a misfire against prod cannot put silent
    # placeholder audio into the random feed. Local devs must pass
    # --publish-for-local-dev to opt in.
    target_status = (
        ClipStatus.published.value if publish_for_local_dev else ClipStatus.draft.value
    )
    logger.info(
        f"[seed] Inserting clips with status={target_status} "
        f"(publish_for_local_dev={publish_for_local_dev})"
    )

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    try:
        for spec in PLACEHOLDERS:
            audio_path = storage_dir / spec["audioFilename"]
            if not audio_path.exists():
                _write_silent_wav(audio_path, duration_seconds=spec["durationSeconds"])
                logger.info(f"[seed] Wrote {audio_path}")
            else:
                logger.info(f"[seed] Audio already present: {audio_path}")

            now = datetime.now(timezone.utc)
            doc = {
                **spec,
                "transcript": " ".join(c["text"] for c in spec["captions"]),
                "status": target_status,
                "consentConfirmed": True,
                "uploadedByAdminId": "seed-script",
                "createdAt": now,
                "updatedAt": now,
            }
            await db.clips.update_one(
                {"id": spec["id"]},
                {"$set": doc},
                upsert=True,
            )
            logger.info(f"[seed] Upserted clip {spec['id']} (status={target_status})")
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Veteran Voices placeholder clips.")
    parser.add_argument(
        "--publish-for-local-dev",
        action="store_true",
        help=(
            "Mark seeded clips as PUBLISHED so /api/clips/random returns them. "
            "Intended ONLY for local dev against a local MongoDB. "
            "Default is DRAFT (safe for accidental prod runs)."
        ),
    )
    args = parser.parse_args()
    asyncio.run(main(publish_for_local_dev=args.publish_for_local_dev))
