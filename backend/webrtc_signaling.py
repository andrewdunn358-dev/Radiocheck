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
from services.database import get_database

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

# Reverse lookup: user_id -> set of socket_ids (supports multiple connections per user)
# A user can have multiple tabs/devices connected simultaneously
user_to_sockets: Dict[str, set] = {}

# Track claimed chat requests to prevent multiple staff accepting same request
claimed_chat_requests: set = set()

# Track claimed call requests to prevent multiple staff accepting same call request
# Format: {request_id: {claimed_by, claimed_by_name, claimed_at, call_id}}
claimed_call_requests: Dict[str, dict] = {}

# Track pending disconnect notifications (for grace period)
# Format: {user_id: asyncio.Task}
pending_disconnects: Dict[str, asyncio.Task] = {}

# Grace period in seconds before notifying about disconnect
DISCONNECT_GRACE_PERIOD = 10

# Standardized status values used across the system
# 'available' - Ready to take calls/chats
# 'limited' - Busy but can be interrupted (shown as "Busy" in UI)
# 'unavailable' - Not taking calls/chats (shown as "Off Duty" in UI)
# 'offline' - Disconnected/logged out
VALID_STATUSES = ['available', 'limited', 'unavailable', 'offline']


async def update_staff_status_in_db(user_id: str, user_type: str, new_status: str):
    """
    Update staff status in the database.
    Works for both counsellors and peer_supporters.
    """
    try:
        db = get_database()
        update_data = {
            "status": new_status,
            "updated_at": datetime.utcnow()
        }
        
        if user_type == 'counsellor':
            result = await db.counsellors.update_one(
                {"user_id": user_id},
                {"$set": update_data}
            )
            logger.info(f"Updated counsellor {user_id} status to {new_status}: {result.modified_count} modified")
        elif user_type == 'peer':
            result = await db.peer_supporters.update_one(
                {"user_id": user_id},
                {"$set": update_data}
            )
            logger.info(f"Updated peer supporter {user_id} status to {new_status}: {result.modified_count} modified")
        else:
            logger.info(f"User {user_id} is type {user_type} - no database update needed")
    except Exception as e:
        logger.error(f"Failed to update status in database for {user_id}: {e}")


@sio.event
async def connect(sid, environ):
    """Handle new connection"""
    logger.info(f"Client connected: {sid}")
    await sio.emit('connected', {'sid': sid}, to=sid)


