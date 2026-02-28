"""
WebRTC Signaling Server
=======================
Handles real-time signaling for WebRTC peer-to-peer calls.
No PBX required - direct browser-to-browser audio/video.

Flow:
1. Staff connects and registers as available
2. User initiates call to staff
3. Signaling server exchanges offer/answer/ICE candidates
4. WebRTC establishes direct peer connection
"""

import socketio
import logging
import asyncio
from datetime import datetime
from typing import Dict, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Socket.IO server
# Use /api/socket.io path to work with Kubernetes ingress routing
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',  # Configure for production
    logger=True,
    engineio_logger=True
)

# Track connected users
# Format: {socket_id: {user_id, user_type, name, status}}
connected_users: Dict[str, dict] = {}

# Track active calls
# Format: {call_id: {caller_sid, callee_sid, status, started_at}}
active_calls: Dict[str, dict] = {}

# Reverse lookup: user_id -> socket_id
user_to_socket: Dict[str, str] = {}

# Track pending disconnect notifications (for grace period)
# Format: {user_id: asyncio.Task}
pending_disconnects: Dict[str, asyncio.Task] = {}

# Grace period in seconds before notifying about disconnect
DISCONNECT_GRACE_PERIOD = 10


@sio.event
async def connect(sid, environ):
    """Handle new connection"""
    logger.info(f"Client connected: {sid}")
    await sio.emit('connected', {'sid': sid}, to=sid)


@sio.event
async def disconnect(sid):
    """Handle disconnection"""
    logger.info(f"Client disconnected: {sid}")
    
    # Get user info before removing
    user_info = connected_users.get(sid)
    
    # Clean up user from tracking
    if sid in connected_users:
        user_id = connected_users[sid].get('user_id')
        current_room = connected_users[sid].get('current_room')
        user_type = connected_users[sid].get('user_type')
        
        # Notify chat room if user was in one
        if current_room:
            logger.info(f"User {user_id} (type: {user_type}) disconnected while in chat room {current_room}")
            
            user_name = user_info.get('name', 'User') if user_info else 'User'
            
            # Emit to the room
            await sio.emit('user_left_chat', {
                'room_id': current_room,
                'user_id': user_id,
                'reason': 'disconnected',
                'user_name': user_name
            }, room=current_room)
            
            # Also emit to all connected staff (in case they're not in the room)
            # This is a backup to ensure staff see when users disconnect
            if user_type == 'user':
                for staff_sid, staff_info in connected_users.items():
                    if staff_sid != sid and staff_info.get('user_type') in ['counsellor', 'peer', 'admin']:
                        logger.info(f"Also notifying staff {staff_info.get('user_id')} about user disconnect")
                        await sio.emit('user_left_chat', {
                            'room_id': current_room,
                            'user_id': user_id,
                            'reason': 'disconnected',
                            'user_name': user_name
                        }, to=staff_sid)
        
        if user_id and user_id in user_to_socket:
            del user_to_socket[user_id]
        del connected_users[sid]
    
    # End any active calls and reset other party's status
    for call_id, call in list(active_calls.items()):
        if call['caller_sid'] == sid or call['callee_sid'] == sid:
            other_sid = call['callee_sid'] if call['caller_sid'] == sid else call['caller_sid']
            # Reset the other party's status to available
            if other_sid in connected_users:
                connected_users[other_sid]['status'] = 'available'
                logger.info(f"Reset status to available for {other_sid} after peer disconnect")
            await sio.emit('call_ended', {
                'call_id': call_id,
                'reason': 'peer_disconnected'
            }, to=other_sid)
            del active_calls[call_id]
    
    # Notify others that staff member went offline
    if user_info and user_info.get('user_type') in ['counsellor', 'peer']:
        await sio.emit('staff_offline', {
            'user_id': user_info['user_id'],
            'name': user_info.get('name', 'Unknown')
        })


