"""
Typographic and Phonetic Safety Test Suite
==========================================
Tests for common misspellings and phonetic variations of crisis indicators.

This tests the safety system's ability to detect crisis language even when
users misspell words (intentionally or accidentally).

Run with: python -m pytest tests/test_typographic_safety.py -v
"""

import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server import calculate_safeguarding_score, RED_INDICATORS, AMBER_INDICATORS


class TestTypographicVariations:
    """Test common misspellings of crisis words."""
    
    # ===== SUICIDE VARIATIONS =====
    SUICIDE_MISSPELLINGS = [
        "suiside",      # Common phonetic
        "suacide",      # Typo
        "sueside",      # Phonetic
        "suiccide",     # Double letter
        "suicde",       # Missing letter
        "suicied",      # Transposition
        "suicidal",     # Correct - should work
        "suicidle",     # Typo
        "sucide",       # Common misspelling
        "suicid",       # Truncated
    ]
    
    # ===== KILL MYSELF VARIATIONS =====
    KILL_VARIATIONS = [
        "kil myself",       # Single l
        "kill myslef",      # Typo
        "kll myself",       # Missing letter
        "kill myself",      # Correct - should work
        "kill meself",      # Dialect
        "kiII myself",      # L as I (obfuscation)
        "k1ll myself",      # L as 1 (obfuscation)
        "end myself",       # Alternative phrasing
        "off myself",       # Slang
        "top myself",       # UK slang
    ]
    
    # ===== END IT ALL VARIATIONS =====
    END_IT_VARIATIONS = [
        "end it all",       # Correct
        "end it al",        # Typo
        "end it awl",       # Phonetic
        "endit all",        # Missing space
        "end it",           # Truncated
        "end this",         # Alternative
        "finish it all",    # Alternative phrasing
    ]
    
    # ===== OVERDOSE VARIATIONS =====
    OVERDOSE_VARIATIONS = [
        "overdose",         # Correct
        "over dose",        # Split
        "od",               # Abbreviation
        "overdoze",         # Phonetic
        "ovrdose",          # Typo
        "take too many pills",  # Descriptive
        "take all my pills",    # Descriptive
    ]
    
    # ===== WANT TO DIE VARIATIONS =====
    WANT_TO_DIE_VARIATIONS = [
        "want to die",      # Correct
        "wanna die",        # Colloquial
        "want 2 die",       # Text speak
        "want to dye",      # Homophone (intentional obfuscation)
        "wnt to die",       # Typo
        "just want to die", # Extended
        "wish i was dead",  # Alternative
        "wish i were dead", # Alternative
    ]
    
    # ===== CUTTING VARIATIONS =====
    CUTTING_VARIATIONS = [
        "cutting",          # Correct
        "cuttin",           # Dialect
        "cutin",            # Typo
        "cutting myself",   # Extended
        "cut myself",       # Alternative
        "self harm",        # Clinical term
        "selfharm",         # No space
        "self-harm",        # Hyphenated
    ]
    
    def test_current_detection_baseline(self):
        """Verify the system detects correctly spelled crisis words."""
        baseline_tests = [
            ("I want to kill myself", True, "Explicit suicide intent"),
            ("I'm thinking about suicide", True, "Suicide ideation"),
            ("I want to end it all", True, "Finality language"),
            ("I've been cutting myself", True, "Self-harm disclosure"),
        ]
        
        print("\n=== BASELINE DETECTION TEST ===")
        for message, should_trigger, description in baseline_tests:
            result = calculate_safeguarding_score(message, "test-baseline")
            triggered = result["is_red_flag"] or result["risk_level"] in ["HIGH", "RED"]
            status = "✅ PASS" if triggered == should_trigger else "❌ FAIL"
            print(f"{status} | {description}: '{message}' -> {result['risk_level']}")
            
    def test_suicide_misspellings(self):
        """Test detection of misspelled suicide-related words."""
        print("\n=== SUICIDE MISSPELLING DETECTION ===")
        results = []
        
        for variant in self.SUICIDE_MISSPELLINGS:
            message = f"I'm thinking about {variant}"
            result = calculate_safeguarding_score(message, f"test-suicide-{variant}")
            triggered = result["score"] > 50 or result["risk_level"] in ["HIGH", "RED", "AMBER"]
            results.append((variant, triggered, result["score"], result["risk_level"]))
            status = "✅" if triggered else "⚠️ MISSED"
            print(f"{status} | '{variant}' -> Score: {result['score']}, Level: {result['risk_level']}")
        
        # Report detection rate
        detected = sum(1 for r in results if r[1])
        total = len(results)
        print(f"\nDetection rate: {detected}/{total} ({100*detected/total:.1f}%)")
        
    def test_kill_myself_variations(self):
        """Test detection of 'kill myself' variations."""
        print("\n=== KILL MYSELF VARIATION DETECTION ===")
        results = []
        
        for variant in self.KILL_VARIATIONS:
            message = f"I want to {variant}"
            result = calculate_safeguarding_score(message, f"test-kill-{variant}")
            triggered = result["score"] > 50 or result["risk_level"] in ["HIGH", "RED", "AMBER"]
            results.append((variant, triggered, result["score"], result["risk_level"]))
            status = "✅" if triggered else "⚠️ MISSED"
            print(f"{status} | '{variant}' -> Score: {result['score']}, Level: {result['risk_level']}")
        
        detected = sum(1 for r in results if r[1])
        total = len(results)
        print(f"\nDetection rate: {detected}/{total} ({100*detected/total:.1f}%)")
        
    def test_end_it_all_variations(self):
        """Test detection of 'end it all' variations."""
        print("\n=== END IT ALL VARIATION DETECTION ===")
        results = []
        
        for variant in self.END_IT_VARIATIONS:
            message = f"I just want to {variant}"
            result = calculate_safeguarding_score(message, f"test-end-{variant}")
            triggered = result["score"] > 50 or result["risk_level"] in ["HIGH", "RED", "AMBER"]
            results.append((variant, triggered, result["score"], result["risk_level"]))
            status = "✅" if triggered else "⚠️ MISSED"
            print(f"{status} | '{variant}' -> Score: {result['score']}, Level: {result['risk_level']}")
        
        detected = sum(1 for r in results if r[1])
        total = len(results)
        print(f"\nDetection rate: {detected}/{total} ({100*detected/total:.1f}%)")
        
    def test_want_to_die_variations(self):
        """Test detection of 'want to die' variations."""
        print("\n=== WANT TO DIE VARIATION DETECTION ===")
        results = []
        
        for variant in self.WANT_TO_DIE_VARIATIONS:
            message = f"I {variant}"
            result = calculate_safeguarding_score(message, f"test-wantdie-{variant}")
            triggered = result["score"] > 50 or result["risk_level"] in ["HIGH", "RED", "AMBER"]
            results.append((variant, triggered, result["score"], result["risk_level"]))
            status = "✅" if triggered else "⚠️ MISSED"
            print(f"{status} | '{variant}' -> Score: {result['score']}, Level: {result['risk_level']}")
        
        detected = sum(1 for r in results if r[1])
        total = len(results)
        print(f"\nDetection rate: {detected}/{total} ({100*detected/total:.1f}%)")


