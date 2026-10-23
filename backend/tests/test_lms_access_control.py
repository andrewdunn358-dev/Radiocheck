"""Access control on the LMS (routers/lms.py, routers/ai_tutor.py).

WHY THIS FILE EXISTS
--------------------
Before this change the LMS had no auth at all:
  * every /api/lms/admin/* route was open (list/delete learners, reset
    passwords, revoke certificates, read tutor conversations);
  * learner routes trusted a `learner_email` parameter, so anyone could read
    or change anyone's progress and drive the OpenAI tutor on their behalf;
  * a hard-coded email address bypassed the module lock;
  * /learner/set-password let anyone who knew an approved volunteer's email
    claim the account before they did.

Runs in-process against mongomock. No network, nothing touches production.
"""
import asyncio
import os
import sys
import types
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-not-used-anywhere-else")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-not-real")

import jwt  # noqa: E402
import routers.auth as auth  # noqa: E402
import routers.lms as lms  # noqa: E402
import routers.ai_tutor as tutor  # noqa: E402
from auth_config import get_jwt_secret  # noqa: E402

ADMIN_ID = "admin-0001"
COUNSELLOR_ID = "staff-0002"
ALICE = "alice@example.com"
BOB = "bob@example.com"
FIRST_MODULE = lms.MHFA_CURRICULUM["modules"][0]["id"]
SECOND_MODULE = lms.MHFA_CURRICULUM["modules"][1]["id"]

ADMIN_ROUTES = [
    ("GET", "/api/lms/admin/registrations"),
    ("GET", "/api/lms/admin/learners"),
    ("GET", "/api/lms/admin/alerts"),
    ("GET", f"/api/lms/admin/module/{FIRST_MODULE}"),
    ("POST", "/api/lms/admin/alert/abc/read"),
    ("POST", "/api/lms/admin/registration/000000000000000000000000/approve"),
    ("POST", "/api/lms/admin/learner/add"),
    ("POST", "/api/lms/admin/registration/000000000000000000000000/reject"),
    ("POST", "/api/lms/admin/alerts/mark-all-read"),
    ("GET", "/api/lms/admin/certificates"),
    ("POST", "/api/lms/admin/certificate/CERT-1/revoke"),
    ("GET", f"/api/lms/admin/learner/{ALICE}"),
    ("PUT", f"/api/lms/admin/learner/{ALICE}"),
    ("POST", f"/api/lms/admin/learner/{ALICE}/reset-password"),
    ("DELETE", f"/api/lms/admin/learner/{ALICE}"),
    ("POST", "/api/lms/enroll"),
    ("GET", "/api/lms/admin/reflections"),
    ("GET", "/api/lms/admin/final-assessments"),
    ("POST", "/api/lms/admin/reflection/abc/review?passed=true"),
    ("GET", "/api/lms/admin/tutor-conversations"),
]

LEARNER_ROUTES = [
    ("GET", f"/api/lms/module/{FIRST_MODULE}?learner_email={ALICE}"),
    ("POST", f"/api/lms/quiz/submit?learner_email={ALICE}"),
    ("GET", f"/api/lms/progress/{ALICE}"),
    ("POST", f"/api/lms/certificate/generate?learner_email={ALICE}"),
    ("POST", "/api/lms/tutor/submit-reflection"),
    ("POST", "/api/lms/tutor/submit-final-assessment"),
    ("POST", "/api/lms/tutor/chat"),
    ("DELETE", f"/api/lms/tutor/chat/clear?learner_email={ALICE}"),
]


def _learner(email):
    return {
        "email": email, "full_name": email.split("@")[0].title(),
        "enrolled_at": datetime.now(timezone.utc),
        "course_id": lms.MHFA_CURRICULUM["course_id"],
        "progress": {"completed_modules": [], "current_module": FIRST_MODULE,
                     "quiz_scores": {}, "total_time_spent_minutes": 0},
        "certificate_issued": False, "certificate_id": None,
        "password_hash": lms.hash_password("correct-horse-1"),
    }