@sio.event
async def register(sid, data):
    """
    Register a user (staff or app user)
    Data: {user_id, user_type: 'counsellor'|'peer'|'user', name, status?}
    """
    user_id = data.get('user_id')
    user_type = data.get('user_type', 'user')
    name = data.get('name', 'Unknown')
    status = data.get('status', 'available')
    
    # Store connection info
    connected_users[sid] = {
        'user_id': user_id,
        'user_type': user_type,
        'name': name,
        'status': status,
        'connected_at': datetime.utcnow().isoformat()
    }
    user_to_socket[user_id] = sid
    
    logger.info(f"User registered: {name} ({user_type}) - {user_id}")
    
    await sio.emit('registered', {
        'success': True,
        'user_id': user_id,
        'user_type': user_type
    }, to=sid)
    
    # If staff, notify others
    if user_type in ['counsellor', 'peer']:
        await sio.emit('staff_online', {
            'user_id': user_id,
            'user_type': user_type,
            'name': name,
            'status': status
        })


@sio.event
async def update_status(sid, data):
    """Update staff availability status"""
    if sid in connected_users:
        connected_users[sid]['status'] = data.get('status', 'available')
        await sio.emit('staff_status_changed', {
            'user_id': connected_users[sid]['user_id'],
            'status': data.get('status')
        })


@sio.event
async def get_online_staff(sid, data):
    """Get list of online staff members"""
    online_staff = []
    for socket_id, user in connected_users.items():
        if user['user_type'] in ['counsellor', 'peer'] and user['status'] == 'available':
            online_staff.append({
                'user_id': user['user_id'],
                'user_type': user['user_type'],
                'name': user['name'],
                'status': user['status']
            })
    
    await sio.emit('online_staff_list', {'staff': online_staff}, to=sid)


@sio.event
async def call_initiate(sid, data):
    """
    User initiates a call to staff
    Data: {target_user_id, caller_name, call_type: 'audio'|'video'}
    """
    target_user_id = data.get('target_user_id')
    caller_info = connected_users.get(sid, {})
    call_type = data.get('call_type', 'audio')
    
    # Find target's socket
    target_sid = user_to_socket.get(target_user_id)
    
    if not target_sid:
        await sio.emit('call_failed', {
            'reason': 'user_offline',
            'message': 'The person you are trying to call is not available'
        }, to=sid)
        return
    
    target_info = connected_users.get(target_sid, {})
    
    if target_info.get('status') != 'available':
        await sio.emit('call_failed', {
            'reason': 'user_busy',
            'message': 'The person you are trying to call is busy'
        }, to=sid)
        return
    
    # Create call record
    call_id = f"call_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{sid[:8]}"
    active_calls[call_id] = {
        'caller_sid': sid,
        'caller_id': caller_info.get('user_id'),
        'caller_name': caller_info.get('name', data.get('caller_name', 'Unknown')),
        'callee_sid': target_sid,
        'callee_id': target_user_id,
        'callee_name': target_info.get('name'),
        'call_type': call_type,
        'status': 'ringing',
        'started_at': datetime.utcnow().isoformat()
    }
    
    # Update statuses
    connected_users[sid]['status'] = 'in_call'
    connected_users[target_sid]['status'] = 'ringing'
    
    logger.info(f"Call initiated: {call_id} from {caller_info.get('name')} to {target_info.get('name')}")
    
    # Notify caller
    await sio.emit('call_ringing', {
        'call_id': call_id,
        'target_name': target_info.get('name')
    }, to=sid)
    
    # Notify callee (incoming call)
    await sio.emit('incoming_call', {
        'call_id': call_id,
        'caller_id': caller_info.get('user_id'),
        'caller_name': caller_info.get('name', 'Unknown'),
        'call_type': call_type
    }, to=target_sid)


