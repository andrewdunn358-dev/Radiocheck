"""
Backend API tests for Shifts/Availability feature
Tests CRUD operations for shift management calendar
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://staff-portal-batch2.preview.emergentagent.com').rstrip('/')

# Test credentials
STAFF_USER = {
    "email": "sarahm.counsellor@radiocheck.me",
    "password": "RadioCheck2026!"
}

ADMIN_USER = {
    "email": "admin@veteran.dbty.co.uk",
    "password": "ChangeThisPassword123!"
}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def staff_auth_token(api_client):
    """Get authentication token for staff user"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json=STAFF_USER
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Staff authentication failed - status {response.status_code}")


@pytest.fixture(scope="module")
def admin_auth_token(api_client):
    """Get authentication token for admin user"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json=ADMIN_USER
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin authentication failed - status {response.status_code}")


class TestShiftsGetEndpoint:
    """Tests for GET /api/shifts endpoint - Public access"""
    
    def test_get_shifts_returns_list(self, api_client):
        """GET /api/shifts should return a list of shifts"""
        response = api_client.get(f"{BASE_URL}/api/shifts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
    
    def test_get_shifts_with_date_filter(self, api_client):
        """GET /api/shifts with date_from and date_to filters"""
        response = api_client.get(
            f"{BASE_URL}/api/shifts?date_from=2026-02-01&date_to=2026-02-28"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Each shift should have required fields
        for shift in data:
            assert "id" in shift
            assert "date" in shift
            assert "start_time" in shift
            assert "end_time" in shift
            assert "staff_id" in shift


class TestShiftsPostEndpoint:
    """Tests for POST /api/shifts endpoint - Requires auth"""
    
    def test_post_shift_without_auth_returns_401(self, api_client):
        """POST /api/shifts without auth should return 401"""
        response = api_client.post(
            f"{BASE_URL}/api/shifts",
            json={
                "date": "2026-03-01",
                "start_time": "09:00",
                "end_time": "17:00"
            }
        )
        
        assert response.status_code in [401, 403], \
            f"Expected 401/403, got {response.status_code}"
    
    def test_post_shift_with_auth_creates_shift(self, api_client, staff_auth_token):
        """POST /api/shifts with valid auth should create a shift"""
        response = api_client.post(
            f"{BASE_URL}/api/shifts",
            headers={"Authorization": f"Bearer {staff_auth_token}"},
            json={
                "date": "2026-03-15",
                "start_time": "10:00",
                "end_time": "18:00"
            }
        )
        
        assert response.status_code in [200, 201], \
            f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "shift" in data
        
        shift = data["shift"]
        assert shift["date"] == "2026-03-15"
        assert shift["start_time"] == "10:00"
        assert shift["end_time"] == "18:00"
        assert "id" in shift
        assert "staff_id" in shift
        assert "staff_name" in shift


class TestShiftsDeleteEndpoint:
    """Tests for DELETE /api/shifts/{id} endpoint - Requires auth"""
    
    def test_delete_shift_without_auth_returns_401(self, api_client):
        """DELETE /api/shifts/{id} without auth should return 401"""
        # First, get an existing shift ID
        get_response = api_client.get(f"{BASE_URL}/api/shifts")
        shifts = get_response.json()
        
        if not shifts:
            pytest.skip("No shifts to test delete")
        
        shift_id = shifts[0]["id"]
        response = api_client.delete(f"{BASE_URL}/api/shifts/{shift_id}")
        
        assert response.status_code in [401, 403], \
            f"Expected 401/403, got {response.status_code}"
    
    def test_delete_own_shift_succeeds(self, api_client, staff_auth_token):
        """DELETE /api/shifts/{id} should delete own shift"""
        # First create a shift to delete
        create_response = api_client.post(
            f"{BASE_URL}/api/shifts",
            headers={"Authorization": f"Bearer {staff_auth_token}"},
            json={
                "date": "2026-03-20",
                "start_time": "08:00",
                "end_time": "12:00"
            }
        )
        
        assert create_response.status_code in [200, 201]
        shift_id = create_response.json()["shift"]["id"]
        
        # Now delete it
        delete_response = api_client.delete(
            f"{BASE_URL}/api/shifts/{shift_id}",
            headers={"Authorization": f"Bearer {staff_auth_token}"}
        )
        
        assert delete_response.status_code == 200, \
            f"Expected 200, got {delete_response.status_code}"
        
        data = delete_response.json()
        assert data.get("success") == True
        
        # Verify deletion by trying to get all shifts
        get_response = api_client.get(f"{BASE_URL}/api/shifts")
        shifts = get_response.json()
        deleted_shift = [s for s in shifts if s["id"] == shift_id]
        assert len(deleted_shift) == 0, "Shift should be deleted"


class TestShiftsTodayEndpoint:
    """Tests for GET /api/shifts/today endpoint"""
    
    def test_get_todays_shifts(self, api_client):
        """GET /api/shifts/today should return today's shifts"""
        response = api_client.get(f"{BASE_URL}/api/shifts/today")
        
        assert response.status_code == 200
        data = response.json()
        assert "shifts" in data
        assert "someone_on_net" in data
        assert isinstance(data["shifts"], list)
        assert isinstance(data["someone_on_net"], bool)


class TestExistingTestShift:
    """Verify the test shift created by main agent exists"""
    
    def test_february_25_shift_exists(self, api_client):
        """The test shift for 2026-02-25 should exist"""
        response = api_client.get(
            f"{BASE_URL}/api/shifts?date_from=2026-02-25&date_to=2026-02-25"
        )
        
        assert response.status_code == 200
        shifts = response.json()
        
        # There should be at least one shift on Feb 25
        assert len(shifts) >= 1, "Expected at least 1 shift on 2026-02-25"
        
        # Verify shift details
        shift = shifts[0]
        assert shift["date"] == "2026-02-25"
        assert shift["staff_name"] == "Sarah M."
        assert shift["start_time"] == "10:00"
        assert shift["end_time"] == "16:00"


# Cleanup fixture to remove test-created shifts
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_shifts(api_client, staff_auth_token):
    """Cleanup test-created shifts after tests complete"""
    yield
    # After tests, delete any shifts created for testing dates
    test_dates = ["2026-03-15", "2026-03-20"]
    for date in test_dates:
        response = api_client.get(
            f"{BASE_URL}/api/shifts?date_from={date}&date_to={date}"
        )
        if response.status_code == 200:
            shifts = response.json()
            for shift in shifts:
                api_client.delete(
                    f"{BASE_URL}/api/shifts/{shift['id']}",
                    headers={"Authorization": f"Bearer {staff_auth_token}"}
                )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
