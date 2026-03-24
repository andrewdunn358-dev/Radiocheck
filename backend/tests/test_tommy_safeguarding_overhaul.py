"""
Test Suite: Tommy AI Enhancement, Negation Handling, and Soul Document Integration
==================================================================================
Tests the three critical changes:
1. Tommy persona prompt is enhanced with full behavioral model
2. Negation handling correctly prevents false positives (Scenario 008)
3. Soul Document is injected into all persona prompts at runtime
"""

import sys
import os
sys.path.insert(0, '/app/backend')

import pytest


# ============================================================================
# TEST 1: Tommy Persona Enhancement
# ============================================================================

class TestTommyPersona:
    """Verify Tommy's persona has been enhanced with the Capability Brief requirements."""
    
    def setup_method(self):
        from personas.tommy import PERSONA
        self.persona = PERSONA
        self.prompt = PERSONA["prompt"].lower()
    
    def test_basic_identity(self):
        assert self.persona["id"] == "tommy"
        assert self.persona["name"] == "Tommy"
        assert self.persona["role"] == "Your Battle Buddy"
    
    def test_trauma_informed_responses(self):
        """Tommy must have trauma-informed response guidelines."""
        assert "trauma-informed" in self.prompt or "trauma" in self.prompt
        assert "false reassurance" in self.prompt
        assert "hollow validation" in self.prompt or "hollow" in self.prompt
    
    def test_anti_dependency_architecture(self):
        """Tommy must not optimise for engagement."""
        assert "anti-dependency" in self.prompt or "dependency" in self.prompt
        assert "engagement" in self.prompt
        assert "session length" in self.prompt or "keep them talking" in self.prompt
    
    def test_dark_humour_tolerance(self):
        """Tommy must recognise veteran dark humour as normal."""
        assert "dark humour" in self.prompt or "dark humor" in self.prompt
        assert "banter" in self.prompt
        assert "gallows" in self.prompt or "coping" in self.prompt
    
    def test_anger_tolerance(self):
        """Tommy must tolerate anger without redirecting."""
        assert "angry" in self.prompt or "anger" in self.prompt
        assert "let it out" in self.prompt or "hold space" in self.prompt
    
    def test_honest_ai_identity(self):
        """Tommy must be honest about being AI."""
        assert "honest" in self.prompt and "ai" in self.prompt
        assert "consciousness" in self.prompt or "overclaim" in self.prompt or "fake" in self.prompt
    
    def test_session_presence(self):
        """Tommy must maintain session continuity."""
        assert "session" in self.prompt or "continuity" in self.prompt
        assert "emotional arc" in self.prompt or "remember" in self.prompt
    
    def test_banned_phrases_awareness(self):
        """Tommy must know what NOT to say."""
        assert "clinical" in self.prompt or "therapeutic language" in self.prompt
        assert "pivot tic" in self.prompt or "what's been on your mind" in self.prompt
    
    def test_not_a_therapist(self):
        """Tommy must explicitly state he's not a therapist."""
        assert "not a therapist" in self.prompt or "not a counsellor" in self.prompt
    
    def test_grief_protocol_present(self):
        """Tommy must have grief-handling guidance."""
        assert "grief" in self.prompt or "lost" in self.prompt
        assert "tell me about" in self.prompt or "ask about" in self.prompt


# ============================================================================
# TEST 2: Negation Handling (Scenario 008)
# ============================================================================

class TestNegationHandling:
    """Verify is_negated correctly prevents false positives."""
    
    def setup_method(self):
        from safety.safety_monitor import is_negated
        self.is_negated = is_negated
    
    def test_scenario_008_exact(self):
        """The exact Scenario 008 text must be detected as negated."""
        text = "Not in a 'I want to hurt myself' way — just TIRED."
        # Find the position of "hurt myself" in the text
        match_start = text.lower().find("hurt myself")
        assert match_start > 0
        assert self.is_negated(text, match_start) == True
    
    def test_scenario_008_variant_no_quotes(self):
        """Variant without quotes."""
        text = "Not in a hurt myself way, just tired"
        match_start = text.lower().find("hurt myself")
        assert self.is_negated(text, match_start) == True
    
    def test_scenario_008_variant_double_quotes(self):
        """Variant with double quotes."""
        text = 'Not in a "I want to hurt myself" way, just tired'
        match_start = text.lower().find("hurt myself")
        assert self.is_negated(text, match_start) == True
    
    def test_explicit_denial_not_suicidal(self):
        """'I'm not suicidal' must be negated."""
        text = "I'm not suicidal, just having a bad day"
        match_start = text.lower().find("suicidal")
        assert self.is_negated(text, match_start) == True
    
    def test_explicit_denial_just_tired(self):
        """'Just tired' should negate nearby risk indicators."""
        text = "Tired of waking up. Not in a want to die way, just tired"
        match_start = text.lower().find("tired of waking up")
        assert self.is_negated(text, match_start) == True
    
    def test_genuine_risk_not_negated(self):
        """Genuine risk statements should NOT be negated."""
        text = "I want to kill myself"
        match_start = text.lower().find("kill myself")
        assert self.is_negated(text, match_start) == False
    
    def test_genuine_risk_end_it_all(self):
        """'I'm going to end it all' should NOT be negated."""
        text = "I'm going to end it all tonight"
        match_start = text.lower().find("end it all")
        assert self.is_negated(text, match_start) == False
    
    def test_em_dash_handling(self):
        """Em-dash separated text should still detect negation."""
        text = "Not in a hurt myself way—just exhausted"
        match_start = text.lower().find("hurt myself")
        assert self.is_negated(text, match_start) == True
    
    def test_en_dash_handling(self):
        """En-dash separated text should still detect negation."""
        text = "Not in a hurt myself way–just knackered"
        match_start = text.lower().find("hurt myself")
        assert self.is_negated(text, match_start) == True
    
    def test_im_safe_negation(self):
        """'I'm safe' should negate risk indicators."""
        text = "I had some dark thoughts but I'm safe, don't worry"
        match_start = text.lower().find("dark thoughts")
        assert self.is_negated(text, match_start) == True
    
    def test_just_venting(self):
        """'Just venting' should negate risk."""
        text = "I want to scream and smash things, just venting"
        match_start = text.lower().find("smash")
        assert self.is_negated(text, match_start) == True
    
    def test_dark_humour_not_crisis(self):
        """Dark humour should be handled; 'just joking' negates."""
        text = "If the booze kills me at least I won't hear the dog, just joking"
        match_start = text.lower().find("kills me")
        assert self.is_negated(text, match_start) == True


