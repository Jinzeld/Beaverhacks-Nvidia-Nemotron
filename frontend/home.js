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

/**
 * Freeze the layout scroll position so post-submit browser work (focus, scroll-into-view)
 * cannot move the document before we navigate away.
 */
function lockDocumentScrollForNavigation() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  const root = document.documentElement;
  root.style.overflow = "hidden";
  root.style.position = "fixed";
  root.style.top = "0";
  root.style.left = "0";
  root.style.right = "0";
  root.style.width = "100%";
}

function goToScanPage() {
  lockDocumentScrollForNavigation();
  // Two frames: default actions and layout often run after the submit handler returns.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      window.location.assign("scan.html");
    });
  });
}

/** Saves scan params and opens the results page (scan.html). */
function startScan(ev) {
  if (ev && typeof ev.preventDefault === "function") {
    ev.preventDefault();
    ev.stopPropagation();
  }

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

  goToScanPage();
}

(function initHomeScanForm() {
  const form = document.getElementById("home-scan-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    startScan(e);
  });
})();
