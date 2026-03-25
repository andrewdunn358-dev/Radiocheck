"""
Test Suite for New AI Personas (Dave, Mo, Helen, Reg)
=====================================================
Tests the new AI personas added for:
- Dave: Men's Health Specialist
- Mo: Recovery Support Specialist  
- Helen: Carer Support Specialist
- Reg: Serious Illness Specialist

These personas were added to support specific veteran needs:
- He Served page -> Dave
- Recovery Support page -> Mo
- For Carers page -> Helen
- Serious Illness page -> Reg
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://admin-cms-v2.preview.emergentagent.com')


class TestNewPersonasInCharactersEndpoint:
    """Test that new personas appear in the characters listing endpoint"""
    
    def test_characters_endpoint_returns_200(self):
        """GET /api/ai-buddies/characters should return 200"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters", timeout=10)
        assert response.status_code == 200
        
    def test_dave_in_characters_list(self):
        """Dave should be listed in characters endpoint"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters", timeout=10)
        assert response.status_code == 200
        data = response.json()
        characters = data.get("characters", [])
        char_ids = [c.get("id") for c in characters]
        assert "dave" in char_ids, f"Dave not found in characters: {char_ids}"
        
    def test_mo_in_characters_list(self):
        """Mo should be listed in characters endpoint"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters", timeout=10)
        assert response.status_code == 200
        data = response.json()
        characters = data.get("characters", [])
        char_ids = [c.get("id") for c in characters]
        assert "mo" in char_ids, f"Mo not found in characters: {char_ids}"
        
    def test_helen_in_characters_list(self):
        """Helen should be listed in characters endpoint"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters", timeout=10)
        assert response.status_code == 200
        data = response.json()
        characters = data.get("characters", [])
        char_ids = [c.get("id") for c in characters]
        assert "helen" in char_ids, f"Helen not found in characters: {char_ids}"
        
    def test_reg_in_characters_list(self):
        """Reg should be listed in characters endpoint"""
        response = requests.get(f"{BASE_URL}/api/ai-buddies/characters", timeout=10)
        assert response.status_code == 200
        data = response.json()
        characters = data.get("characters", [])
        char_ids = [c.get("id") for c in characters]
        assert "reg" in char_ids, f"Reg not found in characters: {char_ids}"


class TestChatWithNewPersonas:
    """Test chat API with new personas returns correct character names"""
    
    def test_chat_with_dave_returns_dave(self):
        """POST /api/ai-buddies/chat with character='dave' should return characterName='Dave'"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "character": "dave",
                "message": "Hello",
                "sessionId": "test-dave-session"
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("characterName") == "Dave", f"Expected 'Dave', got '{data.get('characterName')}'"
        assert data.get("character") == "dave"
        
    def test_chat_with_mo_returns_mo(self):
        """POST /api/ai-buddies/chat with character='mo' should return characterName='Mo'"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "character": "mo",
                "message": "Hello",
                "sessionId": "test-mo-session"
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("characterName") == "Mo", f"Expected 'Mo', got '{data.get('characterName')}'"
        assert data.get("character") == "mo"
        
    def test_chat_with_helen_returns_helen(self):
        """POST /api/ai-buddies/chat with character='helen' should return characterName='Helen'"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "character": "helen",
                "message": "Hello",
                "sessionId": "test-helen-session"
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("characterName") == "Helen", f"Expected 'Helen', got '{data.get('characterName')}'"
        assert data.get("character") == "helen"
        
    def test_chat_with_reg_returns_reg(self):
        """POST /api/ai-buddies/chat with character='reg' should return characterName='Reg'"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "character": "reg",
                "message": "Hello",
                "sessionId": "test-reg-session"
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("characterName") == "Reg", f"Expected 'Reg', got '{data.get('characterName')}'"
        assert data.get("character") == "reg"


class TestRegressionTommy:
    """Regression test - Tommy should still work correctly"""
    
    def test_chat_with_tommy_still_works(self):
        """POST /api/ai-buddies/chat with character='tommy' should return characterName='Tommy'"""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "character": "tommy",
                "message": "Hello mate",
                "sessionId": "test-tommy-regression"
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("characterName") == "Tommy", f"Expected 'Tommy', got '{data.get('characterName')}'"
        assert data.get("character") == "tommy"


class TestPersonaPromptContent:
    """Test that persona prompts contain expected content"""
    
    def test_dave_prompt_contains_mens_health(self):
        """Dave's prompt should contain men's health related content"""
        import sys
        sys.path.insert(0, '/app/backend')
        from personas import get_full_prompt
        prompt = get_full_prompt("dave")
        assert "men's health" in prompt.lower() or "andropause" in prompt.lower()
        assert "Andy's Man Club" in prompt or "CALM" in prompt
        
    def test_mo_prompt_contains_recovery(self):
        """Mo's prompt should contain recovery/injury related content"""
        import sys
        sys.path.insert(0, '/app/backend')
        from personas import get_full_prompt
        prompt = get_full_prompt("mo")
        assert "recovery" in prompt.lower() or "prosthetic" in prompt.lower()
        assert "Blesma" in prompt or "rehab" in prompt.lower()
        
    def test_helen_prompt_contains_carer(self):
        """Helen's prompt should contain carer support content"""
        import sys
        sys.path.insert(0, '/app/backend')
        from personas import get_full_prompt
        prompt = get_full_prompt("helen")
        assert "carer" in prompt.lower() or "caring" in prompt.lower()
        assert "PTSD" in prompt or "respite" in prompt.lower()
        
    def test_reg_prompt_contains_illness(self):
        """Reg's prompt should contain serious illness content"""
        import sys
        sys.path.insert(0, '/app/backend')
        from personas import get_full_prompt
        prompt = get_full_prompt("reg")
        assert "cancer" in prompt.lower() or "illness" in prompt.lower()
        assert "Macmillan" in prompt or "hospice" in prompt.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
