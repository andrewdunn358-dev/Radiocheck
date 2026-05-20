"""
Tests for Veteran Voices PR #A — random selection logic.

Covers the spec's selection requirements:
  1. Exclude clips this user played in last 7 days
  2. Exclude high-sensitivity clips by default (overridable)
  3. Weight toward clips user hasn't heard
  4. Fall back to least-recently-played if all heard
  5. Two consecutive calls from same user must return different clips

Uses an in-memory fake `db` so tests are fast, deterministic, and never
touch a real MongoDB instance.

Safety wall
===========
This test file imports ONLY from `models.clips` and `routers.clips`. It
does not load or exercise any safety / safeguarding / encryption module.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

import pytest

# Make backend importable when run as `pytest backend/tests/...`
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Set required env BEFORE importing the router module (it touches os.makedirs)
os.environ.setdefault("AUDIO_STORAGE_PATH", "/tmp/voices_test_storage")

from routers import clips as clips_module  # noqa: E402


# ---------------------------------------------------------------------------
# In-memory fake collections that mimic the subset of motor we use
# ---------------------------------------------------------------------------

class _FakeFindCursor:
    def __init__(self, docs: Iterable[dict]):
        self._docs = list(docs)

    async def to_list(self, length: Optional[int] = None) -> list:
        if length is None:
            return list(self._docs)
        return list(self._docs)[:length]


class _FakeCollection:
    def __init__(self, docs: Optional[list[dict]] = None):
        self.docs = list(docs or [])

    def find(self, query: dict, projection: Optional[dict] = None) -> _FakeFindCursor:
        return _FakeFindCursor(_match_many(self.docs, query))

    async def distinct(self, field: str, query: Optional[dict] = None) -> list:
        matched = _match_many(self.docs, query or {})
        out: list[Any] = []
        seen = set()
        for d in matched:
            v = d.get(field)
            if v is not None and v not in seen:
                out.append(v)
                seen.add(v)
        return out


def _match_many(docs: list[dict], query: dict) -> list[dict]:
    return [d for d in docs if _matches(d, query)]


def _matches(doc: dict, query: dict) -> bool:
    for key, val in query.items():
        if isinstance(val, dict) and any(k.startswith("$") for k in val.keys()):
            if "$in" in val and doc.get(key) not in val["$in"]:
                return False
            if "$gte" in val and not (doc.get(key) is not None and doc[key] >= val["$gte"]):
                return False
        else:
            if doc.get(key) != val:
                return False
    return True


class _FakeDB:
    def __init__(self, clips: list[dict], plays: list[dict]):
        self.clips = _FakeCollection(clips)
        self.clip_plays = _FakeCollection(plays)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _published(**overrides) -> dict:
    base = {
        "id": "clip_x",
        "contributorName": "Test",
        "contributorBio": "Test",
        "audioFilename": "x.wav",
        "durationSeconds": 30,
        "captions": [],
        "categories": ["just_need_to_hear_a_voice"],
        "sensitivityFlags": ["none"],
        "status": "published",
        "transcript": "",
    }
    base.update(overrides)
    return base


def _play(user_id: str, clip_id: str, days_ago: float = 0.0) -> dict:
    return {
        "userId": user_id,
        "clipId": clip_id,
        "playedAt": datetime.now(timezone.utc) - timedelta(days=days_ago),
        "completionPercent": 100.0,
        "skipped": False,
    }


@pytest.fixture(autouse=True)
def _reset_last_random_state():
    """Reset the in-memory _last_random_by_user dict between tests."""
    clips_module._last_random_by_user.clear()
    yield
    clips_module._last_random_by_user.clear()


# ---------------------------------------------------------------------------
# Spec 2: sensitivity filter excludes flagged clips by default
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sensitivity_filter_excludes_flagged_by_default():
    db = _FakeDB(
        clips=[
            _published(id="safe", sensitivityFlags=["none"]),
            _published(id="heavy", sensitivityFlags=["MST", "suicidal_ideation"]),
        ],
        plays=[],
    )
    # Run 30 times — heavy must never be served
    for _ in range(30):
        chosen = await clips_module._select_random_clip(db, "u1", include_sensitive=False)
        assert chosen is not None
        assert chosen["id"] == "safe"


@pytest.mark.asyncio
async def test_sensitivity_filter_override_lets_flagged_through():
    db = _FakeDB(
        clips=[
            _published(id="heavy", sensitivityFlags=["MST"]),
        ],
        plays=[],
    )
    chosen = await clips_module._select_random_clip(db, "u1", include_sensitive=True)
    assert chosen is not None
    assert chosen["id"] == "heavy"


# ---------------------------------------------------------------------------
# Spec 1: 7-day exclusion
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_recent_7day_plays_are_excluded():
    db = _FakeDB(
        clips=[
            _published(id="a"),
            _published(id="b"),
        ],
        plays=[
            _play("u1", "a", days_ago=2.0),  # within window → excluded
        ],
    )
    for _ in range(20):
        chosen = await clips_module._select_random_clip(db, "u1", include_sensitive=False)
        assert chosen is not None
        assert chosen["id"] == "b"


@pytest.mark.asyncio
async def test_plays_older_than_7_days_not_excluded():
    db = _FakeDB(
        clips=[_published(id="only_one")],
        plays=[_play("u1", "only_one", days_ago=9.0)],  # outside 7d window
    )
    chosen = await clips_module._select_random_clip(db, "u1", include_sensitive=False)
    assert chosen is not None
    assert chosen["id"] == "only_one"


# ---------------------------------------------------------------------------
# Spec 3: prefer unheard
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_prefers_unheard_clip_over_heard_one():
    db = _FakeDB(
        clips=[
            _published(id="heard"),
            _published(id="unheard"),
        ],
        plays=[_play("u1", "heard", days_ago=30.0)],  # heard long ago, not in 7d
    )
    for _ in range(20):
        chosen = await clips_module._select_random_clip(db, "u1", include_sensitive=False)
        assert chosen is not None
        # Reset last-served so it doesn't force a switch artificially
        clips_module._last_random_by_user.clear()
        assert chosen["id"] == "unheard"


# ---------------------------------------------------------------------------
# Spec 4: fall back to least-recently-played when all heard
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_falls_back_to_least_recently_played_when_all_heard():
    db = _FakeDB(
        clips=[
            _published(id="recent"),
            _published(id="oldest"),
        ],
        plays=[
            _play("u1", "recent", days_ago=15.0),  # heard 15d ago
            _play("u1", "oldest", days_ago=60.0),  # heard 60d ago
        ],
    )
    chosen = await clips_module._select_random_clip(db, "u1", include_sensitive=False)
    assert chosen is not None
    assert chosen["id"] == "oldest"


# ---------------------------------------------------------------------------
# Spec 5: two consecutive calls return different clips
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_two_consecutive_calls_return_different_clips():
    db = _FakeDB(
        clips=[
            _published(id="a"),
            _published(id="b"),
        ],
        plays=[],
    )
    first = await clips_module._select_random_clip(db, "u1", include_sensitive=False)
    assert first is not None
    # Record the served clip the way the endpoint does
    clips_module._last_random_by_user["u1"] = first["id"]
    second = await clips_module._select_random_clip(db, "u1", include_sensitive=False)
    assert second is not None
    assert second["id"] != first["id"]


@pytest.mark.asyncio
async def test_consecutive_call_constraint_only_per_user():
    db = _FakeDB(
        clips=[_published(id="only")],
        plays=[],
    )
    # u1 has been served 'only' already; u2 is independent
    clips_module._last_random_by_user["u1"] = "only"
    chosen = await clips_module._select_random_clip(db, "u2", include_sensitive=False)
    # u2 has nothing in its last-served map → may return 'only'
    assert chosen is not None
    assert chosen["id"] == "only"


# ---------------------------------------------------------------------------
# Empty-pool safety
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_returns_none_when_no_published_clips():
    db = _FakeDB(clips=[], plays=[])
    chosen = await clips_module._select_random_clip(db, "u1", include_sensitive=False)
    assert chosen is None


@pytest.mark.asyncio
async def test_returns_none_when_all_clips_filtered_out_by_sensitivity():
    db = _FakeDB(
        clips=[_published(id="only_heavy", sensitivityFlags=["MST"])],
        plays=[],
    )
    chosen = await clips_module._select_random_clip(db, "u1", include_sensitive=False)
    assert chosen is None
