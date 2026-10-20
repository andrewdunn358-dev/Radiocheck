"""
Rear Link router (RL-1, veteran-controlled Rear Link).

Mounted at /api/rear-link. Everything here is OFF unless REAR_LINK_ENABLED=true,
and sends nothing to anyone unless REAR_LINK_DELIVERY=live (see
services/rear_link_service.py for the scope and boundaries).

Three kinds of caller, three kinds of credential:

* the veteran   - "X-Rear-Link-Token" header. Issued once at setup, held on the
                  device, only its hash is stored. No RadioCheck account and no
                  link to the anonymous AI chat.
* a contact     - an invite token (from the invite text) and afterwards a
                  contact token (returned when they accept), both in the URL.
* Twilio        - webhook routes, signature-checked when live.

This router does not import from server.py or safety/, and nothing in the chat
handler calls it.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from encryption import decrypt_field, encrypt_field
from services.database import get_database
from services import rear_link_service as svc

router = APIRouter(prefix="/rear-link", tags=["rear-link"])


# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------

def _require_enabled() -> None:
    if not svc.feature_enabled():
        raise HTTPException(status_code=404, detail="Rear Link is not switched on")


async def _require_owner(token: Optional[str]) -> dict:
    _require_enabled()
    owner = await svc.owner_from_token(get_database(), token)
    if not owner:
        raise HTTPException(status_code=401, detail="Rear Link token missing or not recognised")
    return owner


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class OwnerCreate(BaseModel):
    first_name: str
    own_phone: Optional[str] = None      # optional: lets a peer supporter ring them back
    is_under_18: bool = False


class OwnerUpdate(BaseModel):
    first_name: Optional[str] = None
    own_phone: Optional[str] = None
    flare_enabled: Optional[bool] = None


class AutomaticConsent(BaseModel):
    agree: bool
    wording_version: str


class ContactCreate(BaseModel):
    name: str
    phone: str
    relationship: str = ""


class ContactOrder(BaseModel):
    contact_ids: list[str]


class InviteResponse(BaseModel):
    accept: bool
    allow_automatic: bool = False
    bypass_set_up: bool = False          # contact says they've set Emergency Bypass / priority


class Availability(BaseModel):
    away_days: Optional[int] = None      # None = back now


class Answer(BaseModel):
    answer: str                           # "calling" | "cannot" | "spoke"


# ---------------------------------------------------------------------------
# Status (lets the app hide the feature when it is off)
# ---------------------------------------------------------------------------

@router.get("/status")
async def status():
    return {
        "enabled": svc.feature_enabled(),
        "delivery_mode": svc.delivery_mode(),
        "automatic_operational": False,
        "max_contacts": svc.MAX_CONTACTS,
        "automatic_consent_wording_version": svc.CONSENT_WORDING_VERSION,
    }


# ---------------------------------------------------------------------------
# Veteran: setup and settings
# ---------------------------------------------------------------------------

@router.post("/owner")
async def create_owner(body: OwnerCreate):
    _require_enabled()
    if body.is_under_18:
        # D4 (Ant): under-18 access off at launch.
        raise HTTPException(status_code=403, detail="Rear Link isn't available for under-18s yet")
    name = svc.clean_first_name(body.first_name)
    if not name:
        raise HTTPException(status_code=422, detail="Please give a first name (letters only, up to 30)")
    own_phone = None
    if body.own_phone:
        own_phone = svc.normalise_uk_mobile(body.own_phone)
        if not own_phone:
            raise HTTPException(status_code=422, detail="Please give a UK mobile number, like 07700 900123")
    token = svc.new_token()
    owner = {
        "id": svc.uuid.uuid4().hex,
        "token_hash": svc.hash_token(token),
        "first_name": encrypt_field(name),
        "own_phone": encrypt_field(own_phone) if own_phone else None,
        "flare_enabled": True,
        # Automatic Rear Link is OFF by default and needs its own consent.
        "auto_consent_at": None, "auto_consent_version": None, "auto_revoked_at": None,
        "created_at": svc.now(), "updated_at": svc.now(),
    }
    db = get_database()
    await db.rear_link_owners.insert_one(owner)
    return {"token": token, "owner": svc.owner_view(owner, [])}


@router.get("/owner")
async def get_owner(x_rear_link_token: Optional[str] = Header(None)):
    owner = await _require_owner(x_rear_link_token)
    return svc.owner_view(owner, await svc.list_contacts(get_database(), owner["id"]))


@router.patch("/owner")
async def update_owner(body: OwnerUpdate, x_rear_link_token: Optional[str] = Header(None)):
    owner = await _require_owner(x_rear_link_token)
    updates = {"updated_at": svc.now()}
    if body.first_name is not None:
        name = svc.clean_first_name(body.first_name)
        if not name:
            raise HTTPException(status_code=422, detail="Please give a first name (letters only, up to 30)")
        updates["first_name"] = encrypt_field(name)
    if body.own_phone is not None:
        if body.own_phone == "":
            updates["own_phone"] = None
        else:
            p = svc.normalise_uk_mobile(body.own_phone)
            if not p:
                raise HTTPException(status_code=422, detail="Please give a UK mobile number, like 07700 900123")
            updates["own_phone"] = encrypt_field(p)
    if body.flare_enabled is not None:
        updates["flare_enabled"] = body.flare_enabled
    db = get_database()
    await db.rear_link_owners.update_one({"id": owner["id"]}, {"$set": updates})
    owner = await db.rear_link_owners.find_one({"id": owner["id"]})
    return svc.owner_view(owner, await svc.list_contacts(db, owner["id"]))


@router.post("/owner/automatic-consent")
async def set_automatic_consent(body: AutomaticConsent, x_rear_link_token: Optional[str] = Header(None)):
    """Separate, affirmative, recorded consent for automatic Rear Link.

    Recording consent does NOT switch anything on in the chat: no automatic
    trigger exists yet (RL-1). The app must say so on the consent screen.
    """
    owner = await _require_owner(x_rear_link_token)
    if body.wording_version != svc.CONSENT_WORDING_VERSION:
        raise HTTPException(status_code=409, detail="The consent wording has changed. Please read it again.")
    db = get_database()
    if body.agree:
        updates = {"auto_consent_at": svc.now(), "auto_consent_version": body.wording_version, "auto_revoked_at": None}
    else:
        updates = {"auto_revoked_at": svc.now()}
    updates["updated_at"] = svc.now()
    await db.rear_link_owners.update_one({"id": owner["id"]}, {"$set": updates})
    await db.rear_link_consent_log.insert_one({
        "owner_id": owner["id"], "who": "veteran", "what": "automatic",
        "granted": body.agree, "wording_version": body.wording_version, "at": svc.now(),
    })
    owner = await db.rear_link_owners.find_one({"id": owner["id"]})
    return svc.owner_view(owner, await svc.list_contacts(db, owner["id"]))


@router.delete("/owner")
async def delete_owner(x_rear_link_token: Optional[str] = Header(None)):
    """Leave Rear Link: contacts' details are deleted and the token stops working."""
    owner = await _require_owner(x_rear_link_token)
    db = get_database()
    for c in await svc.list_contacts(db, owner["id"]):
        await svc.forget_contact_details(db, c["id"], "removed")
    await db.rear_link_escalations.update_many(
        {"owner_id": owner["id"], "status": "open"}, {"$set": {"status": "stood_down", "next_action_at": None}})
    await db.rear_link_owners.update_one({"id": owner["id"]}, {"$set": {
        "deleted": True, "token_hash": None, "first_name": None, "own_phone": None, "updated_at": svc.now()}})
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Veteran: contacts
# ---------------------------------------------------------------------------

