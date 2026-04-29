"""
Twilio Voice Calling Router
============================
Browser-to-phone calling functionality for staff portal.
Enables staff to call users directly from the browser using Twilio.
"""

import os
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Form, Request, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from twilio.rest import Client
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.twiml.voice_response import VoiceResponse, Dial
from twilio.request_validator import RequestValidator

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/twilio", tags=["twilio"])

# Twilio configuration from environment
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_API_KEY_SID = os.environ.get('TWILIO_API_KEY_SID')
TWILIO_API_KEY_SECRET = os.environ.get('TWILIO_API_KEY_SECRET')
TWILIO_TWIML_APP_SID = os.environ.get('TWILIO_TWIML_APP_SID')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')

# Initialize Twilio client
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    logger.info("Twilio client initialized successfully")
else:
    missing = [
        n for n, v in [
            ("TWILIO_ACCOUNT_SID", TWILIO_ACCOUNT_SID),
            ("TWILIO_AUTH_TOKEN", TWILIO_AUTH_TOKEN),
            ("TWILIO_PHONE_NUMBER", TWILIO_PHONE_NUMBER),
        ] if not v
    ]
    logger.warning(f"Twilio credentials not configured ({', '.join(missing)} missing) - calling features disabled")


class TokenResponse(BaseModel):
    """Response model for access token"""
    token: str
    identity: str
    ttl: int


class CallResponse(BaseModel):
    """Response model for call initiation"""
    call_sid: str
    status: str
    to_number: str
    from_number: str


class CallStatusUpdate(BaseModel):
    """Model for call status updates"""
    call_sid: str
    status: str
    duration: Optional[int] = None
    timestamp: str


# Track active calls for monitoring
active_calls = {}


@router.get("/status")
async def get_twilio_status():
    """Check if Twilio is configured and ready"""
    is_configured = all([
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_API_KEY_SID,
        TWILIO_API_KEY_SECRET,
        TWILIO_TWIML_APP_SID
    ])
    
    return {
        "configured": is_configured,
        "phone_number": TWILIO_PHONE_NUMBER if is_configured else None,
        "twiml_app_sid": TWILIO_TWIML_APP_SID[:10] + "..." if TWILIO_TWIML_APP_SID else None,
        "features": {
            "browser_calling": is_configured,
            "outbound_calls": is_configured
        }
    }


@router.get("/debug")
async def get_twilio_debug():
    """Debug endpoint to check Twilio configuration"""
    return {
        "account_sid_set": bool(TWILIO_ACCOUNT_SID),
        "auth_token_set": bool(TWILIO_AUTH_TOKEN),
        "api_key_sid_set": bool(TWILIO_API_KEY_SID),
        "api_key_secret_set": bool(TWILIO_API_KEY_SECRET),
        "twiml_app_sid": TWILIO_TWIML_APP_SID,
        "phone_number": TWILIO_PHONE_NUMBER,
        "client_initialized": twilio_client is not None,
        "voice_webhook_url": "/api/twilio/voice",
        "expected_twilio_webhook": "https://veterans-support-api.onrender.com/api/twilio/voice"
    }


@router.post("/token", response_model=TokenResponse)
async def generate_access_token(
    staff_id: str = Form(...),
    staff_name: str = Form(default="Staff")
):
    """
    Generate a Twilio access token for browser-based calling.
    
    This token allows the staff portal JavaScript to connect to Twilio
    and make/receive calls directly in the browser.
    """
    if not all([TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID]):
        raise HTTPException(
            status_code=503,
            detail="Twilio not configured. Please contact administrator."
        )
    
    try:
        # Create identity from staff_id (must be unique per device)
        identity = f"staff_{staff_id}"
        
        # Create access token with 1 hour TTL
        token = AccessToken(
            TWILIO_ACCOUNT_SID,
            TWILIO_API_KEY_SID,
            TWILIO_API_KEY_SECRET,
            identity=identity,
            ttl=3600  # 1 hour
        )
        
        # Add voice grant for making outbound calls
        voice_grant = VoiceGrant(
            outgoing_application_sid=TWILIO_TWIML_APP_SID,
            incoming_allow=True  # Allow receiving calls too
        )
        token.add_grant(voice_grant)
        
        logger.info(f"Generated Twilio token for staff: {staff_id}")
        
        return TokenResponse(
            token=token.to_jwt(),
            identity=identity,
            ttl=3600
        )
        
    except Exception as e:
        logger.error(f"Token generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate access token")


