"""
Shift Swap Router - Handles shift cover requests between staff members
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os
import resend

from services.database import get_database

router = APIRouter(prefix="/shift-swaps", tags=["shift-swaps"])

# Initialize Resend for email notifications
resend.api_key = os.getenv("RESEND_API_KEY")


class SwapRequest(BaseModel):
    shift_id: str
    requester_id: str
    requester_name: str
    reason: Optional[str] = None


class SwapResponse(BaseModel):
    request_id: str
    responder_id: str
    responder_name: str


class SwapApproval(BaseModel):
    admin_id: str
    admin_name: str
    approved: bool
    notes: Optional[str] = None


@router.post("/request")
async def create_swap_request(request: SwapRequest):
    """
    Create a shift swap/cover request.
    Notifies all other staff members who could potentially cover.
    """
    db = get_database()
    
    # Get the shift details
    shift = await db.shifts.find_one({"id": request.shift_id})
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    # Create swap request
    swap_id = str(uuid.uuid4())
    swap_doc = {
        "id": swap_id,
        "shift_id": request.shift_id,
        "shift_date": shift.get("date"),
        "shift_start": shift.get("start_time"),
        "shift_end": shift.get("end_time"),
        "requester_id": request.requester_id,
        "requester_name": request.requester_name,
        "reason": request.reason,
        "status": "pending",  # pending, accepted, approved, rejected, cancelled
        "responder_id": None,
        "responder_name": None,
        "admin_approved": None,
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.shift_swaps.insert_one(swap_doc)
    
    # Notify all other staff (counsellors and peer supporters)
    await notify_staff_of_swap_request(db, swap_doc)
    
    # Remove _id for response
    swap_doc.pop('_id', None)
    
    return {
        "success": True,
        "swap_id": swap_id,
        "message": "Swap request created and staff notified"
    }


@router.post("/{swap_id}/accept")
async def accept_swap_request(swap_id: str, response: SwapResponse):
    """
    Staff member accepts a swap request (first to accept gets it).
    Goes to admin for final approval.
    """
    db = get_database()
    
    # Get the swap request
    swap = await db.shift_swaps.find_one({"id": swap_id})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap.get("status") != "pending":
        raise HTTPException(status_code=400, detail="This swap request is no longer available")
    
    # Can't accept your own request
    if swap.get("requester_id") == response.responder_id:
        raise HTTPException(status_code=400, detail="You cannot accept your own swap request")
    
    # Update swap request
    await db.shift_swaps.update_one(
        {"id": swap_id},
        {
            "$set": {
                "status": "accepted",
                "responder_id": response.responder_id,
                "responder_name": response.responder_name,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Notify requester and admin
    await notify_swap_accepted(db, swap, response.responder_name)
    
    return {
        "success": True,
        "message": "Swap accepted! Waiting for admin approval."
    }


@router.post("/{swap_id}/approve")
async def approve_swap_request(swap_id: str, approval: SwapApproval):
    """
    Admin approves or rejects the swap request.
    If approved, the shift is transferred to the new staff member.
    """
    db = get_database()
    
    # Get the swap request
    swap = await db.shift_swaps.find_one({"id": swap_id})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap.get("status") != "accepted":
        raise HTTPException(status_code=400, detail="This swap request cannot be approved (not yet accepted by another staff member)")
    
    new_status = "approved" if approval.approved else "rejected"
    
    # Update swap request
    await db.shift_swaps.update_one(
        {"id": swap_id},
        {
            "$set": {
                "status": new_status,
                "admin_approved": approval.approved,
                "admin_id": approval.admin_id,
                "admin_name": approval.admin_name,
                "admin_notes": approval.notes,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if approval.approved:
        # Transfer the shift to the new staff member
        await db.shifts.update_one(
            {"id": swap.get("shift_id")},
            {
                "$set": {
                    "user_id": swap.get("responder_id"),
                    "user_name": swap.get("responder_name"),
                    "swapped_from": swap.get("requester_id"),
                    "swap_id": swap_id
                }
            }
        )
    
    # Notify both staff members
    await notify_swap_decision(db, swap, approval.approved, approval.notes)
    
    return {
        "success": True,
        "message": f"Swap request {'approved' if approval.approved else 'rejected'}"
    }


@router.post("/{swap_id}/cancel")
async def cancel_swap_request(swap_id: str, user_id: str):
    """
    Requester cancels their swap request.
    """
    db = get_database()
    
    swap = await db.shift_swaps.find_one({"id": swap_id})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap.get("requester_id") != user_id:
        raise HTTPException(status_code=403, detail="You can only cancel your own swap requests")
    
    if swap.get("status") not in ["pending", "accepted"]:
        raise HTTPException(status_code=400, detail="This swap request cannot be cancelled")
    
    await db.shift_swaps.update_one(
        {"id": swap_id},
        {
            "$set": {
                "status": "cancelled",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"success": True, "message": "Swap request cancelled"}


@router.get("/")
async def get_all_swaps(status: Optional[str] = None):
    """
    Get all swap requests (for admin dashboard).
    """
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    cursor = db.shift_swaps.find(query, {"_id": 0}).sort("created_at", -1)
    swaps = await cursor.to_list(length=100)
    
    return swaps


@router.get("/pending")
async def get_pending_swaps():
    """
    Get all pending swap requests (for staff to see available swaps).
    """
    db = get_database()
    
    cursor = db.shift_swaps.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1)
    
    swaps = await cursor.to_list(length=50)
    return swaps


@router.get("/my-requests/{user_id}")
async def get_my_swap_requests(user_id: str):
    """
    Get swap requests made by a specific user.
    """
    db = get_database()
    
    cursor = db.shift_swaps.find(
        {"requester_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1)
    
    swaps = await cursor.to_list(length=50)
    return swaps


@router.get("/needs-approval")
async def get_swaps_needing_approval():
    """
    Get swap requests that need admin approval.
    """
    db = get_database()
    
    cursor = db.shift_swaps.find(
        {"status": "accepted"},
        {"_id": 0}
    ).sort("created_at", -1)
    
    swaps = await cursor.to_list(length=50)
    return swaps


# Notification helpers
async def notify_staff_of_swap_request(db, swap: dict):
    """Send email to all staff about a new swap request"""
    if not resend.api_key:
        return
    
    # Get all staff emails (excluding the requester)
    counsellors = await db.counsellors.find(
        {"id": {"$ne": swap.get("requester_id")}},
        {"email": 1}
    ).to_list(length=100)
    
    peers = await db.peer_supporters.find(
        {"id": {"$ne": swap.get("requester_id")}},
        {"email": 1}
    ).to_list(length=100)
    
    emails = [c.get("email") for c in counsellors if c.get("email")]
    emails += [p.get("email") for p in peers if p.get("email")]
    
    if not emails:
        return
    
    try:
        resend.Emails.send({
            "from": "Radio Check <noreply@radiocheck.me>",
            "to": emails,
            "subject": "Shift Cover Needed - Radio Check",
            "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1e3a5f;">Shift Cover Request</h2>
                    <p><strong>{swap.get('requester_name')}</strong> needs cover for their shift:</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p><strong>Date:</strong> {swap.get('shift_date')}</p>
                        <p><strong>Time:</strong> {swap.get('shift_start')} - {swap.get('shift_end')}</p>
                        {f"<p><strong>Reason:</strong> {swap.get('reason')}</p>" if swap.get('reason') else ""}
                    </div>
                    <p>If you can cover this shift, log in to the Staff Portal to accept.</p>
                    <p style="color: #6b7280; font-size: 12px;">First person to accept will get the shift (subject to admin approval).</p>
                </div>
            """
        })
    except Exception as e:
        print(f"Error sending swap notification: {e}")


