"""
Test safeguarding detection and AI Battle Buddies features
Tests for UK Veterans Support App
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://safeguard-call.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestHealthAndAuth:
    """Basic health and auth tests"""
    
    def test_health_check(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        print(f"Health check passed: {response.json()}")
    
    def test_admin_login(self, api_client):
        """Test admin login works"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"Admin login successful: {data['user']['name']}")


class TestAIBuddiesCharacters:
    """Test AI Battle Buddies character endpoints"""
    
    def test_get_characters(self, api_client):
        """Test getting available AI characters"""
        response = api_client.get(f"{BASE_URL}/api/ai-buddies/characters")
        assert response.status_code == 200
        data = response.json()
        assert "characters" in data
        characters = data["characters"]
        
        # Should have Tommy and Rachel (doris is the internal ID)
        character_ids = [c["id"] for c in characters]
        assert "tommy" in character_ids, "Tommy should be available"
        assert "doris" in character_ids, "Rachel should be available"
        
        # Verify character data
        for char in characters:
            assert "name" in char
            assert "avatar" in char
            assert "id" in char
        
        print(f"Found characters: {[c['name'] for c in characters]}")


class TestAIBuddiesChat:
    """Test AI Battle Buddies chat functionality"""
    
    def test_chat_with_tommy(self, api_client):
        """Test basic chat with Tommy"""
        session_id = f"test-tommy-{int(time.time())}"
        response = api_client.post(f"{BASE_URL}/api/ai-buddies/chat", json={
            "message": "Hello, how are you?",
            "sessionId": session_id,
            "character": "tommy"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "reply" in data
        assert "characterName" in data
        assert data["characterName"] == "Tommy"
        assert "safeguardingTriggered" in data
        assert data["safeguardingTriggered"] == False
        
        print(f"Tommy replied: {data['reply'][:100]}...")
    
    def test_chat_with_rachel(self, api_client):
        """Test basic chat with Rachel (internal ID: doris)"""
        session_id = f"test-rachel-{int(time.time())}"
        response = api_client.post(f"{BASE_URL}/api/ai-buddies/chat", json={
            "message": "Hello Rachel",
            "sessionId": session_id,
            "character": "doris"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "reply" in data
        assert "characterName" in data
        assert data["characterName"] == "Rachel"
        assert "safeguardingTriggered" in data
        assert data["safeguardingTriggered"] == False
        
        print(f"Rachel replied: {data['reply'][:100]}...")


class TestSafeguardingDetection:
    """Test safeguarding keyword detection in AI chat"""
    
    def test_safeguarding_suicide_keyword(self, api_client):
        """Test safeguarding triggers on suicide keyword"""
        session_id = f"test-safeguard-{int(time.time())}"
        response = api_client.post(f"{BASE_URL}/api/ai-buddies/chat", json={
            "message": "I've been thinking about suicide lately",
            "sessionId": session_id,
            "character": "tommy"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "safeguardingTriggered" in data
        assert data["safeguardingTriggered"] == True, "Safeguarding should trigger on 'suicide'"
        assert "safeguardingAlertId" in data
        assert data["safeguardingAlertId"] is not None
        
        print(f"SUCCESS: Safeguarding triggered. Alert ID: {data['safeguardingAlertId']}")
    
    def test_safeguarding_want_to_die(self, api_client):
        """Test safeguarding triggers on 'want to die'"""
        session_id = f"test-safeguard-die-{int(time.time())}"
        response = api_client.post(f"{BASE_URL}/api/ai-buddies/chat", json={
            "message": "Sometimes I just want to die",
            "sessionId": session_id,
            "character": "doris"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["safeguardingTriggered"] == True, "Safeguarding should trigger on 'want to die'"
        print(f"SUCCESS: Safeguarding triggered on 'want to die'. Alert ID: {data['safeguardingAlertId']}")
    
    def test_safeguarding_hopeless(self, api_client):
        """Test safeguarding triggers on 'hopeless'"""
        session_id = f"test-safeguard-hope-{int(time.time())}"
        response = api_client.post(f"{BASE_URL}/api/ai-buddies/chat", json={
            "message": "Everything feels hopeless right now",
            "sessionId": session_id,
            "character": "tommy"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["safeguardingTriggered"] == True, "Safeguarding should trigger on 'hopeless'"
        print(f"SUCCESS: Safeguarding triggered on 'hopeless'. Alert ID: {data['safeguardingAlertId']}")
    
    def test_safeguarding_no_point_living(self, api_client):
        """Test safeguarding triggers on 'no point living'"""
        session_id = f"test-safeguard-living-{int(time.time())}"
        response = api_client.post(f"{BASE_URL}/api/ai-buddies/chat", json={
            "message": "I feel like there's no point living anymore",
            "sessionId": session_id,
            "character": "doris"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["safeguardingTriggered"] == True, "Safeguarding should trigger on 'no point living'"
        print(f"SUCCESS: Safeguarding triggered on 'no point living'. Alert ID: {data['safeguardingAlertId']}")
    
    def test_no_safeguarding_normal_message(self, api_client):
        """Test that normal messages don't trigger safeguarding"""
        session_id = f"test-normal-{int(time.time())}"
        response = api_client.post(f"{BASE_URL}/api/ai-buddies/chat", json={
            "message": "I'm feeling a bit down today but overall okay",
            "sessionId": session_id,
            "character": "tommy"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["safeguardingTriggered"] == False, "Normal message should NOT trigger safeguarding"
        print("SUCCESS: Normal message did not trigger safeguarding")


class TestSafeguardingAlertsAPI:
    """Test safeguarding alerts management endpoints"""
    
    def test_get_safeguarding_alerts_authenticated(self, authenticated_client):
        """Test getting safeguarding alerts with authenticated staff user"""
        response = authenticated_client.get(f"{BASE_URL}/api/safeguarding-alerts")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"Found {len(data)} safeguarding alerts")
        
        # Check alert structure if any exist
        if data:
            alert = data[0]
            assert "session_id" in alert
            assert "character" in alert
            assert "triggering_message" in alert
            assert "status" in alert
    
    def test_get_safeguarding_alerts_unauthenticated(self, api_client):
        """Test that unauthenticated users cannot access safeguarding alerts"""
        response = api_client.get(f"{BASE_URL}/api/safeguarding-alerts")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], "Unauthenticated users should be denied"
        print("SUCCESS: Unauthenticated access correctly denied")


class TestCounsellorEndpoints:
    """Test counsellor endpoints for crisis support page"""
    
    def test_get_counsellors(self, api_client):
        """Test getting counsellors list (public endpoint)"""
        response = api_client.get(f"{BASE_URL}/api/counsellors")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"Found {len(data)} counsellors")
        
        # Check counsellor structure if any exist
        if data:
            counsellor = data[0]
            assert "name" in counsellor
            assert "status" in counsellor
    
    def test_get_available_counsellors(self, api_client):
        """Test getting available counsellors"""
        response = api_client.get(f"{BASE_URL}/api/counsellors/available")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All returned counsellors should be available
        for counsellor in data:
            assert counsellor["status"] == "available"
        
        print(f"Found {len(data)} available counsellors")


class TestOrganizationsEndpoint:
    """Test support organizations endpoint"""
    
    def test_get_organizations(self, api_client):
        """Test getting organizations list (public endpoint)"""
        response = api_client.get(f"{BASE_URL}/api/organizations")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"Found {len(data)} organizations")
        
        # Check organization structure if any exist
        if data:
            org = data[0]
            assert "name" in org
            assert "phone" in org


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
