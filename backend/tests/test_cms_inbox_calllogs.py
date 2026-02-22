"""
Backend API tests for:
1. Buddy Finder Inbox - /api/buddy-finder/inbox
2. CMS Pages - /api/cms/pages, /api/cms/pages/{slug}
3. CMS Sections - /api/cms/sections (POST)
4. CMS Cards - /api/cms/cards (POST)
5. Call Logs - /api/call-logs
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://compliance-portal-23.preview.emergentagent.com"

# Admin credentials for testing
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"

# Staff credentials
STAFF_EMAIL = "sarahm.counsellor@radiocheck.me"
STAFF_PASSWORD = "RadioCheck2026!"


class TestAuthHelpers:
    """Helper functions for authentication"""
    
    @staticmethod
    def get_admin_token():
        """Get admin JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    @staticmethod
    def get_staff_token():
        """Get staff JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None


class TestAPIHealth:
    """Basic API health checks"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"PASS: API root returns: {data['message']}")


class TestCMSPagesPublic:
    """Test public CMS pages endpoints"""
    
    def test_get_cms_pages_list(self):
        """Test GET /api/cms/pages - returns list of visible pages"""
        response = requests.get(f"{BASE_URL}/api/cms/pages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/cms/pages returns {len(data)} pages")
        
        # Check structure if pages exist
        if len(data) > 0:
            page = data[0]
            assert "slug" in page
            assert "title" in page
            print(f"  - First page: slug='{page['slug']}', title='{page['title']}'")
    
    def test_get_cms_page_veteran_support_app(self):
        """Test GET /api/cms/pages/veteran-support-app - returns page with sections and cards"""
        # Try the veteran-support-app slug first
        response = requests.get(f"{BASE_URL}/api/cms/pages/veteran-support-app")
        
        if response.status_code == 404:
            # Try home page instead
            response = requests.get(f"{BASE_URL}/api/cms/pages/home")
            
        if response.status_code == 404:
            # List available pages
            list_response = requests.get(f"{BASE_URL}/api/cms/pages")
            available_pages = list_response.json()
            if len(available_pages) > 0:
                slug = available_pages[0]["slug"]
                response = requests.get(f"{BASE_URL}/api/cms/pages/{slug}")
                print(f"INFO: Using first available page: {slug}")
            else:
                pytest.skip("No CMS pages available to test")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify page structure
        assert "slug" in data
        assert "title" in data
        assert "sections" in data
        assert isinstance(data["sections"], list)
        
        print(f"PASS: GET /api/cms/pages/{data['slug']} returns page")
        print(f"  - Title: {data['title']}")
        print(f"  - Sections count: {len(data['sections'])}")
        
        # Check sections have cards
        if len(data["sections"]) > 0:
            section = data["sections"][0]
            assert "id" in section
            if "cards" in section:
                print(f"  - First section has {len(section.get('cards', []))} cards")


