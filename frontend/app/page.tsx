"use client";

import { useCallback, useEffect, useState } from "react";
import ActionButton from "./components/ActionButton";
import SeverityBadge from "./components/SeverityBadge";
import StatusBar from "./components/StatusBar";
import StepCard from "./components/StepCard";
import {
  mockAnalyze,
  mockApplyFix,
  mockApprove,
  mockAuditLog,
  mockFixPlan,
  mockHealth,
  mockReport,
  mockScan,
  mockVerification,
} from "./data/mockData";
import { api } from "./lib/api";
import type {
  AnalyzeResponse,
  ApplyFixResponse,
  AuditEvent,
  Finding,
  FixPlanResponse,
  HealthResponse,
  ScanResponse,
  VerificationResponse,
} from "./lib/types";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

const flowLabels = [
  "Scan",
  "Analyze",
  "Fix Plan",
  "Approve",
  "Patch",
  "Verify",
  "Report",
];

const hardScopeRules = [
  "Local demo only",
  "Only patch the configured local Nginx config",
  "No exploits, credential attacks, or malware behavior",
  "All system-modifying actions require approval",
];

async function tryApi<T>(apiFn: () => Promise<T>, fallback: T): Promise<T> {
  if (USE_MOCK) return fallback;
  try {
    return await apiFn();
  } catch {
    return fallback;
  }
}

function getFindingHeadline(findings: Finding[]) {
  if (findings.length === 0) {
    return "No active findings";
  }

  const highestSeverity =
    findings.find((finding) => finding.severity === "critical") ||
    findings.find((finding) => finding.severity === "high") ||
    findings.find((finding) => finding.severity === "medium") ||
    findings[0];

  return `${highestSeverity.severity.toUpperCase()} risk: ${highestSeverity.title}`;
}

