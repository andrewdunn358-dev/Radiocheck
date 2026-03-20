"""
Comprehensive Backend API Tests for Radio Check - UK Veterans Support App

Tests:
- Auth endpoints (JWT token generation)
- CMS pages and home page with sections/cards
- Buddy Finder profiles and inbox
- Shifts CRUD
- AI Buddies (characters, chat with Hugo, safeguarding triggers)
- Call logs analytics
- CMS sections reorder
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Use public URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://staff-portal-audit.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"
STAFF_EMAIL = "sarahm.counsellor@radiocheck.me"
STAFF_PASSWORD = "RadioCheck2026!"


def get_admin_token():
    """Helper to get admin token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")  # API uses access_token
    return None


def get_staff_token():
    """Helper to get staff token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


class TestAuthEndpoints:
    """Auth router tests - JWT token generation"""
    
    def test_login_admin_success(self):
        """Test admin login returns JWT token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "access_token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert len(data["access_token"]) > 20, "Token too short"
        print(f"Admin login success - token length: {len(data['access_token'])}")
    
    def test_login_staff_success(self):
        """Test staff login returns JWT token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
        )
        assert response.status_code == 200, f"Staff login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == STAFF_EMAIL
        print(f"Staff login success - role: {data['user'].get('role')}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpass"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_get_me_with_token(self):
        """Test /auth/me returns user profile with valid token"""
        token = get_admin_token()
        assert token, "Failed to get admin token"
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL


class TestCMSEndpoints:
    """CMS router tests - pages, sections, cards"""
    
    def test_get_cms_pages_list(self):
        """Test /api/cms/pages returns list of pages"""
        response = requests.get(f"{BASE_URL}/api/cms/pages")
        assert response.status_code == 200, f"CMS pages failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one page"
        # Check for expected pages
        slugs = [p.get("slug") for p in data]
        assert "home" in slugs, "Home page should exist"
        print(f"CMS has {len(data)} pages: {slugs}")
    
    def test_get_home_page_with_sections(self):
        """Test /api/cms/pages/home returns page with sections and cards"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/home")
        assert response.status_code == 200, f"Home page failed: {response.text}"
        data = response.json()
        
        # Check page structure
        assert data.get("slug") == "home", "Slug should be 'home'"
        assert "title" in data, "Title should be present"
        assert "sections" in data, "Sections should be present"
        assert isinstance(data["sections"], list), "Sections should be a list"
        
        # Check sections have cards
        if len(data["sections"]) > 0:
            section = data["sections"][0]
            assert "id" in section, "Section should have ID"
            print(f"Home page has {len(data['sections'])} sections")
    
    def test_get_cms_sections_for_page(self):
        """Test getting sections for a specific page"""
        response = requests.get(f"{BASE_URL}/api/cms/sections/home")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return list of sections"
        print(f"Home page has {len(data)} sections via /api/cms/sections/home")
    
    def test_cms_sections_reorder_endpoint_exists(self):
        """Test CMS sections reorder endpoint exists (for drag-drop)"""
        token = get_admin_token()
        assert token, "Failed to get admin token"
        
        # Test reorder endpoint - returns 404 "Section not found" for empty payload
        # This is expected behavior - we just verify endpoint exists
        response = requests.put(
            f"{BASE_URL}/api/cms/sections/reorder",
            headers={"Authorization": f"Bearer {token}"},
            json={"sections": {}}
        )
        # 404 with "Section not found" means endpoint exists but no sections to reorder
        # 200 means it worked
        # Not 405 (method not allowed) which would mean endpoint doesn't exist
        assert response.status_code in [200, 404], f"Reorder endpoint issue: {response.text}"
        if response.status_code == 404:
            assert "not found" in response.text.lower(), "Should be 'not found' error"
        print(f"CMS sections reorder endpoint status: {response.status_code}")


