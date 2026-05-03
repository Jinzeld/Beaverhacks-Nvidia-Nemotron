import { useEffect, useRef } from 'react'

interface ScanTerminalProps {
  lines: string[]
  progress: number
  chip: string
  visible: boolean
}

export function ScanTerminal({ lines, progress, chip, visible }: ScanTerminalProps) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  if (!visible) return null

  return (
    <div className="animate-fade-up relative z-10 mx-auto max-w-3xl px-6 pb-8">
      <div className="overflow-hidden rounded-lg border border-border bg-[#050605] shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-[10px] text-muted">secagent — scan</span>
        </div>
        <div
          className="max-h-56 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-green-bright/90 motion-reduce:scroll-auto"
          aria-live="polite"
          aria-busy="true"
        >
          {lines.map((line, i) => (
            <div key={`${i}-${line.slice(0, 12)}`} className="whitespace-pre-wrap text-muted">
              <span className="text-green-dim">&gt; </span>
              {line}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] text-muted">
            <span
              key={chip}
              className="motion-safe:animate-fade-up rounded-full border border-border px-2 py-0.5 text-green-dim"
            >
              {chip}
            </span>
            <span className="text-green">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-dim to-green shadow-[0_0_12px_rgba(118,237,75,0.5)] motion-safe:transition-[width] motion-safe:duration-300 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
