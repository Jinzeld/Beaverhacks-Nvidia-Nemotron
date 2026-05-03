"use client";

interface ActionButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "danger" | "success" | "ghost";
}

const variants: Record<string, string> = {
  primary:
    "border border-cyan-300/30 bg-[linear-gradient(135deg,#22d3ee,#3b82f6)] text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.32)] hover:scale-[1.01] hover:brightness-110",
  danger:
    "border border-rose-300/30 bg-[linear-gradient(135deg,#fb7185,#f97316)] text-white shadow-[0_0_28px_rgba(251,113,133,0.26)] hover:scale-[1.01] hover:brightness-110",
  success:
    "border border-emerald-300/30 bg-[linear-gradient(135deg,#4ade80,#2dd4bf)] text-slate-950 shadow-[0_0_28px_rgba(45,212,191,0.24)] hover:scale-[1.01] hover:brightness-110",
  ghost:
    "border border-cyan-300/18 bg-cyan-300/8 text-cyan-50 hover:border-cyan-300/50 hover:bg-cyan-300/12",
};

export default function ActionButton({
  onClick,
  loading,
  disabled,
  children,
  variant = "primary",
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Processing...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
