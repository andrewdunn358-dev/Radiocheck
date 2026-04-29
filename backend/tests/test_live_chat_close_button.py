"""
Test Live Chat APIs and Close Button functionality
Tests for the UK Veterans Support App Live Chat feature
Focus: Room creation, staff joining, messaging, and end chat (close button)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://radio-check-safety-1.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = os.environ["TEST_ADMIN_PASSWORD"]  # set via CI repo secret

@pytest.fixture(scope="session")
def auth_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestLiveChatRoomCreation:
    """Test Live Chat room creation API (POST /api/live-chat/rooms)"""
    
    def test_create_room_success(self, api_client):
        """Test creating a new live chat room - simulates user initiating chat"""
        response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={
                "staff_type": "counsellor",
                "safeguarding_alert_id": None,
                "ai_session_id": f"test-session-{uuid.uuid4()}"
            }
        )
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "room_id" in data, "Response should contain room_id"
        assert "status" in data, "Response should contain status"
        assert data["status"] == "active", f"Expected status 'active', got '{data['status']}'"
        assert isinstance(data["room_id"], str), "room_id should be a string"
        assert len(data["room_id"]) > 0, "room_id should not be empty"
        
        print(f"PASS: Created live chat room with ID: {data['room_id']}")
        return data["room_id"]
    
    def test_create_room_with_peer_type(self, api_client):
        """Test creating room requesting peer supporter"""
        response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={
                "staff_type": "peer",
                "ai_session_id": f"test-peer-session-{uuid.uuid4()}"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        print("PASS: Created live chat room for peer supporter")
    
    def test_create_room_with_any_type(self, api_client):
        """Test creating room with any staff type"""
        response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={
                "staff_type": "any"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        print("PASS: Created live chat room for any staff type")


class TestLiveChatRoomInfo:
    """Test Live Chat room info API (GET /api/live-chat/rooms/{id})"""
    
    def test_get_room_info(self, api_client):
        """Test getting room info - used for polling to see when staff joins"""
        # First create a room
        create_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={"staff_type": "counsellor"}
        )
        assert create_response.status_code == 200
        room_id = create_response.json()["room_id"]
        
        # Get room info
        response = api_client.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify room structure
        assert data["id"] == room_id
        assert data["status"] == "active"
        assert data["staff_type"] == "counsellor"
        assert data["staff_id"] is None, "Staff should not be assigned yet"
        assert data["staff_name"] is None, "Staff name should be None initially"
        
        print(f"PASS: Retrieved room info for room {room_id}")
    
    def test_get_room_not_found(self, api_client):
        """Test getting non-existent room returns 404"""
        fake_room_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/live-chat/rooms/{fake_room_id}")
        
        assert response.status_code == 404, f"Expected 404 for non-existent room, got {response.status_code}"
        print("PASS: 404 returned for non-existent room")


class TestStaffJoinChat:
    """Test Staff Join Chat API (POST /api/live-chat/rooms/{id}/join)"""
    
    def test_staff_join_chat_success(self, authenticated_client):
        """Test staff joining a chat room"""
        # Create a room first (as user - no auth needed)
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        create_response = session.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={"staff_type": "counsellor"}
        )
        assert create_response.status_code == 200
        room_id = create_response.json()["room_id"]
        
        # Staff joins the room (authenticated)
        join_response = authenticated_client.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/join",
            json={
                "staff_id": "test-staff-123",
                "staff_name": "Test Counsellor"
            }
        )
        
        assert join_response.status_code == 200
        data = join_response.json()
        assert data["status"] == "joined"
        assert data["staff_name"] == "Test Counsellor"
        
        # Verify staff is now assigned by getting room info
        room_response = session.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}")
        assert room_response.status_code == 200
        room_data = room_response.json()
        assert room_data["staff_name"] == "Test Counsellor"
        assert room_data["staff_id"] == "test-staff-123"
        
        print(f"PASS: Staff successfully joined room {room_id}")
    
    def test_staff_join_requires_auth(self, api_client):
        """Test that joining chat requires authentication"""
        # Create a room
        create_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={"staff_type": "any"}
        )
        room_id = create_response.json()["room_id"]
        
        # Try to join without auth
        join_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/join",
            json={"staff_id": "test", "staff_name": "Test"}
        )
        
        # Should fail without auth
        assert join_response.status_code in [401, 403], f"Expected 401/403, got {join_response.status_code}"
        print("PASS: Staff join correctly requires authentication")


class TestMessageSending:
    """Test Message sending API (POST /api/live-chat/rooms/{id}/messages)"""
    
    def test_send_user_message(self, api_client):
        """Test sending a message as user"""
        # Create room
        create_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={"staff_type": "counsellor"}
        )
        room_id = create_response.json()["room_id"]
        
        # Send message
        msg_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={
                "text": "Hello, I need some help",
                "sender": "user"
            }
        )
        
        assert msg_response.status_code == 200
        data = msg_response.json()
        assert "message_id" in data
        assert data["status"] == "sent"
        
        print(f"PASS: User message sent, ID: {data['message_id']}")
    
    def test_send_staff_message(self, api_client):
        """Test sending a message as staff"""
        # Create room
        create_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={"staff_type": "peer"}
        )
        room_id = create_response.json()["room_id"]
        
        # Send staff message
        msg_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={
                "text": "Hello, I'm here to help",
                "sender": "staff"
            }
        )
        
        assert msg_response.status_code == 200
        data = msg_response.json()
        assert data["status"] == "sent"
        
        print("PASS: Staff message sent successfully")


class TestMessageRetrieval:
    """Test Message retrieval API (GET /api/live-chat/rooms/{id}/messages)"""
    
    def test_get_messages_empty(self, api_client):
        """Test getting messages from new room returns empty array"""
        # Create room
        create_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={"staff_type": "any"}
        )
        room_id = create_response.json()["room_id"]
        
        # Get messages
        response = api_client.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages")
        
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)
        assert len(data["messages"]) == 0
        
        print("PASS: Empty messages array returned for new room")
    
    def test_get_messages_after_sending(self, api_client):
        """Test that sent messages appear in retrieval"""
        # Create room and send messages
        create_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={"staff_type": "counsellor"}
        )
        room_id = create_response.json()["room_id"]
        
        # Send two messages
        api_client.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={"text": "Message 1 from user", "sender": "user"}
        )
        api_client.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={"text": "Message 2 from staff", "sender": "staff"}
        )
        
        # Retrieve messages
        response = api_client.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]) == 2
        
        # Verify message content
        assert data["messages"][0]["text"] == "Message 1 from user"
        assert data["messages"][0]["sender"] == "user"
        assert data["messages"][1]["text"] == "Message 2 from staff"
        assert data["messages"][1]["sender"] == "staff"
        
        # Verify message structure
        for msg in data["messages"]:
            assert "id" in msg
            assert "text" in msg
            assert "sender" in msg
            assert "timestamp" in msg
        
        print("PASS: Messages correctly retrieved with proper structure")


class TestEndChat:
    """Test End chat API (POST /api/live-chat/rooms/{id}/end) - Close Button functionality"""
    
    def test_end_chat_success(self, api_client):
        """Test ending a chat room - this is what the Close button does"""
        # Create room
        create_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={"staff_type": "counsellor"}
        )
        room_id = create_response.json()["room_id"]
        
        # Verify room is active
        room_response = api_client.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}")
        assert room_response.json()["status"] == "active"
        
        # End the chat (Close button action)
        end_response = api_client.post(f"{BASE_URL}/api/live-chat/rooms/{room_id}/end")
        
        assert end_response.status_code == 200
        data = end_response.json()
        assert data["status"] == "ended"
        
        # Verify room is now ended
        room_response = api_client.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}")
        assert room_response.json()["status"] == "ended"
        
        print(f"PASS: Chat room {room_id} ended successfully (Close button works)")
    
    def test_end_chat_with_messages(self, api_client):
        """Test ending a chat that has messages"""
        # Create room and send messages
        create_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={"staff_type": "peer"}
        )
        room_id = create_response.json()["room_id"]
        
        # Send some messages
        api_client.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={"text": "User message", "sender": "user"}
        )
        
        # End the chat
        end_response = api_client.post(f"{BASE_URL}/api/live-chat/rooms/{room_id}/end")
        
        assert end_response.status_code == 200
        assert end_response.json()["status"] == "ended"
        
        # Messages should still be accessible after ending
        msg_response = api_client.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages")
        assert msg_response.status_code == 200
        assert len(msg_response.json()["messages"]) == 1
        
        print("PASS: Chat ended with messages preserved")
    
    def test_double_end_chat(self, api_client):
        """Test that ending an already ended chat doesn't cause errors"""
        # Create and end room
        create_response = api_client.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={"staff_type": "any"}
        )
        room_id = create_response.json()["room_id"]
        
        # End once
        api_client.post(f"{BASE_URL}/api/live-chat/rooms/{room_id}/end")
        
        # End again - should still work (idempotent)
        second_end = api_client.post(f"{BASE_URL}/api/live-chat/rooms/{room_id}/end")
        assert second_end.status_code == 200
        
        print("PASS: Double-ending chat is handled gracefully")


