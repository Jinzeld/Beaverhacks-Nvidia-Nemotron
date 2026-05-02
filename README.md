# 🔐 SecAgent — Web Interface
### NVIDIA NIM · Nemotron 3 Nano · BeaverHacks 2026

Full-stack cybersecurity vulnerability scanner with a live streaming web UI.

```
nemotron-vm-fix-agent/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── scanner.py
│   │   ├── findings.py
│   │   ├── llm.py
│   │   ├── fixer.py
│   │   ├── verifier.py
│   │   ├── audit.py
│   │   ├── report.py
│   │   ├── state.py
│   │   └── templates/
│   │       └── dashboard.html
│   ├── requirements.txt
│   └── run_pipeline.py
├── vm_lab/
│   ├── ubuntu_setup.md
│   ├── nginx_vulnerable_site.conf
│   ├── security_headers.safe.conf
│   ├── windows_verification.md
│   └── reset_lab.md
├── reports/
│   └── .gitkeep
├── audit_logs/
│   └── .gitkeep
├── .env.example
├── .gitignore
├── README.md
└── DEMO_SCRIPT.md
```

---

## Stack

| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Model    | NVIDIA NIM — Nemotron 3 Nano 30B-A3B      |
| Backend  | FastAPI + Uvicorn (Python)                |
| Frontend | Vanilla HTML/CSS/JS (zero dependencies)   |
| Streaming| Server-Sent Events (SSE)                  |

---

## Setup

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

export NVIDIA_API_KEY="nvapi-xxxxxxxxxxxx"

uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

### 2. Frontend

Just open the file in your browser — no build step needed:

```bash
open frontend/index.html
# or on Windows:
start frontend/index.html
```

Or serve it with Python:
```bash
cd frontend
python -m http.server 3000
# then open http://localhost:3000
```

---

## Web API Endpoints

| Method | Endpoint        | Description                            |
|--------|-----------------|----------------------------------------|
| GET    | `/health`       | Check server status                    |
| POST   | `/scan/stream`  | Scan code with live SSE token stream   |
| POST   | `/scan`         | Scan code, return full JSON result     |
| POST   | `/scan/upload`  | Upload a file and scan it              |
| POST   | `/report`       | Scan + return downloadable .txt report |

### Example request:
```bash
curl -X POST http://localhost:8000/scan \
  -H "Content-Type: application/json" \
  -d '{"code": "query = \"SELECT * FROM users WHERE id = \" + user_id", "filename": "app.py"}'
```

---

## Features

- **Paste code** directly in the browser editor
- **Upload a file** (.py .js .ts .c .cpp .php .rb .go .java .cs)
- **Live streaming output** — watch Nemotron think in real time
- **Download report** as a formatted .txt file
- **Model switcher** — Nano 30B, 70B, or 340B
- **Collapsible vuln cards** with vulnerable code, patches, CVEs, CWE IDs
- **Risk score meter** with severity breakdown

---

## Deployment

To deploy publicly (e.g. for a hackathon demo):

```bash
# Backend on a server
uvicorn main:app --host 0.0.0.0 --port 8000

# Update BACKEND in index.html line 1 to your server IP/domain:
# const BACKEND = "https://your-server.com";
```

Free options: Railway, Render, Fly.io all support FastAPI with one config file.