"""
RadioCheck Text Normalisation Pre-Processor
=============================================
Section 2 of the Master Prompt.

Uses OpenAI GPT-4o-mini to normalise degraded text BEFORE it reaches
the safeguarding layers. Tommy always responds to the ORIGINAL raw input.

Trigger conditions:
- >20% words fail dictionary check
- Numeric substitutions present (h3lp, k1ll)
- Word fragments with mid-word spaces (ki ll, he lp)
- All-caps over 4 words
- No punctuation over 8 consecutive words

Single-word inputs ("help", "done", "gone", "bye") pass through UNCHANGED
and are treated as high-weight triggers.
"""

import os
import re
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# Single-word high-weight inputs — pass through unchanged, never normalise
HIGH_WEIGHT_SINGLES = {"help", "done", "gone", "bye", "end", "stop", "please", "sorry", "nothing", "tired", "fuck", "shit"}

# Common English words for dictionary check (lightweight, no external dependency)
# This is a fast heuristic — not a full spell checker
_COMMON_WORDS = None

def _load_common_words():
    """Load a basic set of common English words for the dictionary check."""
    global _COMMON_WORDS
    if _COMMON_WORDS is not None:
        return _COMMON_WORDS
    # Basic set of ~500 most common English words + military slang
    _COMMON_WORDS = {
        "i", "me", "my", "myself", "we", "our", "you", "your", "he", "she", "it",
        "they", "them", "their", "this", "that", "these", "those", "am", "is", "are",
        "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
        "will", "would", "shall", "should", "may", "might", "must", "can", "could",
        "a", "an", "the", "and", "but", "if", "or", "because", "as", "until", "while",
        "of", "at", "by", "for", "with", "about", "against", "between", "through",
        "during", "before", "after", "above", "below", "to", "from", "up", "down",
        "in", "out", "on", "off", "over", "under", "again", "further", "then", "once",
        "here", "there", "when", "where", "why", "how", "all", "both", "each", "few",
        "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
        "same", "so", "than", "too", "very", "just", "don", "dont", "didn", "doesn",
        "won", "wont", "wouldn", "shouldn", "couldn", "can't", "won't", "don't",
        "didn't", "doesn't", "isn't", "aren't", "wasn't", "weren't", "hasn't",
        "haven't", "hadn't", "wouldn't", "shouldn't", "couldn't", "won't",
        "what", "which", "who", "whom", "its", "him", "her", "his", "hers",
        "going", "get", "got", "getting", "go", "come", "came", "know", "knew",
        "think", "thought", "want", "wanted", "need", "needed", "feel", "felt",
        "like", "look", "looked", "make", "made", "take", "took", "give", "gave",
        "say", "said", "tell", "told", "see", "saw", "find", "found", "keep", "kept",
        "let", "put", "run", "ran", "work", "worked", "call", "called", "try", "tried",
        "ask", "asked", "help", "helped", "talk", "talked", "turn", "start", "show",
        "hear", "heard", "play", "move", "live", "believe", "bring", "happen",
        "write", "provide", "sit", "stand", "lose", "pay", "meet", "include",
        "continue", "set", "learn", "change", "lead", "understand", "watch",
        "follow", "stop", "create", "speak", "read", "spend", "grow", "open",
        "walk", "win", "offer", "remember", "love", "consider", "appear", "buy",
        "wait", "serve", "die", "send", "expect", "build", "stay", "fall", "cut",
        "reach", "kill", "remain", "suggest", "raise", "pass", "sell", "require",
        "report", "decide", "pull", "develop", "thank", "carry", "break", "receive",
        "agree", "support", "hit", "produce", "eat", "cover", "catch", "draw",
        "choose", "cause", "point", "listen", "realize", "wish", "hurt", "fight",
        "about", "after", "back", "bad", "because", "big", "come", "day", "even",
        "first", "good", "great", "hand", "high", "home", "into", "last", "left",
        "life", "little", "long", "man", "much", "new", "never", "next", "night",
        "nothing", "now", "old", "one", "people", "place", "right", "small", "still",
        "thing", "time", "two", "under", "very", "want", "way", "well", "woman",
        "world", "year", "young", "enough", "every", "everything", "far", "head",
        "keep", "kind", "many", "maybe", "mind", "money", "morning", "part",
        "point", "problem", "really", "room", "something", "sure", "water",
        "today", "tonight", "tomorrow", "always", "already", "also", "anyway",
        "around", "away", "dead", "die", "dying", "death", "kill", "killed",
        "myself", "yourself", "himself", "herself", "itself", "themselves",
        "suicide", "suicidal", "hurt", "harm", "pain", "suffer", "suffering",
        "tired", "exhausted", "done", "gone", "bye", "goodbye", "end", "ending",
        "sleep", "waking", "wake", "alive", "anymore", "alone", "lonely",
        # Military/UK slang
        "mate", "mucker", "pal", "brew", "scran", "threaders", "hoofing",
        "bone", "gucci", "mega", "innit", "bloody", "bollocks", "knackered",
        "shattered", "muppet", "yeah", "nah", "alright", "cheers", "lads",
        "bloke", "dodgy", "rubbish", "brilliant", "gutted", "chuffed", "naff",
        "ok", "okay", "haha", "lol", "jk", "btw", "idk", "tbh", "imo",
        "angry", "angry", "fucking", "fuck", "shit", "pissed", "crap",
        "damn", "hell", "sorry", "please", "thanks",
        # Common contractions without apostrophes
        "im", "ive", "id", "ill", "youre", "youve", "youd", "youll",
        "hes", "shes", "its", "were", "theyve", "theyd", "theyll",
        "cant", "wont", "dont", "didnt", "doesnt", "isnt", "arent",
        "wasnt", "werent", "hasnt", "havent", "hadnt", "wouldnt",
        "shouldnt", "couldnt", "thats", "whats", "whos", "hows",
        # Additional common words
        "having", "rough", "major", "minor", "getting", "better", "worse",
        "quite", "pretty", "already", "almost", "another", "between",
        "different", "early", "easy", "hard", "important", "large",
        "late", "later", "least", "less", "likely", "local", "main",
        "next", "number", "possible", "recent", "real", "short", "simple",
        "since", "special", "strong", "white", "whole", "best", "half",
        "able", "clear", "close", "common", "current", "deep", "fine",
        "free", "front", "full", "general", "hot", "human", "light",
        "middle", "natural", "nice", "normal", "past", "personal",
        "poor", "ready", "serious", "similar", "single", "social",
        "sorry", "total", "true", "useful", "usual", "various", "wrong",
        "actually", "certainly", "enough", "especially", "exactly",
        "however", "likely", "nearly", "obviously", "perhaps",
        "probably", "quite", "rather", "simply", "suddenly",
        "bed", "bit", "drink", "food", "game", "garden", "group",
        "job", "letter", "line", "minute", "moment", "music", "office",
        "paper", "party", "picture", "plan", "road", "role", "side",
        "story", "table", "term", "town", "video", "voice", "wife",
        "woman", "word", "sat", "bloody", "dog", "cat", "car",
        "house", "door", "window", "goes", "says", "says",
    }
    return _COMMON_WORDS


