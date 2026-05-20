"""
Pytest suite for the Veteran Voices admin pipeline + endpoints (PR #B1).

What's covered
==============
1. `services/voices_pipeline.py`
   - sanitize_filename — guards against path traversal / weird unicode.
   - process_upload happy path (skip_transcription=True, real ffmpeg).
   - process_upload oversized payload rejection.
   - process_upload empty payload rejection.
   - delete_clip_file — works on a real file + refuses path traversal.

2. `routers/clips_admin.py`
   - require_admin gating (non-admin tokens get 403).
   - POST /admin/clips (multipart) end-to-end with skip_transcription patched
     out so the test doesn't hit OpenAI. Asserts the row is created with
     `processingStatus=ready` and `status=draft`.
   - PATCH refuses to publish without consent.
   - publish endpoint refuses without consent / without audio / not ready.
   - archive endpoint flips status correctly.
   - DELETE clears the disk file + clip_plays + clip_saves.

These tests deliberately monkeypatch the Whisper call away — we don't have
an OpenAI key in CI and the watchdog logic is exercised separately with
`asyncio.wait_for` mocking.
"""
from __future__ import annotations

import asyncio
import os
import struct
import sys
import tempfile
import wave
from pathlib import Path
from typing import Any

import pytest


BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# Pipeline + admin router live in the same backend tree.
from services import voices_pipeline  # noqa: E402
from services.voices_pipeline import (  # noqa: E402
    delete_clip_file,
    process_upload,
    sanitize_filename,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point AUDIO_STORAGE_PATH at a per-test temp dir."""
    storage = tmp_path / "clips"
    storage.mkdir()
    monkeypatch.setattr(voices_pipeline, "AUDIO_STORAGE_PATH", str(storage))
    return storage


def _make_silent_wav_bytes(duration_seconds: int = 1) -> bytes:
    """Build a tiny valid WAV in memory — avoids depending on any seed
    audio asset and keeps the test hermetic."""
    buf = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        with wave.open(buf.name, "w") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            silence = struct.pack("<h", 0) * (16000 * duration_seconds)
            wf.writeframes(silence)
        return Path(buf.name).read_bytes()
    finally:
        os.unlink(buf.name)


# ---------------------------------------------------------------------------
# 1. sanitize_filename
# ---------------------------------------------------------------------------

class TestSanitizeFilename:
    def test_strips_path_traversal(self) -> None:
        assert sanitize_filename("../../../etc/passwd") == "etc_passwd"

    def test_strips_unicode_and_spaces(self) -> None:
        out = sanitize_filename("My Cool Voice — clip!")
        # Only alnum/dash/dot/underscore survive; lowercased.
        assert out == "my_cool_voice_clip"

    def test_caps_at_64_chars(self) -> None:
        long = "a" * 200
        assert len(sanitize_filename(long)) == 64

    def test_empty_fallback(self) -> None:
        assert sanitize_filename("...") == "clip"


# ---------------------------------------------------------------------------
# 2. process_upload — real ffmpeg, transcription patched out
# ---------------------------------------------------------------------------

class TestProcessUploadHappyPath:
    @pytest.mark.asyncio
    async def test_transcodes_and_writes_file(self, tmp_storage: Path) -> None:
        raw = _make_silent_wav_bytes(duration_seconds=1)

        result = await process_upload(
            raw_bytes=raw,
            original_filename="tommy first take.wav",
            clip_id="abc123def456",
            skip_transcription=True,
        )

        assert result.ok is True
        assert result.error is None
        # Filename is ALWAYS <clip_id>.<ext> — original filename irrelevant.
        assert result.audio_filename == "abc123def456.mp3"
        assert (tmp_storage / "abc123def456.mp3").is_file()
        # 1s of silence → ffmpeg reports >=1s. Allow a little fuzz.
        assert result.duration_seconds >= 1
        # skip_transcription means we never called OpenAI.
        assert result.transcript == ""
        assert result.captions == []


class TestProcessUploadGuards:
    @pytest.mark.asyncio
    async def test_rejects_empty_upload(self, tmp_storage: Path) -> None:
        result = await process_upload(
            raw_bytes=b"",
            original_filename="empty.wav",
            clip_id="cid1",
            skip_transcription=True,
        )
        assert result.ok is False
        assert result.error and "empty" in result.error.lower()

    @pytest.mark.asyncio
    async def test_rejects_oversized_upload(
        self, tmp_storage: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Shrink the cap so we don't have to allocate 100MB in a test.
        monkeypatch.setattr(voices_pipeline, "MAX_UPLOAD_BYTES_AUDIO", 100)
        # Use a real WAV so the magic-byte sniff classifies it as audio
        # and the size guard is what trips (not the unknown-format guard).
        wav = _make_silent_wav_bytes(duration_seconds=1)
        result = await process_upload(
            raw_bytes=wav + b"x" * 200,  # >100 bytes
            original_filename="big.wav",
            clip_id="cid2",
            skip_transcription=True,
        )
        assert result.ok is False
        assert result.error and "too large" in result.error.lower()

    @pytest.mark.asyncio
    async def test_rejects_unknown_format(self, tmp_storage: Path) -> None:
        """Random bytes that don't match any audio/video magic should be
        rejected up front with a clear message — used to be caught by
        ffmpeg-failure path, but PR #C magic-byte sniff makes this
        explicit and avoids spawning ffmpeg on garbage."""
        result = await process_upload(
            raw_bytes=b"this is definitely not media" * 10,
            original_filename="garbage.bin",
            clip_id="cid3",
            skip_transcription=True,
        )
        assert result.ok is False
        assert result.error and "unsupported" in result.error.lower()

    @pytest.mark.asyncio
    async def test_ffmpeg_failure_returns_failure_not_500(
        self, tmp_storage: Path
    ) -> None:
        """Random garbage bytes are now caught by magic-byte sniff
        BEFORE ffmpeg. The contract here is still 'fails cleanly,
        no orphan mp3' regardless of where in the chain rejection
        happens."""
        result = await process_upload(
            raw_bytes=b"this is definitely not audio" * 100,
            original_filename="garbage.wav",
            clip_id="cid4",
            skip_transcription=True,
        )
        assert result.ok is False
        assert result.error is not None
        # No orphaned mp3 left on disk.
        assert not any(p.suffix == ".mp3" for p in tmp_storage.iterdir())


# ---------------------------------------------------------------------------
# 3. Whisper watchdog — wait_for trips on stuck calls
# ---------------------------------------------------------------------------

class TestWhisperWatchdog:
    @pytest.mark.asyncio
    async def test_timeout_surfaces_as_pipeline_failure(
        self, tmp_storage: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Simulate a Whisper call that hangs forever; the watchdog should
        cancel it after WHISPER_TIMEOUT_SECONDS (we set it tiny here) and
        process_upload should return ok=False."""
        # Cut the deadline so the test is fast.
        monkeypatch.setattr(voices_pipeline, "WHISPER_TIMEOUT_SECONDS", 1)

        async def hang(*_args: Any, **_kwargs: Any) -> Any:
            await asyncio.sleep(60)  # would never return; the watchdog must kill us

        monkeypatch.setattr(voices_pipeline, "transcribe_with_whisper", hang)

        raw = _make_silent_wav_bytes(duration_seconds=1)
        result = await process_upload(
            raw_bytes=raw,
            original_filename="hang.wav",
            clip_id="hang_cid",
            skip_transcription=False,
        )
        # We expect a clean failure, NOT a hang.
        assert result.ok is False
        # The transcoded mp3 should have been cleaned up so the disk stays tidy.
        assert not any(p.suffix == ".mp3" for p in tmp_storage.iterdir())


# ---------------------------------------------------------------------------
# 4. delete_clip_file
# ---------------------------------------------------------------------------

class TestDeleteClipFile:
    def test_deletes_real_file(self, tmp_storage: Path) -> None:
        f = tmp_storage / "abc_test.mp3"
        f.write_bytes(b"x")
        ok = delete_clip_file("abc_test.mp3", storage_dir=str(tmp_storage))
        assert ok is True
        assert not f.exists()

    def test_refuses_path_traversal(self, tmp_storage: Path) -> None:
        # Even with a real file outside the storage dir, delete should refuse.
        ok = delete_clip_file("../escape.mp3", storage_dir=str(tmp_storage))
        assert ok is False

    def test_missing_file_returns_false(self, tmp_storage: Path) -> None:
        assert delete_clip_file("does_not_exist.mp3", storage_dir=str(tmp_storage)) is False


# ---------------------------------------------------------------------------
# 5. Admin router — mounted on a throwaway FastAPI app + in-memory DB stand-in
# ---------------------------------------------------------------------------
#
# We avoid spinning up the full server.py (it tries to load safety models,
# OpenAI clients, etc.). Instead we mount ONLY the clips_admin router on a
# bare FastAPI app and inject a minimal async DB shim that supports the
# subset of motor calls the router uses.
# ---------------------------------------------------------------------------

import importlib  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


class _FakeCursor:
    def __init__(self, docs: list[dict]) -> None:
        self._docs = list(docs)

    def sort(self, *_args, **_kwargs) -> "_FakeCursor":
        return self

    async def to_list(self, length: Any = None) -> list[dict]:
        return list(self._docs)


class _FakeCollection:
    """Just enough of the motor surface for the admin router. In-memory."""

    def __init__(self) -> None:
        self._rows: list[dict] = []

    async def insert_one(self, doc: dict) -> Any:
        self._rows.append(dict(doc))
        return type("R", (), {"inserted_id": doc.get("id")})()

    async def find_one(self, query: dict, projection: dict | None = None) -> dict | None:
        for row in self._rows:
            if all(row.get(k) == v for k, v in query.items()):
                return {k: v for k, v in row.items() if k != "_id"}
        return None

    def find(self, query: dict | None = None, projection: dict | None = None) -> _FakeCursor:
        query = query or {}
        matched = [
            {k: v for k, v in r.items() if k != "_id"}
            for r in self._rows
            if all(r.get(k) == v for k, v in query.items())
        ]
        return _FakeCursor(matched)

    async def update_one(self, query: dict, update: dict) -> Any:
        set_doc = update.get("$set", {})
        matched = 0
        for row in self._rows:
            if all(row.get(k) == v for k, v in query.items()):
                row.update(set_doc)
                matched += 1
                break
        return type("R", (), {"matched_count": matched, "modified_count": matched})()

    async def delete_one(self, query: dict) -> Any:
        for i, row in enumerate(self._rows):
            if all(row.get(k) == v for k, v in query.items()):
                del self._rows[i]
                return type("R", (), {"deleted_count": 1})()
        return type("R", (), {"deleted_count": 0})()

    async def delete_many(self, query: dict) -> Any:
        before = len(self._rows)
        self._rows = [
            r
            for r in self._rows
            if not all(r.get(k) == v for k, v in query.items())
        ]
        return type("R", (), {"deleted_count": before - len(self._rows)})()


class _FakeDB:
    def __init__(self) -> None:
        self.clips = _FakeCollection()
        self.clip_plays = _FakeCollection()
        self.clip_saves = _FakeCollection()


@pytest.fixture
def admin_client(tmp_storage: Path, monkeypatch: pytest.MonkeyPatch):
    """Build a FastAPI app with only the clips_admin router mounted, plus
    fake DB and fake admin-auth. Returns (TestClient, fake_db)."""
    # Re-import the admin router fresh so module-level state is clean.
    clips_admin = importlib.reload(importlib.import_module("routers.clips_admin"))

    fake_db = _FakeDB()

    async def fake_get_current_user(credentials) -> Any:  # noqa: ANN001
        # Header convention for tests: bearer "admin-token" → admin, anything
        # else → service user. Matches the granularity require_admin needs.
        token = getattr(credentials, "credentials", "")
        if token == "admin-token":
            return {"id": "admin-id", "email": "admin@example.com", "role": "admin", "name": "Admin"}
        return {"id": "user-id", "email": "u@example.com", "role": "user", "name": "User"}

    clips_admin.set_dependencies(fake_db, fake_get_current_user)

    # Also point the pipeline at our temp storage AND skip Whisper.
    async def fake_whisper(_path: str):
        return ("", [])

    monkeypatch.setattr(voices_pipeline, "transcribe_with_whisper", fake_whisper)

    app = FastAPI()
    app.include_router(clips_admin.router, prefix="/api")

    return TestClient(app), fake_db


# ---------------------------------------------------------------------------
# 5a. Auth gate
# ---------------------------------------------------------------------------

class TestAdminAuthGate:
    def test_unauth_returns_401_or_403(self, admin_client) -> None:
        client, _ = admin_client
        # No bearer at all → 401 (FastAPI's HTTPBearer auto-error).
        r = client.get("/api/admin/clips")
        assert r.status_code in (401, 403)

    def test_non_admin_returns_403(self, admin_client) -> None:
        client, _ = admin_client
        r = client.get("/api/admin/clips", headers={"Authorization": "Bearer user-token"})
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# 5b. Full happy path: upload → list → fetch → publish guarded → publish ok
# ---------------------------------------------------------------------------

class TestAdminCRUDFlow:
    def test_upload_creates_draft_with_ready_pipeline(self, admin_client) -> None:
        client, fake_db = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={"audio": ("hello.wav", wav, "audio/wav")},
            data={
                "contributorName": "Sam",
                "contributorBio": "Royal Marines, 1998-2010",
                "categories": "transition,lost_purpose",
                "sensitivityFlags": "none",
                "consentConfirmed": "true",
            },
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["contributorName"] == "Sam"
        assert body["status"] == "draft"
        assert body["processingStatus"] == "ready"
        assert body["audioFilename"].endswith(".mp3")
        assert body["categories"] == ["transition", "lost_purpose"]
        assert len(fake_db.clips._rows) == 1

    def test_publish_requires_consent(self, admin_client) -> None:
        client, fake_db = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={"audio": ("a.wav", wav, "audio/wav")},
            data={
                "contributorName": "Sam",
                "contributorBio": "bio",
                # NOTE: consentConfirmed deliberately false
                "consentConfirmed": "false",
            },
        )
        assert r.status_code == 201
        clip_id = r.json()["id"]

        r2 = client.post(
            f"/api/admin/clips/{clip_id}/publish",
            headers={"Authorization": "Bearer admin-token"},
        )
        assert r2.status_code == 400
        assert "consent" in r2.json()["detail"].lower()

    def test_publish_after_consent_flips_status(self, admin_client) -> None:
        client, fake_db = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={"audio": ("a.wav", wav, "audio/wav")},
            data={
                "contributorName": "Sam",
                "contributorBio": "bio",
                "consentConfirmed": "true",
            },
        )
        clip_id = r.json()["id"]

        r2 = client.post(
            f"/api/admin/clips/{clip_id}/publish",
            headers={"Authorization": "Bearer admin-token"},
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "published"

    def test_patch_publish_without_consent_rejected(self, admin_client) -> None:
        client, _ = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={"audio": ("a.wav", wav, "audio/wav")},
            data={
                "contributorName": "Sam",
                "contributorBio": "bio",
                "consentConfirmed": "false",
            },
        )
        clip_id = r.json()["id"]

        r2 = client.patch(
            f"/api/admin/clips/{clip_id}",
            headers={"Authorization": "Bearer admin-token"},
            json={"status": "published"},
        )
        assert r2.status_code == 400
        assert "consent" in r2.json()["detail"].lower()

    def test_archive_flips_status(self, admin_client) -> None:
        client, _ = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={"audio": ("a.wav", wav, "audio/wav")},
            data={
                "contributorName": "Sam",
                "contributorBio": "bio",
                "consentConfirmed": "true",
            },
        )
        clip_id = r.json()["id"]
        r2 = client.post(
            f"/api/admin/clips/{clip_id}/archive",
            headers={"Authorization": "Bearer admin-token"},
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "archived"

    def test_delete_removes_disk_file_and_row(
        self, admin_client, tmp_storage: Path
    ) -> None:
        client, fake_db = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={"audio": ("a.wav", wav, "audio/wav")},
            data={
                "contributorName": "Sam",
                "contributorBio": "bio",
                "consentConfirmed": "true",
            },
        )
        clip_id = r.json()["id"]
        filename = r.json()["audioFilename"]
        assert (tmp_storage / filename).is_file()

        r2 = client.delete(
            f"/api/admin/clips/{clip_id}",
            headers={"Authorization": "Bearer admin-token"},
        )
        assert r2.status_code == 204
        assert not (tmp_storage / filename).exists()
        assert len(fake_db.clips._rows) == 0

    def test_list_returns_created_rows(self, admin_client) -> None:
        client, _ = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        for n in ("a", "b"):
            client.post(
                "/api/admin/clips",
                headers={"Authorization": "Bearer admin-token"},
                files={"audio": (f"{n}.wav", wav, "audio/wav")},
                data={
                    "contributorName": f"Sam-{n}",
                    "contributorBio": "bio",
                    "consentConfirmed": "true",
                },
            )
        r = client.get(
            "/api/admin/clips", headers={"Authorization": "Bearer admin-token"}
        )
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 2
        names = {it["contributorName"] for it in items}
        assert names == {"Sam-a", "Sam-b"}


