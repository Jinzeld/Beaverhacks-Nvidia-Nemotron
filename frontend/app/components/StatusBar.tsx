"use client";

import type { HealthResponse } from "../lib/types";

interface StatusBarProps {
  health: HealthResponse | null;
  loading: boolean;
}

export default function StatusBar({ health, loading }: StatusBarProps) {
  const isOnline = health?.status === "ok";

  return (
    <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 text-sm shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur md:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
          Backend
        </div>
        <div className="flex items-center gap-3">
          {loading ? (
            <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
          ) : (
            <span
              className={`h-3 w-3 rounded-full ${isOnline ? "bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.8)]" : "bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.7)]"}`}
            />
          )}
          <div>
            <div className="font-medium text-white">
              {loading ? "Checking..." : isOnline ? "Online" : "Offline"}
            </div>
            <div className="text-xs text-slate-400">
              {health?.backend || "waiting for agent heartbeat"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
          Target
        </div>
        <code className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-cyan-200">
          {health?.target_url || "http://localhost:8088"}
        </code>
        <div className="mt-2 text-xs text-slate-400">Local lab scope only</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
          Operation Mode
        </div>
        <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
          Local Lab Remediation
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Human approval enforced before patching
        </div>
      </div>
    </div>
  );
}
