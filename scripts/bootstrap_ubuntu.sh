#!/usr/bin/env bash
# Bootstrap helper for the controlled Ubuntu lab VM.
# This installs Python dependencies and the optional Nmap system binary.
# It does not run scans and does not modify firewall, Nginx, or Windows.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

python3 -m pip install -r backend/requirements.txt

if ! command -v nmap >/dev/null 2>&1; then
  echo "Installing optional Nmap system binary for controlled service inventory..."
  sudo apt-get update
  sudo apt-get install -y nmap
else
  echo "nmap already installed: $(command -v nmap)"
fi

python3 scripts/check_tools.py