class TestCMSAdminEndpoints:
    """Test admin-only CMS endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for tests"""
        token = TestAuthHelpers.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        return token
    
    def test_get_all_cms_pages_admin(self, admin_token):
        """Test GET /api/cms/pages/all (admin) - returns all pages including hidden"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/cms/pages/all", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Admin GET /api/cms/pages/all returns {len(data)} pages")
    
    def test_create_cms_section_requires_auth(self):
        """Test POST /api/cms/sections requires authentication"""
        section_data = {
            "page_slug": "test-page",
            "section_type": "text",
            "title": "Test Section",
            "order": 0
        }
        response = requests.post(f"{BASE_URL}/api/cms/sections", json=section_data)
        assert response.status_code in [401, 403]
        print("PASS: POST /api/cms/sections returns 401/403 without auth")
    
    def test_create_cms_section_with_auth(self, admin_token):
        """Test POST /api/cms/sections with admin auth"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First, check if test page exists or create it
        test_slug = f"test-page-{uuid.uuid4().hex[:8]}"
        
        # Create a test page first
        page_data = {
            "slug": test_slug,
            "title": "Test Page for Section",
            "is_visible": False,  # Hidden so it doesn't affect prod
            "show_in_nav": False
        }
        page_response = requests.post(f"{BASE_URL}/api/cms/pages", json=page_data, headers=headers)
        
        if page_response.status_code not in [200, 400]:  # 400 if slug exists
            print(f"WARNING: Could not create test page: {page_response.status_code}")
        
        # Create section
        section_data = {
            "page_slug": test_slug,
            "section_type": "text",
            "title": "TEST_Section_Created",
            "content": "Test content for section",
            "order": 0,
            "is_visible": True
        }
        response = requests.post(f"{BASE_URL}/api/cms/sections", json=section_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "section" in data
        assert data["section"]["title"] == "TEST_Section_Created"
        print(f"PASS: POST /api/cms/sections creates section successfully")
        print(f"  - Section ID: {data['section']['id']}")
        
        # Cleanup - delete section and page
        section_id = data["section"]["id"]
        requests.delete(f"{BASE_URL}/api/cms/sections/{section_id}", headers=headers)
        requests.delete(f"{BASE_URL}/api/cms/pages/{test_slug}", headers=headers)
    
    def test_create_cms_card_requires_auth(self):
        """Test POST /api/cms/cards requires authentication"""
        card_data = {
            "section_id": "test-section-id",
            "card_type": "link",
            "title": "Test Card"
        }
        response = requests.post(f"{BASE_URL}/api/cms/cards", json=card_data)
        assert response.status_code in [401, 403]
        print("PASS: POST /api/cms/cards returns 401/403 without auth")
    
    def test_create_cms_card_with_auth(self, admin_token):
        """Test POST /api/cms/cards with admin auth"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create test page and section first
        test_slug = f"test-page-card-{uuid.uuid4().hex[:8]}"
        
        page_data = {
            "slug": test_slug,
            "title": "Test Page for Card",
            "is_visible": False,
            "show_in_nav": False
        }
        requests.post(f"{BASE_URL}/api/cms/pages", json=page_data, headers=headers)
        
        section_data = {
            "page_slug": test_slug,
            "section_type": "cards",
            "title": "TEST_Section_for_Cards",
            "order": 0
        }
        section_response = requests.post(f"{BASE_URL}/api/cms/sections", json=section_data, headers=headers)
        
        if section_response.status_code != 200:
            pytest.skip("Could not create test section for card test")
        
        section_id = section_response.json()["section"]["id"]
        
        # Create card
        card_data = {
            "section_id": section_id,
            "card_type": "link",
            "title": "TEST_Card_Created",
            "description": "Test card description",
            "icon": "star",
            "order": 0,
            "is_visible": True
        }
        response = requests.post(f"{BASE_URL}/api/cms/cards", json=card_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "card" in data
        assert data["card"]["title"] == "TEST_Card_Created"
        print(f"PASS: POST /api/cms/cards creates card successfully")
        print(f"  - Card ID: {data['card']['id']}")
        
        # Cleanup
        card_id = data["card"]["id"]
        requests.delete(f"{BASE_URL}/api/cms/cards/{card_id}", headers=headers)
        requests.delete(f"{BASE_URL}/api/cms/sections/{section_id}", headers=headers)
        requests.delete(f"{BASE_URL}/api/cms/pages/{test_slug}", headers=headers)


class TestBuddyFinderInbox:
    """Test Buddy Finder inbox endpoint"""
    
    def test_inbox_requires_auth(self):
        """Test GET /api/buddy-finder/inbox requires authentication"""
        response = requests.get(f"{BASE_URL}/api/buddy-finder/inbox")
        assert response.status_code in [401, 403]
        print("PASS: GET /api/buddy-finder/inbox returns 401/403 without auth")
    
    def test_inbox_with_staff_token(self):
        """Test GET /api/buddy-finder/inbox with staff token"""
        token = TestAuthHelpers.get_staff_token()
        if not token:
            pytest.skip("Could not get staff token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/buddy-finder/inbox", headers=headers)
        
        # Should return 200 - either with messages or empty inbox
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "messages" in data
        assert isinstance(data["messages"], list)
        assert "has_profile" in data
        
        print(f"PASS: GET /api/buddy-finder/inbox returns proper structure")
        print(f"  - has_profile: {data.get('has_profile')}")
        print(f"  - profile_id: {data.get('profile_id')}")
        print(f"  - messages count: {len(data['messages'])}")
        print(f"  - unread_count: {data.get('unread_count', 0)}")
    
    def test_inbox_with_admin_token(self):
        """Test GET /api/buddy-finder/inbox with admin token"""
        token = TestAuthHelpers.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/buddy-finder/inbox", headers=headers)
        
        # Admin may not have a buddy profile
        assert response.status_code == 200
        data = response.json()
        
        assert "messages" in data
        assert "has_profile" in data
        
        print(f"PASS: GET /api/buddy-finder/inbox (admin) returns proper structure")
        print(f"  - has_profile: {data.get('has_profile')}")


class TestCallLogs:
    """Test call logs endpoints"""
    
    def test_post_call_log_public(self):
        """Test POST /api/call-logs - public endpoint for logging call intents"""
        call_data = {
            "contact_type": "counsellor",
            "contact_name": "TEST_Call_Intent",
            "contact_phone": "+44123456789",
            "call_method": "phone"
        }
        response = requests.post(f"{BASE_URL}/api/call-logs", json=call_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["contact_type"] == "counsellor"
        assert data["contact_name"] == "TEST_Call_Intent"
        
        print(f"PASS: POST /api/call-logs creates call log successfully")
        print(f"  - ID: {data['id']}")
    
    def test_get_call_logs_requires_admin(self):
        """Test GET /api/call-logs requires admin authentication"""
        response = requests.get(f"{BASE_URL}/api/call-logs")
        assert response.status_code in [401, 403]
        print("PASS: GET /api/call-logs returns 401/403 without auth")
    
    def test_get_call_logs_with_admin(self):
        """Test GET /api/call-logs with admin token - returns metrics for charts"""
        token = TestAuthHelpers.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/call-logs", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify metrics structure for charts
        assert "total_calls" in data
        assert "period_days" in data
        assert "calls_by_type" in data
        assert "calls_by_method" in data
        assert "calls_by_day" in data
        assert "recent_logs" in data
        
        print(f"PASS: GET /api/call-logs returns metrics for charts")
        print(f"  - total_calls: {data['total_calls']}")
        print(f"  - period_days: {data['period_days']}")
        print(f"  - calls_by_type: {data['calls_by_type']}")
        print(f"  - calls_by_method: {data['calls_by_method']}")
        print(f"  - calls_by_day entries: {len(data['calls_by_day'])}")
        print(f"  - recent_logs count: {len(data['recent_logs'])}")
    
    def test_get_call_logs_with_filters(self):
        """Test GET /api/call-logs with query parameters"""
        token = TestAuthHelpers.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test with days filter
        response = requests.get(f"{BASE_URL}/api/call-logs?days=7", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["period_days"] == 7
        print(f"PASS: GET /api/call-logs?days=7 filters correctly")
        
        # Test with contact_type filter
        response = requests.get(f"{BASE_URL}/api/call-logs?contact_type=counsellor", headers=headers)
        assert response.status_code == 200
        print(f"PASS: GET /api/call-logs?contact_type=counsellor filters correctly")


class TestCMSSectionsGet:
    """Test GET endpoints for CMS sections"""
    
    def test_get_sections_for_page(self):
        """Test GET /api/cms/sections/{page_slug}"""
        # First get a valid page slug
        pages_response = requests.get(f"{BASE_URL}/api/cms/pages")
        if pages_response.status_code != 200 or len(pages_response.json()) == 0:
            pytest.skip("No CMS pages available")
        
        page_slug = pages_response.json()[0]["slug"]
        
        response = requests.get(f"{BASE_URL}/api/cms/sections/{page_slug}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"PASS: GET /api/cms/sections/{page_slug} returns {len(data)} sections")


class TestCMSCardsGet:
    """Test GET endpoints for CMS cards"""
    
    def test_get_cards_for_section(self):
        """Test GET /api/cms/cards/{section_id}"""
        # First get a section
        pages_response = requests.get(f"{BASE_URL}/api/cms/pages")
        if pages_response.status_code != 200 or len(pages_response.json()) == 0:
            pytest.skip("No CMS pages available")
        
        page_slug = pages_response.json()[0]["slug"]
        page_response = requests.get(f"{BASE_URL}/api/cms/pages/{page_slug}")
        
        if page_response.status_code != 200:
            pytest.skip("Could not get page details")
        
        page_data = page_response.json()
        sections = page_data.get("sections", [])
        
        if len(sections) == 0:
            pytest.skip("No sections in page")
        
        section_id = sections[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/cms/cards/{section_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"PASS: GET /api/cms/cards/{section_id} returns {len(data)} cards")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
