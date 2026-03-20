"""
Test Suite: Safeguarding Phase 2 - Session ID Linking
=====================================================
Tests for the Phase 2 safeguarding flow which links incoming chat requests 
from users in crisis to their existing safeguarding alerts on the staff portal.

Features tested:
1. Staff portal login with credentials
2. Safeguarding alerts API returns session_id
3. Staff portal app.js has data-session-id attribute in renderSafeguardingAlerts
4. Backend webrtc_signaling includes session_id in incoming_chat_request events
5. Frontend chat screens pass sessionId when navigating to live-chat
"""

import pytest
import requests
import os
import re

# Get BASE_URL from environment or use preview URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://production-stabilize-6.preview.emergentagent.com').rstrip('/')


class TestStaffAuthentication:
    """Test staff portal login functionality"""
    
    def test_staff_login_sharon(self):
        """Test that sharon@radiocheck.me can log in"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sharon@radiocheck.me",
            "password": "ChangeThisPassword123!"
        })
        
        # Should return 200 with token
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == "sharon@radiocheck.me"
        assert data["user"]["role"] in ["counsellor", "admin", "peer"]
        
    def test_admin_login(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@veteran.dbty.co.uk",
            "password": "ChangeThisPassword123!"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"


class TestSafeguardingAlertsAPI:
    """Test safeguarding alerts API returns proper data structure"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for staff"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sharon@radiocheck.me",
            "password": "ChangeThisPassword123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
        
    def test_safeguarding_alerts_have_session_id(self, auth_token):
        """Test that safeguarding alerts API returns session_id field"""
        response = requests.get(
            f"{BASE_URL}/api/safeguarding-alerts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        alerts = response.json()
        
        # Check that at least one alert exists with session_id
        if len(alerts) > 0:
            alert = alerts[0]
            assert "session_id" in alert, f"Missing session_id in alert: {alert.keys()}"
            assert "id" in alert, "Missing id in alert"
            assert "status" in alert, "Missing status in alert"
            # session_id should be a non-empty string
            if alert["session_id"]:
                assert isinstance(alert["session_id"], str), "session_id should be a string"
        else:
            # Create a test alert to verify the structure
            pytest.skip("No alerts to verify - skipping session_id structure test")
            
    def test_safeguarding_alerts_structure(self, auth_token):
        """Test that safeguarding alerts have expected fields"""
        response = requests.get(
            f"{BASE_URL}/api/safeguarding-alerts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        alerts = response.json()
        
        if len(alerts) > 0:
            alert = alerts[0]
            required_fields = [
                "id", "session_id", "character", "triggering_message",
                "risk_level", "status", "created_at"
            ]
            for field in required_fields:
                assert field in alert, f"Missing required field: {field}"


class TestStaffPortalCodeImplementation:
    """Test staff portal app.js code implementation (code review)"""
    
    def test_data_session_id_attribute_in_app_js(self):
        """Verify data-session-id attribute is added to safeguarding alert cards"""
        with open('/app/staff-portal/app.js', 'r') as f:
            content = f.read()
        
        # Check for data-session-id attribute in renderSafeguardingAlerts
        assert 'data-session-id' in content, "data-session-id attribute not found in app.js"
        
        # Verify the attribute is set from alert.session_id
        assert 'alert.session_id' in content, "alert.session_id reference not found"
        
        # Check that the card element includes data-session-id
        pattern = r'data-session-id=.*alert\.session_id'
        assert re.search(pattern, content, re.IGNORECASE), \
            "data-session-id not properly set from alert.session_id"
            
    def test_accept_pending_chat_from_alert_function(self):
        """Verify acceptPendingChatFromAlert function exists"""
        with open('/app/staff-portal/app.js', 'r') as f:
            content = f.read()
        
        assert 'acceptPendingChatFromAlert' in content, \
            "acceptPendingChatFromAlert function not found"
        
        # Check the function is callable from the UI
        assert 'onclick="acceptPendingChatFromAlert' in content, \
            "acceptPendingChatFromAlert not wired to onclick handler"
            
    def test_setup_live_chat_request_listeners(self):
        """Verify setupLiveChatRequestListeners handles session_id"""
        with open('/app/staff-portal/app.js', 'r') as f:
            content = f.read()
        
        assert 'setupLiveChatRequestListeners' in content, \
            "setupLiveChatRequestListeners function not found"
        
        # Check for incoming_chat_request listener
        assert "incoming_chat_request" in content, \
            "incoming_chat_request event listener not found"
            
        # Check for session_id handling in the listener
        assert "session_id" in content, \
            "session_id not handled in event listeners"


class TestBackendWebRTCSignaling:
    """Test backend webrtc_signaling.py implementation"""
    
    def test_request_human_chat_includes_session_id(self):
        """Verify request_human_chat handler passes session_id"""
        with open('/app/backend/webrtc_signaling.py', 'r') as f:
            content = f.read()
        
        # Check for session_id in the request_human_chat handler
        assert 'request_human_chat' in content, \
            "request_human_chat handler not found"
        
        # Check session_id is extracted from data
        assert "session_id = data.get" in content, \
            "session_id not extracted from data in request_human_chat"
            
        # Check session_id is included in incoming_chat_request event
        assert "'session_id': session_id" in content, \
            "session_id not included in incoming_chat_request emit"
            
    def test_incoming_chat_request_event_structure(self):
        """Verify incoming_chat_request event includes all required fields"""
        with open('/app/backend/webrtc_signaling.py', 'r') as f:
            content = f.read()
        
        # Check for the emit statement with session_id
        assert "emit('incoming_chat_request'" in content, \
            "incoming_chat_request emit not found"
        
        # Required fields in the event
        required_fields = ['request_id', 'user_id', 'user_name', 'session_id']
        for field in required_fields:
            assert f"'{field}'" in content, \
                f"Missing {field} in incoming_chat_request event"


class TestFrontendChatScreens:
    """Test frontend chat screens pass sessionId properly"""
    
    def test_character_chat_passes_session_id(self):
        """Verify /app/frontend/app/chat/[characterId].tsx passes sessionId"""
        with open('/app/frontend/app/chat/[characterId].tsx', 'r') as f:
            content = f.read()
        
        # Check sessionId state is created
        assert 'sessionId' in content, "sessionId not found in chat component"
        
        # Check sessionId is passed to navigation params
        assert 'sessionId: sessionId' in content or 'sessionId,' in content, \
            "sessionId not passed in navigation params"
            
        # Check router.push includes sessionId
        assert 'params:' in content and 'sessionId' in content, \
            "sessionId not included in router.push params"
            
    def test_unified_chat_passes_session_id(self):
        """Verify /app/frontend/app/unified-chat.tsx passes sessionId"""
        with open('/app/frontend/app/unified-chat.tsx', 'r') as f:
            content = f.read()
        
        # Check sessionId state is created
        assert 'sessionId' in content, "sessionId not found in unified-chat"
        
        # Check sessionId is passed to live-chat navigation
        assert 'sessionId:' in content, "sessionId not passed to live-chat"
            
    def test_live_chat_receives_and_uses_session_id(self):
        """Verify /app/frontend/app/live-chat.tsx receives sessionId"""
        with open('/app/frontend/app/live-chat.tsx', 'r') as f:
            content = f.read()
        
        # Check sessionId is extracted from params
        assert 'sessionId' in content, "sessionId not in live-chat params"
        
        # Check session_id is used in request_human_chat emit
        assert 'session_id:' in content, "session_id not included in socket emit"
        
        # Check sessionId param handling
        assert 'params.sessionId' in content, "params.sessionId not accessed"


class TestCSSStyles:
    """Test CSS styles for user request indicator"""
    
    def test_user_request_indicator_css(self):
        """Verify .user-request-indicator CSS exists"""
        with open('/app/staff-portal/styles.css', 'r') as f:
            content = f.read()
        
        assert '.user-request-indicator' in content, \
            ".user-request-indicator CSS class not found"


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
