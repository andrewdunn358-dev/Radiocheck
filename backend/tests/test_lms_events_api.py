"""
Tests for LMS and Events API endpoints - Radio Check app
Testing: LMS Course API, Volunteer Registration, Admin Registrations, Approve, Learners, Progress
Testing: Event Joining (time-gating removed)

Created: 2026-03-08
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

# Get base URL from environment - using preview URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://modular-safety-hub.preview.emergentagent.com').rstrip('/')


class TestLMSCourseAPI:
    """Tests for /api/lms/course endpoint"""
    
    def test_get_course_info(self):
        """GET /api/lms/course - Returns course info with modules"""
        response = requests.get(f"{BASE_URL}/api/lms/course")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify course structure
        assert "course_id" in data
        assert "title" in data
        assert "description" in data
        assert "duration_hours" in data
        assert "module_count" in data
        assert "modules" in data
        
        # Verify modules list is not empty
        assert len(data["modules"]) > 0, "Course should have modules"
        
        # Verify module structure
        first_module = data["modules"][0]
        assert "id" in first_module
        assert "title" in first_module
        assert "description" in first_module
        assert "duration_minutes" in first_module
        
        print(f"SUCCESS: Course '{data['title']}' has {data['module_count']} modules")


class TestVolunteerRegistration:
    """Tests for /api/lms/volunteer/register endpoint"""
    
    def test_register_volunteer_success(self):
        """POST /api/lms/volunteer/register - Creates registration and alert"""
        # Unique email for test
        test_email = f"TEST_volunteer_{datetime.now().strftime('%Y%m%d%H%M%S')}@test.com"
        
        registration_data = {
            "full_name": "Test Volunteer",
            "email": test_email,
            "phone": "07123456789",
            "is_veteran": True,
            "service_branch": "Army",
            "years_served": "5-10 years",
            "why_volunteer": "I want to help fellow veterans",
            "has_dbs": False,
            "agreed_to_terms": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/lms/volunteer/register",
            json=registration_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] is True
        assert "registration_id" in data
        assert "message" in data
        assert "next_steps" in data
        
        print(f"SUCCESS: Registration created with ID: {data['registration_id']}")
        return data["registration_id"]
    
    def test_register_volunteer_without_terms(self):
        """POST /api/lms/volunteer/register - Fails without agreed_to_terms"""
        registration_data = {
            "full_name": "Test Volunteer No Terms",
            "email": "noterms@test.com",
            "why_volunteer": "Testing",
            "agreed_to_terms": False  # Should fail
        }
        
        response = requests.post(
            f"{BASE_URL}/api/lms/volunteer/register",
            json=registration_data
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("SUCCESS: Registration correctly rejected without agreed terms")


class TestAdminRegistrations:
    """Tests for /api/lms/admin/registrations endpoint"""
    
    def test_get_all_registrations(self):
        """GET /api/lms/admin/registrations - Lists all registrations"""
        response = requests.get(f"{BASE_URL}/api/lms/admin/registrations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "registrations" in data
        assert isinstance(data["registrations"], list)
        
        print(f"SUCCESS: Found {len(data['registrations'])} registrations")
        return data["registrations"]
    
    def test_filter_pending_registrations(self):
        """GET /api/lms/admin/registrations?status=pending - Filter by status"""
        response = requests.get(f"{BASE_URL}/api/lms/admin/registrations?status=pending")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "registrations" in data
        
        # All returned registrations should be pending
        for reg in data["registrations"]:
            assert reg["status"] == "pending", f"Expected pending, got {reg['status']}"
        
        print(f"SUCCESS: Found {len(data['registrations'])} pending registrations")


class TestAdminApprove:
    """Tests for /api/lms/admin/registration/{id}/approve endpoint"""
    
    def test_approve_registration(self):
        """POST /api/lms/admin/registration/{id}/approve - Enrolls user"""
        # First create a registration
        test_email = f"TEST_approve_{datetime.now().strftime('%Y%m%d%H%M%S')}@test.com"
        
        registration_data = {
            "full_name": "Test Approve User",
            "email": test_email,
            "why_volunteer": "Testing approval flow",
            "agreed_to_terms": True
        }
        
        # Create registration
        reg_response = requests.post(
            f"{BASE_URL}/api/lms/volunteer/register",
            json=registration_data
        )
        assert reg_response.status_code == 200
        registration_id = reg_response.json()["registration_id"]
        
        # Approve the registration
        approve_response = requests.post(
            f"{BASE_URL}/api/lms/admin/registration/{registration_id}/approve"
        )
        
        assert approve_response.status_code == 200, f"Expected 200, got {approve_response.status_code}: {approve_response.text}"
        
        data = approve_response.json()
        assert data["success"] is True
        assert "message" in data
        
        print(f"SUCCESS: Registration approved, user enrolled: {data['message']}")
        return test_email
    
    def test_approve_invalid_registration(self):
        """POST /api/lms/admin/registration/{invalid_id}/approve - Returns 400/404"""
        response = requests.post(
            f"{BASE_URL}/api/lms/admin/registration/invalid_id_12345/approve"
        )
        
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"
        print("SUCCESS: Invalid registration ID correctly rejected")


class TestAdminLearners:
    """Tests for /api/lms/admin/learners endpoint"""
    
    def test_get_all_learners(self):
        """GET /api/lms/admin/learners - Lists enrolled learners"""
        response = requests.get(f"{BASE_URL}/api/lms/admin/learners")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "learners" in data
        assert isinstance(data["learners"], list)
        
        # Check learner structure if any exist
        if len(data["learners"]) > 0:
            learner = data["learners"][0]
            assert "email" in learner
            assert "full_name" in learner
            assert "progress" in learner or "progress_percent" in learner
        
        print(f"SUCCESS: Found {len(data['learners'])} learners")
        return data["learners"]


class TestLearnerProgress:
    """Tests for /api/lms/progress/{email} endpoint"""
    
    def test_get_progress_existing_learner(self):
        """GET /api/lms/progress/{email} - Shows learner progress"""
        # First get a learner email from admin endpoint
        learners_response = requests.get(f"{BASE_URL}/api/lms/admin/learners")
        learners = learners_response.json().get("learners", [])
        
        if not learners:
            pytest.skip("No learners in system to test progress")
        
        test_email = learners[0]["email"]
        
        response = requests.get(f"{BASE_URL}/api/lms/progress/{test_email}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "learner" in data
        assert "total_modules" in data
        assert "completed_modules" in data
        assert "progress_percent" in data
        
        print(f"SUCCESS: Learner {test_email} progress: {data['progress_percent']}%")
    
    def test_get_progress_nonexistent_learner(self):
        """GET /api/lms/progress/{email} - Returns 404 for non-existent"""
        response = requests.get(f"{BASE_URL}/api/lms/progress/nonexistent@nobody.com")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: Non-existent learner correctly returns 404")


class TestEventJoining:
    """Tests for event joining - time-gating removed for testing"""
    
    def test_get_upcoming_events(self):
        """GET /api/events/upcoming - Lists upcoming events"""
        response = requests.get(f"{BASE_URL}/api/events/upcoming")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        
        print(f"SUCCESS: Found {len(data)} upcoming events")
        return data
    
    def test_join_event_any_time(self):
        """POST /api/events/{id}/join - Can join any scheduled event (time-gate removed)"""
        # Get upcoming events
        events_response = requests.get(f"{BASE_URL}/api/events/upcoming")
        events = events_response.json()
        
        if not events:
            pytest.skip("No events available to test joining")
        
        event_id = events[0]["id"]
        event_title = events[0]["title"]
        
        # Try to join event
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/join?display_name=TestUser"
        )
        
        # Should succeed regardless of time (time-gating removed)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "event_id" in data
        assert "jitsi_room_name" in data
        assert "jitsi_domain" in data
        assert "display_name" in data
        assert "config" in data
        
        print(f"SUCCESS: Joined event '{event_title}' - Room: {data['jitsi_room_name']}")
    
    def test_join_cancelled_event_fails(self):
        """POST /api/events/{id}/join - Should fail for cancelled events"""
        # Get all events including cancelled
        response = requests.get(f"{BASE_URL}/api/events/admin/all?status=cancelled")
        
        if response.status_code != 200:
            pytest.skip("Cannot fetch cancelled events")
        
        events = response.json()
        cancelled_events = [e for e in events if e.get("status") == "cancelled"]
        
        if not cancelled_events:
            pytest.skip("No cancelled events to test")
        
        event_id = cancelled_events[0]["id"]
        
        join_response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/join?display_name=TestUser"
        )
        
        assert join_response.status_code == 400, f"Expected 400, got {join_response.status_code}"
        print("SUCCESS: Cancelled event correctly rejected joining")


class TestLMSAdminAlerts:
    """Tests for /api/lms/admin/alerts endpoint"""
    
    def test_get_admin_alerts(self):
        """GET /api/lms/admin/alerts - Returns alerts list"""
        response = requests.get(f"{BASE_URL}/api/lms/admin/alerts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "alerts" in data
        assert isinstance(data["alerts"], list)
        
        print(f"SUCCESS: Found {len(data['alerts'])} admin alerts")


class TestLMSAdminCertificates:
    """Tests for /api/lms/admin/certificates endpoint"""
    
    def test_get_certificates(self):
        """GET /api/lms/admin/certificates - Returns certificates list"""
        response = requests.get(f"{BASE_URL}/api/lms/admin/certificates")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "certificates" in data
        assert isinstance(data["certificates"], list)
        
        print(f"SUCCESS: Found {len(data['certificates'])} certificates")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
