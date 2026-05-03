"""
Lightweight read-only agent orchestrator.

This is the core agentic workflow for the MVP.

The orchestrator is responsible for:
1. Receiving the user goal.
2. Validating the target scope.
3. Building a safe read-only plan.
4. Selecting tools from the backend-controlled tool registry.
5. Running only enabled read-only tools.
6. Recording structured observations and trace events.
7. Generating a Markdown report.

Important:
This is not an autonomous pentesting agent.

Nemotron will be added later as the reasoning layer, but even then:
- Nemotron will not execute commands.
- Nemotron will not create tools.
- Nemotron will not choose arbitrary targets.
- Backend validation remains authoritative.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.agent_trace import AgentTraceLogger
from app.findings import Finding
from app.recommender import RecommendationSummary, generate_recommendation_summary
from app.report import generate_markdown_report
from app.scanner import HeaderScanResult, scan_http_headers, validate_target_url
from app.tool_registry import get_tool_registry, require_enabled_tool


@dataclass(frozen=True)
class AgentPlanStep:
    """
    One step in the agent's visible execution plan.

    This is not private chain-of-thought.
    This is a structured, user-visible plan that can be shown in the demo.
    """

    step_number: int
    tool_name: str
    reason: str
    status: str = "planned"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class AgentPlan:
    """
    Full read-only plan for the current security review.
    """

    goal: str
    mode: str
    steps: List[AgentPlanStep]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "goal": self.goal,
            "mode": self.mode,
            "steps": [step.to_dict() for step in self.steps],
        }


@dataclass(frozen=True)
class AgentRunResult:
    """
    Final result returned by the orchestrator.

    This object is later written to reports/agent_run.json.
    It contains structured data that Nemotron can safely read in later phases.
    """

    goal: str
    target_url: str
    approved_target_host: str
    read_only: bool
    plan: AgentPlan
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
            "tool_outputs": self.tool_outputs,
            "findings": [finding.to_dict() for finding in self.findings],
            "recommendation_summary": self.recommendation_summary,
            "report_path": self.report_path,
            "error": self.error,
        }


def build_deterministic_plan(goal: str) -> AgentPlan:
    """
    Build the MVP investigation plan.

    For Phase 3, this plan is deterministic.
    Later, Nemotron can help explain or refine the plan, but the backend must
    still validate every tool and target before execution.
    """

    return AgentPlan(
        goal=goal,
        mode="read-only",
        steps=[
            AgentPlanStep(
                step_number=1,
                tool_name="http_header_scan",
                reason=(
                    "Check the configured TARGET_URL for missing browser security "
                    "headers and wildcard CORS."
                ),
            ),
            AgentPlanStep(
                step_number=2,
                tool_name="markdown_report_generator",
                reason=(
                    "Generate a Markdown report from structured findings and "
                    "the visible agent trace."
                ),
            ),
        ],
    )


def run_agentic_security_review(
    *,
    goal: str,
    target_url: str,
    approved_target_host: str,
    trace_logger: AgentTraceLogger,
    report_path: Path,
    trace_path: Path,
) -> AgentRunResult:
    """
    Run the read-only agentic security review.

    High-level flow:
    Scope Check -> Plan -> Select Tool -> Execute Read-Only Tool -> Observe -> Report

    No system changes are made here.
    """

    trace_logger.log_event(
        event="agent_goal_received",
        data={"goal": goal},
    )

    validate_target_url(target_url, approved_target_host)

    trace_logger.log_event(
        event="scope_validated",
        data={
            "target_url": target_url,
            "approved_target_host": approved_target_host,
            "read_only": True,
        },
    )

    registry = get_tool_registry()
    trace_logger.log_event(
        event="tool_registry_loaded",
        data={
            "registered_tools": [tool.to_dict() for tool in registry.values()],
        },
    )

    plan = build_deterministic_plan(goal)
    trace_logger.log_event(
        event="agent_plan_generated",
        data=plan.to_dict(),
    )

    tool_outputs: Dict[str, Any] = {}
    all_findings: List[Finding] = []
    generated_report_path: Optional[str] = None
    recommendation_summary: RecommendationSummary = generate_recommendation_summary([])

    for step in plan.steps:
        tool = require_enabled_tool(step.tool_name)

        trace_logger.log_event(
            event="tool_selected",
            data={
                "step_number": step.step_number,
                "tool_name": tool.name,
                "reason": step.reason,
                "read_only": tool.read_only,
                "risk_level": tool.risk_level,
            },
        )

        if tool.name == "http_header_scan":
            scan_result: HeaderScanResult = scan_http_headers(
                target_url=target_url,
                approved_target_host=approved_target_host,
            )

            tool_outputs[tool.name] = scan_result.to_dict()
            all_findings.extend(scan_result.findings)

            trace_logger.log_event(
                event="tool_completed",
                data={
                    "tool_name": tool.name,
                    "status_code": scan_result.status_code,
                    "findings_count": len(scan_result.findings),
                    "error": scan_result.error,
                },
            )

            if scan_result.error:
                trace_logger.log_event(
                    event="tool_observation_error",
                    data={
                        "tool_name": tool.name,
                        "error": scan_result.error,
                    },
                )

        elif tool.name == "markdown_report_generator":
            recommendation_summary = generate_recommendation_summary(all_findings)

            generated_path = generate_markdown_report(
                report_path=report_path,
                goal=goal,
                target_url=target_url,
                approved_target_host=approved_target_host,
                read_only=True,
                plan=plan,
                findings=all_findings,
                recommendation_summary=recommendation_summary,
                trace_path=trace_path,
                tool_outputs=tool_outputs,
            )

            generated_report_path = str(generated_path)

            tool_outputs[tool.name] = {
                "report_path": generated_report_path,
                "recommendation_summary": recommendation_summary.to_dict(),
            }

            trace_logger.log_event(
                event="report_generated",
                data={
                    "tool_name": tool.name,
                    "report_path": generated_report_path,
                    "findings_count": len(all_findings),
                },
            )

            trace_logger.log_event(
                event="tool_completed",
                data={
                    "tool_name": tool.name,
                    "report_path": generated_report_path,
                    "error": None,
                },
            )

        else:
            raise RuntimeError(
                f"Tool '{tool.name}' is enabled but has no execution handler. "
                "Check tool_registry.py and agent_orchestrator.py."
            )

    highest_severity = recommendation_summary.highest_severity

    trace_logger.log_event(
        event="agent_observation_completed",
        data={
            "findings_count": len(all_findings),
            "highest_severity": highest_severity,
        },
    )

    trace_logger.log_event(
        event="agent_run_completed",
        data={
            "read_only": True,
            "no_system_changes_made": True,
            "report_path": generated_report_path,
        },
    )

    return AgentRunResult(
        goal=goal,
        target_url=target_url,
        approved_target_host=approved_target_host,
        read_only=True,
        plan=plan,
        tool_outputs=tool_outputs,
        findings=all_findings,
        recommendation_summary=recommendation_summary.to_dict(),
        report_path=generated_report_path,
        error=None,
    )