@pytest.fixture
def env():
    db = AsyncMongoMockClient()["veterans_support"]

    async def seed():
        await db.staff.insert_one({"id": ADMIN_ID, "email": "admin@radiocheck.me",
                                   "role": "admin", "name": "An Admin"})
        await db.staff.insert_one({"id": COUNSELLOR_ID, "email": "c@radiocheck.me",
                                   "role": "counsellor", "name": "A Counsellor"})
        await db.lms_learners.insert_one(_learner(ALICE))
        await db.lms_learners.insert_one(_learner(BOB))

    asyncio.run(seed())

    lms.get_db = lambda: db
    tutor.get_db = lambda: db
    auth.get_database = lambda: db

    app = FastAPI()
    app.include_router(lms.router)
    app.include_router(tutor.router)
    yield types.SimpleNamespace(db=db, client=TestClient(app))


def _staff_token(sub):
    return jwt.encode({"sub": sub}, get_jwt_secret(), algorithm="HS256")


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


def _learner_token(email):
    return lms.create_learner_token(email, email)


# --- admin routes ------------------------------------------------------------

@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
def test_admin_routes_refuse_no_token(env, method, path):
    assert env.client.request(method, path).status_code in (401, 403)


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
def test_admin_routes_refuse_a_learner_token(env, method, path):
    r = env.client.request(method, path, headers=_hdr(_learner_token(ALICE)))
    assert r.status_code in (401, 403), f"{method} {path} -> {r.status_code}"


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
def test_admin_routes_refuse_a_non_admin_staff_token(env, method, path):
    r = env.client.request(method, path, headers=_hdr(_staff_token(COUNSELLOR_ID)))
    assert r.status_code == 403


def test_refused_delete_leaves_learner_in_place(env):
    env.client.delete(f"/api/lms/admin/learner/{ALICE}")
    assert asyncio.run(env.db.lms_learners.find_one({"email": ALICE})) is not None


def test_admin_can_list_learners(env):
    r = env.client.get("/api/lms/admin/learners", headers=_hdr(_staff_token(ADMIN_ID)))
    assert r.status_code == 200, r.text[:200]


def test_admin_module_returns_quiz(env):
    r = env.client.get(f"/api/lms/admin/module/{FIRST_MODULE}",
                       headers=_hdr(_staff_token(ADMIN_ID)))
    assert r.status_code == 200
    assert r.json()["quiz"]["questions"]


# --- learner routes ----------------------------------------------------------

@pytest.mark.parametrize("method,path", LEARNER_ROUTES)
def test_learner_routes_refuse_no_token(env, method, path):
    assert env.client.request(method, path, json={}).status_code in (401, 403)


@pytest.mark.parametrize("method,path", [r for r in LEARNER_ROUTES if "learner_email=" in r[1] or "/progress/" in r[1]])
def test_learner_cannot_act_as_another_learner(env, method, path):
    r = env.client.request(method, path, headers=_hdr(_learner_token(BOB)),
                           json={"module_id": FIRST_MODULE, "answers": {}})
    assert r.status_code == 403, f"{method} {path} -> {r.status_code}"


def test_learner_cannot_chat_to_tutor_as_someone_else(env):
    r = env.client.post("/api/lms/tutor/chat", headers=_hdr(_learner_token(BOB)),
                        json={"learner_email": ALICE, "message": "hi"})
    assert r.status_code == 403


def test_learner_can_read_own_progress_and_first_module(env):
    h = _hdr(_learner_token(ALICE))
    assert env.client.get(f"/api/lms/progress/{ALICE}", headers=h).status_code == 200
    r = env.client.get(f"/api/lms/module/{FIRST_MODULE}?learner_email={ALICE}", headers=h)
    assert r.status_code == 200
    assert r.json()["is_admin_preview"] is False


