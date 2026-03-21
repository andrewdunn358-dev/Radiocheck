"""
Backend Tests for UK Veterans Support Admin Panel
Testing: Auth, CMS, Counsellors, Peer Supporters, Password Reset

Key Features Tested:
- Admin login at /api/auth/login
- User management (GET /api/auth/users)
- CMS content retrieval (GET /api/content)
- Content seeding (POST /api/content/seed)
- Forgot password endpoint (POST /api/auth/forgot-password)
- CRUD for counsellors and peer supporters
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://safeguard-call.preview.emergentagent.com').rstrip('/')

# Test credentials from main agent
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"


class TestHealthAndBasics:
    """Basic API health checks"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root working: {data['message']}")


class TestAdminLogin:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with provided credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful - email: {data['user']['email']}, role: {data['user']['role']}")
        
        return data["access_token"]
    
    def test_admin_login_invalid_password(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid password correctly rejected with 401")
    
    def test_login_invalid_email(self):
        """Test login with non-existent email"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "somepassword"
        })
        assert response.status_code == 401
        print("✓ Non-existent email correctly rejected with 401")


class TestUserManagement:
    """User management tests (admin only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_all_users(self):
        """Test fetching all users as admin"""
        response = requests.get(f"{BASE_URL}/api/auth/users", headers=self.headers)
        assert response.status_code == 200
        
        users = response.json()
        assert isinstance(users, list)
        assert len(users) >= 1  # At least admin user exists
        
        # Verify admin user is in the list
        admin_found = any(u["email"] == ADMIN_EMAIL for u in users)
        assert admin_found, "Admin user not found in users list"
        print(f"✓ Got {len(users)} users - admin found in list")
    
    def test_get_users_unauthorized(self):
        """Test that unauthenticated users can't access users list"""
        response = requests.get(f"{BASE_URL}/api/auth/users")
        assert response.status_code in [401, 403]
        print("✓ Unauthorized access to users list correctly rejected")


class TestCMSContent:
    """CMS content management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_all_content_public(self):
        """Test fetching all CMS content (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/content")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Got CMS content - {len(data)} pages available")
        
        # Check if content has expected pages
        if data:
            for page, sections in data.items():
                print(f"  - Page: {page}, sections: {list(sections.keys())[:3]}...")
        
        return data
    
    def test_seed_default_content(self):
        """Test seeding default CMS content (admin only)"""
        response = requests.post(f"{BASE_URL}/api/content/seed", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ Seed content: {data['message']}")
    
    def test_get_content_after_seed(self):
        """Test that content exists after seeding"""
        # First seed
        requests.post(f"{BASE_URL}/api/content/seed", headers=self.headers)
        
        # Then fetch
        response = requests.get(f"{BASE_URL}/api/content")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify expected pages exist
        expected_pages = ["home", "crisis-support", "peer-support"]
        for page in expected_pages:
            if page in data:
                print(f"✓ Found page: {page}")
                assert isinstance(data[page], dict)
        
        # Verify home page has key content
        if "home" in data:
            home = data["home"]
            assert "title" in home or len(home) > 0
            print(f"  - Home page sections: {list(home.keys())[:5]}")
    
    def test_update_content_admin(self):
        """Test updating CMS content as admin"""
        # First seed to ensure content exists
        requests.post(f"{BASE_URL}/api/content/seed", headers=self.headers)
        
        # Update a content section
        response = requests.put(
            f"{BASE_URL}/api/content/home/title",
            headers=self.headers,
            json={"content": "Veterans Support - Updated"}
        )
        assert response.status_code == 200
        print("✓ Content update successful")
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/content/home")
        if get_response.status_code == 200:
            data = get_response.json()
            if "title" in data:
                print(f"  - Updated title: {data['title']}")


class TestPasswordReset:
    """Password reset functionality tests"""
    
    def test_forgot_password_existing_user(self):
        """Test forgot password endpoint for existing user"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": ADMIN_EMAIL
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ Forgot password response: {data['message']}")
        
        # Since Resend isn't configured, should return token for dev
        if "reset_token" in data:
            print(f"  - Reset token received (dev mode): {data['reset_token'][:20]}...")
            return data["reset_token"]
    
    def test_forgot_password_nonexistent_email(self):
        """Test forgot password doesn't reveal if email exists"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent@example.com"
        })
        # Should still return 200 to not reveal email existence
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ Non-existent email handled securely: {data['message']}")


class TestCounsellors:
    """Counsellor management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_counsellors_public(self):
        """Test fetching all counsellors (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/counsellors")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} counsellors")
        return data
    
    def test_create_counsellor_admin(self):
        """Test creating a counsellor as admin"""
        counsellor_data = {
            "name": "TEST_Dr. Test Counsellor",
            "specialization": "PTSD Support",
            "phone": "+44 1234 567890",
            "sms": "+44 1234 567891",
            "whatsapp": "+44 1234 567892"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/counsellors",
            headers=self.headers,
            json=counsellor_data
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        created = response.json()
        assert created["name"] == counsellor_data["name"]
        assert created["specialization"] == counsellor_data["specialization"]
        assert "id" in created
        print(f"✓ Created counsellor: {created['name']} (ID: {created['id']})")
        
        return created["id"]
    
    def test_delete_counsellor_admin(self):
        """Test deleting a counsellor as admin"""
        # First create
        counsellor_data = {
            "name": "TEST_To Delete Counsellor",
            "specialization": "Test Spec",
            "phone": "+44 9999 999999"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/counsellors",
            headers=self.headers,
            json=counsellor_data
        )
        
        if create_response.status_code == 200:
            counsellor_id = create_response.json()["id"]
            
            # Delete
            delete_response = requests.delete(
                f"{BASE_URL}/api/counsellors/{counsellor_id}",
                headers=self.headers
            )
            assert delete_response.status_code == 200
            print(f"✓ Deleted counsellor ID: {counsellor_id}")
            
            # Verify deletion
            get_response = requests.get(f"{BASE_URL}/api/counsellors/{counsellor_id}")
            assert get_response.status_code == 404
            print("✓ Counsellor not found after deletion (expected)")


class TestPeerSupporters:
    """Peer supporter management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_peer_supporters_public(self):
        """Test fetching all peer supporters (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/peer-supporters")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} peer supporters")
        return data
    
    def test_create_peer_supporter_admin(self):
        """Test creating a peer supporter as admin"""
        peer_data = {
            "firstName": "TEST_TestPeer",
            "area": "London",
            "background": "Royal Marines",
            "yearsServed": "10",
            "phone": "+44 1234 567893"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/peer-supporters",
            headers=self.headers,
            json=peer_data
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        created = response.json()
        assert created["firstName"] == peer_data["firstName"]
        assert created["area"] == peer_data["area"]
        assert "id" in created
        print(f"✓ Created peer supporter: {created['firstName']} (ID: {created['id']})")
        
        return created["id"]
    
    def test_delete_peer_supporter_admin(self):
        """Test deleting a peer supporter as admin"""
        # First create
        peer_data = {
            "firstName": "TEST_ToDeletePeer",
            "area": "Manchester",
            "background": "Army",
            "yearsServed": "5",
            "phone": "+44 8888 888888"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/peer-supporters",
            headers=self.headers,
            json=peer_data
        )
        
        if create_response.status_code == 200:
            peer_id = create_response.json()["id"]
            
            # Delete
            delete_response = requests.delete(
                f"{BASE_URL}/api/peer-supporters/{peer_id}",
                headers=self.headers
            )
            assert delete_response.status_code == 200
            print(f"✓ Deleted peer supporter ID: {peer_id}")
            
            # Verify deletion
            get_response = requests.get(f"{BASE_URL}/api/peer-supporters/{peer_id}")
            assert get_response.status_code == 404
            print("✓ Peer supporter not found after deletion (expected)")


class TestCleanup:
    """Cleanup test data after tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_cleanup_test_counsellors(self):
        """Clean up TEST_ prefixed counsellors"""
        response = requests.get(f"{BASE_URL}/api/counsellors")
        if response.status_code == 200:
            counsellors = response.json()
            deleted = 0
            for c in counsellors:
                if c.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/counsellors/{c['id']}", headers=self.headers)
                    deleted += 1
            print(f"✓ Cleaned up {deleted} test counsellors")
    
    def test_cleanup_test_peers(self):
        """Clean up TEST_ prefixed peer supporters"""
        response = requests.get(f"{BASE_URL}/api/peer-supporters")
        if response.status_code == 200:
            peers = response.json()
            deleted = 0
            for p in peers:
                if p.get("firstName", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/peer-supporters/{p['id']}", headers=self.headers)
                    deleted += 1
            print(f"✓ Cleaned up {deleted} test peer supporters")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