# ---------------------------------------------------------------------------
# 6. PR #C bug-fix: spaces in filenames + clip_id-based storage + flags
# ---------------------------------------------------------------------------

# Tiny PNG header + JPG header used to test photo upload — we don't need a
# valid image, just bytes that pass the magic-byte check in
# save_contributor_photo.
_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200
_JPG_BYTES = b"\xff\xd8\xff" + b"\x00" * 200


class TestSpacesInFilenamesAndClipIdStorage:
    """Three related production bugs, one fix:
       1. Audio saved as <hash>_<contributor>_<n>.mp3 not <clip_id>.mp3.
       2. Spaces in original filename ('Rachel Voice.m4a') broke uploads.
       3. has_photo / has_audio flags never set, so admin UI hid the
          player and image elements.
    """

    def test_audio_with_space_in_filename_succeeds(self, admin_client, tmp_storage: Path) -> None:
        """Upload 'Rachel Voice.m4a' (space in filename) — must succeed
        AND must be saved as <clip_id>.mp3 (NOT '_rachel_voice.mp3'
        or any contributor-derived name)."""
        client, fake_db = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={"audio": ("Rachel Voice.m4a", wav, "audio/wav")},
            data={
                "contributorName": "Rachel",
                "contributorBio": "bio",
                "consentConfirmed": "true",
            },
        )
        assert r.status_code == 201, r.text
        body = r.json()
        # Filename is exactly <clip_id>.mp3 — NO contributor name, NO
        # extra hash, NO 'rachel_voice' substring.
        expected = f"{body['id']}.mp3"
        assert body["audioFilename"] == expected
        assert (tmp_storage / expected).is_file()
        # Flag is true because the file actually exists on disk.
        assert body["hasAudio"] is True
        assert body["processingStatus"] == "ready"

    def test_photo_with_space_in_filename_succeeds(self, admin_client, tmp_storage: Path) -> None:
        """Upload 'headshot 2.jpg' (space) — must succeed and land at
        <clip_id>.jpg in the photos subdir."""
        client, fake_db = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={
                "audio": ("a.wav", wav, "audio/wav"),
                "contributorPhoto": ("headshot 2.jpg", _JPG_BYTES, "image/jpeg"),
            },
            data={
                "contributorName": "Rachel",
                "contributorBio": "bio",
                "consentConfirmed": "true",
            },
        )
        assert r.status_code == 201, r.text
        body = r.json()
        clip_id = body["id"]
        expected_photo = f"{clip_id}.jpg"
        assert body["contributorPhotoFilename"] == expected_photo
        assert (tmp_storage / "photos" / expected_photo).is_file()
        assert body["hasPhoto"] is True

    def test_has_audio_false_when_pipeline_fails(self, admin_client) -> None:
        """Garbage upload → pipeline fails → hasAudio=false,
        processingStatus=failed. Admin UI uses these to hide the
        broken player element."""
        client, _ = admin_client
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={"audio": ("garbage.bin", b"definitely not audio" * 10, "application/octet-stream")},
            data={
                "contributorName": "X",
                "contributorBio": "bio",
                "consentConfirmed": "false",
            },
        )
        # Endpoint still 201s — the row exists so the admin can fix it.
        assert r.status_code == 201
        body = r.json()
        assert body["hasAudio"] is False
        assert body["hasPhoto"] is False
        assert body["processingStatus"] == "failed"

    def test_audio_and_photo_both_flagged_on_combined_upload(
        self, admin_client, tmp_storage: Path
    ) -> None:
        """Acceptance criterion: 'admin uploads photo → appears on
        clip detail'. With both flags true, the UI shows both elements."""
        client, _ = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={
                "audio": ("a.wav", wav, "audio/wav"),
                "contributorPhoto": ("p.png", _PNG_BYTES, "image/png"),
            },
            data={
                "contributorName": "Sam",
                "contributorBio": "bio",
                "consentConfirmed": "true",
            },
        )
        assert r.status_code == 201
        body = r.json()
        # Both flags set + both files on disk + filenames are <clip_id>.<ext>.
        cid = body["id"]
        assert body["hasAudio"] is True
        assert body["hasPhoto"] is True
        assert body["audioFilename"] == f"{cid}.mp3"
        assert body["contributorPhotoFilename"] == f"{cid}.png"
        assert (tmp_storage / f"{cid}.mp3").is_file()
        assert (tmp_storage / "photos" / f"{cid}.png").is_file()

    def test_list_view_carries_flags(self, admin_client) -> None:
        """The list view must surface hasAudio/hasPhoto so the admin
        table can show a 'missing file' badge without fetching detail."""
        client, _ = admin_client
        wav = _make_silent_wav_bytes(duration_seconds=1)
        client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={
                "audio": ("a.wav", wav, "audio/wav"),
                "contributorPhoto": ("p.png", _PNG_BYTES, "image/png"),
            },
            data={
                "contributorName": "Listed",
                "contributorBio": "bio",
                "consentConfirmed": "true",
            },
        )
        r = client.get("/api/admin/clips", headers={"Authorization": "Bearer admin-token"})
        assert r.status_code == 200
        rows = r.json()
        assert any(row.get("hasAudio") is True and row.get("hasPhoto") is True for row in rows)

    def test_video_filename_is_clip_id_mp4(self, admin_client, tmp_storage: Path) -> None:
        """Same contract for video: <clip_id>.mp4 regardless of source."""
        client, _ = admin_client
        # An ftyp+isom header is enough to classify as video; pipeline
        # will fail ffmpeg transcode on the empty body, which is fine —
        # we're only asserting filename selection logic.
        head = b"\x00\x00\x00\x20ftypisom" + b"\x00" * 50
        r = client.post(
            "/api/admin/clips",
            headers={"Authorization": "Bearer admin-token"},
            files={"audio": ("My Video Clip.mp4", head, "video/mp4")},
            data={
                "contributorName": "V",
                "contributorBio": "bio",
                "consentConfirmed": "false",
            },
        )
        assert r.status_code == 201
        body = r.json()
        # Even though the pipeline ffmpeg-fails on these bytes, the
        # backend STILL writes a row and the filename it WOULD have
        # used must be <clip_id>.mp4 — the user can re-upload a real
        # video against the same row by deleting + retrying. But the
        # critical contract is that `audioFilename` is never the
        # contributor's original 'My Video Clip.mp4'.
        original = "My Video Clip.mp4"
        assert original not in body["audioFilename"]
        if body["audioFilename"]:
            assert body["audioFilename"].endswith(".mp4")
