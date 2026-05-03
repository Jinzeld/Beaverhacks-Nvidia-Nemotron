import type {
  ScanResponse,
  AnalyzeResponse,
  FixPlanResponse,
  ApproveResponse,
  ApplyFixResponse,
  VerificationResponse,
  AuditEvent,
  HealthResponse,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  scan: () => request<ScanResponse>("/api/scan", { method: "POST" }),

  analyze: () => request<AnalyzeResponse>("/api/analyze", { method: "POST" }),

  fixPlan: () => request<FixPlanResponse>("/api/fix-plan", { method: "POST" }),

  approve: () => request<ApproveResponse>("/api/approve", { method: "POST" }),

  applyFix: () =>
    request<ApplyFixResponse>("/api/apply-fix", { method: "POST" }),

  verify: () =>
    request<VerificationResponse>("/api/verify", { method: "POST" }),

  report: () => request<string>("/api/report"),

  auditLog: () => request<AuditEvent[]>("/api/audit-log"),
};
