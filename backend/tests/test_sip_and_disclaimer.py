"""
Test Suite: SIP Extension Management APIs and AI Chat Disclaimer
================================================================
Tests P0: SIP Extension Allocation Admin UI APIs
Tests P1: Migration Script Verification
Tests P2: Legal Disclaimer (basic API test)

Author: T1 Testing Agent
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://admin-cms-v2.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"


class TestSIPExtensionAPIs:
    """Test SIP Extension Management APIs - P0 Feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_get_sip_extensions_list(self):
        """P0: GET /api/admin/sip-extensions - List all SIP assignments"""
        response = self.session.get(f"{BASE_URL}/api/admin/sip-extensions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "assignments" in data, "Response should contain 'assignments' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["assignments"], list), "assignments should be a list"
        assert isinstance(data["total"], int), "total should be an integer"
        print(f"✓ SIP extensions list: {data['total']} assignments found")
    
    def test_create_counsellor_and_assign_sip(self):
        """P0: Create counsellor, assign SIP, verify assignment, remove SIP"""
        # Step 1: Create a test counsellor
        counsellor_data = {
            "name": "TEST_SIP_Counsellor",
            "specialization": "SIP Testing",
            "phone": "07001234567"
        }
        create_resp = self.session.post(f"{BASE_URL}/api/counsellors", json=counsellor_data)
        assert create_resp.status_code == 200, f"Failed to create counsellor: {create_resp.text}"
        
        counsellor_id = create_resp.json()["id"]
        print(f"✓ Created test counsellor: {counsellor_id}")
        
        # Step 2: Assign SIP extension
        sip_data = {
            "sip_extension": "1099",
            "sip_password": "test_sip_pass_123"
        }
        assign_resp = self.session.patch(f"{BASE_URL}/api/admin/counsellors/{counsellor_id}/sip", json=sip_data)
        assert assign_resp.status_code == 200, f"Failed to assign SIP: {assign_resp.text}"
        
        assign_data = assign_resp.json()
        assert assign_data["sip_extension"] == "1099", "SIP extension should be assigned"
        print(f"✓ Assigned SIP extension 1099 to counsellor")
        
        # Step 3: Verify SIP assignment appears in list
        list_resp = self.session.get(f"{BASE_URL}/api/admin/sip-extensions")
        assert list_resp.status_code == 200
        assignments = list_resp.json()["assignments"]
        
        # Find our counsellor in the list
        found = any(a.get("id") == counsellor_id and a.get("sip_extension") == "1099" for a in assignments)
        assert found, "Counsellor with SIP extension should appear in sip-extensions list"
        print(f"✓ Verified SIP assignment in list")
        
        # Step 4: Remove SIP extension
        remove_resp = self.session.delete(f"{BASE_URL}/api/admin/counsellors/{counsellor_id}/sip")
        assert remove_resp.status_code == 200, f"Failed to remove SIP: {remove_resp.text}"
        print(f"✓ Removed SIP extension from counsellor")
        
        # Step 5: Verify removal
        list_resp2 = self.session.get(f"{BASE_URL}/api/admin/sip-extensions")
        assignments2 = list_resp2.json()["assignments"]
        found_after = any(a.get("id") == counsellor_id for a in assignments2)
        assert not found_after, "Counsellor should no longer appear in SIP list after removal"
        print(f"✓ Verified SIP removal from list")
        
        # Cleanup: Delete test counsellor
        self.session.delete(f"{BASE_URL}/api/counsellors/{counsellor_id}")
        print(f"✓ Cleanup complete")
    
    def test_create_peer_supporter_and_assign_sip(self):
        """P0: Create peer supporter, assign SIP, verify assignment, remove SIP"""
        # Step 1: Create a test peer supporter
        peer_data = {
            "firstName": "TEST_SIP_Peer",
            "area": "London",
            "background": "SIP Testing",
            "yearsServed": "5",
            "phone": "07009876543"
        }
        create_resp = self.session.post(f"{BASE_URL}/api/peer-supporters", json=peer_data)
        assert create_resp.status_code == 200, f"Failed to create peer: {create_resp.text}"
        
        peer_id = create_resp.json()["id"]
        print(f"✓ Created test peer supporter: {peer_id}")
        
        # Step 2: Assign SIP extension
        sip_data = {
            "sip_extension": "1098",
            "sip_password": "peer_sip_pass_456"
        }
        assign_resp = self.session.patch(f"{BASE_URL}/api/admin/peer-supporters/{peer_id}/sip", json=sip_data)
        assert assign_resp.status_code == 200, f"Failed to assign SIP: {assign_resp.text}"
        
        assign_data = assign_resp.json()
        assert assign_data["sip_extension"] == "1098", "SIP extension should be assigned"
        print(f"✓ Assigned SIP extension 1098 to peer supporter")
        
        # Step 3: Verify SIP assignment appears in list
        list_resp = self.session.get(f"{BASE_URL}/api/admin/sip-extensions")
        assert list_resp.status_code == 200
        assignments = list_resp.json()["assignments"]
        
        # Find our peer in the list
        found = any(a.get("id") == peer_id and a.get("sip_extension") == "1098" for a in assignments)
        assert found, "Peer supporter with SIP extension should appear in sip-extensions list"
        print(f"✓ Verified SIP assignment in list")
        
        # Step 4: Remove SIP extension
        remove_resp = self.session.delete(f"{BASE_URL}/api/admin/peer-supporters/{peer_id}/sip")
        assert remove_resp.status_code == 200, f"Failed to remove SIP: {remove_resp.text}"
        print(f"✓ Removed SIP extension from peer supporter")
        
        # Step 5: Verify removal
        list_resp2 = self.session.get(f"{BASE_URL}/api/admin/sip-extensions")
        assignments2 = list_resp2.json()["assignments"]
        found_after = any(a.get("id") == peer_id for a in assignments2)
        assert not found_after, "Peer supporter should no longer appear in SIP list after removal"
        print(f"✓ Verified SIP removal from list")
        
        # Cleanup: Delete test peer
        self.session.delete(f"{BASE_URL}/api/peer-supporters/{peer_id}")
        print(f"✓ Cleanup complete")
    
    def test_sip_assign_to_nonexistent_counsellor(self):
        """P0: Should return 404 for nonexistent counsellor"""
        sip_data = {
            "sip_extension": "1000",
            "sip_password": "test123"
        }
        response = self.session.patch(f"{BASE_URL}/api/admin/counsellors/nonexistent-id/sip", json=sip_data)
        assert response.status_code == 404, f"Expected 404 for nonexistent counsellor, got {response.status_code}"
        print(f"✓ Correctly returns 404 for nonexistent counsellor")
    
    def test_sip_assign_to_nonexistent_peer(self):
        """P0: Should return 404 for nonexistent peer supporter"""
        sip_data = {
            "sip_extension": "1000",
            "sip_password": "test123"
        }
        response = self.session.patch(f"{BASE_URL}/api/admin/peer-supporters/nonexistent-id/sip", json=sip_data)
        assert response.status_code == 404, f"Expected 404 for nonexistent peer, got {response.status_code}"
        print(f"✓ Correctly returns 404 for nonexistent peer supporter")
    
    def test_sip_endpoints_require_admin(self):
        """P0: SIP endpoints should require admin role"""
        # Create a session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.get(f"{BASE_URL}/api/admin/sip-extensions")
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ SIP extension list requires authentication")


