import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getReportMarkdown } from '@/lib/secagent/api'
import type { ScanReportVM } from '@/lib/secagent/types'
import { VulnCard } from './VulnCard'

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

type ExtendedScanReportVM = ScanReportVM & {
  risk_level?: RiskLevel
  risk_formula?: string
}

function countBySeverity(vulns: ScanReportVM['vulnerabilities']) {
  const o = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 }

  for (const v of vulns) {
    const k = v.severity as keyof typeof o

    if (k in o) {
      o[k]++
    }
  }

  return o
}

function fallbackRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'HIGH'
  if (score >= 35) return 'MEDIUM'
  return 'LOW'
}

function RiskRing({
  score,
  level,
}: {
  score: number
  level?: RiskLevel
}) {
  const r = 52
  const c = 2 * Math.PI * r
  const targetOff = c * (1 - Math.min(100, score) / 100)

  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const [animatedOff, setAnimatedOff] = useState(() => (reduced ? targetOff : c))

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)

    mq.addEventListener('change', onChange)

    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reduced) return

    const id = requestAnimationFrame(() => setAnimatedOff(targetOff))

    return () => cancelAnimationFrame(id)
  }, [reduced, targetOff])

  const off = reduced ? targetOff : animatedOff
  const riskLevel = level || fallbackRiskLevel(score)

  return (
    <div className="relative mx-auto h-36 w-36">
      <svg className="-rotate-90 transform" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#1a1f1a"
          strokeWidth="8"
        />

        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#g)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-[1.2s] motion-safe:ease-out motion-reduce:transition-none"
        />

        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5bc238" />
            <stop offset="100%" stopColor="#76ed4b" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-4xl font-bold text-green">{score}</div>

        <div className="font-mono text-[10px] text-muted">/ 100</div>

        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-green-dim">
          {riskLevel} RISK
        </div>
      </div>
    </div>
  )
}

export function ScanReport({
  report,
  useMock,
  onToast,
}: {
  report: ScanReportVM
  useMock: boolean
  onToast: (msg: string) => void
}) {
  const extendedReport = report as ExtendedScanReportVM
  const counts = countBySeverity(report.vulnerabilities)
  const total = report.vulnerabilities.length || 1
  const w = (n: number) => `${(n / total) * 100}%`

  const riskLevel = extendedReport.risk_level || fallbackRiskLevel(report.risk_score)
  const riskFormula =
    extendedReport.risk_formula ||
    'Risk score is severity-weighted. Higher means more risk.'

  async function download() {
    if (useMock) {
      const blob = new Blob(
        [
          `SecAgent report (mock)\n\n${report.summary}\n\n${JSON.stringify(
            report.vulnerabilities,
            null,
            2,
          )}`,
        ],
        { type: 'text/plain' },
      )

      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `report_${report.target.replace(/[^a-z0-9]/gi, '_')}.txt`
      a.click()
      URL.revokeObjectURL(a.href)
      onToast('Downloaded demo file')

      return
    }

    try {
      const md = await getReportMarkdown()
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `report_${report.target.replace(/[^a-z0-9]/gi, '_')}.md`
      a.click()
      URL.revokeObjectURL(a.href)
      onToast('Report downloaded')
    } catch (e) {
      onToast(e instanceof Error ? e.message.slice(0, 80) : 'Report not available')
    }
  }

  return (
    <div className="animate-fade-up relative z-10 mx-auto max-w-5xl px-6 pb-32">
      <div className="mb-10 grid gap-8 rounded-xl border border-border bg-surface/80 p-8 backdrop-blur-sm md:grid-cols-[200px_1fr]">
        <RiskRing score={report.risk_score} level={riskLevel} />

        <div>
          <div className="font-mono text-xs text-green-bright">
            // {report.target}
          </div>

          <p className="mt-2 text-sm leading-relaxed text-muted">
            {report.summary}
          </p>

          <div className="mt-2 font-mono text-[10px] text-faint">
            {report.scanned_at} · {report.model_used}
          </div>

          <div className="mt-2 font-mono text-[10px] text-green-dim/80">
            {riskFormula}
          </div>

          <div className="mt-6 flex h-3 w-full overflow-hidden rounded-full bg-border">
            {counts.CRITICAL > 0 && (
              <div
                className="bg-risk-critical"
                style={{ width: w(counts.CRITICAL) }}
                title="Critical"
              />
            )}

            {counts.HIGH > 0 && (
              <div
                className="bg-risk-high"
                style={{ width: w(counts.HIGH) }}
                title="High"
              />
            )}

            {counts.MEDIUM > 0 && (
              <div
                className="bg-risk-medium"
                style={{ width: w(counts.MEDIUM) }}
                title="Medium"
              />
            )}

            {counts.LOW > 0 && (
              <div
                className="bg-risk-low"
                style={{ width: w(counts.LOW) }}
                title="Low"
              />
            )}

            {counts.INFO > 0 && (
              <div
                className="bg-risk-info"
                style={{ width: w(counts.INFO) }}
                title="Info"
              />
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-muted">
            {Object.entries(counts).map(([k, n]) =>
              n > 0 ? (
                <span key={k}>
                  {k}: {n}
                </span>
              ) : null,
            )}
          </div>

          <button
            type="button"
            onClick={download}
            className="mt-6 inline-flex items-center gap-2 border border-green bg-green/10 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-green hover:bg-green/20"
          >
            <Download className="h-4 w-4" />
            Download report
          </button>
        </div>
      </div>

      <h2 className="mb-4 font-display text-2xl font-semibold text-text">
        Findings
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {report.vulnerabilities.map((v) => (
          <VulnCard key={v.id || v.description} v={v} />
        ))}
      </div>

      {report.secure_coding_tips.length > 0 && (
        <div className="mt-10 rounded-lg border border-border bg-surface p-6">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-green">
            Hardening tips
          </h3>

          <ul className="space-y-2 text-sm text-muted">
            {report.secure_coding_tips.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-green">//</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}