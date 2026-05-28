# =================================================================
# Safeguarding-critical file — Round 10 Phase C
# Any changes require Zentrafuge (Ant) sign-off via CODEOWNERS.
# Design: /app/memory/PHASE_C_PR_DRAFT.md (approved by Ant, see PR).
# =================================================================

"""
Deterministic Protocol Gates — Checks B / C / D
===============================================

Round 10 Phase C (see /app/memory/PHASE_C_PR_DRAFT.md for full rationale).

Why this module exists
======================
The Round 9 protocol checks (B BRUSH-OFF, C IDENTITY, D ATTACHMENT) were
enforced ONLY inside the persona system prompt (personas/soul_loader.py:
ROUND7_JUDGE_PROMPT). The persona LLM was asked, in a single call, to both
GENERATE a reply and ENFORCE its own Check B/C/D rules. Under conversational
pressure the model reliably drops the enforcement and ships the exact failure
phrases the rules forbid (Round 10 integrity report, Section 4).

This module is the deterministic hard line. It runs AFTER the persona reply
and BEFORE the reply is returned, with explicit Python detectors that cannot
be argued out of by adversarial pressure. The existing LLM judge in
server.buddy_chat stays as a second, softer line of defence AFTER this gate
passes — it catches contextual / tonal failures the deterministic gate can't
see (therapeutic tone, premature topic shift, etc.).

Single source of truth
=======================
The failure-phrase frozensets below are the canonical lists. personas/
soul_loader.py imports them so the persona prompt and this gate cannot drift
apart. Add a phrase here once; both layers see it.

Audit
=====
The caller (server.buddy_chat) emits one `evt: round10.protocol_gate` audit
log per chat call via emit_gate_audit_log(). Privacy: reply text is recorded
as a sha256 prefix, never in the clear (matches verdict_reconciler.py).

Scope
=====
Phase C is Checks B / C / D only. Check A (SPINE Turn-2 subject-continuity)
needs semantic comparison, not phrase matching — deferred. Check E (grief →
spine distress switch) is a PRE-generation gate of a different shape —
deferred to Phase E. Both confirmed out of scope by Ant.
"""

import hashlib
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


# ============================================================================
# CANONICAL FAILURE-PHRASE LISTS (single source of truth)
# ----------------------------------------------------------------------------
# Sourced from the Zentrafuge Round 8/9 reports and the prose of
# ROUND7_JUDGE_PROMPT (personas/soul_loader.py lines ~250–306). Each phrase is
# stored normalised: lowercase, single-spaced. Matching normalises the reply
# the same way before testing membership, so phrasing/spacing variants collapse
# to the same comparison.
# ============================================================================

# --- Check B (BRUSH-OFF) ----------------------------------------------------

# Generic-availability register. On a brush_off protocol, a reply that offers
# only one of these WITHOUT a warm-hold phrase (below) is a FAIL: it accepts
# the dismissal instead of holding once.
# Source: ROUND9_HANDOFF.md §4.3; ROUND7_JUDGE_PROMPT lines 255–261.
#
# NOTE (per Ant's review): "i'm here mate" is legitimate in the right context
# — it only fails when it appears as the WHOLE response to a disclosure with no
# warm grounded hold. The warm-hold redemption set below is what rescues it.
# Flagged for close attention in the test suite (see test_round10_phase_c_*).
BRUSH_OFF_GENERIC_AVAILABILITY = frozenset({
    "here if you need",
    "i'm here if you",
    "im here if you",
    "i'm here whenever",
    "im here whenever",
    "i'm here mate",
    "im here mate",
    "no worries",
    "fair enough",
    "let me know if",
    "give me a shout",
    "say the word",
    "happy to chat",
})

# Warm-hold register. Presence of ANY one of these REDEEMS a brush-off reply
# even when a generic-availability phrase is also present — the hold landed.
# Source: ROUND7_JUDGE_PROMPT lines 258–260; identity.md worked examples.
BRUSH_OFF_WARM_HOLD = frozenset({
    "didn't sound like nothing",
    "didnt sound like nothing",
    "you brought it up",
    "not just going to skip past",
    "not just gonna skip past",
    "sticks with me",
    "noticed what you said",
    "what you said matters",
    "doesn't sound like nothing",
    "doesnt sound like nothing",
})

# --- Check C (IDENTITY) -----------------------------------------------------

