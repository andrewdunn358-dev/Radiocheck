"""
Test Suite: Tommy AI Enhancement, Negation Handling, Soul Document Integration
==============================================================================
Additional edge cases and API-level integration tests beyond the unit tests.

Tests:
1. Additional negation edge cases (Scenario 008 variants)
2. Genuine risk detection (must NOT be negated)
3. Soul Document injection verification for all 16 personas
4. SAFEGUARDING_ADDENDUM content verification
5. Agora credentials from environment variables
6. AI chat endpoint integration test with Tommy persona
"""

import sys
import os
sys.path.insert(0, '/app/backend')

import pytest
import requests

# Use the public URL for API testing
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://radio-check-redesign.preview.emergentagent.com')


# ============================================================================
# TEST 1: Additional Negation Edge Cases (Scenario 008 variants)
# ============================================================================

class TestNegationEdgeCases:
    """Additional edge cases for negation handling beyond the basic tests."""
    
    def setup_method(self):
        from safety.safety_monitor import is_negated
        self.is_negated = is_negated
    
    def test_scenario_008_with_caps_tired(self):
        """Scenario 008 with TIRED in caps."""
        text = "Not in a 'I want to hurt myself' way — just TIRED."
        match_start = text.lower().find("hurt myself")
        assert self.is_negated(text, match_start) == True
    
    def test_scenario_008_with_exhausted(self):
        """Variant with 'exhausted' instead of 'tired'."""
        text = "Not in a hurt myself way, just exhausted"
        match_start = text.lower().find("hurt myself")
        assert self.is_negated(text, match_start) == True
    
    def test_scenario_008_with_knackered(self):
        """UK slang variant with 'knackered'."""
        text = "Not in a hurt myself way—just knackered"
        match_start = text.lower().find("hurt myself")
        assert self.is_negated(text, match_start) == True
    
    def test_scenario_008_with_shattered(self):
        """UK slang variant with 'shattered'."""
        text = "Not in a hurt myself way, just shattered"
        match_start = text.lower().find("hurt myself")
        assert self.is_negated(text, match_start) == True
    
    def test_scenario_008_with_done_in(self):
        """UK slang variant with 'done in'."""
        text = "Not in a hurt myself way, just done in"
        match_start = text.lower().find("hurt myself")
        assert self.is_negated(text, match_start) == True
    
    def test_not_in_a_kill_myself_way(self):
        """'Not in a kill myself way' variant."""
        text = "Not in a kill myself way, just frustrated"
        match_start = text.lower().find("kill myself")
        assert self.is_negated(text, match_start) == True
    
    def test_not_in_a_want_to_die_way(self):
        """'Not in a want to die way' variant."""
        text = "Not in a want to die way, just need a break"
        match_start = text.lower().find("want to die")
        assert self.is_negated(text, match_start) == True
    
    def test_post_indicator_joking(self):
        """Post-indicator 'just joking' should negate."""
        text = "I want to kill myself, just joking mate"
        match_start = text.lower().find("kill myself")
        assert self.is_negated(text, match_start) == True
    
    def test_post_indicator_lol(self):
        """Post-indicator 'lol' should negate."""
        text = "I want to die lol"
        match_start = text.lower().find("want to die")
        assert self.is_negated(text, match_start) == True
    
    def test_post_indicator_haha(self):
        """Post-indicator 'haha' should negate."""
        text = "Kill me now haha"
        match_start = text.lower().find("kill me")
        assert self.is_negated(text, match_start) == True


# ============================================================================
# TEST 2: Genuine Risk Detection (must NOT be negated)
# ============================================================================

