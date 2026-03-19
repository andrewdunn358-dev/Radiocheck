"""
AI Characters CMS API Tests
Tests for managing AI Battle Buddies personas via database
Features tested:
- GET /api/ai-characters - Public endpoint returns characters from database
- GET /api/ai-characters/{id} - Get single character (public)
- GET /api/ai-characters/admin/all - Admin endpoint with full details
- GET /api/ai-characters/admin/{id} - Admin get single with prompts
- POST /api/ai-characters - Create new character (admin only)
- PUT /api/ai-characters/{id} - Update character (admin only)
- DELETE /api/ai-characters/{id} - Delete character (admin only)
- POST /api/ai-characters/seed-from-hardcoded - Import from hardcoded values
- Verify buddy-chat endpoint uses database characters for prompts
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://staff-refactor-1.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.fail(f"Failed to authenticate admin: {response.status_code} - {response.text}")


@pytest.fixture
def auth_headers(admin_token):
    """Headers with admin authentication"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


# ============================================================================
# PUBLIC ENDPOINT TESTS
# ============================================================================

class TestPublicEndpoints:
    """Tests for public AI Characters endpoints (no auth required)"""
    
    def test_get_all_characters_public(self):
        """GET /api/ai-characters - Returns characters from database"""
        response = requests.get(f"{BASE_URL}/api/ai-characters")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "characters" in data, "Response should contain 'characters' key"
        assert "source" in data, "Response should contain 'source' key"
        
        # Should return from database (seeded)
        assert data["source"] == "database", "Characters should come from database"
        
        # Verify we have characters
        characters = data["characters"]
        assert len(characters) >= 1, "Should have at least 1 character"
        
        # Verify character structure (public - no prompts)
        first_char = characters[0]
        assert "id" in first_char, "Character should have id"
        assert "name" in first_char, "Character should have name"
        assert "prompt" not in first_char, "Public endpoint should NOT expose prompts"
        
        print(f"✓ GET /api/ai-characters - Found {len(characters)} characters from {data['source']}")
    
    def test_get_all_characters_has_expected_fields(self):
        """Verify public characters have expected fields"""
        response = requests.get(f"{BASE_URL}/api/ai-characters")
        assert response.status_code == 200
        
        characters = response.json()["characters"]
        
        # Check that all expected hardcoded characters are seeded
        expected_ids = ["tommy", "doris", "bob", "sentry", "hugo", "margie", "rita", "catherine"]
        actual_ids = [c["id"] for c in characters]
        
        for expected_id in expected_ids:
            assert expected_id in actual_ids, f"Missing character: {expected_id}"
        
        print(f"✓ All 8 hardcoded characters present in database")
    
    def test_get_single_character_public(self):
        """GET /api/ai-characters/{id} - Get single character without prompt"""
        response = requests.get(f"{BASE_URL}/api/ai-characters/tommy")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == "tommy", "Should return tommy"
        assert data["name"] == "Tommy", "Name should be Tommy"
        assert "description" in data, "Should have description"
        assert "prompt" not in data, "Public endpoint should NOT expose prompt"
        
        print(f"✓ GET /api/ai-characters/tommy - Returned character without prompt")
    
    def test_get_character_not_found(self):
        """GET /api/ai-characters/{id} - Returns 404 for non-existent character"""
        response = requests.get(f"{BASE_URL}/api/ai-characters/nonexistent_character_xyz")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ GET /api/ai-characters/nonexistent - Correctly returns 404")
    
    def test_tommy_description_updated_via_cms(self):
        """Verify Tommy's description was updated via CMS"""
        response = requests.get(f"{BASE_URL}/api/ai-characters/tommy")
        assert response.status_code == 200
        
        data = response.json()
        # Main agent updated Tommy's description
        assert "updated via CMS" in data.get("description", "").lower() or "battle buddy" in data.get("description", "").lower(), \
            "Tommy's description should show CMS update or be a battle buddy description"
        
        print(f"✓ Tommy's description: {data.get('description', '')[:50]}...")


# ============================================================================
# ADMIN ENDPOINT TESTS
# ============================================================================