@router.post("/contacts")
async def add_contact(body: ContactCreate, x_rear_link_token: Optional[str] = Header(None)):
    owner = await _require_owner(x_rear_link_token)
    db = get_database()
    current = await svc.list_contacts(db, owner["id"])
    if len(current) >= svc.MAX_CONTACTS:
        raise HTTPException(status_code=409, detail=f"You can have up to {svc.MAX_CONTACTS} people on your Rear Link")
    name = svc.clean_first_name(body.name)
    if not name:
        raise HTTPException(status_code=422, detail="Please give their first name (letters only, up to 30)")
    phone = svc.normalise_uk_mobile(body.phone)
    if not phone:
        raise HTTPException(status_code=422, detail="Please give a UK mobile number, like 07700 900123")
    for c in current:
        if decrypt_field(c.get("phone") or "") == phone:
            raise HTTPException(status_code=409, detail="That number is already on your Rear Link")
    invite_token = svc.new_token()
    contact = {
        "id": svc.uuid.uuid4().hex,
        "owner_id": owner["id"],
        "name": encrypt_field(name),
        "phone": encrypt_field(phone),
        "relationship": encrypt_field((body.relationship or "").strip()[:40]),
        "order": (max([c.get("order", 0) for c in current]) + 1) if current else 1,
        "status": "invited",
        "invite_token_hash": svc.hash_token(invite_token),
        "invite_expires_at": svc.now() + timedelta(days=svc.INVITE_DAYS),
        "invites_sent": 1,
        "created_at": svc.now(), "updated_at": svc.now(),
    }
    await db.rear_link_contacts.insert_one(contact)
    first_name = decrypt_field(owner["first_name"])
    await svc.get_notifier(db).send_sms(phone, svc.invite_sms(first_name, invite_token), f"invite-{contact['id']}")
    return svc.contact_view(contact)


