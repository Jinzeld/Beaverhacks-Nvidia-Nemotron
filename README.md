# 🔐 SecAgent — NVIDIA NIM / Nemotron Cybersecurity AI Agent

Powered by **NVIDIA NIM API** using the **Nemotron** model family.
Uses the OpenAI-compatible endpoint at `https://integrate.api.nvidia.com/v1`.

---

## What It Detects

| Vulnerability        | Example                                          |
|----------------------|--------------------------------------------------|
| SQL Injection         | `"SELECT * FROM users WHERE id = " + input`     |
| XSS                  | `"<div>" + user_input + "</div>"`               |
| Buffer Overflow      | Fixed-size buffer with no bounds check           |
| Hardcoded Secrets    | `API_KEY = "sk-prod-abc123..."`                 |

---

## Setup

```bash
# 1. Install dependencies (just the OpenAI SDK — that's all you need)
pip install -r requirements.txt

# 2. Get a free NVIDIA API key at https://build.nvidia.com
#    New accounts get 1,000 free inference credits

# 3. Export your key
export NVIDIA_API_KEY="nvapi-xxxxxxxxxxxxxxxxxxxx"
```

---

## Usage

```bash
# Scan a specific file
python security_agent.py --file yourcode.py

# Run built-in demo (intentionally vulnerable code)
python security_agent.py --demo

# Scan + generate report
python security_agent.py --file app.py --report

# Scan + auto-apply patches
python security_agent.py --file app.py --patch

# Everything at once
python security_agent.py --file app.py --report --patch

# Use a different Nemotron model
python security_agent.py --file app.py --model nvidia/nemotron-4-340b-instruct

# Save report to specific path
python security_agent.py --file app.py --report --output my_report.txt
```

---

## Available Nemotron Models

| Model ID                                        | Notes                        |
|-------------------------------------------------|------------------------------|
| `nvidia/nemotron-3-nano-30b-a3b`                | **Default — your key** ✅    |
| `nvidia/llama-3.1-nemotron-70b-instruct`        | Fast + accurate              |
| `nvidia/llama-3.1-nemotron-ultra-253b-v1`       | Best reasoning, slower       |
| `nvidia/nemotron-4-340b-instruct`               | Flagship 340B model          |

Switch with: `--model nvidia/nemotron-4-340b-instruct`

---

## Output Per Vulnerability

- **ID** — VULN-001, VULN-002, ...
- **Type** — SQL_INJECTION, XSS, BUFFER_OVERFLOW, HARDCODED_SECRET
- **Severity** — CRITICAL / HIGH / MEDIUM / LOW
- **Line numbers** — where the bug lives
- **Vulnerable code** — exact snippet
- **Description** — why it's dangerous and how attackers exploit it
- **Impact** — real-world damage
- **CVE references** — related CVEs
- **CWE ID** — weakness classification
- **Auto-patch** — fixed version of the code
- **Fix explanation** — what the fix does and why it works

---

## How It Works

```
security_agent.py
│
├── SecurityAgent.__init__()
│   └── openai.OpenAI(base_url="https://integrate.api.nvidia.com/v1")
│
├── scan_code()
│   ├── Sends code + system prompt to NIM streaming API
│   ├── Strips <think>...</think> reasoning traces (Nemotron-specific)
│   └── Parses JSON vulnerability report from model response
│
├── display_results()  — color-coded terminal output + risk bar
├── generate_report()  — saves timestamped .txt report
└── apply_patches()    — replaces vulnerable snippets in source file
```

The agent uses `temperature=0.1` for deterministic, accurate security analysis and streams tokens so you get live feedback during long scans.

---

## Notes

- The `<think>...</think>` traces some Nemotron models emit are automatically stripped before JSON parsing
- `--patch` does direct string replacement — works great for isolated snippets, complex cases may need manual review
- Reports are timestamped so you can track scan history over time
- Free NIM tier gives you 1,000 credits (~40 req/min rate limit)