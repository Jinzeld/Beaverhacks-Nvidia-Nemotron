"""
Controlled Nemotron-powered external audit orchestrator.

The orchestrator implements a safe agent loop:
Scope Check -> Ask Planner -> Validate Action -> Execute Tool -> Observe -> Report

Nemotron may suggest the next safe action, but the backend enforces:
- allowlisted target only
- registered read-only tools only
- no arbitrary shell commands
- no exploit payloads
- no brute force
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from app.agent_trace import AgentTraceLogger
from app.findings import Finding
from app.ftp_tool import check_ftp_anonymous
from app.http_tool import (
    check_debug_endpoint,
    check_directory_listing,
    check_exposed_env,
    check_http_headers,
    check_reflection,
)
from app.nmap_tool import nmap_scan
from app.planner import get_next_action, relevant_checks_remaining
from app.recommender import RecommendationSummary, generate_recommendation_summary
from app.report import generate_markdown_report
from app.scanner import validate_target_url
from app.tool_registry import get_tool_registry, require_enabled_tool


@dataclass(frozen=True)
class AgentPlanStep:
    """One visible step in the agent's execution plan."""

    step_number: int
    tool_name: str
    reason: str
    status: str = "completed"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class AgentPlan:
    """Visible plan produced from the decisions the agent executed."""

    goal: str
    mode: str
    steps: List[AgentPlanStep]

    def to_dict(self) -> Dict[str, Any]:
        return {"goal": self.goal, "mode": self.mode, "steps": [step.to_dict() for step in self.steps]}


@dataclass(frozen=True)
class AgentRunResult:
    """Final JSON-friendly result returned by the orchestrator."""

    goal: str
    target_url: str
    approved_target_host: str
    read_only: bool
    plan: AgentPlan
    services: List[Dict[str, Any]]
    observations: List[Dict[str, Any]]
    decision_log: List[Dict[str, Any]]
    tool_outputs: Dict[str, Any]
    findings: List[Finding]
    recommendation_summary: Dict[str, Any]
    report_path: Optional[str]
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "goal": self.goal,
            "target_url": self.target_url,
            "approved_target_host": self.approved_target_host,
            "read_only": self.read_only,
            "plan": self.plan.to_dict(),
            "services": self.services,
            "observations": self.observations,
            "decision_log": self.decision_log,
            "tool_outputs": self.tool_outputs,
            "findings": [finding.to_dict() for finding in self.findings],
            "recommendation_summary": self.recommendation_summary,
            "report_path": self.report_path,
            "error": self.error,
        }


def target_host_from_url(target_url: str) -> str:
    parsed = urlparse(target_url)
    if not parsed.hostname:
        raise ValueError("TARGET_URL must include a hostname or IP address.")
    return parsed.hostname


def normalize_target_url(target_url: str, approved_target_host: str) -> str:
    """Allow the backend to accept either TARGET_URL or only APPROVED_TARGET_HOST."""

    if target_url:
        return target_url
    if approved_target_host:
        return f"http://{approved_target_host}:8088"
    raise ValueError("TARGET_URL or APPROVED_TARGET_HOST must be configured.")


def visible_decision_entry(phase: str, message: str, action: str = "", args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"phase": phase, "message": message, "action": action, "args": args or {}}


def log_decision(
    *,
    trace_logger: AgentTraceLogger,
    decision_log: List[Dict[str, Any]],
    phase: str,
    message: str,
    action: str = "",
    args: Optional[Dict[str, Any]] = None,
) -> None:
    entry = visible_decision_entry(phase, message, action, args)
    decision_log.append(entry)
    trace_logger.log_event(event=f"agent_{phase.lower()}", data=entry)


def build_plan_from_decisions(goal: str, decision_log: List[Dict[str, Any]]) -> AgentPlan:
    steps: List[AgentPlanStep] = []
    for entry in decision_log:
        action = entry.get("action")
        if not action:
            continue
        if action == "finish":
            continue
        steps.append(
            AgentPlanStep(
                step_number=len(steps) + 1,
                tool_name=action,
                reason=entry.get("message", ""),
                status="completed",
            )
        )
    return AgentPlan(goal=goal, mode="read-only-controlled-agent", steps=steps)


def finding_dicts(findings: List[Finding]) -> List[Dict[str, Any]]:
    return [finding.to_dict() for finding in findings]


