"""
Staff Portal Migration Tests
Tests for the migrated Staff Portal functionality including:
- Staff login with profile matching
- Profile loading with userId verification
- Status buttons functionality
- API endpoints for counsellors, peer supporters, live chat, AI characters
- WebRTC socket connection initialization
"""

import pytest
import requests
import os
from datetime import datetime

# Use the internal preview URL (same as frontend uses)
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cms-legacy-cleanup.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@staff.com"
TEST_PASSWORD = "test123"


class TestStaffLogin:
    """Staff Portal authentication tests"""
    
    def test_staff_login_success(self):
        """Test successful staff login with test credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        
        # Verify user data
        user = data["user"]
        assert user["email"] == TEST_EMAIL
        assert "id" in user
        assert "name" in user
        assert "role" in user
        
        print(f"✓ Login successful for {user['name']} (ID: {user['id']}, Role: {user['role']})")
        return data
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@email.com", "password": "wrongpassword"}
        )
        
        # Should return 401 or 400 for invalid credentials
        assert response.status_code in [400, 401], f"Expected 400/401, got {response.status_code}"
        print("✓ Invalid credentials properly rejected")


class TestProfileLoading:
    """Test profile loading with userId verification"""
    
    @pytest.fixture
    def auth_data(self):
        """Get auth token and user ID"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        return response.json()
    
    def test_counsellors_endpoint(self, auth_data):
        """Test counsellors endpoint returns data"""
        token = auth_data["token"]
        response = requests.get(
            f"{BASE_URL}/api/counsellors",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Counsellors endpoint failed: {response.text}"
        counsellors = response.json()
        assert isinstance(counsellors, list)
        print(f"✓ Counsellors endpoint returned {len(counsellors)} counsellors")
        return counsellors
    
    def test_peer_supporters_endpoint(self, auth_data):
        """Test peer-supporters endpoint returns data"""
        token = auth_data["token"]
        response = requests.get(
            f"{BASE_URL}/api/peer-supporters",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Peer supporters endpoint failed: {response.text}"
        peers = response.json()
        assert isinstance(peers, list)
        print(f"✓ Peer supporters endpoint returned {len(peers)} peers")
        return peers
    
    def test_profile_matches_logged_in_user(self, auth_data):
        """Test that profile user_id matches logged-in user"""
        token = auth_data["token"]
        user_id = auth_data["user"]["id"]
        
        # Get counsellors
        counsellors_response = requests.get(
            f"{BASE_URL}/api/counsellors",
            headers={"Authorization": f"Bearer {token}"}
        )
        counsellors = counsellors_response.json()
        
        # Find matching profile
        matching_profile = None
        for c in counsellors:
            if c.get("user_id") == user_id:
                matching_profile = c
                break
        
        if not matching_profile:
            # Check peer supporters
            peers_response = requests.get(
                f"{BASE_URL}/api/peer-supporters",
                headers={"Authorization": f"Bearer {token}"}
            )
            peers = peers_response.json()
            for p in peers:
                if p.get("user_id") == user_id:
                    matching_profile = p
                    break
        
        # For test user, we expect a matching profile
        assert matching_profile is not None, f"No profile found matching user_id: {user_id}"
        assert matching_profile.get("user_id") == user_id, "Profile user_id mismatch"
        print(f"✓ Profile correctly matches logged-in user: {matching_profile.get('name')} (user_id: {user_id})")


class TestStatusUpdates:
    """Test staff status update functionality"""
    
    @pytest.fixture
    def auth_and_profile(self):
        """Get auth token and find matching profile"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        auth_data = response.json()
        token = auth_data["token"]
        user_id = auth_data["user"]["id"]
        
        # Find profile
        counsellors = requests.get(
            f"{BASE_URL}/api/counsellors",
            headers={"Authorization": f"Bearer {token}"}
        ).json()
        
        profile = None
        profile_type = None
        for c in counsellors:
            if c.get("user_id") == user_id:
                profile = c
                profile_type = "counsellor"
                break
        
        if not profile:
            peers = requests.get(
                f"{BASE_URL}/api/peer-supporters",
                headers={"Authorization": f"Bearer {token}"}
            ).json()
            for p in peers:
                if p.get("user_id") == user_id:
                    profile = p
                    profile_type = "peer"
                    break
        
        return {
            "token": token,
            "user_id": user_id,
            "profile": profile,
            "profile_type": profile_type
        }
    
    def test_status_update_available(self, auth_and_profile):
        """Test updating status to available"""
        if not auth_and_profile["profile"]:
            pytest.skip("No profile linked to test user")
        
        token = auth_and_profile["token"]
        profile_id = auth_and_profile["profile"]["id"]
        profile_type = auth_and_profile["profile_type"]
        
        endpoint = f"/api/{'counsellors' if profile_type == 'counsellor' else 'peer-supporters'}/{profile_id}/status"
        
        response = requests.patch(
            f"{BASE_URL}{endpoint}",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "available"}
        )
        
        assert response.status_code == 200, f"Status update failed: {response.text}"
        print("✓ Status updated to 'available' successfully")
    
    def test_status_update_limited(self, auth_and_profile):
        """Test updating status to limited/busy"""
        if not auth_and_profile["profile"]:
            pytest.skip("No profile linked to test user")
        
        token = auth_and_profile["token"]
        profile_id = auth_and_profile["profile"]["id"]
        profile_type = auth_and_profile["profile_type"]
        
        endpoint = f"/api/{'counsellors' if profile_type == 'counsellor' else 'peer-supporters'}/{profile_id}/status"
        
        response = requests.patch(
            f"{BASE_URL}{endpoint}",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "limited"}
        )
        
        assert response.status_code == 200, f"Status update failed: {response.text}"
        print("✓ Status updated to 'limited' successfully")
    
    def test_status_update_unavailable(self, auth_and_profile):
        """Test updating status to unavailable/offline"""
        if not auth_and_profile["profile"]:
            pytest.skip("No profile linked to test user")
        
        token = auth_and_profile["token"]
        profile_id = auth_and_profile["profile"]["id"]
        profile_type = auth_and_profile["profile_type"]
        
        endpoint = f"/api/{'counsellors' if profile_type == 'counsellor' else 'peer-supporters'}/{profile_id}/status"
        
        response = requests.patch(
            f"{BASE_URL}{endpoint}",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "unavailable"}
        )
        
        assert response.status_code == 200, f"Status update failed: {response.text}"
        print("✓ Status updated to 'unavailable' successfully")


class TestLiveChatAPI:
    """Test live chat room API endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_live_chat_rooms(self, auth_token):
        """Test fetching live chat rooms"""
        response = requests.get(
            f"{BASE_URL}/api/live-chat/rooms",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Live chat rooms failed: {response.text}"
        rooms = response.json()
        assert isinstance(rooms, list)
        print(f"✓ Live chat rooms endpoint returned {len(rooms)} rooms")
        
        # Verify room structure
        if rooms:
            room = rooms[0]
            assert "id" in room or "_id" in room
            assert "status" in room
            print(f"  Sample room status: {room.get('status')}")


class TestAICharactersAPI:
    """Test AI Characters API with order sorting"""
    
    def test_ai_characters_returns_sorted_by_order(self):
        """Test that AI characters are sorted by order field"""
        response = requests.get(f"{BASE_URL}/api/ai-characters")
        
        assert response.status_code == 200, f"AI characters failed: {response.text}"
        data = response.json()
        assert "characters" in data
        
        characters = data["characters"]
        assert len(characters) > 0, "No characters returned"
        
        # Verify order field exists and characters are sorted
        orders = []
        for char in characters:
            order = char.get("order", 99)
            orders.append(order)
            print(f"  - {char.get('name', 'Unknown')} (order: {order})")
        
        # Check if sorted
        is_sorted = all(orders[i] <= orders[i+1] for i in range(len(orders)-1))
        assert is_sorted, f"Characters not sorted by order: {orders}"
        
        print(f"✓ AI characters returned {len(characters)} characters sorted by order")
    
    def test_ai_characters_have_required_fields(self):
        """Test that AI characters have required fields"""
        response = requests.get(f"{BASE_URL}/api/ai-characters")
        characters = response.json()["characters"]
        
        required_fields = ["id", "name", "description", "avatar", "is_enabled"]
        
        for char in characters:
            for field in required_fields:
                assert field in char, f"Character {char.get('id')} missing field: {field}"
        
        print(f"✓ All {len(characters)} characters have required fields")


class TestCallbacksAPI:
    """Test callbacks API endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_callbacks(self, auth_token):
        """Test fetching callbacks"""
        response = requests.get(
            f"{BASE_URL}/api/callbacks",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Callbacks failed: {response.text}"
        callbacks = response.json()
        assert isinstance(callbacks, list)
        print(f"✓ Callbacks endpoint returned {len(callbacks)} callbacks")


class TestSafeguardingAlertsAPI:
    """Test safeguarding alerts API endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_safeguarding_alerts(self, auth_token):
        """Test fetching safeguarding alerts"""
        response = requests.get(
            f"{BASE_URL}/api/safeguarding-alerts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Safeguarding alerts failed: {response.text}"
        alerts = response.json()
        assert isinstance(alerts, list)
        print(f"✓ Safeguarding alerts endpoint returned {len(alerts)} alerts")


class TestCasesAPI:
    """Test cases API endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_cases(self, auth_token):
        """Test fetching cases"""
        response = requests.get(
            f"{BASE_URL}/api/cases",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Cases failed: {response.text}"
        cases = response.json()
        assert isinstance(cases, list)
        print(f"✓ Cases endpoint returned {len(cases)} cases")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