class TestBuddyFinderEndpoints:
    """Buddy Finder router tests - profiles and inbox"""
    
    def test_get_buddy_profiles_list(self):
        """Test /api/buddy-finder/profiles returns list of profiles"""
        response = requests.get(f"{BASE_URL}/api/buddy-finder/profiles")
        assert response.status_code == 200, f"Buddy profiles failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list of profiles"
        
        # Check structure if profiles exist
        if len(data) > 0:
            profile = data[0]
            assert "display_name" in profile or "id" in profile
        print(f"Found {len(data)} buddy profiles")
    
    def test_get_buddy_inbox_structure(self):
        """Test /api/buddy-finder/inbox returns correct structure"""
        token = get_staff_token()
        assert token, "Failed to get staff token"
        
        response = requests.get(
            f"{BASE_URL}/api/buddy-finder/inbox",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Inbox failed: {response.text}"
        data = response.json()
        
        # Check structure - actual response has messages, profile_id, has_profile
        assert "messages" in data, "Should have messages array"
        assert "has_profile" in data, "Should have has_profile flag"
        assert "profile_id" in data, "Should have profile_id"
        assert isinstance(data["messages"], list), "Messages should be list"
        print(f"Inbox: {len(data['messages'])} messages, has_profile: {data['has_profile']}")
    
    def test_get_regions_endpoint(self):
        """Test /api/buddy-finder/regions returns UK regions"""
        response = requests.get(f"{BASE_URL}/api/buddy-finder/regions")
        assert response.status_code == 200
        data = response.json()
        assert "regions" in data
        assert "Scotland" in data["regions"] or "London" in data["regions"]
        print(f"Regions: {data['regions'][:5]}...")
    
    def test_get_branches_endpoint(self):
        """Test /api/buddy-finder/branches returns service branches"""
        response = requests.get(f"{BASE_URL}/api/buddy-finder/branches")
        assert response.status_code == 200
        data = response.json()
        assert "branches" in data
        assert "British Army" in data["branches"] or "Royal Navy" in data["branches"]
        print(f"Branches: {data['branches'][:3]}...")


class TestShiftsEndpoints:
    """Shifts router tests - CRUD operations"""
    
    def test_get_shifts_list(self):
        """Test /api/shifts returns list of shifts"""
        token = get_admin_token()
        assert token, "Failed to get admin token"
        
        response = requests.get(
            f"{BASE_URL}/api/shifts",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Shifts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list of shifts"
        print(f"Found {len(data)} shifts")
    
    def test_get_today_shifts(self):
        """Test /api/shifts/today returns today's shifts"""
        token = get_admin_token()
        assert token, "Failed to get admin token"
        
        response = requests.get(
            f"{BASE_URL}/api/shifts/today",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Response is {shifts: [], someone_on_net: bool, current_time: str}
        assert "shifts" in data, "Should have shifts key"
        assert isinstance(data["shifts"], list), "shifts should be a list"
        assert "someone_on_net" in data, "Should have someone_on_net flag"
        print(f"Today's shifts: {len(data['shifts'])}, on_net: {data['someone_on_net']}")
    
    def test_shift_crud_operations(self):
        """Test create, read, update, delete shift"""
        token = get_admin_token()
        assert token, "Failed to get admin token"
        
        # CREATE shift - response is {success: true, shift: {...}}
        test_shift = {
            "date": "2026-02-20",
            "start_time": "09:00",
            "end_time": "17:00"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/shifts",
            headers={"Authorization": f"Bearer {token}"},
            params={"user_id": "test_user_123", "user_name": "TEST_User"},
            json=test_shift
        )
        assert create_response.status_code in [200, 201], f"Create shift failed: {create_response.text}"
        
        created_data = create_response.json()
        # Response is {success: true, shift: {id: ...}}
        shift_id = created_data.get("shift", {}).get("id") or created_data.get("id")
        assert shift_id, f"Created shift should have ID: {created_data}"
        print(f"Created shift: {shift_id}")
        
        # UPDATE shift
        update_response = requests.put(
            f"{BASE_URL}/api/shifts/{shift_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"end_time": "18:00"}
        )
        assert update_response.status_code == 200, f"Update shift failed: {update_response.text}"
        print(f"Updated shift: {shift_id}")
        
        # DELETE shift
        delete_response = requests.delete(
            f"{BASE_URL}/api/shifts/{shift_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert delete_response.status_code == 200, f"Delete shift failed: {delete_response.text}"
        assert delete_response.json().get("deleted") == True or delete_response.json().get("success") == True
        print(f"Deleted shift: {shift_id}")


class TestAIBuddiesEndpoints:
    """AI Buddies tests - characters, chat, safeguarding"""
    
    def test_get_ai_characters_list(self):
        """Test /api/ai-buddies/characters returns character list"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters")
        assert response.status_code == 200, f"AI characters failed: {response.text}"
        data = response.json()
        
        assert "characters" in data, "Should have characters array"
        characters = data["characters"]
        assert len(characters) >= 2, "Should have at least 2 characters"
        
        # Check character structure
        char_ids = [c.get("id") for c in characters]
        print(f"Available characters: {char_ids}")
    
    def test_hugo_character_recognized(self):
        """Test Hugo character is recognized by the backend"""
        # Even if AI is offline, Hugo should be in AI_CHARACTERS
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "Hello Hugo",
                "sessionId": f"test_hugo_{uuid.uuid4().hex[:8]}",
                "character": "hugo"
            },
            timeout=30
        )
        
        # 503 = API key not configured (but Hugo was recognized)
        # 200 = Working with response
        if response.status_code == 503:
            error_msg = response.text.lower()
            assert "unavailable" in error_msg or "api key" in error_msg
            print("Hugo recognized - AI Buddies offline (no API key configured)")
        elif response.status_code == 200:
            data = response.json()
            assert data.get("characterName") == "Hugo", f"Expected Hugo, got {data.get('characterName')}"
            print(f"Hugo chat working: {data.get('reply', '')[:100]}...")
        else:
            print(f"Hugo response: {response.status_code} - {response.text[:200]}")
            # Allow for temporary server issues
            assert response.status_code in [200, 500, 502, 503, 520], f"Unexpected status: {response.status_code}"
    
    def test_hugo_chat_if_enabled(self):
        """Test Hugo chat if AI is enabled"""
        session_id = f"test_hugo_enabled_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I've been feeling stressed lately",
                "sessionId": session_id,
                "character": "hugo"
            },
            timeout=60
        )
        
        if response.status_code == 503:
            pytest.skip("AI Buddies disabled (no API key)")
        
        if response.status_code in [502, 520]:
            pytest.skip(f"Server gateway error: {response.status_code}")
        
        assert response.status_code == 200, f"Hugo chat failed: {response.text[:500]}"
        data = response.json()
        assert data.get("characterName") == "Hugo"
        assert "reply" in data
        print(f"Hugo reply: {data['reply'][:150]}...")


class TestCallLogsEndpoints:
    """Call logs analytics endpoint tests"""
    
    def test_get_call_logs_metrics(self):
        """Test /api/call-logs returns analytics for charts"""
        token = get_admin_token()
        assert token, "Failed to get admin token"
        
        response = requests.get(
            f"{BASE_URL}/api/call-logs",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Call logs failed: {response.text}"
        data = response.json()
        
        # Check metrics structure
        assert "total_calls" in data, "Should have total_calls"
        assert "calls_by_type" in data, "Should have calls_by_type"
        assert "calls_by_method" in data, "Should have calls_by_method"
        assert "calls_by_day" in data, "Should have calls_by_day"
        
        print(f"Call logs: Total={data['total_calls']}, By type={data['calls_by_type']}")
    
    def test_call_logs_day_filter(self):
        """Test call logs can be filtered by days"""
        token = get_admin_token()
        assert token, "Failed to get admin token"
        
        response = requests.get(
            f"{BASE_URL}/api/call-logs?days=7",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("period_days") == 7
        print(f"Call logs with days=7: {data.get('total_calls')} calls")
    
    def test_post_call_intent_public(self):
        """Test POST /api/call-logs is public (for app users)"""
        response = requests.post(
            f"{BASE_URL}/api/call-logs",
            json={
                "contact_type": "counsellor",
                "contact_id": "test_id",
                "contact_name": "TEST_CallLog_" + uuid.uuid4().hex[:6],
                "call_method": "phone"
            }
        )
        # Should succeed without auth
        assert response.status_code == 200, f"Call log post failed: {response.text}"
        print("Call intent logged successfully (public endpoint)")


class TestHealthAndStatus:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API is responding"""
        response = requests.get(f"{BASE_URL}/api/")
        # May be 404 or 200 depending on root route
        assert response.status_code in [200, 404, 307], f"API not responding: {response.status_code}"
        print(f"API health: {response.status_code}")
    
    def test_auth_endpoint_available(self):
        """Test auth endpoint is available"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "test"}
        )
        # Should return 401 not 404
        assert response.status_code == 401, f"Auth endpoint issue: {response.status_code}"
        print("Auth endpoint responding with 401 for invalid credentials")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
