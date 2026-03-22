"""
Backend tests for Callback Request and Panic Alert features
- Callback endpoints: POST /api/callbacks, GET /api/callbacks, PATCH /api/callbacks/{id}/take|release|complete
- Panic Alert endpoints: POST /api/panic-alert, GET /api/panic-alerts, PATCH /api/panic-alerts/{id}/acknowledge|resolve
- Admin status management: PATCH /api/admin/counsellors/{id}/status, PATCH /api/admin/peer-supporters/{id}/status
"""

import pytest
import requests
import os
import uuid

# Use environment variable or default to the preview URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://staff-portal-batch2.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"


class TestAPIHealth:
    """Basic API health checks"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root endpoint working: {data['message']}")


class TestAuth:
    """Authentication tests"""
    
    def test_admin_login_success(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}")
    
    def test_invalid_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")


class TestCallbackRequests:
    """Callback Request endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            self.user = response.json()["user"]
        else:
            pytest.skip("Authentication failed")
    
    def test_create_callback_counsellor(self):
        """POST /api/callbacks - Create callback request for counsellor"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_Callback_{unique_id}",
            "phone": "07123456789",
            "email": f"test_{unique_id}@example.com",
            "message": "Need counsellor support",
            "request_type": "counsellor"
        }
        response = requests.post(f"{BASE_URL}/api/callbacks", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "message" in data
        print(f"✓ Callback request created: {data['id']}")
        return data["id"]
    
    def test_create_callback_peer(self):
        """POST /api/callbacks - Create callback request for peer"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_Peer_Callback_{unique_id}",
            "phone": "07987654321",
            "message": "Want to talk to fellow veteran",
            "request_type": "peer"
        }
        response = requests.post(f"{BASE_URL}/api/callbacks", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        print(f"✓ Peer callback request created: {data['id']}")
    
    def test_create_callback_invalid_type(self):
        """POST /api/callbacks - Should reject invalid request_type"""
        payload = {
            "name": "Test",
            "phone": "07123456789",
            "message": "Test message",
            "request_type": "invalid"  # Invalid type
        }
        response = requests.post(f"{BASE_URL}/api/callbacks", json=payload)
        assert response.status_code == 422  # Validation error
        print("✓ Invalid callback type correctly rejected")
    
    def test_get_callbacks_requires_auth(self):
        """GET /api/callbacks - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/callbacks")
        assert response.status_code in [401, 403]
        print("✓ GET callbacks requires authentication")
    
    def test_get_callbacks_authenticated(self):
        """GET /api/callbacks - Admin can get all callbacks"""
        response = requests.get(f"{BASE_URL}/api/callbacks", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} callback requests")
    
    def test_callback_take_control(self):
        """PATCH /api/callbacks/{id}/take - Take control of callback"""
        # First create a callback
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(f"{BASE_URL}/api/callbacks", json={
            "name": f"TEST_TakeControl_{unique_id}",
            "phone": "07111111111",
            "message": "Test take control",
            "request_type": "counsellor"
        })
        assert create_response.status_code == 200
        callback_id = create_response.json()["id"]
        
        # Take control
        response = requests.patch(f"{BASE_URL}/api/callbacks/{callback_id}/take", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Take control working: {data['message']}")
        
        return callback_id
    
    def test_callback_release(self):
        """PATCH /api/callbacks/{id}/release - Release callback back to pool"""
        # Create and take control first
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(f"{BASE_URL}/api/callbacks", json={
            "name": f"TEST_Release_{unique_id}",
            "phone": "07222222222",
            "message": "Test release",
            "request_type": "counsellor"
        })
        callback_id = create_response.json()["id"]
        
        # Take control
        requests.patch(f"{BASE_URL}/api/callbacks/{callback_id}/take", headers=self.headers)
        
        # Release
        response = requests.patch(f"{BASE_URL}/api/callbacks/{callback_id}/release", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Release callback working: {data['message']}")
    
    def test_callback_complete(self):
        """PATCH /api/callbacks/{id}/complete - Mark callback as completed"""
        # Create and take control first
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(f"{BASE_URL}/api/callbacks", json={
            "name": f"TEST_Complete_{unique_id}",
            "phone": "07333333333",
            "message": "Test complete",
            "request_type": "peer"
        })
        callback_id = create_response.json()["id"]
        
        # Take control
        requests.patch(f"{BASE_URL}/api/callbacks/{callback_id}/take", headers=self.headers)
        
        # Complete
        response = requests.patch(f"{BASE_URL}/api/callbacks/{callback_id}/complete", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Complete callback working: {data['message']}")


class TestPanicAlerts:
    """Panic Alert endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_create_panic_alert(self):
        """POST /api/panic-alert - Create panic alert"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "user_name": f"TEST_Alert_{unique_id}",
            "user_phone": "07444444444",
            "message": "Test panic alert"
        }
        response = requests.post(f"{BASE_URL}/api/panic-alert", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "message" in data
        assert "crisis_numbers" in data
        print(f"✓ Panic alert created: {data['id']}")
        return data["id"]
    
    def test_create_panic_alert_anonymous(self):
        """POST /api/panic-alert - Can create anonymous alert"""
        response = requests.post(f"{BASE_URL}/api/panic-alert", json={})
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        print("✓ Anonymous panic alert works")
    
    def test_get_panic_alerts_requires_auth(self):
        """GET /api/panic-alerts - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/panic-alerts")
        assert response.status_code in [401, 403]
        print("✓ GET panic alerts requires authentication")
    
    def test_get_panic_alerts_authenticated(self):
        """GET /api/panic-alerts - Admin/Counsellor can view alerts"""
        response = requests.get(f"{BASE_URL}/api/panic-alerts", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} panic alerts")
    
    def test_acknowledge_panic_alert(self):
        """PATCH /api/panic-alerts/{id}/acknowledge - Acknowledge alert"""
        # Create alert first
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(f"{BASE_URL}/api/panic-alert", json={
            "user_name": f"TEST_Ack_{unique_id}",
            "message": "Test acknowledge"
        })
        alert_id = create_response.json()["id"]
        
        # Acknowledge
        response = requests.patch(f"{BASE_URL}/api/panic-alerts/{alert_id}/acknowledge", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Acknowledge alert working: {data['message']}")
        return alert_id
    
    def test_resolve_panic_alert(self):
        """PATCH /api/panic-alerts/{id}/resolve - Resolve alert"""
        # Create and acknowledge first
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(f"{BASE_URL}/api/panic-alert", json={
            "user_name": f"TEST_Resolve_{unique_id}",
            "message": "Test resolve"
        })
        alert_id = create_response.json()["id"]
        
        requests.patch(f"{BASE_URL}/api/panic-alerts/{alert_id}/acknowledge", headers=self.headers)
        
        # Resolve
        response = requests.patch(f"{BASE_URL}/api/panic-alerts/{alert_id}/resolve", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Resolve alert working: {data['message']}")


class TestAdminStatusManagement:
    """Admin status management for counsellors and peers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and counsellor/peer data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
        
        # Get existing counsellors
        counsellors_response = requests.get(f"{BASE_URL}/api/counsellors")
        if counsellors_response.status_code == 200:
            self.counsellors = counsellors_response.json()
        else:
            self.counsellors = []
        
        # Get existing peers
        peers_response = requests.get(f"{BASE_URL}/api/peer-supporters")
        if peers_response.status_code == 200:
            self.peers = peers_response.json()
        else:
            self.peers = []
    
    def test_admin_update_counsellor_status(self):
        """PATCH /api/admin/counsellors/{id}/status - Admin can update counsellor status"""
        if not self.counsellors:
            pytest.skip("No counsellors available to test")
        
        counsellor = self.counsellors[0]
        counsellor_id = counsellor["id"]
        
        # Update status to busy
        response = requests.patch(
            f"{BASE_URL}/api/admin/counsellors/{counsellor_id}/status",
            headers=self.headers,
            json={"status": "busy"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "busy"
        print(f"✓ Admin updated counsellor status to busy")
        
        # Update back to original
        original_status = counsellor.get("status", "off")
        requests.patch(
            f"{BASE_URL}/api/admin/counsellors/{counsellor_id}/status",
            headers=self.headers,
            json={"status": original_status}
        )
    
    def test_admin_update_peer_status(self):
        """PATCH /api/admin/peer-supporters/{id}/status - Admin can update peer status"""
        if not self.peers:
            pytest.skip("No peer supporters available to test")
        
        peer = self.peers[0]
        peer_id = peer["id"]
        
        # Update status to limited
        response = requests.patch(
            f"{BASE_URL}/api/admin/peer-supporters/{peer_id}/status",
            headers=self.headers,
            json={"status": "limited"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "limited"
        print(f"✓ Admin updated peer status to limited")
        
        # Update back to original
        original_status = peer.get("status", "unavailable")
        requests.patch(
            f"{BASE_URL}/api/admin/peer-supporters/{peer_id}/status",
            headers=self.headers,
            json={"status": original_status}
        )
    
    def test_admin_status_requires_auth(self):
        """Admin status endpoints require authentication"""
        if not self.counsellors:
            pytest.skip("No counsellors available")
        
        counsellor_id = self.counsellors[0]["id"]
        response = requests.patch(
            f"{BASE_URL}/api/admin/counsellors/{counsellor_id}/status",
            json={"status": "busy"}
        )
        assert response.status_code in [401, 403]
        print("✓ Admin status update requires authentication")
    
    def test_admin_status_invalid_status(self):
        """Admin status endpoints validate status value"""
        if not self.counsellors:
            pytest.skip("No counsellors available")
        
        counsellor_id = self.counsellors[0]["id"]
        response = requests.patch(
            f"{BASE_URL}/api/admin/counsellors/{counsellor_id}/status",
            headers=self.headers,
            json={"status": "invalid_status"}
        )
        assert response.status_code == 422  # Validation error
        print("✓ Invalid status value correctly rejected")


class TestCounsellorEndpoints:
    """Existing counsellor endpoint tests"""
    
    def test_get_counsellors(self):
        """GET /api/counsellors - Get all counsellors"""
        response = requests.get(f"{BASE_URL}/api/counsellors")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} counsellors")
    
    def test_get_available_counsellors(self):
        """GET /api/counsellors/available - Get available counsellors"""
        response = requests.get(f"{BASE_URL}/api/counsellors/available")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for c in data:
            assert c["status"] == "available"
        print(f"✓ Got {len(data)} available counsellors")


class TestPeerSupporterEndpoints:
    """Peer supporter endpoint tests"""
    
    def test_get_peer_supporters(self):
        """GET /api/peer-supporters - Get all peer supporters"""
        response = requests.get(f"{BASE_URL}/api/peer-supporters")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} peer supporters")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
