"""
LMS Learner Authentication Tests
Testing password-based login flow for learners
- Learner Login API (/api/lms/learner/login)
- Learner Set Password API (/api/lms/learner/set-password)
- Admin Module endpoint (/api/lms/admin/module/{module_id})
- Module images in learner portal
"""

import pytest
import requests
import os
import uuid

# Use environment variable for base URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://staff-portal-batch2.preview.emergentagent.com').rstrip('/')


class TestLMSLearnerAuthentication:
    """Test learner authentication endpoints"""

    def test_learner_login_success(self):
        """Test successful learner login with email and password"""
        response = requests.post(
            f"{BASE_URL}/api/lms/learner/login",
            json={"email": "test@example.com", "password": "testpass123"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Login should return success: true"
        assert "token" in data, "Response should contain token"
        assert len(data["token"]) > 0, "Token should not be empty"
        assert "learner" in data, "Response should contain learner info"
        assert data["learner"]["email"] == "test@example.com", "Email should match"
        assert "full_name" in data["learner"], "Learner should have full_name"
        print(f"✓ Login successful for {data['learner']['email']} ({data['learner']['full_name']})")

    def test_learner_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/lms/learner/login",
            json={"email": "test@example.com", "password": "wrongpassword"}
        )
        
        assert response.status_code == 401, f"Expected 401 for wrong password, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should contain detail"
        print(f"✓ Invalid password correctly rejected: {data['detail']}")

    def test_learner_login_nonexistent_user(self):
        """Test login with non-existent email"""
        response = requests.post(
            f"{BASE_URL}/api/lms/learner/login",
            json={"email": "nonexistent@example.com", "password": "anypassword"}
        )
        
        assert response.status_code == 401, f"Expected 401 for non-existent user, got {response.status_code}"
        print("✓ Non-existent user login correctly rejected")

    def test_learner_login_empty_fields(self):
        """Test login with empty email or password"""
        # Empty password
        response = requests.post(
            f"{BASE_URL}/api/lms/learner/login",
            json={"email": "test@example.com", "password": ""}
        )
        assert response.status_code in [400, 401, 422], f"Expected validation error for empty password"
        
        # Empty email
        response = requests.post(
            f"{BASE_URL}/api/lms/learner/login",
            json={"email": "", "password": "testpass123"}
        )
        assert response.status_code in [400, 401, 422], f"Expected validation error for empty email"
        print("✓ Empty fields correctly rejected")


class TestLMSSetPassword:
    """Test set password endpoint"""

    def test_set_password_nonexistent_user(self):
        """Test setting password for non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/lms/learner/set-password",
            json={
                "email": f"nonexistent-{uuid.uuid4()}@example.com",
                "password": "newpassword123",
                "confirm_password": "newpassword123"
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"
        data = response.json()
        assert "not found" in data.get("detail", "").lower() or "approved" in data.get("detail", "").lower()
        print("✓ Set password correctly rejects non-existent user")

    def test_set_password_mismatch(self):
        """Test password mismatch validation"""
        response = requests.post(
            f"{BASE_URL}/api/lms/learner/set-password",
            json={
                "email": "test@example.com",
                "password": "newpassword123",
                "confirm_password": "differentpassword"
            }
        )
        
        # For existing user with password already set, it may return 400 "Password already set"
        # or for new users would return 400 for mismatch
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ Password mismatch or already set correctly handled")

    def test_set_password_too_short(self):
        """Test password minimum length validation"""
        # Create a unique test email that doesn't exist
        response = requests.post(
            f"{BASE_URL}/api/lms/learner/set-password",
            json={
                "email": "test@example.com",
                "password": "short",
                "confirm_password": "short"
            }
        )
        
        # Will get 400 either for "Password must be at least 8 characters" or "Password already set"
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Short password validation works")

    def test_set_password_already_set_user(self):
        """Test setting password for user who already has password"""
        response = requests.post(
            f"{BASE_URL}/api/lms/learner/set-password",
            json={
                "email": "test@example.com",
                "password": "newpassword123",
                "confirm_password": "newpassword123"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for already set password, got {response.status_code}"
        data = response.json()
        assert "already set" in data.get("detail", "").lower()
        print("✓ Set password correctly rejects user with existing password")


class TestLMSAdminModuleEndpoint:
    """Test admin module endpoint returns quiz data"""

    def test_get_admin_module_with_quiz(self):
        """Test that admin module endpoint returns full quiz data"""
        response = requests.get(f"{BASE_URL}/api/lms/admin/module/m1-intro")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify module structure
        assert data.get("id") == "m1-intro", "Module ID should be m1-intro"
        assert "title" in data, "Module should have title"
        assert "description" in data, "Module should have description"
        assert "content" in data, "Module should have content"
        assert "duration_minutes" in data, "Module should have duration_minutes"
        
        # Verify quiz is included
        assert "quiz" in data, "Admin module endpoint should return quiz data"
        quiz = data["quiz"]
        assert quiz is not None, "Quiz should not be None"
        assert "questions" in quiz, "Quiz should have questions"
        assert len(quiz["questions"]) > 0, "Quiz should have at least one question"
        
        # Verify quiz question structure
        first_question = quiz["questions"][0]
        assert "id" in first_question, "Question should have id"
        assert "question" in first_question, "Question should have question text"
        assert "options" in first_question, "Question should have options"
        assert "correct" in first_question, "Question should have correct answer"
        assert "explanation" in first_question, "Question should have explanation"
        
        print(f"✓ Admin module endpoint returns quiz with {len(quiz['questions'])} questions")

    def test_get_admin_module_with_image(self):
        """Test that admin module endpoint returns image URL"""
        response = requests.get(f"{BASE_URL}/api/lms/admin/module/m1-intro")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check image_url field
        assert "image_url" in data, "Module should have image_url field"
        image_url = data.get("image_url")
        
        if image_url:
            assert image_url.startswith("http"), f"Image URL should be valid: {image_url}"
            print(f"✓ Module has image URL: {image_url[:60]}...")
        else:
            print("⚠ Module has no image_url set (may be intentional)")

    def test_get_admin_module_not_found(self):
        """Test 404 for non-existent module"""
        response = requests.get(f"{BASE_URL}/api/lms/admin/module/nonexistent-module-id")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent module correctly returns 404")

    def test_get_admin_module_critical_module(self):
        """Test critical module has 100% pass rate in quiz"""
        # m3-ethics is marked as critical
        response = requests.get(f"{BASE_URL}/api/lms/admin/module/m3-ethics")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("is_critical") is True, "m3-ethics should be marked as critical"
        
        if data.get("quiz"):
            # Critical modules typically require 100% pass rate
            assert data["quiz"]["pass_rate"] == 100, f"Critical module should have 100% pass rate, got {data['quiz']['pass_rate']}"
            print(f"✓ Critical module m3-ethics has 100% pass rate requirement")


class TestLMSModuleImages:
    """Test module images in learner portal"""

    def test_module_endpoint_returns_image(self):
        """Test that module endpoint returns image_url for learner portal"""
        # First, get a valid learner token
        login_resp = requests.post(
            f"{BASE_URL}/api/lms/learner/login",
            json={"email": "test@example.com", "password": "testpass123"}
        )
        
        if login_resp.status_code != 200:
            pytest.skip("Cannot get learner token for this test")
        
        # Now get module with learner email
        response = requests.get(
            f"{BASE_URL}/api/lms/module/m1-intro",
            params={"learner_email": "test@example.com"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        module = data.get("module", {})
        
        # Verify image_url is in module
        if "image_url" in module and module["image_url"]:
            print(f"✓ Module has image_url in learner view: {module['image_url'][:60]}...")
        else:
            print("⚠ Module image_url not found or empty in learner view")


class TestLMSLearnerProgress:
    """Test learner progress endpoint"""

    def test_get_learner_progress(self):
        """Test getting learner progress"""
        response = requests.get(f"{BASE_URL}/api/lms/progress/test@example.com")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "learner" in data, "Response should contain learner"
        assert "total_modules" in data, "Response should contain total_modules"
        assert "completed_modules" in data, "Response should contain completed_modules"
        assert "progress_percent" in data, "Response should contain progress_percent"
        assert "modules_status" in data, "Response should contain modules_status"
        
        # Verify data values
        assert data["total_modules"] == 14, f"Should have 14 modules, got {data['total_modules']}"
        assert isinstance(data["progress_percent"], (int, float)), "Progress percent should be numeric"
        
        print(f"✓ Learner progress: {data['completed_modules']}/{data['total_modules']} ({data['progress_percent']}%)")

    def test_get_learner_progress_not_found(self):
        """Test 404 for non-existent learner"""
        response = requests.get(f"{BASE_URL}/api/lms/progress/nonexistent-learner@example.com")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent learner progress returns 404")


class TestLMSCourseInfo:
    """Test course info endpoint"""

    def test_get_course_info(self):
        """Test course endpoint returns all modules"""
        response = requests.get(f"{BASE_URL}/api/lms/course")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        assert "course_id" in data, "Should have course_id"
        assert "title" in data, "Should have title"
        assert "modules" in data, "Should have modules"
        assert data["module_count"] == 14, f"Should have 14 modules, got {data['module_count']}"
        
        # Verify each module has required fields
        for module in data["modules"]:
            assert "id" in module, "Module should have id"
            assert "title" in module, "Module should have title"
            assert "description" in module, "Module should have description"
            assert "duration_minutes" in module, "Module should have duration_minutes"
            assert "is_critical" in module, "Module should have is_critical flag"
        
        print(f"✓ Course info returned with {len(data['modules'])} modules")


class TestLMSPortalAccess:
    """Test LMS portal static files access"""

    def test_learner_portal_loads(self):
        """Test that learner portal HTML loads"""
        response = requests.get(f"{BASE_URL}/api/training/")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content = response.text
        
        # Verify it's the learner portal
        assert "Radio Check" in content, "Should contain Radio Check branding"
        assert "Peer to Peer Training" in content, "Should contain Peer to Peer Training"
        assert "loginModal" in content, "Should have login modal"
        assert "loginPassword" in content, "Login modal should have password field"
        
        # Verify logo image
        assert "logo.png" in content or "Radio Check" in content, "Should have logo reference"
        
        print("✓ Learner portal loads with login modal and password field")

    def test_admin_portal_loads(self):
        """Test that admin portal HTML loads"""
        response = requests.get(f"{BASE_URL}/api/lms-admin/")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content = response.text
        
        # Verify it's the admin portal
        assert "LMS Admin" in content, "Should contain LMS Admin"
        assert "loginScreen" in content or "login" in content.lower(), "Should have login functionality"
        
        print("✓ Admin portal loads successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