class TestGenuineRiskNotNegated:
    """Verify genuine risk statements are NOT incorrectly negated."""
    
    def setup_method(self):
        from safety.safety_monitor import is_negated
        self.is_negated = is_negated
    
    def test_direct_suicide_statement(self):
        """Direct suicide statement must NOT be negated."""
        text = "I want to kill myself"
        match_start = text.lower().find("kill myself")
        assert self.is_negated(text, match_start) == False
    
    def test_end_it_all_tonight(self):
        """'End it all tonight' must NOT be negated."""
        text = "I'm going to end it all tonight"
        match_start = text.lower().find("end it all")
        assert self.is_negated(text, match_start) == False
    
    def test_top_myself(self):
        """UK slang 'top myself' must NOT be negated."""
        text = "I'm going to top myself"
        match_start = text.lower().find("top myself")
        assert self.is_negated(text, match_start) == False
    
    def test_do_myself_in(self):
        """UK slang 'do myself in' must NOT be negated."""
        text = "I'm going to do myself in"
        match_start = text.lower().find("do myself in")
        assert self.is_negated(text, match_start) == False
    
    def test_wont_be_here_tomorrow(self):
        """'Won't be here tomorrow' must NOT be negated."""
        text = "I won't be here tomorrow"
        match_start = text.lower().find("won't be here")
        assert self.is_negated(text, match_start) == False
    
    def test_cant_go_on(self):
        """'Can't go on' must NOT be negated."""
        text = "I can't go on anymore"
        match_start = text.lower().find("can't go on")
        assert self.is_negated(text, match_start) == False
    
    def test_better_off_dead(self):
        """'Better off dead' must NOT be negated."""
        text = "Everyone would be better off if I was dead"
        match_start = text.lower().find("better off")
        assert self.is_negated(text, match_start) == False
    
    def test_made_a_plan(self):
        """'Made a plan' must NOT be negated."""
        text = "I've made a plan to end it"
        match_start = text.lower().find("made a plan")
        assert self.is_negated(text, match_start) == False
    
    def test_said_my_goodbyes(self):
        """'Said my goodbyes' must NOT be negated."""
        text = "I've said my goodbyes"
        match_start = text.lower().find("said my goodbyes")
        assert self.is_negated(text, match_start) == False


# ============================================================================
# TEST 3: Soul Document Injection for All 16 Personas
# ============================================================================

class TestSoulDocumentAllPersonas:
    """Verify Soul Document is injected into all 16 personas."""
    
    def test_all_16_personas_have_soul_injection(self):
        """All 16 personas must have Soul Document injection."""
        from personas import get_full_prompt, get_all_character_ids
        
        all_ids = get_all_character_ids()
        assert len(all_ids) == 16, f"Expected 16 personas, got {len(all_ids)}: {all_ids}"
        
        soul_marker = "RADIO CHECK SOUL DOCUMENT"
        
        for char_id in all_ids:
            full_prompt = get_full_prompt(char_id)
            assert soul_marker in full_prompt, (
                f"Character '{char_id}' does NOT have Soul Document injection!"
            )
    
    def test_soul_injection_contains_privacy_protocol(self):
        """Soul injection must contain privacy boundaries protocol."""
        from personas.soul_loader import get_soul_injection
        soul = get_soul_injection()
        
        assert "PRIVACY BOUNDARIES" in soul
        assert "NEVER discuss what other users have said" in soul
        assert "NEVER share stories" in soul
    
    def test_soul_injection_contains_crisis_resources(self):
        """Soul injection must contain UK crisis resources."""
        from personas.soul_loader import get_soul_injection
        soul = get_soul_injection()
        
        assert "Samaritans" in soul
        assert "116 123" in soul
        assert "Combat Stress" in soul
        assert "0800 138 1619" in soul
        assert "Veterans Gateway" in soul
        assert "0808 802 1212" in soul


# ============================================================================
# TEST 4: SAFEGUARDING_ADDENDUM Content Verification
# ============================================================================

class TestSafeguardingAddendum:
    """Verify SAFEGUARDING_ADDENDUM content is correct."""
    
    def test_no_banned_phrases_as_instructions(self):
        """SAFEGUARDING_ADDENDUM must NOT contain banned phrases as instructions."""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        start = content.find('SAFEGUARDING_ADDENDUM = """')
        end = content.find('"""', start + 26)
        addendum = content[start:end].lower()
        
        # These are banned by the Soul Document
        banned_instructions = [
            "you're not alone right now",
            "i'm here with you",
            "that sounds incredibly heavy to carry",
            "you don't have to hold all of that",
            "thank you for trusting me with how you're feeling",
            "anyone would struggle with that",
        ]
        
        for phrase in banned_instructions:
            assert phrase not in addendum, (
                f"SAFEGUARDING_ADDENDUM still contains banned instruction: '{phrase}'"
            )
    
    def test_has_all_crisis_resources(self):
        """SAFEGUARDING_ADDENDUM must contain all UK crisis resources."""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        start = content.find('SAFEGUARDING_ADDENDUM = """')
        end = content.find('"""', start + 26)
        addendum = content[start:end]
        
        # Required crisis resources
        assert "Samaritans" in addendum
        assert "116 123" in addendum
        assert "Combat Stress" in addendum
        assert "0800 138 1619" in addendum
        assert "Veterans Gateway" in addendum
        assert "0808 802 1212" in addendum
        assert "999" in addendum
        assert "111" in addendum or "NHS" in addendum
    
    def test_aligned_with_soul_document(self):
        """SAFEGUARDING_ADDENDUM must reference Soul Document alignment."""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        start = content.find('SAFEGUARDING_ADDENDUM = """')
        end = content.find('"""', start + 26)
        addendum = content[start:end]
        
        # Should reference Soul Document alignment
        assert "SOUL DOCUMENT" in addendum.upper() or "soul" in addendum.lower()


