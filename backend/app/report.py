"""Markdown report generator with Nemotron-first and deterministic fallback."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.findings import Finding
from app.nemotron_client import call_nemotron
from app.recommender import RecommendationSummary


SEVERITY_ORDER = {"high": 3, "medium": 2, "low": 1, "info": 0}


def markdown_escape(value: object) -> str:
    text = str(value)
    return text.replace("|", "\\|").replace("\n", " ")


def read_trace_events(trace_path: Path) -> List[Dict[str, Any]]:
    if not trace_path.exists():
        return []

    events: List[Dict[str, Any]] = []
    with trace_path.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                events.append({"timestamp": "unknown", "event": "unparseable_trace_line", "data": {"raw": line}})
    return events


def format_plan_table(plan: object) -> str:
    steps = getattr(plan, "steps", []) or []
    if not steps:
        return "No plan steps were recorded."

    lines = ["| Step | Tool | Reason | Status |", "|---:|---|---|---|"]
    for step in steps:
        lines.append(
            "| "
            f"{markdown_escape(getattr(step, 'step_number', ''))} | "
            f"{markdown_escape(getattr(step, 'tool_name', ''))} | "
            f"{markdown_escape(getattr(step, 'reason', ''))} | "
            f"{markdown_escape(getattr(step, 'status', ''))} |"
        )
    return "\n".join(lines)


def sort_findings(findings: List[Finding]) -> List[Finding]:
    return sorted(findings, key=lambda f: SEVERITY_ORDER.get(f.severity, 0), reverse=True)


def format_findings_table(findings: List[Finding]) -> str:
    if not findings:
        return "No findings were detected by the enabled read-only tools."

    lines = [
        "| Severity | Category | Finding | Affected Target | Evidence | Recommendation |",
        "|---|---|---|---|---|---|",
    ]
    for finding in sort_findings(findings):
        lines.append(
            "| "
            f"{markdown_escape(finding.severity.upper())} | "
            f"{markdown_escape(finding.category)} | "
            f"{markdown_escape(finding.title)} | "
            f"{markdown_escape(finding.affected_target)} | "
            f"{markdown_escape(finding.evidence)} | "
            f"{markdown_escape(finding.recommendation)} |"
        )
    return "\n".join(lines)


def format_recommendations(recommendation_summary: RecommendationSummary) -> str:
    if not recommendation_summary.priority_actions:
        return "No recommendations were generated."
    return "\n".join(f"{i}. {action}" for i, action in enumerate(recommendation_summary.priority_actions, 1))


def format_trace_summary(trace_events: List[Dict[str, Any]]) -> str:
    if not trace_events:
        return "No trace events were available."

    lines = ["| Time | Event | Summary |", "|---|---|---|"]
    for event in trace_events[-50:]:
        timestamp = event.get("timestamp", "")
        event_name = event.get("event", "")
        data = event.get("data", {})
        if isinstance(data, dict):
            summary = data.get("message") or data.get("reason") or data.get("tool_name") or data.get("summary") or json.dumps(data)[:220]
        else:
            summary = str(data)[:220]
        lines.append(f"| {markdown_escape(timestamp)} | {markdown_escape(event_name)} | {markdown_escape(summary)} |")
    return "\n".join(lines)


def build_nemotron_report_prompt(
    *,
    goal: str,
    target_url: str,
    approved_target_host: str,
    read_only: bool,
    findings: List[Finding],
    recommendation_summary: RecommendationSummary,
    trace_events: List[Dict[str, Any]],
    tool_outputs: Dict[str, Any],
) -> str:
    findings_json = [finding.to_dict() for finding in sort_findings(findings)]
    return f"""
You are a defensive cybersecurity auditor writing a professional external audit report.

Rules:
- This is an authorized allowlisted target.
- Do not include exploit instructions.
- Do not include brute-force steps.
- Do not invent evidence.
- Base the report only on structured findings, tool outputs, and visible trace events.
- Write clear professional English.

Goal: {goal}
Target URL: {target_url}
Approved target host: {approved_target_host}
Read-only mode: {read_only}

Recommendation summary:
{json.dumps(recommendation_summary.to_dict(), indent=2)}

Findings:
{json.dumps(findings_json, indent=2)}

Tool outputs:
{json.dumps(tool_outputs, indent=2, default=str)[:9000]}

Visible agent trace:
{json.dumps(trace_events[-60:], indent=2, default=str)[:9000]}