@router.post("/contacts/{contact_id}/resend")
async def resend_invite(contact_id: str, x_rear_link_token: Optional[str] = Header(None)):
    owner = await _require_owner(x_rear_link_token)
    db = get_database()
    c = await db.rear_link_contacts.find_one({"id": contact_id, "owner_id": owner["id"], "status": "invited"})
    if not c:
        raise HTTPException(status_code=404, detail="No pending invite for that person")
    if c.get("invites_sent", 1) >= 3:
        raise HTTPException(status_code=429, detail="We've already sent this invite three times")
    invite_token = svc.new_token()
    await db.rear_link_contacts.update_one({"id": contact_id}, {"$set": {
        "invite_token_hash": svc.hash_token(invite_token),
        "invite_expires_at": svc.now() + timedelta(days=svc.INVITE_DAYS),
        "invites_sent": c.get("invites_sent", 1) + 1, "updated_at": svc.now()}})
    await svc.get_notifier(db).send_sms(decrypt_field(c["phone"]),
                                        svc.invite_sms(decrypt_field(owner["first_name"]), invite_token),
                                        f"invite-{contact_id}")
    return {"resent": True}


@router.put("/contacts/order")
async def reorder_contacts(body: ContactOrder, x_rear_link_token: Optional[str] = Header(None)):
    owner = await _require_owner(x_rear_link_token)
    db = get_database()
    mine = {c["id"] for c in await svc.list_contacts(db, owner["id"])}
    if set(body.contact_ids) != mine:
        raise HTTPException(status_code=422, detail="The list doesn't match your Rear Link")
    for i, cid in enumerate(body.contact_ids, start=1):
        await db.rear_link_contacts.update_one({"id": cid}, {"$set": {"order": i, "updated_at": svc.now()}})
    return [svc.contact_view(c) for c in await svc.list_contacts(db, owner["id"])]


@router.delete("/contacts/{contact_id}")
async def remove_contact(contact_id: str, x_rear_link_token: Optional[str] = Header(None)):
    """Removes the contact and deletes their details. They are not texted (pending decision)."""
    owner = await _require_owner(x_rear_link_token)
    db = get_database()
    c = await db.rear_link_contacts.find_one({"id": contact_id, "owner_id": owner["id"],
                                              "status": {"$in": ["invited", "active"]}})
    if not c:
        raise HTTPException(status_code=404, detail="Not on your Rear Link")
    await svc.forget_contact_details(db, contact_id, "removed")
    return {"removed": True}


# ---------------------------------------------------------------------------
# Veteran: Send a flare
# ---------------------------------------------------------------------------

def _names(contacts):
    return {c["id"]: decrypt_field(c.get("name") or "") or "Contact" for c in contacts}


