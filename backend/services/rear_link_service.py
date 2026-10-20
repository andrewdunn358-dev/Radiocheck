"""
Rear Link service: trusted contacts, consent, Send a flare and the
escalation ladder.

SCOPE (RL-1, Ant 20 Oct 2026)
-----------------------------
* Veteran-controlled Rear Link only. A flare is the veteran asking for
  contact. It does not use, read or produce any AI safety verdict.
* This module never imports from, or is imported by, the chat handler or
  anything under safety/. It does not change detection, reconciliation,
  suppression, the judge, terminals or personas.
* Automatic Rear Link: the CONSENT model is stored here (off by default,
  separate affirmative consent from the veteran and from each contact,
  revocable). There is deliberately NO automatic trigger. Connecting one to
  the chat handler waits until F2 has been reviewed, merged and verified
  closed, and needs Ant's separate approval.
* Delivery is "test" by default: messages are written to the
  rear_link_outbox collection and nothing is sent to anyone. Real sending
  needs REAR_LINK_DELIVERY=live AND Twilio credentials.

DELIVERY STATES (Ant, RL-1 section C)
-------------------------------------
Each attempt to reach a contact is a step that moves through:

    requested -> queued -> dispatched -> delivered -> acknowledged -> contact_confirmed

plus the terminal states declined, no_answer, failed, skipped, cancelled.

* queued      the adapter accepted the job
* dispatched  the provider accepted it (has a provider reference)
* delivered   the provider reported delivery / the call was answered
* acknowledged the contact pressed 1 / tapped "I'll call them now"
* contact_confirmed the contact reported "We spoke"

Nothing in this module (or the wording it sends to the veteran) claims that
a person WILL make contact. The veteran is only ever told who has been
asked and what they have said.

PRIVACY
-------
* Contacts are told only "<first name> could do with a call". Every message
  is a fixed template; no free text from the client is ever sent on.
* Phone numbers and names are encrypted at rest (encryption.encrypt_field).
* Escalation records refer to contacts by id, never by number.
* A contact's number is deleted when they decline, withdraw, are removed,
  or their invite expires.
* Tokens are random and only their SHA-256 hash is stored.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from encryption import decrypt_field, encrypt_field

logger = logging.getLogger("rear_link")

# ---------------------------------------------------------------------------
# Configuration (environment, read at call time so tests can change it)
# ---------------------------------------------------------------------------

MAX_CONTACTS = 3
INVITE_DAYS = 14
FLARES_PER_HOUR = 3
CONSENT_WORDING_VERSION = "rl-auto-consent-v1"


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def feature_enabled() -> bool:
    return _env("REAR_LINK_ENABLED", "false").lower() == "true"


def delivery_mode() -> str:
    mode = _env("REAR_LINK_DELIVERY", "test").lower()
    return "live" if mode == "live" else "test"


def step_minutes() -> float:
    try:
        return float(_env("REAR_LINK_STEP_MINUTES", "5"))
    except ValueError:
        return 5.0


def app_url() -> str:
    return _env("REAR_LINK_APP_URL", "https://app.radiocheck.me").rstrip("/")


def api_url() -> str:
    return _env("REAR_LINK_API_URL", "https://veterans-support-api.onrender.com").rstrip("/")


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def now() -> datetime:
    return datetime.utcnow()


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


_UK_MOBILE = re.compile(r"^\+447\d{9}$")


def normalise_uk_mobile(raw: str) -> Optional[str]:
    """Return +447XXXXXXXXX or None. UK mobiles only (calls and texts)."""
    if not raw:
        return None
    digits = re.sub(r"[^\d+]", "", raw.strip())
    if digits.startswith("00"):
        digits = "+" + digits[2:]
    if digits.startswith("07"):
        digits = "+44" + digits[1:]
    elif digits.startswith("447"):
        digits = "+" + digits
    return digits if _UK_MOBILE.match(digits) else None


def clean_first_name(raw: str) -> Optional[str]:
    name = (raw or "").strip()
    name = re.sub(r"\s+", " ", name)
    if not name or len(name) > 30:
        return None
    if not re.match(r"^[A-Za-z][A-Za-z '\-]*$", name):
        return None
    return name


def mask_phone(phone: str) -> str:
    if not phone or len(phone) < 7:
        return "•••"
    return phone[:4] + "•" * (len(phone) - 7) + phone[-3:]


# ---------------------------------------------------------------------------
# Fixed message templates. No client text is ever inserted except the
# veteran's validated first name.
# ---------------------------------------------------------------------------

def invite_sms(first_name: str, invite_token: str) -> str:
    return (
        f"{first_name} has asked you to be on their Rear Link on RadioCheck, "
        f"a support app for veterans. It means if they're having a really "
        f"tough time, they may ask us to let you know they could do with a call. "
        f"You won't be told anything private. "
        f"Find out more and say yes or no: {app_url()}/rear-link/invite/{invite_token} "
        f"Not for you? Ignore this and we'll delete your number in {INVITE_DAYS} days."
    )


def flare_sms(first_name: str, respond_token: str) -> str:
    return (
        f"RadioCheck: {first_name} could do with a call. "
        f"Tell us if you can: {app_url()}/rear-link/r/{respond_token} "
        f"If you think they're in danger, call 999."
    )


def flare_voice_text(first_name: str) -> str:
    return (
        f"Hello, this is RadioCheck, the veterans' support service. "
        f"{first_name} has you on their Rear Link, and could do with a call from you. "
        f"Press 1 if you can call them now. Press 2 if you can't."
    )


# ---------------------------------------------------------------------------
# Notification adapters
# ---------------------------------------------------------------------------

class TestNotifier:
    """Non-delivering adapter. Records what WOULD have been sent."""

    name = "test"

    def __init__(self, db):
        self.db = db

    async def send_sms(self, to: str, body: str, ref: str) -> Dict[str, Any]:
        await self.db.rear_link_outbox.insert_one({
            "id": str(uuid.uuid4()), "kind": "sms", "to_masked": mask_phone(to),
            "body": body, "ref": ref, "created_at": now(), "delivered": False,
        })
        return {"provider_ref": f"test-sms-{uuid.uuid4().hex[:10]}", "simulated": True}

    async def place_call(self, to: str, say: str, ref: str, step_token: str) -> Dict[str, Any]:
        await self.db.rear_link_outbox.insert_one({
            "id": str(uuid.uuid4()), "kind": "call", "to_masked": mask_phone(to),
            "body": say, "ref": ref, "created_at": now(), "delivered": False,
        })
        return {"provider_ref": f"test-call-{uuid.uuid4().hex[:10]}", "simulated": True}


class TwilioNotifier:
    """Real delivery through the existing Twilio account."""

    name = "twilio"

    def __init__(self, client, from_number: str):
        self.client = client
        self.from_number = from_number

    async def send_sms(self, to: str, body: str, ref: str) -> Dict[str, Any]:
        def _send():
            return self.client.messages.create(
                to=to, from_=self.from_number, body=body,
                status_callback=f"{api_url()}/api/rear-link/twilio/sms-status/{ref}",
            )
        msg = await asyncio.to_thread(_send)
        return {"provider_ref": msg.sid, "simulated": False}

    async def place_call(self, to: str, say: str, ref: str, step_token: str) -> Dict[str, Any]:
        from twilio.twiml.voice_response import VoiceResponse, Gather

        vr = VoiceResponse()
        gather = Gather(num_digits=1, timeout=10,
                        action=f"{api_url()}/api/rear-link/twilio/gather/{step_token}")
        gather.say(say, voice="Polly.Brian", language="en-GB")
        vr.append(gather)
        vr.say("We didn't catch that. We'll send you a text as well. Goodbye.",
               voice="Polly.Brian", language="en-GB")

        def _call():
            return self.client.calls.create(
                to=to, from_=self.from_number, twiml=str(vr),
                status_callback=f"{api_url()}/api/rear-link/twilio/call-status/{step_token}",
                status_callback_event=["completed"],
                machine_detection="Enable",
            )
        call = await asyncio.to_thread(_call)
        return {"provider_ref": call.sid, "simulated": False}


def get_notifier(db):
    """Live only when explicitly switched on AND Twilio is configured."""
    if delivery_mode() != "live":
        return TestNotifier(db)
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    tok = os.environ.get("TWILIO_AUTH_TOKEN")
    frm = os.environ.get("TWILIO_PHONE_NUMBER")
    if not (sid and tok and frm):
        logger.error("[RearLink] REAR_LINK_DELIVERY=live but Twilio is not configured; using test delivery")
        return TestNotifier(db)
    from twilio.rest import Client
    return TwilioNotifier(Client(sid, tok), frm)


# ---------------------------------------------------------------------------
# Owners (the veteran)
# ---------------------------------------------------------------------------

async def owner_from_token(db, token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    return await db.rear_link_owners.find_one({"token_hash": hash_token(token), "deleted": {"$ne": True}})


def owner_view(owner: dict, contacts: List[dict]) -> dict:
    return {
        "id": owner["id"],
        "first_name": decrypt_field(owner.get("first_name", "")),
        "has_own_phone": bool(owner.get("own_phone")),
        "flare_enabled": owner.get("flare_enabled", True),
        "automatic": {
            "enabled": bool(owner.get("auto_consent_at")) and not owner.get("auto_revoked_at"),
            "consented_at": owner.get("auto_consent_at"),
            "revoked_at": owner.get("auto_revoked_at"),
            "wording_version": owner.get("auto_consent_version"),
            "operational": False,   # no automatic trigger exists yet (RL-1)
        },
        "contacts": [contact_view(c) for c in contacts],
        "delivery_mode": delivery_mode(),
    }


def contact_view(c: dict) -> dict:
    away = c.get("away_until")
    is_away = bool(away and away > now())
    return {
        "id": c["id"],
        "name": decrypt_field(c.get("name", "")),
        "relationship": decrypt_field(c.get("relationship", "")),
        "phone_masked": mask_phone(decrypt_field(c.get("phone", ""))) if c.get("phone") else None,
        "order": c.get("order", 0),
        "status": c["status"],
        "away": is_away,
        "away_until": away if is_away else None,
        "automatic_accepted": bool(c.get("auto_consent_at")) and c["status"] == "active",
        "invite_expires_at": c.get("invite_expires_at") if c["status"] == "invited" else None,
    }


async def list_contacts(db, owner_id: str) -> List[dict]:
    cur = db.rear_link_contacts.find(
        {"owner_id": owner_id, "status": {"$in": ["invited", "active"]}}, {"_id": 0}
    ).sort("order", 1)
    return await cur.to_list(MAX_CONTACTS + 5)


async def forget_contact_details(db, contact_id: str, new_status: str) -> None:
    """Delete the contact's number and name; keep the id for escalation history."""
    await db.rear_link_contacts.update_one(
        {"id": contact_id},
        {"$set": {"status": new_status, "phone": None, "name": None, "relationship": None,
                  "invite_token_hash": None, "contact_token_hash": None, "updated_at": now()}},
    )


