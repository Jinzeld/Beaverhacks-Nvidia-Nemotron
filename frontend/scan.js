/**
 * Results page: mock scan or live FastAPI POST /api/review + GET /api/report.
 */
const SCAN_PAYLOAD_KEY = "secagent_scan";
const BACKEND = "http://localhost:8000";

/** true = offline mock; false = POST /api/review (requires backend + .env). */
const USE_STATIC_MOCK = true;

let lastResult = null;
let lastTarget = "";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

function log(msg) {
  const co = document.getElementById("console-out");
  co.textContent += msg + "\n";
  co.scrollTop = co.scrollHeight;
}

function loadPayload() {
  const raw = sessionStorage.getItem(SCAN_PAYLOAD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function parseErrorBody(resp) {
  const text = await resp.text().catch(() => "");
  try {
    const j = JSON.parse(text);
    if (j.detail !== undefined) {
      return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    }
    return text || `HTTP ${resp.status}`;
  } catch {
    return text || `HTTP ${resp.status}`;
  }
}

/** Map backend severity to CSS pill class (no .sev-INFO in stylesheet). */
function severityToUi(sev) {
  const s = String(sev || "low").toLowerCase();
  if (s === "high") return "HIGH";
  if (s === "medium") return "MEDIUM";
  if (s === "low") return "LOW";
  return "LOW";
}

function riskScoreFromFindings(findings) {
  if (!findings || !findings.length) return 0;
  const rank = { low: 1, medium: 2, high: 3, info: 0 };
  let maxR = 0;
  findings.forEach((f) => {
    const r = rank[String(f.severity || "low").toLowerCase()] ?? 1;
    if (r > maxR) maxR = r;
  });
  const base = maxR === 3 ? 72 : maxR === 2 ? 48 : maxR === 1 ? 28 : 12;
  return Math.min(95, base + Math.min(findings.length * 3, 18));
}

/**
 * Map POST /api/review JSON to the shape expected by renderResults().
 */
function mapApiResponseToViewModel(apiJson) {
  const findings = apiJson.findings || [];
  const targetUrl = apiJson.target_url || "";
  const err = apiJson.error;

  const vulnerabilities = findings.map((f) => {
    const cat = String(f.category || "").toLowerCase();
    const type =
      cat.includes("http") || (f.title || "").toLowerCase().includes("header")
        ? "EXPOSED_HEADER"
        : "MISCONFIGURATION";
    const sevUi = severityToUi(f.severity);
    const desc = [f.title || "", f.evidence || ""].filter(Boolean).join("\n\n");
    return {
      id: f.finding_id || "",
      type,
      severity: sevUi,
      description: desc,
      impact: f.recommendation || "",
      endpoint: f.affected_target || "",
      vulnerable_code: f.evidence || "",
      fix: f.recommendation
        ? { explanation: f.recommendation, patched_code: "", additional_steps: [] }
        : undefined,
    };
  });

  const tips = [];
  const seen = new Set();
  findings.forEach((f) => {
    const r = f.recommendation;
    if (r && !seen.has(r)) {
      seen.add(r);
      tips.push(r);
    }
  });

  let summary = `${findings.length} finding(s) from read-only header review.`;
  if (err) summary = `Error: ${err}. ` + summary;
  if (apiJson.goal) summary += ` Goal: ${apiJson.goal}`;

  const scannedAt =
    (findings[0] && findings[0].created_at) || new Date().toISOString();

  return {
    target: targetUrl,
    summary,
    risk_score: riskScoreFromFindings(findings),
    scanned_at: scannedAt,
    model_used: "Nemotron VM Fix Agent (read-only API)",
    vulnerabilities,
    secure_coding_tips: tips.slice(0, 6),
  };
}

/** Deterministic mock result for UI demo (no network). */
function buildMockResult(target, modules, model) {
  const ts = new Date().toISOString();
  return {
    target,
    summary:
      "Static preview: sample findings for layout testing. Set USE_STATIC_MOCK = false in scan.js to call the API.",
    risk_score: 62,
    scanned_at: ts,
    model_used: model + " (mock)",
    vulnerabilities: [
      {
        id: "VULN-001",
        type: "EXPOSED_HEADER",
        severity: "MEDIUM",
        cwe_id: "CWE-693",
        endpoint: `https://${target}/`,
        description:
          "Content-Security-Policy header is missing; browsers rely on default permissive behavior.",
        impact: "Increased XSS impact surface if injection exists elsewhere.",
        vulnerable_code: 'Content-Security-Policy: (absent)\nX-Frame-Options: (absent)',
        fix: {
          patched_code:
            'add_header Content-Security-Policy "default-src \'self\'";\nadd_header X-Frame-Options "SAMEORIGIN";',
          explanation: "Add baseline CSP and clickjacking protection at the reverse proxy.",
          additional_steps: ["Reload nginx after validation.", "Re-scan headers."],
        },
      },
      {
        id: "VULN-002",
        type: "MISCONFIGURATION",
        severity: "HIGH",
        cwe_id: "CWE-942",
        description: "Access-Control-Allow-Origin allows wildcard for API responses.",
        impact: "Cross-origin data access from untrusted sites if credentials are involved.",
        vulnerable_code: "Access-Control-Allow-Origin: *",
        fix: {
          patched_code: "Access-Control-Allow-Origin: https://trusted.example",
          explanation: "Restrict CORS to known origins; avoid * in production.",
          additional_steps: [],
        },
      },
    ],
    secure_coding_tips: [
      "Prefer deny-by-default CSP and iterate allowlists.",
      "Validate TLS and HSTS before exposing admin routes.",
    ],
  };
}

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runMockScan(payload) {
  const co = document.getElementById("console-out");
  const { target, modules, model } = payload;
  lastTarget = target;

  document.getElementById("console-wrap").style.display = "block";
  document.getElementById("results-wrap").style.display = "none";
  co.textContent = "";
  document.getElementById("console-status").textContent = "SCANNING...";
  document.getElementById("console-dot").style.animation = "";

  log(`[*] Target   : ${target}`);
  log(`[*] Modules  : ${modules.join(", ")}`);
  log(`[*] Model    : ${model}`);
  log(`[*] Mode     : STATIC MOCK (no backend)\n`);

  await delay(400);
  log("[*] Resolving host…");
  await delay(350);
  log("[*] Fetching response headers…");
  await delay(300);

  const narrative =
    "Header hygiene review (preview).\nMissing CSP/XFO can amplify XSS and clickjacking risk.\n";
  for (const ch of narrative) {
    co.textContent += ch;
    co.scrollTop = co.scrollHeight;
    await delay(12);
  }

  const result = buildMockResult(target, modules, model);
  lastResult = result;
  document.getElementById("console-status").textContent = "COMPLETE ✓";
  document.getElementById("console-dot").style.animation = "none";
  renderResults(result);
}

async function runApiReview(payload) {
  const co = document.getElementById("console-out");
  const { target, modules, model } = payload;

  document.getElementById("console-wrap").style.display = "block";
  document.getElementById("results-wrap").style.display = "none";
  co.textContent = "";
  document.getElementById("console-status").textContent = "SCANNING...";
  document.getElementById("console-dot").style.animation = "";
  lastResult = null;

  const goal = [
    "Read-only security review (MVP).",
    `UI modules: ${modules.join(", ")}.`,
    `User context / note: ${target}.`,
    `Model selection (UI only): ${model}.`,
  ].join(" ");

  log(`[*] POST ${BACKEND}/api/review`);
  log(`[*] Modules (context): ${modules.join(", ")}`);
  log(`[*] Note: actual TARGET_URL comes from server .env\n`);

  try {
    const resp = await fetch(`${BACKEND}/api/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    });

    if (!resp.ok) {
      const msg = await parseErrorBody(resp);
      throw new Error(msg);
    }

    const apiJson = await resp.json();
    log("[*] Response received, mapping results…\n");

    const narrative =
      "Review complete. Findings reflect HTTP headers from the configured server target.\n";
    for (const ch of narrative) {
      co.textContent += ch;
      co.scrollTop = co.scrollHeight;
      await delay(10);
    }

    lastTarget = apiJson.target_url || target;
    const vm = mapApiResponseToViewModel(apiJson);
    lastResult = vm;

    const label = document.getElementById("scan-target-label");
    if (label) label.textContent = lastTarget;

    document.getElementById("console-status").textContent = "COMPLETE ✓";
    document.getElementById("console-dot").style.animation = "none";
    renderResults(vm);
  } catch (e) {
    showToast("Request failed — check backend, .env, and CORS origin.");
    log(`\n[✗] ${e.message}`);
    document.getElementById("console-status").textContent = "FAILED";
    document.getElementById("console-dot").style.animation = "none";
  }
}

function renderResults(result) {
  const wrap = document.getElementById("results-wrap");
  const vulns = result.vulnerabilities || [];
  const risk = result.risk_score || 0;
  const rc = risk >= 70 ? "high" : risk >= 40 ? "medium" : "";

  const icons = {
    SQL_INJECTION: "💉",
    XSS: "⚡",
    BUFFER_OVERFLOW: "💥",
    HARDCODED_SECRET: "🔑",
    OPEN_PORT: "🔓",
    SSL_ISSUE: "🔐",
    EXPOSED_HEADER: "📋",
    DIR_TRAVERSAL: "📂",
    CSRF: "🔄",
    MISCONFIGURATION: "⚙️",
  };

  const sevCounts = {};
  vulns.forEach((v) => {
    sevCounts[v.severity] = (sevCounts[v.severity] || 0) + 1;
  });

  let html = `
  <div class="risk-card fade-up">
    <div>
      <div class="risk-label">Risk Score</div>
      <div class="risk-num ${rc}">${risk}</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--muted)">/100</div>
    </div>
    <div class="risk-center">
      <div class="risk-target">// ${esc(result.target || lastTarget)}</div>
      <div class="risk-bar-bg"><div class="risk-bar-fill ${rc}" style="width:${risk}%"></div></div>
      <div class="risk-summary">${esc(result.summary || "")}</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:8px">
        Scanned: ${result.scanned_at || ""} &nbsp;·&nbsp; Model: ${result.model_used || ""}
      </div>
    </div>
    <div class="risk-right">
      <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:4px">${vulns.length} Finding${vulns.length !== 1 ? "s" : ""}</div>
      ${Object.entries(sevCounts)
        .map(([s, c]) => `<div class="sev-pill sev-${s}">${s}: ${c}</div>`)
        .join("")}
    </div>
  </div>`;

  if (vulns.length === 0) {
    html += `
    <div class="clean-banner fade-up delay-1">
      <div class="clean-icon">✅</div>
      <div class="clean-title">No Vulnerabilities Found</div>
      <div class="clean-sub">${esc(lastTarget)} passed all selected scan modules.</div>
    </div>`;
  } else {
    html += `<div class="vuln-list fade-up delay-1">`;
    vulns.forEach((v, i) => {
      const icon = icons[v.type] || "🔴";
      const fix = v.fix || {};
      html += `
      <div class="vuln-card">
        <div class="vuln-header" onclick="toggleVuln(${i})">
          <span class="vuln-icon">${icon}</span>
          <div>
            <div class="vuln-id">${esc(v.id || `VULN-${String(i + 1).padStart(3, "0")}`)}</div>
            <div class="vuln-type">${esc(v.type || "")}</div>
          </div>
          <div class="sev-pill sev-${v.severity} vuln-sev">${esc(v.severity || "")}</div>
          <div class="vuln-toggle" id="tog-${i}">▼</div>
        </div>
        <div class="vuln-body" id="body-${i}">
          <div class="vuln-meta">
            <span>CWE: <b>${esc(v.cwe_id || "N/A")}</b></span>
            ${v.line_numbers && v.line_numbers.length ? `<span>Lines: <b>${v.line_numbers.join(", ")}</b></span>` : ""}
            ${v.endpoint ? `<span>Endpoint: <b>${esc(v.endpoint)}</b></span>` : ""}
            ${(v.cve_references || []).length ? `<span>CVEs: <b>${v.cve_references.join(", ")}</b></span>` : ""}
          </div>
          ${v.vulnerable_code ? `
          <div class="section-label">// Vulnerable Code / Evidence</div>
          <div class="code-block bad">${esc(v.vulnerable_code)}</div>` : ""}
          <div class="section-label">// Description</div>
          <div class="vuln-desc">${esc(v.description || "")}</div>
          <div class="section-label">// Impact</div>
          <div class="vuln-desc">${esc(v.impact || "")}</div>
          ${fix.patched_code ? `
          <div class="section-label">// Recommended Fix</div>
          <div class="code-block good">${esc(fix.patched_code)}</div>
          <div class="section-label">// Fix Explanation</div>
          <div class="vuln-desc">${esc(fix.explanation || "")}</div>
          ${fix.additional_steps && fix.additional_steps.length ? `
          <div class="section-label">// Steps</div>
          <ul class="steps-list">${fix.additional_steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
          ` : fix.explanation ? `
          <div class="section-label">// Fix Explanation</div>
          <div class="vuln-desc">${esc(fix.explanation)}</div>` : ""}
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  const tips = result.secure_coding_tips || [];
  if (tips.length) {
    html += `
    <div class="tips-card fade-up delay-2">
      <div class="tips-title">// Hardening Recommendations</div>
      ${tips.map((t) => `<div class="tip-item">${esc(t)}</div>`).join("")}
    </div>`;
  }

  html += `
  <div class="action-bar fade-up">
    <button class="btn-scan" onclick="downloadReport()">↓ Download Report</button>
    <button class="btn-outline" onclick="copyJSON()">⎘ Copy JSON</button>
    <button class="btn-outline" onclick="goHome()">↺ Edit target</button>
  </div>`;

  wrap.innerHTML = html;
  wrap.style.display = "block";
  if (vulns.length > 0) toggleVuln(0);
}

function toggleVuln(i) {
  const body = document.getElementById(`body-${i}`);
  const tog = document.getElementById(`tog-${i}`);
  const open = body.classList.toggle("open");
  tog.textContent = open ? "▲" : "▼";
}

function buildStaticReportText(target, result) {
  const lines = [
    `SecAgent — Security Report`,
    `Target: ${target}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `Risk score: ${result.risk_score ?? "—"}`,
    `Summary: ${result.summary ?? ""}`,
    ``,
  ];
  const vulns = result.vulnerabilities || [];
  vulns.forEach((v, i) => {
    lines.push(`--- Finding ${i + 1}: ${v.id || ""} (${v.type}) ---`);
    lines.push(`Severity: ${v.severity}`);
    lines.push(`Description: ${v.description || ""}`);
    lines.push("");
  });
  const tips = result.secure_coding_tips || [];
  if (tips.length) {
    lines.push(`--- Recommendations ---`);
    tips.forEach((t) => lines.push(`- ${t}`));
  }
  return lines.join("\n");
}

async function downloadReport() {
  if (!lastResult) return;
  if (!USE_STATIC_MOCK) {
    try {
      const resp = await fetch(`${BACKEND}/api/report`);
      if (!resp.ok) {
        const msg = await parseErrorBody(resp);
        showToast(msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
        return;
      }
      const data = await resp.json();
      const md = data.report_markdown || "";
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security_report_${lastTarget.replace(/[^a-z0-9]/gi, "_")}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Report downloaded!");
    } catch (e) {
      showToast("Download failed — is the backend running?");
    }
    return;
  }

  const text = buildStaticReportText(lastTarget, lastResult);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `security_report_${lastTarget.replace(/[^a-z0-9]/gi, "_")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Report downloaded (static file)");
}

function copyJSON() {
  if (!lastResult) return;
  const text = JSON.stringify(lastResult, null, 2);
  navigator.clipboard.writeText(text).then(
    () => showToast("JSON copied!"),
    () => showToast("Copy failed — try a secure context or copy manually")
  );
}

function goHome() {
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const payload = loadPayload();
  if (!payload || !payload.target) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("scan-target-label").textContent = payload.target;

  if (USE_STATIC_MOCK) {
    runMockScan(payload);
  } else {
    runApiReview(payload);
  }
});