def save_json_outputs(*, output_dir: Path, services: List[Dict[str, Any]], findings: List[Finding], decision_log: List[Dict[str, Any]]) -> Dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)

    services_path = output_dir / "services.json"
    findings_path = output_dir / "findings.json"
    decision_log_path = output_dir / "decision_log.json"

    services_path.write_text(json.dumps(services, indent=2), encoding="utf-8")
    findings_path.write_text(json.dumps(finding_dicts(findings), indent=2), encoding="utf-8")
    decision_log_path.write_text(json.dumps(decision_log, indent=2), encoding="utf-8")

    return {
        "services_json": str(services_path),
        "findings_json": str(findings_path),
        "decision_log_json": str(decision_log_path),
    }


def execute_action(
    *,
    action: str,
    args: Dict[str, Any],
    target_host: str,
    approved_target_host: str,
    findings: List[Finding],
) -> Dict[str, Any]:
    """Execute one registry-approved read-only tool."""

    require_enabled_tool(action if action != "generate_report" else "generate_report")

    if action == "nmap_scan":
        result = nmap_scan(target_host)
        return {"tool": action, "result": result.to_dict(), "new_findings": []}

    if action == "ftp_anonymous_check":
        result = check_ftp_anonymous(target_host=target_host, port=21)
        findings.extend(result.findings)
        return {"tool": action, "result": result.to_dict(), "new_findings": finding_dicts(result.findings)}

    if action == "http_header_check" or action == "http_header_scan":
        url = args.get("url") or f"http://{target_host}:8088"
        result = check_http_headers(target_url=url, approved_target_host=approved_target_host)
        findings.extend(result.findings)
        return {"tool": "http_header_check", "result": result.to_dict(), "new_findings": finding_dicts(result.findings)}

    if action == "exposed_env_check":
        url = args.get("url") or f"http://{target_host}:8088"
        result = check_exposed_env(base_url=url, approved_target_host=approved_target_host)
        findings.extend(result.findings)
        return {"tool": action, "result": result.to_dict(), "new_findings": finding_dicts(result.findings)}

    if action == "directory_listing_check":
        url = args.get("url") or f"http://{target_host}:8088"
        result = check_directory_listing(base_url=url, approved_target_host=approved_target_host)
        findings.extend(result.findings)
        return {"tool": action, "result": result.to_dict(), "new_findings": finding_dicts(result.findings)}

    if action == "debug_endpoint_check":
        url = args.get("url") or f"http://{target_host}:8090"
        result = check_debug_endpoint(base_url=url, approved_target_host=approved_target_host)
        findings.extend(result.findings)
        return {"tool": action, "result": result.to_dict(), "new_findings": finding_dicts(result.findings)}

    if action == "reflection_check":
        url = args.get("url") or f"http://{target_host}:8090"
        result = check_reflection(base_url=url, approved_target_host=approved_target_host)
        findings.extend(result.findings)
        return {"tool": action, "result": result.to_dict(), "new_findings": finding_dicts(result.findings)}

    raise RuntimeError(f"Unsupported action: {action}")


def observation_summary(action: str, tool_result: Dict[str, Any]) -> str:
    result = tool_result.get("result", {})

    if action == "nmap_scan":
        services = result.get("services", [])
        return f"Nmap discovered {len(services)} open service(s) on allowed demo ports."

    if "error" in result and result.get("error"):
        return f"{action} completed with error: {result.get('error')}"

    new_findings = tool_result.get("new_findings", [])
    if new_findings:
        return f"{action} produced {len(new_findings)} finding(s)."

    return f"{action} completed with no new finding."


