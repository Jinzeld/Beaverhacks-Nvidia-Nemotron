import { Zap } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MODEL_UI_LABEL } from '@/lib/secagent/constants'
import type { Phase } from '@/lib/secagent/types'

interface ScanFormProps {
  phase: Phase
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled: boolean
  useMock: boolean
}

function CornerBrackets({ active }: { active: boolean }) {
  const line = cn('absolute h-3 w-3 border-green transition-opacity', active ? 'opacity-100' : 'opacity-50')
  return (
    <>
      <span className={cn(line, 'left-0 top-0 border-l-2 border-t-2')} />
      <span className={cn(line, 'right-0 top-0 border-r-2 border-t-2')} />
      <span className={cn(line, 'bottom-0 left-0 border-b-2 border-l-2')} />
      <span className={cn(line, 'bottom-0 right-0 border-b-2 border-r-2')} />
    </>
  )
}

function statusLabel(phase: Phase): string {
  if (phase === 'scanning') return 'SCANNING…'
  return 'READY'
}

export function ScanForm({ phase, value, onChange, onSubmit, disabled, useMock }: ScanFormProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div
      className={cn(
        'relative z-10 mx-auto max-w-3xl px-6 transition-all duration-500',
        disabled && 'pointer-events-none opacity-0',
      )}
    >
      <div
        className={cn(
          'relative rounded-lg border bg-surface/80 p-1 transition-shadow duration-300',
          focused
            ? 'border-green/60 shadow-[0_0_0_1px_rgba(118,237,75,0.25),0_0_32px_rgba(118,237,75,0.12)]'
            : 'border-border',
        )}
      >
        <CornerBrackets active={focused} />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="flex min-w-0 flex-1">
            <div className="flex items-center border-r border-border/80 bg-bg/50 px-3 font-mono text-xs font-medium text-green">
              TARGET://
            </div>
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => e.key === 'Enter' && !disabled && onSubmit()}
                placeholder="example.com or 192.168.1.1"
                title="Note for the review goal only. The scanned host is TARGET_URL in the server .env."
                className="w-full min-w-0 bg-transparent py-3.5 pl-3 pr-3 font-mono text-sm text-green-bright caret-green-bright placeholder:text-faint/80 focus:outline-none"
                disabled={disabled}
                aria-describedby="scan-target-hint"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!disabled) onSubmit()
            }}
            disabled={disabled}
            className="group flex shrink-0 items-center justify-center gap-2 bg-green px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-[#070808] disabled:opacity-50"
          >
            <Zap className="h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:-rotate-6 motion-safe:group-hover:scale-110" />
            Scan
          </button>
        </div>
      </div>
      <p id="scan-target-hint" className="sr-only">
        User input is sent only as context inside the review goal. The real scan target comes from
        server environment variables.
      </p>
      <div className="mt-4 flex flex-col gap-1 font-mono text-[10px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="text-green">●</span> STATUS: {statusLabel(phase)}
          {useMock ? <span className="ml-2 text-faint">(demo data)</span> : null}
        </span>
        <span className="text-right text-muted">
          MODEL: {MODEL_UI_LABEL} · MODE: READ-ONLY
        </span>
      </div>
    </div>
  )
}