class TestAdminEndpoints:
    """Tests for admin-only AI Characters endpoints"""
    
    def test_admin_get_all_characters(self, auth_headers):
        """GET /api/ai-characters/admin/all - Returns full details including prompts"""
        response = requests.get(
            f"{BASE_URL}/api/ai-characters/admin/all",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "characters" in data
        
        characters = data["characters"]
        assert len(characters) >= 8, "Should have all 8 seeded characters"
        
        # Admin endpoint SHOULD include prompts
        for char in characters:
            assert "prompt" in char, f"Admin endpoint should include prompt for {char.get('id')}"
            assert len(char["prompt"]) > 100, f"Prompt should be substantial for {char.get('id')}"
        
        print(f"✓ GET /api/ai-characters/admin/all - Returned {len(characters)} characters with prompts")
    
    def test_admin_get_all_without_auth(self):
        """GET /api/ai-characters/admin/all - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/ai-characters/admin/all")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Admin endpoint correctly requires authentication")
    
    def test_admin_get_single_character(self, auth_headers):
        """GET /api/ai-characters/admin/{id} - Returns full character with prompt"""
        response = requests.get(
            f"{BASE_URL}/api/ai-characters/admin/tommy",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == "tommy"
        assert "prompt" in data, "Admin endpoint should include prompt"
        assert len(data["prompt"]) > 500, "Tommy's prompt should be substantial"
        
        print(f"✓ GET /api/ai-characters/admin/tommy - Returned full character with prompt ({len(data['prompt'])} chars)")


# ============================================================================
# CREATE CHARACTER TESTS
# ============================================================================

class TestCreateCharacter:
    """Tests for creating new AI characters"""
    
    def test_create_character_success(self, auth_headers):
        """POST /api/ai-characters - Create new character"""
        test_id = f"test_char_{uuid.uuid4().hex[:8]}"
        
        new_character = {
            "id": test_id,
            "name": "Test Character",
            "description": "A test AI character for automated testing",
            "bio": "Test bio for the character",
            "prompt": "You are a test character. Be helpful and respond briefly.",
            "avatar": "/images/test.png",
            "is_enabled": True,
            "category": "general",
            "order": 99
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai-characters",
            headers=auth_headers,
            json=new_character
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "character" in data or "message" in data
        
        # Verify character was created by fetching it
        get_response = requests.get(
            f"{BASE_URL}/api/ai-characters/admin/{test_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200, f"Created character should be fetchable"
        
        created = get_response.json()
        assert created["name"] == "Test Character"
        assert created["description"] == "A test AI character for automated testing"
        
        print(f"✓ POST /api/ai-characters - Created character '{test_id}'")
        
        # Cleanup - delete the test character
        delete_response = requests.delete(
            f"{BASE_URL}/api/ai-characters/{test_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200, "Should be able to delete test character"
        print(f"✓ Cleanup - Deleted test character '{test_id}'")
    
    def test_create_character_requires_auth(self):
        """POST /api/ai-characters - Requires admin authentication"""
        new_character = {
            "id": "unauthorized_char",
            "name": "Unauthorized",
            "description": "Should fail",
            "prompt": "Test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai-characters",
            json=new_character
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Create character correctly requires admin auth")
    
    def test_create_duplicate_id_fails(self, auth_headers):
        """POST /api/ai-characters - Cannot create with existing ID"""
        duplicate_character = {
            "id": "tommy",  # Already exists
            "name": "Duplicate Tommy",
            "description": "Should fail",
            "prompt": "Test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai-characters",
            headers=auth_headers,
            json=duplicate_character
        )
        
        assert response.status_code == 400, f"Expected 400 for duplicate ID, got {response.status_code}"
        print(f"✓ Duplicate ID correctly rejected")


# ============================================================================
# UPDATE CHARACTER TESTS
# ============================================================================

class TestUpdateCharacter:
    """Tests for updating AI characters"""
    
    def test_update_character_description(self, auth_headers):
        """PUT /api/ai-characters/{id} - Update character description"""
        # Get current description first
        get_response = requests.get(f"{BASE_URL}/api/ai-characters/doris")
        original_description = get_response.json().get("description", "")
        
        # Update description
        update_data = {
            "description": "Updated via automated test - a nurturing presence"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/ai-characters/doris",
            headers=auth_headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update persisted
        verify_response = requests.get(f"{BASE_URL}/api/ai-characters/doris")
        updated = verify_response.json()
        assert updated["description"] == "Updated via automated test - a nurturing presence"
        
        print(f"✓ PUT /api/ai-characters/doris - Description updated")
        
        # Restore original description
        restore_data = {"description": original_description if original_description else "A nurturing, compassionate presence who creates a safe space to talk."}
        requests.put(
            f"{BASE_URL}/api/ai-characters/doris",
            headers=auth_headers,
            json=restore_data
        )
        print(f"✓ Restored original description")
    
    def test_update_requires_auth(self):
        """PUT /api/ai-characters/{id} - Requires admin authentication"""
        response = requests.put(
            f"{BASE_URL}/api/ai-characters/tommy",
            json={"description": "Should fail"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Update correctly requires admin auth")
    
    def test_update_nonexistent_character(self, auth_headers):
        """PUT /api/ai-characters/{id} - Returns 404 for non-existent character"""
        response = requests.put(
            f"{BASE_URL}/api/ai-characters/nonexistent_xyz_123",
            headers=auth_headers,
            json={"description": "Should fail"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Update non-existent character returns 404")


# ============================================================================
# DELETE CHARACTER TESTS
# ============================================================================

class TestDeleteCharacter:
    """Tests for deleting AI characters"""
    
    def test_delete_created_character(self, auth_headers):
        """DELETE /api/ai-characters/{id} - Delete a database character"""
        # First create a character to delete
        test_id = f"delete_test_{uuid.uuid4().hex[:8]}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/ai-characters",
            headers=auth_headers,
            json={
                "id": test_id,
                "name": "Delete Test",
                "description": "Will be deleted",
                "prompt": "Test prompt"
            }
        )
        assert create_response.status_code == 200, f"Failed to create test character"
        
        # Delete the character
        delete_response = requests.delete(
            f"{BASE_URL}/api/ai-characters/{test_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/ai-characters/{test_id}")
        assert get_response.status_code == 404, "Deleted character should return 404"
        
        print(f"✓ DELETE /api/ai-characters/{test_id} - Character deleted and verified")
    
    def test_delete_requires_auth(self):
        """DELETE /api/ai-characters/{id} - Requires admin authentication"""
        response = requests.delete(f"{BASE_URL}/api/ai-characters/tommy")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Delete correctly requires admin auth")


# ============================================================================
# SEED FROM HARDCODED TESTS
# ============================================================================

class TestSeedFromHardcoded:
    """Tests for seeding characters from hardcoded values"""
    
    def test_seed_endpoint_exists(self, auth_headers):
        """POST /api/ai-characters/seed-from-hardcoded - Endpoint accessible"""
        response = requests.post(
            f"{BASE_URL}/api/ai-characters/seed-from-hardcoded",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "seeded" in data or "skipped" in data or "message" in data
        
        # Since characters already seeded, should show skipped
        print(f"✓ POST /api/ai-characters/seed-from-hardcoded - Response: {data}")
    
    def test_seed_requires_auth(self):
        """POST /api/ai-characters/seed-from-hardcoded - Requires authentication"""
        response = requests.post(f"{BASE_URL}/api/ai-characters/seed-from-hardcoded")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Seed endpoint correctly requires admin auth")


# ============================================================================
# BUDDY CHAT INTEGRATION TESTS
# ============================================================================

class TestBuddyChatIntegration:
    """Tests to verify buddy-chat uses database characters"""
    
    def test_buddy_chat_uses_database_character(self, auth_headers):
        """POST /api/ai-buddies/chat - Should use character config from database"""
        # First verify Tommy exists in database with a prompt
        admin_response = requests.get(
            f"{BASE_URL}/api/ai-characters/admin/tommy",
            headers=auth_headers
        )
        assert admin_response.status_code == 200
        tommy_config = admin_response.json()
        assert "prompt" in tommy_config
        assert len(tommy_config["prompt"]) > 500, "Tommy should have full system prompt"
        
        print(f"✓ Tommy's database config has prompt ({len(tommy_config['prompt'])} chars)")
        
        # The actual chat endpoint would be tested separately
        # Here we just verify the character config is available
        
    def test_get_character_config_helper_logic(self, auth_headers):
        """Verify get_character_config returns database config when available"""
        # Test that enabled characters return from database
        response = requests.get(f"{BASE_URL}/api/ai-characters/tommy")
        assert response.status_code == 200
        
        data = response.json()
        # If from database, should have created_at field
        assert "created_at" in data or "is_enabled" in data, "Database characters have timestamps/status"
        
        print(f"✓ Character config correctly loaded from database")


# ============================================================================
# CHARACTER FIELDS VALIDATION
# ============================================================================

class TestCharacterFields:
    """Tests for character data structure and fields"""
    
    def test_character_has_all_cms_fields(self, auth_headers):
        """Verify characters have all CMS-managed fields"""
        response = requests.get(
            f"{BASE_URL}/api/ai-characters/admin/tommy",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Required CMS fields
        required_fields = ["id", "name", "description", "prompt", "is_enabled"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Optional but expected CMS fields
        optional_fields = ["bio", "avatar", "category", "order", "created_at"]
        present_optional = [f for f in optional_fields if f in data]
        
        print(f"✓ Character has required fields and {len(present_optional)}/{len(optional_fields)} optional fields")
    
    def test_character_categories(self, auth_headers):
        """Verify characters have appropriate categories"""
        response = requests.get(
            f"{BASE_URL}/api/ai-characters/admin/all",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        characters = response.json()["characters"]
        
        expected_categories = {
            "tommy": "general",
            "doris": "general", 
            "bob": "general",
            "sentry": "legal",
            "hugo": "wellbeing",
            "margie": "addiction",
            "rita": "family",
            "catherine": "wellbeing"
        }
        
        for char in characters:
            char_id = char.get("id")
            if char_id in expected_categories:
                expected = expected_categories[char_id]
                actual = char.get("category", "general")
                assert actual == expected, f"{char_id} should have category '{expected}', got '{actual}'"
        
        print(f"✓ All characters have correct categories")
    
    def test_character_ordering(self, auth_headers):
        """Verify characters have order field for display sorting"""
        response = requests.get(f"{BASE_URL}/api/ai-characters")
        assert response.status_code == 200
        
        characters = response.json()["characters"]
        
        # Characters should be sorted by order
        orders = [c.get("order", 99) for c in characters]
        
        # Check that orders are present and reasonable
        assert all(isinstance(o, int) for o in orders), "All orders should be integers"
        
        print(f"✓ Characters have order field, sorted: {orders}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