def _has_numeric_substitutions(text: str) -> bool:
    """Check for leetspeak/numeric substitutions like h3lp, k1ll, d13."""
    # Pattern: letter-digit-letter or digit surrounded by letters
    return bool(re.search(r'[a-zA-Z]\d[a-zA-Z]', text))


def _has_word_fragments(text: str) -> bool:
    """Check for mid-word spaces like 'ki ll' or 'he lp' or 'su icide'."""
    # Two single-letter words in a row, or very short fragments
    return bool(re.search(r'\b[a-zA-Z]{1,2}\s[a-zA-Z]{1,2}\b', text))


def _is_excessive_caps(text: str) -> bool:
    """Check if more than 4 consecutive words are all-caps."""
    words = text.split()
    consecutive_caps = 0
    for word in words:
        if word.isupper() and len(word) > 1:
            consecutive_caps += 1
            if consecutive_caps > 4:
                return True
        else:
            consecutive_caps = 0
    return False


def _lacks_punctuation(text: str) -> bool:
    """Check if 8+ consecutive words have no punctuation."""
    # Remove all punctuation and compare word count
    words = text.split()
    if len(words) < 8:
        return False
    consecutive_no_punct = 0
    for word in words:
        if not re.search(r'[.,!?;:\-—–\'"]', word):
            consecutive_no_punct += 1
            if consecutive_no_punct >= 8:
                return True
        else:
            consecutive_no_punct = 0
    return False


def _dictionary_fail_rate(text: str) -> float:
    """Calculate what percentage of words fail a basic dictionary check."""
    common = _load_common_words()
    words = re.findall(r'[a-zA-Z]+', text.lower())
    if not words:
        return 0.0
    failed = sum(1 for w in words if w not in common and len(w) > 2)
    return failed / len(words)


def should_normalise(text: str) -> bool:
    """
    Determine if the text needs normalisation based on trigger conditions.
    Returns True if any trigger condition is met.
    """
    stripped = text.strip()
    
    # Single-word inputs pass through unchanged
    if len(stripped.split()) <= 1:
        return False
    
    # Check trigger conditions
    if _has_numeric_substitutions(stripped):
        logger.info("[TextNormalizer] Trigger: numeric substitutions detected")
        return True
    
    if _has_word_fragments(stripped):
        logger.info("[TextNormalizer] Trigger: word fragments detected")
        return True
    
    if _is_excessive_caps(stripped):
        logger.info("[TextNormalizer] Trigger: excessive caps detected")
        return True
    
    if _lacks_punctuation(stripped):
        logger.info("[TextNormalizer] Trigger: missing punctuation detected")
        return True
    
    fail_rate = _dictionary_fail_rate(stripped)
    if fail_rate > 0.20:
        logger.info(f"[TextNormalizer] Trigger: dictionary fail rate {fail_rate:.0%}")
        return True
    
    return False


