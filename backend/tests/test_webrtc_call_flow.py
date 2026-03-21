"""
WebRTC Call Flow Tests
======================
Tests for the two critical WebRTC call flow issues:
1. When one staff member accepts a call, the alert should disappear for all other staff
2. When a staff member hangs up, the call should end on the client's mobile app as well

These tests verify the Socket.IO event handlers are correctly wired up.
"""

import pytest
pytest_plugins = ('pytest_asyncio',)
import os
import sys
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

# Add backend to path
sys.path.insert(0, '/app/backend')

# Import the webrtc_signaling module
import webrtc_signaling as ws


class TestWebRTCEndCallHandler:
    """Tests for the webrtc_end_call socket event handler"""
    
    def setup_method(self):
        """Reset state before each test"""
        ws.connected_users.clear()
        ws.active_calls.clear()
        ws.user_to_sockets.clear()
    
    @pytest.mark.asyncio
    async def test_webrtc_end_call_handler_exists(self):
        """Verify webrtc_end_call handler is registered"""
        # Check that the handler function exists
        assert hasattr(ws, 'webrtc_end_call'), "webrtc_end_call handler should exist"
        
        # Check it's an async function
        import inspect
        assert inspect.iscoroutinefunction(ws.webrtc_end_call), "webrtc_end_call should be async"
        print("PASS: webrtc_end_call handler exists and is async")
    
    @pytest.mark.asyncio
    async def test_webrtc_end_call_emits_call_ended_to_other_party(self):
        """When staff ends call, call_ended should be emitted to the user (callee)"""
        # Setup: Create a mock call scenario
        staff_sid = "staff_socket_123"
        user_sid = "user_socket_456"
        call_id = "call_test_001"
        
        # Register connected users
        ws.connected_users[staff_sid] = {
            'user_id': 'staff_001',
            'user_type': 'counsellor',
            'name': 'Test Staff',
            'status': 'in_call'
        }
        ws.connected_users[user_sid] = {
            'user_id': 'user_001',
            'user_type': 'user',
            'name': 'Test User',
            'status': 'in_call'
        }
        
        # Create active call
        ws.active_calls[call_id] = {
            'caller_sid': staff_sid,
            'caller_id': 'staff_001',
            'callee_sids': {user_sid},
            'callee_id': 'user_001',
            'answered_by_sid': user_sid,
            'status': 'connected'
        }
        
        # Mock the sio.emit function
        with patch.object(ws.sio, 'emit', new_callable=AsyncMock) as mock_emit:
            # Staff ends the call
            await ws.webrtc_end_call(staff_sid, {'call_id': call_id})
            
            # Verify call_ended was emitted to the user
            call_ended_calls = [call for call in mock_emit.call_args_list 
                               if call[0][0] == 'call_ended']
            
            assert len(call_ended_calls) >= 1, "call_ended should be emitted"
            
            # Check it was sent to the user (callee)
            emitted_to = call_ended_calls[0][1].get('to')
            assert emitted_to == user_sid, f"call_ended should be sent to user socket, got {emitted_to}"
            
            # Check the payload
            payload = call_ended_calls[0][0][1]
            assert payload['call_id'] == call_id
            assert payload['reason'] == 'ended_by_peer'
            
            print("PASS: webrtc_end_call emits call_ended to the other party (user)")
    
    @pytest.mark.asyncio
    async def test_webrtc_end_call_removes_from_active_calls(self):
        """When call ends, it should be removed from active_calls"""
        staff_sid = "staff_socket_123"
        user_sid = "user_socket_456"
        call_id = "call_test_002"
        
        ws.connected_users[staff_sid] = {'user_id': 'staff_001', 'user_type': 'counsellor', 'status': 'in_call'}
        ws.connected_users[user_sid] = {'user_id': 'user_001', 'user_type': 'user', 'status': 'in_call'}
        
        ws.active_calls[call_id] = {
            'caller_sid': staff_sid,
            'callee_sids': {user_sid},
            'answered_by_sid': user_sid,
            'status': 'connected'
        }
        
        with patch.object(ws.sio, 'emit', new_callable=AsyncMock):
            await ws.webrtc_end_call(staff_sid, {'call_id': call_id})
            
            assert call_id not in ws.active_calls, "Call should be removed from active_calls"
            print("PASS: webrtc_end_call removes call from active_calls")
    
    @pytest.mark.asyncio
    async def test_webrtc_end_call_resets_statuses(self):
        """When call ends, both parties' statuses should be reset to available"""
        staff_sid = "staff_socket_123"
        user_sid = "user_socket_456"
        call_id = "call_test_003"
        
        ws.connected_users[staff_sid] = {'user_id': 'staff_001', 'user_type': 'counsellor', 'status': 'in_call'}
        ws.connected_users[user_sid] = {'user_id': 'user_001', 'user_type': 'user', 'status': 'in_call'}
        
        ws.active_calls[call_id] = {
            'caller_sid': staff_sid,
            'callee_sids': {user_sid},
            'answered_by_sid': user_sid,
            'status': 'connected'
        }
        
        with patch.object(ws.sio, 'emit', new_callable=AsyncMock):
            await ws.webrtc_end_call(staff_sid, {'call_id': call_id})
            
            assert ws.connected_users[staff_sid]['status'] == 'available', "Staff status should be available"
            assert ws.connected_users[user_sid]['status'] == 'available', "User status should be available"
            print("PASS: webrtc_end_call resets both parties' statuses to available")