@router.post("/flare")
async def send_flare(x_rear_link_token: Optional[str] = Header(None)):
    owner = await _require_owner(x_rear_link_token)
    if not owner.get("flare_enabled", True):
        raise HTTPException(status_code=409, detail="Send a flare is switched off in your settings")
    db = get_database()
    contacts = await svc.list_contacts(db, owner["id"])
    if not any(c["status"] == "active" for c in contacts):
        raise HTTPException(status_code=409, detail="Nobody has accepted a place on your Rear Link yet")
    try:
        esc = await svc.start_flare(db, owner)
    except ValueError:
        raise HTTPException(status_code=429, detail="You've sent several flares in the last hour. "
                                                    "If you need help now, call Samaritans free on 116 123, or 999 in an emergency.")
    all_contacts = await db.rear_link_contacts.find({"owner_id": owner["id"]}, {"_id": 0}).to_list(20)
    return svc.veteran_view(esc, _names(all_contacts))


@router.get("/flare/{escalation_id}")
async def flare_status(escalation_id: str, x_rear_link_token: Optional[str] = Header(None)):
    owner = await _require_owner(x_rear_link_token)
    db = get_database()
    esc = await svc.get_escalation(db, escalation_id)
    if not esc or esc["owner_id"] != owner["id"]:
        raise HTTPException(status_code=404, detail="Not found")
    all_contacts = await db.rear_link_contacts.find({"owner_id": owner["id"]}, {"_id": 0}).to_list(20)
    return svc.veteran_view(esc, _names(all_contacts))


@router.post("/flare/{escalation_id}/stand-down")
async def stand_down(escalation_id: str, x_rear_link_token: Optional[str] = Header(None)):
    """The veteran says they're OK. Stops further steps; does not recall messages already sent."""
    owner = await _require_owner(x_rear_link_token)
    db = get_database()
    esc = await svc.get_escalation(db, escalation_id)
    if not esc or esc["owner_id"] != owner["id"]:
        raise HTTPException(status_code=404, detail="Not found")
    if esc["status"] in ("open", "acknowledged"):
        await db.rear_link_escalations.update_one({"id": escalation_id}, {"$set": {
            "status": "stood_down", "veteran_status": "stood_down", "next_action_at": None,
            "updated_at": svc.now()}})
    esc = await svc.get_escalation(db, escalation_id)
    all_contacts = await db.rear_link_contacts.find({"owner_id": owner["id"]}, {"_id": 0}).to_list(20)
    return svc.veteran_view(esc, _names(all_contacts))


# ---------------------------------------------------------------------------
# Contact side (no account; tokens from the texts)
# ---------------------------------------------------------------------------

@router.get("/invite/{invite_token}")
async def view_invite(invite_token: str):
    _require_enabled()
    db = get_database()
    c = await db.rear_link_contacts.find_one({"invite_token_hash": svc.hash_token(invite_token), "status": "invited"})
    if not c or (c.get("invite_expires_at") and c["invite_expires_at"] <= svc.now()):
        raise HTTPException(status_code=404, detail="This invite has expired or has already been answered")
    owner = await db.rear_link_owners.find_one({"id": c["owner_id"]})
    return {
        "veteran_first_name": decrypt_field(owner["first_name"]) if owner else "",
        "your_name": decrypt_field(c["name"]),
        "automatic_offered": bool(owner and owner.get("auto_consent_at") and not owner.get("auto_revoked_at")),
        "radiocheck_number": os.environ.get("TWILIO_PHONE_NUMBER", ""),
        "expires_at": c["invite_expires_at"],
    }