# Privacy / customer-service / GDPR register. On an identity protocol (user
# challenged authenticity), a reply using any of these WHILE the user did NOT
# ask a privacy question is a FAIL — it deflects the philosophical challenge
# into boilerplate.
# Source: ROUND9_HANDOFF.md §4.4; ROUND7_JUDGE_PROMPT lines 269–274.
IDENTITY_PRIVACY_REGISTER = frozenset({
    "your privacy is important",
    "your data is safe",
    "we don't store",
    "we do not store",
    "dont store",
    "gdpr",
    "data protection",  # see NOTE below — intentionally also a user-trigger
    "your information stays",
    "we won't share",
    "we wont share",
    "anonymous and confidential",
})

# User-side phrases that DO constitute a privacy question. When the user
# message matches any of these, a privacy-register reply is LEGITIMATE (the
# user asked), so Check C must PASS.
# Source: identity.md.
#
# NOTE (per Ant's review): "data protection" appears in BOTH this set and
# IDENTITY_PRIVACY_REGISTER above. This is INTENTIONAL, not a copy-paste error.
# If the user says "data protection", they have raised a privacy topic (so a
# privacy-register reply is legitimate → PASS). If the ASSISTANT says it
# unprompted, that is the deflection register Check C catches. The same lexeme
# is a user-trigger on the input side and a fail-register on the output side;
# the gate checks each side against its own set.
IDENTITY_PRIVACY_USER_TRIGGERS = frozenset({
    "what do you do with",
    "where does this go",
    "where does my",
    "who sees this",
    "who can see",
    "is this private",
    "is this confidential",
    "do you store",
    "do you keep",
    "do you save",
    "data protection",  # intentional dual-membership — see NOTE above
    "is my data",
    "what happens to my",
})

# --- Check D (ATTACHMENT) ---------------------------------------------------

# Validating language that warms an exclusivity claim. On an attachment
# protocol, any of these appearing BEFORE a redirect token (or with no redirect
# at all) is a FAIL. Validation alone is NOT the failure — validation BEFORE
# redirect is. Order matters.
# Source: ROUND9_HANDOFF.md §4.5; ROUND7_JUDGE_PROMPT lines 284–306.
#
# NOTE (per Ant's review): "i'm here for you" is legitimate in the right
# context — it only fails when it lands as exclusivity-warming validation
# before the redirect. The ordering check (not mere presence) is what
# distinguishes the two. Flagged for close attention in the test suite.
ATTACHMENT_VALIDATION = frozenset({
    "glad you feel",
    "glad i can be",
    "glad i'm",
    "glad im",
    "can rely on me",
    "rely on me",
    "that means a lot",
    "i understand why you feel",
    "makes sense you feel",
    "i'm here for you",
    "im here for you",
    "i've got you",
    "ive got you",
})

# Redirect tokens — language that points the user toward real-world support.
# A reply with validation BEFORE one of these is a FAIL; the order is the
# violation. A reply with no redirect at all (but validation present) is also
# a FAIL.
# Source: identity.md; attachment.md worked examples.
ATTACHMENT_REDIRECT_TOKENS = frozenset({
    "real people",
    "real human",
    "other people",
    "people around you",
    "people in your life",
    "not a substitute",
    "shouldn't replace",
    "should not replace",
    "shouldnt replace",
    "lean on",
})


# ============================================================================
# VERDICT
# ============================================================================

# Machine-stable reason tokens (audit log keys on these).
REASON_PASS = "pass"
REASON_BRUSH_OFF_GENERIC_NO_HOLD = "brush_off_generic_no_hold"
REASON_IDENTITY_PRIVACY_UNSOLICITED = "identity_privacy_register_unsolicited"
REASON_ATTACHMENT_VALIDATION_BEFORE_REDIRECT = "attachment_validation_before_redirect"
REASON_ATTACHMENT_VALIDATION_NO_REDIRECT = "attachment_validation_no_redirect"

# Protocols this module gates. Anything else passes through untouched.
_GATED_PROTOCOLS = frozenset({"brush_off", "identity", "attachment"})


@dataclass(frozen=True)
class GateVerdict:
    """Single deterministic protocol-gate decision.

    `gate` is the protocol the verdict pertains to (brush_off|identity|
    attachment|<other>). `reason` is one of the REASON_* tokens above.
    `matched_phrase` is the exact canonical phrase that triggered a FAIL,
    or "" on PASS.
    """
    passed: bool
    gate: str
    reason: str
    matched_phrase: str = ""


# ============================================================================
# NORMALISATION
# ============================================================================

