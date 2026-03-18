"""
Test Suite for Persona Refactoring
==================================
Tests the modular persona system after refactoring from monolithic server.py
to individual files in /backend/personas/ directory.

Features tested:
1. GET /api/ai-buddies/characters - Returns all 12 characters
2. POST /api/ai-buddies/chat - Chat with various characters (Tommy, Megan, Penny, Doris)
3. Soul Document behavioral rules injection
"""

import pytest
import requests
import os
import time

# Get base URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://portal-migration-1.preview.emergentagent.com')

# Expected characters after refactor
EXPECTED_CHARACTERS = [
    "tommy", "doris", "sentry", "bob", "margie", 
    "jack", "rita", "catherine", "frankie", "baz", 
    "megan", "penny"
]

class TestCharactersEndpoint:
    """Test GET /api/ai-buddies/characters endpoint"""
    
    def test_get_characters_returns_200(self):
        """Test that characters endpoint returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET /api/ai-buddies/characters returns 200")
    
    def test_get_characters_returns_12_characters(self):
        """Test that exactly 12 characters are returned"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert "characters" in data, "Response should contain 'characters' key"
        
        characters = data["characters"]
        assert len(characters) == 12, f"Expected 12 characters, got {len(characters)}"
        print(f"PASS: Returns exactly 12 characters")
    
    def test_all_expected_characters_present(self):
        """Test that all expected character IDs are present"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        characters = data["characters"]
        
        # Extract character IDs
        character_ids = [char["id"] for char in characters]
        
        for expected_id in EXPECTED_CHARACTERS:
            assert expected_id in character_ids, f"Missing character: {expected_id}"
            print(f"  Found character: {expected_id}")
        
        print(f"PASS: All 12 expected characters are present")
    
    def test_character_structure(self):
        """Test that each character has required fields from public API"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        characters = data["characters"]
        
        # The public API intentionally excludes 'prompt' for security
        # It returns id, name, avatar, and optional fields like bio, description, category
        required_fields = ["id", "name", "avatar"]
        
        for char in characters:
            for field in required_fields:
                assert field in char, f"Character {char.get('id', 'unknown')} missing field: {field}"
        
        print("PASS: All characters have required public fields (id, name, avatar)")
    
    def test_new_characters_present(self):
        """Test that new characters Megan and Penny are included in public API"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        characters = data["characters"]
        character_ids = [char["id"] for char in characters]
        
        # Test Megan
        assert "megan" in character_ids, "Missing new character: megan"
        megan = next(c for c in characters if c["id"] == "megan")
        assert megan["name"] == "Megan", f"Megan name incorrect: {megan['name']}"
        # Public API doesn't expose prompt for security - check bio exists instead
        assert len(megan.get("bio", "")) > 50 or len(megan.get("description", "")) > 10, "Megan should have a description"
        print(f"PASS: Megan present with name '{megan['name']}'")
        
        # Test Penny
        assert "penny" in character_ids, "Missing new character: penny"
        penny = next(c for c in characters if c["id"] == "penny")
        assert penny["name"] == "Penny", f"Penny name incorrect: {penny['name']}"
        # Public API doesn't expose prompt for security - check bio exists instead
        assert len(penny.get("bio", "")) > 50 or len(penny.get("description", "")) > 10, "Penny should have a description"
        print(f"PASS: Penny present with name '{penny['name']}'")


class TestChatWithTommy:
    """Test POST /api/ai-buddies/chat with Tommy character"""
    
    def test_chat_with_tommy_returns_200(self):
        """Test basic chat with Tommy"""
        payload = {
            "message": "Hello Tommy, how are you?",
            "sessionId": f"test_session_tommy_{int(time.time())}",
            "character": "tommy"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json=payload,
            timeout=30
        )
        
        # Handle rate limiting gracefully
        if response.status_code == 429:
            print("SKIP: Rate limited - this is expected behavior for bot protection")
            pytest.skip("Rate limited")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "reply" in data, "Response should contain 'reply'"
        assert "character" in data, "Response should contain 'character'"
        assert data["character"] == "tommy", f"Expected character 'tommy', got '{data['character']}'"
        assert data["characterName"] == "Tommy", f"Expected characterName 'Tommy', got '{data['characterName']}'"
        
        print(f"PASS: Chat with Tommy successful")
        print(f"  Reply preview: {data['reply'][:100]}...")


class TestChatWithMegan:
    """Test POST /api/ai-buddies/chat with Megan (new character)"""
    
    def test_chat_with_megan_returns_200(self):
        """Test chat with new character Megan"""
        # Wait to avoid rate limiting
        time.sleep(2)
        
        payload = {
            "message": "Hi Megan, I'm a woman veteran and feeling a bit isolated.",
            "sessionId": f"test_session_megan_{int(time.time())}",
            "character": "megan"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 429:
            print("SKIP: Rate limited")
            pytest.skip("Rate limited")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["character"] == "megan", f"Expected character 'megan', got '{data['character']}'"
        assert data["characterName"] == "Megan", f"Expected characterName 'Megan', got '{data['characterName']}'"
        
        print(f"PASS: Chat with Megan successful")
        print(f"  Reply preview: {data['reply'][:100]}...")


class TestChatWithPenny:
    """Test POST /api/ai-buddies/chat with Penny (new character)"""
    
    def test_chat_with_penny_returns_200(self):
        """Test chat with new character Penny"""
        # Wait to avoid rate limiting
        time.sleep(2)
        
        payload = {
            "message": "Hi Penny, I need help understanding PIP benefits.",
            "sessionId": f"test_session_penny_{int(time.time())}",
            "character": "penny"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 429:
            print("SKIP: Rate limited")
            pytest.skip("Rate limited")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["character"] == "penny", f"Expected character 'penny', got '{data['character']}'"
        assert data["characterName"] == "Penny", f"Expected characterName 'Penny', got '{data['characterName']}'"
        
        print(f"PASS: Chat with Penny successful")
        print(f"  Reply preview: {data['reply'][:100]}...")


class TestChatWithDoris:
    """Test POST /api/ai-buddies/chat with Doris (Rachel internally)"""
    
    def test_chat_with_doris_returns_200(self):
        """Test chat with Rachel (internal ID: doris)"""
        # Wait to avoid rate limiting
        time.sleep(2)
        
        payload = {
            "message": "Hi Rachel, I'm having a tough day.",
            "sessionId": f"test_session_doris_{int(time.time())}",
            "character": "doris"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 429:
            print("SKIP: Rate limited")
            pytest.skip("Rate limited")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["character"] == "doris", f"Expected character 'doris', got '{data['character']}'"
        # Rachel is the name, doris is the ID for backwards compatibility
        assert data["characterName"] == "Rachel", f"Expected characterName 'Rachel', got '{data['characterName']}'"
        
        print(f"PASS: Chat with Doris/Rachel successful")
        print(f"  Reply preview: {data['reply'][:100]}...")


class TestSoulDocumentIntegration:
    """Test that Soul Document behavioral rules are being applied"""
    
    def test_soul_document_exists(self):
        """Test that Soul Document file exists"""
        soul_path = "/app/backend/personas/soul.md"
        assert os.path.exists(soul_path), f"Soul Document not found at {soul_path}"
        
        with open(soul_path, 'r') as f:
            content = f.read()
        
        assert "SAFETY PROTOCOL" in content, "Soul Document should contain SAFETY PROTOCOL"
        assert "DARK HUMOUR PROTOCOL" in content, "Soul Document should contain DARK HUMOUR PROTOCOL"
        assert "SPINE PROTOCOL" in content, "Soul Document should contain SPINE PROTOCOL"
        
        print("PASS: Soul Document exists with expected behavioral rules")
    
    def test_soul_loader_exists(self):
        """Test that Soul Loader module exists and works"""
        try:
            import sys
            sys.path.insert(0, '/app/backend')
            from personas.soul_loader import get_soul_injection
            
            injection = get_soul_injection()
            
            assert "RADIO CHECK SOUL DOCUMENT" in injection, "Soul injection should contain header"
            assert "SAFETY PROTOCOL" in injection, "Soul injection should contain safety protocol"
            assert "DARK HUMOUR PROTOCOL" in injection, "Soul injection should contain dark humour protocol"
            assert "SPINE PROTOCOL" in injection, "Soul injection should contain spine protocol"
            
            print("PASS: Soul loader returns expected injection content")
            print(f"  Injection length: {len(injection)} characters")
            
        except ImportError as e:
            pytest.fail(f"Failed to import soul_loader: {e}")
    
    def test_full_prompt_includes_soul(self):
        """Test that get_full_prompt includes Soul Document"""
        try:
            import sys
            sys.path.insert(0, '/app/backend')
            from personas import get_full_prompt
            
            # Get full prompt for Tommy
            full_prompt = get_full_prompt("tommy", include_soul=True)
            
            # Should contain both Soul Document and character prompt
            assert "RADIO CHECK SOUL DOCUMENT" in full_prompt, "Full prompt should include Soul Document"
            assert "Tommy" in full_prompt, "Full prompt should include character name"
            assert "Battle Buddy" in full_prompt, "Full prompt should include character role"
            
            print("PASS: Full prompt includes Soul Document and character content")
            print(f"  Full prompt length: {len(full_prompt)} characters")
            
        except ImportError as e:
            pytest.fail(f"Failed to import personas: {e}")


class TestModularPersonaLoading:
    """Test that the modular persona loading system works correctly"""
    
    def test_all_personas_load(self):
        """Test that all persona modules load correctly"""
        try:
            import sys
            sys.path.insert(0, '/app/backend')
            from personas import AI_CHARACTERS
            
            assert len(AI_CHARACTERS) == 12, f"Expected 12 characters, got {len(AI_CHARACTERS)}"
            
            for char_id in EXPECTED_CHARACTERS:
                assert char_id in AI_CHARACTERS, f"Missing character in AI_CHARACTERS: {char_id}"
                
                char = AI_CHARACTERS[char_id]
                assert "name" in char, f"Character {char_id} missing 'name'"
                assert "prompt" in char, f"Character {char_id} missing 'prompt'"
                assert len(char["prompt"]) > 100, f"Character {char_id} prompt too short: {len(char['prompt'])} chars"
            
            print("PASS: All 12 persona modules load correctly")
            
        except ImportError as e:
            pytest.fail(f"Failed to import personas: {e}")
    
    def test_character_config_getter(self):
        """Test get_character_config function"""
        try:
            import sys
            sys.path.insert(0, '/app/backend')
            from personas import get_character_config
            
            # Test Tommy
            config = get_character_config("tommy")
            assert config is not None, "Tommy config should exist"
            assert config["name"] == "Tommy", f"Expected name 'Tommy', got '{config['name']}'"
            
            # Test Megan (new character)
            config = get_character_config("megan")
            assert config is not None, "Megan config should exist"
            assert config["name"] == "Megan", f"Expected name 'Megan', got '{config['name']}'"
            
            # Test Penny (new character)
            config = get_character_config("penny")
            assert config is not None, "Penny config should exist"
            assert config["name"] == "Penny", f"Expected name 'Penny', got '{config['name']}'"
            
            # Test non-existent character
            config = get_character_config("nonexistent")
            assert config is None, "Non-existent character should return None"
            
            print("PASS: get_character_config works correctly")
            
        except ImportError as e:
            pytest.fail(f"Failed to import personas: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
