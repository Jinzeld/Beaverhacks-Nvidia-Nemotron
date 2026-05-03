"""Read-only FTP anonymous login audit tool."""

from __future__ import annotations

import ftplib
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.findings import Finding, anonymous_ftp_finding


@dataclass(frozen=True)
class FtpAuditResult:
    target_host: str
    port: int
    scanned_at: str
    anonymous_login_succeeded: bool
    evidence: str
    findings: List[Finding]
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["findings"] = [finding.to_dict() for finding in self.findings]
        return data


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def check_ftp_anonymous(target_host: str, port: int = 21, timeout_seconds: int = 8) -> FtpAuditResult:
    """Check whether anonymous FTP login and a harmless file read are allowed."""

    findings: List[Finding] = []

    try:
        ftp = ftplib.FTP()
        ftp.connect(target_host, port, timeout=timeout_seconds)
        ftp.login("anonymous", "anonymous@example.com")

        try:
            root_listing = ftp.nlst()
        except Exception:
            root_listing = []

        readme_lines: List[str] = []
        try:
            ftp.cwd("pub")
            ftp.retrlines("RETR README.txt", readme_lines.append)
        except Exception:
            pass

        try:
            ftp.quit()
        except Exception:
            ftp.close()

        evidence = (
            f"Anonymous FTP login succeeded on {target_host}:{port}. "
            f"Root listing: {root_listing}. "
            f"README sample: {' '.join(readme_lines)[:300]}"
        )
        findings.append(anonymous_ftp_finding(target_host=target_host, port=port, evidence=evidence))

        return FtpAuditResult(
            target_host=target_host,
            port=port,
            scanned_at=utc_now_iso(),
            anonymous_login_succeeded=True,
            evidence=evidence,
            findings=findings,
            error=None,
        )
    except Exception as exc:
        return FtpAuditResult(
            target_host=target_host,
            port=port,
            scanned_at=utc_now_iso(),
            anonymous_login_succeeded=False,
            evidence=f"Anonymous FTP login did not succeed on {target_host}:{port}.",
            findings=[],
            error=str(exc),
        )