class TestCallRequestClaimedBroadcast:
    """Tests for call_request_claimed broadcast when staff accepts a call request"""
    
    def setup_method(self):
        """Reset state before each test"""
        ws.connected_users.clear()
        ws.active_calls.clear()
        ws.user_to_sockets.clear()
    
    @pytest.mark.asyncio
    async def test_accept_call_request_broadcasts_claimed_to_other_staff(self):
        """When one staff accepts a call request, all other staff should receive call_request_claimed"""
        # Setup: Multiple staff members and one user
        staff1_sid = "staff1_socket"
        staff2_sid = "staff2_socket"
        staff3_sid = "staff3_socket"
        user_sid = "user_socket"
        
        # Register staff members
        ws.connected_users[staff1_sid] = {
            'user_id': 'staff_001',
            'user_type': 'counsellor',
            'name': 'Staff One',
            'status': 'available'
        }
        ws.connected_users[staff2_sid] = {
            'user_id': 'staff_002',
            'user_type': 'peer',
            'name': 'Staff Two',
            'status': 'available'
        }
        ws.connected_users[staff3_sid] = {
            'user_id': 'staff_003',
            'user_type': 'supervisor',
            'name': 'Staff Three',
            'status': 'available'
        }
        ws.connected_users[user_sid] = {
            'user_id': 'user_001',
            'user_type': 'user',
            'name': 'Test User',
            'status': 'available'
        }
        
        # Setup user_to_sockets mapping
        ws.user_to_sockets['user_001'] = {user_sid}
        
        request_id = "callreq_test_001"
        
        with patch.object(ws.sio, 'emit', new_callable=AsyncMock):
            # Staff 1 accepts the call request
            await ws.accept_call_request(staff1_sid, {
                'request_id': request_id,
                'user_id': 'user_001',
                'staff_id': 'staff_001',
                'staff_name': 'Staff One',
                'staff_type': 'counsellor'
            })
            
            # Collect all call_request_claimed emissions
            claimed_calls = [call for call in ws.sio.emit.call_args_list 
                           if call[0][0] == 'call_request_claimed']
            
            # Should have been sent to staff2 and staff3 (not staff1 who accepted)
            assert len(claimed_calls) >= 2, f"call_request_claimed should be sent to other staff, got {len(claimed_calls)}"
            
            # Verify the recipients
            recipients = [call[1].get('to') for call in claimed_calls]
            assert staff2_sid in recipients, "Staff 2 should receive call_request_claimed"
            assert staff3_sid in recipients, "Staff 3 should receive call_request_claimed"
            assert staff1_sid not in recipients, "Staff 1 (who accepted) should NOT receive call_request_claimed"
            
            # Verify payload
            payload = claimed_calls[0][0][1]
            assert payload['request_id'] == request_id
            assert payload['claimed_by'] == 'staff_001'
            assert payload['claimed_by_name'] == 'Staff One'
            assert 'call_id' in payload
            
            print("PASS: accept_call_request broadcasts call_request_claimed to all other staff")
    
    @pytest.mark.asyncio
    async def test_accept_call_request_notifies_user(self):
        """When staff accepts call request, user should receive call_request_accepted"""
        staff_sid = "staff_socket"
        user_sid = "user_socket"
        
        ws.connected_users[staff_sid] = {
            'user_id': 'staff_001',
            'user_type': 'counsellor',
            'name': 'Staff One',
            'status': 'available'
        }
        ws.connected_users[user_sid] = {
            'user_id': 'user_001',
            'user_type': 'user',
            'name': 'Test User',
            'status': 'available'
        }
        ws.user_to_sockets['user_001'] = {user_sid}
        
        request_id = "callreq_test_002"
        
        with patch.object(ws.sio, 'emit', new_callable=AsyncMock):
            await ws.accept_call_request(staff_sid, {
                'request_id': request_id,
                'user_id': 'user_001',
                'staff_id': 'staff_001',
                'staff_name': 'Staff One',
                'staff_type': 'counsellor'
            })
            
            # Find call_request_accepted emission
            accepted_calls = [call for call in ws.sio.emit.call_args_list 
                            if call[0][0] == 'call_request_accepted']
            
            assert len(accepted_calls) >= 1, "call_request_accepted should be emitted to user"
            
            # Verify it was sent to the user
            emitted_to = accepted_calls[0][1].get('to')
            assert emitted_to == user_sid, f"call_request_accepted should be sent to user, got {emitted_to}"
            
            print("PASS: accept_call_request sends call_request_accepted to user")