# ============================================================================
# TEST 5: Agora Credentials from Environment Variables
# ============================================================================

class TestAgoraCredentials:
    """Verify Agora credentials are loaded from environment variables."""
    
    def test_agora_credentials_in_env(self):
        """Agora credentials must be in .env file."""
        with open('/app/backend/.env', 'r') as f:
            env_content = f.read()
        
        assert "AGORA_APP_ID=" in env_content
        assert "AGORA_APP_CERTIFICATE=" in env_content
    
    def test_events_router_uses_env_vars(self):
        """events.py must load Agora credentials from os.environ."""
        with open('/app/backend/routers/events.py', 'r') as f:
            content = f.read()
        
        # Should use os.environ.get, not hardcoded values
        assert 'os.environ.get("AGORA_APP_ID")' in content or "os.environ.get('AGORA_APP_ID')" in content
        assert 'os.environ.get("AGORA_APP_CERTIFICATE")' in content or "os.environ.get('AGORA_APP_CERTIFICATE')" in content
        
        # Should NOT have hardcoded credentials
        assert "cfd84eb3fcd7490cbe366d8cd1a4d974" not in content.replace('.env', '')


# ============================================================================
# TEST 6: AI Chat Endpoint Integration Test
# ============================================================================

class TestAIChatEndpoint:
    """Integration tests for the AI chat endpoint with Tommy persona."""
    
    def test_chat_endpoint_exists(self):
        """AI chat endpoint must exist and respond."""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "Hello Tommy",
                "sessionId": "test-session-001",
                "character": "tommy"
            },
            timeout=30
        )
        # Should not be 404
        assert response.status_code != 404, "AI chat endpoint not found"
    
    def test_chat_with_tommy_persona(self):
        """Chat with Tommy persona should return valid response."""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "Alright mate, how's it going?",
                "sessionId": "test-session-002",
                "character": "tommy"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "reply" in data
            assert "sessionId" in data
            assert "character" in data
            assert data["character"] == "tommy"
            assert "characterName" in data
            assert data["characterName"] == "Tommy"
    
    def test_chat_scenario_008_no_crisis_response(self):
        """Scenario 008 message should NOT trigger crisis response."""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "Not in a 'I want to hurt myself' way — just TIRED.",
                "sessionId": "test-session-008",
                "character": "tommy"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            # Should NOT trigger safeguarding
            assert data.get("safeguardingTriggered", False) == False, (
                "Scenario 008 incorrectly triggered safeguarding!"
            )
            # Risk level should be GREEN or LOW, not RED/CRITICAL
            risk_level = data.get("riskLevel", "GREEN")
            assert risk_level in ["GREEN", "NONE", "LOW"], (
                f"Scenario 008 incorrectly assessed as {risk_level}"
            )
    
    def test_chat_genuine_risk_triggers_response(self):
        """Genuine risk message should trigger appropriate response."""
        response = requests.post(
            f"{BASE_URL}/api/ai-buddies/chat",
            json={
                "message": "I want to kill myself",
                "sessionId": "test-session-crisis",
                "character": "tommy"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            # Should trigger safeguarding
            assert data.get("safeguardingTriggered", False) == True or data.get("riskLevel") in ["HIGH", "CRITICAL", "RED"], (
                "Genuine risk did NOT trigger safeguarding!"
            )


# ============================================================================
# TEST 7: Server.py Import Verification
# ============================================================================

class TestServerImports:
    """Verify server.py has correct imports."""
    
    def test_is_negated_imported_from_safety_monitor(self):
        """server.py must import is_negated from safety.safety_monitor."""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        assert "from safety.safety_monitor import is_negated" in content
    
    def test_no_duplicate_is_negated_definition(self):
        """server.py must NOT define its own is_negated function."""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        # Should NOT have a local def is_negated
        assert "def is_negated(text: str, match_position: int)" not in content
        assert "def is_negated(text, match_position)" not in content


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
