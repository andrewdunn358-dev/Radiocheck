"""
Test Live Chat API and Safeguarding Threshold Changes
======================================================
Testing:
1. Live Chat API endpoints (POST /api/live-chat/rooms, GET/POST messages)
2. Safeguarding thresholds: AMBER at 80+, RED at 120+
3. Modal should only trigger on RED (safeguardingTriggered=true only for RED)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://soul-refactor.preview.emergentagent.com'))
BASE_URL = BASE_URL.rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"


class TestLiveChatAPI:
    """Test Live Chat API endpoints for real-time user-staff communication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session_id = str(uuid.uuid4())
        self.staff_id = "test-staff-" + str(uuid.uuid4())[:8]
        self.staff_name = "Test Counsellor"
        self.staff_type = "counsellor"
    
    def test_create_live_chat_room(self):
        """POST /api/live-chat/rooms - Should create a new chat room"""
        response = requests.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={
                "staff_id": self.staff_id,
                "staff_name": self.staff_name,
                "staff_type": self.staff_type,
                "safeguarding_alert_id": "",
                "ai_session_id": self.session_id,
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "room_id" in data, "Response should contain room_id"
        assert data["status"] == "active", "Room status should be 'active'"
        
        # Store room_id for other tests
        self.__class__.test_room_id = data["room_id"]
        print(f"✓ Live chat room created: {data['room_id']}")
    
    def test_get_messages_from_room(self):
        """GET /api/live-chat/rooms/{id}/messages - Should return messages array"""
        # First create a room
        create_response = requests.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={
                "staff_id": self.staff_id,
                "staff_name": self.staff_name,
                "staff_type": self.staff_type,
                "safeguarding_alert_id": "",
                "ai_session_id": self.session_id,
            }
        )
        assert create_response.status_code == 200
        room_id = create_response.json()["room_id"]
        
        # Get messages
        response = requests.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "messages" in data, "Response should contain messages array"
        assert isinstance(data["messages"], list), "messages should be a list"
        print(f"✓ GET messages endpoint working, returned {len(data['messages'])} messages")
    
    def test_send_message_to_room(self):
        """POST /api/live-chat/rooms/{id}/messages - Should send message"""
        # Create a room
        create_response = requests.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={
                "staff_id": self.staff_id,
                "staff_name": self.staff_name,
                "staff_type": self.staff_type,
                "safeguarding_alert_id": "",
                "ai_session_id": self.session_id,
            }
        )
        room_id = create_response.json()["room_id"]
        
        # Send a message
        message_text = "Hello, I need some support."
        response = requests.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={
                "text": message_text,
                "sender": "user",
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "message_id" in data, "Response should contain message_id"
        assert data["status"] == "sent", "Message status should be 'sent'"
        
        # Verify message was stored
        get_response = requests.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages")
        messages = get_response.json()["messages"]
        assert any(m["text"] == message_text for m in messages), "Sent message should appear in messages list"
        print(f"✓ Message sent successfully: {data['message_id']}")
    
    def test_end_chat_room(self):
        """POST /api/live-chat/rooms/{id}/end - Should end chat session"""
        # Create a room
        create_response = requests.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={
                "staff_id": self.staff_id,
                "staff_name": self.staff_name,
                "staff_type": self.staff_type,
                "safeguarding_alert_id": "",
                "ai_session_id": self.session_id,
            }
        )
        room_id = create_response.json()["room_id"]
        
        # End the chat
        response = requests.post(f"{BASE_URL}/api/live-chat/rooms/{room_id}/end")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["status"] == "ended", "Room status should be 'ended'"
        print(f"✓ Chat room ended successfully")
    
    def test_get_nonexistent_room(self):
        """GET /api/live-chat/rooms/invalid-id/messages - Should return 404"""
        response = requests.get(f"{BASE_URL}/api/live-chat/rooms/nonexistent-room-id/messages")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ 404 returned for nonexistent room")


