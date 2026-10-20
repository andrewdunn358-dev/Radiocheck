"""Rear Link (RL-1): veteran-controlled trusted contacts and Send a flare.

Everything runs in-process against mongomock with the non-delivering test
adapter. NOTHING here sends a text, places a call or touches production.

Covers the boundaries in Ant's 20 Oct 2026 instruction:
  * off unless switched on; nothing sent unless delivery is live
  * contact nomination, acceptance, withdrawal, token handling and the
    delivery states are explicit and recorded
  * automatic Rear Link: separate recorded consent, off by default,
    revocable, and NOT operational (no trigger exists)
  * under-18 refused (D4)
  * the router is isolated from the chat handler and safety/
"""
import asyncio
import os
import pathlib
import re
import sys
import types
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

HERE = pathlib.Path(__file__).resolve().parent
BACKEND = HERE.parent
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("ENCRYPTION_KEY", "test-only-encryption-key")

import routers.rear_link as rl  # noqa: E402
from services import rear_link_service as svc  # noqa: E402

P = "/api/rear-link"
VET_PHONE = "07700 900111"
DAVE, SARAH, IAN = "07700 900222", "07700 900333", "07700 900444"


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("REAR_LINK_ENABLED", "true")
    monkeypatch.setenv("REAR_LINK_DELIVERY", "test")
    monkeypatch.setenv("REAR_LINK_STEP_MINUTES", "5")
    db = AsyncMongoMockClient()["veterans_support"]
    monkeypatch.setattr(rl, "get_database", lambda: db)
    app = FastAPI()
    app.include_router(rl.router, prefix="/api")
    client = TestClient(app)   # not used as a context manager: the worker loop does not start
    return types.SimpleNamespace(db=db, client=client)


def run(coro):
    return asyncio.run(coro)


def setup_owner(env, name="Mick", phone=VET_PHONE):
    r = env.client.post(f"{P}/owner", json={"first_name": name, "own_phone": phone})
    assert r.status_code == 200, r.text
    return {"X-Rear-Link-Token": r.json()["token"]}


def invite_token_for(env, contact_id):
    """Pull the invite token out of the outbox text (as the contact would)."""
    async def go():
        rows = await env.db.rear_link_outbox.find({"ref": f"invite-{contact_id}"}).to_list(10)
        return rows[-1]["body"]
    body = run(go())
    return re.search(r"/rear-link/invite/([A-Za-z0-9_\-]+)", body).group(1)


def add_and_accept(env, h, name, phone, allow_automatic=False):
    c = env.client.post(f"{P}/contacts", headers=h, json={"name": name, "phone": phone}).json()
    tok = invite_token_for(env, c["id"])
    r = env.client.post(f"{P}/invite/{tok}/respond", json={"accept": True, "allow_automatic": allow_automatic})
    assert r.status_code == 200, r.text
    return c["id"], r.json()["contact_token"]


def respond_token_for_step(env, esc_id, contact_id):
    async def go():
        rows = await env.db.rear_link_outbox.find({"kind": "sms"}).to_list(100)
        esc = await env.db.rear_link_escalations.find_one({"id": esc_id})
        ref = next(s["ref"] for s in esc["steps"] if s.get("contact_id") == contact_id)
        body = next(r["body"] for r in rows if r["ref"] == ref)
        return re.search(r"/rear-link/r/([A-Za-z0-9_\-]+)", body).group(1)
    return run(go())


def make_due(env, esc_id):
    async def go():
        await env.db.rear_link_escalations.update_one(
            {"id": esc_id}, {"$set": {"next_action_at": datetime.utcnow() - timedelta(seconds=1)}})
        await svc.process_due(env.db)
    run(go())


def esc(env, esc_id):
    return run(env.db.rear_link_escalations.find_one({"id": esc_id}, {"_id": 0}))


# --- switched off by default -------------------------------------------------

