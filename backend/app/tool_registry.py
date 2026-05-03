"""
Backend-controlled tool registry.

This file is a safety boundary.

Nemotron may later reason about tool choices, but it must not:
- create tools
- modify tools
- execute commands
- scan arbitrary targets

All enabled MVP tools must be deterministic, backend-controlled, and read-only.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Literal


ToolRiskLevel = Literal["safe-read-only", "approval-required", "disabled"]
ToolCategory = Literal["http", "linux_posture", "windows_import", "report"]


@dataclass(frozen=True)
class ToolDefinition:
    """
    Metadata for one backend-controlled tool.

    This object describes what a tool is allowed to do.
    It does not execute the tool.
    """

    name: str
    description: str
    category: ToolCategory
    read_only: bool
    enabled: bool
    risk_level: ToolRiskLevel
    allowed_inputs: Dict[str, str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def get_tool_registry() -> Dict[str, ToolDefinition]:
    """
    Return all backend-known tools.

    Only source code can define tools.
    User prompts and Nemotron responses cannot add tools.
    """

    return {
        "http_header_scan": ToolDefinition(
            name="http_header_scan",
            description=(
                "Collect HTTP response headers from the configured TARGET_URL "
                "and detect missing security headers and wildcard CORS."
            ),
            category="http",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={
                "target_url": "Must match configured TARGET_URL",
                "approved_target_host": "Must match APPROVED_TARGET_HOST",
            },
        ),
        "linux_listening_ports_readonly": ToolDefinition(
            name="linux_listening_ports_readonly",
            description=(
                "Future read-only Linux posture tool. It will list local listening ports "
                "using backend allowlisted commands only."
            ),
            category="linux_posture",
            read_only=True,
            enabled=False,
            risk_level="safe-read-only",
            allowed_inputs={
                "host": "Local Ubuntu or controlled agent VM only",
            },
        ),
        "linux_firewall_status_readonly": ToolDefinition(
            name="linux_firewall_status_readonly",
            description=(
                "Future read-only Linux posture tool. It will collect firewall status "
                "without modifying firewall rules."
            ),
            category="linux_posture",
            read_only=True,
            enabled=False,
            risk_level="safe-read-only",
            allowed_inputs={
                "host": "Local Ubuntu or controlled agent VM only",
            },
        ),
        "windows_posture_json_import": ToolDefinition(
            name="windows_posture_json_import",
            description=(
                "Future import tool for manually generated Windows posture JSON. "
                "The backend must never modify the Windows VM."
            ),
            category="windows_import",
            read_only=True,
            enabled=False,
            risk_level="safe-read-only",
            allowed_inputs={
                "json_path": "Path to manually generated Windows posture JSON",
            },
        ),
        "markdown_report_generator": ToolDefinition(
            name="markdown_report_generator",
            description="Future tool that writes a Markdown security posture report.",
            category="report",
            read_only=True,
            enabled=False,
            risk_level="safe-read-only",
            allowed_inputs={
                "findings": "Structured finding list",
                "agent_trace": "Structured agent trace",
            },
        ),
    }


def list_enabled_tools() -> Dict[str, ToolDefinition]:
    """
    Return only tools enabled for the current phase.

    In the current MVP phase, only http_header_scan is enabled.
    """

    registry = get_tool_registry()
    return {
        name: tool
        for name, tool in registry.items()
        if tool.enabled
    }


def require_enabled_tool(tool_name: str) -> ToolDefinition:
    """
    Safety gate before executing any backend tool.

    This prevents:
    - unregistered tools
    - disabled tools
    - non-read-only tools during MVP mode
    """

    registry = get_tool_registry()

    if tool_name not in registry:
        raise ValueError(f"Tool is not registered: {tool_name}")

    tool = registry[tool_name]

    if not tool.enabled:
        raise ValueError(f"Tool is registered but disabled in this phase: {tool_name}")

    if not tool.read_only:
        raise ValueError(f"Tool is not read-only and cannot run in MVP mode: {tool_name}")

    return tool