@sio.event
async def call_accept(sid, data):
    """Callee accepts the call"""
    call_id = data.get('call_id')
    
    logger.info(f"=== CALL ACCEPT EVENT ===")
    logger.info(f"call_accept: Received from sid={sid}, call_id={call_id}")
    logger.info(f"call_accept: Active calls: {list(active_calls.keys())}")
    
    if call_id not in active_calls:
        logger.warning(f"call_accept: Call {call_id} not found in active_calls")
        await sio.emit('call_failed', {'reason': 'call_not_found'}, to=sid)
        return
    
    call = active_calls[call_id]
    logger.info(f"call_accept: Call info - caller_sid={call['caller_sid']}, callee_sid={call['callee_sid']}, callee_id={call['callee_id']}")
    
    # Check if this socket is the callee by user_id (more reliable than sid which can change)
    caller_info = connected_users.get(sid, {})
    accepting_user_id = caller_info.get('user_id')
    
    logger.info(f"call_accept: Accepting user_id={accepting_user_id}, expected callee_id={call['callee_id']}")
    
    # The callee could have reconnected with a new socket ID
    # So we check if the user_id matches the callee_id
    if call['callee_sid'] != sid:
        # Socket ID changed - check if user_id matches
        if accepting_user_id != call['callee_id']:
            logger.warning(f"call_accept: User {accepting_user_id} is not the callee {call['callee_id']}")
            await sio.emit('call_failed', {'reason': 'not_authorized'}, to=sid)
            return
        else:
            # User reconnected - update the callee_sid to their new socket
            logger.info(f"call_accept: Callee socket changed from {call['callee_sid']} to {sid}")
            call['callee_sid'] = sid
    
    call['status'] = 'accepted'
    if sid in connected_users:
        connected_users[sid]['status'] = 'in_call'
    
    logger.info(f"call_accept: Call {call_id} accepted by {accepting_user_id}")
    
    # Notify caller to start WebRTC negotiation (they will create the offer)
    logger.info(f"call_accept: Sending call_accepted to CALLER sid={call['caller_sid']}")
    await sio.emit('call_accepted', {
        'call_id': call_id,
        'callee_name': call['callee_name']
    }, to=call['caller_sid'])
    
    # Also notify callee with call_accepted so they prepare to receive the offer
    # The callee should NOT create an offer (createOffer=false)
    logger.info(f"call_accept: Sending call_accepted to CALLEE sid={sid} with is_callee=True")
    await sio.emit('call_accepted', {
        'call_id': call_id,
        'caller_name': call['caller_name'],
        'is_callee': True  # Flag to indicate they should wait for offer
    }, to=sid)
    
    logger.info(f"call_accept: Both parties notified, waiting for WebRTC offer from caller")


@sio.event
async def call_reject(sid, data):
    """Callee rejects the call"""
    call_id = data.get('call_id')
    reason = data.get('reason', 'rejected')
    
    if call_id not in active_calls:
        return
    
    call = active_calls[call_id]
    
    # Reset statuses
    if call['caller_sid'] in connected_users:
        connected_users[call['caller_sid']]['status'] = 'available'
    if call['callee_sid'] in connected_users:
        connected_users[call['callee_sid']]['status'] = 'available'
    
    logger.info(f"Call rejected: {call_id} - {reason}")
    
    # Notify caller
    await sio.emit('call_rejected', {
        'call_id': call_id,
        'reason': reason
    }, to=call['caller_sid'])
    
    del active_calls[call_id]


@sio.event
async def call_end(sid, data):
    """Either party ends the call"""
    call_id = data.get('call_id')
    
    if call_id not in active_calls:
        return
    
    call = active_calls[call_id]
    
    # Determine other party
    other_sid = call['callee_sid'] if call['caller_sid'] == sid else call['caller_sid']
    
    # Reset statuses
    if call['caller_sid'] in connected_users:
        connected_users[call['caller_sid']]['status'] = 'available'
    if call['callee_sid'] in connected_users:
        connected_users[call['callee_sid']]['status'] = 'available'
    
    logger.info(f"Call ended: {call_id}")
    
    # Notify other party
    await sio.emit('call_ended', {
        'call_id': call_id,
        'reason': 'ended_by_peer'
    }, to=other_sid)
    
    del active_calls[call_id]


# ============ WebRTC Signaling ============

