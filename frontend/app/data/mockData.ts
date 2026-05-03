import type {
  ScanResponse,
  AnalyzeResponse,
  FixPlanResponse,
  ApproveResponse,
  ApplyFixResponse,
  VerificationResponse,
  AuditEvent,
  HealthResponse,
} from "../lib/types";

export const mockHealth: HealthResponse = {
  status: "ok",
  backend: "running",
  target_url: "http://localhost:8088",
};

export const mockScan: ScanResponse = {
  target_url: "http://localhost:8088",
  raw_headers:
    "HTTP/1.1 200 OK\nServer: nginx\nAccess-Control-Allow-Origin: *",
  parsed_headers: {
    server: "nginx",
    "access-control-allow-origin": "*",
  },
  missing_security_headers: [
    "Content-Security-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
  ],
  issues: ["wildcard_cors"],
};

export const mockAnalyze: AnalyzeResponse = {
  findings: [
    {
      id: "FINDING-001",
      title: "Missing HTTP Security Headers",
      category: "web_config",
      severity: "medium",
      confidence: "high",
      evidence: [
        "Content-Security-Policy header is missing",
        "X-Frame-Options header is missing",
        "X-Content-Type-Options header is missing",
        "Referrer-Policy header is missing",
        "Access-Control-Allow-Origin is wildcard",
      ],
      risk_explanation:
        "The application has weaker browser-side protection against clickjacking, MIME sniffing, referrer leakage, and content injection impact.",
      recommended_remediation_direction:
        "Add defensive HTTP security headers in the Nginx server block and restrict CORS to the local frontend origin.",
      auto_remediation_candidate: true,
      safe_verification_steps: [
        "Run curl -I http://localhost:8088 and confirm the headers are present.",
      ],
    },
  ],
};

export const mockFixPlan: FixPlanResponse = {
  fix_plan: {
    id: "FIX-001",
    finding_id: "FINDING-001",
    title: "Add HTTP security headers to Nginx",
    remediation_type: "nginx_config_patch",
    risk_of_change: "low",
    approval_required: true,
    explanation:
      "This patch adds common browser-side defensive headers and replaces wildcard CORS with an explicit local frontend origin.",
    proposed_patch: {
      file_path: "labs/vulnerable-nginx/default.conf",
      patch_type: "replace_security_headers_placeholder",
      content:
        'add_header X-Frame-Options "SAMEORIGIN" always;\nadd_header X-Content-Type-Options "nosniff" always;\nadd_header Referrer-Policy "strict-origin-when-cross-origin" always;\nadd_header Content-Security-Policy "default-src \'self\'; object-src \'none\'; frame-ancestors \'self\';" always;\nadd_header Access-Control-Allow-Origin "http://localhost:3000" always;',
    },
    rollback_plan: {
      backup_required: true,
      steps: [
        "Restore the backup Nginx config.",
        "Restart the vulnerable-nginx container.",
      ],
    },
    verification_steps: [
      "Run curl -I http://localhost:8088.",
      "Confirm CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy are present.",
      "Confirm Access-Control-Allow-Origin is no longer wildcard.",
    ],
  },
};

export const mockApprove: ApproveResponse = {
  approved: true,
  timestamp: new Date().toISOString(),
};

export const mockApplyFix: ApplyFixResponse = {
  success: true,
  message: "Nginx config patched and container restarted successfully.",
  backup_path: "labs/vulnerable-nginx/default.conf.bak",
};

export const mockVerification: VerificationResponse = {
  status: "fixed",
  before_summary:
    "Security headers were missing and CORS allowed all origins.",
  after_summary: "Security headers are present and CORS is restricted.",
  evidence_comparison: [
    {
      check: "Content-Security-Policy",
      before: "missing",
      after: "present",
      result: "passed",
    },
    {
      check: "X-Frame-Options",
      before: "missing",
      after: "SAMEORIGIN",
      result: "passed",
    },
    {
      check: "X-Content-Type-Options",
      before: "missing",
      after: "nosniff",
      result: "passed",
    },
    {
      check: "Referrer-Policy",
      before: "missing",
      after: "strict-origin-when-cross-origin",
      result: "passed",
    },
    {
      check: "Access-Control-Allow-Origin",
      before: "*",
      after: "http://localhost:3000",
      result: "passed",
    },
  ],
};

export const mockAuditLog: AuditEvent[] = [
  {
    timestamp: "2026-05-02T10:00:00Z",
    action: "scan",
    detail: "Scanned http://localhost:8088 — 4 missing headers, 1 CORS issue",
  },
  {
    timestamp: "2026-05-02T10:00:05Z",
    action: "analyze",
    detail: "Nemotron analysis complete — 1 finding (medium severity)",
  },
  {
    timestamp: "2026-05-02T10:00:10Z",
    action: "fix_plan",
    detail: "Generated fix plan FIX-001 for FINDING-001",
  },
  {
    timestamp: "2026-05-02T10:00:20Z",
    action: "approve",
    detail: "User approved fix plan FIX-001",
  },
  {
    timestamp: "2026-05-02T10:00:25Z",
    action: "apply",
    detail: "Patch applied to labs/vulnerable-nginx/default.conf",
  },
  {
    timestamp: "2026-05-02T10:00:30Z",
    action: "verify",
    detail: "Verification passed — all 5 checks passed",
  },
];

export const mockReport = `# Nemotron Local Fix Agent — Remediation Report

## Target
- URL: http://localhost:8088
- Scan time: 2026-05-02T10:00:00Z

## Finding: FINDING-001
- **Title**: Missing HTTP Security Headers
- **Severity**: Medium
- **Confidence**: High

### Evidence
- Content-Security-Policy header is missing
- X-Frame-Options header is missing
- X-Content-Type-Options header is missing
- Referrer-Policy header is missing
- Access-Control-Allow-Origin is wildcard

### Risk
The application has weaker browser-side protection against clickjacking, MIME sniffing, referrer leakage, and content injection impact.

## Remediation Applied
- **Fix ID**: FIX-001
- **Type**: nginx_config_patch
- **Risk of change**: Low
- **Approved by**: User

## Verification Result
| Check | Before | After | Result |
|-------|--------|-------|--------|
| Content-Security-Policy | missing | present | PASSED |
| X-Frame-Options | missing | SAMEORIGIN | PASSED |
| X-Content-Type-Options | missing | nosniff | PASSED |
| Referrer-Policy | missing | strict-origin-when-cross-origin | PASSED |
| Access-Control-Allow-Origin | * | http://localhost:3000 | PASSED |

**Status: ALL CHECKS PASSED**
`;