# ---------------------------------------------------------------------------
# Escalation (Send a flare) and the ladder
# ---------------------------------------------------------------------------

VETERAN_STATUS_TEXT = {
    "asking": "We're letting your Rear Link know.",
    "acknowledged": "{name} has seen it and says they'll call you.",
    "contact_confirmed": "{name} says you've spoken.",
    "peer": "Your Rear Link hasn't answered yet. We've asked a RadioCheck peer supporter to call you.",
    "staff": "Your Rear Link hasn't answered yet. We've let the RadioCheck team know.",
    "exhausted": "We couldn't reach anyone on your Rear Link.",
    "stood_down": "You've let us know you're OK. We've stopped.",
}


async def _site_settings(db) -> dict:
    try:
        return await db.settings.find_one({"_id": "site_settings"}) or {}
    except Exception as e:  # never let a settings read stop a flare
        logger.error(f"[RearLink] settings read failed: {type(e).__name__}: {e}")
        return {}


async def start_flare(db, owner: dict) -> dict:
    """Create a flare escalation and run its first step."""
    since = now() - timedelta(hours=1)
    recent = await db.rear_link_escalations.count_documents(
        {"owner_id": owner["id"], "trigger": "flare", "created_at": {"$gte": since}})
    if recent >= FLARES_PER_HOUR:
        raise ValueError("flare_rate_limited")

    contacts = [c for c in await list_contacts(db, owner["id"]) if c["status"] == "active"]
    settings = await _site_settings(db)
    signpost = settings.get("safeguarding_response_mode") == "signpost"
    human_support = bool(settings.get("counsellor_enabled", True)) and bool(settings.get("peer_to_peer_enabled", True))

    steps = []
    for c in contacts:
        away = c.get("away_until")
        steps.append({
            "rung": "contact", "contact_id": c["id"],
            "state": "skipped" if (away and away > now()) else "pending",
            "reason": "away" if (away and away > now()) else None,
            "history": [],
        })
    # Proposed D3 (pending Ant): in signpost mode, or when human support is
    # switched off, the ladder ends after the veteran's own contacts.
    if human_support and not signpost:
        steps.append({"rung": "peer", "state": "pending", "history": []})
        steps.append({"rung": "staff", "state": "pending", "history": []})

    esc = {
        "id": str(uuid.uuid4()),
        "owner_id": owner["id"],
        "trigger": "flare",
        # Correlation (D-c / FR-T5-2 shape, D8): a flare has no safeguarding
        # alert. These fields are set at creation and never changed.
        "safeguarding_alert_id": None,
        "session_id": None,
        "status": "open",
        "veteran_status": "asking",
        "current": -1,
        "steps": steps,
        "delivery_mode": delivery_mode(),
        "signpost_mode": signpost,
        "human_support_available": human_support,
        "next_action_at": now(),
        "created_at": now(),
        "updated_at": now(),
    }
    await db.rear_link_escalations.insert_one(esc)
    logger.warning(f"[RearLink] FLARE {esc['id']} owner={owner['id'][:8]} contacts={len(contacts)} mode={esc['delivery_mode']}")
    await advance(db, esc["id"])
    return await get_escalation(db, esc["id"])


