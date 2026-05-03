"""
FastAPI API layer for Nemotron VM Fix Agent.

This file exposes backend functionality to the frontend.

Important safety boundary:
- Frontend calls API endpoints.
- API calls the backend orchestrator.
- Backend controls all tools.
- The MVP remains read-only.
- No shell commands are executed here.
- No system modifications are made here.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
REPORTS_DIR = PROJECT_ROOT / "reports"
AUDIT_DIR = PROJECT_ROOT / "audit_logs"

# Make sure app.* imports work when FastAPI starts from project root.
sys.path.insert(0, str(BACKEND_DIR))

from app.agent_orchestrator import run_agentic_security_review  # noqa: E402
from app.agent_trace import AgentTraceLogger  # noqa: E402


app = FastAPI(
    title="Nemotron VM Fix Agent API",
    description="Defensive agentic VM security advisor API.",
    version="0.3.0",
)

# Allow local static frontends (other ports) to call the API during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8080",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReviewRequest(BaseModel):
    goal: str = "Review the controlled VM lab security posture using read-only checks."
    target_host: Optional[str] = None


def load_environment() -> Dict[str, str]:
    """
    Load local .env configuration.

    We support both repo-root `.env` and `backend/.env` so local CLI,
    FastAPI, and EC2 demos behave the same. Values in backend/.env override
    repo-root values for developer convenience.
    """

    project_env_path = PROJECT_ROOT / ".env"
    backend_env_path = BACKEND_DIR / ".env"

    if project_env_path.exists():
        load_dotenv(dotenv_path=project_env_path, override=False)

    if backend_env_path.exists():
        load_dotenv(dotenv_path=backend_env_path, override=True)

    approved_target_host = os.getenv("APPROVED_TARGET_HOST", os.getenv("TARGET_HOST", "")).strip()
    target_url = os.getenv("TARGET_URL", "").strip()
    if not target_url and approved_target_host:
        target_url = f"http://{approved_target_host}:8088"

    allowed_targets_raw = os.getenv("ALLOWED_TARGETS", "").strip()
    allowed_targets = [item.strip() for item in allowed_targets_raw.split(",") if item.strip()]
    for candidate in (approved_target_host, os.getenv("TARGET_HOST", "").strip()):
        if candidate and candidate not in allowed_targets:
            allowed_targets.append(candidate)

    return {
        "TARGET_URL": target_url,
        "APPROVED_TARGET_HOST": approved_target_host,
        "ALLOWED_TARGETS": ",".join(allowed_targets),
        "READ_ONLY_MODE": os.getenv("READ_ONLY_MODE", "true").strip().lower(),
        "ENABLE_FIX_MODE": os.getenv("ENABLE_FIX_MODE", "false").strip().lower(),
        "ENABLE_FIREWALL_HARDENING": os.getenv(
            "ENABLE_FIREWALL_HARDENING", "false"
        ).strip().lower(),
    }


def normalize_target_host_input(value: str) -> str:
    """Normalize UI input into a host/IP candidate.

    The backend still enforces allowlisting. This helper only removes URL
    scheme/path noise from the frontend input.
    """

    candidate = (value or "").strip()
    if not candidate:
        return ""

    if candidate.startswith("http://") or candidate.startswith("https://"):
        from urllib.parse import urlparse

        parsed = urlparse(candidate)
        return parsed.hostname or ""

    return candidate.split("/", 1)[0].strip()


def resolve_target_scope(env: Dict[str, str], requested_target_host: Optional[str]) -> Dict[str, str]:
    """Return target_url and approved_target_host for this run.

    If the UI sends a target, it must be present in ALLOWED_TARGETS or match
    APPROVED_TARGET_HOST/TARGET_HOST. Otherwise the backend refuses the scan.
    """

    allowed_targets = [item for item in env.get("ALLOWED_TARGETS", "").split(",") if item]
    requested = normalize_target_host_input(requested_target_host or "")

    if requested:
        if requested not in allowed_targets:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Target {requested} is not allowlisted. "
                    "Set ALLOWED_TARGETS or APPROVED_TARGET_HOST in backend/.env."
                ),
            )
        return {
            "TARGET_URL": f"http://{requested}:8088",
            "APPROVED_TARGET_HOST": requested,
        }

    return {
        "TARGET_URL": env["TARGET_URL"],
        "APPROVED_TARGET_HOST": env["APPROVED_TARGET_HOST"],
    }

def validate_read_only_mode(env: Dict[str, str]) -> None:
    """
    Enforce MVP safety settings before running the agent workflow.
    """

    if env["READ_ONLY_MODE"] != "true":
        raise HTTPException(
            status_code=400,
            detail="READ_ONLY_MODE must be true for the MVP API.",
        )

    if env["ENABLE_FIX_MODE"] != "false":
        raise HTTPException(
            status_code=400,
            detail="ENABLE_FIX_MODE must be false during the read-only MVP.",
        )

    if env["ENABLE_FIREWALL_HARDENING"] != "false":
        raise HTTPException(
            status_code=400,
            detail="ENABLE_FIREWALL_HARDENING must be false during the read-only MVP.",
        )


def reset_trace_file(trace_path: Path) -> None:
    """
    Clear previous trace before each API-triggered review.
    """

    trace_path.parent.mkdir(parents=True, exist_ok=True)
    trace_path.write_text("", encoding="utf-8")


def write_agent_run_json(agent_result: object) -> Path:
    """
    Save latest agent result to reports/agent_run.json.
    """

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = REPORTS_DIR / "agent_run.json"

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(agent_result.to_dict(), file, indent=2)

    return output_path


def read_trace_events(trace_path: Path) -> List[Dict[str, Any]]:
    """
    Read JSONL trace events for frontend display.
    """

    if not trace_path.exists():
        return []

    events: List[Dict[str, Any]] = []

    with trace_path.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            events.append(json.loads(line))

    return events


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    """
    Simple endpoint for frontend to confirm backend is running.
    """

    return {
        "status": "ok",
        "service": "Nemotron VM Fix Agent",
        "mode": "read-only",
    }


@app.post("/api/review")
def run_review(request: ReviewRequest) -> Dict[str, Any]:
    """
    Run the read-only agentic security review.

    The frontend provides only a human-readable goal.
    The actual target is controlled by backend .env settings.
    """

    env = load_environment()
    validate_read_only_mode(env)
    scope = resolve_target_scope(env, request.target_host)

    trace_path = AUDIT_DIR / "agent_trace.jsonl"
    report_path = REPORTS_DIR / "report.md"

    reset_trace_file(trace_path)
    trace_logger = AgentTraceLogger(trace_path)

    try:
        agent_result = run_agentic_security_review(
            goal=request.goal,
            target_url=scope["TARGET_URL"],
            approved_target_host=scope["APPROVED_TARGET_HOST"],
            trace_logger=trace_logger,
            report_path=report_path,
            trace_path=trace_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    output_path = write_agent_run_json(agent_result)

    response = agent_result.to_dict()
    response["agent_run_json_path"] = str(output_path)
    response["trace_path"] = str(trace_path)
    response["trace_events"] = read_trace_events(trace_path)
    if report_path.exists():
        response["report_markdown"] = report_path.read_text(encoding="utf-8")

    return response

@app.get("/api/report")
def get_latest_report() -> Dict[str, str]:
    """
    Return latest Markdown report content for frontend display.
    """

    report_path = REPORTS_DIR / "report.md"

    if not report_path.exists():
        raise HTTPException(
            status_code=404,
            detail="No report found. Run POST /api/review first.",
        )

    return {
        "report_markdown": report_path.read_text(encoding="utf-8"),
    }


@app.get("/api/trace")
def get_latest_trace() -> Dict[str, Any]:
    """
    Return latest structured agent trace events.
    """

    trace_path = AUDIT_DIR / "agent_trace.jsonl"

    return {
        "events": read_trace_events(trace_path),
    }


@app.get("/")
def root() -> Dict[str, str]:
    """
    Basic root endpoint.
    """

    return {
        "message": "Nemotron VM Fix Agent API is running.",
        "docs": "/docs",
    }