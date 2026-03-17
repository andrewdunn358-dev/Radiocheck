"""
Test suite for iteration 15 - Testing P0/P1/P2 Issues
- Authentication flow
- AI Buddies characters endpoint
- CMS pages endpoint
- Protected endpoints with JWT token
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://chat-system-staging.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"


class TestAdminPasswordReset:
    """Test admin password reset endpoint (prerequisite for login)"""
    
    def test_reset_admin_password(self):
        """POST /api/auth/reset-admin-password should reset/create admin"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-admin-password")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["email"] == ADMIN_EMAIL
        print(f"SUCCESS: Admin password reset - {data['message']}")


class TestAuthentication:
    """Test authentication flow"""
    
    def test_login_success(self):
        """POST /api/auth/login with valid credentials should return token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"SUCCESS: Login successful for {data['user']['email']}")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with invalid credentials should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@example.com", "password": "wrongpass"}
        )
        assert response.status_code == 401
        print("SUCCESS: Invalid credentials correctly rejected with 401")


class TestProtectedEndpoints:
    """Test protected endpoints with JWT token"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for protected tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping protected endpoint tests")
    
    def test_get_users_authenticated(self, auth_token):
        """GET /api/auth/users with valid token should return users list"""
        response = requests.get(
            f"{BASE_URL}/api/auth/users",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0
        print(f"SUCCESS: Got {len(users)} users from protected endpoint")
    
    def test_get_users_unauthenticated(self):
        """GET /api/auth/users without token should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/auth/users")
        assert response.status_code in [401, 403]
        print("SUCCESS: Protected endpoint correctly requires authentication")


class TestAIBuddiesEndpoint:
    """Test AI Buddies characters endpoint"""
    
    def test_get_ai_characters(self):
        """GET /api/ai-buddies/characters should return all characters including Tommy and Rachel"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters")
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "characters" in data
        assert "about" in data
        
        # Get character IDs
        character_ids = [char["id"] for char in data["characters"]]
        
        # Verify Tommy and Rachel (internal ID: doris) are present
        assert "tommy" in character_ids, "Tommy character not found"
        assert "doris" in character_ids, "Rachel character not found"
        print(f"SUCCESS: AI Buddies endpoint returns {len(data['characters'])} characters including Tommy and Rachel")
        
        # Verify each character has required fields
        for char in data["characters"]:
            assert "id" in char
            assert "name" in char
            assert "description" in char
            assert "avatar" in char
            print(f"  - {char['name']}: {char['description'][:50]}...")
    
    def test_ai_characters_tommy_details(self):
        """Verify Tommy character has correct details"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters")
        assert response.status_code == 200
        data = response.json()
        
        tommy = next((c for c in data["characters"] if c["id"] == "tommy"), None)
        assert tommy is not None
        assert tommy["name"] == "Tommy"
        assert "warm" in tommy["description"].lower() or "steady" in tommy["description"].lower()
        assert tommy["avatar"].startswith("http")
        print(f"SUCCESS: Tommy character details verified - {tommy['description']}")
    
    def test_ai_characters_rachel_details(self):
        """Verify Rachel character has correct details (internal ID: doris)"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters")
        assert response.status_code == 200
        data = response.json()
        
        rachel = next((c for c in data["characters"] if c["id"] == "doris"), None)
        assert rachel is not None
        assert rachel["name"] == "Rachel"
        assert "criminal" in rachel["description"].lower() or "justice" in rachel["description"].lower()
        assert rachel["avatar"].startswith("http")
        print(f"SUCCESS: Rachel character details verified - {rachel['description']}")


class TestCMSEndpoints:
    """Test CMS pages endpoints"""
    
    def test_get_cms_pages_home(self):
        """GET /api/cms/pages/home should return home page content"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/home")
        assert response.status_code == 200
        data = response.json()
        
        assert "slug" in data
        assert data["slug"] == "home"
        assert "title" in data
        assert "sections" in data
        print(f"SUCCESS: CMS home page returned with {len(data.get('sections', []))} sections")
    
    def test_get_cms_pages_list(self):
        """GET /api/cms/pages should return list of all CMS pages"""
        response = requests.get(f"{BASE_URL}/api/cms/pages")
        assert response.status_code == 200
        pages = response.json()
        
        assert isinstance(pages, list)
        assert len(pages) > 0
        page_slugs = [p.get("slug") for p in pages]
        print(f"SUCCESS: Got {len(pages)} CMS pages: {page_slugs}")


class TestHealthAndBasicEndpoints:
    """Test health check and basic endpoints"""
    
    def test_organizations_endpoint(self):
        """GET /api/organizations/ should return list of organizations"""
        response = requests.get(f"{BASE_URL}/api/organizations/")
        assert response.status_code == 200
        orgs = response.json()
        assert isinstance(orgs, list)
        print(f"SUCCESS: Organizations endpoint returns {len(orgs)} organizations")
    
    def test_resources_endpoint(self):
        """GET /api/resources/ should return list of resources"""
        response = requests.get(f"{BASE_URL}/api/resources/")
        assert response.status_code == 200
        resources = response.json()
        assert isinstance(resources, list)
        print(f"SUCCESS: Resources endpoint returns {len(resources)} resources")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
