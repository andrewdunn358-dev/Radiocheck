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


DEFERRED_CLEAR_MARKER = "# === Session 4 Scope 1: resolve grief lifecycle ONCE"


def test_grief_subject_is_cleared_when_the_episode_ends():
    """The pivot scenario involves no crisis language: the episode simply
    ends, grief_active_turns reaches 0, and the name persists. Clearing only
    on crisis_override would not address it.

    Session 4 Scope 1 (Ant, 15 Sept): the clear is no longer performed
    mid-turn inside the END-OF-EPISODE block — doing so after grief.md had
    already been injected produced a STATE SYNCHRONISATION FAILURE observed
    live (protocol_state read turn 0 / grief_opening on the closing turn).
    The episode-end block now sets grief_pending_clear, and the clear itself
    runs at the START of the next turn. The property this test protects —
    the subject does not persist past the episode — is unchanged; the
    location of the code that enforces it has moved. Updated rather than
    silently rewritten, per Ant's instruction on corrections.
    """
    src = _read()
    end_block = _block(src, "# === Round 12: END-OF-EPISODE CLEAR-DOWN ===")
    assert "if session['grief_active_turns'] == 0:" in end_block
    assert "session['grief_pending_clear'] = True" in end_block, (
        "episode end must schedule the clear"
    )
    assert "session['grief_name'] = None" not in end_block, (
        "the mid-turn clear is back — that is the desync Scope 1 removed"
    )
    clear_block = _block(src, DEFERRED_CLEAR_MARKER)
    assert "session.pop('grief_pending_clear', False)" in clear_block
    assert "session['grief_name'] = None" in clear_block
    assert "session['grief_pronoun'] = None" in clear_block


def test_grief_turn_count_resets_with_the_subject():
    """grief_turn_count feeds current_protocol_turn, which feeds
    classify_situation(protocol, turn, msg). If it never resets, a SECOND
    grief episode in the same session starts at turn N rather than turn 1 -
    so classify_situation returns grief_mid instead of grief_opening, and the
    micro-prompt takes its 'Turn 2+ -> continue memory' branch on what is
    actually a fresh disclosure."""
    src = _read()
    # Session 4 Scope 1: the episode-end reset moved to the deferred clear at
    # turn start (see test_grief_subject_is_cleared_when_the_episode_ends).
    for marker in ("# Clear grief tracking",
                   DEFERRED_CLEAR_MARKER):
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



def test_second_grief_episode_starts_at_turn_one():
    """The property the source-text tests above exist to protect, asserted
    directly through the hash-guarded transcription of the state machine:
    after an episode ends and a non-grief turn passes, a fresh disclosure
    starts a NEW episode at turn 1 with no leftover subject."""
    from tests.differential.runtime_chain import apply_pre_scoring_state
    from personas.soul_loader import get_protocol_files, extract_grief_name

    session, states = {}, []
    for m in [
        "Lost my dad Dave last month, funeral was last week",
        "see you later then",
        "still not been sleeping much",          # episode ends here (deferred)
        "anyway, what is the weather like",       # clear applied at this turn start
        "Recently lost my mum, she passed on Sunday",   # fresh episode
    ]:
        tr = apply_pre_scoring_state(
            message=m, session=session,
            protocol_files=list(get_protocol_files(m) or []),
            extract_grief_name=extract_grief_name)
        states.append(dict(tr.state_after))

    fresh = states[4]
    assert fresh["grief_active_turns"] == 2
    assert fresh["grief_turn_count"] == 1, (
        f"second episode started at turn {fresh['grief_turn_count']}, not 1 - "
        "classify_situation would return grief_mid on a fresh disclosure"
    )
    assert fresh["grief_name"] != "Dave", "previous episode's subject leaked"
    assert fresh["grief_pronoun"] == "she"
