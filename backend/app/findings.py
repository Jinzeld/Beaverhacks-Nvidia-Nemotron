"""
Finding model for Nemotron VM Fix Agent.

This module defines the structured security finding format used across the MVP.

Why structured findings matter:
- The backend can save them as JSON.
- Nemotron can safely analyze them later.
- The report generator can render them into Markdown.
- The dashboard can display them consistently.

This module is deterministic and read-only.
It does not call Nemotron.
It does not execute commands.
It does not modify systems.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Literal


Severity = Literal["info", "low", "medium", "high"]
FindingStatus = Literal["open", "resolved", "not_applicable"]
RemediationType = Literal[
    "informational",
    "review-required",
    "report-only",
    "remediable",
]


@dataclass(frozen=True)
class Finding:
    """
    One security finding produced by a backend-controlled tool.

    remediation_type explains what kind of action is appropriate:
    - informational: useful context only
    - review-required: human should review before any action
    - report-only: should be documented, not automatically fixed
    - remediable: may be fixable later through approval-gated workflow
    """

    finding_id: str
    title: str
    category: str
    severity: Severity
    status: FindingStatus
    evidence: str
    affected_target: str
    recommendation: str
    remediation_type: RemediationType
    created_at: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert the finding into JSON-serializable data."""
        return asdict(self)


def utc_now_iso() -> str:
    """Return current UTC time in ISO format for finding timestamps."""
    return datetime.now(timezone.utc).isoformat()


def missing_header_finding(
    *,
    header_name: str,
    target_url: str,
    severity: Severity,
    recommendation: str,
) -> Finding:
    """
    Build a Finding for a missing HTTP security header.
    """

    normalized_id = header_name.lower().replace("-", "_")

    return Finding(
        finding_id=f"http_missing_{normalized_id}",
        title=f"Missing {header_name}",
        category="http_security_headers",
        severity=severity,
        status="open",
        evidence=f"The HTTP response from {target_url} did not include the {header_name} header.",
        affected_target=target_url,
        recommendation=recommendation,
        remediation_type="remediable",
        created_at=utc_now_iso(),
    )


def wildcard_cors_finding(
    *,
    target_url: str,
    header_value: str,
) -> Finding:
    """
    Build a Finding for wildcard CORS.

    In this controlled demo, wildcard CORS is considered remediable because
    our optional stretch fix can replace it with a trusted origin later.
    """

    return Finding(
        finding_id="http_wildcard_cors",
        title="Wildcard CORS detected",
        category="http_security_headers",
        severity="medium",
        status="open",
        evidence=(
            f"The HTTP response from {target_url} included "
            f"Access-Control-Allow-Origin: {header_value}"
        ),
        affected_target=target_url,
        recommendation=(
            "Replace wildcard CORS with a specific trusted origin. "
            "For this controlled demo, use the trusted VM origin. "
            "For production, use the real trusted application origin."
        ),
        remediation_type="remediable",
        created_at=utc_now_iso(),
    )