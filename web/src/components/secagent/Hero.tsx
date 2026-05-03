import { MODULES_DEFAULT, MODEL_UI_LABEL } from '@/lib/secagent/constants'

const MODULE_COUNT = MODULES_DEFAULT.length

export function Hero() {
  return (
    <section className="relative z-10 mx-auto max-w-3xl px-6 pt-12 pb-10 text-center">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-green/30 bg-surface/50 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        <span className="text-green">●</span>
        Read-only · won&apos;t touch your data
      </div>

      <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl md:text-7xl lg:text-[4.25rem]">
        <span className="hero-type-first block text-text motion-reduce:opacity-100">Controlled VM</span>
        <span className="hero-type-second mt-1 block text-green hero-glow">Security Review</span>
      </h1>

      <p className="mx-auto mt-8 max-w-xl text-[15px] font-light leading-relaxed text-muted">
        Read-only findings from an approved lab target. Get a{' '}
        <strong className="font-medium text-text/95">clear defensive readout</strong> on headers, CORS,
        and surface signals—without write access or host changes.
      </p>

      <p className="mx-auto mt-6 max-w-2xl font-mono text-[12px] leading-relaxed text-green-bright/90 sm:text-[13px]">
        <span className="text-green-dim">&gt;</span>{' '}
        {MODEL_UI_LABEL.toLowerCase()} · {MODULE_COUNT} detection modules · read-only by design
      </p>

      <p className="mx-auto mt-8 max-w-lg text-[11px] leading-relaxed text-faint">
        Scanned host is set in server{' '}
        <code className="font-mono text-green-dim/90">.env</code> (
        <code className="font-mono text-green-dim/90">TARGET_URL</code>
        ). The field below is only context for the review goal.
      </p>
    </section>
  )
}