async def get_escalation(db, esc_id: str) -> Optional[dict]:
    return await db.rear_link_escalations.find_one({"id": esc_id}, {"_id": 0})


def _record(step: dict, state: str, **extra) -> None:
    step["state"] = state
    entry = {"state": state, "at": now()}
    entry.update({k: v for k, v in extra.items() if v is not None})
    step["history"].append(entry)


async def _save(db, esc: dict) -> None:
    esc["updated_at"] = now()
    await db.rear_link_escalations.update_one({"id": esc["id"]}, {"$set": {
        k: esc[k] for k in ("status", "veteran_status", "current", "steps", "next_action_at", "updated_at")
    }})


async def advance(db, esc_id: str) -> None:
    """Move to the next live step. Safe to call repeatedly."""
    esc = await get_escalation(db, esc_id)
    if not esc or esc["status"] != "open":
        return
    owner = await db.rear_link_owners.find_one({"id": esc["owner_id"]})
    first_name = decrypt_field(owner.get("first_name", "")) if owner else "A veteran"
    notifier = get_notifier(db)

    # Close out the current step if it is still waiting.
    if esc["current"] >= 0:
        cur = esc["steps"][esc["current"]]
        if cur["state"] in ("queued", "dispatched", "delivered"):
            _record(cur, "no_answer")

    i = esc["current"] + 1
    while i < len(esc["steps"]):
        step = esc["steps"][i]
        if step["state"] == "skipped":
            i += 1
            continue
        esc["current"] = i
        if step["rung"] == "contact":
            ok = await _contact_step(db, esc, step, first_name, notifier)
            if ok:
                esc["next_action_at"] = now() + timedelta(minutes=step_minutes())
                await _save(db, esc)
                return
            i += 1
            continue
        if step["rung"] == "peer":
            await _peer_step(db, esc, step, owner, first_name)
            esc["veteran_status"] = "peer"
            esc["next_action_at"] = now() + timedelta(minutes=step_minutes())
            await _save(db, esc)
            return
        if step["rung"] == "staff":
            await _staff_step(db, esc, step, owner)
            esc["veteran_status"] = "staff"
            esc["status"] = "handed_to_staff"
            esc["next_action_at"] = None
            await _save(db, esc)
            return
        i += 1

    esc["current"] = len(esc["steps"])
    esc["status"] = "exhausted"
    esc["veteran_status"] = "exhausted"
    esc["next_action_at"] = None
    await _save(db, esc)
    logger.warning(f"[RearLink] ESCALATION EXHAUSTED {esc['id']}")


