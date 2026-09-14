"""Decision provenance for the safeguarding path.

Discovery Session 2 (Ant's spec). Records, per request, what the safety
system decided, which component produced each value, and how the decision
propagated to the user- or staff-visible outcome. Permanent, not debugging.

WHAT THIS RECORDS
    input/context → legacy result → raw unified result → reconciled result
    → authoritative runtime variables → downstream overrides/gates
    → user/staff-visible action

WHAT THIS DOES NOT RECORD
    Message content. Reply content. Names. Anything that would make this a
    second store of conversation data. The message is represented by a
    16-hex-char sha256 prefix, matching the existing reconcile log convention,
    so a provenance record can be correlated with other logs for the same
    request without carrying the text.

WHY THREE SEPARATE VERDICT COLUMNS
    Session 1 established that the live handler assembles the user-visible
    outcome from three sources that are never reconciled into one:
      - the legacy keyword scorer (initial risk_level assignment)
      - the RAW unified result (read by the corrective blocks)
      - the reconciler (one boolean: failsafe_triggered)
    They are recorded independently and must not be collapsed. Session 3's
    differential tests depend on being able to see where they disagree.

USER-INITIATED VS SYSTEM-DETECTED
    A panic button is not a verdict. Records carry `kind`:
      "system_verdict"          - the safeguarding path ran on a message
      "user_initiated_action"   - the user explicitly requested escalation

STORAGE-INDEPENDENT (Ant's ruling 3)
    This module knows nothing about Mongo, Render, files or any host. It
    builds a record and hands it to whatever sink the host registered. The
    default sink is a structured log line. A future host, or the standalone
    Protocol, supplies its own sink by calling set_sink(). Nothing here
    changes if the storage decision changes.

MUST NOT CHANGE BEHAVIOUR
    Every method here is observation only. If provenance raises, the caller
    swallows it. A provenance failure must never alter a safety decision.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field, asdict
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("safety.provenance")

SCHEMA_VERSION = "1.0"


def _msg_hash(message: Optional[str]) -> Optional[str]:
    """Same convention as verdict_reconciler.py:451 - sha256 of the LOWERCASED
    text, first 16 hex chars - so a provenance line and a reconcile line for
    the same request carry the same hash and can be joined."""
    if not message:
        return None
    return hashlib.sha256(message.lower().encode("utf-8", "ignore")).hexdigest()[:16]


def _short_session(session_id: Optional[str]) -> Optional[str]:
    return session_id[:12] if session_id else None


@dataclass
class Stage:
    """One observed point in the decision chain."""
    name: str
    source: str                      # component that produced these values
    values: Dict[str, Any]
    t_ms: float                      # ms since record started


@dataclass
class ProvenanceRecord:
    kind: str                        # "system_verdict" | "user_initiated_action"
    session: Optional[str]
    character: Optional[str]
    msg_sha256_16: Optional[str]
    msg_length: Optional[int]
    is_under_18: Optional[bool]
    schema: str = SCHEMA_VERSION
    stages: List[Stage] = field(default_factory=list)
    overrides: List[Dict[str, Any]] = field(default_factory=list)
    outcome: Dict[str, Any] = field(default_factory=dict)
    _t0: float = field(default_factory=time.time, repr=False)

    def rekey(self, message: Optional[str]) -> None:
        """Re-hash on the text the detectors actually see (post-normalisation).
        The reconciler hashes safeguarding_text; provenance must match it or
        the two lines cannot be correlated."""
        self.msg_sha256_16 = _msg_hash(message)
        self.msg_length = len(message) if message else None

    def stage(self, name: str, source: str, **values: Any) -> None:
        """Record a point in the chain. Values are copied as given; callers
        are responsible for passing only decision data, never content."""
        self.stages.append(Stage(
            name=name,
            source=source,
            values=dict(values),
            t_ms=round((time.time() - self._t0) * 1000, 1),
        ))

    def override(self, name: str, source: str, variable: str,
                 before: Any, after: Any, reason: str = "") -> None:
        """Record a downstream rewrite of an authoritative runtime variable.
        These are the corrective blocks from Session 1 §2 - each one is a
        place where something after the reconciler changed the outcome."""
        self.overrides.append({
            "name": name,
            "source": source,
            "variable": variable,
            "before": before,
            "after": after,
            "changed": before != after,
            "reason": reason,
            "t_ms": round((time.time() - self._t0) * 1000, 1),
        })

    def finish(self, **outcome: Any) -> Dict[str, Any]:
        """Record the user/staff-visible outcome and emit."""
        self.outcome = dict(outcome)
        self.outcome["total_ms"] = round((time.time() - self._t0) * 1000, 1)
        payload = self.to_dict()
        try:
            _sink(payload)
        except Exception as e:  # provenance must never break the request
            logger.error(f"[Provenance] sink failed: {e}")
        return payload

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d.pop("_t0", None)
        d["stages"] = [asdict(s) for s in self.stages]
        return d


# ---------------------------------------------------------------------------
# Sink - the ONLY place a host's storage choice touches provenance.
# ---------------------------------------------------------------------------

def _log_sink(payload: Dict[str, Any]) -> None:
    """Default: one structured JSON line. No host assumptions."""
    logger.info(json.dumps({"evt": "safety.provenance", **payload},
                           default=str, separators=(",", ":")))


_sink: Callable[[Dict[str, Any]], None] = _log_sink


def set_sink(fn: Callable[[Dict[str, Any]], None]) -> None:
    """Host registers where provenance goes. Radio Check leaves this as the
    log sink for now (Ant's ruling 3: no persistence in this pass). A future
    host or the standalone Protocol supplies its own."""
    global _sink
    _sink = fn


def reset_sink() -> None:
    global _sink
    _sink = _log_sink


# ---------------------------------------------------------------------------
# Constructors
# ---------------------------------------------------------------------------

def start_system_verdict(session_id: Optional[str], character: Optional[str],
                         message: Optional[str], is_under_18: Optional[bool]) -> ProvenanceRecord:
    return ProvenanceRecord(
        kind="system_verdict",
        session=_short_session(session_id),
        character=character,
        msg_sha256_16=_msg_hash(message),
        msg_length=len(message) if message else None,
        is_under_18=is_under_18,
    )


def start_user_initiated_action(session_id: Optional[str], character: Optional[str],
                                action: str) -> ProvenanceRecord:
    """A deliberate user action requesting escalation (e.g. panic button).
    No message, no verdict - the user asked. Recorded so provenance can
    distinguish user-initiated from system-detected escalation."""
    rec = ProvenanceRecord(
        kind="user_initiated_action",
        session=_short_session(session_id),
        character=character,
        msg_sha256_16=None,
        msg_length=None,
        is_under_18=None,
    )
    rec.stage("user_action", source="client", action=action)
    return rec
