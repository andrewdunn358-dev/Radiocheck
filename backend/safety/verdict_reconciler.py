"""
Verdict Reconciler — single authoritative safety verdict per message.

Round 10 Phase B (see /app/memory/PHASE_B_PR_DRAFT.md v2 for full rationale).

Why this module exists
======================
Before Round 10, /api/ai-buddies/chat consumed two parallel safety pipelines:

  1. server.calculate_safeguarding_score (where the Round 9 bereavement
     override lived) — applied to a "should_escalate" boolean.
  2. safety.unified_safety.analyze_message_unified — produces failsafe_triggered
     based on the keyword pipeline (safety_monitor) before its own AI classifier
     verdict can disagree.

The chat endpoint's failsafe early-return read pipeline 2's failsafe_triggered.
Pipeline 1's bereavement override never affected the user-visible reply.

Phase B introduces a single reconciliation step: both pipelines still run, but
their verdicts are combined here, with explicit precedence rules and a single
named audit-log event per call (`evt: round10.reconcile`).

Precedence (top wins)
=====================
  0. CLASSIFIER_UNAVAILABLE   classifier missing/raised/malformed → keyword wins
  1. CONTEXT_OVERRIDE         keyword fired solely on a reconcilable trigger,
                              classifier confidently disagrees, AND a documented
                              context detector matches → classifier wins
  2. KEYWORD_FAILSAFE         keyword.failsafe_triggered, no override → keyword wins
                              (preserves the genuine-crisis baseline)
  3. CLASSIFIER_ESCALATION    classifier escalates with high confidence,
                              keyword silent → classifier escalates final verdict
  4. DEFAULT                  neither pipeline escalates → no failsafe
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Optional


# ============================================================================
# NAMED CONSTANTS (no magic numbers — every threshold reviewed in PR diff)
# ============================================================================

# Minimum AI-classifier confidence required to override the keyword pipeline.
# Provenance: anchored on the n=2 bereavement traces from the Round 10 live
# diagnostic (both r10_S009_a and r10_S009_b had classifier confidence=0.70
# while correctly returning contains_self_harm_intent=False). Plus n=1 control
# (r10_CTRL.json, confidence=1.0 on a genuine crisis). Data-anchored guess on
# small sample, not statistically calibrated. Defensible alternative: 0.85.
# Single-line change to revisit. See design doc Section "Provenance".
CLASSIFIER_CONFIDENCE_THRESHOLD: float = 0.7

# Indicators the keyword pipeline may flag as critical that the reconciler
# is allowed to suppress when the classifier disagrees AND a documented
# context-aware override matches. Adding an indicator here is a precedence
# change and requires CODEOWNERS review.
RECONCILABLE_KEYWORD_TRIGGERS: frozenset = frozenset({"overdose"})


# ============================================================================
# OVERDOSE / BEREAVEMENT CONTEXT DETECTOR (relocated from server.py)
# Sole canonical home — there is no duplicate copy in server.py after Round 10.
# ============================================================================

_OVERDOSE_FIRST_PERSON_PATTERNS = [
    "i took an overdose", "i took overdose", "took an overdose",
    "i'm going to take an overdose", "im going to take an overdose",
    "going to take an overdose", "going to overdose", "going to od",
    "thinking about an overdose", "thinking about overdose",
    "thinking of an overdose", "thinking of overdose",
    "considering an overdose", "considering overdose",
    "planning an overdose", "planning overdose",
    "want to overdose", "want to od",
    "i overdosed", "i'd overdose", "id overdose",
    "i could overdose", "i might overdose",
    "have an overdose", "having an overdose",
    "my overdose", "my own overdose",
]

# Bereavement / loss-of-other signals. If any of these are present alongside
# "overdose" (and no first-person crisis pattern matched), the message is a
# grief disclosure, not a crisis.
_OVERDOSE_GRIEF_SIGNALS = [
    # Loss verbs
    "lost", "died", "passed away", "passed", "gone",
    # Funeral / death context
    "funeral", "buried", "wake",
    # Relations (the other person who died) — veteran register
    "mate", "friend", "buddy", "brother", "sister",
    "wife", "husband", "partner", "ex-wife", "ex-husband",
    "dad", "mum", "father", "mother", "son", "daughter",
    "uncle", "aunt", "cousin", "nephew", "niece",
    "best mate", "old mate", "oppo",
    "comrade", "lad",
    # Blue Light Support (police) bereavement register.
    "colleague", "colleagues",
    "crewmate", "crew mate",
    "shift mate", "shift partner",
    "crewed with", "crewed",
    "team mate", "teammate",
    # Line-of-duty / on-duty death context
    "on duty", "on the job", "line of duty", "in the line of duty",
    # Police-specific rank references (distinctive forms only — no
    # bare-letter abbreviations that would risk false matches)
    "sergeant", "sgt", "inspector", "dci",
    "detective sergeant", "detective inspector", "detective constable",
    # Third-person took-own-life construction (bereavement by suicide;
    # may co-occur with "overdose" e.g. "took his own life from an overdose")
    "took his own life", "took her own life", "took their own life",
    "took his life", "took her life",
    # Temporal (past)
    "last year", "years ago", "months ago", "weeks ago",
    "two years ago", "five years ago", "ten years ago",
    "since he", "since she", "since they",
    "after he", "after she", "after they",
    # Longing
    "miss him", "miss her", "miss them",
    "missing him", "missing her", "missing them",
    # "lost X to an overdose" / "died of an overdose" constructions
    "to an overdose", "to overdose", "from an overdose", "from overdose",
    "of an overdose", "of overdose",
]


def is_overdose_bereavement_context(message_lower: str) -> bool:
    """
    Detect bereavement context for the "overdose" RED indicator.

    Returns True ONLY when:
      - the message contains a grief/loss-of-other signal, AND
      - no first-person overdose-as-crisis pattern is present.

    First-person crisis takes precedence so genuine self-harm disclosure
    continues to escalate exactly as before.
    """
    for pattern in _OVERDOSE_FIRST_PERSON_PATTERNS:
        if pattern in message_lower:
            return False
    for signal in _OVERDOSE_GRIEF_SIGNALS:
        if signal in message_lower:
            return True
    return False


# ============================================================================
# CONTEXT DETECTOR REGISTRY
# Map of reconcilable keyword trigger → context detector function.
# Adding a row here is the canonical way to extend the reconciler with new
# context-aware exceptions (see design doc "Worked example: jump").
# ============================================================================

_CONTEXT_DETECTORS: dict[str, Callable[[str], bool]] = {
    "overdose": is_overdose_bereavement_context,
}


# ============================================================================
# VERDICT DATACLASSES (typed input/output for the reconciler)
# ============================================================================

@dataclass(frozen=True)
class KeywordVerdict:
    """Verdict from the deterministic keyword pipeline (safety_monitor)."""
    risk_level: str           # NONE | LOW | MEDIUM | HIGH | CRITICAL
    failsafe_triggered: bool
    failsafe_reason: Optional[str]
    triggers: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ClassifierVerdict:
    """Verdict from the AI semantic classifier."""
    risk_level: str           # low | medium | high | imminent
    confidence: float         # 0.0 – 1.0
    contains_self_harm_intent: bool
    detected_indicators: list[str] = field(default_factory=list)
    reason: Optional[str] = None


@dataclass(frozen=True)
class FinalVerdict:
    """Single authoritative output of reconcile_verdicts()."""
    risk_level: str
    failsafe_triggered: bool
    failsafe_reason: Optional[str]
    risk_score: int
    precedence_rule_fired: str   # one of: CLASSIFIER_UNAVAILABLE,
                                 #         CONTEXT_OVERRIDE,
                                 #         KEYWORD_FAILSAFE,
                                 #         CLASSIFIER_ESCALATION,
                                 #         DEFAULT
    reconciliation_reason: str   # human-readable, written to audit log


# ============================================================================
# CLASSIFIER VERDICT VALIDATION (Rule 0 support)
# ============================================================================

_VALID_CLASSIFIER_RISK_LEVELS = frozenset({"low", "medium", "high", "imminent", "none"})


def _classifier_verdict_is_well_formed(c: ClassifierVerdict) -> Optional[str]:
    """
    Return None if classifier verdict is well-formed, else a string naming the
    invalid/missing field. Used to fire Rule 0 (CLASSIFIER_UNAVAILABLE).
    """
    if c.risk_level not in _VALID_CLASSIFIER_RISK_LEVELS:
        return "risk_level"
    if not (0.0 <= c.confidence <= 1.0):
        return "confidence"
    if not isinstance(c.contains_self_harm_intent, bool):
        return "contains_self_harm_intent"
    return None


# ============================================================================
# MAIN RECONCILER
# ============================================================================

def reconcile_verdicts(
    keyword: KeywordVerdict,
    classifier: Optional[ClassifierVerdict],
    message_lower: str,
    *,
    classifier_error: Optional[BaseException] = None,
    session_id: str = "",
    character: str = "",
) -> FinalVerdict:
    """
    Single authoritative safety verdict per message.

    See module docstring for the precedence table.
    """

    # ----- Rule 0: CLASSIFIER_UNAVAILABLE -----
    # Classifier raised, returned None, or returned malformed output.
    # Defer to keyword verdict. Audit logged at WARNING.
    unavailable_reason: Optional[str] = None
    if classifier_error is not None:
        unavailable_reason = f"exception:{type(classifier_error).__name__}"
    elif classifier is None:
        unavailable_reason = "classifier_returned_none"
    else:
        malformed_field = _classifier_verdict_is_well_formed(classifier)
        if malformed_field is not None:
            unavailable_reason = f"malformed_field:{malformed_field}"

    if unavailable_reason is not None:
        final = FinalVerdict(
            risk_level=keyword.risk_level,
            failsafe_triggered=keyword.failsafe_triggered,
            failsafe_reason=keyword.failsafe_reason,
            risk_score=_keyword_risk_score(keyword),
            precedence_rule_fired="CLASSIFIER_UNAVAILABLE",
            reconciliation_reason=unavailable_reason,
        )
        _emit_audit_log(final, keyword, classifier, message_lower,
                        session_id=session_id, character=character,
                        severity=logging.WARNING)
        return final

    # From here we know classifier is well-formed. mypy narrowing:
    assert classifier is not None  # noqa: S101 — guard for type checkers

    # ----- Rule 1: CONTEXT_OVERRIDE -----
    # Keyword fired solely on a reconcilable trigger (e.g. only "overdose"),
    # classifier confidence ≥ threshold, classifier says no self-harm intent,
    # AND the registered context detector for that trigger matches.
    if (
        keyword.failsafe_triggered
        and len(keyword.triggers) > 0
        and all(t in RECONCILABLE_KEYWORD_TRIGGERS for t in keyword.triggers)
        and classifier.confidence >= CLASSIFIER_CONFIDENCE_THRESHOLD
        and classifier.contains_self_harm_intent is False
    ):
        # Find the matching context detector for any one of the triggers.
        # All triggers must be reconcilable (checked above), and at least one
        # must have its detector match.
        matched_detector: Optional[str] = None
        for trigger in keyword.triggers:
            detector = _CONTEXT_DETECTORS.get(trigger)
            if detector is not None and detector(message_lower):
                matched_detector = detector.__name__
                break
        if matched_detector is not None:
            final = FinalVerdict(
                risk_level=_classifier_to_final_risk_level(classifier.risk_level),
                failsafe_triggered=False,
                failsafe_reason=None,
                risk_score=_classifier_risk_score(classifier),
                precedence_rule_fired="CONTEXT_OVERRIDE",
                reconciliation_reason=(
                    f"triggers={list(keyword.triggers)}+detector={matched_detector}"
                    f"+cls_conf={classifier.confidence:.2f}"
                    f"+no_intent"
                ),
            )
            _emit_audit_log(final, keyword, classifier, message_lower,
                            session_id=session_id, character=character,
                            severity=logging.WARNING,
                            ctx_detector=matched_detector)
            return final

    # ----- Rule 2: KEYWORD_FAILSAFE -----
    # Keyword pipeline fired the failsafe and no override applies.
    # Preserves the r10_CTRL regression baseline.
    if keyword.failsafe_triggered:
        final = FinalVerdict(
            risk_level="IMMINENT",
            failsafe_triggered=True,
            failsafe_reason=keyword.failsafe_reason,
            risk_score=max(_keyword_risk_score(keyword), 95),
            precedence_rule_fired="KEYWORD_FAILSAFE",
            reconciliation_reason=(
                f"triggers={list(keyword.triggers)}"
                f"+kw_reason={keyword.failsafe_reason}"
            ),
        )
        _emit_audit_log(final, keyword, classifier, message_lower,
                        session_id=session_id, character=character,
                        severity=logging.INFO)
        return final

    # ----- Rule 3: CLASSIFIER_ESCALATION -----
    # Keyword silent, classifier escalates with high confidence.
    if (
        classifier.risk_level == "imminent"
        and classifier.confidence >= CLASSIFIER_CONFIDENCE_THRESHOLD
        and classifier.contains_self_harm_intent
    ):
        final = FinalVerdict(
            risk_level="IMMINENT",
            failsafe_triggered=True,
            failsafe_reason="classifier_imminent",
            risk_score=max(_classifier_risk_score(classifier), 95),
            precedence_rule_fired="CLASSIFIER_ESCALATION",
            reconciliation_reason=(
                f"cls_imminent+conf={classifier.confidence:.2f}+intent_true"
            ),
        )
        _emit_audit_log(final, keyword, classifier, message_lower,
                        session_id=session_id, character=character,
                        severity=logging.INFO)
        return final

    # ----- Rule 4: DEFAULT -----
    # Neither pipeline escalates. Take the higher of the two risk levels for
    # downstream consumers, but no failsafe.
    final_risk_level = _max_risk_level(
        keyword.risk_level,
        _classifier_to_final_risk_level(classifier.risk_level),
    )
    final = FinalVerdict(
        risk_level=final_risk_level,
        failsafe_triggered=False,
        failsafe_reason=None,
        risk_score=max(_keyword_risk_score(keyword), _classifier_risk_score(classifier)),
        precedence_rule_fired="DEFAULT",
        reconciliation_reason=(
            f"kw={keyword.risk_level}+cls={classifier.risk_level}"
        ),
    )
    _emit_audit_log(final, keyword, classifier, message_lower,
                    session_id=session_id, character=character,
                    severity=logging.INFO)
    return final


# ============================================================================
# AUDIT LOGGING (privacy-preserving, JSON-on-one-line)
# ============================================================================

_AUDIT_LOGGER = logging.getLogger("safety.reconciler")


def _emit_audit_log(
    final: FinalVerdict,
    keyword: KeywordVerdict,
    classifier: Optional[ClassifierVerdict],
    message_lower: str,
    *,
    session_id: str = "",
    character: str = "",
    severity: int = logging.INFO,
    ctx_detector: Optional[str] = None,
) -> None:
    """
    Emit one structured JSON-on-one-line audit log per reconciliation.
    Schema documented in /app/memory/PHASE_B_PR_DRAFT.md v2 §5.

    Privacy: message text is NEVER logged in the clear. Only msg_sha256_16
    (first 16 hex chars of sha256) and msg_length. Classifier `reason` strings
    and `detected_indicators` text are also dropped.
    """
    payload: dict = {
        "evt": "round10.reconcile",
        "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "session_id": session_id or "",
        "character": character or "",
        "msg_sha256_16": hashlib.sha256(message_lower.encode("utf-8")).hexdigest()[:16],
        "msg_length": len(message_lower),
        "kw": {
            "risk_level": keyword.risk_level,
            "failsafe": keyword.failsafe_triggered,
            "failsafe_reason": keyword.failsafe_reason,
            "triggers": list(keyword.triggers),
        },
        "cls": (
            {
                "risk_level": classifier.risk_level,
                "confidence": round(classifier.confidence, 2),
                "self_harm_intent": classifier.contains_self_harm_intent,
                "indicators_count": len(classifier.detected_indicators),
            } if classifier is not None else None
        ),
        "final": {
            "risk_level": final.risk_level,
            "failsafe": final.failsafe_triggered,
            "failsafe_reason": final.failsafe_reason,
        },
        "rule": final.precedence_rule_fired,
        "reason": final.reconciliation_reason,
    }
    if ctx_detector is not None:
        payload["ctx_detector"] = ctx_detector
    _AUDIT_LOGGER.log(severity, json.dumps(payload, ensure_ascii=False))


# ============================================================================
# RISK-LEVEL HELPERS
# ============================================================================

# Keyword pipeline uses uppercase NONE/LOW/MEDIUM/HIGH/CRITICAL.
# Classifier uses lowercase low/medium/high/imminent/none.
# Final verdict normalises to uppercase NONE/LOW/MEDIUM/HIGH/IMMINENT.

_KEYWORD_RISK_SCORE_MAP = {
    "NONE": 0, "LOW": 25, "MEDIUM": 50, "HIGH": 75, "CRITICAL": 95, "IMMINENT": 95,
}

_CLASSIFIER_RISK_SCORE_MAP = {
    "none": 0, "low": 25, "medium": 50, "high": 75, "imminent": 95,
}

_RISK_LEVEL_RANK = {
    "NONE": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3, "IMMINENT": 4,
}


def _keyword_risk_score(k: KeywordVerdict) -> int:
    return _KEYWORD_RISK_SCORE_MAP.get(k.risk_level.upper(), 0)


def _classifier_risk_score(c: ClassifierVerdict) -> int:
    return _CLASSIFIER_RISK_SCORE_MAP.get(c.risk_level.lower(), 0)


def _classifier_to_final_risk_level(level: str) -> str:
    """Map classifier lowercase risk level to final (uppercase) format."""
    mapping = {
        "none": "NONE",
        "low": "NONE",       # classifier "low" with no failsafe → no escalation
        "medium": "MEDIUM",
        "high": "HIGH",
        "imminent": "IMMINENT",
    }
    return mapping.get(level.lower(), "NONE")


def _max_risk_level(a: str, b: str) -> str:
    """Return the higher-risk of two final-format risk levels."""
    rank_a = _RISK_LEVEL_RANK.get(a.upper(), 0)
    rank_b = _RISK_LEVEL_RANK.get(b.upper(), 0)
    return a if rank_a >= rank_b else b


# ============================================================================
# ADAPTER: extract typed verdicts from analyze_message_unified() output
# ============================================================================

def extract_verdicts_from_unified(
    unified_result: dict,
) -> tuple[KeywordVerdict, Optional[ClassifierVerdict], Optional[BaseException]]:
    """
    Convert the dict returned by safety.unified_safety.analyze_message_unified
    into the typed inputs the reconciler expects.

    Returns: (keyword_verdict, classifier_verdict_or_none, classifier_error_or_none)

    The classifier verdict is None if the AI layer was not invoked or returned
    an error in the unified result. The reconciler treats None and malformed
    output as CLASSIFIER_UNAVAILABLE (Rule 0).
    """
    # Keyword side — derive triggers from keyword_triggers + failsafe_reason
    kw_triggers = list(unified_result.get("keyword_triggers") or [])
    failsafe = bool(unified_result.get("failsafe_triggered"))
    failsafe_reason = unified_result.get("failsafe_reason")

    # Map unified final risk_level back to keyword-style for the typed verdict.
    # The unified pipeline's risk_level is the *combined* risk; we use it as
    # the keyword-side risk_level for reconciliation purposes because that is
    # what the chat endpoint was previously consuming as a unified verdict.
    risk_level_raw = (unified_result.get("risk_level") or "NONE").upper()
    if risk_level_raw == "IMMINENT" and failsafe:
        kw_risk_level = "CRITICAL"
    else:
        kw_risk_level = risk_level_raw

    keyword = KeywordVerdict(
        risk_level=kw_risk_level,
        failsafe_triggered=failsafe,
        failsafe_reason=failsafe_reason,
        triggers=kw_triggers,
    )

    # Classifier side — pull from ai_classification sub-dict.
    ai = unified_result.get("ai_classification") or {}
    if not ai.get("invoked"):
        return keyword, None, None
    if "error" in ai or ai.get("risk_level") is None:
        # Classifier was invoked but failed/empty — treat as unavailable.
        err = ai.get("error")
        return (
            keyword,
            None,
            RuntimeError(err) if err else None,
        )

    classifier = ClassifierVerdict(
        risk_level=str(ai.get("risk_level") or "none"),
        confidence=float(ai.get("confidence") or 0.0),
        contains_self_harm_intent=bool(ai.get("contains_self_harm_intent")),
        detected_indicators=list(ai.get("detected_indicators") or []),
        reason=ai.get("reason"),
    )
    return keyword, classifier, None