async def _contact_step(db, esc: dict, step: dict, first_name: str, notifier) -> bool:
    contact = await db.rear_link_contacts.find_one({"id": step["contact_id"], "status": "active"})
    if not contact or not contact.get("phone"):
        _record(step, "skipped", reason="contact_unavailable")
        return False
    phone = decrypt_field(contact["phone"])
    respond_token = new_token()
    step["respond_token_hash"] = hash_token(respond_token)
    step_ref = uuid.uuid4().hex
    step["ref"] = step_ref
    _record(step, "requested")
    _record(step, "queued", adapter=notifier.name)
    try:
        sms = await notifier.send_sms(phone, flare_sms(first_name, respond_token), step_ref)
        call = await notifier.place_call(phone, flare_voice_text(first_name), step_ref, step_ref)
        step["sms_ref"] = sms.get("provider_ref")
        step["call_ref"] = call.get("provider_ref")
        _record(step, "dispatched", simulated=sms.get("simulated", False))
        return True
    except Exception as e:
        logger.error(f"[RearLink] dispatch failed esc={esc['id']} contact={step['contact_id']}: {type(e).__name__}: {e}")
        _record(step, "failed", error=type(e).__name__)
        return False


async def _peer_step(db, esc: dict, step: dict, owner: Optional[dict], first_name: str) -> None:
    """Existing peer-support callback queue."""
    phone = decrypt_field(owner.get("own_phone")) if owner and owner.get("own_phone") else ""
    _record(step, "requested")
    try:
        await db.callbacks.insert_one({
            "id": str(uuid.uuid4()),
            "name": first_name,
            "phone": phone or "Not given - veteran is in the app",
            "preferred_time": "As soon as possible",
            "reason": "Rear Link flare: the veteran's own contacts have not answered",
            "user_id": f"rear-link:{esc['owner_id']}",
            "additional_notes": f"Rear Link escalation {esc['id']}",
            "is_anonymous": not bool(phone),
            "status": "pending",
            "source": "rear_link",
            "rear_link_escalation_id": esc["id"],
            "created_at": now(), "updated_at": now(),
        })
        _record(step, "queued", target="peer_callback_queue")
    except Exception as e:
        logger.error(f"[RearLink] peer step failed {esc['id']}: {type(e).__name__}: {e}")
        _record(step, "failed", error=type(e).__name__)