@router.post("/invite/{invite_token}/respond")
async def respond_invite(invite_token: str, body: InviteResponse):
    _require_enabled()
    db = get_database()
    c = await db.rear_link_contacts.find_one({"invite_token_hash": svc.hash_token(invite_token), "status": "invited"})
    if not c or (c.get("invite_expires_at") and c["invite_expires_at"] <= svc.now()):
        raise HTTPException(status_code=404, detail="This invite has expired or has already been answered")
    if not body.accept:
        await svc.forget_contact_details(db, c["id"], "declined")
        await db.rear_link_consent_log.insert_one({"contact_id": c["id"], "owner_id": c["owner_id"],
                                                   "who": "contact", "what": "flare", "granted": False, "at": svc.now()})
        return {"declined": True}
    contact_token = svc.new_token()
    await db.rear_link_contacts.update_one({"id": c["id"]}, {"$set": {
        "status": "active",
        "flare_consent_at": svc.now(),
        "auto_consent_at": svc.now() if body.allow_automatic else None,
        "bypass_set_up": bool(body.bypass_set_up),
        "invite_token_hash": None,
        "contact_token_hash": svc.hash_token(contact_token),
        "updated_at": svc.now()}})
    await db.rear_link_consent_log.insert_one({"contact_id": c["id"], "owner_id": c["owner_id"],
                                               "who": "contact", "what": "flare", "granted": True, "at": svc.now()})
    await db.rear_link_consent_log.insert_one({"contact_id": c["id"], "owner_id": c["owner_id"],
                                               "who": "contact", "what": "automatic",
                                               "granted": bool(body.allow_automatic), "at": svc.now()})
    return {"accepted": True, "contact_token": contact_token}


async def _contact_from_token(token: str) -> dict:
    _require_enabled()
    c = await get_database().rear_link_contacts.find_one(
        {"contact_token_hash": svc.hash_token(token), "status": "active"})
    if not c:
        raise HTTPException(status_code=404, detail="Not recognised")
    return c


@router.get("/contact/{contact_token}")
async def contact_settings(contact_token: str):
    c = await _contact_from_token(contact_token)
    owner = await get_database().rear_link_owners.find_one({"id": c["owner_id"]})
    v = svc.contact_view(c)
    v["veteran_first_name"] = decrypt_field(owner["first_name"]) if owner else ""
    return v


@router.post("/contact/{contact_token}/availability")
async def contact_availability(contact_token: str, body: Availability):
    c = await _contact_from_token(contact_token)
    away = None
    if body.away_days:
        away = svc.now() + timedelta(days=max(1, min(body.away_days, 60)))
    await get_database().rear_link_contacts.update_one({"id": c["id"]}, {"$set": {
        "away_until": away, "updated_at": svc.now()}})
    return {"away_until": away}


@router.post("/contact/{contact_token}/automatic")
async def contact_automatic(contact_token: str, body: AutomaticConsent):
    c = await _contact_from_token(contact_token)
    await get_database().rear_link_contacts.update_one({"id": c["id"]}, {"$set": {
        "auto_consent_at": svc.now() if body.agree else None, "updated_at": svc.now()}})
    await get_database().rear_link_consent_log.insert_one({
        "contact_id": c["id"], "owner_id": c["owner_id"], "who": "contact", "what": "automatic",
        "granted": body.agree, "wording_version": body.wording_version, "at": svc.now()})
    return {"automatic_accepted": body.agree}


@router.post("/contact/{contact_token}/withdraw")
async def contact_withdraw(contact_token: str):
    c = await _contact_from_token(contact_token)
    await svc.forget_contact_details(get_database(), c["id"], "withdrawn")
    return {"withdrawn": True}


@router.get("/r/{respond_token}")
async def view_request(respond_token: str):
    _require_enabled()
    db = get_database()
    esc = await db.rear_link_escalations.find_one(
        {"steps.respond_token_hash": svc.hash_token(respond_token)}, {"_id": 0})
    if not esc:
        raise HTTPException(status_code=404, detail="Not recognised")
    owner = await db.rear_link_owners.find_one({"id": esc["owner_id"]})
    return {"veteran_first_name": decrypt_field(owner["first_name"]) if owner else "",
            "status": esc["status"], "simulated": esc.get("delivery_mode") == "test"}


@router.post("/r/{respond_token}")
async def answer_request(respond_token: str, body: Answer):
    _require_enabled()
    if body.answer not in ("calling", "cannot", "spoke"):
        raise HTTPException(status_code=422, detail="Unknown answer")
    res = await svc.contact_response(get_database(), respond_token, body.answer)
    if not res:
        raise HTTPException(status_code=404, detail="Not recognised")
    return {"recorded": body.answer}


