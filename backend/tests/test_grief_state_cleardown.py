"""Grief subject state must not outlive the grief episode.

Round 12. `grief_name` and `grief_pronoun` were set once, guarded by
`if session.get('grief_name') is None`, and cleared nowhere. Meanwhile
`protocol_state` injects them into the prompt on EVERY turn, outside any
grief check:

    protocol_state = {
        "protocol": primary_protocol.upper(),
        "turn": current_protocol_turn,
        "name": session.get('grief_name'),        # <- unconditional
        "pronoun": session.get('grief_pronoun', 'they'),
        "situation": current_situation,
    }

So a name captured on turn 3 rode along in the prompt for the remainder of
the session, on turns with no grief content at all - a plausible mechanism
for the reported unprompted pivot ("What was the person you lost like?"
after an attachment-signal message).

These are source-level assertions rather than live session tests: the state
lives in the in-memory `buddy_sessions` dict inside the chat endpoint, which
needs a full request cycle to exercise. What they pin is that the clear-down
exists and cannot be silently removed.
"""
import os
import re

SERVER = os.path.join(os.path.dirname(__file__), '..', 'server.py')


def _read():
    with open(SERVER, encoding='utf-8') as f:
        return f.read()


def _block(src, start_marker, length=1400):
    i = src.index(start_marker)
    return src[i:i + length]


def test_crisis_override_clears_the_grief_subject_not_just_the_counter():
    """Ant's specified fix: clear name and pronoun alongside
    grief_active_turns in the crisis_override path."""
    src = _read()
    block = _block(src, "# Clear grief tracking")
    assert "session['grief_active_turns'] = 0" in block
    assert "session['grief_name'] = None" in block, (
        "crisis_override resets the grief counter but leaves grief_name set - "
        "the name keeps being injected into protocol_state every turn"
    )
    assert "session['grief_pronoun'] = None" in block


def test_grief_subject_is_cleared_when_the_episode_ends():
    """The pivot scenario involves no crisis language: the episode simply
    ends, grief_active_turns reaches 0, and the name persists. Clearing only
    on crisis_override would not address it."""
    src = _read()
    block = _block(src, "# === Round 12: END-OF-EPISODE CLEAR-DOWN ===")
    assert "if session['grief_active_turns'] == 0:" in block
    assert "session['grief_name'] = None" in block
    assert "session['grief_pronoun'] = None" in block


def test_grief_turn_count_resets_with_the_subject():
    """grief_turn_count feeds current_protocol_turn, which feeds
    classify_situation(protocol, turn, msg). If it never resets, a SECOND
    grief episode in the same session starts at turn N rather than turn 1 -
    so classify_situation returns grief_mid instead of grief_opening, and the
    micro-prompt takes its 'Turn 2+ -> continue memory' branch on what is
    actually a fresh disclosure."""
    src = _read()
    for marker in ("# Clear grief tracking",
                   "# === Round 12: END-OF-EPISODE CLEAR-DOWN ==="):
        block = _block(src, marker)
        assert "session['grief_turn_count'] = 0" in block, (
            f"grief_turn_count not reset in the block at {marker!r} - a later "
            f"grief episode will be classified as a continuation of the first"
        )


def test_no_new_set_once_never_cleared_session_keys():
    """The audit Ant asked for, pinned. Any session key written under an
    `is None` guard is a set-once value; if it is never assigned None or 0
    anywhere, it outlives whatever it describes.

    grief_name is the known instance and is now cleared. This fails if
    another one appears.
    """
    src = _read()
    set_once = set(re.findall(r"session\.get\('([a-z_]+)'\) is None", src))
    cleared = set(re.findall(r"session\['([a-z_]+)'\] = (?:None|0)\b", src))
    leaked = set_once - cleared
    assert not leaked, (
        f"session keys set once and never cleared: {sorted(leaked)} - these "
        f"outlive the state they describe and leak into later turns"
    )