def test_everything_is_off_unless_switched_on(env, monkeypatch):
    monkeypatch.delenv("REAR_LINK_ENABLED")
    assert env.client.get(f"{P}/status").json()["enabled"] is False
    assert env.client.post(f"{P}/owner", json={"first_name": "Mick"}).status_code == 404
    assert env.client.post(f"{P}/flare", headers={"X-Rear-Link-Token": "x"}).status_code == 404


def test_delivery_defaults_to_test_and_live_without_twilio_falls_back(env, monkeypatch):
    monkeypatch.delenv("REAR_LINK_DELIVERY")
    assert svc.delivery_mode() == "test"
    monkeypatch.setenv("REAR_LINK_DELIVERY", "live")
    for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"):
        monkeypatch.delenv(k, raising=False)
    assert isinstance(svc.get_notifier(env.db), svc.TestNotifier)


# --- setup -------------------------------------------------------------------

def test_under_18_is_refused(env):
    r = env.client.post(f"{P}/owner", json={"first_name": "Jo", "is_under_18": True})
    assert r.status_code == 403


def test_names_and_numbers_are_validated(env):
    assert env.client.post(f"{P}/owner", json={"first_name": "<script>"}).status_code == 422
    assert env.client.post(f"{P}/owner", json={"first_name": "Mick", "own_phone": "0191 123 4567"}).status_code == 422


def test_token_is_needed_and_only_its_hash_is_stored(env):
    h = setup_owner(env)
    assert env.client.get(f"{P}/owner").status_code == 401
    assert env.client.get(f"{P}/owner", headers={"X-Rear-Link-Token": "wrong"}).status_code == 401
    owner = run(env.db.rear_link_owners.find_one({}))
    assert h["X-Rear-Link-Token"] not in str(owner)
    assert owner["token_hash"] == svc.hash_token(h["X-Rear-Link-Token"])


def test_contact_details_are_encrypted_at_rest(env):
    h = setup_owner(env)
    env.client.post(f"{P}/contacts", headers=h, json={"name": "Dave", "phone": DAVE})
    c = run(env.db.rear_link_contacts.find_one({}))
    assert c["phone"].startswith("ENC:") and c["name"].startswith("ENC:")
    assert "900222" not in str(c)


# --- contacts, invites, consent ---------------------------------------------

def test_invite_is_sent_through_the_test_adapter_only(env):
    h = setup_owner(env)
    c = env.client.post(f"{P}/contacts", headers=h, json={"name": "Dave", "phone": DAVE}).json()
    assert c["status"] == "invited"
    out = run(env.db.rear_link_outbox.find({}).to_list(10))
    assert len(out) == 1 and out[0]["kind"] == "sms" and out[0]["delivered"] is False
    assert "Mick has asked you to be on their Rear Link" in out[0]["body"]
    assert "900222" not in out[0]["to_masked"]


def test_limits_three_contacts_and_no_duplicates(env):
    h = setup_owner(env)
    for n, p in (("Dave", DAVE), ("Sarah", SARAH), ("Ian", IAN)):
        assert env.client.post(f"{P}/contacts", headers=h, json={"name": n, "phone": p}).status_code == 200
    assert env.client.post(f"{P}/contacts", headers=h, json={"name": "Bob", "phone": "07700900555"}).status_code == 409
    env.client.delete(f"{P}/contacts/{env.client.get(f'{P}/owner', headers=h).json()['contacts'][0]['id']}", headers=h)
    assert env.client.post(f"{P}/contacts", headers=h, json={"name": "Sal", "phone": SARAH}).status_code == 409


def test_contact_accepts_and_their_consent_is_recorded(env):
    h = setup_owner(env)
    cid, ctok = add_and_accept(env, h, "Dave", DAVE, allow_automatic=False)
    v = env.client.get(f"{P}/owner", headers=h).json()["contacts"][0]
    assert v["status"] == "active" and v["automatic_accepted"] is False
    log = run(env.db.rear_link_consent_log.find({"contact_id": cid}).to_list(10))
    assert {(l["what"], l["granted"]) for l in log} == {("flare", True), ("automatic", False)}
    # the invite token cannot be reused
    c = run(env.db.rear_link_contacts.find_one({"id": cid}))
    assert c["invite_token_hash"] is None


