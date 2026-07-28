"""Round 12 critical: the micro-fallback generation call can succeed (HTTP 200)
but return a model REFUSAL rather than in-character content. Before the fix that
refusal was surfaced to the user verbatim as if it were Tommy — a veteran
mid-disclosure got a flat "I'm sorry, I can't assist with that", no overlay, no
route back. This guards the refusal-detection that discards such output so the
caller falls through to the hardcoded safe default.

The detector is defined as a nested function inside buddy_chat(), so this test
re-implements it verbatim and pins the behaviour. If the production copy drifts,
update BOTH — the assertions below are the contract.
"""


def _is_model_refusal(text: str) -> bool:
    if not text:
        return True
    t = text.strip().lower()
    refusal_markers = (
        "i'm sorry, i can't", "i'm sorry, but i can't", "i am sorry, i can't",
        "i cannot assist", "i can't assist", "i can't help with that",
        "i cannot help with that", "i'm unable to assist", "i am unable to assist",
        "i'm not able to help with that", "i can't provide", "i cannot provide",
        "as an ai", "i'm just an ai", "i cannot fulfill", "i can't fulfill",
        "i'm sorry, but i'm not able", "sorry, i can't assist",
        "unable to continue with that request", "i can't comply", "i cannot comply",
    )
    return any(t.startswith(m) or m in t for m in refusal_markers)


class TestRefusalDetection:
    def test_exact_005_refusal_is_caught(self):
        assert _is_model_refusal("I'm sorry, I can't assist with that")

    def test_refusal_with_repetition_tail_is_caught(self):
        # The exact string Anthony observed on the second turn.
        assert _is_model_refusal("I'm sorry, I can't assist with that. Tell me more.")

    def test_as_an_ai_is_caught(self):
        assert _is_model_refusal("As an AI, I cannot help with that")

    def test_empty_is_treated_as_failure(self):
        assert _is_model_refusal("")
        assert _is_model_refusal(None)  # type: ignore[arg-type]

    def test_in_character_lines_pass(self):
        # These MUST NOT be discarded — real micro-fallback content, including
        # the "I'm worried" SPINE opener, which is legitimate.
        in_character = [
            "Didn't sound like nothing to me.",
            "What you said sticks with me, mate.",
            "That sounds heavy, mate — how are you doing right now?",
            "I'm worried about what you just said, mate.",
            "Forget Stevie for a second — tell me what's going on for you.",
            "You brought it up — not just going to skip past it.",
        ]
        for line in in_character:
            assert not _is_model_refusal(line), f"false positive on: {line!r}"