@sio.event
async def disconnect(sid):
    """Handle disconnection with grace period for reconnection"""
    logger.info(f"Client disconnected: {sid}")
    
    # Get user info before removing
    user_info = connected_users.get(sid)
    
    if not user_info:
        logger.info(f"No user info found for disconnected sid: {sid}")
        return
    
    user_id = user_info.get('user_id')
    current_room = user_info.get('current_room')
    user_type = user_info.get('user_type')
    user_name = user_info.get('name', 'User')
    
    # Clean up from connected_users immediately
    if sid in connected_users:
        del connected_users[sid]
    
    # Remove this socket from user's socket set
    if user_id and user_id in user_to_sockets:
        user_to_sockets[user_id].discard(sid)
        # Only clean up if NO sockets remain for this user
        if not user_to_sockets[user_id]:
            del user_to_sockets[user_id]
            logger.info(f"All connections closed for user {user_id}")
        else:
            logger.info(f"User {user_id} still has {len(user_to_sockets[user_id])} active connections")
    
    # End any active calls immediately (no grace period for calls)
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
    
    # For chat room notifications, use a grace period to allow reconnection
    if current_room:
        logger.info(f"User {user_id} (type: {user_type}) disconnected while in chat room {current_room}")
        logger.info(f"Starting {DISCONNECT_GRACE_PERIOD}s grace period before notifying...")
        
        # Cancel any existing pending disconnect for this user
        if user_id in pending_disconnects:
            pending_disconnects[user_id].cancel()
            logger.info(f"Cancelled previous pending disconnect for {user_id}")
        
        # Create a delayed notification task
        async def delayed_disconnect_notification():
            try:
                await asyncio.sleep(DISCONNECT_GRACE_PERIOD)
                
                # Check if user reconnected during grace period
                if user_id in user_to_sockets and user_to_sockets[user_id]:
                    logger.info(f"User {user_id} reconnected during grace period - not sending disconnect notification")
                    return
                
                logger.info(f"Grace period expired - sending disconnect notification for {user_id}")
                
                # Emit to the room
                await sio.emit('user_left_chat', {
                    'room_id': current_room,
                    'user_id': user_id,
                    'reason': 'disconnected',
                    'user_name': user_name
                }, room=current_room)
                
                # Also emit to all connected staff (in case they're not in the room)
                if user_type == 'user':
                    for staff_sid, staff_info in connected_users.items():
                        if staff_info.get('user_type') in ['counsellor', 'peer', 'admin']:
                            logger.info(f"Notifying staff {staff_info.get('user_id')} about user disconnect")
                            await sio.emit('user_left_chat', {
                                'room_id': current_room,
                                'user_id': user_id,
                                'reason': 'disconnected',
                                'user_name': user_name
                            }, to=staff_sid)
                
                # Notify about staff going offline
                if user_type in ['counsellor', 'peer']:
                    await sio.emit('staff_offline', {
                        'user_id': user_id,
                        'name': user_name
                    })
                    # Update status in database to 'offline'
                    await update_staff_status_in_db(user_id, user_type, 'offline')
                
            except asyncio.CancelledError:
                logger.info(f"Disconnect notification cancelled for {user_id} (user reconnected)")
            finally:
                # Clean up pending disconnect
                if user_id in pending_disconnects:
                    del pending_disconnects[user_id]
        
        # Start the delayed task
        task = asyncio.create_task(delayed_disconnect_notification())
        pending_disconnects[user_id] = task
    
    else:
        # No chat room - just notify about staff going offline immediately
        if user_type in ['counsellor', 'peer']:
            await sio.emit('staff_offline', {
                'user_id': user_id,
                'name': user_name
            })
            # Update status in database to 'offline'
            await update_staff_status_in_db(user_id, user_type, 'offline')


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
    
    # Cancel any pending disconnect notification for this user (they reconnected!)
    if user_id in pending_disconnects:
        pending_disconnects[user_id].cancel()
        logger.info(f"Cancelled pending disconnect for {user_id} - user reconnected")
        del pending_disconnects[user_id]
    
    # Store connection info
    connected_users[sid] = {
        'user_id': user_id,
        'user_type': user_type,
        'name': name,
        'status': status,
        'connected_at': datetime.utcnow().isoformat()
    }
    
    # Add this socket to the user's set of connections
    if user_id not in user_to_sockets:
        user_to_sockets[user_id] = set()
    user_to_sockets[user_id].add(sid)
    
    logger.info(f"User registered: {name} ({user_type}) - {user_id} (now has {len(user_to_sockets[user_id])} connections)")
    
    await sio.emit('registered', {
        'success': True,
        'user_id': user_id,
        'user_type': user_type
    }, to=sid)
    
    # If staff, notify others and update database status
    if user_type in ['counsellor', 'peer']:
        await sio.emit('staff_online', {
            'user_id': user_id,
            'user_type': user_type,
            'name': name,
            'status': status
        })
        # Update status in database to 'available' (or whatever status they registered with)
        await update_staff_status_in_db(user_id, user_type, status)


@sio.event
async def update_status(sid, data):
    """Update staff availability status"""
    if sid in connected_users:
        new_status = data.get('status', 'available')
        old_status = connected_users[sid].get('status')
        user_id = connected_users[sid].get('user_id')
        user_type = connected_users[sid].get('user_type')
        
        connected_users[sid]['status'] = new_status
        logger.info(f"Status updated for {sid}: {old_status} -> {new_status}")


@sio.event
async def heartbeat(sid, data):
    """Handle heartbeat from clients to maintain connection health"""
    if sid in connected_users:
        user_id = data.get('user_id')
        connected_users[sid]['last_heartbeat'] = datetime.utcnow().isoformat()
        # Update connected_at to track activity
        connected_users[sid]['last_activity'] = datetime.utcnow().isoformat()
        # Emit heartbeat acknowledgment
        await sio.emit('heartbeat_ack', {
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': user_id
        }, to=sid)
        
        await sio.emit('staff_status_changed', {
            'user_id': user_id,
            'status': new_status
        })
        
        # Update status in database
        if user_type in ['counsellor', 'peer']:
            await update_staff_status_in_db(user_id, user_type, new_status)


@sio.event
async def force_available(sid, data):
    """
    Force a user's status back to 'available' and clean up any orphaned calls.
    Used when status gets stuck due to disconnects, timeouts, etc.
    """
    if sid in connected_users:
        user_id = connected_users[sid].get('user_id')
        old_status = connected_users[sid].get('status')
        
        # Clean up any active calls involving this user
        for call_id in list(active_calls.keys()):
            call = active_calls[call_id]
            if call['caller_sid'] == sid or call['callee_sid'] == sid:
                logger.info(f"Cleaning up orphaned call {call_id} for user {user_id}")
                # Notify the other party
                other_sid = call['callee_sid'] if call['caller_sid'] == sid else call['caller_sid']
                if other_sid in connected_users:
                    connected_users[other_sid]['status'] = 'available'
                    await sio.emit('call_ended', {
                        'call_id': call_id,
                        'reason': 'cleanup'
                    }, to=other_sid)
                del active_calls[call_id]
        
        # Force status to available
        connected_users[sid]['status'] = 'available'
        logger.info(f"Force reset status for {user_id}: {old_status} -> available")
        
        await sio.emit('status_reset', {
            'user_id': user_id,
            'status': 'available',
            'message': 'Status reset to available'
        }, to=sid)
        
        # Broadcast to others
        await sio.emit('staff_status_changed', {
            'user_id': user_id,
            'status': 'available'
        })