def test_declining_deletes_the_number(env):
    h = setup_owner(env)
    c = env.client.post(f"{P}/contacts", headers=h, json={"name": "Dave", "phone": DAVE}).json()
    tok = invite_token_for(env, c["id"])
    assert env.client.post(f"{P}/invite/{tok}/respond", json={"accept": False}).json() == {"declined": True}
    row = run(env.db.rear_link_contacts.find_one({"id": c["id"]}))
    assert row["status"] == "declined" and row["phone"] is None and row["name"] is None


def test_contact_can_withdraw_and_is_forgotten(env):
    h = setup_owner(env)
    cid, ctok = add_and_accept(env, h, "Dave", DAVE)
    assert env.client.post(f"{P}/contact/{ctok}/withdraw").json() == {"withdrawn": True}
    row = run(env.db.rear_link_contacts.find_one({"id": cid}))
    assert row["status"] == "withdrawn" and row["phone"] is None
    assert env.client.get(f"{P}/contact/{ctok}").status_code == 404


def test_expired_invite_is_forgotten(env):
    h = setup_owner(env)
    c = env.client.post(f"{P}/contacts", headers=h, json={"name": "Dave", "phone": DAVE}).json()
    run(env.db.rear_link_contacts.update_one({"id": c["id"]}, {"$set": {"invite_expires_at": datetime.utcnow() - timedelta(minutes=1)}}))
    run(svc.process_due(env.db))
    row = run(env.db.rear_link_contacts.find_one({"id": c["id"]}))
    assert row["status"] == "expired" and row["phone"] is None


# --- automatic Rear Link: consent only, not operational ----------------------

def test_automatic_is_off_by_default_needs_its_own_consent_and_is_not_operational(env):
    h = setup_owner(env)
    auto = env.client.get(f"{P}/owner", headers=h).json()["automatic"]
    assert auto["enabled"] is False and auto["operational"] is False
    assert env.client.post(f"{P}/owner/automatic-consent", headers=h,
                           json={"agree": True, "wording_version": "old"}).status_code == 409
    auto = env.client.post(f"{P}/owner/automatic-consent", headers=h,
                           json={"agree": True, "wording_version": svc.CONSENT_WORDING_VERSION}).json()["automatic"]
    assert auto["enabled"] is True and auto["operational"] is False
    auto = env.client.post(f"{P}/owner/automatic-consent", headers=h,
                           json={"agree": False, "wording_version": svc.CONSENT_WORDING_VERSION}).json()["automatic"]
    assert auto["enabled"] is False and auto["revoked_at"]
    assert env.client.get(f"{P}/status").json()["automatic_operational"] is False


def test_no_automatic_trigger_exists():
    src = (BACKEND / "services" / "rear_link_service.py").read_text() + (BACKEND / "routers" / "rear_link.py").read_text()
    # No code path creates an escalation with trigger="automatic".
    assert 'trigger": "automatic"' not in src and "trigger='automatic'" not in src


# --- Send a flare ------------------------------------------------------------

def test_flare_needs_an_accepted_contact(env):
    h = setup_owner(env)
    env.client.post(f"{P}/contacts", headers=h, json={"name": "Dave", "phone": DAVE})
    assert env.client.post(f"{P}/flare", headers=h).status_code == 409


def test_flare_reaches_first_contact_with_fixed_wording_and_no_promises(env):
    h = setup_owner(env)
    dave, _ = add_and_accept(env, h, "Dave", DAVE)
    add_and_accept(env, h, "Sarah", SARAH)
    v = env.client.post(f"{P}/flare", headers=h).json()
    assert v["simulated"] is True
    assert v["message"] == "We're letting your Rear Link know."
    assert [s["state"] for s in v["steps"]][:2] == ["dispatched", "pending"]
    e = esc(env, v["id"])
    assert [h_["state"] for h_ in e["steps"][0]["history"]] == ["requested", "queued", "dispatched"]
    assert e["safeguarding_alert_id"] is None and e["trigger"] == "flare"
    out = run(env.db.rear_link_outbox.find({"ref": e["steps"][0]["ref"]}).to_list(10))
    assert {o["kind"] for o in out} == {"sms", "call"}
    sms = next(o["body"] for o in out if o["kind"] == "sms")
    assert sms.startswith("RadioCheck: Mick could do with a call.")
    for banned in ("on their way", "will call you", "help is coming", "risk", "crisis", "suicid"):
        assert banned not in sms.lower() and banned not in v["message"].lower()


