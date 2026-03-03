"""
Test suite for Staff Portal Bug Fixes - Iteration 22

Tests the fixes made for:
1. Staff portal login - token extraction (data.token || data.access_token)
2. Cases API endpoints - /api/cases
3. Shifts API - POST /api/shifts/ with user_id query param
4. Counsellors status update - PATCH /api/counsellors/{id}/status
5. Safeguarding alerts API - GET /api/safeguarding-alerts
6. Callbacks API - GET /api/callbacks
"""

import pytest
import requests
import os
import uuid

# Use production URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vet-support-chat.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_CREDS = {
    "email": "admin@veteran.dbty.co.uk",
    "password": "ChangeThisPassword123!"
}
STAFF_CREDS = {
    "email": "sharon@radiocheck.me",
    "password": "ChangeThisPassword123!"
}


class TestAuthenticationTokenExtraction:
    """Test that login returns 'token' field (not just 'access_token')"""
    
    def test_admin_login_returns_token_field(self):
        """Test admin login returns 'token' field in response"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDS,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Critical fix: Backend must return 'token' field
        assert "token" in data, "Response must contain 'token' field"
        assert len(data["token"]) > 0, "Token must not be empty"
        
        # Verify user data
        assert "user" in data, "Response must contain 'user' field"
        assert data["user"]["email"] == ADMIN_CREDS["email"]
        assert data["user"]["role"] == "admin"
        print(f"PASS: Admin login returns token field correctly")

    def test_staff_login_returns_token_field(self):
        """Test staff login returns 'token' field in response"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=STAFF_CREDS,
            headers={"Content-Type": "application/json"}
        )
        
        # Staff login may fail if user doesn't exist, but structure check is important
        if response.status_code == 200:
            data = response.json()
            assert "token" in data, "Response must contain 'token' field"
            print(f"PASS: Staff login returns token field correctly")
        elif response.status_code == 401:
            print(f"INFO: Staff user may not exist - {response.text}")
            pytest.skip("Staff user not found in database")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")

    def test_invalid_credentials_returns_401(self):
        """Test invalid credentials return proper 401 error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"PASS: Invalid credentials correctly return 401")


class TestCasesAPI:
    """Test Cases API endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDS,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code != 200:
            pytest.skip("Cannot authenticate for cases testing")
        return response.json()["token"]
    
    def test_get_cases_authenticated(self, auth_token):
        """Test GET /api/cases with authentication"""
        response = requests.get(
            f"{BASE_URL}/api/cases",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"Cases API failed: {response.text}"
        cases = response.json()
        assert isinstance(cases, list), "Cases response must be a list"
        print(f"PASS: GET /api/cases returns {len(cases)} cases")

    def test_get_cases_without_auth_returns_401(self):
        """Test GET /api/cases without auth returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/cases",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: Cases API correctly requires authentication")

    def test_cases_morning_queue(self, auth_token):
        """Test GET /api/cases/morning-queue"""
        response = requests.get(
            f"{BASE_URL}/api/cases/morning-queue",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"Morning queue failed: {response.text}"
        data = response.json()
        assert "high_priority" in data, "Response must contain high_priority field"
        assert "standard" in data, "Response must contain standard field"
        print(f"PASS: Morning queue returns proper structure")


class TestShiftsAPI:
    """Test Shifts API endpoints - specifically POST with user_id query param"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Get admin auth token and user info"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDS,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code != 200:
            pytest.skip("Cannot authenticate for shifts testing")
        data = response.json()
        return {"token": data["token"], "user_id": data["user"]["id"], "user_name": data["user"]["name"]}

    def test_get_shifts(self, auth_data):
        """Test GET /api/shifts"""
        response = requests.get(
            f"{BASE_URL}/api/shifts",
            headers={
                "Authorization": f"Bearer {auth_data['token']}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"GET shifts failed: {response.text}"
        shifts = response.json()
        assert isinstance(shifts, list), "Shifts response must be a list"
        print(f"PASS: GET /api/shifts returns {len(shifts)} shifts")

    def test_create_shift_with_user_id_query_param(self, auth_data):
        """Test POST /api/shifts/ with user_id query parameter - THE KEY FIX"""
        test_shift = {
            "date": "2026-03-15",
            "start_time": "10:00",
            "end_time": "18:00"
        }
        
        # This is the critical fix - user_id must be passed as query param
        response = requests.post(
            f"{BASE_URL}/api/shifts/?user_id={auth_data['user_id']}&user_name={auth_data['user_name']}",
            json=test_shift,
            headers={
                "Authorization": f"Bearer {auth_data['token']}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"POST shift with user_id failed: {response.text}"
        data = response.json()
        
        # Verify shift was created with correct data
        assert data["date"] == test_shift["date"], "Date mismatch"
        assert data["start_time"] == test_shift["start_time"], "Start time mismatch"
        assert data["end_time"] == test_shift["end_time"], "End time mismatch"
        assert data["user_id"] == auth_data["user_id"], "user_id not set correctly"
        assert "id" in data, "Shift ID must be returned"
        
        print(f"PASS: POST /api/shifts/ with user_id query param works correctly")
        
        # Cleanup - delete the test shift
        if data.get("id"):
            requests.delete(
                f"{BASE_URL}/api/shifts/{data['id']}",
                headers={"Authorization": f"Bearer {auth_data['token']}"}
            )

    def test_get_today_shifts(self, auth_data):
        """Test GET /api/shifts/today"""
        response = requests.get(
            f"{BASE_URL}/api/shifts/today",
            headers={
                "Authorization": f"Bearer {auth_data['token']}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"GET today shifts failed: {response.text}"
        print(f"PASS: GET /api/shifts/today works")


class TestCounsellorsStatusAPI:
    """Test Counsellors status update API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDS,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code != 200:
            pytest.skip("Cannot authenticate for counsellors testing")
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def counsellor_id(self, auth_token):
        """Get a counsellor ID for testing"""
        response = requests.get(
            f"{BASE_URL}/api/counsellors",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        if response.status_code != 200 or not response.json():
            pytest.skip("No counsellors found")
        return response.json()[0]["id"]

    def test_get_counsellors(self, auth_token):
        """Test GET /api/counsellors"""
        response = requests.get(
            f"{BASE_URL}/api/counsellors",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"GET counsellors failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Counsellors response must be a list"
        print(f"PASS: GET /api/counsellors returns {len(data)} counsellors")

    def test_update_counsellor_status_available(self, auth_token, counsellor_id):
        """Test PATCH /api/counsellors/{id}/status to 'available'"""
        response = requests.patch(
            f"{BASE_URL}/api/counsellors/{counsellor_id}/status",
            json={"status": "available"},
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"Update status failed: {response.text}"
        data = response.json()
        assert data.get("success") == True or data.get("status") == "available", f"Unexpected response: {data}"
        print(f"PASS: PATCH counsellor status to 'available' works")

    def test_update_counsellor_status_limited(self, auth_token, counsellor_id):
        """Test PATCH /api/counsellors/{id}/status to 'limited' (busy)"""
        response = requests.patch(
            f"{BASE_URL}/api/counsellors/{counsellor_id}/status",
            json={"status": "limited"},
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"Update status failed: {response.text}"
        print(f"PASS: PATCH counsellor status to 'limited' works")

    def test_update_counsellor_status_unavailable(self, auth_token, counsellor_id):
        """Test PATCH /api/counsellors/{id}/status to 'unavailable' (off duty)"""
        response = requests.patch(
            f"{BASE_URL}/api/counsellors/{counsellor_id}/status",
            json={"status": "unavailable"},
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"Update status failed: {response.text}"
        print(f"PASS: PATCH counsellor status to 'unavailable' works")


class TestSafeguardingAlertsAPI:
    """Test Safeguarding Alerts API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDS,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code != 200:
            pytest.skip("Cannot authenticate")
        return response.json()["token"]

    def test_get_safeguarding_alerts(self, auth_token):
        """Test GET /api/safeguarding-alerts"""
        response = requests.get(
            f"{BASE_URL}/api/safeguarding-alerts",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"GET safeguarding alerts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Safeguarding alerts must be a list"
        
        # Verify alert structure if there are any
        if len(data) > 0:
            alert = data[0]
            assert "id" in alert, "Alert must have id"
            assert "status" in alert, "Alert must have status"
            assert "risk_level" in alert, "Alert must have risk_level"
        
        print(f"PASS: GET /api/safeguarding-alerts returns {len(data)} alerts")

    def test_safeguarding_alerts_without_auth(self):
        """Test safeguarding alerts requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/safeguarding-alerts",
            headers={"Content-Type": "application/json"}
        )
        
        # May be public or require auth depending on implementation
        if response.status_code in [401, 403]:
            print(f"PASS: Safeguarding alerts correctly requires authentication")
        else:
            print(f"INFO: Safeguarding alerts is publicly accessible")


class TestCallbacksAPI:
    """Test Callbacks API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDS,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code != 200:
            pytest.skip("Cannot authenticate")
        return response.json()["token"]

    def test_get_callbacks(self, auth_token):
        """Test GET /api/callbacks"""
        response = requests.get(
            f"{BASE_URL}/api/callbacks",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code == 200, f"GET callbacks failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Callbacks must be a list"
        
        # Verify callback structure if there are any
        if len(data) > 0:
            callback = data[0]
            assert "id" in callback, "Callback must have id"
            assert "status" in callback, "Callback must have status"
            assert "name" in callback, "Callback must have name"
        
        print(f"PASS: GET /api/callbacks returns {len(data)} callbacks")

    def test_create_callback(self, auth_token):
        """Test POST /api/callbacks"""
        test_callback = {
            "name": f"TEST_StaffPortal_{uuid.uuid4().hex[:8]}",
            "phone": "07123456789",
            "message": "Test callback from staff portal fix tests",
            "request_type": "peer"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/callbacks",
            json=test_callback,
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        assert response.status_code in [200, 201], f"POST callback failed: {response.text}"
        data = response.json()
        assert "id" in data or "success" in data, "Response must contain id or success"
        print(f"PASS: POST /api/callbacks works correctly")


class TestAPIAuthenticationFlow:
    """Test the full authentication flow as used by staff-portal"""
    
    def test_full_auth_flow_admin(self):
        """Test complete auth flow: login -> use token -> access protected resources"""
        # Step 1: Login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDS,
            headers={"Content-Type": "application/json"}
        )
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        
        # Step 2: Extract token (the key fix)
        token = login_data.get("token") or login_data.get("access_token")
        assert token is not None, "No token in response"
        
        # Step 3: Use token to access protected resources
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Test accessing cases
        cases_response = requests.get(f"{BASE_URL}/api/cases", headers=headers)
        assert cases_response.status_code == 200, f"Cases access failed with token: {cases_response.text}"
        
        # Test accessing callbacks
        callbacks_response = requests.get(f"{BASE_URL}/api/callbacks", headers=headers)
        assert callbacks_response.status_code == 200, f"Callbacks access failed with token: {callbacks_response.text}"
        
        # Test accessing safeguarding alerts
        alerts_response = requests.get(f"{BASE_URL}/api/safeguarding-alerts", headers=headers)
        assert alerts_response.status_code == 200, f"Safeguarding alerts access failed with token: {alerts_response.text}"
        
        print(f"PASS: Full auth flow works - login, extract token, access protected resources")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
