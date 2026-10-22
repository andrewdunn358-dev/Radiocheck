"""Operational-log privacy helpers (#146, Ant 22 Oct 2026).

Operational logs (stdout -> Render) must not carry conversation content or
unnecessary personal identifiers. These helpers produce privacy-preserving
metadata for log lines. They are used ONLY in log statements: they never
change a safeguarding decision, a database record or a response.

- ip_ref(ip):      keyed HMAC-SHA256 reference for IP correlation. Needs the
                   LOG_IP_HMAC_KEY environment secret. Without it there is no
                   raw IP and no unkeyed hash: the reference is the constant
                   "ip:unkeyed" and a one-time privacy.config_missing event is
                   logged. The key itself is never logged.
- sid(s):          12-character session reference (existing convention).
- mask_phone(p):   last 3 digits only.
- exc(e):          exception type name only (no message text).
- guard_third_party_logging(): caps third-party loggers that can write
                   request payloads, URLs with personal data or Socket.IO
                   packet data, so DEBUG/INFO payload logging cannot be
                   switched on by accident (root level, OPENAI_LOG, library
                   defaults). WARNING and ERROR from those libraries still flow.
"""
import hashlib
import hmac
import json
import logging
import os
import re
import threading

IP_HMAC_KEY_ENV = "LOG_IP_HMAC_KEY"
IP_UNKEYED = "ip:unkeyed"
_MIN_KEY_LEN = 16

_config_warned = set()
_lock = threading.Lock()


def _warn_once(missing: str, detail: str) -> None:
    with _lock:
        if missing in _config_warned:
            return
        _config_warned.add(missing)
    try:
        logging.getLogger("privacy").warning(json.dumps(
            {"evt": "privacy.config_missing", "missing": missing, "detail": detail}))
    except Exception:
        pass


def _ip_key():
    key = os.environ.get(IP_HMAC_KEY_ENV, "") or ""
    if len(key) < _MIN_KEY_LEN:
        _warn_once(IP_HMAC_KEY_ENV, "absent" if not key else "too_short")
        return None
    return key.encode("utf-8")


def ip_ref(ip) -> str:
    """'ip:<12 hex>' (keyed HMAC-SHA256) or 'ip:unkeyed' / 'ip:none'.
    Never the raw address, never an unkeyed hash."""
    if not ip:
        return "ip:none"
    key = _ip_key()
    if key is None:
        return IP_UNKEYED
    digest = hmac.new(key, str(ip).encode("utf-8"), hashlib.sha256).hexdigest()
    return "ip:" + digest[:12]


def sid(session_id) -> str:
    return (str(session_id) if session_id else "")[:12]


def mask_phone(number) -> str:
    digits = re.sub(r"\D", "", str(number or ""))
    if not digits:
        return "none"
    return "***" + digits[-3:]


def exc(e) -> str:
    return type(e).__name__


def ua_family(user_agent) -> str:
    """Coarse user-agent family only (no version, no full string)."""
    ua = (user_agent or "").lower()
    for token, name in (("python-requests", "python-requests"), ("curl", "curl"), ("wget", "wget"),
                        ("bot", "bot"), ("spider", "bot"), ("crawl", "bot"),
                        ("android", "android"), ("iphone", "ios"), ("ipad", "ios"),
                        ("edg/", "edge"), ("chrome", "chrome"), ("firefox", "firefox"),
                        ("safari", "safari")):
        if token in ua:
            return name
    return "other" if ua else "none"


# Third-party loggers that can emit payloads or personal data:
#   openai / httpx / httpcore: request options incl. messages (DEBUG); request
#     URLs incl. the ip-api URL that contains the veteran's IP (httpx INFO)
#   twilio.*: request URL and params incl. phone numbers (INFO)
#   engineio.server / socketio.server: every Socket.IO packet with its data,
#     i.e. live-chat messages (INFO, enabled by engineio_logger=True)
#   google_genai / google: request details
#   urllib3: request URLs (DEBUG)
THIRD_PARTY_CAPS = {
    "openai": logging.WARNING,
    "openai._base_client": logging.WARNING,
    "httpx": logging.WARNING,
    "httpcore": logging.WARNING,
    "twilio": logging.WARNING,
    "twilio.http_client": logging.WARNING,
    "twilio.async_http_client": logging.WARNING,
    "engineio": logging.WARNING,
    "engineio.server": logging.WARNING,
    "socketio": logging.WARNING,
    "socketio.server": logging.WARNING,
    "google_genai": logging.WARNING,
    "google": logging.WARNING,
    "urllib3": logging.WARNING,
}


def guard_third_party_logging() -> dict:
    """Apply the caps. Idempotent; safe to call more than once (it is called
    at import of server.py and again at startup, after libraries that set
    their own levels, e.g. openai with OPENAI_LOG, have been imported)."""
    applied = {}
    for name, level in THIRD_PARTY_CAPS.items():
        lg = logging.getLogger(name)
        if lg.level == logging.NOTSET or lg.level < level:
            lg.setLevel(level)
        applied[name] = logging.getLevelName(lg.level)
    if os.environ.get("OPENAI_LOG"):
        try:
            logging.getLogger("privacy").warning(json.dumps(
                {"evt": "privacy.third_party_debug_blocked", "source": "OPENAI_LOG"}))
        except Exception:
            pass
    return applied


# Explicit allowlist (Ant, 23 Oct 2026). Only these recognised machine-readable
# codes pass through; every other value, including single-word free text,
# becomes "unstructured". A known judge contract code followed by free text
# (e.g. "spine_leak - said worried twice") maps to the code alone.
#   judge contract (safety/judge_prompt.py "FAIL: <reason>") + server default
JUDGE_REASONS = ("welfare_pivot", "spine_leak", "brush_off_acceptance", "banned_phrase",
                 "therapeutic_tone")
#   protocol gate reasons (safety/protocol_gates.py REASON_* constants)
GATE_REASONS = ("pass", "brush_off_generic_no_hold", "identity_privacy_register_unsolicited",
                "attachment_validation_before_redirect", "attachment_validation_no_redirect",
                "grief_memory_question_after_welfare_signal")
#   fallback / validator machine codes (safety/fallback_validation.py, server.py)
FALLBACK_REASONS = ("judge_fail", "generation_returned_nothing", "post_filter_error",
                    "gate_validator_error", "judge_validator_error")
REASON_CODES = frozenset(JUDGE_REASONS + GATE_REASONS + FALLBACK_REASONS)
_JUDGE_PREFIX_RE = re.compile(r"^(" + "|".join(JUDGE_REASONS) + r")(?=$|[^a-z0-9_])")


def reason_code(reason):
    """Allowlisted reason code for logs and provenance, else "unstructured".
    None or empty -> None."""
    if reason is None:
        return None
    text = str(reason).strip()
    if not text:
        return None
    low = text.lower()
    if low in REASON_CODES:
        return low
    m = _JUDGE_PREFIX_RE.match(low)
    if m:
        return m.group(1)
    return "unstructured"