def test_contact_acknowledges_then_confirms(env):
    h = setup_owner(env)
    dave, _ = add_and_accept(env, h, "Dave", DAVE)
    v = env.client.post(f"{P}/flare", headers=h).json()
    rt = respond_token_for_step(env, v["id"], dave)
    assert env.client.get(f"{P}/r/{rt}").json()["veteran_first_name"] == "Mick"
    env.client.post(f"{P}/r/{rt}", json={"answer": "calling"})
    s = env.client.get(f"{P}/flare/{v['id']}", headers=h).json()
    assert s["status"] == "acknowledged" and s["message"] == "Dave has seen it and says they'll call you."
    env.client.post(f"{P}/r/{rt}", json={"answer": "spoke"})
    s = env.client.get(f"{P}/flare/{v['id']}", headers=h).json()
    assert s["status"] == "contact_confirmed"
    # acknowledged: the ladder stops, so a later timeout does nothing
    make_due(env, v["id"])
    assert esc(env, v["id"])["status"] == "contact_confirmed"


def test_cannot_moves_straight_to_the_next_contact(env):
    h = setup_owner(env)
    dave, _ = add_and_accept(env, h, "Dave", DAVE)
    sarah, _ = add_and_accept(env, h, "Sarah", SARAH)
    v = env.client.post(f"{P}/flare", headers=h).json()
    env.client.post(f"{P}/r/{respond_token_for_step(env, v['id'], dave)}", json={"answer": "cannot"})
    e = esc(env, v["id"])
    assert e["steps"][0]["state"] == "declined" and e["steps"][1]["state"] == "dispatched"


def test_full_ladder_contacts_then_peer_then_staff(env):
    h = setup_owner(env)
    add_and_accept(env, h, "Dave", DAVE)
    add_and_accept(env, h, "Sarah", SARAH)
    v = env.client.post(f"{P}/flare", headers=h).json()
    make_due(env, v["id"])                     # Dave timed out -> Sarah
    e = esc(env, v["id"])
    assert [s["state"] for s in e["steps"]] == ["no_answer", "dispatched", "pending", "pending"]
    make_due(env, v["id"])                     # Sarah timed out -> peer callback
    e = esc(env, v["id"])
    assert e["steps"][2]["state"] == "queued" and e["veteran_status"] == "peer"
    cb = run(env.db.callbacks.find_one({"source": "rear_link"}))
    assert cb["status"] == "pending" and cb["phone"] == "+447700900111" and cb["rear_link_escalation_id"] == v["id"]
    make_due(env, v["id"])                     # peer not answered -> staff
    e = esc(env, v["id"])
    assert e["status"] == "handed_to_staff"
    pa = run(env.db.panic_alerts.find_one({"source": "rear_link"}))
    assert pa["status"] == "active" and "not an AI safety assessment" in pa["message"]
    s = env.client.get(f"{P}/flare/{v['id']}", headers=h).json()
    assert s["message"] == "Your Rear Link hasn't answered yet. We've let the RadioCheck team know."


def test_signpost_mode_ends_after_the_veterans_own_contacts(env):
    h = setup_owner(env)
    add_and_accept(env, h, "Dave", DAVE)
    run(env.db.settings.insert_one({"_id": "site_settings", "safeguarding_response_mode": "signpost"}))
    v = env.client.post(f"{P}/flare", headers=h).json()
    assert [s["rung"] for s in v["steps"]] == ["contact"]
    make_due(env, v["id"])
    assert esc(env, v["id"])["status"] == "exhausted"
    assert run(env.db.callbacks.count_documents({})) == 0
    assert run(env.db.panic_alerts.count_documents({})) == 0


