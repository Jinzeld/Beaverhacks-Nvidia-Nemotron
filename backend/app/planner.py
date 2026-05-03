"""
Nemotron-backed controlled planner.

The planner asks Nemotron for exactly one next action, but the backend remains
authoritative: only registered read-only tools can execute, scope is enforced,
and deterministic fallback keeps the demo stable.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from app.nemotron_client import call_nemotron


ALLOWED_ACTIONS = {
    "nmap_scan",
    "ftp_anonymous_check",
    "http_header_check",
    "exposed_env_check",
    "directory_listing_check",
    "debug_endpoint_check",
    "reflection_check",
    "markdown_report_generator",
    "generate_report",
    "finish",
}


def service_is_open(state: Dict[str, Any], port: int) -> bool:
    return any(svc.get("port") == port for svc in state.get("services", []))


def relevant_checks_remaining(state: Dict[str, Any]) -> bool:
    completed = set(state.get("completed_actions", []))

    if "nmap_scan" not in completed:
        return True

    if service_is_open(state, 21) and "ftp_anonymous_check" not in completed:
        return True

    if service_is_open(state, 8088):
        for action in ("http_header_check", "exposed_env_check", "directory_listing_check"):
            if action not in completed:
                return True

    if service_is_open(state, 8090):
        for action in ("debug_endpoint_check", "reflection_check"):
            if action not in completed:
                return True

    return False


def deterministic_next_action(state: Dict[str, Any], target_host: str) -> Dict[str, Any]:
    """Stable fallback planner matching the demo target workflow."""

    completed = set(state.get("completed_actions", []))

    if "nmap_scan" not in completed:
        return {
            "phase": "PLAN",
            "reason": "No service discovery has been completed yet, so the first safe step is Nmap service discovery on the allowed demo ports.",
            "action": "nmap_scan",
            "args": {"target_host": target_host, "ports": [21, 8088, 8090]},
        }

    if service_is_open(state, 21) and "ftp_anonymous_check" not in completed:
        return {
            "phase": "DECIDE",
            "reason": "FTP is open on port 21, so the next safe external check is anonymous login validation.",
            "action": "ftp_anonymous_check",
            "args": {"target_host": target_host, "port": 21},
        }

    if service_is_open(state, 8088):
        if "http_header_check" not in completed:
            return {
                "phase": "DECIDE",
                "reason": "HTTP is open on port 8088, so the agent will audit security headers and wildcard CORS.",
                "action": "http_header_check",
                "args": {"url": f"http://{target_host}:8088", "port": 8088},
            }
        if "exposed_env_check" not in completed:
            return {
                "phase": "DECIDE",
                "reason": "HTTP is open on port 8088, so the agent will check for exposed dotfiles such as .env.",
                "action": "exposed_env_check",
                "args": {"url": f"http://{target_host}:8088", "port": 8088},
            }
        if "directory_listing_check" not in completed:
            return {
                "phase": "DECIDE",
                "reason": "HTTP is open on port 8088, so the agent will check for directory listing exposure.",
                "action": "directory_listing_check",
                "args": {"url": f"http://{target_host}:8088", "port": 8088},
            }

    if service_is_open(state, 8090):
        if "debug_endpoint_check" not in completed:
            return {
                "phase": "DECIDE",
                "reason": "A web application is open on port 8090, so the agent will check for exposed debug information.",
                "action": "debug_endpoint_check",
                "args": {"url": f"http://{target_host}:8090", "port": 8090},
            }
        if "reflection_check" not in completed:
            return {
                "phase": "DECIDE",
                "reason": "A web application is open on port 8090, so the agent will run a safe canary reflection check.",
                "action": "reflection_check",
                "args": {"url": f"http://{target_host}:8090", "port": 8090},
            }

    return {
        "phase": "REPORT",
        "reason": "All relevant checks for discovered services are complete, so the agent will generate the final report.",
        "action": "generate_report",
        "args": {"target_host": target_host},
    }


def extract_json_object(text: str) -> Dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in Nemotron output: {text[:200]}")

    return json.loads(match.group(0))


def ask_nemotron_next_action(state: Dict[str, Any], target_host: str) -> Dict[str, Any]:
    system = """
You are the planner for a controlled external security audit agent.
Return JSON only.

Rules:
- Only audit the allowlisted target.
- Do not exploit vulnerabilities.
- Do not brute force credentials.
- Do not suggest arbitrary shell commands.
- Choose exactly one next action from the allowed action list.
- If no service discovery has been completed, choose nmap_scan.
- If all relevant checks are complete, choose generate_report.

Allowed actions:
nmap_scan, ftp_anonymous_check, http_header_check, exposed_env_check,
directory_listing_check, debug_endpoint_check, reflection_check,
generate_report, finish

Return format:
{"phase":"PLAN|DECIDE|ACTION|REPORT","reason":"short visible reason","action":"allowed_action","args":{}}
"""

    compact_state = {
        "target_host": target_host,
        "services": state.get("services", []),
        "completed_actions": state.get("completed_actions", []),
        "findings": state.get("findings", [])[-10:],
        "recent_observations": state.get("observations", [])[-5:],
    }

    user = (
        "Allowed target:\n"
        f"{target_host}\n\n"
        "Current agent state:\n"
        f"{json.dumps(compact_state, ensure_ascii=False, indent=2)}\n\n"
        "Choose the single next best safe audit action. Return JSON only."
    )

    raw = call_nemotron(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
        max_tokens=600,
    )
    return extract_json_object(raw)


def validate_or_fallback(decision: Dict[str, Any], state: Dict[str, Any], target_host: str) -> Dict[str, Any]:
    action = decision.get("action")
    args = decision.get("args") or {}

    if action not in ALLOWED_ACTIONS:
        return deterministic_next_action(state, target_host)

    if action in state.get("completed_actions", []) and action not in {"generate_report", "finish"}:
        return deterministic_next_action(state, target_host)

    if action in {"generate_report", "markdown_report_generator"} and relevant_checks_remaining(state):
        return deterministic_next_action(state, target_host)

    if "target_host" in args and args["target_host"] != target_host:
        return deterministic_next_action(state, target_host)

    if "url" in args:
        allowed_prefixes = [f"http://{target_host}:8088", f"http://{target_host}:8090"]
        if not any(str(args["url"]).startswith(prefix) for prefix in allowed_prefixes):
            return deterministic_next_action(state, target_host)

    return decision


def get_next_action(state: Dict[str, Any], target_host: str) -> Dict[str, Any]:
    try:
        decision = ask_nemotron_next_action(state, target_host)
    except Exception as exc:
        decision = deterministic_next_action(state, target_host)
        decision["reason"] = f"Nemotron planner fallback used: {exc}. {decision['reason']}"

    return validate_or_fallback(decision, state, target_host)
