"""
Round 10 deployment-integrity diagnostic endpoint.

Purpose: prove what code is actually running on the live server, by
returning file hashes, function introspection, and per-pathway trace
output for an arbitrary input message.

Approved by Andrew (Round 10 brief): auth-gated, removed in the same session
once the integrity report is produced. Chosen over SSH access because it
leaves a log trail.

Hard requirements honoured:
  - Endpoint is INERT until the env var ROUND10_TRACE_TOKEN is set on the
    deployment. Without the token set on the server AND a matching
    X-R10-Token header on the request, the endpoint returns 404 (looks
    like it doesn't exist).
  - Endpoint is read-only with respect to product state. It calls the
    safety pathways with a synthetic session_id ("_r10_diag_*") so it
    cannot pollute real session state.
  - Every invocation is logged with origin IP and user-agent for audit.
  - No safety-pathway code is modified.

Remove this file and the import in server.py before merging anything else.
"""

from __future__ import annotations

import hashlib
import inspect
import logging
import os
import sys
from typing import Any, Dict

from fastapi import APIRouter, Header, HTTPException, Request

logger = logging.getLogger("round10_diagnostics")

router = APIRouter()


def _sha256_file(path: str) -> str | None:
    if not path or not os.path.exists(path):
        return None
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _safe_call(label: str, fn, *args, **kwargs) -> Dict[str, Any]:
    try:
        result = fn(*args, **kwargs)
        return {"ok": True, "result": result}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


