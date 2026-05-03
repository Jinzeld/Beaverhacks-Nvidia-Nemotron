/**
 * Results page: static mock by default. Replace runLiveScan() body when backend exists.
 * Contract matches frontend/script expectations (see runLiveScan SSE parsing).
 */
const SCAN_PAYLOAD_KEY = "secagent_scan";
const BACKEND = "http://localhost:8000";

/** Set false when POST /scan/url/stream is ready. */
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

/** Deterministic mock result for UI demo (no network). */
function buildMockResult(target, modules, model) {
  const ts = new Date().toISOString();
  return {
    target,
    summary:
      "Static preview: sample findings for layout testing. Connect the backend and set USE_STATIC_MOCK = false.",
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

/**
 * Live SSE scan — wire when backend implements POST /scan/url/stream
 * (same line protocol as before: lines starting with "data: " + JSON).
 */
async function runLiveScan(payload) {
  const co = document.getElementById("console-out");
  const { target, modules, model } = payload;
  lastTarget = target;

  document.getElementById("console-wrap").style.display = "block";
  document.getElementById("results-wrap").style.display = "none";
  co.textContent = "";
  document.getElementById("console-status").textContent = "SCANNING...";
  document.getElementById("console-dot").style.animation = "";
  lastResult = null;

  log(`[*] Target   : ${target}`);
  log(`[*] Modules  : ${modules.join(", ")}`);
  log(`[*] Model    : ${model}`);
  log(`[*] Sending to backend…\n`);

  try {
    const resp = await fetch(`${BACKEND}/scan/url/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, modules, model }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(errText || `HTTP ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let data;
        try {
          data = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        if (data.type === "token") {
          co.textContent += data.content;
          co.scrollTop = co.scrollHeight;
        } else if (data.type === "progress") {
          log(data.message);
        } else if (data.type === "done") {
          lastResult = data.result;
          document.getElementById("console-status").textContent = "COMPLETE ✓";
          document.getElementById("console-dot").style.animation = "none";
          renderResults(data.result);
        } else if (data.type === "error") {
          showToast("Error: " + data.message);
        }
      }
    }
  } catch (e) {
    showToast("Connection error — is the backend running?");
    log(`\n[✗] ${e.message}`);
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
          ` : ""}
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
      const resp = await fetch(`${BACKEND}/report/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: lastTarget, result: lastResult }),
      });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security_report_${lastTarget.replace(/[^a-z0-9]/gi, "_")}.txt`;
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
    runLiveScan(payload);
  }
});