async def _staff_step(db, esc: dict, step: dict, owner: Optional[dict]) -> None:
    """Existing staff panic-alert queue (shown in the staff portal Alerts tab)."""
    _record(step, "requested")
    try:
        await db.panic_alerts.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": f"rear-link:{esc['owner_id']}",
            "location": "",
            "message": "Rear Link flare: the veteran asked for contact. Their own contacts and "
                       "the peer-support callback have not been answered. This is a request "
                       "from the veteran, not an AI safety assessment.",
            "status": "active",
            "source": "rear_link",
            "rear_link_escalation_id": esc["id"],
            "created_at": now(),
        })
        _record(step, "queued", target="staff_panic_alerts")
    except Exception as e:
        logger.error(f"[RearLink] staff step failed {esc['id']}: {type(e).__name__}: {e}")
        _record(step, "failed", error=type(e).__name__)


async def contact_response(db, respond_token: str, answer: str) -> Optional[dict]:
    """A contact answered by link (or by keypress, via the same path)."""
    th = hash_token(respond_token)
    esc = await db.rear_link_escalations.find_one({"steps.respond_token_hash": th}, {"_id": 0})
    if not esc:
        return None
    idx = next(i for i, s in enumerate(esc["steps"]) if s.get("respond_token_hash") == th)
    step = esc["steps"][idx]
    contact = await db.rear_link_contacts.find_one({"id": step["contact_id"]}) or {}
    name = decrypt_field(contact.get("name") or "") or "Your contact"

    if answer == "calling":
        if step["state"] in ("dispatched", "delivered", "no_answer", "queued"):
            _record(step, "acknowledged")
            if esc["status"] == "open" or esc["status"] == "exhausted":
                esc["status"] = "acknowledged"
                esc["veteran_status"] = "acknowledged"
                esc["next_action_at"] = None
                esc["acknowledged_by"] = step["contact_id"]
            await _save_full(db, esc)
    elif answer == "spoke":
        _record(step, "contact_confirmed")
        esc["status"] = "contact_confirmed"
        esc["veteran_status"] = "contact_confirmed"
        esc["next_action_at"] = None
        await _save_full(db, esc)
    elif answer == "cannot":
        if step["state"] in ("dispatched", "delivered", "queued") and esc["status"] == "open" and esc["current"] == idx:
            _record(step, "declined")
            await _save_full(db, esc)
            await advance(db, esc["id"])
        else:
            _record(step, "declined")
            await _save_full(db, esc)
    return {"escalation": await get_escalation(db, esc["id"]), "contact_name": name}