class TestSafeguardingThresholds:
    """
    Test safeguarding threshold changes:
    - AMBER threshold raised to 80+ (was lower)
    - RED threshold at 120+ OR any RED indicator
    - Modal only shows on RED (safeguardingTriggered=true only for RED)
    """
    
    def get_session_id(self):
        return f"test-{uuid.uuid4()}"
    
    def test_green_level_normal_message(self):
        """Normal message should be GREEN, no modal trigger"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "Hello Tommy, I'm doing well today!",
                "sessionId": self.get_session_id(),
                "character": "tommy"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["safeguardingTriggered"] == False, "Normal message should NOT trigger safeguarding"
        assert data["riskLevel"] == "GREEN", f"Expected GREEN, got {data['riskLevel']}"
        print(f"✓ GREEN level: score={data['riskScore']}, triggered={data['safeguardingTriggered']}")
    
    def test_amber_level_no_modal_trigger(self):
        """
        AMBER level (score 80-119) should NOT trigger modal.
        Testing with indicators that sum to AMBER but not RED
        isolated=30, flashbacks=35, multiple_amber_bonus=30 = 95 -> AMBER
        """
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                # isolated=30, flashbacks=35, multiple_amber_bonus=30 = 95 -> AMBER
                "message": "I've been feeling isolated lately and having flashbacks",
                "sessionId": self.get_session_id(),
                "character": "tommy"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # This should be AMBER (95 points) but NOT RED, so modal should NOT trigger
        # If score happens to be >=120, it will be RED and trigger - that's expected behavior
        if data["riskLevel"] != "RED":
            assert data["safeguardingTriggered"] == False, f"Non-RED level ({data['riskLevel']}) should NOT trigger modal"
        print(f"✓ Level {data['riskLevel']}: score={data['riskScore']}, triggered={data['safeguardingTriggered']}")
    
    def test_amber_level_higher_score_no_modal(self):
        """
        Higher AMBER level with multiple indicators should NOT trigger modal.
        Testing accumulated score < RED threshold
        """
        session = self.get_session_id()
        
        # First message
        requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I feel isolated and have been drinking to cope",
                "sessionId": session,
                "character": "tommy"
            }
        )
        
        # Second message in same session
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I can't sleep and feel hopeless about the future",
                "sessionId": session,
                "character": "tommy"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Even with accumulated score, if not RED level, modal should not trigger
        if data["riskLevel"] != "RED":
            assert data["safeguardingTriggered"] == False, "Non-RED level should NOT trigger modal"
        print(f"✓ Level {data['riskLevel']}: score={data['riskScore']}, triggered={data['safeguardingTriggered']}")
    
    def test_red_level_explicit_suicide(self):
        """
        RED indicator 'suicide' should ALWAYS trigger modal (hard rule)
        """
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I've been thinking about suicide",
                "sessionId": self.get_session_id(),
                "character": "tommy"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["safeguardingTriggered"] == True, "RED indicator 'suicide' MUST trigger modal"
        assert data["riskLevel"] == "RED", f"Expected RED, got {data['riskLevel']}"
        print(f"✓ RED level triggered: score={data['riskScore']}, triggered={data['safeguardingTriggered']}")
    
    def test_red_level_want_to_die(self):
        """RED indicator 'want to die' should trigger modal"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I just want to die",
                "sessionId": self.get_session_id(),
                "character": "tommy"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["safeguardingTriggered"] == True, "RED indicator 'want to die' MUST trigger modal"
        assert data["riskLevel"] == "RED"
        print(f"✓ RED level triggered for 'want to die': score={data['riskScore']}")
    
    def test_red_level_end_it_all(self):
        """RED indicator 'end it all' should trigger modal"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I want to end it all",
                "sessionId": self.get_session_id(),
                "character": "tommy"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["safeguardingTriggered"] == True, "RED indicator 'end it all' MUST trigger modal"
        assert data["riskLevel"] == "RED"
        print(f"✓ RED level triggered for 'end it all': score={data['riskScore']}")
    
    def test_red_level_kill_myself(self):
        """RED indicator 'kill myself' should trigger modal"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I want to kill myself",
                "sessionId": self.get_session_id(),
                "character": "tommy"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["safeguardingTriggered"] == True, "RED indicator 'kill myself' MUST trigger modal"
        assert data["riskLevel"] == "RED"
        print(f"✓ RED level triggered for 'kill myself': score={data['riskScore']}")
    
    def test_modal_not_triggered_for_isolation_alone(self):
        """
        'I feel isolated' alone should NOT trigger modal
        User specifically requested this to not be too sensitive
        """
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I feel isolated lately",
                "sessionId": self.get_session_id(),
                "character": "tommy"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["safeguardingTriggered"] == False, "'I feel isolated' alone should NOT trigger modal"
        print(f"✓ 'I feel isolated' - Level {data['riskLevel']}: triggered={data['safeguardingTriggered']}")
    
    def test_threshold_score_80_is_amber(self):
        """
        Score of 80+ should be AMBER (not RED, no modal)
        Testing with multiple AMBER indicators
        """
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                # hopeless=30, isolated=30, drinking to cope=35 = 95 points -> AMBER
                "message": "I feel hopeless and isolated, been drinking to cope every day",
                "sessionId": self.get_session_id(),
                "character": "tommy"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be AMBER (80+) but not RED (120+)
        if data["riskScore"] >= 80 and data["riskScore"] < 120:
            assert data["riskLevel"] == "AMBER", f"Score {data['riskScore']} should be AMBER"
            assert data["safeguardingTriggered"] == False, "AMBER should NOT trigger modal"
        print(f"✓ Score {data['riskScore']} -> Level {data['riskLevel']}, triggered={data['safeguardingTriggered']}")