@sio.event
async def webrtc_offer(sid, data):
    """Forward WebRTC offer to peer"""
    call_id = data.get('call_id')
    offer = data.get('offer')
    
    logger.info(f"=== WEBRTC OFFER EVENT ===")
    logger.info(f"webrtc_offer: Received from sid={sid}, call_id={call_id}")
    logger.info(f"webrtc_offer: Offer type={offer.get('type') if offer else 'None'}")
    logger.info(f"webrtc_offer: Active calls: {list(active_calls.keys())}")
    
    if call_id not in active_calls:
        logger.error(f"webrtc_offer: CRITICAL - Call {call_id} not found in active_calls!")
        logger.error(f"webrtc_offer: Available call IDs: {list(active_calls.keys())}")
        logger.error(f"webrtc_offer: This usually means call_id mismatch between client and server")
        # Emit error back to sender so they know the offer failed
        await sio.emit('webrtc_error', {
            'error': 'call_not_found',
            'call_id': call_id,
            'message': 'Call ID not found on server. Please retry the call.'
        }, to=sid)
        return
    
    call = active_calls[call_id]
    target_sid = call['callee_sid'] if call['caller_sid'] == sid else call['caller_sid']
    
    logger.info(f"webrtc_offer: Forwarding from {sid} to target_sid={target_sid}")
    logger.info(f"webrtc_offer: Is target in connected_users? {target_sid in connected_users}")
    
    if target_sid not in connected_users:
        logger.error(f"webrtc_offer: Target {target_sid} not in connected_users!")
        logger.error(f"webrtc_offer: Connected users: {list(connected_users.keys())}")
        await sio.emit('webrtc_error', {
            'error': 'peer_disconnected',
            'call_id': call_id,
            'message': 'The other party has disconnected.'
        }, to=sid)
        return
    
    await sio.emit('webrtc_offer', {
        'call_id': call_id,
        'offer': offer
    }, to=target_sid)
    
    logger.info(f"webrtc_offer: Offer forwarded successfully to {target_sid}")


@sio.event
async def webrtc_answer(sid, data):
    """Forward WebRTC answer to peer"""
    call_id = data.get('call_id')
    answer = data.get('answer')
    
    logger.info(f"=== WEBRTC ANSWER EVENT ===")
    logger.info(f"webrtc_answer: Received from sid={sid}, call_id={call_id}")
    logger.info(f"webrtc_answer: Answer type={answer.get('type') if answer else 'None'}")
    
    if call_id not in active_calls:
        logger.warning(f"webrtc_answer: Call {call_id} not found in active_calls")
        return
    
    call = active_calls[call_id]
    target_sid = call['callee_sid'] if call['caller_sid'] == sid else call['caller_sid']
    
    logger.info(f"webrtc_answer: Forwarding from {sid} to target_sid={target_sid}")
    
    await sio.emit('webrtc_answer', {
        'call_id': call_id,
        'answer': answer
    }, to=target_sid)
    
    logger.info(f"webrtc_answer: Answer forwarded successfully to {target_sid}")


@sio.event
async def webrtc_ice_candidate(sid, data):
    """Forward ICE candidate to peer"""
    call_id = data.get('call_id')
    candidate = data.get('candidate')
    
    if call_id not in active_calls:
        return
    
    call = active_calls[call_id]
    target_sid = call['callee_sid'] if call['caller_sid'] == sid else call['caller_sid']
    
    await sio.emit('webrtc_ice_candidate', {
        'call_id': call_id,
        'candidate': candidate
    }, to=target_sid)


# ============ API Endpoints ============

def get_online_staff_list():
    """Get list of online staff (for REST API)"""
    online = []
    for sid, user in connected_users.items():
        if user['user_type'] in ['counsellor', 'peer']:
            online.append({
                'user_id': user['user_id'],
                'user_type': user['user_type'],
                'name': user['name'],
                'status': user['status']
            })
    return online


def get_active_calls_list():
    """Get list of active calls (for admin)"""
    return list(active_calls.values())


# ============ Chat Messaging ============

# Track active chat rooms
# Format: {room_id: {participants: [user_ids], created_at}}
active_chat_rooms: Dict[str, dict] = {}


