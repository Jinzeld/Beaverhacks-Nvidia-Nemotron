const SCAN_PAYLOAD_KEY = "secagent_scan";

function toggleChip(el) {
  el.classList.toggle("checked");
}

function getActiveModules() {
  return [...document.querySelectorAll(".option-chip.checked")].map((el) =>
    el.textContent.trim()
  );
}

function setExample(val) {
  document.getElementById("url-input").value = val;
  document.getElementById("url-input").focus();
}

function normalizeTarget(raw) {
  return raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim();
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

/** Saves scan params and opens the results page (scan.html). */
function startScan() {
  const raw = document.getElementById("url-input").value.trim();
  const model = document.getElementById("model-select").value;
  const modules = getActiveModules();

  if (!raw) {
    showToast("Enter a URL or IP first!");
    return;
  }

  const target = normalizeTarget(raw);
  const payload = {
    target,
    modules,
    model,
    startedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(SCAN_PAYLOAD_KEY, JSON.stringify(payload));
  } catch (e) {
    showToast("Could not save scan — allow storage for this site.");
    return;
  }

  window.location.href = "scan.html";
}