async def _save_full(db, esc: dict) -> None:
    esc["updated_at"] = now()
    fields = {k: esc.get(k) for k in ("status", "veteran_status", "current", "steps",
                                       "next_action_at", "updated_at", "acknowledged_by")}
    await db.rear_link_escalations.update_one({"id": esc["id"]}, {"$set": fields})


def veteran_view(esc: dict, contacts_by_id: Dict[str, str]) -> dict:
    """What the veteran sees. Who has been asked and what they said; no promises."""
    name = contacts_by_id.get(esc.get("acknowledged_by") or "", "Your contact")
    if esc["status"] == "contact_confirmed":
        for s in esc["steps"]:
            if s["state"] == "contact_confirmed":
                name = contacts_by_id.get(s.get("contact_id"), name)
    people = []
    for s in esc["steps"]:
        if s["rung"] == "contact":
            label = contacts_by_id.get(s["contact_id"], "Contact")
        elif s["rung"] == "peer":
            label = "RadioCheck peer supporter"
        else:
            label = "RadioCheck team"
        people.append({"who": label, "rung": s["rung"], "state": s["state"]})
    text = VETERAN_STATUS_TEXT.get(esc["veteran_status"], VETERAN_STATUS_TEXT["asking"]).format(name=name)
    return {
        "id": esc["id"], "status": esc["status"], "message": text, "steps": people,
        "simulated": esc.get("delivery_mode") == "test",
        "created_at": esc["created_at"],
    }


# ---------------------------------------------------------------------------
# Background worker: durable, restart-safe. State lives in Mongo; the loop
# only picks up escalations whose next_action_at has passed.
# ---------------------------------------------------------------------------

async def process_due(db) -> int:
    processed = 0
    due = await db.rear_link_escalations.find(
        {"status": "open", "next_action_at": {"$ne": None, "$lte": now()}}, {"_id": 0, "id": 1}
    ).to_list(50)
    for row in due:
        # Claim: push next_action_at forward so a second worker doesn't double-fire.
        claimed = await db.rear_link_escalations.find_one_and_update(
            {"id": row["id"], "status": "open", "next_action_at": {"$ne": None, "$lte": now()}},
            {"$set": {"next_action_at": now() + timedelta(minutes=1)}},
        )
        if not claimed:
            continue
        try:
            await advance(db, row["id"])
            processed += 1
        except Exception as e:
            logger.error(f"[RearLink] advance failed {row['id']}: {type(e).__name__}: {e}")
    # Expire stale invites and delete their numbers.
    expired = await db.rear_link_contacts.find(
        {"status": "invited", "invite_expires_at": {"$lte": now()}}, {"_id": 0, "id": 1}
    ).to_list(200)
    for c in expired:
        await forget_contact_details(db, c["id"], "expired")
    return processed


_worker_task: Optional[asyncio.Task] = None


async def _worker_loop(get_db) -> None:
    while True:
        try:
            if feature_enabled():
                await process_due(get_db())
        except Exception as e:
            logger.error(f"[RearLink] worker error: {type(e).__name__}: {e}")
        await asyncio.sleep(20)


def start_worker(get_db) -> None:
    global _worker_task
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.get_event_loop().create_task(_worker_loop(get_db))
        logger.info("[RearLink] worker started")
