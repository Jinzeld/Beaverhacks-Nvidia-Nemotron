export interface ScanResponse {
  target_url: string;
  raw_headers: string;
  parsed_headers: Record<string, string>;
  missing_security_headers: string[];
  issues: string[];
}

export interface Finding {
  id: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
  evidence: string[];
  risk_explanation: string;
  recommended_remediation_direction: string;
  auto_remediation_candidate: boolean;
  safe_verification_steps: string[];
}

export interface AnalyzeResponse {
  findings: Finding[];
}

export interface ProposedPatch {
  file_path: string;
  patch_type: string;
  content: string;
}

export interface RollbackPlan {
  backup_required: boolean;
  steps: string[];
}

export interface FixPlan {
  id: string;
  finding_id: string;
  title: string;
  remediation_type: string;
  risk_of_change: "low" | "medium" | "high";
  approval_required: boolean;
  explanation: string;
  proposed_patch: ProposedPatch;
  rollback_plan: RollbackPlan;
  verification_steps: string[];
}

export interface FixPlanResponse {
  fix_plan: FixPlan;
}

export interface ApproveResponse {
  approved: boolean;
  timestamp: string;
}

export interface ApplyFixResponse {
  success: boolean;
  message: string;
  backup_path?: string;
}

export interface EvidenceComparison {
  check: string;
  before: string;
  after: string;
  result: "passed" | "failed";
}

export interface VerificationResponse {
  status: "fixed" | "not_fixed" | "partial";
  before_summary: string;
  after_summary: string;
  evidence_comparison: EvidenceComparison[];
}

export interface AuditEvent {
  timestamp: string;
  action: string;
  detail: string;
}

export interface HealthResponse {
  status: "ok" | "error";
  backend: string;
  target_url: string;
}