@sio.event
async def join_chat_room(sid, data):
    """
    User joins a chat room
    Data: {room_id, user_id, user_type, name}
    """
    room_id = data.get('room_id')
    user_id = data.get('user_id')
    user_type = data.get('user_type')
    name = data.get('name', 'Unknown')
    
    if not room_id:
        await sio.emit('chat_error', {'error': 'room_id required'}, to=sid)
        return
    
    # Join the Socket.IO room
    await sio.enter_room(sid, room_id)
    
    # Track user in room
    if room_id not in active_chat_rooms:
        active_chat_rooms[room_id] = {
            'participants': [],
            'created_at': datetime.utcnow().isoformat()
        }
    
    if user_id not in active_chat_rooms[room_id]['participants']:
        active_chat_rooms[room_id]['participants'].append(user_id)
    
    # Update connected users with room info
    if sid in connected_users:
        connected_users[sid]['current_room'] = room_id
        connected_users[sid]['name'] = name  # Store name for disconnect notification
    
    logger.info(f"User {name} ({user_id}) joined chat room {room_id}")
    
    # Notify room members
    await sio.emit('user_joined_chat', {
        'room_id': room_id,
        'user_id': user_id,
        'user_type': user_type,
        'name': name
    }, room=room_id, skip_sid=sid)
    
    # Confirm join to user
    await sio.emit('chat_room_joined', {
        'room_id': room_id,
        'participants': active_chat_rooms[room_id]['participants']
    }, to=sid)


@sio.event
async def leave_chat_room(sid, data):
    """User leaves a chat room"""
    room_id = data.get('room_id')
    user_id = data.get('user_id')
    
    if room_id:
        await sio.leave_room(sid, room_id)
        
        # Remove from tracking
        if room_id in active_chat_rooms and user_id in active_chat_rooms[room_id]['participants']:
            active_chat_rooms[room_id]['participants'].remove(user_id)
            
            # Clean up empty rooms
            if not active_chat_rooms[room_id]['participants']:
                del active_chat_rooms[room_id]
        
        # Clear room from user and reset status to available
        if sid in connected_users:
            connected_users[sid].pop('current_room', None)
            # Reset status to available when leaving chat
            if connected_users[sid].get('status') == 'in_chat':
                connected_users[sid]['status'] = 'available'
                logger.info(f"User {user_id} status reset to available after leaving chat")
        
        logger.info(f"User {user_id} left chat room {room_id}")
        
        # Get user name for notification
        user_name = 'User'
        if sid in connected_users:
            user_name = connected_users[sid].get('name', 'User')
        
        # Notify room members
        await sio.emit('user_left_chat', {
            'room_id': room_id,
            'user_id': user_id,
            'user_name': user_name,
            'reason': 'left'  # User chose to leave (vs 'disconnected')
        }, room=room_id)


@sio.event
async def chat_message(sid, data):
    """
    Send a chat message
    Data: {room_id, message, sender_id, sender_name, sender_type}
    """
    room_id = data.get('room_id')
    message = data.get('message')
    sender_id = data.get('sender_id')
    sender_name = data.get('sender_name', 'Unknown')
    sender_type = data.get('sender_type', 'user')
    
    if not room_id or not message:
        return
    
    message_data = {
        'room_id': room_id,
        'message': message,
        'sender_id': sender_id,
        'sender_name': sender_name,
        'sender_type': sender_type,
        'timestamp': datetime.utcnow().isoformat(),
        'message_id': f"msg_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{sid[:8]}"
    }
    
    logger.info(f"Chat message in room {room_id} from {sender_name}")
    
    # Broadcast to room (including sender for confirmation)
    await sio.emit('new_chat_message', message_data, room=room_id)


@sio.event
async def typing_start(sid, data):
    """User started typing"""
    room_id = data.get('room_id')
    user_id = data.get('user_id')
    user_name = data.get('user_name', 'Someone')
    
    if room_id:
        await sio.emit('user_typing', {
            'room_id': room_id,
            'user_id': user_id,
            'user_name': user_name,
            'is_typing': True
        }, room=room_id, skip_sid=sid)


@sio.event
async def typing_stop(sid, data):
    """User stopped typing"""
    room_id = data.get('room_id')
    user_id = data.get('user_id')
    
    if room_id:
        await sio.emit('user_typing', {
            'room_id': room_id,
            'user_id': user_id,
            'is_typing': False
        }, room=room_id, skip_sid=sid)


