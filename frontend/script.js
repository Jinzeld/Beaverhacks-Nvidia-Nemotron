const BACKEND = "http://localhost:8000";
let lastResult = null;
let lastTarget = "";
 
// ─── Chip toggle ─────────────────────────────────────────────────
function toggleChip(el) {
  el.classList.toggle("checked");
}
function getActiveModules() {
  return [...document.querySelectorAll(".option-chip.checked")]
    .map(el => el.textContent.trim());
}
 
// ─── Example targets ─────────────────────────────────────────────
function setExample(val) {
  document.getElementById("url-input").value = val;
  document.getElementById("url-input").focus();
}
 
// ─── Main scan ───────────────────────────────────────────────────
async function runScan() {
  const raw    = document.getElementById("url-input").value.trim();
  const model  = document.getElementById("model-select").value;
  const modules = getActiveModules();
 
  if (!raw) { showToast("Enter a URL or IP first!"); return; }
 
  // Normalize target
  const target = raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim();
  lastTarget = target;
 
  // Reset UI
  const btn = document.getElementById("btn-scan");
  btn.disabled = true; btn.textContent = "⏳ Scanning...";
  const cw = document.getElementById("console-wrap");
  const co = document.getElementById("console-out");
  cw.style.display = "block";
  co.textContent = "";
  document.getElementById("results-wrap").style.display = "none";
  document.getElementById("console-status").textContent = "SCANNING...";
  lastResult = null;
 
  log(`[*] Target   : ${target}`);
  log(`[*] Modules  : ${modules.join(", ")}`);
  log(`[*] Model    : ${model}`);
  log(`[*] Sending to Nemotron...\n`);
 
  try {
    const resp = await fetch(`${BACKEND}/scan/url/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, modules, model })
    });
 
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
 
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = JSON.parse(line.slice(6));
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
  } catch(e) {
    showToast("Connection error — is the backend running?");
    log(`\n[✗] ${e.message}`);
  }
 
  btn.disabled = false;
  btn.textContent = "⚡ Scan";
}
 
function log(msg) {
  const co = document.getElementById("console-out");
  co.textContent += msg + "\n";
  co.scrollTop = co.scrollHeight;
}
 
// ─── Render results ──────────────────────────────────────────────
function renderResults(result) {
  const wrap  = document.getElementById("results-wrap");
  const vulns = result.vulnerabilities || [];
  const risk  = result.risk_score || 0;
  const rc    = risk >= 70 ? "high" : risk >= 40 ? "medium" : "";
 
  const icons = {
    SQL_INJECTION:"💉", XSS:"⚡", BUFFER_OVERFLOW:"💥",
    HARDCODED_SECRET:"🔑", OPEN_PORT:"🔓", SSL_ISSUE:"🔐",
    EXPOSED_HEADER:"📋", DIR_TRAVERSAL:"📂", CSRF:"🔄",
    MISCONFIGURATION:"⚙️"
  };
 
  const sevCounts = {};
  vulns.forEach(v => { sevCounts[v.severity] = (sevCounts[v.severity]||0) + 1; });
 
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
      <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:4px">${vulns.length} Finding${vulns.length!==1?'s':''}</div>
      ${Object.entries(sevCounts).map(([s,c])=>`<div class="sev-pill sev-${s}">${s}: ${c}</div>`).join("")}
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
      const fix  = v.fix || {};
      html += `
      <div class="vuln-card">
        <div class="vuln-header" onclick="toggleVuln(${i})">
          <span class="vuln-icon">${icon}</span>
          <div>
            <div class="vuln-id">${esc(v.id||`VULN-${String(i+1).padStart(3,'0')}`)}</div>
            <div class="vuln-type">${esc(v.type||'')}</div>
          </div>
          <div class="sev-pill sev-${v.severity} vuln-sev">${esc(v.severity||'')}</div>
          <div class="vuln-toggle" id="tog-${i}">▼</div>
        </div>
        <div class="vuln-body" id="body-${i}">
          <div class="vuln-meta">
            <span>CWE: <b>${esc(v.cwe_id||'N/A')}</b></span>
            ${v.line_numbers&&v.line_numbers.length?`<span>Lines: <b>${v.line_numbers.join(', ')}</b></span>`:''}
            ${v.endpoint?`<span>Endpoint: <b>${esc(v.endpoint)}</b></span>`:''}
            ${(v.cve_references||[]).length?`<span>CVEs: <b>${v.cve_references.join(', ')}</b></span>`:''}
          </div>
          ${v.vulnerable_code?`
          <div class="section-label">// Vulnerable Code / Evidence</div>
          <div class="code-block bad">${esc(v.vulnerable_code)}</div>`:''}
          <div class="section-label">// Description</div>
          <div class="vuln-desc">${esc(v.description||'')}</div>
          <div class="section-label">// Impact</div>
          <div class="vuln-desc">${esc(v.impact||'')}</div>
          ${fix.patched_code?`
          <div class="section-label">// Recommended Fix</div>
          <div class="code-block good">${esc(fix.patched_code)}</div>
          <div class="section-label">// Fix Explanation</div>
          <div class="vuln-desc">${esc(fix.explanation||'')}</div>
          ${fix.additional_steps&&fix.additional_steps.length?`
          <div class="section-label">// Steps</div>
          <ul class="steps-list">${fix.additional_steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}
          `:''}
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
      ${tips.map(t=>`<div class="tip-item">${esc(t)}</div>`).join('')}
    </div>`;
  }
 
  html += `
  <div class="action-bar fade-up">
    <button class="btn-scan" onclick="downloadReport()">↓ Download Report</button>
    <button class="btn-outline" onclick="copyJSON()">⎘ Copy JSON</button>
    <button class="btn-outline" onclick="rescan()">↺ Re-scan</button>
  </div>`;
 
  wrap.innerHTML = html;
  wrap.style.display = "block";
  if (vulns.length > 0) toggleVuln(0);
}
 
function toggleVuln(i) {
  const body = document.getElementById(`body-${i}`);
  const tog  = document.getElementById(`tog-${i}`);
  const open = body.classList.toggle("open");
  tog.textContent = open ? "▲" : "▼";
}
 
// ─── Actions ─────────────────────────────────────────────────────
async function downloadReport() {
  if (!lastResult) return;
  try {
    const resp = await fetch(`${BACKEND}/report/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: lastTarget, result: lastResult })
    });
    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `security_report_${lastTarget.replace(/[^a-z0-9]/gi,'_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Report downloaded!");
  } catch(e) { showToast("Download failed — is the backend running?"); }
}
 
function copyJSON() {
  if (!lastResult) return;
  navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2));
  showToast("JSON copied!");
}
 
function rescan() {
  document.getElementById("results-wrap").style.display = "none";
  document.getElementById("console-wrap").style.display = "none";
  document.getElementById("url-input").focus();
}
 
// ─── Helpers ─────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}