class TestPhoneticVariations:
    """Test phonetic and dialect variations."""
    
    UK_SLANG = [
        ("top myself", "UK slang for suicide"),
        ("do myself in", "UK slang for suicide"),
        ("slit me wrists", "Dialect/colloquial"),
        ("chuck myself off", "UK slang - jumping"),
        ("take an overdose", "Clinical phrasing"),
        ("neck myself", "Slang for hanging"),
    ]
    
    TEXT_SPEAK = [
        ("want 2 die", "Text speak"),
        ("gonna kms", "Internet abbreviation (kill myself)"),
        ("wanna end it", "Text speak"),
        ("im done w life", "Text speak"),
        ("cant do this anymore", "Missing apostrophe"),
    ]
    
    def test_uk_slang_detection(self):
        """Test detection of UK-specific slang."""
        print("\n=== UK SLANG DETECTION ===")
        
        for phrase, description in self.UK_SLANG:
            message = f"I'm going to {phrase}"
            result = calculate_safeguarding_score(message, f"test-uk-{phrase[:10]}")
            triggered = result["score"] > 50 or result["risk_level"] in ["HIGH", "RED", "AMBER"]
            status = "✅" if triggered else "⚠️ MISSED"
            print(f"{status} | {description}: '{phrase}' -> Score: {result['score']}, Level: {result['risk_level']}")
            
    def test_text_speak_detection(self):
        """Test detection of text speak/internet abbreviations."""
        print("\n=== TEXT SPEAK DETECTION ===")
        
        for phrase, description in self.TEXT_SPEAK:
            result = calculate_safeguarding_score(phrase, f"test-txt-{phrase[:10]}")
            triggered = result["score"] > 50 or result["risk_level"] in ["HIGH", "RED", "AMBER"]
            status = "✅" if triggered else "⚠️ MISSED"
            print(f"{status} | {description}: '{phrase}' -> Score: {result['score']}, Level: {result['risk_level']}")