@sio.event
async def request_human_chat(sid, data):
    """
    User requests to chat with a human (handover from AI)
    Data: {user_id, user_name, reason?, preferred_type: 'counsellor'|'peer'|'any', session_id?, alert_id?}
    """
    user_id = data.get('user_id')
    user_name = data.get('user_name', 'A veteran')
    reason = data.get('reason', 'Requested human support')
    preferred_type = data.get('preferred_type', 'any')
    session_id = data.get('session_id', '')  # Original AI chat session ID for matching
    alert_id = data.get('alert_id', '')  # Associated safeguarding alert ID
    
    # Find available staff
    available_staff = []
    for socket_id, user in connected_users.items():
        if user['user_type'] in ['counsellor', 'peer'] and user['status'] == 'available':
            if preferred_type == 'any' or user['user_type'] == preferred_type:
                available_staff.append({
                    'socket_id': socket_id,
                    'user_id': user['user_id'],
                    'user_type': user['user_type'],
                    'name': user['name']
                })
    
    if not available_staff:
        # No staff available
        await sio.emit('human_chat_unavailable', {
            'message': 'No staff members are currently available. Please try again later or request a callback.',
            'suggestion': 'callback'
        }, to=sid)
        return
    
    # Create a chat request that goes to available staff
    request_id = f"req_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{sid[:8]}"
    
    logger.info(f"Human chat request from {user_name} ({user_id}), session: {session_id}, {len(available_staff)} staff available")
    
    # Notify all available staff about the request
    for staff in available_staff:
        await sio.emit('incoming_chat_request', {
            'request_id': request_id,
            'user_id': user_id,
            'user_name': user_name,
            'reason': reason,
            'preferred_type': preferred_type,
            'session_id': session_id,  # Pass the session ID for linking to safeguarding alerts
            'alert_id': alert_id,  # Pass the alert ID if available
            'timestamp': datetime.utcnow().isoformat()
        }, to=staff['socket_id'])
    
    # Notify user that request is pending
    await sio.emit('human_chat_pending', {
        'request_id': request_id,
        'message': 'Finding an available supporter...',
        'available_count': len(available_staff)
    }, to=sid)
    
    # Store request for tracking
    if sid in connected_users:
        connected_users[sid]['pending_chat_request'] = request_id


@sio.event
async def request_human_call(sid, data):
    """
    User requests a voice call with staff (from safeguarding flow)
    Data: {user_id, user_name, session_id?, alert_id?}
    This is emitted when the user navigates to peer-support and is ready to receive calls.
    """
    user_id = data.get('user_id')
    user_name = data.get('user_name', 'A veteran')
    session_id = data.get('session_id', '')  # Original AI chat session ID
    alert_id = data.get('alert_id', '')  # Associated safeguarding alert ID
    
    # Find available staff
    available_staff = []
    for socket_id, user in connected_users.items():
        if user['user_type'] in ['counsellor', 'peer'] and user['status'] == 'available':
            available_staff.append({
                'socket_id': socket_id,
                'user_id': user['user_id'],
                'user_type': user['user_type'],
                'name': user['name']
            })
    
    if not available_staff:
        # No staff available
        await sio.emit('human_call_unavailable', {
            'message': 'No staff members are currently available. Please try again later.',
            'suggestion': 'callback'
        }, to=sid)
        return
    
    # Create a call request that goes to available staff
    request_id = f"callreq_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{sid[:8]}"
    
    logger.info(f"Human call request from {user_name} ({user_id}), session: {session_id}, {len(available_staff)} staff available")
    
    # Notify all available staff about the call request
    for staff in available_staff:
        await sio.emit('incoming_call_request', {
            'request_id': request_id,
            'user_id': user_id,
            'user_name': user_name,
            'session_id': session_id,
            'alert_id': alert_id,
            'request_type': 'call',
            'timestamp': datetime.utcnow().isoformat()
        }, to=staff['socket_id'])
    
    # Notify user that request is pending
    await sio.emit('human_call_pending', {
        'request_id': request_id,
        'message': 'Finding an available supporter to call you...',
        'available_count': len(available_staff)
    }, to=sid)
    
    # Store request for tracking
    if sid in connected_users:
        connected_users[sid]['pending_call_request'] = request_id