Generate a Markdown report using this exact structure:
# Nemotron External Audit Report
## 1. Executive Summary
## 2. Scope
## 3. Agent Workflow Summary
## 4. Service Discovery Summary
## 5. Risk Summary
## 6. Findings
For each finding include Severity, Affected Service, Evidence, Risk, Recommendation.
## 7. Prioritized Recommendations
## 8. Audit Notes
## 9. Evidence Appendix
""".strip()


def generate_nemotron_report(
    *,
    goal: str,
    target_url: str,
    approved_target_host: str,
    read_only: bool,
    findings: List[Finding],
    recommendation_summary: RecommendationSummary,
    trace_events: List[Dict[str, Any]],
    tool_outputs: Dict[str, Any],
) -> str:
    prompt = build_nemotron_report_prompt(
        goal=goal,
        target_url=target_url,
        approved_target_host=approved_target_host,
        read_only=read_only,
        findings=findings,
        recommendation_summary=recommendation_summary,
        trace_events=trace_events,
        tool_outputs=tool_outputs,
    )
    return call_nemotron(
        [
            {"role": "system", "content": "You write evidence-based defensive security audit reports."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=3000,
    )


def generate_fallback_markdown_report(
    *,
    goal: str,
    target_url: str,
    approved_target_host: str,
    read_only: bool,
    plan: object,
    findings: List[Finding],
    recommendation_summary: RecommendationSummary,
    trace_path: Path,
    tool_outputs: Dict[str, Any],
) -> str:
    trace_events = read_trace_events(trace_path)
    service_output = tool_outputs.get("nmap_scan", {})
    services = service_output.get("services", []) if isinstance(service_output, dict) else []

    lines = [
        "# Nemotron External Audit Report",
        "",
        "## 1. Executive Summary",
        "",
        (
            f"The read-only external audit reviewed `{target_url}` / `{approved_target_host}` "
            f"and identified `{recommendation_summary.total_findings}` finding(s). "
            f"The highest severity is `{recommendation_summary.highest_severity}`."
        ),
        "",
        "## 2. Scope",
        "",
        f"- **Goal:** {goal}",
        f"- **Target URL:** `{target_url}`",
        f"- **Approved Target Host:** `{approved_target_host}`",
        f"- **Read-only Mode:** `{read_only}`",
        "- **Safety Boundary:** Allowlisted target only; no exploit payloads; no brute-force activity; no system modification.",
        "",
        "## 3. Agent Workflow Summary",
        "",
        "The backend used a controlled Plan → Act → Observe → Decide → Report loop. Nemotron may choose the next safe action, but backend validation controls the tool registry and target scope.",
        "",
        "### Visible Plan",
        "",
        format_plan_table(plan),
        "",
        "## 4. Service Discovery Summary",
        "",
    ]

    if services:
        for service in services:
            lines.append(f"- `{service.get('port')}/tcp`: {service.get('service')} {service.get('version', '')}".strip())
    else:
        lines.append("No service discovery data was provided or no allowed demo ports were open.")

    lines.extend([
        "",
        "## 5. Risk Summary",
        "",
        f"- **Total findings:** `{recommendation_summary.total_findings}`",
        f"- **Highest severity:** `{recommendation_summary.highest_severity}`",
        f"- **High:** `{recommendation_summary.counts_by_severity.get('high', 0)}`",
        f"- **Medium:** `{recommendation_summary.counts_by_severity.get('medium', 0)}`",
        f"- **Low:** `{recommendation_summary.counts_by_severity.get('low', 0)}`",
        f"- **Info:** `{recommendation_summary.counts_by_severity.get('info', 0)}`",
        "",
        "## 6. Findings",
        "",
        format_findings_table(findings),
        "",
        "## 7. Prioritized Recommendations",
        "",
        format_recommendations(recommendation_summary),
        "",
        "## 8. Audit Notes",
        "",
        "- This report was generated by safe read-only checks against an allowlisted target.",
        "- No exploit payloads or credential attacks were performed.",
        "- No system changes were made.",
        "",
        "## 9. Evidence Appendix",
        "",
        "### Agent Trace Summary",
        "",
        format_trace_summary(trace_events),
        "",
        "### Tool Outputs",
        "",
        "```json",
        json.dumps(tool_outputs, indent=2, default=str)[:12000],
        "```",
        "",
    ])

    return "\n".join(lines)


def generate_markdown_report(
    *,
    report_path: Path,
    goal: str,
    target_url: str,
    approved_target_host: str,
    read_only: bool,
    plan: object,
    findings: List[Finding],
    recommendation_summary: RecommendationSummary,
    trace_path: Path,
    tool_outputs: Dict[str, Any],
) -> Path:
    trace_events = read_trace_events(trace_path)

    try:
        report = generate_nemotron_report(
            goal=goal,
            target_url=target_url,
            approved_target_host=approved_target_host,
            read_only=read_only,
            findings=findings,
            recommendation_summary=recommendation_summary,
            trace_events=trace_events,
            tool_outputs=tool_outputs,
        )
    except Exception as exc:
        report = generate_fallback_markdown_report(
            goal=goal,
            target_url=target_url,
            approved_target_host=approved_target_host,
            read_only=read_only,
            plan=plan,
            findings=findings,
            recommendation_summary=recommendation_summary,
            trace_path=trace_path,
            tool_outputs=tool_outputs,
        )
        report += f"\n\n<!-- Nemotron report generation failed; fallback used: {exc} -->\n"

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report, encoding="utf-8")
    return report_path