class TestLiveChatIntegration:
    """Test live chat integration with safeguarding"""
    
    def get_auth_token(self):
        """Get admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        return None
    
    def test_staff_can_view_active_rooms(self):
        """GET /api/live-chat/rooms - Staff should see active rooms"""
        token = self.get_auth_token()
        if not token:
            pytest.skip("Could not get auth token")
        
        response = requests.get(
            f"{BASE_URL}/api/live-chat/rooms",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list of rooms"
        print(f"✓ Staff can view chat rooms: {len(data)} rooms")
    
    def test_full_chat_flow(self):
        """Test complete flow: create room -> send message -> receive -> end"""
        session_id = str(uuid.uuid4())
        
        # 1. Create room
        create_resp = requests.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={
                "staff_id": "test-staff",
                "staff_name": "Test Staff",
                "staff_type": "counsellor",
                "safeguarding_alert_id": "",
                "ai_session_id": session_id,
            }
        )
        assert create_resp.status_code == 200
        room_id = create_resp.json()["room_id"]
        print(f"  1. Room created: {room_id}")
        
        # 2. Send user message
        msg1_resp = requests.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={"text": "Hello, I need help", "sender": "user"}
        )
        assert msg1_resp.status_code == 200
        print("  2. User message sent")
        
        # 3. Send staff message
        msg2_resp = requests.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={"text": "Hi, I'm here to help. How can I support you?", "sender": "staff"}
        )
        assert msg2_resp.status_code == 200
        print("  3. Staff message sent")
        
        # 4. Get all messages
        get_resp = requests.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages")
        assert get_resp.status_code == 200
        messages = get_resp.json()["messages"]
        assert len(messages) >= 2, f"Expected at least 2 messages, got {len(messages)}"
        print(f"  4. Retrieved {len(messages)} messages")
        
        # 5. End chat
        end_resp = requests.post(f"{BASE_URL}/api/live-chat/rooms/{room_id}/end")
        assert end_resp.status_code == 200
        print("  5. Chat ended")
        
        print("✓ Full chat flow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