@router.post("/call")
async def initiate_call(
    to_number: str = Form(...),
    staff_id: str = Form(...),
    staff_name: str = Form(default="Staff"),
    callback_id: str = Form(default=None),
    user_name: str = Form(default="User")
):
    """
    Initiate an outbound notification call (one-way).
    For two-way browser-to-phone calling, use the Device SDK via /voice webhook.
    
    This is a fallback for when Device SDK isn't available.
    """
    if not twilio_client:
        raise HTTPException(
            status_code=503,
            detail="Twilio not configured. Please contact administrator."
        )
    
    # Validate phone number format
    if not to_number:
        raise HTTPException(status_code=400, detail="Phone number is required")
    
    # Ensure E.164 format
    clean_number = to_number.strip().replace(" ", "")
    if not clean_number.startswith("+"):
        # Assume UK number if no country code
        if clean_number.startswith("0"):
            clean_number = "+44" + clean_number[1:]
        else:
            clean_number = "+44" + clean_number
    
    try:
        # Create TwiML for notification call (one-way)
        # This plays a message when the person answers
        twiml = VoiceResponse()
        twiml.say(
            f"Hello, this is Radio Check. {staff_name} from our support team is trying to reach you. "
            "Please hold while we connect you.",
            voice="alice",
            language="en-GB"
        )
        twiml.pause(length=1)
        twiml.say(
            "If you requested a callback, a team member will speak with you shortly. "
            "Thank you for your patience.",
            voice="alice",
            language="en-GB"
        )
        # Keep the line open for 60 seconds to allow staff to join via conference
        twiml.pause(length=60)
        twiml.say(
            "We're sorry, but we couldn't connect you at this time. "
            "Please try again or use the app to request another callback.",
            voice="alice",
            language="en-GB"
        )
        
        # Initiate the call
        call = twilio_client.calls.create(
            from_=TWILIO_PHONE_NUMBER,
            to=clean_number,
            twiml=str(twiml),
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            status_callback_method="POST"
        )
        
        # Track the call
        active_calls[call.sid] = {
            "call_sid": call.sid,
            "staff_id": staff_id,
            "staff_name": staff_name,
            "to_number": clean_number,
            "user_name": user_name,
            "callback_id": callback_id,
            "status": call.status,
            "started_at": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Call initiated: {call.sid} from {staff_name} to {clean_number}")
        
        return {
            "call_sid": call.sid,
            "status": call.status,
            "to_number": clean_number,
            "from_number": TWILIO_PHONE_NUMBER
        }
        
    except Exception as e:
        logger.error(f"Call initiation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {str(e)}")


@router.post("/voice")
async def handle_voice_webhook(request: Request):
    """
    TwiML webhook endpoint for handling voice calls.
    
    This is called by Twilio when:
    - A browser client initiates an outbound call
    - Someone calls the Twilio number
    """
    try:
        form_data = await request.form()
        to_number = form_data.get('To', '')
        from_number = form_data.get('From', '')
        call_sid = form_data.get('CallSid', '')
        
        # Enhanced logging for debugging
        logger.info(f"=== VOICE WEBHOOK CALLED ===")
        logger.info(f"Voice webhook: CallSid={call_sid}, From={from_number}, To={to_number}")
        logger.info(f"All form data: {dict(form_data)}")
        logger.info(f"Request headers: {dict(request.headers)}")
        
        response = VoiceResponse()
        
        # Normalize phone number - UK numbers starting with 07 should be +44
        normalized_to = to_number
        if to_number and to_number.startswith('07') and len(to_number) >= 10:
            normalized_to = '+44' + to_number[1:]
            logger.info(f"Normalized UK phone number: {to_number} -> {normalized_to}")
        
        # Check if this is an outbound call (To is a phone number)
        is_phone_number = normalized_to and (normalized_to.startswith('+') or (to_number.startswith('0') and len(to_number) >= 10))
        
        if is_phone_number and not to_number.startswith('client:'):
            # Outbound call to phone number
            response.say(
                "Connecting your call now.",
                voice="alice",
                language="en-GB"
            )
            
            dial = Dial(
                caller_id=TWILIO_PHONE_NUMBER,
                timeout=30
            )
            dial.number(normalized_to)
            response.append(dial)
            
        elif to_number and to_number.startswith('client:'):
            # Incoming call to a staff member
            client_id = to_number.replace('client:', '')
            response.say(
                "Connecting you to support now.",
                voice="alice",
                language="en-GB"
            )
            
            dial = Dial()
            dial.client(client_id)
            response.append(dial)
            
        else:
            # Default - incoming call to the Twilio number
            response.say(
                "Thank you for calling Radio Check. Please hold while we connect you.",
                voice="alice",
                language="en-GB"
            )
            # Could route to available staff here
            response.say(
                "We're sorry, but all our staff are currently busy. Please try again later or use our app to request a callback.",
                voice="alice",
                language="en-GB"
            )
        
        return Response(content=str(response), media_type="application/xml")
        
    except Exception as e:
        logger.error(f"Voice webhook error: {str(e)}")
        response = VoiceResponse()
        response.say("An error occurred. Please try again.", voice="alice")
        return Response(content=str(response), media_type="application/xml")


@router.post("/call-status")
async def handle_call_status(request: Request):
    """
    Webhook for call status updates from Twilio.
    
    Updates are received as calls progress through states:
    initiated -> ringing -> answered -> completed
    """
    try:
        form_data = await request.form()
        call_sid = form_data.get('CallSid', '')
        call_status = form_data.get('CallStatus', '')
        call_duration = form_data.get('CallDuration')
        
        logger.info(f"Call status update: {call_sid} - {call_status}")
        
        # Update tracked call
        if call_sid in active_calls:
            active_calls[call_sid]['status'] = call_status
            if call_duration:
                active_calls[call_sid]['duration'] = int(call_duration)
            if call_status in ['completed', 'failed', 'busy', 'no-answer', 'canceled']:
                active_calls[call_sid]['ended_at'] = datetime.utcnow().isoformat()
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Call status webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}


@router.get("/active-calls")
async def get_active_calls():
    """Get list of currently active calls (for monitoring)"""
    # Filter to only show active/in-progress calls
    active = {
        sid: call for sid, call in active_calls.items()
        if call.get('status') in ['initiated', 'ringing', 'in-progress', 'answered']
    }
    return {"calls": list(active.values()), "count": len(active)}


@router.post("/end-call")
async def end_call(call_sid: str = Form(...)):
    """End an active call"""
    if not twilio_client:
        raise HTTPException(status_code=503, detail="Twilio not configured")
    
    try:
        call = twilio_client.calls(call_sid).update(status='completed')
        
        if call_sid in active_calls:
            active_calls[call_sid]['status'] = 'completed'
            active_calls[call_sid]['ended_at'] = datetime.utcnow().isoformat()
        
        logger.info(f"Call ended: {call_sid}")
        return {"status": "ended", "call_sid": call_sid}
        
    except Exception as e:
        logger.error(f"Failed to end call: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to end call: {str(e)}")