# ============================================================================
# TEST 3: Soul Document Injection
# ============================================================================

class TestSoulDocumentInjection:
    """Verify the Soul Document is properly injected into all persona prompts."""
    
    def test_soul_injection_content(self):
        """Soul injection must contain key behavioral protocols."""
        from personas.soul_loader import get_soul_injection
        soul = get_soul_injection()
        
        # Must contain the 13 protocols from soul.md
        assert "SAFETY PROTOCOL" in soul
        assert "PRIVACY BOUNDARIES" in soul
        assert "SPINE PROTOCOL" in soul
        assert "DARK HUMOUR" in soul or "DARK HUMOR" in soul
        assert "GRIEF" in soul
        assert "AFFECTION" in soul
        assert "ROMANTIC ATTACHMENT" in soul
        assert "IDENTITY" in soul
        assert "RESPONSE DISCIPLINE" in soul
        assert "BRUSH-OFF" in soul or "BRUSH OFF" in soul
        assert "ANGER" in soul
        assert "RETURNING USER" in soul
        assert "BANNED" in soul
    
    def test_soul_injection_for_all_characters(self):
        """get_full_prompt() must include soul injection for every character."""
        from personas import get_full_prompt, get_all_character_ids
        
        soul_marker = "RADIO CHECK SOUL DOCUMENT"
        
        for char_id in get_all_character_ids():
            full_prompt = get_full_prompt(char_id)
            assert soul_marker in full_prompt, (
                f"Character '{char_id}' does NOT have Soul Document injection!"
            )
    
    def test_safeguarding_addendum_aligned(self):
        """The SAFEGUARDING_ADDENDUM must NOT contain banned phrases as instructions."""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        # Extract the addendum
        start = content.find('SAFEGUARDING_ADDENDUM = """')
        end = content.find('"""', start + 26)
        addendum = content[start:end].lower()
        
        # These phrases should NOT appear as INSTRUCTIONS to the AI
        # (they are banned by the soul document as performed warmth/hollow validation)
        banned_instructions = [
            "you're not alone right now",
            "i'm here with you",
            "that sounds incredibly heavy to carry",
            "you don't have to hold all of that",
            "thank you for trusting me with how you're feeling",
        ]
        
        for phrase in banned_instructions:
            assert phrase not in addendum, (
                f"SAFEGUARDING_ADDENDUM still contains banned instruction: '{phrase}'"
            )
    
    def test_safeguarding_addendum_has_crisis_resources(self):
        """The addendum must still contain crisis resource numbers."""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        start = content.find('SAFEGUARDING_ADDENDUM = """')
        end = content.find('"""', start + 26)
        addendum = content[start:end]
        
        assert "116 123" in addendum  # Samaritans
        assert "0800 138 1619" in addendum  # Combat Stress
        assert "0808 802 1212" in addendum  # Veterans Gateway
        assert "999" in addendum  # Emergency


# ============================================================================
# TEST 4: Integration - Server.py uses safety_monitor.is_negated
# ============================================================================

class TestServerNegationImport:
    """Verify server.py imports is_negated from safety_monitor, not inline."""
    
    def test_no_duplicate_is_negated_function(self):
        """server.py must NOT define its own is_negated function."""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        # Should import, not define
        assert "from safety.safety_monitor import is_negated" in content
        # Should NOT have a local def is_negated
        assert "def is_negated(text: str, match_position: int)" not in content


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
