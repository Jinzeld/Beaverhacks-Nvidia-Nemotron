export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center border-2 border-green font-mono text-sm font-bold text-green">
            S
          </div>
          <div>
            <div className="font-display text-xl font-semibold tracking-wide text-green">
              SecAgent
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              NVIDIA NIM · NEMOTRON 3 NANO
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted sm:inline">
            V0.4.2-EDGE
          </span>
          <div className="border border-green bg-transparent px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-green shadow-[0_0_16px_rgba(118,237,75,0.12)]">
            BEAVERHACKS 2026
          </div>
        </div>
      </div>
    </header>
  )
}
