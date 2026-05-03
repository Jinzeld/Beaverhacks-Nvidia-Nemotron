"""
Finding model for Nemotron VM Fix Agent.

This module defines one structured finding schema shared by all safe read-only
backend tools. Tools produce facts; Nemotron may later reason over those facts.
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
    One security finding produced by a backend-controlled read-only tool.
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
        return asdict(self)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def missing_header_finding(
    *,
    header_name: str,
    target_url: str,
    severity: Severity,
    recommendation: str,
) -> Finding:
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


def wildcard_cors_finding(*, target_url: str, header_value: str) -> Finding:
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
            "For production, use the real trusted application origin."
        ),
        remediation_type="remediable",
        created_at=utc_now_iso(),
    )


def anonymous_ftp_finding(*, target_host: str, port: int, evidence: str) -> Finding:
    return Finding(
        finding_id="ftp_anonymous_login_enabled",
        title="Anonymous FTP login enabled",
        category="ftp_misconfiguration",
        severity="medium",
        status="open",
        evidence=evidence,
        affected_target=f"ftp://{target_host}:{port}",
        recommendation=(
            "Disable anonymous FTP login unless there is a documented business requirement. "
            "Restrict FTP access to authenticated users and review exposed files."
        ),
        remediation_type="review-required",
        created_at=utc_now_iso(),
    )


def exposed_env_finding(*, target_url: str, evidence: str) -> Finding:
    return Finding(
        finding_id="http_exposed_env_file",
        title="Exposed environment file",
        category="sensitive_file_exposure",
        severity="high",
        status="open",
        evidence=evidence,
        affected_target=target_url,
        recommendation=(
            "Remove .env files from the web root, deny access to dotfiles at the web server layer, "
            "and rotate any real credentials if exposure occurred."
        ),
        remediation_type="remediable",
        created_at=utc_now_iso(),
    )


def directory_listing_finding(*, target_url: str, evidence: str) -> Finding:
    return Finding(
        finding_id="http_directory_listing_enabled",
        title="Directory listing enabled",
        category="web_misconfiguration",
        severity="medium",
        status="open",
        evidence=evidence,
        affected_target=target_url,
        recommendation=(
            "Disable directory listing/autoindex and restrict direct access to internal files, "
            "backups, and notes."
        ),
        remediation_type="remediable",
        created_at=utc_now_iso(),
    )


def debug_endpoint_finding(*, target_url: str, evidence: str) -> Finding:
    return Finding(
        finding_id="http_debug_endpoint_exposure",
        title="Debug endpoint exposes sensitive information",
        category="debug_exposure",
        severity="high",
        status="open",
        evidence=evidence,
        affected_target=target_url,
        recommendation=(
            "Disable debug endpoints in production, require authentication for diagnostics, "
            "and avoid returning secrets in API responses."
        ),
        remediation_type="remediable",
        created_at=utc_now_iso(),
    )


def reflected_input_finding(*, target_url: str, evidence: str) -> Finding:
    return Finding(
        finding_id="http_reflected_user_input",
        title="Reflected user input detected",
        category="web_input_handling",
        severity="medium",
        status="open",
        evidence=evidence,
        affected_target=target_url,
        recommendation=(
            "HTML-encode user-controlled output and maintain a restrictive Content-Security-Policy. "
            "The audit used a harmless canary string only."
        ),
        remediation_type="review-required",
        created_at=utc_now_iso(),
    )
