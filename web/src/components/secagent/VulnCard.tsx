import { ChevronDown, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { VulnerabilityVM } from '@/lib/secagent/types'

function severityStyle(sev: string): { border: string; bar: string; text: string } {
  switch (sev) {
    case 'CRITICAL':
      return { border: 'hover:border-risk-critical', bar: 'bg-risk-critical', text: 'text-risk-critical' }
    case 'HIGH':
      return { border: 'hover:border-risk-high', bar: 'bg-risk-high', text: 'text-risk-high' }
    case 'MEDIUM':
      return { border: 'hover:border-risk-medium', bar: 'bg-risk-medium', text: 'text-risk-medium' }
    case 'LOW':
      return { border: 'hover:border-risk-low', bar: 'bg-risk-low', text: 'text-risk-low' }
    case 'INFO':
      return { border: 'hover:border-risk-info', bar: 'bg-risk-info', text: 'text-risk-info' }
    default:
      return { border: 'hover:border-muted', bar: 'bg-muted', text: 'text-muted' }
  }
}

export function VulnCard({ v }: { v: VulnerabilityVM }) {
  const [open, setOpen] = useState(false)
  const st = severityStyle(v.severity)

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]',
        st.border,
      )}
    >
      <div className={cn('absolute left-0 top-0 h-full w-1', st.bar)} />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 p-4 pl-5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide',
                'border border-border bg-bg',
                st.text,
              )}
            >
              {v.severity}
            </span>
            <span className="font-mono text-[10px] text-muted">{v.type}</span>
          </div>
          <h3 className="font-display text-lg font-medium text-text">{v.description.split('\n')[0]}</h3>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {[v.cwe_id, v.cve_id, v.cvss ? `CVSS ${v.cvss}` : null].filter(Boolean).join(' · ') ||
              `${v.id || 'finding'}`}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-muted">{v.description}</p>
        </div>
        <ChevronDown
          className={cn('mt-1 h-5 w-5 shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="animate-fade-up border-t border-border px-4 py-4 pl-5">
          {v.endpoint && (
            <div className="mb-3">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">
                Affected endpoint
              </div>
              <div className="font-mono text-xs text-green-bright">{v.endpoint}</div>
            </div>
          )}
          {v.vulnerable_code && (
            <div className="mb-3">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">
                Evidence
              </div>
              <pre className="overflow-x-auto rounded border border-border bg-bg p-3 font-mono text-[11px] text-muted">
                {v.vulnerable_code}
              </pre>
            </div>
          )}
          {v.impact && (
            <div className="mb-3">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">
                Impact
              </div>
              <p className="text-sm text-muted">{v.impact}</p>
            </div>
          )}
          {v.fix && (
            <div className="mb-3">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">
                Remediation
              </div>
              {v.fix.patched_code && (
                <pre className="mb-2 overflow-x-auto rounded border border-green/20 bg-green/5 p-3 font-mono text-[11px] text-green-bright">
                  {v.fix.patched_code}
                </pre>
              )}
              <p className="text-sm text-muted">{v.fix.explanation}</p>
              {v.fix.additional_steps.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-sm text-muted">
                  {v.fix.additional_steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <a
            href="https://owasp.org"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-green hover:underline"
          >
            OWASP reference <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </article>
  )
}