# ---------------------------------------------------------------------------
# Twilio webhooks
# ---------------------------------------------------------------------------

async def _twilio_valid(request: Request) -> bool:
    if svc.delivery_mode() != "live":
        return True
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not token:
        return False
    from twilio.request_validator import RequestValidator
    form = dict(await request.form())
    url = f"{svc.api_url()}{request.url.path}"
    return RequestValidator(token).validate(url, form, request.headers.get("X-Twilio-Signature", ""))


def _twiml(text: str) -> Response:
    from twilio.twiml.voice_response import VoiceResponse
    vr = VoiceResponse()
    vr.say(text, voice="Polly.Brian", language="en-GB")
    return Response(content=str(vr), media_type="application/xml")


async def _step_by_ref(db, ref: str):
    esc = await db.rear_link_escalations.find_one({"steps.ref": ref}, {"_id": 0})
    if not esc:
        return None, None
    idx = next(i for i, s in enumerate(esc["steps"]) if s.get("ref") == ref)
    return esc, idx


@router.post("/twilio/gather/{ref}")
async def twilio_gather(ref: str, request: Request):
    if not await _twilio_valid(request):
        raise HTTPException(status_code=403, detail="Invalid signature")
    form = await request.form()
    digits = form.get("Digits", "")
    db = get_database()
    esc, idx = await _step_by_ref(db, ref)
    if esc is None:
        return _twiml("Thank you. Goodbye.")
    step = esc["steps"][idx]
    if digits == "1":
        svc._record(step, "acknowledged", channel="call")
        if esc["status"] in ("open", "exhausted"):
            esc["status"] = "acknowledged"
            esc["veteran_status"] = "acknowledged"
            esc["next_action_at"] = None
            esc["acknowledged_by"] = step["contact_id"]
        await svc._save_full(db, esc)
        return _twiml("Thank you. Please call them now. If you think they're in danger, call 999. Goodbye.")
    if digits == "2":
        svc._record(step, "declined", channel="call")
        await svc._save_full(db, esc)
        if esc["status"] == "open" and esc["current"] == idx:
            await svc.advance(db, esc["id"])
        return _twiml("No problem. We'll try someone else. Thank you. Goodbye.")
    return _twiml("Thank you. Goodbye.")


@router.post("/twilio/call-status/{ref}")
async def twilio_call_status(ref: str, request: Request):
    if not await _twilio_valid(request):
        raise HTTPException(status_code=403, detail="Invalid signature")
    form = await request.form()
    call_status = form.get("CallStatus", "")
    answered_by = form.get("AnsweredBy", "")
    db = get_database()
    esc, idx = await _step_by_ref(db, ref)
    if esc is None:
        return Response(status_code=204)
    step = esc["steps"][idx]
    if step["state"] == "dispatched":
        if call_status == "completed" and not answered_by.startswith("machine"):
            svc._record(step, "delivered", channel="call")
        elif call_status in ("busy", "no-answer", "failed", "canceled") or answered_by.startswith("machine"):
            step.setdefault("history", []).append({"state": "call_" + (call_status or "machine"), "at": svc.now()})
        await svc._save_full(db, esc)
    return Response(status_code=204)


@router.post("/twilio/sms-status/{ref}")
async def twilio_sms_status(ref: str, request: Request):
    if not await _twilio_valid(request):
        raise HTTPException(status_code=403, detail="Invalid signature")
    form = await request.form()
    st = form.get("MessageStatus", "")
    db = get_database()
    esc, idx = await _step_by_ref(db, ref)
    if esc is None:
        return Response(status_code=204)
    step = esc["steps"][idx]
    if st == "delivered" and step["state"] == "dispatched":
        svc._record(step, "delivered", channel="sms")
    else:
        step.setdefault("history", []).append({"state": f"sms_{st}", "at": svc.now()})
    await svc._save_full(db, esc)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

@router.on_event("startup")
async def _start_worker():
    svc.start_worker(get_database)