@sio.event
async def get_online_staff(sid, data):
    """Get list of online staff members"""
    online_staff = []
    for socket_id, user in connected_users.items():
        if user['user_type'] in ['counsellor', 'peer', 'peer_supporter', 'staff', 'supervisor'] and user['status'] == 'available':
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
    Data: {target_user_id, caller_name, call_type: 'audio'|'video', call_id (optional from client)}
    """
    target_user_id = data.get('target_user_id')
    caller_info = connected_users.get(sid, {})
    call_type = data.get('call_type', 'audio')
    client_call_id = data.get('call_id')  # Client may provide their own call_id
    
    logger.info("=== CALL INITIATE ===")
    logger.info(f"Caller SID: {sid}")
    logger.info(f"Caller info: {caller_info}")
    logger.info(f"Target user_id: {target_user_id}")
    logger.info(f"Client call_id: {client_call_id}")
    logger.info(f"All connected users: {list(connected_users.keys())}")
    logger.info(f"User to socket mapping: {dict((k, list(v)) for k, v in user_to_sockets.items())}")
    
    # Find target's sockets (user may have multiple tabs/devices)
    target_sids = user_to_sockets.get(target_user_id, set())
    
    logger.info(f"Found target_sids: {target_sids}")
    
    if not target_sids:
        logger.warning(f"Target user {target_user_id} not found in user_to_sockets mapping!")
        await sio.emit('call_failed', {
            'reason': 'user_offline',
            'message': 'The person you are trying to call is not available'
        }, to=sid)
        return
    
    # Use the first socket for status checks (they all represent the same user)
    target_sid = next(iter(target_sids))
    target_info = connected_users.get(target_sid, {})
    logger.info(f"Target info: {target_info}")
    
    # IMPROVED: Allow calling users in 'in_chat' status (they can answer while chatting)
    # Also check if they're in a real call vs stuck status
    target_status = target_info.get('status', 'offline')
    if target_status not in ['available', 'in_chat']:
        # If status is 'limited' or 'unavailable', they've explicitly set themselves busy/off
        if target_status in ['limited', 'unavailable', 'busy']:
            logger.info(f"Target user {target_user_id} status is '{target_status}' - not available for calls")
            await sio.emit('call_failed', {
                'reason': 'user_busy',
                'message': 'The person you are trying to call is not available'
            }, to=sid)
            return
        
        # Check if this is a stuck status - no active call for this user
        is_actually_busy = False
        for call_id, call in active_calls.items():
            if call['callee_sid'] == target_sid or call['caller_sid'] == target_sid:
                is_actually_busy = True
                break
        
        if not is_actually_busy:
            # Status is stuck - auto-reset to available
            logger.warning(f"Target user {target_user_id} status was stuck as '{target_status}', resetting to 'available'")
            connected_users[target_sid]['status'] = 'available'
        else:
            logger.warning(f"Target user {target_user_id} is genuinely busy, status: {target_status}")
            await sio.emit('call_failed', {
                'reason': 'user_busy',
                'message': 'The person you are trying to call is busy'
            }, to=sid)
            return
    
    # Create call record - use client's call_id if provided, otherwise generate one
    call_id = client_call_id or f"call_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{sid[:8]}"
    active_calls[call_id] = {
        'caller_sid': sid,
        'caller_id': caller_info.get('user_id'),
        'caller_name': caller_info.get('name', data.get('caller_name', 'Unknown')),
        'callee_sids': target_sids.copy(),  # Store ALL sockets for the callee
        'callee_id': target_user_id,
        'callee_name': target_info.get('name'),
        'call_type': call_type,
        'status': 'ringing',
        'started_at': datetime.utcnow().isoformat()
    }
    
    # Update statuses
    connected_users[sid]['status'] = 'in_call'
    # Update status on ALL callee's sockets
    for ts in target_sids:
        if ts in connected_users:
            connected_users[ts]['status'] = 'ringing'
    
    logger.info(f"Call initiated: {call_id} from {caller_info.get('name')} to {target_info.get('name')} ({len(target_sids)} devices)")
    
    # Notify caller
    await sio.emit('call_ringing', {
        'call_id': call_id,
        'target_name': target_info.get('name')
    }, to=sid)
    
    # Notify callee on ALL their connected devices/tabs (incoming call)
    for ts in target_sids:
        await sio.emit('incoming_call', {
            'call_id': call_id,
            'caller_id': caller_info.get('user_id'),
            'caller_name': caller_info.get('name', 'Unknown'),
            'call_type': call_type
        }, to=ts)
        logger.info(f"Sent incoming_call to socket {ts}")


@sio.event
async def call_accept(sid, data):
    """Callee accepts the call"""
    call_id = data.get('call_id')
    
    logger.info("=== CALL ACCEPT EVENT ===")
    logger.info(f"call_accept: Received from sid={sid}, call_id={call_id}")
    logger.info(f"call_accept: Active calls: {list(active_calls.keys())}")
    
    if call_id not in active_calls:
        logger.warning(f"call_accept: Call {call_id} not found in active_calls")
        await sio.emit('call_failed', {'reason': 'call_not_found'}, to=sid)
        return
    
    call = active_calls[call_id]
    callee_sids = call.get('callee_sids', set())
    logger.info(f"call_accept: Call info - caller_sid={call['caller_sid']}, callee_sids={callee_sids}, callee_id={call['callee_id']}")
    
    # Check if this socket is the callee by user_id (more reliable than sid which can change)
    caller_info = connected_users.get(sid, {})
    accepting_user_id = caller_info.get('user_id')
    
    logger.info(f"call_accept: Accepting user_id={accepting_user_id}, expected callee_id={call['callee_id']}")
    
    # Verify the accepting user is the callee
    if accepting_user_id != call['callee_id']:
        logger.warning(f"call_accept: User {accepting_user_id} is not the callee {call['callee_id']}")
        await sio.emit('call_failed', {'reason': 'not_authorized'}, to=sid)
        return
    
    # Store the specific socket that answered
    call['answered_by_sid'] = sid
    call['status'] = 'accepted'
    
    if sid in connected_users:
        connected_users[sid]['status'] = 'in_call'
    
    logger.info(f"call_accept: Call {call_id} accepted by {accepting_user_id}")
    
    # Stop ringing on ALL other devices for this user (they already answered on this one)
    for other_sid in callee_sids:
        if other_sid != sid and other_sid in connected_users:
            connected_users[other_sid]['status'] = 'available'
            await sio.emit('call_answered_elsewhere', {
                'call_id': call_id,
                'message': 'Call answered on another device'
            }, to=other_sid)
            logger.info(f"Notified {other_sid} that call was answered elsewhere")
    
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
    
    logger.info("call_accept: Both parties notified, waiting for WebRTC offer from caller")


@sio.event
async def call_reject(sid, data):
    """Callee rejects the call"""
    call_id = data.get('call_id')
    reason = data.get('reason', 'rejected')
    
    if call_id not in active_calls:
        return
    
    call = active_calls[call_id]
    callee_sids = call.get('callee_sids', set())
    
    # Reset statuses
    if call['caller_sid'] in connected_users:
        connected_users[call['caller_sid']]['status'] = 'available'
    # Reset status on ALL callee's sockets
    for cs in callee_sids:
        if cs in connected_users:
            connected_users[cs]['status'] = 'available'
    
    logger.info(f"Call rejected: {call_id} - {reason}")
    
    # Notify caller
    await sio.emit('call_rejected', {
        'call_id': call_id,
        'reason': reason
    }, to=call['caller_sid'])
    
    # Stop ringing on all other devices
    for cs in callee_sids:
        if cs != sid:
            await sio.emit('call_cancelled', {
                'call_id': call_id,
                'reason': 'rejected_on_another_device'
            }, to=cs)
    
    del active_calls[call_id]


@sio.event
async def call_end(sid, data):
    """Either party ends the call"""
    call_id = data.get('call_id')
    
    if call_id not in active_calls:
        return
    
    call = active_calls[call_id]
    callee_sids = call.get('callee_sids', set())
    answered_sid = call.get('answered_by_sid')
    
    # Determine other party - if we know which socket answered, use that
    if call['caller_sid'] == sid:
        other_sid = answered_sid if answered_sid else next(iter(callee_sids), None)
    else:
        other_sid = call['caller_sid']
    
    # Reset statuses
    if call['caller_sid'] in connected_users:
        connected_users[call['caller_sid']]['status'] = 'available'
    # Reset status on ALL callee's sockets
    for cs in callee_sids:
        if cs in connected_users:
            connected_users[cs]['status'] = 'available'
    
    logger.info(f"Call ended: {call_id}")
    
    # Notify other party
    if other_sid:
        await sio.emit('call_ended', {
            'call_id': call_id,
            'reason': 'ended_by_peer'
        }, to=other_sid)
    
    del active_calls[call_id]


@sio.event
async def webrtc_end_call(sid, data):
    """
    Handle WebRTC call end event from staff portal.
    This is emitted when staff clicks "End Call" button.
    """
    call_id = data.get('call_id')
    
    logger.info(f"=== WEBRTC END CALL ===")
    logger.info(f"webrtc_end_call: sid={sid}, call_id={call_id}")
    
    if not call_id:
        logger.warning("webrtc_end_call: No call_id provided")
        return
    
    if call_id not in active_calls:
        logger.warning(f"webrtc_end_call: Call {call_id} not found in active_calls")
        # Still emit call_ended to ensure cleanup on sender's side
        await sio.emit('call_ended', {
            'call_id': call_id,
            'reason': 'call_not_found'
        }, to=sid)
        return
    
    call = active_calls[call_id]
    callee_sids = call.get('callee_sids', set())
    answered_sid = call.get('answered_by_sid')
    caller_sid = call.get('caller_sid')
    
    logger.info(f"webrtc_end_call: caller_sid={caller_sid}, callee_sids={callee_sids}, answered_sid={answered_sid}")
    
    # Determine who is ending and who needs to be notified
    if caller_sid == sid:
        # Staff (caller) is ending - notify user (callee)
        other_sids = [answered_sid] if answered_sid else list(callee_sids)
    else:
        # User (callee) is ending - notify staff (caller)
        other_sids = [caller_sid] if caller_sid else []
    
    logger.info(f"webrtc_end_call: Notifying other party sids: {other_sids}")
    
    # Reset statuses
    if caller_sid and caller_sid in connected_users:
        connected_users[caller_sid]['status'] = 'available'
        logger.info(f"webrtc_end_call: Reset caller {caller_sid} status to available")
    
    for cs in callee_sids:
        if cs in connected_users:
            connected_users[cs]['status'] = 'available'
            logger.info(f"webrtc_end_call: Reset callee {cs} status to available")
    
    # Notify all other parties
    for other_sid in other_sids:
        if other_sid and other_sid in connected_users:
            logger.info(f"webrtc_end_call: Sending call_ended to {other_sid}")
            await sio.emit('call_ended', {
                'call_id': call_id,
                'reason': 'ended_by_peer'
            }, to=other_sid)
    
    # Remove from active calls
    del active_calls[call_id]
    logger.info(f"webrtc_end_call: Call {call_id} removed from active_calls")


# ============ WebRTC Signaling ============

@sio.event
async def webrtc_offer(sid, data):
    """Forward WebRTC offer to peer"""
    call_id = data.get('call_id')
    offer = data.get('offer')
    
    logger.info("=== WEBRTC OFFER EVENT ===")
    logger.info(f"webrtc_offer: Received from sid={sid}, call_id={call_id}")
    logger.info(f"webrtc_offer: Offer type={offer.get('type') if offer else 'None'}")
    logger.info(f"webrtc_offer: Active calls: {list(active_calls.keys())}")
    
    if call_id not in active_calls:
        logger.error(f"webrtc_offer: CRITICAL - Call {call_id} not found in active_calls!")
        logger.error(f"webrtc_offer: Available call IDs: {list(active_calls.keys())}")
        logger.error("webrtc_offer: This usually means call_id mismatch between client and server")
        # Emit error back to sender so they know the offer failed
        await sio.emit('webrtc_error', {
            'error': 'call_not_found',
            'call_id': call_id,
            'message': 'Call ID not found on server. Please retry the call.'
        }, to=sid)
        return
    
    call = active_calls[call_id]
    
    # Determine target - use answered_by_sid if available (multi-session support)
    if call['caller_sid'] == sid:
        # Caller sending offer to callee
        target_sid = call.get('answered_by_sid') or next(iter(call.get('callee_sids', set())), None)
    else:
        # Callee sending offer to caller (shouldn't happen normally)
        target_sid = call['caller_sid']
    
    logger.info(f"webrtc_offer: Forwarding from {sid} to target_sid={target_sid}")
    logger.info(f"webrtc_offer: Is target in connected_users? {target_sid in connected_users if target_sid else False}")
    
    if not target_sid or target_sid not in connected_users:
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
    
    logger.info("=== WEBRTC ANSWER EVENT ===")
    logger.info(f"webrtc_answer: Received from sid={sid}, call_id={call_id}")
    logger.info(f"webrtc_answer: Answer type={answer.get('type') if answer else 'None'}")
    
    if call_id not in active_calls:
        logger.warning(f"webrtc_answer: Call {call_id} not found in active_calls")
        return
    
    call = active_calls[call_id]
    
    # Determine target - answer always goes back to caller from callee
    if call['caller_sid'] == sid:
        # Caller sending answer (unusual)
        target_sid = call.get('answered_by_sid') or next(iter(call.get('callee_sids', set())), None)
    else:
        # Callee sending answer to caller (normal flow)
        target_sid = call['caller_sid']
    
    logger.info(f"webrtc_answer: Forwarding from {sid} to target_sid={target_sid}")
    
    if target_sid and target_sid in connected_users:
        await sio.emit('webrtc_answer', {
            'call_id': call_id,
            'answer': answer
        }, to=target_sid)
        logger.info(f"webrtc_answer: Answer forwarded successfully to {target_sid}")
    else:
        logger.warning(f"webrtc_answer: Target {target_sid} not connected")


@sio.event
async def webrtc_ice_candidate(sid, data):
    """Forward ICE candidate to peer"""
    call_id = data.get('call_id')
    candidate = data.get('candidate')
    
    if call_id not in active_calls:
        return
    
    call = active_calls[call_id]
    
    # Determine target based on multi-session support
    if call['caller_sid'] == sid:
        # Caller sending ICE to callee
        target_sid = call.get('answered_by_sid') or next(iter(call.get('callee_sids', set())), None)
    else:
        # Callee sending ICE to caller
        target_sid = call['caller_sid']
    
    if target_sid and target_sid in connected_users:
        await sio.emit('webrtc_ice_candidate', {
            'call_id': call_id,
            'candidate': candidate
        }, to=target_sid)


# ============ API Endpoints ============

def get_online_staff_list():
    """Get list of online staff (for REST API)"""
    online = []
    for sid, user in connected_users.items():
        if user['user_type'] in ['counsellor', 'peer', 'peer_supporter', 'staff', 'supervisor']:
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
    
    logger.info("=== REQUEST_HUMAN_CHAT EVENT ===")
    logger.info(f"From user: {user_name} ({user_id}), session: {session_id}, alert: {alert_id}")
    logger.info(f"Total connected users: {len(connected_users)}")
    
    # Log all connected users for debugging
    for socket_id, user in connected_users.items():
        logger.info(f"  Connected: {user.get('name')} ({user.get('user_id')}) - type: {user.get('user_type')}, status: {user.get('status')}")
    
    # Find available staff (also reset any stuck statuses)
    available_staff = []
    for socket_id, user in connected_users.items():
        if user['user_type'] in ['counsellor', 'peer', 'peer_supporter', 'staff', 'supervisor']:
            user_status = user.get('status', 'offline')
            
            # Skip staff who have explicitly set themselves as unavailable or limited
            if user_status in ['limited', 'unavailable', 'busy', 'offline']:
                logger.info(f"  Skipping {user.get('name')} - status: {user_status}")
                continue
            
            # Check if status is stuck (not 'available' but not intentionally set)
            if user_status != 'available':
                is_actually_busy = False
                # Check active calls
                for call_id, call in active_calls.items():
                    if call['caller_sid'] == socket_id or call['callee_sid'] == socket_id:
                        is_actually_busy = True
                        break
                # Check active chat rooms
                for room_id, room in active_chat_rooms.items():
                    if room.get('staff_sid') == socket_id:
                        is_actually_busy = True
                        break
                
                if not is_actually_busy:
                    # Status is stuck - auto-reset to available
                    logger.warning(f"Auto-resetting stuck status for {user.get('name')}: {user_status} -> available")
                    connected_users[socket_id]['status'] = 'available'
                    user_status = 'available'
            
            if user_status == 'available':
                if preferred_type == 'any' or user['user_type'] == preferred_type:
                    available_staff.append({
                        'socket_id': socket_id,
                        'user_id': user['user_id'],
                        'user_type': user['user_type'],
                        'name': user['name']
                    })
    
    logger.info(f"Available staff count: {len(available_staff)}")
    
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
    
    print(f"[CALL_REQUEST] === REQUEST_HUMAN_CALL EVENT ===")
    print(f"[CALL_REQUEST] From user: {user_name} ({user_id}), session: {session_id}, alert: {alert_id}")
    print(f"[CALL_REQUEST] Total connected users: {len(connected_users)}")
    
    logger.info("=== REQUEST_HUMAN_CALL EVENT ===")
    logger.info(f"From user: {user_name} ({user_id}), session: {session_id}, alert: {alert_id}")
    logger.info(f"Total connected users: {len(connected_users)}")
    
    # Log all connected users for debugging
    for socket_id, user in connected_users.items():
        print(f"[CALL_REQUEST]   Connected: {user.get('name')} ({user.get('user_id')}) - type: {user.get('user_type')}, status: {user.get('status')}")
        logger.info(f"  Connected: {user.get('name')} ({user.get('user_id')}) - type: {user.get('user_type')}, status: {user.get('status')}")
    
    # Find available staff (also reset any stuck statuses)
    available_staff = []
    for socket_id, user in connected_users.items():
        if user['user_type'] in ['counsellor', 'peer', 'peer_supporter', 'staff', 'supervisor']:
            user_status = user.get('status', 'offline')
            
            # Check if status is stuck (not in a real active call)
            if user_status not in ['available', 'offline']:
                is_in_active_call = False
                for call_id, call in active_calls.items():
                    if call['caller_sid'] == socket_id or call['callee_sid'] == socket_id:
                        is_in_active_call = True
                        break
                
                if not is_in_active_call:
                    # Status is stuck - auto-reset to available
                    logger.warning(f"Auto-resetting stuck status for {user.get('name')}: {user_status} -> available")
                    connected_users[socket_id]['status'] = 'available'
                    user_status = 'available'
            
            if user_status == 'available':
                available_staff.append({
                    'socket_id': socket_id,
                    'user_id': user['user_id'],
                    'user_type': user['user_type'],
                    'name': user['name']
                })
    
    logger.info(f"Available staff count: {len(available_staff)}")
    print(f"[CALL_REQUEST] Available staff count: {len(available_staff)}")
    
    if not available_staff:
        # No staff available
        print(f"[CALL_REQUEST] No available staff found! Sending human_call_unavailable to user {sid}")
        logger.warning(f"No available staff found! Sending human_call_unavailable to user {sid}")
        await sio.emit('human_call_unavailable', {
            'message': 'No staff members are currently available. Please try again later.',
            'suggestion': 'callback'
        }, to=sid)
        return
    
    # Create a call request that goes to available staff
    request_id = f"callreq_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{sid[:8]}"
    
    print(f"[CALL_REQUEST] Created request_id: {request_id}")
    logger.info(f"Human call request from {user_name} ({user_id}), session: {session_id}, {len(available_staff)} staff available")
    
    # Notify all available staff about the call request
    for staff in available_staff:
        print(f"[CALL_REQUEST] Emitting incoming_call_request to staff: {staff['name']} ({staff['user_id']}) socket: {staff['socket_id']}")
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
async def accept_call_request(sid, data):
    """
    Staff accepts a call request (safeguarding flow)
    Data: {request_id, user_id, staff_id, staff_name, staff_type}
    """
    request_id = data.get('request_id')
    requester_user_id = data.get('user_id')
    staff_id = data.get('staff_id')
    staff_name = data.get('staff_name', 'Staff')
    staff_type = data.get('staff_type', 'counsellor')
    
    logger.info("=== ACCEPT CALL REQUEST ===")
    logger.info(f"Staff {staff_name} ({staff_id}) accepting call request {request_id} from user {requester_user_id}")
    
    # Generate a call ID early (needed for claimed notification)
    call_id = f"call_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{staff_id[:8] if staff_id else 'staff'}"
    
    # Mark this request as claimed FIRST so other staff see it's taken
    # This happens BEFORE checking if user is still connected
    claimed_call_requests[request_id] = {
        'claimed_by': staff_id,
        'claimed_by_name': staff_name,
        'claimed_at': datetime.utcnow().isoformat(),
        'call_id': call_id
    }
    
    # Notify ALL other staff that this call request has been claimed
    # This happens BEFORE checking if user is still connected
    logger.info(f"=== BROADCASTING call_request_claimed to other staff ===")
    logger.info(f"Total connected_users: {len(connected_users)}")
    notified_count = 0
    for socket_id, user in list(connected_users.items()):  # Use list() to avoid iteration issues
        user_type = user.get('user_type', 'unknown')
        user_name_log = user.get('name', 'Unknown')
        logger.info(f"Checking user: {user_name_log}, type: {user_type}, socket: {socket_id}, is_self: {socket_id == sid}")
        
        # Check if this is a staff member (not the one who accepted)
        if user_type in ['counsellor', 'peer', 'peer_supporter', 'staff', 'supervisor', 'admin'] and socket_id != sid:
            logger.info(f">>> SENDING call_request_claimed to {user_name_log} ({user_type}) at socket {socket_id}")
            await sio.emit('call_request_claimed', {
                'request_id': request_id,
                'claimed_by': staff_id,
                'claimed_by_name': staff_name,
                'call_id': call_id
            }, to=socket_id)
            notified_count += 1
        elif socket_id == sid:
            logger.info(f"Skipping self: {user_name_log}")
        else:
            logger.info(f"Skipping non-staff user: {user_name_log} (type: {user_type})")
    
    logger.info(f"Notified {notified_count} other staff that request {request_id} was claimed by {staff_name}")
    
    # NOW find the user's socket
    user_socket_id = None
    for socket_id, user in connected_users.items():
        if user['user_id'] == requester_user_id:
            user_socket_id = socket_id
            break
    
    if not user_socket_id:
        logger.warning(f"User {requester_user_id} not found in connected users - they may have disconnected")
        await sio.emit('call_request_error', {
            'request_id': request_id,
            'error': 'User is no longer connected. They may have closed the app.'
        }, to=sid)
        return
    
    # Add call to active_calls so webrtc_offer can find it
    active_calls[call_id] = {
        'caller_sid': sid,  # Staff is the caller
        'caller_id': staff_id,
        'caller_name': staff_name,
        'callee_sids': {user_socket_id},
        'callee_id': requester_user_id,
        'callee_name': connected_users.get(user_socket_id, {}).get('name', 'Veteran'),
        'call_type': 'safeguarding_call',
        'status': 'connecting',
        'started_at': datetime.utcnow().isoformat()
    }
    logger.info(f"Added call {call_id} to active_calls for safeguarding flow")
    
    # Notify the user that their call was accepted - staff will call them
    await sio.emit('call_request_accepted', {
        'request_id': request_id,
        'call_id': call_id,
        'staff_id': staff_id,
        'staff_name': staff_name,
        'staff_type': staff_type,
        'message': f'{staff_name} is calling you now...'
    }, to=user_socket_id)
    
    # Tell staff to initiate the WebRTC call
    await sio.emit('initiate_call_to_user', {
        'request_id': request_id,
        'call_id': call_id,
        'user_id': requester_user_id,
        'user_socket_id': user_socket_id,
        'user_name': connected_users.get(user_socket_id, {}).get('name', 'Veteran')
    }, to=sid)
    
    logger.info(f"Call request accepted. Call ID: {call_id}, Staff calling user {requester_user_id}")


@sio.event
async def accept_chat_request(sid, data):
    """
    Staff accepts a chat request
    Data: {request_id, user_id (of the requester)}
    """
    request_id = data.get('request_id')
    requester_user_id = data.get('user_id')
    
    logger.info("=== ACCEPT CHAT REQUEST ===")
    logger.info(f"accept_chat_request: request_id={request_id}, requester_user_id={requester_user_id}")
    
    # Check if this request has already been claimed
    if request_id in claimed_chat_requests:
        logger.warning(f"accept_chat_request: Request {request_id} already claimed")
        await sio.emit('chat_request_already_claimed', {
            'request_id': request_id,
            'message': 'This chat has already been taken by another staff member'
        }, to=sid)
        return
    
    # Mark as claimed immediately to prevent race conditions
    claimed_chat_requests.add(request_id)
    
    logger.info(f"accept_chat_request: user_to_sockets keys: {list(user_to_sockets.keys())}")
    
    staff_info = connected_users.get(sid, {})
    
    if staff_info.get('user_type') not in ['counsellor', 'peer']:
        logger.warning(f"accept_chat_request: Staff type not valid: {staff_info.get('user_type')}")
        claimed_chat_requests.discard(request_id)  # Release the claim
        return
    
    # Find the requester's sockets (they may have multiple connections)
    requester_sids = user_to_sockets.get(requester_user_id, set())
    
    logger.info(f"accept_chat_request: Found requester_sids={requester_sids}")
    
    if not requester_sids:
        logger.warning(f"accept_chat_request: User {requester_user_id} not found in user_to_sockets")
        claimed_chat_requests.discard(request_id)  # Release the claim
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
    
    # === CRITICAL: Join both parties to the Socket.IO room ===
    await sio.enter_room(sid, room_id)  # Staff joins room
    
    # Join ALL of the requester's sockets to the room (so all their devices get messages)
    for rs in requester_sids:
        await sio.enter_room(rs, room_id)
    
    # Track room participants (all user sockets are joined to the room)
    active_chat_rooms[room_id] = {
        'participants': [staff_info.get('user_id'), requester_user_id],
        'created_at': datetime.utcnow().isoformat(),
        'staff_sid': sid,
        'user_sids': list(requester_sids)  # Store all user's sockets
    }
    
    logger.info(f"Both parties joined Socket.IO room {room_id} ({len(requester_sids)} user devices)")
    logger.info(f"Staff {staff_info.get('name')} accepted chat request {request_id}, room: {room_id}")
    
    # Notify the requester on ALL their devices
    for rs in requester_sids:
        logger.info(f"accept_chat_request: Emitting human_chat_accepted to requester socket {rs}")
        await sio.emit('human_chat_accepted', {
            'request_id': request_id,
            'room_id': room_id,
            'staff_id': staff_info.get('user_id'),
            'staff_name': staff_info.get('name'),
            'staff_type': staff_info.get('user_type')
        }, to=rs)
    
    # Confirm to staff
    logger.info(f"accept_chat_request: Emitting chat_request_confirmed to staff {sid}")
    await sio.emit('chat_request_confirmed', {
        'request_id': request_id,
        'room_id': room_id,
        'user_id': requester_user_id
    }, to=sid)
    
    # Notify ALL other staff that this chat has been claimed
    for staff_sid, staff_data in connected_users.items():
        if staff_sid != sid and staff_data.get('user_type') in ['counsellor', 'peer']:
            await sio.emit('chat_request_claimed', {
                'request_id': request_id,
                'claimed_by': staff_info.get('name'),
                'claimed_by_id': staff_info.get('user_id')
            }, to=staff_sid)
    
    logger.info(f"accept_chat_request: Notified other staff that request {request_id} was claimed by {staff_info.get('name')}")
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
