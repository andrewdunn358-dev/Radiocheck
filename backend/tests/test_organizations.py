"""
Backend tests for Organizations API endpoints - UK Veterans Support App
Tests: GET /api/organizations, POST /api/organizations/seed, POST /api/organizations, DELETE /api/organizations/{id}
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mental-health-hub-81.preview.emergentagent.com')

# Admin credentials
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in login response"
    return data["access_token"]


@pytest.fixture(scope="module")
def authenticated_client(api_client, admin_token):
    """Session with admin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


class TestOrganizationsPublicEndpoints:
    """Test public organization endpoints"""
    
    def test_get_organizations_returns_list(self, api_client):
        """GET /api/organizations - returns list of organizations"""
        response = api_client.get(f"{BASE_URL}/api/organizations")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} organizations")
    
    def test_organizations_have_correct_structure(self, api_client):
        """Verify each organization has required fields"""
        response = api_client.get(f"{BASE_URL}/api/organizations")
        assert response.status_code == 200
        
        organizations = response.json()
        if len(organizations) > 0:
            org = organizations[0]
            # Check required fields
            assert "id" in org, "Organization must have 'id'"
            assert "name" in org, "Organization must have 'name'"
            assert "description" in org, "Organization must have 'description'"
            assert "phone" in org, "Organization must have 'phone'"
            print(f"Organization structure valid: {org['name']}")
    
    def test_uk_veteran_organizations_present(self, api_client):
        """Verify UK veteran organizations are seeded"""
        response = api_client.get(f"{BASE_URL}/api/organizations")
        assert response.status_code == 200
        
        organizations = response.json()
        org_names = [org["name"] for org in organizations]
        
        # Check for expected UK veteran organizations
        expected_orgs = [
            "Combat Stress",
            "Samaritans",
            "Veterans UK",
            "CALM",
            "SSAFA",
            "Help for Heroes",
            "Royal British Legion",
            "NHS Urgent Mental Health Helpline"
        ]
        
        for expected in expected_orgs:
            assert expected in org_names, f"Expected organization '{expected}' not found"
        
        print(f"All {len(expected_orgs)} expected UK veteran organizations present")


class TestOrganizationsAdminEndpoints:
    """Test admin-only organization endpoints"""
    
    def test_seed_organizations_requires_auth(self, api_client):
        """POST /api/organizations/seed without auth returns 401/403"""
        # Remove auth header for this test
        headers = {"Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/organizations/seed", headers=headers)
        assert response.status_code in [401, 403], "Seed endpoint should require authentication"
        print("Seed endpoint correctly requires authentication")
    
    def test_seed_organizations_with_auth(self, authenticated_client):
        """POST /api/organizations/seed - seeds default organizations"""
        response = authenticated_client.post(f"{BASE_URL}/api/organizations/seed")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data, "Response should have message"
        assert "Organizations seeded successfully" in data["message"]
        print(f"Seed response: {data['message']}")
    
    def test_create_organization_requires_auth(self, api_client):
        """POST /api/organizations without auth returns 401/403"""
        headers = {"Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/organizations", 
            headers=headers,
            json={
                "name": "TEST_Unauthorized Org",
                "description": "Should not be created",
                "phone": "0000000000"
            }
        )
        assert response.status_code in [401, 403], "Create endpoint should require authentication"
        print("Create endpoint correctly requires authentication")
    
    def test_create_organization_with_auth(self, authenticated_client):
        """POST /api/organizations - creates new organization (admin only)"""
        response = authenticated_client.post(f"{BASE_URL}/api/organizations", json={
            "name": "TEST_New Veterans Charity",
            "description": "Test organization for veterans support",
            "phone": "0800 TEST 123",
            "sms": "0800 SMS TEST",
            "whatsapp": "44800123456"
        })
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_New Veterans Charity"
        assert data["description"] == "Test organization for veterans support"
        assert data["phone"] == "0800 TEST 123"
        assert "id" in data
        print(f"Created organization with ID: {data['id']}")
        
        # Store ID for cleanup
        TestOrganizationsAdminEndpoints.created_org_id = data["id"]
    
    def test_verify_organization_persisted(self, api_client):
        """GET /api/organizations - verify created org exists"""
        response = api_client.get(f"{BASE_URL}/api/organizations")
        assert response.status_code == 200
        
        organizations = response.json()
        org_names = [org["name"] for org in organizations]
        assert "TEST_New Veterans Charity" in org_names, "Created organization not found in list"
        print("Created organization persisted successfully")
    
    def test_delete_organization_requires_auth(self, api_client):
        """DELETE /api/organizations/{id} without auth returns 401/403"""
        org_id = getattr(TestOrganizationsAdminEndpoints, 'created_org_id', 'fake-id')
        headers = {"Content-Type": "application/json"}
        response = requests.delete(f"{BASE_URL}/api/organizations/{org_id}", headers=headers)
        assert response.status_code in [401, 403], "Delete endpoint should require authentication"
        print("Delete endpoint correctly requires authentication")
    
    def test_delete_organization_with_auth(self, authenticated_client, api_client):
        """DELETE /api/organizations/{id} - deletes organization (admin only)"""
        org_id = getattr(TestOrganizationsAdminEndpoints, 'created_org_id', None)
        if not org_id:
            pytest.skip("No organization ID to delete")
        
        response = authenticated_client.delete(f"{BASE_URL}/api/organizations/{org_id}")
        assert response.status_code == 200, f"Delete failed: {response.text}"
        
        # Verify deletion via GET
        get_response = api_client.get(f"{BASE_URL}/api/organizations")
        organizations = get_response.json()
        org_names = [org["name"] for org in organizations]
        assert "TEST_New Veterans Charity" not in org_names, "Organization should be deleted"
        print(f"Organization {org_id} deleted and verified")
    
    def test_delete_nonexistent_organization(self, authenticated_client):
        """DELETE /api/organizations/{id} with fake ID returns 404"""
        response = authenticated_client.delete(f"{BASE_URL}/api/organizations/fake-nonexistent-id")
        assert response.status_code == 404, "Should return 404 for nonexistent org"
        print("404 returned for nonexistent organization")


class TestAdminAuthentication:
    """Test admin login functionality"""
    
    def test_admin_login_success(self, api_client):
        """POST /api/auth/login with valid admin credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful: {data['user']['name']}")
    
    def test_admin_login_wrong_password(self, api_client):
        """POST /api/auth/login with wrong password"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "WrongPassword123!"
        })
        assert response.status_code == 401
        print("Correctly rejected wrong password")
    
    def test_admin_me_endpoint(self, authenticated_client):
        """GET /api/auth/me returns current user"""
        response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print(f"Admin /me endpoint returns: {data['name']}")


class TestAPIHealthAndBasics:
    """Basic API health checks"""
    
    def test_api_root(self, api_client):
        """GET /api/ returns healthy response"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"API Root: {data['message']}")
    
    def test_counsellors_endpoint(self, api_client):
        """GET /api/counsellors works"""
        response = api_client.get(f"{BASE_URL}/api/counsellors")
        assert response.status_code == 200
        print(f"Found {len(response.json())} counsellors")
    
    def test_peer_supporters_endpoint(self, api_client):
        """GET /api/peer-supporters works"""
        response = api_client.get(f"{BASE_URL}/api/peer-supporters")
        assert response.status_code == 200
        print(f"Found {len(response.json())} peer supporters")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