class TestFullChatFlow:
    """Test complete chat flow from creation to end"""
    
    def test_complete_chat_flow(self, authenticated_client):
        """Test the full user journey: create room -> staff joins -> exchange messages -> end chat"""
        
        # 1. User creates a chat room
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        create_response = session.post(
            f"{BASE_URL}/api/live-chat/rooms",
            json={
                "staff_type": "counsellor",
                "ai_session_id": f"full-flow-test-{uuid.uuid4()}"
            }
        )
        assert create_response.status_code == 200
        room_id = create_response.json()["room_id"]
        print(f"Step 1: User created chat room {room_id}")
        
        # 2. User sends initial message
        msg1_response = session.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={"text": "I need to talk to someone", "sender": "user"}
        )
        assert msg1_response.status_code == 200
        print("Step 2: User sent initial message")
        
        # 3. User polls for staff (initially empty)
        room_info = session.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}").json()
        assert room_info["staff_name"] is None
        print("Step 3: User polling - no staff yet")
        
        # 4. Staff joins the chat
        join_response = authenticated_client.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/join",
            json={"staff_id": "counsellor-001", "staff_name": "Jane Counsellor"}
        )
        assert join_response.status_code == 200
        print("Step 4: Staff joined the chat")
        
        # 5. User polls again - staff now visible
        room_info = session.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}").json()
        assert room_info["staff_name"] == "Jane Counsellor"
        print("Step 5: User sees staff has joined")
        
        # 6. Staff sends response
        msg2_response = session.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={"text": "Hello, I'm Jane. I'm here to listen.", "sender": "staff"}
        )
        assert msg2_response.status_code == 200
        print("Step 6: Staff sent response")
        
        # 7. Exchange more messages
        session.post(
            f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages",
            json={"text": "Thank you for being here", "sender": "user"}
        )
        print("Step 7: User sent another message")
        
        # 8. Verify all messages are present
        messages = session.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}/messages").json()
        assert len(messages["messages"]) == 3
        print(f"Step 8: Verified {len(messages['messages'])} messages in room")
        
        # 9. User ends the chat (Close button)
        end_response = session.post(f"{BASE_URL}/api/live-chat/rooms/{room_id}/end")
        assert end_response.status_code == 200
        assert end_response.json()["status"] == "ended"
        print("Step 9: User ended the chat (Close button worked!)")
        
        # 10. Verify room is ended
        final_room_info = session.get(f"{BASE_URL}/api/live-chat/rooms/{room_id}").json()
        assert final_room_info["status"] == "ended"
        assert "ended_at" in final_room_info
        print("Step 10: Chat room is confirmed ended")
        
        print("\n=== FULL CHAT FLOW TEST PASSED ===")
        print("Close button functionality (end chat API) is working correctly!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