def test_old_preview_email_no_longer_bypasses_module_lock(env):
    asyncio.run(env.db.lms_learners.insert_one(_learner("admin-preview@radiocheck.me")))
    tok = _learner_token("admin-preview@radiocheck.me")
    r = env.client.get(
        f"/api/lms/module/{SECOND_MODULE}?learner_email=admin-preview@radiocheck.me",
        headers=_hdr(tok))
    assert r.status_code == 403


def test_admin_token_can_preview_locked_module(env):
    r = env.client.get(f"/api/lms/module/{SECOND_MODULE}?learner_email={ALICE}",
                       headers=_hdr(_staff_token(ADMIN_ID)))
    assert r.status_code == 200
    assert r.json()["is_admin_preview"] is True


def test_staff_token_for_non_admin_is_not_a_learner(env):
    r = env.client.get(f"/api/lms/progress/{ALICE}", headers=_hdr(_staff_token(COUNSELLOR_ID)))
    assert r.status_code == 403


# --- set-password takeover -----------------------------------------------------

def _approved_without_password(email, token=None, expires_in=3600):
    doc = _learner(email)
    doc.pop("password_hash")
    if token:
        doc["setup_token"] = token
        doc["setup_token_expires"] = datetime.now(timezone.utc).timestamp() + expires_in
    return doc


def _set_pw(env, email, token=None):
    body = {"email": email, "password": "a-new-pass-123", "confirm_password": "a-new-pass-123"}
    if token is not None:
        body["setup_token"] = token
    return env.client.post("/api/lms/learner/set-password", json=body)


def test_set_password_refused_without_setup_token(env):
    asyncio.run(env.db.lms_learners.insert_one(_approved_without_password("carol@example.com", "tok-123")))
    assert _set_pw(env, "carol@example.com").status_code == 403
    doc = asyncio.run(env.db.lms_learners.find_one({"email": "carol@example.com"}))
    assert "password_hash" not in doc


def test_set_password_refused_with_wrong_token(env):
    asyncio.run(env.db.lms_learners.insert_one(_approved_without_password("carol@example.com", "tok-123")))
    assert _set_pw(env, "carol@example.com", "guess").status_code == 403


def test_set_password_refused_with_expired_token(env):
    asyncio.run(env.db.lms_learners.insert_one(
        _approved_without_password("carol@example.com", "tok-123", expires_in=-1)))
    assert _set_pw(env, "carol@example.com", "tok-123").status_code == 403


def test_set_password_works_once_with_correct_token(env):
    asyncio.run(env.db.lms_learners.insert_one(_approved_without_password("carol@example.com", "tok-123")))
    r = _set_pw(env, "carol@example.com", "tok-123")
    assert r.status_code == 200, r.text[:200]
    doc = asyncio.run(env.db.lms_learners.find_one({"email": "carol@example.com"}))
    assert doc.get("password_hash")
    assert "setup_token" not in doc
    assert _set_pw(env, "carol@example.com", "tok-123").status_code == 400  # already set


def test_approval_issues_a_setup_token(env, monkeypatch):
    sent = []

    async def fake_email(email, name, setup_token=None):
        sent.append((email, setup_token))

    monkeypatch.setattr(lms, "send_approval_email", fake_email)

    async def add_reg():
        res = await env.db.volunteer_registrations.insert_one(
            {"email": "dave@example.com", "full_name": "Dave", "status": "pending"})
        return str(res.inserted_id)

    reg_id = asyncio.run(add_reg())
    r = env.client.post(f"/api/lms/admin/registration/{reg_id}/approve",
                        headers=_hdr(_staff_token(ADMIN_ID)))
    assert r.status_code == 200, r.text[:200]
    doc = asyncio.run(env.db.lms_learners.find_one({"email": "dave@example.com"}))
    assert doc.get("setup_token")
    assert sent == [("dave@example.com", doc["setup_token"])]