@sio.event
async def accept_chat_request(sid, data):
    """
    Staff accepts a chat request
    Data: {request_id, user_id (of the requester)}
    """
    request_id = data.get('request_id')
    requester_user_id = data.get('user_id')
    
    logger.info(f"=== ACCEPT CHAT REQUEST ===")
    logger.info(f"accept_chat_request: request_id={request_id}, requester_user_id={requester_user_id}")
    logger.info(f"accept_chat_request: user_to_socket keys: {list(user_to_socket.keys())}")
    
    staff_info = connected_users.get(sid, {})
    
    if staff_info.get('user_type') not in ['counsellor', 'peer']:
        logger.warning(f"accept_chat_request: Staff type not valid: {staff_info.get('user_type')}")
        return
    
    # Find the requester's socket
    requester_sid = user_to_socket.get(requester_user_id)
    
    logger.info(f"accept_chat_request: Found requester_sid={requester_sid}")
    
    if not requester_sid:
        logger.warning(f"accept_chat_request: User {requester_user_id} not found in user_to_socket")
        await sio.emit('chat_request_expired', {
            'request_id': request_id,
            'reason': 'User no longer connected'
        }, to=sid)
        return
    
    # Create a chat room
    room_id = f"chat_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{staff_info.get('user_id', '')[:8]}"
    
    logger.info(f"accept_chat_request: Creating room {room_id}")
    
    # Create the room in the database so the API can find it
    # IMPORTANT: Must use live_chat_rooms collection to match the API endpoints in server.py
    try:
        from server import db, live_chat_rooms
        room_doc = {
            "id": room_id,
            "user_session_id": requester_user_id,
            "staff_id": staff_info.get('user_id'),
            "staff_name": staff_info.get('name'),
            "status": "active",
            "request_type": staff_info.get('user_type'),
            "created_at": datetime.utcnow().isoformat(),
            "messages": []
        }
        # Add to in-memory dict for immediate access
        live_chat_rooms[room_id] = room_doc.copy()
        # Also persist to database
        await db.live_chat_rooms.insert_one(room_doc)
        logger.info(f"Created chat room in database AND in-memory: {room_id}")
    except Exception as e:
        logger.error(f"Error creating chat room in database: {e}")
    
    # Update staff status
    connected_users[sid]['status'] = 'in_chat'
    
    logger.info(f"Staff {staff_info.get('name')} accepted chat request {request_id}, room: {room_id}")
    
    # Notify the requester
    logger.info(f"accept_chat_request: Emitting human_chat_accepted to requester {requester_sid}")
    await sio.emit('human_chat_accepted', {
        'request_id': request_id,
        'room_id': room_id,
        'staff_id': staff_info.get('user_id'),
        'staff_name': staff_info.get('name'),
        'staff_type': staff_info.get('user_type')
    }, to=requester_sid)
    
    # Confirm to staff
    logger.info(f"accept_chat_request: Emitting chat_request_confirmed to staff {sid}")
    await sio.emit('chat_request_confirmed', {
        'request_id': request_id,
        'room_id': room_id,
        'user_id': requester_user_id
    }, to=sid)
    
    logger.info(f"accept_chat_request: Done, chat room {room_id} created and both parties notified")



@sio.event
async def staff_chat_invite(sid, data):
    """
    Staff initiates chat with a user from safeguarding alert
    Data: {session_id, staff_id, staff_name, alert_id}
    """
    session_id = data.get('session_id')
    staff_id = data.get('staff_id')
    staff_name = data.get('staff_name')
    alert_id = data.get('alert_id')
    
    logger.info(f"Staff {staff_name} sending chat invite for session {session_id}")
    
    # Try to find the user by their session ID
    target_sid = None
    for socket_id, user in connected_users.items():
        # Check if the user's ID contains the session ID or vice versa
        user_id = user.get('user_id', '')
        if session_id and (session_id in user_id or user_id in session_id):
            target_sid = socket_id
            break
    
    if target_sid:
        # User is connected - send them the chat invite
        await sio.emit('staff_chat_invite', {
            'staff_id': staff_id,
            'staff_name': staff_name,
            'alert_id': alert_id,
            'message': f'{staff_name} would like to chat with you'
        }, to=target_sid)
        
        logger.info(f"Chat invite sent to user {target_sid}")
    else:
        # User not connected - notify staff
        await sio.emit('chat_invite_failed', {
            'reason': 'User is not currently connected',
            'session_id': session_id
        }, to=sid)
        logger.info(f"User for session {session_id} not connected")


def get_active_chat_rooms():
    """Get list of active chat rooms (for admin)"""
    return active_chat_rooms
