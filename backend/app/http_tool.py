"""Read-only HTTP/Web exposure audit tools."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests

from app.findings import (
    Finding,
    debug_endpoint_finding,
    directory_listing_finding,
    exposed_env_finding,
    reflected_input_finding,
)
from app.scanner import HeaderScanResult, scan_http_headers, validate_target_url


@dataclass(frozen=True)
class HttpAuditResult:
    tool_name: str
    target_url: str
    scanned_at: str
    status_code: Optional[int]
    evidence: str
    findings: List[Finding]
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["findings"] = [finding.to_dict() for finding in self.findings]
        return data


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_url_in_scope(url: str, approved_target_host: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("HTTP audit URL must start with http:// or https://.")
    if parsed.hostname != approved_target_host:
        raise ValueError(
            f"HTTP audit URL host {parsed.hostname} does not match approved host {approved_target_host}."
        )


def safe_get(url: str, timeout_seconds: int = 6) -> requests.Response:
    return requests.get(url, timeout=timeout_seconds, allow_redirects=False)


def check_http_headers(target_url: str, approved_target_host: str) -> HeaderScanResult:
    return scan_http_headers(target_url=target_url, approved_target_host=approved_target_host)


def check_exposed_env(base_url: str, approved_target_host: str) -> HttpAuditResult:
    validate_target_url(base_url, approved_target_host)
    target_url = base_url.rstrip("/") + "/.env"
    findings: List[Finding] = []

    try:
        response = safe_get(target_url)
        body_sample = response.text[:600]
        upper = body_sample.upper()
        secret_like = any(token in upper for token in ["PASSWORD", "SECRET", "TOKEN", "API_KEY", "DB_", "JWT"])

        if response.status_code == 200 and secret_like:
            evidence = f"GET {target_url} returned HTTP 200 with secret-like keys. Sample: {body_sample[:300]}"
            findings.append(exposed_env_finding(target_url=target_url, evidence=evidence))
        else:
            evidence = f"GET {target_url} returned HTTP {response.status_code}; secret_like={secret_like}."

        return HttpAuditResult(
            tool_name="exposed_env_check",
            target_url=target_url,
            scanned_at=utc_now_iso(),
            status_code=response.status_code,
            evidence=evidence,
            findings=findings,
            error=None,
        )
    except requests.RequestException as exc:
        return HttpAuditResult(
            tool_name="exposed_env_check",
            target_url=target_url,
            scanned_at=utc_now_iso(),
            status_code=None,
            evidence="Request failed while checking exposed .env.",
            findings=[],
            error=str(exc),
        )


def check_directory_listing(base_url: str, approved_target_host: str) -> HttpAuditResult:
    validate_target_url(base_url, approved_target_host)
    target_url = base_url.rstrip("/") + "/files/"
    findings: List[Finding] = []

    try:
        response = safe_get(target_url)
        body = response.text.lower()
        listing_detected = (
            response.status_code == 200
            and ("index of" in body or "<a href=" in body or "db-backup.sql" in body or "internal-note.txt" in body)
        )

        if listing_detected:
            evidence = f"GET {target_url} returned a browsable directory-style response. Sample: {response.text[:300]}"
            findings.append(directory_listing_finding(target_url=target_url, evidence=evidence))
        else:
            evidence = f"GET {target_url} returned HTTP {response.status_code}; directory_listing={listing_detected}."

        return HttpAuditResult(
            tool_name="directory_listing_check",
            target_url=target_url,
            scanned_at=utc_now_iso(),
            status_code=response.status_code,
            evidence=evidence,
            findings=findings,
            error=None,
        )
    except requests.RequestException as exc:
        return HttpAuditResult(
            tool_name="directory_listing_check",
            target_url=target_url,
            scanned_at=utc_now_iso(),
            status_code=None,
            evidence="Request failed while checking directory listing.",
            findings=[],
            error=str(exc),
        )


def check_debug_endpoint(base_url: str, approved_target_host: str) -> HttpAuditResult:
    validate_url_in_scope(base_url, approved_target_host)
    target_url = base_url.rstrip("/") + "/debug"
    findings: List[Finding] = []

    try:
        response = safe_get(target_url)
        sample = response.text[:600]
        lower = sample.lower().replace(" ", "")
        exposed = response.status_code == 200 and (
            "api_key" in lower or "db_password" in lower or "jwt_secret" in lower or '"debug":true' in lower
        )

        if exposed:
            evidence = f"GET {target_url} returned debug or secret-like fields. Sample: {sample[:300]}"
            findings.append(debug_endpoint_finding(target_url=target_url, evidence=evidence))
        else:
            evidence = f"GET {target_url} returned HTTP {response.status_code}; exposed_debug={exposed}."

        return HttpAuditResult(
            tool_name="debug_endpoint_check",
            target_url=target_url,
            scanned_at=utc_now_iso(),
            status_code=response.status_code,
            evidence=evidence,
            findings=findings,
            error=None,
        )
    except requests.RequestException as exc:
        return HttpAuditResult(
            tool_name="debug_endpoint_check",
            target_url=target_url,
            scanned_at=utc_now_iso(),
            status_code=None,
            evidence="Request failed while checking debug endpoint.",
            findings=[],
            error=str(exc),
        )


def check_reflection(base_url: str, approved_target_host: str) -> HttpAuditResult:
    validate_url_in_scope(base_url, approved_target_host)
    canary = "NEMO_AUDIT_CANARY"
    target_url = base_url.rstrip("/") + f"/search?q={canary}"
    findings: List[Finding] = []

    try:
        response = safe_get(target_url)
        reflected = response.status_code == 200 and canary in response.text

        if reflected:
            evidence = f"GET {target_url} reflected the safe audit canary in the response body."
            findings.append(reflected_input_finding(target_url=target_url, evidence=evidence))
        else:
            evidence = f"GET {target_url} returned HTTP {response.status_code}; reflected={reflected}."

        return HttpAuditResult(
            tool_name="reflection_check",
            target_url=target_url,
            scanned_at=utc_now_iso(),
            status_code=response.status_code,
            evidence=evidence,
            findings=findings,
            error=None,
        )
    except requests.RequestException as exc:
        return HttpAuditResult(
            tool_name="reflection_check",
            target_url=target_url,
            scanned_at=utc_now_iso(),
            status_code=None,
            evidence="Request failed while checking safe canary reflection.",
            findings=[],
            error=str(exc),
        )