def run_agentic_security_review(
    *,
    goal: str,
    target_url: str,
    approved_target_host: str,
    trace_logger: AgentTraceLogger,
    report_path: Path,
    trace_path: Path,
    max_steps: int = 12,
) -> AgentRunResult:
    """Run the controlled external audit agent."""

    target_url = normalize_target_url(target_url, approved_target_host)
    validate_target_url(target_url, approved_target_host)
    target_host = target_host_from_url(target_url)

    if target_host != approved_target_host:
        raise ValueError("TARGET_URL host must match APPROVED_TARGET_HOST.")

    decision_log: List[Dict[str, Any]] = []
    observations: List[Dict[str, Any]] = []
    tool_outputs: Dict[str, Any] = {}
    findings: List[Finding] = []
    services: List[Dict[str, Any]] = []
    completed_actions: List[str] = []
    generated_report_path: Optional[str] = None

    trace_logger.log_event(event="agent_goal_received", data={"goal": goal})
    log_decision(
        trace_logger=trace_logger,
        decision_log=decision_log,
        phase="PLAN",
        message=f"Target {approved_target_host} is allowlisted. Starting controlled external audit.",
    )

    trace_logger.log_event(
        event="scope_validated",
        data={"target_url": target_url, "approved_target_host": approved_target_host, "read_only": True},
    )

    registry = get_tool_registry()
    trace_logger.log_event(
        event="tool_registry_loaded",
        data={"registered_tools": [tool.to_dict() for tool in registry.values()]},
    )

    for step in range(1, max_steps + 1):
        state = {
            "target_host": target_host,
            "services": services,
            "observations": observations,
            "findings": finding_dicts(findings),
            "completed_actions": completed_actions,
        }

        decision = get_next_action(state, target_host)
        action = decision.get("action")
        args = decision.get("args") or {}
        reason = decision.get("reason", "No visible reason provided.")
        phase = decision.get("phase", "DECIDE")

        if action in {"generate_report", "markdown_report_generator"}:
            log_decision(trace_logger=trace_logger, decision_log=decision_log, phase="REPORT", message=reason, action="generate_report", args=args)
            break

        if action == "finish":
            log_decision(trace_logger=trace_logger, decision_log=decision_log, phase="REPORT", message=reason, action="finish", args=args)
            break

        require_enabled_tool(action)
        log_decision(trace_logger=trace_logger, decision_log=decision_log, phase=phase, message=reason, action=action, args=args)

        trace_logger.log_event(event="tool_selected", data={"step": step, "tool_name": action, "reason": reason, "args": args})

        tool_result = execute_action(
            action=action,
            args=args,
            target_host=target_host,
            approved_target_host=approved_target_host,
            findings=findings,
        )

        tool_outputs[action] = tool_result.get("result", {})

        if action == "nmap_scan":
            services = tool_result["result"].get("services", [])

        summary = observation_summary(action, tool_result)
        observations.append({"tool": action, "summary": summary, "result": tool_result.get("result", {})})
        log_decision(trace_logger=trace_logger, decision_log=decision_log, phase="OBSERVE", message=summary)

        trace_logger.log_event(
            event="tool_completed",
            data={"tool_name": action, "summary": summary, "new_findings_count": len(tool_result.get("new_findings", []))},
        )

        if action not in completed_actions:
            completed_actions.append(action)

        if not relevant_checks_remaining({"services": services, "completed_actions": completed_actions}):
            log_decision(
                trace_logger=trace_logger,
                decision_log=decision_log,
                phase="REPORT",
                message="All relevant checks for discovered services are complete, so the agent will generate the final report.",
                action="generate_report",
                args={"target_host": target_host},
            )
            break

    recommendation_summary: RecommendationSummary = generate_recommendation_summary(findings)
    plan = build_plan_from_decisions(goal, decision_log)

    output_json_paths = save_json_outputs(
        output_dir=trace_path.parent,
        services=services,
        findings=findings,
        decision_log=decision_log,
    )
    tool_outputs["structured_outputs"] = output_json_paths

    generated_path = generate_markdown_report(
        report_path=report_path,
        goal=goal,
        target_url=target_url,
        approved_target_host=approved_target_host,
        read_only=True,
        plan=plan,
        findings=findings,
        recommendation_summary=recommendation_summary,
        trace_path=trace_path,
        tool_outputs=tool_outputs,
    )
    generated_report_path = str(generated_path)

    trace_logger.log_event(
        event="report_generated",
        data={"report_path": generated_report_path, "findings_count": len(findings)},
    )
    trace_logger.log_event(
        event="agent_run_completed",
        data={"read_only": True, "no_system_changes_made": True, "report_path": generated_report_path},
    )

    return AgentRunResult(
        goal=goal,
        target_url=target_url,
        approved_target_host=approved_target_host,
        read_only=True,
        plan=plan,
        services=services,
        observations=observations,
        decision_log=decision_log,
        tool_outputs=tool_outputs,
        findings=findings,
        recommendation_summary=recommendation_summary.to_dict(),
        report_path=generated_report_path,
        error=None,
    )
