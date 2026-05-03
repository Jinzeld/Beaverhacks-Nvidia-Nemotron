import type { Finding } from "../lib/types";

const colors: Record<Finding["severity"], string> = {
  critical: "border-rose-400/30 bg-rose-400/15 text-rose-100",
  high: "border-orange-400/30 bg-orange-400/15 text-orange-100",
  medium: "border-amber-300/30 bg-amber-300/15 text-amber-50",
  low: "border-emerald-400/30 bg-emerald-400/15 text-emerald-100",
};

export default function SeverityBadge({ level }: { level: Finding["severity"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${colors[level]}`}
    >
      {level}
    </span>
  );
}
