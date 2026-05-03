"""
Read-only HTTP header scanner.

This module is one backend-controlled tool.

It performs only one safe action:
- Send an HTTP GET request to the configured TARGET_URL.

It detects:
- Missing Content-Security-Policy
- Missing X-Frame-Options
- Missing X-Content-Type-Options
- Missing Referrer-Policy
- Wildcard CORS: Access-Control-Allow-Origin: *

It does NOT:
- execute shell commands
- exploit vulnerabilities
- scan subnets
- modify Nginx
- modify the Windows VM
- use Nemotron directly
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests

from app.findings import Finding, Severity, missing_header_finding, wildcard_cors_finding


# Required browser-facing security headers for the demo.
# Each entry contains deterministic severity and recommendation text.
REQUIRED_SECURITY_HEADERS: Dict[str, Dict[str, str]] = {
    "Content-Security-Policy": {
        "severity": "high",
        "recommendation": (
            "Add a restrictive Content-Security-Policy header. "
            "For the demo Nginx site, a safe baseline is: "
            "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';"
        ),
    },
    "X-Frame-Options": {
        "severity": "medium",
        "recommendation": (
            "Add X-Frame-Options with DENY or SAMEORIGIN to reduce clickjacking risk."
        ),
    },
    "X-Content-Type-Options": {
        "severity": "medium",
        "recommendation": (
            "Add X-Content-Type-Options: nosniff to reduce MIME-sniffing risk."
        ),
    },
    "Referrer-Policy": {
        "severity": "low",
        "recommendation": (
            "Add Referrer-Policy, such as no-referrer or strict-origin-when-cross-origin, "
            "to reduce accidental URL information leakage."
        ),
    },
}


@dataclass(frozen=True)
class HeaderScanResult:
    """
    Structured result from the HTTP header scanner.

    This object is intentionally JSON-friendly so it can be:
    - saved to report files
    - passed to Nemotron later
    - shown in the dashboard later
    """

    target_url: str
    approved_target_host: str
    scanned_at: str
    read_only: bool
    no_system_changes_made: bool
    status_code: Optional[int]
    headers: Dict[str, str]
    findings: List[Finding]
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert scanner result into JSON-serializable data."""
        data = asdict(self)
        data["findings"] = [finding.to_dict() for finding in self.findings]
        return data


def utc_now_iso() -> str:
    """Return current UTC time in ISO format for audit/report timestamps."""
    return datetime.now(timezone.utc).isoformat()


def validate_target_url(target_url: str, approved_target_host: str) -> None:
    """
    Validate scan scope before making any HTTP request.

    This is a key safety control.

    The scanner is only allowed to scan TARGET_URL when its hostname exactly
    matches APPROVED_TARGET_HOST.

    Example:
    TARGET_URL=http://192.168.1.50:8088
    APPROVED_TARGET_HOST=192.168.1.50
    """

    if not target_url:
        raise ValueError("TARGET_URL is missing.")

    if not approved_target_host:
        raise ValueError("APPROVED_TARGET_HOST is missing.")

    if "<UBUNTU_VM_IP>" in target_url or "<UBUNTU_VM_IP>" in approved_target_host:
        raise ValueError(
            "TARGET_URL or APPROVED_TARGET_HOST still contains <UBUNTU_VM_IP>. "
            "Replace it with the real Ubuntu VM IP."
        )

    parsed = urlparse(target_url)

    if parsed.scheme not in {"http", "https"}:
        raise ValueError("TARGET_URL must start with http:// or https://.")

    if not parsed.hostname:
        raise ValueError("TARGET_URL must include a hostname or IP address.")

    if parsed.hostname != approved_target_host:
        raise ValueError(
            "TARGET_URL host does not match APPROVED_TARGET_HOST. "
            f"TARGET_URL host: {parsed.hostname}; "
            f"APPROVED_TARGET_HOST: {approved_target_host}"
        )


def detect_header_findings(
    *,
    target_url: str,
    headers: Dict[str, str],
) -> List[Finding]:
    """
    Convert raw HTTP response headers into structured findings.

    This logic is deterministic:
    the same headers always produce the same findings.
    """

    # HTTP header names are case-insensitive, so normalize them to lowercase.
    normalized_headers = {key.lower(): value for key, value in headers.items()}
    findings: List[Finding] = []

    for header_name, metadata in REQUIRED_SECURITY_HEADERS.items():
        if header_name.lower() not in normalized_headers:
            findings.append(
                missing_header_finding(
                    header_name=header_name,
                    target_url=target_url,
                    severity=metadata["severity"],  # type: ignore[arg-type]
                    recommendation=metadata["recommendation"],
                )
            )

    # Wildcard CORS allows any origin to read responses when CORS applies.
    # For this demo, it is classified as remediable.
    cors_value = normalized_headers.get("access-control-allow-origin")
    if cors_value is not None and cors_value.strip() == "*":
        findings.append(
            wildcard_cors_finding(
                target_url=target_url,
                header_value=cors_value,
            )
        )

    return findings


def scan_http_headers(
    *,
    target_url: str,
    approved_target_host: str,
    timeout_seconds: int = 10,
) -> HeaderScanResult:
    """
    Run the read-only HTTP header scan.

    GET is used instead of HEAD because some servers handle HEAD differently
    and may omit headers that appear in normal browser requests.

    This function never modifies the target.
    """

    validate_target_url(target_url, approved_target_host)

    try:
        response = requests.get(
            target_url,
            timeout=timeout_seconds,
            allow_redirects=False,
        )

        headers = dict(response.headers)
        findings = detect_header_findings(
            target_url=target_url,
            headers=headers,
        )

        return HeaderScanResult(
            target_url=target_url,
            approved_target_host=approved_target_host,
            scanned_at=utc_now_iso(),
            read_only=True,
            no_system_changes_made=True,
            status_code=response.status_code,
            headers=headers,
            findings=findings,
            error=None,
        )

    except requests.RequestException as exc:
        # Network failures are reported as scan errors, not crashes.
        # This keeps the demo stable even if the VM is temporarily unreachable.
        return HeaderScanResult(
            target_url=target_url,
            approved_target_host=approved_target_host,
            scanned_at=utc_now_iso(),
            read_only=True,
            no_system_changes_made=True,
            status_code=None,
            headers={},
            findings=[],
            error=str(exc),
        )