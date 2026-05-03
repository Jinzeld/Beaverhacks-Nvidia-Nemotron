"""
Nemotron API client.

This module is the only place that talks to NVIDIA's OpenAI-compatible
Nemotron endpoint. It does not execute tools and it does not expose API keys.
"""

from __future__ import annotations

import os
from typing import Dict, List

from dotenv import load_dotenv


DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_MODEL = "nvidia/nemotron-3-nano-30b-a3b"


def load_nemotron_config() -> Dict[str, str]:
    """Load Nemotron configuration from .env."""

    load_dotenv(dotenv_path=".env")

    api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    base_url = os.getenv("NVIDIA_BASE_URL", DEFAULT_BASE_URL).strip()
    model = os.getenv("NVIDIA_MODEL", DEFAULT_MODEL).strip()

    if not api_key:
        raise ValueError("NVIDIA_API_KEY is not set. Add it to .env or export it.")

    if not api_key.isascii():
        raise ValueError("NVIDIA_API_KEY contains non-ASCII characters. Check .env for placeholders or copy errors.")

    return {
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
    }


def call_nemotron(
    messages: List[Dict[str, str]],
    *,
    temperature: float = 0.1,
    max_tokens: int = 600,
) -> str:
    """
    Call Nemotron and return assistant message content.

    The caller is responsible for parsing the content. This function never
    returns reasoning_content and never prints secrets.
    """

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise ValueError("openai package is not installed. Run pip install -r requirements.txt") from exc

    config = load_nemotron_config()
    client = OpenAI(api_key=config["api_key"], base_url=config["base_url"])

    response = client.chat.completions.create(
        model=config["model"],
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=False,
    )

    content = response.choices[0].message.content
    if content is None or not content.strip():
        raise ValueError("Nemotron returned empty content.")

    return content.strip()