export default function Dashboard() {
  const [loading, setLoading] = useState("");

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [fixPlan, setFixPlan] = useState<FixPlanResponse | null>(null);
  const [approved, setApproved] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyFixResponse | null>(null);
  const [verification, setVerification] = useState<VerificationResponse | null>(
    null
  );
  const [report, setReport] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);

  const refreshAudit = useCallback(async () => {
    const log = await tryApi(api.auditLog, mockAuditLog);
    setAuditLog(log);
  }, []);

  useEffect(() => {
    (async () => {
      const h = await tryApi(api.health, mockHealth);
      setHealth(h);
      setHealthLoading(false);
    })();
  }, []);

  async function handleScan() {
    setLoading("scan");
    const result = await tryApi(api.scan, mockScan);
    setScan(result);
    await refreshAudit();
    setLoading("");
  }

  async function handleAnalyze() {
    setLoading("analyze");
    const result = await tryApi(api.analyze, mockAnalyze);
    setAnalysis(result);
    await refreshAudit();
    setLoading("");
  }

  async function handleFixPlan() {
    setLoading("fixplan");
    const result = await tryApi(api.fixPlan, mockFixPlan);
    setFixPlan(result);
    await refreshAudit();
    setLoading("");
  }

  async function handleApprove() {
    setLoading("approve");
    await tryApi(api.approve, mockApprove);
    setApproved(true);
    await refreshAudit();
    setLoading("");
  }

  async function handleApplyFix() {
    setLoading("apply");
    const result = await tryApi(api.applyFix, mockApplyFix);
    setApplyResult(result);
    await refreshAudit();
    setLoading("");
  }

  async function handleVerify() {
    setLoading("verify");
    const result = await tryApi(api.verify, mockVerification);
    setVerification(result);
    await refreshAudit();
    setLoading("");
  }

  async function handleReport() {
    setLoading("report");
    const result = await tryApi(api.report, mockReport);
    setReport(result);
    await refreshAudit();
    setLoading("");
  }

  const findings = analysis?.findings ?? [];
  const completedSteps = [
    Boolean(scan),
    Boolean(analysis),
    Boolean(fixPlan),
    approved,
    Boolean(applyResult),
    Boolean(verification),
    Boolean(report),
  ].filter(Boolean).length;

  const currentStage =
    loading === "scan"
      ? 1
      : loading === "analyze"
        ? 2
        : loading === "fixplan"
          ? 3
          : loading === "approve"
            ? 4
            : loading === "apply"
              ? 5
              : loading === "verify"
                ? 6
                : loading === "report"
                  ? 7
                  : Math.min(completedSteps + 1, flowLabels.length);

  const metrics = [
    {
      label: "Workflow Progress",
      value: `${completedSteps}/7`,
      detail: "steps completed",
    },
    {
      label: "Header Gaps",
      value: scan ? String(scan.missing_security_headers.length) : "--",
      detail: "missing defensive headers",
    },
    {
      label: "Nemotron Findings",
      value: findings.length ? String(findings.length) : "--",
      detail: findings.length ? getFindingHeadline(findings) : "analysis pending",
    },
    {
      label: "Verification",
      value: verification?.status?.toUpperCase() || "--",
      detail: verification ? verification.after_summary : "awaiting remediation",
    },
  ];

  const liveChecks = scan
    ? [
        `csp:${scan.missing_security_headers.includes("Content-Security-Policy") ? "missing" : "present"}`,
        `xfo:${scan.missing_security_headers.includes("X-Frame-Options") ? "missing" : "present"}`,
        `nosniff:${scan.missing_security_headers.includes("X-Content-Type-Options") ? "missing" : "present"}`,
        `cors:${scan.issues.includes("wildcard_cors") ? "wildcard" : "restricted"}`,
      ]
    : ["csp:pending", "xfo:pending", "nosniff:pending", "cors:pending"];

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-[22px] border border-cyan-300/12 bg-slate-950/72 px-5 py-4 shadow-[0_24px_80px_rgba(2,6,23,0.3)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-cyan-300/30 bg-[linear-gradient(135deg,#22d3ee,#3b82f6)] text-lg font-bold text-slate-950 shadow-[0_0_30px_rgba(56,189,248,0.35)]">
              S
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight text-white">
                SecAgent
              </div>
              <div className="font-mono text-sm text-slate-400">
                NVIDIA NIM · Nemotron 3 Nano
              </div>
            </div>
          </div>
          <div className="inline-flex self-start rounded-md border border-cyan-300/24 bg-cyan-300/10 px-4 py-2 font-mono text-xs font-medium uppercase tracking-[0.24em] text-cyan-100 sm:self-auto">
            BeaverHacks 2026
          </div>
        </div>

        <section className="glass-panel panel-lines relative overflow-hidden rounded-[28px] px-6 py-8 shadow-[0_40px_120px_rgba(2,6,23,0.45)] sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_78%_16%,rgba(59,130,246,0.16),transparent_20%),linear-gradient(120deg,rgba(5,10,22,0.9),rgba(8,15,30,0.55))]" />
          <div className="absolute right-6 top-6 hidden h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl lg:block" />
          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="inline-flex rounded-md border border-cyan-300/25 bg-cyan-300/12 px-4 py-1 font-mono text-xs font-medium uppercase tracking-[0.26em] text-cyan-100">
                Local Defensive AI Remediation
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                Patch the broken local lab live.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">
                SecAgent scans a vulnerable Nginx container on{" "}
                <span className="font-mono text-cyan-200">localhost:8088</span>,
                catches missing security headers and wildcard CORS, asks
                Nemotron to explain the risk, then applies an approved fix and
                proves the result.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <ActionButton
                  onClick={handleScan}
                  loading={loading === "scan"}
                  variant="primary"
                >
                  Launch Live Scan
                </ActionButton>
                <div className="rounded-md border border-cyan-300/14 bg-slate-950/70 px-4 py-3 font-mono text-sm text-slate-300">
                  Current phase:{" "}
                  <span className="font-medium text-cyan-100">
                    {flowLabels[Math.min(currentStage - 1, flowLabels.length - 1)]}
                  </span>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {hardScopeRules.map((rule) => (
                  <div
                    key={rule}
                    className="rounded-md border border-cyan-300/12 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
                  >
                    {rule}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="neon-frame rounded-[20px] bg-slate-950/78 p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-100/70">
                  Live Scan Preview
                </div>
                <div className="mt-4 rounded-[18px] border border-cyan-300/12 bg-black/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-slate-400">
                      target=http://localhost:8088
                    </span>
                    <span className="rounded-md border border-rose-300/18 bg-rose-300/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-rose-100">
                      vulnerable
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {liveChecks.map((check) => (
                      <div
                        key={check}
                        className="flex items-center justify-between rounded-md border border-white/6 bg-slate-950/75 px-3 py-2 font-mono text-xs text-slate-200"
                      >
                        <span>{check.split(":")[0]}</span>
                        <span className="text-cyan-200">{check.split(":")[1]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-200/70">
                    Detect → Reason → Approve → Patch → Verify → Report
                  </div>
                </div>
              </div>
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-[18px] border border-cyan-300/10 bg-slate-950/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                >
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-100/60">
                    {metric.label}
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    {metric.value}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">
                    {metric.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-6">
          <StatusBar health={health} loading={healthLoading} />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <div className="rounded-[22px] border border-cyan-300/12 bg-slate-950/55 p-4">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-100/60">
                Workflow Bus
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {flowLabels.map((label, index) => {
                const stepNumber = index + 1;
                const isComplete = stepNumber <= completedSteps;
                const isCurrent = stepNumber === currentStage;

                return (
                  <div
                    key={label}
                    className={`rounded-md border p-4 transition ${
                      isComplete
                        ? "border-emerald-300/30 bg-emerald-300/[0.08]"
                        : isCurrent
                          ? "border-cyan-300/30 bg-cyan-300/[0.08] shadow-[0_0_22px_rgba(34,211,238,0.12)]"
                          : "border-cyan-300/8 bg-slate-950/70"
                    }`}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-100/55">
                      Step {stepNumber}
                    </div>
                    <div className="mt-2 font-medium text-white">{label}</div>
                  </div>
                );
              })}
              </div>
            </div>

            <StepCard
              step={1}
              title="Scan Local Lab"
              description="Inspect the local Nginx target at localhost:8088 and surface missing security headers plus wildcard CORS before any reasoning step begins."
              status={scan ? "complete" : loading === "scan" ? "active" : "ready"}
            >
              <ActionButton onClick={handleScan} loading={loading === "scan"}>
                Scan Headers
              </ActionButton>
              {scan && (
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-300">
                      Raw Headers
                    </h3>
                    <pre className="overflow-x-auto rounded-[24px] border border-white/10 bg-slate-950/80 p-4 text-xs leading-6 text-cyan-100">
                      {scan.raw_headers}
                    </pre>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="mb-2 text-sm font-medium text-slate-300">
                        Missing Security Headers
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {scan.missing_security_headers.map((header) => (
                          <span
                            key={header}
                            className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1 text-xs text-rose-100"
                          >
                            {header}
                          </span>
                        ))}
                      </div>
                    </div>
                    {scan.issues.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-medium text-slate-300">
                          Issues
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {scan.issues.map((issue) => (
                            <span
                              key={issue}
                              className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100"
                            >
                              {issue}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </StepCard>

            <StepCard
              step={2}
              title="Analyze with Nemotron"
              description="Use NVIDIA Nemotron through an OpenAI-compatible interface to explain why the missing headers and wildcard CORS are risky and what safe remediation should look like."
              disabled={!scan}
              status={
                analysis
                  ? "complete"
                  : loading === "analyze"
                    ? "active"
                    : scan
                      ? "ready"
                      : "locked"
              }
            >
              <ActionButton
                onClick={handleAnalyze}
                loading={loading === "analyze"}
                disabled={!scan}
              >
                Analyze
              </ActionButton>
              {analysis && (
                <div className="space-y-4">
                  {analysis.findings.map((finding) => (
                    <div
                      key={finding.id}
                      className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
                            {finding.id}
                          </div>
                          <h3 className="mt-2 text-xl font-semibold text-white">
                            {finding.title}
                          </h3>
                          <p className="mt-2 text-sm text-slate-400">
                            {finding.category}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <SeverityBadge level={finding.severity} />
                          <span className="rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1 text-xs text-blue-100">
                            {finding.confidence} confidence
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                        <div>
                          <h4 className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                            Evidence
                          </h4>
                          <ul className="space-y-2 text-sm leading-6 text-slate-300">
                            {finding.evidence.map((evidence, index) => (
                              <li
                                key={index}
                                className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                              >
                                {evidence}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                            <h4 className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                              Risk Explanation
                            </h4>
                            <p className="text-sm leading-6 text-slate-300">
                              {finding.risk_explanation}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
                            <h4 className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-100/70">
                              Remediation Direction
                            </h4>
                            <p className="text-sm leading-6 text-emerald-50">
                              {finding.recommended_remediation_direction}
                            </p>
                          </div>
                          {finding.auto_remediation_candidate && (
                            <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                              Auto-remediation available
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </StepCard>

            <StepCard
              step={3}
              title="Generate Fix Plan"
              description="Generate a tightly scoped Nginx remediation plan that only touches the configured local file and includes rollback plus verification steps."
              disabled={!analysis}
              status={
                fixPlan
                  ? "complete"
                  : loading === "fixplan"
                    ? "active"
                    : analysis
                      ? "ready"
                      : "locked"
              }
            >
              <ActionButton
                onClick={handleFixPlan}
                loading={loading === "fixplan"}
                disabled={!analysis}
              >
                Generate Fix Plan
              </ActionButton>
              {fixPlan && (
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
                        {fixPlan.fix_plan.id}
                      </span>
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                        Approval required
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-white">
                      {fixPlan.fix_plan.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {fixPlan.fix_plan.explanation}
                    </p>
                    <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                        Proposed Patch
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-emerald-100">
                        {fixPlan.fix_plan.proposed_patch.content}
                      </pre>
                      <p className="mt-3 text-xs text-slate-500">
                        File: {fixPlan.fix_plan.proposed_patch.file_path}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Rollback Plan
                      </div>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                        {fixPlan.fix_plan.rollback_plan.steps.map((step, index) => (
                          <li
                            key={index}
                            className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                          >
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Risk of Change
                      </div>
                      <div className="mt-3 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                        {fixPlan.fix_plan.risk_of_change}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </StepCard>

            <StepCard
              step={4}
              title="Approval Gate"
              description="Require explicit human approval before any change is applied to the local system, preserving the project's defensive guardrails."
              disabled={!fixPlan}
              status={
                approved
                  ? "complete"
                  : loading === "approve"
                    ? "active"
                    : fixPlan
                      ? "ready"
                      : "locked"
              }
            >
              <div className="rounded-[24px] border border-white/10 bg-slate-950/75 p-5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                  />
                  <span className="text-sm leading-6 text-slate-300">
                    I confirm this target is my authorized local Docker lab and
                    I understand the patch will modify the remediation target.
                  </span>
                </label>
                <div className="mt-4">
                  <ActionButton
                    onClick={handleApprove}
                    loading={loading === "approve"}
                    disabled={!fixPlan || !confirmChecked || approved}
                    variant="success"
                  >
                    {approved ? "Approved" : "Approve Fix"}
                  </ActionButton>
                </div>
                {approved && (
                  <p className="mt-4 text-sm text-emerald-200">
                    Fix plan approved successfully.
                  </p>
                )}
              </div>
            </StepCard>

            <StepCard
              step={5}
              title="Apply Fix"
              description="Apply only the approved local Nginx patch, restart the Docker container, and show the exact result of the remediation step."
              disabled={!approved}
              status={
                applyResult
                  ? "complete"
                  : loading === "apply"
                    ? "active"
                    : approved
                      ? "ready"
                      : "locked"
              }
            >
              <ActionButton
                onClick={handleApplyFix}
                loading={loading === "apply"}
                disabled={!approved}
              >
                Apply Approved Fix
              </ActionButton>
              {applyResult && (
                <div
                  className={`rounded-[24px] border p-5 text-sm ${
                    applyResult.success
                      ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-50"
                      : "border-rose-300/20 bg-rose-300/[0.08] text-rose-50"
                  }`}
                >
                  <p className="text-base font-medium">{applyResult.message}</p>
                  {applyResult.backup_path && (
                    <p className="mt-2 text-xs text-slate-300">
                      Backup: {applyResult.backup_path}
                    </p>
                  )}
                </div>
              )}
            </StepCard>

            <StepCard
              step={6}
              title="Verify"
              description="Rescan the target headers after restart and prove the fix with before-vs-after evidence instead of unverifiable claims."
              disabled={!applyResult}
              status={
                verification
                  ? "complete"
                  : loading === "verify"
                    ? "active"
                    : applyResult
                      ? "ready"
                      : "locked"
              }
            >
              <ActionButton
                onClick={handleVerify}
                loading={loading === "verify"}
                disabled={!applyResult}
                variant="success"
              >
                Verify Headers
              </ActionButton>
              {verification && (
                <div className="space-y-4 rounded-[24px] border border-white/10 bg-slate-950/75 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Verification Status
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                        verification.status === "fixed"
                          ? "bg-emerald-300/15 text-emerald-100"
                          : "bg-rose-300/15 text-rose-100"
                      }`}
                    >
                      {verification.status}
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Before
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {verification.before_summary}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        After
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {verification.after_summary}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-white/8">
                    <table className="w-full text-sm">
                      <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Check</th>
                          <th className="px-4 py-3">Before</th>
                          <th className="px-4 py-3">After</th>
                          <th className="px-4 py-3">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verification.evidence_comparison.map((comparison) => (
                          <tr key={comparison.check} className="border-t border-white/8">
                            <td className="px-4 py-3 font-mono text-xs text-slate-200">
                              {comparison.check}
                            </td>
                            <td className="px-4 py-3 text-rose-200">
                              {comparison.before}
                            </td>
                            <td className="px-4 py-3 text-emerald-200">
                              {comparison.after}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  comparison.result === "passed"
                                    ? "bg-emerald-300/15 text-emerald-100"
                                    : "bg-rose-300/15 text-rose-100"
                                }`}
                              >
                                {comparison.result}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </StepCard>

            <StepCard
              step={7}
              title="Report"
              description="Produce a markdown summary of what was detected, what Nemotron recommended, what was approved, what changed, and how the result was verified."
              disabled={!verification}
              status={
                report
                  ? "complete"
                  : loading === "report"
                    ? "active"
                    : verification
                      ? "ready"
                      : "locked"
              }
            >
              <ActionButton
                onClick={handleReport}
                loading={loading === "report"}
                disabled={!verification}
                variant="ghost"
              >
                Load Report
              </ActionButton>
              {report && (
                <div className="rounded-[24px] border border-white/10 bg-slate-950/80 p-5">
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                    {report}
                  </pre>
                </div>
              )}
            </StepCard>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-[22px] border border-cyan-300/10 bg-slate-950/60 p-5">
              <div className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-100/60">
                Demo Summary
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Security demo energy, tight defensive scope.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                The product story here is constrained and credible: inspect one
                vulnerable local lab, reason about a narrow class of web
                misconfigurations, require approval, patch safely, and verify
                the result with audit events.
              </p>
            </div>

            <div className="rounded-[22px] border border-cyan-300/10 bg-slate-950/60 p-5">
              <div className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-100/60">
                Workflow Narrative
              </div>
              <div className="mt-4 space-y-3">
                {flowLabels.map((label, index) => {
                  const stepNumber = index + 1;
                  const isComplete = stepNumber <= completedSteps;
                  const isCurrent = stepNumber === currentStage;

                  return (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-md border border-cyan-300/8 bg-slate-950/70 px-4 py-3"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold ${
                          isComplete
                            ? "bg-emerald-300/15 text-emerald-100"
                            : isCurrent
                              ? "bg-cyan-300/15 text-cyan-100"
                              : "bg-white/8 text-slate-300"
                        }`}
                      >
                        {stepNumber}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {label}
                        </div>
                        <div className="text-xs text-slate-400">
                          {isComplete
                            ? "Completed"
                            : isCurrent
                              ? "Current focus"
                              : "Queued"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[22px] border border-cyan-300/10 bg-slate-950/60 p-5">
              <div className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-100/60">
                Audit Log
              </div>
              <div className="mt-1 text-sm text-slate-300">
                Every meaningful action is timestamped.
              </div>
              {auditLog.length === 0 ? (
                <p className="mt-4 rounded-md border border-cyan-300/8 bg-slate-950/70 px-4 py-4 text-sm text-slate-400">
                  No events yet. Start a scan to begin.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {auditLog.map((event, index) => (
                    <div
                      key={index}
                      className="rounded-md border border-cyan-300/8 bg-slate-950/72 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-md bg-cyan-300/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                          {event.action}
                        </span>
                        <span className="font-mono text-xs text-slate-500">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {event.detail}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