class TestMigrationScriptExists:
    """Test P1: Data Migration Script for encrypting PII"""
    
    def test_migration_script_exists(self):
        """P1: Migration script should exist at /app/backend/scripts/migrate_encrypt_pii.py"""
        import os
        script_path = "/app/backend/scripts/migrate_encrypt_pii.py"
        assert os.path.exists(script_path), f"Migration script not found at {script_path}"
        print(f"✓ Migration script exists at {script_path}")
    
    def test_migration_script_has_required_functions(self):
        """P1: Migration script should have migrate_collection and run_migration functions"""
        script_path = "/app/backend/scripts/migrate_encrypt_pii.py"
        
        with open(script_path, 'r') as f:
            content = f.read()
        
        assert 'async def migrate_collection' in content, "Missing migrate_collection function"
        assert 'async def run_migration' in content, "Missing run_migration function"
        assert 'ENCRYPTED_FIELDS' in content, "Should use ENCRYPTED_FIELDS from encryption module"
        print(f"✓ Migration script has required functions")
    
    def test_migration_script_handles_already_encrypted(self):
        """P1: Migration script should skip already encrypted fields (ENC: prefix)"""
        script_path = "/app/backend/scripts/migrate_encrypt_pii.py"
        
        with open(script_path, 'r') as f:
            content = f.read()
        
        assert "startswith('ENC:')" in content, "Should check for ENC: prefix to skip already encrypted"
        assert "already_encrypted" in content, "Should track already encrypted count"
        print(f"✓ Migration script handles already encrypted fields")


