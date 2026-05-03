"""
Deterministic recommendation generator.

This module turns structured findings into text-only recommendations.

Important:
- This is read-only.
- It does not call Nemotron.
- It does not execute commands.
- It does not modify systems.

Later, Nemotron can improve the wording and prioritization narrative, but this
deterministic recommender gives us a safe fallback for the MVP.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List

from app.findings import Finding


SEVERITY_ORDER = {
    "info": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
}


@dataclass(frozen=True)
class RecommendationSummary:
    """
    Summary of what the user should review or fix next.

    This object is intentionally JSON-friendly so it can be:
    - saved into agent_run.json
    - rendered into report.md
    - passed to Nemotron later
    """

    total_findings: int
    highest_severity: str
    counts_by_severity: Dict[str, int]
    priority_actions: List[str]
    overall_summary: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def calculate_highest_severity(findings: List[Finding]) -> str:
    """
    Return the highest severity among all findings.
    """

    if not findings:
        return "none"

    return max(findings, key=lambda finding: SEVERITY_ORDER[finding.severity]).severity


def count_findings_by_severity(findings: List[Finding]) -> Dict[str, int]:
    """
    Count findings by severity for report summary tables.
    """

    counts = {
        "high": 0,
        "medium": 0,
        "low": 0,
        "info": 0,
    }

    for finding in findings:
        counts[finding.severity] += 1

    return counts


def build_priority_actions(findings: List[Finding]) -> List[str]:
    """
    Build a deterministic prioritized action list.

    These are text-only recommendations. They do not apply fixes.
    """

    if not findings:
        return [
            "No required HTTP header findings were detected by the enabled tools."
        ]

    sorted_findings = sorted(
        findings,
        key=lambda finding: SEVERITY_ORDER[finding.severity],
        reverse=True,
    )

    actions: List[str] = []

    for finding in sorted_findings:
        actions.append(
            f"[{finding.severity.upper()}] {finding.title}: {finding.recommendation}"
        )

    return actions


def generate_recommendation_summary(findings: List[Finding]) -> RecommendationSummary:
    """
    Generate a deterministic recommendation summary from findings.
    """

    total_findings = len(findings)
    highest_severity = calculate_highest_severity(findings)
    counts_by_severity = count_findings_by_severity(findings)
    priority_actions = build_priority_actions(findings)

    if total_findings == 0:
        overall_summary = (
            "No findings were detected by the currently enabled read-only tools. "
            "This does not prove the target is fully secure; it only means the MVP "
            "checks did not detect the required HTTP header findings."
        )
    else:
        overall_summary = (
            f"The read-only security review detected {total_findings} finding(s). "
            f"The highest severity is {highest_severity.upper()}. "
            "The current MVP provides text-only recommendations and makes no system changes."
        )

    return RecommendationSummary(
        total_findings=total_findings,
        highest_severity=highest_severity,
        counts_by_severity=counts_by_severity,
        priority_actions=priority_actions,
        overall_summary=overall_summary,
    )