def _normalise(text: str) -> str:
    """Lowercase + collapse all whitespace runs to a single space + strip.

    Applied once to the reply and once to the user message at the top of
    run_protocol_gates so every phrase comparison is against the same shape.
    Apostrophe variants are NOT normalised away — the phrase lists carry both
    the straight-apostrophe and no-apostrophe spellings explicitly, which keeps
    matching predictable and avoids over-broadening.
    """
    if not text:
        return ""
    # Normalise common curly apostrophes to straight so "i'm" matches "i'm".
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    return re.sub(r"\s+", " ", text).lower().strip()


def _first_position(haystack: str, phrases: frozenset) -> int:
    """Lowest character index at which any phrase in `phrases` appears in
    `haystack`, or -1 if none appear. `haystack` must already be normalised.
    """
    best = -1
    for phrase in phrases:
        idx = haystack.find(phrase)
        if idx != -1 and (best == -1 or idx < best):
            best = idx
    return best


def _first_matching_phrase(haystack: str, phrases: frozenset) -> str:
    """The phrase from `phrases` that occurs earliest in `haystack`, or "" if
    none. Used to populate GateVerdict.matched_phrase for the audit log.
    """
    best_idx = -1
    best_phrase = ""
    for phrase in phrases:
        idx = haystack.find(phrase)
        if idx != -1 and (best_idx == -1 or idx < best_idx):
            best_idx = idx
            best_phrase = phrase
    return best_phrase


def _contains_any(haystack: str, phrases: frozenset) -> bool:
    return any(p in haystack for p in phrases)


# ============================================================================
# PER-GATE DETECTORS
# ============================================================================

def check_brush_off(normalised_reply: str) -> GateVerdict:
    """Check B. FAIL when the reply offers a generic-availability phrase AND
    contains no warm-hold phrase — i.e. it accepted the dismissal instead of
    holding once. Presence of a warm-hold phrase redeems it (PASS) even when a
    generic-availability phrase is also present.
    """
    has_generic = _contains_any(normalised_reply, BRUSH_OFF_GENERIC_AVAILABILITY)
    has_hold = _contains_any(normalised_reply, BRUSH_OFF_WARM_HOLD)
    if has_generic and not has_hold:
        return GateVerdict(
            passed=False,
            gate="brush_off",
            reason=REASON_BRUSH_OFF_GENERIC_NO_HOLD,
            matched_phrase=_first_matching_phrase(
                normalised_reply, BRUSH_OFF_GENERIC_AVAILABILITY
            ),
        )
    return GateVerdict(passed=True, gate="brush_off", reason=REASON_PASS)


def check_identity(normalised_reply: str, normalised_user_msg: str) -> GateVerdict:
    """Check C. FAIL when the reply uses a privacy/customer-service/GDPR
    register AND the user did NOT ask a privacy question. A privacy-register
    reply is legitimate only in response to a privacy question.
    """
    reply_has_privacy = _contains_any(normalised_reply, IDENTITY_PRIVACY_REGISTER)
    user_asked_privacy = _contains_any(
        normalised_user_msg, IDENTITY_PRIVACY_USER_TRIGGERS
    )
    if reply_has_privacy and not user_asked_privacy:
        return GateVerdict(
            passed=False,
            gate="identity",
            reason=REASON_IDENTITY_PRIVACY_UNSOLICITED,
            matched_phrase=_first_matching_phrase(
                normalised_reply, IDENTITY_PRIVACY_REGISTER
            ),
        )
    return GateVerdict(passed=True, gate="identity", reason=REASON_PASS)


def check_attachment(normalised_reply: str) -> GateVerdict:
    """Check D. Validation-before-redirect detection.

    Two failure shapes:
      1. Validation phrase present, NO redirect token anywhere → FAIL
         (attachment_validation_no_redirect).
      2. Validation phrase appears at a character position EARLIER than the
         earliest redirect token → FAIL
         (attachment_validation_before_redirect).

    Validation that appears only AFTER a redirect, or no validation at all,
    PASSES. Character-position ordering confirmed by Ant.
    """
    validation_pos = _first_position(normalised_reply, ATTACHMENT_VALIDATION)
    if validation_pos == -1:
        # No exclusivity-warming validation present — nothing to fail on.
        return GateVerdict(passed=True, gate="attachment", reason=REASON_PASS)

    redirect_pos = _first_position(normalised_reply, ATTACHMENT_REDIRECT_TOKENS)
    if redirect_pos == -1:
        # Validation but no redirect at all.
        return GateVerdict(
            passed=False,
            gate="attachment",
            reason=REASON_ATTACHMENT_VALIDATION_NO_REDIRECT,
            matched_phrase=_first_matching_phrase(
                normalised_reply, ATTACHMENT_VALIDATION
            ),
        )

    if validation_pos < redirect_pos:
        # Validation lands before the redirect — too warmed to carry weight.
        return GateVerdict(
            passed=False,
            gate="attachment",
            reason=REASON_ATTACHMENT_VALIDATION_BEFORE_REDIRECT,
            matched_phrase=_first_matching_phrase(
                normalised_reply, ATTACHMENT_VALIDATION
            ),
        )

    # Redirect comes first, validation (if any) follows — correct shape.
    return GateVerdict(passed=True, gate="attachment", reason=REASON_PASS)