class TestPortalCallRequestClaimedHandler:
    """Tests to verify the portal has the call_request_claimed handler"""
    
    def test_portal_has_call_request_claimed_handler(self):
        """Verify useWebRTCPhone.tsx has call_request_claimed socket listener"""
        with open('/app/portal/src/hooks/useWebRTCPhone.tsx', 'r') as f:
            content = f.read()
        
        # Check for the call_request_claimed handler
        assert "socket.on('call_request_claimed'" in content, \
            "Portal should have call_request_claimed socket listener"
        
        # Check it stops the ringtone
        assert "stopRingtone()" in content, \
            "Handler should stop the ringtone"
        
        # Check it clears the pending request state
        assert "hasIncomingCallRequest: false" in content, \
            "Handler should clear hasIncomingCallRequest"
        
        print("PASS: Portal has call_request_claimed handler that dismisses the alert")
    
    def test_portal_handler_checks_request_id(self):
        """Verify the handler only dismisses if request_id matches"""
        with open('/app/portal/src/hooks/useWebRTCPhone.tsx', 'r') as f:
            content = f.read()
        
        # Check that it compares request_id before dismissing
        assert "prev.pendingRequest?.request_id === data.request_id" in content, \
            "Handler should check request_id matches before dismissing"
        
        print("PASS: Portal handler checks request_id before dismissing")


class TestMobileAppCallEndedHandler:
    """Tests to verify the mobile app has the call_ended handler"""
    
    def test_mobile_app_has_call_ended_handler(self):
        """Verify SafeguardingCallModal.tsx has call_ended socket listener"""
        with open('/app/frontend/src/components/SafeguardingCallModal.tsx', 'r') as f:
            content = f.read()
        
        # Check for the call_ended handler
        assert "socket.on('call_ended'" in content, \
            "Mobile app should have call_ended socket listener"
        
        # Check it calls cleanup
        assert "cleanup()" in content, \
            "Handler should call cleanup function"
        
        # Check it closes the modal
        assert "onClose()" in content, \
            "Handler should close the modal"
        
        print("PASS: Mobile app has call_ended handler that triggers cleanup and closes modal")
    
    def test_mobile_app_cleanup_function_exists(self):
        """Verify the cleanup function properly cleans up WebRTC resources"""
        with open('/app/frontend/src/components/SafeguardingCallModal.tsx', 'r') as f:
            content = f.read()
        
        # Check cleanup function exists and does proper cleanup
        assert "function cleanup()" in content, \
            "cleanup function should exist"
        
        # Check it stops local stream tracks
        assert "localStreamRef.current.getTracks().forEach(track => track.stop())" in content, \
            "cleanup should stop local stream tracks"
        
        # Check it closes peer connection
        assert "pcRef.current.close()" in content, \
            "cleanup should close peer connection"
        
        # Check it disconnects socket
        assert "socketRef.current.disconnect()" in content, \
            "cleanup should disconnect socket"
        
        print("PASS: Mobile app cleanup function properly cleans up WebRTC resources")


class TestBackendEventHandlerRegistration:
    """Tests to verify socket event handlers are properly registered"""
    
    def test_webrtc_end_call_is_registered_as_event(self):
        """Verify webrtc_end_call is decorated with @sio.event"""
        import inspect
        
        # Get the source code of the module
        source = inspect.getsource(ws)
        
        # Check that webrtc_end_call is decorated with @sio.event
        # The decorator should appear right before the function definition
        assert "@sio.event\nasync def webrtc_end_call" in source, \
            "webrtc_end_call should be decorated with @sio.event"
        
        print("PASS: webrtc_end_call is registered as a socket event")
    
    def test_accept_call_request_is_registered_as_event(self):
        """Verify accept_call_request is decorated with @sio.event"""
        import inspect
        
        source = inspect.getsource(ws)
        
        assert "@sio.event\nasync def accept_call_request" in source, \
            "accept_call_request should be decorated with @sio.event"
        
        print("PASS: accept_call_request is registered as a socket event")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
