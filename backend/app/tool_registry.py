"""Backend-controlled read-only tool registry."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Literal


ToolRiskLevel = Literal["safe-read-only", "approval-required", "disabled"]
ToolCategory = Literal["discovery", "ftp", "http", "web", "linux_posture", "windows_import", "report"]


@dataclass(frozen=True)
class ToolDefinition:
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
    Return all backend-known tools. User prompts and Nemotron responses cannot
    create tools or change this registry.
    """

    return {
        "nmap_scan": ToolDefinition(
            name="nmap_scan",
            description="Run constrained Nmap service discovery on allowed demo ports 21, 8088, and 8090.",
            category="discovery",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={"target_host": "Must equal approved target host"},
        ),
        "ftp_anonymous_check": ToolDefinition(
            name="ftp_anonymous_check",
            description="Check whether anonymous FTP login and harmless file read are allowed.",
            category="ftp",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={"target_host": "Must equal approved target host", "port": "21 only"},
        ),
        "http_header_check": ToolDefinition(
            name="http_header_check",
            description="Collect HTTP headers and detect missing browser security headers and wildcard CORS.",
            category="http",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={"url": "http://approved-host:8088"},
        ),
        "http_header_scan": ToolDefinition(
            name="http_header_scan",
            description="Backward-compatible alias for http_header_check.",
            category="http",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={"target_url": "Must match configured TARGET_URL"},
        ),
        "exposed_env_check": ToolDefinition(
            name="exposed_env_check",
            description="Check whether /.env is externally readable and contains secret-like keys.",
            category="web",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={"url": "http://approved-host:8088"},
        ),
        "directory_listing_check": ToolDefinition(
            name="directory_listing_check",
            description="Check whether /files/ exposes a browsable directory listing.",
            category="web",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={"url": "http://approved-host:8088"},
        ),
        "debug_endpoint_check": ToolDefinition(
            name="debug_endpoint_check",
            description="Check whether /debug exposes diagnostic or secret-like data.",
            category="web",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={"url": "http://approved-host:8090"},
        ),
        "reflection_check": ToolDefinition(
            name="reflection_check",
            description="Run a harmless canary reflection check against /search.",
            category="web",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={"url": "http://approved-host:8090/search?q=NEMO_AUDIT_CANARY"},
        ),
        "markdown_report_generator": ToolDefinition(
            name="markdown_report_generator",
            description="Generate a Markdown report from structured findings and visible agent trace.",
            category="report",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={"findings": "Structured findings", "agent_trace": "Visible trace", "report_path": "Controlled reports path"},
        ),
        "generate_report": ToolDefinition(
            name="generate_report",
            description="Alias used by the Nemotron planner to trigger markdown report generation.",
            category="report",
            read_only=True,
            enabled=True,
            risk_level="safe-read-only",
            allowed_inputs={"findings": "Structured findings", "agent_trace": "Visible trace"},
        ),
        "linux_listening_ports_readonly": ToolDefinition(
            name="linux_listening_ports_readonly",
            description="Future authenticated Linux posture tool; disabled for external audit MVP.",
            category="linux_posture",
            read_only=True,
            enabled=False,
            risk_level="safe-read-only",
            allowed_inputs={"host": "Controlled agent VM only"},
        ),
        "windows_posture_json_import": ToolDefinition(
            name="windows_posture_json_import",
            description="Future import tool for manually generated Windows posture JSON.",
            category="windows_import",
            read_only=True,
            enabled=False,
            risk_level="safe-read-only",
            allowed_inputs={"json_path": "Path to manually generated JSON"},
        ),
    }


def list_enabled_tools() -> Dict[str, ToolDefinition]:
    registry = get_tool_registry()
    return {name: tool for name, tool in registry.items() if tool.enabled}


def require_enabled_tool(tool_name: str) -> ToolDefinition:
    registry = get_tool_registry()

    if tool_name not in registry:
        raise ValueError(f"Tool is not registered: {tool_name}")

    tool = registry[tool_name]
    if not tool.enabled:
        raise ValueError(f"Tool is registered but disabled in this phase: {tool_name}")

    if not tool.read_only:
        raise ValueError(f"Tool is not read-only and cannot run in MVP mode: {tool_name}")

    return tool