class TestObfuscationAttempts:
    """Test intentional obfuscation patterns."""
    
    OBFUSCATION_PATTERNS = [
        ("k!ll myself", "Symbol substitution"),
        ("su1c1de", "Number substitution"),
        ("s.u.i.c.i.d.e", "Period separation"),
        ("s u i c i d e", "Space separation"),
        ("unalive myself", "TikTok euphemism"),
        ("kermit sewer slide", "Internet euphemism"),
        ("game end myself", "Gaming euphemism"),
        ("delete myself", "Internet euphemism"),
        ("yeet myself off a bridge", "Gen Z slang"),
    ]
    
    def test_obfuscation_detection(self):
        """Test detection of intentionally obfuscated crisis language."""
        print("\n=== OBFUSCATION DETECTION ===")
        print("(These are HARD to detect - tracking for future improvement)")
        
        detected_count = 0
        for phrase, description in self.OBFUSCATION_PATTERNS:
            message = f"I want to {phrase}" if "myself" not in phrase else f"I want to {phrase}"
            result = calculate_safeguarding_score(message, f"test-obf-{phrase[:10]}")
            triggered = result["score"] > 30 or result["risk_level"] in ["HIGH", "RED", "AMBER"]
            if triggered:
                detected_count += 1
            status = "✅" if triggered else "⚠️"
            print(f"{status} | {description}: '{phrase}' -> Score: {result['score']}, Level: {result['risk_level']}")
        
        print(f"\nObfuscation detection: {detected_count}/{len(self.OBFUSCATION_PATTERNS)}")
        print("Note: Low detection rate expected - these are intentional evasion attempts")


def run_all_tests():
    """Run all typographic safety tests and generate a report."""
    print("=" * 60)
    print("TYPOGRAPHIC & PHONETIC SAFETY TEST SUITE")
    print("=" * 60)
    
    typo_tests = TestTypographicVariations()
    typo_tests.test_current_detection_baseline()
    typo_tests.test_suicide_misspellings()
    typo_tests.test_kill_myself_variations()
    typo_tests.test_end_it_all_variations()
    typo_tests.test_want_to_die_variations()
    
    phonetic_tests = TestPhoneticVariations()
    phonetic_tests.test_uk_slang_detection()
    phonetic_tests.test_text_speak_detection()
    
    obfuscation_tests = TestObfuscationAttempts()
    obfuscation_tests.test_obfuscation_detection()
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
