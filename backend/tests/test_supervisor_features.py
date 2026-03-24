"""
Test Supervisor Features - Backend API Tests
Tests for the new Supervisor role functionality:
- User registration with supervisor role
- Team management (view counsellors and peers)
- Supervision notes (1:1 supervision logs)
- Escalations from staff to supervisors
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://safety-hardening-1.preview.emergentagent.com').rstrip('/')

# Test data
ADMIN_CREDS = {"email": "admin@veteran.dbty.co.uk", "password": "Admin123!"}
SUPERVISOR_CREDS = {"email": "supervisor@radiocheck.me", "password": "Sup123!"}
COUNSELLOR_CREDS = {"email": "newcounsellor@test.com", "password": "Counsel123!"}

# Staff IDs from the review request
TEST_COUNSELLOR_ID = "f044736b-40a3-4e7b-b48a-0145689a52c8"
TEST_PEER_ID = "4991a972-7430-4f1a-ae15-166a9d82b1f5"


class TestHealthCheck:
    """Basic API health check"""
    
    def test_api_health(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"API health check failed: {response.text}"
        print("API health check passed")


class TestAdminLogin:
    """Test admin authentication"""
    
    def test_admin_login(self):
        """Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        assert data["user"]["role"] == "admin", f"Expected admin role, got {data['user']['role']}"
        print(f"Admin login successful, role: {data['user']['role']}")
        return data["token"]


class TestSupervisorUserCreation:
    """Test creating supervisor users via admin"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["token"]
    
    def test_create_supervisor_user(self, admin_token):
        """Admin can create a user with 'supervisor' role"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create unique supervisor email for test
        test_email = f"test_supervisor_{uuid.uuid4().hex[:8]}@radiocheck.me"
        
        supervisor_data = {
            "email": test_email,
            "password": "TestSup123!",
            "role": "supervisor",
            "name": "Test Supervisor"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=supervisor_data,
            headers=headers
        )
        
        assert response.status_code == 200 or response.status_code == 201, f"Failed to create supervisor: {response.text}"
        data = response.json()
        assert data.get("role") == "supervisor", f"Expected supervisor role, got {data.get('role')}"
        assert data.get("email") == test_email, f"Email mismatch"
        print(f"Successfully created supervisor user: {test_email}")
        return data
    
    def test_supervisor_role_pattern_validation(self, admin_token):
        """Verify supervisor role is accepted in the role pattern"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        test_email = f"test_sup_valid_{uuid.uuid4().hex[:8]}@test.com"
        
        supervisor_data = {
            "email": test_email,
            "password": "ValidSup123!",
            "role": "supervisor",
            "name": "Pattern Test Supervisor"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=supervisor_data,
            headers=headers
        )
        
        # Should succeed - supervisor is in the allowed pattern
        assert response.status_code in [200, 201], f"Supervisor role should be allowed: {response.text}"
        print("Supervisor role pattern validation passed")


class TestSupervisorLogin:
    """Test supervisor authentication and login flow"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["token"]
    
    def test_create_and_login_supervisor(self, admin_token):
        """Create a supervisor and verify they can login"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create supervisor
        test_email = f"test_sup_login_{uuid.uuid4().hex[:8]}@radiocheck.me"
        test_password = "SuperLogin123!"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "role": "supervisor",
                "name": "Login Test Supervisor"
            },
            headers=headers
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create supervisor for login test: {create_response.text}")
        
        # Now login as supervisor
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": test_password}
        )
        
        assert login_response.status_code == 200, f"Supervisor login failed: {login_response.text}"
        data = login_response.json()
        assert data["user"]["role"] == "supervisor", f"Expected supervisor role, got {data['user']['role']}"
        
        # Check redirect field - supervisors should be redirected to staff portal
        redirect = data.get("redirect")
        print(f"Supervisor login successful, redirect: {redirect}")
        
        # Supervisor should get staff redirect
        assert redirect == "/staff", f"Expected /staff redirect for supervisor, got {redirect}"
        return data["token"]


class TestExistingSupervisorLogin:
    """Test login with existing supervisor credentials from review request"""
    
    def test_existing_supervisor_login(self):
        """Test login with provided supervisor credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        
        if response.status_code == 401:
            # Supervisor might not exist yet - create it first
            print("Existing supervisor not found, will test with newly created supervisor")
            pytest.skip("Supervisor credentials not yet seeded in database")
        
        assert response.status_code == 200, f"Supervisor login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "supervisor", f"Expected supervisor role, got {data['user']['role']}"
        print(f"Existing supervisor login successful: {data['user']['email']}")
        return data["token"]