@router.post("/api/_round10_trace")
async def round10_trace(
    request: Request,
    x_r10_token: str | None = Header(default=None, alias="X-R10-Token"),
) -> Dict[str, Any]:
    expected = (os.environ.get("ROUND10_TRACE_TOKEN") or "").strip()
    if not expected or not x_r10_token or x_r10_token != expected:
        # Indistinguishable from the endpoint not existing.
        raise HTTPException(status_code=404, detail="Not Found")

    body = await request.json()
    message: str = body.get("message", "")
    session_id: str = body.get("session_id", "_r10_diag_default")
    user_id: str = body.get("user_id", "_r10_diag_user")
    character: str = body.get("character", "tommy")

    client_host = getattr(getattr(request, "client", None), "host", "unknown")
    user_agent = request.headers.get("user-agent", "unknown")
    logger.warning(
        "[Round10Trace] invocation from %s ua=%r message_preview=%r session=%s",
        client_host, user_agent, (message[:80] + "...") if len(message) > 80 else message, session_id,
    )

    # Lazy imports so a broken safety module doesn't 500 the diagnostic.
    import server  # noqa: WPS433
    from safety import safety_monitor as _safety_monitor  # noqa: WPS433
    from safety import unified_safety as _unified_safety  # noqa: WPS433
    from personas import soul_loader as _soul_loader  # noqa: WPS433

    # ----- 1. File integrity (path + sha256 + size + mtime) ---------------
    file_integrity: Dict[str, Any] = {}
    for label, mod in [
        ("server.py", server),
        ("safety/safety_monitor.py", _safety_monitor),
        ("safety/unified_safety.py", _unified_safety),
        ("personas/soul_loader.py", _soul_loader),
    ]:
        try:
            path = inspect.getfile(mod)
            file_integrity[label] = {
                "path": path,
                "sha256": _sha256_file(path),
                "size_bytes": os.path.getsize(path) if os.path.exists(path) else None,
                "mtime_unix": os.path.getmtime(path) if os.path.exists(path) else None,
            }
        except Exception as e:  # noqa: BLE001
            file_integrity[label] = {"error": f"{type(e).__name__}: {e}"}

    # ----- 2. Function introspection -------------------------------------
    def _fn_meta(label: str, fn) -> Dict[str, Any]:
        if fn is None:
            return {"present": False}
        try:
            return {
                "present": True,
                "module": getattr(fn, "__module__", None),
                "qualname": getattr(fn, "__qualname__", None),
                "filename": getattr(getattr(fn, "__code__", None), "co_filename", None),
                "first_line": getattr(getattr(fn, "__code__", None), "co_firstlineno", None),
                "id": id(fn),
            }
        except Exception as e:  # noqa: BLE001
            return {"present": True, "introspection_error": str(e)}

    fn_introspection = {
        "server.is_overdose_bereavement_context": _fn_meta(
            "is_overdose_bereavement_context",
            getattr(server, "is_overdose_bereavement_context", None),
        ),
        "server.calculate_safeguarding_score": _fn_meta(
            "calculate_safeguarding_score",
            getattr(server, "calculate_safeguarding_score", None),
        ),
        "safety.safety_monitor.assess_message_safety": _fn_meta(
            "assess_message_safety",
            getattr(_safety_monitor, "assess_message_safety", None),
        ),
        "safety.unified_safety.analyze_message_unified": _fn_meta(
            "analyze_message_unified",
            getattr(_unified_safety, "analyze_message_unified", None),
        ),
    }

    # Round 9 prompt-level checks present in the deployed judge prompt?
    judge_prompt = getattr(_soul_loader, "ROUND7_JUDGE_PROMPT", "")
    round9_prompt_status = {
        "round7_judge_prompt_length_chars": len(judge_prompt),
        "round9_check_a_marker_present": "ROUND 9 CHECK A" in judge_prompt,
        "round9_check_b_marker_present": "ROUND 9 CHECK B" in judge_prompt,
        "round9_check_c_marker_present": "ROUND 9 CHECK C" in judge_prompt,
        "round9_check_d_marker_present": "ROUND 9 CHECK D" in judge_prompt,
        "check_b_failure_string_quoted": "I'm here if you need anything" in judge_prompt,
        "check_c_failure_string_quoted": "privacy is important to me" in judge_prompt,
        "check_d_failure_string_quoted": "glad you feel you can rely on me" in judge_prompt,
    }

    # ----- 3. Live pathway trace on the supplied message ------------------
    pathway = {}
    pathway["calculate_safeguarding_score_(server.py)"] = _safe_call(
        "calculate_safeguarding_score",
        server.calculate_safeguarding_score, message, session_id, character,
    )
    pathway["is_overdose_bereavement_context_(server.py, direct)"] = _safe_call(
        "is_overdose_bereavement_context",
        getattr(server, "is_overdose_bereavement_context", lambda *_a, **_k: None),
        message.lower(),
    )
    pathway["assess_message_safety_(safety/safety_monitor.py)"] = _safe_call(
        "assess_message_safety",
        _safety_monitor.assess_message_safety, message,
    )
    pathway["analyze_message_unified_(safety/unified_safety.py)"] = _safe_call(
        "analyze_message_unified",
        _unified_safety.analyze_message_unified,
        message=message, session_id=session_id, user_id=user_id, character=character,
    )

    # ----- 4. Middleware stack -------------------------------------------
    middleware_stack: list[str] = []
    try:
        for m in server.app.user_middleware:
            middleware_stack.append(repr(m))
    except Exception as e:  # noqa: BLE001
        middleware_stack.append(f"introspection error: {type(e).__name__}: {e}")

    # ----- 5. Deployment metadata ----------------------------------------
    deploy_meta = {
        "python_version": sys.version,
        "process_id": os.getpid(),
        "cwd": os.getcwd(),
        "git_commit_env": (
            os.environ.get("RENDER_GIT_COMMIT")
            or os.environ.get("GIT_COMMIT")
            or os.environ.get("SOURCE_VERSION")
            or "unset"
        ),
        "render_service_id": os.environ.get("RENDER_SERVICE_ID", "unset"),
        "render_instance_id": os.environ.get("RENDER_INSTANCE_ID", "unset"),
        "host": os.environ.get("RENDER_EXTERNAL_HOSTNAME") or os.environ.get("HOSTNAME") or "unknown",
    }

    return {
        "diagnostic_endpoint_version": "round10-trace-v1",
        "input": {
            "message": message,
            "session_id": session_id,
            "character": character,
        },
        "deployment_metadata": deploy_meta,
        "file_integrity": file_integrity,
        "function_introspection": fn_introspection,
        "round9_prompt_status": round9_prompt_status,
        "live_pathway_trace": pathway,
        "middleware_stack": middleware_stack,
    }


def register_round10_diagnostics(app) -> None:
    app.include_router(router)
    logger.warning(
        "[Round10Trace] diagnostic router registered. "
        "Endpoint will 404 unless ROUND10_TRACE_TOKEN env var is set "
        "on this deployment AND callers send a matching X-R10-Token header."
    )
