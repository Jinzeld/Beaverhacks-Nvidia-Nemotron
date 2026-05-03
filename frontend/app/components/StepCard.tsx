"use client";

interface StepCardProps {
  step: number;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
  description?: string;
  status?: "locked" | "ready" | "active" | "complete";
}

export default function StepCard({
  step,
  title,
  children,
  disabled,
  description,
  status = "ready",
}: StepCardProps) {
  const tone =
    status === "complete"
      ? "border-emerald-300/28 bg-emerald-300/[0.06]"
      : status === "active"
        ? "border-cyan-300/38 bg-cyan-300/[0.05]"
        : disabled
          ? "border-white/6 bg-white/[0.02]"
          : "border-cyan-300/12 bg-slate-950/55";

  return (
    <div
      className={`panel-lines rounded-[22px] border p-6 transition duration-300 ${tone} ${
        disabled ? "pointer-events-none opacity-45" : ""
      }`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-md border border-cyan-300/20 bg-slate-950/88 font-mono text-sm font-bold text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.12)]">
            {String(step).padStart(2, "0")}
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/55">
              Stage {step}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {description}
              </p>
            )}
          </div>
        </div>
        <span className="rounded-md border border-cyan-300/14 bg-slate-950/80 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-100/80">
          {status}
        </span>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