async def notify_swap_accepted(db, swap: dict, responder_name: str):
    """Notify requester that someone accepted their swap"""
    if not resend.api_key:
        return
    
    # Get requester email
    requester = await db.counsellors.find_one({"id": swap.get("requester_id")})
    if not requester:
        requester = await db.peer_supporters.find_one({"id": swap.get("requester_id")})
    
    if not requester or not requester.get("email"):
        return
    
    try:
        resend.Emails.send({
            "from": "Radio Check <noreply@radiocheck.me>",
            "to": [requester.get("email")],
            "subject": "Your Shift Swap Has Been Accepted! - Radio Check",
            "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                    <h2 style="color: #22c55e;">Good News!</h2>
                    <p><strong>{responder_name}</strong> has agreed to cover your shift on {swap.get('shift_date')}.</p>
                    <p>Waiting for admin approval. You'll be notified once confirmed.</p>
                </div>
            """
        })
    except Exception as e:
        print(f"Error sending acceptance notification: {e}")


async def notify_swap_decision(db, swap: dict, approved: bool, notes: str = None):
    """Notify both staff members of admin decision"""
    if not resend.api_key:
        return
    
    # Get both staff emails
    emails = []
    for user_id in [swap.get("requester_id"), swap.get("responder_id")]:
        user = await db.counsellors.find_one({"id": user_id})
        if not user:
            user = await db.peer_supporters.find_one({"id": user_id})
        if user and user.get("email"):
            emails.append(user.get("email"))
    
    if not emails:
        return
    
    status_color = "#22c55e" if approved else "#ef4444"
    status_text = "Approved" if approved else "Rejected"
    
    try:
        resend.Emails.send({
            "from": "Radio Check <noreply@radiocheck.me>",
            "to": emails,
            "subject": f"Shift Swap {status_text} - Radio Check",
            "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                    <h2 style="color: {status_color};">Shift Swap {status_text}</h2>
                    <p>The shift swap for <strong>{swap.get('shift_date')}</strong> has been <strong>{status_text.lower()}</strong>.</p>
                    {f"<p><strong>Admin notes:</strong> {notes}</p>" if notes else ""}
                    {"<p>The shift has been transferred. Check your schedule for updates.</p>" if approved else "<p>The original shift assignment remains unchanged.</p>"}
                </div>
            """
        })
    except Exception as e:
        print(f"Error sending decision notification: {e}")