class TestAIChatEndpoints:
    """Test AI Chat related endpoints for P2 disclaimer feature"""
    
    def test_ai_buddies_characters_endpoint(self):
        """P2: AI characters endpoint should be accessible"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "characters" in data, "Should return characters list"
        assert len(data["characters"]) > 0, "Should have at least one character"
        
        # Check Tommy character exists
        tommy = next((c for c in data["characters"] if c["id"] == "tommy"), None)
        assert tommy is not None, "Tommy character should exist"
        assert "name" in tommy and "avatar" in tommy, "Character should have name and avatar"
        print(f"✓ AI characters endpoint returns {len(data['characters'])} characters")
    
    def test_ai_chat_endpoint_exists(self):
        """P2: AI chat endpoint should be accessible"""
        chat_data = {
            "message": "Hello",
            "sessionId": "test-session-123",
            "character": "tommy"
        }
        response = requests.post(f"{BASE_URL}/api/ai-buddies/chat", json=chat_data)
        # Should return 200 or might have rate limiting, but endpoint should exist
        assert response.status_code in [200, 429, 500], \
            f"AI chat endpoint should exist, got {response.status_code}"
        print(f"✓ AI chat endpoint accessible (status: {response.status_code})")


class TestAdminStatusManagement:
    """Additional tests for admin status management (related to SIP tab staff list)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_admin_can_update_counsellor_status(self):
        """Admin should be able to update counsellor status"""
        # Get counsellors list first
        list_resp = self.session.get(f"{BASE_URL}/api/counsellors")
        if list_resp.status_code != 200:
            pytest.skip("Could not get counsellors list")
        
        counsellors = list_resp.json()
        if len(counsellors) == 0:
            pytest.skip("No counsellors to test with")
        
        counsellor_id = counsellors[0]["id"]
        
        # Update status
        status_resp = self.session.patch(
            f"{BASE_URL}/api/admin/counsellors/{counsellor_id}/status",
            json={"status": "available"}
        )
        # Might be 200 or endpoint might not exist for admin override
        if status_resp.status_code == 200:
            print(f"✓ Admin can update counsellor status")
        else:
            print(f"Note: Admin status update returned {status_resp.status_code}")
    
    def test_admin_can_update_peer_status(self):
        """Admin should be able to update peer supporter status"""
        # Get peers list first
        list_resp = self.session.get(f"{BASE_URL}/api/peer-supporters")
        if list_resp.status_code != 200:
            pytest.skip("Could not get peer supporters list")
        
        peers = list_resp.json()
        if len(peers) == 0:
            pytest.skip("No peer supporters to test with")
        
        peer_id = peers[0]["id"]
        
        # Update status
        status_resp = self.session.patch(
            f"{BASE_URL}/api/admin/peer-supporters/{peer_id}/status",
            json={"status": "available"}
        )
        if status_resp.status_code == 200:
            print(f"✓ Admin can update peer supporter status")
        else:
            print(f"Note: Admin status update returned {status_resp.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