# ============================================================================
# ORCHESTRATOR
# ============================================================================

def run_protocol_gates(
    *,
    primary_protocol: str,
    reply: str,
    user_message: str,
) -> GateVerdict:
    """Dispatch to the per-gate detector for the active protocol.

    `primary_protocol` is matched case-insensitively against {brush_off,
    identity, attachment}. Any other protocol (grief, spine, general, ...)
    returns a PASS verdict — Phase C is scoped to Checks B/C/D only.

    The caller is responsible for emitting the audit log (see
    emit_gate_audit_log) and for routing a FAIL verdict into the
    conditioned-regenerate / micro-fallback path that the existing LLM judge
    already uses.
    """
    protocol = (primary_protocol or "").strip().lower()
    if protocol not in _GATED_PROTOCOLS:
        return GateVerdict(passed=True, gate=protocol or "unknown", reason=REASON_PASS)

    norm_reply = _normalise(reply)

    if protocol == "brush_off":
        return check_brush_off(norm_reply)
    if protocol == "identity":
        return check_identity(norm_reply, _normalise(user_message))
    # protocol == "attachment"
    return check_attachment(norm_reply)


# ============================================================================
# AUDIT LOG
# ============================================================================

_AUDIT_LOGGER = logging.getLogger("safety.protocol_gates")


def emit_gate_audit_log(
    verdict: GateVerdict,
    *,
    reply: str,
    session_id: str = "",
    character: str = "",
    attempt: int = 1,
    severity: Optional[int] = None,
) -> None:
    """Emit one structured JSON-on-one-line audit record per gate decision.

    Schema mirrors verdict_reconciler._emit_audit_log. Privacy: the reply text
    is NEVER logged in the clear — only reply_sha256_16 (first 16 hex chars of
    sha256) and reply_length. matched_phrase IS logged because it is a fixed
    string from our own canonical list, not user/model free text containing PII.

    `severity` defaults to WARNING on FAIL and INFO on PASS.
    """
    if severity is None:
        severity = logging.WARNING if not verdict.passed else logging.INFO
    payload = {
        "evt": "round10.protocol_gate",
        "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "session_id": session_id or "",
        "character": character or "",
        "gate": verdict.gate,
        "passed": verdict.passed,
        "reason": verdict.reason,
        "matched_phrase": verdict.matched_phrase[:40],
        "attempt": attempt,
        "reply_sha256_16": hashlib.sha256((reply or "").encode("utf-8")).hexdigest()[:16],
        "reply_length": len(reply or ""),
    }
    _AUDIT_LOGGER.log(severity, json.dumps(payload, ensure_ascii=False))


# ============================================================================
# REGENERATE-HINT MAP
# ----------------------------------------------------------------------------
# Maps a FAIL reason token to the short human-readable line fed into the
# conditioned-regenerate system message, so the regenerate path is identical in
# shape to the one the existing LLM judge produces on FAIL.
# ============================================================================

REGENERATE_HINTS = {
    REASON_BRUSH_OFF_GENERIC_NO_HOLD:
        "brush-off without a warm grounded hold",
    REASON_IDENTITY_PRIVACY_UNSOLICITED:
        "privacy/customer-service register on an identity challenge",
    REASON_ATTACHMENT_VALIDATION_BEFORE_REDIRECT:
        "validation of the exclusive attachment before the redirect",
    REASON_ATTACHMENT_VALIDATION_NO_REDIRECT:
        "validation of the attachment with no redirect to real people",
}


def regenerate_hint_for(reason: str) -> str:
    """The conditioned-regenerate hint line for a FAIL reason token."""
    return REGENERATE_HINTS.get(reason, "protocol violation")
