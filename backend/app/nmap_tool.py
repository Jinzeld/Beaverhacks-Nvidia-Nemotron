"""
Read-only Nmap service discovery tool.

The command is intentionally constrained to a small allowlisted port set used
by the demo target: FTP 21, Nginx 8088, and Flask bad-web 8090.
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


SCAN_PORTS = "21,8088,8090"


@dataclass(frozen=True)
class ServiceInfo:
    port: int
    state: str
    service: str
    version: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class NmapScanResult:
    target_host: str
    scanned_at: str
    command: str
    services: List[ServiceInfo]
    raw_output: str
    stderr: str
    returncode: int
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["services"] = [svc.to_dict() for svc in self.services]
        return data


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_command(cmd: List[str], timeout_seconds: int = 45) -> Dict[str, Any]:
    """Run a bounded subprocess command and never raise on timeout."""

    try:
        result = subprocess.run(
            cmd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout_seconds,
        )
        return {
            "returncode": result.returncode,
            "stdout": (result.stdout or "").strip(),
            "stderr": (result.stderr or "").strip(),
            "error": None,
        }
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout if isinstance(exc.stdout, str) else ""
        stderr = exc.stderr if isinstance(exc.stderr, str) else ""
        return {
            "returncode": 124,
            "stdout": stdout.strip(),
            "stderr": (stderr.strip() + f"\nTIMEOUT after {timeout_seconds}s").strip(),
            "error": f"timeout after {timeout_seconds}s",
        }
    except FileNotFoundError as exc:
        return {
            "returncode": 127,
            "stdout": "",
            "stderr": str(exc),
            "error": "nmap command not found",
        }


def normalize_service_name(port: int, detected: str) -> str:
    if port == 21:
        return "ftp"
    if port in {8088, 8090}:
        return "http"
    return detected or "unknown"


def parse_services(nmap_output: str) -> List[ServiceInfo]:
    services: List[ServiceInfo] = []

    for line in nmap_output.splitlines():
        match = re.match(r"^(\d+)/tcp\s+open\s+(\S+)\s*(.*)$", line.strip())
        if not match:
            continue

        port = int(match.group(1))
        detected = match.group(2).strip()
        version = match.group(3).strip()
        services.append(
            ServiceInfo(
                port=port,
                state="open",
                service=normalize_service_name(port, detected),
                version=version,
            )
        )

    return services


def nmap_scan(target_host: str) -> NmapScanResult:
    """
    Run quick read-only service discovery against the demo port set.
    """

    cmd = [
        "nmap",
        "-Pn",
        "-sT",
        "-T4",
        "-n",
        "--max-retries",
        "1",
        "--host-timeout",
        "30s",
        "-p",
        SCAN_PORTS,
        target_host,
    ]

    result = run_command(cmd, timeout_seconds=45)
    services = parse_services(result["stdout"])

    return NmapScanResult(
        target_host=target_host,
        scanned_at=utc_now_iso(),
        command=" ".join(cmd),
        services=services,
        raw_output=result["stdout"],
        stderr=result["stderr"],
        returncode=result["returncode"],
        error=result["error"],
    )