def test_away_contact_is_skipped(env):
    h = setup_owner(env)
    dave, dtok = add_and_accept(env, h, "Dave", DAVE)
    add_and_accept(env, h, "Sarah", SARAH)
    env.client.post(f"{P}/contact/{dtok}/availability", json={"away_days": 3})
    v = env.client.post(f"{P}/flare", headers=h).json()
    assert [s["state"] for s in v["steps"]][:2] == ["skipped", "dispatched"]


def test_stand_down_stops_the_ladder(env):
    h = setup_owner(env)
    add_and_accept(env, h, "Dave", DAVE)
    v = env.client.post(f"{P}/flare", headers=h).json()
    s = env.client.post(f"{P}/flare/{v['id']}/stand-down", headers=h).json()
    assert s["status"] == "stood_down"
    make_due(env, v["id"])
    assert esc(env, v["id"])["status"] == "stood_down"


def test_flares_are_rate_limited_with_helplines(env):
    h = setup_owner(env)
    add_and_accept(env, h, "Dave", DAVE)
    for _ in range(svc.FLARES_PER_HOUR):
        assert env.client.post(f"{P}/flare", headers=h).status_code == 200
    r = env.client.post(f"{P}/flare", headers=h)
    assert r.status_code == 429 and "116 123" in r.json()["detail"]


def test_dispatch_failure_moves_on_and_is_recorded(env, monkeypatch):
    h = setup_owner(env)
    add_and_accept(env, h, "Dave", DAVE)
    add_and_accept(env, h, "Sarah", SARAH)

    calls = {"n": 0}
    orig = svc.TestNotifier.send_sms

    async def flaky(self, to, body, ref):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("provider down")
        return await orig(self, to, body, ref)
    monkeypatch.setattr(svc.TestNotifier, "send_sms", flaky)
    v = env.client.post(f"{P}/flare", headers=h).json()
    e = esc(env, v["id"])
    assert e["steps"][0]["state"] == "failed" and e["steps"][1]["state"] == "dispatched"


def test_twilio_keypress_1_acknowledges(env):
    h = setup_owner(env)
    add_and_accept(env, h, "Dave", DAVE)
    v = env.client.post(f"{P}/flare", headers=h).json()
    ref = esc(env, v["id"])["steps"][0]["ref"]
    r = env.client.post(f"{P}/twilio/gather/{ref}", data={"Digits": "1"})
    assert r.status_code == 200 and "Please call them now" in r.text
    assert esc(env, v["id"])["status"] == "acknowledged"


def test_twilio_webhooks_need_a_signature_when_live(env, monkeypatch):
    monkeypatch.setenv("REAR_LINK_DELIVERY", "live")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "x")
    r = env.client.post(f"{P}/twilio/gather/anything", data={"Digits": "1"})
    assert r.status_code == 403


# --- leaving -----------------------------------------------------------------

def test_leaving_rear_link_forgets_contacts_and_kills_the_token(env):
    h = setup_owner(env)
    cid, _ = add_and_accept(env, h, "Dave", DAVE)
    assert env.client.delete(f"{P}/owner", headers=h).json() == {"deleted": True}
    assert env.client.get(f"{P}/owner", headers=h).status_code == 401
    row = run(env.db.rear_link_contacts.find_one({"id": cid}))
    assert row["phone"] is None and row["status"] == "removed"


# --- isolation from the chat handler and safety layer ------------------------

def test_rear_link_does_not_import_the_chat_handler_or_safety():
    for f in ("routers/rear_link.py", "services/rear_link_service.py"):
        src = (BACKEND / f).read_text()
        imports = [l for l in src.splitlines() if l.strip().startswith(("import ", "from "))]
        assert not any("server" in l or "safety" in l or "personas" in l for l in imports), f


def test_chat_handler_does_not_call_rear_link():
    src = (BACKEND / "server.py").read_text()
    start = src.index("async def buddy_chat(")
    end = src.index("\n@", start)
    assert "rear_link" not in src[start:end]
