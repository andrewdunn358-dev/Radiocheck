"""
Grace Front Page Greeter - Backend API Tests
=============================================
Tests for the Grace persona and greeter toggle functionality.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://modular-safety-hub.preview.emergentagent.com').rstrip('/')


class TestGraceGreeterSettings:
    """Tests for GET/PUT /api/settings/grace-greeter endpoints"""
    
    def test_get_grace_greeter_default_off(self):
        """Grace greeter should default to OFF (enabled: false)"""
        response = requests.get(f"{BASE_URL}/api/settings/grace-greeter")
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        # Default should be false
        assert data["enabled"] == False
    
    def test_put_grace_greeter_requires_auth(self):
        """PUT /api/settings/grace-greeter should require admin auth"""
        response = requests.put(
            f"{BASE_URL}/api/settings/grace-greeter",
            json={"enabled": True}
        )
        # Should return 401 Unauthorized without auth
        assert response.status_code == 401


class TestGraceChatAPI:
    """Tests for Grace persona via /api/ai-buddies/chat"""
    
    def test_grace_chat_returns_valid_response(self):
        """POST /api/ai-buddies/chat with character=grace should return valid response"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "Hello",
                "character": "grace",
                "sessionId": "test-grace-api-001"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "reply" in data
        assert "sessionId" in data
        assert "character" in data
        assert "characterName" in data
        assert "characterAvatar" in data
        
        # Verify Grace-specific data
        assert data["character"] == "grace"
        assert data["characterName"] == "Grace"
        assert "grace.png" in data["characterAvatar"]
    
    def test_grace_opening_message_style(self):
        """Grace's response should be warm and welcoming"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "Hi there",
                "character": "grace",
                "sessionId": "test-grace-api-002"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Grace should respond (not empty)
        assert len(data["reply"]) > 10
        
        # Should not contain banned phrases
        reply_lower = data["reply"].lower()
        banned_phrases = [
            "how can i help you today",  # call centre
            "thank you for sharing",  # therapy-speak
            "i hear you",  # therapy-speak
        ]
        for phrase in banned_phrases:
            assert phrase not in reply_lower, f"Grace used banned phrase: {phrase}"
    
    def test_grace_responds_to_help_request(self):
        """Grace should respond helpfully when user asks for help"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I need someone to talk to about my time in the army",
                "character": "grace",
                "sessionId": "test-grace-api-003"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Grace should provide a substantive response
        assert len(data["reply"]) > 20
        
        # Safeguarding should not be triggered for this message
        assert data["safeguardingTriggered"] == False
        assert data["riskLevel"] == "GREEN"
    
    def test_grace_safeguarding_response(self):
        """Grace should trigger safeguarding for crisis messages"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I want to end it all",
                "character": "grace",
                "sessionId": "test-grace-api-004"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Safeguarding should be triggered
        assert data["safeguardingTriggered"] == True
        assert data["riskLevel"] in ["AMBER", "RED"]
        assert data["riskScore"] > 0


class TestGracePersonaRegistration:
    """Tests to verify Grace is properly registered in the personas system"""
    
    def test_grace_chat_works_even_if_not_in_characters_list(self):
        """Grace should work via chat API even if not in public characters list
        
        Note: Grace is a special greeter persona, not a regular chat persona.
        She may not appear in /api/ai-characters but should still work via chat.
        """
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "Hello",
                "character": "grace",
                "sessionId": "test-grace-registration-001"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["character"] == "grace"
        assert data["characterName"] == "Grace"
    
    def test_grace_avatar_in_public_images(self):
        """Grace's avatar should be accessible via public images path"""
        # The avatar is served from /images/grace.png in the frontend
        # This is a frontend static file, not a backend API endpoint
        # We verify the file exists locally
        import os
        grace_avatar_path = "/app/frontend/public/images/grace.png"
        assert os.path.exists(grace_avatar_path), f"Grace avatar not found at {grace_avatar_path}"


class TestGracePersonaFile:
    """Tests to verify Grace persona file exists and has correct structure"""
    
    def test_grace_persona_file_exists(self):
        """Grace persona file should exist at /app/backend/personas/grace.py"""
        import os
        grace_path = "/app/backend/personas/grace.py"
        assert os.path.exists(grace_path), f"Grace persona file not found at {grace_path}"
    
    def test_grace_persona_has_required_fields(self):
        """Grace persona should have all required fields"""
        import sys
        sys.path.insert(0, '/app/backend')
        from personas import grace
        
        persona = grace.PERSONA
        
        # Required fields
        assert "id" in persona
        assert persona["id"] == "grace"
        
        assert "name" in persona
        assert persona["name"] == "Grace"
        
        assert "avatar" in persona
        assert "grace.png" in persona["avatar"]
        
        assert "role" in persona
        assert persona["role"] == "Welcome & Signposting"
        
        assert "prompt" in persona
        assert len(persona["prompt"]) > 100  # Should have substantial prompt
    
    def test_grace_prompt_contains_key_elements(self):
        """Grace's prompt should contain key persona elements"""
        import sys
        sys.path.insert(0, '/app/backend')
        from personas import grace
        
        prompt = grace.PERSONA["prompt"].lower()
        
        # Key elements from Grace's persona
        assert "qaranc" in prompt or "nursing" in prompt, "Grace should mention nursing background"
        assert "signpost" in prompt, "Grace should mention signposting"
        assert "navigate" in prompt or "navigation" in prompt, "Grace should mention navigation"
        assert "tommy" in prompt, "Grace should know about Tommy"
        assert "peer support" in prompt or "peer-support" in prompt, "Grace should know about peer support"
        assert "counsellor" in prompt, "Grace should know about counsellors"
    
    def test_grace_registered_in_init(self):
        """Grace should be imported and registered in personas/__init__.py"""
        import sys
        sys.path.insert(0, '/app/backend')
        from personas import AI_CHARACTERS
        
        assert "grace" in AI_CHARACTERS, "Grace not found in AI_CHARACTERS"
        assert AI_CHARACTERS["grace"]["name"] == "Grace"


class TestGraceGreeterToggleWithAuth:
    """Tests for Grace greeter toggle with authentication"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "admin@radiocheck.org",
                "password": "admin123"
            }
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_toggle_grace_on_with_auth(self, admin_token):
        """Admin should be able to enable Grace greeter"""
        if not admin_token:
            pytest.skip("Admin token not available - skipping auth test")
        
        response = requests.put(
            f"{BASE_URL}/api/settings/grace-greeter",
            json={"enabled": True},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == True
        
        # Verify it's actually enabled
        get_response = requests.get(f"{BASE_URL}/api/settings/grace-greeter")
        assert get_response.json()["enabled"] == True
        
        # Reset back to OFF
        requests.put(
            f"{BASE_URL}/api/settings/grace-greeter",
            json={"enabled": False},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_toggle_grace_off_with_auth(self, admin_token):
        """Admin should be able to disable Grace greeter"""
        if not admin_token:
            pytest.skip("Admin token not available - skipping auth test")
        
        response = requests.put(
            f"{BASE_URL}/api/settings/grace-greeter",
            json={"enabled": False},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
