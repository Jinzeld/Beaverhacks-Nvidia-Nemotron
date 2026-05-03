"""
Structured agent trace logger.

This file records a visible decision trace for the demo.

Important:
This is not private chain-of-thought.

Instead, it records structured events such as:
- goal received
- scope validated
- plan generated
- tool selected
- tool completed
- observation completed

This helps judges understand how the agent works without exposing hidden
reasoning text or allowing unsafe behavior.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


def utc_now_iso() -> str:
    """Return current UTC time in ISO format."""
    return datetime.now(timezone.utc).isoformat()


class AgentTraceLogger:
    """
    Append-only JSONL logger for agent workflow events.

    JSONL means each line is one JSON object.
    This format is easy to inspect in terminal and easy to parse later.
    """

    def __init__(self, trace_path: Path) -> None:
        self.trace_path = trace_path
        self.trace_path.parent.mkdir(parents=True, exist_ok=True)

    def log_event(
        self,
        *,
        event: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Write one structured event to the trace file.
        """

        payload = {
            "timestamp": utc_now_iso(),
            "event": event,
            "data": data or {},
        }

        with self.trace_path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(payload) + "\n")