class TestSupervisionTeam:
    """Test supervisor team management endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["token"]
    
    @pytest.fixture
    def supervisor_token(self, admin_token):
        """Get or create supervisor and return token"""
        # Try existing supervisor first
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        if response.status_code == 200:
            return response.json()["token"]
        
        # Create new supervisor
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_email = f"test_sup_team_{uuid.uuid4().hex[:8]}@radiocheck.me"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "TeamSup123!",
                "role": "supervisor",
                "name": "Team Test Supervisor"
            },
            headers=headers
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create supervisor: {create_response.text}")
        
        # Login as new supervisor
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": "TeamSup123!"}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Supervisor login failed: {login_response.text}")
        
        return login_response.json()["token"]
    
    def test_supervisor_can_view_team(self, supervisor_token):
        """Supervisor can view team members (counsellors and peers)"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        
        response = requests.get(f"{BASE_URL}/api/supervision/team", headers=headers)
        
        assert response.status_code == 200, f"Failed to get team: {response.text}"
        team = response.json()
        assert isinstance(team, list), "Expected list of team members"
        print(f"Supervisor can view team, found {len(team)} members")
        
        # Check team member structure
        for member in team:
            assert "id" in member or "email" in member, "Team member missing identifier"
            assert "role" in member, "Team member missing role"
            print(f"  - {member.get('name', 'Unknown')}: {member.get('role')}")
        
        return team
    
    def test_admin_can_view_team(self, admin_token):
        """Admin can also view team members"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/supervision/team", headers=headers)
        
        assert response.status_code == 200, f"Admin failed to get team: {response.text}"
        team = response.json()
        print(f"Admin can view team, found {len(team)} members")
        return team
    
    def test_non_supervisor_cannot_view_team(self):
        """Non-supervisors cannot view team"""
        # Try to login as counsellor
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COUNSELLOR_CREDS)
        
        if response.status_code != 200:
            print("Counsellor credentials not found, skipping permission test")
            pytest.skip("Counsellor credentials not available")
        
        counsellor_token = response.json()["token"]
        headers = {"Authorization": f"Bearer {counsellor_token}"}
        
        response = requests.get(f"{BASE_URL}/api/supervision/team", headers=headers)
        
        assert response.status_code == 403, f"Expected 403 for non-supervisor, got {response.status_code}"
        print("Non-supervisor correctly denied access to team view")


class TestSupervisionNotes:
    """Test supervision notes (1:1 supervision logs)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["token"]
    
    @pytest.fixture
    def supervisor_token(self, admin_token):
        """Get or create supervisor and return token"""
        # Try existing supervisor first
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        if response.status_code == 200:
            return response.json()["token"]
        
        # Create new supervisor
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_email = f"test_sup_notes_{uuid.uuid4().hex[:8]}@radiocheck.me"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "NotesSup123!",
                "role": "supervisor",
                "name": "Notes Test Supervisor"
            },
            headers=headers
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create supervisor: {create_response.text}")
        
        # Login as new supervisor
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": "NotesSup123!"}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Supervisor login failed: {login_response.text}")
        
        return login_response.json()["token"]
    
    @pytest.fixture
    def staff_id(self, admin_token):
        """Get a staff member ID for testing"""
        # Try to use the provided counsellor ID
        return TEST_COUNSELLOR_ID
    
    def test_supervisor_can_create_supervision_note(self, supervisor_token, staff_id):
        """Supervisor can create supervision notes for staff"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        
        note_data = {
            "staff_id": staff_id,
            "wellbeing_notes": "Staff member is doing well, no concerns",
            "case_notes": "Discussed handling of 3 cases this week",
            "action_items": ["Follow up on case A", "Review documentation for case B"],
            "next_session_date": "2026-02-01",
            "is_confidential": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/supervision/notes",
            json=note_data,
            headers=headers
        )
        
        assert response.status_code in [200, 201], f"Failed to create supervision note: {response.text}"
        data = response.json()
        assert "note" in data or "id" in data, "Response should contain note data"
        
        note = data.get("note", data)
        assert note.get("staff_id") == staff_id, "Staff ID mismatch"
        assert note.get("wellbeing_notes") == note_data["wellbeing_notes"], "Wellbeing notes mismatch"
        print(f"Successfully created supervision note: {note.get('id')}")
        return note
    
    def test_supervisor_can_view_supervision_notes(self, supervisor_token):
        """Supervisor can view supervision notes"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        
        response = requests.get(f"{BASE_URL}/api/supervision/notes", headers=headers)
        
        assert response.status_code == 200, f"Failed to get supervision notes: {response.text}"
        notes = response.json()
        assert isinstance(notes, list), "Expected list of notes"
        print(f"Supervisor can view {len(notes)} supervision notes")
        return notes
    
    def test_admin_can_view_all_supervision_notes(self, admin_token):
        """Admin can view all supervision notes"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/supervision/notes", headers=headers)
        
        assert response.status_code == 200, f"Admin failed to get supervision notes: {response.text}"
        notes = response.json()
        print(f"Admin can view {len(notes)} supervision notes")
        return notes
    
    def test_supervision_note_with_staff_filter(self, supervisor_token, staff_id):
        """Can filter supervision notes by staff ID"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/supervision/notes?staff_id={staff_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to filter notes: {response.text}"
        notes = response.json()
        print(f"Found {len(notes)} notes for staff {staff_id}")
        
        # Verify all notes are for the specified staff
        for note in notes:
            assert note.get("staff_id") == staff_id, f"Note for wrong staff: {note.get('staff_id')}"


