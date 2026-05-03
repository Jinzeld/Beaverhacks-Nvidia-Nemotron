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
| Frontend | React + Vite + TypeScript ([`web/`](web/)); legacy static UI in [`frontend/`](frontend/) |
| Streaming| Server-Sent Events (SSE)                  |

---

## Setup

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

export NVIDIA_API_KEY="nvapi-xxxxxxxxxxxx"   # optional; planner falls back if unset

python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend runs at `http://127.0.0.1:8000`  
API docs at `http://127.0.0.1:8000/docs`

### 2. Frontend (primary — `web/`)

```bash
cd web
npm install
npm run dev   # FastAPI on :8000 + Vite (requires backend deps / uvicorn)
```

Use `npm run dev:vite` only if the API is already running in another process. Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Leave `VITE_API_BASE_URL` empty so Vite proxies `/api` to port 8000. Set `VITE_USE_MOCK=false` in `web/.env` for live scans. See [`web/README.md`](web/README.md).

**Legacy static UI:** open `frontend/index.html` in a browser or `cd frontend && python -m http.server 3000` (no build; uses `frontend/scan.js`).

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
# Backend on a server (run from repo / backend)
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000

# React app: set VITE_API_BASE_URL at build time to your API origin, or serve API and UI on the same host.
# Legacy static: set BACKEND in frontend/scan.js to your API URL.
```

Free options: Railway, Render, Fly.io all support FastAPI with one config file.