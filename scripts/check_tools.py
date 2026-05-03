"""
Preflight checks for Nemotron VM Fix Agent.

This script checks whether the local development environment has the Python
packages and optional system tools needed for the controlled lab demo.
It does not run scans and does not modify the system.
"""

from __future__ import annotations

import importlib.util
import shutil
from typing import Iterable


PYTHON_MODULES = ["openai", "requests", "dotenv", "fastapi", "uvicorn", "jinja2"]
OPTIONAL_SYSTEM_TOOLS = ["nmap"]


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def print_status(label: str, ok: bool, detail: str = "") -> None:
    status = "OK" if ok else "MISSING"
    suffix = f" - {detail}" if detail else ""
    print(f"[{status}] {label}{suffix}")


def check_python_modules(modules: Iterable[str]) -> bool:
    print("Python package checks")
    print("-" * 22)
    all_ok = True

    for module in modules:
        ok = module_available(module)
        print_status(module, ok)
        all_ok = all_ok and ok

    print()
    return all_ok


def check_system_tools(tools: Iterable[str]) -> bool:
    print("System tool checks")
    print("-" * 18)
    all_ok = True

    for tool in tools:
        path = shutil.which(tool)
        ok = path is not None
        detail = path or "not found on PATH"
        print_status(tool, ok, detail)
        all_ok = all_ok and ok

    print()
    return all_ok


def main() -> int:
    python_ok = check_python_modules(PYTHON_MODULES)
    tools_ok = check_system_tools(OPTIONAL_SYSTEM_TOOLS)

    if not python_ok:
        print("Install Python dependencies with:")
        print("  python -m pip install -r backend/requirements.txt")
        print()

    if not tools_ok:
        print("Nmap is a system binary, not a normal pip package.")
        print("Install it for the controlled service inventory tool:")
        print("  Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y nmap")
        print("  macOS:         brew install nmap")
        print("  Windows:       install from the official Nmap installer and reopen terminal")
        print()
        print("The agent can still run the required HTTP header MVP checks without Nmap.")

    return 0 if python_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())