class TestEscalations:
    """Test escalation functionality from staff to supervisors"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["token"]
    
    @pytest.fixture
    def supervisor_token(self, admin_token):
        """Get or create supervisor and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        if response.status_code == 200:
            return response.json()["token"]
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_email = f"test_sup_esc_{uuid.uuid4().hex[:8]}@radiocheck.me"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "EscSup123!",
                "role": "supervisor",
                "name": "Escalation Test Supervisor"
            },
            headers=headers
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create supervisor: {create_response.text}")
        
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": "EscSup123!"}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Supervisor login failed: {login_response.text}")
        
        return login_response.json()["token"]
    
    @pytest.fixture
    def counsellor_token(self, admin_token):
        """Get or create counsellor and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COUNSELLOR_CREDS)
        if response.status_code == 200:
            return response.json()["token"]
        
        # Create counsellor
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_email = f"test_counsel_{uuid.uuid4().hex[:8]}@test.com"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "Counsel123!",
                "role": "counsellor",
                "name": "Test Counsellor"
            },
            headers=headers
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create counsellor: {create_response.text}")
        
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": "Counsel123!"}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Counsellor login failed: {login_response.text}")
        
        return login_response.json()["token"]
    
    def test_counsellor_can_create_escalation(self, counsellor_token):
        """Counsellor can create an escalation"""
        headers = {"Authorization": f"Bearer {counsellor_token}"}
        
        escalation_data = {
            "subject": "Urgent case needing supervisor input",
            "description": "Client presenting with high-risk indicators, need guidance on next steps",
            "priority": "high",
            "related_case_id": None
        }
        
        response = requests.post(
            f"{BASE_URL}/api/escalations",
            json=escalation_data,
            headers=headers
        )
        
        assert response.status_code in [200, 201], f"Failed to create escalation: {response.text}"
        data = response.json()
        assert "escalation" in data, "Response should contain escalation data"
        
        escalation = data["escalation"]
        assert escalation.get("subject") == escalation_data["subject"], "Subject mismatch"
        assert escalation.get("priority") == "high", "Priority mismatch"
        assert escalation.get("status") == "pending", "New escalation should be pending"
        print(f"Counsellor created escalation: {escalation.get('id')}")
        return escalation
    
    def test_supervisor_can_view_escalations(self, supervisor_token):
        """Supervisor can view all escalations"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        
        response = requests.get(f"{BASE_URL}/api/escalations", headers=headers)
        
        assert response.status_code == 200, f"Failed to get escalations: {response.text}"
        escalations = response.json()
        assert isinstance(escalations, list), "Expected list of escalations"
        print(f"Supervisor can view {len(escalations)} escalations")
        return escalations
    
    def test_supervisor_can_acknowledge_escalation(self, supervisor_token, counsellor_token):
        """Supervisor can acknowledge an escalation"""
        # First create an escalation
        headers_counsellor = {"Authorization": f"Bearer {counsellor_token}"}
        
        create_response = requests.post(
            f"{BASE_URL}/api/escalations",
            json={
                "subject": "Test escalation for acknowledge",
                "description": "Testing acknowledgment flow",
                "priority": "normal"
            },
            headers=headers_counsellor
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create escalation: {create_response.text}")
        
        escalation_id = create_response.json()["escalation"]["id"]
        
        # Now supervisor acknowledges it
        headers_supervisor = {"Authorization": f"Bearer {supervisor_token}"}
        
        ack_response = requests.patch(
            f"{BASE_URL}/api/escalations/{escalation_id}/acknowledge",
            headers=headers_supervisor
        )
        
        assert ack_response.status_code == 200, f"Failed to acknowledge: {ack_response.text}"
        print(f"Supervisor acknowledged escalation: {escalation_id}")
        
        # Verify status changed
        get_response = requests.get(f"{BASE_URL}/api/escalations", headers=headers_supervisor)
        escalations = get_response.json()
        
        ack_escalation = next((e for e in escalations if e.get("id") == escalation_id), None)
        assert ack_escalation is not None, "Could not find acknowledged escalation"
        assert ack_escalation.get("status") == "acknowledged", f"Expected acknowledged status, got {ack_escalation.get('status')}"
        assert ack_escalation.get("supervisor_id") is not None, "Supervisor ID should be set"
    
    def test_supervisor_can_resolve_escalation(self, supervisor_token, counsellor_token):
        """Supervisor can resolve an escalation"""
        # First create an escalation
        headers_counsellor = {"Authorization": f"Bearer {counsellor_token}"}
        
        create_response = requests.post(
            f"{BASE_URL}/api/escalations",
            json={
                "subject": "Test escalation for resolve",
                "description": "Testing resolution flow",
                "priority": "normal"
            },
            headers=headers_counsellor
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create escalation: {create_response.text}")
        
        escalation_id = create_response.json()["escalation"]["id"]
        
        # Supervisor resolves it
        headers_supervisor = {"Authorization": f"Bearer {supervisor_token}"}
        
        resolve_response = requests.patch(
            f"{BASE_URL}/api/escalations/{escalation_id}/resolve",
            params={"resolution_notes": "Provided guidance on handling this case"},
            headers=headers_supervisor
        )
        
        assert resolve_response.status_code == 200, f"Failed to resolve: {resolve_response.text}"
        print(f"Supervisor resolved escalation: {escalation_id}")
        
        # Verify status changed
        get_response = requests.get(f"{BASE_URL}/api/escalations", headers=headers_supervisor)
        escalations = get_response.json()
        
        resolved_escalation = next((e for e in escalations if e.get("id") == escalation_id), None)
        assert resolved_escalation is not None, "Could not find resolved escalation"
        assert resolved_escalation.get("status") == "resolved", f"Expected resolved status, got {resolved_escalation.get('status')}"
    
    def test_counsellor_sees_only_own_escalations(self, counsellor_token):
        """Counsellor can only see their own escalations"""
        headers = {"Authorization": f"Bearer {counsellor_token}"}
        
        response = requests.get(f"{BASE_URL}/api/escalations", headers=headers)
        
        assert response.status_code == 200, f"Failed to get escalations: {response.text}"
        escalations = response.json()
        print(f"Counsellor sees {len(escalations)} of their own escalations")
        
        # All escalations should belong to this counsellor (same staff_id)
        if escalations:
            staff_ids = set(e.get("staff_id") for e in escalations)
            assert len(staff_ids) <= 1, "Counsellor should only see their own escalations"


class TestAccessControl:
    """Test role-based access control for supervisor features"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["token"]
    
    def test_supervisor_cannot_create_escalation(self, admin_token):
        """Supervisors cannot create escalations (only counsellors/peers can)"""
        # Create a supervisor
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_email = f"test_sup_access_{uuid.uuid4().hex[:8]}@radiocheck.me"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "AccessSup123!",
                "role": "supervisor",
                "name": "Access Test Supervisor"
            },
            headers=headers
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create supervisor: {create_response.text}")
        
        # Login as supervisor
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": "AccessSup123!"}
        )
        
        supervisor_token = login_response.json()["token"]
        sup_headers = {"Authorization": f"Bearer {supervisor_token}"}
        
        # Try to create escalation (should fail)
        esc_response = requests.post(
            f"{BASE_URL}/api/escalations",
            json={
                "subject": "Test",
                "description": "This should fail",
                "priority": "normal"
            },
            headers=sup_headers
        )
        
        assert esc_response.status_code == 403, f"Supervisor should not be able to create escalations, got {esc_response.status_code}"
        print("Correctly denied: Supervisor cannot create escalations")
    
    def test_counsellor_cannot_acknowledge_escalation(self, admin_token):
        """Counsellors cannot acknowledge escalations"""
        # Create a counsellor
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_email = f"test_counsel_ack_{uuid.uuid4().hex[:8]}@test.com"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "CounselAck123!",
                "role": "counsellor",
                "name": "Ack Test Counsellor"
            },
            headers=headers
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create counsellor: {create_response.text}")
        
        # Login as counsellor
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": "CounselAck123!"}
        )
        
        counsellor_token = login_response.json()["token"]
        counsel_headers = {"Authorization": f"Bearer {counsellor_token}"}
        
        # First create an escalation
        create_esc = requests.post(
            f"{BASE_URL}/api/escalations",
            json={
                "subject": "Test for access control",
                "description": "Testing access control",
                "priority": "normal"
            },
            headers=counsel_headers
        )
        
        if create_esc.status_code not in [200, 201]:
            pytest.skip("Could not create escalation for test")
        
        escalation_id = create_esc.json()["escalation"]["id"]
        
        # Try to acknowledge own escalation (should fail)
        ack_response = requests.patch(
            f"{BASE_URL}/api/escalations/{escalation_id}/acknowledge",
            headers=counsel_headers
        )
        
        assert ack_response.status_code == 403, f"Counsellor should not be able to acknowledge, got {ack_response.status_code}"
        print("Correctly denied: Counsellor cannot acknowledge escalations")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