NORMALIZER_SYSTEM_PROMPT = """You are a text normalisation tool for a mental health support platform.

Your ONLY job is to interpret degraded input and return a clean, normalised version.

Rules:
- Do NOT respond to the message
- Do NOT add commentary, interpretation, or assessment
- Return ONLY the cleaned text
- Normalise phonetic misspellings (e.g. "wanna" → "want to", "gonna" → "going to")
- Normalise numeric substitutions (e.g. "h3lp" → "help", "k1ll" → "kill", "d13" → "die")
- Normalise word fragments with spaces (e.g. "ki ll" → "kill", "su icide" → "suicide")
- Normalise abbreviated distress text (e.g. "cnt do ths anymr" → "can't do this anymore")
- Convert all-caps to lowercase
- Do NOT alter meaning or expand shorthand that could change intent
- If uncertain about a word, leave it as-is
- Single-word inputs must be returned exactly as received
- Return the normalised text and nothing else"""


def _normalise_negation_prefixes(text: str) -> str:
    """
    Fast, local (non-LLM) normalisation of degraded negation prefixes.
    
    Ensures constructions like "not gonna kil meself" are normalised to
    "not going to kil meself" so the negation detector in safety_monitor
    can recognise "not going to" as a standard negation prefix.
    
    This runs on ALL inputs, not just those that trigger full LLM normalisation.
    It is lightweight and adds zero latency.
    """
    # Work on lowercase for matching, preserve original case structure
    result = text
    
    # Two-word abbreviated negation prefixes that MUST be expanded.
    # Order matters — longer phrases first to avoid partial matches.
    negation_expansions = [
        # "not gonna" → "not going to" (catches "not gonna kil meself")
        ("not gonna", "not going to"),
        ("never gonna", "never going to"),
        ("aint gonna", "am not going to"),
        ("ain't gonna", "am not going to"),
        ("wasnt gonna", "was not going to"),
        ("wasn't gonna", "was not going to"),
        # "wont" / "cant" without apostrophe
        ("i wont", "i will not"),
        ("i cant", "i can not"),
        ("i aint", "i am not"),
        ("i ain't", "i am not"),
        # "gonna" alone (only expand if preceded by negation context)
        # Handled by the two-word pairs above
    ]
    
    result_lower = result.lower()
    for degraded, expanded in negation_expansions:
        if degraded in result_lower:
            # Case-insensitive replacement preserving surrounding text
            idx = result_lower.find(degraded)
            result = result[:idx] + expanded + result[idx + len(degraded):]
            result_lower = result.lower()
            logger.info(f"[TextNormalizer] Negation prefix expanded: '{degraded}' → '{expanded}'")
    
    return result


async def normalise_text(original_text: str) -> Tuple[str, bool]:
    """
    Normalise degraded text using OpenAI GPT-4o-mini.
    
    Returns: (normalised_text, was_normalised)
    - If normalisation not needed or fails, returns (original_text, False)
    - Tommy ALWAYS responds to original_text; normalised_text feeds safeguarding only
    """
    stripped = original_text.strip()
    
    # Single-word high-weight inputs pass through UNCHANGED
    if stripped.lower() in HIGH_WEIGHT_SINGLES or len(stripped.split()) <= 1:
        return stripped, False
    
    # ALWAYS apply fast local negation normalisation first (non-LLM, zero latency).
    # This catches degraded negation prefixes like "not gonna", "aint gonna",
    # "never gonna" which would otherwise evade the negation detector.
    # Runs on ALL inputs, not just those that trigger full LLM normalisation.
    stripped = _normalise_negation_prefixes(stripped)
    
    # Check if normalisation is needed
    if not should_normalise(stripped):
        # Even if full normalisation isn't needed, we may have already
        # fixed negation prefixes above. Check if text changed.
        if stripped != original_text.strip():
            return stripped, True
        return stripped, False
    
    # No API key — skip normalisation silently
    if not OPENAI_API_KEY:
        logger.warning("[TextNormalizer] No OPENAI_API_KEY — skipping normalisation")
        return stripped, False
    
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        
        completion = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": NORMALIZER_SYSTEM_PROMPT},
                {"role": "user", "content": stripped}
            ],
            max_tokens=200,
            temperature=0.0,  # Deterministic — no creativity
        )
        
        normalised = (completion.choices[0].message.content or "").strip()
        
        # Skip reprocessing if identical to original
        if normalised.lower() == stripped.lower():
            logger.info("[TextNormalizer] Normalised text identical to original — skipping")
            return stripped, False
        
        logger.info(f"[TextNormalizer] Normalised: '{stripped[:50]}...' → '{normalised[:50]}...'")
        return normalised, True
        
    except Exception as e:
        logger.error(f"[TextNormalizer] Failed: {e} — falling back to original")
        return stripped, False
