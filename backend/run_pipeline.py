"""
Nemotron VM Fix Agent CLI pipeline.

This is the main command-line entry point for the MVP.

Current Phase:
- Loads environment variables from .env
- Validates read-only MVP mode
- Runs the lightweight agentic workflow
- Writes reports/agent_run.json
- Writes audit_logs/agent_trace.jsonl

It does NOT:
- use Nemotron yet
- modify Nginx
- modify firewall settings
- modify Windows VM
- run shell commands
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv


# Resolve important project paths.
# This lets the script work when run from the project root:
# python backend/run_pipeline.py
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
REPORTS_DIR = PROJECT_ROOT / "reports"
AUDIT_DIR = PROJECT_ROOT / "audit_logs"

# Add backend/ to Python import path so we can import app.* modules.
sys.path.insert(0, str(BACKEND_DIR))

from app.agent_orchestrator import run_agentic_security_review  # noqa: E402
from app.agent_trace import AgentTraceLogger  # noqa: E402


DEFAULT_GOAL = "Review the controlled VM lab security posture using read-only checks."


def load_environment() -> Dict[str, str]:
    """
    Load configuration from .env.

    The important safety flags are:
    - READ_ONLY_MODE=true
    - ENABLE_FIX_MODE=false
    - ENABLE_FIREWALL_HARDENING=false
    """

    env_path = PROJECT_ROOT / ".env"

    if env_path.exists():
        load_dotenv(env_path)

    return {
        "TARGET_URL": os.getenv("TARGET_URL", "").strip(),
        "APPROVED_TARGET_HOST": os.getenv("APPROVED_TARGET_HOST", "").strip(),
        "READ_ONLY_MODE": os.getenv("READ_ONLY_MODE", "true").strip().lower(),
        "ENABLE_FIX_MODE": os.getenv("ENABLE_FIX_MODE", "false").strip().lower(),
        "ENABLE_FIREWALL_HARDENING": os.getenv(
            "ENABLE_FIREWALL_HARDENING", "false"
        ).strip().lower(),
    }


def parse_args() -> argparse.Namespace:
    """
    Parse CLI arguments.

    The goal is a human-readable request.
    It does not directly control tools or commands.
    """

    parser = argparse.ArgumentParser(
        description="Nemotron VM Fix Agent read-only backend pipeline."
    )

    parser.add_argument(
        "--goal",
        default=DEFAULT_GOAL,
        help="High-level user goal for the read-only security review.",
    )

    return parser.parse_args()


def reset_trace_file(trace_path: Path) -> None:
    """
    Clear the previous trace before each run.

    This keeps demo output easy to read.
    Later, we can switch to append-only history if needed.
    """

    trace_path.parent.mkdir(parents=True, exist_ok=True)
    trace_path.write_text("", encoding="utf-8")


def write_agent_run_json(agent_result: object) -> Path:
    """
    Save the full agent result as JSON.

    This file is useful for:
    - debugging
    - report generation
    - sending structured data to Nemotron in a later phase
    """

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = REPORTS_DIR / "agent_run.json"

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(agent_result.to_dict(), file, indent=2)

    return output_path


def print_banner(env: Dict[str, str]) -> None:
    """Print project identity and safety mode."""

    print("Nemotron VM Fix Agent")
    print("=" * 28)
    print("Updated Phase 2: Agentic read-only backend")
    print()
    print("Positioning:")
    print("- Defensive VM security advisor")
    print("- Agentic read-only workflow")
    print("- Not an autonomous pentesting agent")
    print()
    print("Core safety sentence:")
    print("Nemotron reasons. Backend controls tools. Human approves risky actions.")
    print()
    print("Current mode:")
    print(f"- READ_ONLY_MODE={env['READ_ONLY_MODE']}")
    print(f"- ENABLE_FIX_MODE={env['ENABLE_FIX_MODE']}")
    print(f"- ENABLE_FIREWALL_HARDENING={env['ENABLE_FIREWALL_HARDENING']}")
    print()
    print("This phase makes no system changes.")
    print()


def validate_mvp_mode(env: Dict[str, str]) -> None:
    """
    Enforce read-only MVP mode.

    If these checks fail, the pipeline stops before running any tool.
    """

    if env["READ_ONLY_MODE"] != "true":
        raise ValueError("READ_ONLY_MODE must be true for the MVP pipeline.")

    if env["ENABLE_FIX_MODE"] != "false":
        raise ValueError("ENABLE_FIX_MODE must be false during the read-only MVP.")

    if env["ENABLE_FIREWALL_HARDENING"] != "false":
        raise ValueError(
            "ENABLE_FIREWALL_HARDENING must be false during the read-only MVP."
        )


def print_agent_result(agent_result: object, output_path: Path, trace_path: Path) -> None:
    """
    Print a human-readable summary for the terminal demo.
    """

    print("Goal:")
    print(f"- {agent_result.goal}")
    print()

    print("Scope:")
    print(f"- TARGET_URL: {agent_result.target_url}")
    print(f"- APPROVED_TARGET_HOST: {agent_result.approved_target_host}")
    print(f"- Read-only: {agent_result.read_only}")
    print()

    print("Agent Plan:")
    for step in agent_result.plan.steps:
        print(f"{step.step_number}. {step.tool_name}")
        print(f"   Reason: {step.reason}")
    print()

    print("Findings:")
    if not agent_result.findings:
        print("- No findings detected by enabled tools.")
    else:
        for finding in agent_result.findings:
            print(f"- [{finding.severity.upper()}] {finding.title}")
            print(f"  Evidence: {finding.evidence}")
            print(f"  Recommendation: {finding.recommendation}")
            print()

    print("Outputs:")
    print(f"- Agent run JSON: {output_path}")
    print(f"- Agent trace JSONL: {trace_path}")
    print()

    print("Safety result:")
    print("- Read-only workflow completed.")
    print("- No system changes were made.")
    print("- No shell commands were executed.")
    print("- Windows VM was not modified.")


def main() -> int:
    """
    Main CLI entry point.
    """

    args = parse_args()
    env = load_environment()

    print_banner(env)

    try:
        validate_mvp_mode(env)
    except ValueError as exc:
        print("[CONFIG ERROR]")
        print(str(exc))
        return 1

    trace_path = AUDIT_DIR / "agent_trace.jsonl"
    reset_trace_file(trace_path)
    trace_logger = AgentTraceLogger(trace_path)

    try:
        agent_result = run_agentic_security_review(
            goal=args.goal,
            target_url=env["TARGET_URL"],
            approved_target_host=env["APPROVED_TARGET_HOST"],
            trace_logger=trace_logger,
        )
    except ValueError as exc:
        print("[SCOPE ERROR]")
        print(str(exc))
        print()
        print("Fix your .env file and run again.")
        return 1

    output_path = write_agent_run_json(agent_result)
    print_agent_result(agent_result, output_path, trace_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())